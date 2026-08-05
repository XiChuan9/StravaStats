# PR-07: Import Core + Canonical JSON Fixture

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation |
| Milestone | M4 |
| Base branch | `integration/v2` |
| Exact base SHA | `6f51010919ca442fa45c0d6c9d633b72d0bc36f0` |
| Feature branch | `codex/v2/import-core` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/8d7c/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-06 / PR #12 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Implement the deterministic Synthetic JSON import vertical slice:

```text
Synthetic JSON artifact
-> SHA-256 and RawArtifact
-> DecoderRegistry / synthetic-json decoder
-> descriptor-safe decode
-> Normalizer / validateImportedActivityBundle
-> exact raw-artifact duplicate decision
-> one-ImportItem Canonical transaction
-> persisted ImportJob / ImportItem log
-> Canonical read-projection seam
-> redacted Activities Preview
```

The implementation must keep every current page on the Legacy Repository, add no
eighth Repository method, preserve the accepted Canonical contracts, and never
open, upgrade, write, clear, or delete the Legacy database.

## A0 baseline evidence

- Starting worktree: detached and clean at exact SHA
  `6f51010919ca442fa45c0d6c9d633b72d0bc36f0`.
- Local `integration/v2`, `origin/integration/v2`, and starting HEAD matched that
  SHA with ahead/behind `0/0`.
- GitHub PR #12 is `MERGED`; base/head were
  `integration/v2 <- codex/v2/shadow-writer`; squash merge commit is the exact
  base SHA.
- PR #12 check run `30960686960 / 92163732006` succeeded.
- Exact integration push CI `30961502417` and pull-request CI `30961505735`
  both succeeded at the base SHA.
- Baseline `npm ci`: PASS; syntax: PASS for 158 files; privacy: PASS; full suite:
  PASS 1,044/1,044; `git diff --check`: PASS.
- No real file, account, Token, activity, route, health stream, export, private
  fixture, or user browser profile was read.

## A1 publication rule

The first branch commit contains only this Task Brief. It is pushed before any
implementation starts and opens a Draft PR with base `integration/v2`. No other
path may be staged in the A1 commit.

## A2 read-only findings

### Accepted boundaries and actual call graph

- The Accepted `ImportedActivityBundle` is the only Canonical write input and is
  validated by `validateImportedActivityBundle` before storage.
- PR-05 physical v1 contains exactly eight stores: `metadata`, `migrations`,
  `activities`, `activitySources`, `streamSeries`, `laps`, `events`, `devices`.
- `createCanonicalStore` owns initialization, atomic six-store bundle writes,
  Canonical bundle reads, indexed activity-list reads, metadata-only manifests,
  and connection close/versionchange behavior.
- PR-06 supplies a best-effort imported-bundle writer seam but owns shadow
  parity, not durable import jobs, raw artifacts, cancellation, retry, or import
  reports.
- The public Repository entry remains exactly seven methods. Factory mode is
  still Legacy-only and every page read remains Legacy-only.
- A PR-07 preview can call the existing Canonical `listActivities` storage seam
  through an Import-owned read projection. It does not need a Repository method,
  Factory mode, page change, or production cutover.

### Minimum physical v2 migration

Physical IndexedDB version `2` adds only:

| Store | keyPath | Index | Immediate query |
| --- | --- | --- | --- |
| `rawArtifacts` | `id` | `bySha256` = `sha256` | exact duplicate lookup |
| `importJobs` | `id` | `byCreatedAt` = `createdAt` | durable newest-first import log |
| `importItems` | `id` | `byJobId` = `jobId` | reconstruct one job/report after reload |

No existing store, keyPath, index, record encoding, or Canonical contract changes.
The v1 bootstrap remains historical `0 -> 1` with eight stores. The additive
`schema-0002-import-core` step is `1 -> 2`, creates only the three stores and
three indexes above, updates database metadata to `strava-stats-v2@2`, and
records a completed structural migration in the same versionchange transaction.
Fresh initialization runs both steps; v1 upgrade preserves every existing row.
Failure aborts the versionchange transaction and explicit initialization retries.

