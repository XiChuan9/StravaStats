# PR-31: Service Worker Private-Request and Cache Storage Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R9 |
| Status | A2 findings-first audit complete; minimum cache decision pending owner approval |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/service-worker-cache-boundary` |
| Exact base | `integration/v2@fe32274dabd7f41adcb255572b5a4a6460f492a4` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependency | R5 PR #36 Squash Merged; integration push CI recorded successful by the control tower |
| Pull request | Draft PR #37; Ready transition authorized only after final Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blocker P0-07 by making the production Service Worker fail closed for private,
dynamic, credential-bearing, query-bearing, provider/auth/API, and other non-static requests. Only
an explicitly approved literal same-origin static-shell allowlist may be matched, written to, or
served from Cache Storage. Preserve the allowed offline shell without changing application data,
Repository, Import, Storage, Backup, Diagnostics, analysis, default mode, or provider behavior.

This task does not authorize P0-08 lifecycle work. `skipWaiting`, `clients.claim`, activate-time
cache deletion/eviction, mixed-version behavior, production rollout, deployment, and rollback-worker
strategy remain the separate D3 responsibility surface. R6 weather, R7 AI, R8 maps, R10 Legacy
probe, and R11 telemetry/CDN also remain independent.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit are required evidence but do not freeze an undecided contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `fe32274dabd7f41adcb255572b5a4a6460f492a4`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` matched with divergence `0/0`.
- Integration push CI run `31241351233`, job `93062757174`, was independently verified by the
  control tower as completed successfully at the exact base. Local GitHub CLI authentication is
  invalid and was not bypassed with an interactive login.
- Untouched local gates passed: `npm ci`; syntax for 242 files; privacy; full tests 1527/1527;
  `git diff --check`; final clean status and `0/0` divergence.
- No real Token, Authorization value, provider response, identity, activity, route, GPS,
  heart-rate, power, settings, export, screenshot, private fixture, browser profile, Legacy
  library, V2 library, or Cache Storage content was read.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before production or test implementation is committed. GitHub
authorization failure is delegated to the control tower and does not authorize Chrome, interactive
login, or the user's browser profile.

Until A2 records the exact request/response/cache call graph and the owner approves the minimum
decision package, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-31-service-worker-cache-boundary.md
```

## A2 findings-first investigation contract

Read-only audit must freeze:

1. install, fetch, activate, Cache Storage, and registration call graphs;
2. every production API, auth, provider, same-origin dynamic, navigation, module, style, image,
   manifest, CDN, weather, AI, map, telemetry, and query route class;
3. request URL/origin, method, mode, destination, credentials, headers, Range, and query handling;
4. response status, type, redirect, content type, and Cache-Control handling;
5. every `match`, `put`, `addAll`, and fallback path, including rejection behavior;
6. the smallest exact static-shell path/extension allowlist and failure-first synthetic matrix.

The audit records only paths, categories, counts, closed safe codes, and fixed synthetic canaries.
It never records a credential, identity, provider/private payload, activity, route/GPS,
heart-rate, power, private setting, or raw Cache Storage value.

## Default recommendation pending owner approval

Prefer a literal same-origin static-shell allowlist. All other requests are network-only and never
call Cache Storage. Eligibility must be based on a complete request and response contract, not URL
name heuristics. A request that cannot be safely inspected fails closed. A response that does not
meet the exact status/type/content/cache-control contract is returned without Cache Storage write.

The implementation allowlist, exact cacheable paths/extensions, and treatment of query,
credentials, Range, navigation, modules, images, CDN, and historical private cache entries remain
unapproved until the A2 decision package is returned. No delete, eviction, activate change,
lifecycle change, storage cleanup, schema cleanup, or deployment strategy may be inferred.

## A2 findings and minimum decision package

### Frozen source-to-cache call graph

The current production graph is:

```text
non-local application startup
  -> applyServiceWorkerPolicy
  -> navigator.serviceWorker.register('./sw.js')

install
  -> caches.open('strava-dashboard-v1')
  -> cache.addAll('/', '/manifest.json', '/icon-sport.svg')
  -> addAll rejection is swallowed after raw console output
  -> skipWaiting (P0-08; unchanged here)

fetch for every http(s) GET except URL text containing api.strava.com
  -> fetch(request)
  -> any status-200 response clone
  -> caches.open('strava-dashboard-v1')
  -> unawaited cache.put(request, clone)
  -> on network rejection, global caches.match(request)
  -> cached response or fixed 503

