# PR-43c: Bounded Provider Live Sync Activation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M28 / C3c live provider-to-import activation audit and material freeze |
| Status | A2 material package frozen; awaiting owner selection; no implementation authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae` |
| Exact base tree | `14f60e943fea98a3d35d1c116f04493c8b523154` |
| Feature branch | `codex/v2/provider-live-sync` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/35cd/StravaStats` |
| Parent decision | D-A A2 / D-B C; D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A |
| Completed prerequisites | C1 controller, C2 SourceConnection/Backup, C3a mapper, C3b artifact import |
| Pull request | [Draft PR #52](https://github.com/XiChuan9/StravaStats/pull/52), open against `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Owner approval | A0-A2 investigation and material freeze only |

## Goal

Produce a findings-first, materially complete owner decision package for C3c: an explicit and
bounded live provider acquisition may feed only the already merged C3a mapper, C3b artifact builder,
and existing ImportService pipeline. Freeze the live authentication boundary, provider request
contract, orchestration and SourceConnection transitions, UI and privacy behavior, evidence gates,
and the smallest collision-audited literal candidate allowlist before any implementation begins.

This first commit creates only this Task Brief. A2 is read-only except for updates to this same file.
No live implementation starts until the owner explicitly approves every material choice and the
exact literal path hard maximum.

## Authority and boundary

The authoritative baseline is merged PR #51 at
`integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae`. The delegated integration evidence records
successful integration-push CI run `31449313043`, job `93650164736`, plus an independently clean
integration worktree with syntax 271 and full 1782/1782 tests. Those are baseline facts, not evidence
for this feature head.

The owner selected staged P0 closure through separate C1-C4 tranches and later selected:

> D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A

That authority permits only this isolated branch, a Task-Brief-only Draft PR, read-only current-code
investigation, and updates to this Task Brief containing the C3c material package. It does not
authorize production or test implementation, live OAuth/Token/account/provider calls, private data,
schema/public API/dependency/Worker/Service Worker/server/CSP expansion, Ready, merge, cleanup,
deployment, release, or C4 ownership/lease work.

## Global invariants

- Provider data may enter persistence only through C3a mapping, C3b artifact construction, and the
  existing ImportService. No parallel persistence or page-selected storage path is allowed.
- Legacy and V2 data are preserved. No migration shortcut, deletion, clear, overwrite, cleanup, or
  provenance reinterpretation is allowed. Disconnecting Strava and deleting local data remain
  separate actions.
- Missing and null never become zero. True zero and negative zero remain distinct wherever frozen.
  Activity and provider IDs remain opaque strings and are never numericized.
- Connect, Sync, Disconnect, startup, reload, restore, and offline transitions are explicit. Connect
  must never trigger automatic sync, and startup/reload/restore must never trigger provider I/O.
- Token, authorization header, subject, private provider values, precise location, health/power data,
  and raw provider errors must not enter DOM, logs, reports, errors, Diagnostics, Backup, URLs, Git,
  or deterministic synthetic evidence.
- Identity, granted scope, provenance, cancellation, error redaction, and bounded acquisition remain
  fail closed. No implementation option may weaken them to avoid a server or public-boundary decision.
- Public APIs, schema, algorithms, dependencies, Worker, Service Worker, server, and CSP remain
  unchanged unless A2 proves a minimum expansion unavoidable and returns it as an explicit owner
  option. Discovery is a stop, not implicit authorization.
- Only deterministic synthetic evidence is permitted in this phase. No user Chrome/profile or real
  account/provider evidence is authorized.

## A0 exact-base and untouched-gate evidence

- The isolated worktree began clean and detached at exact commit
  `43455a6c9f513cca57d661a1aef179bb588897ae`, tree
  `14f60e943fea98a3d35d1c116f04493c8b523154`.
- Local `integration/v2` and `origin/integration/v2` both resolved to the exact base. `origin` is
  `https://github.com/XiChuan9/StravaStats.git`; upstream push is disabled.
- The narrow feature branch `codex/v2/provider-live-sync` was created at that exact commit. The
  dedicated integration worktree was not opened or modified.
- GitHub CLI 2.96.0 is installed, but its local credential reports invalid. No interactive login,
  Chrome, or user browser profile will be used. Normal Git push and GitHub App/connector publication
  may be attempted independently; any remaining authentication failure is returned exactly.
- A1 local gates passed on the docs-only working tree: `npm ci`; syntax for 271 files; privacy;
  full `npm test` 1782/1782; and `git diff --check`. Exact-head CI is recorded only after it runs.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

Draft PR title:

```text
feat(v2): activate bounded provider sync
```

Draft PR body:

```markdown
## What changed

Adds the C3c Task Brief for the live provider-to-existing-import activation audit and material freeze.

## Why

C1, C2, C3a, and C3b are merged, but live authentication, bounded provider requests, cancellation, SourceConnection transitions, UI, privacy, and runtime boundaries require a separate owner-approved package before implementation.

## Impact

Docs only. No provider/OAuth/Token/account/private-data call, Import or Storage mutation, schema/public API/dependency/Worker/Service Worker/server/CSP change, migration, deploy, or release.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, release, C4 work, or
real/private evidence is part of A1.

### A1 publication readback

- First commit `994d7bb79d109ba145b16ab07d80afe5a1287529` has exact parent
  `43455a6c9f513cca57d661a1aef179bb588897ae` and changes only this Task Brief.
- The branch was pushed normally. The GitHub App created open Draft PR #52 with exact base/head,
  one commit, one changed file, 188 additions, the requested title/body, Draft true, and merged
  false. No reviewer, label, assignment, Ready, merge, or other PR write was made.

## A2 findings-first audit

A2 must read the exact merged code, tests, and accepted documentation before recommending a
contract. It must establish:

1. Source Manager composition/controller/UI behavior, Demo isolation, CSP, offline/reload behavior,
   and root auth/Token lifecycle including same-origin API/server routes.
2. C2 SourceConnection schema, store/status/CAS transitions, subject and granted-scope semantics,
   Backup treatment, and the boundary with future C4 ownership/lease recovery.
3. C3a mapper authority snapshot, exact scopes, limits, ordering, cancellation, reduced provider
   inputs, opaque IDs, and missing/null/zero rules.
4. C3b artifact builder through existing ImportService/Worker/Backup provenance, including artifact,
   item/job/report, duplicate/reselection/conflict, cancellation, quota, and partial-success behavior.
5. Existing connector and same-origin route behavior for pagination, detail, streams, laps,
   rate-limit/429, timeout, retry, AbortSignal, errors, redaction, and offline boundaries without
   issuing any provider request.
6. Existing public exports, schema, dependencies, server, R9 Service Worker and R11 CSP/runtime
   boundaries, privacy guards, Diagnostics, cache behavior, and collision surfaces.
7. The historical parent Task Brief on `origin/codex/v2/source-manager-lifecycle` only as decision
   provenance; current integration code remains authoritative.

Findings must precede recommendations. The old broad C3 candidate list must not be inherited without
a current collision audit.

## Required material decision package

The A2 update must freeze complete, mutually exclusive owner options for at least:

- exact explicit Connect/Sync/Disconnect states and whether live auth belongs in C3c or a separately
  named minimum C1.1 tranche;
- OAuth/state/confidential-client posture, callback scrub ordering, subject/granted-scope binding,
  Token acceptance/removal, revoke ownership, and safe local-only fallbacks;
- exact provider routes, methods, requested fields, page/detail/stream/lap bounds, concurrency,
  rate-limit/429, timeout, retry/no-retry, AbortSignal, and partial-page semantics;
- exact mapping to artifact to existing ImportService orchestration, item/job ordering,
  duplicate/reselection/conflict/cancellation/quota/partial-success rules;
- exact SourceConnection CAS transitions and `lastSyncAt` rule derived only from public ImportReport
  outcomes, including stale revision, disconnect/cancel/offline/page-close behavior and C4 separation;
- exact UI status/action/copy, Demo zero-I/O, reload/offline, privacy/redaction/DOM/Diagnostics/Backup/
  Service Worker/cache boundaries;
- schema/public API/dependency/Worker/Service Worker/server/CSP effects, migration/data/rollback
  impact, real/private evidence gates; and
- a collision-audited literal candidate allowlist with an exact hard maximum and no substitutions.

If safe live activation unavoidably requires server/auth/public/API expansion, A2 must present that as
an explicit owner option and stop. No package may trade away identity, scope, provenance,
cancellation, or redaction.

## A2 write and publication boundary

Until a new owner decision, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

A2 may publish only a second Task-Brief-only commit on the same Draft PR. It must run the repository
minimum gates, audit exact path scope, read back remote depth one and exact-head CI, and keep the PR
open and Draft. It must return the complete A/B/C decision package to the control tower. No
implementation follows automatically.

## A2 current-tree findings

These findings describe the exact A1 head and do not authorize implementation. Current integration
code is authoritative. The historical PR-40 Task Brief was read only from
`origin/codex/v2/source-manager-lifecycle` as decision provenance.

### F1 — the C1 controller remains intentionally inert and callback-safe only by discarding data

- `js/source-manager.js` calls `sanitizeSourceManagerNavigation()` before diagnostics,
  sessionStorage, page lifecycle, Worker, IndexedDB, Crypto, or application composition. A scrub
  failure blocks before all those capabilities.
- `js/app/source-manager-connection.js` accepts only the exact Source Manager route and canonical
  mode query. OAuth-shaped query/hash material is synchronously scrubbed once, but the code, state,
  scope, and error values are deliberately discarded. The controller exposes only
  `getConnectionSnapshot`, `beginConnect`, `disconnect`, and `close`; its sole snapshot is
  `authorization_unavailable`, and both actions fail before I/O.
- The page accepts only that exact snapshot, renders one disabled `Connect unavailable` button, and
  never binds Connect, Sync, Disconnect, Token, Storage, or provider behavior. Demo constructs no
  Real controller, store, Worker, Token reader, or network boundary.
- Therefore live callback activation is not a local switch. It requires a separately approved
  callback capsule/state/Token/server contract and deliberate changes to the C1 boundary tests.

### F2 — C2 is sufficient for CAS state, but it contains no scope or sync ownership authority

- V5 has one fixed `source-connection:strava` row with immutable provider/subject identity,
  statuses `connected`, `reconnect_required`, `error`, and `disconnected`, nullable historical
  `lastSyncAt`, fixed error pairing, and an integer revision.
- Creation accepts only connected/revision-1/null-last-sync. Every transition is a one-store CAS.
  Non-connected transitions preserve `lastSyncAt`; connected-to-connected requires a strictly newer
  non-null time. There is no delete, `syncing` state, scope, Token, owner, heartbeat, or lease.
- C3c can use the existing store and public factory unchanged. `syncing`/`cancelling` must be
  ephemeral controller states. C4 retains durable ownership/lease/recovery authority.
- A second tab can perform a concurrent foreground sync before C4. C3c may serialize only within
  one controller. Existing Import identity/idempotency prevents a second Canonical activity, and
  final C2 CAS makes a stale completion lose, but C3c must not claim a durable cross-tab lease.

### F3 — the current root auth lifecycle cannot be imported or inherited

- `js/app/auth.js` reads root-page globals/UI, requests the broader
  `read,activity:read_all,profile:read_all` scope, creates no OAuth state, accepts any callback code,
  ignores returned state/error/scope, and scrubs the URL only after successful exchange/acceptance.
- `api/strava-auth.js` owns the client secret correctly, but accepts an unbounded code and returns
  the raw provider exchange object. `js/app/auth-lifecycle.js` then stores only access token,
  refresh token, and expiry; granted scopes and the subject binding are lost.
- Root identity protection is Legacy-specific. It cannot bind a Token to the C2 V5 identity. A
  Token or `ActivitySource` alone is never identity or scope authority.
- Root disconnect calls the legacy direct provider deauthorization endpoint from the browser. The
  Source Manager CSP permits only same-origin connections, and the official 2026 server-authenticated
  revoke endpoint requires the client secret. Direct browser revoke is rejected for C3c.

### F4 — official provider documentation resolves the live protocol, with one explicit stop

- The official authentication guide documents web authorization-code redirect, optional echoed
  `state`, one-use short-lived code, athlete-selectable granted scopes returned by callback/exchange,
  server-side client-secret exchange, and refresh-token rotation.
- From 1 June 2026 the official guide recommends server-authenticated
  `POST https://www.strava.com/oauth/revoke`; it becomes the only supported deauthorization endpoint
  on 1 June 2027. Revoking a refresh token also revokes associated access tokens.
- The official guide does not define PKCE parameters for this flow. The frozen option below uses
  confidential-client authorization code plus mandatory state and makes no PKCE claim. If security
  review requires provider-supported PKCE, implementation stops rather than inventing parameters.
- The official reference still documents `GET /athlete/activities` with `page`/`per_page`,
  `GET /activities/{id}`, and `GET /activities/{id}/streams`; activity detail contains laps, so no
  separate laps request is required. The announced API base-URL change is not available until
  4 January 2027, so this package does not pre-empt it.
- Default read-rate limits are shared application limits, not a per-sync allowance. A bounded
  foreground package must stop on 429, never auto-retry, and must not promise that a fixed request
  count guarantees provider capacity.

### F5 — the Legacy connector/server routes fit V1, not bounded C3c

- `StravaApiConnector` has safe fixed errors and same-origin routes, but no AbortSignal, timeout,
  page/window input, SourceConnection/scope binding, or reduced-response budget. It accepts numeric
  IDs and base64-encodes the whole stored Token record into an Authorization header.
- `api/strava-activities.js` performs an unbounded server-side loop with `per_page=100` until an
  empty page. It loses 401/403/429 distinctions, has no timeout/cancellation/shape/byte cap, and can
  exceed C3a's 100-activity ceiling before the browser can intervene.
- Existing detail/stream routes put IDs/types in browser query strings, accept broad responses, and
  have no timeout or response limits. Reinterpreting those routes would risk the preserved V1 path.
- C3c therefore needs one new fixed same-origin bounded sync route and one dedicated injected reader;
  it must not silently change the existing V1 activities/detail/stream behavior.

### F6 — C3a and C3b already provide the exact non-persistence seams

- C3a factory authority is exact session `{ provider, subjectId, grantedScopes }` plus the exact C2
  connection. The only accepted ordered scope array is `['read', 'activity:read_all']`; authorization
  and subject equality are checked before provider records.
- C3a maps an ordered all-or-nothing array of exact `{ summary, detail, streams }` values. Its
  ceilings are 100 activities, two later-orchestrator activity operations, 200,000 points per
  series, and 10,000 laps. Its cancellation value is a pre-call boolean snapshot, not an
  AbortSignal or mid-map interrupt.
- C3a descriptor-safely clones its supplied provider item before dropping private/unknown fields.
  The live reader must therefore reduce server responses before C3a; C3a is not a raw-response
  privacy filter.
- C3b directly and internally builds one canonical provider artifact per bundle, 1..100, with
  32 MiB per artifact and per job. The existing Worker already decodes the media type, and the
  existing ImportService owns hashing, raw provenance, normalization, duplicate/exact-identity,
  fuzzy review, cancellation, quota, persistence, and redacted reports.
- No C3a, C3b, ImportService, Import public export, Import store, Worker, Repository, schema,
  migration, Backup, Service Worker, or dependency change is required for live orchestration.

### F7 — ImportReport, not job status alone, controls `lastSyncAt`

- The public report contains only status, aggregate totals, and ordered safe item outcomes/codes.
  `completed_with_warnings` may mean bundle warnings or isolated item failure, so status alone is
  insufficient.
- Accepted sync outcomes are exactly `completed`, `review_required`, and
  `skipped_exact_duplicate`. Advance only after `waitForJob` returns total at least one,
  failed/cancelled zero, every item accepted, and accepted count equal to total. Both completed job
  statuses are allowed when that predicate holds.
- Empty provider selection creates no C3b job and leaves `lastSyncAt` unchanged. Any mapping/artifact
  preflight failure, quota partial, cancellation, exact-identity conflict, decode/storage failure,
  or nonterminal report item also leaves it unchanged.
- One strict millisecond UTC `acquiredAt` is captured after bounded acquisition and before mapping;
  every C3a source and the successful final connected-to-connected CAS use that same value. If it is
  not strictly later than current `lastSyncAt`, no time is synthesized and the import remains
  committed with a safe `LAST_SYNC_NOT_ADVANCED` result.
- Final CAS uses the original connected snapshot revision. Stale revision, concurrent Disconnect,
  reconnect/error transition, close, or pagehide wins. There is no reread/retry and no revival of
  `connected`; already imported data remains.

### F8 — cancellation, partial enrichment, and partial persistence are distinct

- Provider acquisition is atomic at the selected-page level: no mapper/artifact/import call begins
  until the bounded page and every optional enrichment attempt reach a deterministic result.
  Authentication, scope, 429, cancellation, or required summary failure discards the acquisition.
- Detail/laps and streams are optional capabilities. A non-auth 404, timeout, network/5xx, malformed,
  or over-limit optional response becomes `detail: null` or `streams: null` with existing C3a
  warnings. It is not a silently omitted activity. A malformed required summary/list is fatal.
- Abort stops new requests and ignores late results; a server request already received may continue
  only until its own shorter upstream timeout. Mapper and artifact builder are synchronous; the
  controller checks cancellation immediately before and after each and discloses that they are not
  mid-call interruptible.
- Once ImportService owns a job, cancellation uses its existing checkpoints. In-flight digest,
  Worker, and IndexedDB transactions are not interrupted; completed/review/skipped items and stored
  raw bytes remain. Quota can preserve earlier committed items. Neither condition advances
  `lastSyncAt` unless the exact report predicate passes.

### F9 — UI, offline, diagnostics, Backup, CSP, and Service Worker boundaries

- Real startup/reload/restore reads local Token/SourceConnection metadata only and performs zero
  provider request. Connect and Sync are explicit separate clicks. Connect never starts Sync.
- Demo renders a presentation-only API card with no Connect/Sync/Disconnect and performs zero Real
  storage, Token, Worker, or network I/O. Local file/ZIP import remains usable while provider work
  is unavailable or offline.
- UI and accessibility surfaces may render only fixed state/copy, aggregate counts, safe codes, and
  `lastSyncAt`. Token, state, code, subject, scopes, provider IDs, names, routes, health/power values,
  raw responses, errors, and retry headers never enter DOM, Diagnostics, reports, logs, or URLs.
- Diagnostics receives fixed category/code/count records only. Provider POSTs and Authorization
  requests already bypass the Service Worker and remain network-only; no cache/SW change is needed.
  Same-origin browser fetches preserve the current CSP, and every auth/sync response must add
  `Cache-Control: no-store`.
- Current accepted C2 Backup format 2 intentionally retains the opaque decimal
  `SourceConnection.subjectId` while excluding Tokens/scopes and projecting credential-dependent
  states to reconnect-required. That conflicts with a literal reading of this task's “no subject in
  Backup” invariant. C3c cannot silently rewrite the merged C2 archive contract; the owner must
  resolve D-C3c.R below before live implementation.

### F10 — collision audit and evidence gaps

- The old broad C3 path list is obsolete. C3a/C3b remove every mapper, artifact, Import, Worker,
  schema, and Backup path from the new C3c candidate surface.
- Existing Source Manager tests intentionally forbid auth/network/Token behavior and accept only the
  unavailable snapshot. They must be partitioned deliberately without weakening Demo, sanitizer,
  DOM, Import-public, CSP, and SW assertions.
- A focused read-only regression run across mapper, artifact, Import/Worker identity,
  SourceConnection, boundary, and privacy suites passed 61/61. It did not exercise a live route,
  browser, OAuth, Token, account, or private fixture.
- Existing tests contain two inherited evidence gaps: one registry-wiring assertion still describes
  six decoders although the provider decoder is the seventh, and C3b asserts rather than drives the
  5,000,000-node +1 boundary. They are not C3c implementation authorization or a reason to expand
  Worker/Import scope.

## D-C3c.R — resolve restored-library identity before selecting live activation

Choose exactly one. This is independent of implementation sequencing but gates Packages A and B.

### D-C3c.R-A — reconnect only to the exact restored subject

Interpret “no subject in Backup” as prohibiting new live auth-session/provider subject material.
The already accepted C2 `SourceConnection.subjectId` remains the sole opaque non-secret archive
identity, exactly as merged; C3c adds no Token, state, code, granted scope, session snapshot, provider
payload, or account profile to Backup. After restore the row remains `reconnect_required`; an explicit
Reconnect may accept a Token and transition to `connected` only when the exchanged positive-decimal
subject exactly equals the immutable restored subject. A mismatch fails with the fixed safe identity
error, writes no Token/connection change, never overwrites the subject, and leaves every restored
Legacy/V2 record intact. This preserves format-2 restore and provider-artifact provenance without a
Backup/schema change.

### D-C3c.R-B — literal zero subjects; require a separate fresh-library path

Treat the prohibition literally. C3c stops. A separately named C2.1 must design an additive fresh-
library path in which an archive with no subject cannot be rebound in place: restored Legacy/V2 data
remains untouched and separately addressable, and a newly connected account writes only to a new
library identity. C2.1 must independently freeze format-2 compatibility, provider-artifact
validation, library selection/isolation, schema/migration, UI, rollback, and an exact allowlist. No
path or behavior for that tranche is inferred here, and no existing library is deleted, cleared,
overwritten, or assigned the new subject.

There is no silent exception. Package A or B requires explicit `D-C3c.R-A`; selecting
`D-C3c.R-B` has the same immediate product outcome as Package C until C2.1 is separately approved
and closed.

## D-C3c — mutually exclusive activation packages

Choose exactly one package and, for A or B, one D-C3c.R value. The behavioral contract below is
frozen only as a candidate; selection still requires a separate implementation authorization for
the exact named hard maximum.

### Package A — separate C1.1 auth/server activation, then narrow C3c sync

This is the minimum architecture-preserving split. C1.1 lands and is independently reviewed before
C3c begins. Neither tranche authorizes a real account/provider request.

#### A1 — exact Connect/authorization/disconnect contract owned by C1.1

- Exact durable rows remain C2. Exact composite/controller states are `unconfigured`,
  `authorizing`, `callback_processing`, `connected`, `reconnect_required`, `error`,
  `disconnecting`, `disconnected`, and `closed`. C3c later adds only ephemeral `syncing` and
  `cancelling`; neither becomes a V5 value.
- Actions are exact: unconfigured/disconnected/reconnect-required offers Connect/Reconnect;
  connected offers Sync and Disconnect; error offers explicit Sync again only with an exact local
  authority plus Disconnect; authorizing/callback/disconnecting/closed offer no competing action;
  syncing offers only Cancel Sync and disables Disconnect until terminal cancellation.
- Connect is a same-tab full-page redirect, Real mode only, after explicit consent copy. It requests
  exactly ordered scopes `read,activity:read_all`; no `profile:read_all`, popup, iframe, silent auth,
  startup auth, reload auth, or automatic Sync.
- Create 32 injected-Crypto random bytes, base64url encode them, and write one exact single-use
  sessionStorage state record with a ten-minute TTL and exact Real return path. Storage/Crypto
  failure blocks before config/network/navigation.
- Callback accepts exactly one nonblank code, one exact state, and the exact granted-scope set, or
  one `error=access_denied` outcome. Duplicate/blank/unknown/cross-mode/replayed/expired callbacks
  fail closed. Query/hash are synchronously scrubbed to the exact mode-only path before diagnostics,
  state storage access, DOM, exchange, or other network work. State is then consumed/deleted before
  exchange. A scrub failure discards the in-memory capsule and blocks.
- Browser config is existing same-origin GET `/api/config`; exchange is POST `/api/strava-auth`.
  Both use `credentials:'same-origin'`, `cache:'no-store'`, `redirect:'error'`,
  `referrerPolicy:'no-referrer'`, a 15-second AbortSignal, and fixed/no-store responses. Exchange
  alone uses exact JSON content type.
- Server validates bounded exact request/response data, keeps the client secret server-only, and
  returns only access token, refresh token, expiry, normalized positive-decimal subject, and exact
  granted scopes. No raw athlete/profile object or provider error crosses the route.
- The one local Token record remains `strava_tokens` and becomes exact five-field authority:
  access token, refresh token, expiry, `subject_id`, and ordered `granted_scopes`. A legacy three-field
  Token remains usable by V1 but is insufficient for C3c and displays Reconnect required.
- Before Token acceptance, compare subject against the immutable C2 slot and the existing Legacy
  identity guard. Missing/unconfirmed/mismatched identity stores nothing. Token write precedes
  create/CAS; a later C2 failure removes the just-written Token best-effort and never treats Token
  presence as authority. Root refresh compatibility must preserve subject/scopes or C3c fails closed.
- Disconnect first prevents/awaits active sync, then POSTs the refresh token to new same-origin
  `/api/strava-revoke`; the server uses current provider Basic client authentication and a 12-second
  upstream timeout. There is no retry. Local Token removal is attempted whether revoke is confirmed
  or not. Successful removal CASes to disconnected, preserving `lastSyncAt` and recording null or
  `REVOCATION_UNCONFIRMED`. Stale CAS is not retried; local data is never removed. Token-removal
  failure returns a fixed error and does not claim disconnection.
- No PKCE claim is made. A security review requiring PKCE blocks C1.1. CSP stays same-origin-only;
  no Service Worker, schema, Backup, dependency, Worker, Import, Repository, or root V1 behavior is
  reinterpreted.

#### A2 — exact bounded provider acquisition owned by C3c

- One dedicated injected reader uses only fixed same-origin
  `POST /api/strava-sync`. Browser bodies are exact mutually exclusive operations: list; detail
  with opaque positive-decimal string activity ID; or streams with that ID and the exact ordered
  stream array. IDs never enter the browser URL.
- List performs exactly one provider `GET /athlete/activities?page=1&per_page=25`. There is no
  second page, cursor, background polling, webhook, startup fetch, or “fetch all” claim. The UI says
  “latest 25 activities”. Empty result is a successful no-op with no Import job and no `lastSyncAt`
  advance.
- For each returned summary, at most two activity workers run concurrently. Each worker requests
  detail then streams sequentially, so no more than two provider requests are in flight. Detail is
  `GET /activities/{id}?include_all_efforts=false`; laps are taken only from detail and capped at
  10,000. There is no separate lap route.
- Streams request exactly `time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth`,
  `key_by_type=true`, with 200,000 points per series. Server reduction returns only the C3a
  summary/detail/lap/stream field allowlist and converts accepted provider IDs to opaque strings;
  names, athlete/profile, map/polyline, gear/device, segment efforts, and unknown fields do not
  cross into the browser.
- Provider list/detail bodies are at most 2 MiB each, stream body at most 16 MiB, and total reduced
  foreground acquisition at most 32 MiB. A response over its bound is never mapped/imported.
- Browser timeout is 15 seconds per same-origin operation and server upstream timeout is 12 seconds.
  There is no automatic retry for any status. Any 401/403 is fatal and CASes the exact current row
  to reconnect-required while preserving history. Any 429 is fatal, stops scheduling, preserves
  connected/history, and shows fixed try-later copy; Retry-After is neither persisted nor rendered.
  List network/timeout/5xx/malformed/over-limit is fatal. Optional detail/stream non-auth failure
  becomes null plus the existing warning; no summary is omitted.
- A successful bounded page preserves provider order through C3a bundle order, C3b artifact order,
  Import item order, and public report ordinal. Duplicate IDs in one page are fatal before detail
  scheduling. No raw provider response enters C3a.

#### A3 — exact mapping, Import, cancellation, report, and CAS orchestration

1. Require one exact local Token authority and one exact C2 snapshot. If the durable status is
   error, an explicit Sync first CASes error to connected while preserving `lastSyncAt`; a stale
   revision stops before provider I/O. Reconnect-required/disconnected cannot Sync.
2. Run the bounded acquisition above. Abort before every request and stop future scheduling on
   fatal/cancel/close. Capture one strict millisecond UTC `acquiredAt` only after acquisition.
3. Construct one C3a mapper with the exact session and the same C2 connected snapshot. Call its
   all-or-nothing `mapActivities` with the cancellation snapshot.
4. Call C3b `createStravaProviderArtifacts` with the same connection and ordered bundles. Check
   cancellation immediately before and after this synchronous bounded stage.
5. Submit the exact descriptor array once to existing `ImportService.importArtifacts`; record its
   job ID only inside the controller and use existing cancel/wait/report APIs. No page, connector,
   mapper, or controller writes storage directly.
6. Apply the F7 report predicate. On success CAS connected-to-connected with original revision and
   the shared `acquiredAt`. On all other outcomes retain the public report and leave history
   unchanged. Stale/post-import write failure never rolls back or hides imported data.

Exact duplicate bytes become skipped; different bytes with the same exact Strava identity link new
raw provenance without replacing Canonical data; disagreeing exact targets fail one item atomically;
fuzzy candidates remain `review_required`. Reselection is a new explicit Sync. There is no hidden
resume, retry, deletion, or C4 lease.

Cancel during acquisition imports nothing. Cancel during Import uses the current latch/checkpoints
and keeps completed work. Pagehide/close aborts the reader, requests active-job cancellation, waits
for controller/import close, performs no SourceConnection success CAS, and makes no provider revoke.
Offline/list failure preserves local reads and current connection history. Disconnect is disabled
until cancellation reaches a terminal state.

#### A4 — exact UI/copy and privacy boundary

- Status labels are `Not connected`, `Authorization in progress`, `Connected locally`, `Syncing`,
  `Cancelling`, `Reconnect required`, `Connection error`, `Disconnecting`, and `Disconnected`.
  “Connected locally” copy says authorization is stored locally, is not automatically checked, and
  Sync imports at most the latest 25 only when pressed.
- Exact actions are `Connect Strava`, `Reconnect Strava`, `Sync latest 25`, `Cancel sync`, and
  `Disconnect Strava`. Confirmation says Disconnect also affects the origin-shared Legacy
  credential, does not delete any local activity/log/source/backup/settings data, and provider
  revocation may be unconfirmed offline.
- Success/failure copy exposes aggregate counts and fixed codes only: success records last sync;
  all-duplicate success says no second activities were created; partial/quota/cancel says completed
  items were kept and last sync was not advanced; stale CAS says local import completed but another
  connection change won.
- Demo shows `Demo — no provider connection` with no live action. Reload/restore never auto-connects
  or auto-syncs. Browser-reported offline state is advisory only; attempts still fail through the
  fixed network boundary.
- DOM uses text nodes/textContent and fixed copy only. Diagnostics uses fixed page/category/code/count
  values. Backup receives no new auth/session material. Service Worker/cache, CSP, public exports,
  schema, algorithms, dependencies, Worker protocol/registry, and server routing config stay frozen.

#### Package A literal candidate allowlists

**C1.1 hard maximum — exactly 23 paths**

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
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/repository/strava-api-connector.test.js
tests/privacy/server-api-logging.test.js
tests/privacy/privacy-guard.test.js
docs/guides/privacy-guide.md
```

`api/config.js`, local-dev server routing, CSP text, V2 schema/Storage implementation, Backup,
Import, Worker, Service Worker, dependencies, lockfile, root `index.html`, and root main are unchanged.
If any listed path is unnecessary it remains unused; it may not be replaced.

**C3c hard maximum after C1.1 — exactly 19 paths**

```text
docs/tasks/pr-43c-provider-live-sync.md
source-manager.html
styles/source-manager.css
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-provider-sync.js
js/pages/source-manager/source-manager.js
js/connectors/strava/strava-sync-connector.js
api/strava-sync.js
tests/source-manager/source-manager-provider-sync.test.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/connectors/strava-sync-connector.test.js
tests/privacy/server-api-logging.test.js
tests/privacy/privacy-guard.test.js
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
```

No twentieth path is authorized. In particular, C3a, C3b, ImportService, Import store/public index,
Worker/client/protocol, SourceConnection store/schema/migration/public index, Backup, Repository,
legacy connector/routes, Service Worker, CSP, dependencies, lockfile, and C4 paths are excluded.

#### Package A failure-first, evidence, migration, privacy, and rollback

- C1.1 tests: entropy/TTL/single-use state; scrub-before-storage/network/DOM; duplicate/denied/
  reduced-scope/replayed/expired callbacks; exact subject/scope authority; Legacy/C2 mismatch; Token
  write/remove and C2 compensation failure; refresh metadata preservation; revoke timeout/401/429/
  5xx/malformed response; local removal after unconfirmed revoke; two tabs; Demo/invalid mode; fixed
  no-store/log/DOM/Diagnostics behavior.
- C3c tests: exact one-page/25/51-request ceiling; concurrency two; route/method/body/field/byte/lap/
  stream limits; 401/403/404/429/5xx/timeout/malformed; no retry; optional degradation; cancellation at
  every acquisition/mapping/artifact/import seam; duplicate/reselection/conflict/review; quota partial;
  report predicate; monotonic/stale CAS; Disconnect/cancel/pagehide/offline; no auto work; Demo zero I/O;
  SW bypass and CSP unchanged.
- Disposable served-browser evidence uses only deterministic injected auth/server/provider seams and
  invented data, including reload/offline/two-tab/blocked storage. No user profile, real request,
  account, Token, private fixture, GPS/health/power data, or actual-provider claim.
- Real OAuth consent, exchange/refresh/revoke, account/subject binding, provider paging/rate behavior,
  and private rollback remain separately authorized gates outside Git. Until then there is no
  Production/full-v2.0/release claim.
- No schema or data migration. Live use would add only the existing local Token shape, existing C2
  state transitions, and provider artifacts/Canonical data through ImportService. Rollback disables
  the UI/controller/routes and preserves every Legacy/V2 record. A removed/revoked Token cannot be
  restored; reconnect is explicit. Risk: C1.1 high at shared auth/server seams, C3c medium after C1.1.

### Package B — combine C1.1 and C3c in one implementation tranche

Package B freezes the same exact behavior as Package A but lands it in one PR. It has no functional
shortcut: state, subject/scope authority, server revoke, dedicated bounded sync route, reducer,
cancellation, Import-only persistence, report predicate, UI/privacy, and evidence rules are identical.

This option has a **hard maximum of exactly 29 paths**, the collision-audited union below:

```text
docs/tasks/pr-43c-provider-live-sync.md
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-authorization.js
js/app/source-manager-provider-sync.js
js/app/auth-lifecycle.js
js/connectors/strava/strava-api-connector.js
js/connectors/strava/strava-sync-connector.js
js/pages/source-manager/source-manager.js
api/_shared.js
api/strava-auth.js
api/strava-revoke.js
api/strava-sync.js
tests/source-manager/source-manager-authorization.test.js
tests/source-manager/source-manager-provider-sync.test.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/repository/strava-api-connector.test.js
tests/connectors/strava-sync-connector.test.js
tests/privacy/server-api-logging.test.js
tests/privacy/privacy-guard.test.js
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
```

No thirtieth path or silent substitution is allowed. Migration/data/rollback effects match Package
A. Architecture and review risk are **high** because callback security, shared Token refresh,
confidential server routes, provider acquisition, SourceConnection CAS, Import orchestration, UI,
and privacy evidence collide on one head. Package B is not recommended.

### Package C — keep live provider activation unavailable

Retain the merged C1 fail-closed card/controller exactly. C3a/C3b remain deterministic internal
capabilities with no live caller. Source Manager continues local files/ZIP, Demo isolation, local
preview/reports/review, and zero provider/OAuth I/O.

The cumulative implementation allowlist is exactly this Task Brief; there is no product/test change,
migration, Token, data, rollback, server, CSP, public, Worker, Service Worker, dependency, or real/
private evidence effect. Package C is also the required immediate outcome when D-C3c.R-B is selected
or when confidential-client-with-state/no-PKCE fails security review.

## Owner response required

Return exactly:

1. one restored-library identity decision: `D-C3c.R-A` or `D-C3c.R-B`; and
2. one activation package: `D-C3c A`, `D-C3c B`, or `D-C3c C`.

Because the current instruction literally prohibits subject values in Backup, the safe unresolved
default is:

```text
D-C3c.R-B + D-C3c C
```

If the owner explicitly confirms the already merged C2 subject as the sole exception, the minimum
staged activation direction is `D-C3c.R-A + D-C3c A`.

That selection approves only the material direction. C1.1 implementation and its exact 23-path
maximum still require a separate explicit authorization; after C1.1 independently closes, C3c and
its exact 19-path maximum require another explicit authorization. There is no automatic
implementation, Ready, merge, cleanup, deployment, release, C4 work, real provider request, or
private evidence from this A2 freeze.

## A2 local publication evidence

- The A2 working diff contains only this Task Brief. `git diff --check` passes.
- The literal allowlist audit reports C1.1 23 paths, narrow C3c 19 paths, union/combined 29 paths,
  with no duplicate, missing, extra, or substituted path.
- `npm ci` completed; `npm run check:syntax` passed for 271 files; `npm run check:privacy` passed;
  and the full `npm test` passed 1782/1782.
- No live OAuth, Token, account, provider, private fixture, user browser/profile, migration, server,
  Storage, Import, Worker, Service Worker, or application implementation action was performed.
- Remote depth-one and exact-head CI evidence are publication-time readbacks and must be reported
  from the pushed A2 commit; they are not inferred from these local results.
