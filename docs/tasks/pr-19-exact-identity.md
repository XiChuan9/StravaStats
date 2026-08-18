# PR-19: Exact Identity Resolver

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M16 / PR-19 |
| Status | A3.3 test-only expansion approved for implementation; Draft PR #25 |
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
- V2 database name, stores, key paths, and Legacy physical isolation remain unchanged; physical
  version 3 adds only the approved non-unique compound source-identity index and version-specific
  migration snapshot;
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

### A3.1 approved common identity/link semantics

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

### A3.1 approval record

The user explicitly approved Candidate B through the control tower after reviewing the A/B/C
evidence and rollback trade-off. The accepted material boundary is:

- physical IndexedDB version `3` and schema ID `strava-stats-v2@3`;
- one non-unique compound `activitySources` index with exact key path
  `["provider", "externalId"]`;
- version-specific v1, v2, and v3 physical descriptors/snapshots so each structural migration is
  attributed to the version that introduced it;
- the successful-upgrade rollback limitation that old physical-v2 code returns
  `VERSION_UNSUPPORTED`; no destructive downgrade, data deletion, store replacement, or record
  rewrite is allowed;
- the initial 17-path cumulative allowlist below. A new path or material contract requires a new decision
  package and pause.

### A3.2 test-only expansion approval record

The existing ImportService regression at `tests/import/import-core.test.js` encoded the superseded
behavior that different raw bytes with the same exact Strava provider/external identity must
conflict. After the A3.1 implementation, that was the sole failure in the 27-test existing import
suite: 26 passed and the old conflict assertion failed because the item correctly completed.
Leaving the test unchanged made the full-suite gate impossible; restoring the old behavior would
violate the approved exact-link contract.

The user explicitly approved one test-only expansion through the control tower: add that existing
test file as the eighteenth literal path, change only the affected test name and assertions to
require one completed item, zero failed items, a null error code, one preview activity, and an
unchanged original Canonical activity payload. ImportService, public APIs, Canonical contracts,
and all other frozen boundaries remain unchanged.

### A3.3 test-only expansion approval record

The first full regression passed 1,356 of 1,357 tests. Its only failure was the PR-07 Shadow
boundary test's mutable whole-file SHA freeze over the approved `schema.js` and `constants.js`
changes. The public Storage and Repository entry files themselves remained byte-identical. Merely
refreshing hashes would retain a future-hostile gate and contradict this brief's stable-boundary
rule.

The user explicitly approved one further test-only expansion through the control tower: add
`tests/shadow/shadow-boundaries.test.js` as the nineteenth literal path, remove its `node:crypto`
hash dependency and whole-file map, and replace only that hash test with exact semantic assertions
over the existing seven Storage exports and five Repository exports. Shadow production code,
public APIs, Canonical contracts, and all other frozen boundaries remain unchanged.

## A3.3 frozen implementation boundary

Implementation, failure-first tests, review repairs, browser evidence, and Closure may modify
exactly these 19 cumulative paths and no twentieth path:

```text
docs/tasks/pr-19-exact-identity.md
docs/migrations/indexeddb-v2.md
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/exact-identity-resolver.js
js/storage/import-store.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/storage/exact-identity-resolver.test.js
tests/storage/exact-identity-transactions.test.js
tests/storage/exact-identity-boundaries.test.js
tests/storage/exact-identity-performance.test.js
tests/import/exact-identity-import.test.js
tests/import/import-core.test.js
tests/storage/exact-identity-browser-smoke.html
tests/shadow/shadow-boundaries.test.js
```

This is a literal allowlist, not a directory glob. Public `js/storage/index.js`, production
`backup-manifest.js`, Canonical contracts, `canonical-store.js`, Repository, ImportService,
decoders, Service Worker, dependencies, and every UI path stay unchanged. Stable public-boundary
and literal-source assertions are required. Whole-tree manifests and mutable whole-file hashes are
prohibited.

### Prohibited changes

- `package.json`, lockfile, dependency, production build, Service Worker, page, tab, CSS, UI,
  route, source-manager, decoder, contract, Repository, feature-flag, auth, provider, disconnect,
  deletion, backup, deployment, release, or Legacy path changes;
