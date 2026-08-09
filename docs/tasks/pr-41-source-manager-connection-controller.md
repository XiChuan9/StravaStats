# PR-41: Fail-Closed Source Manager Connection Controller

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C1 connection-controller seam |
| Status | A2 findings / A3 contract freeze; docs-only, implementation not authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df` |
| Exact base tree | `8692ac73a08a4725b68f40cf135be743d3018666` |
| Feature branch | `codex/v2/source-manager-connection-controller` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr41/StravaStats` |
| Owner decision | C1-A approved for Task-Brief-only Draft publication; implementation withheld |
| Parent decision | PR-40 / D-A A2 / D-B C / C1 A3 at `c864930f3890a392283939067f5d4d8da494d96f` |
| Parent pull request | PR #46 remains open and Draft; this task does not modify it |
| Pull request | PR #47 is open and Draft; title `feat(v2): add fail-closed Source Manager connection controller` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Prepare a separately reviewable C1 implementation contract for a fail-closed Source Manager
connection-controller seam. The eventual seam will expose sanitized connection status/actions to
the Source Manager page without enabling live authorization, reading or writing a Token, calling a
provider, or claiming that a durable provider connection exists.

This A1 publication creates only this Task Brief. A2/A3 remain read-only/docs-only until the owner
separately authorizes implementation. The parent approval does not authorize any of the nine
candidate runtime/test paths below.

## Authority and decision record

The owner selected the PR-40 staged direction and then selected C1-A:

> 批准 C1-A，并授权创建 PR-41 Task-Brief-only Draft；暂不授权实现。

The authoritative interpretation is:

- create this separate worktree/branch from the exact current `integration/v2` baseline;
- make the first commit contain exactly this Task Brief, push it normally, and create an open Draft
  PR targeting `integration/v2`;
- freeze the fail-closed contract and ten-path candidate maximum for later material approval; and
- do not implement, mark Ready, merge, clean up, deploy, release, mutate PR #31 or PR #46, use a
  real account/provider/private data, or expand another tranche.

Accepted ADRs, the product PRD, engineering plans/release gates, the PR-40 selected parent contract,
then this Task Brief govern conflicts. A proposed ADR, historical conversation, or candidate
allowlist is not implementation authority.

## Global invariants

- Preserve every Legacy and V2 record. Disconnecting a provider and deleting local data remain
  separate actions; this tranche provides neither.
- Preserve Legacy, Shadow, Canonical, and Demo isolation. Default feature flags and local-first
  startup remain unchanged.
- Pages do not read Tokens, call provider/server auth endpoints, select a provider, or choose
  persistence. Any future connection result reaches the page only through an injected sanitized
  application façade.
- Do not add or exercise OAuth, config/code exchange, revoke, credentials, Token/status reads or
  writes, localStorage/sessionStorage, provider/account/private-data access, server APIs, V5/schema,
  public Storage/Repository/Import APIs, dependencies, Worker, or Service Worker changes.
- Use only deterministic synthetic/static evidence and disposable browser profiles. Never use a
  user browser profile, real credential, private fixture, activity payload, route, health/power
  record, or provider request.
- A2/A3 may update only this Task Brief. Implementation requires a later exact owner authorization
  naming the selected phase and literal allowlist.

## A0 exact-base and untouched-gate evidence

- The remote `refs/heads/integration/v2`, local `integration/v2`, local
  `origin/integration/v2`, and new worktree HEAD were verified at exact commit
  `b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df`, tree
  `8692ac73a08a4725b68f40cf135be743d3018666`.
- The feature branch and `/Users/wangchuanliang/.codex/worktrees/pr41` path were absent before
  creation. The isolated branch/worktree was then created at the exact base. The locked long-lived
  integration worktree was not modified.
- PR #46's worktree was clean at `c864930f3890a392283939067f5d4d8da494d96f` before this task and
  is outside PR-41 scope.
- Untouched PR-41 baseline gates passed: `npm ci`; `npm run check:syntax` for 261 files;
  `npm run check:privacy`; full `npm test` 1711/1711; and `git diff --check`.