This is sufficient for PR-07. A fourth store, another index, a destructive
change, or a Legacy operation is outside the approved boundary.

### Frozen import records

`ImportJob` stores only:

```text
id, status, totalItems, completedItems, createdAt, completedAt,
retryCount, errorCode
```

`ImportItem` stores only:

```text
id, jobId, ordinal, artifactId, status, errorCode, retryable, activityId
```

`RawArtifact` stores immutable identity/content plus processing state:

```text
id, sha256, mediaType, byteLength, acquiredVia, importedAt,
content, state, activityId
```

The only accepted media type in PR-07 is
`application/vnd.stravastats.synthetic+json`. `content` is the exact local
Synthetic JSON text and never appears in a public error, report, log, DOM, or
evidence file. State metadata may move from `pending` to `committed`; hash,
media type, byte length, acquisition method, timestamp, and content are never
overwritten.

All IDs are non-empty opaque strings. Missing, `null`, zero, and value remain
distinct. Public inputs must be plain, dense, exact, JSON-safe data; accessors,
symbols, custom prototypes, cycles, special objects, non-finite values, and
reflection-failing Proxies fail closed before storage or worker side effects.

### ImportJob state machine

The exact PRD transitions are frozen:

```text
queued -> validating -> hashing -> decoding -> normalizing -> matching
-> persisting -> analyzing -> completed
analyzing -> completed_with_warnings
validating -> failed_validation
decoding -> failed_decode
persisting -> failed_storage
queued|validating|decoding|normalizing|matching -> cancelled
failed_validation|failed_decode|failed_storage -> retrying -> validating
```

Every other transition returns stable `INVALID_TRANSITION`. Hashing cancellation
is latched until the next PRD-valid `decoding -> cancelled` boundary. Persisting
and analyzing are non-cancellable atomic/finalization phases. Cancellation marks
only unfinished items and never deletes a successful item, RawArtifact, Canonical
row, or either database.

Ordinary per-item validation/decode/storage failures are recorded on that item
and do not roll back earlier completed items. The job finishes
`completed_with_warnings`. A Worker crash is job-level `failed_decode`, remains
observable after reload, and requires explicit retry through
`failed_decode -> retrying -> validating`. Retry reuses the persisted artifact,
is idempotent, and never silently retries a failed Worker.

### Hash and duplicate semantics

- SHA-256 is computed over UTF-8 bytes of the exact Synthetic JSON text.
- RawArtifact ID is deterministically derived from the full lowercase digest;
  the SHA index remains non-unique and is always verified against exact byte
  length, media type, and content.
- Same digest plus identical artifact is an exact duplicate. Once the artifact
  is committed, later imports return `skipped_exact_duplicate` without a
  Canonical write.
- Same digest with different bytes is `HASH_COLLISION`, never a duplicate and
  never an overwrite.
- Concurrent pending imports may decode, but one per-item readwrite transaction
  commits the artifact state, accepted Canonical graph, ImportItem terminal
  status, and ImportJob completed count. Later contenders observe committed state
  and become `skipped_exact_duplicate`; no second activity is created.
- A Canonical collision that is not the same committed artifact remains a safe
  storage conflict and never overwrites an existing activity.

### Decoder, normalizer, Worker, and report boundaries

- DecoderRegistry has one registered decoder: `synthetic-json` for the exact
  media type. No CSV, ZIP, FIT, TCX, GPX, XML, archive, or general parser ships.
- Decoder parses exact JSON text only and does no storage, DOM, network, logging,
  identity, or analysis work.
- Normalizer creates a detached bundle, attaches the RawArtifact reference to
  sources without mutating decoder output, and calls
  `validateImportedActivityBundle` before any Canonical readwrite transaction.
