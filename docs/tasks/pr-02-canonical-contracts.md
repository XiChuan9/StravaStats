# PR-02：ADR 与 Canonical Contracts

## Metadata

| Field | Value |
| --- | --- |
| Status | Ready for investigation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/contracts` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/contracts` |
| Owner | XiChuan9 |
| Reviewer | 独立 Codex 线程 + XiChuan9 |
| Related PRD | Sections 4、5、6、8.4、9、15、17、19 |
| Related plan | Sprint 1 / PR-02 |
| Related ADRs | ADR-0001 至 ADR-0006（当前均为 Proposed） |
| Dependencies | PR-00 与 PR-01 已合入 `integration/v2` |
| Pull request | A1 创建后补充 |

## Goal

在不改变现有运行时页面、Legacy Cache、IndexedDB 或数据来源的前提下，调查并在
后续 Implementation Gate 获批后定义来源中立、可校验、可版本演进的最小
Canonical Contract。

PR-02 的目标合同范围是：

- `CanonicalActivity`；
- `CanonicalStreamSet` 或等价的逻辑 Stream Contract；
- `Lap`；
- `Event`；
- `SourceReference` / `ActivitySource` 的公共命名决策；
- `Capabilities`；
- Version Metadata；
- `ImportedActivityBundle`；
- 稳定的 validation error contract；
- 所有领域 ID 使用 non-empty opaque string；
- 缺失值保持 `null` 或 absent，不转换为 `0`；
- 米、秒、瓦、bpm、摄氏度等单位语义；
- UTC、timezone、offset 和 local time 的语义；
- Schema evolution 与 unsupported version 规则；
- ADR-0001 至 ADR-0006 的状态和范围决策。

本 Task Brief 只初始化调查合同。上述项目均不是已冻结的具体 Schema、字段全集、
validator API 或 Accepted ADR。

## Why now

PR-00 已建立仓库安全和最低测试能力，PR-01 已建立 Legacy Cache 救援与鉴权生命周期
解耦。Development Plan 要求 Contracts 位于 Repository、IndexedDB v2、Shadow
Writer 和 Import Core 之前。若先实施下游模块，来源、缺失值、单位、时间、
capabilities、版本和引用完整性会由各实现自行决定，形成难以回滚的不兼容合同。

同时，六份目标 ADR 仍为 Proposed，并明确保留 validator、sport taxonomy、时间、
stream 表示、Repository、Import、Analysis 和 Provenance 的未决问题。因此必须先完成
严格只读调查和 Investigation Gate，再决定 PR-02 可以冻结的最小范围。

## Investigation questions

1. 当前仓库是否存在事实上的 Canonical 模型、runtime validator 或可复用契约？
2. `js/models/activity-track.js`、`analysis-result.js` 等现有模型的职责是什么，
   为什么它们不能直接视为来源中立 Canonical Contract？
3. 当前 Strava 与 Demo activity 的实际字段、运动类型、时间字段和 ID 假设是什么？
4. Vanilla ESM、无 bundler 和浏览器静态部署对 runtime validator 有哪些约束？
5. 无依赖显式 validator、JSON Schema validator、Zod/Valibot 和其他原生浏览器
   ESM 方案的包体积、加载、复用、CSP、离线和 PWA 风险分别是什么？
6. `CanonicalActivity` 的最小必填字段、可选字段和扩展边界是什么？
7. ID 是否必须拒绝 number、空字符串和纯空白，并将可解析数字字符串保留为
   opaque string？
8. absent 与 `null` 分别允许出现在哪里，如何区分合法真实 `0` 与缺失值，
   如何处理 `NaN`、`Infinity` 和负数？
9. 米、秒、瓦、bpm、摄氏度等单位的非负性、零值和合理范围如何定义？
10. `startTimeUtc` 是否必须是带 `Z` 的合法 ISO instant；IANA timezone、offset、
    local time、DST、精度和演进如何表达？
11. sport taxonomy 的 category、variant、未知运动和 Strava 类型映射如何定义，
    同时避免页面出现 provider-specific 分支？
12. `Capabilities` 的最小字段、`false` / unknown / unavailable 语义、推导规则，
    以及与 streams/laps 的一致性如何校验？
13. `CanonicalStreamSet` 与 `StreamSeries` 的逻辑关系是什么；共享或独立时间轴、
    缺失点、真实 `0`、重复 timestamp、长度差异和空 stream 如何处理？
14. 哪些 stream 逻辑规则必须在 PR-02 决定，哪些 TypedArray、Blob、chunk、
    压缩和 IndexedDB 编码必须推迟到 PR-05？
