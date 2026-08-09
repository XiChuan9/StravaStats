# PR-36: External Map Location-Egress Consent and Precision Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R8 |
| Status | Local Final Review Closure complete; push, exact-head CI, and Draft-to-Ready pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/map-location-boundary` |
| Exact base | `integration/v2@5707d056ed1c083ab7a61648a050c8806efa4bbd` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | Integration push CI run `31286031445`, job `93174915406`, successful |
| Pull request | Draft PR [#42](https://github.com/XiChuan9/StravaStats/pull/42); Ready transition only after remote and CI gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close the R8 external-map location privacy release blocker. Every production-reachable map, tile,
geocoding, or other external-location request must be deny-by-default until the user receives an
accurate destination, purpose, field, precision, route-shape, timing, retention, and revocation
disclosure and gives the specifically approved affirmative authorization. Any authorized request
must use a frozen literal origin and request allowlist, the minimum approved location precision,
bounded scheduling, cancellation, failure, and memory behavior, and the approved mode matrix.

The accepted R1/R2 DOM-output hardening remains baseline. Safe DOM rendering does not establish a
safe request, location, browser, provider, cache, or retention boundary and must not be treated as
R8 evidence.

This task does not authorize R11 telemetry/CDN governance; D3 Service Worker lifecycle, deployment,
or rollback; provider/auth changes; R6 weather; R7 AI; schema, public API, algorithm, or dependency
expansion; destructive cache or data operations; a real external map/tile/geocoding request; a real
credential/account/private-data run; deployment, release, merge, cleanup, history rewrite, rebase,
amend, force push, or branch/worktree deletion.

Conflicts resolve in this order: Accepted ADRs, the product PRD, engineering plans and release
gates, this Task Brief, then implementation details. Proposed ADRs and historical conversations are
evidence, not authority to freeze an undecided location-egress contract.

## Global invariants

- Missing or `null` values never become numeric zero; genuine finite numeric zero remains distinct.
- Activity IDs remain opaque strings and are never parsed, normalized numerically, or used in
  coordinate, tile, or external-path construction.
- Demo never reads or sends Real coordinates, routes, consent, caches, provider state, or other
  user-owned state.
- Legacy rollback and all Legacy/V2 data remain intact. Disconnect, deletion, migration, and cache
  cleanup remain separate and unauthorized.
- There is no silent public API, schema, algorithm, dependency, provider, authentication,
  telemetry, CDN, Service Worker, or deployment expansion.
- Evidence uses deterministic synthetic values, loopback or interception boundaries, and a
  disposable browser only. Real Tokens, accounts, activities, routes, GPS, health, power, browser
  profiles, external requests, and private fixtures are prohibited.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `5707d056ed1c083ab7a61648a050c8806efa4bbd`.
- After an explicit fetch, `HEAD`, `FETCH_HEAD`, local `integration/v2`, and
  `origin/integration/v2` all resolved to the exact required SHA. `git diff --check` and status
  were clean before branch creation.
- GitHub App evidence independently verified integration push run `31286031445`, job
  `93174915406`, as `completed/success`. Its install, syntax, privacy, and full-test steps were all
  successful.
- Untouched local gates passed before any branch or file change: `npm ci`; syntax for 247 files;
  privacy; full tests 1665/1665; `git diff --check`; clean status.
- Local `gh` authentication is invalid and will not be repaired through Chrome, interactive login,
  or the user's browser profile. GitHub App authorization failure is delegated to the control
  tower.
- No real Token, account, activity, coordinate, route, heart-rate, power, setting, export,
  screenshot, user browser profile, Legacy/V2 library, private fixture, external request, or cache
  content was read.

## A1 Task-Brief publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed normally and used
to open a Draft PR targeting `integration/v2` with the exact title:

```text
fix(v2): require consent for external map location egress
```

If the GitHub App returns `403` or `Resource not accessible by integration` for create, update, or
Ready operations, delegate the exact operation directly to the control tower. Do not use Chrome,
interactive login, a user profile, or a materially different GitHub write path.

From Task-Brief publication through the material decision gate, A2 is strictly read-only. The
cumulative write allowlist is exactly:

```text
docs/tasks/pr-36-map-location-boundary.md
```

No production, test, harness, fixture, documentation, lockfile, dependency, or generated artifact
may be edited before the owner choice is returned through the control tower.

## A2 findings-first investigation contract

Audit every production-reachable map and external-location path end to end:

```text
root summary / detail / gear / Run Plus / NSM / direct navigation
-> Demo or Real and Legacy / Shadow / Canonical mode selection
-> disclosure, consent, revoke, and current authorization state
-> activity, stream, polyline, start/end, gear, or UI location source
-> missing/null/zero, range, descriptor, and opaque-ID validation
-> coordinate, route, bounding-box, zoom, tile, or geocoding transformation
-> URL/origin/path/query/header/referrer/credential request construction
-> trigger timing, concurrency, scheduling, timeout, retry, and cancellation
-> provider response, render, library seam, memory/browser/HTTP cache, SW and telemetry boundary
-> offline, denied, revoked, malformed, unavailable, navigation, and reload behavior
```

The audit must inventory, with exact source locations and production reachability:

1. every root-summary, activity-detail, Run, Bike, Swim, gear, Run Plus, NSM, Legacy, Canonical,
   Shadow, Demo, direct-route, lazy/eager import, map-control, click, hover, resize, pan, zoom, and
   programmatic trigger;
2. every map library, plugin, CDN-loaded map script/style, embedded frame, static-map image,
   reverse/forward geocoder, tile raster/vector endpoint, attribution or icon endpoint, provider
   link, and URL-opening seam that can disclose location or route context;
3. exact origins, schemes, ports, paths, subdomains, query parameters, path segments, headers,
   methods, modes, destinations, referrer/referrer-policy behavior, credentials, cookie behavior,
   redirect behavior, and response types;
4. coordinate sources and transformations, including start/end points, decoded polylines,
   `streams.latlng`, route sampling, rounding, truncation, bounding boxes, centers, map-fit logic,
   zoom levels, and tile `{z}/{x}/{y}` derivation;
5. disclosure class per request: single point, multiple independent points, ordered route shape,
   start/end pair, bounding region, or zoom/tile-region leakage; include temporal correlation,
   interaction timing, request count, concurrency, repeated views, pans, and zooms;
6. validation of absent, missing, `null`, genuine numeric zero, numeric strings, non-finite and
   out-of-range coordinates, empty routes, malformed encodings, sparse arrays, accessors, Proxies,
   revoked values, and opaque activity IDs before any external or cache side effect;
7. current consent or disclosure copy, state owner, storage key/format, lifetime, reuse, grant,
   revoke, abort, reload, cross-document, cross-mode, and existing-user behavior;
8. timeouts, retry/backoff, cancellation, abort races, navigation teardown, failure UI, offline
   behavior, partial tile failure, response/error redaction, and whether any automatic fallback
   broadens destination or precision;
9. browser memory cache, HTTP cache directives, Cache Storage, Service Worker interception,
   persistent site data, library caches, prefetch/preconnect, DNS and referrer exposure, plus the
   already separate telemetry/CDN boundary without changing it; and
10. tests, harnesses, docs, disclosures, and release assertions that freeze consent-free egress,
    exact coordinates, full routes, uncontrolled tile regions, false Demo isolation, missing-to-zero
    behavior, unsafe retention, or another release-blocking outcome.

### Evidence rules

- Static source, deterministic VM/DOM execution, fixed synthetic coordinates and routes, loopback
  serving, and interception-before-import are permitted.
- No request may reach a real external map, tile, geocoder, CDN, telemetry, provider, or auth host.
  Actual-served browser evidence must abort or fulfill from the harness before any external socket
  and retain only redacted origin/path/category/count facts.
- Never record request secrets, private values, full synthetic coordinate payloads when counts and
  categories suffice, or a user-owned browser/storage state. No screenshot may contain athlete or
  location data.
- Findings lead with release-blocking behavior and the complete source-to-egress graph. A safe DOM
  or local-only render claim is not substituted for a request/privacy finding.

## Material A/B/C decision gate

Before any production or test implementation, deliver one findings-backed A/B/C package to the
control tower and obtain the owner's explicit choice. The package must freeze all related choices
together; no value below may be inferred from the recommendation:

- deny-by-default and the exact affirmative gesture, disclosure copy, grant scope, expiry,
  persistence, re-prompt, and revoke behavior;
- exact user-facing destination, purpose, field, precision, route-shape, tile-region, timing,
  browser-cache, provider-retention, and limitation disclosure;
- exact coordinate rounding/truncation and validation, route-versus-point treatment, route sample
  maximum/order, tile zoom bounds, pan bounds, and whether user interaction can expand the region;
- per-request, per-document, session, or durable authorization and state ownership, including
  existing-user compatibility and separate deletion semantics;
- exact timeout, retry, concurrency, cancellation, revoke, navigation, response/cache lifetime,
  cache-key, cache-capacity, HTTP-cache and in-memory-cache behavior;
- Demo, Legacy, Canonical, and Shadow matrix, including direct navigation, reload, offline,
  denied, unavailable, malformed, missing-GPS, and zero-coordinate outcomes;
- a literal origin, protocol, host, port, path, query, method, header, credentials, referrer, and
  redirect allowlist, with all nonlisted destinations and fallbacks denied; and
- the exact cumulative file allowlist, focused/full/browser verification, migration, privacy,
  rollback, data-retention, public-surface, dependency, and known-limitation impact.

The package must include a privacy-first recommended option and at least two materially distinct
alternatives. A choice cannot silently mix options. A collision with a required path, origin,
library behavior, public boundary, or accepted decision stops implementation and is delegated as a
new minimum decision package.

## Post-decision implementation and closure contract

After the explicit owner choice is relayed, freeze the selected contract and literal allowlists in
this Task Brief before production changes. Implement failure-first and remain within the approved
paths. Required closure evidence is:

1. focused failure-first tests for authorization, precision, route/point/tile leakage, mode
   isolation, validation, missing/null/zero, cancellation, retry/timeout, cache, referrer,
   credentials, and literal allowlists;
2. full `npm test`, `npm run check:syntax`, `npm run check:privacy`, and `git diff --check`;
3. actual-served disposable-browser evidence with interception registered before production-module
   import and with zero real external request;
4. an independent findings-first review, fixes for every finding, and a fresh independent
   no-findings re-review;
5. a Task-Brief-only Final Review Closure commit, normal push, true remote depth-1 fetch/verification,
   and exact-head GitHub CI success; and
6. direct delegation of the exact PR-body update and Draft-to-Ready operation to the control tower
   when the GitHub App lacks permission.

Stop at Ready. Squash merge, cleanup, deploy, release, cache deletion, data mutation, branch or
worktree deletion, and any history rewrite require separate user authorization.

## A3 owner decision and frozen implementation contract

The owner selected Option A exactly on 2026-08-09 through the control tower. A read-only collision
audit found no required thirtieth path, dependency, Service Worker, HTML, or public-surface change.
The following contract is authoritative for implementation; missing context always denies.

### Consent, disclosure, and mode contract

- Permission belongs to one map in one loaded document and exists only in memory. Every new map,
  reload, direct navigation, and newly opened document begins denied. No permission state is read
  from or written to cookies, `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, the
  Service Worker, a URL, or another document.
