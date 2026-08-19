# PR-43a: Synthetic Provider Bundle Mapper

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C3a pure provider mapper |
| Status | C3a implemented and independently closed; awaiting exact-head CI and Ready handoff |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@92a735fb4d4809173c5fddf868416bf44642faed` |
| Exact base tree | `568cf2457f418130ec0a6641478eb45a60e676c1` |
| Feature branch | `codex/v2/provider-bundle-mapper` |
| Worktree | `<worktree-root>/<task-name>` |
| Parent decision | PR-43 / `D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A` |
| Parent Draft | PR #49 |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Freeze the separately approvable C3a contract for a pure, deterministic, synthetic-only Strava
provider mapper. C3a accepts an injected synthetic authorization/identity snapshot and bounded
synthetic provider records, proves exact SourceConnection subject/scope authorization before
mapping, and returns accepted `ImportedActivityBundle` values without network, Token, storage,
Worker, DOM, or provider side effects.

The owner subsequently approved the exact frozen C3a A3 implementation and literal eight-path hard
maximum. C3b, C3c, live provider/auth work, persistence, and every other excluded surface remain
separately gated.

## Authority

The owner selected verbatim:

> 批准 D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A

The owner then approved C3a implementation verbatim:

> 批准 C3a A3 实施及精确 8 路径上限。

For C3a this freezes only:

- injected deterministic synthetic authorization/identity authority;
- a pure bounded summary + detail + supported-stream mapping contract;
- at most 100 activities per foreground acquisition and at most two concurrent per-activity
  operations in the later orchestrator;
- deterministic reduced provider input and `ImportedActivityBundle` output; and
- separate C3a, C3b, and C3c approvals.

The C3a approval does not authorize C3b provider-artifact/ImportService integration, C3c live
read/auth/UI, OAuth, Token, account/provider/private evidence, schema/public/dependency/Worker/
Service Worker/server changes, merge, cleanup, deployment, release, or any data mutation. Ready is
limited to the standing safe handoff only after all frozen gates pass.

## Frozen cumulative candidate maximum

The C3a candidate hard maximum is exactly these eight literal paths:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
js/connectors/strava/strava-import-mapper.js
tests/connectors/strava-import-mapper.test.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/contracts/imported-activity-bundle.test.js
tests/import/import-boundaries.test.js
tests/privacy/privacy-guard.test.js
```

No ninth path is authorized. The Task Brief is the only path allowed before a separate explicit A3.
If A2 finds that a listed path is unnecessary it remains unused; it may not be replaced implicitly.
If a necessary path is absent, stop and return a minimum collision decision.

## A2 read-only audit

A2 must verify from exact current code/tests/docs:

1. `ImportedActivityBundle`, Canonical activity/streams, ActivitySource, DeviceReference, warning,
   version, JSON-safety, opaque-ID, null/missing/zero, unit, timestamp, and capability contracts.
2. Current Strava connector envelopes and operations only as shape inputs; no call may be issued.
3. C2 SourceConnection identity/status/CAS boundaries and the exact synthetic session/subject/scope
   check that occurs before mapper input is accepted.
4. Deterministic bounded collection semantics: maximum 100 activity inputs, concurrency-two promise
   scheduling contract for the later orchestrator, exact ordering, supported streams, detail/lap
   reduction, unknown-field policy, and input/output non-mutation.
5. Fixed safe warning/error/cancellation behavior, including malformed/hostile values, partial
   optional capability degradation, and fatal identity/authorization failures.
6. Existing test locations, module/export boundaries, privacy guard behavior, fixture rules, and
   literal eight-path collision surface.
7. Failure-first tests, actual-served disposable synthetic browser evidence, migration/data/privacy/
   rollback impact, and the boundary between synthetic completion and later private evidence.

Findings precede the frozen implementation contract. A2 may update only this Task Brief.

## Global invariants

- The mapper is a pure injected module: no fetch/XHR/WebSocket, Token/Web Storage, IndexedDB,
  Worker, DOM, timer, console, process environment, provider route, or import-time side effect.
- Synthetic subject/provider/activity/device values are deterministic inventions, never derived from
  a real account/export. No precise location, realistic health/power trace, credential, header, raw
  provider error, or private payload enters Git, CI, diagnostics, DOM, or logs.
- Authorization is fail closed and precedes provider-record inspection. Token presence,
  ActivitySource provenance, and Canonical records never establish identity.
