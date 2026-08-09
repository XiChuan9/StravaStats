# PR-38: Service Worker Lifecycle Governance

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / D3 / P0-08 |
| Status | A3 Option A frozen; bounded implementation authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/service-worker-lifecycle` |
| Exact base | `integration/v2@d8bcdb221e49f7ed664eeb43733918eabd0ccf30` |
| Exact base tree | `9fe7ccb41e38e3606c371f8cbcb8dbdbf7c6f103` |
| Owner | Codex |
| Dependency | Integration push CI run `31305831264`, job `93225954586`, successful |
| Pull request | Draft PR #44, targeting `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Investigate the production Service Worker lifecycle from registration through install, waiting,
activation, controller changes, fetch/cache handling, update, failure, and rollback. Produce a
complete, mutually exclusive A/B/C owner decision package before any implementation or test
change. This Task Brief freezes the investigation contract and stop conditions only; it does not
select, imply, or authorize a lifecycle implementation.

Conflicts resolve in this order: accepted ADRs, product PRD, engineering plans and release gates,
this Task Brief, then implementation details. Proposed ADRs and historical conversations are
context, not authority to freeze an undecided lifecycle contract.

## Global invariants

- Preserve Legacy, V2, settings, backup, and all user-owned data. Do not delete, clear, migrate,
  overwrite, or mutate a real cache, database, storage area, browser profile, or registration.
- Missing or `null` values never become numeric zero. Genuine finite numeric zero remains
  distinct. Activity IDs remain opaque strings.
- R6 weather, R7 AI, R8 maps, R9 cache request/response boundaries, and R11 telemetry/CDN
  contracts remain unchanged unless a material collision is identified and routed for a new
  decision.
- No public API, schema, dependency, Worker, Repository, Import, Backup, Diagnostics, provider,
  deployment, or release contract expands by inference.
- `main` and `maintenance/v1` remain unchanged. The working base is the unique authorized
  `integration/v2` commit and tree recorded above.

## A0 exact-base evidence

- The assigned Codex worktree began detached and clean at
  `d8bcdb221e49f7ed664eeb43733918eabd0ccf30`, tree
  `9fe7ccb41e38e3606c371f8cbcb8dbdbf7c6f103`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` independently resolved to that exact
  commit and tree before branch creation.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`; the isolated worktree was attached to
  the exact branch `codex/v2/service-worker-lifecycle`.
- Status was clean before branch creation. The supplied untouched-baseline evidence records
  `npm ci` passing, syntax checking 259 files, privacy passing, the full suite passing 1696/1696,
  and clean diff/status.
- Local `gh` authentication is invalid. It will not be repaired through Chrome, interactive
  login, or a user browser/profile. A GitHub App `403` write must be delegated exactly to the
  control tower.

## A1 Task-Brief publication boundary

