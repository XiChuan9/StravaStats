# PR-21: Backup / Restore

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M18 / PR-21 |
| Status | A3 frozen; implementation and verification in progress |
| Branch | `codex/v2/backup-restore` |
| Base | `integration/v2` at `7c22c85bda85667921db6b0768c9b2f895b00991` |
| Draft PR title | `feat(v2): add full backup and restore` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Investigate and, only after explicit approval of every material contract, implement the PR-21
full-library backup and restore workflow described by the product PRD, development plan, IndexedDB
migration authority, and rollback plan. A user must be able to create a self-contained private
backup of every V2 record needed to reconstruct the local library, validate exact version and
per-file integrity metadata before mutation, and restore it safely in a fresh isolated browser.

Restore must never overwrite or corrupt the current usable library on validation failure, schema
incompatibility, interruption, cancellation, transaction abort, quota failure, or repeated
execution. Legacy storage remains physically separate, readable, and untouched. Disconnecting
Strava and deleting local data remain separate actions.

PR-21 does not start PR-22 diagnostics/performance, PR-23 default switching, Service Worker work,
deployment, release, merge, cleanup, destructive data maintenance, or a broad UI redesign.

## A0 exact baseline evidence

- The assigned isolated worktree began clean and detached at exact SHA
  `7c22c85bda85667921db6b0768c9b2f895b00991`; local `integration/v2`,
  `origin/integration/v2`, and the live remote branch resolved to the same SHA with local/origin
  divergence `0/0`.
- The protected source and long-lived integration worktrees were clean and were not modified.
  The feature branch `codex/v2/backup-restore` was created at the exact base in this isolated
  worktree; no local or remote branch with that name previously existed.
- GitHub PR #26, `feat(v2): add duplicate review workflow`, was verified `MERGED` with squash merge
  commit exactly `7c22c85bda85667921db6b0768c9b2f895b00991`, so the required M17 physical V4 state is present.
- Untouched-base gates passed: `npm ci`; syntax for 217 files; privacy; full suite 1,385/1,385;
  and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, health or power value, account, Token,
  Authorization value, export, screenshot, private fixture, user profile, or user browser state
  was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open
a Draft PR targeting `integration/v2` before investigation results or implementation are
committed. GitHub App write failures are delegated to the control tower without using the user's
browser login or profile. The PR remains Draft through implementation, independent review, and
Final Review Closure. Ready is a later control-tower operation and is never merge authorization.

## Authority and inherited frozen contracts

Conflict order is accepted ADRs, product PRD, engineering plan and release gates, this Task Brief,
then implementation details. The investigation must preserve these already-frozen boundaries:

- physical V4, its thirteen stores and indexes, current version-specific descriptors, migrations,
  transaction behavior, Import and Repository boundaries, and the existing Backup Manifest
  foundation are authoritative current state;
- the backup must contain every V2 record needed to reconstruct the full library, including the
  PRD inventory `manifest.json`, `activities.jsonl`, `sources.jsonl`, `streams/`, `laps.jsonl`,
  `events.jsonl`, `devices.jsonl`, `overrides.jsonl`, `analysis/`, `settings.json`, and `raw/`;
- the manifest records exact backup, physical IndexedDB, Canonical schema, application and relevant
  data-version metadata, record counts, and per-file hashes; validation completes before any
  restore target mutation and incompatible versions never force-restore;
- activity, source, relation, and RawArtifact IDs remain non-empty opaque strings and are never
  numerically parsed, normalized, or defaulted; absent, missing, `null`, real zero, and negative
  zero remain distinct where the existing contract distinguishes them;
- backup and restore preserve RawArtifact binary/media bytes exactly and maintain every internal
  reference, activity graph, source association, import log, duplicate-review record, setting,
  feature flag, user-owned state, override, and analysis snapshot required by current V4;
- failure, interruption, cancellation, crash, quota error, malformed input, hash mismatch, schema
  incompatibility, and repeat restore must leave the current usable library intact;
