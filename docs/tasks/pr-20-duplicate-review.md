# PR-20: Duplicate Review

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M17 / PR-20 |
| Status | A3 contract frozen; implementation authorized within literal allowlist |
| Branch | `codex/v2/duplicate-review` |
| Base | `integration/v2` at `a686b19a6f2ab6ecb2c724cc940db3ab5c09eafe` |
| Draft PR title | `feat(v2): add duplicate review workflow` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Investigate and, only after explicit approval of every material contract, implement the PR-20
Duplicate Review workflow described by the product PRD and development plan. Possible or fuzzy
duplicates may become review candidates, but PR-20 always keeps them as two intact Canonical
activities, including after the user records that they are the same activity. PR-19's four exact
identities continue to use the existing Exact Identity Resolver and must not be changed, weakened,
rescored, or routed through fuzzy review.

The planned user surface includes candidate review, an explainable confidence/category,
side-by-side comparison, Confirm same activity, Keep separate, Later, and a durable audit record.
The A3 decision record below freezes the algorithms, thresholds, persistence, review-only decision
semantics, rollback, Source Manager surface, and narrow runtime API needed by this PR. It does not
authorize source/field preference, stream handling, activity coalescing, hiding, deletion, or
Unmerge.

PR-20 does not start PR-21 backup/restore, PR-22 diagnostics/performance, PR-23 default switching,
Service Worker work, deployment, release, merge, cleanup, or a broad UI redesign.

## A0 exact baseline evidence

- The assigned worktree began clean and detached at exact SHA
  `a686b19a6f2ab6ecb2c724cc940db3ab5c09eafe`; local `integration/v2` and
  `origin/integration/v2` resolved to the same SHA.
- The base is the merged PR-19 commit `feat(v2): add exact identity resolver (#25)`, so the exact
  identity dependency is present before PR-20 begins.
- The protected long-lived branches were not modified. The feature branch
  `codex/v2/duplicate-review` was created at the exact base in this isolated worktree.
- Untouched-base gates passed: `npm ci`; syntax for 211 files; privacy; full suite 1,363/1,363;
  and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, health or power value, account, Token,
  Authorization value, export, screenshot, private fixture, user profile, or user browser state
  was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open
a Draft PR targeting `integration/v2` before investigation results or implementation are
committed. GitHub writes are delegated to the control tower; the user's browser login and Chrome
profile are prohibited. Draft remains Draft through implementation, independent review, and
Closure. Ready is a later control-tower operation and is never merge authorization.

## Authority and inherited frozen contracts

Conflict order is accepted ADRs, product PRD, engineering plan and release gates, this Task Brief,
then implementation details. The investigation must preserve these already-frozen boundaries:

- PR-19 exact source ID, provider/external ID, committed RawArtifact SHA-256, and trusted FIT
  session/file identity continue to link exactly and atomically; PR-20 does not alter that resolver;
- fuzzy or possible similarity never authorizes automatic merge, source association, Canonical
  replacement, stream replacement, deletion, or analysis change;
- Canonical, ImportedActivityBundle, RawArtifact, ActivitySource, Import, Storage, Source Manager,
  Repository, Demo, Legacy, default-mode, disconnect, and rollback contracts remain unchanged
  unless a material decision explicitly authorizes the minimum necessary change;
- activity IDs remain non-empty opaque strings and are never numerically parsed, compared,
  synthesized from arithmetic, or defaulted; missing, absent, `null`, and real zero are distinct;
- RawArtifacts, ActivitySources, Import logs, Canonical data, and Legacy data are never deleted or
  overwritten as candidate, merge, rejection, rollback, or error recovery;
- every confirmed action must preserve full provenance, an explainable decision, and a
  non-destructive recovery path before it can be implemented;
- errors, DOM, logs, reports, evidence, review findings, and PR prose must not expose raw IDs,
  hashes, filenames, routes, payloads, causes, Tokens, Authorization values, or private activity
  content.

## Investigation gate

The read-only investigation must produce:

1. the current served Source Manager/Import Report call graph and the narrowest viable Duplicate
   Review composition boundary;
2. current Canonical, ImportedActivityBundle, RawArtifact, ActivitySource, ImportItem/ImportJob,
   ImportStore, Exact Identity Resolver, Storage, Source Manager, and Repository contracts;