The first feature-branch commit contains exactly this path:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
```

It must be pushed normally and used to open a Draft PR targeting `integration/v2` with the exact
title:

```text
fix(v2): govern Service Worker lifecycle
```

If the GitHub App returns `403` or `Resource not accessible by integration`, delegate the exact
GitHub write to the control tower. Do not use Chrome, interactive login, a user profile, or another
credential path.

## A2 findings-first read-only investigation contract

Audit the actual production call graph end to end:

```text
registration and update checks
-> install and install seeding
-> installed/waiting worker and activation trigger
-> activate cleanup and client adoption
-> controllerchange and page reload/update UX
-> controlled and uncontrolled fetch
-> request classification and response/cache behavior
-> multi-tab and mixed-version coexistence
-> failure, cancellation, timeout, observability, eviction, and rollback
```

The audit must inventory exact current source, tests, authoritative documentation, and browser
standards for:

1. `skipWaiting`, `clients.claim`, install seeding, fixed or versioned cache names, activate-time
   deletion, registration/update checks, `controllerchange`, and fetch handlers;
2. R9 request/response policy, R11 same-origin vendor assets, query/private bypasses, local
   development policy, cache keys, and response admission;
3. controlled/uncontrolled clients, old/new worker coexistence, waiting-worker behavior,
   multi-tab mixed-version behavior, page reloads, update prompts, and scope;
4. cold and warm offline behavior, partial or failed install/update/activate, fetch failures,
   cancellation/timeouts, retry and observability;
5. precise cache ownership, entry ownership, eviction eligibility and timing, owner-scoped
   cleanup, unrelated cache preservation, storage/user-data boundaries, and rollback to a prior
   build; and
6. material browser/platform limitations and every dependency on deployment, immutable asset
   publication, release ordering, rollback retention, hosting headers, and release policy.

Read the current PRD, release gates, relevant Task Briefs, and exact source/tests. Do not rely on
stale PR summaries. Evidence is limited to repository/static/standards analysis and deterministic
synthetic or in-memory probes. No production deployment, real Service Worker rollout, user browser
or profile, credentials, account/private activity, provider/network telemetry, or real cache,
database, storage, or registration mutation is permitted.

## Material A/B/C owner decision gate

Before any production, test, package, workflow, or Service Worker change, deliver one complete,
mutually exclusive A/B/C package directly to the control tower. It must include one recommendation
and explain tradeoffs. Each option must explicitly freeze:

- activation and update UX, including waiting, prompting, reload, and cancellation semantics;
- cache version/naming, exact ownership, entry ownership, eviction timing, and untouched caches;
- old/new worker coexistence, controlled/uncontrolled clients, and mixed-tab behavior;
- install/update/activate failure, timeout, retry, fallback, and observability semantics;
- precise cold/warm offline claims and rollback-to-prior-build behavior;
- browser/platform scope, privacy and complete user-data preservation boundaries;
- deployment and release dependencies, including publication order and retained rollback assets;
  and
- a collision-audited exact candidate implementation path allowlist and verification boundary.

The options must be materially distinct and cannot silently mix. A required extra path, dependency,
public surface, storage mutation, deployment promise, or collision with R6/R7/R8/R9/R11 or an
accepted contract stops implementation and must be routed as a new minimum decision.

## Stop and write boundary

During A2, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
```

A2 may add findings and the decision package to this Task Brief in one docs-only commit and push
it. It may not edit production code, tests, fixtures, packages, lockfiles, workflows, Service
Worker files, generated artifacts, or other documentation. Keep the PR open and Draft. Do not
mark Ready, merge, clean up, deploy, release, change a default branch, clear caches/data, or begin
another risk surface. Stop before implementation until the owner explicitly selects A, B, or C.

## A2 findings

### Release-blocking findings

1. **Activation deletes Cache Storage without an ownership boundary.** `sw.js` enumerates the
   origin/storage-key Cache Storage name map and deletes every name except
   `strava-dashboard-v1`. Cache names are not scoped to one Service Worker registration. The code
   can therefore delete a cache owned by another application or scope on the same origin. It also
   logs the raw deleted cache name. The local-development policy is narrower but still deletes by
   the broad prefix `strava-dashboard-` and unregisters every registration returned for the origin,
   without proving root-scope `/sw.js` ownership.
2. **An update immediately replaces the active worker while old page code is running.** Install
   always calls `skipWaiting()` and ignores its promise. Activation calls `clients.claim()` outside
   `event.waitUntil()` and ignores its promise. There is no `updatefound`, worker `statechange`,
   waiting-worker, `controllerchange`, message, prompt, or reload coordinator. A tab can therefore
   continue executing old page modules after its controller changes to the new worker. Multiple
   tabs can cross that boundary at different moments with no UX or safe-point contract.
3. **The fixed cache makes build identity and rollback unprovable.** Installing and active workers
   both open `strava-dashboard-v1`. The installing worker may partially write new seed responses
   while the old active worker reads or writes the same cache. Runtime network-first writes then
   replace unversioned paths incrementally. A deployment rollback does not restore an old coherent
   cache; redeploying the current pre-D3 worker would again activate immediately and delete every
   other Cache Storage name.
4. **Install failure is intentionally converted into success.** Failure to open Cache Storage, any
   seed fetch, response validation, clone, or `put` is caught. `seedInstallCache()` therefore
   fulfills, install succeeds, and `skipWaiting()` still runs even when zero seeds were stored.
   This preserves R9's safer fetch classifier rollout but provides no atomic build/cache readiness
   signal. Activate cleanup rejection also cannot be treated as rollback: once a worker is
   activating, the standard advances it to activated even if activation work fails or is
   terminated.
5. **Update checking and failure observability are implicit.** Only root `index.html` imports
   `js/app/main.js`; after `window.load`, it calls `register('./sw.js')`. Direct Source Manager,
   Backup, Diagnostics, router, detail, and Gear entry pages do not register or observe updates,
   although an existing root-scope registration can control them. There is no explicit
   `registration.update()`, retry, cancellation, or app timeout. Registration rejection produces
   one generic fixed warning; install/update/activate/waiting/controller state is otherwise silent.

