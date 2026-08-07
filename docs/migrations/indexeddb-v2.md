# IndexedDB v2 设计与迁移规则

| 字段 | 内容 |
| --- | --- |
| Status | Proposed |
| Owner | XiChuan9 |
| Created | 2026-07-28 |
| Last updated | 2026-08-06 |
| Target implementation | PR-05 IndexedDB v2 Schema、PR-19 Exact Identity Resolver、PR-20 Duplicate Review |
| Related ADRs | ADR-0001、ADR-0002、ADR-0005、ADR-0006 |

## 1. 核心决定

V2 使用独立数据库：

```text
strava-stats-v2
```

不得原地升级、重命名、覆盖或删除：

```text
strava-dashboard-cache
```

Legacy 数据库在 V2 稳定、回滚演练和用户备份完成前保持可读。

## 2. Proposed object stores

```text
rawArtifacts
importJobs
importItems
activities
activitySources
streamSeries
laps
events
devices
userOverrides
analysisSnapshots
timelineSnapshots
mergeCandidates
mergeDecisions
sourceConnections
settings
migrations
```

具体 keyPath、index 和数据表示在 ADR/Contract 接受后冻结。

## 3. Proposed indexes

```text
activities.startTimeUtc
activities.sportCategory
activitySources.[provider, externalId]
rawArtifacts.sha256
importJobs.createdAt
importItems.jobId
streamSeries.[activityId, streamType]
analysisSnapshots.[activityId, analysisType, inputHash]
mergeCandidates.status
migrations.version
```

每个 index 必须对应明确查询；禁止为了“以后可能有用”无限增加写入成本。

## 4. Key 和 ID 规则

- 所有应用级 ID 是 opaque string；
- 调用方不得依赖自增数字或解析 ID；
- 来源 external ID 与内部 ID 分离；
- RawArtifact 通过稳定 ID 和 SHA-256 查找；
- 复合 index 不替代实体主键；
- backup/restore 保持内部引用一致。

## 5. Transaction boundaries

以下写入必须原子：

### 单个导入活动

```text
activity
activitySources
streamSeries
laps
events
devices relation
importItem status
```

### Merge decision

```text
mergeCandidate status
mergeDecision
```

PR-20 的 review-only decision 不移动 ActivitySource、不修改 Canonical graph，也不触发
analysis invalidation。未来若批准真实 merge/Unmerge，必须以新的原子事务合同补充这些
写入，不能复用 review-only transaction 暗中改变活动数据。

### Restore unit

恢复策略必须明确是整库 staging 后切换，还是按批次事务；失败不得覆盖现有可用资料库。

一个 ImportItem 失败不回滚其他已经完成的 Item。

## 6. Schema versioning

数据库版本与 Canonical schema、parser 和 analysis version 分开：

```text
indexedDbVersion
canonicalSchemaVersion
parserVersion
normalizerVersion
analysisVersion
backupFormatVersion
```

IndexedDB `version` 只表示物理 schema 升级，不用于表示算法变化。

## 7. Migration registry

`migrations` store 至少记录：

```text
id
fromVersion
toVersion
status
startedAt
completedAt
applicationVersion
inputSummary
outputSummary
errorCode
retryCount
```

状态：

```text
pending
running
completed
failed
rolled_back
```

Migration 必须幂等。重复初始化或重试不会创建重复数据。

## 8. Initialization

空库初始化必须：

1.打开指定版本；
2.创建必需 stores/indexes；
3.写入数据库 metadata；
4.写入初始 migration 记录；
5.关闭并重新打开验证；
6.不访问或修改 Legacy DB。

初始化失败时应用可回退 Legacy，不自动重试无限循环。

## 9. Upgrade rules

- 升级前确认浏览器存储能力；
- 必要时要求用户创建备份；
- `onupgradeneeded` 只做短小、可预测的结构操作；
- 大规模数据转换使用显式 migration job，不阻塞版本升级事务；
- migration 记录进度和失败；
- 不在读取页面时偷偷执行不可逆转换；
- 不允许 silent data loss；
- 旧字段清理必须是后续独立 migration。

## 10. Streams 和大对象

在 ADR-0002 未冻结前，Stream 的 Array/TypedArray/Blob/chunk 表示保持 Proposed。

必须满足：

- 启动不加载所有 streams；
- 按 activity + requested type 查询；
- 200,000 点活动可存储、读取和降采样；
- normalized 数据与 chart cache 分离；
- backup 可以流式处理，避免一次构建巨大 JSON；
- quota error 不产生半条活动。

## 11. Concurrency

必须测试：

- 多个 tab 同时打开；
- import worker 与页面读取并发；
- 数据库版本升级时已有连接；
- migration 与新导入冲突；
- 用户取消导入；
- 浏览器关闭/崩溃。

需要明确数据库连接关闭策略和 `versionchange` 处理。

## 12. Quota 和容量

使用 Storage Estimate 提供容量信息。空间不足时：

- 在写入前尽可能预估；
- 当前事务失败并回滚；
- ImportItem 标记 `failed_storage`；
- 提示备份或显式清理；
- 不自动删除 raw、streams、analysis 或 Legacy 数据。

任何自动清理策略必须有独立 ADR。

## 13. Backup compatibility

备份 manifest 至少记录：

```text
backupFormatVersion
indexedDbVersion
canonicalSchemaVersion
createdAt
applicationVersion
stores/files
record counts
hashes
```

