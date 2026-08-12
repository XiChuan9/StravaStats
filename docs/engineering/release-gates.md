# StravaStats v2 Release Gates

| 字段 | 内容 |
| --- | --- |
| Status | Proposed |
| Owner | XiChuan9 |
| Created | 2026-07-28 |
| Last updated | 2026-08-12 |
| Related plan | [V2 Development Plan](./v2-development-plan.md) |

## 1. 目的

Release Gate 是阻断条件，不是建议清单。功能“看起来可用”不能替代测试、迁移、隐私和回滚证据。

每项 Gate 必须记录：

| 字段 | 说明 |
| --- | --- |
| Evidence | 日志、测试结果、截图、报告或 PR 链接 |
| Verified by | 验证者 |
| Verified at | 日期与环境 |
| Result | Pass / Fail / Blocked / Not applicable |
| Related PR | 引入或修复该能力的 PR |

没有证据的检查项不得标记为 Pass。

## 2. 当前能力声明

PR-00 建立了以下最低自动能力，当前 integration 继续执行：

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
```

GitHub Actions 在 Node 24 LTS 上执行相同检查。当前确定性测试覆盖 Feature Flag、
Repository、Storage V6、Import、CSV/ZIP/FIT/TCX/GPX Decoder、Backup format 3、
Source Manager Connect/Disconnect/Sync/Recover/Abandon/Retry、Repository consumers、
Service Worker policy/lifecycle、隐私边界和已冻结的性能样本。测试数会随独立任务变化，
因此以 exact-head CI 和
[PR-24 current-tree supplement](../tasks/pr-24-release-documentation.md#superseding-current-tree-ledger)
记录的精确基线为准。

这些自动证据不替代真实账户/私人资料库、Safari/Firefox/Windows/iOS/PWA、生产式
Service Worker/部署/联合回滚、公共 Git 历史处置、性能预算豁免、版本/制品或发布负责人
批准。没有执行的环境 Gate 仍为 `PARTIAL`、`BLOCKED` 或 `NOT RUN`。

### 2.1 当前外部与环境门禁

以下结果直接约束当前 `integration/v2@eb0b6695b5dbf618877ff794dbc76935babeb793`。
确定性代码/测试通过不能把这些行提升为 `PASS`：

| Evidence class | Result | Missing evidence or decision |
| --- | --- | --- |
| Real account / private library | NOT RUN | 授权的真实 OAuth、Disconnect、Legacy/V2 私人资料库、真实导入、Backup 恢复与 parity/Shadow 复核 |
| Browser / platform | BLOCKED | Safari、Firefox、Windows、iOS/PWA、mobile、广泛 accessibility 矩阵或有时限豁免 |
| Production Service Worker / deployment / combined rollback | BLOCKED | 生产式 mixed-version、cold-offline、cache eviction、部署失败和完整回滚演练及授权 |
| R3 public Git history | BLOCKED | Privacy/security owner 的 incident disposition；当前树移除不等于公共历史闭合 |
| Version / tag / artifact / release owner | BLOCKED | Package 仍为 `1.0.0`；没有 V2 tag、GitHub Release、artifact、deployment 或 release-owner approval |

性能也保持 `PARTIAL`：5,000 activities 与 200,000 points 的确定性证据已通过，
10,000 activities 与 1,000 FIT throughput 仍只有记录性结果，没有批准的绝对预算或豁免。

## 3. PR Gate

每个功能 PR 必须满足：

- [ ] Task Brief 状态为 `Approved for implementation`；
- [ ] 依赖 PR 已合并；
- [ ] 必需 ADR 已为 `Accepted`，或任务明确不依赖未决部分；
- [ ] 修改文件没有超出允许范围；
- [ ] `npm ci` 成功；
- [ ] `npm run check:syntax` 成功；
- [ ] `npm run check:privacy` 成功；
- [ ] `npm test` 成功；
- [ ] 本任务专项测试成功；
- [ ] `git diff --check` 无错误；
- [ ] 无真实运动、GPS、健康数据或凭据；
- [ ] 数据迁移影响已说明；
- [ ] 回滚步骤可执行；
- [ ] 人工验收项目已列出；
- [ ] 未执行的验证被明确报告，没有伪装成 Pass。

纯文档 PR 也必须执行 `npm ci`、syntax、privacy、完整 `npm test`、专项文档测试、
`git diff --check` 和 literal changed-path gate；未执行项必须明确报告。

## 4. Integration Gate

功能 PR 合入 `integration/v2` 前后必须满足：

- [ ] `integration/v2` CI 通过；
- [ ] Feature Flag 默认值符合当前迁移阶段；
- [ ] Legacy 路径仍可启动；
- [ ] Canonical 写入或读取失败不会破坏 Legacy 数据；
- [ ] 跨 PR Repository、Storage 和 Import 集成测试通过；
- [ ] 热点文件没有未解决的并行冲突；
- [ ] 数据库 migration 可重复执行；
- [ ] 新增错误有可观察、无隐私泄漏的诊断信息。

## 5. Alpha Gate

`v2.0.0-alpha.1` 重点验证架构与 Shadow Mode：

- [ ] Baseline Tag 和 `maintenance/v1` 存在；
- [ ] Legacy Cache 可导出、验证和恢复；
- [ ] Canonical Contracts 已接受；
- [ ] Repository 收口完成；
- [ ] IndexedDB v2 与 Legacy 数据物理隔离；
- [ ] Shadow Writer 不改变页面读取路径；
- [ ] Parity Report 可以导出并解释差异；
- [ ] Feature Flag 可以切回 Legacy。

## 6. Beta Gate

`v2.0.0-beta.1` 重点验证导入和本地使用：

- [ ] Synthetic JSON 纵向切片通过；
- [ ] `activities.csv` 导入通过；
- [ ] Strava ZIP 安全与关联测试通过；
- [ ] FIT、TCX、GPX Decoder 矩阵通过；
- [ ] 同一文件重复导入不生成重复活动；
- [ ] 单文件失败不影响同批成功项目；
- [ ] 无 Strava Token 可以启动并浏览本地数据；
- [ ] Summary-only 和缺失能力场景可以降级；
- [ ] Source Manager 和 Import Report 可用。

## 7. Release Candidate Gate

`v2.0.0-rc.1` 必须满足：

- [ ] CSV/FIT/TCX/GPX 全部通过回归矩阵；
- [ ] 完整资料库备份与新环境恢复通过；
- [ ] Exact Identity Resolver 通过；
- [ ] 模糊重复不会自动合并；
- [ ] 汇总页面 Legacy/Canonical Parity 已审阅；
- [ ] Activity Detail 能读取本地 Streams；
- [ ] Run Plus / NSM 回归通过；
- [ ] Service Worker 更新与旧缓存淘汰策略通过；
- [ ] 5,000/10,000 活动和大 Stream 性能达到预算或记录豁免；
- [ ] 迁移和发布回滚演练完成；
- [ ] 未解决的 P0/P1 缺陷为零。

## 8. Production Release Gate

`v2.0.0` 发布必须满足：

- [ ] 无 Strava Token 正常启动；
- [ ] Strava Disconnect 不删除本地资料库；
- [ ] Legacy Cache 可恢复；
- [ ] CI 全部通过；
- [ ] 所有 P0 数据源导入通过；
- [ ] 数据库备份恢复通过；
- [ ] Exact Duplicate 通过；
- [ ] 汇总页面 Parity 通过；
- [ ] 详情页能力降级通过；
- [ ] Run Plus / NSM 通过；
- [ ] Shadow 差异已审阅；
- [ ] Canonical 可以切回 Legacy；
- [ ] 无隐私数据进入 Git、日志或外部埋点；
- [ ] Migration、Backup、Privacy、Troubleshooting 文档完成；
- [ ] 最终回滚演练完成；
- [ ] 发布负责人明确批准。

## 9. 豁免政策

以下项目不得豁免：

- 数据丢失风险；
- 破坏 Legacy Cache；
- 真实隐私数据进入 Git 或日志；
- 无法回滚；
- Exact Duplicate 产生第二条活动；
- Strava Disconnect 删除本地活动；
- 未经授权把活动数据发送外部服务。

性能、浏览器边缘兼容等非数据安全项可以提出限时豁免，但必须记录：

- 原因；
- 用户影响；
- 临时缓解；
- Owner；
- 到期日期；
- 后续任务。

## 10. Gate 失败处理

Gate 失败时：

1. 停止合并或发布；
2. 保存失败证据和环境信息；
3. 判断是代码缺陷、测试缺陷还是环境问题；
4. 创建范围明确的修复任务；
5. 重新执行全部受影响 Gate；
6. 不通过修改检查结果或删除失败测试来绕过。
