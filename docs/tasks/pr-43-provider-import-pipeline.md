# PR-43: Provider to ImportedActivityBundle to ImportService Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C3 provider ingestion decision |
| Status | A2 decision package complete; C3 implementation prohibited pending owner selection and tranche A3 |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@92a735fb4d4809173c5fddf868416bf44642faed` |
| Exact base tree | `568cf2457f418130ec0a6641478eb45a60e676c1` |
| Feature branch | `codex/v2/provider-import-pipeline` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr43/StravaStats` |
| Completed prerequisites | C1 / PR #47 and C2 / PR #48 merged |
| Parent decision | PR-40 / D-A A2 / D-B C, staged C1-C4 |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce a findings-first, materially complete owner decision package for C3: the bounded path from an
authorized provider read through deterministic normalization into `ImportedActivityBundle` and the
existing `ImportService`. The package must freeze identity binding, provenance, pagination, retry,
cancellation, quota, deduplication, recovery, privacy, browser evidence, and rollback before any C3
production or test implementation begins.

This first commit creates only this Task Brief. A2 is read-only except for a later update to this same
file. No provider call, OAuth/account use, Token access, private evidence, schema/public API change, or
C3 implementation is authorized.

## Authority and current limit

The authoritative post-C2 handoff permits only C3 planning from the exact merged baseline:

> Proceed only to C3 planning from this exact baseline: create separate Task-Brief-first Draft
> PR/worktree for provider → ImportedActivityBundle → ImportService; A0/A1 then A2 read-only except
> Task Brief.

Authorized now:

- create this isolated branch/worktree from the exact integration head;
- publish a Task-Brief-only first commit and open Draft PR targeting `integration/v2`;
- inspect current code, tests, accepted contracts, PRD/release gates, and call graphs read-only; and
- update only this Task Brief with findings, mutually exclusive owner decisions, literal candidate
  allowlists, failure-first tests, browser/private-evidence boundaries, migration/privacy/rollback
  impact, and collision risks.

Not authorized:

- any production or test implementation outside this Task Brief;
- live Connect, OAuth configuration/callback/exchange/revoke, Token/status reads or writes, real
  account/provider activity, private fixtures/evidence, or user browser/profile access;
- schema/V6, public Storage/Repository/Import API, dependency, Worker, Service Worker, server API,
  deployment, release, Ready, merge, or cleanup changes; or
- C4 ownership, heartbeat, lease, crash recovery, multi-tab takeover, or durable scheduling.

## Global invariants

- Preserve every Legacy and V2/V5 record. C3 must not delete, clear, overwrite, downgrade, or repair
  an existing library as an ingestion shortcut.
- Provider authorization, connection identity, imported provenance, local activity ownership,
  disconnect, and delete-local-data remain separate contracts.
- C3 must consume C1/C2 boundaries rather than infer authorization from Token presence or construct
  source identity from `ActivitySource` rows.
- Provider bytes must cross a narrow, validated, redacted boundary before normalization. No Token,
  authorization header, provider response/error body, precise private payload, or raw route may enter
  logs, DOM, diagnostics, fixtures, Git, CI, or public errors.
- `ImportedActivityBundle` remains the only accepted Canonical write envelope. ImportService owns
  durable job/item outcomes, cancellation, retry, quota handling, dedup/linking, and provenance unless
  an owner decision explicitly freezes a narrower internal seam.
- Demo, Legacy, Shadow, local file/ZIP imports, provider ingestion, Backup, and future C4 ownership
  remain isolated.

## Required A2 audit

Read exact current code, tests, and durable docs for:

1. Source Manager C1 controller/bootstrap/mode isolation and C2 `SourceConnection` public state.
2. Root auth, `Token`, provider connector, refresh/retry/error/pagination behavior, scopes, same-origin
   server boundaries, subject/account binding, and disconnect semantics.
3. Provider activity/stream/lap/event/device payload handling, normalization, validation, redaction,
   opaque identity, capability degradation, and `ImportedActivityBundle` construction.
4. ImportService/ImportStore/Worker contracts: job/item states, retry, cancellation, quotas,
   atomicity, raw artifacts, exact-identity linking, duplicates, reports, and reload recovery.
5. Repository/Storage/Backup/Diagnostics/Service Worker/browser/network/privacy boundaries and all
   public/schema/dependency collision surfaces.
6. PRD P0, accepted ADRs, engineering plans, release gates, Alpha/full-v2.0 distinctions, and the
   remaining C4 ownership gap.

Findings must precede recommendations. Historical summaries are context, not evidence.

## Required owner decisions

The A2 package must keep material choices separable and mutually exclusive. At minimum it must freeze:

- **D-C3.1 authorization and identity binding:** whether C3 uses a deterministic synthetic seam only,
  an existing Token-backed connector, or a new authorized controller/server boundary; required scopes,
  account/subject equality, reconnect/error handling, disconnect interaction, and what needs real
  private evidence.
