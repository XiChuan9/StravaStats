# PR-16: Canonical Summary Cutover

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation |
| Milestone | M13 |
| Base branch | `integration/v2` |
| Exact base SHA | `b8525bce7ca7d536f30ad3ed7312332a12ef243e` |
| Feature branch | `codex/v2/cutover-summary` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/ecf4/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent findings-first Final Review before Ready transition |
| Dependency | PR-15 local-first bootstrap merged into `integration/v2` |
| Created | 2026-08-06 |
| Draft PR title | `refactor(v2): cut over summary consumers to canonical data` |

## Goal

Make the V2-only Local Library useful beyond the Dashboard shell by driving the
existing summary-consumer path through the Canonical Store, one Canonical
Repository session, and an explicit Legacy-shaped read projection. Preserve the
existing Legacy and Demo repositories, the current shadow observation/write
path, an explicit Canonical feature flag, and a one-step Legacy rollback.

PR-16 owns summary consumers only, in the development-plan order:

```text
Activities
Calendar
Wrapped
Dashboard
Run
Bike
Swim
Gear
Map
Planner
```

The global default remains Legacy. PR-23, not this PR, owns changing the default
to Canonical.

## A0 baseline evidence

- The assigned worktree was clean at exact base
  `b8525bce7ca7d536f30ad3ed7312332a12ef243e`; local
  `integration/v2` and `HEAD` matched before creating only
  `codex/v2/cutover-summary`.
- `npm ci`, syntax for 199 files, privacy, and `git diff --check` passed.
- A controlled serial full suite passed 1,291/1,291 with zero failure,
  cancellation, skip, or todo in 34,545.944 ms. An earlier default-concurrency
  run stopped producing runner output and was interrupted; its isolated
  suspected Legacy file passed 53/53. No product or test file was changed.
- No real activity, route, account, Token, credential, private fixture, export,
  screenshot, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with
`integration/v2 <- codex/v2/cutover-summary` and the frozen title above. GitHub
write failure is handed to the control tower; it does not authorize use of a
user Chrome login or change the implementation scope.

## A2 read-only investigation

### Current repository and startup graph

The public Repository surface has exactly five exports and seven methods:

```text
createRepository
createRepositoryWithDependencies
RepositoryError
REPOSITORY_ERROR_CODE
REPOSITORY_SOURCE

listActivities
getActivity
getStreams
getAthlete
getZones
getGears
getGear
```

The factory currently selects Demo before constructing Real dependencies and
supports only Legacy for Real sessions. `DEFAULT_FEATURE_FLAGS.dataRepositoryMode`
is the literal `legacy`; the already accepted explicit values are `legacy`,
`shadow`, and `canonical`. PR-15 independently detects V2 presence, preserves a
V2-only Dashboard shell, and leaves summary cutover to PR-16.

The root consumer graph is:

```text
root startup / PR-15 bootstrap
-> Demo: existing DemoRepository
-> Real legacy: existing LegacyRepository
-> Real shadow: existing LegacyRepository read + shadow observation/write
-> Real canonical: new CanonicalRepository
-> listActivities()
-> one Legacy-shaped summary projection array
-> existing preprocessActivities
-> setupDashboard / tab configuration
-> Activities, Calendar, Wrapped, Dashboard, Run, Bike, Swim, Gear, Map, Planner
```

Pages and tabs continue to receive the one injected array. They do not choose a
database, Store, provider, Token, cache, or source mode. Planner is an actual
summary consumer: `js/tabs/index.js` exports it, `js/app/main.js` registers the
`/planner` route and injects `allActivities`, and `js/tabs/planner.js` only
filters and sorts that array. Planner performs no Repository, IndexedDB,
provider, Token, or network read, so it enters the boundary and browser parity
inventory without a product-code change.

### Canonical Store gap and A2.1 decision

The current `listActivities` accepts only `sportCategory`, `limit`, and
`direction`; it rejects limits over 500, reads all matching records, sorts them,
and slices the first page. Repeating the same call therefore cannot return item
501. A complete summary response with `partial: false` is impossible without a
bounded paging contract.

The approved A3.1 decision extends the existing method options with one keyset
cursor. Raising the limit would preserve the current unbounded intermediate
read and create another finite cliff. Returning only 500 records with
`partial: true` would be truthful but would fail summary parity. An unbounded
public mode or Repository access to IndexedDB would respectively create a
long-transaction/memory risk or violate the Store boundary. No new Store
method, Repository method, schema, store, index, version, or migration is
needed.

