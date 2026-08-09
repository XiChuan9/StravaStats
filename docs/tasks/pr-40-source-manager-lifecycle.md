# PR-40: Source Manager Lifecycle Decision Audit

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / release lifecycle decision |
| Status | Investigating; no implementation authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/source-manager-lifecycle` |
| Exact base | `integration/v2@b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df` |
| Exact base tree | `8692ac73a08a4725b68f40cf135be743d3018666` |
| Owner | Product owner; Codex findings-first audit |
| Dependency | PR #45 merged; integration push CI run `31312737153`, job `93242975924`, successful |
| Pull request | [Draft PR #46](https://github.com/XiChuan9/StravaStats/pull/46), open against `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Produce authoritative current-tree evidence and a minimal owner decision package for the Source
Manager connector, disconnect, and import retry/recovery lifecycle. This is an A0/A1/A2
findings-first task. No product implementation, public contract change, provider request, real
account use, or private evidence is authorized until the owner selects both the milestone scope and
one Source Manager contract package.

Conflicts resolve in this order: accepted ADRs, the product PRD, engineering plans and release
gates, this Task Brief, then implementation details. Proposed ADRs and historical conversations do
not freeze an undecided contract.

## Global invariants

- Preserve the working V1 path and every Legacy and V2 record. Disconnecting Strava and deleting
  local data remain separate actions.
- Keep Demo, Legacy, Shadow, and Canonical modes isolated. Default feature flags continue to
  preserve the accepted production behavior.
- Do not add or exercise OAuth, credentials, Tokens, provider/API calls, external network,
  migrations, schema/public API/dependency expansion, Worker or Service Worker changes.
- Use deterministic synthetic/static evidence only. Do not use a real account, private activity,
  private fixture, user browser profile, provider request, deployment, or release action.
- A2 may change only this file. Implementation begins only after the owner selects the exact D-A
  and D-B contracts and separately authorizes the resulting literal path allowlist.

## A0 exact-base and untouched-gate evidence

- The assigned worktree began detached and clean at exact commit
  `b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df`, tree
  `8692ac73a08a4725b68f40cf135be743d3018666`.