- **D-C3.2 provider read and normalization boundary:** pagination/windowing, activity/detail/stream
  acquisition, raw-versus-reduced payload retention, deterministic `ImportedActivityBundle` mapping,
  capability degradation, unknown/future fields, redaction, and provider error mapping.
- **D-C3.3 ImportService integration:** whether provider pages enter the existing file-style job seam,
  a new internal bundle-input seam, or a separately gated public API; job/item provenance, cancellation,
  retry/resume, quota, atomicity, dedup/linking, reporting, and reload behavior.
- **D-C3.4 delivery boundary:** one combined tranche or separately approved controller, provider mapper,
  and Import integration tranches, each with a collision-audited literal path hard maximum.

Every option must identify exact UI semantics, authorization/token/storage/network behavior, data
preservation, errors, cancellation, resume, privacy, rollback, failure-first tests, browser evidence,
architecture/collision risk, and any real-account/private evidence gate. No option may infer authority
for credentials, provider calls, schema/public API/dependency expansion, or C4 behavior.

## A1 publication contract

The first commit changes exactly:

```text
docs/tasks/pr-43-provider-import-pipeline.md
```

Draft PR title:

```text
feat(v2): define provider import pipeline contract
```

Draft PR body:

```markdown
## What changed

Adds the C3 Task Brief for the provider-to-ImportedActivityBundle-to-ImportService material decision package.

## Why

C1 and C2 are merged, but provider authorization/identity binding, deterministic normalization, ImportService ingestion, recovery, and private-evidence boundaries remain separately gated.

## Impact

Docs only. No C3 implementation, live Connect, OAuth, Token/account/provider/private data, schema/public API, dependency, Worker, Service Worker, deployment, or release change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of A1.

## A1 and A2 verification

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

After A2, push normally, verify the true remote depth-1 exact head, confirm exact-head CI, and keep the
PR OPEN/Draft. Return the complete decision package directly to control tower without implementation.

## A2 findings first

### C3-F1 — C1 and C2 are safe seams, not a live provider path

- Source Manager sanitizes OAuth-shaped navigation before any application capability and, in Real
  mode only, composes the local Import store/Worker with a C1 controller. The controller has exactly
  one snapshot: `authorization_unavailable`, with Connect and Disconnect both false.
- C2 adds one private Strava `SourceConnection` slot with immutable positive-string `subjectId`,
  revision CAS, durable `connected`/`reconnect_required`/`error`/`disconnected` states, monotonic
  `lastSyncAt`, and a retained disconnected tombstone. Source Manager does not yet construct or read
  that store.
- Absence of a connection is unconfigured. `ActivitySource.provider === "strava"`, a Token, or an
  existing Canonical activity does not prove the current account. C3 must compare an independently
  authenticated subject to the C2 subject before the first provider activity read.
- C2 permits `connected -> connected` only when `lastSyncAt` strictly advances. C3 may update it only
  after the whole bounded acquisition has reached accepted terminal Import outcomes; cancellation,
  quota, authorization failure, partial provider failure, or page close must leave it unchanged.

### C3-F2 — the current OAuth lifecycle is Legacy authority and is not C3-ready

- `js/app/auth.js` requests `read,activity:read_all,profile:read_all`, fetches `/api/config`, redirects
  to the provider, posts a nonempty callback code to `/api/strava-auth`, and stores the returned Token
  in origin-shared `localStorage` through `js/app/auth-lifecycle.js`.
- The current redirect contains no frozen request-state or PKCE contract. Callback scrubbing occurs
  only after exchange/token acceptance; C1's early sanitizer intentionally prevents Source Manager
  from consuming that callback.
- Legacy token acceptance checks a populated Legacy library against the exchange response athlete.
  It does not read the V5 SourceConnection and cannot establish ownership of a Canonical-only library.
- Legacy Disconnect attempts provider revocation, removes `strava_tokens` even when revocation is
  unconfirmed, and preserves local data. Those preservation semantics are useful, but they do not
  authorize C3 to import the module or treat Token presence as connection status.
- Therefore reuse of the current OAuth/Token channel, or replacement with a server-owned session,
  is a material C1.1/auth decision requiring separate owner approval and real account/private
  evidence. A deterministic synthetic seam can prove all downstream C3 logic without making that
  choice.

### C3-F3 — the existing connector preserves Legacy parity, not bounded ingestion

- `StravaApiConnector` is side-effect free at import but its default instance reads/writes the whole
  `strava_tokens` record in localStorage, base64-encodes that record into every same-origin Bearer
  header, and persists refreshed credentials returned by server endpoints.
- It exposes list activities, activity detail, streams, athlete, zones, and gear. It has no
  `AbortSignal`, cursor/window/page argument, scope/status method, SourceConnection input, subject
  check, or `ImportedActivityBundle` output.
- `/api/strava-activities` loops pages of 100 until an empty provider page, accumulates the entire
  library in memory, and returns one aggregate response. It cannot be cancelled from the browser,
  bounded per Import job, resumed after reload, or stopped when local quota is reached.
- `_shared.js` refreshes credentials server-side but accepts the browser-supplied token bundle and
  has no C2 subject/scope binding. Provider handlers map broad failures to fixed server errors and do
  not form an acquisition checkpoint.
- The connector's exact exports and Legacy parity tests are frozen. Extending it for C3 creates a
  deliberate collision with Repository/Legacy tests and server privacy tests; silently changing its
  existing methods would risk V1 behavior.

### C3-F4 — no provider normalizer exists

- No current module maps provider activity/detail/streams/laps/device data into the exact nine-field
  `ImportedActivityBundle`. Existing provider payloads stop at Legacy Repository shapes.
- The accepted bundle validator requires a Canonical activity and streams object plus arrays for
  laps, events, sources, devices, warnings, and version metadata. It validates references,
  capabilities, timestamps, uniqueness, JSON safety, and exact schema versions.
- `ActivitySource` can already represent `provider: "strava"`, a provider external ID,
  `acquisitionMethod: "strava-api"`, and a RawArtifact reference without schema change. It never
  authorizes branching Canonical behavior by provider.
- The mapper must be pure and descriptor-safe: normalize opaque numeric/string IDs to positive
  strings, use fixed UTC instants and units, drop unknown fields with bounded warning codes, minimize
  device data to allowed manufacturer/model, never retain serials, and set capability flags from
  actual accepted data rather than provider promises.
- Full provider payload retention is unnecessary and increases backup/privacy exposure. The narrow
  durable input should be a deterministic, reduced, versioned provider-import envelope containing
  only fields required to reproduce the bundle.

### C3-F5 — ImportService is artifact-only and provenance is literally local-file

- `createImportService` accepts nonempty artifacts from an exact media-type allowlist. It hashes
  their string content, stores a RawArtifact, dispatches decoding through the Worker, calls the
  source-neutral normalizer, and lets ImportStore validate and atomically persist the bundle.
- The Import public export list is exact. The Source Manager composition exposes
  `importArtifacts`, not a provider-bundle or provider-page API. The page is expressly prohibited
  from selecting storage/provider/auth or calling network routes.
- ImportStore accepts the same exact media types and validates every RawArtifact with
  `acquiredVia === "local-file"`. Backup validation repeats that literal. Passing provider JSON as
  synthetic JSON would therefore misstate acquisition provenance and is not an acceptable shortcut.
- A new internal provider-bundle artifact media type can reuse the existing hash, Worker,
  normalization, validation, transaction, exact-identity, duplicate-review, report, and retry path,
  but it requires explicit Import/Worker/Storage/Backup collision approval. It need not expand the
  public `js/import/index.js` surface or physical IndexedDB schema.

### C3-F6 — current job semantics are useful but do not provide acquisition recovery

- Jobs/items cover queued, validation, hashing, decoding, normalization, matching, persistence,
  analysis, terminal failure, retry, and cancellation. Per-item Canonical writes are atomic;
  committed earlier items survive a later failure/cancel/quota event.
- `retryJob` is allowed only for failed validation/decode/storage jobs with a retryable item and its
  retained RawArtifact. Completed, review-required, duplicate, and cancelled items are not retried.
  Source Manager still does not expose retry UI.
- Cancellation is cooperative between ImportService checkpoints. It has no way to abort a provider
  request that happens before artifact submission. A C3 orchestrator must abort acquisition first,
  then cancel an active Import job, while acknowledging that a request already received by the
  provider cannot be recalled.
- Reload recovery of provider pagination, leases, heartbeat, and takeover does not exist. Without a
  new durable cursor/owner schema, C3 can only support an explicit bounded foreground run and a safe
  manual restart; exact identity/hash dedup makes that restart idempotent. Durable resume remains C4.

### C3-F7 — exact identity is reusable only with deterministic external identity

- ImportStore first compares RawArtifact SHA-256, then Canonical exact identity. A matching
  `[provider, externalId]` links provenance to the existing activity; near matches become review
  candidates and are never auto-merged.
- Provider response ordering, refreshed metadata, or irrelevant unknown fields must not change the
  durable artifact bytes. The reduced envelope therefore needs a canonical field order, sorted
  streams/laps/events, exact numeric rules, and a version identifier before hashing.
- A provider external ID conflict, malformed duplicate source, or different activity for the same
  exact identity must fail closed. Disconnect must retain the activity, ActivitySource, RawArtifact,
  Import Log, duplicate decisions, and last successful sync time.

### C3-F8 — Backup is an intentional collision, not a schema migration

- Format-2/V5 backup includes RawArtifacts and validates their complete record graph. Its current
  validator accepts only `acquiredVia: "local-file"`.
- Selecting a provider-artifact path requires Backup to accept the exact new `provider-api` value and
  preserve the reduced envelope. Token, authorization header, scopes, provider response bodies, and
  live session state remain excluded. This changes validation/docs/tests but not the archive path
  list, manifest format, store/index schema, or public Backup API.
- If the owner instead selects no durable provider artifact, retry/reproducibility is lost and a new
  Import state path is required. That is a materially different package, not a smaller patch.

### C3-F9 — Source Manager and isolation tests expose the live-activation collision

- The current API card has one disabled `Connect unavailable` button. The page's connection snapshot
  validator accepts only C1's unavailable shape. App boundaries prohibit fetch, Token, provider, and
  Web Storage; Demo constructs neither Real Import nor provider state.
- A live Sync/Connect/Disconnect card therefore requires explicit C1.1 UI/controller authority and
  changes across HTML, bootstrap, composition root, controller, page, SourceConnection composition,
  and browser tests. C3 downstream mapping alone must leave the card unchanged.
- Legacy, Shadow, Canonical, Demo, local file/ZIP imports, Backup, Diagnostics, Repository consumers,
  and Service Worker routing remain separate. No option may make Demo or a page module construct a
  connector, and no provider/private route may be cached.

### C3-F10 — privacy evidence has a hard synthetic/private split

- Deterministic synthetic evidence can completely prove pure mapping, invalid/hostile payload
  rejection, canonical serialization, Import state transitions, cancellation injection, quota,
  exact dedup/linking, reports, backup round-trip, SourceConnection CAS, DOM redaction, offline
  behavior, and zero unexpected external requests.
- It cannot prove requested scope sufficiency, provider payload drift, token refresh/revoke,
  account/subject equality, rate-limit headers, real browser callback behavior, hosting logs, or the
  absence of provider-side side effects. Those require separately authorized credentials, a private
  evidence plan, an isolated non-user browser/profile, and a no-retention report.
- No private activity fixture, Token, subject, response, screenshot, trace, backup, or error body may
  enter Git, CI, public PR text, diagnostics, console, DOM, or ordinary test output.

### C3-F11 — release claims remain blocked after a synthetic C3

- PRD P0 requires the optional Strava Connector, Source Manager state/actions, provider data entering
  the unified Import pipeline, disconnect preservation, and all P0 source imports. Current release
  gates also require Source Manager/Import Report and zero unresolved P0/P1 defects.
- A synthetic C3 mapper/import seam reduces architecture risk but does not make Connect available,
  prove a real provider import, provide durable C4 recovery, or justify Alpha/full-v2.0/release
  readiness. Those claims remain prohibited until their own gates pass.

### C3-F12 — collision audit against open work

- Draft PR #31 and Draft PR #46 change only their own Task Briefs. Draft PR #49 currently changes
  only this Task Brief. They do not overlap any C3 candidate production/test path.
- The main historical collision surfaces are exact export assertions in Import, Storage,
  Repository, and Shadow tests; Source Manager no-provider assertions; RawArtifact and Backup exact
  validators; server logging/privacy tests; and the frozen Legacy connector parity suite.
- Every candidate list below is a literal cumulative hard maximum for its option. Discovery of an
  omitted necessary path pauses that tranche for a minimum collision decision; no list grants
  implementation authority by itself.

## Material owner decisions

The four decisions are separable. Selecting a downstream package does not silently select live auth
or grant provider/private evidence. The recommended staged contract is **D-C3.1 A + D-C3.2 B +
D-C3.3 A + D-C3.4 A**.

### D-C3.1 — authorization and identity authority

#### A — deterministic injected authority only (recommended now)

- Keep production C1 `authorization_unavailable`; no Connect/Disconnect/Sync UI becomes operable.
- Tests inject a frozen synthetic session `{provider, subjectId, grantedScopes}` and a synthetic
  reader. The orchestrator requires exact subject equality with an existing connected C2 record
  before reading one item. Token presence is never consulted.
- This can authorize C3 mapper/import implementation with synthetic data. It does not close the
  live Connector P0, change Token storage, or require private evidence.
- Error semantics: missing connection/session, non-connected state, invalid scope shape, or subject
  mismatch performs zero provider/import writes and returns a fixed safe code. No connection state is
  fabricated or repaired.
- Architecture/collision risk: **low**; product-completion risk: **high if treated as final**.

Literal candidate hard maximum — 6 paths:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
js/connectors/strava/strava-import-mapper.js
tests/connectors/strava-import-mapper.test.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/privacy/privacy-guard.test.js
```