- no restore may clear existing stores, delete or overwrite an existing database, destructively
  rename/activate storage, or mutate Legacy storage without an explicitly approved recovery and
  rollback contract;
- no raw filenames or paths, Tokens, credentials, provider payloads, routes, GPS points, health
  streams, internal causes, or private identifiers may enter logs, errors, DOM, reports, evidence,
  or PR prose. They may exist only inside the private backup bytes explicitly requested by the
  user;
- no public Repository, Canonical, Import, Backup, or Storage API; physical schema/store/index or
  version; algorithm; dependency; Service Worker; deploy/release boundary; or next-PR scope changes
  without explicit approval.

## A2 read-only investigation gate

Before production or test implementation changes, the evidence package must establish:

1. every current V4 store, index, key path, version-specific descriptor, migration, database-open,
   connection-close, transaction, cursor, and error-mapping contract;
2. every physical record represented by the PRD backup inventory, including which records and
   settings exist, which are absent, how compound/internal references are encoded, and how raw
   binary/media values are currently stored;
3. the existing Backup Manifest call graph and its metadata-only limits, plus all ZIP/archive,
   Strava ZIP import, Source Manager, Storage & Backup, download/upload, Blob, stream, chunk,
   cancellation, and browser capability seams;
4. Legacy rescue, localStorage, feature-flag, user-owned setting, disconnect/delete, Cache Storage,
   and Service Worker boundaries that backup/restore must not cross;
5. exact large-data behavior: whole-buffer versus bounded streaming/chunking, archive and per-entry
   size/count limits, memory amplification, backpressure, cancellation timing, and whether a
   browser implementation can avoid constructing the entire library or archive in memory;
6. evidence-backed comparisons of deterministic ZIP/archive versus another bounded container,
   whole-buffer versus streaming/chunked export, and empty-target restore versus staging database
   plus atomic activation versus direct batched restore;
7. validation order and failure behavior for malformed/accessor/Proxy inputs, traversal names,
   duplicate entries, container bombs, truncated bytes, per-file hash and count mismatch, schema
   incompatibility, quota, transaction abort, interruption/crash/cancellation, non-empty current
   library, idempotent repeat, and new-browser restore;
8. the narrowest UI and runtime seams, the smallest literal cumulative path allowlist, a
   failure-first test matrix, deterministic served-browser evidence plan, privacy impact,
   migration impact, and code/data rollback limits.

The evidence must prove what exists and what is absent. Proposed ADR language and historical
discussion do not freeze an undecided contract.

## A2 evidence and A3 material approval

Read-only A2 proved that physical V4 has thirteen stores; the existing Backup Manifest is
metadata/count-only; RawArtifact content is an exact string (including base64-backed binary media);
durable settings are outside V4; overrides and analysis have no current physical stores; the
existing Strava ZIP reader is import-only and whole-buffer; and the fixed database name has no
activation, rename, or staging pointer. IndexedDB can atomically restore all V4 stores in one
transaction but cannot rename a database, while WebCrypto SHA-256 is whole-buffer.

The material owner explicitly approved Option A through the control tower before implementation.
The following contract is Accepted and frozen:

- a dedicated deterministic stored ZIP32 profile with exactly seventeen regular entries in the
  literal order below, fixed DOS epoch, UTF-8 names, no directory, symlink, comment, descriptor,
  encryption, compression, nesting, or local extra fields, and one exact central-directory private
  SHA-256 field per entry in addition to CRC32;
- archive and individual entry hard limits are both exactly 268,435,456 bytes. Export, validation,
  and restore are deliberately whole-buffer and non-resumable in PR-21, with cancellation checks
  between bounded phases; an over-limit input fails closed;
- collision-free lossless tagged JSONL, code-unit key sorting, IDB key order for records, exact raw
  string bytes, and preservation of opaque strings, missing object keys, null, +0, -0, and special
  own string keys. Accessors, Proxy traps, symbols, cycles, sparse arrays, custom prototypes, and
  non-finite numbers fail closed;
