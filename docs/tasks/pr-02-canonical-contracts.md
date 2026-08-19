# PR-02：ADR 与 Canonical Contracts

## Metadata

| Field | Value |
| --- | --- |
| Status | In review |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/contracts` |
| Worktree | `<worktree-root>/contracts` |
| Owner | XiChuan9 |
| Reviewer | 独立 Codex 线程 + XiChuan9 |
| Related PRD | Sections 4、5、6、8.4、9、15、17、19 |
| Related plan | Sprint 1 / PR-02 |
| Related ADRs | ADR-0001 至 ADR-0006（均于 2026-07-30 Accepted） |
| Dependencies | PR-00 与 PR-01 已合入 `integration/v2` |
| Pull request | https://github.com/XiChuan9/StravaStats/pull/6 |

## Phase status and evidence

- A0 baseline completed；
- A1 Task Brief completed；
- A2 read-only investigation completed；
- Investigation Gate approved by control tower；
- A3 decision package approved by project owner；
- A3 accepted and B1 authorized by control tower；
- B1 initial control-tower review: `REVISE`；
- B1.1 accessor/Proxy safety revision completed locally；
- B1.1 control-tower re-review: `Accepted`；
- B1 local implementation gate: `Accepted`；
- B1 commit:
  `b5b6c60b9f197ea540790cc30b61fc6e312b61e7`；
- B1 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30515429741；
- B1 remote finalization: `Accepted`，B1 formally closed；
- B2 local implementation authorized by control tower；
- B2 local implementation completed；
- B2 independent control-tower review: `Accepted`；
- B2 Local Implementation Gate: `Accepted`；
- B2 commit:
  `3e2f8df5a0bf50e51c462f16fefe8ce4a6d76a99`；
- B2 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30520888393；
- B2 remote finalization: `Accepted`，B2 formally closed；
- B3 local implementation authorized by control tower；
- B3 ADR closure and automatic local verification completed；
- B3 browser limitation independently reproduced by control tower in both
  in-app Browser and connected Chrome；
- B3 Local Review Gate: `Accepted`；
- B3 documentation commit:
  `1240dcf0cdea5037037593364e3aac4f262b360a`；
- B3 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30526989854；
- B3 remote commit/CI finalization: `Completed`；
- Browser dynamic import、storage/network instrumentation 与 Manual DevTools
  已由控制塔批准延期，但继续保持 `Not run`，不视为 Pass；
- ADR-0001 至 ADR-0006 已收窄到 PR-02 实际实现和测试的逻辑合同，并于
  2026-07-30 转为 `Accepted`；
- Accepted decision 不等于下游 Repository、Storage、Import、Projection 或
  Analysis 已实现。

实际证据：

- Task Brief commit:
  `0daddbc47de605c5e0b1fc9b04ebdd0f0246632a`；
- Draft PR: https://github.com/XiChuan9/StravaStats/pull/6；
- CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30506623094；
- CI result: Success；
- A1 diff: Task Brief only；
- A2 Git/file modifications: None；
- Investigation Gate: Approved；
- A3 commit:
  `a4ef3124790aa3fbef2d52af99963044bdb614ca`；
- A3 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30510590380；
- A3 CI result: Success；
- A3 PR body: Updated，PR remains Draft；
- B1 commit:
  `b5b6c60b9f197ea540790cc30b61fc6e312b61e7`；
- B1 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30515429741；
- B1 CI result: Success；
- B1 finalization: Accepted and closed；
- B2 commit:
  `3e2f8df5a0bf50e51c462f16fefe8ce4a6d76a99`；
- B2 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30520888393；
- B2 CI result: Success；
- B2 finalization: Accepted and closed；
- B3 exact local scope: Task Brief + ADR-0001 through ADR-0006；
- B3 documentation commit:
  `1240dcf0cdea5037037593364e3aac4f262b360a`；
- B3 CI Run:
  https://github.com/XiChuan9/StravaStats/actions/runs/30526989854；
- B3 CI result: Success；
- Browser direct contract-module URL load: Pass（in-app Browser 与 Chrome）；
- Browser dynamic import and automated side-effect smoke: Not run（两种受控
  `playwright.evaluate` 执行面均不提供 module loading；未绕过）；
- Browser deferral: Approved by control tower；由第一个实际从浏览器应用路径接入
  contracts 的后续 PR 补齐，且必须在 Canonical 默认启用或进入 release candidate
  前完成；
- Manual DevTools panel inspection: Not run；
- Real-data verification: Not run。

## Goal

在不改变现有运行时页面、Legacy Cache、IndexedDB 或数据来源的前提下，定义来源中立、
可校验、可版本演进的最小 Canonical Contract。PR-02 冻结逻辑合同和纯 validation
边界，不实现 Repository、Storage、Connector、Decoder、Import Pipeline、Projection
或 Analysis。

PR-02 的合同范围是：

- `CanonicalActivity`；
- `CanonicalStreamSet` 与 `StreamSeries`；
- `Lap` 与 `Event`；
- `ActivitySource` 与最小 `DeviceReference`；
- `Capabilities`；
- `VersionMetadata`；
- `ImportedActivityBundle`；
- 稳定的 validation error/warning contract；
- ID、缺失值、数值、单位、时间、sport taxonomy、版本与引用完整性规则。

## Current-state findings

- 当前前端是 Vanilla JavaScript + 原生 ES Modules，静态 Web/PWA 部署，没有
  bundler；
- V1 现有 `ActivityTrack`、`AnalysisResult`、Strava DTO 与 Strava StreamSet
  是 Legacy/来源特定模型，不是来源中立的 Canonical Contract；
- A3 完成时仓库中尚不存在 PR-02 目标 runtime validator、
  `js/data/contracts/` 或 `tests/contracts/`；B1 只创建获批的
  CanonicalActivity validation core 与三份专项测试；
- PRD 数据模型是产品语义示例，不是最终 runtime schema；
- PR-00 已建立 syntax、privacy 与 `node:test` 最低检查；
- PR-01 已建立 Legacy Cache 救援与鉴权生命周期解耦；
- Repository、IndexedDB v2、Shadow Writer、Import Core、Decoder 与 Legacy
  Projection 均安排在后续 PR；
- 测试必须离线、确定性，不依赖 Strava credentials、网络、真实浏览器 profile
  或私人 fixture。

## Approved validator and validation API

PR-02 使用 dependency-free 显式 validator：

- 不修改 `package.json` 或 `package-lock.json`；
- 模块必须可由 Node 与原生浏览器 ESM 直接 import；
- 不依赖 bundler、CDN、runtime compilation 或 `unsafe-eval`；
- 不 coercion、不填默认值、不 strip unknown fields；
- 不排序或修改输入；
- 不把 class instance、`Date`、`Map` 或 `Set` 写入合同对象；
- 普通非法输入不 throw；
- 仅 validator API 被错误调用等 programmer misuse 允许抛出 `TypeError`；
- validation result 不返回活动原始值或敏感字段；
- path 使用 JSON Pointer；
- 多个 error 按 `path`、`code` 稳定排序；
- warning 使用与 error 相同的稳定 item shape 和排序；
- 程序逻辑只能依赖稳定的 `code` / `path`，不得依赖 message 文案。

普通非法输入示例：

```js
{
  ok: false,
  errors: [
    {
      code: "ID_INVALID",
      path: "/activity/id",
      message: "Expected a non-empty opaque string."
    }
  ],
  warnings: []
}
```

成功结果：

```js
{
  ok: true,
  errors: [],
  warnings: []
}
```

Unsupported schema version 返回 `VERSION_UNSUPPORTED`。Unknown field 保留在原输入
中，并产生 `UNKNOWN_FIELD` warning；validator 不删除该字段。

## Approved primitive rules

### IDs

- ID 必须是 trim 后非空的 opaque string；
- number 必须拒绝；
- `"123"` 是合法 string ID，且不得转换成 number；
- cross-reference 使用精确 string equality；
- 空字符串、纯空白、`NaN` 和 `Infinity` 均不得充当 ID。

### Missing values

- absent 表示生产者未提供该可选字段；
- `null` 表示字段适用，但已确认值不可用；
- `0` 表示真实测量、声明或 offset 为零；
- validator 不把 absent 或 `null` 转换成 `0`；
- 合法真实 `0` 必须原样保留。

### Numbers and units

- 所有 number 必须 finite，拒绝 `NaN`、`Infinity`、`-Infinity`；
- distance、duration、power、cadence、elevation gain 与 offset 不得为负；
- altitude 与 temperature 可以为负；
- `schemaVersion` 必须是受支持的正整数；
- heart rate 必须大于 0，hard maximum 为 300 bpm；
- latitude 范围为 -90 至 90；
- longitude 范围为 -180 至 180；
- 极端但可能真实的 power、cadence、temperature 优先 warning，不随意 hard reject。

字段名携带单位或由 stream type/unit 明确单位。第一版使用米、秒、瓦、bpm、
摄氏度和 WGS84 经纬度。

## Approved CanonicalActivity

最小必填字段：

- `schemaVersion`；
- `id`；
- `sportCategory`；
- `sportVariant`；
- `startTimeUtc`；
- `timeZone`；
- `capabilities`。

`sportVariant` 可以为 `null`。

候选 nullable/optional summary 字段：

- `name`；
- `distanceMeters`；
- `movingTimeSeconds`；
- `elapsedTimeSeconds`；
- `elevationGainMeters`；
- `averageHeartRateBpm`；
- `averagePowerWatts`；
- `averageCadence`；
- `extensions`。

规则：

- 第一版 `schemaVersion` 为 `1`；
- `movingTimeSeconds` 与 `elapsedTimeSeconds` 同时存在时，前者不得大于后者；
- `extensions` 必须是 plain JSON-safe object；
- provider-specific 字段不得扩散到顶层。

## Approved time contract

`startTimeUtc`：

- 必须是 RFC 3339 UTC instant；
- 必须显式以 `Z` 结尾；
- 第一版固定毫秒精度；
- validator 不自动规范化或补 timezone；
- 必须拒绝非法月份、不存在日期等日期溢出；
- 不接受无 offset local datetime 充当 absolute instant。

`timeZone`：

```js
{
  ianaName: string | null,
  utcOffsetMinutes: integer | null
}
```

规则：

- `timeZone` object 必须存在；
- `ianaName` 和 `utcOffsetMinutes` 各自可以为 `null`；
- offset 范围为 -840 至 840 分钟；
- IANA name 只做稳定、确定性的格式检查；
- 不把不同 runtime/tzdb 的 zone-offset 一致性作为 hard-fail；
- 可能的不一致通过 warning 表达；
- PR-02 不保存冗余 `localStart`；
- 后续 Projection 可由 UTC instant 和 timezone metadata 生成本地显示时间。

## Approved sport taxonomy

第一版顶层 category：

- `run`
- `ride`
- `swim`
- `walk`
- `hike`
- `workout`
- `winter`
- `team`
- `racket`
- `other`

`sportVariant`：

- 为 `null` 或来源中立的 normalized slug；
- 未知运动使用 `other` + normalized variant；
- 不因未知运动拒绝整条活动；
- provider 原始类型保存在 provenance/extensions，不进入页面 provider 分支。

PR-02 记录以下基础映射示例，但不实现完整 Strava Decoder：

| Source type | sportCategory | sportVariant |
| --- | --- | --- |
| Run | run | road |
| TrailRun | run | trail |
| VirtualRun | run | virtual |
| Ride | ride | road |
| MountainBikeRide | ride | mountain-bike |
| GravelRide | ride | gravel |
| VirtualRide | ride | virtual |
| IndoorRide | ride | indoor |
| EBikeRide | ride | electric |
| PoolSwim | swim | pool |
| OpenWaterSwim | swim | open-water |
| WeightTraining | workout | strength |
| Yoga | workout | yoga |

## Approved Capabilities

第一版严格使用 boolean，不采用 `available`、`unavailable`、`unknown` 三态字符串：

```js
{
  hasGps: boolean,
  hasHeartRate: boolean,
  hasPower: boolean,
  hasCadence: boolean,
  hasLaps: boolean
}
```

三态字符串被禁止，因为 JavaScript 中 `"unavailable"` 是 truthy，会与 PRD 的
`capabilities.hasGps` 消费方式冲突。

规则：

- 五个字段全部必填且必须是 boolean；
- 尚未确认的能力通过 bundle warning 或 quality metadata 表达；
- unknown 不得编码成 truthy string；
- bundle 包含对应 stream/lap 时，相关 capability 必须为 `true`；
- capability 为 `true` 但 summary-only bundle 尚未携带详细 stream 可以合法；
- capability 为 `false` 时，同一完整 bundle 不得携带对应数据。

## Approved stream, lap and event contracts

### CanonicalStreamSet and StreamSeries

```js
{
  activityId,
  series: []
}
```

`StreamSeries` 逻辑字段：

- `streamType`；
- `unit`；
- `offsetsSeconds`；
- `values`；
- `quality`（optional）。

规则：

- 每个 series 允许独立 logical timeline；
- `offsetsSeconds` 与 `values` 长度必须一致；
- offset 必须 finite、非负且 non-decreasing；
- 重复 timestamp 允许，但产生稳定 warning；
- 缺失点使用 `null`；
- 合法 `0` 原样保留；
- 空 series 无效；
- 缺失 stream 通过不包含该 series 表达；
- 不要求不同 series 等长；
- moving stream 使用 `boolean | null`；
- position stream 使用 WGS84 `[latitude, longitude] | null`；
- 其他数值 stream 使用 `number | null`；
- PR-02 不冻结 Array/TypedArray/Blob/chunk/压缩或 IndexedDB 表示；
- PR-02 runtime bundle 使用 plain arrays，Storage 后续可以转换编码。

### Lap

最小逻辑字段：

- `id`；
- `activityId`；
- `index`；
- `startOffsetSeconds`；
- `elapsedTimeSeconds`；
- `movingTimeSeconds`（optional/nullable）；
- `distanceMeters`（optional/nullable）。

规则：

- ID 和 index 唯一；
- 按 `startOffsetSeconds` non-decreasing；
- 有活动 duration 时不得越界；
- 第一版不允许 lap overlap；
- 如真实格式调查证明需要 overlap，后续通过新 `schemaVersion` 扩展。

### Event

最小逻辑字段：

- `id`；
- `activityId`；
- `index`；
- `type`；
- `offsetSeconds`；
- `sourceType`（optional）。

核心 `type`：

- `start`
- `pause`
- `resume`
- `stop`
- `marker`
- `unknown`

规则：

- offset non-decreasing；
- 同一 offset 可以有多个事件；
- 核心 `start` / `pause` / `resume` / `stop` 执行基本状态一致性校验；
- 未知来源事件使用 `type: "unknown"` 并保留 `sourceType`；
- 不静默删除未知事件。

## Approved ActivitySource and DeviceReference

公共名称统一为 `ActivitySource`，不再创建第二个公共 `SourceReference` 类型。

`ActivitySource` 最小字段：

- `id`；
- `activityId`；
- `provider`；
- `externalId`（nullable/optional）；
- `rawArtifactId`（nullable/optional）；
- `acquisitionMethod`；
- `deviceId`（nullable/optional）；
- `importedAt`。

规则：

- `provider` 只用于 provenance，不允许页面用它选择业务逻辑；
- `importedAt` 使用与 `startTimeUtc` 相同的 UTC instant 规则；
- source ID 和 activity reference 必须是 string；
- 同一 bundle 中 source ID 唯一。

最小 `DeviceReference`：

- `id`；
- `manufacturer`（nullable/optional）；
- `model`（nullable/optional）。

PR-02 的测试、错误和日志禁止使用真实设备序列号。完整 Device、序列号保护与持久化
留给后续任务。

## Approved VersionMetadata

PR-02 定义以下六个公共字段的名称、类型和职责：

- `schemaVersion`；
- `parserVersion`；
- `normalizerVersion`；
- `analysisVersion`；
- `settingsVersion`；
- `inputHash`。

规则：

- `schemaVersion` 必填，第一版为 `1`；
- 其余五个字段可以为 string 或 `null`；
- validator 不计算 hash；
- PR-02 不冻结 `inputHash` canonicalization；
- PR-02 不实现 `AnalysisSnapshot`；
- PR-02 不实现 stale dependency graph；
- PR-02 不定义 snapshot retention；
- PR-02 只冻结字段语义，供后续 Decoder、Normalizer 与 Analysis 复用；
- bundle、activity 与 `versionMetadata` 的 `schemaVersion` 必须一致。

不得把 `analysisVersion`、`settingsVersion` 或 `inputHash` 整体排除出 PR-02。

## Approved ImportedActivityBundle

第一版逻辑结构：

```js
{
  schemaVersion,
  activity,
  streams,
  laps,
  events,
  sources,
  devices,
  warnings,
  versionMetadata
}
```

规则：

- `activity` 必须存在；
- `streams` 使用 `CanonicalStreamSet`；
- `laps`、`events`、`sources`、`devices`、`warnings` 始终为 arrays；
- summary-only bundle 使用空 series/arrays；
- `sources` 至少一项；
- 所有 `activityId` 必须等于 `activity.id`；
- 各对象 ID 在自身类型内唯一；
- `deviceId` 必须引用 bundle 内 `DeviceReference`，或为 `null` / absent；
- bundle 只能包含 plain object、array、string、boolean、finite number 和 `null`；
- 不使用 `Date`、`Map`、`Set` 或 class instance；
- bundle 必须可 `structuredClone` 且 JSON-safe；
- validator 不修改、不排序、不填充 bundle；
- unknown fields 保留并 warning；
- `rawArtifactId` 只是 opaque reference；
- PR-02 不定义 `RawArtifact` 或持久化。

## Schema evolution

- 第一版只支持 `schemaVersion: 1`；
- 不支持的版本 fail closed，并返回 `VERSION_UNSUPPORTED`；
- additive optional fields 可在兼容演进中加入；
- unknown fields 不被删除，返回 `UNKNOWN_FIELD` warning；
- 破坏性合同变更必须使用新的 schema version；
- PR-02 不实现数据 migration、validator registry migration 或 storage migration。

## ADR status policy

B3 在 B1/B2 实现、专项测试、全量测试和 B2 CI 成功后，将 ADR-0001 至
ADR-0006 收窄到 PR-02 已实现且已验证的逻辑合同，并于 2026-07-30 转为
`Accepted`：

- ADR-0001：接受 Canonical Activity 逻辑合同；Projection 实现与 parity 验收推迟；
- ADR-0002：接受逻辑 Stream/Lap/Event 模型；TypedArray/Blob/chunk/IndexedDB
  编码推迟 PR-05；
- ADR-0003：接受 Repository 是消费者唯一数据边界；Repository 实现和最终返回
  shape 推迟 PR-03；
- ADR-0004：接受统一 Import Pipeline 架构与 `ImportedActivityBundle` 边界；
  Job、Worker、transaction、cancel/retry 实现推迟 PR-07；
- ADR-0005：接受版本分层原则与六个 `VersionMetadata` 字段；hash、失效图、
  snapshot 与 UI 推迟 Analysis v2；
- ADR-0006：接受 P0 `ActivitySource` provenance；字段级 provenance 和
  merge/unmerge 保持 P1。

每份转为 Accepted 的 ADR 都必须明确：

> Accepted decision does not mean downstream implementation is complete.

不得声称 Repository、Storage、Import、Decoder、Projection、Analysis 或 P1
Provenance 已完成。

## Exact implementation boundary

Implementation Gate 的 Allowed files 精确为以下 19 个路径：

1. `docs/tasks/pr-02-canonical-contracts.md`
2. `docs/architecture/adr/0001-canonical-activity.md`
3. `docs/architecture/adr/0002-stream-model.md`
4. `docs/architecture/adr/0003-repository-boundary.md`
5. `docs/architecture/adr/0004-import-pipeline.md`
6. `docs/architecture/adr/0005-analysis-versioning.md`
7. `docs/architecture/adr/0006-source-provenance.md`
8. `js/data/AGENTS.md`
9. `js/data/contracts/errors.js`
10. `js/data/contracts/primitives.js`
11. `js/data/contracts/canonical-activity.js`
12. `js/data/contracts/canonical-streams.js`
13. `js/data/contracts/imported-activity-bundle.js`
14. `js/data/contracts/index.js`
15. `tests/contracts/canonical-activity.test.js`
16. `tests/contracts/canonical-streams.test.js`
17. `tests/contracts/imported-activity-bundle.test.js`
18. `tests/contracts/validation-error-contract.test.js`
19. `tests/contracts/data-boundaries.test.js`

禁止使用 glob 扩大范围。任何必须新增或修改的第 20 个路径都必须停止并重新请求控制塔
批准。

明确禁止：

```text
package.json
package-lock.json
docs/architecture/overview.md
.github/**
index.html
sw.js
api/**
styles/**
js/app/**
js/models/**
js/analysis/**
js/demo/**
js/pages/**
js/services/**
js/shared/**
js/tabs/**
tests/legacy/**
tests/fixtures/**
docs/product/**
docs/engineering/**
docs/migrations/**
```

并继续禁止：

- 修改 Legacy Cache、IndexedDB、localStorage、Service Worker 或 Feature Flag；
- 实现 Repository、Storage、Connector、Decoder、Import Pipeline、Projection、
  Analysis、Shadow Writer 或 Parity Report；
- 读取或提交真实活动、位置、健康、设备、token、export 或私人 fixture；
- 使用 `git add .`；
- rebase、amend、force-push、合并 PR、删除分支或 worktree；
- 直接修改 `main`、`maintenance/v1` 或 `integration/v2`。

## Implementation phases

A3 冻结以下阶段。B1 与 B2 已完成、通过 CI 并正式关闭；控制塔已授权 B3
ADR closure、浏览器合同冒烟验证与最终本地复验。

### B1：Validation Primitives and CanonicalActivity

- `js/data/AGENTS.md`
- `js/data/contracts/errors.js`
- `js/data/contracts/primitives.js`
- `js/data/contracts/canonical-activity.js`
- `js/data/contracts/index.js`
- `tests/contracts/canonical-activity.test.js`
- `tests/contracts/validation-error-contract.test.js`
- `tests/contracts/data-boundaries.test.js`
- 本 Task Brief

### B2：Streams, Laps, Events, Source, Device, Version and Bundle

- `js/data/contracts/errors.js`
- `js/data/contracts/canonical-streams.js`
- `js/data/contracts/imported-activity-bundle.js`
- `js/data/contracts/index.js`
- `tests/contracts/canonical-streams.test.js`
- `tests/contracts/imported-activity-bundle.test.js`
- `tests/contracts/validation-error-contract.test.js`
- `tests/contracts/data-boundaries.test.js`
- 本 Task Brief

控制塔在 B2 授权时纠偏了原阶段清单：公共 API、稳定 B2 code 与 boundary/error
contract tests 必须随本阶段维护，因此 B2 精确使用以上 9 个路径。九个路径均已包含在
A3 冻结的 19 路径总边界内；不得增加第 10 个 B2 路径。

### B3：ADR closure and full verification

- ADR-0001 至 ADR-0006；
- 本 Task Brief；
- 本次不修改 contract/test/runtime；如复验发现缺陷，停止并申请纠偏范围。

每一阶段都必须先实现，再运行专项与全量测试，然后返回控制塔验收。未获批准不得进入
下一阶段，不提前提交后续阶段。PR 始终保持 Draft，直到最终独立审查通过。

## B1 implementation record

### Scope

B1 只新增或修改以下 9 个路径：

1. `docs/tasks/pr-02-canonical-contracts.md`
2. `js/data/AGENTS.md`
3. `js/data/contracts/errors.js`
4. `js/data/contracts/primitives.js`
5. `js/data/contracts/canonical-activity.js`
6. `js/data/contracts/index.js`
7. `tests/contracts/canonical-activity.test.js`
8. `tests/contracts/validation-error-contract.test.js`
9. `tests/contracts/data-boundaries.test.js`

B2 的 stream/bundle 模块与测试尚未创建，六份 ADR 尚未修改。

### Public API

`js/data/contracts/index.js` 在 B1 只导出：

```js
validateCanonicalActivity(value)
```

普通非法输入返回 result，不 throw；成功与失败 result 始终只包含 `ok`、`errors`、
`warnings`。每个 error/warning item 始终只包含 `code`、`path`、`message`。API 不返回
输入、修复副本或 normalized value。

实际稳定 error codes：

- `ID_INVALID`
- `JSON_UNSAFE`
- `NUMBER_INVALID`
- `RANGE_INVALID`
- `RELATION_INVALID`
- `REQUIRED_FIELD_MISSING`
- `TIMESTAMP_INVALID`
- `TYPE_INVALID`
- `VALUE_INVALID`
- `VERSION_INVALID`
- `VERSION_UNSUPPORTED`

实际稳定 warning code：

- `UNKNOWN_FIELD`

Item 按 `path`、`code`、`message` 的 code-unit 顺序确定性排序。path 使用 RFC 6901
JSON Pointer，segment 中 `~` 转义为 `~0`，`/` 转义为 `~1`。message 只描述期待的
合同，不回显 actual value 或敏感数据。

### Implemented CanonicalActivity rules

- `schemaVersion`、`id`、`sportCategory`、`sportVariant`、`startTimeUtc`、
  `timeZone`、`capabilities` 全部必填；
- 第一版只支持整数 `schemaVersion: 1`；
- ID 必须是 trim 后非空的 string；不 trim、不 coerce，numeric-looking string
  保持 string；
- sport category 只允许冻结的十个值；
- non-null sport variant 使用 lowercase ASCII alphanumeric segment，以单个
  hyphen 分隔；
- UTC instant 使用固定 `YYYY-MM-DDTHH:mm:ss.SSSZ`，以纯算术检查日历合法性，
  不依赖宿主时区；
- IANA name 只做稳定格式检查，不调用 `Intl` 或宿主 tzdb；
- UTC offset 只接受 `null` 或 -840 至 840 的整数，合法 `0` 保留；
- 五个 capability 全部必填且只能是 strict boolean；
- optional summary 保持 absent、`null` 与 `0` 区别；
- summary number 必须 finite，冻结为非负的字段拒绝负数；
- heart rate 必须大于 0 且不超过 300 bpm；
- moving time 不得大于 elapsed time；
- extensions 必须是 `null` 或 plain JSON-safe object；
- 顶层、`timeZone`、`capabilities` 的 unknown fields 保留并逐项 warning；
- extensions 内部扩展 key 不产生普通 unknown-field warning；
- 未冻结的极端 power、cadence、temperature warning 阈值未在 B1 擅自定义。

JSON-safe 检查只允许 plain object、array、string、boolean、finite number 和 `null`，
拒绝 `undefined`、non-finite number、bigint、symbol、function、`Date`、`Map`、
`Set`、class instance、array hole/extra property、accessor/non-enumerable property 与
cyclic reference。

### B1 verification evidence

- Focused B1 tests:
  `node --test tests/contracts/canonical-activity.test.js
  tests/contracts/validation-error-contract.test.js
  tests/contracts/data-boundaries.test.js` — Pass (140/140)；
- Node direct ESM import — Pass（由 data-boundaries test 验证）；
- timezone determinism — Pass（UTC、Pacific/Kiritimati、
  America/Los_Angeles 三个隔离子进程结果一致）；
- frozen input、input deep equality、`structuredClone` 与 JSON round-trip — Pass；
- zero network/storage/DOM side effect traps — Pass；
- full repository checks — Pass。

Initial B1 gate（superseded by control-tower `REVISE`）：

- `npm ci` — Pass；
- `npm run check:syntax` — Pass（112 files）；
- `npm run check:privacy` — Pass；
- focused B1 tests — Pass（140/140）；
- `npm test` — Pass（258/258）；
- `git diff --check` — Pass；
- exact path audit — Pass（仅 9 个 B1 allowed paths）；
- staged paths — Empty；
- package files、六份 ADR — Unchanged；
- B2 contract/test files — Not created。

### B1.1 accessor and reflection safety revision

控制塔 B1 初验结论为 `REVISE`。确认的缺陷是：初版
`collectJsonSafetyErrors()` 能发现 accessor 或非法 descriptor，但后续语义校验仍通过
点访问读取 `schemaVersion`、ID、sport、time、timezone、capabilities、summary、
extensions 与 relation 字段。普通非法 getter 因而可能被执行、产生可观察副作用或把
输入异常传播给调用者。

B1.1 只允许修改：

1. `docs/tasks/pr-02-canonical-contracts.md`
2. `js/data/contracts/primitives.js`
3. `js/data/contracts/canonical-activity.js`
4. `tests/contracts/canonical-activity.test.js`
5. `tests/contracts/validation-error-contract.test.js`

修复策略：

- 所有语义字段读取先使用 `Object.getOwnPropertyDescriptor()` 检查；
- 只有 own、enumerable、data descriptor 且 descriptor 包含 `value` 时才读取
  descriptor value；
- accessor、non-enumerable、symbol key 与非法 descriptor 继续返回
  `JSON_UNSAFE`，不执行 getter/setter；
- `Reflect.ownKeys()`、`Object.getPrototypeOf()`、
  `Object.getOwnPropertyDescriptor()` 与 `Array.isArray()` 的输入反射异常在对应
  reflection boundary fail closed；
- Proxy/revoked Proxy 返回现有稳定 result/code/message，不传播或回显原始异常；
- 没有在整个 validator 外层增加吞掉正常 programmer bug 的 broad catch；
- 既有 code、排序、unknown warning、NaN、frozen input、null/zero/absent 与公共
  export 行为保持不变。

新增 deterministic synthetic regression coverage：

- optional `name` throwing getter；
- required `id` getter；
- 有计数副作用但不抛错的 getter；
- setter-only property；
- `timeZone.ianaName` accessor；
- `capabilities.hasGps` accessor；
- extensions nested accessor；
- non-enumerable data/accessor property；
- throwing `getPrototypeOf`、`ownKeys` 与 `getOwnPropertyDescriptor` Proxy；
- revoked Proxy；
- getter/setter call count 保持 0；
- exception message/value 不进入 validation result；
- repeatable Proxy case 结果确定。

B1.1 local verification：

- `npm run check:syntax` — Pass（112 files）；
- `npm run check:privacy` — Pass；
- focused B1 tests — Pass（157/157）；
- `npm test` — Pass（275/275）；
- `git diff --check` — Pass；
- minimal getter reproducer — Pass（no throw、getter calls 0、`JSON_UNSAFE`、
  no exception-message leak）；
- directed nested accessor reproduction — Pass（precise `JSON_UNSAFE` path）；
- revoked/reflection Proxy reproduction — Pass（fail closed、stable result、
  no exception-message leak）；
- original accessor/getter P1 defect — Closed；
- control-tower B1.1 re-review — Accepted；
- B1 local implementation gate — Accepted；
- B1 remote commit/CI — Completed and accepted；
- B1 commit —
  `b5b6c60b9f197ea540790cc30b61fc6e312b61e7`；
- B1 CI —
  https://github.com/XiChuan9/StravaStats/actions/runs/30515429741
  (`Success`)；
- B1 status — Formally closed。

## B2 implementation record

### Authorization and exact scope

控制塔在 B1 正式关闭后批准 B2 本地实施，并将 B2 精确范围纠偏为：

1. `docs/tasks/pr-02-canonical-contracts.md`
2. `js/data/contracts/errors.js`
3. `js/data/contracts/canonical-streams.js`
4. `js/data/contracts/imported-activity-bundle.js`
5. `js/data/contracts/index.js`
6. `tests/contracts/canonical-streams.test.js`
7. `tests/contracts/imported-activity-bundle.test.js`
8. `tests/contracts/validation-error-contract.test.js`
9. `tests/contracts/data-boundaries.test.js`

纠偏原因是 B2 必须同步维护公共入口、稳定 B2 code 以及共享 validation/boundary
contract tests。`primitives.js`、`canonical-activity.js`、对应 B1 test、
`js/data/AGENTS.md`、package files 与六份 ADR 均不在 B2 修改范围。

### Public API and stable codes

`js/data/contracts/index.js` 在 B2 只公开：

```js
validateCanonicalActivity(value)
validateCanonicalStreamSet(value)
validateImportedActivityBundle(value)
```

三个 validator 均返回稳定 `{ ok, errors, warnings }`，item 只包含
`{ code, path, message }`。B2 保留全部 B1 code，并新增：

- error: `DUPLICATE_VALUE`、`LENGTH_MISMATCH`、`ORDER_INVALID`、
  `REFERENCE_INVALID`、`STATE_INVALID`、`CAPABILITY_CONFLICT`；
- warning: `DUPLICATE_TIMESTAMP`。

### Implemented B2 contracts

- `CanonicalStreamSet` 支持 summary-only 空 `series`、各 series 独立时间轴、
  stream type 唯一、offset/value 等长、非负 non-decreasing offset 与重复 timestamp
  warning，不排序或修改输入；
- moving stream 使用 `boolean | null` 与 `unit: "boolean"`；position stream 使用
  WGS84 二元 tuple 与经纬度 hard bounds；其他 stream 使用 finite number 或 null；
- heart rate、distance、power、cadence hard bounds 已实现，altitude 与
  temperature 允许负数，开放数值 stream 不增加未冻结 maximum；
- Lap 实现 ID/index 唯一、reference、non-decreasing order、no overlap、
  moving/elapsed relation 与 activity duration bound；
- Event 实现 ID/index 唯一、reference、offset order/bound、same-offset、
  unknown/sourceType 保留及 start/pause/resume/stop 状态机；
- ActivitySource 实现 provenance-only string fields、optional opaque references、
  fixed-millisecond `importedAt` 与 activity/device reference；
- DeviceReference 实现唯一 ID 与 nullable/optional manufacturer/model，不包含序列号；
- VersionMetadata 保留全部六字段，验证 version 类型、unsupported version 及
  bundle/activity/version schema 一致性，不计算 hash；
- ImportedActivityBundle 验证全部九个必填字段、array shape、至少一个 source、
  warning item shape、cross-reference、capability conflicts、JSON safety 与
  structuredClone/JSON round-trip；
- 组合 validator 合并 activity/streams/bundle validation items，按稳定顺序返回并
  删除完全相同的重复 item，不产生 normalized bundle；
- descriptor-gated 读取贯穿新增 validator；accessor/non-enumerable/symbol/非法
  descriptor 与 reflection Proxy failure 均 fail closed，不执行 getter 或回显异常。

### B2 local verification

- `npm run check:syntax` — Pass（116 files）；
- focused contract tests:
  `node --test tests/contracts/*.test.js` — Pass（280/280）；
- `npm test` — Pass（398/398）；
- duplicate timestamp、Lap overlap、invalid Event state、broken device reference、
  false capability with detail、schema mismatch — Pass；
- getter calls 0、revoked/reflection Proxy fail closed、deep-frozen input、
  non-mutation、structuredClone/JSON round-trip — Pass；
- Node direct ESM import and zero network/storage/DOM side effects — Pass；
- package files、B1-only runtime/tests 与六份 ADR — Unchanged；
- B2 exact path audit — 9 approved paths only；
- B2 commit —
  `3e2f8df5a0bf50e51c462f16fefe8ce4a6d76a99`
  (`feat(v2): add stream and activity bundle contracts`)；
- B2 CI —
  https://github.com/XiChuan9/StravaStats/actions/runs/30520888393
  (`Success`)；
- staged paths after finalization — Empty；
- independent control-tower review — Accepted；
- B2 Local Implementation Gate — Accepted；
- B2 remote commit/CI — Completed；
- B2 status — Formally closed。

## B3 local implementation record

### Authorization and exact scope

控制塔在 B2 正式关闭后授权 B3 本地实施。B3 精确允许修改：

1. `docs/tasks/pr-02-canonical-contracts.md`
2. `docs/architecture/adr/0001-canonical-activity.md`
3. `docs/architecture/adr/0002-stream-model.md`
4. `docs/architecture/adr/0003-repository-boundary.md`
5. `docs/architecture/adr/0004-import-pipeline.md`
6. `docs/architecture/adr/0005-analysis-versioning.md`
7. `docs/architecture/adr/0006-source-provenance.md`

B3 不修改 runtime、tests、package、Legacy 或 storage 文件，不新增文件。发现
runtime/test defect 时必须停止并申请纠偏，不能在本阶段直接修复。

### ADR closure

- 六份 ADR 的 `Status` 均为 `Accepted`，Accepted date 为 2026-07-30；
- ADR-0001 收窄为已验证的 CanonicalActivity v1；
- ADR-0002 收窄为 StreamSet/StreamSeries 逻辑模型，不冻结 storage encoding；
- ADR-0003 只接受未来消费者 Repository boundary 原则，不冻结接口或实现；
- ADR-0004 只接受统一 `ImportedActivityBundle` target 与 validation boundary；
- ADR-0005 只接受六个 VersionMetadata 字段及一致性合同；
- ADR-0006 只接受 P0 ActivitySource/DeviceReference 逻辑合同；
- 每份 ADR 均明确：
  `Accepted decision does not mean downstream implementation is complete.`；
- Repository、Storage、Decoder、Import Job、Projection、Analysis、hash、
  invalidation、merge/UserOverride 等下游实现继续留给后续独立 PR。

### B3 local verification

- `npm ci` — Pass；
- `npm run check:syntax` — Pass（116 files）；
- `npm run check:privacy` — Pass；
- focused contract tests — Pass（280/280）；
- `npm test` — Pass（398/398）；
- `git diff --check` — Pass；
- ADR status/date/disclaimer、相对链接及延后边界 audit — Pass；
- browser direct URL
  `http://127.0.0.1:3001/js/data/contracts/index.js` — in-app Browser 与
  connected Chrome 均可打开；
- browser native ESM dynamic import — Not run；控制塔独立复现确认两种受控
  `playwright.evaluate` 执行面均返回精确错误：
  `module loading is not available in playwright.evaluate`；
- 未使用 script URL、DOM 注入、`javascript:` URL 或其他方式绕过受控执行面；
- browser exact exports / three validator calls — Not run；
- automated browser storage/cache/service-worker snapshots — Not run；
- browser validator-time fetch/XHR/WebSocket instrumentation — Not run；
- Node boundary tests for exact exports and zero network/storage/DOM access — Pass；
- Manual DevTools panel inspection — Not run；
- real-data/credentials/private browser profile validation — Not run；
- browser limitation deferral — Approved by control tower；未运行项不视为 Pass；
- mandatory follow-up — 第一个实际从浏览器应用路径接入 contracts 的后续 PR；
  最迟在 Canonical 默认启用或进入 release candidate 前完成；
- exact B3 path audit — 7 approved documentation paths only；
- initial B3 documentation commit —
  `1240dcf0cdea5037037593364e3aac4f262b360a`；
- initial B3 CI —
  https://github.com/XiChuan9/StravaStats/actions/runs/30526989854
  (`Success`)；
- PR body — Updated；PR remains Draft；
- PR Ready / merge / PR-03 — Not performed。

## Acceptance criteria

### A1 / Investigation readiness

- [x] 只有本 Task Brief 一个文件发生变化；
- [x] A1 时状态为 `Ready for investigation`；
- [x] A1 completion-time evidence recorded six ADRs as Proposed；
- [x] 合同目标、待决问题、范围、候选文件、A1 唯一允许文件与禁止操作完整；
- [x] A1 未冻结具体 Schema、validator、字段全集或 storage encoding；
- [x] A1 未声称 `js/data/`、`tests/contracts/` 或 Canonical 实现已经存在；
- [x] A1 自动检查全部通过；
- [x] A1 只显式暂存本文件；
- [x] Draft PR 以 `integration/v2` 为 base，且 A1 diff 只有本文件；
- [x] Task Brief commit 对应 GitHub CI 成功并已记录。

### A2 / Investigation Gate

- [x] A2 全程未修改文件、index、commit、PR body 或分支状态；
- [x] 调查覆盖 34 个 Investigation questions；
- [x] 给出当前事实、六份 ADR 状态矩阵和 contract inventory；
- [x] 给出最小字段/invariant 草案，并明确当时不是实施授权；
- [x] 比较 validator 选项并推荐适合当前 Vanilla ESM 的无依赖方案；
- [x] 给出 sport、time/timezone、null/absent/zero、streams/laps/events、
      source naming、version metadata、bundle 与 validation error 建议；
- [x] 给出精确最小候选文件、Allowed files 建议与 Prohibited files；
- [x] 给出自动测试矩阵、人工验证、P0/P1/P2 风险与
      privacy/migration/rollback 影响；
- [x] 列出所有需项目负责人决定的问题；
- [x] 明确未运行验证与已知限制；
- [x] Investigation Gate 已获 control tower 批准；
- [x] A2 停止，未进入产品实现。

### A3 / Decision and scope freeze

- [x] Metadata status 更新为 `Approved for implementation`；
- [x] Draft PR URL 和 A0/A1/A2/Gate 证据已记录；
- [x] Validator/API、ID、missing value、number、time、sport 与 capabilities
      决策已冻结；
- [x] Stream/Lap/Event、ActivitySource/DeviceReference、VersionMetadata 与
      ImportedActivityBundle 决策已冻结；
- [x] 19 个 Allowed files 和 Prohibited files 已精确冻结；
- [x] ADR 状态策略与 B1/B2/B3 阶段已记录；
- [x] A3 只修改本 Task Brief；
- [x] A3 最低自动检查全部通过；
- [x] A3 commit 已推送且新 head CI 成功；
- [x] Draft PR body 已更新且 PR 仍为 Draft；
- [x] A3 完成时 B1 尚未开始并等待控制塔授权（后已正式授权）。

### B1 / Local implementation gate

- [x] 只新增或修改 9 个 B1 allowed paths；
- [x] `index.js` 只公开 `validateCanonicalActivity(value)`；
- [x] 普通非法输入返回稳定 result，不 throw、不泄漏 actual value；
- [x] CanonicalActivity v1、strict capabilities、UTC/timezone 与 summary hard
      bounds 已实现；
- [x] unknown-field warning、RFC 6901 path 与稳定排序已实现；
- [x] input unchanged、frozen input、JSON-safe、`structuredClone` 与 JSON
      round-trip 已验证；
- [x] timezone 跨环境结果一致；
- [x] Node direct ESM import、零网络与零 storage side effect 已验证；
- [x] dependency、package script、ADR、B2 文件均未修改或提前创建；
- [x] focused 140/140 与 full 258/258 tests 通过；
- [x] B1 保持未暂存、未提交、未推送，PR 仍为 Draft；
- [x] B1 completion-time evidence recorded that B2/B3 had not yet started。
- [x] Control tower initial review completed with `REVISE`；
- [x] B1.1 control-tower re-review accepted；
- [x] Original accessor/getter P1 defect closed；
- [x] B1 local implementation gate accepted；
- [x] B1 remote commit and CI finalization completed。

### B2 / Local implementation gate

- [x] 只新增或修改控制塔纠偏后的 9 个 B2 allowed paths；
- [x] `index.js` 只公开三个批准 validator；
- [x] B1 codes 全部保留，B2 只增加七个批准 code；
- [x] CanonicalStreamSet、StreamSeries 与空 summary-only streams 已实现；
- [x] Lap/Event/ActivitySource/DeviceReference/VersionMetadata 合同已实现；
- [x] ImportedActivityBundle、references、state、version 与 capability checks 已实现；
- [x] validation items 合并、去重与稳定排序已实现；
- [x] accessor/getter 不执行，reflection Proxy fail closed 且不泄漏异常；
- [x] input unchanged、deep freeze、JSON-safe、structuredClone 与 JSON round-trip
      已验证；
- [x] Node direct import 与零 network/storage/DOM side effect 已验证；
- [x] focused contract tests 280/280 与 full tests 398/398 通过；
- [x] package、B1-only runtime/tests 与 ADR 未修改；
- [x] staged paths 为空，未 commit、未 push、未更新 PR body；
- [x] independent control-tower review accepted；
- [x] B2 Local Implementation Gate accepted；
- [x] B2 remote commit and CI finalization completed；
- [x] B2 formally closed。

### B3 / ADR closure and final local verification

- [x] 控制塔授权 B3，且实际修改仅为 Task Brief 与六份 ADR；
- [x] ADR-0001 至 ADR-0006 收窄到 PR-02 已实现/验证范围并转为 Accepted；
- [x] 每份 ADR 记录 2026-07-30 Accepted date 和统一 downstream disclaimer；
- [x] 每份 ADR 明确未实现的后续 PR 边界，未声称 downstream implementation 完成；
- [x] npm ci、syntax、privacy、280/280 contracts、398/398 full tests 与 diff check 通过；
- [ ] 浏览器动态 import、精确 exports、三个 valid validator result（Not run：
      in-app Browser 与 Chrome 的受控 evaluate 均不提供 module loading）；
- [ ] 自动浏览器 storage/network instrumentation（Not run）；
- [x] 控制塔独立复现浏览器限制并批准延期；未运行项未改写为 Pass；
- [x] 延期项已移交给第一个实际从浏览器应用路径接入 contracts 的后续 PR，且必须在
      Canonical 默认启用或 release candidate 前完成；
- [x] B3 七路径审计通过，runtime/tests/package 未修改，staged 为空；
- [x] B3 Local Review Gate accepted；
- [x] B3 remote commit/CI finalization completed；
- [ ] PR Ready / final project acceptance；
- [ ] Manual DevTools panel and real-data verification。

Browser 延期只解除 PR-02 B3 的本地阻断，不构成浏览器验证 Pass，也不解除后续接入
PR 在 Canonical 默认启用或 release candidate 前补齐验证的强制门禁。

### Candidate implementation acceptance

- [x] Runtime validation 覆盖获批 Canonical contracts；
- [x] ID 是 non-empty opaque string，number 与空白 ID 被拒绝；
- [x] 缺失值不转换为 `0`，合法真实 `0` 可区分；
- [x] 非法单位、时间、版本与 cross-reference 被稳定 error contract 拒绝；
- [x] unknown sport 可以无损表达；
- [x] validator 不修改输入，适用对象可 `structuredClone`；
- [x] 测试在不同时区结果一致，不访问网络、IndexedDB 或 localStorage；
- [x] 不改变现有页面、Legacy Cache、Feature Flag 或分析行为。

以上 candidate implementation 项目必须由 B1/B2/B3 的实际代码和测试证明；A3 不勾选。

## Required verification

B3 文档更新后执行：

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/contracts/*.test.js
npm test
git diff --check
git diff --name-only
git diff --cached --name-only
```

本地 B3 结束时 cached paths 必须为空，且 diff 精确为 Task Brief 与六份 ADR。
同时执行 ADR metadata、统一 disclaimer、相对链接、deferred boundary 和浏览器
dynamic import/side-effect 精确审计。

自动测试必须使用 `node:test` 和 inline deterministic synthetic objects，至少覆盖：

- 最小/完整 `CanonicalActivity`；
- numeric、空、空白与 numeric-looking string ID；
- `schemaVersion`；
- UTC、非法日期与 offset；
- `null`、absent 与合法 `0`；
- `NaN`、`Infinity` 与负数；
- known/unknown sport；
- strict boolean capabilities；
- capability 与 bundle 内容冲突；
- stream null point 与真实 `0`；
- stream length、offset 与重复 timestamp；
- Lap/Event reference、排序、越界与状态；
- ActivitySource/Device reference；
- 六个 VersionMetadata 字段；
- bundle reference integrity；
- unknown fields preservation/warning；
- unsupported version fail closed；
- stable multi-error ordering；
- validator 输入不变与 frozen input；
- `structuredClone` 和 JSON round-trip；
- 多 timezone 子进程结果一致；
- fetch、IndexedDB、localStorage 调用为零；
- boundary test 阻止 contracts 导入 API/UI/Storage/Analysis；
- 不依赖 credentials、网络或私人 fixture。

## Manual verification

B3 执行：

1. Node 直接 import `js/data/contracts/index.js`（B1/B2 automated test 已通过）；
2. in-app Browser 与 connected Chrome 均可直接打开
   `/js/data/contracts/index.js`（Pass）；
3. 浏览器 dynamic import `/js/data/contracts/index.js?b3-browser-smoke=1`
   （Not run：两种受控 evaluate 均返回
   `module loading is not available in playwright.evaluate`）；
4. 浏览器模块导出和三个 inline synthetic valid validator result（Not run）；
5. 浏览器 local/session storage、IndexedDB database metadata、Cache Storage 与
   Service Worker registration snapshot（Not run）；
6. 浏览器 validator-time fetch/XHR/WebSocket instrumentation（Not run）；
7. validator 前后 deep equality、合法 `0` 与 absent/`null` 语义由自动测试覆盖；
8. Manual DevTools panel inspection（Not run）；
9. 不使用真实账号、真实运动资料、credentials 或私人 fixture。

B3 未使用真实数据。浏览器 dynamic import、自动 side-effect instrumentation、
Manual DevTools 与真实数据验证均继续 Not run。控制塔已批准环境限制延期；该批准不把
未运行项视为 Pass。第一个实际从浏览器应用路径接入 contracts 的后续 PR 必须补齐，
且不得晚于 Canonical 默认启用或 release candidate。

## Privacy and security impact

B1/B2 只新增来源中立的纯 validation 模块、领域规则和 inline synthetic tests；B3
只收口文档并以 synthetic object 验证现有模块。各阶段均不读取、
写入、上传或记录活动、位置、健康、设备或凭据数据，不新增 committed fixture。
Validator error、warning 和测试输出不得包含 token、
Authorization header、原始活动、GPS、完整 HR/Power stream、真实文件名或设备序列号。

Dependency-free validator 避免新增供应链、CDN、CSP、离线和 PWA 依赖风险。

## Migration impact

B1/B2/B3 没有数据 migration，不创建或修改 IndexedDB v2，不读取或修改 Legacy Cache，
不写 localStorage，不持久化 Canonical 数据，也不改变 Feature Flag。

PR-02 逻辑合同必须支持后续 additive、idempotent、observable、recoverable
migration，但本 PR 不实现 migration、store、transaction 或编码。stream storage
表示留给 PR-05。

## Rollback procedure

B1/B2 已作为普通提交完成并通过 CI；B3 当前只是未暂存、未提交、未推送的七份
documentation 更新：

1. 保持 Draft PR，不合并；
2. B3 验收前如需放弃，只能处理本阶段 7 个允许路径；不得清理任务外文件；
3. B1/B2 如需撤销，使用普通 revert 提交，不 amend、rebase 或 force-push；
4. 不清理 Legacy Cache、IndexedDB、localStorage、Service Worker cache 或私人
   export，因为 PR-02 未修改这些数据；
5. 删除远端分支或 worktree 不属于本任务授权。

未来 implementation 的回滚必须保持 Legacy 默认路径，不得以删除或覆盖 Legacy/V2
数据作为捷径。

## Independent review checklist

- [x] Worktree、branch、base、A1 HEAD 与 Metadata 一致；
- [x] A0 基线证据完整，没有把未运行项标记为 Pass；
- [x] A1 diff 只有 Task Brief，A2 无 Git/file 修改；
- [x] 当前状态为 `In review`；
- [x] 所有六份 ADR 已收窄并于 2026-07-30 Accepted；
- [x] PRD 示例没有被当作 provider-specific runtime schema 直接复制；
- [x] Dependency-free validator、稳定 result/error/warning 与 unknown-field policy
      已冻结；
- [x] ID、缺失值、单位、时间、sport、capabilities、streams、references、
      version、bundle、validation 与 schema evolution 已冻结；
- [x] capabilities 使用严格 boolean，未采用 truthy 三态字符串；
- [x] VersionMetadata 保留全部六个公共字段；
- [x] 19 个 Allowed files 与 Prohibited files 精确记录；
- [x] Out of scope 排除 Storage、Repository、Import、Decoder、Projection、UI、
      Analysis、Shadow Writer、Feature Flag 与 Service Worker；
- [x] package 依赖变更被禁止；
- [x] 测试只允许 synthetic、确定性、离线数据；
- [x] 没有私人数据、credentials 或敏感日志；
- [x] migration、privacy 与 rollback 影响已明确；
- [x] A3 未修改 ADR、Schema、validator、test 或 runtime export；
- [x] A3 diff/cached diff 仅包含 Task Brief；
- [x] A3 自动检查和新 head CI 成功；
- [x] PR #6 保持 Draft，B1/B2 已关闭，B3 仅本地文档变更；
- [x] in-app Browser 与 Chrome direct contract-module URL load 通过；
- [x] Browser dynamic import、自动 network/storage smoke、Manual DevTools panel
      与 real-data verification 明确为 Not run，且未声明为 Pass；
- [x] B3 Local Review Gate 获控制塔接受，环境限制延期与后续强制补验阶段已记录。

## Completion evidence

```text
A0 local/remote audit:
  Worktree: <worktree-root>/contracts
  Branch: codex/v2/contracts
  Starting HEAD: b96bb6aa7e9929845af51b5151f7ba195b4489d4
  Base: origin/integration/v2 at b96bb6aa7e9929845af51b5151f7ba195b4489d4
  Ahead/behind: 0/0
  PR-00: #3 merged into integration/v2
  PR-01: #5 merged into integration/v2
  Remote codex/v2/contracts branch/PR before A1: absent
  Initial worktree/index: clean
  Initial docs/tasks/pr-02-canonical-contracts.md: absent
  Initial js/data/: absent
  Initial tests/contracts/: absent

A0 baseline:
  npm ci — Pass
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  npm test — Pass (118/118)
  git diff --check — Pass

A1 Task Brief:
  npm run check:privacy — Pass
  npm run check:syntax — Pass (105 files)
  npm test — Pass (118/118)
  git diff --check — Pass
  Task Brief commit — 0daddbc47de605c5e0b1fc9b04ebdd0f0246632a
  Draft PR — https://github.com/XiChuan9/StravaStats/pull/6
  CI Run — https://github.com/XiChuan9/StravaStats/actions/runs/30506623094
  CI result — Success

A2 read-only investigation:
  Investigation completed — Yes
  Git/file modifications — None
  Investigation Gate — Approved by control tower
  Browser/real-data verification — Not run

A3 decision and scope freeze:
  Decision package — Approved by project owner
  Implementation — Not started
  ADR modifications — None
  Schema/validator/tests/runtime exports — Not created
  Current authorized change — Task Brief only
  npm ci — Pass
  npm run check:syntax — Pass (105 files)
  npm run check:privacy — Pass
  npm test — Pass (118/118)
  git diff --check — Pass
  git diff --name-only — docs/tasks/pr-02-canonical-contracts.md only
  git diff --cached --name-only before staging — empty
  A3 commit — a4ef3124790aa3fbef2d52af99963044bdb614ca
  A3 push — Success
  A3 CI Run — https://github.com/XiChuan9/StravaStats/actions/runs/30510590380
  A3 CI result — Success
  Draft PR body — Updated; PR remains Draft

B1 local implementation:
  Authorization — PR-02 / A3 Accepted / B1 Authorized
  Public API — validateCanonicalActivity(value)
  Focused contract tests — Pass (140/140)
  npm ci — Pass
  npm run check:syntax — Pass (112 files)
  npm run check:privacy — Pass
  npm test — Pass (258/258)
  git diff --check — Pass
  Exact path audit — Pass (9 B1 allowed paths only)
  Staged paths — Empty
  B2/B3 — Not started
  ADR modifications — None
  Commit/push/PR update — Not performed

B1.1 local revision:
  Initial control-tower status — B1 REVISE
  Root cause — unsafe semantic property reads after JSON-safe scan
  Fix — descriptor-gated reads and reflection-boundary fail closed
  npm run check:syntax — Pass (112 files)
  npm run check:privacy — Pass
  Focused regression tests — Pass (157/157)
  npm test — Pass (275/275)
  git diff --check — Pass
  Minimal getter reproducer — Pass
  Nested accessor reproduction — Pass; JSON_UNSAFE
  Revoked/reflection Proxy — Pass; fail closed
  Original accessor/getter P1 defect — Closed
  Control-tower re-review — Accepted
  B1 local implementation gate — Accepted
  B1 remote commit/CI — Completed
  B2/B3 — Not started
  Commit/push/PR update — Not performed

B1 finalization:
  Control-tower acceptance — Passed; B1 formally closed
  Commit — b5b6c60b9f197ea540790cc30b61fc6e312b61e7
  Commit message — feat(v2): add canonical activity contracts
  Push — Success; origin/codex/v2/contracts synchronized 0/0
  CI Run — https://github.com/XiChuan9/StravaStats/actions/runs/30515429741
  CI result — Success
  PR #6 — OPEN / Draft; integration/v2 <- codex/v2/contracts

B2 local implementation:
  Authorization — PR-02 / B1 Closed / B2 Local Implementation Authorized
  Exact scope correction — 9 approved paths within A3 frozen boundary
  Public API — validateCanonicalActivity(value),
    validateCanonicalStreamSet(value), validateImportedActivityBundle(value)
  New stable errors — DUPLICATE_VALUE, LENGTH_MISMATCH, ORDER_INVALID,
    REFERENCE_INVALID, STATE_INVALID, CAPABILITY_CONFLICT
  New stable warning — DUPLICATE_TIMESTAMP
  npm ci — Pass
  npm run check:syntax — Pass (116 files)
  npm run check:privacy — Pass
  Focused contract tests — Pass (280/280)
  npm test — Pass (398/398)
  git diff --check — Pass
  Directed relationship/state/version/capability checks — Pass
  Getter calls — 0
  Revoked/reflection Proxy — Pass; fail closed
  structuredClone/JSON round-trip — Pass
  Import/validation network/storage/DOM access — 0
  Exact path audit — Pass (9 B2 allowed paths only)
  Independent control-tower review — Accepted
  B2 Local Implementation Gate — Accepted
  Commit — 3e2f8df5a0bf50e51c462f16fefe8ce4a6d76a99
  Commit message — feat(v2): add stream and activity bundle contracts
  Push — Success; origin/codex/v2/contracts synchronized 0/0
  CI Run — https://github.com/XiChuan9/StravaStats/actions/runs/30520888393
  CI result — Success
  B2 status — Formally closed

B3 local implementation:
  Authorization — PR-02 / B2 Closed / B3 Local Implementation Authorized
  Exact scope — Task Brief + ADR-0001 through ADR-0006
  ADR status — Accepted (2026-07-30)
  ADR scope — PR-02 implemented/tested logical contracts only
  Downstream disclaimer — Present in all six ADRs
  npm ci — Pass
  npm run check:syntax — Pass (116 files)
  npm run check:privacy — Pass
  Focused contract tests — Pass (280/280)
  npm test — Pass (398/398)
  git diff --check — Pass
  ADR metadata/link/deferred-boundary audit — Pass
  Browser direct contract-module URL load — Pass in in-app Browser and Chrome
  Browser native ESM dynamic import — Not run; both controlled evaluate
    surfaces return "module loading is not available in playwright.evaluate"
  Browser bypass attempts — None; no script URL, DOM injection, javascript URL,
    or alternate execution path used
  Browser exports/validator calls — Not run
  Browser storage/cache/service-worker snapshots — Not run
  Browser validator fetch/XHR/WebSocket instrumentation — Not run
  Node exact-export and zero network/storage/DOM boundary tests — Pass
  Manual DevTools panel inspection — Not run
  Real-data/credentials/private-profile verification — Not run
  Browser deferral — Approved by control tower; Not run items are not Pass
  Mandatory follow-up — First downstream PR that connects contracts from a
    browser application path, before Canonical becomes default or release candidate
  Exact path audit — Pass (7 B3 approved documentation paths only)
  Runtime/tests/package modifications — None
  B3 Local Review Gate — Accepted
  Documentation commit — 1240dcf0cdea5037037593364e3aac4f262b360a
  Commit message — docs(v2): accept canonical contract decisions
  Push — Success
  CI Run — https://github.com/XiChuan9/StravaStats/actions/runs/30526989854
  CI Job — https://github.com/XiChuan9/StravaStats/actions/runs/30526989854/job/90820111031
  CI result — Success
  B3 remote commit/CI finalization — Completed
  PR body — Updated; PR remains Draft
  PR Ready/merge/PR-03 — Not performed
```

## PR-02 Final Review Closure

- Final Independent Review: `Accepted`；
- Control-tower decision: Ready for review approved；
- Reviewed head:
  `5ad15cc207cb9f1709eb167ae0a8979f2b00d862`；
- Remote PR state before Ready: `OPEN / Draft / MERGEABLE`；
- Merge state before Ready: `CLEAN`；
- Base/head: `integration/v2` ← `codex/v2/contracts`；
- Changed files: 19/19 approved paths；
- Ahead/behind against `integration/v2`: 6/0；
- Final reviewed CI:
  https://github.com/XiChuan9/StravaStats/actions/runs/30527192861；
- Final reviewed CI result: Success；
- Syntax: 116 files；
- Privacy: Pass；
- Contract tests: 280/280；
- Full tests: 398/398；
- ADR Accepted/status/date/disclaimer audit: 6/6；
- Browser dynamic import: Not run；
- Browser exact exports / validator calls: Not run；
- Browser storage/network/Service Worker instrumentation: Not run；
- Manual DevTools: Not run；
- Real-data verification: Not run；
- Browser items are a control-tower-approved deferral and are not Pass；
- Mandatory browser follow-up: the first downstream PR that connects contracts
  from a browser application path；the checks must pass before Canonical becomes
  the default or enters a release candidate；
- Squash merge: Not authorized；
- PR-03: Not started；
- Project publication/merge: Not claimed。

## Stop condition

PR-02 Final Independent Review 已获控制塔接受。本次只允许提交并推送本 Task Brief
的 Final Review Closure 记录、更新 PR body、等待新 HEAD CI，并仅在该 CI 成功后把
PR #6 从 Draft 标记为 Ready for review。完成后立即停止；不合并、不修改
`integration/v2`、不开始 PR-03 或其他下游实现，不删除分支或 worktree。