## A3.1 frozen contract and literal allowlist

### Literal path allowlist

Implementation, tests, review repairs, and Closure may change exactly these 20
paths and no twenty-first path:

```text
docs/tasks/pr-16-canonical-summary-cutover.md
js/app/main.js
js/repository/errors.js
js/repository/factory.js
js/repository/canonical/canonical-repository.js
js/repository/canonical/summary-projection.js
js/storage/canonical-store.js
js/storage/transaction.js
tests/consumers/summary-consumers.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/canonical-summary-browser-smoke.html
tests/repository/canonical-repository.test.js
tests/repository/repository-contract.test.js
tests/repository/repository-factory.test.js
tests/repository/dependency-boundaries.test.js
tests/repository/strava-api-connector.test.js
tests/shadow/shadow-app-integration.test.js
tests/shadow/shadow-boundaries.test.js
tests/storage/canonical-pagination.test.js
tests/storage/canonical-store.test.js
```

There is no directory glob or cumulative prior-PR permission. The Task Brief,
Canonical Repository, Canonical summary projection, pagination test, and new
browser harness are new files; all other entries are existing paths.

### A3.2 approved test-only boundary repair

The existing `tests/storage/canonical-store.test.js` froze the former
`listActivities` implementation by spying on `IDBIndex.prototype.getAll` and
requiring one exact call. The approved bounded keyset implementation correctly
uses `openCursor`; without a redundant probe, the new 503-record pagination
suite passed 3/3 while that one old implementation spy failed (the other 15
Canonical Store tests passed). A semantic-free `getAll` probe was proven
unnecessary for transaction completion and would add an unauthorized data
request.

The user therefore approved A3.2 to add only this nineteenth path. Its sole
change replaces the implementation spy with `openCursor`, retains the exact
`activities` / `byStartTimeUtc` boundary assertion, and explicitly asserts zero
`getAll` calls. `boundedIndexProbe` and the probe-only `getAll(count)` extension
remain prohibited. No other old test meaning or product contract changes.

### A3.3 approved test-only boundary repair

The serial full suite then passed 1306 of 1307 tests. Its sole failure was the
PR-07 boundary test's whole-file SHA-256 freeze of
`js/repository/factory.js`: the approved PR-16 Canonical routing necessarily
changes that implementation file while preserving the public Repository
surface. Updating the digest would merely recreate the same future-hostile
blocker for the next approved Factory change.

The user therefore approved A3.3 to add only this twentieth path. Its sole
change removes the Factory whole-file digest from `FROZEN_HASHES`; the other
four stable public/schema/storage hashes and every existing Shadow test
meaning remain intact. Product code is not changed to satisfy the stale hash,
and the PR-16 Factory routing is covered by focused public-contract, Factory,
dependency-boundary, and Shadow-integration assertions.

### Prohibited paths and operations

The following remain unmodified: `js/app/feature-flags.js`,
`js/app/local-first-bootstrap.js`, `js/repository/index.js`, every Canonical
schema/contract/import/decoder/analysis file, IndexedDB database/index/schema/
constants/version/migration files, every detail-page and Run Plus/NSM consumer,
all dependencies, Service Worker, release, deployment, and production
configuration. The finalized
`tests/consumers/summary-browser-smoke.html` and
`tests/bootstrap/local-first-bootstrap-browser-smoke.html` remain unchanged.

Do not delete, clear, overwrite, migrate, reverse-copy, or repair Legacy or V2
data. Do not merge, auto-merge, deploy, release, clean the branch/worktree, or
start PR-17, PR-18, or M14.

### Public Canonical Store pagination contract

`listActivities(options)` retains `sportCategory`, integer `limit` from 1
through 500, and `direction` equal to `asc` or `desc`. It adds only:

```js
cursor?: {
  startTimeUtc: string,
  id: string
}
```

An absent cursor requests the first page. A cursor is exclusive and compares
the tuple `(startTimeUtc, id)` using JavaScript code-unit lexicographic order.
Ascending returns tuples strictly greater than the cursor; descending returns
tuples strictly less. Activity IDs and cursor IDs are opaque, non-empty strings
and are never parsed, normalized, coerced, or numerically sorted. The timestamp
must satisfy the existing strict fixed-millisecond UTC instant contract.

The cursor must be an ordinary Object or null-prototype record with exactly the
two own enumerable data properties. `null`, arrays, accessors, symbol keys,
custom prototypes, Proxies/reflection failures, invalid timestamps, and blank
IDs reject with the existing redacted Storage `INVALID_REQUEST` before database
transaction I/O. Returned pages preserve the existing deeply frozen detached
CanonicalActivity array contract.