### Exact current production call graph

```text
root/index or rewritten root-tab document
  -> /js/main.js -> /js/app/main.js DOMContentLoaded handler
  -> window.load
  -> applyServiceWorkerPolicy()
     local host without ?enable-sw=1
       -> getRegistrations() -> unregister every returned registration
       -> caches.keys() -> delete every name starting strava-dashboard-
     all other hosts, or local ?enable-sw=1
       -> navigator.serviceWorker.register('./sw.js')
       -> no explicit scope/type/updateViaCache and no update()

install
  -> caches.open('strava-dashboard-v1')
  -> parallel validated credential-omit seed attempts for exactly
     /, /manifest.json, /icon-sport.svg
  -> every open/fetch/validation/clone/put failure contained
  -> event.waitUntil(seedInstallCache()) always fulfills
  -> unawaited skipWaiting()

activate
  -> event.waitUntil(caches.keys() -> delete every name other than fixed cache)
  -> raw cache-name console output for each attempted deletion
  -> unawaited clients.claim() outside the lifetime promise

controlled fetch
  -> R9 request classifier
  -> prohibited/private/query/cross-origin/navigation requests: no respondWith or Cache Storage
  -> approved queryless same-origin static subresource: network first
  -> validated response write to fixed cache
  -> network failure: validated match from fixed cache or fixed 503

uncontrolled fetch
  -> browser network path; worker sees no fetch event
```

Calling `register()` with the same URL, type, scope, and `updateViaCache` resolves the existing
registration under the standard registration algorithm; it is not the application's explicit
update policy. The user agent can independently run soft update checks, including stale checks.
The current code does not determine their timing and `vercel.json` defines no Service Worker script
header or release-order contract.

### Current R9/R11 interaction and offline truth

- R9 remains the complete runtime request/response boundary. All runtime documents, `/api/`,
  `/_vercel/`, query-bearing, sensitive-header, credential-`include`, non-GET, Range, cross-origin,
  weather, AI, tile, and provider requests bypass Service Worker caching. This package does not
  broaden that classifier or response admission policy.
- R11's exact same-origin versioned vendor JavaScript under `/js/vendor/` and CSS under
  `/styles/vendor/` are eligible R9 static subresources. After a successful online request, they
  may receive the current network-first write and later validated fallback. R11's SRI, CSP,
  no-CDN, no-telemetry, no-alternate-request, and fixed-failure contracts remain unchanged.
- Cold first-ever offline load is unsupported: no document can load and register a worker. Warm
  offline document navigation/reload is also unsupported because R9 deliberately keeps runtime
  documents network-only; the cached `/` install seed is inert for navigation. The only supportable
  claim is that an already installed/controlled app can return a previously validated eligible
  static subresource from its owned cache after that subresource's network request fails. API and
  external features remain network-only, and Cache Storage availability is never guaranteed.

### Cache ownership and data-preservation proof

The current repository and its tracked history prove only one application Cache Storage name:

```text
strava-dashboard-v1
```

Current and historical `sw.js` revisions create and open that exact name. It can contain the three
current install seeds and any R9-eligible static subresource actually requested online, including
R11 local vendor assets. Because the name predates R9, it can also contain historical private,
dynamic, query, or cross-origin entries. R9 makes those entries inert by never looking them up and
by revalidating every matched response; it does not identify or delete them.

No other current cache name can be proven application-owned. Every other name returned by
`caches.keys()` must remain untouched. Prefix similarity is not ownership evidence. In particular,
Cache Storage is origin/storage-key data shared by all scopes on that storage key, not private to
the root registration.

Cache Storage, IndexedDB, localStorage, sessionStorage, and Service Worker registrations are
distinct storage endpoints. Deleting a Cache Storage name does not directly delete IndexedDB or
localStorage, but that is not permission to delete it. The following remain wholly outside this
task and must never be opened, migrated, cleared, or overwritten by lifecycle code:

```text
IndexedDB  strava-dashboard-cache   (Legacy user library)
IndexedDB  strava-stats-v2          (Canonical V2 user library)
Legacy and approved settings in localStorage
bounded Diagnostics state in sessionStorage
private backups, imports, RawArtifacts, provider/auth state, and browser HTTP cache
```