- `gh` 2.96.0 is installed but its local credential is invalid. It will not be repaired through
  interactive login, Chrome, or a user browser profile. Draft creation uses the GitHub App; an App
  403 is delegated as the exact Draft-only write to the control tower.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-41-source-manager-connection-controller.md
```

Branch:

```text
codex/v2/source-manager-connection-controller
```

Draft PR title:

```text
feat(v2): add fail-closed Source Manager connection controller
```

Draft PR body:

```markdown
## What changed

Adds the PR-41 Task Brief for the selected C1-A fail-closed Source Manager connection-controller seam.

## Why

The parent lifecycle decision selected staged P0 closure, but C1 implementation remains separately gated. This Draft freezes the sanitized controller contract, ten-path candidate maximum, privacy boundaries, and failure-first evidence before any runtime or test change.

## Impact

Docs only. No implementation, OAuth, Token or Web Storage access, provider/server request, schema/public API change, migration, or data mutation.

## Checks

- `npm ci`
- `npm run check:syntax` (261 files)
- `npm run check:privacy`
- `npm test` (1711/1711)
- `git diff --check`
```

No PR body update, Ready transition, merge, review request, label, assignment, cleanup, deployment,
or release is authorized.

### Authoritative A1 readback

- GitHub assigned PR number **#47** (PR-41 is the task identifier, not a reserved GitHub number).
- PR #47 is open, Draft, unmerged, and mergeable. Its base is
  `integration/v2@b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df`; its head is
  `codex/v2/source-manager-connection-controller@900c70b004ecb0c52e711d252b4954d6fb995c41`.
- The head is one commit ahead and zero behind the exact base. It contains exactly one changed file:
  this Task Brief. The installed title and body are exact, and no reviewer, label, assignment,
  Ready transition, merge, PR #31 edit, or PR #46 edit was made.
- The earlier unverified expansion `900c70bc6bdf84b5be0b16a3f817a60623e36d0f` is not a commit on
  this branch and must not be reused.

## A2 findings first

### F1 — the API card is static disclosure, not a connection lifecycle

- `source-manager.html` currently renders the Strava API card as `not_configured`, with two disabled
  actions (`Connect later` and `Disconnect`). No runtime reads or updates this card.
- The page introduction says nothing connects to a provider, and CSP allows only same-origin
  connections. This safely avoids provider I/O but does not implement the PRD P0 states, Connect,
  Disconnect, reauthorization, or Source Connection visibility.
- C1-A can truthfully replace the placeholder with one explicit `authorization_unavailable` state
  and a single disabled action. It cannot claim `not_configured`, `connected`, `disconnected`,
  last-sync, activity ownership, or account identity because no authoritative record exists.

### F2 — bootstrap already touches session storage before application startup

- `js/source-manager.js` installs global diagnostics listeners, reads `sessionStorage`, and configures
  the Import performance recorder before it calls `startSourceManager()`.
- The performance recorder immediately calls `getItem('stravastats_import_performance_v1')` during
  configuration. Diagnostics can later read/write `stravastats_diagnostics_errors_v1`.
- Therefore a callback sanitizer inside `js/app/source-manager.js` would be too late for the frozen
  "sanitize before storage" guarantee. The sanitizer must be the first synchronous bootstrap step,
  before diagnostics installation, Web Storage access, Worker construction, IndexedDB opening,
  application mode dispatch, or any error recording.
- C1 does not remove or broaden the existing bounded diagnostics/performance storage. It prevents
  callback values from reaching it and keeps the new connection controller itself storage-free.

### F3 — current mode parsing is permissive and constructs Real resources eagerly

- `js/app/source-manager.js` uses `URLSearchParams.get('mode')`: a missing mode selects Real, the
  first duplicate wins, and unrelated query fields do not block Real startup.
- After mode selection, Real composition constructs an Import store and module Worker before page
  initialization. Demo constructs only its storage-free Import façade; an invalid mode constructs
  that Demo façade solely to render a blocking error.
- A callback-shaped query must therefore be scrubbed and reduced to a canonical mode before the
  application function is called. Demo and invalid/sanitizer-failure paths must prove zero Real
  controller, Import store, IndexedDB, Crypto, or Worker construction.

### F4 — existing root authentication is materially incompatible

- `js/app/auth.js` reads `window` at module scope, fetches `/api/config`, redirects to Strava, posts
  authorization codes to `/api/strava-auth`, reads/writes `strava_tokens` in `localStorage`, and
  directly calls Strava deauthorization with a Bearer token.
- Its callback accepts any nonempty code without a C1-owned request-state contract and scrubs the URL
  only after exchange and token acceptance. Its disconnect removes the legacy token even when
  provider revocation is unconfirmed.
- Importing or adapting that module would cross the C1 authorization, Token, network, server API,
  provider, Demo, and local-library boundaries. C1-A must not import it, call it, or infer connection
  status from its token.

### F5 — V2 has no durable connection identity or backup representation

- The current database is V4 (`strava-stats-v2@4`) and has no `sourceConnections` store. Public
  Storage exposes no connection operation, and the backup payload/manifest has no connection entry.
- Activity Source provenance exists, but it is not an authenticated connection or durable owner.
  Repository public exports contain no provider connection surface.
- Consequently C1 cannot safely make Connect or Disconnect operable. C2 owns additive V5
  SourceConnection and backup semantics; any need to touch schema, Storage, Repository, Backup, or
  migration files is an immediate C1 stop.

### F6 — Import retry exists below Source Manager but is deliberately not exposed

- Import Service implements explicit `retryJob(jobId)` only for jobs in `failed_validation`,
  `failed_decode`, or `failed_storage`, with at least one retryable item and every required raw
  artifact still present. Cancelled and completed jobs are terminal and not retryable.
- Source Manager's Real Import façade exposes import, cancel, report, wait, preview, persisted-log,
  and duplicate-review calls, but not `retryJob`. The page polls active jobs, stops later work on
  quota failure, preserves completed items on cancellation, and renders persisted terminal reports.
- C1 must not add retry/recovery UI or expand Import/Worker public surfaces. That remains a distinct
  lifecycle tranche and collision domain.

### F7 — local-first data, backup, and Service Worker boundaries are already separate

- Real mode opens only the independent V2 Import path; Demo returns zero-data/unavailable methods and
  does not fall back to Real storage. Existing file/ZIP/FIT/TCX/GPX imports, duplicate review,
  persisted Import Log, first-run rendering, Storage & Backup navigation, and diagnostics remain
  independent of provider authorization.
- Source Manager navigations containing a query already bypass runtime Service Worker caching.
  The Service Worker and its cache policy need no C1 change.
- Disconnect/delete separation is present only as copy today. C1 keeps both actions unavailable and
  performs no record mutation, so Legacy, Shadow, Canonical, Demo, backup, diagnostics, and local
  activities remain byte-for-byte outside its write set.

### F8 — browser-side scrubbing has a precise privacy limit

- A script can scrub callback material from history before application storage/network work, and a
  `no-referrer` document policy can prevent it from becoming a referrer on subsequent resource
  requests.
- It cannot prevent the original document URL from having reached the browser, hosting edge, or
  origin access log. C1 therefore must not claim server-log erasure or a real OAuth callback privacy
  proof. A real callback endpoint, server logging policy, credentials, and provider evidence require
  separate authority.
- C1 browser evidence is limited to deterministic synthetic canaries in a disposable profile:
  post-scrub address bar/history, DOM, console, Web Storage, IndexedDB, diagnostics, fetch/XHR,
  resource referrers, and Service Worker observations.

## A2 call graph and protected boundaries

### Current Source Manager boundary

The current production graph remains:

```text
/source-manager.html
-> /js/source-manager.js
-> js/app/source-manager.js
-> js/pages/source-manager/source-manager.js
-> injected Import/V2 façade only
```

- `source-manager.html` has a same-origin-only CSP and a static disabled API card.
- `js/source-manager.js` injects document, location, IndexedDB, Crypto, and the module Worker for the
  existing local Import composition. It also owns the existing Import-performance `sessionStorage`
  configuration. It injects no fetch, Token, auth, or provider connector.
- `js/app/source-manager.js` constructs Canonical Import storage/Worker only for Real mode and a
  storage-free façade for Demo. It imports no root auth or provider module.
- `js/pages/source-manager/source-manager.js` is an injected UI consumer. Page rules prohibit it
  from reading Tokens/Web Storage, calling `/api/strava-*`, selecting a provider, or rendering raw
  errors/private inputs.
- Boundary tests freeze import-time zero I/O, Demo isolation, current Import/Repository public
  surfaces, and no page-owned auth/provider/storage.

### Why root auth is not reused

- `js/app/auth.js` reads `window` at module scope and imports root loading/error UI and Demo
  utilities. Its login/logout behavior is coupled to `js/app/main.js` and cannot be imported into
  Source Manager.
- The current root callback has no request-state contract, accepts any non-empty code, and scrubs
  the callback query only after successful exchange/Token acceptance. The current root disconnect
  performs a direct provider request. None of that behavior is authorized for PR-41.
- V2 V4 has no SourceConnection or Canonical owner identity. A Token cannot honestly become a
  durable `connected` state before C2, and it has no Source Manager Sync value before C3.

### Collision state

- PR #31's merge-base diff changes only `docs/tasks/pr-25-release-readiness-audit.md`; it does not
  overlap the candidate PR-41 paths and must not be edited.
- PR #46 contains the parent decision record only and must remain unchanged by this task.
- `tests/source-manager/source-manager-boundaries.test.js` contains historical PR-10 assertions and
  forward-looking Source Manager boundaries. A future implementation may update only the latter;
  it must preserve the historical PR-10 nine-path record.
- Shared auth, server API, Storage, Repository, Import, Worker, Service Worker, root shell, guides,
  and package files are outside the selected candidate maximum. Discovering a need for any of them
  is a material stop, not an implicit expansion.

## A3 frozen C1-A implementation contract

A3 records this selected candidate for later implementation approval; it does not implement it.

### Exact production semantics

- API card status: `authorization_unavailable`.
- Exact badge copy: `Authorization unavailable`.
- Exact visible copy: `Connection controller staged; authorization remains unavailable until
  connection identity and provider import are ready.`
- Render exactly one disabled button labeled `Connect unavailable`; render no Disconnect or Sync
  action.
- Read no Token or provider status. Perform no OAuth URL construction, config fetch, code exchange,
  revoke, localStorage/sessionStorage, external request, or automatic work.
- A nonempty local library and every Import/Backup/Diagnostics/duplicate record remain untouched.

### Exact controller and application/page façade

The application-local factory is `createSourceManagerConnectionController()`. It accepts no
options or capabilities in C1. Passing arguments has no observable effect because the factory does
not enumerate, access, retain, or call them. It performs no work at module import or construction.

The injected page façade contains exactly:

```text
getConnectionSnapshot()
beginConnect()
disconnect()
close()
```

`getConnectionSnapshot()` returns the exact deeply frozen production value:

```js
{
  schemaVersion: 1,
  status: 'authorization_unavailable',
  code: 'AUTHORIZATION_UNAVAILABLE',
  actions: {
    connect: false,
    disconnect: false
  }
}
```

- The snapshot contains no Token, athlete/account ID, URL, scope, provider response, underlying
  error, storage handle, SourceConnection, last-sync value, or activity count.
- Before close, `beginConnect()` and `disconnect()` return rejected Promises whose only enumerable
  field is the fixed safe code `AUTHORIZATION_UNAVAILABLE`. Rejection occurs before any I/O.
- `getConnectionSnapshot()` is synchronous and returns the same exact deeply frozen snapshot before
  and after close. It never throws and performs no I/O.
- `close()` is asynchronous and idempotent; every call resolves to the same deeply frozen
  `{ status: 'closed' }` value. After the first close call, `beginConnect()` and `disconnect()` reject
  with an object whose only enumerable field is `code: 'CONNECTION_CLOSED'`.
- The page never imports the controller module. Real composition constructs exactly one controller
  and injects it. Demo and invalid/sanitizer-failure composition construct none and never call a
  connection façade; the static fail-closed API card remains the Demo/blocked presentation.
- Page initialization reads the Real snapshot once and renders only allowlisted status/copy/action
  fields. It never renders an object, error message, stack, cause, URL, identity, or provider value.
- Application/page close closes the controller without changing the existing Import close/data
  semantics. Pagehide remains the only automatic close trigger.

### Navigation sanitizer

- `source-manager.html` places `<meta name="referrer" content="no-referrer">` before the stylesheet
  and module script. CSP remains same-origin-only and is not expanded.
- The first synchronous statement in `js/source-manager.js` invokes the application-local
  sanitizer with the current pathname, raw search, raw hash, and History façade. No diagnostics,
  Web Storage, Worker, IndexedDB, Crypto, timer, console, DOM mutation, or application startup may
  occur first.
- Canonical clean inputs are exactly the pathname `/source-manager.html`, an empty hash, and one of:
  empty search (Real), `?mode=real`, or `?mode=demo`. They perform zero history writes.
- Any nonempty hash, any OAuth-shaped exact query key (`code`, `state`, `error`, or `scope`), any
  unknown field, duplicate field, blank/invalid mode, malformed encoding, or noncanonical ordering
  is rejected as untrusted navigation material. Values are never retained, interpolated, rendered,
  logged, thrown, or persisted.
- Rejection performs exactly one `history.replaceState(null, '', canonicalPath)`. It preserves
  `?mode=real` or `?mode=demo` only when the parsed query has exactly one own `mode` value with that
  exact value and all remaining fields are OAuth-shaped; otherwise `canonicalPath` is the bare
  `/source-manager.html`. Hash is always removed. A bare replacement does not authorize Real startup
  in the current document; rejected input without one valid mode remains blocked until a later clean
  navigation/reload.
- A clean input returns exactly a deeply frozen `{ status: 'clean', sessionMode: 'real' | 'demo' }`.
  A successfully scrubbed input with one valid mode returns the same shape with status `sanitized`.
  Application dispatch consumes this returned mode rather than rereading `location.search`.
- Rejected input without one valid mode, or a sanitizer dependency failure, returns exactly a deeply
  frozen `{ status: 'blocked', sessionMode: null, code: 'NAVIGATION_SANITIZATION_FAILED' }`. It never
  returns query/hash/path values, and bootstrap does not call application startup.
- If pathname/dependencies are invalid, accessor/Proxy inspection fails, or history replacement
  throws, bootstrap performs no diagnostics/storage/network/Worker/IndexedDB/application work and
  reveals no input. It may set the existing static blocking panel only to code
  `NAVIGATION_SANITIZATION_FAILED` and copy `The Source Manager navigation could not be accepted
  safely.` after sanitization has returned.
- Sanitization is history-only rejection. It does not validate OAuth state, exchange a code,
  establish authorization, alter a Token, or prove that upstream logs lack the original URL.

### Literal candidate implementation allowlist

The hard cumulative maximum is exactly ten paths:

```text
docs/tasks/pr-41-source-manager-connection-controller.md
source-manager.html
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/pages/source-manager/source-manager.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
```

This A1 commit changes only the first path. The other nine are candidates, not authorization. A
stylesheet, third runtime module, auth/API file, guide, root page, or eleventh path pauses work for a
new material collision record and owner decision.

### Public, schema, dependency, Worker, and Service Worker boundaries

- No public Repository, Import, Storage, Backup, Diagnostics, or auth export changes.
- No database/store/index/record migration and no SourceConnection implementation.
- No dependency, package/lockfile, Worker/decoder/registry, Service Worker/cache, server API, CSP
  external-origin, root `index.html`, or `js/app/main.js` change.
- No Connect activation, provider identity, granted scope, Token lifecycle, revoke, Sync, Import
  retry/recovery, C2, C3, or C4 behavior.

### Failure-first tests required before future implementation

- Controller/page module import performs zero fetch, Token/Web Storage, provider, Worker, timer,
  console, navigation, history, or DOM I/O.
- Exact façade keys; no factory-option inspection; deeply frozen exact snapshot/close result; fixed
  status/codes and exact enumerable fields; repeat calls; pre/post-close matrix; and deterministic
  rejected Promises.
- `beginConnect()` and `disconnect()` prove zero fetch, config/exchange/revoke, navigation/history,
  storage, provider, Repository, Import, and Worker work.
- Bootstrap-order tests make storage/diagnostics/Worker/IndexedDB/DOM dependencies throw if touched
  before sanitization. Sanitizer tests cover every OAuth-shaped key, unknown keys, fragments,
  duplicates, blanks, malformed encodings, canonical Real/Demo, valid mode preservation, invalid
  path, hostile inputs, zero writes for clean input, and exactly one write for rejected input.
- Real constructs and closes exactly one controller. Demo, invalid dependency, sanitizer failure,
  history failure, and blocked mode construct zero controllers and zero Real Import resources.
- Canary callback values never appear in DOM, diagnostics, console, post-scrub URL, public errors,
  snapshots, Web Storage, IndexedDB, subsequent resource referrers, or persisted storage. Tests do
  not claim control over the original document request or hosting/server access logs.
- Existing file/ZIP import, cancellation, report/log, duplicate review, preview, backup navigation,
  Real/Demo/invalid mode, local-first, Repository/Import public, and Service Worker boundaries remain
  unchanged.

### Browser evidence required before future implementation

Use only an actual-served disposable fresh profile with deterministic synthetic inputs:

- Real, Demo, and invalid modes;
- unsolicited callback scrub and fixed safe error;
- offline and zero external/provider/server-auth requests;
- existing local import/cancel/report and backup navigation;
- keyboard/focus, disabled action semantics, 320px layout, and no raw query/private disclosure; and
- Service Worker request bypass/cache behavior unchanged.

The committed smoke harness may freeze and emit evidence, but no actual browser pass may be claimed
until it runs at the exact implementation head.

## Migration, data, privacy, and rollback

- **Migration/data:** none in A0–A3. A future C1-A implementation writes no Token, Web Storage,
  IndexedDB, source, import, activity, backup, setting, cache, or Demo record.
- **Privacy/network:** A0–A3 use no real account, credential, Token, provider/API request, private
  activity, location, health/power data, private fixture, or user browser profile. Future C1-A
  production remains network-free and must redact callback canaries from every output surface.
- **Rollback:** A0–A3 are docs-only and revert without browser-data impact. A future implementation
  rollback reverts only the authorized ten-path diff; no data or Token restoration is needed.
- **Architecture/collision risk:** medium. The controller is isolated and low risk, but bootstrap
  ordering intersects existing diagnostics/sessionStorage setup, and mode sanitization changes
  permissive query handling. Collision remains bounded to the ten candidate paths and forward-looking
  PR-10 boundary assertions.

## Material A3 implementation-authorization package

The evidence supports one bounded implementation package, **C1-A3**, and no live-auth substitute:

1. Implement the exact fail-closed zero-capability controller and Real-only injection described
   above.
2. Replace only the API-card placeholder with the exact unavailable badge/copy/single disabled
   action; do not add Connect, Disconnect, Sync, retry, or delete behavior.
3. Make navigation sanitization the first bootstrap operation, add the `no-referrer` policy, and
   retain only the sanitized mode result. Do not import root auth or touch Token/provider/server
   boundaries.
4. Add failure-first Node tests and deterministic disposable-profile browser smoke evidence within
   the ten-path maximum. Preserve every existing Import, cancellation, report, duplicate, backup,
   diagnostics, local-first, Demo/Real, Repository, Storage, Worker, and Service Worker behavior.

Implementation remains **not authorized** until the owner explicitly approves this exact C1-A3
package and ten-path maximum. Approval still would not authorize live OAuth/account/provider calls,
credentials/private data, Token or Web Storage connection-state access, server API, C2/V5/schema/
Backup changes, C3 Import/provider expansion, C4 ownership/lease recovery, deployment, release,
Ready, merge, or cleanup. A need for any such boundary is a material stop and new owner decision.

## Required verification

At A1 and after every later authorized docs or implementation phase:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Before any implementation completion claim, also require the frozen disposable-profile browser
evidence and an exact diff/allowlist audit. Tests must remain offline and synthetic.

## Stop condition

After the Task-Brief-only commit is pushed and the open Draft PR exact base/head/path state is
verified, stop. A2/A3 may perform read-only investigation and update only this Task Brief if
separately directed. Do not modify any candidate implementation path until the owner explicitly
authorizes implementation of the exact C1-A phase/allowlist.