- The exact affirmative action is **“Load approximate OpenStreetMap tiles for this map”**. No map
  library receives coordinates and no tile request is scheduled before that action.
- Demo performs no grant-state read or write, displays no grant control, reads no Real Gear cache,
  passes no coordinates to Leaflet, and performs zero external tile, map-location, or geocoding
  request. Its map presentation is deterministic and local only.
- Legacy and Shadow root/detail maps and Canonical detail maps use separate per-map grants.
  Canonical root has no GPS summary, offers no grant, issues no tile request, and states that no
  local route location is available.
- Gear is Real-only for R8. Its grant copy states that the approved coarse area covers all matching
  activities. This task does not migrate its Legacy data source. Swim remains local/unavailable and
  does not add Leaflet. Run Plus and NSM retain no direct map request; linked detail documents begin
  denied.
- A date, sport, activity, Gear set, or visualization-view change that changes or reclassifies the
  displayed region revokes the map and requires another action. Route-color, heat-color, density,
  radius, blur, and weather-presentation-only changes preserve the current map and do not resend
  tiles.
- Revoke removes the tile layer, aborts registered active and queued loads, revokes object URLs, and
  blocks future requests. `pagehide` performs the same cancellation. Copy states that revocation
  cannot recall requests already received or erase browser or provider records.

