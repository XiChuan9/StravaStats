# PR-45: Source Manager Explicit Failed-Import Retry

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M33 / P0-RETRY Option A |
| Status | Complete material options frozen; awaiting owner selection; implementation blocked |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@1669d1636188184232d76b3c05305496d26ff313` |
| Exact base tree | `d62d29bee122ee2d9abcd76d805309564d91dbe9` |
| Feature branch | `codex/v2/source-manager-retry` |
| Product decision | Retain the PRD requirement and implement isolated explicit user Retry |
| Audit authority | PR #56 final audit Task Brief at `33db355c7e3e7a27ba40d726594750dd99535b5d` |
| Pull request | [#57](https://github.com/XiChuan9/StravaStats/pull/57), OPEN/Draft |

## Authority and sequence

The owner selected P0-RETRY Option A: retain the PRD requirement and implement a bounded explicit
failed-job Retry. The delegated implementation is limited to the literal candidate allowlist and
the product contract actually frozen in PR #56's final audit Task Brief. This Task Brief does not
infer missing API, state-machine, copy, error-code, or durable-operation decisions.

The required sequence is:

1. independently verify the exact base, tree, clean state, remotes, and baseline gates;
2. make this Task Brief the only path in the first commit and open a Draft PR against
   `integration/v2`;
3. revalidate the audit's literal allowlist, behavior, privacy, data, rollback, and verification
   contract against the current tree; and
4. stop before implementation if an exact executable contract is absent or ambiguous.

Draft-to-Ready is authorized only after implementation, all required checks, genuinely independent
findings-first review, fresh no-findings re-review, exact remote-head verification, and exact-head
CI all pass. Ready is not merge authorization.

## Exact-base evidence

The isolated worktree began clean and detached at exact commit
`1669d1636188184232d76b3c05305496d26ff313`, tree
`d62d29bee122ee2d9abcd76d805309564d91dbe9`. A refreshed `origin/integration/v2`
resolved to the same commit and tree, with local/origin divergence `0/0`. The refreshed audit branch
resolved to `33db355c7e3e7a27ba40d726594750dd99535b5d`. `origin` is
`https://github.com/XiChuan9/StravaStats.git`; upstream push remains disabled. The exact suggested
feature branch was absent locally, absent from the remote-tracking refs, and absent from the live
remote before creation.

Executed directly on the exact base:

```text
npm ci                       PASS; 6 packages
npm run check:syntax         PASS; 283 files
npm run check:privacy        PASS
npm test                     PASS; 1,897/1,897
git diff --check             PASS
```

GitHub CLI 2.96.0 is installed, but its configured GitHub credential is invalid. No user browser or
profile may be used to repair authentication. Draft publication must use an available repository
connector or stop as blocked.

