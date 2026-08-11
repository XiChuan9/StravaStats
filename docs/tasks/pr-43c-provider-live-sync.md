# PR-43c: Source Manager Live Authorization and Server Revoke Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M29 / C1.1 Source Manager authorization |
| Status | A3 implementation authorized; failure-first implementation in progress |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae` |
| Exact base tree | `14f60e943fea98a3d35d1c116f04493c8b523154` |
| Feature branch | `codex/v2/source-manager-authorization` |
| Owner decision | `D-C3c.R-A + D-C3c A` |
| Parent package | Draft PR #52 A2 Package A |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Current authority | Complete frozen C1.1 A3 implementation within the exact 23-path maximum |

## Goal

Freeze the independently reviewable C1.1 boundary that activates same-tab, Real-mode-only Source
Manager Connect, Reconnect, callback processing, Token authority, and Disconnect with best-effort
server-side revoke. C1.1 does not acquire or import provider activities. Narrow C3c may begin only
after this PR is merged to `integration/v2` and integration CI succeeds.

This first commit creates only this Task Brief. The next authorized step is a short current-tree
collision/readiness audit recorded only in this file. Product and test implementation still requires
a separate explicit A3 authorization relayed by the control tower.

## Authority and sequence

The authoritative baseline is merged PR #51 at
`integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae`. The delegated baseline evidence records successful
integration-push CI run `31449313043`, job `93650164736`, and a clean integration worktree with
syntax 271 and full 1782/1782 tests. Those are baseline facts, not evidence for this feature head.

The owner approved `D-C3c.R-A + D-C3c A` with this required order:

1. C1.1 implements and independently closes the authorization and revoke boundary in this PR.
2. C1.1 merges to `integration/v2` and the integration push CI succeeds.
3. A separate narrow C3c branch and authorization may then activate provider acquisition through
   the already merged C3a, C3b, and Import boundaries.

The current dispatch authorizes only A0, A1, and a short readiness audit. It does not authorize
production or test implementation, live OAuth or provider calls, real account/private evidence,
Ready, merge, cleanup, deployment, release, or C3c/C4 work.

## Global invariants

- Preserve the working V1 path. A legacy three-field Token remains V1-only and must not be treated
  as C1.1/C3c authority.
- Preserve every Legacy/V2/import/source/backup/settings record. Disconnect and local-data deletion
  remain separate actions; C1.1 has no delete-source-data behavior.
- The C2 Strava subject is immutable. An exact restored-subject reconnect is allowed; a restored-
  subject mismatch fails closed without overwriting subject, Token, or SourceConnection.
- Missing identity or scope evidence never becomes authority. Provider and subject IDs remain
  normalized opaque strings and are never numericized for application use.
- Tokens, authorization headers, callback values, subject values, raw provider errors, precise
  location, health, or power data never enter DOM, logs, Diagnostics, reports, URLs after the
  synchronous scrub, Backup, Git, or deterministic evidence.
- Startup, reload, restore, Demo mode, and offline observation perform no automatic authorization,
  revoke, sync, or provider work.
- No schema, storage, migration, Backup, Import, Repository, Worker, Service Worker, dependency,
  root behavior, CSP, or local-development routing contract is reinterpreted by C1.1.

## Frozen C1.1 behavior

### Exact states and actions

- Exact composite/controller states are `unconfigured`, `authorizing`, `callback_processing`,
  `connected`, `reconnect_required`, `error`, `disconnecting`, `disconnected`, and `closed`.
- C3c may later add only ephemeral `syncing` and `cancelling`; neither becomes a C2/V5 durable
  value. Until C3c exists, C1.1 contains no provider sync implementation.
- The complete staged action lattice remains the exact PR #52 Package A contract:
  `unconfigured`/`disconnected` offer Connect, `reconnect_required` offers Reconnect, `connected`
  offers Sync and Disconnect, `error` offers explicit Sync again only with exact local authority plus
  Disconnect, `authorizing`/`callback_processing`/`disconnecting`/`closed` offer no competing
  action, and future `syncing` offers only Cancel Sync while Disconnect remains disabled until
  terminal cancellation.
- C1.1 activates only Connect, Reconnect, callback processing, and Disconnect. It may expose the
  later Sync action position/state without an active handler, but no Sync, Cancel Sync, provider
  acquisition, or import work exists until narrow C3c is separately authorized and merged.
- Connect and Reconnect are same-tab full-page redirects, Real mode only, after explicit consent
  copy. There is no popup, iframe, silent authorization, startup authorization, reload
  authorization, or automatic sync.

### Authorization request and callback capsule

- Request exactly the ordered scopes `read,activity:read_all`; do not request
  `profile:read_all`.
- Generate exactly 32 random bytes with injected browser Crypto, base64url encode them without
  padding, and store one exact single-use session state record with a ten-minute TTL and the exact
  Real Source Manager return path.
- Crypto or sessionStorage failure blocks before config fetch, authorization navigation, or other
  network work.
- Callback accepts exactly one nonblank code, one exact state, and the exact granted-scope set, or
  one `error=access_denied` outcome. Duplicate, blank, unknown, cross-mode, replayed, expired, or
  reduced/extra/reordered scope input fails closed.
- Callback query and fragment are synchronously scrubbed to the exact mode-only Source Manager path
  before Diagnostics, sessionStorage access, DOM work, exchange, or any other network work. A scrub
  failure discards the in-memory callback capsule and blocks.
- After the scrub, consume and delete state before exchange. A state cannot be retried or replayed.
- This contract uses the provider-documented confidential-client authorization-code flow with
  mandatory state. It makes no PKCE claim because Strava does not document PKCE parameters. If a
  security review requires provider-supported PKCE, stop instead of inventing a protocol.

### Same-origin browser and server boundary

- Browser config remains the existing same-origin `GET /api/config`.
- Exchange remains same-origin `POST /api/strava-auth` and receives one bounded exact JSON request.
- Add same-origin `POST /api/strava-revoke` for best-effort provider revocation.
- Browser requests use `credentials: 'same-origin'`, `cache: 'no-store'`, `redirect: 'error'`,
  `referrerPolicy: 'no-referrer'`, and a 15-second AbortSignal timeout. JSON POSTs use the exact JSON
  content type. There is no retry.
- Server routes validate exact method, content type, body keys, string lengths, provider status,
  response content type, response size, and reduced response shape. Responses are fixed,
  no-store, redacted, and do not reflect raw input or upstream details.
- Upstream exchange and revoke use a 12-second timeout and no retry. The client secret remains
  server-only. Revoke uses the current provider server-authenticated boundary.
- Exchange returns only reduced access token, refresh token, expiry, normalized positive-decimal
  subject, and exact ordered granted scopes. Athlete/profile objects and unknown provider fields do
  not cross into the browser.

### Token, subject, and scope authority

- The single local `strava_tokens` record becomes exact five-field C1.1/C3c authority: access token,
  refresh token, expiry, `subject_id`, and ordered `granted_scopes`.
- A legacy three-field Token remains usable by V1 but is insufficient for C1.1/C3c and renders
  `Reconnect required` at the Source Manager boundary.
- Before Token acceptance, compare the exact subject with both the immutable C2 Strava slot and the
  existing Legacy identity guard. Missing or unconfirmed identity stores nothing.
- For restored C2 data, only an exact restored-subject reconnect is allowed. Any mismatch stores
  nothing and never mutates subject, Token, or SourceConnection.
- Token write precedes C2 create/CAS. If the later C2 operation fails, remove the just-written Token
  best effort and never treat its presence as authority.
- Root refresh compatibility must preserve the existing exact subject and ordered scopes. A refresh
  response that cannot prove them fails closed and cannot downgrade a five-field authority record.

### Disconnect and revoke

- Disconnect first prevents or awaits the active sync boundary. C3c is absent on this head, so
  C1.1 must expose the seam without inventing sync acquisition or durable sync ownership.
- POST the refresh token through same-origin `/api/strava-revoke`; the browser never calls the
  provider revoke endpoint directly.
- Revoke is best effort. Local Token removal is attempted whether provider revoke is confirmed,
  unavailable, timed out, or returns a fixed failure.
- Successful local Token removal CASes only the permitted C2 status/history to `disconnected`,
  preserving immutable identity and `lastSyncAt`, and recording either no error or the exact fixed
  unconfirmed-revocation code permitted by C2.
- A stale C2 CAS is not retried. Token-removal failure returns a fixed error and does not claim local
  disconnection. No disconnect path removes activity, source, import, backup, settings, or Legacy/V2
  data.

### UI, privacy, and rollback

- Exact C1.1 labels are `Not connected`, `Authorization in progress`, `Connected locally`,
  `Reconnect required`, `Connection error`, `Disconnecting`, and `Disconnected`.
- Connected copy states that authorization is stored locally and is not automatically checked.
  Disconnect confirmation states that the origin-shared Legacy credential is also affected, local
  data is preserved, and provider revocation may be unconfirmed offline.
- DOM output uses fixed copy and text nodes/textContent only. Diagnostics records fixed categories,
  codes, and counts only. No callback value, Token field, subject, provider body, or raw error is
  rendered or logged.
- Demo remains `Demo — no provider connection` with no live action or injected auth capability.
- Rollback disables the Source Manager actions and same-origin routes while preserving all local
  records. A locally removed or provider-revoked Token cannot be reconstructed; reconnect remains
  explicit.

## Exact cumulative hard maximum

C1.1 may cumulatively change no more than these exact 23 paths:

```text
docs/tasks/pr-43c-provider-live-sync.md
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-authorization.js
js/app/auth-lifecycle.js
js/connectors/strava/strava-api-connector.js
js/pages/source-manager/source-manager.js
api/_shared.js
api/strava-auth.js
api/strava-revoke.js
tests/source-manager/source-manager-authorization.test.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/repository/strava-api-connector.test.js
tests/repository/dependency-boundaries.test.js
tests/privacy/server-api-logging.test.js
tests/privacy/privacy-guard.test.js
docs/guides/privacy-guide.md
```

There is no twenty-fourth path and no further substitution. A listed path may remain unused if
current-tree audit or implementation proves it unnecessary.

Explicitly excluded paths and behaviors include `api/config.js`, root `index.html` or main behavior,
local-development routing, CSP expansion, schema/storage/migrations, Backup, Import, Repository,
Worker, Service Worker, dependencies/package/lock files, C3c provider acquisition, C4
lease/recovery, deploy, release, cleanup, and real OAuth/provider/account/private data.

Discovery of any required twenty-fourth path, public/schema/dependency/Service Worker/Worker/CSP/
server-routing expansion, provider-supported PKCE requirement, or significantly different identity
or Token behavior is a stop condition. Return the minimum material collision to the owner; do not
expand silently.

## A0 exact-base and untouched-gate evidence

- This isolated worktree began clean and detached at exact commit
  `43455a6c9f513cca57d661a1aef179bb588897ae` with tree
  `14f60e943fea98a3d35d1c116f04493c8b523154`.
- Local `integration/v2`, the existing `origin/integration/v2` tracking ref, and live
  `refs/heads/integration/v2` all resolved to the exact base. `origin` is
  `https://github.com/XiChuan9/StravaStats.git`.