3. existing indexes, transactions, candidate/decision storage capability, merge/reversal
   capability, and data-preservation limits;
4. the PRD-versus-development-plan gap for P0/P1, candidate status, confidence/category, Confirm,
   Keep separate, Later, audit, merge, and reversibility;
5. evidence-backed A/B/C options for candidate discovery, persistence, decision application, and
   rollback, including complexity/benchmark evidence where algorithmic or index choices are
   material;
6. false-positive defenses, cross-sport policy, missing-value behavior, deterministic tie-breaks,
   re-review/retry/idempotency/concurrency behavior, and candidate lifecycle;
7. the smallest literal cumulative path allowlist, focused/failure-first test matrix, actual
   served browser evidence plan, privacy impact, migration impact, and code rollback limits.

## Decisions required before implementation

No value below is Accepted by this initial brief. Any material ambiguity must be packaged with
authority citations, call-graph evidence, options, risks, reversibility, tests, and a recommended
choice, then delegated to the control tower while production and test implementation remain
untouched:

- candidate comparison fields, weights, thresholds, confidence values/categories, tie-breaks,
  candidate ordering, cross-sport matching, time window, distance/duration tolerance, missing data,
  and suppression/reappearance rules;
- whether and where MergeCandidate and MergeDecision persist, their exact schema/index/version,
  status lifecycle, retention, uniqueness, concurrency, and import/report association;
- route, public API, Repository/Storage boundary, Source Manager/Import Report integration, review
  UI copy/DOM, pagination, and refresh behavior;
- exact effects of Confirm same activity and Keep separate, including Canonical identity,
  ActivitySource ownership, summary/metadata source preference, streams/laps/events/devices,
  analysis invalidation, audit evidence, and idempotent replay;
- the contradiction between the development plan deferring field-level merge and Unmerge, PRD
  classifying fuzzy review/reversible merge as P1, and PRD P0/state/release language that still
  requires review suggestions and reversible merge behavior;
- the non-destructive reversal available in PR-20 if a confirmed merge changes durable data. If
  the current model cannot make Confirm fully reversible without new schema or a later PR, the
  task must pause rather than implement an irreversible approximation;
- any new schema, store, index, physical version, migration, public API, Canonical contract,
  analysis algorithm, production dependency, provider/auth lifecycle, delete/disconnect behavior,
  or path outside the later approved literal allowlist.

This section records the initial gate. It was resolved only by the exact A3 approvals and frozen
contract below; it is not an open-ended authorization to fill later gaps by implementation choice.

## A2 evidence and A3 approval record

The read-only investigation established the following implementation boundaries:

- the actual call graph is `source-manager.html` -> `js/source-manager.js` -> the Source Manager
  composition root -> ImportService/ImportStore -> decode and normalize -> matching -> one
  `persistImportItem` transaction -> PR-19 exact identity lookup -> exact link or unmatched
  Canonical write -> safe public Import report -> Import Log;
- the only race-safe candidate insertion point is after the PR-19 resolver returns `unmatched` and
  before the same readwrite transaction commits the new Canonical graph, RawArtifact, ImportItem,
  ImportJob, and candidate records;
- physical V3 contains eleven stores and no candidate, decision, alias, presentation suppression,
  field preference, merge snapshot, or reversal representation;
- the existing `activities.bySportCategoryAndStartTimeUtc` index supports a transaction-current,
  same-sport bounded time query. A deterministic synthetic offline benchmark measured 1,000
  queries over 10,000 summaries at 177.7 ms with that index versus 23,021.9 ms and 10,000,000
  materialized rows with full `getAll`; it is query-shape evidence, not an accuracy claim;
- no accepted route-summary or numeric heart-rate/power coverage representation exists in the
  Canonical contract, while source, device, lap, and capability-presence facts can be loaded safely;
- PRD P1 and the development-plan deferrals make a real merge/Unmerge broader than PR-20, while
  release gates require every fuzzy similarity to remain review-only and never auto-merge.

The decision owner approved the main material package verbatim:

> 批准 M17 A3：按推荐的 Review-only Option A、双区间 Algorithm B、physical V4、嵌入式 Source Manager 与 29 路径上限冻结实施。

The decision owner then approved the only missing percentage formula verbatim:

> 批准 M17 A3 百分比公式：距离和 moving duration 均采用对称 max-denominator；双零为 0%，正数与零为 100%，负数/缺失/null/非有限值不参与候选，阈值边界含等号。

Independent review exposed two contract collisions. The decision owner approved the A3.1
clarification verbatim:

> 批准 M17 A3.1：采用 R-A，Import report 始终包含 reviewRequired（含 0），在 29 路径内以 tests/import/strava-zip.test.js 替换未使用的 indexeddb-v2-boundaries.test.js；采用 U-A，使用固定 provider-family 标签及脱敏设备数量标签，不暴露原始 provider/model。

No implementation inference may expand those approvals. The frozen contract is:

### Review-only product and lifecycle contract

- Candidate discovery runs only after the unchanged PR-19 exact resolver returns `unmatched`.
  Every exact match retains PR-19 behavior and performs no fuzzy query or candidate write.
- Similarity never automatically merges, links a source, replaces a graph or stream, hides an
  activity, changes Repository reads, or changes analysis. The incoming and existing Canonical
  graphs and all provenance remain byte-for-byte durable.
- `Confirm same activity` appends a `confirmed_same` identity-intent decision and moves only the
  candidate status from `review_required` to `confirmed_same`. The UI must state that both
  activities remain in the library until a future separately approved reversible merge exists.
- `Keep separate` appends a `rejected` decision and moves only the candidate status to `rejected`.
  `Later` performs no durable write. Repeating the same terminal decision returns the existing
  decision; a different, stale, or concurrent terminal decision fails atomically with a stable
  redacted conflict.
- There is no field selection, source preference, primary/secondary activity, alias, suppression,
  merge, Unmerge, or decision deletion/update in PR-20. Candidate and decision audit rows are
  retained. Undo requires a future approved additive contract; PR-20 recovery is the absence of
  destructive activity changes, not a simulated Unmerge.

### Candidate algorithm and false-positive contract

- The compared CanonicalActivity fields are exactly `sportCategory`, `startTimeUtc`,
  `distanceMeters`, and `movingTimeSeconds`. The sport categories must be identical. Cross-sport
  pairs are ineligible.
- Both activities must have a strict UTC start instant and present, finite, non-negative distance
  and moving duration. Missing, absent, `null`, non-finite, or negative values are ineligible and
  are never coerced to zero. Activity IDs remain opaque strings and are only compared with
  code-unit string ordering; they are never parsed or numerically converted.
- `timeDeltaSeconds = abs(Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc)) / 1000`.
  For distance and moving duration, `deltaRatio(a,b) = 0` when both values are exactly zero;
  otherwise it is `abs(a-b) / max(abs(a), abs(b))`. A positive value versus zero is therefore
  `1` (100%).
- `high` requires all three inclusive gates: time <= 30 seconds, distance ratio <= 0.01, and
  moving-duration ratio <= 0.01. Otherwise `possible` requires all three inclusive gates: time
  <= 120 seconds, distance ratio <= 0.02, and moving-duration ratio <= 0.03. A pair outside any
  possible gate is not a candidate. Neither category changes activity data or authorizes merge.
- Candidate evidence is a frozen creation snapshot containing only confidence, the three safe
  deltas, the equal sport category, and `matcherVersion`; no raw activity ID, filename, hash,
  route, payload, provider external ID, cause, health value, power value, or credential enters a
  public DTO, DOM, log, error, report, or evidence artifact.
- Candidate ranking is `high` before `possible`, then lower time delta, then the ordered opaque
  activity-pair strings as code-unit tie-breaks. The stored pair is ordered by that same opaque
  code-unit comparison. No arithmetic, locale collation, or case folding is applied to IDs.
- At most 20 qualifying candidates may be created for one incoming activity. The bounded cursor
  may inspect only the existing same-sport +/-120-second index range and stops on the 21st
  qualifying row. That row causes stable redacted `CANDIDATE_LIMIT_EXCEEDED`; the transaction saves
  neither the new activity nor partial candidates and does not alter RawArtifact, ImportItem, or
  ImportJob progress. Full activity-store scans and cross-job/tab snapshots are prohibited.

### V4 storage, API, import, and UI contract

