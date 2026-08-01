# PR-03：Legacy Repository 与 Strava Connector

## Metadata

| Field | Value |
| --- | --- |
| Status | In review |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/repository` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/repository` |
| Owner | XiChuan9 |
| Reviewer | 控制塔 + 独立审查线程 |
| Related PRD | Sections 4.1、5、8.4、8.6、8.7、17、19 |
| Related plan | Sprint 1 / PR-03 |
| Related ADRs | ADR-0003（Accepted，仅 Repository 消费者边界原则）及 ADR-0001、0002、0004、0005、0006 的下游边界 |
| Dependencies | PR-00、PR-01、PR-02 已合入 `integration/v2` |
| Starting baseline | `5137afeff2530a228c2be79af54bd04912a0c389` |
| Pull request | Draft PR [#7](https://github.com/XiChuan9/StravaStats/pull/7) |

## Status

控制塔已完成 A0、A1、A2、A2.1 和 A3 验收。A2 初次结论为 `REVISE`，经 A2.1
只读合同纠偏后为 `PASS`；A3 已冻结公共合同、ownership、依赖边界、17 个最大允许
路径和 B1/B2/B3 分阶段范围。

本状态表示 PR-03 的实施范围已经冻结。控制塔已完成 B1 与 B1.1 复验，两者结论均为
`PASS`。B2、B2.1 和 B2.2 均已通过控制塔复验，结论为 `PASS`；B2 finalization
commit 与 CI 已完成。控制塔已完成 B3 local implementation 复验，结论为 `PASS`，
B3 状态为 `Completed / PASS`。PR-03 当前为 `In review`，但尚未取得 Final Review；
Final Review Correction FR.1 已通过控制塔复验，状态为 `Completed / PASS`；当前等待
`Final Review Closure`，不得写成 Closure 已通过。PR 必须继续保持 Draft，未授权
标记 Ready 或合并，PR-04A 未开始。

## A3 approved decision record

### Public Repository API

PR-03 冻结且只冻结以下七个公共方法：

```text
listActivities({ refresh = false } = {})
getActivity(activityId)
getStreams(activityId, { types })
getAthlete()
getZones()
getGears()
getGear(gearId)
```

明确不包含 `getLaps`。Laps 当前内嵌于 activity detail；PR-03 不增加重复网络请求，
独立 lap query 留给 PR-04B 或后续 Canonical Repository。新增第八个公共方法必须
重新申请控制塔批准。

公共方法不得接收 raw Token、Authorization、raw provider response、DOM/UI 对象、
raw athlete 作为 `getGears` 参数、storage implementation 或 page/tab state。

### Public entry and factory

唯一公共入口是：

```text
js/repository/index.js
```

精确 named exports：

```text
createRepository
RepositoryError
REPOSITORY_ERROR_CODE
REPOSITORY_SOURCE
REPOSITORY_WARNING_CODE
```

公共入口禁止导出 LegacyRepository、DemoRepository、StravaApiConnector、Connector
internal errors、cache adapter、projection helpers、provider DTO helpers 或 testing-only
dependency helpers。

Public factory：

```js
createRepository({
    sessionMode,
    mode = 'legacy'
})
```

- `sessionMode` 必须显式为 `real` 或 `demo`，未知值抛出 `INVALID_REQUEST`；
- PR-03 唯一支持的 mode 是 `legacy`；
- `v2`、`shadow`、`canonical` 和未知 mode 均抛出 `UNSUPPORTED_MODE`；
- Demo 分支不得构造 Connector；
- Factory construction 不读取 Token/cache、不联网、不访问 DOM；
- dependency-injection helper 可从 `factory.js` 内部导出供测试使用，但不得由公共
  `index.js` re-export。

### Success result contract

所有公共 Repository 方法成功时统一返回：

```js
{
    data,
    source,
    warnings,
    partial
}
```

- 顶层必须且只能包含这四个字段；
- failure 通过 throw `RepositoryError`，不使用 `{ ok: false, error }` 第二套协议；
- `warnings` 永远为 array，`partial` 永远为 boolean；
- 完整结果为 `partial: false`，成功空集合不是 partial；
- 所有结果必须 JSON-safe；
- 输入不得被修改；
- 返回对象不得与 cache、Connector response 或内部 memo 共享可变引用；
- 输出不强制 deep-freeze，以保持 Legacy preprocessing 兼容。

方法 data shape：

| Method | `data` |
| --- | --- |
| `listActivities` | array |
| `getActivity` | object |
| `getStreams` | object |
| `getAthlete` | object 或合法 `null` |
| `getZones` | object 或合法 `null` |
| `getGears` | array |
| `getGear` | object |

Demo 中不存在的 activity 由 `getActivity` 抛出 `NOT_FOUND`。Demo 中存在的 activity
没有 streams 时，`getStreams` 返回空 object，不伪造 stream；activity 不存在时仍
抛出 `NOT_FOUND`。

### Source and warning contract

`REPOSITORY_SOURCE` 精确冻结为：

```text
cache
network
demo
mixed
```

`mixed` 只能用于同一成功结果由 cache/network 混合组装。

`REPOSITORY_WARNING_CODE` 精确冻结为：

```text
CACHE_READ_FAILED
CACHE_WRITE_FAILED
ITEM_FETCH_FAILED
```

Warning shape：

```js
{
    code,
    operation,
    retryable,
    itemIndex?
}
```

- `operation` 必须是冻结的七个公共方法名之一；
- `itemIndex` 只能用于 `ITEM_FETCH_FAILED`，且必须是原始 gear 顺序中的非负整数；
- warning 禁止额外字段以及 provider ID、raw message、body、payload 或 cause；
- warnings 必须确定性排序，gear item warnings 按 `itemIndex` 升序；
- operation-level warning 顺序必须稳定；
- cache write failure 不自动令 data partial；
- 只有实际缺少部分数据时才使用 `partial: true`。

### RepositoryError contract

`RepositoryError` 稳定字段：

```text
code
message
operation
retryable
httpStatus
retryAfterSeconds
```

除 `code`、`message`、`operation`、`retryable` 外，可选字段无值时使用 `null`。
错误不得携带 raw cause 或 provider payload。

`REPOSITORY_ERROR_CODE` 精确冻结为：

```text
UNAUTHENTICATED
FORBIDDEN
TOKEN_INVALID
TOKEN_READ_FAILED
TOKEN_ENCODING_FAILED
TOKEN_WRITE_FAILED
NETWORK_UNAVAILABLE
PROVIDER_HTTP_ERROR
RATE_LIMITED
NOT_FOUND
UNSUPPORTED_MODE
INVALID_REQUEST
RESPONSE_INVALID
```

当前明确不定义 `TOKEN_REFRESH_FAILED` 或 `TOKEN_EXPIRED`。`api/**` 没有结构化
refresh-failure discriminator，浏览器不得匹配 raw response message 把普通 HTTP 500
推断为 refresh failure。

冻结映射：

| Observable | Repository error |
| --- | --- |
| Token absent | `UNAUTHENTICATED` |
| malformed Token | `TOKEN_INVALID` |
| storage read throws | `TOKEN_READ_FAILED` |
| encoder throws | `TOKEN_ENCODING_FAILED` |
| fetch rejection | `NETWORK_UNAVAILABLE` |
| HTTP 401 | `UNAUTHENTICATED` |
| HTTP 403 | `FORBIDDEN` |
| HTTP 429 | `RATE_LIMITED` |
| invalid JSON/envelope | `RESPONSE_INVALID` |
| token persistence failure | `TOKEN_WRITE_FAILED` |
| HTTP 5xx | `PROVIDER_HTTP_ERROR` |

HTTP 404 按 operation 解释：`getActivity`、`getGear` 等明确 ID resource query 映射为
`NOT_FOUND`；`listActivities`、`getAthlete`、`getZones` 等非 ID query 映射为
`PROVIDER_HTTP_ERROR`。参数错误必须在 fetch 前抛出 `INVALID_REQUEST`。

`Retry-After` 只读取 header，支持整数秒或 HTTP date，使用注入 clock；无法解析时
`retryAfterSeconds: null`。所有错误必须脱敏，不得包含 Token、Authorization、
refresh Token、raw body、provider payload、GPS/健康/活动内容或原始 exception
message。

### Connector and provider pagination ownership

`StravaApiConnector` 是 network-only，只允许负责 same-origin `/api/strava-*` 请求、
query encoding、Authorization 构建、HTTP/JSON/envelope validation、refreshed Token
验证和一次写回，以及脱敏错误映射。

Connector 禁止负责 activity/metadata cache、provider pagination、Repository
Factory、Demo session 选择、UI/DOM、Canonical conversion、analysis、migration 或
Legacy Cache 清理。

Activities list：

- Connector 只发送一次 `/api/strava-activities` 请求；
- 不发送 `page` 或 `per_page`，不循环、不合并 provider pages；
- 不排序代理返回的聚合 activities；
- provider pagination 仍只属于 `api/strava-activities.js`；
- Connector internal errors 不由 Repository public index 导出。

Server pagination hardening 记录为 Backlog：`Server Proxy Contract Hardening`。它不
阻塞 PR-03，也不阻塞未修改 server proxy 的 PR-04A；首次修改
`api/strava-activities.js` 时必须补齐，最迟在 release candidate 前完成。本 PR 不
创建额外任务文件，也不修改开发计划。

### Activity cache ownership

PR-04A 前，`main.js` 继续拥有 activities cache read/write。
`Connector.fetchActivities()` 是 network-only；`fetchAllActivities()` facade 的 real
path 委托 Connector，不委托 LegacyRepository，也不读写 activities cache。

必须保持：

| Path | Cache read | Network | Cache write |
| --- | ---: | ---: | ---: |
| Initialize hit | 1 | 0 | 0 |
| Initialize miss | 1 | 1 | 1 |
| Refresh | 0 | 1 | 1 |

`LegacyRepository.listActivities()` 是未来 cache-aware API，但 PR-03 不把
`main.js` 接到它：

- `refresh: false` 时，非空有效 cache hit 返回 `source: cache`；
- empty array、expired、version mismatch 或 miss 只触发一次 network；
- observable cache read failure 可 network fallback，并产生 warning；
- network success 后最多一次 cache write；
- write failure 返回 network data 和 `CACHE_WRITE_FAILED`，不得重复 read/write；
- `refresh: true` 跳过 cache read，只进行一次 network 和最多一次 cache write。

### Gear contract and partial-cache correction

公共接口是 `getGears()` 和 `getGear(gearId)`；`getGears()` 不接收 athlete。

Aggregate cache hit 时直接返回，不读取 athlete、per-ID cache，也不联网。

Aggregate miss 时：

- 获取或复用 athlete；
- ID 顺序严格为 shoes 后 bikes，不擅自 deduplicate；
- 每个 ID 经过 `getGear`；
- per-ID cache miss 最多一次 network；
- 成功项保持原始顺序；
- 失败项按原始 index 产生 `ITEM_FETCH_FAILED`；
- 存在 item failure 时使用 `partial: true`。

完整 gear 结果可以写 aggregate cache；partial gear 结果不得写 aggregate cache。
Partial 中已成功的 per-ID gear cache 可以保留，使下一次 `getGears` 能重试失败项。
Aggregate cache write failure产生 warning，但不令完整 data partial。

旧 `fetchAllGears(athlete)` 在 B3 保持原参数和 array 返回值，不委托公共
`getGears`，不重复请求 athlete，继续使用 `Promise.allSettled` 和现有 partial array
行为，也不向旧消费者增加 warnings。

### TTL-aware athlete memo

Legacy Repository instance 可以合并并发 athlete load，但必须：

- 共享同一个 in-flight promise；
- promise reject 后立即清除；
- resolved snapshot 必须 TTL-aware，最长有效 24 小时；
- 使用注入 clock；
- TTL 到期后重新经过 cache/network 决策，不永久缓存 resolved promise；
- aggregate gears cache hit 时不得触发 athlete load；
- 并发 `getAthlete` / `getGears` 最多产生一次实际 athlete load；
- failed load 后下一次调用必须能够重试。

### Demo and dependency boundaries

DemoRepository 只读取现有 Demo namespace，返回 `source: demo`。它不得构造
Connector，Token read/fetch/Token write 均为 0；不得读取真实 activity cache、
真实 athlete/zones/gears，不得修改真实 Local Library。

PR-03 不修改 `js/demo/**` 或 `js/app/feature-flags.js`。Feature Flag 命名收敛留给
后续 PR。

依赖边界：

- Repository implementation 不导入 `js/services/api.js`；
- Connector 不导入 Repository implementation；
- `api.js` 不被 Repository 反向导入；
- `activity-cache.js` 不导入 Repository；
- Demo branch 不构造 Connector；
- `js/data/contracts/**` 不导入 Repository；
- Repository 不修改或扩大 PR-02 contract exports；
- 模块 import 不读取 Token/cache、不 fetch、不访问 DOM；
- 不形成循环依赖。

### Frozen 17-file allowlist

PR-03 全阶段最多允许以下 17 个路径：

```text
docs/tasks/pr-03-legacy-repository.md
js/connectors/strava/strava-api-connector.js
js/repository/index.js
js/repository/errors.js
js/repository/factory.js
js/repository/legacy/legacy-projection.js
js/repository/legacy/legacy-cache-adapter.js
js/repository/legacy/legacy-repository.js
js/repository/demo/demo-repository.js
js/services/api.js
tests/repository/repository-contract.test.js
tests/repository/strava-api-connector.test.js
tests/repository/legacy-repository.test.js
tests/repository/demo-repository.test.js
tests/repository/repository-factory.test.js
tests/repository/dependency-boundaries.test.js
tests/repository/legacy-api-parity.test.js
```

第 18 个路径必须重新申请控制塔批准。

Phase-specific restrictions：

```text
B1:
  docs/tasks/pr-03-legacy-repository.md
  js/connectors/strava/strava-api-connector.js
  js/repository/errors.js
  tests/repository/strava-api-connector.test.js

B2:
  docs/tasks/pr-03-legacy-repository.md
  js/repository/index.js
  js/repository/errors.js
  js/repository/factory.js
  js/repository/legacy/legacy-projection.js
  js/repository/legacy/legacy-cache-adapter.js
  js/repository/legacy/legacy-repository.js
  js/repository/demo/demo-repository.js
  tests/repository/repository-contract.test.js
  tests/repository/legacy-repository.test.js
  tests/repository/demo-repository.test.js
  tests/repository/repository-factory.test.js
  tests/repository/dependency-boundaries.test.js

B3:
  docs/tasks/pr-03-legacy-repository.md
  js/services/api.js
  tests/repository/legacy-api-parity.test.js
```

已有 B1/B2 文件可被 B3 测试引用，但不得在 B3 修改。需要修改时必须重新申请范围
扩展。

每个实施阶段完成后不得暂存、提交或推送；先返回控制塔验收。只有复验通过后，控制塔
才下发该阶段 finalization 指令。

### Frozen prohibited files and operations

除当前 phase-specific Allowed files 外，所有文件均禁止修改，特别包括：

```text
AGENTS.md
.github/**
api/**
html/**
index.html
sw.js
package.json
package-lock.json
styles/**
docs/architecture/**
docs/engineering/**
docs/migrations/**
docs/product/**
js/app/**
js/analysis/**
js/data/**
js/demo/**
js/models/**
js/pages/**
js/shared/**
js/tabs/**
js/services/activity-cache.js
js/services/index.js
js/services/legacy-cache/**
tests/contracts/**
tests/legacy/**
tests/fixtures/**
```

PR-03 禁止真实 Token/账号/活动/私人 fixture、真实 Strava 网络测试、浏览器 profile
修改、migration、Service Worker 修改、Feature Flag 接线、consumer migration、
Canonical conversion、dependency changes 或 version bump。

## Background

当前浏览器应用通过 `js/services/api.js`、Legacy activity cache、Demo API 以及页面
或 tab 中的直接请求取得 Strava 数据。ADR-0003 已接受 Repository 是未来消费者唯一
数据边界的原则，但明确把具体接口、返回 shape、错误语义、实现、Factory 和迁移留给
PR-03 及后续 PR。

PR-01 已建立 Legacy Cache 救援、Authentication Lifecycle 解耦和 Demo namespace
隔离。PR-02 已建立 provider-neutral Canonical contracts，但没有实现 Repository、
Connector、Projection、Storage 或 consumer migration。PR-03 已通过 A2/A2.1
调查真实调用链和现有行为，并由 A3 冻结保持 Legacy 行为的最小边界。

## Goal

在控制塔逐阶段授权下，实现一个最小、可测试、可回滚的 Legacy Repository 与
Strava Connector 边界：

- 只实现 A3 冻结的七个公共方法、公共入口、成功/错误/source/warning 合同；
- 保持 Connector network-only、Legacy Repository cache-aware；
- 保持 PR-04A 前 `main.js` 的 activities cache ownership；
- 建立 Legacy/Demo Repository 与 fail-closed Factory；
- 通过离线、确定性、无私人数据的 contract、Connector、Repository 和 parity 测试；
- 保持 Legacy 默认行为，不提前进行 Canonical conversion 或 consumer migration。

## Non-goals

PR-03 不做：

- 将 Legacy 数据转换为 `CanonicalActivity` 或其他 Canonical contract；
- IndexedDB v2、Canonical Repository、Shadow Writer、Parity Report 或 migration；
- 迁移全部页面、tabs、详情、streams、Run Plus、NSM 或 analysis；
- 删除、清理、覆盖、升级或改变 Legacy Cache；
- 删除或替换 `js/services/api.js`；
- 修改 PR-02 contract 语义、validator 或公共 exports；
- 重构分析算法、Demo namespace、Service Worker 或页面视觉；
- 开始 PR-04A、PR-04B、PR-04C 或 PR-05；
- 更新产品版本号、依赖或发布配置。

## Dependencies

- PR-00 Repository Safety 已合入；
- PR-01 Legacy Cache Rescue 与鉴权解耦已合入；
- PR-02 Canonical Contracts 已合入，六份 ADR 已按实际逻辑合同收窄；
- `integration/v2` 基线已确认并保持为 `5137afeff2530a228c2be79af54bd04912a0c389`；
- A2.1 已通过复验，A3 已由控制塔批准并完成范围冻结；
- B1、B2、B3 仍必须分别取得控制塔授权。

## Accepted ADR constraints

ADR-0003 只冻结以下原则：

- 未来 UI、tab、详情页和 analysis consumer 通过 Repository 或明确 read
  projection 读取活动数据；
- consumer 不选择 provider、store 或 API；
- Connector 的认证生命周期与本地 canonical read boundary 解耦；
- Legacy 路径在 migration、shadow comparison 和 rollback 获批前继续保留；
- Repository 不得让页面长期依赖 provider-specific HTTP response。

ADR-0003 没有冻结方法名、参数、返回结构、错误合同、Factory、Legacy adapter、
Strava Connector、Feature Flag 接线或 consumer migration。

## A2/A2.1 verified current state

以下结论已由 A2/A2.1 只读调查验证：

- `js/services/api.js` 是主要 Strava API 访问入口，部分页面和 tabs 仍绕过它；
- `activity-cache.js` 保存 Legacy activity list，并由 app/gear 路径读取；
- Demo API 与真实 API 在 services 层存在分派；
- `auth-lifecycle.js` 已提供部分稳定 auth 状态，但 Repository 使用 A3 冻结的独立、
  脱敏错误合同；
- `feature-flags.js` 当前使用 `legacy` / `v2`，与架构文档的
  `legacy` / `shadow` / `canonical` 不一致；
- Canonical contracts 尚未从浏览器应用路径实际接入；
- PR-03 不进行 consumer migration，也不触发 PR-02 延期的 browser dynamic import
  门禁。

## A0 baseline evidence

执行日期：2026-07-30，环境：macOS / Asia/Shanghai。

| Check | Result |
| --- | --- |
| V2 worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` |
| V2 branch | `integration/v2` |
| Local HEAD | `5137afeff2530a228c2be79af54bd04912a0c389` |
| Remote `integration/v2` | 与预期 SHA identical，ahead/behind `0/0` |
| V2 worktree status | Clean |
| Repository worktree before A1 | Absent |
| Local/remote `codex/v2/repository` before A1 | Absent |
| Related PR before A1 | Absent |
| PR-03 Task Brief before A1 | Absent |
| `npm ci` | Pass；added 6 packages，0 vulnerabilities |
| `npm run check:syntax` | Pass；116 files |
| `npm run check:privacy` | Pass |
| `npm test` | Pass；398/398 |
| `git diff --check` | Pass |

远端状态通过已连接的 GitHub app 核对；本地 `gh` 默认账号凭据无效，未被用于建立
远端事实。GitHub compare 证明预期 SHA 与 `integration/v2` identical；远端 branch
搜索和全部近期 PR 检查未发现 PR-03 同名对象。

## Implementation authorization gate

A3 只完成决策记录和范围冻结。后续 B 阶段均须由控制塔逐阶段单独授权；
当前 B1/B1.1、B2/B2.1/B2.2 与 B3 均已完成并通过控制塔复验；B3 finalization
已获授权，PR-03 在完成提交、推送与 CI 后等待 Final Review。

- B1 只能使用 B1 phase-specific Allowed files；
- B2 finalization 已完成；B3 只能使用本阶段获批的三个路径；
- 每阶段完成实现和本地验证后不得自行暂存、提交或推送；
- 每阶段必须先返回控制塔验收，再等待独立 finalization 指令；
- 不得用全阶段 17-file allowlist 绕过 phase-specific 限制；
- 不运行真实网络、真实 Token、真实账号或私人活动测试。

## Investigation record

A2 初次返回为 `REVISE`。A2.1 已完成 pagination ownership、activities cache/facade、
error observability、public boundary、Gear contract、dependency graph、Allowed files
和测试矩阵纠偏，并由控制塔复验为 `PASS`。冻结结论以本文件
“A3 approved decision record”为准。

## Prohibited operations

- 直接修改 `main`、`maintenance/v1` 或 `integration/v2`；
- rebase、amend、force-push、合并 PR、把 PR 标记 Ready、删除分支或 worktree；
- 使用 `git add .` 或 `git add -A`；
- 删除、清空、覆盖或修改 Legacy Cache；
- 修改任何浏览器 profile 数据；
- 修改 migration 文件或创建 migration；
- 修改 Service Worker；
- 更新产品版本号；
- 添加或更新依赖；
- 使用真实 Token、账号、活动、GPS、健康、设备或私人导出；
- 真实 Strava 或其他网络测试；
- 实施 A3 冻结范围之外的接口、Factory、Connector、Feature Flag 或 consumer wiring；
- 为 Repository 修改 `js/data/contracts/**` 语义或扩大 exports；
- 未经控制塔授权自行进入 B1、B2 或 B3；
- 在阶段验收前自行暂存、提交或推送实施变更；
- 修改 phase-specific Allowed files 之外的任何路径。

## Privacy constraints

- 不允许真实 access Token、refresh Token、Authorization header、Cookie 或账号；
- 不允许真实 FIT、TCX、GPX、Strava ZIP、GPS、HR、Power、设备序列号或私人活动；
- 自动测试只能使用 inline 或 approved synthetic deterministic data；
- 错误、日志、PR、CI 和调查报告不得包含原始 response body、完整 provider payload
  或可识别运动信息；
- Demo 模式必须保持 `strava_tokens_demo` 与 Demo namespace 隔离；
- 不读取、枚举、复制或提交 `tests/fixtures/private/`。

## Testing expectations

每个获批 B 阶段的最低门禁：

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

专项测试必须离线、确定性、无真实 credentials，按 phase-specific 范围覆盖
Repository contract、Legacy parity、Connector HTTP/auth/JSON/envelope、Factory
fail-closed、cache hit/miss/TTL、Demo 零网络/零 Token、error redaction、
non-mutation、import side effects 和 no DOM。

客户端 Connector 不测试 provider pagination、多页合并或中页失败。Connector 对
activities 只断言一次代理请求、聚合 envelope、稳定顺序和 HTTP/error mapping。
真正的 server pagination tests 属于 `Server Proxy Contract Hardening` backlog。

## Migration impact

A0–A3 没有 migration，不读取或修改用户存储，不创建 IndexedDB v2，不清理或写回
Legacy Cache。Canonical conversion 不属于 PR-03。

Consumer migration 属于 PR-04A/PR-04B/PR-04C。PR-03 只允许 B3 对现有
`fetchAllActivities()` network facade 做冻结范围内的兼容委托，不接 main/pages/tabs。

## Rollback expectation

A1/A3 只有 Task Brief 普通提交，可用普通 revert 撤销，不影响产品代码或浏览器数据。
未来获批实现必须保留 Legacy 默认路径，通过普通 revert 恢复，不删除 Legacy 或
Canonical 数据，不以 cache 清理作为回滚步骤。B3 出现回归时可单独 revert facade
委托，恢复旧 network 路径。

## Browser verification carry-over

PR-02 延期的 browser native ESM dynamic import、exact exports/validator calls、
storage/network/Service Worker instrumentation 和 Manual DevTools 仍为
`Not run`，不是 Pass。

PR-03 不从浏览器应用路径导入 Canonical contracts，也不接 consumer，因此不触发该
门禁。该门禁保持 `Not run` 并明确移交 PR-04A；Node 测试不能替代浏览器验证。

## Acceptance process

```text
A0 baseline
→ A1 Task Brief + Draft PR + CI
→ A2 read-only investigation（REVISE）
→ A2.1 read-only contract correction（PASS）
→ A3 approved decision and scope freeze
→ B1 separately authorized implementation
→ B1 control-tower review and finalization
→ B2/B3 separately authorized implementation and finalization
→ independent review
→ project-owner Ready approval
→ separate merge authorization
```

PR 在 A3 后仍必须保持 Draft。只有 project owner 单独授权才能标记 Ready；只有后续
独立授权才能合并。

## Stop conditions

以下任一发生立即停止并报告：

- 当前阶段需要第 18 个路径或 phase-specific Allowed files 之外的路径；
- 需要新增公共方法、error/warning/source、success 字段或公共 export；
- 需要修改 `api/**`、consumer、Feature Flag、Canonical contracts、dependency、
  migration、Service Worker 或版本号；
- 需要真实凭据、私人数据、真实网络或浏览器 profile；
- PR base/head、Draft/Open 状态不正确；
- 任一门禁或 CI 失败；
- 发现 Token、Authorization、raw body、provider payload、GPS/健康数据泄漏；
- 当前阶段尚未获控制塔授权。

## B1 finalization record

- 公共 Repository error constants 已冻结；`RepositoryError` 保持 immutable、redacted，
  `toJSON()` 与 `JSON.stringify()` 不受事后 mutation 影响。
- network-only `StravaApiConnector` 实现六个方法：`fetchActivities()`、
  `fetchActivity()`、`fetchStreams()`、`fetchAthlete()`、`fetchZones()` 和
  `fetchGear()`。
- Activities 只发送一次 browser proxy request，不实现 client provider pagination、
  page 合并或排序。
- Token read/parse/encode/write、operation-sensitive 404、strict delta-seconds /
  IMF-fixdate `Retry-After`、HTTP/JSON/envelope/redaction 合同均有确定性测试。
- 成功响应只返回 JSON-safe detached data；accessor、reflection failure 与 Proxy 均
  fail closed，不执行 getter，也不传播 raw exception。
- 本地门禁：focused 101/101、full 499/499、syntax 119 files、privacy 与
  `git diff --check` 全部通过。
- 真实网络与 browser verification 为 `Not run`；没有使用真实 Token、账号、活动、
  GPS 或健康数据。
- B1 finalization 时 B2/B3 implementation 尚未开始；当前 B2 状态见下方本地实施记录，
  B3 仍未授权。

## B2 local implementation record

- Public Repository entry 精确导出 `createRepository`、`RepositoryError`、
  `REPOSITORY_ERROR_CODE`、`REPOSITORY_SOURCE` 和
  `REPOSITORY_WARNING_CODE`；内部 implementation、Connector、cache/projection 与
  DI helper 均未公开。
- Factory 仅支持显式 `real` / `demo` session 和 `legacy` mode；Demo branch 不构造
  Connector 或真实 cache，默认依赖保持 lazy，import/constructor 零 I/O。
- LegacyRepository 与 DemoRepository 均实现冻结的七方法和精确
  `{ data, source, warnings, partial }` success envelope；没有 `getLaps` 或第八方法。
- Legacy projection 保留 Legacy DTO、拒绝敏感 transport key，并对 accessor、
  Proxy、cycle、non-JSON value fail closed；输出 detached 且安全处理
  `__proto__` / `constructor`。
- Legacy metadata/gear cache adapter 仅访问冻结 key，使用 24h TTL、精确 key-pair
  cleanup、snapshot/compensating rollback；activity cache 只通过注入调用现有
  `getCachedActivities` / `saveCachedActivities`。
- Connector errors 映射为公共 Repository errors；athlete snapshot/in-flight
  coalescing、TTL expiry、gear shoes-before-bikes 顺序、duplicate ID、partial warning、
  mixed source、aggregate/per-ID cache ownership均由确定性测试覆盖。
- Demo 七方法保持 `source: demo`，不读取 Token、真实 cache 或真实 Local Library，
  不构造 Connector，不联网；malformed payload 安全退化，不 fallback real。
- B2 初验前本地门禁：B2 focused 82/82、B1 regression 101/101、full 581/581、
  syntax 130 files、privacy 与 `git diff --check` 全部通过。
- 真实网络与 browser verification 为 `Not run`；未使用真实 credentials、私人活动、
  GPS、健康数据或 browser profile。
- B2 初验前没有 staged path、commit、push、PR body 更新或远端 CI 记录；B3
  implementation 尚未开始。

## B2.1 contract correction record

控制塔对 B2 初验结论为 `REVISE`，要求纠正以下两个合同根因：

1. `getGears()` 错误地把 athlete source 无条件加入 gear source 集合，使
   “athlete cache + 全部 gear network”和“athlete network + 全部 gear cache”
   被误报为 `mixed`。
2. Legacy cache 只检查 age，未拒绝 future timestamp 或
   `timestamp + ttlMs` overflow；athlete memo 也直接信任 cache `expiresAt`，
   可能形成超出一个 metadata TTL 的 snapshot 或非有限 expiry。

B2.1 修正合同：

- 非空或 partial 且存在成功 gear 时，source 只由成功 gear 的 cache/network
  来源决定；只有完整空 gear 或 partial 且零成功 gear 时才使用 athlete source。
  顺序、duplicate ID、warning、partial 和 aggregate write 合同保持不变。
- Legacy cache timestamp 必须有限且不晚于 injected now，age 不得大于 TTL，
  `timestamp + ttlMs` 必须有限；future、expired、overflow 和非法 timestamp
  按原策略只清理对应 data/timestamp key pair，cleanup failure 继续返回
  observable failed status。
- Athlete cache expiry 必须有限且未过期，并 clamp 到本次
  `now + metadataTtlMs`；invalid/expired expiry 产生 `CACHE_READ_FAILED` 后
  fallback network。无法建立有限 expiry 上限时以稳定 `RepositoryError`
  fail closed，network snapshot 也不能形成 Infinity 或永久 memo。
- 定向测试新增六种 gear source 组合，以及 future timestamp、expiry overflow、
  `timestamp === now`、exact TTL boundary、cleanup failure、极远 cache expiry
  clamp、expired/non-finite cache fallback 和 network expiry overflow。
- B2.1 本地门禁：B2 focused 94/94、B1 regression 101/101、full 593/593、
  syntax 130 files、privacy 与 `git diff --check` 全部通过。
- B2.1 仅修改 Task Brief、Legacy cache adapter、LegacyRepository 和 Legacy
  Repository tests；B2.1 复验前没有 staged path、commit、push、PR body 更新或
  远端 CI。B3 implementation 未开始。

## B2.2 Cache Adapter fail-closed correction record

控制塔复验确认 B2.1 的 gear source 与 TTL 上限两个原阻断项已正确修复，同时发现
LegacyCacheAdapter 在类型验证前执行 `Number()`、`timestamp + ttlMs` 和
`now - timestamp`，使 Symbol、BigInt 或非数字 clock 可能泄漏原生 `TypeError`。

B2.2 修正合同：

- Read/write 均先捕获 injected clock exception，再要求 clock value 为 primitive、
  finite number；Symbol、BigInt、string、boxed Number、object、null、undefined、
  `NaN` 和 `Infinity` 全部稳定返回 cache failed，不进入任何算术。
- 非法 clock 不清理现有 cache；read/write 不传播原生异常。
- Storage data value 仅接受 string/null；非字符串 data 返回 failed，且不调用
  `JSON.parse`、`valueOf`、`toString` 或 Proxy trap。
- Storage timestamp value 仅接受 string/null；只有确认 non-empty string 后才调用
  `Number()`。非字符串 timestamp 不执行 coercion，并按冻结合同只清理当前
  data/timestamp key pair；cleanup failure 继续返回 observable failed。
- 定向测试覆盖 read/write clock throw、Symbol、BigInt、string、boxed Number、
  observable object、null、undefined、`NaN`、`Infinity`；timestamp Symbol、
  BigInt、observable object/Proxy；data Symbol、observable object/Proxy；
  coercion/trap 调用均为 0，并验证 cleanup 精确范围与非法 clock 零 cleanup。
- B2.2 本地门禁：B2 focused 115/115、B1 regression 101/101、full 614/614、
  syntax 130 files、privacy 与 `git diff --check` 全部通过。
- B2.2 仅修改 Task Brief、Legacy cache adapter 和 Legacy Repository tests；
  B2.2 复验前没有 staged path、commit、push、PR body 更新或远端 CI。B3
  implementation 未开始。

## B2 finalization record

- 控制塔复验结论：B2、B2.1 gear source / TTL correction、B2.2 Cache Adapter
  fail-closed correction 均为 `PASS`。
- 最终合同已通过：六种 gear source 组合、athlete memo 单 TTL 上限、future/overflow
  timestamp 拒绝、primitive finite clock、storage 零 coercion、精确 key-pair cleanup、
  stable source/warning/partial 与 Demo 零 Connector/Token/真实 cache I/O。
- 最终本地门禁：B2 focused 115/115、B1 regression 101/101、full 614/614、
  syntax 130 files、privacy 与 `git diff --check` 全部通过。
- 最终 B2 实际路径精确为以下 12 个：

```text
docs/tasks/pr-03-legacy-repository.md
js/repository/index.js
js/repository/factory.js
js/repository/legacy/legacy-projection.js
js/repository/legacy/legacy-cache-adapter.js
js/repository/legacy/legacy-repository.js
js/repository/demo/demo-repository.js
tests/repository/repository-contract.test.js
tests/repository/legacy-repository.test.js
tests/repository/demo-repository.test.js
tests/repository/repository-factory.test.js
tests/repository/dependency-boundaries.test.js
```

- 真实网络、真实 Token、真实账号和 browser/profile verification 继续为 `Not run`；
  未使用私人活动、GPS、健康数据或 private fixture。
- B2 finalization 时 B3 为 `Not authorized / Not started`；当前 B3 状态见下方本地
  实施记录。PR #7 必须保持 Draft，不得标记 Ready 或合并。

## B3 implementation and control-tower acceptance record

- B2 finalization commit 为
  `a31b4ddf6ed895f7456a17d3fe00d859d4b00ae6`；B2 CI run
  [30629769024](https://github.com/XiChuan9/StravaStats/actions/runs/30629769024)
  结论为 success。
- B3 实际范围精确为 `docs/tasks/pr-03-legacy-repository.md`、
  `js/services/api.js` 和 `tests/repository/legacy-api-parity.test.js` 三个路径。
- 控制塔已完成 B3 local implementation 复验，结论为 `PASS`；B3 finalization 已获
  授权，PR-03 在 finalization 完成后等待单独 Final Review。
- Demo `fetchAllActivities()` 继续先检查 Demo session 并直接返回 Demo activities；
  Connector、Token read/write、`btoa`、network 和真实 activities cache I/O 均为 0。
- Real `fetchAllActivities()` 直接委托临时构造、零 I/O 的 network-only
  `StravaApiConnector.fetchActivities()`；浏览器只请求一次
  `/api/strava-activities`，不经过 Repository、activities cache、pagination、排序或
  `handleApiResponse()` 二次处理，并保持 Legacy array 返回。
- Connector `HTTP_UNAUTHENTICATED` / `HTTP_FORBIDDEN` 仅依据 immutable
  `StravaConnectorError` 与稳定 code 映射回既有 `ApiResponseError` 401/403 语义；
  500、network、JSON/envelope 与 Token read/parse/encode/write failure 均不伪装为
  auth 或 refresh failure，错误输出不保存 raw message/body/payload/cause。
- Legacy `fetchAllGears(athlete)` 保持原 facade：不重新获取 athlete，不调用
  Repository，shoes-before-bikes、duplicate ID、`Promise.allSettled`、partial array、
  null/rejected omission 和 Demo offline 行为均未改变。
- 新增 22 个完全离线、确定性的 parity tests；B3 focused 22/22、B1 101/101、
  B2 115/115、Repository combined 238/238、Legacy auth/Demo 52/52、full 636/636。
  Syntax 为 131 files，privacy 与 `git diff --check` 通过。
- 真实网络、真实 Token、真实账号、browser/profile/storage verification 继续为
  `Not run`；未读取 private fixture 或私人活动、GPS、健康数据。
- B3 local implementation 验收前未 staged、未 commit、未 push、未更新 PR body；
  finalization 仍要求 PR #7 保持 Draft。尚未取得 Final Review，未授权 Ready/merge，
  未开始 PR-04A 或 consumer migration。

## Final Review correction FR.1 local record

- PR-03 总状态继续为 `In review`；B1、B1.1、B2、B2.1、B2.2 与 B3 均保持
  `Completed / PASS`。控制塔已通过 FR.1 review，FR.1 状态为 `Completed / PASS`；
  Final Review 当前为 `awaiting Final Review Closure`，不得写成 Closure 已通过，
  未授权 Ready 或 merge，PR-04A 未开始。
- FR.1 根因是 `LegacyRepository.#loadCacheBacked()` 在判断 `includeExpiry` 前无条件
  执行 `Number(cacheResult.expiresAt)`：这会接受 numeric string，并可能对 boxed
  Number、object 或 Proxy 触发隐式 coercion、`valueOf()`、`toString()` 或 trap；
  zones/getGear 等非 memo 路径也会无意义处理未使用的 expiry。
- FR.1 实际允许路径精确为 `docs/tasks/pr-03-legacy-repository.md`、
  `js/repository/legacy/legacy-repository.js` 和
  `tests/repository/legacy-repository.test.js`，不得出现第 4 个路径。
- 修正后只有 `includeExpiry === true` 才读取和验证 expiry；athlete expiry 必须为
  primitive finite number 且严格大于本次 `now`，合法极远值继续 clamp 到
  `maxExpiresAt`。非法、缺失、过期或 non-finite expiry 稳定产生一个
  `CACHE_READ_FAILED` warning 并 fallback network，不传播原生异常或返回伪 cache hit。
- 非 memo cache hit 不读取、转换或调用 expiry value；zones/getGear 既有 cache source、
  network count 与返回合同保持不变。
- 新增确定性矩阵覆盖 numeric string、boxed Number、BigInt、Symbol、null、undefined、
  `NaN`、`Infinity`、带 observable `valueOf()`/`toString()` 的 object 与带
  `get`/`getPrototypeOf`/reflection traps 的 Proxy value；逐项证明 coercion/trap 为 0、
  network 恰好一次、source 为 network、warning 为 `CACHE_READ_FAILED` 且数据来自
  network。
- 合法 boundary 回归继续证明 `expiresAt > now` cache hit、`expiresAt === now`
  fallback、极远 finite expiry clamp 到一个 metadata TTL，并在 clamp boundary 重新读取。
  非 memo zones 的 observable object/Proxy expiry 均保持 0 coercion/trap、0 network 与
  cache source。
- FR.1 本地证据：Legacy Repository 95/95、B3 parity 22/22、B1 Connector 101/101、
  Repository all 252/252、full 650/650、syntax 131 files、privacy 与
  `git diff --check` PASS。真实 Token、真实网络、私人数据和 browser profile 验证均为
  `Not run`。
- FR.1 本地修订复验已由控制塔判定为 `PASS`，并已单独授权 Finalization；PR 必须继续
  保持 Draft。Ready、merge 与 PR-04A 均未授权，Finalization 完成后等待
  Final Review Closure。

## Phase ledger

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| A0 Environment, baseline, remote audit | Completed | Baseline `5137afe...`；116 syntax files；398/398 tests；all gates Pass |
| A1 Worktree, branch, Task Brief, Draft PR | Completed | Commit `01a5ac2...`；Draft PR #7；CI run `30537098485` success |
| A2 Read-only investigation | Completed with REVISE | 初次决策包需纠偏 pagination、cache/facade、error、public boundary、Gear 和 dependencies |
| A2.1 Read-only contract correction | Completed / PASS | 控制塔复验通过；纠偏结论已纳入 A3 freeze |
| A3 Decision and scope freeze | Completed | 公共合同、ownership、17-file allowlist 与 phase restrictions 已冻结 |
| B1 | Completed / PASS | 公共 errors/constants、network-only Connector、六个方法和本地 101/101 focused、499/499 full、119-file syntax、privacy/diff 门禁均通过；控制塔已批准 Finalization |
| B1.1 | Completed / PASS | immutable/redacted Error 与 strict `Retry-After` 安全纠偏已通过控制塔复验 |
| B2 | Completed / PASS | 公共 entry、Factory、Legacy/Demo Repository、projection/cache 与共享合同测试完成；focused 115/115、B1 101/101、full 614/614、syntax 130 files、privacy/diff PASS |
| B2.1 | Completed / PASS | 六种 gear source 与 TTL/future/overflow/memo 上限纠偏通过控制塔复验 |
| B2.2 | Completed / PASS | primitive finite clock、storage 零 coercion 与精确 cleanup fail-closed 纠偏通过控制塔复验 |
| B3 | Completed / PASS | 控制塔已通过 Legacy activities facade 与 API parity 本地实施复验；focused 22/22、Repository 238/238、Legacy 52/52、full 636/636、syntax 131 files、privacy/diff PASS；等待 PR-03 Final Review |
| Final Review | awaiting Final Review Closure | FR.1 Completed / PASS；primitive finite expiry、零 coercion、非 memo expiry 忽略与 fallback warning 合同通过控制塔复验；Closure 尚未通过 |
