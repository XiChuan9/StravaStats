# PR-17: Canonical Detail Consumer Cutover

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M14 / PR-17 |
| Status | A3 frozen; Task Brief publication pending |
| Branch | `codex/v2/cutover-detail` |
| Base | `integration/v2` at `1e0f36095f0c91f5c7625ce316c56818b1bf3403` |
| Draft PR title | `refactor(v2): cut over detail consumers to canonical data` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

When a Real document explicitly selects `dataRepositoryMode: "canonical"`, route the
actual Activity Router and Generic Activity, Run, Bike, and Swim detail documents through
the existing Canonical Store, seven-method Repository, and source-neutral read projections.
Keep Demo isolated and keep Legacy and Shadow reads unchanged. Reuse the document-local
`DetailReadSession` so Advanced Analysis receives the same already-loaded projected activity
and streams without another Repository, provider, Token, or storage read.

This PR is a read cutover. It does not change Canonical contracts, storage schema, imports,
analysis algorithms, global defaults, Service Worker, deployment, release behavior, or the
PR-18 Run Plus/NSM path.

## A0 exact baseline evidence

The assigned Codex worktree began detached at exact SHA
`1e0f36095f0c91f5c7625ce316c56818b1bf3403`. The locked long-lived
`integration/v2` worktree was at the same SHA. The assigned worktree had no tracked,
untracked, staged, or unstaged changes. The feature branch
`codex/v2/cutover-detail` was then created at that exact commit; `main`,
`maintenance/v1`, and `integration/v2` were not modified.

Untouched-baseline gates:

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 6 packages installed from the frozen lockfile |
| `npm run check:syntax` | PASS; 203 files |
| `npm run check:privacy` | PASS |
| `npm test` | PASS; 1,307 tests, 0 failures/skips/cancellations/todos |
| `git diff --check` | PASS |

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed before product
implementation and opens a Draft PR with base `integration/v2`. If the GitHub App cannot
write, the commit/PR operation is delegated to the control tower; the user's Chrome login
state is never used. Draft remains Draft through implementation, independent review, and
Closure. Ready for review is a later control-tower operation and is not merge authorization.

## A2 read-only investigation

### Current mode and composition graph

`DEFAULT_FEATURE_FLAGS.dataRepositoryMode` remains the literal `legacy`. The accepted
explicit modes are `legacy`, `shadow`, and `canonical`. PR-16 routes only the root summary
session: Real + explicit Canonical selects `CanonicalRepository`, while Demo stays
Demo-first and Legacy/Shadow stay on Legacy reads. The Router and all four detail
composition roots still hard-code `mode: "legacy"`, so explicit Canonical currently falls
back to Legacy for every detail document.

Current served composition is:

```text
html/activity-router.html?id=<opaque string>
-> js/pages/activity-router.js
-> isDemoMode once
-> createRepository({ sessionMode, mode: "legacy" })
-> listActivities({ refresh: false }) once
-> Generic / Run / Bike / Swim full-document navigation
-> destination isDemoMode once
-> createRepository({ sessionMode, mode: "legacy" })
-> one memoized DetailReadSession
-> getActivity + getStreams + optional getZones/getAthlete concurrently
-> injected renderer
-> Generic Advanced Analysis reuses the injected activity and streams on every click
```

The tracked PR-04B browser harness is an isolated served ESM harness with injected
Repositories, Chart/Leaflet/download stubs, fail-closed network/storage counters, and
synthetic fixtures. It proves the page composition and renderer boundaries but does not seed
the real Canonical Store or exercise the actual served Router/destination documents in
explicit Canonical mode. PR-16's actual-root harness demonstrates the safe disposable-origin
pattern for seeding `strava-stats-v2`, selecting an explicit feature flag, and observing
network, console/runtime, IndexedDB, Cache Storage, and Service Worker state. PR-17 needs one
new actual-route harness; neither prior harness is changed or relabelled as PR-17 evidence.

### Existing Repository and Store capability

The public Repository has exactly seven methods:

```text
listActivities
getActivity
getStreams
getAthlete
getZones
getGears
getGear
```

`CanonicalRepository.listActivities` is complete and paginated. `getAthlete`, `getZones`,
`getGears`, and `getGear` return truthful neutral Canonical envelopes. `getActivity` and
`getStreams` are callable but currently reject `UNSUPPORTED_MODE`.

The existing public Canonical Store already provides:

```text
initialize
putBundle
getBundle(activityId, { streamTypes })
listActivities
createBackupManifest
close
```