The standard also makes cache persistence weaker than a product guarantee: Cache objects do not
expire or change merely because a worker updates, but best-effort origin storage can be cleared by
the user agent under storage pressure or by the user. No option below claims durable offline data
or changes persistence permission.

### Failure, concurrency, rollback, and platform limits

- `skipWaiting()` permits activation while clients use the old registration. `clients.claim()`
  changes matching clients' controller and schedules `controllerchange`; neither method reloads
  page JavaScript. The current ignored promises provide no completion or rejection evidence.
- `waitUntil()` extends an event only for its supplied promise and is subject to an optional
  user-agent timeout. A worker may be terminated when it has no event or exceeds a user-agent
  limit. Application code cannot promise a portable install/activate duration.
- If install's lifetime promise rejects or times out, the installing worker becomes redundant and
  an existing active worker remains. In the current code, catches prevent that failure path for
  all seed/cache failures.
- A waiting worker normally activates after the last client using the existing registration
  unloads. Current `skipWaiting()` bypasses that drain. Unregistering affects subsequent
  navigations; already controlled clients remain effective until they unload.
- Service Workers and Cache Storage require a secure context, subject to the platform's local
  development exceptions, storage key/partitioning, quotas, and user clearing. The PRD target is
  current-two Chrome/Safari/Firefox on macOS/Windows plus basic iOS Safari/PWA, but repository
  lifecycle evidence is deterministic Node/VM and prior disposable Chromium only. No Safari,
  Firefox, Windows, mobile, iOS/PWA, production, or real rollback claim exists.