- The Worker seam supports a real module Worker in the browser and an injected
  deterministic seam in Node. Worker errors map only to `WORKER_CRASHED`; raw
  events, messages, stacks, causes, IDs, and payloads are discarded.
- Analysis work is explicitly deferred. The job still passes through the PRD
  `analyzing` state without enqueueing an analysis task.
- Import Report contains only status, totals, item ordinal, stable outcome/error
  code, and retryability. It contains no job/item/artifact/activity/source ID,
  filename, raw artifact, Canonical payload, location, health value, Token,
  cause, or raw platform message.
- Activities Preview is a frozen aggregate projection of Canonical
  `listActivities`: total count and per-sport counts only. It exposes no IDs or
  activity payload and is not wired to a production page.

## Approved phase allowlists

### A3: Task Brief publication

```text
docs/tasks/pr-07-import-core.md
```

### B1: additive physical v2 and import transaction storage

```text
docs/tasks/pr-07-import-core.md
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/canonical-store.js
js/storage/import-store.js
js/storage/index.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/canonical-store.test.js
tests/storage/backup-manifest.test.js
```

`canonical-store.js` is included only to factor its already-accepted Canonical
graph transaction logic so PR-07 can atomically join ImportItem state. It does
not change the Canonical bundle contract or ordinary `putBundle` behavior.

### B2: Import Core, fixture, and deterministic Node integration

```text
docs/tasks/pr-07-import-core.md
js/import/AGENTS.md
js/import/index.js
js/import/errors.js
js/import/safe-data.js
js/import/state-machine.js
js/import/decoder-registry.js
js/import/synthetic-json-decoder.js
js/import/normalizer.js
js/import/worker-client.js
js/import/synthetic-import-worker.js
js/import/import-service.js
js/import/activities-preview.js
tests/fixtures/synthetic/canonical/import-run-summary.json
tests/fixtures/synthetic/canonical/README.md
tests/import/import-state-machine.test.js
tests/import/import-worker.test.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
```

### B3: Browser/CDP vertical slice

```text
docs/tasks/pr-07-import-core.md
tests/import/import-browser-smoke.html
```

### B4: historical storage-freeze compatibility

```text
tests/shadow/shadow-boundaries.test.js
```

Necessity record: the PR-06 guard intentionally froze the then-current PR-05
storage descriptor and public storage entry by exact hashes. PR-07 is the
approved next owner of the additive physical v2 migration and the minimal
storage-owned Import Store seam, so the historical fixed expectations must move
to the reviewed PR-07 versions or the repository-wide gate rejects the approved
migration. This update does not change Shadow behavior, loosen the guard, use a
dynamic allowlist, or alter any Repository file/export.

### B5: durable storage browser-harness compatibility

```text
tests/storage/indexeddb-v2-browser-smoke.html
```

Necessity record: PR-05's durable browser harness asserts physical version 1,
eight stores, and one migration. Those expectations become false when PR-07's
approved additive physical v2 is present. The harness must be advanced to the
same eleven-store/two-migration contract so it remains a valid release artifact;
its transaction, close, privacy, and synthetic Legacy-sentinel scenarios remain
unchanged.

The cumulative maximum is the literal union of the paths above: 34 paths. A
35th path requires a necessity record in this Task Brief before modification.
Allowlist checks use this literal list, never current diff output, a dynamic
directory allowlist, skip rules, or generated expectations.

## Prohibited scope

- `package.json`, lockfile, dependencies, Accepted ADRs, PRD, release plan,
  GitHub workflows, Service Worker, deployment, feature-flag defaults.
- Any Repository export/method/Factory mode, Canonical page cutover, production
  page/tab/analysis/UI change, Source Manager, or Import Dialog.
- Any fourth new store, destructive migration, existing-store/index change,
  Legacy database operation, database deletion, store clear, restore, cleanup,
  downgrade, or V2-to-Legacy write.