`getBundle` validates the opaque ID and requested Canonical stream types, performs one
read-only transaction over the accepted activity graph, reconstructs and validates the exact
nine-field `ImportedActivityBundle`, and returns a detached deeply frozen value. It includes
the activity envelope, selected streams, laps, events, sources, devices, warnings, and version
metadata. Therefore no eighth Repository method, new Store method, private IndexedDB seam,
schema/index/version/migration change, or direct page storage read is required.

For a Canonical destination session, `getActivity` and `getStreams` are invoked concurrently
by the existing `DetailReadSession`. The Canonical Repository can coalesce those same-turn
calls into one `getBundle` operation, union the requested physical stream types, and project
the two existing Repository envelopes. A standalone `getActivity` remains valid by reading
the bundle without a narrowed stream request. Optional Canonical athlete/zones remain literal
`null` and never cause Legacy/provider fallback.

### Current and target request/I/O counts

Counts exclude static HTML/JS/CSS/CDN/map-tile assets and the previously accepted optional
Real Open-Meteo weather behavior. They count application data-boundary operations per
successful document.

| Path | Current | Target explicit Real Canonical |
| --- | --- | --- |
| Router | 1 Legacy/Demo `listActivities`; Canonical not selectable | 1 Canonical `listActivities`; 0 detail/provider/Token/Legacy reads |
| Destination session | 1 `getActivity`, 1 `getStreams`, optional zones/athlete; hard-coded Legacy | same seven-method calls; 1 coalesced Canonical Store `getBundle` transaction; neutral metadata is local/no fallback |
| Generic Advanced click | 0 Repository/provider/storage reads; injected reuse | unchanged; 0 reads on every click |
| Demo | 1 Demo list plus destination Demo reads; 0 Real I/O | unchanged and flag-independent |
| Legacy / Shadow rollback | existing Legacy reads | byte-for-byte mode ownership preserved |

The actual Store transaction reads one activity envelope, activity sources, laps, events,
the selected physical stream records, and referenced devices. It performs no write, provider,
Token, Authorization, Legacy IndexedDB, or provider-owned localStorage operation.

### Detail projection contract

The projection is a pure Canonical-to-current-detail compatibility boundary. It accepts only
the Store-validated bundle and returns detached deeply frozen plain data. It performs no I/O,
logging, clock/locale lookup, provider selection, analysis, persistence, or mutation.

Activity summary fields reuse the accepted PR-16 mapping, preserving the opaque ID and the
distinction between absent, `null`, real `0`, and negative zero. The detail projection adds
only truthful compatibility data available in the bundle:

```text
activity.laps <- accepted Canonical laps
lap_index     <- Canonical index
distance      <- distanceMeters when present
moving_time   <- movingTimeSeconds when present
elapsed_time  <- elapsedTimeSeconds
average_speed <- distance / moving time only when both are finite and moving time > 0
```

Missing lap metrics remain missing/null and renderer presentation must degrade to its existing
empty marker instead of inventing zero or showing `NaN`. Events, sources, devices, version
metadata, provider identity, filenames, hashes, and Canonical warnings do not enter the page
DTO. No polyline is fabricated.

Requested Legacy stream names map only to stored Canonical series:

```text
latlng         <- position
heartrate      <- heartRate
watts          <- power
velocity_smooth <- speed
temp           <- temperature
distance, altitude, cadence, moving, grade_smooth <- same-name series
time           <- the selected reference series' stored offsetsSeconds
```

The reference timeline prefers requested `distance`, then `position`, then the first
deterministically ordered selected series. A projected series is emitted only when its offsets
exactly match that reference; otherwise it is omitted as an explicit capability degradation.
Values are never interpolated, resampled, defaulted, coerced, or treated as an analysis
algorithm. Missing requested data is a successful complete query with an absent stream key,
not a fabricated stream and not a partial Repository envelope. A missing activity returns
Repository `NOT_FOUND`; unsafe request/storage/projection failures are redacted and fail closed.

The four existing map renderers may use injected `streams.latlng.data` when the Legacy
polyline is absent. They do not encode/store a polyline or fetch a route. Missing/empty GPS
keeps the existing map-empty behavior. Existing provider polylines remain the Legacy/Demo
preference. Laps and charts similarly degrade without changing their algorithms or visual
configuration.

### Partial, error, metadata, and mode semantics