Primary standards evidence: [Service Workers living draft](https://w3c.github.io/ServiceWorker/),
especially `skipWaiting`, `Clients.claim`, `ExtendableEvent.waitUntil`, Install/Activate/Try
Activate, and Cache lifetimes; and the [WHATWG Storage Standard](https://storage.spec.whatwg.org/)
for storage endpoints, best-effort buckets, quota, pressure, and clearing.

## A/B/C owner decision package

All options preserve the R9 request/response classifier and R11 local-vendor contract, create no
user-data migration, and never clear IndexedDB, localStorage, sessionStorage, backups, imports,
settings, credentials, or browser HTTP cache. They are mutually exclusive; selecting one does not
authorize values from another.

### A — Recommended: drained activation with immutable cache generations

**Activation and update UX**

- Remove unconditional `skipWaiting()` and `clients.claim()`. The new worker installs into waiting
  and activates only after the last client using the old registration unloads.
- Root startup registers exact `/sw.js` with explicit scope `/` and `updateViaCache: 'none'`, then
  calls `registration.update()` once. There is no interval or background retry. An eight-second
  page observation cutoff may emit only `SW_UPDATE_CHECK_TIMEOUT`; it does not cancel the browser
  update job.
- If `registration.waiting` exists, or an installing update reaches `installed` while a controller
  exists, root shows a non-modal, non-persistent informational banner: “Update ready. Close all
  StravaStats tabs, then reopen.” It has no Activate button and stores no consent/dismissal state.
- There is no automatic page reload and no page-triggered activation. First install leaves the
  current page uncontrolled until a later navigation. Natural activation should occur with no old
  client present; any unexpected `controllerchange` is observed with a fixed code only and does
  not trigger a reload loop.

**Cache name, ownership, coexistence, and eviction**

- The first governed cache name is exactly `stravastats-static-v2-000001`. The namespace
  `stravastats-static-v2-` is reserved exclusively for governed StravaStats static caches.
- `strava-dashboard-v1` is the exact legacy rollback cache. It remains untouched during the first
  governed rollout. Every unrelated cache name remains untouched.
- Each later governed worker must declare three literal lists in source: one current cache, one
  immediately previous rollback cache, and an exact `RETIRED_OWNED_CACHE_NAMES` list. Regex,
  prefix, “delete all except current,” and origin-wide cleanup are prohibited.
- Activation may delete only literal names in `RETIRED_OWNED_CACHE_NAMES`, only after natural
  drained activation, and never current, immediate previous, `strava-dashboard-v1`, or an unknown
  name. The first governed rollout has an empty retired list and deletes nothing.
- Old tabs remain entirely on the old page code, old worker, and old cache generation. The waiting
  worker uses only its new generation. Because activation waits for all old clients to unload,
  old/new workers do not control different live tabs and no tab runs old page code under the new
  worker by design.

**Install/activate failure, cancellation, timeout, and observability**

- The three R9 install seed paths remain exactly `/`, `/manifest.json`, and `/icon-sport.svg`, with
  the unchanged R9 request/response validation. All three are required for a governed generation.
  Open/fetch/validation/clone/put failure deletes only the partially created exact current cache
  and rejects install; the old active worker and all prior caches remain. No other deletion occurs.
- Install and activation use `event.waitUntil()` for every lifecycle promise. No raw error, URL,
  cache key, client URL/ID, activity ID, or data value is logged. Allowed fixed states/codes are
  `SW_UPDATE_CHECK_TIMEOUT`, `SW_UPDATE_INSTALL_FAILED`, `SW_UPDATE_WAITING`,
  `SW_ACTIVATED`, and `SW_CACHE_EVICTION_FAILED`, plus aggregate counts only.
- There is no app cancellation after the user closes tabs, no force-activation timeout, and no
  retry loop. Browser event timeouts/termination remain platform-defined. A failed install or
  update leaves the old worker active; a cleanup failure is non-fatal, preserves undeleted caches,
  and is retried only by a later deployment that again lists the exact retired name.

**Offline and rollback**

- Cold first-ever offline and warm offline navigation/reload remain unsupported. Only R9-eligible,
  previously validated static subresources in the controlling generation have warm fallback.
- Operational rollback must publish the prior application artifact with a new governed worker and
  a new monotonic cache generation; it must not redeploy a pre-D3 `sw.js`. Rollback follows the same
  drained activation and banner flow. Current and immediate previous governed caches plus
  `strava-dashboard-v1` remain available; no user data is touched.

**Tradeoff and recommendation**

This is recommended because it removes destructive origin-wide cleanup and avoids live mixed
page/worker versions without forcing reloads during imports, backup, or analysis. Its cost is slow
rollout and slow rollback when any tab remains open. It does not provide an “update now” action or
full offline application claim.

### B — Prompted activation with coordinated all-tab reload

- Use the same exact cache-generation, ownership, seed, failure, eviction, privacy, offline, and
  rollback contracts as A.
- Every production page in root scope must load one shared lifecycle client coordinator. When an
  update waits, every open tab displays “Update now” and “Later.” “Later” is memory-only until the
  next navigation. “Update now” explicitly warns that all StravaStats tabs will reload and can
  interrupt in-flight UI work.
- Acceptance is broadcast to all controlled tabs. Tabs acknowledge readiness; any tab may defer.
  If every tab acknowledges within 30 seconds, the accepting page messages the exact waiting worker
  to call `skipWaiting()` inside a message-event `waitUntil`. Otherwise activation is cancelled for
  that attempt, the worker remains waiting, and fixed `SW_UPDATE_COORDINATION_TIMEOUT` is shown.
- After accepted activation, every tab reloads exactly once on `controllerchange`, guarded by an
  in-memory one-shot flag. `clients.claim()` remains absent. A tab that fails to acknowledge or
  reload prevents success evidence and requires the user to close/reopen it; there is no forced
  navigation fallback.
- This gives faster user-controlled rollout and explicit mixed-tab coordination, but materially
  expands every production entry and browser-test surface, adds race/cancellation complexity, and
  can interrupt user work. It is not recommended for the first lifecycle repair.

### C — Immediate activation and best-effort automatic reload

- Use the same exact cache-generation, ownership, seed, failure, eviction, privacy, offline, and
  rollback contracts as A, except successful install calls awaited `skipWaiting()` and activation
  calls awaited `clients.claim()`.
- There is no prompt, consent, or cancellation. On `controllerchange`, lifecycle-enabled pages
  reload once automatically. Activation also sends a fixed update message to matched window
  clients; clients without the lifecycle coordinator can remain old page code under the new
  controller until their next navigation.
- A ten-second observation cutoff records only aggregate success/failure; it cannot cancel
  activation or force a browser reload. Failed install leaves the old worker active. Failed claim,
  message, or reload does not roll back the already activated worker.
- This minimizes rollout latency and makes emergency rollback fastest, but preserves an unavoidable
  mixed-version window and can disrupt imports, backup, or analysis without user choice. It is the
  least safe option and is not recommended.

## Exact candidate implementation boundary for Option A

Static collision audit found the smallest candidate allowlist for A:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
sw.js
js/app/service-worker-policy.js
js/app/main.js
styles/style.css
tests/service-worker-fetch-policy.test.js
tests/service-worker-policy.test.js
tests/service-worker-lifecycle.test.js
tests/service-worker-lifecycle-browser-smoke.html
```

`tests/service-worker-fetch-policy.test.js` contains the current byte-frozen lifecycle block and
must change while retaining the complete R9 fetch matrix. The new deterministic lifecycle test owns
install/waiting/activate/failure/cache-ownership/multi-tab state-model evidence. The browser smoke
is limited to a disposable loopback origin and disposable profile after implementation authority;
it is not authorized during A2. Root banner behavior remains in existing `js/app/main.js` and
`styles/style.css`, so A does not require changes to `index.html` or non-root production entries.

The current `tests/import/decoder-registry-wiring.test.js` has no Service Worker whole-file hash and
is excluded. R11 vendor assets, HTML/CSP/SRI, `vercel.json`, package/lock files, workflows,
Diagnostics, Repository, Import, Backup, storage, and every other path are excluded. Discovery of a
required tenth path stops implementation and returns a minimum collision decision.

## Material deployment and release-policy dependencies

No option alone closes the production release gate. Before implementation can be called
deployable, the release owner must separately freeze and later rehearse:

1. the exact monotonic cache-generation assignment and its mapping to each deployment/artifact;
2. atomic publication order: complete immutable application assets first, governed `sw.js` last,
   with no interval where the worker names an unavailable artifact set;
3. verified Service Worker script MIME, scope, and update-cache headers at the real host; current
   `vercel.json` does not freeze them, and this candidate allowlist does not authorize changing it;
4. retention of the current and immediate previous application deployments/assets for rollback,
   plus preservation of `strava-dashboard-v1` during the first governed rollout;
5. a rollback artifact that keeps the governed lifecycle and advances the cache generation instead
   of restoring the destructive pre-D3 worker;
6. production-like multi-tab, failed-update, storage-pressure, cold/warm offline, and forward/
   rollback rehearsal without real user data or cache deletion;
7. the supported Chrome/Safari/Firefox/macOS/Windows/iOS-PWA matrix or an explicit time-bounded
   compatibility waiver; and
8. release owner, rollback owner, verification owner, user communication, defect inventory, and
   zero unresolved P0/P1 sign-off.

If the deployment platform cannot guarantee atomic immutable artifacts and retained rollback
deployments, or if header/build automation requires `vercel.json`, a workflow, package, dependency,
public route, or generated manifest, implementation must stop for a new decision. No such release
or deployment policy is inferred by recommending A.

## A2 decision request and stop

Owner selection requested: **A (recommended), B, or C**. Until the exact choice is returned through
the control tower, no production, test, package, workflow, Service Worker, browser, cache, storage,
deployment, or release change is authorized. Draft PR #44 remains open and Draft.

## A3 owner selection and frozen implementation contract

The owner selected **Option A exactly** on 2026-08-09 through the control tower: drained activation
with immutable cache generations. No deployment-policy authorization was added. Every value in
Option A above is now mandatory; no behavior from B or C may be mixed into the implementation.

The exact cumulative hard allowlist for decision freeze, failure-first tests, implementation,
browser evidence, review repair, and Final Review Closure is:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
sw.js
js/app/service-worker-policy.js
js/app/main.js
styles/style.css
tests/service-worker-fetch-policy.test.js
tests/service-worker-policy.test.js
tests/service-worker-lifecycle.test.js
tests/service-worker-lifecycle-browser-smoke.html
```

Every unlisted path is prohibited. A required tenth path, deployment/header/workflow/package or
public-surface change, ownership ambiguity, or collision with R6/R7/R8/R9/R11 stops implementation
and returns a minimum decision package. The implementation does not authorize a production
rollout, release, cache cleanup, real registration/cache/profile mutation, or deployment-policy
claim.

Failure-first tests must precede production repair and prove the selected registration options,
one explicit update check, drained waiting behavior, absence of unconditional `skipWaiting` and
`clients.claim`, exact current/legacy cache names, empty first-rollout retired list, literal-only
eviction, required seed failure rollback limited to the partial current cache, fixed safe
observability, local root-registration ownership, unknown-cache preservation, no automatic reload,
and unchanged R9/R11 request/response behavior.
