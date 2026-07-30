# ADR-0006：ActivitySource、DeviceReference 与 Provenance 边界

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 已实现并验证的 P0 source/device 逻辑合同 |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[ADR-0001](./0001-canonical-activity.md)、[ADR-0003](./0003-repository-boundary.md)、[ADR-0004](./0004-import-pipeline.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

同一次活动可能来自多个 provider 或 artifact。CanonicalActivity 顶层不应承载
provider 业务分支，但 bundle 必须能表达来源关系和最小设备引用，同时避免收集不必要
的设备身份数据。

## Accepted decision

PR-02 接受以下 P0 逻辑合同：

`ActivitySource` 字段为：

```text
id
activityId
provider
externalId
rawArtifactId
acquisitionMethod
deviceId
importedAt
```

- `id` 与 `activityId` 是 non-empty opaque string，source ID 在 bundle 内唯一；
- `activityId` 必须精确引用 bundle activity；
- `provider` 与 `acquisitionMethod` 是 non-empty string，仅表达 provenance；
- `externalId`、`rawArtifactId`、`deviceId` 可以 absent、`null` 或 opaque string；
- `importedAt` 使用 fixed-millisecond UTC instant；
- 非 null `deviceId` 必须引用 bundle 内的 `DeviceReference`；
- 最小 `DeviceReference` 只有 `id`、optional/nullable `manufacturer` 和
  optional/nullable `model`，device ID 在 bundle 内唯一；
- 合同不包含序列号，测试、错误和日志不使用真实设备或活动信息；
- 来源记录是审计关系；未来断开 provider 或合并决策不得以删除来源记录为捷径。

## Deferred downstream work

PR-02 没有实现或冻结：

- RawArtifact schema、内容保留、hash 和 identity；
- exact duplicate matching、模糊候选、review UI 或 merge/unmerge；
- `UserOverride`、字段级 provenance 和来源优先级；
- provider preference、设备 identity 或序列号处理；
- Connector disconnect retention policy 与 PR-19 workflow；
- provenance/storage repository、migration 或真实来源导入。

旧的 hash/external-ID/FIT identity 匹配规则与默认来源优先级只是未来候选，必须在
后续 PR 以隐私、误合并和可回退证据重新决策。

## Consequences

- CanonicalActivity 保持 provider-neutral，同时 bundle 可校验来源与设备引用；
- 最小设备合同降低序列号和真实设备数据泄漏风险；
- 去重、合并和断开策略仍需后续任务独立实现。

## Validation evidence

- bundle tests 覆盖 source/device 必填与 optional 字段、固定 UTC、
  唯一性、activity/device reference 和 unknown field；
- 错误 message 不回显实际 provider、ID、设备或活动值；
- inline deterministic synthetic tests、privacy guard 与 Node side-effect
  检查均不使用真实数据或 credentials；浏览器 side-effect instrumentation
  保持 Not run；
- 完整证据记录在 [Task Brief](../../tasks/pr-02-canonical-contracts.md)。
