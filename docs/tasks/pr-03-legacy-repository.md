# PR-03：Legacy Repository 与 Strava Connector

## Metadata

| Field | Value |
| --- | --- |
| Status | Ready for investigation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/repository` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/repository` |
| Owner | XiChuan9 |
| Reviewer | 控制塔 + 独立审查线程 |
| Related PRD | Sections 4.1、5、8.4、8.6、8.7、17、19 |
| Related plan | Sprint 1 / PR-03 |
| Related ADRs | ADR-0003（Accepted，仅 Repository 消费者边界原则）及 ADR-0001、0002、0004、0005、0006 的下游边界 |
| Dependencies | PR-00、PR-01、PR-02 已合入 `integration/v2` |
| Starting baseline | `5137afeff2530a228c2be79af54bd04912a0c389` |
| Pull request | Draft PR 待 A1 创建 |

## Status

本任务当前只获准完成 A0、A1 和 A2。A2 是严格只读调查；A2 完成前没有产品实施
权限。第一个实施阶段必须等待控制塔单独批准 A3 决策与范围冻结。

Repository API、Connector API、Factory API、Legacy adapter、Feature Flag 接线、
消费者迁移方式及 Allowed files 均尚未冻结。本文档的候选项不能解释为实施授权。

## Background

当前浏览器应用通过 `js/services/api.js`、Legacy activity cache、Demo API 以及页面
或 tab 中的直接请求取得 Strava 数据。ADR-0003 已接受 Repository 是未来消费者唯一
数据边界的原则，但明确把具体接口、返回 shape、错误语义、实现、Factory 和迁移留给
PR-03 及后续 PR。

PR-01 已建立 Legacy Cache 救援、Authentication Lifecycle 解耦和 Demo namespace
隔离。PR-02 已建立 provider-neutral Canonical contracts，但没有实现 Repository、
Connector、Projection、Storage 或 consumer migration。PR-03 必须先调查真实调用链
和现有行为，再提出保持 Legacy 行为的最小边界。

## Goal

调查并为后续控制塔决策准备一个最小、可测试、可回滚的 Legacy Repository 与
Strava Connector 边界方案：

- 识别所有当前 API、cache、storage、Demo、Token 和消费者调用链；
- 记录现有输入、输出、错误、缓存、副作用和 UI-facing shape；
- 建议 Connector、Legacy Repository 与 Factory 的职责分离；
- 基于真实消费者提出非绑定的最小 Repository API、错误合同、文件布局和测试矩阵；
- 保持 Legacy 默认行为，并明确哪些消费者迁移属于 PR-04A/PR-04B；
- 为 A3 提供精确 Allowed/Prohibited files 候选和 B1/B2/B3 分阶段建议。

## Non-goals

本阶段以及未经 A3 批准的 PR-03 不做：

- 将 Legacy 数据转换为 `CanonicalActivity` 或其他 Canonical contract；
- IndexedDB v2、Canonical Repository、Shadow Writer、Parity Report 或 migration；
- 迁移全部页面、tabs、详情、streams、Run Plus、NSM 或 analysis；
- 删除、清理、覆盖、升级或改变 Legacy Cache；
- 删除或替换 `js/services/api.js`；
- 修改 PR-02 contract 语义、validator 或公共 exports；
- 重构分析算法、Demo namespace、Service Worker 或页面视觉；
- 开始 PR-04A、PR-04B、PR-04C 或 PR-05；
- 更新产品版本号、依赖或发布配置。

## Dependencies

- PR-00 Repository Safety 已合入；
- PR-01 Legacy Cache Rescue 与鉴权解耦已合入；
- PR-02 Canonical Contracts 已合入，六份 ADR 已按实际逻辑合同收窄；
- `integration/v2` 必须保持在已确认的最新远端基线；
- A3 必须由控制塔在 A2 决策包之后单独批准。

## Accepted ADR constraints

ADR-0003 只冻结以下原则：

- 未来 UI、tab、详情页和 analysis consumer 通过 Repository 或明确 read
  projection 读取活动数据；
- consumer 不选择 provider、store 或 API；
- Connector 的认证生命周期与本地 canonical read boundary 解耦；
- Legacy 路径在 migration、shadow comparison 和 rollback 获批前继续保留；
- Repository 不得让页面长期依赖 provider-specific HTTP response。

ADR-0003 没有冻结方法名、参数、返回结构、错误合同、Factory、Legacy adapter、
Strava Connector、Feature Flag 接线或 consumer migration。

## Current-state assumptions

以下均为 A2 待验证的假设，不是已冻结事实：

- `js/services/api.js` 是主要 Strava API 访问入口，但页面或 tabs 仍可能绕过它；
- `activity-cache.js` 保存 Legacy activity list，并由 app/gear 路径读取；
- Demo API 与真实 API 在 services 层存在分派；
- `auth-lifecycle.js` 已提供部分稳定 auth 状态，但不一定可直接作为 Repository
  error contract；