#### B — harden and reuse the browser-held Legacy Token channel

- Before C3, freeze a C1.1 request-state/PKCE callback contract, exact scope set, Token lifecycle,
  early callback handoff, C2 subject comparison from authenticated athlete identity, refresh/error
  behavior, and disconnect/revoke readback. The C3 connector receives credentials only through an
  injected controller; Source Manager/page code never reads localStorage.
- Existing `strava_tokens` remains an origin-shared secret and the encoded full token bundle still
  crosses the browser/server boundary unless separately redesigned. This preserves Legacy
  compatibility but carries the largest browser credential exposure.
- Required real evidence: one expressly authorized test account, scope readback, same-account and
  mismatch cases, refresh, 401/403/429, revoke/unconfirmed revoke, callback/log redaction. No real
  activity is committed or retained without separate approval.
- The proposed C3 scope string is exactly `read,activity:read_all`; the current
  `profile:read_all` is not authorized for C3. Provider documentation and private scope readback must
  confirm sufficiency before activation. PKCE is used only if the provider's verified current
  contract supports it; otherwise unpredictable single-use `state`, exact redirect matching, short
  callback lifetime, and one-time exchange remain mandatory and the PKCE absence is disclosed.
- Architecture/collision risk: **high**; migration: none; rollback removes the activation/controller
  composition while preserving C2 tombstone, Token rules, V5 data, and Legacy.