- IndexedDB database name, store/key-path changes, indexes other than the one approved compound
  index, migrations other than the version-specific additive v3 migration, database open/close,
  delete, clear, downgrade, overwrite-as-recovery, or destructive helper changes;
- CanonicalActivity, ImportedActivityBundle, ActivitySource, RawArtifact, Import state, public API,
  export, status, error code, report shape, or Repository surface changes;
- fuzzy/high-confidence matching, thresholds, candidates, review UI, confirm/keep-separate,
  field-level merge, source preference, stream replacement, unmerge, or PR-20 work;
- real data, user browser/profile, credential, provider network, merge, cleanup, deploy, release,
  or PR-20 start.

If evidence shows that another schema/index/version, public API, Canonical contract,
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
node --test tests/storage/exact-identity-performance.test.js
node --test tests/import/exact-identity-import.test.js
npm test
git diff --check
```

The browser harness is deterministic, synthetic, same-origin, and must exercise the real
ImportStore transaction in browser IndexedDB. Its initial source is evidence seeding only and may
not claim a browser pass. A pass may be recorded only after the served harness actually runs.

## Rollback, migration, and privacy

Rollback uses the existing Feature Flag to select Legacy reads; it deletes nothing. A code revert
to physical-v2 logic after a successful v3 upgrade returns `VERSION_UNSUPPORTED` for the V2
database and must not downgrade, repair, clear, or recreate it. Returning to v3-capable code makes
the retained V2 records readable again. Existing Canonical data, source relations, RawArtifacts,
import logs, Demo data, and Legacy IndexedDB remain intact. An exact source association is additive
provenance and is not removed by rollback. Disconnect and local-data deletion remain separate.

Migration impact is one additive physical v2->v3 index migration with exact version-specific
descriptors. It adds no store and rewrites no logical record. Privacy impact is bounded to an
existing local-only compound index over already-stored provenance; there is no new collection,
network, telemetry, logging, UI, export, or public error field.

## Closure

### Delivered contract and scope

Implementation commit `6ac1d3628e3491792ed8bb8ab1c337ed275a12bf` delivers the approved
A3.1/A3.2/A3.3 scope on the exact 19-path allowlist. Physical IndexedDB schema v3 adds only the
non-unique `activitySources.byProviderAndExternalId` compound index over `[provider, externalId]`.
Frozen v1, v2, and v3 physical descriptors attribute each migration exactly; the additive v2->v3
upgrade preserves every record and an aborted upgrade retains physical v2 for explicit retry.

The internal resolver accepts only the approved exact identities: established ActivitySource
primary identity, exact provider plus opaque string external identity, committed RawArtifact
identity, and trusted FIT file/session identity with existing source proof. Missing, `null`,
numeric zero, string zero, and case differences remain distinct under their frozen validators.
Time, distance, duration, filename-like text, route-like data, sport, statistics, and device labels
never select a Canonical activity. Multiple exact signals that reach different activities, or one
identity already associated with multiple activities, fail closed instead of choosing a target.

Exact linking runs inside the existing per-item readwrite transaction. It validates the complete
persisted Canonical envelope and referenced source/device records before adding provenance,
associates a new RawArtifact/source with the existing activity atomically, and does not replace
the Canonical payload, streams, laps, events, or metadata. Replays remain idempotent. Any
validation, collision, constraint, quota, or abort failure rolls back source/device association,
RawArtifact transition, ImportItem, and ImportJob changes together.

No public Storage export, Repository export, Canonical contract, Canonical store, ImportService,
decoder, Service Worker, dependency, UI, provider lifecycle, disconnect/delete behavior, Legacy
path, Demo path, or default mode changed. PR-20 review UI and field-level merge/unmerge remain out
of scope. The A3.3 Shadow guard now checks the stable seven-member Storage and five-member
Repository public surfaces semantically instead of freezing mutable whole-file hashes.

### Findings-first review and repairs

The first independent findings-first review identified four issues, each reproduced with a
failure-first test before repair:

1. committed RawArtifact replay bypassed the unified candidate set and target validation;
2. the generic IndexedDB browser harness still asserted physical-v2 success behavior;
3. a generated source key could collide with another incoming source and surface as a late
   constraint failure rather than a redacted exact conflict;
4. an idempotently existing source skipped validation of its referenced device.

The repairs unified committed-raw candidates, validated the target before writes, moved the
generic harness to v3 with a non-destructive unsupported-v4 probe, preflighted generated source
keys, and validated device references even for accepted existing sources. A fresh independent
review then found one additional P1: target validation accepted a shallow but malformed Canonical
envelope. Failure-first committed-replay and pending-link tests reproduced it; the repair now
requires the exact Canonical schema, a valid CanonicalActivity, matching activity and version
metadata schemas, descriptor-safe envelope values, dense warnings, and sorted unique opaque
device IDs before any finalize/add/put operation.

Fresh re-review verified all five findings closed and returned **no findings**. A final narrow
review of the 10k/1k performance fixture and complete 19-path diff also returned **no findings**;
it confirmed that the reduced seed shape still populates the real primary and compound indexes
and does not weaken the recorded full-record decision benchmark.

### Verification evidence

- Baseline at the exact integration base: `npm ci`; syntax 205 files; privacy pass; full tests
  1337/1337; diff check pass.
- Final implementation worktree: `npm ci`; focused exact/migration/import/boundary/Shadow tests
  79/79; syntax 211 files; privacy pass; full `npm test` 1363/1363; diff check pass; exact 19-path
  gate; clean worktree and index (0/0).
- Two earlier parallel full-suite attempts each exposed a different pre-existing Legacy timing
  fluctuation. Both named cases passed in isolation; the subsequent implementation-worktree and
  depth-1 full runs each passed 1363/1363.
- Performance gate: 10,000 actual IndexedDB source records and 1,000 exact lookups issued exactly
  1,000 compound-index requests, zero full-store scans, and materialized 500 bounded matches under
  the five-second limit.
- Deterministic synthetic same-origin browser evidence exercised the real ImportStore transaction:
  physical-v2 seed upgraded to v3 with index backfill; the index remained non-unique and omitted
  absent/null keys; exact provider identity linked provenance to one existing Canonical activity;
  Canonical payload remained unchanged; fuzzy-only input remained separate; RawArtifact
  association was atomic; the Legacy sentinel was unchanged. Network, authentication, console,
  page-error, Service Worker, and cache counters were all zero.
- The generic IndexedDB browser harness passed 19/19 on a fresh isolated origin with physical v3,
  11 stores, nine indexes, reload and manifest checks, a rejected unsupported-v4 attempt that left
  v3 intact, and an unchanged Legacy sentinel. No real account, Token, activity, profile, route,
  health data, or user browser was used.
- A true depth-1 clone at the implementation head had history count 1 and passed `npm ci`, focused
  79/79, syntax 211 files, privacy, full tests 1363/1363, diff check, and clean 0/0.
- GitHub implementation-head CI run
  `https://github.com/XiChuan9/StravaStats/actions/runs/31095536385` (job
  `92596533643`) concluded **SUCCESS** at exact head
  `6ac1d3628e3491792ed8bb8ab1c337ed275a12bf`; install, syntax, privacy, and tests all succeeded.

### Migration, privacy, rollback, and release state

Migration is additive, idempotent, recoverable, and preserves all v1/v2 data. No destructive
downgrade exists. Old physical-v2 code may return `VERSION_UNSUPPORTED` after a successful v3
upgrade; returning to v3-capable code restores access to the retained data. Feature-flag rollback
continues to select Legacy reads without deleting V2 or Legacy data, and disconnect remains
separate from local deletion.

Privacy impact is limited to a local index over already-stored source provenance. No new data is
collected or transmitted, and public errors, reports, browser evidence, UI, console, and logs do
not expose raw identity, digest, filename, route, payload, platform cause, or credential values.

Draft PR #25 remained OPEN, Draft, unmerged, based on `integration/v2`, and contained exactly the
19 approved files at the implementation CI head. Closure-commit push, PR-body finalization,
closure exact-head CI, Ready transition, merge, cleanup, deploy, release, and PR-20 start were
**Not run** when this Closure was written. The control tower owns those GitHub operations. Ready
will indicate review readiness only and is not merge authorization.