The exact standard disclosure is:

> Map tiles are provided by OpenStreetMap. If you choose “Load approximate OpenStreetMap tiles for
> this map”, StravaStats requests map images for the coarse area shown (zoom 11 or lower) from
> a.tile.openstreetmap.org, b.tile.openstreetmap.org, or c.tile.openstreetmap.org. Tile paths reveal
> the approximate displayed area and request timing. StravaStats does not send activity names or
> IDs, dates, route coordinates or route order, tokens, heart rate, or power; the route overlay
> stays in this document. Permission applies only to this map in this document. Revoke stops new
> requests and cancels registered loads, but cannot recall requests already received or erase
> browser or provider records.

Aggregate root and Gear views add: **“For this view, the requested area covers all currently visible
activities.”** The separate limitation text is: **“Map drawing code is currently loaded from
unpkg.com and runs in this page. This tile permission does not resolve that separate CDN trust
boundary.”** CDN governance remains R11 and is not changed or claimed closed here.

### Geometry, precision, request, and lifetime contract

- Geometry is validated in local code before any map-library or network side effect. Only a dense,
  ordinary array of dense, ordinary two-element arrays containing own finite numeric data values is
  accepted. Latitude is within `[-90, 90]` and longitude within `[-180, 180]`. Missing, `null`,
  numeric strings, holes, accessors, Proxies that throw, non-finite values, extra elements,
  out-of-range values, and malformed encoded polylines fail closed. Genuine numeric zero remains
  valid. Activity IDs remain opaque and never enter coordinate or tile construction.
