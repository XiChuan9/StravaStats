# PR-22: Diagnostics and Performance

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M19 / PR-22 |
| Status | A1 Task Brief; A2 read-only investigation pending |
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