- Mapper output is exactly one accepted, deeply detached/frozen `ImportedActivityBundle` per accepted
  input activity. It performs no persistence, hashing, artifact creation, dedup, Import job/report,
  SourceConnection transition, or analysis.
- Legacy, Demo, Shadow, Canonical storage, local file/ZIP imports, Backup, Diagnostics, Repository,
  Service Worker, and C4 remain untouched.

## A1 publication contract

The first commit changes exactly:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
```

Draft PR title:

```text
feat(v2): define synthetic provider bundle mapper
```

Draft PR body:

```markdown
## What changed

Adds the C3a Task Brief for the synthetic-only provider-to-ImportedActivityBundle mapper contract.

## Why

The owner selected the staged C3 contract, but mapper authorization, identity, normalization, privacy, and evidence semantics require a separate bounded A3 before implementation.

## Impact

Docs only. No mapper implementation, ImportService integration, live provider/auth/UI, Token/account/private data, schema/public API, dependency, Worker, Service Worker, server, deployment, or release change.

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

## Verification

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

After A2, push normally, verify true remote depth-1 exact head and exact-head CI, and keep the PR
OPEN/Draft. Return the bounded C3a A3 implementation authorization package to control tower.

## A2 findings first

### C3a-F1 — C2 supplies identity state, not provider authorization

- V5 has exactly one private connection slot: `source-connection:strava`. Its provider is `strava`,
  its subject is a positive decimal string, and its legal states are `connected`,
  `reconnect_required`, `error`, and `disconnected`. A connected record has `errorCode: null`; the
  store enforces revision CAS and retains a disconnected tombstone.
- No Source Manager composition reads that store or produces an authenticated subject today. The C1
  controller remains fail closed as `authorization_unavailable`. Token presence, an
  `ActivitySource`, an imported activity, or a Legacy athlete row is not identity authority.
- Therefore C3a can accept only two injected, strict synthetic snapshots: one authenticated session
  and one complete connected SourceConnection. Exact provider/subject equality and exact scopes must
  pass before the mapper inspects any provider activity record. C3a neither creates nor transitions
  a connection and never advances `lastSyncAt`.

### C3a-F2 — the current connector is deliberately outside this tranche

- `StravaApiConnector` reads and writes the entire `strava_tokens` localStorage record by default,
  encodes it into a same-origin Bearer header, and exposes list/detail/streams plus athlete/zones/gear
  calls. It has no SourceConnection or scope input, no AbortSignal, no page/window bound, and no
  bundle output.
- The current stream allowlist is `time`, `distance`, `latlng`, `altitude`, `velocity_smooth`,
  `heartrate`, `cadence`, `watts`, `temp`, `moving`, and `grade_smooth`. The route returns provider
  objects without a reduced-envelope contract.
- Importing, modifying, or calling that connector would bring Token/network/C3c behavior into C3a
  and collide with its frozen Legacy parity and hash tests. The new mapper must be a separate direct
  module with no import from the existing connector and no public connector index expansion.

### C3a-F3 — the accepted bundle is strict enough to be the output oracle

- `ImportedActivityBundle` has exactly nine required top-level fields: schema, activity, streams,
  laps, events, sources, devices, warnings, and version metadata. At least one source is required;
  activity/stream/lap/source references, schema versions, timestamps, ordering, uniqueness, JSON
  safety, and capabilities are checked together.
- Canonical activity IDs are opaque nonempty strings. Optional numeric summaries distinguish absent,
  null, and zero; heart rate is the exception because a present value must be greater than zero and
  at most 300. Moving time cannot exceed elapsed time.
- Stream series require nonempty aligned arrays and non-decreasing finite offsets. Null points are
  allowed. Distance, power, and cadence are nonnegative; heart rate is in `(0, 300]`; position is a
  nullable WGS84 pair; moving is nullable boolean. Present position/heart-rate/power/cadence series
  and laps require their corresponding capability to be true.
- `ActivitySource` already supports provider `strava`, an opaque external ID, acquisition method
  `strava-api`, nullable `rawArtifactId`, nullable device reference, and a strict millisecond UTC
  `importedAt`. C3a can therefore emit a valid ephemeral source without schema or Storage changes;
  C3b alone may replace the null artifact reference with a durable provider artifact.