恢复前在 staging 结构校验，版本不兼容时不得强制覆盖当前资料库。

## 14. Test requirements

PR-05 至少覆盖：

- 空库初始化；
- 重复初始化；
- schema upgrade；
- 中断和重试；
- transaction rollback；
- quota error；
- 多连接/versionchange；
- 数据计数和索引查询；
- Legacy DB 未改变；
- Feature Flag 回退。

## 15. Acceptance criteria

- [ ]数据库名与 Legacy 分离；
- [ ] object stores 和 indexes 有 Contract；
- [ ]所有 migration 幂等；
- [ ]失败不会留下半个活动；
- [ ]重复初始化安全；
- [ ] Legacy DB 不被打开为 readwrite；
- [ ] quota、并发和中断有测试；
- [ ] backup metadata 可以描述当前 schema；
- [ ]数据库错误可诊断且不泄露隐私；
- [ ]页面尚未被强制切换到 Canonical。

## 16. PR-19 accepted physical v3 migration

PR-19 将独立 V2 数据库的物理版本从 2 增加到 3，只在现有
`activitySources` store 上增加一个索引：

```text
name: byProviderAndExternalId
keyPath: [provider, externalId]
unique: false
multiEntry: false
```

`non-unique` 使升级能够保留历史重复 exact identity，并让 resolver 对多个不同
activity 的结果 fail closed。IndexedDB 不会为缺失或 `null` externalId 建立有效复合
key；非空 opaque string（包括字符串 `"0"`）按原值、区分大小写索引。

物理描述按版本冻结：v1 只含 Canonical core，v2 增加 RawArtifact/ImportJob/ImportItem，
v3 只增加上述复合索引。全新建库按 v1 -> v2 -> v3 顺序写入三条 migration 记录；
已有 v1/v2 库在单个 versionchange transaction 内逐级验证、建索引并更新 metadata。
升级中止时 IndexedDB 回滚整个 v3 结构变更，保留可重试的旧库；成功后不重写、删除或
替换任何逻辑记录。

成功升级到 v3 后，旧 physical-v2 代码可返回 `VERSION_UNSUPPORTED`。禁止 destructive
downgrade、清库或以重建方式“修复”；切回支持 v3 的代码即可重新读取保留的数据。
Legacy 数据库、默认 Legacy 模式、disconnect 与本地删除生命周期均不受此迁移影响。

## 17. PR-20 accepted physical v4 migration

PR-20 将物理版本从 3 增加到 4，schema ID 为 `strava-stats-v2@4`，migration ID 为
`schema-0004-duplicate-review`。V3 的 11 个 store 和全部记录保持原样，只新增：

```text
mergeCandidates
  keyPath: id
  byActivityPair: [activityAId, activityBId], unique
  byStatusAndCreatedAt: [status, createdAt], non-unique

mergeDecisions
  keyPath: id
  byCandidateId: candidateId, non-unique
```

`mergeCandidates` 保留有序 opaque activity pair、`high`/`possible` confidence、
`review_required`/`confirmed_same`/`rejected` status、matcher version、时间、来源 ImportItem
和冻结的安全差异快照。`mergeDecisions` 是 append-only identity-intent audit；PR-20 不含
field choices、primary/secondary、alias、活动隐藏、来源移动、field/stream preference 或
Unmerge。

V3 -> V4 只在一个 versionchange transaction 中创建两个 store/index 集合、更新 metadata
并写入第四条 migration。结构创建或 metadata 校验失败会回滚整个升级，V3 数据库保持
可重试；成功后不重写或删除 Canonical、RawArtifact、ActivitySource、Import 或 Legacy
记录。全新数据库按 v1 -> v2 -> v3 -> v4 顺序完成四条结构 migration。

成功升级后，旧 physical-v3 代码以 `VERSION_UNSUPPORTED` 安全失败，不得降级、清库或
重建。代码回滚必须使用支持 v4 的版本；应用数据回滚仍通过独立保留的 Legacy 数据库和
既有 feature flag。候选/决策记录继续保留，不作为自动清理对象。

## 18. PR-21 accepted backup and restore profile

PR-21 不改变 physical V4、store、index、database version 或 migration registry。备份使用
专用 deterministic stored ZIP32，固定 17 个 entry；archive 和单 entry 上限均为
268,435,456 bytes。当前实现明确是 whole-buffer，不声称 streaming、chunking、resume 或
backpressure。CRC32 与 central-directory SHA-256 校验、manifest 版本/计数/hash、全部记录
结构和内部引用验证在任何目标写入前完成。

恢复只接受数据库不存在或 exact empty V4 baseline。不存在时在一个 versionchange
transaction 创建现有 V4 描述符并写入备份；空基线时在一个包含 13 stores 的 readwrite
transaction 内重新检查并写入。除空基线的 metadata/migrations 外一律使用 `add`，不提供
delete、clear、rename、swap 或 non-empty overwrite。transaction abort、quota、constraint、
取消或进程中断不会留下部分 V4 资料库。

相同备份重复执行返回 `already_restored` 且不写数据库；其他 non-empty/different target
返回 `TARGET_NOT_EMPTY`。Durable settings 不进入 V4 schema，只按冻结 allowlist 在数据库
成功后 additive 写入；冲突在数据库写入前返回 `TARGET_SETTINGS_CONFLICT`，中途失败返回
`SETTINGS_PENDING`，重复同一备份仅补齐缺失 setting。Legacy database/cache 始终不被打开、
升级、写入或删除。
