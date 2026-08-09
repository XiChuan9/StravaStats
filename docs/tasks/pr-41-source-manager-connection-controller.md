# PR-41: Fail-Closed Source Manager Connection Controller

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C1 connection-controller seam |
| Status | A1 Task-Brief-only publication; implementation not authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df` |
| Exact base tree | `8692ac73a08a4725b68f40cf135be743d3018666` |
| Feature branch | `codex/v2/source-manager-connection-controller` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr41/StravaStats` |
| Owner decision | C1-A approved for Task-Brief-only Draft publication; implementation withheld |
| Parent decision | PR-40 / D-A A2 / D-B C / C1 A3 at `c864930f3890a392283939067f5d4d8da494d96f` |
| Parent pull request | PR #46 remains open and Draft; this task does not modify it |
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

## A2 read-only evidence to preserve

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
  existing local Import composition. It injects no fetch, Token, auth, or provider connector.
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

## A3 frozen C1-A candidate contract

A3 records this selected candidate for later implementation approval; it does not implement it.

### Exact production semantics

- API card status: `authorization_unavailable`.
- Exact visible copy: `Connection controller staged; authorization remains unavailable until
  connection identity and provider import are ready.`
- Render exactly one disabled button labeled `Connect unavailable`; render no Disconnect or Sync
  action.
- Read no Token or provider status. Perform no OAuth URL construction, config fetch, code exchange,
  revoke, localStorage/sessionStorage, external request, or automatic work.
- A nonempty local library and every Import/Backup/Diagnostics/duplicate record remain untouched.

### Exact application/page façade

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
- `beginConnect()` and `disconnect()` reject with the fixed safe code
  `AUTHORIZATION_UNAVAILABLE` before any I/O.
- `close()` is idempotent. After close, every action rejects with fixed `CONNECTION_CLOSED` and
  performs no work.
- The new application controller is side-effect free at module import and receives every
  capability through validated injection. The page never imports it directly.

### Navigation sanitizer

- Before session-mode dispatch, an injected same-origin sanitizer detects any OAuth-shaped
  `code`, `state`, `error`, or `scope` query field.
- It rejects the navigation before auth/storage/network I/O; never renders, logs, throws, or records
  any query value; and performs one history replacement.
- It preserves only a sole exact `mode=real` or `mode=demo` field. Otherwise it returns to the bare
  `/source-manager.html` path. Duplicate, blank, malformed, accessor, and Proxy inputs fail closed.
- Demo and invalid modes never construct the Real controller. Sanitization is history-only and does
  not establish an auth flow.

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
- Exact façade keys; deeply frozen exact snapshot; fixed status/codes; repeat calls; close barrier;
  hostile options/accessors/Proxies; and deterministic rejected Promises.
- `beginConnect()` and `disconnect()` prove zero fetch, config/exchange/revoke, navigation/history,
  storage, provider, Repository, Import, and Worker work.
- Sanitizer covers every OAuth-shaped key, duplicates, blanks, malformed encodings, valid Real/Demo
  preservation, invalid mode, same-origin path, hostile inputs, and exactly one history replacement.
- Canary callback values never appear in DOM, diagnostics, console, post-scrub URL, public errors,
  snapshots, or persisted storage.
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
- **Architecture/collision risk:** low-to-medium, limited to Source Manager composition, navigation
  sanitization, and forward-looking PR-10 boundary assertions.

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
