# PR-02：ADR 与 Canonical Contracts

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/contracts` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/contracts` |
| Owner | XiChuan9 |
| Reviewer | 独立 Codex 线程 + XiChuan9 |
| Related PRD | Sections 4、5、6、8.4、9、15、17、19 |
| Related plan | Sprint 1 / PR-02 |
| Related ADRs | ADR-0001 至 ADR-0006（当前均为 Proposed） |
| Dependencies | PR-00 与 PR-01 已合入 `integration/v2` |
| Pull request | https://github.com/XiChuan9/StravaStats/pull/6 |

## Phase status and evidence

- A0 baseline completed；
- A1 Task Brief completed；
- A2 read-only investigation completed；
- Investigation Gate approved by control tower；
- A3 decision package approved by project owner；
- Implementation 尚未开始；
- ADR-0001 至 ADR-0006 当前仍为 `Proposed`；
- ADR 只会在对应合同实现及测试通过后转为 `Accepted`；
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
- Browser/real-data verification: Not run。

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
- 仓库中尚不存在 PR-02 目标 runtime validator、`js/data/contracts/` 或
  `tests/contracts/`；
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

A3 不修改 ADR，ADR-0001 至 ADR-0006 当前继续保持 `Proposed`。后续 PR-02
implementation 只有在对应合同实现及测试通过后，才将 ADR 收窄到实际已决定的逻辑
范围并转为 `Accepted`：

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

A3 只冻结以下阶段，不执行任何实施。

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

- `js/data/contracts/canonical-streams.js`
- `js/data/contracts/imported-activity-bundle.js`
- `js/data/contracts/index.js`
- `tests/contracts/canonical-streams.test.js`
- `tests/contracts/imported-activity-bundle.test.js`
- 本 Task Brief

### B3：ADR closure and full verification

- ADR-0001 至 ADR-0006；
- 本 Task Brief；
- 已批准的 contract/test 文件，仅限修正审查发现。

每一阶段都必须先实现，再运行专项与全量测试，然后返回控制塔验收。未获批准不得进入
下一阶段，不提前提交后续阶段。PR 始终保持 Draft，直到最终独立审查通过。

## Acceptance criteria

### A1 / Investigation readiness

- [x] 只有本 Task Brief 一个文件发生变化；
- [x] A1 时状态为 `Ready for investigation`；
- [x] 六份 ADR 明确保持 Proposed；
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
- [ ] A3 commit 已推送且新 head CI 成功；
- [ ] Draft PR body 已更新且 PR 仍为 Draft；
- [x] B1 尚未开始并等待控制塔授权。

### Candidate implementation acceptance

- [ ] Runtime validation 覆盖获批 Canonical contracts；
- [ ] ID 是 non-empty opaque string，number 与空白 ID 被拒绝；
- [ ] 缺失值不转换为 `0`，合法真实 `0` 可区分；
- [ ] 非法单位、时间、版本与 cross-reference 被稳定 error contract 拒绝；
- [ ] unknown sport 可以无损表达；
- [ ] validator 不修改输入，适用对象可 `structuredClone`；
- [ ] 测试在不同时区结果一致，不访问网络、IndexedDB 或 localStorage；
- [ ] 不改变现有页面、Legacy Cache、Feature Flag 或分析行为。

以上 candidate implementation 项目必须由 B1/B2/B3 的实际代码和测试证明；A3 不勾选。

## Required verification

A3 文档更新后执行：

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
git diff --name-only
git diff --cached --name-only
```

暂存前 cached paths 必须为空。只允许：

```bash
git add docs/tasks/pr-02-canonical-contracts.md
```

暂存后检查 cached diff，必须只有本 Task Brief。

未来 implementation 的最低门禁：

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/contracts/*.test.js
npm test
git diff --check
```

并执行精确路径审计。

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

未来 implementation 执行：

1. Node 直接 import `js/data/contracts/index.js`；
2. 本地静态服务中由浏览器动态 import；
3. 离线状态无需 CDN；
4. validator 前后 deep equality；
5. 合法 `0` 保留，absent/`null` 不补零；
6. DevTools 确认零网络、零 IndexedDB/localStorage 写入；
7. 不使用真实账号、真实运动资料或真实浏览器 profile。

A3 是治理文档变更，不运行浏览器或真实数据验证。

## Privacy and security impact

A3 只更新治理文档，不读取、写入、上传或记录活动、位置、健康、设备或凭据数据。
未来 contract tests 只使用小型 inline deterministic synthetic objects，不新增
committed fixture。validator error、warning 和测试输出不得包含 token、
Authorization header、原始活动、GPS、完整 HR/Power stream、真实文件名或设备序列号。

Dependency-free validator 避免新增供应链、CDN、CSP、离线和 PWA 依赖风险。

## Migration impact

A3 没有数据 migration，不创建或修改 IndexedDB v2，不读取或修改 Legacy Cache，
不写 localStorage，不生成 Canonical 数据，也不改变 Feature Flag。

PR-02 逻辑合同必须支持后续 additive、idempotent、observable、recoverable
migration，但本 PR 不实现 migration、store、transaction 或编码。stream storage
表示留给 PR-05。

## Rollback procedure

A3 仍是 Task Brief-only 文档更新：

1. 保持 Draft PR，不合并；
2. 如需撤销，使用普通 revert 提交，不 amend、rebase 或 force-push；
3. 不清理 Legacy Cache、IndexedDB、localStorage、Service Worker cache 或私人
   export，因为 A3 未修改这些数据；
4. 删除远端分支或 worktree 不属于本任务授权。

未来 implementation 的回滚必须保持 Legacy 默认路径，不得以删除或覆盖 Legacy/V2
数据作为捷径。

## Independent review checklist

- [x] Worktree、branch、base、A1 HEAD 与 Metadata 一致；
- [x] A0 基线证据完整，没有把未运行项标记为 Pass；
- [x] A1 diff 只有 Task Brief，A2 无 Git/file 修改；
- [x] 当前状态为 `Approved for implementation`；
- [x] 所有六份 ADR 当前仍为 Proposed；
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
- [ ] A3 自动检查和新 head CI 成功；
- [x] PR #6 保持 Draft，B1 未开始；
- [x] Browser/real-data verification 明确为 Not run。

## Completion evidence

```text
A0 local/remote audit:
  Worktree: /Users/wangchuanliang/Documents/StravaStats-worktrees/contracts
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
  A3 commit/push/new head CI — recorded in PR and completion report
```

## Stop condition

A3 完成后必须停止，不开始 B1。Implementation 尚未开始，ADR 尚未修改，
Schema/validator/tests 尚未创建，PR 必须保持 Draft。当前等待控制塔在 A3 新 head CI
成功后另行授权 B1。