- `getActivity` and `getStreams` remain required. Missing activity maps to safe `NOT_FOUND`;
  invalid Store data/read failure maps to safe `RESPONSE_INVALID`. No raw storage/provider
  message, payload, ID, Token, Authorization, cause, GPS, health, or power value is exposed.
- Successful Canonical results use `source: "canonical"`, `warnings: []`, and
  `partial: false`. Absent optional capabilities are truthful complete data, not partial data.
- `getZones` and `getAthlete` remain optional literal `null`. The pages must not fall back to
  Legacy metadata, provider APIs, or provider-owned storage.
- Real + explicit `canonical` selects Canonical independently in the Router and destination
  document. Real `legacy` and `shadow` select Legacy. Demo always selects Demo before any Real
  dependency construction and ignores the Real Repository flag.
- `DEFAULT_FEATURE_FLAGS.dataRepositoryMode` remains literal `legacy`. PR-23 owns the global
  default change.
- Advanced Analysis receives the projected activity/streams already loaded by the Generic
  page and performs no provider, Repository, Store, Token, Authorization, or Legacy I/O.

## A3 frozen implementation boundary

Implementation, tests, findings-first repairs, and Closure may modify exactly these 17 paths
and no eighteenth path:

```text
docs/tasks/pr-17-canonical-detail-cutover.md
js/pages/activity-router.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/repository/canonical/canonical-repository.js
js/repository/canonical/detail-projection.js
tests/repository/canonical-repository.test.js
tests/repository/dependency-boundaries.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/canonical-detail-browser-smoke.html
```

This is a literal cumulative allowlist, not a directory glob. Stable public boundary
assertions and literal source/path audits are required. Whole-tree manifests and whole-file
hashes of mutable implementation files are prohibited because they are future-hostile.

### Prohibited paths and operations

The following remain unmodified unless a new evidence-backed control-tower decision expands
scope before the change:

```text
package.json
package-lock.json
.github/**
api/**
sw.js
manifest.json
index.html
html/**
styles/**
js/app/feature-flags.js
js/app/local-first-bootstrap.js
js/app/main.js
js/data/**
js/storage/**
js/import/**
js/decoders/**
js/shadow/**
js/analysis/**
js/tabs/**
js/pages/detail/detail-read-session.js
js/pages/activity/advanced-analysis.js
js/pages/activity/analysis-ui-components.js
tests/fixtures/**
docs/architecture/**
docs/product/**
docs/engineering/**
docs/migrations/**
```

Also prohibited: an eighth Repository method/export; Canonical contract or physical Store
change; provider/auth change; analysis/export algorithm change; Run Plus/NSM or PR-18 work;
production dependency; Service Worker/deployment/release behavior; real credentials, account,
provider network, user browser profile, or private sports data; delete/clear/overwrite/repair/
downgrade/reverse-copy of Legacy or V2 data; merge/auto-merge; amend/rebase/force-push; branch or
worktree cleanup.

## Frozen implementation phases

### B1: Canonical Repository and detail projection

- Add the pure detail projection.
- Implement descriptor-safe opaque-ID/stream-option validation and coalesced Store bundle reads.
- Preserve the exact seven-method Repository surface and redacted error mapping.
- Add failure-first projection, I/O-count, concurrency, missing/null/zero, opaque-ID,
  capability, timeline, Store, and Legacy/summary regression tests.

### B2: Router and four composition roots

- Select Canonical only for explicit Real Canonical mode.
- Keep Demo first and Legacy/Shadow rollback unchanged.
- Preserve one Repository and one memoized `DetailReadSession` per destination document.
- Prove exact stream sets, optional metadata semantics, safe errors, and zero direct provider,
  Token, Authorization, Legacy storage, or IndexedDB page I/O.

### B3: renderer degradation and served Browser/CDP evidence

- Add only the minimal injected-position map fallback and safe missing lap presentation needed
  for truthful Canonical bundles.
- Add one deterministic synthetic actual-route harness covering Router plus Generic/Run/Bike/
  Swim in Canonical, Demo, and Legacy rollback modes; opaque IDs; full/missing capabilities;
  streams/laps/maps/charts; repeated Advanced reuse; safe errors; and storage/runtime evidence.
- Perform a findings-first independent review, add focused failing regressions for every
  actionable finding, minimally repair, then obtain a fresh no-actionable-findings re-review.

### B4: Final Review Closure

After implementation/review gates pass, update only this Task Brief with exact base/head,
commits, changed paths, local/browser/depth-1 evidence, CI run/job URLs, findings and repairs,
privacy/migration/rollback impact, and explicit Not-run items. Closure is one Task Brief-only
commit and requires fresh exact-head CI before the control tower moves the Draft PR to Ready.

