# PR-01：Legacy Cache Rescue 与鉴权解耦

## Metadata

| Field | Value |
| --- | --- |
| Status | Ready for investigation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/legacy-rescue` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/legacy-rescue` |
| Owner | XiChuan9 |
| Reviewer | 独立 Codex 线程 + XiChuan9 |
| Related PRD | Sections 2.3、4.1、8.1、8.2、8.7、8.8、9.1、Epic C、20 |
| Related plan | Sprint 0 / PR 01 |
| Related ADRs | ADR-0003（Proposed，仅作后续边界背景；本 PR 不冻结其未决契约） |
| Dependencies | PR-00 已合并；V1 baseline、`maintenance/v1`、`integration/v2` 和本任务 worktree 已建立 |
| Pull request | Pending |

## Goal

在创建 IndexedDB v2、Canonical 双写或本地导入能力之前，为现有 Legacy
活动缓存建立非破坏性的发现、导出、校验和可验证恢复路径，并把 Strava
鉴权生命周期与本地活动数据生命周期解耦。

目标行为是：

- Rescue Reader 可以绕过 TTL 和 `cacheVersion` 限制读取旧缓存；
- 导出包可校验、可用于隔离环境恢复；
- logout、disconnect、Token 过期、刷新失败、401 和 403 不自动删除活动；
- 断开 Strava 与删除本地数据保持为两个独立动作；
- Legacy 默认页面行为继续可回退。

## Why now

已确认的迁移基线指出，Legacy IndexedDB 当前是缓存而非长期资料库，
logout/disconnect 与活动缓存清理耦合，且当前尚没有已验证并私下保存的
Legacy 导出。Git 回滚无法恢复浏览器 IndexedDB；若在救援路径建立前开始
IndexedDB v2、Canonical 或导入开发，唯一的浏览器数据副本可能无法恢复。

因此 PR-01 是后续用户数据迁移的阻断前置任务。

## Investigation questions

调查阶段只读回答：

1. `js/app/auth.js` 中 logout、disconnect、Token 检查和鉴权状态转换的精确调用图是什么？
2. 401、403、Token 过期和刷新失败分别从哪些文件、函数和 UI 路径进入？
3. `getCachedActivities`、`saveCachedActivities` 和
   `clearCachedActivities` 的全部调用者、参数和副作用是什么？
4. `strava-dashboard-cache` 的打开、升级、读取、写入、清空和删除路径是什么？
5. IndexedDB entry 的 `timestamp`、`cacheVersion` 和 TTL 如何校验？
6. localStorage fallback 在成功、空值、malformed JSON、quota、读写异常和
   IndexedDB 打开失败时分别如何表现？
7. `getCachedActivities` 的默认参数是否真的满足 Rescue Reader 的全部要求，
   包括只读、不更新时间、不触发网络、区分来源、返回 warning，以及读取旧版本
   或损坏 fallback 时的行为？
8. Demo Token、Demo activities、真实 Legacy activities 和 metadata 的生命周期
   边界在哪里，是否存在混入导出的路径？
9. Settings 或其他 UI 当前有哪些“断开 Strava”“logout”和“删除本地数据”入口？
10. Service Worker、固定缓存名、localhost 策略和多 worktree 是否会使人工验证
    运行到错误版本？
11. 当前 `node:test` 环境能否可靠模拟 IndexedDB；PR-01 是否需要
    `fake-indexeddb` 或等价的隔离实现？
12. Rescue Reader、导出、SHA-256、恢复和事务回滚所需的最小实现边界是什么？
13. 哪些文件是实现所必需的热点文件，哪些文件可以保持不变？
14. 无真实账号、无真实运动数据时，如何证明鉴权与数据生命周期已解耦？
15. 哪些接口、UI 文案、导出容器格式和恢复目标仍需项目负责人决定？

## Confirmed current-state facts

以下事实仅来自已批准或已验证的仓库文档；调查必须与代码重新核对：

- V1 baseline 状态为 `Verified with limitations`；
- baseline 已确认 Legacy IndexedDB 是缓存，不是长期资料库；
- baseline 已确认 logout/disconnect 与活动缓存清理耦合；
- baseline 未执行 Disconnect/Logout，因为没有 Legacy 私有备份；
- baseline 尚未完成 Legacy Cache 的导出和私下保存；
- baseline 指出 localhost Service Worker 可能影响多 worktree 验证；
- PR-00 已建立 `npm ci`、syntax、privacy 和 `node:test` 最低检查；
- Migration 文档列出的待核对 Legacy IndexedDB 为
  `strava-dashboard-cache` version 1、store `entries`、key
  `strava_activities`；
- Migration 文档列出了 IndexedDB 值中的 `activities`、`timestamp`、
  `cacheVersion`，以及若干 localStorage fallback/metadata key；