Literal candidate hard maximum — 24 paths:

```text
docs/tasks/pr-43c-browser-token-activation.md
source-manager.html
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-provider-import.js
js/app/auth.js
js/app/auth-lifecycle.js
js/pages/source-manager/source-manager.js
js/connectors/strava/strava-api-connector.js
js/storage/source-connection-store.js
api/config.js
api/strava-auth.js
api/_shared.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/repository/strava-api-connector.test.js
tests/repository/legacy-api-parity.test.js
tests/privacy/server-api-logging.test.js
docs/guides/privacy-guide.md
tests/docs/release-docs.test.js
```

#### C — new server-owned session/BFF authority

- OAuth exchange/refresh credentials live only in a server-owned, HttpOnly, Secure, SameSite session;
  browser requests carry no provider Token. Freeze CSRF, state/PKCE, session expiry/revocation,
  subject/scope readback, hosting storage, key rotation, multi-device behavior, and data residency.
- This is the strongest credential boundary but is a new server/public/deployment architecture, not
  an adaptation of current code. It may require a dependency and durable server storage; neither is
  authorized or known from the current repository.
- Required evidence includes threat review and separately approved deployment/account/private tests.
  Selecting C triggers a new A2/A3 before code; an omitted dependency/config/storage path is a stop.
- Architecture/collision risk: **very high**; rollback disables the BFF routes/session issuance and
  preserves every local/Legacy/V5 record.

