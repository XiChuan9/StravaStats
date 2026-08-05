# PR-15: Local-first Bootstrap

## Metadata

| Field | Value |
| --- | --- |
| Status | A3 frozen; implementation authorized inside literal allowlist |
| Milestone | M12 |
| Base branch | `integration/v2` |
| Exact base SHA | `52334bbc7671231745bad96327afa4fa31d1a73c` |
| Feature branch | `codex/v2/local-first-bootstrap` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/32b9/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent findings-first Final Review before Ready transition |
| Dependency | PR-14 / PR #20 merged into `integration/v2` |
| Created | 2026-08-06 |

## Goal

Deliver the smallest conservative local-first startup slice:

```text
application startup
-> initialize the existing Local Library boundary
-> determine whether a local activity exists
-> empty library: deterministic First-run / Source Manager entry
-> non-empty library: existing Dashboard shell
-> optional, safely reported Strava source state
```

Provider or network failure must not block local capabilities. The existing
Legacy path remains available and PR-16 retains ownership of Canonical summary
page cutover.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `52334bbc7671231745bad96327afa4fa31d1a73c`.
- Starting `HEAD` and fetched `origin/integration/v2` matched with ahead/behind
  `0/0`; the exact commit is `feat(v2): wire local decoders into import registry
  (#20)`.
- The locked long-lived `integration/v2` worktree was present at the same exact
  SHA. No local task branch or task worktree existed before branch creation.
- Baseline gates passed: `npm ci`; syntax for 196 files; privacy; full suite
  1,271/1,271; and `git diff --check`.
- The local `gh` credential is invalid. GitHub write operations must use the
  authenticated GitHub App/control-tower handoff and must not use a user Chrome
  profile.
- No real activity, route, account, Token, credential, private fixture, export,
  screenshot, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with
`integration/v2 <- codex/v2/local-first-bootstrap` and title
`feat(v2): add local-first bootstrap`. No implementation path may be staged or
committed before this gate. If GitHub write access is unavailable, the exact
operation is handed to the control tower while local read-only work continues.

## A2 read-only investigation

### Actual startup and data call graphs

The current root path is auth-gated:

```text
/index.html
-> /js/main.js
-> /js/app/main.js DOMContentLoaded
-> handleAuth(initializeApp)
   -> valid Real Token or valid Demo Token: initializeApp
   -> absent/expired/invalid Token: no initializeApp
-> initializeApp
   -> one Legacy/Demo public Repository session
   -> listActivities({ refresh: false })
   -> optional athlete/zones/gears
   -> preprocessActivities
   -> setupDashboard and current tabs
```

`initializeApp(tokenData)` does not use `tokenData`; auth controls whether it is
called. The Real `LegacyRepository` reads the one-hour/version-matched Legacy
cache and otherwise invokes the Strava Connector. Consequently an absent Token
prevents even a locally cached Dashboard from starting, and an expired/stale
cache can fall through to provider I/O.

The independent Source Manager path is already local-only:

```text
/source-manager.html?mode=real
-> /js/source-manager.js
-> /js/app/source-manager.js
-> createImportStore + ImportService + one module Worker
-> initialize strava-stats-v2
-> previewActivities / Import Log / local file intake
```

Demo mode creates no Real Import Store or Worker. Source Manager imports are
the existing same-origin offline local capability and do not require auth.

Existing read boundaries relevant to startup are:

- public V2 `createCanonicalStore()` is import-time side-effect free; explicit
  `initialize()` opens/verifies only `strava-stats-v2`, and
  `listActivities({ limit: 1 })` proves activity presence without reading
  streams or relations;
- public Legacy Rescue readers open the Legacy IndexedDB without a version and
  abort missing-database creation, or read the exact localStorage fallback;
  they enforce neither TTL nor current cache version and never use network;
- the public Repository Factory remains Legacy/Demo-only with exactly seven
  methods. Its construction performs zero I/O, while a Real cache miss may
  invoke provider/token/network behavior;
- PR-16 owns Canonical summary data projection/cutover. PR-15 must not pass V2
  activity records to tabs, add a Canonical Repository mode, or introduce an
  eighth Repository method.

### First-run and failure definition

The bootstrap checks V2 first, then the two non-Demo Legacy Rescue sources.
`First-run` is proven only when V2 initializes successfully and has no activity,
and both Legacy sources are readable and have no activity. It navigates to the
existing `/source-manager.html?mode=real` entry.