## Verification contract

Required local gates:

```text
npm ci
npm run check:syntax
npm run check:privacy
focused Canonical Repository/detail projection tests
focused detail consumer/boundary tests
focused Repository Factory/Storage/Legacy/summary/shadow regressions
npm test
git diff --check
literal allowlist and prohibited-surface audit
depth-1/shallow-clone CI-safe boundary verification
```

The browser gate must use a disposable isolated loopback origin/profile and only deterministic
synthetic values. Observation begins before navigation and records actual Router/destination
network requests, Authorization presence, Fetch/XHR/WebSocket, console/runtime/log events,
IndexedDB names/versions and safe synthetic counts, Local/Session Storage key inventory, Cache
Storage, and Service Worker registrations. It must close all connections and stop the server.
It must not use or enumerate a user profile, real Token/account, provider data/network, private
fixture, real route/GPS/heart-rate/power history, export, or screenshot.

Do not claim full visual parity, real provider behavior, production Service Worker, Safari,
Firefox, mobile, real quota pressure, crash durability, large-library performance, or CI unless
that exact check ran.

## Privacy, migration, rollback, and risks

- **Privacy:** only inline deterministic synthetic fixtures are allowed. Public/DOM/console/PR
  evidence is redacted and contains no activity ID from a user, precise location, health/power
  history, Token, Authorization, payload, raw cause, filename, account, or profile data.
- **Migration:** none. This PR performs read-only Store initialization/queries and adds no
  schema, store, index, version, migration, write, cleanup, or reverse projection into Legacy.
- **Rollback:** select literal `legacy` or ordinarily revert this PR. Retain both databases and
  all data. Shadow remains a Legacy read. Never clear/delete/downgrade/repair either database.
- **Primary risks:** mismatched independent Canonical stream timelines; missing provider-only
  detail fields; duplicate Store reads; Demo/Real mode leakage; stale whole-file boundary tests;
  unsafe lap/map assumptions; and accidental expansion into PR-18 or global default cutover.
  Focused tests, exact I/O instrumentation, literal boundaries, browser observation, and
  findings-first review cover these risks.

## Stop conditions

Pause and send the smallest decision package to the control tower before any required eighteenth
path, public Repository/Store method or export, schema/index/version/migration change, import or
Canonical contract change, analysis/provider-auth change, production dependency, Service Worker/
deployment/release change, PR-18 path, destructive data action, real credential/private-data use,
merge/cleanup, or another material product/architecture expansion.

## Implementation ledger

### B1: Canonical Repository and detail projection

Status: **Completed locally / PASS**.

- Added the pure descriptor-safe `detail-projection.js` compatibility boundary.
- Implemented Canonical `getActivity` and `getStreams` without changing the seven-method
  Repository surface or five public exports.
- Same-turn activity/stream calls coalesce into one Store initialization and one
  `getBundle` transaction with the exact union of requested physical stream types.
- Opaque strings are preserved; numeric IDs, duplicate/unknown streams, accessors, sparse
  arrays, and Proxies fail before Store construction/I/O.
- Missing activities map to safe `NOT_FOUND`; invalid Store/projection failures map to
  redacted `INVALID_REQUEST` or `RESPONSE_INVALID` without retaining private details.
- Activity/lap/stream projection preserves absent/null/zero/negative-zero, omits mismatched
  timelines, and never interpolates or fabricates Canonical data.

Actual local evidence at the B1 stop boundary:

```text
node --test tests/repository/canonical-repository.test.js
  PASS 13/13
node --test tests/repository/canonical-repository.test.js
  tests/storage/canonical-store.test.js
  tests/repository/repository-contract.test.js
  tests/repository/repository-factory.test.js
  PASS 50/50
npm run check:syntax
  PASS 204 files
npm run check:privacy
  PASS
node --test tests/repository/dependency-boundaries.test.js
  PASS 7/7
node --test tests/consumers/detail-boundaries.test.js
  PASS 21/21
git diff --check
  PASS
```

All B1 fixtures are deterministic, inline, synthetic, and offline. No migration, write-path,
schema, provider/auth, analysis, dependency, Service Worker, PR-18, or default-mode change was
made. Browser/CDP, independent review, full suite, CI, and Closure remain pending.

### B2: Router and detail composition cutover

Status: **Completed locally / PASS**.