- backup format 1 accepts only the exact current physical V4 schema `strava-stats-v2@4` and
  Canonical schema 1. Application version is informational; incompatible schemas cannot be forced;
- restore accepts only an absent database or an exact empty V4 baseline. All V4 records are written
  in one versionchange/readwrite transaction, with metadata/migrations replacing only an empty
  baseline. No delete, clear, rename, database swap, or user-record overwrite exists;
- an exact repeated restore returns `already_restored` with zero database writes. Any other
  non-empty/different target returns `TARGET_NOT_EMPTY`;
- approved durable settings are additive and idempotent. Conflicting existing values return
  `TARGET_SETTINGS_CONFLICT` before database mutation. The database commits before missing settings;
  a settings write failure returns `SETTINGS_PENDING`, and repeating the same backup resumes it;
- a separate `js/backup` public surface exports exactly `BACKUP_ERROR_CODE`, `BackupError`, and
  `createBackupService`; the service exposes exactly `exportLibrary`, `validateBackup`,
  `restoreBackup`, and `close`;
- a same-origin Storage & Backup page is linked from Sources. Demo performs zero Real I/O and keeps
  backup/restore unavailable. No provider, auth, network telemetry, destructive action, storage
  estimate, or default Repository switch is added.

The fixed archive entries are:

```text
manifest.json
activities.jsonl
sources.jsonl
streams/series.jsonl
laps.jsonl
events.jsonl
devices.jsonl
overrides.jsonl
analysis/snapshots.jsonl
settings.json
raw/artifacts.jsonl
system/metadata.jsonl
system/migrations.jsonl
imports/jobs.jsonl
imports/items.jsonl
review/candidates.jsonl
review/decisions.jsonl
```

The manifest lists descriptors, counts, byte lengths, and SHA-256 over the exact uncompressed bytes
of the other sixteen entries; the central-directory hashes protect all seventeen entries including
the manifest. All thirteen V4 stores are exported. Overrides and analysis are mandatory zero-record
entries. The durable settings allowlist is the ten established user-setting keys plus strict
`gear-custom-*`; Tokens, credentials, provider state, Legacy activity caches, Demo data, API keys,
routes, and transient UI state are excluded.

Safe public error codes are limited to `INVALID_REQUEST`, `BACKUP_UNAVAILABLE`, `BACKUP_TOO_LARGE`,
`BACKUP_CANCELLED`, `BACKUP_CONTAINER_INVALID`, `BACKUP_HASH_MISMATCH`,
`BACKUP_SCHEMA_INCOMPATIBLE`, `BACKUP_DATA_INVALID`, `BACKUP_REFERENCE_INVALID`,
`TARGET_NOT_EMPTY`, `TARGET_SETTINGS_CONFLICT`, `RESTORE_ABORTED`, `QUOTA_EXCEEDED`, and
`SETTINGS_PENDING`. Status literals are `exported`, `validated`, `restored`, `already_restored`,
`settings_pending`, and `closed`. Errors never carry raw cause, message, input, identifier, or path.

The following topics remain outside the approval and require a new material decision:

- a streamed, chunked, compressed, resumable, or partially retained archive profile;
- forward/backward schema negotiation, conversion, or restore into any version other than exact V4;
- staging databases, activation pointers, rename/swap, restore over a non-empty library, cleanup, or
  any delete/clear/overwrite action;
- settings overwrite/removal, broader settings or feature-flag capture, provider/account data,
  Legacy cache import, or real overrides/analysis stores;
- any new Repository, Canonical, Import, public Storage, or additional Backup API; schema, store,
  index, version, migration, dependency, Service Worker, deploy/release, or seventeenth path.

## Browser Gate evidence and approved baseline exception

An actual served run used two fresh headless Chrome profiles with explicit temporary user-data
directories and deterministic synthetic data only. The source profile began with zero databases,
created only `strava-stats-v2`, produced and downloaded a 10,582-byte backup, and reported one
activity. The second profile opened the production Storage & Backup page with the V2 database still
absent (the page reported `Not created`), uploaded the actual downloaded file, created V4 only inside
the restore transaction, restored successfully, and was inspected after commit:

```text
activities 1              activitySources 1
streamSeries 0            laps 1
events 0                  devices 0
rawArtifacts 0            importJobs 0
importItems 0             mergeCandidates 0
mergeDecisions 0          metadata 1
migrations 4
```

Both approved durable settings were present exactly. Repeating the same actual upload returned
`already_restored`. The restored synthetic summary opened on `/`, `/activities`, `/calendar`, and
`/run` in explicit Real Canonical mode with no blocking error. The source and target retained zero
Cache Storage entries and zero Service Worker registrations; runtime exceptions, provider endpoint,
OAuth, Token, and Authorization I/O were zero. Both browser processes, temporary profiles, and the
temporary synthetic backup were removed after inspection.

The honest run also observed pre-existing root-page third-party CDN/telemetry attempts and a generic
404 console resource error. The material owner explicitly approved Browser Gate Option A: the fresh
profile backup/restore/storage/Canonical-route evidence is accepted for PR-21, while those existing
`index.html` external static/telemetry attempts and generic 404 remain recorded as out-of-scope
observations. PR-21 does not claim fully offline or clean-console root navigation, does not treat the
same-origin static Strava connector module load as provider endpoint I/O, and does not expand the
sixteen-path maximum to change the root page, telemetry, or CDN dependencies.

## Non-negotiable verification and closure

- Freeze the exact literal cumulative path allowlist only after collision audit; any additional
  path pauses implementation and requires approval.
- Add failure-first coverage for deterministic archive bytes and hashes, every V4 record type,
  binary RawArtifact fidelity, missing/null/zero, opaque IDs, hostile inputs, path traversal and
  container bombs, hash mismatch, incompatible schema, current-library protection, transaction
  abort, quota/interruption/cancellation, repeat restore, new-browser restore, privacy, and safe
  redacted errors.
- Use deterministic synthetic data only. Actual served disposable-profile browser evidence must
  inspect storage before and after a real backup download/import, open major restored Canonical
  routes, and prove zero provider/auth/external telemetry plus clean console/runtime and protected
  Service Worker/Cache/Legacy boundaries.
- Run exact-head focused, full, privacy, syntax, diff, depth-1 checkout, and CI gates. Independent
  findings-first review must be followed by failure-first repairs and a fresh no-findings re-review.
- Final Review Closure changes only this Task Brief. Publication, Ready transition, CI observation,
  merge, cleanup, data deletion, deploy, release, and PR-22 remain separate authorization gates.

## A3 literal cumulative allowlist

The cumulative hard maximum is exactly sixteen paths. A seventeenth path pauses implementation:

1. `docs/tasks/pr-21-backup-restore.md`
2. `docs/migrations/indexeddb-v2.md`
3. `docs/migrations/rollback-plan.md`
4. `source-manager.html`
5. `storage-backup.html`
6. `js/storage-backup.js`
7. `js/app/storage-backup.js`
8. `js/pages/storage-backup/storage-backup.js`
9. `js/backup/index.js`
10. `js/backup/codec.js`
11. `js/backup/backup-service.js`
12. `tests/backup/codec.test.js`
13. `tests/backup/backup-service.test.js`
14. `tests/backup/backup-boundaries.test.js`
15. `tests/backup/backup-browser-smoke.html`
16. `tests/source-manager/source-manager-boundaries.test.js`

## Current authorization boundary

Authorized now: implementation, tests, deterministic disposable-browser evidence, local/depth-1/CI
gates, independent findings-first review, fresh re-review, Task-Brief-only Final Review Closure, and
publication within the frozen contract and sixteen paths. Not authorized: any seventeenth path,
schema/store/index/version/dependency/Repository/Import/public Storage API change, destructive
restore, database deletion/clear/rename, Service Worker, deploy/release, PR Ready, merge,
branch/worktree/task cleanup, user data cleanup, or PR-22.