15. `Lap` 与 `Event` 的 ID、activity reference、offset/time、单位、排序、范围和
    pause/resume/start/stop 语义是什么？
16. PRD、Development Plan 和 ADR 分别如何使用 `SourceReference` 与
    `ActivitySource`；公共合同是否需要区分来源引用和持久化关系？
17. `schemaVersion`、`parserVersion`、`normalizerVersion`、`analysisVersion`、
    `settingsVersion` 和 `inputHash` 中哪些属于 PR-02 合同，哪些留给后续实现？
18. `ImportedActivityBundle` 的 activity、streams、laps、events、sources、
    devices、warnings 最小集合、完整集合和 reference integrity 如何定义？
19. Bundle 是否必须可 `structuredClone`，validator 是否必须保证不修改输入？
20. Validation API 返回 result 还是 throw；稳定 code、field path、multiple
    errors、unknown fields 和 unsupported version 如何表达？
21. Schema evolution 如何处理 additive optional fields、unknown version、
    backward compatibility 和 validator version，同时不在 PR-02 实现 migration？
22. ADR-0001 至 ADR-0006 哪些决定可由 PR-02 接受，哪些必须继续 Proposed 或缩小
    决策范围？
23. ADR-0001 的 Legacy Projection validation 如何记录为后续 PR 验收，而不在
    PR-02 实现 Projection？
24. ADR-0003 的 Repository interface 哪些可冻结为消费者边界，哪些必须留给
    PR-03？
25. ADR-0004 的 `ImportedActivityBundle` 哪些可冻结，哪些 Import Pipeline 行为
    必须留给 PR-07？
26. ADR-0005 的 Version Metadata 哪些可冻结，哪些 Analysis v2 问题继续未决？
27. ADR-0006 的 P0 activity/source provenance 与 P1 字段级 provenance 边界
    如何表达？
28. `js/data/AGENTS.md` 应增加哪些该领域特有边界，而不复制根规则？
29. `tests/contracts/` 的最小结构和 Connector、Decoder、Repository 可复用
    contract test 方式是什么？
30. 是否完全使用小型 inline deterministic synthetic object，避免新增 committed
    fixture？
31. `check:syntax` 是否自动覆盖候选新目录，是否需要新的静态边界检查？
32. PR-02 对页面行为、Legacy Cache、IndexedDB、隐私、migration 和 rollback 的
    实际影响是什么？
33. 最小实现文件和明确禁止文件分别是什么？
34. Implementation Gate 前必须由项目负责人决定的全部问题是什么？

## Confirmed current-state facts

- A0 在 `codex/v2/contracts` worktree 执行，起始 HEAD 和
  `origin/integration/v2` 均为
  `b96bb6aa7e9929845af51b5151f7ba195b4489d4`，ahead/behind 为 `0/0`；
- A0 时 staged、unstaged 和 untracked 均为空；
- PR-00（GitHub PR #3）和 PR-01（GitHub PR #5）已合入
  `integration/v2`；
- A0 时远端不存在 `codex/v2/contracts` 分支或同名 PR；
- A0 时 `docs/tasks/pr-02-canonical-contracts.md`、`js/data/` 和
  `tests/contracts/` 均不存在；
- PR-00 已建立 `npm ci`、`npm run check:syntax`、
  `npm run check:privacy` 和 `npm test` 最低检查；
- A0 基线通过 syntax（105 files）、privacy、118 个 `node:test` 测试和
  `git diff --check`；
- 当前前端是 Vanilla JavaScript + ES Modules，部署形态为静态 Web/PWA，
  当前计划不包含 bundler 或全量 TypeScript 迁移；
- 当前 V1 大量使用 Strava DTO 和 Strava StreamSet 语义，Architecture Overview
  将其描述为事实上的现有领域模型，而非来源中立的 V2 Canonical Contract；
- PRD 中的数据模型是产品语义示例，不是最终 runtime schema；
- ADR-0001 至 ADR-0006 的状态均为 `Proposed`；
- ADR-0001 明确要求在 PR-02 调查完整 sport taxonomy、时间/timezone、
  扩展字段、validator 和 schema evolution；
- ADR-0002 明确保留共享/独立时间轴和 IndexedDB 表示等未决项；
- Repository、IndexedDB v2、Shadow Writer、Import Core、Decoder 和
  Legacy Projection 的实现分别安排在后续 PR；
- 测试必须离线、确定性，不依赖 Strava credentials、网络、浏览器 profile 或
  私人 fixture。

以上是长期文档和 A0 已确认事实，不代表 A2 已完成。

## Decisions required before implementation

Implementation Gate 前，项目负责人必须至少决定：

