# PR-22: Diagnostics and Performance

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M19 / PR-22 |
| Status | Final Review Closure complete; awaiting exact-head CI and Ready handoff |
| Branch | `codex/v2/diagnostics-performance` |
| Base | `integration/v2` at `964e88d2cad0bbbfe2139f8b9d46a847199980e1` |
| Draft PR title | `feat(v2): add diagnostics and performance gates` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Investigate and, only after explicit approval of every material contract, implement the PR-22
Diagnostics and performance scope from the product PRD and V2 development plan. The result must
provide a privacy-safe local Diagnostics workflow, observable import and page failures, honest
Storage Estimate behavior, display-only Stream downsampling, and deterministic performance gates
for the required large synthetic workloads.

The implementation must make failures diagnosable without disclosing private athlete data and must
keep large workloads bounded, cancellable where the existing Import contract promises
cancellation, and responsive enough to meet the approved performance budgets. Stream optimization
must not mutate Canonical or Repository records, persisted Streams, analysis inputs or formulas, or
their missing/null/zero semantics.

PR-22 does not switch the default Repository, begin PR-23, alter release or deployment behavior,
delete or rewrite any Legacy or V2 data, change backup/restore semantics, merge the branch, clean up
worktrees or branches, or broaden the product into telemetry or remote diagnostics.

## A0 exact baseline evidence

- The assigned isolated worktree began clean and detached at exact SHA
  `964e88d2cad0bbbfe2139f8b9d46a847199980e1`. Local `integration/v2`,
  `origin/integration/v2`, the fetched remote head, and this worktree HEAD resolved to the same SHA
  with local/origin divergence `0/0`.
- The protected source worktree on `main` and locked long-lived worktree on `integration/v2` were
  inspected read-only and were clean. Neither was modified.
- GitHub PR #27, `feat(v2): add full backup and restore`, was verified `MERGED`; its merge commit is
  exactly `964e88d2cad0bbbfe2139f8b9d46a847199980e1`, so the required PR-21 state is present.
- No local or remote branch named `codex/v2/diagnostics-performance` existed before branch
  creation. The feature branch was created from the exact base in this isolated worktree.
