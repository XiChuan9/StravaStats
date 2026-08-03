# PR-04B：活动详情消费者迁移

## Metadata

| Field | Value |
| --- | --- |
| Status | Investigating |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/detail-consumers` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/detail-consumers` |
| Owner | XiChuan9 |
| Reviewer | 控制塔 + 独立审查任务 |
| Related PRD | Sections 4.1、5、8.4、8.6、10 Epic B2、11.2、19 |
| Related plan | Sprint 2 / PR-04B |
| Related ADRs | ADR-0003，以及与 Activity/Streams 合同相关的 ADR-0001/0002 |
| Dependencies | PR-00 至 PR-04A 已合并 |
| Starting baseline | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Pull request | Pending Draft PR |

## Goal

- 查明 activity router、通用详情页、Run/Bike/Swim 详情页和 Advanced Analysis 的真实取数链。
- 设计最小迁移，使详情 consumer 只通过 Repository 或明确的页面 read façade 获取数据。
- 避免页面和 Advanced Analysis 重复获取同一活动数据。
- 保持现有详情输出、算法、DOM、CSS、路由和视觉不变。
- 不在 A0–A2 实施迁移。

## Why now

PR-03 已冻结七个 Repository 公共方法和统一 success/error 合同；PR-04A 已合并汇总
consumer 迁移。ADR-0003 要求详情页和 analysis consumer 不再自行选择 provider、
storage、cache 或 API。PR-04B 必须先完成只读调查和控制塔决策，再进入任何实现阶段。

## Investigation questions

- Router 如何解析 ID、读取/写入 Token、请求 activity，并选择详情页？
- 四类详情页分别请求哪些 activity、streams 和 metadata，产生多少 storage/network 副作用？
- Advanced Analysis 是否重复请求 activity/streams，能否安全接收页面已加载数据？
- 现有七方法是否足以在页面 session 内组合一次 Legacy detail bundle？
- Laps 是否继续使用 activity detail 内嵌数据，是否完全不需要独立 `getLaps`？
- Demo/Real 如何冻结一次 session mode，并保持 provider/storage 隔离？
- 哪些候选文件、测试和浏览器证据是后续实施的最小集合？

## In scope

- 本 Task Brief。
- 只读源码、测试和文档调查。
- 当前/目标调用图。
- Repository 能力缺口分析。
- 测试与浏览器验证设计。
- 隐私、migration、rollback 和风险分析。

## Out of scope

- 所有产品代码和测试实现。
- PR-04C Run Plus/NSM。
- IndexedDB v2。
- Canonical storage、decoder 或 import。
- 分析算法、阈值或结果调整。
- HTML、CSS 或视觉重构。
- Service Worker。
- package 或 dependency 变更。
- server `api/**`。
- 真实 Strava 网络、Token、账号、私人数据或用户 browser profile。

## Allowed files during A0–A2

```text
docs/tasks/pr-04b-detail-consumers.md
```

产品源码、测试、长期文档和治理文件在 A0–A2 只能读取。候选实施路径将在 A2 中作为
proposal 记录，不构成 allowlist，也不授权实现。

## Prohibited files and operations during A0–A2

- 不修改 HTML、JavaScript 产品代码、测试、Repository、Connector、Factory、公共 exports、
  package 文件、Service Worker、server `api/**` 或长期治理文档。
- 不创建 page façade、测试文件或 `AGENTS.md`。
- 不新增 `getActivityBundle`、`getLaps` 或任何第八个 Repository 公共方法。
- 不修改 Token/auth lifecycle、算法、charts、copy、CSS、DOM、路由或视觉。
- 不使用真实 Strava Token/account/network、私人 fixture 或用户现有 browser profile。
- 不启动 PR-04C、PR-05 或 B1/B2/B3；不修改 `main`、`maintenance/v1`、`integration/v2`。
- 不使用 rebase、amend、force push、`git add .`，不触碰两个 detached Codex worktree。

## Frozen upstream contracts

PR-03 冻结且只冻结以下七个公共方法：

```text
listActivities({ refresh = false } = {})
getActivity(activityId)
getStreams(activityId, { types })
getAthlete()
getZones()
getGears()
getGear(gearId)
```

所有成功结果使用精确 `{ data, source, warnings, partial }` envelope；失败抛出脱敏的
`RepositoryError`。Laps 当前内嵌于 activity detail。新增第八个公共方法必须重新获得
控制塔批准；A2 不会自行新增或冻结该能力。

## A0 baseline evidence