- `feature-flags.js` 当前使用 `legacy` / `v2`，与架构文档的
  `legacy` / `shadow` / `canonical` 不一致；
- Canonical contracts 尚未从浏览器应用路径实际接入；
- PR-03 可以不触发 consumer migration，但必须由 A2 证据确认。

## A0 baseline evidence

执行日期：2026-07-30，环境：macOS / Asia/Shanghai。

| Check | Result |
| --- | --- |
| V2 worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` |
| V2 branch | `integration/v2` |
| Local HEAD | `5137afeff2530a228c2be79af54bd04912a0c389` |
| Remote `integration/v2` | 与预期 SHA identical，ahead/behind `0/0` |
| V2 worktree status | Clean |
| Repository worktree before A1 | Absent |
| Local/remote `codex/v2/repository` before A1 | Absent |
| Related PR before A1 | Absent |
| PR-03 Task Brief before A1 | Absent |
| `npm ci` | Pass；added 6 packages，0 vulnerabilities |
| `npm run check:syntax` | Pass；116 files |
| `npm run check:privacy` | Pass |
| `npm test` | Pass；398/398 |
| `git diff --check` | Pass |

远端状态通过已连接的 GitHub app 核对；本地 `gh` 默认账号凭据无效，未被用于建立
远端事实。GitHub compare 证明预期 SHA 与 `integration/v2` identical；远端 branch
搜索和全部近期 PR 检查未发现 PR-03 同名对象。

## Investigation Gate

A2 完成前：

- 不修改任何文件，包括本 Task Brief；
- 不修改 PR body；
- 不暂存、提交、推送或创建实现文件；
- 不安装依赖；
- 不修改 Git 状态；
- 不实施 Repository、Connector、Factory、Feature Flag 或 consumer wiring；
- 不运行真实网络、真实 Token、真实账号或真实私人活动测试。

A2 返回完整决策包后立即停止。只有控制塔批准 A3 并冻结接口、错误、文件和阶段范围
后，才可能开始第一个实施阶段。

## Investigation questions

1. `js/services/api.js` 的完整 export 清单和每个静态调用方是什么？
2. `activity-cache.js` 的全部调用方、副作用、TTL、hit/miss 和 fallback 行为是什么？
3. `services/index.js` 如何 re-export，哪些消费者绕过公共入口？
4. Demo API 与真实 API 在哪里分派，Demo 是否仍可触达 Token、fetch 或真实 storage？
5. 全部 `/api/strava-*`、直接 Strava endpoint、Authorization 构建和 Token refresh
   路径是什么？
6. 页面、tabs、app、analysis 中有哪些数据访问绕过 services？
7. activity、detail、streams、laps、athlete、zones、gears、gear detail、pagination、
   refresh 的精确行为合同是什么？
8. provider response、Legacy storage shape、UI-facing shape、preprocessing input 和
   Canonical contract 如何区分？
9. Connector、Legacy Repository 与 Factory 的最小职责边界是什么？
10. 开发计划中的七个候选方法是否逐一需要，是否存在更小或额外候选？
11. PR-03 应暂时返回 Legacy DTO、Legacy read projection，还是其他兼容 shape？
12. summary/detail、requested streams、missing、empty、not-found 和 unavailable
    应如何表达？
13. 现有 API/auth errors 能否复用，如何避免敏感信息和重复状态？
14. Demo 是否需要独立 Repository，Connector 在 Demo 中是否必须完全不可达？
15. `legacy`/`v2` 与 `legacy`/`shadow`/`canonical` 的差异如何在 A3 决策？
16. 最合适的 Repository、Connector、Factory 和 test 目录是什么？
17. 后续是否需要新依赖；如何优先通过依赖注入避免新增依赖？
18. 同一 Repository contract suite 能否复用于 Legacy、Demo/Synthetic 和未来
    Canonical/IndexedDB v2 Repository？
19. PR-03 是否会成为首个从浏览器应用路径导入 contracts 的 PR？
20. P0/P1/P2 风险、migration、storage、privacy、rollback 和 PR-04 ownership
    影响是什么？

## Candidate scope

以下只用于 A2 比较，不是 Allowed files，也不授权创建或修改：

```text
js/repository/**
js/data/repository/**
js/services/repository/**
js/connectors/strava/**
js/services/api.js
js/services/index.js
js/app/feature-flags.js
js/demo/index.js
tests/repository/**
tests/connectors/**
docs/tasks/pr-03-legacy-repository.md
```

开发计划中的候选方法也仅是调查输入：

```text
listActivities
getActivity
getStreams
getLaps
getAthlete
getZones
getGears
```

Allowed files 尚未冻结。A2 必须给出精确候选，A3 才能批准。

## Prohibited operations

- 直接修改 `main`、`maintenance/v1` 或 `integration/v2`；
- rebase、amend、force-push、合并 PR、把 PR 标记 Ready、删除分支或 worktree；
- 使用 `git add .` 或 `git add -A`；
- 删除、清空、覆盖或修改 Legacy Cache；
- 修改任何浏览器 profile 数据；
- 修改 migration 文件或创建 migration；
- 修改 Service Worker；
- 更新产品版本号；
- 添加或更新依赖；
- 使用真实 Token、账号、活动、GPS、健康、设备或私人导出；
- 真实 Strava 或其他网络测试；
- 实施未经 A3 冻结的接口、Factory、Connector、Feature Flag 或 consumer wiring；
- 为 Repository 修改 `js/data/contracts/**` 语义或扩大 exports；
- 自行进入 A3、B1、B2 或 B3。

## Privacy constraints

- 不允许真实 access Token、refresh Token、Authorization header、Cookie 或账号；
- 不允许真实 FIT、TCX、GPX、Strava ZIP、GPS、HR、Power、设备序列号或私人活动；
- 自动测试只能使用 inline 或 approved synthetic deterministic data；
- 错误、日志、PR、CI 和调查报告不得包含原始 response body、完整 provider payload
  或可识别运动信息；
- Demo 模式必须保持 `strava_tokens_demo` 与 Demo namespace 隔离；
- 不读取、枚举、复制或提交 `tests/fixtures/private/`。

## Testing expectations

A2 只提出测试策略，不实现测试。候选 B 阶段最低门禁：

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

专项测试候选必须离线、确定性、无真实 credentials，覆盖 Repository contract、
Legacy parity、Connector HTTP/auth/pagination、Factory fail-closed、cache hit/miss/TTL、
Demo 零网络/零 Token、error redaction、non-mutation、import side effects 和 no DOM。

## Migration impact

A0–A2 没有 migration，不读取或修改用户存储，不创建 IndexedDB v2，不清理或写回
Legacy Cache。Canonical conversion 不属于 PR-03。

Consumer migration 原则上属于 PR-04A/PR-04B/PR-04C；只有 A3 单独批准的最小兼容
接线才可能进入 PR-03，且必须有明确回滚和 parity 证据。

## Rollback expectation

A1 只有 Task Brief 普通提交，可用普通 revert 撤销，不影响产品代码或浏览器数据。
未来获批实现也必须保留 Legacy 默认路径，通过普通 revert 恢复，不删除 Legacy 或
Canonical 数据，不以 cache 清理作为回滚步骤。

## Browser verification carry-over

PR-02 延期的 browser native ESM dynamic import、exact exports/validator calls、
storage/network/Service Worker instrumentation 和 Manual DevTools 仍为
`Not run`，不是 Pass。

A2 必须明确判断：

- 若 PR-03 不从浏览器应用路径导入 contracts，则不触发该门禁，并明确移交 PR-04A；
- 若 A3 计划接入 contracts，则 B 阶段必须补齐真实浏览器 dynamic import、精确
  exports、validator 调用及 storage/network side-effect 检查；
- Node 测试不能替代浏览器验证。

## Acceptance process

```text
A0 baseline
→ A1 Task Brief + Draft PR + CI
→ A2 read-only investigation
→ control-tower A3 decision
→ B1/B2/B3 separately authorized implementation phases
→ independent review
→ project-owner Ready approval
→ separate merge authorization
```

PR 必须在整个 A0–A2 保持 Draft。A2 返回不更新本文档或 PR body。

## Stop conditions

以下任一发生立即停止并报告：

- 同名 branch、worktree、PR 或 Task Brief 已存在；
- `integration/v2` 远端基线无法确认或本地/远端不同步；
- V2 worktree 不干净；
- A0 任一门禁失败；
- A1 diff 不只包含本 Task Brief；
- A1 CI 未完成、失败或 head SHA 不匹配；
- PR base/head、Draft/Open 状态或 diff 不正确；
- A2 发现必须先改代码、测试、依赖、ADR、migration 或 Service Worker 才能继续；
- 需要扩大权限到 A3/B 阶段；
- 发现真实凭据或私人数据暴露风险。

## Phase ledger

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| A0 Environment, baseline, remote audit | Completed | Baseline `5137afe...`；116 syntax files；398/398 tests；all gates Pass |
| A1 Worktree, branch, Task Brief, Draft PR | In progress | 只允许本 Task Brief；等待 commit、push、Draft PR 与 CI |
| A2 Read-only investigation | Not started | 仅在 A1 CI 成功且 PR/diff/worktree 状态正确后开始 |
| A3 Decision and scope freeze | Not authorized | 等待控制塔在 A2 后单独批准 |
| B1 | Not authorized | 不得开始 |
| B2 | Not authorized | 不得开始 |
| B3 | Not authorized | 不得开始 |
