# ADR-0005：VersionMetadata 与分析版本边界

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Date | 2026-07-28 |
| Accepted date | 2026-07-30 |
| Decision owners | XiChuan9 |
| Decision scope | PR-02 已实现并验证的 VersionMetadata 字段合同 |
| Related documents | [PR-02 Task Brief](../../tasks/pr-02-canonical-contracts.md)、[ADR-0001](./0001-canonical-activity.md)、[ADR-0002](./0002-stream-model.md)、[ADR-0004](./0004-import-pipeline.md) |

> Accepted decision does not mean downstream implementation is complete.

## Context

Parser、Normalizer、设置和算法变化可能要求不同范围的重新计算。单一全局 cache
version 无法表达这些职责，但 PR-02 也不应提前实现 hash、失效图或 snapshot 生命周期。

## Accepted decision

PR-02 接受 `VersionMetadata` 的六个公共字段：

```text
schemaVersion
parserVersion
normalizerVersion
analysisVersion
settingsVersion
inputHash
```

- `versionMetadata` object 是 `ImportedActivityBundle` 必填字段；
- `schemaVersion` 必填，第一版只接受整数 `1`；
- 其余五项 optional；如存在，必须为 `null` 或 non-empty string；
- bundle、activity 与 versionMetadata 的 `schemaVersion` 必须一致；
- unsupported version fail closed；
- validator 不计算 hash，也不修改或填充 metadata；
- PR-02 不冻结 `inputHash` 的 canonicalization。

六个字段名称表达未来版本职责，但不证明相应 producer 或 invalidation runtime 已存在。

## Deferred downstream work

以下仍由后续 Analysis、Storage 或 Import PR 决定：

- `AnalysisSnapshot` shape、状态、持久化和读取策略；
- input hash 算法与 canonical serialization；
- stale dependency graph、重算 queue 和失败恢复；
- parser/normalizer/analysis/settings version 的生成与映射；
- snapshot retention、清理、容量、UI stale 标识和 rollback。

旧 snapshot shape、state 与 stale trigger 清单是 future candidate，当前不具约束力。

## Consequences

- bundle 可以携带稳定的版本职责字段并校验 schema 一致性；
- hash 和失效策略保持可演进，不被 PR-02 的占位实现锁定；
- 后续实现必须补齐可复现性、存储和回退证据。

## Validation evidence

- bundle tests 覆盖六字段、optional null/string、空字符串拒绝、unsupported version
  和三层 schema mismatch；
- validator 结果不包含或计算 input hash，不产生 normalized bundle；
- Node 最小 bundle validation 通过；浏览器 dynamic import 保持 Not run；
- 自动化门禁记录在 [Task Brief](../../tasks/pr-02-canonical-contracts.md)。