| Check | Actual result |
| --- | --- |
| Source worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` |
| Source branch | `integration/v2` |
| Source worktree status | Clean |
| Local HEAD | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local `origin/integration/v2` ref | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local/origin ahead/behind | `0/0` |
| GitHub remote `integration/v2` | Identical to `66cdc2c457457a93bec46fdf98c5a508c96770c9` (`0/0`) |
| PR #8 | Merged; merge commit `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local/remote feature branch before creation | Absent / absent |
| Target worktree path before creation | Absent |
| Detached Codex worktrees | Two observed; not modified |
| New branch/worktree | `codex/v2/detail-consumers` at the required manual path |
| New worktree HEAD/status | Required SHA / clean |
| Initial upstream | `origin/integration/v2`, `0/0`; to be replaced by same-name upstream on first push |
| `npm ci` | PASS; 6 packages added; 0 vulnerabilities |
| `npm run check:syntax` | PASS; 133 files |
| `npm run check:privacy` | PASS |
| `npm test` | PASS; 702/702; skipped/cancelled/todo `0/0/0` |
| `git diff --check` | PASS |

## Current-state investigation

Pending A2 read-only investigation.

## Candidate target designs

Pending A2 comparison. Any page composition façade, eighth Repository method, Router handoff,
storage/session mechanism, file path, or phase split recorded here remains a proposal until the
control tower completes A2 acceptance and A3 decisions.

## Acceptance criteria for A0–A2

- A0 exact branch/SHA/clean/sync/PR/absence checks are evidenced before worktree creation.
- A1 and A2 diffs contain only this Task Brief.
- A2 records current and candidate call graphs, request/side-effect matrices, Repository and laps
  capability analysis, Demo/Real/error/output parity, candidate/prohibited paths, test plans,
  privacy/migration/rollback, risks, and all control-tower decisions required.
- Browser/manual/real-data checks not actually run are marked `Not run`.
- Final A2 status is `Awaiting decision`; implementation remains unstarted and Draft PR remains open.

## Required automated checks

At A0 and after each Task Brief update, record actual results for:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

## Manual verification

- Browser/CDP detail-page smoke: planned for a separately approved implementation phase; A0–A2
  result is `Not run` unless explicitly executed with deterministic synthetic isolated state.
- Visual parity, Safari/Firefox/mobile, production Service Worker, real Strava account/network,
  private data, and the user's existing browser profile: `Not run` in A0–A2.

## Privacy and security impact

A0–A2 are documentation and read-only investigation only. They do not read or expose Token,
Authorization, account, activity, GPS, heart-rate, power, private fixture, raw body/payload/cause,
or the user's browser profile. All future test design must use deterministic synthetic data and
fail closed without deleting Local Library data.

## Migration impact

None in A0–A2. No IndexedDB, cache, storage schema, Token lifecycle, Canonical data, Legacy data,
or Local Library content is created, modified, migrated, cleared, or deleted.

## Rollback procedure

A1/A2 change only this Task Brief in ordinary commits. Rollback requires control-tower direction
and an ordinary revert; do not reset/rebase/force-push, delete branches/worktrees, or clear browser
or Legacy storage.

## Initial risk register

### P0

- Numeric parsing of opaque activity IDs can select the wrong resource or make local string IDs unusable.
- Router/page/analyzer duplication can create multiple provider requests and repeated Token writes.
- Demo mode can fall through to real Token/cache/metadata paths.
- An unapproved eighth Repository method would violate the PR-03 frozen contract.

### P1

- Stream type drift or missing-capability handling can change charts, maps, laps, exports, or errors.
- Error remapping can misclassify network/500 failures as auth failure or expose private payloads.
- Cross-page state handoff can create stale bundles, circular dependencies, or import-time I/O.

### P2

- Browser/visual evidence may require a dedicated synthetic smoke harness in a later authorized phase.
- Existing key spelling and ownership inconsistencies may require explicit compatibility documentation.

## Decisions required before implementation

Pending A2 evidence. At minimum, the control tower must decide the bundle composition boundary,
Router-to-page reuse mechanism, whether the seven-method contract remains unchanged, exact allowed
files, phase-specific test files/harness, and browser/manual acceptance surface.

## Independent review checklist

- [x] A0 exact baseline and absence checks passed before creation.
- [x] A0 minimum automated gates passed with actual evidence.
- [ ] A1 Task Brief-only commit, push, Draft PR, and exact-head CI recorded.
- [ ] A2 required call graphs and matrices completed from read-only evidence.
- [ ] A2 diff remains Task Brief only and implementation remains unstarted.
- [ ] Final A2 gates, commit, push, Draft PR update, and exact-head CI recorded.
- [ ] Worktree clean, local/upstream `0/0`, PR diff Task Brief only.

## Completion evidence

### A0

- Completed at starting baseline `66cdc2c457457a93bec46fdf98c5a508c96770c9`.
- All local/remote safety checks and baseline gates passed as recorded above.

### A1

Pending.

### A2

Pending read-only investigation. Implementation has not started.
