# PR-05: IndexedDB v2 Schema

## Metadata

| Field | Value |
| --- | --- |
| Status | In review |
| Final review | Pending |
| Milestone | M2 |
| Base branch | `integration/v2` |
| Exact base SHA | `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110` |
| Feature branch | `codex/v2/storage` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/09cc/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Control tower decision; independent implementation review required later |
| Related PRD | [StravaStats v2 PRD](../product/stravastats-v2-prd.md) |
| Related ADRs | [ADR-0001](../architecture/adr/0001-canonical-activity.md), [ADR-0002](../architecture/adr/0002-stream-model.md), [ADR-0003](../architecture/adr/0003-repository-boundary.md), [ADR-0004](../architecture/adr/0004-import-pipeline.md), [ADR-0005](../architecture/adr/0005-analysis-versioning.md), [ADR-0006](../architecture/adr/0006-source-provenance.md) |
| Dependencies | PR-00 through PR-04C merged into `integration/v2` at the exact base SHA |
| Pull request | [Draft PR #11](https://github.com/XiChuan9/StravaStats/pull/11) |
| Created | 2026-08-04 |
| Last updated | 2026-08-04 |

## Goal

Freeze and implement the smallest independently testable physical IndexedDB v2
schema for the new `strava-stats-v2` database, together with its storage boundary,
transaction primitive, idempotent migration foundation, Repository adapter seam,
and backup-manifest metadata foundation, without changing any page read source or
opening the Legacy `strava-dashboard-cache` database for write, upgrade, clear, or
delete operations.

The control tower accepted the A3 decision package and subsequently authorized
and independently accepted B1, B2, B3, and their corrective subphases on
2026-08-04. The implementation remains bounded by the frozen phase allowlists
below. PR-05 is now in review with Final Review Pending; it remains Draft and is
not authorized for Ready, merge, or cleanup.

## Why now

PR-00 through PR-04C established repository safety, rescued the Legacy cache,
accepted the Canonical contracts, created the Repository boundary, and migrated
current consumers away from provider and persistence selection. PR-05 is the next
serial dependency before shadow writing and import work can safely begin.

## Investigation questions

- What IndexedDB, Legacy cache, Repository, and Canonical boundaries exist at the
  exact base, and what is their true runtime call graph?
- Which proposed stores and indexes are justified by an already accepted contract
  or an immediate PR-05 query, and which remain future-only proposals?
- What exact public storage API, transaction surface, migration state machine,
  stable error codes, and backup-manifest contract can PR-05 safely freeze?
- How can tests prove empty initialization, idempotency, upgrade, interruption,
  retry, rollback, quota/error handling, multi-connection `versionchange`, index
  queries, Legacy database preservation, and Legacy feature-flag fallback?
- Which checks require real browser IndexedDB evidence rather than
  `fake-indexeddb`, and is an approved isolated Browser/CDP surface available?
- Does PR-05 need a storage-specific nested `AGENTS.md`, any package change, or a
  change to an Accepted ADR? Any such expansion requires an explicit decision.

## Confirmed current-state facts

The A2 investigation will append the complete evidence and call graph. A0 already
confirmed:

- the worktree began clean at exact SHA
  `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110`;
- local `integration/v2`, `origin/integration/v2`, and the starting HEAD all point
  to that exact SHA;
- the remote feature branch did not exist before this task;
- PR-00 through PR-04C are present in the first-parent history of the base;
- `fake-indexeddb@6.2.5` is already a dev dependency;
- CI uses Node 24 and runs install, syntax, privacy, and the full Node test suite;
- the A0 local baseline passed 965 tests and left the tracked tree clean.

## Decisions frozen for implementation

The A3 control-tower decision freezes:

- exact public API and adapter ownership;
- physical schema version, stores, key paths, and indexes;
- transaction and migration state machines;
- stable redacted error codes;
- minimum backup-manifest contract;
- phase B1/B2/B3 allowlists and acceptance commands;
- browser evidence requirements;
- rollback boundaries and every unresolved contract question.

No implementation decision is accepted merely because it appears in a Proposed
document. The definitive A3 decision record below overrides the earlier
recommendations wherever it adds a correction or tighter boundary.

## In scope

### A0-A2 investigation scope

- Read-only repository, history, package, test, and GitHub inspection.
- This Task Brief and its investigation evidence.
- A Draft PR targeting `integration/v2`.
- A precise candidate implementation plan for later control-tower approval.

### Approved implementation scope within the active phase allowlist

- Physical schema for the independent `strava-stats-v2` database.
- Storage connection lifecycle and version-change handling.
- Narrow transaction and migration foundations.
- A Canonical Repository adapter boundary without consumer wiring.
- Minimal backup-manifest metadata describing the current physical schema.
- Deterministic synthetic offline storage tests using `fake-indexeddb` and any
  separately approved browser evidence.

## Out of scope

- PR-06 shadow writing or parity reporting.
- PR-07+ import jobs, decoders, normalizers, workers, identity, merge, restore, or
  source-management behavior.
- Page, tab, detail, analysis, or application read-source changes.
- Canonical cutover, dual write, feature-flag default changes, or Legacy fallback
  removal.
- Backup archive creation, restore execution, user-facing deletion, or automatic
  cleanup.
- Stream compression, Blob/TypedArray/chunk performance decisions without
  evidence and approval.
- Real athlete data, private fixtures, credentials, tokens, browser profiles, or
  network-backed tests.

## Allowed files

During A0-A2 the only writable repository path is:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
```

The candidate implementation allowlist will be proposed by A2 and remains
unauthorized until A3 acceptance.

## Prohibited files and operations

During A0-A2, do not modify:

```text
package.json
package-lock.json
docs/architecture/adr/**
docs/migrations/indexeddb-v2.md
js/**
tests/**
.github/**
integration/v2
main
maintenance/v1
```

Never read, write, upgrade, clear, overwrite, rename, or delete
`strava-dashboard-cache` as part of PR-05 implementation. Never delete user or
Legacy data, switch page reads to Canonical, rebase, amend, force-push, merge the
PR, or clean up the branch/worktree without explicit authorization.

## Interfaces and expected outputs

The exact public API is intentionally not frozen during A1. A2 must derive the
smallest API from accepted contracts and immediate PR-05 tests, and must keep:

- application IDs as opaque non-empty strings;
- stored contract data plain and JSON-safe unless a separately approved physical
  encoding stays entirely behind the storage adapter;
- accessor, Proxy, symbol, custom-prototype, cyclic, and non-finite inputs
  fail-closed without getter execution or mutation;
- public errors deterministic and redacted;
- the Repository boundary as the only future consumer access path.

## Acceptance criteria

### A0-A2

- [x] Exact local/base/remote SHA and clean starting state verified.
- [x] Minimum baseline commands executed and results recorded truthfully.
- [x] Draft PR exists and contains only this Task Brief.
- [x] Current storage and Repository call graph is documented with file evidence.
- [x] Candidate schema/API/state machine/error/backup contracts are explicit.
- [x] Proposal-only decisions are separated from accepted facts.
- [x] Candidate allowlists, phase plan, tests, rollback, and open decisions are
      ready for control-tower review.
- [x] A2 ended with `Status = Awaiting decision`; implementation had not started.

### Candidate implementation acceptance after A3

- Empty database initialization and repeated initialization are safe.
- Physical schema upgrade and migration retry are deterministic and idempotent.
- Failed transactions and quota/error injection leave no partial activity.
- Multi-connection `versionchange` behavior is explicit and tested.
- Every index has a demonstrated query and deterministic result.
- Legacy database remains unchanged and is never opened for readwrite/upgrade.
- Legacy remains the default and fallback page read path.
- Backup metadata can describe the exact implemented schema.
- Errors are actionable but disclose no record values, locations, credentials, or
  underlying private messages.

## Required automated checks

Repository minimum, both before implementation and at exact implementation head:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Candidate targeted commands and browser evidence will be frozen by A3. A Node
`fake-indexeddb` pass must never be reported as real-browser IndexedDB evidence.

## Manual verification

Real Browser/CDP verification is required for the physical browser implementation,
but not as a substitute for deterministic Node fault injection. The current
in-app Browser can navigate a served, isolated synthetic harness. Its read-only
evaluation sandbox does not expose `indexedDB` or `navigator`, so B3 needs a
dedicated tracked page-origin harness similar to the existing consumer smoke
pages. Unexecuted quota-pressure, browser-migration, and CI checks must remain
`Not run`.

## Privacy and security impact

- A0-A2 reads only repository-controlled synthetic code, docs, tests, and Git
  metadata; it does not read tokens, accounts, real activities, GPS, HR, power,
  private fixtures, or the user's browser profile.
- Future tests must use inline or committed deterministic synthetic values and
  remain offline.
- Error and diagnostic contracts must omit raw record values, storage payloads,
  causes, provider messages, credentials, and precise locations.
- No external service receives activity data.

## Migration impact

A0-A2 has no runtime or database impact. Future PR-05 work may create or upgrade
only `strava-stats-v2`. Migration design must be additive, idempotent, observable,
recoverable, and independent of Canonical/parser/analysis/backup format versions.
Legacy `strava-dashboard-cache` remains untouched.

## Rollback procedure

For A0-A2, revert the Task Brief commits if required; there is no runtime or data
rollback. For later implementation, rollback means revert the feature commit and
keep Legacy mode/read paths active. Do not delete either database as rollback and
do not write V2 data back into Legacy storage. Failed initialization or migration
must close the V2 connection, preserve any previously committed V2 data, and
allow the application to continue on Legacy.

## A2 investigation record

### Base, dependency, package, and CI facts

Git history and GitHub PR metadata agree on the merged dependency chain:

| PR | Merge commit on `integration/v2` | GitHub result |
| --- | --- | --- |
| PR-00 / #3 | `8d1d498156f0d37171fc261c3afef333120a039e` | merged |
| PR-01 / #5 | `b96bb6aa7e9929845af51b5151f7ba195b4489d4` | merged |
| PR-02 / #6 | `5137afeff2530a228c2be79af54bd04912a0c389` | merged |
| PR-03 / #7 | `2178858f29d6c8efe5cf45de5ff07443387d2577` | merged |
| PR-04A / #8 | `66cdc2c457457a93bec46fdf98c5a508c96770c9` | merged |
| PR-04B / #9 | `eb78e19482f470edf4ae5f2483a579db5efec648` | merged |
| PR-04C / #10 | `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110` | merged |

Additional facts:

- The npm project is native ESM and uses the built-in `node:test` runner.
- CI runs Node 24 on pull requests and on pushes to the three long-lived
  branches. It executes `npm ci`, syntax, privacy, and the full test suite.
- `fake-indexeddb@6.2.5` is already in `devDependencies` and the lockfile. PR-05
  needs no dependency or package-file change.
- The exact base contains 965 passing tests. Existing IndexedDB tests are Legacy
  rescue/auth tests; there is no V2 storage module or `tests/storage/` suite.
- `fake-indexeddb` describes itself as a pure-JavaScript in-memory implementation:
  data is not persisted to disk. Its bundled README reports 1369/1653 (82.8%)
  IndexedDB Web Platform Tests for v6.2.5 and notes that Node-only runs omit
  browser-only areas such as workers and cross-origin isolation. Its factory also
  does not model storage keys. It supports connection `versionchange`, `blocked`,
  transaction rollback, explicit `commit`, and fresh isolated `IDBFactory`
  instances, but it is not evidence for browser persistence or real quota.

### Current Legacy IndexedDB call graph

```text
Summary/detail/Run Plus consumers
  -> public Repository entry (`js/repository/index.js`)
  -> Factory (`js/repository/factory.js`)
  -> LegacyRepository
     -> activity cache dependency
        -> `getCachedActivities` / `saveCachedActivities`
        -> `js/services/activity-cache.js`
        -> indexedDB.open("strava-dashboard-cache", 1)
        -> store `entries`, keyPath `key`, key `strava_activities`

Legacy rescue/export planning
  -> `js/services/legacy-cache/index.js`
  -> `readLegacyIndexedDb`
  -> indexedDB.open("strava-dashboard-cache") with no version
  -> aborts `onupgradeneeded` so a missing Legacy DB is not created
  -> readonly `entries.get("strava_activities")`

Legacy restore (separate, explicit workflow)
  -> signed restore plan and target recheck
  -> readwrite `entries` only after validation/conflict checks
  -> compensating rollback on later localStorage failure
```

Important boundaries and exceptions:

- `activity-cache.js` is the active V1 persistence implementation. It may create
  Legacy database version 1 and performs readonly/readwrite transactions. PR-05
  must not import, call, or modify it.
- Rescue Reader is intentionally versionless and readonly. It aborts accidental
  database creation, closes on `versionchange`, and returns stable Legacy error
  codes. It is useful design evidence, not a V2 adapter to reuse.
- Restore is an independently authorized destructive-capable Legacy workflow.
  PR-05 must not reuse its write/delete helpers or expose a restore/clear API.
- `js/pages/gear/gear-analysis.js` still directly reads the Legacy activity cache;
  it is a pre-existing V1 exception outside PR-05 and is not a reason to wire V2
  storage to a page.
- No existing runtime opens `strava-stats-v2`.

### Current Repository and consumer call graph

The public Repository entry exports exactly:

```text
createRepository
RepositoryError
REPOSITORY_ERROR_CODE
REPOSITORY_SOURCE
REPOSITORY_WARNING_CODE
```

The Factory accepts only `mode: "legacy"`; any other mode returns
`UNSUPPORTED_MODE`. `DEFAULT_FEATURE_FLAGS.dataRepositoryMode` is `legacy`, while
the current application composition roots do not consult it for Repository
selection. Instead, main, Router, and all four detail roots explicitly call:

```js
createRepository({ sessionMode: "real" | "demo", mode: "legacy" })
```

`LegacyRepository` and `DemoRepository` expose the seven frozen methods:

```text
listActivities
getActivity
getStreams
getAthlete
getZones
getGears
getGear
```

The current success envelope is exactly `{ data, source, warnings, partial }` and
`REPOSITORY_SOURCE` has only `cache`, `network`, `demo`, and `mixed`. A Canonical
Repository implementation would therefore need new projection, source, factory,
and public error decisions. Those are not implied by PR-05's storage schema and
must not be changed in A0-A2 or silently added during implementation.

### Current Canonical persistence inputs

The accepted public contract entry exports exactly three pure validators:

```text
validateCanonicalActivity(value)
validateCanonicalStreamSet(value)
validateImportedActivityBundle(value)
```

An `ImportedActivityBundle` is the only accepted full write boundary. It contains
exactly `schemaVersion`, `activity`, `streams`, `laps`, `events`, `sources`,
`devices`, `warnings`, and `versionMetadata`. Relevant storage facts are:

- every application-level ID is a non-empty opaque string;
- `CanonicalActivity.id` is the activity primary identity;
- `CanonicalStreamSet` holds `activityId`; an individual series intentionally
  does not;
- Lap/Event/ActivitySource/Device records already have stable opaque IDs and
  accepted relationships;
- Source `externalId`, `rawArtifactId`, and `deviceId` are nullable/optional;
- contract values are plain JSON-safe data; missing, null, and zero remain
  distinct;
- validators fail closed for accessors, revoked/throwing Proxies, reflection
  failures, unsafe JSON, bad references, and unsupported schema versions without
  modifying input or echoing values in diagnostics;
- stream runtime arrays are Accepted logical data, but Array/TypedArray/Blob,
  compression, and chunking were explicitly deferred as physical decisions;
- RawArtifact, ImportJob/Item, UserOverride, AnalysisSnapshot, merge, restore,
  hash canonicalization, and duplicate semantics are not accepted contracts.

Dependency direction for PR-05 must therefore be:

```text
Canonical contracts <- V2 storage <- future Canonical Repository <- consumers
```

Contracts must never import storage, storage must not import pages/tabs/analysis,
and current consumers must continue to select the Legacy Repository.

## A2 recommended decision package accepted by A3

The control tower accepted the six recommendations in this section on
2026-08-04, subject to the tighter corrections in the definitive A3 decision
record below. Where wording differs, the definitive record controls.

### Recommended physical schema version and record encoding

Use IndexedDB physical version `1` and database name exactly:

```text
strava-stats-v2
```

Store structured-cloneable plain JSON-safe objects. For physical version 1, keep
each accepted StreamSeries as one plain-array record. Do not introduce Blob,
TypedArray, compression, or chunking without the PR-22 large-stream performance
evidence and a separate additive migration. This keeps null/zero and all accepted
stream types lossless and makes backup inspection deterministic.

The `activities` record is a physical envelope, not a mutation of the accepted
CanonicalActivity:

```js
{
  activity,          // exact CanonicalActivity
  warnings,          // exact accepted bundle warning array
  versionMetadata    // exact accepted VersionMetadata
}
```

Each `streamSeries` physical record is:

```js
{
  activityId,
  streamType,
  series             // exact accepted StreamSeries
}
```

This preserves the logical contracts while giving IndexedDB stable key paths.
Sources, laps, events, and devices are stored as their exact accepted plain
objects. The adapter reconstructs a bundle with sources/devices sorted by opaque
string ID, laps/events by accepted numeric `index`, and series by opaque
`streamType`; IDs are never converted or compared numerically.

### Recommended object stores and indexes

Freeze only the following eight stores in physical version 1:

| Store | keyPath | Indexes | Immediate query or invariant |
| --- | --- | --- | --- |
| `metadata` | `key` | none | direct `"database"` metadata lookup and exact schema verification |
| `migrations` | `id` | none | direct migration-state lookup; expected registry is small |
| `activities` | `activity.id` | `byStartTimeUtc` = `activity.startTimeUtc`; `bySportCategoryAndStartTimeUtc` = `[activity.sportCategory, activity.startTimeUtc]` | ordered activity scan and ordered sport filter |
| `activitySources` | `id` | `byActivityId` = `activityId` | reconstruct one activity's provenance |
| `streamSeries` | `[activityId, streamType]` | `byActivityId` = `activityId` | direct requested-type get by compound primary key; all-series query by activity |
| `laps` | `id` | unique `byActivityIdAndIndex` = `[activityId, index]` | deterministic ordered laps for one activity |
| `events` | `id` | unique `byActivityIdAndIndex` = `[activityId, index]` | deterministic ordered events for one activity |
| `devices` | `id` | none | direct reads for device IDs referenced by sources |

All indexes are non-unique unless explicitly marked. IndexedDB does not provide
foreign keys; `putBundle` must validate the whole accepted bundle before opening a
readwrite transaction and must write every related record atomically.

Do not create `activitySources.[provider, externalId]` in PR-05. Null external IDs
and exact-identity/update semantics are explicitly deferred by ADR-0006. Do not
create a redundant `[activityId, streamType]` index because it is the primary key.
Do not add `migrations.version`; direct deterministic IDs cover the PR-05 registry.

### Proposed database metadata record

The `metadata` store contains exactly one PR-05-owned record:

```js
{
  key: "database",
  databaseName: "strava-stats-v2",
  schemaId: "strava-stats-v2@1",
  indexedDbVersion: 1,
  canonicalSchemaVersion: 1,
  createdAt,                    // fixed-millisecond UTC from injected clock
  createdByApplicationVersion  // injected non-empty opaque string
}
```

Repeated initialization reads and verifies this record. A mismatch fails closed
with `SCHEMA_MISMATCH`; it is not silently repaired or overwritten. No last-opened
timestamp is written on read-only startup.

### Proposed migration registry and state machine

Code owns a sequential structural registry. Version 1 uses deterministic ID
`schema-0001-bootstrap`. `onupgradeneeded` performs only short structural work,
writes database metadata, and writes the bootstrap record as `completed` in the
same versionchange transaction. If that transaction aborts, IndexedDB restores
the previous version/schema; no partial metadata or migration record survives and
an explicit later `initialize()` retries the same registry step.

Persisted post-open migration records use the Proposed minimum fields:

```text
id, fromVersion, toVersion, status, startedAt, completedAt,
applicationVersion, inputSummary, outputSummary, errorCode, retryCount
```

The recommended state machine is:

```text
absent -> pending -> running -> completed
                         \----> failed -> running (retryCount + 1)
running found on startup -> failed(MIGRATION_INTERRUPTED) -> running
running -> rolled_back only through a future explicit approved compensating job
completed / rolled_back -> terminal
```

The status transition to `running` is committed before a data transaction. The
data transformation itself is one atomic transaction. Success commits
`completed`; abort commits a redacted `failed` record afterward. A crash between
data commit and status commit is handled by the mandatory idempotent retry: the
step verifies its output and completes without duplicating records. PR-05 ships no
large data transformation; the runner and fault-injected synthetic test establish
the framework only.

`indexedDbVersion`, `canonicalSchemaVersion`, parser, normalizer, analysis, and
backup format versions remain independent. An IndexedDB version increase is only
for physical schema.

### Proposed public storage API and adapter boundary

Create a new public storage entry `js/storage/index.js` with exactly:

```text
V2_DATABASE_NAME
V2_DATABASE_VERSION
V2_SCHEMA
STORAGE_ERROR_CODE
StorageError
createCanonicalStore
```

`createCanonicalStore({ indexedDB, IDBKeyRange, now, applicationVersion })` is
side-effect free and returns exactly:

```text
initialize()
putBundle(bundle)
getBundle(activityId, { streamTypes } = {})
listActivities({ sportCategory, limit, direction } = {})
createBackupManifest()
close()
```

Recommended semantics:

- `initialize()` opens version 1, runs/verifies schema and migrations, closes and
  reopens once on a newly created database, then returns a frozen safe database
  descriptor. Repeated calls do not add records.
- `putBundle()` first calls `validateImportedActivityBundle`. It queues one
  readwrite transaction across the six Canonical record stores. A fully
  byte-equivalent existing bundle returns
  `{ status: "already-present", activityId }`; a new bundle returns
  `{ status: "committed", activityId }`; any differing primary-key collision
  aborts with `CONFLICT`. It never silently overwrites a different record.
- `getBundle()` accepts one opaque string ID. Omitted/empty `streamTypes` means all
  stored series; otherwise only the requested distinct opaque types are read by
  compound primary key. Missing activity returns `null`; broken stored references
  fail with `SCHEMA_MISMATCH` rather than inventing data.
- `listActivities()` uses the exact activity indexes, returns only detached
  CanonicalActivity values, defaults to descending time and a bounded limit, and
  never exposes IDB records, cursors, transactions, or store names.
- `createBackupManifest()` reads metadata and record counts only; it does not read
  or export raw activity content.
- `close()` is an idempotent Promise-returning terminal barrier. It waits for an
  in-flight open or upgrade to reach a platform terminal event and closes any
  late connection before resolving. `onversionchange` immediately closes and
  marks the handle stale. No operation silently retries; explicit `initialize()`
  may reopen.

This is a Canonical persistence adapter for a future Repository, not a new public
Repository implementation. PR-05 should not modify `js/repository/index.js`, the
seven-method contract, sources, Factory modes, projection, pages, or Feature Flag
wiring. If “Repository Adapter” in the development plan is intended to require a
new `CanonicalRepository`, that is a real Accepted-contract expansion and needs a
separate control-tower decision before implementation.

### Proposed internal transaction API

Keep the low-level helper private to `js/storage/`:

```text
runTransaction(database, { storeNames, mode, operation }, enqueue)
```

- `storeNames` must be an exact non-empty dense array of known V2 stores;
- mode is only `readonly` or `readwrite`;
- `enqueue` is synchronous and may only queue requests through the supplied
  narrow context; no raw database or transaction escapes the storage module;
- the Promise resolves only on `transaction.oncomplete`, never on a request's
  `onsuccess`;
- synchronous throw, request error, `error`, or `abort` aborts once and maps to a
  stable redacted `StorageError`;
- there is no automatic retry and no public delete/clear/database-delete helper;
- all single-bundle records are written in one transaction; future ImportItem
  status joins that transaction only after its contract is accepted in PR-07.

### Proposed stable storage errors

Freeze the following safe codes:

```text
UNAVAILABLE
INVALID_REQUEST
DATA_INVALID
OPEN_FAILED
OPEN_BLOCKED
CONNECTION_STALE
VERSION_UNSUPPORTED
SCHEMA_MISMATCH
MIGRATION_FAILED
MIGRATION_INTERRUPTED
TRANSACTION_ABORTED
QUOTA_EXCEEDED
CONSTRAINT_VIOLATION
CONFLICT
NOT_FOUND
```

`StorageError` exposes only `name`, `code`, `message`, `operation`, and
`retryable`; it is immutable and its `toJSON()` returns those same fields. It does
not retain or serialize `cause`, DOMException message, database payload, key,
index key, activity ID, provider, location, filename, Token, or raw record.
`QuotaExceededError`, `ConstraintError`, `VersionError`, and blocked/stale cases
map by safe DOMException `name` only. Storage errors remain internal until a
future Canonical Repository explicitly maps them to its public contract.

### Proposed backup-manifest foundation

Freeze this metadata-only shape:

```js
{
  backupFormatVersion: 1,
  databaseName: "strava-stats-v2",
  indexedDbVersion: 1,
  canonicalSchemaVersion: 1,
  createdAt,
  applicationVersion,
  stores: [
    { name, recordCount }
  ],
  files: [],
  hashes: []
}
```

Store rows are in frozen schema order and counts are finite non-negative integers.
PR-05 does not serialize files or records, so `files` and `hashes` must be empty;
it must not invent hashes over mutable in-memory objects. PR-21 may add file
descriptors and SHA-256 entries while preserving these fields. Restore, staging,
compatibility overwrite decisions, and archive streaming remain PR-21.

### Proposal freeze and deferral table

| Candidate from Proposed documents | A3 recommendation | Reason |
| --- | --- | --- |
| Separate database `strava-stats-v2` | freeze in PR-05 | repeated accepted safety direction and PR-05 target |
| `activities`, `activitySources`, `streamSeries`, `laps`, `events`, `devices` | freeze in PR-05 | map directly to Accepted PR-02 bundle records |
| `metadata`, `migrations` | freeze in PR-05 | required for physical schema verification, retries, and backup metadata |
| Plain-array StreamSeries record | freeze for physical v1 | lossless accepted values; no performance evidence for a more complex encoding |
| `activities` time/sport indexes and per-activity relation indexes | freeze in PR-05 | immediate adapter queries are documented above |
| `rawArtifacts`, `importJobs`, `importItems` | defer to PR-07+ | no Accepted record/state contract; import status transaction not yet authorized |
| `userOverrides` | defer | model and ownership explicitly deferred by ADR-0001 |
| `analysisSnapshots`, `timelineSnapshots` | defer | hash, invalidation, retention, and result contracts explicitly deferred by ADR-0005 |
| `mergeCandidates`, `mergeDecisions` | defer to PR-19/20 | exact/ambiguous identity and merge semantics are not accepted |
| `sourceConnections`, `settings` | defer | ownership, keys, and lifecycle not frozen; avoid mixing UI/user state with provider data |
| `[provider, externalId]`, `sha256`, import, analysis, merge indexes | defer with their stores/contracts | uniqueness, null, canonicalization, and query semantics remain undecided |
| Blob/TypedArray/chunk/compression | defer to performance migration | null/mixed stream semantics and 200k-point browser evidence are not yet available |
| Shadow write, parity, page read selection | defer to PR-06 and cutover PRs | explicitly out of PR-05 |
| Full backup export/restore and cleanup | defer to PR-21 | only manifest foundation is authorized |

## A3 approved phase plan and allowlists

### B1: physical schema, connection, errors, and governance

Final status: **Completed / PASS** on 2026-08-04 after independent B1, B1.1,
and B1.2 review. This completion authorizes publication of the exact ten B1
paths below; it does not authorize B2 or B3.

Approved B1 writable paths:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/AGENTS.md
js/storage/index.js
js/storage/constants.js
js/storage/errors.js
js/storage/schema.js
js/storage/database.js
js/storage/migrations.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-boundaries.test.js
```

`js/storage/AGENTS.md` is recommended because PR-05 creates a new persistence
domain with a unique hotspot owner. It should forbid Legacy database imports,
delete/clear shortcuts, raw errors, unsafe inputs, consumer imports, and real-data
tests while requiring the accepted validator boundary and explicit connection
lifecycle.

B1 acceptance:

```bash
node --test tests/storage/indexeddb-v2-schema.test.js
node --test tests/storage/indexeddb-v2-boundaries.test.js
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

### B2: atomic Canonical adapter, queries, and manifest foundation

Final B2 phase status: **Completed / PASS.** Independent control-tower review
accepted B2 and B2.1, including the A3.1 correction, and authorized B2
Finalization. At that phase boundary the overall PR-05 status remained
`In progress` because B3 had not started. The initial B2 authorization permitted
local work only; its separate Finalization authorization permitted the exact
ten-path commit, push, and Draft PR update without authorizing B3, Ready state,
merge, or cleanup.

Additional B2 writable paths:

```text
js/storage/transaction.js
js/storage/canonical-store.js
js/storage/backup-manifest.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/canonical-store.test.js
tests/storage/backup-manifest.test.js
```

B2 acceptance adds:

```bash
node --test tests/storage/*.test.js
```

### B3: real-browser storage lifecycle and final gates

The control tower authorized local B3 implementation and Browser/CDP evidence.
Finalization remains separately gated. The only additional writable path is:

```text
tests/storage/indexeddb-v2-browser-smoke.html
```

The harness must be served from loopback in a disposable in-app Browser/CDP
session and use only synthetic records. It must expose a deterministic final
status/result in the DOM, close all connections, and leave no Service Worker or
external network request. The Task Brief records environment, browser version,
gates, database names/versions, and Not-run items; it must not record activity
payloads or precise synthetic coordinates.

Final B3 acceptance reruns:

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/storage/*.test.js
npm test
git diff --check
```

Then require exact-head pull-request CI success and an independent review before
any later Ready-for-review transition. B3 does not authorize changing the PR out
of Draft without a later control-tower instruction.

### Cumulative candidate allowlist

Only the 17 paths listed across B1-B3 are candidates. The following remain
prohibited unless the control tower explicitly expands scope:

```text
package.json
package-lock.json
docs/architecture/adr/**
docs/migrations/indexeddb-v2.md
js/app/**
js/data/contracts/**
js/repository/**
js/services/**
js/pages/**
js/tabs/**
js/analysis/**
.github/**
api/**
sw.js
tests/fixtures/private/**
```

IndexedDB Schema/Migration, every `js/storage/**` path, and the package files are
hotspots with a single owner. No package owner is needed because no package diff
is recommended.

## A3 test strategy

| Scenario | Node/fake evidence | Browser evidence | Required assertion |
| --- | --- | --- | --- |
| Empty initialization | fresh `IDBFactory` | disposable origin | exact eight stores/indexes, metadata, completed bootstrap record |
| Repeated initialization | same factory, repeated open/close | reload/reopen | no duplicate records or schema mutation |
| Schema upgrade | seed synthetic older V2 schema through internal test registry | dedicated harness upgrade | ordered steps only; exact final version/schema |
| Upgrade interruption/retry | abort injected versionchange step, retry | abort then reopen | prior version intact; retry succeeds once |
| Data migration interruption/retry | stale `running`, injected atomic abort | browser close/reopen if deterministic | failed/interrupted recorded safely; retryCount increments; no duplicate output |
| Bundle transaction rollback | fail after first queued write | deterministic constraint abort | all Canonical stores unchanged |
| Quota/error | injected `QuotaExceededError`/request failure | real quota pressure Not run in PR-05 unless safely reproducible | safe code, transaction rollback, no cleanup/delete |
| Multi-connection/versionchange | two fake connections | two same-origin connections | old connection closes; blocked is observable; explicit retry only |
| Index queries | synthetic opaque IDs, duplicate times/sports | same queries in harness | exact order/filter/type selection and no numeric ID conversion |
| Legacy unchanged | synthetic Legacy sentinel before/after | browser DB inventory and sentinel | version, stores, counts, and bytes unchanged; zero Legacy readwrite/upgrade |
| Feature Flag/fallback | boundary/source assertions | import/open smoke | defaults and every page remain Legacy; storage import has zero I/O |
| Accessor/Proxy/JSON safety | getter/Proxy/cycle/non-finite fixtures | minimal valid structured clone | zero getter/trap side effects where measurable; `DATA_INVALID`; no write |
| Error privacy | DOMException/message sentinels | console/DOM audit | no raw cause, key, ID, payload, Token, GPS/HR/Power value |
| Backup manifest | deterministic injected clock/version | counts against browser stores | exact safe fields/counts; empty files/hashes; no record content |

`fake-indexeddb` evidence must be labelled Node/fake. It can prove application
logic against its implementation, but not disk persistence, eviction, browser
quota, process crash durability, Safari/Firefox parity, worker concurrency, or
the user's actual browser environment.

The A2 capability probe started the repository's loopback server and used a
disposable in-app Browser. The existing tracked summary smoke page loaded and
reported its own consumer gates, and its source demonstrates that page-origin
JavaScript can call `indexedDB.databases()`. However, the Browser's read-only
`playwright.evaluate` sandbox exposed neither `indexedDB` nor `navigator`, so it
cannot directly synthesize the V2 lifecycle. No V2 or Legacy IndexedDB was opened,
upgraded, written, cleared, or deleted by the probe. Tabs were finalized and the
server stopped. Therefore the B3 tracked page-origin harness is both necessary
and feasible; the A2 probe is not PR-05 browser test evidence.

## A3 privacy, migration, and rollback freeze

- Tests use only inline deterministic synthetic objects. No private fixture,
  real file, Token, account, browser profile, GPS route, HR curve, power curve,
  or provider network is read.
- Storage options and bundle inputs are inspected through data descriptors and
  accepted validators before cloning or IndexedDB calls. Proxies/accessors fail
  closed; `__proto__` and `constructor` remain ordinary JSON data keys.
- Application IDs remain opaque strings in primary/index keys. Compound
  IndexedDB keys are physical keys, not application IDs.
- Production storage code contains only the literal database name
  `strava-stats-v2` and must not import Legacy cache modules/constants.
- No API exposes `deleteDatabase`, store `clear`, bulk cleanup, restore, or
  overwrite-as-recovery.
- Feature Flag default and all current Factory calls remain Legacy. A V2 failure
  can therefore be handled by closing V2 and leaving current runtime behavior
  untouched.
- Rolling back code means an ordinary revert. Rolling back data means retain the
  last committed V2 version and Legacy database; do not downgrade IndexedDB in
  place, delete either database, or copy V2 data into Legacy.

## Definitive A3 control-tower decision record

The control tower approved all six A2 questions on 2026-08-04. The physical
database is version `1`, named exactly `strava-stats-v2`, with only the eight
stores and indexes listed above. All other Proposed stores and indexes are
deferred. A StreamSeries is one plain-array structured-cloneable record per
series in v1; Blob, TypedArray, chunking, and compression require later browser
performance evidence and an additive migration.

“Repository Adapter” means only the storage-facing `createCanonicalStore` seam
in PR-05. The existing Repository entry's five exports, Repository seven-method
contract, Factory modes, sources, projections, consumers, Feature Flag, pages,
tabs, and analysis remain unchanged. The public storage API, private transaction
boundary, migration state machine, safe error codes, database metadata, and
metadata-only backup manifest described above are approved with these mandatory
corrections:

- `V2_SCHEMA` is a deeply frozen JSON-safe physical descriptor. It contains no
  IndexedDB handle, database, transaction, request, cursor, function, mutable
  `Set`, or mutable `Map`.
- “Already present” means getter-free strict JSON-safe structural equality. It
  never uses `JSON.stringify` or property enumeration order as semantic
  equivalence, and it preserves absent, `null`, and `0`. If any existing
  primary-key record differs, `putBundle` aborts the whole transaction with
  `CONFLICT`; no partial record is committed.
- `putBundle` first calls `validateImportedActivityBundle`, then creates a
  detached validated snapshot. Accessors, Proxies or reflection failure, cycles,
  symbols, special objects, and other non-JSON-safe values fail closed before a
  readwrite transaction opens. Neither `putBundle` nor `getBundle` modifies,
  sorts, or freezes caller input.
- `getBundle` returns a deterministic storage read projection: laps and events
  by accepted numeric `index`, stream series by opaque `streamType`, and sources
  and devices by opaque string ID. This does not modify persisted objects and
  does not claim to preserve original caller array order. `bundle.schemaVersion`
  is reconstructed only from explicit, validated, mutually consistent persisted
  fields. Bundle warnings and all six VersionMetadata fields are preserved
  losslessly.
- `listActivities` accepts only an omitted filter or one of the ten Accepted
  `sportCategory` values; `limit` defaults to `100` and must be an integer from
  `1` through `500`; `direction` defaults to `desc` and accepts only `asc` or
  `desc`. Equal `startTimeUtc` values use opaque string ID code-unit order as the
  stable tie-breaker; IDs are never parsed or compared numerically.
- `blocked`, open lifecycle, cancellation, `versionchange`, and late success
  follow the PR-01 cancelled-request principle. A public function never returns
  while a background request can still mutate schema. If a platform request
  never reaches a terminal event it may remain pending; code must not manufacture
  an early timeout failure and leave a later schema mutation behind. A late
  connection result after cancellation is closed before the call settles.
- No production or test helper exposes or calls `deleteDatabase`, store
  `clear`, or any real Legacy open/upgrade/readwrite path. Legacy preservation
  uses an independently created synthetic Legacy-like sentinel in the same
  `IDBFactory` storage realm as V2 and proves both V2 success and failure leave
  its version, stores, indexes, count, and record bytes untouched.
- Migration status and data consistency use same-transaction structural
  bootstrap plus fault injection for the interruption/crash window and
  idempotent retry. PR-05 does not create a fake large-scale migration.
- `StorageError` and every public result are immutable and detached. They retain
  no raw cause, DOMException message, key, activity ID, payload, location,
  credential, or secret.

The approved cumulative allowlist contains exactly these 17 paths:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/AGENTS.md
js/storage/index.js
js/storage/constants.js
js/storage/errors.js
js/storage/schema.js
js/storage/database.js
js/storage/migrations.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-boundaries.test.js
js/storage/transaction.js
js/storage/canonical-store.js
js/storage/backup-manifest.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/canonical-store.test.js
tests/storage/backup-manifest.test.js
tests/storage/indexeddb-v2-browser-smoke.html
```

B1 was completed with only the first ten paths changed in that phase. Later B2
and B3 authorization was separately recorded and accepted below. Package and lock files, Accepted
ADRs, `docs/migrations/indexeddb-v2.md`, Repository/runtime/page/tab/analysis
code, Feature Flag code, CI workflows, and every path outside the active
allowlist are prohibited.

The B1 public entry exposes the six approved exports and its frozen factory
skeleton exposes all six approved method names. Only `initialize()` and `close()`
have storage behavior in B1. `putBundle`, `getBundle`, `listActivities`, and
`createBackupManifest` fail closed with the stable `UNAVAILABLE` code and perform
zero IndexedDB I/O until B2 authorizes their implementation. B1 creates the
physical schema, verifies repeated initialization, closes on `versionchange`,
and establishes the bootstrap migration record atomically. It does not implement
Canonical writes, queries, list pagination, or a manifest.

B3 must include a tracked loopback, disposable-profile, page-origin Browser/CDP
synthetic harness. Node `fake-indexeddb` evidence is never described as browser
evidence. Real quota pressure, crash durability, Safari, Firefox, mobile,
workers, 5k/10k activity scale, and 200k-point performance remain explicitly
Not run in PR-05.

Rollback remains code-only: revert the implementation while Legacy continues as
the default read path. Never downgrade, overwrite, clear, or delete V2 or Legacy
data, and never copy V2 data into Legacy. A failed upgrade must abort and close;
an explicit later initialization may retry the same additive registry step.

### A3.2 governance consistency correction

Status: **Completed / PASS (Accepted).** The stale lower A3 `listActivities` maximum was
corrected to `1..500`, matching the later control-tower B2 freeze,
implementation, and accepted tests. This is bookkeeping for the same public
method boundary; it changes no product code, API, database version, store, or
index. This Task Brief has one authoritative maximum: `500`.

## B1.1 independent-review correction record

Final status: **Completed / PASS**. The control tower independently reproduced
the initial B1 candidate and returned `REVISE` before any B1 file was staged,
committed, pushed, or added to the Draft PR. B1.1 stayed inside B1 and corrected
the three findings below without authorizing B2.

The three root causes were:

1. `close()` returned synchronously while an open/upgrade request could still
   reach late success. Its best-effort abort could fail or arrive too late,
   allowing mutation after the public result and, in the cancelled bootstrap
   case, risking a version-1 database without the complete schema.
2. The structural bootstrap registry existed, but there was no reusable internal
   data-migration runner implementing persisted
   `absent -> pending -> running -> completed`, safe failure, stale-running
   interruption, retry counting, and idempotent crash-window recovery with real
   IndexedDB transactions.
3. The original synthetic Legacy sentinel used a different `IDBFactory` from V2,
   so physical isolation made the preservation assertion true without proving
   same-realm non-interference.

B1.1 freezes these corrections:

- `close()` returns a stable Promise. During an in-flight request, repeated
  calls share the same Promise and wait for the request/upgrade transaction to
  become terminal. Cancellation no longer aborts the versionchange transaction;
  it permits either IndexedDB's atomic failure or a complete verified schema,
  closes late success, then settles. If the platform never emits a terminal
  event, `initialize()` and `close()` remain pending.
- Bootstrap application is re-entrant inside the same versionchange transaction:
  a transient operation failure can re-check/create only missing schema pieces,
  while a persistent failure aborts atomically. Metadata and the bootstrap
  migration use idempotent `put` operations inside that transaction.
- The internal data-migration runner persists `pending`, commits `running` before
  a real atomic data transaction, persists redacted `failed` state after abort,
  maps stale `running` to `MIGRATION_INTERRUPTED`, increments `retryCount` on the
  next attempt, and treats `completed`/`rolled_back` as terminal. It exposes no
  new public index export, store, delete, clear, or compensating behavior.
- The same-realm synthetic sentinel records version, store/keyPath, index
  descriptors, count, and deterministic record bytes before and after V2 fresh
  initialization plus a close-cancel failure.

The exact B1.1 paths are:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/database.js
js/storage/migrations.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-boundaries.test.js
```

No package, lock, ADR, migration-design, Repository, runtime, page, analysis, CI,
or B2 path changes are permitted. The first corrected focused run passed 21/21
synthetic offline Node tests. Full B1.1 gate evidence is recorded below only
after every command actually runs.

## B1.2 descriptor and store-boundary correction record

Final status: **Completed / PASS**. The control tower accepted all three B1.1
findings, then returned B1 to `REVISE` for two narrower boundary defects. B1.2
did not reopen the accepted lifecycle, schema, Legacy preservation, or database
code and did not authorize B2.

The two B1.2 root causes and corrections are:

1. The JSON-safe migration summary clone assigned ordinary-object keys with
   `result[key] = value`. An own enumerable data key named `__proto__` therefore
   reached the inherited setter, changed the clone's prototype, and lost the own
   data property. The clone now defines every string key with an own enumerable
   data descriptor. `__proto__`, `constructor`, and ordinary keys retain their
   values while the output remains an ordinary `Object.prototype` object; input
   accessors are rejected by descriptor without execution or mutation.
2. Migration `storeNames` previously excluded only `metadata` and `migrations`.
   An unknown name could persist `pending` and `running` before the data
   transaction rejected. Normalization now accepts only a native dense,
   key-exact, duplicate-free array drawn from the six V2 Canonical stores.
   Metadata, migrations, unknown stores, sparse/accessor/extra/symbol/custom
   prototype arrays, and reflection-failing Proxies reject with
   `MIGRATION_FAILED` before any database transaction or migration-state I/O.
   Validation never invokes caller iterators or `forEach` methods.

The exact B1.2 paths are:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/migrations.js
tests/storage/indexeddb-v2-schema.test.js
```

`tests/storage/indexeddb-v2-boundaries.test.js`, `js/storage/database.js`, and
every other previously accepted file remain unchanged by B1.2. Directed tests
prove special summary keys survive input, persistence, and the frozen returned
snapshot without prototype pollution; getter calls and caller mutation are zero.
They also instrument the database transaction boundary for every rejected store
array and prove zero migration or Canonical-store changes.

## Risks

### P0

- Accidentally opening `strava-dashboard-cache` with a higher version or a
  readwrite transaction could alter user data.
- Freezing a Proposed store/index contract as if it were Accepted could force
  later import or restore behavior without evidence.
- A partial cross-store write or failed upgrade could create unrecoverable or
  misleading migration state.

### P1

- IndexedDB lifecycle semantics differ between `fake-indexeddb` and real
  browsers, especially `blocked`, `versionchange`, crash, quota, and persistence.
- An adapter that leaks raw IDB objects or storage decisions can bypass the
  accepted Repository boundary.
- Accessors, Proxies, unsafe JSON values, or underlying error messages can create
  side effects or disclose private data.

### P2

- Premature indexes increase write cost and migration burden.
- Over-broad storage helpers could pull PR-06+ import, shadow, backup, or cleanup
  behavior into this PR.

## Independent review checklist

- [ ] Reviewer is independent from the implementation pass.
- [ ] Diff is restricted to the approved allowlist.
- [ ] Database name is exactly `strava-stats-v2`.
- [ ] No Legacy database mutation path exists.
- [ ] Stores/indexes map to frozen contracts and demonstrated queries.
- [ ] Upgrade, interruption, retry, rollback, quota, and concurrency behavior is
      covered without overstating fake-browser evidence.
- [ ] IDs, JSON safety, reflection safety, and error redaction are preserved.
- [ ] Page read source and Legacy feature-flag fallback remain unchanged.
- [ ] Privacy, migration, rollback, and Not-run evidence are complete.

## Completion evidence

### A0 baseline

- Start/base/local/remote SHA:
  `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110`.
- Start state: detached clean HEAD; `codex/v2/storage` did not exist remotely.
- Node: `v25.8.1`; npm: `11.11.0`; CI contract: Node 24.
- `npm ci`: PASS, 6 packages installed.
- `npm run check:syntax`: PASS, 137 files.
- `npm run check:privacy`: PASS.
- `npm test`: PASS, 965 passed, 0 failed/skipped/todo.
- `git diff --check`: PASS.
- Browser/CDP: Not run during A0.
- GitHub exact-head CI for this feature branch: Not run before first push.

### A1 publication

- Branch created from exact base: `codex/v2/storage`.
- Docs-only commit: `d722a94f39409bc81486546243afe79ead30ea9d`.
- Push: `origin/codex/v2/storage` tracking established.
- Pull request: [Draft #11](https://github.com/XiChuan9/StravaStats/pull/11),
  base `integration/v2`, one changed path, open and Draft.
- Exact A1-head CI: run `30911193761`, completed successfully.

### A2 investigation and decision package

- Changed path: only `docs/tasks/pr-05-indexeddb-v2-schema.md`.
- Implementation/product/test/dependency/ADR/migration-design files: unchanged.
- Status: `Awaiting decision`; implementation has not started.
- `npm run check:syntax`: PASS, 137 files.
- `npm run check:privacy`: PASS.
- `npm test`: PASS, 965 passed, 0 failed/cancelled/skipped/todo.
- `git diff --check`: PASS.
- Browser capability probe: existing synthetic consumer harness loaded in a
  disposable in-app Browser, but no PR-05 V2 harness exists and the read-only
  evaluation sandbox exposes no IndexedDB API. PR-05 real-browser IndexedDB
  lifecycle verification remains Not run, not Pass.
- Real quota pressure, process/browser crash durability, workers, Safari,
  Firefox, mobile, 5k/10k activities, and 200k-point performance: Not run.
- A2 docs-only commit, push, Draft-state verification, and its exact-head CI are
  recorded in the control-tower completion report after publication.

### A3 approval and phase gate

- Control-tower decision: all six questions approved subject to the mandatory
  corrections in the definitive A3 record.
- Status: `Approved for implementation`.
- Active phase: B1 only; implementation had not started at the A3 docs commit.
- A3 changed path: only `docs/tasks/pr-05-indexeddb-v2-schema.md`.
- A3 local docs gate: `git diff --check` must pass before publication.
- A3 commit, push, Draft-state verification, and exact-head CI are recorded after
  their actual completion; a Not-run check is never recorded as Pass.

### B1 finalization stop condition

The control tower's final B1/B1.1/B1.2 review result is `PASS`. B1 finalization
may publish exactly the ten approved B1 paths with an ordinary commit, push, and
Draft PR body update. After exact-head CI succeeds, stop with a clean worktree
and local/upstream divergence `0/0`. Do not create or modify B2 files, mark the
PR ready, merge, rebase, amend, force-push, delete the branch, or clean up the
worktree.

This historical B1 stop was satisfied by commit
`50058e07b7bd376f6e408afd362a904c0c9e0d49` and exact-head CI success. The later
explicit B2 authorization supersedes only the prohibition on beginning B2; all
other Git, Draft, merge, cleanup, and B3 restrictions remain active.

### B1.1 local correction evidence

- Final independent result: **Completed / PASS**; the initial `REVISE` findings
  and their three root causes remain recorded above as review history.
- Corrected focused storage tests: 21 passed, 0 failed/cancelled/skipped/todo.
- `npm ci`: PASS; 6 packages installed from the unchanged lockfile.
- `npm run check:syntax`: PASS; 145 JavaScript files parsed.
- `npm run check:privacy`: PASS.
- `npm test`: PASS; 986 passed, 0 failed/cancelled/skipped/todo.
- `git diff --check`: PASS after this evidence update.
- Real browser IndexedDB/CDP, quota pressure, crash durability, Safari, Firefox,
  mobile, workers, 5k/10k activities, and 200k-point performance: Not run in
  B1.1; B3 owns the tracked browser harness.
- Finalization scope remains exactly the ten B1 paths; B2 has not started.

### B1.2 local correction evidence

- Final independent result: **Completed / PASS**. The prior three findings and
  the two B1.2 boundary corrections all passed control-tower re-verification.
- Directed schema storage tests: PASS, 14 passed with special-key persistence,
  getter-zero, caller-preservation, and rejected-store zero-I/O instrumentation.
- Combined focused storage tests: PASS, 24 passed, 0
  failed/cancelled/skipped/todo.
- `npm ci`: PASS; 6 packages installed from the unchanged lockfile.
- `npm run check:syntax`: PASS; 145 JavaScript files parsed.
- `npm run check:privacy`: PASS.
- `npm test`: PASS; 989 passed, 0 failed/cancelled/skipped/todo.
- `git diff --check`: PASS after this evidence update.
- Real browser IndexedDB/CDP and the B3 quota, durability, cross-browser, scale,
  and performance matrix remain Not run.
- Finalization must keep the PR open and Draft and publish no path outside B1.

### B1 final acceptance evidence

- Overall B1 status: **Completed / PASS**; PR-05 overall status remains
  `In progress` because B2 and B3 are not complete or authorized.
- Final contract: `close()` is an asynchronous idempotent terminal barrier;
  in-flight open/upgrade requests settle before it resolves, and any late
  connection is closed before return.
- Migration foundation: exact v1 structural bootstrap plus persisted internal
  data-migration states, redacted failure/interruption, retry counting, and
  idempotent real-transaction crash-window tests.
- Preservation evidence: one synthetic Legacy-like sentinel shares the same
  `IDBFactory` realm with V2 and retains version, stores, indexes, count, and
  record bytes across V2 success and close-cancel failure.
- Descriptor/store evidence: migration summaries preserve own `__proto__` and
  `constructor` data keys without getter execution or prototype pollution;
  invalid or non-Canonical store arrays fail before any database transaction.
- Exact final paths: the ten B1 paths listed in the B1 allowlist, with no B2,
  package, ADR, migration-design, Repository, runtime, page, analysis, or CI
  workflow path.
- Final local gates before publication: `npm ci` PASS (6 packages), syntax PASS
  (145 files), privacy PASS, focused storage PASS (24 tests), full suite PASS
  (989 tests), and `git diff --check` PASS.
- Real Browser/CDP IndexedDB, quota pressure, crash durability, Safari, Firefox,
  mobile, workers, 5k/10k activities, and 200k-point performance remain Not run
  and owned by B3.

## B2 local implementation record

### Frozen public and connection boundary

- The public storage entry still exports exactly `V2_DATABASE_NAME`,
  `V2_DATABASE_VERSION`, `V2_SCHEMA`, `STORAGE_ERROR_CODE`, `StorageError`, and
  `createCanonicalStore`. No low-level transaction or Repository export was
  added.
- The frozen factory still exposes exactly `initialize`, `putBundle`,
  `getBundle`, `listActivities`, `createBackupManifest`, and `close`.
- All four B2 data methods require the current ready connection. Before explicit
  initialization, after close, and after `versionchange`, they fail with
  `CONNECTION_STALE` and perform no implicit open, upgrade, or retry.
- `close()` remains a Promise terminal barrier and now also waits for tracked B2
  operations. It closes the connection immediately to new work, lets an existing
  transaction reach its terminal event, then resolves. The B1 open/upgrade and
  migration-runner behavior is unchanged.

### Private transaction foundation

`js/storage/transaction.js` provides only an internal module export. It accepts
an exact non-empty dense array of known V2 stores, `readonly` or `readwrite`, and
a stable operation. Its frozen narrow context queues `get`, indexed `getAll`,
`count`, `add`, and `put` without returning the database, transaction, request,
or cursor through a public result. Business results are built only from settled
internal slots after `transaction.oncomplete`.

Synchronous queue failure aborts before settlement. Request error, transaction
error/abort, quota, and constraint faults map to redacted stable errors. There is
no retry, delete, clear, or recovery overwrite. Fault tests cover mid-queue
failure, constraint rollback, quota rollback, after-read writes, and a synthetic
complete-before-request-result platform violation.

### Atomic Canonical adapter

- `putBundle` first calls `validateImportedActivityBundle`, then creates a
  descriptor-safe detached JSON-safe snapshot before opening a readwrite
  transaction. It never mutates, sorts, or freezes caller input.
- Under the A3.1 correction, the physical activity envelope stores exactly five
  fields: `schemaVersion`, `activity`, `warnings`, `versionMetadata`, and
  `deviceIds`. `deviceIds` is the unique opaque device ID projection from the
  accepted bundle, code-unit sorted and descriptor-safe; it is internal
  association metadata and never enters the public bundle. Each stream record
  remains exactly `{ activityId, streamType, series }`; laps, events, sources,
  and devices retain their accepted records.
- One readwrite transaction spans the six Canonical stores. A new exact graph
  returns frozen `committed`; a complete structural match returns frozen
  `already-present` with zero write requests. Absent, `null`, `0`, and `-0`
  remain distinct, special own data keys survive, and ordinary-object property
  order is not semantic.
- Any differing collision, partial graph, same-activity extra relation, or
  non-device orphan collision aborts with `CONFLICT`. An identical device may be
  shared across activities; a differing device cannot. Quota and constraint
  injection prove full rollback.
- `getBundle` validates an opaque ID and exact safe stream options before I/O,
  reads all or selected series, detects missing/broken graphs, reconstructs the
  nine bundle fields from explicit consistent stored schema versions, sorts the
  read projection deterministically, revalidates it, and returns a detached
  deeply frozen bundle.
- `listActivities` accepts only the ten Canonical sport categories when present,
  safe-integer limits `1..500` with default `100`, and `asc`/`desc` with default
  `desc`. It uses the frozen activity indexes, applies opaque ID code-unit order
  as the equal-time tie-breaker, returns only frozen detached CanonicalActivity
  records, and never loads relation or stream stores.

### Backup manifest foundation

`createBackupManifest` validates the bootstrap metadata and uses only one
metadata `get` plus `count` on the eight stores in `V2_SCHEMA` order. It never
reads activity payloads or invents hashes. The exact deeply frozen result has
`backupFormatVersion: 1`, database/indexedDB/Canonical versions, an injected-clock
`createdAt`, current `applicationVersion`, ordered `{ name, recordCount }`
entries, and empty `files`/`hashes` arrays. Invalid clocks fail before I/O and
metadata/count mismatches fail closed.

### Exact B2 local paths and scope

Actual B2 paths are:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/database.js
js/storage/errors.js
js/storage/transaction.js
js/storage/canonical-store.js
js/storage/backup-manifest.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/canonical-store.test.js
tests/storage/backup-manifest.test.js
tests/storage/indexeddb-v2-boundaries.test.js
```

`database.js` changes only to retain the accepted `IDBKeyRange` boundary, route
the four approved methods through the current ready connection, and track their
terminal Promises for close. The existing boundary test changes only to replace
the B1 `UNAVAILABLE` skeleton expectation with B2 `CONNECTION_STALE` and include
the three new production modules in destructive/Legacy source scans.

`js/storage/errors.js` changed only during the approved B2.1 correction to add
module-private issued-error branding used by the internal transaction runner;
the public index exports and StorageError code/message/toJSON contract are
unchanged. `js/storage/index.js`, `constants.js`, `schema.js`, `migrations.js`,
and the B1 schema test required no B2 change. Package/lock, Accepted ADR,
migration-design, Repository, runtime, page/tab/analysis, Feature Flag, and CI
workflow paths remain prohibited and unchanged. No B3 harness exists in B2.

### B2 local evidence

- All fixtures are small, deterministic, synthetic, offline, and contain no
  token, real athlete data, private GPS, heart rate, power history, or network
  dependency.
- `npm ci`: PASS; 6 packages installed from the frozen lockfile.
- `npm run check:syntax`: PASS for 151 files.
- `npm run check:privacy`: PASS.
- `node --test tests/storage/*.test.js`: PASS, 48 tests, 0 failures.
- `npm test`: PASS, 1,013 tests, 0 failures.
- `git diff --check`: PASS after this evidence update; the six new files also
  pass explicit untracked-file whitespace checks.
- Exact path audit: PASS. B2 has exactly the ten paths listed above; the
  cumulative PR remains the approved 16 paths. Package/lock, Accepted ADR,
  migration design, Repository/runtime/pages/analysis, and CI workflow paths
  have no B2 changes.
- Git state at the B2 stop boundary remains intentionally unstaged,
  uncommitted, and unpushed. The published B1 head and Draft PR body are
  unchanged; implementation has not entered B3.
- Browser/CDP IndexedDB, quota pressure against a real browser, crash durability,
  Safari, Firefox, mobile, workers, 5k/10k activities, and 200k-point performance
  remain Not run and owned by B3.
- Rollback remains code-only: close V2 and revert B2 while Legacy stays the
  default/fallback. Do not delete, clear, downgrade, overwrite, or copy data into
  Legacy.

## A3.1 / B2.1 correction record

Status: **Completed / PASS.** Independent control-tower review accepted both
findings and authorized B2 Finalization. A3.1 and B2.1 are complete; B3 has not
started.

### A3.1 five-field envelope decision

Independent review proved that ADR-0006 accepts a `DeviceReference` that is not
referenced by any source. The former source-derived reconstruction rejected or
lost that valid record. A3.1 therefore freezes the five-field envelope described
above without changing the Accepted Canonical contract, database version,
stores, indexes, or public API.

`putBundle` now derives `deviceIds` only from the already validated detached
bundle, checks unique opaque IDs, and code-unit sorts the new array without
mutating caller input. Strict envelope equality includes the association, so an
identical retry remains `already-present` with zero writes and any differing or
tampered association conflicts. `getBundle` reads every listed device, not only
source-referenced devices, then revalidates the complete nine-field bundle.
Missing listed devices, duplicate/unsorted/non-string IDs, broken source
references, and malformed envelopes fail with `SCHEMA_MISMATCH`. Identical
devices remain safely shareable between activities, and `listActivities` still
returns only CanonicalActivity records.

### B2.1 issued-error boundary

Review also proved that `instanceof StorageError` can execute Proxy reflection
and leak a revoked or hostile object. `errors.js` now registers each constructed
StorageError in a module-private `WeakSet`; the internal runner uses that
side-effect-free identity check. A genuine issued error preserves its code and
object identity. Transparent, revoked, prototype-reflection-failing, accessor,
or lookalike values are never returned or retained; unsafe name access maps to a
frozen redacted `TRANSACTION_ABORTED`, while safely read `QuotaExceededError`
and `ConstraintError` names retain their approved mappings.

### B2.1 exact local scope and focused evidence

The correction modifies only these six paths, all already inside the approved
cumulative 16-path allowlist:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
js/storage/errors.js
js/storage/transaction.js
js/storage/canonical-store.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/canonical-store.test.js
```

- Two-file B2.1 focused run: PASS, 23 tests, 0 failures.
- All-storage pre-gate run: PASS, 51 tests, 0 failures.
- `npm ci`: PASS; 6 packages installed from the frozen lockfile.
- `npm run check:syntax`: PASS for 151 files.
- `npm run check:privacy`: PASS.
- `npm test`: PASS, 1,016 tests, 0 failures.
- Final `git diff --check`, explicit untracked-file whitespace checks, cumulative
  path audit, prohibited-path audit, staged-state audit, and privacy recheck:
  PASS.
- Git remains intentionally unstaged, uncommitted, and unpushed at published B1
  head `50058e07b7bd376f6e408afd362a904c0c9e0d49`; local/upstream is `0/0`, the
  Draft PR body is unchanged, and B3 has not started.

## B3 local Browser/CDP implementation record

Status: **Completed / PASS.** The control tower independently accepted A3.2,
B3, and B3.1. PR-05 is **In review** with **Final Review Pending**. Draft PR #11
must remain OPEN/Draft and is not authorized for Ready, merge, or cleanup.

Independent review accepted the storage lifecycle coverage but rejected the
cross-reload environment proof. The initial harness reinitialized `metrics` and
Performance Resource Timing after reload, persisted only sentinel/manifest/gate
data, and therefore reported zeros for the second document without proving the
first document that executed the main lifecycle. B3.1 adds a settled
`environment-first-load` gate before reload, persists only safe counters, keeps
instrumentation active until navigation destroys the first document, then
separately asserts the reload counters and their aggregate total.

### Exact B3 scope

Only the two authorized paths changed:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
tests/storage/indexeddb-v2-browser-smoke.html
```

The cumulative PR path inventory is exactly 17. No `js/storage` product module,
Node test, package/lockfile, Accepted ADR, migration design, Repository, runtime,
page/tab/analysis, Feature Flag, CI workflow, or Browser product path changed.

### Superseded initial loopback browser evidence

- Superseded evidence directory:
  `/private/tmp/pr05-b3-evidence-UjQ6sw`. The safe JSON is
  `browser-evidence.json`; the final-page screenshot is `browser-passed.png`.
  Nothing from this directory was copied into the repository.
- Browser surface: isolated Codex In-app Browser, Chromium `150.0.0.0`, browser
  binding `-49de-4126-aed0-a4be3f0abbfc`, target `5`. The superseded origin was
  `http://127.0.0.1:59522`; the profile/origin began with no
  `strava-stats-v2`, Service Worker, or Cache Storage state.
- A first diagnostic origin on port `59422` proved the initial CSP omitted an
  inline-module nonce, so no harness or product module executed. That tab and
  server were closed and are not acceptance evidence. The nonce-only harness
  reran from the fresh final origin above.
- The initial DOM reported `data-status="passed"` after an actual page reload and
  all `17/17` gates. Native ESM imported the real public
  `js/storage/index.js` and its production dependencies. The final browser tab,
  all public/raw V2 and sentinel connections, loopback server, and ports were
  closed after evidence capture. Independent review does not accept this origin
  or evidence directory as final B3 proof because its environment zeros covered
  only the reload document.

The 17 browser gates covered:

1. fresh-origin V2 absence and zero Service Worker/Cache Storage;
2. same-origin synthetic Legacy-like sentinel creation and byte-hash baseline;
3. public import and factory construction with zero IndexedDB I/O;
4. fresh initialization with database version `1`, eight stores, six exact
   indexes, metadata, and completed bootstrap migration;
5. repeated initialize, asynchronous close, and explicit reopen;
6. atomic `putBundle` committed/already-present and `getBundle` all streams;
7. selected-stream reads and five-field envelope/unreferenced-device round trip;
8. indexed asc/desc/filter lists, opaque equal-time ID ordering, accepted limit
   `500`, and rejected `501`;
9. accessor/revoked-Proxy/options failures before transaction I/O;
10. injected Constraint/Abort failures with exact zero-partial-write counts;
11. close waiting for an in-flight write terminal event, stale rejection, and
    explicit recovery;
12. exact count-only backup manifest with one metadata get, eight counts, zero
    payload reads, and no files/hashes;
13. two public connections receiving native `versionchange` from an atomically
    aborted v2 request, becoming stale, retaining database version `1`, and
    recovering only through explicit initialize;
14. sentinel version/store/index/count/byte-hash preservation before reload;
15. native ESM import after reload;
16. explicit reopen/get/manifest equivalence after reload; and
17. final sentinel preservation and connection cleanup.

### Safe browser inventory and environment gates

- Final V2 inventory: database `strava-stats-v2`, IndexedDB version `1`, eight
  stores, six indexes. Manifest counts were metadata `1`, migrations `1`,
  activities `5`, activitySources `5`, streamSeries `10`, laps `0`, events `0`,
  and devices `3`; manifest payload reads were `0`.
- The separate sentinel was
  `synthetic-legacy-like-b3-sentinel` version `3`, one store, one index, one
  record, with identical before/after SHA-256
  `3267b1a052ab8db33ff033fe97d497609625eb508c8b32fe341c502bc5a6f53f`.
  No actual Legacy database name or user record was opened, upgraded, read, or
  written.
- The initial DOM reported reload-document zeros for external HTTP(S), provider
  API, fetch, XHR, WebSocket, Authorization/Token, console error/warning,
  uncaught/unhandled, Service Worker, and Cache Storage. Those numbers are
  superseded rather than accepted because first-load counters were not persisted.
- The DOM and evidence contain only safe gate names, versions, counts, the
  synthetic sentinel hash, and environment identifiers. They contain no bundle
  payload, coordinate, heart-rate, power, token, authorization value, account,
  or private fixture.

### B3.1 final cross-reload Browser/CDP evidence

- Final B3.1 evidence is exclusively under
  `/private/tmp/pr05-b31-evidence-qrgxqf`: `browser-evidence.json` and
  `browser-passed.png`. The earlier CSP diagnostic origin `59422` and rejected
  B3 origin `59522` remain explicitly discarded and are not final evidence.
- The complete corrected harness ran from the new unique origin
  `http://127.0.0.1:60035`. It began with no `strava-stats-v2`, Service Worker,
  or Cache Storage. Browser surface was isolated Codex In-app Browser,
  Chromium `150.0.0.0`, binding `-9f16-4d25-9453-e7cd8e4b09a1`, target `6`.
- Final DOM was `data-status="passed"` with `19/19` gates. The original 17
  lifecycle assertions reran from scratch. `environment-first-load` waited for
  two animation frames plus a browser task before inspecting Performance
  Resource Timing and every runtime counter, asserted all zeros, and persisted
  only that safe counter object. Instrumentation remained active until reload
  destroyed the first document.
- `environment-reload` independently waited and asserted the second document,
  reasserted the persisted first-load counters, then constructed and asserted an
  aggregate total. First-load, reload, and total each recorded exact zeros for
  external HTTP(S), fetch, XHR, WebSocket, Authorization, console error/warning,
  uncaught exception, unhandled rejection, Service Worker, and Cache Storage.
  Browser warning/error logs were also zero.
- Final database, manifest, and sentinel values matched the original accepted
  lifecycle evidence: V2 version `1`, eight stores, six indexes; manifest counts
  `1/1/5/5/10/0/0/3`, one metadata get, eight counts, zero payload reads; and
  sentinel version/store/index/count/hash unchanged. All public/raw connections,
  the tab, server, and port `60035` were closed after evidence capture.

### B3 privacy, migration, rollback, and Not-run boundary

The harness never calls database deletion or store clearing and never opens the
actual Legacy database. It proves only fresh physical v1 creation, additive
bootstrap, atomic data transactions, aborted versionchange rollback, explicit
reopen, and same-origin synthetic sentinel preservation. Rollback remains
code-only: close V2 and revert PR-05 while retaining all V2 and Legacy data.

Final B3.1 local Node and repository gates after the corrected cross-reload
browser harness:

- `npm ci`: PASS; 6 packages installed from the unchanged lockfile.
- `npm run check:syntax`: PASS for 151 files.
- `npm run check:privacy`: PASS.
- `node --test tests/storage/*.test.js`: PASS, 51 tests, 0 failures.
- `npm test`: PASS, 1,016 tests, 0 failures/cancelled/skipped/todo.
- `git diff --check`, explicit harness whitespace check, exact two-path B3 audit,
  cumulative 17-path audit, prohibited-path audit, and pre-finalization unstaged
  state: PASS. B3 Finalization tracks the harness as a normal stage-0 file in
  the exact two-path commit.

Real quota pressure, browser/process crash durability, Safari, Firefox, mobile,
workers, 5k/10k activities, 200k-point streams, production Service Worker, user
profiles, real provider network, real credentials, and real athlete data remain
explicitly **Not run**.