Literal candidate hard maximum — 25 paths (dependency/config additions require a new collision
decision rather than entering implicitly):

```text
docs/tasks/pr-43c-server-session-activation.md
source-manager.html
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-provider-import.js
js/pages/source-manager/source-manager.js
js/storage/source-connection-store.js
api/config.js
api/strava-auth.js
api/strava-session.js
api/strava-disconnect.js
api/_shared.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/api/strava-session.test.js
tests/api/strava-auth.test.js
tests/privacy/server-api-logging.test.js
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/migrations/rollback-plan.md
README.md
tests/docs/release-docs.test.js
```

### D-C3.2 — provider acquisition and normalization

#### A — bounded summaries only

- Read at most one explicit page/100 summaries in a foreground run and map each to a summary-only
  bundle with empty streams/laps/events and truthful false capability flags.
- Lowest network/privacy/quota exposure and synthetic evidence is complete. It does not import
  provider streams/detail and therefore offers lower product fidelity; no full Connector claim.
- 401/403 blocks the run and requests reauthorization; 429/network/5xx is retryable before artifact
  submission; malformed summary/404 is an item-safe failure. Unknown fields are dropped.
- Architecture risk: **low-medium**; product risk: **medium-high**.

Literal candidate hard maximum — 7 paths:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
js/connectors/strava/strava-import-mapper.js
tests/connectors/strava-import-mapper.test.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/contracts/imported-activity-bundle.test.js
tests/privacy/privacy-guard.test.js
```

#### B — bounded summaries plus detail/streams (recommended)

- One user-triggered foreground run accepts at most one page/100 activities. Acquisition is ordered
  and uses at most two concurrent per-activity operations. It fetches detail and only the exact
  supported stream types needed by Canonical capabilities; laps come from validated detail data.
- Normalize one deterministic reduced envelope per activity. Do not retain athlete/profile, route
  URLs, raw headers, gear serials, names not required by Canonical, unknown provider fields, or full
  provider responses. Missing optional streams produce bounded warnings and truthful degradation.
- `AbortSignal` must reach every connector/server fetch. Stop scheduling immediately on cancel,
  quota, 401/403, or rate limit. A provider-received request cannot be recalled. No durable cursor is
  claimed; restart refetches the bounded window and relies on exact identity/hash idempotency. C4
  owns durable resume/lease.
- A run advances C2 `lastSyncAt` only if all selected items finish as completed,
  review-required, or exact-duplicate and there is no acquisition/import failure or cancellation.
- Architecture risk: **medium** downstream of synthetic authority; **high** when live.

Literal mapper hard maximum — 8 paths:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
js/connectors/strava/strava-import-mapper.js
tests/connectors/strava-import-mapper.test.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/contracts/imported-activity-bundle.test.js
tests/import/import-boundaries.test.js
tests/privacy/privacy-guard.test.js
```

The later live read boundary has this separate 12-path candidate maximum and still depends on the
selected D-C3.1 activation package:

```text
docs/tasks/pr-43c-provider-read.md
js/app/source-manager-provider-import.js
js/connectors/strava/strava-api-connector.js
api/_shared.js
api/strava-activities.js
api/strava-activity.js
api/strava-streams.js
tests/source-manager/source-manager-provider-import.test.js
tests/repository/strava-api-connector.test.js
tests/repository/legacy-api-parity.test.js
tests/privacy/server-api-logging.test.js
tests/source-manager/source-manager-browser-smoke.html
```