- The narrow unused branch `codex/v2/source-manager-authorization` was created at that exact commit.
  The unique integration worktree was not opened or modified.
- GitHub CLI 2.96.0 is installed and its `XiChuan9` keyring session is authenticated for the
  repository.
- `npm ci` completed; `npm run check:syntax` passed for 271 files; `npm run check:privacy` passed;
  and `git diff --check` passed on the untouched tree.
- One initially concurrent full-suite run had 1781/1782 pass because the deterministic stream
  performance p95 measured 35.368 ms against its 25 ms gate. The required uncontended rerun passed
  1782/1782 in 25.9 seconds. No file change was used to obtain the pass.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

Draft PR title:

```text
feat(v2): activate Source Manager authorization
```

The PR remains open and Draft. No reviewer, label, assignment, Ready transition, merge, cleanup,
deployment, release, or real/private evidence is part of A1.

### A1 publication readback

- First commit `b32c52b0bc1f157d660cb2b5741735ac32e983d5` has exact parent
  `43455a6c9f513cca57d661a1aef179bb588897ae` and changes only this Task Brief.
- The branch was pushed normally. The GitHub connector created open Draft PR #53 against exact
  `integration/v2`, with one commit, one changed file, 250 additions, the requested title/body,
  Draft true, and merged false.