### C3a-F4 — mapping and acquisition scheduling must remain separate

- The selected contract caps a later user-triggered foreground run at 100 summaries and two
  concurrent per-activity detail/stream operations. Those are acquisition/orchestrator limits, not
  permission for C3a to create promises, call a reader, or schedule network work.
- C3a can export the frozen limits and synchronously map a dense array of zero through 100 already
  reduced inputs in input order. A malformed item fails the pure call with no partial return or
  side effect. A later item-isolating orchestrator may invoke the same mapper with one item at a time.
- The existing 200,000-point activity performance boundary and decoder limits provide an evidence-
  based per-stream ceiling; existing decoders also cap laps at 10,000. Accepting larger unbounded
  arrays in a provider mapper would be a new memory-risk exception with no product justification.

### C3a-F5 — missing, null, zero, and opaque values need explicit provider rules

- Provider activity and subject IDs may enter the reduced input only as positive safe integers or
  positive decimal strings. They are normalized to strings without numeric parsing of strings.
  Leading-zero, signed, decimal, exponential, whitespace-padded, zero, unsafe-number, and non-string
  object IDs fail closed; a valid string is retained exactly.
- Optional summary fields preserve their three states: absent stays absent, null stays null, and a
  valid zero stays zero. Canonical restrictions still apply, so zero heart rate and zero identity are
  invalid. Provider `start_date` is normalized to fixed-millisecond UTC; a missing/invalid date is
  fatal. Missing/null UTC offset maps to null; valid zero remains zero.
- Missing or null detail/streams/laps are truthful optional-capability degradation with a fixed
  warning. An empty streams object or lap array means the provider explicitly supplied no points or
  laps and does not become synthetic data; a non-null detail still requires a valid repeated ID.
  Unknown/private fields are not copied and generate at most one fixed warning per input section; no
  unknown field name or value is echoed.

### C3a-F6 — C3a cancellation is a snapshot, not a live abort claim

- A synchronous pure mapper cannot honestly abort a request or observe an AbortSignal changing
  during a call. Its exact cancellation seam is a required plain boolean snapshot checked before the
  activity array is inspected. `cancelled: true` returns a fixed cancellation error and no bundle.
- C3c must check the real AbortSignal before list/detail/stream scheduling and pass a fresh snapshot
  to each one-item mapping call. Cancellation during fetch, a request already received by the
  provider, Import cancellation after C3b submission, and durable resume remain outside C3a.

### C3a-F7 — the literal eight-path maximum has no known ninth-path collision

- Four listed paths already exist (this brief, the fixture README, the bundle contract test, and the
  Import boundary test); four are new candidates (mapper, focused mapper test, synthetic API fixture,
  and focused privacy test). A new path in the list is intentional and is not a collision.
- The Repository dependency test recursively discovers every module under `js/connectors/strava`.
  A one-way mapper import of only `js/data/contracts/index.js` does not enter its connector/repository
  file set, creates no cycle, and needs no edit. The frozen hash covers only the existing connector.
- Direct-module exports avoid changes to connector, Import, Storage, Repository, Backup, Worker, or
  Service Worker public surfaces. The existing Import export assertion remains exact. The authorized
  Import boundary path may add a no-Import/no-Worker/no-provider-I/O source assertion; it must not
  alter Import behavior.
- The existing privacy command scans every tracked file, so it automatically covers the mapper and
  fixture. The additional authorized privacy test is limited to the C3a no-credential/no-profile/
  no-private-field/no-external-route contract. If any implementation needs a ninth path, A3 stops
  before that edit and returns a minimum collision package.

### C3a-F8 — synthetic evidence is complete only for the pure seam

- Deterministic tests and an actual-served disposable browser can prove authorization ordering,
  hostile-value rejection without getter execution, mapping, limits, warnings/errors, cancellation
  snapshot, non-mutation, deep freeze, accepted bundle validation, and zero runtime side effects.
- They cannot prove provider scope sufficiency, response drift, OAuth/account subject binding,
  refresh/revoke, HTTP/rate-limit behavior, or live request cancellation. Those require the separate
  C3c auth/read A3 and separately authorized private evidence. No real account or copied provider
  payload is needed or permitted for C3a.

### C3a-F9 — C3a has no migration or durable rollback surface

- C3a opens no database and writes no RawArtifact, Import job/item, Canonical activity,
  SourceConnection, Backup, setting, log, or cache. Existing Legacy and V5 data cannot be changed by
  this module.