Any verified local activity selects Dashboard without auth:

- Legacy Rescue activities use an explicitly approved bootstrap read façade
  for the current compatible summary path, bypassing TTL and provider fallback;
- a V2-only library enters the existing Dashboard shell and exposes Sources,
  but does not feed Canonical records into summary tabs before PR-16.

If one storage boundary fails but another proves an activity exists, Dashboard
continues with a safe degraded Local status. If no activity is proved and any
required read failed, startup is `blocked`, not falsely `First-run`; the UI
shows fixed recovery copy and performs no deletion, repair, retry loop, provider
fallback, or raw error disclosure.

Demo is selected before any Real storage construction and retains the existing
Demo Repository path. Real startup never selects Demo activities. The Legacy
Rescue aggregate helper is not used because it also inspects Demo state; the
two Real Legacy sources are read directly.

### Candidate options and risks

| Candidate | Benefit | Risk | Decision |
| --- | --- | --- | --- |
| Add Canonical Repository mode or project V2 records into tabs | Local records immediately populate charts | Starts PR-16, changes public/cutover contracts | Rejected |
| Use ordinary Legacy Repository for bootstrap | Reuses current session | Stale/empty cache can require Token/network | Rejected |
| Use `getCachedActivities()` directly | Small code path | Can create a missing Legacy database and enforces cache implementation behavior | Rejected |
| V2 presence check plus direct Real Rescue readers | Zero provider I/O, no missing Legacy DB creation, preserves current Legacy summary compatibility | V2-only summaries wait for PR-16 | Selected |
| Modify auth lifecycle to authenticate local sessions | Central status API | Changes provider auth contract and couples local startup to Token semantics | Rejected |

Primary risks are false First-run on storage error, accidental Demo/Real
fallback, duplicate store reads, Token/error disclosure, background provider
I/O, and quietly beginning Canonical summary cutover. Focused tests and literal
source audits cover each risk.

## A3 frozen contract and literal allowlist

### Literal path allowlist

Implementation and verification may change only these seven paths:

```text
docs/tasks/pr-15-local-first-bootstrap.md
index.html
js/app/main.js
js/app/local-first-bootstrap.js
tests/bootstrap/local-first-bootstrap.test.js
tests/bootstrap/local-first-bootstrap-boundaries.test.js
tests/bootstrap/local-first-bootstrap-browser-smoke.html
```

No allowlist glob, directory permission, or cumulative prior-PR path is implied.
`index.html` and `js/app/main.js` are the only existing production hotspots.

### Bootstrap result and source-status contract

The new app-internal bootstrap module exposes only frozen constants and a
dependency-injected inspection/orchestration seam. It returns one exact,
frozen safe result with:

```text
route: dashboard | first-run | blocked | demo
localStatus: ready | degraded | unavailable | demo
stravaStatus: connected | not_connected | reconnect_required | unavailable | demo
networkStatus: online | offline | unknown
legacyActivities: detached dense JSON-safe array only for the approved internal Legacy read façade
```

The Source Status and diagnostic fields expose no Token, credential, activity
ID/count, filename, date range, database handle/version, storage key, raw error,
warning, payload, cause, or provider response. The detached Legacy payload is
passed only to the current preprocessing boundary; it is never logged, rendered
as status/error copy, or returned from a public Repository/API. `connected`
means only that a locally stored Real Token
record has the existing required string fields and a finite future expiry; it
is not a network health claim. Missing Token is `not_connected`; malformed or
expired is `reconnect_required`; storage access failure is `unavailable`.

The bootstrap performs at most one V2 initialize, one presence query with
literal `{ limit: 1 }`, one V2 close, one Real Legacy IndexedDB read, one Real
Legacy localStorage read, and one Token read. V2 inspection completes before
Legacy inspection. Module import and factory construction perform zero storage,
Token, network, DOM, Worker, timer, console, or Service Worker I/O.

### Application orchestration contract

- Exact Demo mode runs the existing `handleAuth(initializeApp)` path and never
  constructs or reads Real V2/Legacy bootstrap dependencies.
- Real `first-run` performs one same-origin navigation to
  `/source-manager.html?mode=real` and starts no Repository/provider session.
- Real `dashboard` establishes at most one current Legacy Repository session
  for later explicit refresh/detail capabilities, but startup activities come
  only from the approved local Rescue result. Local-only initialization skips
  athlete, zones, gears, Token, and provider/network reads.