#### C — retain the current unbounded aggregate list behavior

- Fetch all pages server-side, return one aggregate list, then fetch details/streams. There is no
  browser cancellation, memory/quota bound, deterministic checkpoint, or honest reload resume.
- This conflicts with PRD foreground cancellation/performance expectations and must not be
  implemented as C3. Its literal list is recorded only to make the rejection auditable.
- Architecture/operational risk: **unacceptable**.

Rejected 8-path candidate:

```text
docs/tasks/pr-43c-unbounded-provider-read.md
js/app/source-manager-provider-import.js
js/connectors/strava/strava-api-connector.js
api/_shared.js
api/strava-activities.js
tests/source-manager/source-manager-provider-import.test.js
tests/repository/strava-api-connector.test.js
tests/privacy/server-api-logging.test.js
```

### D-C3.3 — ImportService entry contract

#### A — versioned provider-bundle artifact through the existing pipeline (recommended)

- The pure mapper emits an exact canonical JSON serialization under one new internal media type.
  The existing Worker parses it, the normalizer injects its actual RawArtifact ID, and the existing
  ImportService/ImportStore path owns all states, quota, exact identity, duplicate review, reports,
  and explicit failed-job retry.
- RawArtifact stores `acquiredVia: "provider-api"`; Backup validates and round-trips the reduced
  artifact. No Token/full response is retained. `js/import/index.js` exports stay exact and there is
  no physical schema, Repository API, dependency, or Service Worker change.
- Cancelled acquisition has no job until artifacts are submitted. Once submitted, existing job
  cancellation applies. Reload can retry only qualifying failed jobs with retained artifacts; it
  cannot resume provider pagination (C4).
- Architecture/collision risk: **medium** because Worker/Storage/Backup exact boundaries change.

Literal cumulative hard maximum — 21 paths:

```text
docs/tasks/pr-43b-provider-artifact-import.md
js/import/import-service.js
js/import/strava-api-bundle-decoder.js
js/import/synthetic-import-worker.js
js/storage/import-store.js
js/backup/backup-service.js
tests/import/import-core.test.js
tests/import/import-worker.test.js
tests/import/import-boundaries.test.js
tests/import/import-browser-smoke.html
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/exact-identity-transactions.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/shadow/shadow-boundaries.test.js
docs/guides/backup-guide.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
README.md
tests/docs/release-docs.test.js
```

#### B — new bundle-input state path

- Add a distinct `importBundles` path that validates already-normalized bundles and creates durable
  jobs/items without a decoder Worker. It must define what hashing/raw artifact/retry means and add
  legal transitions that do not falsely claim validation/hashing/decoding work.
- This avoids serializing a reduced artifact but expands the public or instance Import API, duplicates
  state-machine/storage logic, and loses reproducibility unless a new durable normalized-input record
  is added. Any new store/index is a separately prohibited schema decision.
- Architecture/collision risk: **high**; rollback must preserve any new records and disable only the
  entry path.

Literal no-schema candidate hard maximum — 18 paths:

```text
docs/tasks/pr-43b-provider-bundle-input.md
js/import/import-service.js
js/import/state-machine.js
js/import/index.js
js/storage/import-store.js
tests/import/import-core.test.js
tests/import/import-state-machine.test.js
tests/import/import-boundaries.test.js
tests/import/import-browser-smoke.html
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/exact-identity-transactions.test.js
tests/shadow/shadow-boundaries.test.js
js/app/source-manager.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
docs/guides/privacy-guide.md
README.md
tests/docs/release-docs.test.js
```

#### C — mapper writes Canonical/Import stores directly

- Rejected: it bypasses ImportService ownership, durable job/item outcomes, quota terminalization,
  cancellation, retry, RawArtifact audit, reports, and the Repository/storage layering rule.
- Architecture/data risk: **unacceptable**. No implementation allowlist is offered because this
  would contradict accepted ADR-0004 and repository instructions.

### D-C3.4 — delivery sequencing

#### A — three separately approved tranches (recommended)

1. **C3a:** select D-C3.1 A and one D-C3.2 mapper contract; pure synthetic mapper only, using the
   selected 6-8-path list.
2. **C3b:** select D-C3.3 A or B; deterministic artifact/Import/Backup integration only, using its
   own 21- or 18-path list. Production C1 remains unavailable.
3. **C3c:** after a separate C1.1 auth selection, add bounded live acquisition/UI. Use the selected
   D-C3.1 B/C list plus D-C3.2 live-read list; shared paths are counted once in the new Task Brief.

Each tranche requires a Task-Brief-first Draft, exact base, failure-first implementation approval,
independent review, fresh re-review, actual-served browser evidence proportional to its boundary,
exact-head CI, and separate Ready/merge authority. Risk: **lowest collision and rollback risk**.