- Rollback removes or stops importing the direct mapper module and its synthetic evidence. There is
  no record conversion, delete, clear, downgrade, compensating write, or backup-format impact. C3a
  does not close the Connector P0 gap or support an Alpha/full-v2.0/release-readiness claim.

## Frozen C3a A3 implementation contract

### Direct module surface and authority order

`js/connectors/strava/strava-import-mapper.js` is imported directly and exports exactly:

```text
STRAVA_IMPORT_LIMITS
STRAVA_IMPORT_MAPPER_ERROR_CODE
STRAVA_IMPORT_MAPPER_WARNING_CODE
StravaImportMapperError
createStravaImportMapper
```

It imports only `validateImportedActivityBundle` through `js/data/contracts/index.js`. It does not
import a connector, auth/controller, Import, Storage, Repository, Backup, Worker, page, or server
module and does not change any aggregate index.

`createStravaImportMapper({ session, connection })` accepts an exact ordinary-data object:

```js
session = {
  provider: 'strava',
  subjectId: '<positive decimal string>',
  grantedScopes: ['read', 'activity:read_all']
}

connection = {
  id: 'source-connection:strava',
  provider: 'strava',
  subjectId: '<same positive decimal string>',
  status: 'connected',
  lastSyncAt: null | '<strict millisecond UTC instant>',
  errorCode: null,
  revision: '<positive safe integer>'
}
```

The scope array is dense, duplicate-free, and in that exact canonical order; no extra scope is
accepted. The factory validates container/descriptors, session, complete connection shape/status,
provider, scopes, and exact subject equality in that order. It never reads provider records. It
returns a deeply frozen mapper exposing exactly `mapActivities`.

For fail-closed classification, a structurally valid non-connected record uses the C2 combinations
`reconnect_required/AUTHORIZATION_REQUIRED`, `error/CONNECTION_ERROR`, or
`disconnected/(null|REVOCATION_UNCONFIRMED)` and yields mapper `AUTHORIZATION_REQUIRED`. Any other
status/error combination is structurally invalid rather than repaired or reinterpreted.

`mapActivities({ cancelled, acquiredAt, activities })` accepts an exact ordinary-data control
object. `cancelled` is a strict boolean and is checked before inspecting `activities`; `acquiredAt`
is a strict millisecond UTC instant; `activities` is a dense array of zero through 100 entries. Each
entry contains own ordinary-data `summary`, `detail`, and `streams` fields. Summary is required;
detail and streams may be null. Duplicate external activity identities in one call fail closed.
The result is a deeply frozen dense array of accepted bundles in input order. Inputs are never
mutated, retained by reference, or returned. The output is JSON-safe and remains valid after
JSON stringify/parse.

The immutable limits are exactly:

```js
{
  maxActivitiesPerRun: 100,
  maxConcurrentActivityOperations: 2,
  maxStreamPointsPerSeries: 200_000,
  maxLapsPerActivity: 10_000
}
```

Only the first, third, and fourth limits are enforced by the pure mapper. Concurrency two is an
exported C3c scheduling constant and must not be presented as implemented scheduling in C3a.

### Reduced provider fields and deterministic precedence

The mapper reads known fields only through own enumerable data descriptors. Every accepted object
has `Object.prototype` or null prototype; every array is a dense ordinary array; accessors, symbols,
functions, BigInt, cycles, sparse entries, exotic prototypes, hostile/revoked proxies, non-finite
numbers, and over-limit arrays fail closed without executing user getters.

Known summary/detail fields are:

```text
id, sport_type, type, start_date, utc_offset, timezone,
name, distance, moving_time, elapsed_time, total_elevation_gain,
average_heartrate, average_watts, average_cadence,
athlete, map, gear_id, device_name, laps
```

Summary supplies the activity identity and is authoritative for fields it owns, including explicit
null and zero. Detail must repeat the same valid identity when non-null and supplies a summary field
only when that field is absent from summary. A conflicting repeated value is dropped with one fixed
warning. Detail alone supplies laps. `name`, `athlete`, `map`, `gear_id`, and `device_name` are always
dropped: C3a emits no activity name, athlete/profile, route URL/polyline, gear/device identifier,
serial, manufacturer, or model. Other own data fields are unknown and dropped. Unknown/private keys
or values are never placed in warning/error output.

