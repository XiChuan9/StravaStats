# ADR-0004：来源中立的 Import Pipeline 边界

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 已实现的统一 import target 与 validation boundary |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[ADR-0001](./0001-canonical-activity.md)、[ADR-0003](./0003-repository-boundary.md)、[ADR-0006](./0006-source-provenance.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

本地文件、Archive、API 和 Demo 具有不同容器和格式。若每个来源自行定义 normalized
结果和写入形态，就无法统一验证引用、能力、版本和 provenance。

## Accepted decision

PR-02 接受以下来源中立边界：

- Decoder/Normalizer 的统一输出目标是 `ImportedActivityBundle`；
- bundle 恰有九个必填顶层字段：
  `schemaVersion`、`activity`、`streams`、`laps`、`events`、`sources`、
  `devices`、`warnings`、`versionMetadata`；
- bundle validator 合并各子合同，并校验 activity references、device references、
  ID/index 唯一性、capability consistency、schema version consistency 和 event
  state；
- `ActivitySource.provider` 只表达 provenance，不触发业务分支；
- 任意后续持久化入口必须先通过 bundle validation，不得绕过 canonical
  contract；
- validator 不生成 normalized 副本、不执行 Decoder、Storage、Analysis 或网络逻辑。

这是未来 pipeline 的既有目标合同，不表示 pipeline 已经可运行。

## Deferred downstream work

PR-02 没有实现或冻结：

- `ImportJob`、`ImportItem`、Worker、进度、取消、重试和恢复状态；
- transaction、IndexedDB 写入、幂等导入和失败回滚；
- Connector、Decoder、Normalizer 的具体实现；
- RawArtifact 内容、hash/canonicalization、identity 和 duplicate matching；
- ZIP/XML 安全处理、FIT/TCX/GPX/Archive 解析；
- analysis enqueue、Import Report、UI 和真实数据导入。

旧流水线步骤与 import state 清单只是未来设计输入，不是当前已实现的状态机。

## Consequences

- 所有来源有一个可测试、来源中立的输出边界；
- 引用和版本错误能在未来写入前 fail closed；
- pipeline 的事务、恢复和安全实现仍需后续 PR 单独验证。

## Validation evidence

- `validateImportedActivityBundle(value)` 已覆盖九字段 shape、Lap、Event、
  ActivitySource、DeviceReference、VersionMetadata、bundle warning、引用、
  capability、version 和 state-machine 一致性；
- getter/Proxy fail-closed、non-mutation、deep freeze、structuredClone、
  JSON round-trip、稳定排序与去重已通过；
- 自动 Node 边界验证不访问网络、storage、DOM 或真实活动数据；浏览器
  dynamic import/side-effect instrumentation 保持 Not run；
- 完整证据记录在 [Task Brief](../../tasks/pr-02-canonical-contracts.md)。
