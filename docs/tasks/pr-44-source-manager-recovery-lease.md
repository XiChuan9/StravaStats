# PR-44: Source Manager Durable Recovery Lease

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M31 / C4 durable owner, heartbeat, lease, and explicit recovery |
| Status | A2 material decision package complete; awaiting owner selection |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994` |
| Exact base tree | `11434bb7cbce1cef2e72904182df089b17a7e2e9` |
| Feature branch | `codex/v2/source-manager-recovery-lease` |
| Parent decision | `D-A A2 / D-B C`, staged C1–C4 closure |
| Completed prerequisites | C1, C2, C3a, C3b, C1.1, and C3c merged |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Current authority | A0, A1 Draft publication, and read-only A2 decision package only |

## Goal

Define a materially complete owner decision for C4 durable Source Manager coordination after merged
C3c. C4 owns durable owner identity, heartbeat and lease semantics, plus explicit `Recover` and
`Abandon` actions. Startup, reload, visibility, online, restore, and lease expiry must never resume,
retry, or start provider acquisition or Import work automatically.

This first commit changes only this Task Brief. A2 may inspect the exact merged tree read-only and
may update only this same document. No production, test, schema, migration, public API, Backup,
Worker, Service Worker, dependency, provider, or browser-profile change is authorized.

## Authority and sequence

The authoritative baseline is C3c PR #54 squash-merged at
`integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994`. The owner route remains:

> D-A A2 / D-B C: staged full P0 closure through separate C1–C4 tranches, with no release claim.

C1, C2, C3a, C3b, C1.1, and C3c are merged. This dispatch authorizes only:

1. independent A0 verification of the exact base, remote, clean state, and untouched gates;
2. an A1 Task-Brief-only first commit and open Draft PR against `integration/v2`; and
3. a findings-first, source-to-state A2 audit recorded only in this Task Brief.

It does not authorize C4 implementation or tests, schema/public API expansion, migration, Ready,
merge, cleanup, deployment, release, real provider/account/private data, or a user browser/profile.

## Global invariants

- Preserve the working V1 path and every Legacy and V2 record. No delete, clear, overwrite,
  downgrade, implicit migration, destructive cleanup, or rollback of committed import items.
- Disconnecting Strava, abandoning a recovery claim, removing authorization material, and deleting
  local data remain distinct decisions and actions.
- Provider, subject, activity, Import job, item, owner, and lease IDs remain opaque strings. Missing
  or null values never become `0`; true zero remains distinct.
- Provider data may persist only through the merged C3a → C3b → existing ImportService path.
  Source Manager and pages must not choose persistence directly.
- Startup, reload, restore, `pageshow`, visibility, online, heartbeat observation, lease expiry, and
  cross-tab messages perform no automatic provider read, Import resume, retry, or new scheduling.
- A durable record must not contain Token values, authorization headers, raw provider responses,
  filenames, precise location, health/power data, private errors, or identifiable athlete data.
- C4 cannot promise cancellation of already committed items, a running IndexedDB transaction that
  has crossed its commit boundary, or work continuing in a crashed/closed browsing context.
- Demo remains isolated from Real storage, provider, authentication, recovery, and lease capability.
- Draft status, passing tests, or successful CI is not implementation, merge, deployment, or release
  authorization.

## A0 exact-base and untouched-gate evidence

- This isolated worktree began clean and detached at exact commit
  `c2df4ea16920d4b5c80ea06eae1059c1940e1994`, the exact local and remote-tracking
  `integration/v2` head. The integration worktree was not opened or modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`; upstream push is disabled.
- GitHub App readback confirms PR #54 is closed and merged, with squash merge commit
  `c2df4ea16920d4b5c80ea06eae1059c1940e1994` into `integration/v2`.
- Local and remote-tracking `main` and `maintenance/v1` remain at
  `fe34535c39db421434a5e28cd26a57b3f71130e2`.
- The delegated postmerge record reports `npm ci`, syntax 279, privacy, full 1864/1864 tests, and
  `git diff --check`. GitHub App readback independently confirms integration push CI run
  `31482670964`, job `93750958046`, completed successfully at the exact base and that every install,
  syntax, privacy, and test step succeeded. These baseline results are not evidence for this
  feature head.
- GitHub CLI 2.96.0 is installed, but its API credential is invalid. No interactive login or user
  browser/profile may be used. GitHub App operations are preferred.
- The feature branch was created from the exact base only after local and GitHub branch-name
  collision checks returned no existing `codex/v2/source-manager-recovery-lease` branch.

## A1 publication contract

The first commit and initial Draft PR diff must contain exactly:

```text
docs/tasks/pr-44-source-manager-recovery-lease.md
```

Draft PR title:

```text
feat(v2): define Source Manager recovery lease
```

Draft PR body:

```markdown
## What changed

Adds the C4 Task Brief for durable Source Manager owner/heartbeat/lease coordination and explicit Recover or Abandon decisions.

## Why

C3c is merged, but durable owner provenance, lease expiry, cross-tab takeover, terminalization, recovery UX, and schema/API boundaries require a separate findings-first owner decision. No automatic resume is allowed.

## Impact

Docs only. No Source Manager, Import, Storage, schema, migration, Backup, public API, Worker, Service Worker, dependency, provider/auth, Token, browser-profile, or user-data change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
A1.

### A1 publication evidence

- First commit: `f5b4dbc29a1dcabd27b4ecbef7847619a7b6f8f8`.
- Exact first-commit diff: one new path, this Task Brief, with no product or test change.
- Open Draft PR: [#55](https://github.com/XiChuan9/StravaStats/pull/55), base
  `integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994`, initial head
  `f5b4dbc29a1dcabd27b4ecbef7847619a7b6f8f8`.
- GitHub App, rather than a user browser/profile or the invalid local GitHub CLI credential, created
  and read back the Draft PR. It remains open and Draft.

## A2 findings-first audit contract

A2 must establish from the exact current code, tests, and accepted documentation:

1. the source-to-state call graph from Source Manager and merged C3c into C3a, C3b, ImportService,
   ImportJob, ImportItem, Storage, Repository, SourceConnection, and public report surfaces;
2. every existing durable and ephemeral job/item/controller state, transition, timestamp, error
   code, cancellation checkpoint, transaction boundary, and terminal report predicate;
3. current IndexedDB schema, migration, Storage Factory, Backup/restore, public/internal API, Demo,
   startup, reload, close, pagehide, visibility, offline, and cross-tab capabilities;
4. what survives reload/crash/close, what cannot survive, which committed items remain, and whether
   any uncommitted item can be safely scheduled only after an explicit user action;
5. SourceConnection C2 history and C3c success-CAS interactions, including stale revision, authority
   loss, reconnect, disconnect, restore, quota, storage, and malformed-record behavior;
6. browser/platform primitives and limits for owner identity, clocks, heartbeats, leases, CAS,
   BroadcastChannel/storage observation, timer throttling, transaction cancellation, and crash
   detection; and
7. exact test topology, actual-served disposable synthetic browser seams, privacy boundaries, and
   literal-path collision candidates.

Historical summaries are context, not evidence. Findings must precede recommendations.

## Required A2 material decision package

The Task Brief update must present mutually exclusive complete owner options. Each option must fix:

- owner/tab identity provenance, generation, lifetime, storage, redaction, and privacy;
- heartbeat and lease timestamps, duration, clock source, skew handling, visibility throttling,
  sleep/wake, offline behavior, and expiry calculation;
- exact eligible nonterminal ImportJob and ImportItem states;
- the invariant that observation never resumes work automatically;
- exact `Recover` and `Abandon` visibility, confirmation, preconditions, action effects, idempotency,
  and unavailable/conflict copy;
- cross-tab conflict, CAS revision, expiry, takeover, losing-tab behavior, and simultaneous action
  linearization;
- limits on aborting provider requests, active Workers, ImportService work, and IndexedDB
  transactions, including commit-boundary uncertainty;
- reload, crash, close, `pagehide`, `pageshow`, visibility, and browser process-loss semantics;
- retention of committed items and the exact future scheduling rule for remaining work;
- exact ImportJob/ImportItem terminalization, totals, audit fields, and fixed redacted error codes;
- quota/storage failure behavior, partial-write handling, and what action remains available;
- Backup/restore inclusion or exclusion and SourceConnection/C3c authority/history interaction;
- exact schema/store/index/migration, public API, internal API, dependency, Worker, Service Worker,
  and browser-runtime impact;
- browser/platform limitations, unsupported cases, privacy, rollback, and failure-first tests;
- actual-served disposable synthetic browser evidence with interception before navigation and no
  user profile, credentials, real provider, or private data; and
- a collision-audited literal cumulative path allowlist, with no glob or implicit substitute.

Every option must state what it cannot guarantee. Any required schema, migration, Backup format,
public API, Worker protocol, Service Worker, dependency, provider/private evidence, or additional
path remains a separate owner decision and is not inferred from this audit.

## Stop conditions

Stop and return to the control tower before:

- any product or test implementation before an explicit owner selection;
- any real Token/account/provider/private activity or user browser/profile use;
- any schema, migration, public API, Backup format, dependency, Worker protocol, Service Worker,
  deployment, or release mutation;
- any path outside this Task Brief during A2;
- any Ready transition, merge, auto-merge, prior-PR closure, branch/worktree cleanup, final release
  audit, rebase, amend, force-push, or destructive Git/data action.

## A2 source-to-state findings

These findings describe the exact merged C3c tree. They precede and constrain every option below.

### Source Manager and C3c call graph

```text
source-manager.html
  -> js/source-manager.js
     -> js/app/source-manager.js
        -> js/pages/source-manager/source-manager.js
        -> createImportStore -> createImportService -> Worker decoder
        -> createSourceConnectionStore -> authorization/connection controllers
        -> createSourceManagerProviderSyncController
           -> Strava reader (maximum two workers)
           -> C3a mapper -> C3b provider artifact
           -> ImportService.importArtifacts
           -> waitForJob -> redacted report predicate
           -> C2 SourceConnection revision CAS for lastSyncAt
