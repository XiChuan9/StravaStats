# ADR-0002：活动 Stream 模型

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 已实现并验证的 CanonicalStreamSet 逻辑合同 |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[ADR-0001](./0001-canonical-activity.md)、[ADR-0003](./0003-repository-boundary.md)、[ADR-0004](./0004-import-pipeline.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

不同来源的采样率、时间轴和缺失点表达不同。把 Strava StreamSet 或统一一秒
插值数组固定为 V2 标准会制造数据、丢失缺失语义，并把存储表示泄漏到逻辑合同。

## Accepted decision

PR-02 接受以下已实现并验证的运行时逻辑模型：

```js
{
  activityId,
  series: [
    {
      streamType,
      unit,
      offsetsSeconds,
      values,
      quality
    }
  ]
}
```

- `activityId` 只存在于 `CanonicalStreamSet`；`StreamSeries` 内没有
  `activityId`；
- 每条 series 拥有独立 timeline，不要求跨 series 等长或共享 offset；
- PR-02 runtime 使用 plain arrays；这不是 IndexedDB 编码决定；
- `offsetsSeconds` 与 `values` 等长、非空，offset finite、非负且
  non-decreasing；
- 重复 timestamp 合法，每个重复位置产生 `DUPLICATE_TIMESTAMP` warning；
- 缺失点使用 `null`，真实 `0` 原样保留；
- `moving` 使用 `boolean | null`，unit 为 `boolean`；
- `position` 使用 WGS84 `[latitude, longitude] | null`，坐标 finite 且在范围内；
- 其他开放 stream 使用 finite `number | null`，并应用已冻结的 HR 与非负约束；
- summary-only/no-stream 使用 `series: []`；实际存在的 series 不得为空；
- 同一 set 的 `streamType` 唯一，validator 不排序输入；
- `quality` 可以 absent、`null` 或 plain JSON-safe object；
- laps 和 events 是 bundle 中的独立领域对象，不隐藏在 stream 数组里。

## Consequences

- 不同采样率和采样空洞可以被无损表达；
- 缺失传感器不会被伪造为全零数组；
- 逻辑合同不预先绑定持久化编码；
- 后续读取、降采样和大数据性能仍需要独立设计。

## Deferred downstream work

PR-05 或其他获批后续 PR 决定：

- TypedArray、Blob、chunk、压缩、chunk size 和 IndexedDB encoding；
- StreamRepository、lazy loading、requested-type 查询和 persistence；
- 性能基准、大 stream 内存策略和图表 downsampling；
- 插值、派生 stream、coverage/quality 的完整 vocabulary；
- GPX/TCX/FIT decoder 对无时间戳或异常采样的策略。

旧 `StreamRepository` 方法草案不属于本 ADR 的已接受实现，也不约束 PR-03/PR-05。

## Validation evidence

- `validateCanonicalStreamSet(value)` 覆盖空 set、独立 timeline、长度与顺序、
  duplicate timestamp、moving/position/numeric 类型、null/0、quality 和
  unknown field；
- accessor/Proxy fail-closed、frozen input、non-mutation、
  structuredClone/JSON round-trip 和稳定排序已通过；
- Node 原生 ESM import 与最小有效 StreamSet 已通过；浏览器 dynamic import
  因获批 Browser 执行面不可用而保持 Not run，证据记录在
  [Task Brief](../../tasks/pr-02-canonical-contracts.md)。