- Development Plan 将 Rescue Reader、旧缓存导出、鉴权解耦、Demo 隔离和
  恢复测试列为 PR-01；
- Canonical Schema、IndexedDB v2、Repository 长期契约和完整 Canonical
  Backup/Restore 属于后续任务。

以上条目不代表相关函数、键名、错误分支或调用路径已完成代码级确认。

## Decisions required before implementation

只读调查完成后，由项目负责人确认：

- 最小允许文件集合和热点文件 Owner；
- Rescue Reader 的公开接口、返回类型、错误与 warning 语义；
- 导出容器形式、文件编码、稳定序列化规则和下载入口；
- SHA-256 使用的运行时 API 和不支持场景；
- 第一版恢复目标是 Legacy 原位恢复、隔离 Legacy 恢复，还是其他明确目标；
- 恢复冲突、重复 entry、部分 metadata 和事务失败的处理规则；
- logout 与 disconnect 是否为同一用户动作，及其目标状态机和文案；
- 远端撤销失败时本地 Token/Source Connection 的最终状态和可重试行为；
- “删除本地数据”入口是否进入 PR-01；若进入，其二次确认和精确删除范围；
- Demo 数据从真实 Legacy 导出中排除的判定方式；
- 是否引入 `fake-indexeddb`，以及对应的 `package.json` /
  `package-lock.json` 修改；
- Service Worker 人工验证所需的版本识别和隔离步骤；
- Required automated checks 中 PR-01 专项测试的最终命令。

Task Brief 在负责人批准前不得改为 `Approved for implementation`。

## In scope

调查确认并批准后，PR-01 可包含：

1. 对 Legacy IndexedDB 和 localStorage fallback 的非破坏性 Rescue Reader；
2. 不检查 TTL、允许 `cacheVersion` 不匹配且不写回的旧缓存读取；
3. 明确区分 IndexedDB、localStorage、Demo、空缓存和读取错误；
4. Legacy 私有导出包、manifest、逐文件 SHA-256 和导出后校验；
5. 导出失败不修改或清理任何源数据；
6. 可验证的 Legacy 恢复路径及成功、失败和事务回滚测试；
7. logout、disconnect、Token 过期、刷新失败、401、403 与活动清理解耦；
8. “断开 Strava”和“删除本地数据”的生命周期边界；
9. 防止 Demo activities 混入真实 Legacy 导出；
10. 仅使用 deterministic synthetic 数据的自动测试；
11. 无真实账号条件下的隔离人工验证说明；
12. 与上述行为直接相关的最小文档更新。

## Out of scope

- 修改或冻结 Canonical Schema；
- 创建、升级或写入 IndexedDB v2；
- Canonical Repository、Shadow Writer 或 Legacy Projection 的长期实现；
- 完整 Canonical Backup/Restore（PR-21）；
- FIT、TCX、GPX、CSV 或 Strava ZIP 导入；
- 页面、导航、Settings、Source Manager 或视觉的顺便重构；
- Dashboard、Run、Bike、Swim、Run Plus、NSM 或分析算法修改；
- 通用 Repository 迁移；
- Service Worker 策略重构；
- 真实 Strava OAuth 集成验证；
- 真实运动数据 fixture、截图或导出进入仓库；
- 删除、覆盖或原地迁移现有 Legacy Cache。

## Allowed files

调查前的初步候选范围：

```text
docs/tasks/pr-01-legacy-cache-rescue.md
js/app/auth.js
js/services/activity-cache.js
js/services/api.js（仅调查证明鉴权错误路径需要时）
js/demo/**（仅 Demo/真实 Legacy 生命周期隔离所需的最小文件）
tests/legacy/**
tests/fixtures/synthetic/**（仅最小、确定性的 synthetic fixture 与 manifest）
package.json（仅负责人批准 fake-indexeddb 或等价测试依赖时）
package-lock.json（仅与获批测试依赖配套）
```

若调查建议新增独立 Rescue/Export/Restore 模块，必须先列出精确路径、职责和
依赖，并由项目负责人批准后加入允许范围。

Settings 或其他 UI 的现有入口文件必须先在调查中确认；在批准精确路径前不允许
修改。实施前必须把以上候选范围缩小为精确的最小集合。

## Prohibited files and operations

禁止文件和领域：

```text
js/data/**
docs/architecture/adr/**
docs/migrations/indexeddb-v2.md
js/analysis/**
js/tabs/**
styles/**
api/**（除非后续调查证明远端 revoke 的最小修复不可避免并获得单独批准）
sw.js
tests/fixtures/private/**
仓库外私人资料、导出、备份和 baseline evidence
```

禁止操作：