- PR-02 最终允许和禁止文件；
- 采用哪种 runtime validator 路径，是否批准依赖变更；
- 公共 validation API、稳定 error code/path/result 结构和 unknown-field policy；
- 各合同的最小必填、可选字段和扩展方式；
- non-empty opaque string ID 的严格校验与跨对象引用规则；
- `null` / absent、真实 `0`、非有限值和负值规则；
- 单位、范围和数值精度；
- UTC instant、IANA timezone、offset、local time 和 DST 表达；
- sport category/variant/unknown taxonomy；
- capabilities 的字段、三态或二态语义、推导和一致性；
- stream 的逻辑时间轴和缺失点规则，以及明确推迟的存储表示；
- Lap/Event 的 reference、排序、范围和事件语义；
- `SourceReference` 与 `ActivitySource` 命名和职责；
- Version Metadata 中由 PR-02 冻结的部分；
- `ImportedActivityBundle` 最小组成、reference integrity 和
  `structuredClone` 要求；
- schema evolution、unsupported version 和 backward compatibility；
- 是否新增 `js/data/AGENTS.md` 及其精确领域规则；
- 测试目录、inline synthetic object 和可复用 contract suite 结构；
- ADR-0001 至 ADR-0006 各自应 Accepted、缩小后 Accepted 或继续 Proposed；
- ADR 中属于 Repository、Storage、Import、Projection、Analysis 和 P1
  Provenance 的后续验收如何记录。

调查建议不得自动成为实施批准。

## In scope

当前 A1/A2 只允许：

1. 创建本 Task Brief 并提交、推送、创建 Draft PR；
2. 严格只读调查当前代码、测试、依赖、文档和 Git/GitHub 状态；
3. 在聊天中返回事实审计、备选方案、风险、测试矩阵、最小候选文件和待决问题；
4. 等待项目负责人通过 Investigation Gate。

Investigation Gate 后，PR-02 的候选实施范围仅限：

- 来源中立的 runtime contract 与纯 validation；
- 合同级 synthetic tests；
- 与已批准合同直接相关的最小 ADR 状态/范围更新；
- `js/data/` 的领域边界规则；
- 不改变页面运行时行为的模块导出。

候选实施范围不是当前授权，必须由项目负责人另行冻结。

## Out of scope

- IndexedDB v2 schema、store、transaction、adapter 或 migration；
- Legacy Cache 或 PR-01 Rescue/Auth 生命周期修改；
- Repository 实现、Legacy/Canonical Adapter 或 Factory；
- Strava Connector 或任何第三方 Connector；
- Import Pipeline、ImportJob、ImportItem 或 Transaction Writer 实现；
- FIT、TCX、GPX、CSV、ZIP 或 Strava Archive Decoder；
- Legacy Projection 实现；
- 页面、tab、导航、视觉或分析算法修改；
- Shadow Writer、Parity Report 或双写；
- Feature Flag 行为或默认值修改；
- Service Worker；
- 备份恢复实现；
- Exact Identity、Merge 或字段级 Provenance 实现；
- 真实运动数据、私人 fixture、真实导出或浏览器 profile；
- package 依赖变更，除非 Investigation Gate 后单独批准；
- 直接提交到 `main`、`maintenance/v1` 或 `integration/v2`。

## Preliminary candidate files

以下路径仅用于 A2 调查和 Implementation Gate 候选，不是实施授权：

```text
docs/tasks/pr-02-canonical-contracts.md
docs/architecture/adr/0001-canonical-activity.md
docs/architecture/adr/0002-stream-model.md
docs/architecture/adr/0003-repository-boundary.md
docs/architecture/adr/0004-import-pipeline.md
docs/architecture/adr/0005-analysis-versioning.md
docs/architecture/adr/0006-source-provenance.md
docs/architecture/overview.md
js/data/AGENTS.md
js/data/contracts/**
tests/contracts/**
package.json
package-lock.json
```

`package.json` 和 `package-lock.json` 只有在项目负责人批准外部 validator 后才可进入
实施范围。A2 必须把候选清单收敛成精确最小集合。

## A1 allowed file

A1 唯一允许修改：

```text
docs/tasks/pr-02-canonical-contracts.md
```

A1 完成后，A2 不允许修改任何文件、Git index、commit、PR body 或分支状态。

## Prohibited files and operations

A1/A2 禁止修改：

```text
AGENTS.md
tests/AGENTS.md
.github/**
docs/**（仅 A1 的 docs/tasks/pr-02-canonical-contracts.md 例外）
js/**
tests/**
package.json
package-lock.json
sw.js
api/**
styles/**
```