- No reviewer, team, label, assignment, Ready transition, merge, or other PR mutation was made.

## A2 readiness-audit contract

After A1 publication, perform only a short read-only audit of the current integration tree needed to
confirm the literal C1.1 contract and exact 23-path maximum. The audit may inspect the named paths,
their direct imports, current server conventions, frozen C1/C2 and privacy tests, and the historical
PR #52 Task Brief only as decision provenance. It must not restart broad C3c investigation.

Record findings and any Task Brief correction only in this file, publish a second Task-Brief-only
commit, run the exact repository gates, read back remote depth one and exact-head CI, and return the
explicit A3 implementation authorization package to the control tower. Implementation does not
follow automatically.

## A2 current-tree collision and readiness findings

The audit used the exact A1/current-integration code. Historical PR #52 material was used only as
decision provenance. It did not reopen C3c provider acquisition, C4 ownership, or any excluded
surface.

### R1 — the existing callback scrub and composition seams are sufficient

- `js/source-manager.js` already invokes `sanitizeSourceManagerNavigation()` synchronously before
  Diagnostics, sessionStorage, DOM, Worker, IndexedDB, Crypto, or application composition. A scrub
  failure blocks before every application capability.
- `js/app/source-manager-connection.js` already recognizes only the exact Source Manager path and
  OAuth-shaped `code`, `state`, `error`, and `scope` query keys, scrubs once with `replaceState`, and
  rejects untrusted/cross-mode navigation. It currently discards those values and exposes only the
  frozen unavailable snapshot.