```

The Real facade creates one in-memory ImportService, browser Worker, ImportStore, and connection
controller. It exposes import, cancel, report, wait, preview, duplicate-review, close, and terminal
Import Log reads. ImportService also has `retryJob`, but the Source Manager facade does not expose
it. The page holds local-file `activeJobId` only in memory. C3c separately holds acquisition,
AbortController, reader, import job, cancellation, success-suppression, and success-CAS state only
in memory. Nothing durably associates a Source Manager operation, tab, or SourceConnection with an
ImportJob.

Startup initializes connection, ImportService, C3c, and persisted **terminal** reports. Current UI
actions are Connect/Reconnect, Sync latest 25/Cancel sync, local file import, and Disconnect. It has
no Recover or Abandon action. Existing copy correctly says sync is never automatic. `pageshow`,
visibility, online events, BroadcastChannel, Web Locks, and cross-tab storage observation are not
used. `pagehide` requests `application.close()` but cannot await completion after document/process
loss.

### Exact durable Import state

ImportJob fields are exactly `id`, `status`, `totalItems`, `completedItems`, `createdAt`,
`completedAt`, `retryCount`, and `errorCode`. ImportItem fields are exactly `id`, `jobId`, `ordinal`,
`artifactId`, `status`, `errorCode`, `retryable`, and `activityId`. IDs are opaque strings and time
values are strict UTC strings.

The exact nonterminal job states are:

```text
queued validating hashing decoding normalizing matching persisting analyzing retrying
```

The exact nonterminal item states are:

```text
queued validating hashing decoding normalizing matching persisting retrying
```

Terminal job states are `completed`, `completed_with_warnings`, `failed_validation`,
`failed_decode`, `failed_storage`, and `cancelled`. Terminal item states are `completed`,
`review_required`, `skipped_exact_duplicate`, `failed_validation`, `failed_decode`,
`failed_storage`, and `cancelled`.

Current cancellation is deliberately narrower than nonterminality. A running job may request cancel
in queued, validating, hashing, decoding, normalizing, matching, or persisting. Hashing cancellation
is latched until the job reaches decoding. Analyzing and retrying are not currently cancellable.
The active-job and cancellation sets disappear on reload/crash.

`importArtifacts` snapshots all supplied artifacts before creating a durable queued job and items,
then returns `{ jobId, completion }` while the run continues. RawArtifact bytes and the item link are
stored one item at a time during hashing. Therefore a stalled job can contain both recoverable
nonterminal items with a valid `artifactId` and unrecoverable nonterminal items with `artifactId`
null. Existing `retryJob` accepts only terminal failed jobs and retryable items whose RawArtifact
exists; it is not nonterminal crash recovery.

Each item persistence transaction atomically covers canonical records, provenance, RawArtifact
commit state, ImportItem terminal state, and job counters. A completed transaction remains; an
aborted transaction does not partially persist. Earlier committed items are never rolled back when
a later item, Worker, cancellation, storage, or quota failure occurs. Worker termination rejects
pending calls as `WORKER_CRASHED`, but a hard browser/process loss cannot be converted reliably into
an application error. The [IndexedDB standard](https://w3c.github.io/IndexedDB/) makes transaction
completion/abort the authority; application code cannot cancel a transaction after it has entered
commit and cannot infer partial completion from a lost JavaScript promise.

The public Import report remains schema version 1 and exposes only status, aggregate totals, and
per-item ordinal/outcome/fixed error/retryable. It does not expose job, item, artifact, activity,
provider, subject, or owner IDs. Import Log lists durable terminal jobs only.

### C3c, connection history, close, and failure findings

C3c reads exact Token authority and SourceConnection before provider acquisition, maps only through
C3a, creates only the deterministic C3b artifact, and persists only through ImportService. The C3b
artifact contains provider `strava`, fixed SourceConnection ID, and ImportedActivityBundle data; it
contains no Token or subject ID. Its locally acquired RawArtifact can therefore be processed later
without another provider request.

C3c advances `lastSyncAt` only when the report is `completed` or `completed_with_warnings`, has at
least one item, has no failed/cancelled item, contains only completed/review-required/exact-duplicate
outcomes, and its totals agree. It then uses the SourceConnection revision and acquisition time
captured before the provider call. Authority loss, disconnect/reconnect, a competing connection
transition, or any stale revision makes that history CAS fail as `HISTORY_NOT_ADVANCED`; committed
items remain. Close aborts acquisition and requests Import cancellation until the success CAS has
started. Once that CAS starts, close drains it rather than claiming cancellation.

Quota while hashing has only best-effort terminalization because even those error writes can fail.
Quota during item persistence leaves earlier committed items and marks later work failed when error
writes succeed. Storage unavailability can leave an otherwise well-formed durable nonterminal job.
No current mechanism can prove a tab dead, transfer ownership, fence a waking old tab, or bind C3c
history advancement to a recovered job.

### Schema, Backup, restore, privacy, and rollback findings

The exact database is `strava-stats-v2`, physical version 5, schema ID `strava-stats-v2@5`, with 14
stores and migration IDs `schema-0001-bootstrap` through `schema-0005-source-connection`.
`sourceConnections` is the V5 addition and has unique `byProvider`. SourceConnection fields are
exactly `id`, `provider`, `subjectId`, `status`, `lastSyncAt`, `errorCode`, and `revision`; identity is
immutable and `lastSyncAt` is monotonic. These fields are authorization/history state, not an
operation lease.

Storage publicly exports `createCanonicalStore`, `createImportStore`, and
`createSourceConnectionStore`. ImportService and Source Manager facades are application surfaces.
Any new store, record fields, method, or facade action is an explicit schema/public-or-internal API
decision, not an implementation detail.

Backup format 2 enumerates all 14 stores, including RawArtifact, ImportJob, ImportItem, duplicate
review, and SourceConnection state. It validates nonterminal Import records, so a valid backup may
carry a stalled job. Portable SourceConnection export clears credentials (which are never stored)
and maps connected/error to reconnect-required. Restore is whole-database and atomic, only into an
absent or exactly empty supported database; local settings are handled separately. A new store
requires a new exact Backup profile/format or an explicit, tested exclusion rule. Restore must never
invent an owner, interpret a stale owner as live, convert null to zero, or terminalize existing work
implicitly.

Accepted ADR-0003 keeps pages behind repositories/services; ADR-0004 requires every source to use
ImportedActivityBundle and deferred recovery to this tranche; ADR-0006 states provenance is not
account ownership and cannot be deleted as a disconnect shortcut. Current known limitations already
state that durable resume and cross-tab lease do not exist. Legacy IndexedDB, V1 routes, main, and
maintenance/v1 need no mutation for C4. A physical V6 database cannot be opened by the current V5
build; a safe rollback is therefore a V6-aware build that disables C4 UI/runtime while preserving
the additive store and every V2 record, never a downgrade or clear.

### Browser primitive and platform findings

An exclusive [Web Lock](https://w3c.github.io/web-locks/) can fence same-origin, same-storage-bucket
live owners while its callback promise remains unsettled. `ifAvailable: true` can fail immediately;
`steal` destroys the required exclusion guarantee and must be forbidden. Locks do not coordinate
different profiles, private contexts, browsers, origins, devices, or storage buckets. A durable
IndexedDB/localStorage timestamp alone cannot prove owner death because hidden-tab throttling,
sleep, suspension, clock changes, and process scheduling can outlast any lease.

`Date.now()` is the comparable wall-clock source across contexts; `performance.now()` origins are
not durable or cross-context. BroadcastChannel/storage events can prompt a read but cannot be an
authority. Visibility and online changes may refresh UI/heartbeat but must never acquire a lock or
schedule work. Browser compatibility beyond an actual-served disposable Chromium run is presently
unverified; Safari, Firefox, mobile lifecycle, private mode, storage eviction, and multi-device
behavior must remain explicit limitations.

### Existing verification topology

Relevant current unit counts are: Import state machine 2, Import core 27, Import boundaries 7,
IndexedDB schema 23, IndexedDB transactions 7, SourceConnection store 8, Backup service 13, Backup
boundaries 16, provider-sync 18, Source Manager core 15, and Source Manager boundaries 17. Existing
tests cover stage cancellation, Worker failure, quota, committed retention, SourceConnection CAS,
pagehide ordering, schema migration, and Backup restore. They do not cover durable owner identity,
heartbeat, sleep/clock behavior, cross-tab fencing, simultaneous Recover/Abandon, or restored stale
work.

## Common C4 action contract

The following contract is common to all three mutually exclusive carriers. An option that cannot
meet part of it says so explicitly.

### Identity, heartbeat, lease, and observation

- `ownerId` is `crypto.randomUUID()` generated once per Real Source Manager Document. It is new on
  every reload, never copied from session/local storage, Token, SourceConnection, subject, browser,
  filename, or DOM data, and has no weak fallback. `operationId` is a separate UUID generated for
  each explicit Import, Sync, Recover, or Abandon claim. Both remain opaque strings; invalid/missing
  crypto fails closed.
- The active durable record may store those random IDs locally. UI, logs, diagnostics, public Import
  reports, Backup, exported filenames, and idle audit state must not expose them. Demo creates no
  identity or lease.
- A visible owner heartbeats every 15 seconds; a hidden owner targets every 30 seconds. Every
  successful heartbeat sets `heartbeatAt = now` and `leaseExpiresAt = now + 90 seconds` in one CAS.
  `leaseExpiresAt` is derived, never extended from its previous value. Becoming visible triggers an
  immediate heartbeat. Offline does not stop local heartbeat, but blocks new provider acquisition.
- All timestamps are strict UTC strings derived from injected `Date.now()`. Each mutation requires
  `now >= startedAt` and `now >= heartbeatAt`. A backward clock, malformed timestamp, or arithmetic
  overflow fails closed as `SOURCE_OPERATION_CLOCK_INVALID`. A forward clock may make stale UI
  visible, but the live Web Lock still prevents takeover.
- Startup, reload, restore, `pageshow`, visibility, online, timer fire, lease expiry, and
  BroadcastChannel/storage notification may only read, validate, and render. They never request a
  lock, provider data, Worker, Import run/retry, connection transition, Recover, or Abandon.

### Live fencing, expiry, conflicts, and lifecycle

- The whole Real Source Manager operation is inside the named exclusive Web Lock
  `stravastats-source-manager-v1`, requested with `ifAvailable: true`. No waiting queue and no
  `steal` are allowed. Local file import and provider sync share this one-operation fence.
- Lock acquisition precedes the durable active CAS. A claim is usable only after both succeed.
  Heartbeat, job-link, phase, and completion writes are serialized in the owning context and CAS the
  exact record revision. Any CAS loss stops new scheduling, aborts provider fetch/reader and Worker
  work best-effort, requests Import cancellation when a job is known, and releases the Web Lock only
  after those promises settle or reject.
- An active record is stale only when `now >= leaseExpiresAt`. Staleness makes explicit action UI
  eligible; it never proves the old context dead. Recover/Abandon must still obtain the Web Lock
  immediately and CAS the exact observed revision. If the lock is unavailable, show
  `This Source Manager operation is still active in another tab.` If the revision/state changes,
  show `The operation changed in another tab. Review its latest state.`
- Two simultaneous actions linearize at the Web Lock and durable CAS. One can win. A later action
  sees idle/terminal or a different revision and is an idempotent no-op; it never terminalizes or
  reschedules twice.
- `pagehide` and close stop future heartbeats, abort acquisition, request job cancellation where the
  current state machine permits it, and keep the Web Lock until close settles if the context
  survives. They cannot promise completion. Crash/process loss releases live capabilities and
  eventually the Web Lock, but leaves the active record unchanged until explicit action.
- If Web Locks, crypto, durable storage, or exact-schema validation is unavailable, Sync, Import,
  Recover, and Abandon fail closed. Read-only terminal Import Log and connection status may remain.

### Exact action eligibility and effects

The recovery panel is visible only for either (a) one stale active record with a linked nonterminal
job, or (b) a preserved orphan nonterminal job that has no active owner after migration/restore. It
shows fixed redacted state/counts and requires a confirmation naming the action, never a provider,
subject, filename, activity, or owner ID. If several orphan jobs exist, the user selects one opaque
UI ordinal and handles one under the global fence at a time.

`Recover` is eligible only for the exact nonterminal job states listed above. For every exact
nonterminal item, its RawArtifact must exist, validate, be `pending`, and match the item's artifact
ID to be schedulable. Terminal items—including completed, review-required, exact duplicate, failed,
or cancelled—never change. Nonterminal items without valid pending bytes atomically become
`cancelled`, `retryable: false`, `activityId: null`, error `RECOVERY_SOURCE_UNAVAILABLE`.

For queued through persisting jobs, Recover atomically claims the stale record, changes every
schedulable nonterminal item to `retrying`, changes the job to `retrying`, increments `retryCount`
once, clears `completedAt`, recomputes `completedItems` from terminal items, and records audit result
`RECOVERY_REQUEUED`. Only those already-durable bytes may then enter the existing validation → hash
→ decode → normalize → match → persist path. It never reacquires a file/provider response or starts
a new job. If no item is schedulable, Recover is disabled and only Abandon is offered.

An `analyzing` job is a special explicit finalize recovery: all its items must already be valid
terminal records. Recover performs no Worker/provider/item persistence and conservatively sets the
job to `completed_with_warnings` with exact recomputed totals. A malformed or nonterminal item makes
finalize unavailable and leaves Abandon. This is the only recovery that does not schedule bytes.

`Abandon` is eligible for any exact nonterminal job state. In one atomic ImportJob/ImportItem
transaction it preserves every terminal item and committed RawArtifact/canonical record, converts
every nonterminal item to `cancelled`, `retryable: false`, `activityId: null`, error
`RECOVERY_ABANDONED`, and sets the job `cancelled`, exact terminal count, `completedAt = now`, and
error `RECOVERY_ABANDONED`. It performs no provider, Worker, retry, new job, disconnect, provenance
delete, or raw/canonical delete. A stale acquisition record with `jobId: null` can only be abandoned;
it changes no Import record.

An IndexedDB transaction already committing is allowed to complete or abort atomically before a
subsequent recovery transaction can observe it. C4 never claims to cancel that commit. If a prior
item committed, it remains terminal and is never scheduled. If its transaction aborted, the item is
still nonterminal and is scheduled only by explicit Recover with valid pending bytes.

### Completion, history, failures, and fixed codes

After recovered Import completion, provider history advances only when all existing C3c successful
report predicates pass **and** the operation retained original `acquiredAt`, original connection
revision, and kind `provider_sync`, and current Token authority plus exact C2 subject/connection
still match. It uses the original C2 CAS. Any missing authority, orphan/restore provenance,
disconnect/reconnect, stale revision, or CAS failure retains committed items, clears the operation,
and records `RECOVERY_HISTORY_NOT_ADVANCED`. Local imports never touch SourceConnection.

A heartbeat/phase/job-link storage or quota failure stops new scheduling and attempts current-work
cancellation; it never clears data or fabricates terminalization. If its failure record cannot be
written, the old lease expires and only explicit recovery remains. A Recover/Abandon quota or
transaction failure is atomic, leaves the observed stale state unchanged, and displays
`SOURCE_OPERATION_STORAGE_FAILED`; after space/availability returns, the same explicit action may
be retried.

Fixed operation/UI/audit codes are:

```text
SOURCE_OPERATION_ACTIVE
SOURCE_OPERATION_RECOVERY_REQUIRED
SOURCE_OPERATION_CLOCK_INVALID
SOURCE_OPERATION_CONFLICT
SOURCE_OPERATION_UNAVAILABLE
SOURCE_OPERATION_STORAGE_FAILED
RECOVERY_NOT_AVAILABLE
RECOVERY_REQUEUED
RECOVERY_SOURCE_UNAVAILABLE
RECOVERY_ABANDONED
RECOVERY_HISTORY_NOT_ADVANCED
```

Only `RECOVERY_SOURCE_UNAVAILABLE` and `RECOVERY_ABANDONED` are new ImportItem/ImportJob terminal
errors. `RECOVERY_REQUEUED` and history/owner errors are operation audit/UI codes, not public item
data. Public Import report schema version 1 and its redacted shape remain unchanged.

## Option A — additive V6 `sourceOperations` store (recommended)

### Durable shape and transactional contract

Add physical V6/schema `strava-stats-v2@6`, migration
`schema-0006-source-operation-lease`, and one `sourceOperations` object store keyed by `id`, with no
index. Migration creates the fixed row `source-operation:manager` without inspecting or changing
ImportJob, ImportItem, RawArtifact, SourceConnection, canonical, provenance, Legacy, or V1 data.

The row is an exact record with these fields:

```text
id                         "source-operation:manager"
status                     "idle" | "active"
kind                       null | "local_import" | "provider_sync"
phase                      null | "acquiring" | "importing" | "history_commit"
ownerId                    null | opaque UUID string
operationId                null | opaque UUID string
jobId                      null | opaque ImportJob string
sourceConnectionRevision   null | nonnegative safe integer
acquiredAt                 null | strict UTC timestamp
startedAt                  null | strict UTC timestamp
heartbeatAt                null | strict UTC timestamp
leaseExpiresAt             null | strict UTC timestamp
revision                   nonnegative safe integer
lastAction                 null | "completed" | "recovered" | "abandoned" | "failed"
lastActionKind             null | "local_import" | "provider_sync"
lastActionAt               null | strict UTC timestamp
lastResultCode             null | fixed redacted code
```

`active` requires kind, phase, owner/operation IDs, and all lease timestamps. Provider sync requires
original connection revision and acquiredAt once acquisition has succeeded; local import requires
both null. `idle` requires all current-operation fields from kind through lease expiry null. It may
retain only the redacted `lastAction*` audit quartet. Every mutation increments `revision` exactly
once. One internal mutation queue prevents same-owner heartbeat/job-link races.

The operation store API owns claim, heartbeat, phase/job link, complete, list orphan, recover, and
abandon transactions. Job link, recovery transitions, and abandon use one transaction spanning
`sourceOperations`, `importJobs`, `importItems`, and `rawArtifacts` as needed. ImportService gains
internal `recoverJob`/`abandonJob`; Source Manager gains redacted `getRecoveryState`, `recover`, and
`abandon`. `createSourceOperationStore` is a deliberate new public storage-factory export. Existing
Import report, SourceConnection, C3a/C3b artifact, Worker protocol, provider API, dependency, and
Service Worker surfaces do not change.

### Backup, restore, privacy, and rollback

Backup becomes exact format 3 and includes `operations/source-manager.jsonl`. Export refuses with
`ACTIVE_SOURCE_OPERATION` for every active row, including an expired unresolved row; the user must
explicitly Recover or Abandon first. An idle portable row clears owner, operation, job, phase,
connection revision, acquiredAt, and lease timestamps, but may retain the redacted `lastAction*`
audit values. Formats 1 and 2 remain accepted and restore additively into V6 with a new idle row.
Their preserved nonterminal jobs are shown as orphan candidates; no migration resumes, claims, or
terminalizes them. Orphans can recover durable bytes but can never advance provider history because
their operation provenance is absent.

This option gives atomic lease/job association and clear separation between authorization identity
and runtime coordination. It cannot coordinate other profiles/browsers/devices/storage buckets,
guarantee hidden heartbeat timing/pagehide completion, recover bytes never persisted, cancel a
committing transaction, or support an old V5 binary against a V6 database.

### Failure-first verification required before implementation acceptance

- Unit/state tests: every exact active/idle validator branch; UUID and null/zero rejection; all job
  and item eligibility states; valid/missing/malformed/committed RawArtifact; analyzing finalize;
  exact totals; idempotent action; revision conflict; backward/forward clock; quota at claim,
  heartbeat, job link, recovery, abandon, and completion; current transition regressions.
- Transaction tests: atomic operation+job link, Recover, Abandon, CAS loss, transaction abort, and
  committed-item retention; V5→V6 interrupted/idempotent migration; exact 15-store schema and no
  index; Legacy and all 14 V5 stores byte-for-byte/logically preserved.
- Backup tests: format-3 deterministic manifest/codec, active export refusal, idle redaction,
  formats 1/2 restore to idle V6, orphan nonterminal action, malformed owner/clock/code rejection,
  SourceConnection portability, atomic restore, quota, and V2/Legacy preservation.
- Controller/UI tests: no event-triggered action; local/provider mutual exclusion; lock unavailable;
  simultaneous Recover/Abandon; old-owner CAS loss; no automatic provider call; authority and C2
  revision loss; fixed conflict/unavailable copy; Demo isolation; close/pagehide ordering.
- Actual-served browser evidence: a local origin in a disposable synthetic Chromium profile, two
  tabs in the same storage bucket, request interception installed before first navigation, zero
  external requests, synthetic IndexedDB only, no credentials or private fixture. Prove one live
  lock owner, hidden/offline heartbeat without action, stale UI without auto-resume, crash/reload,
  simultaneous-action single winner, quota/abort retention, Recover versus Abandon, format-3
  export/restore, and zero Token/provider/user-profile access. Safari/Firefox/mobile remain
  unverified limitations, not inferred passes.

### Option A collision-audited literal cumulative allowlist

No glob, directory substitute, generated private fixture, or unlisted path is allowed. An unused
listed path stays untouched; discovering a required unlisted path stops for owner approval.

```text
README.md
source-manager.html
storage-backup.html
styles/source-manager.css
docs/tasks/pr-44-source-manager-recovery-lease.md
docs/migrations/indexeddb-v2.md
docs/guides/backup-guide.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
docs/guides/troubleshooting.md
js/source-manager.js
js/storage-backup.js
js/app/source-manager.js
js/app/source-manager-provider-sync.js
js/app/source-manager-recovery.js
js/app/storage-backup.js
js/pages/source-manager/source-manager.js
js/pages/storage-backup/storage-backup.js
js/import/state-machine.js
js/import/errors.js
js/import/import-service.js
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/import-store.js
js/storage/source-operation-store.js
js/storage/backup-manifest.js
js/storage/index.js
js/backup/codec.js
js/backup/backup-service.js
tests/import/import-state-machine.test.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/storage/source-operation-store.test.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/backup/codec.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/source-manager/source-manager-recovery.test.js
tests/source-manager/source-manager-provider-sync.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/docs/release-docs.test.js
```

## Option B — localStorage lease plus Web Lock, no schema change

Use the common contract with one exact localStorage key
`strava_stats_source_manager_operation_v1`. Its canonical JSON has exactly the Option A row fields
and invariants. The Web Lock linearizes same-bucket writers; each writer reads, validates, writes a
revision+1 record, reads it back, and fails closed unless the exact operation/revision matches.
Storage events are notifications only. Import recovery/abandon remains one ImportStore IndexedDB
transaction, but operation state and Import state cannot share a transaction.

Backup remains format 2 and excludes the key. Export must read and reject any active exact record as
`ACTIVE_SOURCE_OPERATION`; malformed localStorage fails closed as `SOURCE_OPERATION_UNAVAILABLE`.
Restore never imports the key. Any restored nonterminal job is an orphan and may be handled
explicitly under a newly claimed Web Lock, with no provider-history advance. Rollback removes the
C4 UI/controller but preserves the unrelated key; a future C4-aware build can read it. No database,
migration, storage-factory, SourceConnection, public Import report, Worker, dependency, Service
Worker, or provider contract changes.

This option avoids V6/format-3 migration, but it **cannot** atomically bind operation state to job
creation, recovery, abandon, Backup snapshot, or Import completion. A crash between IndexedDB and
localStorage writes creates an orphan or an active record without a job. localStorage quota,
blocking, clearing, eviction, or separate partition can erase coordination while Import data
remains. It therefore gives a failure-safe explicit orphan workflow, not the durable atomic audit
guarantee of Option A, and is not recommended for full P0 closure.

Required tests are the common controller/UI/browser matrix plus malformed/blocking/quota/clear and
every before/after-IndexedDB localStorage crash gap, orphan detection, format-2 exclusion, active
export refusal, and no automatic action. Actual-served evidence has the same disposable synthetic
constraints as Option A and must additionally clear/disable localStorage between transitions.

### Option B collision-audited literal cumulative allowlist

```text
README.md
source-manager.html
storage-backup.html
styles/source-manager.css
docs/tasks/pr-44-source-manager-recovery-lease.md
docs/guides/backup-guide.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
docs/guides/troubleshooting.md
js/source-manager.js
js/storage-backup.js
js/app/source-manager.js
js/app/source-manager-provider-sync.js
js/app/source-manager-recovery.js
js/app/storage-backup.js
js/pages/source-manager/source-manager.js
js/pages/storage-backup/storage-backup.js
js/import/state-machine.js
js/import/errors.js
js/import/import-service.js
js/storage/import-store.js
tests/import/import-state-machine.test.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/source-manager/source-manager-recovery.test.js
tests/source-manager/source-manager-provider-sync.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/docs/release-docs.test.js
```

## Option C — embed provider lease in SourceConnection (not recommended)

Add physical V6/schema `strava-stats-v2@6` and migration
`schema-0006-source-connection-operation`. Extend the exact SourceConnection record with an
`operation` object containing the Option A current-operation and audit fields except fixed row ID,
plus an independent `operationRevision`. Heartbeats increment only `operationRevision`; they must
not increment the existing C2 `revision`, otherwise every heartbeat would invalidate C3c's captured
history CAS. Connection transitions preserve the exact operation object; operation transitions
preserve C2 fields. Transactions that complete provider history clear the operation and CAS both
captured revision domains.

This carrier uses the common lock/heartbeat/action rules for `provider_sync`. It cannot honestly
represent local file import because no SourceConnection owns local data. To make the option complete
for Source Manager, local imports retain current single-document behavior and any stalled local job
appears only as an explicit orphan Recover/Abandon candidate under the global Web Lock. No local
operation heartbeat/audit can be durable before a job exists. The owner must explicitly accept that
scope reduction; otherwise Option C is ineligible.

Backup becomes format 3. Portable SourceConnection output resets its current `operation` to idle and
clears owner/operation/job/lease/connection-revision/acquiredAt fields while retaining only fixed
redacted audit values. Active export is refused. Formats 1/2 add an idle operation object on restore,
without changing preserved jobs. `createSourceConnectionStore` gains operation methods and record
shape, but no new factory/store/index is added. ImportStore/ImportService still gain explicit orphan
Recover/Abandon. Worker, dependency, Service Worker, provider, and public Import report stay fixed.

This option couples authorization identity/history to runtime coordination, creates two revision
domains in one record, raises heartbeat-versus-disconnect/reconnect/Backup conflict risk, and cannot
give local import the same durable pre-job lease. Rollback still requires a V6-aware build. It is
strictly less cohesive than Option A and is not recommended.

Required tests include the entire common and Option A failure-first matrix, substituting exact
SourceConnection nested validators, independent revision races, connect/reconnect/disconnect while
heartbeating, history dual-CAS, format-3 portable clearing, local orphan behavior, and proof that a
heartbeat never invalidates C2 revision. Actual-served evidence must cover provider and local paths
separately with the same disposable/no-network rules.

### Option C collision-audited literal cumulative allowlist

```text
README.md
source-manager.html
storage-backup.html
styles/source-manager.css
docs/tasks/pr-44-source-manager-recovery-lease.md
docs/migrations/indexeddb-v2.md
docs/guides/backup-guide.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
docs/guides/troubleshooting.md
js/source-manager.js
js/storage-backup.js
js/app/source-manager.js
js/app/source-manager-provider-sync.js
js/app/source-manager-recovery.js
js/app/storage-backup.js
js/pages/source-manager/source-manager.js
js/pages/storage-backup/storage-backup.js
js/import/state-machine.js
js/import/errors.js
js/import/import-service.js
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/import-store.js
js/storage/source-connection-store.js
js/storage/backup-manifest.js
js/storage/index.js
js/backup/codec.js
js/backup/backup-service.js
tests/import/import-state-machine.test.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/storage/source-connection-store.test.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/backup/codec.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/source-manager/source-manager-recovery.test.js
tests/source-manager/source-manager-provider-sync.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/docs/release-docs.test.js
```

## Open-PR collision audit

GitHub App readback on 2026-08-11 found open PRs #4, #31, #46, #49, #52, and this Draft #55.
PRs #31, #46, #49, and #52 each change exactly one distinct Task Brief and collide with no option
allowlist. PR #55 changes only this Task Brief. PR #4 is the cumulative 374-path
`integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994` →
`main@fe34535c39db421434a5e28cd26a57b3f71130e2` promotion PR, so it contains most existing candidate
paths by construction; it is not an independent feature head and C4 must not update, merge, close,
or retarget it. Before any later implementation authorization, repeat the collision audit against
then-open PRs and stop on any new feature-branch path overlap.

## Recommendation and precise owner decisions

Select **Option A**. It is the only option that gives one durable, privacy-minimized Source Manager
coordination domain for both local and provider imports, an atomic operation/job recovery boundary,
and a portable Backup rule without overloading SourceConnection authorization state. Reject Option
B for non-atomic/evictable audit state and Option C for authorization coupling and incomplete local
pre-job ownership.

No implementation is authorized until the owner decides all of the following explicitly:

1. select exactly Option A, B, or C;
2. approve or change the shared scope: one exclusive lease serializes both Real local import and
   provider sync, while Demo remains incapable;
3. approve or change the exact 15s visible / 30s hidden / 90s expiry timings and the mandatory
   Web-Lock fail-closed browser floor;
4. approve the exact Recover rule (only valid pending durable bytes; analyzing finalize) and
   Abandon terminalization/error codes;
5. approve no automatic resume on every listed lifecycle/observation event and no Web Lock `steal`;
6. approve provider-history recovery only with original provenance plus current Token/C2 authority
   and original revision CAS, otherwise retained items plus `RECOVERY_HISTORY_NOT_ADVANCED`;
7. for A/C, authorize V6, the named migration, format 3, active-export refusal, V5 rollback
   limitation, and the stated public/internal API changes; for B, explicitly accept non-atomic
   localStorage/orphan limitations;
8. approve that formats 1/2 and otherwise unowned preserved jobs become explicit orphan candidates,
   never implicit migration/resume/history advance;
9. approve the selected option's literal cumulative path allowlist and require a stop for every
   unlisted path or new open-PR collision; and
10. authorize a separate implementation tranche and separately authorize actual-served disposable
    synthetic Chromium evidence. No real account, Token, provider response, private fixture, user
    Chrome/profile, release, deployment, Ready, or merge is implied.

Until those decisions are returned, the only valid state is this open Draft documentation PR.
