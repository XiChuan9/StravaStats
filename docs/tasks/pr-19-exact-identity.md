# PR-19: Exact Identity Resolver

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M16 / PR-19 |
| Status | Paused after A2; material schema/index decision required before A3 |
| Branch | `codex/v2/exact-identity` |
| Base | `integration/v2` at `2f0bff0dc483e73f226437d63f3f10d08cd86d65` |
| Draft PR title | `feat(v2): add exact identity resolver` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Resolve only the four P0 exact identity signals before a Canonical import write:

1. exact provider plus opaque external ID;
2. exact SHA-256 identity of the immutable RawArtifact;
3. the existing deterministic FIT file/session identity;
4. an already-established ActivitySource reference.

An exact match links the newly committed RawArtifact and its source provenance to the one
existing CanonicalActivity without creating a second activity. An unmatched item keeps the
existing new-bundle persistence path. Conflicting exact signals fail atomically. Similar time,
distance, duration, filename, route, sport, statistics, or device metadata never authorizes an
automatic match.

This PR does not implement PR-20 candidates or UI, confidence scoring, fuzzy thresholds,
field-level activity/stream selection, merge/unmerge, provider lifecycle, backup, release, or a
default-mode change.

## A0 exact baseline evidence

- The assigned worktree began clean and detached at exact SHA
  `2f0bff0dc483e73f226437d63f3f10d08cd86d65`; local and origin-tracking
  `integration/v2` resolved to that same SHA.
- The base is the GitHub-authored, single-parent squash merge
  `refactor(v2): cut over Run Plus and NSM to canonical data (#24)`, proving the assigned PR-18
  merge commit is present before PR-19 starts.
- `codex/v2/exact-identity` was absent locally and in the available remote-tracking refs, then
  created at the exact base. The protected long-lived branches were not modified.
- Untouched-base gates passed: `npm ci`; syntax for 205 files; privacy; full suite
  1,337/1,337; and `git diff --check`.
- No real FIT, TCX, GPX, ZIP, GPS route, health or power value, account, Token, Authorization
  value, export, screenshot, private fixture, user profile, or user browser state was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open
a Draft PR targeting `integration/v2` before implementation. The Draft title is frozen above.
The local GitHub CLI is installed but its configured token is invalid, so push and Draft creation
are delegated to the control tower; the user's Chrome profile is prohibited. Draft remains Draft
through implementation, review, and Closure. Ready is a later control-tower action and is never
merge authorization.

## Authority and frozen contracts

Conflict order is accepted ADRs, product PRD, engineering plan and release gates, this Task Brief,
then implementation details. Relevant accepted/frozen boundaries are:

- PRD 7.2: only `exact_match` may establish an automatic source association;
- PRD 8.5 and Epic F: the four literal exact signals above; fuzzy similarity retains both
  activities and belongs to human review;
- ADR-0006: ActivitySource fields remain exactly `id`, `activityId`, `provider`, `externalId`,
  `rawArtifactId`, `acquisitionMethod`, `deviceId`, and `importedAt`;
- CanonicalActivity and ImportedActivityBundle remain unchanged and provider-neutral;
- RawArtifact remains immutable except the existing atomic `pending -> committed` state and
  `activityId` association;
- ImportJob, ImportItem, the state machine, public ImportService, Canonical Store, Repository,
  and seven-method Repository surface remain unchanged;
- V2 database name, physical version 2, stores, indexes, migrations, and Legacy physical
  isolation remain unchanged;
- all application IDs are non-empty opaque strings. No numeric parse, coercion, fallback,
  arithmetic, normalization, or truthiness matching is allowed. Missing, `null`, string `"0"`,
  and numeric zero remain distinct under their existing validators.

## A2 read-only investigation

### Current write graph

```text
Source Manager / ImportService
-> exact UTF-8 SHA-256 and immutable RawArtifact
-> Decoder Registry
-> Normalizer + validateImportedActivityBundle
-> matching state (currently transition-only)
-> ImportStore.persistImportItem(itemId, bundle)
-> one readwrite transaction across Canonical + RawArtifact + ImportItem + ImportJob stores
-> enqueueCanonicalBundleWrite for an unmatched new bundle
```

