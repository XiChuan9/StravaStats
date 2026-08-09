# PR-37: Telemetry and CDN Runtime Governance

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R11 |
| Status | A1 Task-Brief-only publication pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/telemetry-cdn-governance` |
| Exact base | `integration/v2@189a743c99af86fba38433ecdad20a09bfc39385` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | Exact-base integration CI run `31290651916`, completed successfully |
| Pull request | Draft PR pending |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close the R11 production telemetry and CDN-governance release blocker. Every production-reachable
Google Tag Manager, Google Analytics, Microsoft Clarity, Vercel telemetry, and third-party runtime
asset must have an explicit, frozen default and consent contract, page/mode matrix, literal request
allowlist, version/integrity policy, privacy boundary, failure/offline behavior, and evidence that
unapproved requests cannot occur. The final implementation must preserve the approved product
behavior while failing closed when a resource, consent state, runtime value, or request boundary is
missing, malformed, hostile, unavailable, or offline.

This task does not authorize D3 Service Worker lifecycle, production deployment or release, real
accounts or private data, the R3 public-Git-history incident disposition, provider/auth changes,
schema or public API changes, analysis changes, dependency expansion, a Worker or Service Worker
contract change, destructive cache/data work, or any real telemetry/CDN/provider request. R8 has
already closed the separate external tile-location consent boundary; R11 may govern the Leaflet
runtime asset but must not reopen or weaken the R8 tile contract.

Conflicts resolve in this order: accepted ADRs, product PRD, engineering plans and release gates,
this Task Brief, then implementation details. Proposed ADRs and historical conversations are
evidence, not authority to freeze an undecided telemetry or CDN contract.

## Global invariants

- Missing or `null` values never become numeric zero; genuine finite numeric zero remains distinct.
- Activity IDs remain opaque strings and are never parsed, normalized numerically, or placed in a
  telemetry field, URL, cache key, log, or third-party request.
- Demo never reads or sends Real activity, identity, consent, provider, cache, or user-owned state.
- Legacy rollback and all Legacy/V2 data remain intact. Disconnect, deletion, migration, cache
  cleanup, and data overwrite remain separate and unauthorized.
- No public API, schema, algorithm, dependency, Worker, Service Worker, provider, authentication,
  deployment, or release contract expands silently.
- Evidence uses deterministic synthetic values, loopback serving, interception registered before
  navigation/import, and disposable browser state only. Real Tokens, accounts, activities, routes,
  GPS, health, power, browser profiles, external requests, and private fixtures are prohibited.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `189a743c99af86fba38433ecdad20a09bfc39385`.
- After an explicit remote fetch, `HEAD`, `FETCH_HEAD`, local
  `refs/remotes/origin/integration/v2`, and the assigned SHA all resolved exactly to
  `189a743c99af86fba38433ecdad20a09bfc39385`. Status and diff were clean before branch creation.
- GitHub App evidence independently verified PR-triggered CI run `31290651916` at the exact base as
  `completed/success`. The combined legacy status API had no additional contexts.
- Untouched local gates passed before branch creation: `npm ci`; syntax for 249 files; privacy;
  full tests 1682/1682; `git diff --check`; clean status.
- Local `gh` authentication is invalid and will not be repaired through Chrome, interactive login,
  or the user's browser profile. A GitHub App `403` write will be delegated exactly to the control
  tower.
- No real Token, account, identity, activity, route, coordinate, heart-rate, power, setting,
  export, screenshot, browser profile, private fixture, external request, telemetry record, CDN
  response, Legacy library, or V2 library was read.

## A1 Task-Brief publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed normally and used
to open a Draft PR targeting `integration/v2` with the exact title:

```text
fix(v2): govern telemetry and CDN runtime dependencies
```

If the GitHub App returns `403` or `Resource not accessible by integration` for create, update, or
Ready operations, delegate the exact operation directly to the control tower. Do not use Chrome,
interactive login, a user profile, or a materially different GitHub write path.

From Task-Brief publication through the material decision gate, A2 is strictly read-only. The
cumulative write allowlist is exactly:

```text
docs/tasks/pr-37-telemetry-cdn-governance.md
```

No production, test, harness, fixture, documentation, lockfile, dependency, generated artifact,
Worker, or Service Worker may be edited before the owner choice is returned through the control
tower.

## A2 findings-first investigation contract

Audit every production-reachable telemetry and third-party runtime-asset path end to end:

```text
root / detail / gear / source / backup / diagnostics / direct navigation
-> Demo or Real and Legacy / Shadow / Canonical mode selection
-> eager or lazy document/module/library activation
-> source declaration, bootstrap, injected runtime, or dynamic loader
-> DOM/runtime execution and event/payload construction
-> URL/origin/path/query/header/referrer/credential request construction
-> network, response, redirect, CORS, SRI, CSP, browser cache, Cache Storage, and SW boundary
-> cookie/localStorage/sessionStorage/IndexedDB/global/console side effects
-> success, denial, malformed input, load failure, offline, refresh, and mode-switch behavior
```

The audit must inventory, with exact source locations and production reachability:

1. Google Tag Manager, `gtag`, Google Analytics, Microsoft Clarity, Vercel Analytics/Insights and
   Speed Insights, beacons, pixels, `sendBeacon`, `fetch`, image, iframe, script, module, injected
   global, dynamic import, and same-origin `/_vercel/` telemetry paths;
2. every root, detail, gear, source-manager, backup, diagnostics, analysis, Legacy, Shadow,
   Canonical, Demo, direct-route, reload, mode-switch, eager/lazy, click, timer, visibility,
   navigation, error, performance, and page-lifecycle trigger;
3. every CDN declaration and runtime import for Chart.js, D3, Cal-Heatmap, Leaflet,
   Leaflet.heat, their styles/plugins/icons/workers/fonts, and any other third-party runtime asset;
4. exact origin, scheme, host, port, path, query, version/pin, redirect, module/classic script,
   integrity/SRI, `crossorigin`, CSP, CORS, referrer policy, credentials, response type, MIME, and
   global-symbol behavior;
5. telemetry fields and transformations, including URL/title/referrer, opaque IDs, activity and
   gear attributes, routes/coordinates, errors, timing, user/session/client IDs, consent state,
   IP-derived metadata, and missing/null/zero behavior;
6. cookie, local/session storage, IndexedDB, memory/global state, browser/HTTP cache, Cache Storage,
   Service Worker interception, preconnect, DNS-prefetch, preload/prefetch, console, and unload or
   background-delivery behavior;
7. load failure, partial dependency failure, tamper/integrity failure, timeout, retry, fallback,
   offline, cold load, refresh, direct navigation, duplicate bootstrap, race, and late-event
   behavior, including whether a failure broadens origins or changes private-data handling;
8. production-reachable versus declared-but-unreachable assets and requests, with R8-approved map
   tile requests reported separately and never counted as an R11 telemetry/CDN authorization;
9. existing tests, browser harnesses, docs, CSP/hosting files, package/lock data, release claims,
   and known limitations that freeze or contradict current behavior; and
10. the exact smallest candidate file and literal network allowlists, plus any dependency,
    Service Worker, deployment, or public-surface collision that requires stopping before A3.

### Evidence rules

- Static source, deterministic VM/DOM execution, loopback serving, fixed synthetic canaries, and
  interception-before-import/navigation are permitted.
- No request may reach a real telemetry, CDN, provider, map, weather, AI, or auth host. Browser
  evidence must abort or fulfill from the harness before any external socket and retain only fixed
  category/origin/path/count facts.
- Never record a credential, identity, private payload, activity, route/GPS, health/power value,
  user-owned storage/profile, raw telemetry body, or external response.
- Findings lead with release-blocking behavior and the complete source-to-DOM/runtime/network/
  storage/cache/SW/console graph. A declaration alone is not proof of execution, and a blocked
  network request is not proof that third-party code did not execute.

## Material A/B/C decision gate

Before any production or test implementation, deliver one complete, mutually exclusive A/B/C
package directly to the control tower and obtain the owner's explicit material choice. The package
must freeze all related choices together; no value below may be inferred from the recommendation:

- telemetry default, exact affirmative consent if any, disclosure, scope, expiry, persistence,
  revocation, re-prompt, and complete-disable versus opt-in behavior;
- root/detail/gear/source/backup/diagnostics/analysis and Demo/Legacy/Shadow/Canonical matrix,
  including direct navigation, reload, offline, failure, and mode switch;
- exact telemetry events/fields, URL/referrer/title handling, identifiers, retention/cache/storage,
  IP/browser metadata, consent signaling, failure UI, and late/background delivery;
- each third-party origin and URL, exact version/pin, SRI, CSP, referrer, CORS, credentials,
  redirect, MIME/global, load order, timeout/retry/fallback, failure, offline, and cache semantics;
- whether each runtime asset is removed, vendored/localized, package-managed, or remotely pinned,
  and the compatibility, privacy, performance, provenance, update, rollback, and cache impact;
- exact hard network allowlist and deny behavior, distinguishing authorized CDN assets, disabled or
  opted-in telemetry, and R8-approved tile requests;
- dependency, lockfile, Worker, Service Worker, deployment, hosting/CSP, public-surface, schema,
  migration, privacy, rollback, and known-limitation impact; and
- exact cumulative file allowlist plus focused/full/browser verification and review requirements.

The package must contain one privacy-first recommendation and at least two materially distinct
alternatives. A choice cannot silently mix options. A required additional path, origin, dependency,
public contract, Service Worker/deployment change, or collision with an accepted decision stops
implementation and is delegated as a new minimum decision package.

## Post-decision implementation and closure contract

After the explicit owner choice is relayed, freeze the selected A3 contract and literal file,
origin, URL, event, field, storage, and cache allowlists in this Task Brief before production
changes. Implement failure-first and remain inside the approved paths. Required closure evidence:

1. focused failure-first tests for default and consent behavior, page/mode isolation, exact
   origins/URLs/versions/SRI/CSP/referrer/CORS, fields, storage/cache, duplicate/late execution,
   failure/offline/refresh/mode switch, missing/null/zero, and literal allowlists;
2. full `npm test`, `npm run check:syntax`, `npm run check:privacy`, and `git diff --check`;
3. actual-served disposable-browser evidence with interception registered before navigation or
   production import, proving default and Demo zero telemetry/unauthorized third-party requests,
   approved resource behavior, failure/offline/refresh/mode switching, and zero real external
   request;
4. one genuinely independent findings-first review, fixes for every finding, and a fresh
   independent no-findings re-review;
5. a Task-Brief-only Final Review Closure commit, normal push, true remote depth-1 exact-head
   readback, and exact-head GitHub CI success; and
6. a safe final PR body with exact base/head/tree/changed paths/CI/review/browser evidence and the
   control-tower Draft-to-Ready handoff.

Stop at Ready. Squash merge, auto-merge, cleanup, deploy, release, cache deletion, data mutation,
branch/worktree deletion, and any history rewrite require separate user authorization.

## A3 owner decision and frozen implementation contract

The owner selected Option A exactly on 2026-08-09 through the control tower. The selection also
authorizes one build-source-only acquisition in a disposable temporary directory for the exact npm
package versions below. It does not authorize an application or browser CDN request. Acquisition
material must be removed after the selected distribution bytes, package provenance, license,
tarball integrity, and hashes are verified and the approved local assets are created.

`package.json`, `package-lock.json`, and `tests/import/decoder-registry-wiring.test.js` remain
byte-for-byte unchanged. The exact-locked `@vercel/speed-insights@2.0.0` package remains an
install-only, runtime-unreachable dependency because PR-14 freezes the package files by whole-file
digest. Any need to change one of those three paths or a thirty-ninth path is a new collision and
stops implementation.

### Telemetry and page-mode contract

- Runtime telemetry is completely disabled. There is no telemetry opt-in, consent record, event,
  queue, identifier, cookie, storage key, retry, unload/background delivery, or fallback.
- The runtime telemetry allowlist is empty: Google Tag Manager, direct Google Analytics, Microsoft
  Clarity, Vercel Analytics, Vercel Insights, and Vercel Speed Insights are all denied.
- Root, every rewritten root tab route, activity router, Generic/Run/Bike/Swim detail, Gear, Source
  Manager, Storage Backup, and Diagnostics make zero telemetry request in Demo, Legacy, Shadow, and
  Canonical modes, including direct navigation, reload, refresh, and mode changes.
- Root GTM/`gtag`/noscript markup, every `/_vercel/insights/script.js` declaration, and every
  production import of `js/shared/utils/speed-insights.js` are removed. The utility may remain
  tracked but must be unreachable from every production entry.
- An opaque activity or Gear ID, URL/query/hash, document title/referrer, activity/athlete/gear
  field, coordinate/route, health/power value, Token, error, timing, IP-derived value, or browser
  metadata never enters telemetry because no telemetry code or collector is reachable.

### Local runtime asset contract

The only approved third-party visualization runtime is the following exact same-origin set:

```text
/js/vendor/d3-7.9.0.min.js
/js/vendor/cal-heatmap-4.2.2.min.js
/styles/vendor/cal-heatmap-4.2.2.css
/js/vendor/chart-4.5.0.umd.min.js
/js/vendor/chartjs-adapter-date-fns-3.0.0.bundle.min.js
/js/vendor/chartjs-chart-matrix-3.0.0.min.js
/styles/vendor/leaflet-1.9.4.css
/js/vendor/leaflet-1.9.4.min.js
/js/vendor/leaflet-heat-0.2.0.min.js
/js/vendor/html2canvas-1.4.1.min.js
/js/vendor/jspdf-2.5.1.umd.min.js
```

The package provenance is exactly D3 `7.9.0`, Cal-Heatmap `4.2.2`, Chart.js `4.5.0`,
chartjs-adapter-date-fns `3.0.0`, chartjs-chart-matrix `3.0.0`, Leaflet `1.9.4`, Leaflet.heat
`0.2.0`, html2canvas `1.4.1`, and jsPDF `2.5.1`. The selected distribution bytes and licenses are
tracked; no package is added to the manifest or lockfile. A later A3 evidence subsection must
freeze each acquired tarball integrity, selected-file SHA-256, and HTML SHA-384 SRI before a
production HTML change is committed.

Every local third-party `script` and `link` uses the exact versioned path, `crossorigin="anonymous"`,
and its exact `integrity="sha384-..."`. There is no alternate origin, unversioned path, redirect,
query, retry, fallback CDN, dynamic loader, `eval`, or remote module. A missing, malformed, or
integrity-failing core Chart runtime stops root/detail/Gear before Repository or private-data reads
and shows only fixed unavailable copy. Missing optional Cal-Heatmap, Leaflet/Leaflet.heat,
html2canvas, or jsPDF degrades only its visualization/export with fixed unavailable copy and never
broadens the request boundary.

The VDOT calculator iframe is removed. Its feature becomes an explicit user-initiated navigation
with `target="_blank"` and `rel="noopener noreferrer"`. External athlete profile images are denied:
the summary renderer accepts only the exact same-origin local placeholder `/icon-sport.svg`, and
Demo uses that path. Provider-controlled or other external HTTPS image values remain data only and
never become a request.

### Referrer, CSP, CORS, cache, and offline contract

Root, router, detail, and Gear documents declare `Referrer-Policy: no-referrer`. Their meta CSP has
no broad `https:`, `data:` script, `unsafe-eval`, external frame, object, or base permission:

```text
default-src 'self'
script-src 'self' plus only the exact SHA-256 hashes of retained static inline blocks
script-src-attr 'unsafe-hashes' plus only exact hashes of retained fixed handlers
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
worker-src 'self'
manifest-src 'self'
object-src 'none'
base-uri 'none'
form-action 'none'
frame-src 'none'
```

`connect-src` is page-minimal: activity router is `'self'`; Gear is `'self'` plus the exact three
R8 OpenStreetMap tile origins; Generic/Run/Bike are `'self'` plus the R6 Open-Meteo origin and the
three R8 tile origins; Swim is `'self'` plus R6 Open-Meteo; root is `'self'` plus the exact R6, R7,
and R8 origins. CSP is defense in depth; the accepted R6/R7/R8 modules continue to enforce their
exact paths, fields, methods, credentials, referrer, consent, cancellation, and limits.

Local vendor JavaScript under `/js/vendor/` and CSS under `/styles/vendor/` uses R9's existing
queryless same-origin static classifier. A successful online response may receive the existing
network-first validated Cache Storage behavior and later fallback. No Service Worker file,
classifier, install seed, cache name, lifecycle, deletion, eviction, or D3 contract changes. There
is no alternate resource request when offline. Cold first-ever offline remains unsupported; a
missing warm fallback fails with fixed local unavailable copy. Browser HTTP cache behavior is not
promoted to a product guarantee.

### Exact external request allowlist retained from R6/R7/R8

R11 adds no external origin. The only authorized automatic application request candidates remain
behind their previously accepted affirmative controls:

```text
R6 GET  https://archive-api.open-meteo.com/v1/archive
R7 POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
R8 GET  https://a.tile.openstreetmap.org/{z}/{x}/{y}.png
R8 GET  https://b.tile.openstreetmap.org/{z}/{x}/{y}.png
R8 GET  https://c.tile.openstreetmap.org/{z}/{x}/{y}.png
```

All other automatic external origins and paths are denied. Explicit user navigation to existing
Strava, Ko-fi, Reddit, or VDOT pages is not a runtime fetch authorization and must use
`noopener noreferrer`. R8 tiles remain separate location requests, not CDN or telemetry approval.

### A3 literal cumulative hard maximum

Implementation, tests, review repairs, documentation, and Closure may modify exactly these 38
paths. Every unlisted path is prohibited:

```text
docs/tasks/pr-37-telemetry-cdn-governance.md
index.html
html/activity-router.html
html/activity.html
html/run.html
html/bike.html
html/swim.html
html/gear.html
js/app/main.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/gear/index.js
js/demo/generator.js
js/tabs/athlete.js
js/vendor/d3-7.9.0.min.js
js/vendor/cal-heatmap-4.2.2.min.js
js/vendor/chart-4.5.0.umd.min.js
js/vendor/chartjs-adapter-date-fns-3.0.0.bundle.min.js
js/vendor/chartjs-chart-matrix-3.0.0.min.js
js/vendor/leaflet-1.9.4.min.js
js/vendor/leaflet-heat-0.2.0.min.js
js/vendor/html2canvas-1.4.1.min.js
js/vendor/jspdf-2.5.1.umd.min.js
js/vendor/THIRD_PARTY_NOTICES.md
styles/vendor/cal-heatmap-4.2.2.css
styles/vendor/leaflet-1.9.4.css
tests/privacy/external-runtime.test.js
tests/consumers/external-runtime-browser-smoke.html
tests/consumers/summary-boundaries.test.js
tests/consumers/detail-consumers.test.js
README.md
LOCAL_SETUP.md
PWA_GUIA.md
TECHNICAL_GUIDE.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
```

No schema, public API, analysis algorithm, package/lock, Worker, Service Worker, provider/auth,
deployment, release, Legacy/V2 data, migration, deletion, cleanup, or R3 incident-disposition
change is authorized. Rollback is a code-and-static-asset revert only and never clears Cache
Storage, Service Worker state, settings, credentials, Legacy data, or V2 data.