#### B — combine mapper, Import integration, and live activation

- One PR would join auth/Token/server APIs, provider network, Source Manager UI, Import/Worker,
  Storage, Backup, Legacy parity, privacy, and browser evidence. The union exceeds 50 candidate paths
  before dependency/config surprises and makes rollback/auth diagnosis non-local.
- Architecture/collision risk: **very high**. For the browser-Token authority variant, the literal
  candidate hard maximum is 55 paths below. A server-session variant must use D-C3.1 C's server paths
  in place of the browser-auth paths and receive a fresh A3; neither union authorizes implementation.

```text
docs/tasks/pr-43-combined-provider-import.md
source-manager.html
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/source-manager-provider-import.js
js/app/auth.js
js/app/auth-lifecycle.js
js/pages/source-manager/source-manager.js
js/connectors/strava/strava-api-connector.js
js/connectors/strava/strava-import-mapper.js
js/import/import-service.js
js/import/strava-api-bundle-decoder.js
js/import/synthetic-import-worker.js
js/storage/import-store.js
js/storage/source-connection-store.js
js/backup/backup-service.js
api/config.js
api/strava-auth.js
api/_shared.js
api/strava-activities.js
api/strava-activity.js
api/strava-streams.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/connectors/strava-import-mapper.test.js
tests/contracts/imported-activity-bundle.test.js
tests/import/import-core.test.js
tests/import/import-worker.test.js
tests/import/import-boundaries.test.js
tests/import/import-browser-smoke.html
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/exact-identity-transactions.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/shadow/shadow-boundaries.test.js
tests/source-manager/source-manager-provider-import.test.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/repository/strava-api-connector.test.js
tests/repository/legacy-api-parity.test.js
tests/privacy/privacy-guard.test.js
tests/privacy/server-api-logging.test.js
docs/guides/backup-guide.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/migrations/rollback-plan.md
README.md
tests/docs/release-docs.test.js
tests/api/strava-auth.test.js
tests/api/strava-provider-read.test.js
```

#### C — ship only C3a+C3b synthetic seams and defer live activation

- Produces a complete deterministic provider-to-bundle-to-ImportService seam with no account or
  external request. It is safe groundwork and may be appropriate for a non-release milestone.
- It must retain `Authorization unavailable`, disclose live Connector and C4 recovery as deferrals,
  and make no Alpha/full-v2.0/release-readiness claim. Risk: **low technical, explicit P0 gap**.