禁止操作：

- 实施 Canonical Schema、validator、tests 或 runtime exports；
- 修改任何 ADR 或把 Proposed 描述为 Accepted/已冻结；
- 把 PRD 示例复制为最终 runtime schema；
- 创建 `js/data/`、`tests/contracts/` 或其他候选实现路径；
- 安装依赖或修改 lockfile；
- 写入 IndexedDB、localStorage、Legacy Cache 或任何用户数据；
- 读取、枚举、复制或提交 `tests/fixtures/private/` 或仓库外私人资料；
- 使用真实 FIT、TCX、GPX、Strava ZIP、GPS、HR、Power、Token 或 export；
- 修改页面、分析、Repository、Storage、Import、Decoder、Projection、
  Feature Flag 或 Service Worker；
- 在 A2 修改 Task Brief、Git index、commit、PR body 或分支状态；
- 使用 `git add .` 或隐式暂存任务外文件；
- rebase、amend、force-push、合并 PR、删除分支或 worktree；
- 直接修改 `main`、`maintenance/v1` 或 `integration/v2`；
- 未经 Investigation Gate 进入 A3 或产品实现。

## Interfaces requiring investigation

A2 必须给出建议但不得冻结：

- 每个合同的命名、模块边界和 export surface；
- validator 是单对象函数、按类型函数还是 registry；
- validation 是 result-based、throwing 或二者分层；
- 成功结果是否返回原对象、clone 或只返回状态；
- validator 不修改输入的可验证保证；
- error item 的稳定 `code`、`path`、`message`、`expected` / `actual` 边界；
- multiple errors、fail-fast、unknown fields 和 unsupported schema version；
- activity、streams、laps、events、sources、devices 的 cross-reference 验证；
- `ImportedActivityBundle` 的最小和完整形式；
- `structuredClone`、JSON-safe 和浏览器/Node 共用限制；
- Connector、Decoder、Repository 后续复用 contract tests 的接口；
- Legacy Projection、Repository、Storage 和 Import 后续 PR 的明确接缝。

## Acceptance criteria

### A1 / Investigation readiness

- [ ] 只有本 Task Brief 一个文件发生变化；
- [ ] 状态为 `Ready for investigation`；
- [ ] 六份 ADR 明确保持 Proposed；
- [ ] 合同目标、待决问题、范围、候选文件、A1 唯一允许文件和禁止操作完整；
- [ ] 未冻结具体 Schema、validator、字段全集或 storage encoding；
- [ ] 未声称 `js/data/`、`tests/contracts/` 或 Canonical 实现已经存在；
- [ ] A1 自动检查全部通过；
- [ ] 只显式暂存本文件；
- [ ] Draft PR 以 `integration/v2` 为 base 且 diff 只有本文件；
- [ ] Task Brief commit 的 GitHub CI 结果已记录。

### A2 / Investigation Gate

- [ ] A2 全程未修改文件、index、commit、PR body 或分支状态；
- [ ] 调查覆盖 34 个 Investigation questions；
- [ ] 给出当前事实、六份 ADR 状态矩阵和 contract inventory；
- [ ] 给出最小字段/invariant 草案，但明确不是实施授权；
- [ ] 比较 validator 选项并给出适配当前 Vanilla ESM 的推荐；
- [ ] 给出 sport、time/timezone、null/absent/zero、streams/laps/events、
      source naming、version metadata、bundle 和 validation error 建议；
- [ ] 给出精确最小候选文件、Allowed files 建议和 Prohibited files；
- [ ] 给出自动测试矩阵、人工验证、P0/P1/P2 风险和隐私/migration/rollback 影响；
- [ ] 列出所有需项目负责人决定的问题；
- [ ] 明确未运行验证和已知限制；
- [ ] 停止并等待 Investigation Gate。

### Candidate implementation acceptance

以下仅用于 A2 设计测试证据，不授权实施：

- Runtime validation 覆盖获批 Canonical contracts；
- ID 是 non-empty opaque string，number 和空白 ID 被拒绝；
- 缺失值不转换为 `0`，真实合法 `0` 可区分；
- 非法单位、时间、版本和 cross-reference 被稳定 error contract 拒绝；
- unknown sport 可以无损表达；
- validator 不修改输入，适用对象可 `structuredClone`；
- 测试在不同时区结果一致，不访问网络、IndexedDB 或 localStorage；
- 不改变现有页面、Legacy Cache、Feature Flag 或分析行为。

## Required automated checks

A0 已执行：

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

A1 文件完成后必须执行：

```bash
npm run check:privacy
npm run check:syntax
npm test
git diff --check
git diff --name-only
git diff --cached --name-only
```