activate
  -> caches.keys -> delete every name other than strava-dashboard-v1
  -> clients.claim
  -> entire path is P0-08/D3 and remains unchanged
```

`urlsToCache` is an unused broader list. The fetch path does not inspect origin, pathname class,
query, username/password, request mode, destination, credentials, Authorization/Token headers,
Range, response type, redirect state, URL, content type, Cache-Control, `Vary`, clone failure,
`put` failure, or cached-response eligibility. It uses global `caches.match`, so any origin cache
may satisfy the fallback.

Read-only deterministic VM reproduction proved one `put` each for a static request, same-origin API
request, query-bearing request, Authorization-category request, and cross-origin request. With
network failure it proved one `match` each for same-origin API, query-bearing, and cross-origin
requests. Output contained only fixed category labels and counts.

### Production request classes

The same-origin dynamic/private responsibility surface includes `/api/config`, `/api/strava-auth`,
`/api/strava-activities`, `/api/strava-activity`, `/api/strava-streams`, `/api/strava-athlete`,
`/api/strava-zones`, and `/api/strava-gear`; several carry opaque IDs or provider results in query
or response data. Detail/router and Sources URLs carry opaque IDs or mode state in query strings.
Same-origin `/_vercel/` paths are telemetry runtime paths. Cross-origin requests include provider,
weather, AI, map tile, CDN, analytics, and embedded-service categories. None is a static-shell
cache candidate.

The tracked static application surface is queryless root shell HTML, JavaScript modules and module
workers under `/js/`, styles under `/styles/`, two root classifier scripts, the manifest, one SVG
icon, and three fixed background JPEGs. Other root/detail HTML routes either carry private query
state in normal use, depend on external runtime assets, or are not needed for the minimum emergency
offline shell.

### Recommended request allowlist

Approve option A, the minimum emergency boundary:

```text
exact document paths
  /
  /index.html

script paths
  /classifyRun.js
  /classifyBike.js
  /js/**/*.js

style paths
  /styles/**/*.css

exact manifest/image paths
  /manifest.json
  /icon-sport.svg
  /media/bg-run.jpg
  /media/bg-bike.jpg
  /media/bg-swim.jpg