- `activities.csv`, Strava ZIP, FIT, TCX, GPX, XML, archive parser, fuzzy
  identity, merge candidates, analysis enqueue, bootstrap, backup/restore, or
  real-file performance work.
- Real credentials, Tokens, accounts, activity files, routes, screenshots,
  location/health data, exports, private fixtures, or user browser profiles.
- Logging or DOM exposure of raw artifact, payload, IDs, Token, Authorization,
  cause, location, health, filename, or platform error text.

## Test matrix

Node/fake IndexedDB tests must prove:

- fresh physical v2 initialization, repeated initialization, v1-to-v2 upgrade,
  failed upgrade rollback/retry, reload, and same-realm Legacy-like sentinel
  preservation;
- exact eleven stores, preserved eight prior stores/indexes, and the three exact
  new indexes with demonstrated queries;
- valid Synthetic JSON vertical slice, persisted job/items/artifact, report, and
  preview after a new store/service instance;
- import once and ten times, concurrent duplicates, defensive hash collision,
  and no second Canonical activity;
- cancellation at every PRD-valid boundary, hashing latch, invalid transitions,
  and completed-item retention;
- one bad item with later success, transaction abort/quota rollback, Worker crash,
  explicit retry, interrupted/reloaded log, and retry idempotency;
- missing/null/zero/value, opaque IDs, hostile artifact/options/decoder/Worker
  results, getter count zero, reflection failure, input non-mutation, frozen and
  detached public results;
- stable redacted errors/reports, no raw cause/payload/ID/Token/location/health
  disclosure, no console/logger dependency, no provider/network I/O;
- exact public exports, no Repository eighth method, Legacy mode unchanged, no
  destructive API, exact allowlist, and deterministic committed fixture policy.

The Browser/CDP harness uses a fresh loopback origin and disposable browser
surface, native ESM, the committed Synthetic JSON fixture, an actual module
Worker, real Web Crypto SHA-256, real browser IndexedDB, automatic reload, and
the production Import Core/storage/read-projection seams. It records only safe
gates/counts and proves first-load, reload, and aggregate zeros for external
HTTP(S), provider endpoints, Authorization/Token, console warning/error,
uncaught/unhandled errors, Service Workers, and Cache Storage. It inventories the
V2 database and a synthetic Legacy-like sentinel, closes all connections, and
stops the server. Real quota pressure may be deterministic fault injection; it
must not be described as real browser quota exhaustion.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/storage/*.test.js
node --test tests/import/*.test.js
npm test
git diff --check
```

Exact-head pull-request CI must succeed after each published implementation
head. Node/fake IndexedDB evidence is never labelled browser persistence,
quota, or crash evidence.

## Privacy, migration, and rollback

All committed and browser inputs are deterministic Synthetic JSON. No real data,
credential, account, route, health stream, private fixture, or user profile is
used. Raw synthetic content is local-only and absent from reports, errors, logs,
DOM, and evidence.

The physical migration is additive `1 -> 2`, idempotent, retry-safe, observable,
and isolated to `strava-stats-v2`. Upgrade failure preserves the committed v1
database. The Legacy database is never opened by PR-07.

Rollback is code/flag-only: stop new imports, close V2 connections, and revert
PR-07 while retaining physical v2, RawArtifacts, Import logs, Canonical data, and
Legacy data. Never downgrade, clear, overwrite, delete, or reverse-copy data.
Current pages remain Legacy before, during, and after rollback.

## Completion gate

After B1-B3, independently review the exact-base diff, public/storage/import
contracts, state transitions, transaction atomicity, duplicate/collision
behavior, Worker lifecycle, report privacy, browser evidence, and literal
allowlist. Reproduce each actionable defect with a minimal failing test before
fixing it. Only after `No actionable findings`, exact-head CI success, clean Git
state, and local/upstream `0/0` may the Task Brief and PR body receive Final
Review Closure and the Draft PR move to Ready for review.

Do not merge, modify `integration/v2`, clean the branch/worktree, or start M5.