The existing per-item transaction is already the only safe insertion point. It serializes a
committed duplicate check, all Canonical graph writes, RawArtifact association, ImportItem
terminal state, and ImportJob completed count. Moving identity reads into ImportService would
create a read/match/write race and require a new public store method. A second transaction would
permit partial source or Canonical state. Both are rejected.

### Existing exact evidence

- RawArtifact identity is `raw:` plus its full lowercase SHA-256. `bySha256` exists, and
  `storeRawArtifact` verifies digest, byte length, media type, and content. A committed identical
  artifact is already skipped; concurrent pending contenders are serialized by the per-item
  transaction.
- FIT Decoder v1 emits one deterministic activity ID of the exact shape
  `fit-session:<manufacturer>:<product>:<file-number>:<file-created>:<session-start>`, where each
  part is `x` or a non-negative safe integer string. It excludes device serial number. FIT exact
  matching additionally requires exact `provider: "fit"` provenance on both sides.
- ActivitySource has a primary opaque `id` and the non-unique `byActivityId` index. There is no
  `[provider, externalId]` index even though PRD section 16 lists it as a key index. Selecting a
  transaction-local full source scan or adding the compound index is a material decision; neither
  is accepted before control-tower/user approval.
- Canonical bundle writes are conflict-only and never overwrite a differing graph. Exact linking
  therefore uses a narrowly additive source/device association inside the existing transaction,
  while retaining the stored activity, streams, laps, events, warnings, and versions unchanged.

### Proposed exact resolution semantics common to A/B/C

For one validated incoming bundle and its stored pending RawArtifact:

1. validate every stored source returned by the selected lookup structurally; malformed stored
   identity data fails closed instead of creating a false-negative duplicate;
2. collect candidate activity IDs only from literal source-ID equality, literal provider plus
   non-null external-ID equality, committed same RawArtifact identity, or trusted FIT identity;
3. zero candidate IDs means `unmatched`; exactly one means `exact_match`; more than one means a
   redacted `CONFLICT` with no write;
4. verify the selected Canonical activity exists and is structurally consistent;
5. rewrite only the incoming source records' `activityId` to the selected opaque string ID;
6. retain a byte-equivalent existing source record; when an incoming source primary ID is already
   established but the new artifact provenance differs, allocate the deterministic opaque source
   ID `exact-source:<rawArtifactId>:<ordinal>` and add the new relation;
7. add only referenced missing device records and add their opaque IDs to the existing physical
   activity envelope's device association. A differing device or source primary-key collision is
   a conflict;
8. atomically mark the RawArtifact committed to the selected activity, finish the ImportItem, and
   increment the ImportJob. A request, quota, constraint, validation, or transaction failure
   leaves no partial association or partial Canonical write.

The exact match outcome uses the existing successful `completed` item state. The existing
`skipped_exact_duplicate` state remains reserved for an already-committed identical RawArtifact.
No state, error surface, or report field is added.

### Negative and privacy policy

- Start time, distance, duration, filename, path, route, sport, stream values, lap shape,
  summaries, and device labels are never read as identity evidence.
- String comparisons are exact and case-sensitive. No trim, Unicode normalization, locale,
  numeric conversion, substring, prefix (except validation of the frozen FIT identity grammar),
  tolerance, score, or fallback is permitted.
- Any raw ID, hash, filename, route, payload, platform message, cause, Token, or source value is
  prohibited from public errors, Import Report, UI, DOM, console, logs, fixtures, screenshots,
  review findings, Closure evidence, and PR prose.
- Tests use only small deterministic synthetic values created for this repository. They never
  read or enumerate `tests/fixtures/private/` and never require network or credentials.

## A2 material decision package

No option in this section is Accepted. The implementation and test paths remain untouched while
the task is paused for a control-tower/user decision.

