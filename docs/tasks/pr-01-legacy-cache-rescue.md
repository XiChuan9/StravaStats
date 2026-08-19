# PR-01：Legacy Cache Rescue 与鉴权解耦

## Metadata

| Field | Value |
| --- | --- |
| Status | In review |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/legacy-rescue` |
| Worktree | `<worktree-root>/legacy-rescue` |
| Owner | XiChuan9 |
| Reviewer | 独立 Codex 线程 + XiChuan9 |
| Related PRD | Sections 2.3、4.1、8.1、8.2、8.7、8.8、9.1、Epic C、20 |
| Related plan | Sprint 0 / PR 01 |
| Related ADRs | ADR-0003（Proposed，仅作后续边界背景；本 PR 不冻结其未决契约） |
| Dependencies | PR-00 已合并；V1 baseline、`maintenance/v1`、`integration/v2` 和本任务 worktree 已建立 |
| Pull request | [#5](https://github.com/XiChuan9/StravaStats/pull/5) |

## Goal

在创建 IndexedDB v2、Canonical 双写或本地导入能力之前，为现有 Legacy
活动缓存建立非破坏性的发现、导出、校验和可验证恢复路径，并把 Strava
鉴权生命周期与本地活动数据生命周期解耦。

目标行为是：

- Rescue Reader 可以绕过 TTL 和 `cacheVersion` 限制读取旧缓存；
- 导出包可校验、可用于隔离环境恢复；
- Disconnect Strava、Token 过期、刷新失败、401 和 403 不自动删除活动；
- 断开 Strava 与删除本地数据保持为两个独立动作；
- Legacy 默认页面行为继续可回退。

## Why now

已确认的迁移基线指出，Legacy IndexedDB 当前是缓存而非长期资料库，
logout/disconnect 与活动缓存清理耦合，且当前尚没有已验证并私下保存的
Legacy 导出。Git 回滚无法恢复浏览器 IndexedDB；若在救援路径建立前开始
IndexedDB v2、Canonical 或导入开发，唯一的浏览器数据副本可能无法恢复。

因此 PR-01 是后续用户数据迁移的阻断前置任务。

## Investigation questions

调查阶段已只读回答以下问题，确认事实和控制塔决策见后续章节：

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

以下事实已由 PR-01 只读代码调查确认：

- Legacy IndexedDB 仅由 `js/services/activity-cache.js` 打开，数据库名为
  `strava-dashboard-cache`、version `1`、store `entries`、key
  `strava_activities`，entry 包含 `activities`、`timestamp` 和
  `cacheVersion`；
- 调查基线中的活动删除使用
  `objectStore.delete('strava_activities')`；B1 唯一批准的
  `indexedDB.deleteDatabase()` 路径是删除失败 restore 在原本无库目标中新建的
  `strava-dashboard-cache`，预先存在的数据库和 `objectStore.clear()` 仍禁止；
- `getCachedActivities()` 的默认参数是 `cacheVersion = null` 和
  `maxAgeMs = Infinity`，因此默认调用不阻断 TTL 或 `cacheVersion`；
- 现有 `getCachedActivities()` 不是合格的 Rescue Reader：它用固定 version
  打开数据库，缺库时可能创建数据库和 store；它不返回来源、warning、实际
  database version 或时间范围，并把空缓存、损坏 fallback 和部分读取错误收敛
  为 `null`；
- `getCachedActivities()` 的调用者只有 `js/app/main.js` 和
  `js/pages/gear/gear-analysis.js`；后者使用默认参数；
- `saveCachedActivities()` 的两个调用者均在 `js/app/main.js`，分别位于首次
  网络加载和手工 refresh；它通过 `put` 覆盖同一个 Legacy entry；
- localStorage fallback 写入发生 quota/error 时，
  `saveCachedActivities()` 会删除已有 fallback payload 和 timestamp；
- `clearCachedActivities()` 先删除 localStorage fallback，再删除 IndexedDB
  entry；它的三个调用者全部位于 `js/app/auth.js`；
- 当前 `logout()` 同时尝试 Strava deauthorization、删除 Token、清除 Legacy
  activities、athlete、zones、gears、filters、HRV 和 Demo 数据，并且远端
  revoke 网络失败后仍继续本地清理；
- OAuth code exchange 成功后会立即调用 `clearCachedActivities()`；
- `handleAuth()` 在 Token 过期或字段不完整时删除 Token、Legacy activities 和
  多项 metadata；它在到达后端 refresh 路径前已执行该清理；
- 前端对 401/403 只抛出普通 API error，没有通用 retry 或 auth state
  framework，也不会直接清理活动；`strava-activities` 后端会把 Strava 错误
  转换为 500，其余多个 endpoint 会透传 401/403；
- 当前运行时没有独立 `disconnect` 函数或 Delete Local Data 入口；唯一顶栏
  动作为 `Log out`，Settings 只包含显示和单位相关设置；
- 应用只有 Token 存在且未过期时才调用 `initializeApp()`，因此保留 Legacy
  cache 不等于已经实现无 Token 的完整 Legacy 页面浏览；
- Demo activities 使用 `strava_demo_activities`，但 Demo athlete、zones、
  gears 和 Token 使用真实模式共享的 key；Demo 启动仍先读取 Legacy
  IndexedDB，cache miss 时还会把 Demo activities 写入真实 Legacy entry；
- `clearDemoData()` 当前没有调用者，且会删除与真实模式共享的 metadata key；
- 当前 activity CSV 导出使用预处理后的页面数组，不是 raw、可校验、可恢复的
  Legacy backup；
- `js/app/main.js` 会记录 raw/preprocessed activities，
  `js/services/api.js` 会记录 athlete 标识信息；
- localhost Service Worker policy 在 window `load` 后执行，首次加载仍可能已
  使用旧资源；生产 `sw.js` 可能缓存同源 `/api/strava-*` GET response；
- 当前测试使用内置 `node:test`；调查环境中 `indexedDB` 为 `undefined`，
  `fake-indexeddb` 未安装，Web Crypto `crypto.subtle` 可用；
- V1 baseline 未执行真实 Disconnect/Logout，也未完成真实 Legacy 导出；
  PR-01 调查没有运行真实账号、真实缓存、浏览器恢复或 Service Worker 演练；
- Canonical Schema、IndexedDB v2、通用 Repository、通用 auth retry framework
  和完整 Canonical Backup/Restore 仍属于后续任务。

## Decisions required before implementation

Investigation Gate 已通过。控制塔批准并冻结以下实现决策：

- 批准增加 `fake-indexeddb` devDependency；
- Legacy 导出使用单个 JSON bundle，bundle 内包含六个逻辑文件：
  `manifest.json`、`legacy-activities.json`、`legacy-athlete.json`、
  `legacy-zones.json`、`legacy-gears.json`、`legacy-settings.json`；
- Legacy Cache 实现拆分为五个精确模块：`constants.js` 维护数据库常量和稳定
  code，`reader.js` 负责严格只读发现，`bundle.js` 负责确定性 bundle 和 hash，
  `restore.js` 负责恢复计划与回滚，`index.js` 只提供明确公共导出；
- `exportedAt` 必须由调用方注入；
- `applicationCommit` 由调用方注入；无法取得时写入 `null`，并加入稳定 warning；
- mixed Demo/Legacy 允许导出，但必须产生 `PROVENANCE_UNCERTAIN`；未经用户明确
  确认不得恢复；
- restore 只允许空目标；目标内容与导出相同时为 no-op，非空且冲突时 abort；
- 现有 `Log out` 改为 `Disconnect Strava`；
- disconnect 删除本地 Token，但保留全部 Local Library；
- 远端 revoke 失败返回 `revocation-unconfirmed`，本地仍不保留 Token；
- PR-01 不新增 Delete Local Data 入口；
- PR-01 不建设通用 401/403 retry framework，只保证 401、403、Token expiry
  和 refresh failure 不删除活动；
- OAuth 新账号与旧 cache 的账号不同或无法确认时 fail closed：不得读取或覆盖
  旧 cache；
- Demo 使用独立 namespace，不得读写真实 Legacy activities 或 metadata；
- 移除 raw activities 和 athlete identity console logging；
- Service Worker API cache 记录为后续任务，PR-01 不修改 `sw.js`。

以上决定与下方 Allowed files 共同构成 Implementation Gate。实施中若需要任何
额外路径、接口扩大或行为变化，必须停止并重新提交控制塔批准。

## In scope

PR-01 实施范围冻结为：

1. 对 Legacy IndexedDB 和 localStorage fallback 的非破坏性 Rescue Reader；
2. 不检查 TTL、允许 `cacheVersion` 不匹配且不写回的旧缓存读取；
3. 明确区分 IndexedDB、localStorage、Demo、空缓存和读取错误；
4. 单 JSON bundle、六个逻辑文件、manifest、逐逻辑文件 SHA-256 和导出后校验；
5. 导出失败不修改或清理任何源数据；
6. 仅空目标、identical no-op、conflict abort 的 Legacy 恢复路径，以及成功、
   失败和事务回滚测试；
7. `Disconnect Strava`、Token 过期、刷新失败、401、403 与活动清理解耦；
8. disconnect revoke 失败的 `revocation-unconfirmed` 状态；
9. OAuth 不同或未知账号时 fail closed；
10. Demo activities 和 metadata 使用独立 namespace；
11. mixed provenance 导出 warning 和恢复确认；
12. 移除 raw activities 与 athlete identity console logging；
13. 仅使用 deterministic synthetic 数据的自动测试；
14. 无真实账号条件下的隔离人工验证说明；
15. 与上述行为直接相关的 Task Brief 状态和完成证据更新。

## Out of scope

- 修改或冻结 Canonical Schema；
- 创建、升级或写入 IndexedDB v2；
- Canonical Repository、Shadow Writer 或 Legacy Projection 的长期实现；
- 完整 Canonical Backup/Restore（PR-21）；
- FIT、TCX、GPX、CSV 或 Strava ZIP 导入；
- 页面、导航、Settings、Source Manager 或视觉的顺便重构；
- Dashboard、Run、Bike、Swim、Run Plus、NSM 或分析算法修改；
- 通用 Repository 迁移；
- 通用 401/403 retry/auth state framework；
- 新增 Delete Local Data 入口或本地资料库删除能力；
- Service Worker 策略重构；
- Service Worker API response cache 修复；
- 真实 Strava OAuth 集成验证；
- 真实运动数据 fixture、截图或导出进入仓库；
- 删除、覆盖或原地迁移现有 Legacy Cache。

## Allowed files

控制塔批准的精确文件范围：

```text
docs/tasks/pr-01-legacy-cache-rescue.md
index.html
js/app/auth.js
js/app/auth-lifecycle.js（新建）
js/app/main.js
js/services/activity-cache.js
js/services/api.js
js/services/index.js
js/services/legacy-cache/constants.js（新建）
js/services/legacy-cache/reader.js（新建）
js/services/legacy-cache/bundle.js（新建）
js/services/legacy-cache/restore.js（新建）
js/services/legacy-cache/index.js（新建）
js/demo/index.js
js/tabs/athlete.js
js/tabs/run-plus.js
package.json
package-lock.json
tests/legacy/legacy-cache-rescue.test.js
tests/legacy/auth-lifecycle.test.js
tests/legacy/demo-isolation.test.js
```

测试使用文件内 deterministic synthetic fixture，不新增 fixture 文件。除以上
21 个精确路径外，其他所有路径均不允许修改。

五个 Legacy Cache 模块的职责冻结为：

- `constants.js`：Legacy DB、store、key 与稳定 warning/error code；
- `reader.js`：严格只读发现和来源诊断；
- `bundle.js`：稳定序列化、bundle 构建、SHA-256 与验证；
- `restore.js`：restore plan、空目标写入、no-op、abort 和回滚；
- `index.js`：只做明确的公共导出，不承载读取、bundle 或 restore 实现。

## Prohibited files and operations

禁止文件和领域：

```text
AGENTS.md
.github/**
docs/**（除 docs/tasks/pr-01-legacy-cache-rescue.md）
js/data/**
docs/architecture/adr/**
docs/migrations/indexeddb-v2.md
js/analysis/**
js/tabs/**（仅 `js/tabs/athlete.js` 和 `js/tabs/run-plus.js` 两个精确路径例外）
js/pages/**
styles/**
api/**
sw.js
js/demo/generator.js
js/demo/polylines.js
tests/**（除三个获批 tests/legacy/*.test.js 精确路径）
tests/fixtures/private/**
仓库外私人资料、导出、备份和 baseline evidence
```

禁止操作：

- 修改 Canonical Schema；
- 创建 IndexedDB v2；
- 删除、清空、覆盖或原地升级预先存在的 Legacy Cache；唯一例外是 restore
  前目标数据库不存在、由本次失败 apply 创建
  `strava-dashboard-cache` 时，补偿回滚必须只删除该次新建数据库；
- 把恢复实现为先清空再写入；
- 使用真实 FIT、TCX、GPX、Strava ZIP、GPS、心率、功率或真实导出作为 fixture；
- 读取、枚举、复制或提交 `tests/fixtures/private/`；
- 在真实浏览器 profile 中运行可能清理用户缓存的 logout/disconnect；
- 将 Token、Authorization header、Cookie、原始私人活动或精确位置写入日志；
- 顺便重构页面、分析算法、样式或 Service Worker；
- 新增 Delete Local Data 入口；
- 建设通用 401/403 retry/auth state framework；
- 修改或绕过 Service Worker API cache；
- 直接提交或推送到 `main`、`maintenance/v1` 或 `integration/v2`；
- 切换、删除、rebase、amend 或 force-push 分支；
- 合并 PR 或删除 worktree；
- 使用 `git add .`、`git add -A` 或隐式暂存任务外文件；
- 修改任何未列入 Allowed files 的路径；
- 在本 A3 范围冻结提交中实施任何产品代码、测试或依赖变更。

## Interfaces and expected outputs

本节冻结可观察行为和返回语义。实现可在获批文件内选择内部函数名，但不得改变
以下 source、warning、bundle、restore 和 auth lifecycle 约束。

### Rescue Reader

应返回可机器判定的：

```text
status
selectedSource
sources.indexedDb
sources.localStorage
sources.demo
activities
activityCount
earliestActivity
latestActivity
sourceDatabase
sourceDatabaseVersion
sourceCacheVersion
warnings
errors
```

它必须只读、不检查 TTL、允许旧 `cacheVersion`、不更新时间或版本、不触发
Strava 网络请求，并区分 IndexedDB、localStorage、Demo、空缓存与读取错误。
打开 IndexedDB 时不得传入固定 version；若 `onupgradeneeded` 表示数据库不存在，
必须 abort，不得创建数据库或 store。IndexedDB 错误不得被 localStorage fallback
隐藏。

### Legacy export

第一版输出一个 JSON bundle。bundle 内的 `files` 对象包含六个逻辑文件：

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

每个非 manifest 逻辑文件必须使用最终 UTF-8 bytes 计算 SHA-256，并在 manifest
记录 filename、media type、byte length 和 lowercase hex digest。
`exportedAt` 必须由调用方注入。
`applicationCommit` 由调用方注入；缺失时为 `null` 并产生
`APPLICATION_COMMIT_UNAVAILABLE` warning。

导出使用以下精确 localStorage allowlist：

```text
legacy-athlete.json  ← strava_athlete_data
legacy-zones.json    ← strava_training_zones
legacy-gears.json    ← strava_gears
legacy-settings.json ← dashboard_filters
                       dashboard_readiness_hrv
                       dashboard_settings
                       training_goals
                       run_plus_capacity_inputs_v1
                       run_plus_nsm_settings_v1
                       run_plus_nsm_activity_tags_v1
                       run_plus_nsm_session_inputs_v1
                       run_plus_nsm_tests_v1
                       run_plus_nsm_interval_analysis_v1
                       gear-custom-*（只允许此严格前缀）
```

必须明确排除 `strava_tokens`、所有 Authorization/refresh/access Token、
Gemini/API key、AI chat history、Demo namespace 和其他未列出的 localStorage
key。mixed Demo/Legacy 允许导出，但 manifest 必须包含
`PROVENANCE_UNCERTAIN`。

`legacy-activities.json` 必须包含被 hash 保护的 provenance：

```text
provenance.uncertain
provenance.evidenceCodes
provenance.sourceErrorCodes
```

manifest 中的 `PROVENANCE_UNCERTAIN` 和 `SOURCE_READ_ERROR` 必须从该 hashed
provenance 派生，并在 verify 时核对一致。restore 的确认 gate 只读取已验证的
hashed provenance，不得依赖可单独篡改的 manifest warning。

allowlisted activities 或 metadata 中发现敏感字段时，逻辑 payload 必须记录
不含值的 hashed redaction evidence，manifest 派生
`SENSITIVE_FIELDS_REDACTED`；不得静默修改导出内容。

确定性序列化规则冻结为：

- `exportedAt` 必须由调用方注入；
- `applicationCommit` 必须由调用方注入；缺失时序列化为 `null` 并产生
  `APPLICATION_COMMIT_UNAVAILABLE` warning；
- 对象 key 必须递归按字典序排序；
- 数组必须保持原始顺序；
- logical filename 必须按字典序排序；
- 所有逻辑文件使用 UTF-8；
- 用于 hash 的 JSON bytes 不带尾随换行；
- manifest 不对自身做递归 hash；
- 相同输入、`exportedAt` 和 `applicationCommit` 必须产生完全相同的 bytes 和
  SHA-256。

### Restore

恢复必须先校验 manifest 和 hashes，在隔离环境解析并展示数量、时间范围和
warning：

- 目标为空时允许恢复；
- 目标与 bundle 内容相同时返回 no-op；
- 非空且冲突时 abort；
- bundle 含 `PROVENANCE_UNCERTAIN` 时必须再次明确确认，否则不得写入；
- 写入失败必须事务或补偿回滚，并产生 `imported` / `skipped` / `failed` /
  `rolledBack` 报告；
- restore plan 必须由模块私有机制签发、与 verified bundle 绑定并递归冻结；
- restore 只允许不存在的目标或 version 1 目标；更高或未知不兼容版本 abort；
- restore write open request 在 timeout/onblocked 后必须标记 cancelled，并等待
  request error/success 终态；迟到 upgrade 只允许 abort，不得创建 store 或写入；
- cancelled request 若仍以 success 证明创建了新 DB，apply 必须在返回前完成精确
  删除；删除 error/blocked/timeout 返回 `RESTORE_ROLLBACK_FAILED` 和
  `partial-rollback`；
- 预存数据库只有在 restore write transaction 已触发 `complete`、且
  `writeIndexedDbEntry` 成功 resolve 后，才允许补偿恢复或删除原 entry；
  open/error/blocked/timeout、transaction abort 或写入失败不得触发 entry 补偿，
  也不得报告 `rolledBack: indexedDbEntry`；
- 预存 entry 补偿必须在同一个 readwrite transaction 中先读取当前 entry；仅当
  当前值仍等于本次 restore 已提交的 desired entry 时，才能恢复 previous entry
  或删除 key；若已被并发替换，必须保留并发值并返回
  `RESTORE_ROLLBACK_FAILED`（带稳定 conflict evidence）和
  `partial-rollback`；
- 若失败 apply 创建了此前不存在的 Legacy DB，补偿回滚只删除该次新建 DB，并
  等待 delete success/error/blocked/timeout；预先存在的 DB 永远不得删除；
- 导出 bundle 不得因恢复被删除。

### Authentication lifecycle

```text
Disconnect Strava
→ 尝试远端 revoke
→ 删除本地 Token
→ 保留 Local Library
→ success 或 revocation-unconfirmed
```

Token expiry、refresh failure、401 和 403 不得调用活动清理。OAuth 新账号与旧
cache 的账号不同或无法确认时必须 fail closed，不读取、不展示、不覆盖旧 cache。
Demo 必须使用独立 namespace，不调用真实 Legacy activities 或 metadata 的读写
路径。

B2-A Authentication Lifecycle 实现边界：

- `js/app/auth-lifecycle.js` 是无 DOM、无 reload、依赖注入的核心，公开
  `disconnect`、`expireToken`、`handleAuthFailure` 和
  `acceptOAuthTokenResponse`；
- 稳定状态为 `success`、`revocation-unconfirmed`、`token-expired`、
  `unauthenticated`、`refresh-failed`、`forbidden`、
  `identity-mismatch`、`identity-unconfirmed`，并为本地 Token 读写失败保留
  明确失败状态；
- Disconnect 和 Token expiry 只允许删除 `strava_tokens`；Local Library、
  Legacy Rescue/export marker 和 Demo namespace 均不得清理；
- OAuth identity guard 只读取旧 athlete ID；IndexedDB 只用 `count(key)` 确认
  activity entry 是否存在，不读取或展示旧活动；
- 旧 Local Library 存在时，旧 ID 或新 OAuth athlete ID 任一未知均
  `identity-unconfirmed`，不同则 `identity-mismatch`；blocked 路径零写入；
- `js/services/api.js` 只为 refresh failure、401 和 403 提供稳定、可测试的错误
  状态，不增加 retry、自动 refresh 或通用 auth-state framework。

B2-A.1 控制塔纠偏：

- LocalStorage presence 只能通过 `length` / `key(index)` 枚举 key 名；不得读取
  activities、zones、gears、settings、Rescue 或 Demo 值，唯一允许读取和解析的
  身份值是 `strava_athlete_data.id`；
- `indexedDB.databases()` 仅为可选优化；缺失或调用失败时使用不带 version 的
  `open(LEGACY_DB_NAME)`，missing upgrade 必须 abort，禁止创建 store，并等待
  error/success 终态后再返回；
- timeout/onblocked 后的迟到 upgrade 必须 abort；若 abort 失败并创建空探测 DB，
  必须关闭连接并等待精确删除终态，不能在返回后留下未报告 mutation；
- Disconnect 必须区分 Token 不存在、有效、malformed、缺少 access token 和读取
  失败；除确认不存在或成功 revoke 外，删除本地 Token 后均返回
  `revocation-unconfirmed`。

B2-B Demo Namespace Isolation 实现边界：

- Demo namespace 冻结为
  `strava_demo_mode`、`strava_demo_activities`、
  `strava_demo_athlete_data`、`strava_demo_training_zones`、
  `strava_demo_gears`、三个对应 metadata timestamp key 和
  `strava_tokens_demo`，由 `js/demo/index.js` 集中导出；
- `loadDemoData()` 使用注入的 `referenceDate` 和 `now` 确定性生成 Demo
  activities、athlete、zones、gears 和唯一 Demo Token；写入失败只补偿本次尝试
  的 Demo keys，不读取或修改真实 Local Library；
- Demo getter 只读取对应 Demo key，malformed payload 返回安全空值，不 fallback
  到真实 activities 或 metadata，也不触发网络；
- Demo logout、malformed/expired Demo Token 和真实 OAuth 成功后的 Demo exit
  只调用 `clearDemoData()`；不得进入 Authentication Lifecycle disconnect、
  远端 revoke 或真实 cache 清理；
- URL 包含 OAuth code 时真实 OAuth 优先，B2-A identity guard 保持生效；只有
  OAuth 成功后才清理 Demo namespace 并使用真实 Token；
- Demo API activities、athlete、zones、gears 和 gear-by-id 全部从 Demo
  namespace 返回；Demo gear cache 更新只写 Demo gears/timestamp，所有 Demo API
  路径 fetch 调用为零；
- B2-B 不修改 `auth-lifecycle.js`、Legacy Rescue、页面、Service Worker、
  Canonical Schema、IndexedDB v2 或依赖；B2-C 保持未开始。

B2-C App Integration & Privacy Closure 精确实现边界：

- A3.2 最小范围扩展后，只允许修改 Task Brief、`index.html`、
  `js/app/main.js`、`js/tabs/athlete.js`、`js/tabs/run-plus.js` 和既有
  `tests/legacy/demo-isolation.test.js`，不得新增文件或依赖；
- `initializeApp` 和 `refreshActivities` 在每次操作开始时各读取一次 Demo mode，
  冻结为稳定 `demo` / `real` session mode，并调用 `main.js` 内可注入的
  `loadActivitiesForSession()`；
- Demo initialize/refresh 只调用 `getDemoActivities()`，不得调用
  `getCachedActivities()`、`fetchAllActivities()` 或
  `saveCachedActivities()`，不得打开、创建、覆盖或清理真实 Legacy cache；
- 真实 initialize cache hit 保持网络与写入为零；cache miss 保持一次网络和一次
  cache 写入；真实 refresh 保持一次网络和一次 cache 写入，TTL 与
  `CACHE_VERSION` 传递不变；
- Demo metadata/gears 继续使用 B2-B 已隔离的 API/Demo namespace；Demo 提示不得
  声称从 Strava 下载，也不得在 Demo 失败时 fallback 到真实 activities；
- `main.js` 日志只允许非识别性计数或状态，不得输出 raw/preprocessed activities、
  athlete identity、zones、gears、私人日期范围、Token、Authorization header 或
  未净化 error 对象；
- 现有 logout button 的 `aria-label` 和 `title` 均改为
  `Disconnect Strava`，不新增 Delete Local Data、确认弹窗、页面或视觉重构；
- 行为级 synthetic tests 必须覆盖 Demo initialize（真实 cache present/empty）、
  Demo refresh，以及真实 cache hit/miss/refresh 的调用次数、返回来源和
  byte-for-byte snapshot；最终 acceptance checkbox 留给控制塔独立复验。

B2-C.1 Demo Production-Path Isolation 修正合同：

- `main.js` 持有稳定 `activeSessionMode`、`sessionAthlete`、`sessionZones` 和
  `sessionGears`；gear filters 只使用 session gears，禁止读取真实
  `strava_gears` key，malformed/missing Demo gears 必须为空；
- Trends 的 athlete/zones 由 main 显式注入；`athlete.js` 禁止读取真实 metadata
  key、fallback 到 storage 或记录 athlete identity，null metadata 安全跳过；
- Demo athlete 缺失或 malformed 时，main 向 preprocessing 传入不含真实 ID、
  name 或 username 的 local-only Demo marker，以阻断 core 的 Legacy athlete
  fallback；不得修改 preprocessing core；
- `getRunPlusRenderOptions()` 由稳定 session mode 派生
  `allowRemoteStrava`，未确定或 Demo 时为 false；
- Run Plus production request boundary 必须在 Token read、Token 编码、fetch、
  response body 和 Token write 之前 fail closed；Real 模式保持一次 Token read、
  一次 fetch，并只在响应含 refreshed tokens 时写回；
- B2-C.1 行为测试必须调用生产 metadata selector、preprocessing 与 Run Plus
  request boundary，并用 spy 证明 Demo 真实 key read、fetch 和 Token write 为零；
  两个最终 privacy/isolation acceptance checkbox继续留给控制塔复验。

## Acceptance criteria

- [x] Rescue Reader 可以只读打开 Legacy IndexedDB；
- [x] 未过期和已过期 IndexedDB cache 均可发现，且读取不更新时间；
- [x] `cacheVersion` 不匹配的 entry 可读取并产生可解释 warning；
- [x] localStorage fallback 可识别并与 IndexedDB 来源区分；
- [x] malformed JSON、IndexedDB 打开失败、空缓存和读取错误可区分；
- [x] Rescue Reader 不触发网络请求或清理；
- [x] 单 JSON bundle 包含六个规定逻辑文件、manifest 和逐文件 SHA-256；
- [x] manifest 可解析，hash、活动数量和时间范围可校验；
- [x] `exportedAt` 由调用方注入；
- [x] `applicationCommit` 缺失时为 `null` 且有稳定 warning；
- [x] 对象 key、logical filename、UTF-8、无尾随换行和 manifest 自身不 hash
      的规则产生确定性 bytes 与 SHA-256；
- [x] `legacy-settings.json` 只包含精确 allowlist 和 `gear-custom-*` 严格前缀；
- [x] Token、API key、AI chat history、Demo namespace 和未列出 key 均被排除；
- [x] export 失败不修改源数据；
- [x] mixed Demo/Legacy 导出产生 `PROVENANCE_UNCERTAIN`；
- [x] hashed provenance 与 manifest warning 一致，删除或伪造 manifest warning
      无法绕过 restore confirmation；
- [x] partial selected source 记录稳定 `SOURCE_READ_ERROR`，empty/error source
      返回 `RESCUE_SOURCE_NOT_EXPORTABLE`；
- [x] 敏感字段 redaction 可观察、被 hash 保护且不改变源数据；
- [x] 未确认 `PROVENANCE_UNCERTAIN` 时 restore 零写入；
- [x] Demo namespace 不读写真实 Legacy cache；
- [x] `Disconnect Strava` 删除 Token 并保留活动和 Local Library；
- [x] Token 过期、刷新失败、401 和 403 保留活动；
- [x] disconnect revoke 失败返回 `revocation-unconfirmed`，不保留 Token；
- [x] PR-01 没有 Delete Local Data 入口；
- [x] OAuth 不同或未知账号 fail closed，不读取或覆盖旧 cache；
- [x] restore 成功、失败和事务回滚均有自动测试；
- [x] restore 仅空目标；identical 为 no-op；冲突目标 abort；
- [x] restore plan 由模块签发、递归冻结并与 verified bundle 绑定；
- [x] 失败 apply 新建的 DB 被删除；预先存在的空 DB 不被删除；
- [x] version > 1、incompatible store 和 plan/apply TOCTOU 均 fail closed；
- [x] 恢复不删除导出包或未授权的源数据；
- [x] raw activities 和 athlete identity 不再写入 console；
- [x] Legacy 默认页面行为无变化；
- [x] 只使用 deterministic synthetic 测试数据；
- [x] 没有 Canonical Schema、IndexedDB v2、页面重构或分析改动；
- [x] 没有通用 401/403 retry framework 或 `sw.js` 修改；
- [x] B1 实施期间 Task Brief 状态保持 `In progress`。

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
确定性序列化 bytes 与 SHA-256
settings 精确 allowlist 与 gear-custom-* 严格前缀
敏感和未列出 localStorage key 排除
export 失败不修改源数据
Disconnect Strava 保留活动
Token 过期保留活动
disconnect 网络撤销失败仍保留活动
disconnect revoke 失败删除 Token 并返回 revocation-unconfirmed
OAuth 不同或未知账号 fail closed
Demo 独立 namespace 不读写 Legacy
mixed Demo/Legacy 导出 warning 与 restore 确认
manifest provenance warning tamper
empty/error/partial export source gate
sensitive redaction hashed evidence
forged/mutated restore plan
restore 新建 DB 精确删除
预先存在空 DB entry 回滚
预存 DB open/transaction 未提交失败不触发 entry 补偿
预存 DB 已提交 desired entry 的 compare-before-rollback
rollback 前并发替换保留与 partial-rollback conflict evidence
unsupported target version/store
plan/apply target delete/create/upgrade
restore 成功、失败和回滚
restore 空目标、identical no-op、冲突 abort
fallback metadata-first/payload-last 与 rollback failure
raw activities/athlete console logging 移除
```

专项测试使用已批准的 `fake-indexeddb` 和三个精确 `tests/legacy/*.test.js`
路径。测试必须离线，不得需要 Strava credentials、浏览器 profile、私人 fixture
或系统当前时间。

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
7. 使用 mock/fake auth 和 network failure 验证 Disconnect Strava、Token
   过期、401、403 和 revoke 失败均保留 synthetic activities；
8. 验证 revoke 失败删除 Token，并显示 `revocation-unconfirmed`；
9. 切换 Demo 并证明 Demo namespace 不读写真实 Legacy cache；
10. 构造 mixed Demo/Legacy，验证导出含 `PROVENANCE_UNCERTAIN`，未确认时
    restore 零写入；
11. 验证空目标恢复、identical no-op 和冲突目标 abort；
12. 验证现有 Legacy 页面仍能读取 synthetic cache，未发生视觉或导航重构。

不得在包含真实 Legacy 数据的浏览器 profile 中执行任何可能清理缓存的操作。
真实 OAuth、真实 disconnect 和真实用户导出必须标记为未运行；如未来进行，只能
在仓库外保存私人证据，并且必须先有可验证备份。

调查阶段的未运行验证：

- 未运行真实 Strava OAuth、真实账号 401/403 或 Token refresh；
- 未运行真实用户 profile 的 Disconnect/Logout；
- 未读取、导出或恢复任何真实 Legacy cache；
- 调查基线时尚未运行 Rescue Reader、JSON bundle、SHA-256 或 restore，且当时
  实现尚不存在；当前 B1 core 已实现并通过自动测试，但浏览器与真实数据验证仍为
  `Not run`；
- 未运行浏览器 IndexedDB、localStorage quota/error 或 transaction rollback；
- 未运行 Service Worker 浏览器状态和多 worktree/多端口演练；
- 未运行 migration、E2E、视觉回归或真实数据检查。

以上项目均为 `Not run` / `Not implemented`，不得标记为 Pass。

## Privacy and security impact

Legacy 导出包含私人运动和可能的健康资料，默认只允许在用户本地生成和保存，
不得上传外部服务、写入日志、提交 Git 或作为 CI artifact。仓库内测试必须全部
使用人工构造、固定时间和虚构 ID 的 synthetic 数据，不包含真实 GPS、HR、
Power、Token 或设备序列号。

错误和 warning 只记录来源类别、计数、版本和非识别性状态；不得记录原始活动、
Authorization header、Token、精确位置或私人导出内容。导出下载和恢复失败不得
触发源数据清理。PR-01 必须移除当前 raw activities 和 athlete identity console
logging。Service Worker 同源 API cache 风险保留为后续任务，不得在本 PR 修改
`sw.js`。

## Migration impact

PR-01 不创建 IndexedDB v2，不修改 Canonical Schema，不把 Legacy 数据原地迁移，
也不把 Canonical 数据反向写入 Legacy Cache。

预期的数据影响仅限：

- 对现有 Legacy 数据进行只读发现和导出；
- 只向空目标恢复；identical 内容 no-op；冲突目标 abort；
- mixed provenance 必须在用户明确确认后才允许恢复；
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

Task Brief 初始化提交本身仅新增本文档；若需要回滚，revert
`a55d2fd7a55957d573f7fa0c59627ba58b49404a` 及后续 A3 docs commit 即可，
不影响运行时代码或浏览器数据。

## Independent review checklist

- [x] 状态在控制塔最终复验后为 `In review`；
- [x] 调查报告给出精确函数、文件和调用路径证据；
- [x] diff 只包含 21 个 Allowed files 中本次实际需要的最小子集；
- [x] Legacy Cache 实现严格拆分为五个获批模块，职责没有跨界；
- [x] 没有混入 Canonical、IndexedDB v2、页面或分析重构；
- [x] Rescue Reader 只读、无 TTL/version 阻断、无网络和无写回；
- [x] IndexedDB、localStorage、Demo、空缓存与错误状态可区分；
- [x] 单 JSON bundle、六个逻辑文件、manifest 和 SHA-256 验证完整；
- [x] `exportedAt` 和 `applicationCommit` 均由调用方注入；
- [x] `applicationCommit` 缺失时为 `null` 并产生 warning；
- [x] 稳定序列化遵守递归对象 key 排序、数组原序、filename 排序、UTF-8、
      无尾随换行和 manifest 不自 hash；
- [x] 相同输入、`exportedAt` 和 `applicationCommit` 产生完全相同 bytes/hash；
- [x] settings 导出只使用精确 allowlist 和 `gear-custom-*` 严格前缀；
- [x] Token、API key、AI chat history、Demo namespace 和其他 key 被排除；
- [x] 导出失败不会修改或删除源数据；
- [x] mixed provenance 导出含 `PROVENANCE_UNCERTAIN`，未经确认不得恢复；
- [x] provenance/source error/redaction evidence 位于 hashed payload，manifest
      warning 与其一致；
- [x] forged、mutated 或与 verified bundle 不一致的 restore plan 零写入并返回
      `RESTORE_PLAN_INVALID`；
- [x] 失败 restore 新建的 DB 被精确删除，预先存在的空 DB 只回滚 entry；
- [x] version > 1 或 plan/apply 间目标变化 fail closed；
- [x] restore 空目标、identical no-op、冲突 abort 和回滚均有 synthetic 测试；
- [x] Disconnect/Token expiry/refresh failure/401/403 不删除活动；
- [x] revoke 失败删除 Token、返回 `revocation-unconfirmed` 并保留 Local Library；
- [x] 没有新增 Delete Local Data 入口；
- [x] OAuth 不同或未知账号 fail closed；
- [x] Demo namespace 不读写真实 Legacy cache；
- [x] raw activities 和 athlete identity console logging 已移除；
- [x] 没有建设通用 401/403 retry framework；
- [x] `sw.js` 未修改，Service Worker API cache 作为后续任务；
- [x] `fake-indexeddb` 仅为 devDependency；
- [x] 测试离线、确定性且不使用 credentials 或私人 fixture；
- [x] 日志、错误、PR 和 CI artifact 不泄露私人数据；
- [x] Service Worker 和多 worktree 人工验证版本已明确，浏览器验证为 `Not run`；
- [x] 回滚不清理预先存在的 Legacy Cache、导出包或未来 V2 数据；仅精确删除
      失败 restore 本次创建的 Legacy DB；
- [x] 所有未执行验证明确标记，未伪装成 Pass；
- [x] staged paths、commit、base/head branch 和 Draft PR 目标正确。

## Completion evidence

```text
Task Brief initialization commit: a55d2fd7a55957d573f7fa0c59627ba58b49404a
Draft PR: #5 — https://github.com/XiChuan9/StravaStats/pull/5
Read-only investigation: Completed 2026-07-28
Investigation Gate: Approved by control tower
Implementation approval: Granted by control tower
A3 scope-freeze commit: 66c92274b97c5e8328c8e1488fc04e1f4480abd8
A3.1 governance correction: Task Brief boundary and Draft PR body only
B1 implementation: Completed after B1 REVISE — Legacy Rescue Core only
fake-indexeddb: 6.2.5 (devDependency only)
B1 revision verification:
  npm ci — Pass
  npm run check:syntax — Pass (102 files)
  npm run check:privacy — Pass
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (46/46)
  npm test — Pass (59/59)
  git diff --check — Pass
B1 directed reproductions:
  provenance manifest removal — Pass
  forged/mutated restore plan — Pass
  localStorage restore failure removes newly created DB — Pass
  empty Rescue Result build rejection — Pass
B1.2 late-open cancellation: Implemented
B1.2 focused tests:
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (50/50)
B1.2 independent late-event reproduction:
  Pass — failed/RESTORE_WRITE_FAILED; createObjectStore=0; transaction.abort=1;
  deleteDatabase=1; databases after late events=0; localStorage writes=0;
  rolledBack=indexedDbDatabase
B1.2 final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (102 files)
  npm run check:privacy — Pass
  npm test — Pass (63/63)
  git diff --check — Pass
B1.3 pre-existing database rollback isolation: Implemented
B1.3 focused tests:
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
B1.3 independent blocked-open reproduction:
  Pass — failed/RESTORE_CONFLICT; rolledBack empty; restore write transaction
  committed=false; concurrent entry preserved field-for-field; localStorage writes=0
B1.3 final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (102 files)
  npm run check:privacy — Pass
  npm test — Pass (66/66)
  git diff --check — Pass
B1 final control-tower review: Approved for commit after B1.3
Focused tests: Pass (53/53)
Full tests: Pass (66/66)
B2-A Authentication Lifecycle: Approved by control tower after B2-A.1
B2-A focused tests:
  node --test tests/legacy/auth-lifecycle.test.js — Pass (17/17)
B2-A Local Library preservation:
  Disconnect success/network failure/HTTP failure and Token expiry preserve all
  activity fallback, athlete, zones, gears, dashboard/settings, Rescue marker,
  and Demo namespace values; refresh failure/401/403 perform zero storage writes
B2-A OAuth identity guard:
  same account updates only strava_tokens; mismatch and unknown identity perform
  zero storage writes; IndexedDB presence uses count(key) without reading activities
B2-A final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (104 files)
  npm run check:privacy — Pass
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (83/83)
  git diff --check — Pass
B2-A.1 contract correction: Approved by control tower
B2-A.1 focused tests:
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
B2-A.1 directed evidence:
  localStorage presence reads only strava_athlete_data value; activity fallback
  getItem calls=0; no-databases first login succeeds without DB/store creation;
  malformed/missing-access/read-error Token returns revocation-unconfirmed after removal
B2-A.1 final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (104 files)
  npm run check:privacy — Pass
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (94/94)
  git diff --check — Pass
Authentication focused tests: Pass (28/28)
Legacy Rescue tests: Pass (53/53)
Full tests: Pass (94/94)
Browser/real OAuth verification: Not run
B2-B Demo Namespace Isolation module boundary: Approved for commit by control tower
B2-B commit: ce68edf40ab0c07827d37d3ff1e7dc0808a0898f
B2-B CI Run 30421863457: Success
B2-B focused tests:
  node --test tests/legacy/demo-isolation.test.js — Pass (15/15)
B2-B directed evidence:
  entering and clearing Demo preserve the complete real Local Library snapshot
  byte-for-byte; Demo API fetch calls=0; Demo logout revoke calls=0 and
  Authentication Lifecycle disconnect calls=0; successful real OAuth clears only
  Demo namespace and uses the guarded real Token; identity mismatch performs zero
  storage writes and leaves Demo plus real data unchanged
End-to-end Demo activity-cache isolation:
  Not complete — `main.js` initialization and refresh paths remain a mandatory
  B2-C item and are outside the B2-B module commit
B2-B final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  node --test tests/legacy/demo-isolation.test.js — Pass (15/15)
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (109/109)
  git diff --check — Pass
B2-C App Integration & Privacy Closure:
  Approved by control tower after B2-C.2 final re-review
B2-C focused tests:
  node --test tests/legacy/demo-isolation.test.js — Pass (19/19)
B2-C directed evidence:
  Demo initialize with real cache present/empty and Demo refresh each report
  getCachedActivities=0, fetchAllActivities/network=0, saveCachedActivities=0,
  return Demo activities and preserve the complete real snapshot byte-for-byte;
  real cache hit reports cache/network/save=1/0/0, real miss=1/1/1 and real
  refresh=0/1/1
B2-C privacy and UI evidence:
  main.js raw/preprocessed activities, athlete, zones, gears, date-range summary
  and unfiltered error-object logs removed or reduced to non-identifying counts;
  logout button aria-label/title are both Disconnect Strava; no Delete Local Data
  entry added
B2-C final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  node --test tests/legacy/demo-isolation.test.js — Pass (19/19)
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (113/113)
  git diff --check — Pass
B2-C first control-tower review: REVISE
B2-C omitted production-path facts:
  main gear filters still read real strava_gears; Trends read and logged real
  athlete/zones; Run Plus Demo remote actions read real Token and could fetch;
  missing/malformed Demo athlete could trigger preprocessing Legacy fallback
A3.2 minimum scope expansion: Approved by control tower
B2-C.1 Demo Production-Path Isolation:
  Approved by control tower after B2-C.2 final re-review
B2-C.1 focused tests:
  node --test tests/legacy/demo-isolation.test.js — Pass (24/24)
B2-C.1 directed evidence:
  main Demo gear real-key reads=0; Trends athlete/zones real-key reads=0 and
  identity logs=0; missing/malformed Demo athlete preprocessing fallback reads=0;
  Demo Run Plus Token reads/fetch/Token writes=0/0/0; Real Run Plus without
  refreshed tokens=1/1/0 and with refreshed tokens=1/1/1
B2-C.1 final automated checks:
  npm ci — Pass
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  node --test tests/legacy/demo-isolation.test.js — Pass (24/24)
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (118/118)
  git diff --check — Pass
B2-C.2 preprocessing test-evidence correction:
  Approved by control tower after final re-review
B2-C.2 correction reason:
  The B2-C.1 preprocessing isolation test passed an empty activities array, so
  preprocessActivities returned before applyIndoorSwimPool20mCorrection and
  isSpecificAthlete could evaluate the Demo marker or attempt the Legacy
  athlete fallback
B2-C.2 corrected evidence:
  null, array, empty-object and ID-only Demo athlete inputs each use a fresh,
  deterministic non-empty indoor-swim activity; all four production
  preprocessing calls complete with one returned activity, and forbidden
  strava_athlete_data reads remain exactly zero
B2-C.2 scope:
  Test and Task Brief evidence only; no B2-C product implementation changed
B2-C.2 final automated checks:
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  node --test tests/legacy/demo-isolation.test.js — Pass (24/24)
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (118/118)
  git diff --check — Pass
B2-C final control-tower review:
  Approved after B2-C.2
B2-C independent control-tower verification:
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  node --test tests/legacy/demo-isolation.test.js — Pass (24/24)
  node --test tests/legacy/auth-lifecycle.test.js — Pass (28/28)
  node --test tests/legacy/legacy-cache-rescue.test.js — Pass (53/53)
  npm test — Pass (118/118)
  git diff --check — Pass
End-to-end Demo activity-cache acceptance:
  Approved by control tower after B2-C.2
Browser and real-data verification: Not run
Investigation automated checks: A1 repository minimum passed
Investigation manual verification: Not run; see Manual verification
Real OAuth / real cache / Disconnect / export / restore / browser SW: Not run
Independent review: B1 approved for commit after B1.3
Final remote review: Approved for Ready for review
Reviewed head: 3abdc66b5fbfdd324d0622183e407aebf9512956
Remote PR state before Ready: OPEN / Draft / MERGEABLE / CLEAN
Changed files: 21/21 approved paths
Final B2-C commit scope: 6/6 approved paths
CI Run 30425500420: Success
Control-tower decision: Ready for review approved
Browser/real-data verification: Not run; documented limitation, not represented as Pass
```