- The complete valid local geometry is inspected before authorization is offered. It computes a
  coarse approved tile envelope locally; no ordered route vertices or sample are serialized. The
  current first-point zoom-13 request is prohibited. The map fits the complete approved region
  before adding a tile layer.
- Tile zoom is restricted to canonical integers `0..11`. `noWrap` is enabled. Pan and zoom are
  constrained to the initially approved coarse envelope, and tiles outside that envelope fail
  closed. At zoom 11, one equatorial tile is approximately 19.6 km wide and is latitude-dependent.
- The only permitted method is `GET`. Requests use `credentials: 'omit'`,
  `referrerPolicy: 'no-referrer'`, `redirect: 'error'`, `cache: 'no-store'`, no app header or token,
  a four-second timeout, bounded concurrency, and no retry or provider fallback. Responses must be
  successful PNG images no larger than 1 MiB. Response bodies and Blob URLs remain memory-only.
- Offline, denied, revoked, malformed, missing-GPS, timeout, abort, provider error, invalid response,
  and partial-tile failure produce local explicit states and never broaden origin, precision,
  destination, or retry behavior. R8 creates no durable tile cache and never clears browser,
  provider, Legacy, V2, Service Worker, or historical cache data.

### Literal network allowlist

The only hosts are:

```text
a.tile.openstreetmap.org
b.tile.openstreetmap.org
c.tile.openstreetmap.org
```

The only URL grammar is `https://HOST/Z/X/Y.png`, where `Z`, `X`, and `Y` are canonical unsigned
base-10 integers, `0 <= Z <= 11`, and `0 <= X,Y < 2^Z`. A leading sign, leading zero other than the
literal zero, whitespace, port, userinfo, query, fragment, alternate suffix or path, wildcard host,
redirect, retina variant, and every nonlisted origin are denied. Carto, Stamen, OpenTopoMap, Esri,
geocoding, and automatic fallback are not permitted.

### Literal cumulative implementation allowlist

The collision-audited maximum is exactly the following 29 paths. No thirtieth path may be changed
without a new owner decision:

```text
docs/tasks/pr-36-map-location-boundary.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
README.md
PWA_GUIA.md
TECHNICAL_GUIDE.md
js/app/main.js
js/app/map-location-egress.js
js/tabs/maps.js
js/tabs/run-analysis.js
js/pages/activity/index.js
js/pages/activity/activity.js
js/pages/run/index.js
js/pages/run/run.js
js/pages/bike/index.js
js/pages/bike/bike.js
js/pages/swim/index.js
js/pages/swim/swim.js
js/pages/gear/index.js
js/pages/gear/gear-analysis.js
tests/privacy/map-location-egress.test.js
tests/consumers/map-location-consent-browser-smoke.html
tests/consumers/summary-boundaries.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/canonical-summary-browser-smoke.html
tests/consumers/detail-browser-smoke.html
tests/consumers/canonical-detail-browser-smoke.html
tests/default-canonical-browser-smoke.html
```

## Final Review Closure

Local implementation and review closed on 2026-08-09 at implementation commit
`b72d3f63048d875b77d1de186253ebc9c6e23ee7`.

- Failure-first evidence: the first focused R8 run failed because
  `js/app/map-location-egress.js` did not exist. Production implementation began only after that
  expected failure and the A3 contract freeze.
- Scope evidence: the implementation commit changes exactly 23 paths, all contained in the frozen
  29-path maximum. The temporary attempted use of unapproved
  `tests/consumers/detail-consumers.test.js` was detected before staging, removed completely, and
  reported to the control tower; equivalent coverage is in approved
  `tests/consumers/detail-boundaries.test.js`. No thirtieth path was added.
- Focused evidence: the final combined R8 privacy, detail-boundary, and existing detail-consumer run
  passed 296/296. The fresh independent reviewer also ran the current R8 boundary subset at 43/43.
- Repository gates: `npm test` passed 1682/1682; `npm run check:syntax` passed for 249 files;
  `npm run check:privacy` passed; and `git diff --check` passed. One preceding full run encountered
  an unrelated Legacy timeout assertion under parallel load; that file passed 59/59 in isolation
  and the required full rerun passed 1682/1682.
- Actual-served evidence: a fresh headless Chromium context used an empty disposable profile. A
  route interceptor installed before navigation allowed only `127.0.0.1:3001` and aborted every
  other destination, while the served harness installed its fetch interception before production
  import. The exact result was `PASS: pre-consent and Demo zero egress; bounded rejection and revoke
  settlement verified.` There were zero non-loopback requests, console warnings, console errors, or
  page errors. No real external map request or user browser profile was used.
- Review evidence: the first independent review found unsafe consumer normalization, pre-bound
  response buffering, and premature Leaflet completion. Later fresh reviews found renderer clone
  laundering, incomplete response cancellation, unsettled revoke callbacks, missing decode status,
  a misleading Swim provider seam/state, and route-sized argument spreading. Every finding was
  fixed and regression-tested. A brand-new final reviewer then reported **no findings** across the
  complete latest tree and all prior findings.
- Contract result: Real maps start denied and use one per-map, per-document memory grant; Demo has
  no grant or tile request; Canonical root without GPS is unavailable; Swim remains local; Gear is
  Real-only aggregate disclosure; Run Plus/NSM retain no direct map. Geometry fails closed without
  missing/null-to-zero conversion, accepts genuine zero, supports the 200,000-point scale, and
  constructs only the approved coarse envelope before requests.
- Network result: only exact HTTPS `a`, `b`, or `c.tile.openstreetmap.org/Z/X/Y.png` URLs at zoom
  `0..11` can be constructed inside the approved envelope. Requests use the frozen credential,
  referrer, redirect, cache, timeout, concurrency, no-retry, response-size, cancellation, and
  object-URL contracts. No geocoder, provider fallback, durable permission, tile cache, telemetry,
  Service Worker, auth, schema, API, or dependency change was added.
- Migration, data, and rollback result: there is no migration or destructive operation. Legacy and
  V2 data, provider credentials, historical caches, disconnect semantics, and Legacy rollback remain
  intact. No real account, Token, activity, GPS route, health/power value, private fixture, or user
  browser state was read.
- Known limitation: Leaflet and Leaflet.heat remain loaded from `unpkg.com`; this separate R11 CDN
  trust boundary remains open. R6 weather, R11 telemetry/CDN, and D3 Service Worker lifecycle remain
  explicitly outside this change.

Remote publication, a true depth-1 remote-head verification, exact-head CI success, PR body update,
and Draft-to-Ready remain post-closure gates. Ready does not authorize merge, deploy, release, cache
deletion, cleanup, or history rewrite.