### Benchmark method and limits

The reproducible benchmark is `/tmp/pr19-identity-benchmark.mjs`, intentionally outside the
repository. It uses Node 25.8.1, the installed `fake-indexeddb`, deterministic synthetic source
records, 5,000 and 10,000 existing sources, and 1,000 sequential exact lookups. Half of the keys
exist and half do not. Each A/B lookup uses a separate readwrite transaction, matching the current
per-item persistence lifecycle. Heap deltas are sampled `heapUsed` high-water deltas after an
explicit GC and are directional, not a browser memory claim. These numbers do not satisfy the
future real-browser 5k/10k/1k performance gate; they quantify algorithmic work and materiality.

| Existing sources × lookups | A: full `getAll` | B: compound-index `getAll` | C: one job snapshot + Map |
| --- | --- | --- | --- |
| 5,000 × 1,000 | 8,807.9 ms; 5,000,000 rows materialized; 97,132,792 B sampled heap delta | 124.8 ms; 500 rows materialized; 54,287,608 B sampled heap delta | 10.0 ms; 5,000 rows materialized once; 2,704,992 B sampled heap delta |
| 10,000 × 1,000 | 17,753.9 ms; 10,000,000 rows materialized; 123,217,744 B sampled heap delta | 131.0 ms; 500 rows materialized; 54,180,840 B sampled heap delta | 17.9 ms; 10,000 rows materialized once; 15,971,184 B sampled heap delta |

The first run independently measured A at 8,642.0/18,903.2 ms and B at
126.8/129.8 ms for 5k/10k, respectively. This confirms the order-of-magnitude result rather than
relying on one warm run.

### Option A — version 2 unchanged, per-item full source scan

Identity-specific work is exactly one `activitySources.getAll()` request per item followed by an
exact in-memory scan, in addition to the existing per-item transaction reads. For `N` stored
sources and `M` imported items, it issues `M` full-store requests, materializes and compares
`N × M` source records, has `O(N × M)` time/clone volume, and `O(N)` live lookup memory per item.
The benchmark materialized 5M/10M rows and spent about 8.8/17.8 seconds for the PRD-sized 1,000
lookups before decoder, Canonical, or other import work.

The scan runs inside the existing readwrite persistence transaction so that identity cannot race
the source link. Import cancellation is checked before the job enters `persisting`; that state is
intentionally non-cancellable. Option A therefore adds the measured identity delay to a
non-cancellable phase and lengthens every transaction, increasing contention with other tabs and
connections. It needs no migration and old code can still open the database, but it conflicts
with PRD 9.2's 1,000-file responsiveness direction and PRD 16's explicit compound-index design.
Option A is **not recommended and not Accepted**.

### Option B — additive physical version 3 compound index

Raise only the physical IndexedDB version/schema ID and add the following index to the existing
`activitySources` store:

```text
name: byProviderAndExternalId
keyPath: [provider, externalId]
unique: false
multiEntry: false
```

Non-unique is required so an upgrade does not discard or fail on historical duplicate exact
identities and so the resolver can observe all matches. One returned activity ID is exact; more
than one distinct activity ID is a redacted conflict. IndexedDB omits records whose compound key
is invalid because `externalId` is absent or `null`; an accepted non-empty string, including
literal string `"0"`, is indexed without normalization. Missing, `null`, and zero therefore stay
separate. Provider and external ID comparisons remain exact and case-sensitive.

The lookup cost becomes 1,000 bounded index requests and `O(M log N + K)` logical work, where `K`
is the number of returned exact rows; the benchmark spent about 125–131 ms and materialized only
500 matches. Existing Source Reference IDs still use direct primary-key `get`; RawArtifact uses
its digest-derived primary key/current `bySha256`; FIT uses the Canonical activity primary key plus
the existing `byActivityId` source proof. No public Storage/Import/Repository API is needed.