暂存前 `git diff --cached --name-only` 必须为空；暂存后必须只显示：

```text
docs/tasks/pr-02-canonical-contracts.md
```

候选实施专项测试命令和覆盖范围必须由 Investigation Gate 决定，不得在 A1/A2
安装或实现。

## Manual verification

A1 不改变运行时，不需要浏览器验证。人工检查只包括：

1. 对照 Task Brief 模板确认章节完整；
2. 对照 PRD、Development Plan、Architecture Overview、六份 ADR、Testing
   Strategy 和 Fixture Policy，确认没有把 Proposed 内容描述为冻结事实；
3. 检查 diff 和 cached diff 只有本文件；
4. 检查 Draft PR 的 base/head、Draft 状态、标题和 body；
5. 检查 CI 对应 Task Brief commit。

A2 的人工验证是只读代码和合同审查，不运行真实账号、真实运动数据、浏览器
IndexedDB migration 或 Service Worker 演练。未来 implementation 的浏览器或
projection 验收由 Investigation Gate 决定。

## Privacy and security impact

A1 只新增治理文档，不读取、写入、上传或记录任何活动、位置、健康、设备或凭据
数据。A2 只调查仓库内代码和 synthetic 测试，不读取私人 fixture 或浏览器
profile。

候选 contract tests 优先使用小型 inline deterministic synthetic object。除非
项目负责人另行批准并完成 manifest 审查，不新增 committed fixture。validator
错误和测试输出不得包含 Token、Authorization header、原始活动、GPS、完整 HR /
Power stream、真实文件名或设备序列号。

任何外部 validator 的供应链、CSP、CDN、离线、PWA、包体积和许可风险必须在批准
依赖前记录。

## Migration impact

A1/A2 没有数据 migration，不创建或修改 IndexedDB v2，不读取或修改 Legacy
Cache，不写 localStorage，不生成 Canonical 数据，也不改变 Feature Flag。

候选合同必须支持后续 additive、idempotent、observable、recoverable migration，
但 PR-02 不实现 migration、store、transaction 或编码。底层 stream storage
表示明确留给 PR-05。

## Rollback procedure

A1 只有 Task Brief 文档提交。回滚方式：

1. 保持 Draft PR，不合并；
2. 如需撤销，使用普通 revert 提交撤销 Task Brief commit，不 amend、rebase 或
   force-push；
3. 不清理 Legacy Cache、IndexedDB、localStorage、Service Worker cache 或私人
   导出，因为 A1 未修改这些数据；
4. 删除远端分支或 worktree 不属于本任务授权。

A2 没有文件或 Git 状态变化，因此无需数据回滚。未来实施的回滚方案必须在
Implementation Gate 重新确认。

## Independent review checklist

- [ ] Worktree、branch、base、HEAD 和依赖 PR 与 Metadata 一致；
- [ ] A0 基线证据完整且没有把未运行项标记为 Pass；
- [ ] diff 和 cached diff 只包含 Task Brief；
- [ ] 状态为 `Ready for investigation`；
- [ ] 所有六份 ADR 明确仍为 Proposed；
- [ ] PRD 示例没有被当作最终 runtime schema；
- [ ] Task Brief 只整理长期文档已确认要求；
- [ ] `Preliminary candidate files` 明确不是实施授权；
- [ ] `A1 allowed file` 只有本文件；
- [ ] Out of scope 明确排除 Storage、Repository、Import、Decoder、Projection、
      UI、Analysis、Shadow Writer、Feature Flag 和 Service Worker；
- [ ] package 依赖变更需要单独批准；
- [ ] ID、缺失值、单位、时间、sport、capabilities、streams、references、
      version、bundle、validation 和 schema evolution 均进入调查；
- [ ] 测试只允许 synthetic、确定性、离线数据；
- [ ] 没有私人数据、credentials 或敏感日志；
- [ ] A2 严格只读且结果只返回聊天；
- [ ] Draft PR 保持 Draft，未经批准不进入 A3；
- [ ] migration、privacy 和 rollback 影响已明确；
- [ ] 未运行验证单独报告。

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

A1 Task Brief checks:
  npm run check:privacy — Pass
  npm run check:syntax — Pass (105 files)
  npm test — Pass (118/118)
  git diff --check — Pass
  git status before staging — only this untracked Task Brief
Task Brief commit: Pending
Draft PR: Pending
Task Brief CI: Pending
A2 read-only investigation: Not started
Investigation Gate: Pending
Implementation: Not started
ADR modifications: None
Browser/real data/migration verification: Not run
```
