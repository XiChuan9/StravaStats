# ADR-0003：Repository 是消费者唯一数据边界

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 接受的消费者边界原则；Repository 设计与实现留给 PR-03 |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[ADR-0001](./0001-canonical-activity.md)、[ADR-0002](./0002-stream-model.md)、[ADR-0004](./0004-import-pipeline.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

Legacy 页面和分析入口仍存在直接 Strava API 与缓存依赖。只增加 Decoder 而不建立
消费者边界，会让来源、持久化和认证判断继续散落在 UI 与分析模块中。

## Accepted decision

本 ADR 只接受以下架构原则：

- 未来 UI、tab、详情页和 analysis consumer 只通过 Repository 或明确的 read
  projection 读取活动数据；
- consumer 不选择 provider、store 或 API，也不直接读取原始导入格式；
- PR-02 的三个纯 validator 构成当前已实现的 canonical domain validation
  boundary；
- Connector 认证生命周期与本地 canonical read boundary 解耦；
- Legacy 路径在 migration、shadow comparison 和 rollback 获批且验证前继续保留；
- Repository 的实现不得让页面重新依赖 provider-specific DTO。

## Non-binding future candidates

旧文档中的 `listActivities`、`getActivity`、`getStreams`、`getLaps`、
`getActivityBundle` 等方法名只是未来候选，不是本 ADR 接受的接口清单。
PR-03 必须根据消费者调查独立决定 Repository 的分层、方法、返回 shape 和错误语义。

## Not implemented by PR-02

PR-02 没有实现或冻结：

- Repository class/interface、具体方法列表或 Factory；
- Legacy/Canonical adapter、IndexedDB store 或缓存策略；
- `dataRepositoryMode` feature flag、shadow writer 或 parity comparison；
- consumer migration、Legacy Projection 或直接 API 调用移除；
- Repository contract tests、offline read 流程或 auth fallback。

## Consequences

- 后续消费者迁移有明确的依赖方向和回退约束；
- Repository API 不会被 PR-02 的临时假设过早冻结；
- Legacy 与 Canonical 并存期仍需承担 adapter 和 parity 成本。

## Validation evidence

- PR-02 boundary tests 证明 contracts 模块不导入 app、service、model、
  analysis、provider、repository、storage、decoder 或 connector runtime；
- 公共入口只暴露三个 validator，不暴露 Repository、Storage、Import、
  Projection 或 Analysis API；
- Node import/validation 是纯边界测试，不构成 Repository 实现证据；浏览器
  dynamic import 保持 Not run；
- PR-03 将负责 Repository 具体决策、实现与独立验收。