- IndexedDB advances additively to physical version 4 and schema ID `strava-stats-v2@4` with
  migration ID `schema-0004-duplicate-review`. V3 -> V4 creates `mergeCandidates` and
  `mergeDecisions` and rewrites no existing record. Upgrade abort leaves V3 retryable and intact.
  Successfully upgraded V2 data remains readable by V4-capable code; old V3 code returns
  `VERSION_UNSUPPORTED`. Legacy is a separate retained database and remains the application
  rollback path.
- `mergeCandidates` uses keyPath `id`; a unique `byActivityPair` index on
  `[activityAId, activityBId]`; and a non-unique `byStatusAndCreatedAt` index on
  `[status, createdAt]`. Its exact fields are `id`, `activityAId`, `activityBId`, `confidence`,
  `status`, `matcherVersion`, `createdAt`, `updatedAt`, `createdFromImportItemId`, and `evidence`.
  `status` is `review_required`, `confirmed_same`, or `rejected`.
- `mergeDecisions` uses keyPath `id` and non-unique `byCandidateId`. Its exact fields are `id`,
  `candidateId`, `decision`, `decidedAt`, and `decisionVersion`. Decisions are append-only;
  `decision` is `confirmed_same` or `rejected`. There is no `fieldChoices` placeholder.
- Candidate pair uniqueness makes repeated imports idempotent. IDs are opaque, generated values;
  the unique pair index, not a derived ID, is the concurrency authority. Candidate status update
  and decision append share one explicit readwrite transaction.
- ImportItem gains terminal `review_required`. An unmatched import with one or more new or existing
  review candidates commits normally but ends `review_required`; it remains a completed item for
  ImportJob progress. ImportService public report schema remains version 1 and always includes
  `totals.reviewRequired`, including zero, plus item outcome `review_required`; it never exposes
  candidate or activity IDs. `CANDIDATE_LIMIT_EXCEEDED` maps to the existing safe storage-failure
  path.
- ImportStore's returned runtime object may add bounded `listDuplicateReviewCandidates`,
  `getDuplicateReviewCandidate`, and `decideDuplicateReviewCandidate` methods for the composition
  root. The top-level Storage ES export names, five Repository exports, seven Repository methods,
  Import ES exports, CanonicalActivity and ImportedActivityBundle contracts remain unchanged.
- Duplicate Review is embedded in Source Manager; no new route is added. Real mode lists a bounded
  review queue and loads approved comparison details on demand. It shows start, sport, distance,
  moving duration, capability availability, provider-safe source labels/count, device-present and
  a redacted device-count label, and lap count. Provider-family labels are exactly `Strava`, `FIT
  file`, `TCX file`, `GPX file`, or `Local import`, deduplicated and code-unit sorted. Device labels
  are exactly `No device details`, `Recorded device`, or `N recorded devices`. Raw provider and
  model strings are never exposed. It omits route summary/geometry and numeric heart-rate/power
  coverage. DOM and accessible messages never expose IDs, hashes, filenames, routes, payloads,
  internal causes, or credentials.
- Demo mode exposes the section only as disabled/unavailable presentation and performs zero Real
  storage or provider I/O. Legacy/default feature selection, disconnect/delete separation, Source
  Manager import behavior, Canonical/Legacy rollback, and provider/auth boundaries are unchanged.

## A3 literal cumulative allowlist

The collision audit confirmed the following 29 paths as the hard cumulative maximum for A3,
implementation, verification, repair, and Closure:

```text
docs/tasks/pr-20-duplicate-review.md
docs/migrations/indexeddb-v2.md
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/transaction.js
js/storage/import-store.js
js/storage/duplicate-review.js
js/import/state-machine.js
js/import/import-service.js
js/app/source-manager.js
js/pages/source-manager/source-manager.js
source-manager.html
styles/source-manager.css
tests/storage/indexeddb-v2-schema.test.js
tests/import/strava-zip.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/storage/duplicate-review.test.js
tests/storage/duplicate-review-transactions.test.js
tests/storage/duplicate-review-boundaries.test.js
tests/storage/duplicate-review-performance.test.js
tests/import/import-state-machine.test.js
tests/import/import-core.test.js
tests/import/duplicate-review-import.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
```