- Untouched-base gates passed: `npm ci`; syntax for 226 files; privacy; full suite 1,411/1,411; and
  `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, heart-rate or power value, account, Token,
  Authorization value, export, screenshot, private fixture, user profile, or user browser state was
  read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before investigation results or implementation are committed.
GitHub App write failures are delegated directly to the control tower without using the user's
Chrome login or profile. The PR remains Draft throughout implementation, independent review, and
Final Review Closure. A later Ready transition is a control-tower operation and is never merge
authorization.

## Authority and inherited frozen contracts

Conflict order is accepted ADRs, the product PRD, engineering plan and release gates, this Task
Brief, then implementation details. Proposed ADRs and historical conversations are evidence only
and do not freeze an undecided contract. PR-22 must preserve these inherited boundaries:

- Legacy remains the default and recoverable path until a separately approved switch. Legacy
  IndexedDB, localStorage, Cache Storage, provider connection, and tokens are not migration or
  diagnostics cleanup targets.
- Physical V4, its thirteen stores and indexes, migrations, Repository and Canonical public
  contracts, Import public API and persistence semantics, and PR-21 backup/restore are frozen.
- Activity and relation identifiers are non-empty opaque strings and are never logged, parsed,
  normalized, arithmetically coerced, truncated into pseudo-identifiers, or used as diagnostic
  correlation values.
- Missing or absent values, `null`, real zero, and negative zero remain distinct wherever the
  current contract distinguishes them.
- Diagnostics exports, durable error records, the DOM, console output, tests, evidence, and PR prose
  may never include Tokens, Authorization data, raw causes or payloads, raw filenames or paths,
  activity IDs, GPS/route coordinates, heart-rate or power values/series, device serials, athlete
  names, private settings, or user-owned analysis values.
- Stream downsampling may affect only an explicitly approved presentation boundary. It may not
  silently change Canonical or Repository data, stored Stream records, backup bytes, import
  identity, duplicate detection, analysis inputs or formulas, or public data semantics.
- No new production dependency, public API, physical schema/store/index/version, migration,
  Service Worker behavior, deployment, release, provider/auth flow, telemetry upload, or remote
  endpoint is allowed without separate material approval.

## Authoritative required scope

The engineering plan requires Diagnostics export, Storage Estimate, Import performance records,
page error records, Stream downsampling, and large-scale activity performance tests. Its
performance matrix requires explicit coverage of:

```text
5,000 activities
10,000 activities
1,000 FIT batch
200,000-point activity
Multiple simultaneous imports
Worker cancellation
IndexedDB quota pressure
```

The product PRD additionally requires:

- 5,000 activity summaries queried within one second on a representative desktop;
- Activities first render within 1.5 seconds;
- one normal FIT import to show continuing progress without an obvious main-thread freeze;
- a 1,000-file import to be cancellable, recoverable, and committed per file;
- a 200,000-point Stream to be downsampled rather than fully plotted;
- page main-thread long tasks to remain near or below 100 ms per task;
- detail Streams to be loaded on demand rather than at application startup;
- zero uncaught page exceptions and default-local observability for Import Job/Item state, decoder,
  database, analysis, migration, and recent page errors;
- exported diagnostics to exclude private data by default and raw activity data never to be sent to
  a server.

These requirements define investigation targets, not yet-approved implementation contracts or
claims. Performance thresholds must be tied to a reproducible environment and measurement method
before they can become gates.

## A2 read-only investigation gate

Before any production or test implementation change, an evidence package must establish:

1. all current error creation, mapping, rendering, console, window/unhandled rejection, Import
   report, job/item audit, analysis failure, migration failure, and backup failure paths, including
   what is already safely redacted and what is not recorded;
2. every existing diagnostics-like surface, page entry, navigation seam, storage/backup page seam,
   export/download helper, and local durable-setting boundary;
3. the current Import timing and progress call graph from preflight through queue, worker parse,
   normalization, identity, transaction commit, report projection, cancellation, resume, and close;
4. worker and inline-worker scheduling, transfer/copy behavior, concurrency, cancellation timing,
   late-result handling, partial failure behavior, and any main-thread parser fallback;
5. all uses of `navigator.storage.estimate`, browser support/denial/error behavior, quota/usage
   meaning and precision, persistence implications, and a truthful unsupported/degraded UI state;
6. every Stream path from physical storage and Repository reads through analysis and chart adapters,
   including requested Stream types, copies/projections, chart library input, point ordering,
   missing values, extrema, gaps, and whether any consumer mutates its input;
7. exact current algorithms and complexity for activity summary queries, Activities preprocessing
   and render, 1,000-artifact queueing, concurrent imports, 200,000-point charts, and quota mapping;
8. deterministic synthetic benchmarks comparing plausible downsampling and scheduling candidates,
   including runtime, allocation/point-count amplification, preserved endpoint/extrema/gap behavior,
   worst-case complexity, cancellation latency, and sensitivity to input order;
9. whether the required Diagnostics/error/import records can reuse an existing store or setting
   without violating its contract. A new store, index, schema version, public API, or retention
   mechanism is material and remains blocked pending approval;
10. the smallest collision-free literal cumulative path allowlist, failure-first test matrix,
    disposable-profile served-browser evidence plan, privacy proof, migration impact, and rollback
    limits.

The evidence must prove both presence and absence. No candidate algorithm, format, field, retention
policy, error persistence model, metric storage location, or UI surface is accepted merely because
it is convenient or appears in proposed text.

## A2 material decision package and A3 freeze

The A2 package must present evidence-backed A/B/C options, a recommendation, explicit tradeoffs,
failure behavior, privacy impact, migration and rollback impact, and the proposed exact path
allowlist for each material topic:

1. Diagnostics export format, safe field allowlist, version, creation semantics, maximum size,
   ordering, retention, and whether it contains only a snapshot or also retained events.
2. Recent page-error record schema, safe fixed codes/categories, in-memory versus durable storage,
   retention count/time, reload behavior, deduplication, capture points, and unavailable-storage
   behavior.
3. Import performance metric names and units, start/end boundaries, aggregation, clock semantics,
   per-job versus per-item granularity, storage location and retention, concurrency interpretation,
   and cancellation/failure accounting.
4. Storage Estimate browser semantics, rounding, labels, refresh behavior, unsupported/permission
   error states, and prohibition on presenting estimates as exact or app-exclusive bytes unless
   evidence proves that claim.
5. Stream downsampling algorithm, threshold, target point count, gap and extrema behavior,
   deterministic ordering, chart integration seam, and proof that only presentation is affected.
6. Performance harness environment, warmup/repetition policy, percentile/threshold rules, flake
   handling, synthetic dataset shape, CI versus browser responsibility, and evidence artifacts.
7. Any public API, schema, dependency, Worker, Service Worker, deployment, or release change that
   A2 shows is necessary.

The control tower must return an explicit accepted option and exact contract before implementation.
After approval, this Task Brief records the accepted contract verbatim enough to audit it and
freezes a literal exact cumulative path allowlist. A next path, future-hostile boundary collision,
or contract gap pauses implementation for the smallest possible supplemental decision. No
implementation begins while any required material decision is open.

## A3, A3.1 and A3.2 approved contracts

The user approved the default A3 package verbatim with `批准 M19 A3 默认方案`, approved the Import
collision supplement verbatim with `批准 M19 A3.1 默认 S1–S4 方案`, and approved the persistence
cancellation supplement verbatim with `批准 M19 A3.2 S5-A`. These approvals freeze the following
implementation contracts.

### Diagnostics export and recent errors

- Export is an explicit-click-only, standalone, deterministic, versioned JSON snapshot with MIME
  `application/vnd.stravastats.diagnostics+json;version=1`, fixed field ordering, and an exact
  256 KiB UTF-8 hard cap. It contains only approved closed codes and safe aggregates, session error
  and Import performance aggregates, and a rounded Storage Estimate. Oldest bounded records are
  removed first when necessary and only omitted counts are exposed. It is never restore-compatible.
- Export, DOM, console, tests, and session records exclude IDs, filenames, paths, URLs and queries,
  Tokens, Authorization, settings values, user agent or fingerprints, raw messages, stacks, causes,
  payloads, activity or Stream data, route coordinates, heart-rate, power, device or athlete data,
  user-owned analysis values, and backup bytes.
- Recent errors use `sessionStorage` for the current tab/session, with a bounded in-memory fallback.
  At most 20 records are retained; adjacent identical records coalesce. The exact record is
  `{version:1, occurredAt, page, category, code, count}`. Page, category and code are closed enums;
  `occurredAt` is ISO time and `count` is an integer. There is no TTL or automatic deletion and the
  records are excluded from backup.
- Handled V2 entry failures record only a selected fixed code. Global `error` and
  `unhandledrejection` listeners record category-only events, never inspect the event error, reason,
  message or filename, and never call `preventDefault`. Diagnostics never reads console, DOM
  datasets, arbitrary `window` state or raw caught objects.

### Import performance, batching, cancellation and quota

- One safe `sessionStorage` performance aggregate represents one user selection, with at most 50
  records and an in-memory fallback. It uses a monotonic clock and only the frozen fields: version,
  fixed outcome, artifact count, fixed terminal counts, total milliseconds, fixed stage
  milliseconds, decoder sum/maximum, persistence sum/maximum, cancellation-observed milliseconds
  or `null`, and peak Worker requests. It contains no identifiers, names, formats, paths, hashes,
  sizes, timestamps beyond array order, raw errors, private values or per-item records.
- The internal, non-index-exported recorder seam lives in
  `js/diagnostics/import-performance.js`. `js/source-manager.js` configures its session sink and
  monotonic clock. `js/import/import-service.js` emits fixed timing events without changing
  `createImportService` options, `js/import/index.js`, the public Import report or handle, Repository,
  schema, backup, Worker messages or Worker protocol.
- The 1,000-file batching contract applies to ordinary FIT, TCX and GPX local files. Deterministic
  ordinary-file chunks contain at most 25 files and at most 32 MiB selected input. The existing
  16 MiB per-file limit remains. The exact total selected-input ceiling is 256 MiB.
- CSV and ZIP behavior and accepted limits remain unchanged. Each selected CSV or ZIP is a
  singleton container job outside the ordinary-file 32 MiB chunk budget. Existing container
  expansion limits remain 10,000 entries and 256 MiB. Evidence may claim the 1,000 FIT workload is
  bounded; it must not claim a general bound on CSV or ZIP expansion memory.
- One user selection is a transient batch that sequentially creates existing durable Import Jobs,
  with at most one active UI job and the existing single shared Worker. Completed chunks remain
  durable and appear as the existing per-job Import Log. A cancellation request latches before
  awaiting the current job, requests cancellation of that job, and creates no later jobs. Later
  files are transient `not started`, never durable cancelled Import Items. Reselection recovers by
  the existing exact-duplicate path.
- A page-local closed `SELECTION_TOO_LARGE` code has exact copy
  `Select files totaling no more than 256 MiB.` and is not added to public Import errors or reports.
- Internal cancellation checkpoints occur between items in validation, hashing, decoding,
  normalization, matching and before persistence scheduling. They never abort an in-flight Worker
  message or transaction and never change the Worker protocol. Quota stops future scheduling,
  preserves earlier commits, projects only safe code/count, best-effort terminalizes, and never
  evicts, deletes or cleans data. Four direct concurrent-job tests prove isolation and atomicity,
  not parallel speedup.
- Cancellation may latch while one `persistImportItem` transaction is in flight. The transaction is
  never aborted or compensated. Immediately after it returns, the existing atomic
  `cancelImportJob` transaction preserves committed terminal items, changes only unfinished items
  to `cancelled`, changes the durable job from `persisting` to `cancelled`, and prevents every later
  persistence or chunk schedule. No other storage or state transition changes.

### Storage Estimate and presentation-only Stream reduction

- Diagnostics requests `navigator.storage.estimate()` only on page load and explicit Refresh.
  Labels are exactly `Estimated origin storage use`, `Estimated origin storage quota`, and
  `Estimated origin storage headroom`. Values are rounded to MiB and percent to at most one decimal
  and are explicitly described as coarse, origin-wide and not guaranteed. Missing support is
  `unsupported`; rejection or malformed/nonfinite results are `unavailable`; zero quota avoids
  division; headroom is `max(quota - usage, 0)`. No `usageDetails`, `persist()`, inferred V2 size,
  import-success promise, or database creation/upgrade is allowed.
- Stream reduction is presentation-only aligned critical-index min/max bucket selection after
  full-resolution derivation or smoothing and immediately before Chart or Leaflet construction.
  Inputs of at most 2,000 points are unchanged. Larger chart output is at most 1,000 points; map
  output and layers are at most 2,000.
- Selection preserves first/last, deterministic first-occurring per-series bucket extrema, global
  extrema, one positive-zero and negative-zero anchor when present, a null marker and adjacent
  finite boundaries for each null run, strictly increasing original indices, duplicate-offset
  order and missing-series omission. Smoothing-dependent charts reapply the original gap mask.
  Mandatory anchors beyond the cap produce a stable bounded `too fragmented to plot` state and
  never a full-data fallback.
- Canonical, Repository, persistence, backup, public APIs, formulas, Advanced Analysis and Run Plus
  retain full-resolution inputs and unchanged missing, `null`, zero and negative-zero semantics.

### Performance and privacy gates

- The deterministic Node Stream gate uses 200,000 points, at most six aligned series, target 1,000,
  ten warmups and thirty samples; p95 is at most 25 ms and no sample exceeds 50 ms, in addition to
  semantic, cap and immutability assertions.
- The 1,000 FIT direct-service gates make correctness, per-file atomicity, cancellation and quota
  hard requirements and record median/p95 without an absolute throughput budget.
- Actual-served disposable-browser gates use five repetitions: cold 5,000-activity Repository
  envelope p95 at most 1,000 ms and Activities second-`requestAnimationFrame` p95 at most 1,500 ms.
  The 10,000 workload is mandatory and record-only. The 200,000-point detail has chart input at most
  1,000, map input/layers at most 2,000, zero uncaught errors, maximum observed post-seed long task
  below 100 ms, and application startup `getStreams` calls exactly zero.
- Browser evidence records runtime/browser/hardware, external-resource baseline, warmups, samples,
  median/p95/maximum, exceptions, long tasks, Worker and storage behavior honestly. Hard adapter
  assertions use deterministic recording stubs. CDN pinning or vendoring is prohibited.
- Raw Error or private-value logging is removed only from paths PR-22 newly touches or exercises.
  Diagnostics never ingests console, DOM or arbitrary window state. Untouched inherited disclosure
  risks remain documented release blockers rather than a repo-wide cleanup.
- No production dependency, public API, physical schema/store/index/version, migration, backup
  format, Repository contract, Worker protocol, Service Worker, deployment, release, provider/auth
  route, CDN pin/vendor or default Repository change is authorized.

## A3 exact cumulative path allowlist

The collision audit found no further material boundary after the A3.1 supplement. A later pure-test
collision added only `tests/import/strava-zip.test.js` under delegated control-tower authority so
the inherited quota regression can assert the approved stop-scheduling behavior. Fresh independent
review then proved persistence cancellation required the existing state-machine and Import Store
transaction boundaries; A3.2 S5-A added exactly those two production paths and one direct state-
machine test path. The following 46 paths are the literal hard maximum for every implementation,
test, repair and closure change in PR-22. A path not listed here requires a supplemental decision
before it is edited.

```text
docs/tasks/pr-22-diagnostics-performance.md
diagnostics.html
storage-backup.html
js/diagnostics.js
js/diagnostics/index.js
js/diagnostics/import-performance.js
js/pages/diagnostics/diagnostics.js
js/main.js
js/app/main.js
js/app/ui.js
js/source-manager.js
js/app/source-manager.js
js/pages/source-manager/source-manager.js
js/storage-backup.js
js/pages/storage-backup/storage-backup.js
js/pages/activity-router.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/pages/detail/stream-presentation.js
js/import/import-service.js
js/import/state-machine.js
js/storage/import-store.js
js/analysis/index.js
tests/diagnostics/diagnostics.test.js
tests/diagnostics/diagnostics-boundaries.test.js
tests/diagnostics/diagnostics-browser-smoke.html
tests/diagnostics/import-performance.test.js
tests/import/import-core.test.js
tests/import/import-performance.test.js
tests/import/import-state-machine.test.js
tests/import/strava-zip.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-performance-browser-smoke.html
tests/consumers/stream-presentation.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/performance/stream-performance.test.js
tests/performance/performance-browser-smoke.html
```

In particular, the allowlist excludes `package.json`, lockfiles, styles, `source-manager.html`,
`index.html`, every `js/storage/**` except the literal `js/storage/import-store.js`,
`js/repository/**`, `js/data/**`, `js/backup/**`,
`js/import/index.js`, Worker client/implementation and protocol paths, migrations, schema, Service
Worker, deploy/release, provider/auth, public API and dependency files. Existing synthetic
generators may be imported by tests but are not modified. Map tests use deterministic abstract,
non-identifying geometry that is never exported, logged or committed as a private fixture.

## Failure-first implementation and verification

- Work on one architectural risk surface at a time. Add a failing focused test before the minimal
  implementation or repair, then rerun the focused and relevant regression suites.
- Synthetic datasets are deterministic and contain no realistic identifiers, filenames, paths,
  GPS, route, heart-rate, power, account, token, credential, or private-setting values.
- Required large-data gates cover 5k and 10k activities, a 1k synthetic FIT batch, a 200k-point
  synthetic activity, multiple simultaneous imports, worker cancellation, and IndexedDB quota
  pressure. Measurements state the exact runtime, browser/runtime version, dataset shape, warmup,
  sample count, statistic, and threshold.
- Actual-served browser evidence uses a disposable browser profile and proves Diagnostics UI and
  export, safe redaction, Storage Estimate success and degraded behavior, page-error handling, and
  the approved large-data responsiveness boundaries. It records the baseline external-resource
  behavior honestly and uses no user profile, credentials, provider network, or private data.
- Browser evidence must distinguish actual browser facts from harness or source assertions and
  must record runtime exceptions, console disclosure, provider/auth requests, Cache Storage,
  Service Worker, and local database effects.
- Run focused tests, relevant regressions, full `npm test`, `npm run check:syntax`,
  `npm run check:privacy`, and `git diff --check` at the implementation head.
- Reproduce the exact implementation head in a fresh depth-1 checkout and rerun install, syntax,
  privacy, full tests, and diff check there. No network, Strava credentials, or private fixtures may
  be required by tests.
- Conduct a genuinely independent findings-first review after implementation. Every actionable
  finding receives a failure-first regression and minimal repair. A fresh independent re-review
  must report no actionable findings.

## Closure and authorization boundaries

### Final Review Closure evidence

The closed implementation head is `7a51ee4fab13b193f03d20365bf984ef3c5a1ad6` on
`codex/v2/diagnostics-performance`, with exact merge base
`964e88d2cad0bbbfe2139f8b9d46a847199980e1`. The worktree was clean at closure.
The diff contains exactly 44 of the 46 approved paths and no path outside the literal allowlist:

```text
diagnostics.html
docs/tasks/pr-22-diagnostics-performance.md
js/analysis/index.js
js/app/main.js
js/app/ui.js
js/diagnostics.js
js/diagnostics/import-performance.js
js/diagnostics/index.js
js/import/import-service.js
js/import/state-machine.js
js/main.js
js/pages/activity-router.js
js/pages/activity/activity.js
js/pages/activity/index.js
js/pages/bike/bike.js
js/pages/bike/index.js
js/pages/detail/stream-presentation.js
js/pages/diagnostics/diagnostics.js
js/pages/run/index.js
js/pages/run/run.js
js/pages/source-manager/source-manager.js
js/pages/storage-backup/storage-backup.js
js/pages/swim/index.js
js/pages/swim/swim.js
js/source-manager.js
js/storage-backup.js
js/storage/import-store.js
storage-backup.html
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/stream-presentation.test.js
tests/diagnostics/diagnostics-boundaries.test.js
tests/diagnostics/diagnostics-browser-smoke.html
tests/diagnostics/diagnostics.test.js
tests/diagnostics/import-performance.test.js
tests/import/import-core.test.js
tests/import/import-performance.test.js
tests/import/import-state-machine.test.js
tests/import/strava-zip.test.js
tests/performance/performance-browser-smoke.html
tests/performance/stream-performance.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-performance-browser-smoke.html
tests/source-manager/source-manager.test.js
```

Failure-first and local evidence at the closed implementation head:

- Persistence cancellation first reproduced `INVALID_TRANSITION`; the approved A3.2 repair then
  proved one in-flight committed item is preserved, one unfinished item is cancelled, the durable
  job is cancelled and `persistImportItem` is called exactly once. A separate failure-first quota
  race reproduced `failed_storage` winning incorrectly; the repair now preserves the first safe
  `failed_storage` terminal item, cancels only the unfinished item, cancels the job, performs zero
  Canonical commit and makes exactly one persistence call.
- Final focused Import/state/ZIP coverage passed 48/48; storage transaction regressions passed 7/7.
  The deterministic 1,000 ordinary-FIT direct-service workload completed with descriptive
  median/p95 8,240.2 ms and no absolute throughput claim.
- The deterministic Node 200,000-point fresh-wrapper gate used ten warmups and thirty samples after
  the disclosed 20-second quiet period; fresh independent evidence recorded p95 9.142 ms and
  maximum 9.27 ms, within the 25/50 ms hard budgets, with semantic/cap/immutability assertions.
- `npm run check:syntax` passed 237 files; `npm run check:privacy` passed; the full suite passed
  1,451/1,451; and `git diff --check` passed.

Actual-served browser evidence used only deterministic synthetic data in an isolated Codex in-app
Chromium profile: Chrome 150 on macOS, reported hardware concurrency 10. The final isolated run
recorded 5,000-activity Canonical Repository median/p95 18.4/29.9 ms and Activities second-rAF
median/p95 557.7/852.8 ms across five repetitions. The mandatory record-only 10,000 workload was
56.0 ms Repository and 980.6 ms second-rAF. The 200,000-point workload recorded median/p95/maximum
14.4/30.7/30.7 ms, chart maximum 486, map maximum 1,585, 1,584 layers and maximum long task 0 ms;
startup `getStreams` was exactly zero. The actual Repository seam performed 76 page reads and six
initializations through the disclosed deterministic read-only paginated Canonical Store stub.
Recording stubs were exactly Chart, Leaflet and that Canonical Store.

The same final browser head passed the 1,000-file Source Manager plan with 40 jobs, zero eager
reads, 2.5 ms planning and zero Worker/storage writes; Diagnostics success/unsupported/unavailable
Storage Estimate states, two safe errors, one safe Import record and exact MIME exported 1,711
bytes; and all eleven detail gates including fragmented zero-Chart behavior. Every final page
recorded zero console entries, uncaught errors, unhandled rejections, external resources,
provider/auth requests and Service Worker/Cache changes, and zero IndexedDB count delta where
measured. One earlier performance run under concurrent review/clone load failed closed with
`ACTIVITIES_5K_P95`; after those workloads ended, the isolated five-repetition run above passed
without changing data, thresholds or implementation.

The final remote verification used a real GitHub shallow fetch and detached checkout at exact
`7a51ee4fab13b193f03d20365bf984ef3c5a1ad6`; `git rev-parse --is-shallow-repository` was `true`.
In that checkout, untouched `npm ci`, syntax for 237 files, privacy, the full 1,451-test suite,
`git diff --check` and clean status all passed. The incomplete earlier network clone and every
successful verification directory were retained; no cleanup was performed.

Independent findings-first review found and repaired five initial issues: cancellation after a
safe Worker failure, a tautological Repository/startup browser seam, write-denied performance
fallback, a cached rather than production-like Node benchmark, and silent fragmented Bike/Swim
charts. Later fresh reviews found and failure-first repaired persistence-stage cancellation and the
quota/cancellation race. A final reviewer uninvolved in implementation reviewed exact `7a51ee4`,
ran 75 focused Import/state/ZIP/source tests and 303 Diagnostics/detail/Stream/performance tests,
and reported verbatim: `fresh independent re-review: no actionable findings`.

There is no schema, store, index, version, migration, backup, public API, dependency, Worker
protocol, Service Worker, deployment, release, provider/auth or default-Repository change. Legacy,
V2 and backup data are neither deleted nor rewritten. Rollback is code-only: session diagnostics
are bounded ephemeral records, Stream reduction is presentation-only, and persistence cancellation
preserves committed terminal items without compensation. Contractual limitations remain explicit:
Storage Estimate is coarse and origin-wide; 10,000 activities and 1,000 FIT throughput are
record-only; browser Chart/Leaflet/Canonical Store boundaries are disclosed recording stubs; and
untouched inherited privacy risks remain release blockers outside this PR rather than being claimed
fixed.

Final Review Closure is a Task-Brief-only commit recording the frozen contract, exact changed
paths, implementation head, focused/full/depth/browser/performance/privacy evidence, independent
review findings and repairs, migration and rollback impact, and known limitations. After it is
pushed, exact-head CI must succeed before the control tower updates the PR body and marks the Draft
PR Ready.

Ready is not merge authorization. Completion stops at a clear Squash Merge authorization package
to the control tower. Merge, integration fast-forward verification, post-merge CI/regression,
branch or worktree cleanup, data deletion, deployment, release, default-canonical switching, and
PR-23 are separate authorization gates.

## Pause and blocker policy

Pause and send a minimal structured decision request directly to the control tower if work would
change a PRD P0 or release route; require a physical schema, public API, dependency, Worker or
Service Worker contract, algorithm semantics, real credentials/private data, production deploy or
release behavior; delete or overwrite data; merge; or clean up branches/worktrees.

For incidental blockers, read the failure and make the smallest reproduction. After the same
blocker occurs twice, change the evidence source. Only after three consecutive occurrences without
meaningful progress may the task be marked blocked, with the exact command, output, affected gate,
and required external action reported to the control tower.
