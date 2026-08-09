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