Provider `sport_type` takes precedence over `type`; conflicting known values warn. The exact map is:

```text
Run -> run; TrailRun -> run/trail-run; VirtualRun -> run/virtual-run
Ride -> ride; MountainBikeRide -> ride/mountain-bike; GravelRide -> ride/gravel
VirtualRide -> ride/virtual; EBikeRide -> ride/e-bike
EMountainBikeRide -> ride/e-mountain-bike
Swim -> swim; Walk -> walk; Hike -> hike; Workout -> workout
WeightTraining -> workout/strength; Crossfit -> workout/cross-training
Elliptical -> workout/elliptical; StairStepper -> workout/stair-stepper
Yoga -> workout/yoga
AlpineSki -> winter/alpine-ski; NordicSki -> winter/nordic-ski
Snowboard -> winter/snowboard; Snowshoe -> winter/snowshoe
Soccer -> team/football
Tennis -> racket/tennis; Badminton -> racket/badminton
Pickleball -> racket/pickleball; Padel -> racket/padel
Racquetball -> racket/racquetball; Squash -> racket/squash
```

An unknown nonempty sport becomes `other/null` with a warning; missing/null/non-string sport is
invalid. `start_date` accepts a valid UTC provider timestamp with seconds and optional milliseconds
and normalizes it to exact milliseconds. `utc_offset`, when present, is null or integer seconds
divisible by 60 whose minute value is within `[-840, 840]`; provider time-zone display text is never
retained. Summary numeric fields map to their same-named Canonical units and preserve absent/null/
valid zero, subject to Canonical range and moving/elapsed rules.

The exact summary mapping is `distance -> distanceMeters`, `moving_time -> movingTimeSeconds`,
`elapsed_time -> elapsedTimeSeconds`, `total_elevation_gain -> elevationGainMeters`,
`average_heartrate -> averageHeartRateBpm`, `average_watts -> averagePowerWatts`, and
`average_cadence -> averageCadence`.

### Streams, laps, sources, and bundle identity

The exact provider-to-Canonical stream map and output order is:

| Provider field | Canonical type | Unit |
| --- | --- | --- |
| `distance` | `distance` | `m` |
| `latlng` | `position` | `wgs84` |
| `altitude` | `altitude` | `m` |
| `velocity_smooth` | `speed` | `m/s` |
| `heartrate` | `heartRate` | `bpm` |
| `cadence` | `cadence` | `rpm` |
| `watts` | `power` | `W` |
| `temp` | `temperature` | `C` |
| `moving` | `moving` | `boolean` |
| `grade_smooth` | `grade_smooth` | `percent` |

`time` is never emitted as a series; its nonnegative, finite, non-decreasing `data` array supplies
`offsetsSeconds` for every emitted series. A stream entry is null or an exact reduced object whose
`data` is dense and no longer than 200,000. Missing entries are absent; null entries warn and
degrade; empty data means known-empty and is omitted without fabricating a point. A nonempty
supported stream requires a nonempty time array of exactly the same length. Length mismatch,
malformed values, invalid units/ranges, or oversized data is fatal. Unknown stream types and provider
metadata are dropped with a bounded warning. Null points and genuine zero/false/`[0, 0]` survive;
zero heart rate does not.

Laps are absent when detail is null or `laps` is missing/null, with a fixed warning, and are known
empty when `laps: []`. A present dense lap array is capped at 10,000. Each lap requires a unique
nonnegative safe-integer `lap_index` and finite nonnegative `elapsed_time`; optional `moving_time` and
`distance` preserve absent/null/zero. Laps sort by provider index, map to zero-based Canonical index,
and receive cumulative non-overlapping start offsets. Canonical moving/elapsed/activity-duration
relations remain fatal. C3a emits no events or devices.

For provider external ID `E`, deterministic identities and provenance are:

```text
activity.id                 = strava-api:E
source.id                   = strava-api-source:E
source.provider             = strava
source.externalId           = E
source.rawArtifactId        = null
source.acquisitionMethod    = strava-api
source.deviceId             = null
source.importedAt           = acquiredAt
lap.id                      = strava-api:E:lap:<provider lap_index>
version schema              = 1
version parser              = null
version normalizer          = strava-import-mapper@1
version analysis/settings/hash = null
```

