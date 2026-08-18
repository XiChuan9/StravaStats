# StravaStats v2 回滚计划

| 字段 | 内容 |
| --- | --- |
| Status | Proposed |
| Owner | XiChuan9 |
| Created | 2026-07-28 |
| Last updated | 2026-07-28 |
| Related gates | [Release Gates](../engineering/release-gates.md) |

## 1. 目标

回滚不是“重新部署旧 commit”这么简单。V2 需要分别处理应用代码、Feature Flag、Service Worker、IndexedDB、导入数据、备份和用户期望。

任何回滚都不得为了恢复页面而删除用户资料。

## 2. 不变量

- Legacy DB 不被 V2 原地升级；
- V2 DB 不反向写入 Legacy Cache；
- 切换模式不删除任一数据库；
- RawArtifact 和私人备份不因应用回滚被删除；
- 恢复失败不覆盖当前可用资料库；
- 用户明确执行“删除资料库”之前，Disconnect/Logout/Token 失败均不删除活动；
- 每个 PR 必须记录数据影响和 rollback command/procedure。

## 3. 回滚层次

### 3.1 Feature Flag 回滚

首选紧急恢复：

```js
dataRepositoryMode = 'legacy'
```

预期：

- 页面重新使用 Legacy Repository；
- Canonical DB 保留；
- 后台双写/导入按故障范围关闭；
- 记录 fallback 原因；
- 不要求用户重新授权即可读取现有 Legacy 数据。

适用于 Repository、Projection、Canonical 读取和页面 cutover 问题。

### 3.2 单 PR 回滚

每个 PR 描述必须包含：

```text
Revert target
Feature Flag
Changed database/schema
Created user data
Cache/Service Worker impact
Recovery verification
```

优先使用新的 revert commit，不改写共享历史。若 PR 已写入用户数据，先评估兼容性和导出，再回滚代码。

### 3.3 发布回滚

```text
停止新部署
→ Feature Flag 切 Legacy
→ Vercel 回退上一稳定部署
→ 更新/清理对应 Service Worker cache version
→ Revert Release PR
→ 执行 Legacy smoke test
→ 保存故障和回滚证据
```

Service Worker 必须与部署回滚一起处理，否则浏览器可能继续运行新旧混合资源。

### 3.4 用户数据恢复

数据恢复与应用回滚分开：

1.冻结新的导入/merge；
2.导出当前 V2 资料库；
3.验证最近成功备份；
4.在 staging 数据库恢复；
5.校验 hash、record count、时间范围和引用完整性；
6.用户确认；
7.切换到恢复后的数据库或明确导入；
8.保留故障库用于诊断，除非用户确认删除。

## 4. 场景 Runbook

### Canonical 页面结果错误

```text
切回 legacy
→ 导出 Parity Report
→ 禁止继续 cutover
→ 保留 Canonical DB
→ 创建回归任务
```

### Shadow 写入失败

```text
页面继续 Legacy
→ 关闭 canonicalShadowWriteEnabled
→ 保存错误与 Import/Migration 状态
→ 不重建或清空 V2 DB
```

### IndexedDB migration 失败

```text
停止新写入
→ 事务自动回滚
→ migration 标记 failed
→ 切 Legacy
→ 导出诊断
→ 修复后在副本/测试环境重试
```

### 导入造成错误活动

```text
停止相关 Import Job
→ 保留 RawArtifact 和 Import Log
→ 识别受影响 activityIds
→ 禁用相关 Decoder 版本
→ 从备份或重新解析恢复
→ 不进行模糊批量删除
```

### Strava Disconnect 删除风险

如果发现 disconnect 仍会删除本地活动：

```text
立即阻止 PR/发布
→ 禁用 disconnect 操作或切旧 UI
→ 尝试 Legacy Rescue Reader
→ 从私人导出恢复
→ 增加回归测试
```

### Service Worker 混合版本

```text
确认当前 deployment 和 cache version
→ 停止注册错误 worker
→ 激活正确版本
→ 提供人工 unregister/cache cleanup 指引
→ 重新执行页面 smoke test
```