The Store implementation performs a bounded cursor scan through the existing
start-time index, applies the opaque-ID tie-break and optional sport filter,
and stops after `limit`. The private transaction context may add only the
bounded cursor-read primitive required by this Store implementation; it does
not expose an IndexedDB handle or add public Storage surface.

Pagination provides monotonic, duplicate-free, read-committed traversal, not a
strict snapshot, MVCC view, or first-page watermark. Concurrent inserts in the
unread range may enter the traversal; inserts in a range already passed wait
for a later refresh.

### Canonical Repository and source contract

`REPOSITORY_SOURCE` adds the public literal `CANONICAL: 'canonical'`. Canonical
must never masquerade as `cache`. Existing `cache`, `network`, `demo`, and
`mixed` literals remain unchanged. Public exports remain five and public
methods remain seven.

For a Real Canonical session, `listActivities()` validates the existing public
summary option shape, then repeatedly calls Store `listActivities` with fixed
`direction: 'desc'` and `limit: 500`, using the last activity tuple as the next
cursor. A page shorter than 500 terminates traversal; an exact multiple may
make one empty terminal call. Only after every page succeeds and every record
projects successfully does the Repository return one deeply detached,
immutable envelope:

```js
{
  data: projectedActivities,
  source: 'canonical',
  warnings: [],
  partial: false
}
```

There is no successful partial response. Storage `INVALID_REQUEST` maps to a
redacted Repository `INVALID_REQUEST`; failed or invalid local reads map to the
existing redacted `RESPONSE_INVALID` with `operation: 'listActivities'`, no raw
cause, record, ID, database detail, or provider wording in logs. The generic
public response-invalid message may be corrected from provider-specific to
Repository wording without adding an error code.

Canonical neutral metadata is exact and does not fabricate athlete, zones, or
gear data:

```text
getAthlete -> data null
getZones   -> data null
getGears   -> data []
getGear    -> data null after validating an opaque non-empty string ID
```

Every neutral result has `source: 'canonical'`, `warnings: []`, and
`partial: false`. `getActivity` and `getStreams` retain callable methods but
reject with redacted `UNSUPPORTED_MODE` and perform no Store/provider/Legacy
I/O; PR-17 and PR-18 own their consumers and projections.

Factory construction and module import perform zero database, IndexedDB,
Legacy, provider, Token, network, DOM, timer, Worker, console, or Service Worker
I/O. Real Canonical Store construction/open is lazy. Demo selection precedes
all Real dependency construction and never opens the V2 Real database.

### Summary read-projection contract

The projection is the only Canonical-to-current-summary compatibility boundary.
It accepts one validated CanonicalActivity snapshot and returns a detached,
deeply frozen plain object. It has no IndexedDB, Repository, provider, Token,
network, DOM, clock, locale, `Intl`, storage, or analysis dependency.

It maps only truthful Canonical values:

```text
id                      <- id, unchanged opaque string
type / sport_type       <- stable category/known-variant compatibility name
name                    <- name when present, including null
distance                <- distanceMeters when present, including null/0
moving_time             <- movingTimeSeconds when present, including null/0
elapsed_time            <- elapsedTimeSeconds when present, including null/0
start_date              <- startTimeUtc
start_date_local        <- deterministic offset wall time when offset is known;
                           otherwise the same absolute UTC instant
average_heartrate       <- averageHeartRateBpm when present, including null/0
average_watts           <- averagePowerWatts when present, including null/0
average_cadence         <- averageCadence when present, including null/0
gear_id                 <- documented shadow extension value when explicitly
                           present, including null
```

Known category/variant pairs map to the current compatibility vocabulary (for
example `run/null -> Run`, `run/trail-run -> TrailRun`,
`ride/mountain-bike -> MountainBikeRide`, and `swim/null -> Swim`). An unknown
variant safely falls back to its category compatibility name instead of
inventing a provider type. A missing optional Canonical field remains missing;
`null`, `0`, and negative zero remain distinct values. No polyline is present
in CanonicalActivity summary storage, so the projection does not fabricate a
`map`, coordinates, gear, streams, laps, events, speed, elevation analysis, or
provider-owned field.

### Mode orchestration and rollback contract