Capabilities are derived only from accepted output: GPS/heart-rate/power/cadence are true when the
corresponding retained series has at least one non-null point or its accepted summary average exists
(GPS has no summary substitute); laps are true only when a lap is retained. The completed bundle is
validated with `validateImportedActivityBundle`; any validation error becomes a fixed mapper error.

### Exact warning, error, and cancellation surface

Bundle warning codes are exactly:

```text
UNKNOWN_FIELDS_DROPPED
PRIVATE_FIELDS_DROPPED
DETAIL_CONFLICT_DROPPED
SPORT_FALLBACK
TIME_ZONE_NAME_DROPPED
DETAIL_UNAVAILABLE
LAPS_UNAVAILABLE
STREAMS_UNAVAILABLE
STREAM_UNAVAILABLE
TIME_STREAM_UNAVAILABLE
```

Warnings use fixed messages and fixed redacted section paths, are deduplicated, and sort by path,
code, then message. At most one warning of each code/path pair is emitted per bundle. No raw field
name, ID, subject, scope, value, provider error, or route appears.

Mapper error codes are exactly:

```text
INVALID_REQUEST
AUTHORIZATION_REQUIRED
IDENTITY_MISMATCH
SCOPE_INSUFFICIENT
LIMIT_EXCEEDED
CANCELLED
PROVIDER_RECORD_INVALID
BUNDLE_INVALID
```

`StravaImportMapperError` is deeply frozen and serializes only `name`, `code`, fixed `message`,
fixed `stage`, nonnegative `activityIndex` or null, and `retryable: false`. It has no cause, payload,
ID, subject, scope, field name, URL, stack serialization, or provider text. Structurally invalid
authority/control input is `INVALID_REQUEST`; a valid non-connected connection is
`AUTHORIZATION_REQUIRED`; exact subject mismatch is `IDENTITY_MISMATCH`; missing/extra/noncanonical
scope is `SCOPE_INSUFFICIENT`; count/point/lap overflow is `LIMIT_EXCEEDED`; a true cancellation
snapshot is `CANCELLED`; malformed known provider content is `PROVIDER_RECORD_INVALID`; rejected
constructed output is `BUNDLE_INVALID`.

Failure never returns partial bundles and never changes input, output from an earlier call, global
state, connection state, or durable data. Retry means the later caller may correct/reacquire the
synthetic input and call again; the mapper itself performs no retry, sleep, timer, request, or resume.

## Failure-first implementation and evidence plan

### Focused tests before production code

1. First add mapper tests that fail because the direct module is absent. Cover exact exports and
   import-time no fetch/XHR/WebSocket/Token/Web Storage/IndexedDB/Worker/DOM/timer/console/process
   access.
2. Cover authorization ordering with getters/proxies that would fail if provider records are touched:
   absent/malformed authority, every non-connected C2 state, scope missing/extra/order/duplicate,
   exact/mismatched subject, invalid revisions/timestamps/error combinations, and cancellation before
   provider inspection.
3. Cover zero/one/100/101 activities, input order, duplicate IDs, safe-number and string identities,
   leading zeros/zero/unsafe numbers, all sport mappings/unknown sport, fixed timestamps/UTC offsets,
   missing/null/zero summaries, heart-rate exception, precedence/conflict, and private/unknown drops.
4. Cover every supported stream, exact units/order/timeline, independent missing/null/empty states,
   null/zero/false/WGS84 points, malformed/mismatched/nonmonotonic/duplicate/200,000/200,001 points,
   and warning determinism. Cover zero/10,000/10,001 laps, sorting, duplicate index, bounds, and
   duration relations.
5. Validate every result directly and after JSON round trip, deep-detachment/freeze/non-mutation,
   repeat determinism, fixed redacted errors/warnings, hostile getters/proxies/prototypes/symbols/
   cycles/sparse arrays, and no raw canary leakage.
6. Add only boundary assertions needed to prove no Import/Worker/provider-I/O or aggregate export
   expansion, plus the focused tracked-fixture privacy assertions. Existing full contract,
   dependency, Legacy, Demo, Shadow, Import, Storage, and privacy suites remain authoritative.

### Synthetic fixture and privacy rules

