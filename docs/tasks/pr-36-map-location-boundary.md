# PR-36: External Map Location-Egress Consent and Precision Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R8 |
| Status | Task-Brief-only publication in progress; A2 read-only audit and owner decision required before implementation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/map-location-boundary` |
| Exact base | `integration/v2@5707d056ed1c083ab7a61648a050c8806efa4bbd` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | Integration push CI run `31286031445`, job `93174915406`, successful |
| Pull request | Draft PR required; Ready transition authorized only after final Closure gates |
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