- V2-only Dashboard startup renders the shell and safe Source Status without
  projecting Canonical records into current summary consumers.
- `blocked` shows fixed local-library recovery copy and safe Source Status;
  it does not enter First-run, authenticate, initialize Repository, mutate
  storage, or execute a destructive recovery.
- The Sources action is same-origin and available from the Dashboard shell.
  Strava remains optional; no automatic OAuth redirect, sync, revoke, refresh,
  or connection probe occurs.
- Existing explicit Connect, Demo, Refresh, Disconnect, Legacy Repository,
  Import, Source Manager, and Service Worker behavior remains otherwise intact.

The following scope is prohibited unless an evidence-backed decision package
is accepted separately: public API or export changes; IndexedDB database,
schema, store, index, version, or migration changes; Canonical contract changes;
analysis changes; provider auth contract changes; production dependencies;
Service Worker, release, deployment, or telemetry changes; Legacy data writes,
deletion, migration, clearing, or overwrite; PR-16 consumer cutover; M13 work.

Activity IDs remain opaque strings. Missing, null, and zero remain distinct.
Demo and Real modes remain isolated. Public errors and Source Status must be
descriptor-safe, immutable/detached where applicable, deterministic, stable,
and redacted.

### Test and browser plan

Focused Node tests use dependency injection with deterministic synthetic data
and `fake-indexeddb` only where needed. They cover: import-time zero I/O; exact
first-run; V2-only, Legacy IndexedDB, and Legacy localStorage Dashboard routes;
V2-first ordering; one-call/no-duplicate I/O; offline/provider independence;
connected/disconnected/expired/malformed/unreadable Token status; V2/Legacy
failure degradation and blocking; Demo zero-Real-I/O; hostile descriptors,
accessors, Proxies, arrays, and errors; safe navigation/copy; missing/null/zero
preservation; and unchanged auth/Repository/Source Manager/Import boundaries.

The served browser harness uses a fresh disposable profile and actual root and
Source Manager paths with synthetic V2/Legacy sentinels. CDP observation starts
before navigation and records external/provider/auth requests, Authorization,
Fetch/XHR/WebSocket, console/runtime/log events, IndexedDB databases and safe
counts, Cache Storage, and Service Worker registrations. It exercises empty,
Legacy-present, V2-present, offline/provider-blocked, and Demo isolation states.
No real Token/account/activity/private fixture or user browser profile is used.

## Verification contract

Required local evidence:

```text
npm ci
npm run check:syntax
npm run check:privacy
focused startup/auth/Repository/Storage/Source Manager/Import tests
npm test
git diff --check
literal path and prohibited-surface audits
```

A disposable-profile served-path Browser/CDP run must exercise empty and
non-empty V2 storage, optional/disconnected/failing provider state, Demo/Real
isolation, offline local behavior, and synthetic Legacy/V2 sentinels. It must
record network, authorization/provider, console/runtime, IndexedDB, Cache, and
Service Worker observations without real credentials or private data.

After implementation, an independent reviewer performs a findings-first review
of the exact-base diff. Every actionable finding receives a focused failing
test before repair and a fresh independent re-review. Closure requires no
actionable findings, clean local gates, exact-head CI success, a final closure
ledger/PR body, and a second exact-head CI success for any closure commit before
the Draft PR moves to Ready for review.

## Privacy, migration, rollback, and stop conditions

Tests and browser evidence use only deterministic synthetic data. No user data,
filename, activity ID, route, health/power stream, Token, Authorization value,
raw provider error, or private payload may enter committed fixtures, DOM error
copy, console output, screenshots, reports, CI logs, or the PR body.

No data migration is planned. Rollback is a normal revert of this bounded code
slice or selection of the existing Legacy behavior, while retaining the entire
Legacy and V2 Local Library. Rollback never deletes, clears, repairs, downgrades,
reverse-copies, or overwrites data and never couples Strava disconnect with
local deletion.

Pause for a material architecture/product decision, scope outside the frozen
allowlist, a required public/schema/auth/deployment contract change, real
credentials/private data, Service Worker release strategy, production
deployment, merge, or destructive cleanup.

## Closure ledger

Pending investigation, implementation, deterministic verification, browser
evidence, independent review and re-review, exact-head CI, and Ready transition.
Ready is not merge authorization. Do not merge, clean the branch/worktree,
modify a protected long-lived branch, deploy/release, or start M13 / PR-16.