The Task-Brief-only first commit is
`121ce2d9e726f274ea3f57d355990b1ba4e1deb5`. Its exact diff is this one new path. The GitHub
repository connector created [Draft PR #57](https://github.com/XiChuan9/StravaStats/pull/57) with
base `integration/v2@1669d1636188184232d76b3c05305496d26ff313` and initial head
`121ce2d9e726f274ea3f57d355990b1ba4e1deb5`. Readback reported OPEN, Draft, unmerged, one commit,
one changed file, and no requested reviewers. PR #56 and historical PR #31 were not modified.

## Audit-frozen Option-A behavior

The final audit records these exact P0 facts and boundaries:

- PRD sections 4.1, 7.1, 8.3, 13.4, and 13.5 retain user-visible failed-import Retry as a P0.
- ImportService already implements and tests programmatic `retryJob`; the real Source Manager
  facade/page does not expose or invoke it.
- The target terminal ImportJob states are exactly `failed_validation`, `failed_decode`, and
  `failed_storage`.
- Retry is explicit user action only. It never runs automatically, at startup, on reload, after a
  crash, from observation, or in the background.
- Retry reuses persisted pending bytes only, preserves completed/committed items, does not read a
  provider, and keeps Demo zero-capability.
- It operates under the same C4 exclusive Web Lock, durable SourceOperation lease/revision CAS,
  heartbeat, cancellation, and no-steal rules.
- Existing normally terminal failed linked jobs remain distinct from C4 stale nonterminal recovery;
  C4's Recover/Abandon crash-gap is not a substitute for failed-job Retry.
- Legacy, Shadow, Canonical, local/provider, persistence-selection, schema V6, Backup format 3,
  public Import/Storage/Repository APIs, dependencies, Worker protocol, and Service Worker contracts
  remain frozen unless expressly included in this package.

The current implementation contract additionally requires all reports and visible failures to be
fixed and redacted: no filename, job/item/artifact/activity/owner ID, hash, raw error or cause, path,
payload, coordinate, health/power value, Token, Authorization material, provider response, or other
identifiable athlete data may reach the DOM, console, or a public report.

## Literal hard allowlist

The audit's exact candidate allowlist is the hard maximum. The audit names
`docs/tasks/pr-45-source-manager-explicit-retry.md`; that authoritative filename is used instead of
the delegation's non-binding suggested filename.

```text
docs/tasks/pr-45-source-manager-explicit-retry.md
js/app/source-manager-recovery.js
js/app/source-manager.js
js/import/import-service.js
js/pages/source-manager/source-manager.js
js/storage/source-operation-store.js
tests/import/import-core.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/source-manager/source-manager-recovery.test.js
tests/storage/source-operation-store.test.js
```

No substitute, generated file, fixture, screenshot, dependency, manifest, schema, migration,
Backup, Worker, Service Worker, provider/auth, release, deployment, or historical-PR path is
implicitly allowed. A need for any twelfth path is an immediate stop.

## Data, privacy, and rollback boundaries

- Preserve every Legacy and V2 record, RawArtifact, ImportJob, ImportItem, SourceOperation,
  Canonical record, SourceConnection, setting, and both libraries. Never delete, clear, overwrite,
  downgrade, repair-by-reset, or make Disconnect delete local data.
- Retry may schedule only already-retained durable pending RawArtifact bytes accepted by existing
  ImportService semantics. It must preserve every successful/committed item and exact duplicate or
  review result.
- IDs remain opaque strings. Missing and null remain distinct from true zero.
- Demo constructs no Retry capability and performs no Retry storage, lock, timer, provider, Worker,
  or other I/O.
- No real Token, account, provider call, private activity/file/library, user browser profile, or
  production origin is permitted.
- Rollback is an ordinary code revert. It must preserve every Import record, RawArtifact, Canonical
  record, SourceOperation, and both libraries; V6 must never be cleared or downgraded.

## Required verification matrix

The audit requires failure-first normal failed-job UI, reload, two-tab exclusion, lease/CAS loss,
preserved and missing bytes, partial completed items, cancellation, quota/abort, pagehide, Demo,
provider-zero-I/O, frozen public API/schema boundaries, focused and full gates, disposable synthetic
browser evidence, and depth-one/exact-head CI.

The delegated evidence matrix further requires eligible, ineligible, conflict, cancellation,
reload, and Demo cases in an actual-served disposable synthetic Chromium environment. Interception
must be installed before navigation. Evidence must use only synthetic data and a disposable profile,
must prove zero external/provider requests, and must not be labelled real quota, real account,
production-origin, private-library, or cross-browser evidence.

Minimum local and publication gates:

```text
focused Retry/Import/Source Manager/Storage tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
literal changed-path allowlist
exact data-retention invariants
actual-served disposable synthetic Chromium matrix
independent findings-first review
fresh independent no-findings re-review
true remote depth-one exact-head verification
exact-head CI
```

## Material contract gap found during revalidation

The final audit supplies a literal executable path allowlist and the high-level behavior and
verification boundaries above. It does **not** freeze the following implementation-critical details
that the delegated package says must be copied from that audit:

1. the opaque internal failed-job handle type, creation/lifetime rules, page-to-facade method shape,
   lookup semantics, and reload reconstruction seam that prevents durable job IDs from entering the
   DOM or public reports;
2. the exact safe result/error code and user-visible copy matrix for unavailable, ineligible,
   conflict, quota, cancellation, and generic Retry failures;
3. the exact SourceOperation phase/audit transition used to claim an existing terminal failed job,
   how the existing job is linked without weakening C4's atomic-link invariant, and the precise
   losing-tab/lease-CAS-loss terminal result; and
4. whether Retry eligibility follows only the three terminal job statuses, or also requires at
   least one current `retryable: true` item with retained RawArtifact bytes before the action is
   rendered, including how mixed retryable/non-retryable failed items are reported.

These are observable product, privacy, concurrency, and durable-state contracts. Choosing them from
current implementation details would invent a broader package and could make tests freeze an
unapproved design. They cannot be repaired safely by implementation inference.

## Current-tree material findings

The material-decision turn inspected the current C4, ImportService, page, ImportStore, and
SourceOperationStore source and tests without changing them. These facts constrain every complete
option below.

### Existing Import and page seams

- Public `ImportService` already exposes exactly `initialize`, `importArtifacts`, `cancelJob`,
  `retryJob`, `getReport`, `previewActivities`, `waitForJob`, and `close`. Direct
  `retryJob(jobId)` accepts only `failed_validation`, `failed_decode`, or `failed_storage`, requires
  at least one `retryable: true` item, preflights a retained RawArtifact for every such item, then
  moves the job to `retrying`. Its run loop preserves every terminal non-retryable item, moves only
  retryable items through `retrying -> validating`, and increments `retryCount` once.
- `recoverImportServiceJob(service, jobId)` is an existing direct-file internal helper, deliberately
  absent from `js/import/index.js`. It resumes a job already atomically prepared as `retrying` and
  requires at least one item already in `retrying`. C4 uses it after its storage transaction.
- A public report is exactly `{ schemaVersion, status, totals, items }`; each item is exactly
  `{ ordinal, outcome, errorCode, retryable }`. It contains no job, item, artifact, activity,
  filename, hash, content, or provider identifier. `listPersistedReports()` currently resolves raw
  job IDs only inside `js/app/source-manager.js` and returns only those redacted reports.
- The page creates Import Log DOM with `createElement` and `textContent`. Reports are numbered by
  display order. No report uses a durable ID as text, attribute, dataset, property, URL, or event
  payload. Dynamic controls can be added inside the existing report card; no HTML or CSS path is
  required.
- The real Source Manager app facade already uses an in-memory `Map` with positional opaque tokens
  for duplicate-review IDs. The C4 recovery controller independently uses an in-memory `Map` with
  positional opaque tokens for recovery candidates. Neither durable identifier enters the page.

### Existing C4 and storage seams

- C4 uses one exclusive Web Lock named `stravastats-source-manager-v1` with
  `{ mode: 'exclusive', ifAvailable: true }`. It never supplies `steal`; a missing lock returns
  `SOURCE_OPERATION_ACTIVE` immediately and never queues.
- One V6 `sourceOperations` row has only `idle` or `active`, kinds `local_import` or
  `provider_sync`, phases `acquiring`, `importing`, or `history_commit`, revision CAS, 15-second
  visible and 30-second hidden heartbeats, and an exact 90-second lease. Every mutation increments
  revision. Startup, refresh, visibility, `pageshow`, online, and lease observation are read-only.
- `enqueueSourceOperationJobLink` atomically links a newly created ImportJob to an owned operation.
  `recoverOperation` already demonstrates the required transaction shape for an existing job: one
  transaction over `sourceOperations`, `importJobs`, `importItems`, and `rawArtifacts` can validate
  the operation/job/items/bytes, transition the job/items, and publish the active operation or roll
  everything back.
- A normally completed Source Manager task returns the SourceOperation row to idle even when its
  Import report is a terminal failure. A terminal failed job left linked to a stale active operation
  remains a C4 Abandon-only candidate. Failed-job Retry must not bypass that C4 action.
- Existing close/pagehide wiring cancels current provider acquisition and/or Import work, waits for
  the controller task and mutation queue, and closes storage. A hard crash cannot finish those
  steps; the active lease then remains subject only to explicit C4 Recover/Abandon after expiry.
- V6 and Backup format 3 already accept the unchanged SourceOperation record shape. Adding a new
  record field, status, phase, kind, store, index, persisted handle, or Backup field is neither
  necessary nor authorized.

## Common executable contract for every selectable option

Executable Options A1 and A2 are subordinate designs for the already-selected P0-RETRY Option A;
neither reopens the retain-versus-amend PRD decision. They differ only in ownership of the ephemeral
handle map. The following behavior,
eligibility, copy, concurrency, data, and state transitions are identical and mandatory for either
selection.

### Retry scope and eligibility rule

Eligibility requires **both**:

1. an exact terminal job status of `failed_validation`, `failed_decode`, or `failed_storage`; and
2. at least one exact terminal item with `retryable: true`, where every `retryable: true` item has a
   valid retained RawArtifact whose ID matches the item, whose exact bytes validate, and whose state
   is `pending`.

The action is all-or-nothing at eligibility time. One missing, malformed, mismatched, empty, or
non-pending artifact for any retryable item makes the whole job ineligible. It must not schedule the
remaining subset. This preserves current `ImportService.retryJob` preflight semantics. A mixed job
is eligible when at least one retryable item satisfies the byte rule and every other retryable item
also satisfies it. Completed, review-required, exact-duplicate, cancelled, and non-retryable failed
items are preserved byte-for-byte and are never moved back to nonterminal state.

### Exact eligibility table

| Observed state | Required inspection result | Retry presentation | Fixed code | Mutation |
| --- | --- | --- | --- | --- |
| Real, operation idle, one of the three failed job statuses | At least one retryable item; every retryable item has exact pending bytes | Enabled `Retry` button | `RETRY_AVAILABLE` | None until click |
| Same, mixed terminal items | Successful/committed/non-retryable items are exact and every retryable item has exact pending bytes | Enabled `Retry` button | `RETRY_AVAILABLE` | On click, only retryable items move to `retrying` |
| One of the three failed statuses | Zero `retryable: true` items | No button; fixed unavailable note on that failed report | `RETRY_NOT_ELIGIBLE` | None |
| One of the three failed statuses | Any retryable item lacks an artifact, or artifact is missing, malformed, mismatched, empty, committed, or otherwise not exact pending bytes | No button; fixed unavailable note | `RETRY_SOURCE_UNAVAILABLE` | None |
| `completed` or `completed_with_warnings` | Exact terminal report | No Retry capability or Retry note | `RETRY_NOT_ELIGIBLE` internally only | None |
| `cancelled` | Exact terminal report | No Retry capability or Retry note | `RETRY_NOT_ELIGIBLE` internally only | None |
| Any nonterminal job, including `retrying` | Any | Never placed in the ordinary terminal Import Log as Retry-eligible | `RETRY_NOT_ELIGIBLE` | None |
| Malformed job, item, RawArtifact, totals, ordinal set, or public report | Any | Fail the Retry catalog closed; render no Retry button | `RETRY_UNAVAILABLE` | None |
| Current SourceOperation active and lease unexpired | Any otherwise eligible failed job | No enabled Retry button | `SOURCE_OPERATION_ACTIVE` | None |
| Current SourceOperation active and lease expired | Linked or unrelated work still requires C4 resolution | No enabled Retry button; C4 panel remains authoritative | `SOURCE_OPERATION_RECOVERY_REQUIRED` | None |
| Web Locks, operation storage, crypto UUID, clock, or required internal seam unavailable | Any | Existing reports remain readable; no Retry button | `RETRY_UNAVAILABLE` | None |
| Demo | No Retry controller, catalog, handle, storage, lock, timer, Worker, or provider construction | No Retry button | `DEMO_RETRY_UNAVAILABLE` only if an impossible direct action is attempted | Zero I/O |
| Unknown, expired, consumed, cross-generation, accessor, Proxy, malformed, or non-string handle | Any | Refresh ordinary Import Log | `RETRY_NOT_ELIGIBLE` | None |

Neither warning facts nor item `retryable` display alone authorizes an action. The durable job status,
all exact items, all retryable bytes, coordination state, handle generation, Web Lock, and revision
CAS are revalidated before the first write.

### Literal safe code and UI-copy table

These values are page/controller-local safe codes except the existing `SOURCE_OPERATION_*` codes.
They do not expand `IMPORT_ERROR_CODE`, the public Import report, or the durable SourceOperation
result-code vocabulary. Only code and literal copy may enter the DOM; raw error messages and causes
are discarded.

| Outcome | Fixed code | Literal UI copy |
| --- | --- | --- |
| Eligible | `RETRY_AVAILABLE` | `This failed import can be retried from its preserved local bytes.` |
| User action accepted and running | `RETRY_RUNNING` | `Retrying the failed import from preserved local bytes.` |
| Completed or completed with warnings | `RETRY_COMPLETED` | `Retry completed. Previously committed items were kept.` |
| Demo direct attempt | `DEMO_RETRY_UNAVAILABLE` | `Import Retry is unavailable in Demo mode.` |
| Coordination or catalog unavailable | `RETRY_UNAVAILABLE` | `Import Retry is unavailable. The existing import record was not changed.` |
| Wrong status, no retryable item, stale/unknown handle | `RETRY_NOT_ELIGIBLE` | `This import can no longer be retried.` |
| Missing or invalid retained bytes | `RETRY_SOURCE_UNAVAILABLE` | `The preserved local import bytes are unavailable. The existing import record was not changed.` |
| Other tab owns the Web Lock or active lease | `SOURCE_OPERATION_ACTIVE` | `This Source Manager operation is still active in another tab.` |
| An expired active lease requires C4 | `SOURCE_OPERATION_RECOVERY_REQUIRED` | `An interrupted Source Manager operation needs an explicit action.` |
| Clock invalid | `SOURCE_OPERATION_CLOCK_INVALID` | `The local clock could not safely update the Source Manager lease.` |
| Revision/ownership/handle race | `SOURCE_OPERATION_CONFLICT` | `The operation changed in another tab. Review its latest state.` |
| Required C4 capability disappears after catalog creation | `SOURCE_OPERATION_UNAVAILABLE` | `Source Manager operation coordination is unavailable.` |
| Pre-run operation transaction quota/abort/storage failure | `SOURCE_OPERATION_STORAGE_FAILED` | `The operation could not be saved. Free local storage and try again.` |
| Retried Import ends in quota/storage failure | `RETRY_STORAGE_FAILED` | `Browser storage space is not sufficient for this Retry. Previously committed items were kept.` |
| Explicit Retry cancellation reaches terminal `cancelled` | `RETRY_CANCELLED` | `Retry cancelled. Previously committed items were kept.` |
| Retried Import ends in another validation/decode/non-quota storage failure, or its terminal report cannot be verified | `RETRY_FAILED` | `The failed import could not be completed. Previously committed items were kept.` |

The existing generic `safeCode` allowlist must recognize only this table plus the existing fixed
Source Manager codes. An unexpected thrown value maps to `RETRY_FAILED` after the controller has
already used the narrower SourceOperation mappings where applicable. A quota or transaction abort
during the atomic prepare maps to `SOURCE_OPERATION_STORAGE_FAILED`; a verified terminal Import
report containing `STORAGE_QUOTA_EXCEEDED` maps to `RETRY_STORAGE_FAILED`.

### Exact atomic operation and Import transitions

1. Listing is read-only. It reads the current SourceOperation and exact terminal Import records,
   validates every record without accessors, and creates no owner, lease, timer, Worker, or lock.
2. Clicking `Retry` consumes the handle immediately in memory. A second click with the same handle
   is `RETRY_NOT_ELIGIBLE`.
3. The controller requests `stravastats-source-manager-v1` exactly once with
   `{ mode: 'exclusive', ifAvailable: true }`. It supplies no `steal`, accepts no shared lock, and
   never queues. A null lock is `SOURCE_OPERATION_ACTIVE` with zero storage mutation.
4. Under the held lock, the controller obtains one exact current timestamp, creates one document-
   internal UUID operation ID, and invokes the selected option's atomic prepare method with the
   candidate's captured SourceOperation revision and internal job ID.
5. One readwrite transaction over `sourceOperations`, `importJobs`, `importItems`, and
   `rawArtifacts` revalidates: the SourceOperation is still idle at the captured revision; the job
   is one of the three exact failed terminal states; item count/ordinals/job links and terminal
   totals are exact; at least one item is retryable; and every retryable item has exact pending
   bytes. Any failure aborts every write.
6. In that same transaction, only retryable items become
   `{ status: 'retrying', errorCode: null, retryable: false, activityId: null }`. All other items are
   unchanged. The job becomes `{ status: 'retrying', completedAt: null,
   retryCount: retryCount + 1, errorCode: null }`; `completedItems` decreases by exactly the number
   moved from terminal failure to `retrying`.
7. The same transaction changes the existing SourceOperation from idle to active with revision
   `old + 1`, `kind: 'local_import'`, `phase: 'importing'`, the current owner and new operation UUID,
   the existing internal job ID, null provider revision/acquisition time, and equal
   `startedAt`/`heartbeatAt` plus exact `leaseExpiresAt = heartbeatAt + 90_000ms`. Every explicit
   failed-job Retry is coordinated as local retained-byte work even when the retained RawArtifact
   provenance says provider; it performs no provider acquisition and never advances provider Sync
   history.
8. Only after that transaction commits does the controller call the existing internal
   `recoverImportServiceJob` seam to run the already-prepared retrying items. There is no second job,
   new bytes, re-selection, provider read, automatic scheduling, or public `retryJob` call from the
   page.
9. Visible heartbeat remains 15 seconds, hidden heartbeat remains 30 seconds, and every heartbeat
   is the existing owner/operation/revision CAS with a fresh exact 90-second lease. A heartbeat
   never changes job/item state.
10. The held Web Lock spans atomic prepare, Import execution, terminal report verification, and the
    final SourceOperation release. Successful `completed` or `completed_with_warnings` reports
    complete the operation with existing `lastAction: 'completed'` and `lastResultCode: null`.
    Verified terminal `failed_validation`, `failed_decode`, `failed_storage`, or `cancelled` reports
    complete it with existing `lastAction: 'failed'` and `lastResultCode: null`; the ImportJob status,
    item codes, and `retryCount` remain the durable detailed audit. No new durable audit enum is
    added.
11. Explicit `cancelRetry()` calls existing `cancelJob` only for the controller's internal active
    job ID. It never accepts a job ID from the page. Already committed items and transactions past
    commit remain. The Retry task waits for the terminal report and releases the operation as above.
12. Revision CAS or lease loss stops heartbeats, requests cancellation of the internal current job,
    releases no row it no longer owns, and returns only `SOURCE_OPERATION_CONFLICT`. The active row
    remains for existing C4 expiry and explicit resolution. It is never stolen or overwritten.
13. Orderly page close/pagehide uses the existing close chain: stop heartbeat, request cancellation,
    wait for the Retry task and mutation queue, then close stores. A hard reload/crash may leave the
    active lease or `retrying` job; startup never resumes it. Before expiry it reports active; after
    expiry only existing explicit C4 Recover/Abandon rules apply.
14. `visibilitychange`, `pageshow`, online, reload, and ordinary Import Log refresh may rebuild
    eligibility and new memory-only handles, but perform zero Retry mutation, lock acquisition,
    Worker scheduling, provider I/O, or automatic action.

### DOM, report, privacy, and data proof obligations

- The public Import report shape and every item field remain byte-for-byte unchanged. Retry UI
  metadata is an adjacent page-internal envelope, never a report property.
- Job, item, artifact, activity, owner, operation, SourceConnection, and provider identifiers remain
  only inside ImportService, app, recovery-controller, and storage closures. The page receives only
  a redacted report, one memory-only handle, fixed booleans/status, and fixed codes.
- The page must bind Retry/Cancel with listener closures. It must not place the handle or any durable
  ID in text, `id`, `name`, `value`, dataset, attribute, URL, form data, event detail, console,
  diagnostic event, public return value, or serialized snapshot.
- Browser evidence must assert that hostile durable IDs, filenames, hashes, raw errors, paths,
  payloads, coordinates, health/power values, Tokens, Authorization, and provider data are absent
  from `document.documentElement.outerHTML`, `body.textContent`, attributes/datasets, public reports,
  diagnostics, and captured requests.
- Successful/committed items, Canonical graphs, RawArtifacts, exact duplicates, review candidates,
  and non-retryable failures remain unchanged. Retry never deletes, clears, overwrites, downgrades,
  reselects, reacquires, or rolls back either library.

## Executable Option A1 — controller-owned ephemeral Retry catalog (recommended)

The C4 recovery controller owns both the only raw job-ID map and the only page-facing Retry handle
map. This keeps job resolution, Web Lock ownership, SourceOperation CAS, heartbeats, cancellation,
and handle consumption in one closure.

### Exact handle domain, lifetime, and reconstruction

- Handles are document-memory-only strings matching `^retry-[1-9][0-9]*-[1-9][0-9]*$`, formatted
  `retry-<generation>-<ordinal>`.
- `generation` begins at zero inside a newly created Real recovery controller and increments before
  every catalog rebuild attempt. `ordinal` is one-based in the current terminal report order.
- The controller clears the map before every rebuild, action attempt, initialization failure, and
  close. A handle is valid only from one successful `listImportLog()` result until the next rebuild,
  action attempt, or close. It is single-use and never stable across calls.
- Reload reconstructs eligibility by re-reading the durable SourceOperation, jobs, items, and
  RawArtifacts, then creates a fresh controller and new map. No handle is read from or written to
  IndexedDB, localStorage, sessionStorage, URL, history, DOM, Backup, Worker, or Service Worker.

### Exact internal method shapes

`js/import/import-service.js` adds one direct-file-only helper beside the existing recovery helper;
neither is re-exported by `js/import/index.js`:

```text
inspectImportServiceRetryJobs(service) -> Promise<readonly Array<{
  jobId: opaque internal string,
  report: existing frozen public report,
  eligibility: 'eligible' | 'not_eligible' | 'source_unavailable'
}>>
```

It uses ImportService's captured store, exact terminal-job ordering, item validators, and
`getRawArtifact`. It returns identifiers only to the recovery controller. Malformed data rejects
with a safe Import error; it never returns a partial catalog.

`js/storage/source-operation-store.js` adds one method to the internal object returned by the
already-public factory, but adds no module export:

```text
prepareRetryOperation({
  expectedRevision, ownerId, operationId, jobId, actionAt, leaseExpiresAt
}) -> Promise<{
  operation: exact active SourceOperation,
  job: exact retrying ImportJob,
  scheduledItems: positive safe integer
}>
```

Its exact transaction and preconditions are common-contract steps 5–7. The factory's module export
surface remains unchanged.

`js/app/source-manager-recovery.js` adds exactly:

```text
listImportLog() -> Promise<readonly Array<{
  schemaVersion: 1,
  report: existing frozen public report,
  retry: { available: boolean, code: fixed code, handle: opaque handle | null }
}>>
getRetryState() -> {
  schemaVersion: 1,
  status: 'idle' | 'running' | 'unavailable' | 'closed',
  code: fixed code | null,
  actions: { cancel: boolean }
}
retry(handle) -> Promise<existing frozen public report>
cancelRetry() -> Promise<{ status: 'cancellation-requested' | 'cancelled' }>
```

The retry envelope is internal to the page boundary and is never returned by ImportService. The
controller calls `inspectImportServiceRetryJobs`, owns the internal descriptor map, calls
`prepareRetryOperation`, then calls the existing `recoverImportServiceJob` and `waitForJob` seams.
Option A splits dependency normalization into a read-only Import catalog capability and a mutation
coordination capability. If Web Locks, the SourceOperation store, UUID, or clock is unavailable,
`listImportLog()` still returns the existing redacted reports through the valid Import reader, but
every failed entry has `{ available: false, code: 'RETRY_UNAVAILABLE', handle: null }`. It performs
no SourceOperation read or mutation and constructs no handle.

`js/app/source-manager.js` forwards only `listImportLog`, `getRetryState`, `retry`, and
`cancelRetry` from the controller to the Real page composition. Demo passes no Retry facade.
`js/pages/source-manager/source-manager.js` renders the adjacent envelope, binds handles only in
closures, and creates dynamic Retry/Cancel controls inside existing report cards.

### Executable Option A1 impact

Executable Option A1 may modify all and only the exact eleven-path hard maximum. It needs no HTML/CSS path and
no twelfth file. It adds no public module export, public Import method, Repository method, Storage
module export, schema/store/index/record field, migration, Backup field/format, package/dependency,
Worker message, Service Worker/cache, provider/auth request, Token behavior, retention rule, or
terminal job/item state. It is recommended because one controller owns handle lifetime and every
coordination decision, minimizing stale-handle and split-authority surfaces.

## Executable Option A2 — Import-facade-owned ephemeral handles (complete, not recommended)

Executable Option A2 uses the entire common contract and identical storage transaction, transitions, copy,
tests, and eleven-path ceiling. The only difference is handle ownership.

### Exact differing handle and method contract

- `js/app/source-manager.js`'s Real Import facade owns the generation counter, raw job-ID map, and
  `retry-<generation>-<ordinal>` handles. Lifetime, single-use behavior, clearing, reconstruction,
  non-persistence, and DOM prohibitions are identical to Option A.
- The Import facade adds internal `listImportLog()` and `consumeRetryHandle(handle)` methods.
  `listImportLog()` uses the direct ImportService inspection helper and returns the same adjacent
  page envelope. `consumeRetryHandle` returns an internal descriptor exactly once to the recovery
  controller or rejects `RETRY_NOT_ELIGIBLE`; it is never passed to the page.
- The recovery controller adds `retry(handle)`, `cancelRetry()`, and `getRetryState()` but delegates
  handle resolution to the Import facade before it requests the Web Lock. It then owns the same
  lock/prepare/heartbeat/cancel/release sequence.
- The storage method, page controls, safe code table, reload behavior, Demo isolation, and every
  data invariant are identical to Option A.

### Executable Option A2 impact and limitation

Executable Option A2 also fits the same eleven paths and adds no prohibited public or durable surface. It is not
recommended because handle generation and consumption live in the Import facade while Web Lock,
revision CAS, active job identity, and cancellation live in the recovery controller. That creates
two internal authorities and a larger stale/close race surface without a product or privacy benefit.

## Alternatives deliberately not offered

A persisted random handle, hash-derived handle, durable job alias, job ID in a dataset/attribute,
public-report handle field, URL/session handoff, new V6 field/store/index, new Backup value, new
public Import method, or page call to raw `retryJob(jobId)` would materially expand a prohibited
schema, retention, public, or disclosure boundary. None fits this package and none is an owner option.

Calling `retryJob` first and linking SourceOperation in a later transaction is also not an option:
it creates a `retrying` orphan crash gap and violates the required atomic C4 link. Claiming an
operation first and transitioning the terminal job later is equally non-atomic. Automatic startup,
reload, crash, visibility, online, timer, or background retry remains prohibited.

## Exact owner decision required

Implementation remains blocked until the owner returns exactly one of the following mutually
exclusive selections. Any edit, hybrid, new path, or broader contract requires another material
turn.

Recommended exact response:

```text
Owner selects PR-45 Executable Option A1, the controller-owned ephemeral Retry catalog, under the already-selected P0-RETRY Option A, and approves the complete common executable contract, exact eligibility and safe-copy tables, atomic SourceOperation/Import transitions, handle lifetime and reload reconstruction, internal method shapes, DOM/public-report redaction proof, Demo/provider-zero-I/O rules, data preservation and rollback boundaries, verification matrix, and literal eleven-path hard maximum exactly as frozen in Draft PR #57's Task Brief. Eligibility requires at least one retryable item and exact retained pending bytes for every retryable item. No public API, schema, migration, Backup, dependency, Worker, Service Worker, provider/auth, Token, retention, terminal-state, release, deployment, merge, or historical-PR expansion is authorized. Authorize a separate failure-first implementation tranche and disposable synthetic Chromium evidence inside that exact contract; keep PR #57 Draft until implementation, independent no-findings re-review, all gates, exact remote head, and exact-head CI pass. Ready is not merge authorization.
```

Alternative exact response:

```text
Owner selects PR-45 Executable Option A2, the Import-facade-owned ephemeral Retry handles, under the already-selected P0-RETRY Option A, and approves the complete common executable contract and Executable Option A2 differences exactly as frozen in Draft PR #57's Task Brief, including the same eleven-path hard maximum and all stated prohibitions. Authorize a separate failure-first implementation tranche and disposable synthetic Chromium evidence; keep PR #57 Draft until every gate passes. Ready is not merge authorization.
```

## Stop conditions

Stop before implementation, Ready, or any broader mutation if:

- the owner has not returned exactly one selection from `Exact owner decision required`;
- any path outside the exact eleven-path allowlist is needed;
- any public API, schema, Backup, dependency, Worker, Service Worker, provider/auth, retention, or
  material retry-state expansion is required;
- evidence would require real credentials, provider/private data, a user browser/profile, or user
  data/cache mutation; or
- an action would merge, auto-merge, clean up, deploy, release, tag, modify a default/protected
  branch, or edit/mark Ready/merge PR #56 or historical PR #31.

## Completion evidence

The Task-Brief-only first commit and OPEN/Draft PR #57 record exact-base verification and the
pre-implementation blocker. This material-decision update freezes a complete common executable
contract plus mutually exclusive Executable Options A1 and A2. No production or test behavior has
changed. The PR must remain Draft and implementation must remain absent until the owner returns
exactly one response from `Exact owner decision required`.

The docs-only material head passed 78/78 focused Import, Source Manager boundary/recovery, and
SourceOperation storage tests; 283-file syntax validation; privacy validation; the complete
1,897/1,897 suite; `git diff --check`; and an exact changed-path gate proving this Task Brief is the
only path changed from the prior published head. No browser evidence was run because this turn
authorizes no implementation and makes no browser-behavior claim.