The list may shrink but may not grow. Any thirtieth path, dependency, changed threshold/formula,
new store/index/version/API/export/Canonical field, standalone route, activity coalescing/hiding,
or Unmerge requires a new evidence-backed material approval before edit. Directory globs,
whole-tree manifests, and mutable whole-file hashes are prohibited. `js/storage/transaction.js` is
included only to let its existing bounded cursor selector inspect a row while stopping at the 21st
qualifying candidate; it does not authorize a general transaction API redesign.

## Prohibited paths and operations

Every path outside the A3 literal allowlist is prohibited. Throughout PR-20 the following remain
out of scope unless a new evidence-backed material decision explicitly says otherwise:

- `package.json`, lockfile, dependency, API/provider/auth, Service Worker, deployment, release,
  backup/restore, diagnostics, global default, Legacy database, delete/clear/downgrade, and user
  browser/profile changes;
- weakening or bypassing PR-19 exact resolution; using similarity for automatic merge; treating a
  missing value as zero; numeric conversion of opaque IDs; destructive Canonical/RawArtifact/
  provenance/Import/Legacy mutation;
- real credentials, provider network, private fixtures, real activity/route/health/power data,
  identifiable screenshots, external telemetry, merge, cleanup, deploy, release, or PR-21 start.

## Acceptance criteria to freeze at A3

The approved A3 record must turn each item into an observable test or explicit Not applicable
statement:

- PR-19 four-signal exact linkage is byte-for-byte behaviorally preserved;
- possible similarity creates at most a deterministic review candidate and never changes either
  Canonical graph before explicit confirmation;
- false-positive and boundary fixtures cover near-but-distinct activities, cross-sport cases,
  missing/null/zero values, opaque IDs, ties, retries, stale candidates, concurrent decisions,
  malformed stored data, and privacy-safe errors;
- Confirm/Keep separate/Later are deterministic, idempotent, explainable, atomic where applicable,
  and preserve all provenance and required rollback evidence;
- Legacy, Demo, Canonical/Legacy feature-flag rollback, Source Manager/Import behavior, public
  Repository, disconnect/delete separation, and local-only privacy boundaries remain safe;
- only deterministic synthetic offline fixtures are used; no private fixture or user browser
  profile is read;
- the actual served browser surface is exercised on an isolated same-origin origin if PR-20 owns a
  browser surface; source inspection, Node-only evidence, and `srcdoc` do not count as browser pass.

## Required checks

Baseline and final minimum gates are:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

A3 focused commands are `node --test tests/storage/duplicate-review.test.js`,
`node --test tests/storage/duplicate-review-transactions.test.js`,
`node --test tests/storage/duplicate-review-boundaries.test.js`,
`node --test tests/storage/duplicate-review-performance.test.js`,
`node --test tests/import/duplicate-review-import.test.js`, and the existing Source Manager,
schema, migration-boundary, state-machine, import-core, backup-manifest, and browser-smoke files
named in the allowlist. Final verification also requires a true depth-1 checkout at the exact
implementation/Closure head and exact-head CI. Unrun checks must be reported as `Not run` and never
presented as Pass.

## Rollback, migration, and privacy

The approved V4 migration is structural and additive only. Application rollback continues to
select Legacy through the existing feature flag and deletes nothing. V2 and Legacy databases
remain physically retained. Code rollback after a successful V4 upgrade requires V4-capable code;
old V3 code must fail safely with `VERSION_UNSUPPORTED` and must not downgrade, clear, or rewrite
the database. A failed upgrade transaction leaves V3 intact and retryable.

Privacy impact is local persistence of redacted candidate difference snapshots and identity-intent
audit decisions. Evidence remains deterministic, synthetic, offline, local-only, and redacted. No
new telemetry, provider request, credential, real athlete input, precise route output, health/power
value, or external data flow is authorized.

## Independent review and Closure

After implementation, an independent findings-first reviewer must inspect the complete approved
diff and tests. Every finding is reproduced failure-first where feasible, repaired, and followed
by a fresh independent re-review. The final Task Brief-only Closure commit records exact paths and
contracts, false-positive defenses, reversibility, tests, browser evidence, privacy, migration,
rollback, commit/PR/CI state, clean worktree/index counts, and every `Not run` item. The control
tower owns the final Ready transition; Ready is not merge authorization.