`api-import-fixture.js` exports only small, deterministic, deeply frozen hand-authored data: exact
session/connection snapshots, one rich activity, one degraded activity, and bounded generators for
100/101 activities, 200,000/200,001 points, and 10,000/10,001 laps. IDs are reserved synthetic
positive strings; dates, coordinates, heart rate, power, cadence, laps, and warnings are invented.
The fixture README must explicitly prohibit replacement with an account response/export and record
that it contains no Token, header, profile, route URL/polyline, gear/device identifier, or provider
error body. Generated large arrays are not committed as bulk data.

The privacy test and global guard must reject credential/token/Authorization strings used as data,
profile/athlete retention, private-fixture reads, external/provider URLs, precise payload/error
logging, numeric parsing of opaque IDs, and any mapper/fixture path to local/session storage. Test
canaries remain obviously synthetic and never resemble a real account or export.

### Actual-served disposable browser evidence

Serve the exact implementation head on loopback and launch a fresh disposable Chromium profile, not
the user's Chrome/profile. From a same-origin served page, dynamically import the direct mapper and
synthetic fixture, run rich/degraded/limit/cancel/hostile cases, and validate bundles with the served
contract module. Instrument before import and record:

- only expected same-origin static module requests and zero external/provider requests;
- zero fetch/XHR/WebSocket, Worker, Token/Web Storage, IndexedDB, timer, console error, or navigation;
- unchanged DOM snapshot and unchanged storage/database inventory;
- deterministic repeated output, accepted JSON round trip, deep freeze, input non-mutation, and fixed
  cancellation/error redaction; and
- no subject/activity/private canary in DOM, URL, console, error serialization, or diagnostics.

No repository browser-harness path is added: the evidence runner may use disposable automation or a
temporary untracked harness outside the worktree. A browser pass proves only the pure module; it is
not evidence of OAuth, live scope, provider read, ImportService, or C3c cancellation.

### Required gates, review, and rollback

Implementation, if separately approved, must run focused failure-first tests, then:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

It must also audit `git diff --name-only` against the literal eight-path maximum, run actual-served
synthetic browser evidence, obtain an independent findings-first review, fix every material finding,
and obtain a fresh no-findings re-review before a Task-Brief-only Final Review Closure. Push normally,
verify true remote depth-1 exact head and exact-head CI, and keep PR #50 OPEN/Draft unless a later
standing Ready gate is expressly confirmed. Merge remains separate.

Rollback is code-only: stop importing/revert the mapper and retain every Legacy/V5 record unchanged.
No database migration, RawArtifact/Backup format, public API, dependency, Worker/SW, server, setting,
or deployment rollback exists in C3a.

## Collision-audited literal A3 package

The requested implementation authorization is exactly:

```text
Approve C3a A3 implementation of the frozen injected-synthetic provider bundle mapper contract and
the literal cumulative eight-path hard maximum in this Task Brief.
```

Approval authorizes failure-first implementation and evidence only within the eight listed paths.
It does not authorize a ninth path, C3b ImportService/artifact work, C3c live auth/read/UI, current
Token connector reuse, OAuth/account/provider/private activity, SourceConnection reads/writes,
schema/public/dependency/Worker/SW/server changes, Ready, merge, cleanup, deployment, release, or any
Alpha/full-v2.0/readiness claim. Architecture/collision risk is **low-medium**: the module is isolated
and non-durable, while exact provider-shape reduction and duplicated validation of an injected C2
snapshot require the failure-first hostile/boundary suite. Product-completion risk remains **high if
misrepresented as a live connector**.

## Final Review Closure

The authorized C3a implementation is complete at immutable code head
`f72d2a4fe91fd9af00c5f8ddfa391491b278d744`. The cumulative base-to-code diff changes exactly seven
of the eight frozen paths. `tests/contracts/imported-activity-bundle.test.js` remained unnecessary
and untouched; no path was substituted and no ninth path was used.

- Failure-first evidence preceded production: the initial focused mapper test failed 0/1 with
  `ERR_MODULE_NOT_FOUND` because the direct mapper did not exist. The focused implementation suite
  then covered the exact direct exports, injected session/SourceConnection authority, identity,
  scopes, summary/detail precedence, every supported stream and sport mapping, laps, limits,
  opaque IDs, missing/null/zero distinctions, warnings/errors, cancellation, hostile inputs,
  privacy, detachment, deep freeze, determinism, and accepted JSON round trips.