- The Router and Generic, Run, Bike, and Swim composition roots now read the existing public
  feature flags exactly once for a Real document and select Canonical only for the literal
  `canonical` mode.
- Literal `legacy` and `shadow` retain Legacy reads. Demo selects Demo first, never calls the
  Real feature-flag reader, and still constructs the Factory with its safe Legacy mode input.
- Each destination still creates exactly one Repository, one `DetailReadSession`, one memoized
  load, and one renderer call. Exact stream sets and optional zones/athlete flags are unchanged.
- Unsafe feature-flag accessors and shapes fail closed before Factory construction without
  executing getters or exposing raw errors.
- Composition roots and Router still perform no direct provider, Token, Authorization,
  localStorage, IndexedDB, network, or implementation-specific Repository access.
- The boundary suite now freezes the literal 17-path PR-17 allowlist and stable public/mode/
  privacy assertions without adding whole-file or whole-tree hashes.

Actual B2 local evidence:

```text
node --test tests/consumers/detail-consumers.test.js
  tests/consumers/detail-boundaries.test.js
  PASS 266/266
node --test tests/repository/canonical-repository.test.js
  tests/repository/repository-factory.test.js
  tests/repository/repository-contract.test.js
  tests/repository/dependency-boundaries.test.js
  PASS 41/41
node --test tests/consumers/summary-consumers.test.js
  tests/consumers/summary-boundaries.test.js
  tests/feature-flags.test.js
  tests/legacy/demo-isolation.test.js
  tests/shadow/shadow-app-integration.test.js
  PASS 90/90
npm run check:syntax
  PASS 204 files
npm run check:privacy
  PASS
git diff --check
  PASS
```

No HTML/CSS, renderer, Store/schema, Import, analysis, dependency, Service Worker, release,
global default, or PR-18 path changed in B2. Browser/CDP, renderer degradation, full suite,
independent review, CI, and Closure remain pending.

### B3: renderer degradation and actual-route harness

Status: **Implementation completed locally / Browser execution blocked by surface capability**.

- Generic, Run, Bike, and Swim maps now prefer an existing provider polyline and otherwise
  consume only the injected `latlng` stream. Coordinates are copied, finite/bounds-checked,
  and never encoded, stored, or fetched as a route.
- A failure-first stream-contract check found that Run, Bike, and Swim did not request
  `latlng`. Their existing stream lists now append only `latlng`; request count, session count,
  Repository methods, metadata flags, and all other stream ordering remain unchanged.
- Minimal Canonical laps render missing metrics as the existing dash marker. Pace/speed charts
  include only laps with a finite positive derived speed, so DOM, chart data, and tooltips do
  not contain `NaN`, `Infinity`, or `undefined`.
- The new deterministic harness seeds only four inline synthetic Canonical bundles and freezes
  actual served Router plus Generic/Run/Bike/Swim document checks, Canonical/Demo/Legacy/Shadow
  mode checks, opaque IDs, maps/laps/charts, repeated Advanced reuse, provider/auth/Legacy I/O,
  console/runtime, IndexedDB, storage, Cache, and Service Worker observations.
- A stable boundary test parses the harness module with Node and asserts the actual-route and
  evidence contracts without a whole-file hash.

Actual local evidence at the B3 implementation boundary:

```text
node --test tests/consumers/detail-consumers.test.js
  tests/consumers/detail-boundaries.test.js
  PASS 269/269
node --test [focused detail/Canonical Store/Repository/summary/Demo/shadow set]
  PASS 415/415
npm run check:syntax
  PASS 204 files
npm run check:privacy
  PASS
git diff --check
  PASS
```

Browser/CDP did not pass and is not claimed. The control tower used policy-compliant fresh
in-app Browser tabs at two isolated loopback ports. Both passed the loopback and explicit
synthetic-mode preconditions and failed closed before seeding with redacted
`StorageError / PR17_BROWSER_GATE_FAILED`; `seededBundles` remained zero. A bounded capability
check on the fresh origin established that `indexedDB`, `IDBKeyRange`, `localStorage`, and
`sessionStorage` are all unavailable in that execution surface. No Chrome/raw-CDP fallback
was used. The actual Canonical Store/browser portion is **Blocked pending a separately approved
equivalent execution surface**. No user profile, credential, Token, account, private fixture,
real activity/location/health/power data, external provider request, screenshot, Cache, or
Service Worker was accessed. Both temporary servers were stopped cleanly.

Independent review, full suite, depth-1 verification, exact-head CI, and Closure remain pending.