- C1.1 can evolve that included module to produce a detached, bounded in-memory callback capsule and
  pass it through the included bootstrap/composition paths after the scrub. No root entry, routing,
  CSP, session handoff, or new public module is required.

### R2 — existing Source Manager UI seams contain the activation

- Real composition already owns a separate connection facade; Demo passes `null` and constructs no
  connection controller. The page consumes only the injected facade and contains no provider,
  Token, storage, or server-route selection.
- The Strava card already has a fixed copy/status/action region and the page close path awaits the
  connection facade before closing Import. The included HTML, CSS, page, composition, and tests can
  represent the frozen states/actions without changing root navigation or Import APIs.
- C1.1 must keep Sync inert as described above. There is no C3a/C3b/Import call, provider acquisition,
  or active-import cancellation reinterpretation on this head.

### R3 — C2 already supplies the exact immutable identity and CAS boundary

- The public existing `createSourceConnectionStore` factory is already exported by
  `js/storage/index.js`; Source Manager can import it through its included composition root without
  changing Storage exports or implementation.
- The one fixed Strava slot validates the normalized positive-decimal `subjectId`, exact durable
  states, immutable ID/provider/subject, nullable historical `lastSyncAt`, exact error pairing, and
  integer revision. Its existing create and transition methods already provide the required atomic
  create/CAS behavior and stale-revision failure.
- Merged C2 Backup format 2 already preserves the exact subject and projects credential-dependent
  operational states to `reconnect_required` without Token material. Therefore exact restored-
  subject reconnect can be checked with a read; mismatch needs zero C2 or Backup mutation and cannot
  be repaired or rebound by C1.1.
- No schema, migration, storage, Backup, Repository, or C4 path is required.

### R4 — the shared Legacy Token collision is contained by the listed compatibility paths

- Current `js/app/auth-lifecycle.js` writes and disconnects a three-field V1 Token and already owns
  the Legacy identity guard and fixed no-delete results. Current `StravaApiConnector` consumes the
  same origin-shared Token and can otherwise downgrade refreshed metadata to three fields.
- Both implementation files and their exact regression tests are included. They can accept the
  five-field record, preserve subject/scopes across V1 refresh writes, retain three-field V1 use,
  and reject three-field C1.1/C3c authority without changing `js/app/auth.js` or Legacy data.
- Existing root V1 posts the exact `{ code }` request and must remain operational. The auth route may
  distinguish that bounded legacy request from the new exact Source Manager callback request. A
  reduced legacy response with no exact granted-scope evidence may create only a three-field V1
  Token; it must never invent scopes or upgrade itself to five-field authority. The Source Manager
  response must contain exact subject and ordered scopes and pass both Legacy and C2 guards.
- Root V1 direct logout remains a preserved Legacy path. Source Manager Disconnect independently
  uses the new same-origin revoke route and removes the origin-shared Token; neither path deletes
  local data.

### R5 — the server, CSP, and Service Worker boundaries need no expansion

- `api/strava-auth.js` already owns confidential exchange and `api/_shared.js` already owns the
  closed fixed server-event logger. Both require hardening but no new dependency or public browser
  secret. The new revoke handler is the only new server file.
- Platform `/api/*.js` discovery supplies the deployed route without a routing-table change. The
  excluded local-development server need not route or claim support for C1.1.