- Implementation commit `c4a71d47a3ffabeff6da49f1e374d92c59986ee6` added only the pure mapper,
  deterministic fixture, focused tests, and frozen boundary/privacy assertions. It adds no aggregate
  export, connector call, Token, Storage, Import, Worker, Service Worker, server, schema, dependency,
  or durable data surface.
- The independent findings-first review of `c4a71d4` found two P1 contract violations: recursively
  oversized arrays could be cloned before an unknown field was dropped, and an explicitly empty
  time array could silently discard a nonempty supported stream. Failure-first reproductions failed
  16/18 before repair. Repair commit `f72d2a4` propagates a fixed `LIMIT_EXCEEDED` boundary before
  cloning any array over 200,000 and makes the explicit zero-versus-nonzero timeline mismatch fatal.
- A genuinely fresh independent re-review of exact `f72d2a4` returned **NO FINDINGS**. It rechecked
  the two repairs, every frozen authority/mapping/privacy boundary, exact seven-of-eight path scope,
  focused 95/95, full 1764/1764, syntax 269 files, privacy, and diff gates without modifying the
  repository or PR.
- Actual-served final browser evidence used installed Chromium headlessly with a newly created
  temporary profile, loopback-only static modules, and no user browser/profile or login. Exact
  `f72d2a4` accepted rich/degraded bundles and the 100-activity, 200,000-point, and 10,000-lap
  boundaries; 101 activities, 200,001 points, 10,001 laps, and recursively oversized unknown data
  returned `LIMIT_EXCEEDED`; empty timing with nonempty data returned
  `PROVIDER_RECORD_INVALID`. Repeated output was deterministic, deeply frozen, input-preserving,
  and valid directly and after JSON round trip. Cancellation inspected zero activity entries and a
  hostile getter executed zero times. Instrumentation recorded zero fetch/XHR/WebSocket, Worker,
  timer, console, Web Storage read/write, IndexedDB open, navigation, or mapper DOM mutation; URL and
  pre-report DOM were unchanged; only same-origin static module resources loaded and external
  resources were empty. The temporary profile path did not exist before launch; local/session
  storage were empty before and after, and the post-run IndexedDB inventory was empty.
- Final code-head gates passed: `npm ci` (6 packages, 0 vulnerabilities), syntax 269 files, privacy,
  focused 203/203 before review and 27/27 after the repairs, full 1764/1764, `git diff --check`, and
  the literal path audit. The worktree was clean at the immutable review heads.

Migration/data impact remains none: C3a neither opens nor changes Legacy/V5 data, connections,
artifacts, Import jobs, Canonical records, settings, backup formats, or schema. Privacy evidence is
synthetic-only; it proves the pure seam, not live provider scope, account binding, response drift,
OAuth/refresh/revoke, rate limits, request cancellation, C3b persistence, or C3c UI/network behavior.
Rollback remains code-only: stop importing or revert the isolated mapper while preserving every
existing Legacy/V5 record. PR #50 may advance only through the authorized safe Ready handoff after
exact closure-head push/CI; Squash Merge remains separately unauthorized.

## A2 evidence readback

- A0 independently verified local remote-tracking `integration/v2` and the untouched locked
  integration worktree at `92a735fb4d4809173c5fddf868416bf44642faed`, tree
  `568cf2457f418130ec0a6641478eb45a60e676c1`, synchronized and clean before branch creation.
- A1 created `codex/v2/provider-bundle-mapper` in the isolated PR-43a worktree. First commit
  `beeb8649c6a467409ae0836239a9c8759633208d` changes exactly this Task Brief. Draft PR #50 targets
  the exact base with the frozen title/body and one changed file.
- A2 read current C2 SourceConnection validation/state/CAS, connector and stream route, Canonical and
  ImportedActivityBundle validators/tests, Canonical projection stream mappings, Import and
  Repository dependency/export boundaries, synthetic-fixture rules, privacy guard/tests, PRD P0,
  engineering performance/release gates, and the parent PR-43 decision package.
- A2 made no provider request, Token/account/private read, browser/profile use, data/schema/public API,
  dependency, Worker/SW/server, production, or test change. Browser evidence is intentionally not run
  for this docs-only revision; the exact implementation evidence is frozen above.
- A2 docs-only gates after the frozen package: `npm ci` PASS (6 packages, 0 vulnerabilities), syntax
  PASS (265 files), privacy PASS, full test PASS (1742/1742), and `git diff --check` PASS.