The upgrade creates and backfills the index in one versionchange transaction. It must add a
physical v2->v3 migration registry record, update metadata/schema verification and backup-manifest
expectations, and prove: fresh v3 creation; additive v2->v3 preservation; duplicate compound keys;
absent/null/string-`"0"` index semantics; abort rollback; explicit retry; old v2 data; multiple
connections closing on `versionchange`; blocked/open failure; exact browser upgrade; and no Legacy
touch. An aborted upgrade retains a readable physical v2 database. A successful v3 database
cannot be opened by old physical-v2 code and returns `VERSION_UNSUPPORTED`; destructive downgrade
is prohibited, so code rollback retains all data but temporarily loses V2 access until v3-capable
code returns. The default Legacy path and Legacy database remain physically untouched.

Candidate B necessarily expands the initial path idea to storage constants, schema, migrations,
database/manifest expectations, and their existing tests/harness. Exact literal paths must be
frozen only after approval and a collision check. Option B best matches PRD 16 and the benchmark,
but it is **not Accepted** because schema/version/index and rollback compatibility require explicit
user approval.

### Option C — existing-key or job-local non-O(N×M) alternatives

Existing keys solve three signals without a new index:

- RawArtifact digest-derived primary key / `bySha256` handles exact raw replay;
- ActivitySource primary-key `get` handles an already-established source ID;
- activities primary-key `get`, followed by `byActivityId` provider proof, handles the frozen FIT
  file/session ID across different raw hashes.

They cannot answer arbitrary exact provider + external ID because ActivitySource IDs are opaque
and current producers do not derive them from that pair. Changing source-ID generation would need
contract/producer changes plus old-record backfill or a fallback scan, so it is not an existing-key
solution.

A one-time per-job `getAll` plus Map is `O(N + M)` and benchmarked at 10.0/17.9 ms. However, the
current import uses one independent transaction per item. A Map cannot see a source committed by
another tab, ImportStore, or job after the snapshot, so it can create a false-negative second
activity. Keeping one transaction open across hashing/worker decode/cancellation is invalid for
IndexedDB lifecycle and would abandon per-item commit/recovery. Adding a cross-connection revision
or batch API is itself new schema/public-contract work. Therefore C is performant but incomplete
or race-unsafe and is **not recommended and not Accepted**.

### Common identity/link semantics proposed for the approved option

- Existing Source Reference lookup is its exact opaque primary ID. If that reference and another
  exact signal identify different Canonical activities, the transaction fails; it never chooses.
- Provider/external lookup may return multiple records for one activity and still agree. More than
  one distinct activity ID is `CONFLICT` with no mutation.
- A new external/raw source is added in the existing per-item readwrite transaction. Only source
  and referenced-device associations are additive; stored Canonical activity payload, streams,
  laps, events, warnings, and versions are retained byte-for-byte. RawArtifact commit/activityId,
  ImportItem terminal state, and ImportJob count complete in that same transaction. Any request or
  validation failure aborts every change.
- FIT identity is sufficient only when the incoming ID matches the frozen five-part
  `fit-session:` grammar and both incoming and stored provenance are exactly provider `fit`. Since
  the ID derives file/session fields rather than raw bytes, a different raw hash can match. The new
  RawArtifact and an additional deterministic source relation are then linked atomically.
- PR-19 owns exact lookup/link and, only if approved, the minimum index migration. PR-20 retains
  fuzzy candidates, confidence, review UI, merge decisions, field selection, and unmerge. PR-21
  retains full backup/restore format and must later understand the then-current physical version.
  PR-22 retains general diagnostics and large-scale performance gates, but does not excuse PR-19
  from choosing and verifying a bounded identity lookup now.

### Recommendation and approval request

Recommend **B**, conditional on explicit approval of physical IndexedDB version 3, schema ID 3,
one non-unique compound index, its additive migration/verification tests, the expanded literal
allowlist, and the documented old-code `VERSION_UNSUPPORTED` rollback limitation. If that rollback
limitation is unacceptable, PR-19 needs a new material design decision rather than falling back to
A or unsafe C.

## A3 HOLD — no implementation allowlist frozen