- Source Manager CSP already permits only same-origin `connect-src 'self'`; both browser calls fit
  it. The Service Worker already bypasses same-origin API/private/dynamic requests and does not need
  a cache or lifecycle change.
- The included privacy/server tests can freeze method, header, body, timeout, response, logging, and
  no-store behavior without adding a server-routing, CSP, Worker, or Service Worker path.

### R6 — the literal maximum is exact and collision-free

- The hard-maximum block parses to exactly 23 paths and 23 unique paths, in the delegated order.
- At the A1/current-integration head, 19 non-Task-Brief paths already exist. The only new
  implementation/test paths are `js/app/source-manager-authorization.js`, `api/strava-revoke.js`,
  and `tests/source-manager/source-manager-authorization.test.js`; this Task Brief is the remaining
  path.
- Every direct production edit identified by the call graph is already listed. Existing public
  Storage exports, Backup subject projection, root auth caller, platform routing, Service Worker,
  CSP, and dependency files are read-only consumers or fixed boundaries and require no change.
- No 24th path, public/schema/dependency/Service Worker/Worker/CSP/server-routing expansion,
  provider-supported PKCE requirement, or different subject/Token contract was found. The frozen
  stop conditions remain mandatory if implementation evidence later proves otherwise.

## Explicit C1.1 A3 authorization package

The control tower may relay implementation authority only in a new explicit instruction that names
all of the following:

```text
C1.1 A3 authorized on open Draft PR #53 from exact A2 head.
Implement only the frozen Source Manager authorization and server revoke contract in
docs/tasks/pr-43c-provider-live-sync.md, with the exact cumulative 23-path hard maximum.
Retain the merged C2 Backup subject only for exact restored-subject reconnect.
Any subject mismatch stores nothing and never mutates subject, Token, or SourceConnection.
Stop on any 24th path, excluded-boundary expansion, provider-supported PKCE requirement,
or materially different identity/Token behavior.
Run the exact local and exact-head CI gates; keep the PR open and Draft.
No C3c, C4, real/private provider evidence, Ready, merge, cleanup, deploy, or release.
```

Until that explicit authorization is relayed, no production or test implementation is authorized.

## A3 owner authorization

The control tower relayed the owner authorization verbatim:

> 批准 C1.1 A3 实施及精确 23 路径上限。

This authorizes complete failure-first implementation of the frozen C1.1 contract on open Draft PR
#53 from exact A2 head `f77574212a28a21fa60eb977770965e5311122f0`, subject to every hard boundary,
stop condition, evidence gate, independent review, Closure, and Ready-only condition in this brief.
It does not authorize merge, auto-merge, cleanup, deployment, release, C3c, C4, real/private
provider evidence, changes to `integration/v2`, or changes outside the exact 23-path maximum.

## A3 owner path-replacement decision

The control tower relayed the owner material decision verbatim:

> 批准 C1.1 路径替换：以 tests/repository/dependency-boundaries.test.js 替换 tests/source-manager/source-manager.test.js，累计硬上限仍为 23；新路径仅可更新 Connector 冻结 SHA-256 及对应批准说明。

This removes `tests/source-manager/source-manager.test.js` from the cumulative allowlist and adds
`tests/repository/dependency-boundaries.test.js`. The cumulative hard maximum remains exactly 23
paths. In the replacement path, only the Connector frozen SHA-256 and its corresponding explicit
approval/accounting comment or assertion may change. No other behavior or path expansion is
authorized.

## A2 local publication evidence

- The A2 working diff changes only this Task Brief. The literal allowlist audit reports exactly 23
  paths and 23 unique paths, with the three expected new implementation/test paths and no
  substitution.
- `npm ci` completed; `npm run check:syntax` passed for 271 files; `npm run check:privacy` passed;
  and `git diff --check` passed.
- The first A2 full-suite run passed 1781/1782; only the existing deterministic stream performance
  gate missed by 0.266 ms (`p95 25.266 ms` against `25 ms`). The immediate clean full-suite rerun
  passed 1782/1782 in 24.4 seconds. No product/test change or performance workaround was made.
- No OAuth, Token, provider, account, private fixture, user browser/profile, migration, Storage,
  Backup, Import, Repository, Worker, Service Worker, server implementation, or application/test
  implementation action was performed.
- Remote depth-one and exact-head CI are publication-time readbacks and are reported to the control
  tower after the pushed A2 commit; they are not inferred in this file.
