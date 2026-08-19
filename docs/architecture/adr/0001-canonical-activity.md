# ADR-0001：来源中立的 Canonical Activity

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 已实现并验证的 CanonicalActivity v1 逻辑合同 |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[PRD](../../product/stravastats-v2-prd.md)、[Architecture Overview](../overview.md)、[ADR-0002](./0002-stream-model.md)、[ADR-0006](./0006-source-provenance.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

Legacy 页面、缓存和分析大量使用 Strava DTO。让其他来源继续生成 Strava
DTO 会把 V2 永久绑定到 provider 字段、ID、缺失值和运动类型语义。PR-02
因此实现了来源中立、可校验、可版本化的最小活动合同，但没有迁移现有消费者。

## Accepted decision

PR-02 接受以下已实现并通过测试的 `CanonicalActivity` v1 逻辑合同：

- `schemaVersion` 只接受整数 `1`；
- `id` 是不可解析、不可假定为数字的 non-empty opaque string；
- `sportCategory` 固定为 `run`、`ride`、`swim`、`walk`、`hike`、
  `workout`、`winter`、`team`、`racket`、`other`；
- `sportVariant` 是 `null` 或来源中立的 normalized slug；
- `startTimeUtc` 是固定毫秒精度、显式 `Z` 结尾且不存在日期溢出的 UTC instant；
- `timeZone` 必须是 `{ ianaName, utcOffsetMinutes }` 对象；两项均可为
  `null`，offset 范围为 -840 至 840 分钟；
- absent、`null` 与真实 `0` 保持不同语义，不做 coercion 或默认填充；
- `capabilities` 的五个字段全部必填且为严格 boolean；
- summary 字段可以 absent 或 `null`，如存在则必须满足有限数值及关系约束；
- `extensions` 可以 absent、`null` 或 plain JSON-safe object；
- validator 是 dependency-free 原生 ESM，只返回稳定
  `{ ok, errors, warnings }`，不修改输入、不执行 accessor，并对反射失败
  fail closed；
- provider-specific 字段不进入活动顶层；来源关系由独立的
  `ActivitySource` 表达。

内部逻辑单位为米、秒、瓦、bpm 和摄氏度。Unknown field 保留在输入中并产生
稳定 warning。

## Consequences

- 新数据源无需伪装成 Strava，消费者可依赖稳定的领域语义；
- 缺失能力、缺失 summary 和真实零值可被一致区分；
- schema version 与纯 validator 为后续迁移提供 fail-closed 边界；
- Legacy DTO 与 CanonicalActivity 的并存和 projection 会增加过渡成本。

## Deferred downstream work

以下内容未由本 ADR 或 PR-02 实现：

- Canonical → Legacy Projection、页面/UI consumer migration 和 parity 验收；
- `UserOverride` 的模型、持久化与 UI；
- Repository、Storage、IndexedDB v2、migration、shadow write 和 rollback；
- FIT/TCX/GPX/Archive Decoder、provider mapping 的完整实现；
- schema evolution migration 与真实数据验证。

这些能力必须由各自后续 PR 单独授权、实现、测试和验收。

## Validation evidence

- `validateCanonicalActivity(value)` 已实现上述 v1 合同；
- Node 合同测试覆盖 opaque ID、十类 sport、nullable variant、fixed-ms UTC、
  `timeZone` 对象、严格 capabilities、summary 关系、extensions 和
  absent/null/0；
- descriptor-safe、throwing getter、revoked/reflection Proxy、
  frozen input、non-mutation、JSON round-trip 和稳定错误排序已通过；
- PR-02 自动门禁证据记录在
  [Task Brief](../../tasks/pr-02-canonical-contracts.md)；浏览器 ESM dynamic
  import 因获批 Browser 执行面不可用而保持 Not run，不影响本 ADR 只接受已经由
  Node 合同测试证明的逻辑决定。