- 修改 Canonical Schema；
- 创建 IndexedDB v2；
- 删除、清空、覆盖或原地升级 Legacy Cache；
- 把恢复实现为先清空再写入；
- 使用真实 FIT、TCX、GPX、Strava ZIP、GPS、心率、功率或真实导出作为 fixture；
- 读取、枚举、复制或提交 `tests/fixtures/private/`；
- 在真实浏览器 profile 中运行可能清理用户缓存的 logout/disconnect；
- 将 Token、Authorization header、Cookie、原始私人活动或精确位置写入日志；
- 顺便重构页面、分析算法、样式或 Service Worker；
- 直接提交或推送到 `main`、`maintenance/v1` 或 `integration/v2`；
- 切换、删除、rebase、amend 或 force-push 分支；
- 合并 PR 或删除 worktree；
- 使用 `git add .`、`git add -A` 或隐式暂存任务外文件；
- 在负责人批准前实施产品代码或把状态改为
  `Approved for implementation`。

## Interfaces and expected outputs

本节只记录已有迁移要求，不冻结调查前的函数名或模块边界。

### Rescue Reader

应返回可机器判定的：

```text
status
source
activities
activityCount
earliestActivity
latestActivity
sourceDatabase
sourceDatabaseVersion
sourceCacheVersion
warnings
error
```

它必须只读、不检查 TTL、允许旧 `cacheVersion`、不更新时间或版本、不触发
Strava 网络请求，并区分 IndexedDB、localStorage、Demo、空缓存与读取错误。

### Legacy export

第一版至少输出：

```text
manifest.json
legacy-activities.json
legacy-athlete.json
legacy-zones.json
legacy-gears.json
legacy-settings.json
```

Manifest 至少包含：

```text
formatVersion
exportedAt
sourceDatabase
sourceDatabaseVersion
sourceCacheVersion
activityCount
earliestActivity
latestActivity
files + sha256
warnings
applicationCommit
```

具体 JavaScript 接口、容器格式和文件缺失语义由调查报告建议、负责人批准。

### Restore

恢复必须先校验 manifest 和 hashes，在隔离环境解析并展示数量、时间范围和
warning，用户确认后才写入明确目标。写入失败必须事务回滚，并产生
`imported` / `skipped` / `failed` 报告；导出包不得因恢复被删除。

## Acceptance criteria

- [ ] Rescue Reader 可以只读打开 Legacy IndexedDB；
- [ ] 未过期和已过期 IndexedDB cache 均可发现，且读取不更新时间；
- [ ] `cacheVersion` 不匹配的 entry 可读取并产生可解释 warning；
- [ ] localStorage fallback 可识别并与 IndexedDB 来源区分；
- [ ] malformed JSON、IndexedDB 打开失败、空缓存和读取错误可区分；
- [ ] Rescue Reader 不触发网络请求或清理；
- [ ] 导出包含规定文件、manifest 和逐文件 SHA-256；
- [ ] manifest 可解析，hash、活动数量和时间范围可校验；
- [ ] export 失败不修改源数据；
- [ ] Demo 数据不会混入真实 Legacy 导出；
- [ ] logout 保留活动；
- [ ] Token 过期、刷新失败、401 和 403 保留活动；
- [ ] disconnect 的远端撤销成功或失败均保留活动；
- [ ] 断开 Strava 与删除本地数据是独立动作；
- [ ] restore 成功、失败和事务回滚均有自动测试；
- [ ] 恢复不删除导出包或未授权的源数据；
- [ ] Legacy 默认页面行为无变化；
- [ ] 只使用 deterministic synthetic 测试数据；
- [ ] 没有 Canonical Schema、IndexedDB v2、页面重构或分析改动；
- [ ] Task Brief 仍保持负责人批准的状态，不由执行者自行越过 Implementation Gate。

## Required automated checks

仓库最低检查：

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

PR-01 专项测试必须使用 synthetic 数据并至少覆盖：

```text
未过期 IndexedDB cache
已过期 IndexedDB cache
cacheVersion 不匹配
localStorage fallback
malformed JSON
IndexedDB 打开失败
空缓存与读取错误区分
export manifest
SHA-256 校验
export 失败不修改源数据
logout 保留活动
Token 过期保留活动
disconnect 网络撤销失败仍保留活动
Demo 数据不会混入真实 Legacy 导出
restore 成功、失败和回滚
```

专项测试的精确命令、IndexedDB mock 和测试文件路径由调查后批准。测试必须离线，
不得需要 Strava credentials、浏览器 profile、私人 fixture 或系统当前时间。

## Manual verification

在没有真实账号和没有真实运动数据的条件下，使用隔离浏览器 profile、独立端口和
deterministic synthetic 数据：

1. 明确记录运行 commit、URL、端口、Service Worker registration 和 Cache
   状态，确认加载的是本 worktree 版本；