For recommended D-C3.2 B plus D-C3.3 A, the literal two-tranche union is 28 paths; this union is an
audit aid, not permission to skip separate Task Briefs/approvals:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
docs/tasks/pr-43b-provider-artifact-import.md
js/connectors/strava/strava-import-mapper.js
js/import/import-service.js
js/import/strava-api-bundle-decoder.js
js/import/synthetic-import-worker.js
js/storage/import-store.js
js/backup/backup-service.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/connectors/strava-import-mapper.test.js
tests/contracts/imported-activity-bundle.test.js
tests/import/import-core.test.js
tests/import/import-worker.test.js
tests/import/import-boundaries.test.js
tests/import/import-browser-smoke.html
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/exact-identity-transactions.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
tests/shadow/shadow-boundaries.test.js
tests/privacy/privacy-guard.test.js
docs/guides/backup-guide.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
README.md
tests/docs/release-docs.test.js
```

## Frozen cross-option behavior

### UI, network, storage, and data preservation

- Until C3c approval, the API card remains disabled and unchanged. C3a/C3b add no UI action or
  provider request. A later foreground Sync shows bounded progress, Cancel, safe fixed error code,
  and terminal Import Report; Connect/Disconnect are owned by the selected C1.1 contract.
- A live card has this exact projection: absent row = `Not configured` + Connect; connected =
  `Connected` + Sync + Disconnect; foreground acquisition = `Syncing` + Cancel with Connect/Sync/
  Disconnect disabled; reconnect-required = `Reconnect required` + Reconnect + Disconnect; error =
  `Error` + Retry + Disconnect; disconnected tombstone = `Disconnected` + Connect. No state exposes
  subject, scope, Token age, activity ID, or provider text, and no card offers Delete data.
- Disconnect during a foreground run first requests acquisition abort and Import cancellation, waits
  for bounded local settlement, then performs the selected revoke/removal contract and CAS-writes the
  tombstone. Already committed items remain. Revoke failure still removes local credential authority
  and records only `REVOCATION_UNCONFIRMED`; storage/CAS failure leaves the card blocked with a fixed
  local error rather than claiming disconnection. A request already received by the provider cannot
  be recalled.
- Connection failure never blocks local startup, local imports, Backup, or Canonical reads. Offline
  disables only live provider acquisition. Disconnect retains all local/Legacy/V5 data and prevents
  future requests; delete-local-data remains a separate unavailable operation.
- Provider acquisition never writes directly to Canonical. Only a validated bundle through the
  selected ImportService seam may commit. Per-item commit remains atomic; earlier commits survive
  later failure. SourceConnection `lastSyncAt` is not a cursor and advances only after whole-run
  success as defined above.

### Failure-first tests

- Hostile Proxy/getter/prototype/cycle/symbol/sparse/duplicate/oversized/non-finite inputs before
  network or storage; exact unknown-field drop and safe warning ordering; invalid reference,
  capability, unit, time, stream/lap/event ordering, provider/external ID, subject, and scope.
- Exact reduced-envelope canonical bytes/hash; same external ID and same artifact repeat; changed
  metadata with same exact identity; hash collision; duplicate-review candidate; item isolation;
  report redaction; no auto-merge.
- Cancel before list, during list/detail/streams, between artifacts, during Worker, and persistence;
  401/403/404/429 with Retry-After, network/5xx, malformed JSON/envelope, rate-limit stop, Worker
  crash, quota at RawArtifact and Canonical transaction, close/reload/manual restart.
- SourceConnection absent/unconfigured, connected exact subject, mismatch, reconnect/error/
  disconnected, CAS race, lastSync monotonic success/no-advance failure. Demo/Legacy/Shadow/local
  import/backup isolation and exact public export tests.
- Backup provider artifact export/validate/restore/repeat/corruption with Token/scope/header/full
  payload absence. No database clear/delete/downgrade and no provider call during restore.

### Actual-served browser evidence

- C3a: dynamic import and synthetic mapper validation in a disposable same-origin profile; zero
  network/storage/DOM side effects.
- C3b: exact-head server with deterministic synthetic provider envelopes; Import progress/cancel,
  reload reports, exact duplicate/link, quota injection, backup round-trip in a second isolated
  profile, offline mode, Demo isolation, console/DOM/diagnostics/storage inspection, and zero external
  provider requests. No user browser/profile.
- C3c: first run remains synthetic against injected same-origin handlers. Real account/provider
  evidence is a later, explicit private gate and may not be substituted by public screenshots or
  copied payloads.

### Migration, privacy, rollback, and limitations

- Recommended A/B/A/A needs no V6/store/index migration and no public Import/Repository API or
  dependency. It broadens only exact media/acquisition validation and format-2 RawArtifact content;
  existing Legacy/V5 records and format-1/format-2 backups remain valid.
- Provider reduced artifacts contain activity data and inherit the backup's sensitive-data handling.
  They contain no Token, scopes, auth header, athlete profile, full provider response, device serial,
  or server/provider error text. Diagnostics and UI receive fixed codes/aggregates only.
- Rollback disables new composition/media dispatch while retaining imported activities, provenance,
  RawArtifacts, logs, SourceConnection, backups, and Legacy. Never downgrade/delete/clear V5 or
  rewrite provider imports as local files. Older code encountering a new valid provider artifact must
  fail closed; a V5-aware forward-recovery build remains available.
- C3 does not provide background sync, durable acquisition cursor, ownership/heartbeat/lease,
  takeover, cancelled-job retry, or crash continuation. Those are C4. It also does not authorize
  deployment, release, production credentials, or a real user account.

## Owner response requested

Select exactly one option in each decision, for example:

```text
D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A
```

That selection freezes contracts and tranche shape only. Every selected tranche still requires its
own Task Brief, literal cumulative allowlist approval, and explicit A3 implementation authorization.
Real OAuth/account/provider/private evidence, server/public API, schema, dependency, Worker,
deployment, Ready, merge, and release authority are never inferred from the decision shorthand.

## A2 closure and evidence readback

- A0 exact base was independently read from local and remote as
  `92a735fb4d4809173c5fddf868416bf44642faed`, tree
  `568cf2457f418130ec0a6641478eb45a60e676c1`. The locked integration worktree was not modified.
- A1 first commit is `fa5d01b2bb78edc5ed0f5098b6b2343b5732d092`; its diff is exactly this
  Task Brief. Draft PR #49 targets `integration/v2` with the exact frozen title and safe body.
- A2 inspected current Source Manager/bootstrap/controller, root auth lifecycle, provider connector
  and same-origin handlers, C2 SourceConnection, ImportedActivityBundle/ADRs, ImportService/
  ImportStore/Worker/state machine, exact identity/duplicate/report behavior, Backup/Diagnostics/
  Service Worker boundaries, PRD P0, engineering plan, release gates, and protecting tests.
- A2 changes only this Task Brief. No production/test implementation, browser/provider request,
  Token/account/private data, schema/public API/dependency/Worker/Service Worker/server change, or
  Legacy/V5 mutation occurred.
- Required docs-only gates after this decision package: `npm ci` PASS (6 packages, 0
  vulnerabilities); syntax PASS (265 files); privacy PASS; full test PASS (1742/1742); and
  `git diff --check` PASS.
- Browser evidence is intentionally **not run** in A2: there is no runtime change to validate.
  Every later implementation option has an exact synthetic browser/private-evidence boundary above.
- PR #49 must remain OPEN/Draft after push and exact-head CI. Owner selection freezes only the named
  contracts; implementation remains blocked until a separate Task Brief and explicit A3 for the
  selected tranche.