- `DEFAULT_FEATURE_FLAGS.dataRepositoryMode` remains literal `legacy`.
- Real + explicit `legacy` keeps the current Legacy read path.
- Real + explicit `shadow` keeps the current Legacy read plus existing shadow
  observation/write; Canonical never becomes the shadow read source.
- Real + explicit `canonical` uses Canonical Repository for the summary session
  and performs zero provider, Token, Legacy Repository, Legacy IndexedDB, or
  Legacy localStorage read.
- Demo takes priority over the data-repository flag, keeps DemoRepository, and
  performs zero Real V2 open or other Real storage read.
- PR-15 default-Legacy V2-only shell behavior and its finalized test remain
  unchanged. The new PR-16 harness explicitly enables Canonical to prove the
  V2-only root path renders real summary consumers.

Rollback is a one-line operational flag selection back to `legacy` or a normal
revert of this bounded PR. It retains the complete Legacy and V2 libraries and
does not delete, clear, migrate, downgrade, or overwrite data.

### Boundary and regression tests

The Storage pagination test uses actual `fake-indexeddb` with at least 503
synthetic activities. It covers same-timestamp page boundaries, opaque IDs such
as numeric-looking and URL/punctuation strings, asc/desc, sport filtering,
exact-multiple termination, no gap/duplicate, stable ordering, absent/null/zero,
hostile cursor validation before transaction I/O, and the documented
read-committed concurrent-insert semantics.

Repository tests prove all seven methods, exact envelopes, deep detach/freeze,
complete results beyond 500, projection parity, redacted failure mapping,
import/construction zero I/O, Demo-first isolation, lazy Real Store open, and
zero Legacy/provider/Token I/O. Existing source constant snapshots, adapters,
factory tests, shadow integration, summary consumers, and literal dependency
boundaries are updated only where the new truthful Canonical source or frozen
PR-16 path requires it. Boundary checks freeze this PR's literal paths and
stable public surfaces; they do not introduce a future-hostile global tree
digest.

The new `tests/consumers/canonical-summary-browser-smoke.html` is the sole new
PR-16 harness. It seeds only deterministic synthetic data into the actual V2
database, explicitly selects Real Canonical mode, loads the served root app,
and checks all ten summary routes including Planner. It also covers V2-only,
Legacy/Canonical sentinel isolation, Demo isolation, shadow preservation,
offline/provider failure, more than 500 records, tab clicks/history, zero
provider/Token/Authorization I/O, safe console/runtime behavior, and storage/
Service Worker evidence. It never uses a real Token, account, activity, private
fixture, route, user Chrome profile, or provider network.

## Verification contract

Required local evidence:

```text
npm ci
npm run check:syntax
npm run check:privacy
focused Canonical Repository/Storage/summary/shadow/factory tests
focused Legacy/Storage/Repository regressions
npm test
git diff --check
literal allowlist and prohibited-surface audits
depth-1/shallow-clone CI-safe boundary verification
```

A disposable synthetic-profile served Browser/CDP run observes the actual app
before navigation and records provider/external requests, Authorization,
Fetch/XHR/WebSocket, console/runtime/log events, IndexedDB database metadata
and safe counts, Cache Storage, and Service Worker registrations. Browser and
CI results are reported only if actually run.

After implementation, an independent reviewer performs a findings-first review
of the exact-base diff. Each actionable finding receives a focused failing
regression before repair. A fresh independent re-review must report no
actionable finding. Closure is one final edit to this Task Brief recording the
exact evidence; any Closure commit receives fresh exact-head CI before the
control tower moves the Draft PR to Ready for review. Ready is not merge
authorization.

## Privacy, migration, rollback, and stop conditions

Only deterministic synthetic fixtures are committed or used in Browser/CDP.
No Token, Authorization header, raw private activity, route/GPS track,
heart-rate/power stream, export, filename, account data, storage handle, raw
error, or provider response enters committed fixtures, UI error copy, console,
screenshots, reports, CI logs, or PR text.

There is no schema or data migration. Pagination is a read-only option-contract
extension over existing indexes. Canonical writes remain owned by Import and
the existing shadow writer. Legacy and Canonical stores stay isolated and
unchanged by reads.

Pause only for a required nineteenth path, a new public method, schema/index/
version/migration change, analysis or provider-auth change, production
dependency, Service Worker/release/deployment change, destructive data action,
real credential/private-data requirement, PR-17/18 expansion, merge, cleanup,
or another substantive architecture/product decision.

## Closure ledger

Pending implementation, local and Browser/CDP verification, independent Final
Review, fresh re-review, exact-head CI, and Ready handoff.