The earlier eight-path/schema-unchanged idea is withdrawn. Until the control tower/user selects a
material option, the only writable path is this Task Brief for candidate/Paused accounting. No
implementation or test file is authorized. After approval, A3 must freeze a fresh literal
cumulative allowlist and the chosen physical/API/transaction boundary before failure-first tests.

### Prohibited changes

- `package.json`, lockfile, dependency, production build, Service Worker, page, tab, CSS, UI,
  route, source-manager, decoder, contract, Repository, feature-flag, auth, provider, disconnect,
  deletion, backup, deployment, release, or Legacy path changes;
- IndexedDB name, version, schema, store, key path, index, migration, database open/close, delete,
  clear, overwrite-as-recovery, or destructive helper changes;
- CanonicalActivity, ImportedActivityBundle, ActivitySource, RawArtifact, Import state, public API,
  export, status, error code, report shape, or Repository surface changes;
- fuzzy/high-confidence matching, thresholds, candidates, review UI, confirm/keep-separate,
  field-level merge, source preference, stream replacement, unmerge, or PR-20 work;
- real data, user browser/profile, credential, provider network, merge, cleanup, deploy, release,
  or PR-20 start.

If evidence shows that a prohibited schema/index/version, public API, Canonical contract,
production dependency, disconnect/delete lifecycle, fuzzy threshold, or PR-20 change is required,
implementation pauses with a material decision package for the control tower. No such change is
silently added.

## Failure-first verification matrix

Focused tests must first fail because the resolver/link path does not exist, then pass for:

- exact provider + external ID, including opaque string `"0"`;
- exact committed RawArtifact SHA replay and concurrent pending replay;
- exact trusted FIT file/session identity;
- exact established ActivitySource primary ID;
- one activity reached through multiple agreeing exact signals;
- multiple exact signals pointing to different activity IDs -> atomic conflict;
- missing and `null` external ID do not match; numeric zero is rejected by the existing bundle
  validator; provider and external ID case differences do not match;
- close-but-different time, distance, duration, filename-like text, route-like data, sport,
  statistics, and device labels remain separate;
- source/device primary-key conflicts -> no source, device, activity-envelope, RawArtifact,
  ImportItem, or ImportJob partial write;
- quota/constraint/abort injection -> complete rollback;
- retry and replay are idempotent; concurrency creates one Canonical activity;
- all outputs, errors, reports, DOM evidence, and source literals remain redacted;
- module import has zero IndexedDB, network, DOM, timer, Worker, console, or provider side effects;
- public Storage, Import, Repository, contract, schema, migration, Legacy, Demo, Canonical read,
  default mode, and rollback boundaries remain unchanged.

Required commands are:

```text
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/storage/exact-identity-resolver.test.js
node --test tests/storage/exact-identity-transactions.test.js
node --test tests/storage/exact-identity-boundaries.test.js
node --test tests/import/exact-identity-import.test.js
npm test
git diff --check
```

The browser harness is deterministic, synthetic, same-origin, and must exercise the real
ImportStore transaction in browser IndexedDB. Its initial source is evidence seeding only and may
not claim a browser pass. A pass may be recorded only after the served harness actually runs.

## Rollback, migration, and privacy

Rollback is a code revert or switching the existing read mode to Legacy. It requires no data
migration and deletes nothing. Existing V2 Canonical data, source relations, RawArtifacts, import
logs, Demo data, and Legacy IndexedDB remain intact. An exact source association created by this
PR is additive provenance and is not removed by rollback. Disconnect and local-data deletion
remain separate existing concerns.

Migration impact is `None`: physical version, schema ID, stores, indexes, migrations, and
Canonical schema do not change. Privacy impact is bounded to existing local-only provenance;
there is no new collection, network, telemetry, logging, UI, export, or public error field.

## Closure

Not started. This section is updated only after implementation, focused and full verification,
findings-first independent review, repair, fresh re-review, exact-head CI, and control-tower Ready
handoff. Ready is not merge authorization.