## 5. 数据兼容窗口

V2 正式发布后仍需保留：

- Legacy Repository；
- Legacy Cache Reader；
- `dataRepositoryMode=legacy`；
- Legacy migration/export 工具；
- 至少一个经过验证的 V1 部署/标签。

删除时间必须由独立任务、使用数据和回滚演练决定，不与 V2 首次发布绑定。

## 6. 回滚演练

Release Candidate 前至少演练：

1. canonical → legacy；
2.失败 migration → legacy；
3.坏部署 → 上一部署；
4. Service Worker 新旧版本切换；
5.空浏览器从备份恢复；
6.恢复中断；
7.断开 Strava 后继续浏览本地活动。

每次演练记录：

```text
date
commit/deployment
browser
database versions
steps
result
duration
data counts
unexpected behavior
follow-up
```

真实数据计数和截图保存在私有证据目录。

## 7. Stop conditions

以下情况不得继续发布：

- 无法切回 Legacy；
- 旧缓存不可读且无备份；
- migration 不幂等；
- 恢复会覆盖当前资料库；
- Service Worker 无法稳定切换；
- 回滚要求手工删除整个站点数据；
- 故障可能泄露隐私；
- 没有明确 Owner 和恢复证据。

## 8. Ownership

每次发布必须指定：

- Release owner；
- Migration owner；
- Rollback decision owner；
- 验证者；
- 用户沟通负责人。

个人项目中可以是同一人，但角色和确认动作仍需记录。

## 9. PR-21 backup/restore rollback note

PR-21 没有 schema、store、index、database version、Repository default、Service Worker 或
deployment 变化。代码回滚使用普通 revert commit；已经成功写入的 V4 资料库和私人备份
文件继续保留，不需要逆向 migration。

本 PR 的恢复策略不是 staging/rename/swap。它只允许 absent 或 exact empty V4 target，并在
单一 IndexedDB transaction 中提交全部 13 stores。失败、quota、取消和中断依赖 transaction
abort 保留原目标；不同的 non-empty library 返回安全冲突，不提供 clear/delete/overwrite。
同一备份重复执行幂等。数据库提交后若 durable settings 未全部添加，状态为
`SETTINGS_PENDING`，应重复选择同一备份补齐；不得删除数据库或覆盖现有 setting 作为修复。

Legacy `strava-dashboard-cache`、Legacy localStorage/cache、provider connection、Token、Cache
Storage 和 Service Worker 不在备份/恢复边界内。切回 Legacy feature flag 仍是应用回滚路径，
且不会删除已恢复的 V4 数据。

## 10. PR-42 V5 SourceConnection and backup rollback note

PR-42 的 V4 -> V5 迁移只新增空 `sourceConnections` store、唯一 `byProvider` index 和第五条
migration，保留 V4、Legacy 和所有逻辑记录。代码回滚使用普通 revert/feature disable；不得
downgrade、delete、clear 或重建已经成功写入的 V5。若旧 build 返回 `VersionError`，应切换
到支持 V5 且 fail-closed 的 build，或显式使用保持隔离的 Legacy read path，同时保留 V5。

SourceConnection 的 disconnected tombstone 不等同于删除本地数据，也不授权 Token revoke。
回滚不会删除 identity、历史 `lastSyncAt`、活动、ActivitySource、RawArtifact、Import/review、
setting、backup 或 Legacy 数据。C2 没有 OAuth、Token、provider、Worker、Service Worker 或
deployment side effect。

Format 2/V5 备份和用户保存的旧 format 1/V4 备份都继续保留。restore 只接受 absent 或 exact
empty V5 target；所有验证先于写入，14-store transaction abort 处理取消、quota、constraint
和中断。旧 format 1 经严格 profile 验证后只 additive 转换为 V5，不创建连接身份。不得通过
删除现有 V5、覆盖不同 tombstone 或修改私人备份来规避安全冲突。