- The requested branch did not exist and the worktree was attached to the new isolated branch
  `codex/v2/source-manager-lifecycle`. The unique integration worktree was not modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`.
- Untouched baseline gates passed: `npm ci`; `npm run check:syntax` for 261 files;
  `npm run check:privacy`; full `npm test` 1711/1711; and `git diff --check`.
- Local `gh` authentication is invalid. It will not be repaired through Chrome, interactive login,
  or a user browser/profile. If the GitHub App cannot create the Draft PR, delegate only that exact
  write to the control tower.

## A1 publication boundary

The first feature-branch commit contains exactly this path:

```text
docs/tasks/pr-40-source-manager-lifecycle.md
```

It must be pushed normally and used to open a Draft PR targeting `integration/v2` with the exact
title:

```text
feat(v2): complete Source Manager lifecycle
```

No Ready, merge, cleanup, deploy, release, history rewrite, PR #31 edit, or implementation is
authorized.

### A1 readback

- First commit `08e9b79686a39bdeedffe109a8a4501ecfbb6f50` contains exactly this Task
  Brief and was pushed normally.
- The GitHub App returned `403 Resource not accessible by integration`; no user browser, login, or
  Token repair was attempted. The control tower performed only the requested Draft creation.
- Authoritative readback: PR #46 is `OPEN`, Draft, unmerged, and mergeable; its title, base, head,
  one-commit count, and one-file diff are exact. `maintainer_can_modify=false` is GitHub's
  same-repository fork-collaboration result, not a loss of repository maintainer permission.

## A2 investigation questions

Read the exact current code, tests, PRD, release gates, and accepted architecture records for:

- Source Manager page, bootstrap, modes, First-run, local file/ZIP intake, import progress, log,
  reports, preview, cancellation, reload, and missing recovery/retry controls;
- `ImportService` job/item states, `retryJob`, quota behavior, duplicate handling, cancellation,
  idempotency, resumability, and durable report boundaries;
- existing auth, connector, Token, disconnect, identity, provider/API, Repository, Storage, Backup,
  Diagnostics, browser/network/privacy, Worker, and Service Worker boundaries; and
- the exact Alpha versus full-v2.0 requirements and release evidence.

The final A2 update must present findings before recommendations, then require two separable owner
decisions:

1. **D-A milestone scope:** Alpha-now with exact disclosed deferrals and success criteria; direct
   full v2.0 implementing the PRD P0 lifecycle; or another option only if current evidence proves it
   genuinely distinct.
2. **D-B Source Manager contract:** mutually exclusive A/B/C packages covering Connector status,
   Connect, Disconnect, and import retry/recovery with exact UI, authorization, Token, storage,
   network, data-preservation, privacy, rollback, error, cancellation, and resume semantics.

For every option, derive a collision-audited literal candidate path allowlist, public/schema/
dependency/Worker/Service Worker boundaries, failure-first tests, browser evidence, migration/data
impact, rollback, and architecture/collision risk. Separate deterministic synthetic completion from
evidence that requires a real provider account or private data. Any real OAuth/credential need or
public API/schema/dependency expansion is a stop condition, not inferred authority.

## A2 output and stop condition

The A2 commit remains docs-only and changes only this Task Brief. It records evidence and owner
choices; it does not select or implement a product contract. After normal push, the exact head,
open/Draft PR state, and exact-head CI must be verified. The complete decision package is then
returned directly to the control tower for owner selection.

## A2 findings

Findings precede options. They describe the exact base above and do not authorize implementation.

### F1 — the Connector card is a static disclosure, not a lifecycle

- `source-manager.html` states that the page does not connect to a provider. Its API card is fixed
  at `not_configured`, labels the provider connection outside PR-10, and disables both `Connect
  later` and `Disconnect`.
- The page CSP permits only same-origin connections. The Source Manager composition root injects
  IndexedDB, Crypto, and a module Worker, but not `fetch`, `localStorage`, auth, Token, or a provider
  connector. Boundary tests deliberately freeze that isolation.
- `js/app/source-manager.js` constructs only a Canonical import store and Import Worker for Real
  mode. Demo constructs neither. `mode=real` and `mode=demo` are document-session modes; they do
  not select the Repository factory's Legacy, Shadow, or Canonical data mode.
- Empty Canonical storage reveals the First-run copy. Backup restore remains a separate
  `Storage & Backup` page reached by link; First-run does not inline restore or Connect. Source
  Manager diagnostics record only bounded page/category/code/count data and never a raw report or
  artifact.
- Therefore the card cannot currently distinguish unconfigured, connected, reconnect-required,
  disconnected, syncing, or provider error; it cannot establish or sever a connection; and it
  cannot claim provider reachability or a last successful sync.

### F2 — local file and ZIP ingestion works, but Source Manager omits existing retry authority

- Real mode accepts deterministic local FIT, TCX, GPX, activities CSV, and Strava ZIP artifacts,
  enforces file/job/byte limits, imports through `ImportService`, previews items, supports an active
  job cancellation request, and renders terminal persisted reports. Demo is synthetic and creates
  no real storage, Worker, provider, or Token state.
- `ImportService.retryJob(jobId)` already exists. It is explicit and idempotent, reuses persisted
  `RawArtifact` records, preserves successful items, and is legal only for jobs in
  `failed_validation`, `failed_decode`, or `failed_storage` with at least one retryable item.
  Worker crashes become retryable decode failures. Quota failure stops later batches and leaves
  completed records intact.
- The Source Manager facade intentionally does not expose `retryJob`. Its persisted-report
  projection strips job IDs, and the page renders no Retry action. The current workaround is to
  reselect the original local files; exact duplicate handling prevents duplicate Canonical writes.
- `completed_with_warnings` is terminal at job level even when an individual report item says
  `retryable=true`. `cancelled` is also terminal. Neither can use `retryJob`, and cancellation
  never rolls back completed items.

### F3 — reload recovery is a separate, currently absent contract

- Only terminal jobs are returned by `listPersistedReports()`. A browser crash or reload can leave
  a durable nonterminal ImportJob in IndexedDB that the next Source Manager session neither lists,
  resumes, cancels, nor marks failed.
- There is no durable job owner, heartbeat, lease, or update timestamp. Another tab may still own a
  nonterminal job, so treating every such job as abandoned would race an active import.
- `retryJob` is consequently not crash/reload resume. A safe recovery feature needs an explicit
  ownership/lease rule plus new state-machine and storage behavior. Silent automatic retry or
  resume is not supported by current code or accepted architecture.

### F4 — current auth and connector code is reusable evidence, not a Source Manager seam

- `js/app/auth-lifecycle.js` stores the shared origin Token under `strava_tokens`. Its disconnect
  operation attempts an injected revocation, removes the local Token even when provider revocation
  cannot be confirmed, and returns distinct safe statuses. It does not delete local activities.
- The current identity guard inspects Legacy localStorage/IndexedDB presence and athlete metadata.
  It does not bind an OAuth athlete to an existing Canonical V2 library or to a SourceConnection.
- `js/app/auth.js` is coupled to root-page DOM/navigation. Connect fetches `/api/config`, redirects
  to provider OAuth, and posts the callback code to `/api/strava-auth`. Direct deauthorization calls
  the external provider. The Source Manager CSP would block that external call. Current code also
  provides no evidenced OAuth state/PKCE contract; a security/provider review is required before
  reusing it as a new Source Manager authorization surface.
- `js/connectors/strava/strava-api-connector.js` serves the explicit Legacy Repository path and uses
  same-origin APIs. The Canonical Repository never constructs it. `api/strava-activities.js`
  accumulates provider pages server-side, but no provider response is converted to an
  `ImportedActivityBundle` or submitted to ImportService.
- A Token being present can support only a local credential-status statement. It does not prove
  provider reachability, account identity, authorization validity, sync success, or Canonical
  ingestion.

### F5 — full connection state is a schema, backup, and public-contract expansion

- The physical V2 V4 database has thirteen stores and no `sourceConnections` store. The PRD names
  that store and a SourceConnection record with provider, status, last-sync, and error fields.
- Adding it requires an additive V5 migration and coordinated schema, storage, transaction,
  backup/restore, validation, documentation, and browser evidence. Backup currently freezes an
  explicit thirteen-store mapping. Connection metadata contains no Token, but the owner must still
  decide whether it is included in backup and how restore marks a credential-less connection.
- Accepted ADR-0003 keeps provider/persistence selection out of pages and analysis. ADR-0004
  requires every source to normalize through `ImportedActivityBundle`. ADR-0006 makes
  ActivitySource provenance durable audit data: future disconnect must not delete it.
- A full provider source therefore requires a new application connector/sync boundary, not direct
  page persistence and not provider logic inside ImportService. That is a public/schema/API/Worker
  expansion and a hard stop until explicitly authorized.

### F6 — disconnect and delete have distinct data and privacy effects

- The existing auth lifecycle supports the safe invariant: remove a Token while retaining Legacy
  and V2 activities. It also distinguishes confirmed revocation from local removal with
  `revocation-unconfirmed`.
- The Token is shared by the origin's V1 and V2 surfaces. A Source Manager local disconnect would
  also remove the credential used by Legacy provider operations, so confirmation copy must say so.
- Disconnect must preserve Canonical activities, RawArtifacts, ImportJobs/Logs, ActivitySources,
  SourceConnection audit metadata, backups, settings, and Demo isolation. A future destructive
  "delete source data" action is a separate product decision and is outside all packages here.
- Diagnostics and reports may expose only bounded safe codes and counts. Tokens, authorization
  headers, raw provider payloads, private activities, precise location data, and account identifiers
  remain prohibited from logs, DOM diagnostics, committed fixtures, and CI output.

### F7 — local-first, network, Worker, and Service Worker boundaries are currently sound

- Local-first startup does not require a Token. It inspects Canonical and Legacy data and routes an
  empty library to Source Manager; failures block rather than silently choose a source. Demo stays
  isolated.
- Source Manager currently performs no provider request. Its Worker is limited to registered local
  decoders. The Service Worker caches only same-origin static assets; API requests, credentialed
  requests, query navigations, and cross-origin requests bypass its cache.
- Terminal local retry needs no dependency, schema, Worker, Service Worker, or external-network
  change. Provider Connect, revoke, sync, and provider decoding do. Service Worker behavior should
  remain frozen unless a failure-first test proves a change necessary.

### F8 — the PRD P0 and release ledgers describe different milestone claims

- PRD P0 requires local import failure/cancel/recovery/log, optional Strava API ingestion through
  the unified pipeline, disconnect without local deletion, and local startup without a Token. It
  also specifies connection states and visible SourceConnection/ImportLog behavior.
- Alpha release gates are architecture/shadow gates and do not require a completed Source Manager
  connector. They do require credible Legacy cache export/validate/restore evidence. The current
  ledger has deterministic rescue coverage but still marks real Legacy recovery evidence partial.
- Historical Beta "Source Manager usable" evidence was based on the present local-import UI; it
  does not prove the P0 connector/recovery lifecycle. Production disconnect evidence is likewise
  synthetic and partial; no authorized real-account OAuth, revoke, provider import, or private
  rollback drill has run.
- Consequently current-tree evidence supports neither a full-v2.0 claim nor an immediate Alpha
  release claim. Alpha can defer this lifecycle, but its remaining Alpha gates and release action
  still need to be satisfied and authorized independently.

### F9 — collision audit

- Draft PR #31 changes only `docs/tasks/pr-25-release-readiness-audit.md`; it does not directly
  overlap the candidate code paths below. This task must not edit PR #31.
- The Source Manager, shared auth/Token lifecycle, Import state machine/store, V2 schema/migrations,
  backup mapping, Repository connector, and server API are high-collision architecture seams even
  without a current textual overlap. Package C must be split into ordered PRs under separate task
  briefs; a single lifecycle mega-PR would violate repository scope rules.
- The unique `integration/v2` worktree remains at the exact authoritative base and was not modified.

## D-A — owner decision: milestone scope

Choose exactly one. This decision governs the release claim; it does not itself choose the Source
Manager product contract in D-B.

### D-A1 — Alpha-now, with disclosed lifecycle deferrals

Authorize an Alpha milestone whose Source Manager scope is deterministic local file/ZIP import,
active-job cancellation, terminal reports, Demo isolation, and local-first startup. Connector
Connect/provider revoke/provider ingestion, job Retry, and crash/reload recovery are explicit
deferrals. The product must say "unavailable in this Alpha", not present a misleading working
connector or full-v2.0 claim.

Exact Alpha success means all Alpha rows in `docs/engineering/release-gates.md` pass on one exact
head: baseline/maintenance references, accepted architecture decisions, converged Repository
contract, physical V2 isolation, Shadow reads that cannot affect Legacy results, parity reporting,
Legacy default/rollback, privacy and no-data-loss gates, fresh CI, and an owner-authorized release
artifact. The currently partial Legacy cache recovery row requires separately authorized real
private export/validate/restore evidence outside Git, or the Alpha claim must remain blocked. This
option does not waive that evidence and does not satisfy Beta/Production or PRD P0.

Recommended compatible D-B choices: A for the smallest Alpha or B for an optional synthetic local
lifecycle improvement. D-B remains a separate recorded choice.

### D-A2 — staged P0 closure, with no release claim yet

Keep the integrated candidate unreleased while implementing the selected D-B contract as bounded,
ordered tranches. Re-run release readiness only after those tranches land. This is distinct from
Alpha-now because it makes no Alpha release, and distinct from direct full v2.0 because it does not
pre-authorize real OAuth, private evidence, deployment, or Production.

This is the lowest-risk route if the owner wants progress without converting PR #46 into a broad
release authorization. D-B B can complete entirely with deterministic seams; D-B C still stops at
each public/schema/provider boundary and requires fresh authority.

### D-A3 — direct full v2.0

Do not release until PRD P0, applicable Beta/Production gates, root privacy disclosure, migration
and rollback evidence, and every other Release Readiness blocker pass at one exact head. Select
D-B C; Packages A and B cannot support a full-v2.0 claim.

This choice authorizes planning, not implementation. Full execution must be decomposed and must
stop before OAuth/provider credentials, real-account/private evidence, schema/public API,
dependency, Worker, Service Worker, deploy, or release activity until each is explicitly approved.

## D-B — owner decision: Source Manager contract

Choose exactly one package. All packages preserve local data, forbid automatic connection and
automatic retry, keep delete-source-data separate, and retain Legacy/Shadow/Canonical/Demo
isolation.

### D-B A — honest Alpha freeze

**UI and behavior**

- Connector status reads `Unavailable in this Alpha`; it is not `not_configured`, `connected`, or
  a provider-reachability claim. Render one disabled button labeled `Connect unavailable in
  Alpha`; do not render a Disconnect action. Static copy names both as full-v2.0 deferrals. Source
  Manager reads and writes no Token and makes no network request.
- Local files/ZIP, progress, current-session cancellation, reports, and duplicate handling remain
  unchanged. There is no Retry/Resume action. Failed or interrupted work is recovered only by
  manually reselecting the original artifact; exact duplicates remain skipped.
- `completed_with_warnings`, `cancelled`, and reload-stalled jobs stay non-resumable. Completed items
  and every persisted record remain untouched. Quota errors instruct the user to free unrelated
  origin storage and reselect; Source Manager never deletes data to make room.

**Literal candidate path allowlist**

```text
docs/tasks/pr-40-source-manager-lifecycle.md
source-manager.html
tests/source-manager/source-manager-boundaries.test.js
README.md
docs/guides/known-limitations.md
docs/guides/troubleshooting.md
tests/docs/release-docs.test.js
```

No public/schema/dependency/Worker/Service Worker/network boundary changes. Failure-first coverage
must freeze the exact Alpha disclosure, disabled/absent controls, zero auth/Token/provider imports,
zero external requests, and unchanged Real/Demo/invalid-mode behavior. Browser evidence uses a
disposable fresh profile and synthetic files only; verify CSP, current import/cancel/report flows,
reload disclosure, and no external request. No migration or data impact. Rollback is a copy/docs
revert. Architecture/collision risk: **low**.

Deterministic synthetic completion is sufficient for this package. It is not sufficient for an
Alpha release by itself and cannot satisfy full v2.0.

### D-B B — local credential lifecycle plus terminal retry; no provider Connect

**UI and authorization contract**

- Status is derived only from the shared local Token and labeled as local evidence:
  `no_local_credential`, `local_credential_present`, `reconnect_required`, or
  `credential_status_unavailable`. It never says the provider is reachable, synced, or authorized.
- Connect remains disabled as `Provider authorization not available in this build`. There is no
  OAuth redirect, callback, credential acquisition, provider API, external request, or automatic
  sync.
- If a local credential exists, expose `Disconnect on this device`. Confirmation states that the
  shared origin credential used by Legacy provider operations will be removed and all local data
  retained. The operation performs no provider revoke request. Success is
  `local_credential_removed; provider_revocation_not_attempted`; storage failure is explicit and
  leaves the credential/status unchanged. The UI must not label this as confirmed provider
  revocation. Do not render Disconnect when no local credential exists or credential storage is
  unavailable; an expired but readable credential may still be removed.

**Retry, failure, cancellation, and resume contract**

- Persisted reports retain an opaque, in-memory action handle that is never rendered or logged.
  Show Retry only when the underlying job is `failed_validation`, `failed_decode`, or
  `failed_storage` and contains a retryable item. Retry calls the existing `retryJob` on the same
  job, reuses stored RawArtifacts, preserves successful items, refreshes progress/report, and
  disables concurrent Retry clicks.
- No automatic retry. `completed_with_warnings`, `cancelled`, missing-artifact jobs, and durable
  nonterminal jobs are not retryable or resumable. Reload-stalled jobs are shown as
  `Recovery unavailable in this build` without exposing a job ID. Manual reselect remains the
  fallback. Active cancellation retains the existing latched semantics and completed writes.
- Offline local import and retry continue to work. Quota, Worker crash, missing artifact, duplicate,
  and storage errors use bounded safe codes; no raw artifact, Token, athlete identity, or path is
  logged.

**Literal candidate path allowlist**

```text
docs/tasks/pr-40-source-manager-lifecycle.md
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-local-credential.js
js/pages/source-manager/source-manager.js
tests/source-manager/source-manager-local-credential.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
README.md
docs/guides/known-limitations.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/guides/migration-guide.md
tests/docs/release-docs.test.js
```

The new application adapter may consume `createAuthLifecycle` but cannot change
`js/app/auth-lifecycle.js`; any required shared-auth edit is a stop and allowlist amendment. The
facade change is private to Source Manager; the public Import module, Repository, schema,
dependency graph, Worker, Service Worker, CSP, and server APIs remain unchanged.

Failure-first tests must cover malformed/expired/missing Token states without exposing Token data;
local removal success/failure; no revoke/OAuth/provider request; the warning that Legacy shares the
credential; exact retry eligibility; missing artifacts; Worker crash; quota; duplicate replay;
double-click/concurrent retry; cancel-vs-retry; reload-stalled disclosure; report redaction; and
Demo/invalid-mode isolation. Browser evidence uses a fresh disposable profile, synthetic Token
shapes and artifacts, request interception proving zero external/provider traffic, reload, and
multi-tab observation that no recovery action is offered.

No migration or Canonical/Legacy activity change. Disconnect changes only the shared local Token;
retry mutates the existing failed ImportJob/items and may add Canonical records only through the
existing validated import transaction. Rollback removes the UI/adapter while retaining all jobs,
artifacts, reports, and activities; a removed Token is not recoverable from the app. Architecture/
collision risk: **medium**, concentrated in Source Manager composition and shared-credential UX.

All implementation and browser evidence can be deterministic and synthetic. Provider revocation,
OAuth, and real-account evidence are deliberately outside this package, so it cannot satisfy the
full PRD connector lifecycle or Production disconnect evidence.

### D-B C — full PRD P0 connector, provider import, disconnect, retry, and recovery

**UI and connection contract**

- Persist SourceConnection states `unconfigured`, `connected`, `syncing`, `reconnect_required`,
  `error`, and `disconnected`, with bounded `errorCode` and `lastSyncAt`. Activity count is derived
  through a source-neutral application/storage projection. A restored connection record without a
  Token becomes `reconnect_required`, never `connected`.
- Connect is always explicit. It uses a separately security-reviewed OAuth flow, binds the returned
  provider athlete to Legacy and Canonical source identity before Token acceptance, and does not
  start sync automatically. Status distinguishes local credential, provider authorization, and
  last successful sync; no Token or account identifier enters DOM diagnostics.
- An explicit Sync fetches bounded/cancellable provider pages through an application connector,
  normalizes each response into `ImportedActivityBundle`, and submits it through the unified Import
  Pipeline. The page never chooses a provider, Repository, store, or persistence operation.
- Disconnect confirms scope, attempts provider revocation, removes the local Token even if
  revocation is unconfirmed, stops future sync, and records `disconnected` plus a safe outcome. It
  retains Legacy/V2 activities, RawArtifacts, ImportJobs/Logs, ActivitySources, SourceConnection
  audit, backups, settings, and Demo data. Delete-source-data remains a separate unavailable action.

**Retry, recovery, cancellation, and offline contract**

- Terminal failure Retry has Package B semantics. `completed_with_warnings` and `cancelled` remain
  terminal and non-resumable; cancel never rolls back completed items.
- Every running job has an atomic durable owner/heartbeat/lease. A fresh page lists nonterminal jobs
  as `running_in_another_session` while a lease is live, or `recovery_required` after expiry. There
  is no automatic resume. Explicit Recover atomically acquires the lease, preserves completed
  items, and replays only unfinished persisted artifacts through validation. Missing artifacts
  become safe nonretryable item failures. Explicit Abandon marks unfinished items cancelled but
  deletes nothing.
- Provider-fetch cancellation aborts further requests and prevents creation of new import items;
  already committed items remain. Import-stage cancellation uses the existing latch. Closing or
  crashing a page is handled only by lease expiry, never by guessing another tab is dead.
- Offline startup and local library reads remain fully usable. Local artifact Retry/Recover works
  without network. Connect/Sync reports network unavailable without changing a valid local
  library. Offline Disconnect removes the local Token and records revocation unconfirmed.

**Required ordered tranches and literal candidate allowlists**

Package C is not authorized as one PR. Each tranche requires a new brief, fresh collision readback,
and explicit authority. The union below is the candidate maximum; discoveries outside it stop work.

Tranche C1 — connection controller and secure auth surface:

```text
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/auth-lifecycle.js
js/pages/source-manager/source-manager.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
README.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/guides/known-limitations.md
tests/docs/release-docs.test.js
```

Tranche C2 — additive V5 SourceConnection and backup/restore semantics:

```text
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/source-connection-store.js
js/storage/index.js
js/backup/backup-service.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
docs/migrations/indexeddb-v2.md
docs/migrations/rollback-plan.md
docs/guides/backup-guide.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
```

Tranche C3 — provider-to-import application pipeline:

```text
js/app/source-manager.js
js/app/source-manager-sync.js
js/connectors/strava/strava-api-connector.js
js/import/import-service.js
js/import/strava-api-decoder.js
js/import/synthetic-import-worker.js
js/storage/import-store.js
api/strava-activities.js
tests/source-manager/source-manager.test.js
tests/repository/strava-api-connector.test.js
tests/import/strava-api-import.test.js
tests/import/import-core.test.js
tests/import/import-worker.test.js
tests/import/import-boundaries.test.js
tests/import/decoder-registry-wiring.test.js
tests/privacy/server-api-logging.test.js
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/guides/known-limitations.md
```

Tranche C4 — terminal Retry and durable lease-based recovery:

```text
source-manager.html
styles/source-manager.css
js/app/source-manager.js
js/pages/source-manager/source-manager.js
js/import/import-service.js
js/import/state-machine.js
js/storage/import-store.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/import/import-core.test.js
tests/import/import-state-machine.test.js
tests/import/import-boundaries.test.js
tests/storage/indexeddb-v2-transactions.test.js
docs/guides/troubleshooting.md
docs/guides/known-limitations.md
```

Every tranche also includes its new `docs/tasks/<task>.md`; this PR-40 brief is not reused as
implementation authority. No dependency or Service Worker path is allowed. If OAuth security needs
a dependency, CSP expansion, a new/changed auth endpoint, or a Service Worker change, stop and
derive a new allowlist. Tranche C2 is a schema/public-storage expansion. Tranches C3/C4 expand the
application/import contract and Worker registry. Those are explicit owner approval points.

**Failure-first and browser evidence**

- Auth: unsolicited/mismatched/expired callback, state/PKCE failure, popup/navigation interruption,
  canonical/Legacy athlete mismatch, Token write/remove failure, offline, revoke denial/timeout,
  callback replay, and secret/log/DOM redaction.
- Provider import: pagination bound, rate limit, partial page, duplicate activity, malformed/private
  response, cancellation before/during import, quota, Worker crash, exact identity, retry, and no
  direct Repository/store writes.
- Connection storage: V4-to-V5 upgrade, idempotent reopen, interrupted migration, backup round trip,
  credential-free restore to `reconnect_required`, unknown fields/statuses, and retained provenance.
- Recovery: two-tab live lease, expired lease takeover, crash/reload, concurrent Recover, missing
  artifact, completed-item preservation, cancellation, Abandon, quota, and no automatic work.
- Browser matrix: fresh disposable profiles for Real/Demo/invalid modes, two tabs, offline, CSP and
  request inspection, synthetic auth/server seams, IndexedDB upgrade/restore, and Service Worker
  cache-bypass assertions. No user browser profile is used.

Deterministic synthetic seams can complete state, storage, migration, backup, adapter, cancellation,
retry/recovery, privacy, and browser failure evidence. They cannot prove provider OAuth consent,
real Token refresh/revoke, provider pagination/rate behavior, cross-account handling against a real
library, or private migration/rollback. Those require separately authorized real account/private
evidence outside Git. Until then, full-v2.0/Production remains blocked.

Migration/data impact is additive V5 metadata plus ImportJob lease fields and provider-origin
RawArtifacts/activities. Rollback never downgrades or deletes the V5 database: disable the feature,
return reads to Legacy/default behavior, retain V2, and use an older build only if it demonstrably
opens a higher-version database safely. Revoked/removed Tokens are not recoverable; reconnect is
explicit. Architecture/collision risk: **high** across shared auth, schema/backup, provider API,
Import state/Worker, and Source Manager composition.

## Owner response required

Record one D-A value (`A1`, `A2`, or `A3`) and one D-B value (`A`, `B`, or `C`). Also record each
explicit stop-boundary authorization needed by the selected package. Selection does not authorize
Ready, merge, PR #31 edits, release, deployment, real accounts, provider requests, private data,
schema/public/dependency/Worker/Service Worker expansion, or paths outside the selected allowlist.

No implementation starts from this audit alone.