2. 注入 synthetic Legacy IndexedDB cache，分别验证未过期、已过期和版本不匹配；
3. 注入 synthetic localStorage fallback，并验证来源与 warning；
4. 导出后离线核对 manifest、活动数量、时间范围和全部 SHA-256；
5. 导出前后比较源 entry，证明没有 timestamp、version 或活动内容写回；
6. 在隔离环境清空显式测试目标后恢复，验证成功、失败和事务回滚；
7. 使用 mock/fake auth 和 network failure 验证 logout、Token 过期、401、403
   和 disconnect revoke 失败均保留 synthetic activities；
8. 切换 Demo 并证明真实 Legacy 导出不包含 Demo activities；
9. 验证现有 Legacy 页面仍能读取 synthetic cache，未发生视觉或导航重构。

不得在包含真实 Legacy 数据的浏览器 profile 中执行任何可能清理缓存的操作。
真实 OAuth、真实 disconnect 和真实用户导出必须标记为未运行；如未来进行，只能
在仓库外保存私人证据，并且必须先有可验证备份。

## Privacy and security impact

Legacy 导出包含私人运动和可能的健康资料，默认只允许在用户本地生成和保存，
不得上传外部服务、写入日志、提交 Git 或作为 CI artifact。仓库内测试必须全部
使用人工构造、固定时间和虚构 ID 的 synthetic 数据，不包含真实 GPS、HR、
Power、Token 或设备序列号。

错误和 warning 只记录来源类别、计数、版本和非识别性状态；不得记录原始活动、
Authorization header、Token、精确位置或私人导出内容。导出下载和恢复失败不得
触发源数据清理。

## Migration impact

PR-01 不创建 IndexedDB v2，不修改 Canonical Schema，不把 Legacy 数据原地迁移，
也不把 Canonical 数据反向写入 Legacy Cache。

预期的数据影响仅限：

- 对现有 Legacy 数据进行只读发现和导出；
- 在用户明确选择、校验通过并确认目标后执行可回滚恢复；
- 鉴权状态变化不再驱动活动删除。

所有写入路径必须明确目标、可观察、幂等或可安全重试，并证明失败不会损坏原缓存。
在 Legacy 导出、hash、activity count 或恢复测试未通过前，禁止开始 IndexedDB v2
用户数据迁移。

## Rollback procedure

实施后的回滚必须：

1. 停止 PR-01 新入口，记录当前运行 commit 和 Service Worker 状态；
2. 在不清理任何浏览器存储的前提下，将运行代码 revert 到 PR-01 前的
   `integration/v2` 行为；
3. 保留全部已生成的私人导出和恢复报告，不删除或覆盖备份；
4. 确认是否已有用户依赖“disconnect 不删除活动”的新行为；必要时禁用旧的破坏性
   disconnect 入口，而不是执行它；
5. 若 Service Worker 使旧 bundle 继续运行，只处理应用 shell 版本，不清理
   IndexedDB 或 localStorage 数据；
6. 使用 synthetic 隔离环境重新验证 Legacy 页面和缓存可读；
7. 记录未回滚的数据状态和后续恢复步骤。

Task Brief 初始化提交本身仅新增本文档；若该文档提交需要回滚，revert 对应 docs
commit 即可，不影响运行时代码或浏览器数据。

## Independent review checklist

- [ ] 状态未在负责人批准前改为 `Approved for implementation`；
- [ ] 调查报告给出精确函数、文件和调用路径证据；
- [ ] 最小修改集合没有混入 Canonical、IndexedDB v2、页面或分析重构；
- [ ] Rescue Reader 只读、无 TTL/version 阻断、无网络和无写回；
- [ ] IndexedDB、localStorage、Demo、空缓存与错误状态可区分；
- [ ] 导出 manifest、稳定内容和 SHA-256 验证完整；
- [ ] 导出失败不会修改或删除源数据；
- [ ] restore 成功、失败和事务回滚均有 synthetic 测试；
- [ ] logout/disconnect/Token expiry/401/403 不删除活动；
- [ ] disconnect 远端撤销失败的目标状态明确且可重试；
- [ ] “断开 Strava”和“删除本地数据”保持独立；
- [ ] Demo activities 不会进入真实 Legacy 导出；
- [ ] 测试离线、确定性且不使用 credentials 或私人 fixture；
- [ ] 日志、错误、PR 和 CI artifact 不泄露私人数据；
- [ ] Service Worker 和多 worktree 人工验证版本已明确；
- [ ] 回滚不清理 Legacy Cache、导出包或未来 V2 数据；
- [ ] 所有未执行验证明确标记，未伪装成 Pass；
- [ ] staged paths、commit、base/head branch 和 Draft PR 目标正确。

## Completion evidence

```text
Task Brief commit: Pending
Draft PR: Pending
Read-only investigation: Pending
Implementation approval: Not granted
Implementation: Not started
Automated checks: Not run for implementation
Manual verification: Not run
Independent review: Pending
```