```

Eligibility additionally requires all of the following:

- `http:` or `https:`, exact `self.location.origin`, `GET`, empty username/password/search/hash;
- the exact path class above and matching browser destination: document, script/worker, style,
  manifest, or image;
- no `Authorization`, `Proxy-Authorization`, `Cookie`, `Range`, `X-API-Key`, or `X-Auth-Token`
  header category, and credentials mode is not `include`;
- descriptor/brand-safe inspection; any missing, hostile, throwing, accessor, or Proxy boundary
  fails closed without Cache Storage access.

URL suffix alone never establishes eligibility: prefix, extension, destination, origin, query,
method, credential, and response checks must all agree. A same-origin API path ending in `.js`, a
query-bearing static path, or a programmatic fetch with an empty destination remains ineligible.

Everything else is network-only: the fetch event does not call `respondWith`, `caches.open`,
`cache.match`, `cache.put`, `cache.addAll`, or global `caches.match`. This includes every `/api/`,
auth/provider request, `/_vercel/`, third-party CDN/analytics/weather/AI/map request, query-bearing
navigation or module, non-GET, Range request, and credentials-mode `include` request.

### Recommended response allowlist

An eligible network response may be written only when it is a non-redirected same-origin basic
response with status exactly 200, URL equal to the request URL, and content type matching the
request class:

```text
document  text/html
script    text/javascript or application/javascript
style     text/css
manifest  application/manifest+json or application/json
SVG       image/svg+xml
JPEG      image/jpeg
```

`opaque`, `opaqueredirect`, `error`, redirect, non-200, missing/mismatched content type,
`Cache-Control: no-store`, `private`, or `no-cache`, and `Vary: *` responses are returned from the
network but never stored. The same response contract is re-applied after `cache.match` before a
cached response can be served. Thus an old or hostile entry cannot be replayed merely because its
key now looks static.

Network-first remains only for eligible static requests. `open`, `clone`, `put`, and response
inspection failures return the successful network response without logging raw values. Network,
`open`, `match`, or cached-response validation failure returns one fixed synthetic 503 response.
`put` is awaited so rejection cannot become an unhandled promise. Global `caches.match` is never
used.

### Install, old entries, and lifecycle separation

The exact install seed remains `/`, `/manifest.json`, and `/icon-sport.svg`, but each is fetched
with credentials omitted and must pass the same response contract before `put`. `cache.addAll` is
not used because it cannot enforce the response allowlist. A seed failure does not prevent the
emergency worker from installing; it produces no raw log and no unsafe entry.

Keep cache name `strava-dashboard-v1` in R9. A new name would interact with the existing
activate-time delete-all-other-caches behavior and cross into P0-08. Existing private API, query,
or cross-origin entries are neither deleted nor evicted; they become inert because R9 never asks
for those keys, uses only the explicitly opened owned cache, and revalidates every matched response.
Deletion/eviction remains a D3 owner decision.

The existing `skipWaiting`, `clients.claim`, activate handler, delete behavior, registration policy,
and localhost cleanup behavior remain byte-for-byte outside the R9 implementation range. Passing
R9 does not close P0-08 or claim production lifecycle, mixed-version, cold-offline, rollout,
rollback, or cleanup evidence.

### Options and decision requested

- **A — Recommended:** approve the request/response allowlists and inert-old-entry handling above.
  This closes P0-07 without a destructive operation or lifecycle change and preserves a bounded
  static offline path.
- **B — Network-only worker fetch:** intercept/cache nothing at runtime. This is simpler and safer
  for privacy but materially removes the existing offline shell and is a product architecture
  decision.
- **C — Broader HTML/media or extension allowlist:** preserves more offline routes but increases
  private-query and rewrite ambiguity; not recommended without a separate exact route inventory
  and owner acceptance.

Owner approval is required before production or test implementation. Approval of A authorizes only
`sw.js`, `tests/service-worker-fetch-policy.test.js`, and this Task Brief as the eventual literal
cumulative allowlist. Any additional path or any delete/eviction/lifecycle/deployment change
requires a new minimum collision package and delegation.

## Failure-first verification contract

Before production repair, deterministic synthetic tests must fail for the exact current defects and
then prove:

- Token/Authorization, query, private-response, opaque-ID, API/auth/provider, weather, AI, map, and
  telemetry categories never reach `cache.match`, `cache.put`, or `cache.addAll`;
- GET and non-GET, navigation/static module/style/image, Range, error, redirect, opaque, and
  Cache-Control `no-store`/`private` cases obey the frozen contract;
- hostile Request/Response/accessor/Proxy inputs fail closed without getter/trap execution or raw
  disclosure;
- `cache.match`, `cache.put`, `cache.addAll`, clone, and fetch failures have deterministic safe
  behavior; and
- approved static assets remain available through the intended offline fallback.

If Node seams cannot prove the served worker boundary, use only a fresh disposable browser profile
and fresh loopback origin with deterministic synthetic data. Record Cache Storage names, entry
counts, and categories only. Never use a user profile, login, Token, provider, private fixture, or
production origin.

## Prohibited scope and stop conditions

- No modification of `main`, `maintenance/v1`, or `integration/v2`.
- No Service Worker lifecycle, cache deletion/eviction, schema/data cleanup, deploy, release,
  production rollout, mixed-version, or rollback-worker implementation.
- No Repository, Import, Storage, Backup, Diagnostics, Worker, analysis, dependency, route,
  feature-default, Legacy/V2 data, provider/auth behavior, weather, AI, map, telemetry, or CDN
  change.
- No real credentials, accounts, provider/private data, private browser state, destructive cache or
  storage operation, history rewrite, rebase, amend, force push, merge, cleanup, deploy, release,
  or next-package work.

Pause and delegate for any path expansion, material cache/product architecture decision, existing
private-cache deletion or eviction, lifecycle/deployment work, private evidence, destructive
operation, or GitHub authorization failure. Otherwise continue automatically through the approved
failure-first implementation, verification, independent review, Task-Brief-only Closure,
exact-head CI, and authorized Draft-to-Ready handoff. Squash Merge always requires separate user
authorization.

## Privacy, migration, and rollback

The intended privacy impact is to prevent private or dynamic responses from entering or being
replayed from Cache Storage. Migration impact is none: no database, schema, record, setting,
provider state, backup, Legacy library, or V2 library is read or changed. Historical Cache Storage
cleanup and production rollback are explicitly not authorized here. Mechanical code rollback is an
ordinary revert, but restoring broad private-response caching is not an acceptable production
state; emergency operational rollback requires the separately approved lifecycle/deployment
runbook.
