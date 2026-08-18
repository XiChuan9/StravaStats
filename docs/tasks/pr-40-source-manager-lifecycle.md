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

Every implementation tranche also requires its own new `docs/tasks/<task>.md`; this PR-40 parent
brief records the selected direction and material A3 packages but is not implementation authority.
No dependency or Service Worker path is allowed. If OAuth security needs a dependency, CSP
expansion, a new/changed auth endpoint, or a Service Worker change, stop and derive a new allowlist.
Tranche C2 is a schema/public-storage expansion. Tranches C3/C4 expand the application/import
contract and Worker registry. Those are explicit owner approval points.

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

## A3 parent selection — accepted, tranche implementation still gated

On 2026-08-09, the owner selected:

> 批准 D-A A2、D-B C，按 C1–C4 分阶段推进。

The authoritative interpretation is:

- **D-A A2:** staged P0 closure with no Alpha, full-v2.0, release-readiness, deploy, or release
  claim.
- **D-B C:** pursue the full PRD P0 lifecycle through four separate bounded tranches: C1
  auth/controller; C2 additive V5 SourceConnection and backup; C3 provider to
  ImportedActivityBundle to ImportService; C4 durable ownership/heartbeat/lease recovery.
- The selection authorizes read-only investigation and Task-Brief/A3 contract freezing. It does
  not authorize implementation of any tranche. Each tranche requires its own material decision,
  literal implementation allowlist, new Task Brief, and separate explicit approval.
- Real OAuth/account/provider calls, credentials/private data, V5 schema/public Storage API,
  Import/Worker/provider API expansion, deployment, release, Ready, merge, and cleanup remain
  unauthorized. PR #46 remains open and Draft; PR #31 and every Legacy/V2 record remain untouched.

The following is the first bounded follow-up: the C1 A3 material decision package. It supersedes
the earlier broad C1 candidate list for C1 planning only. It does not start C1 implementation.

## C1 A3 material decision package — auth/controller

Status: **Awaiting separate owner selection and implementation authorization.**

### C1 findings

#### C1-F1 — the two documents have incompatible auth composition boundaries

- The root application imports `js/app/auth.js`, which reads `window` at module scope, imports root
  loading/error UI and Demo utilities, and attaches root login/logout behavior. It is not safe to
  import into Source Manager.
- Source Manager modules currently import with zero Token, Web Storage, provider, network, or DOM
  I/O. The page consumer is explicitly prohibited from reading Tokens, calling `/api/strava-*`,
  selecting a provider, or owning auth. Any connection work must be an injected application-layer
  façade whose public results contain safe status/action data only.
- The current Source Manager CSP has `connect-src 'self'`. It permits the existing same-origin
  config/code-exchange endpoints but blocks the root auth module's direct provider deauthorization
  request.

#### C1-F2 — current callback handling is not sufficient for a new authorization surface

- Root `redirectToStrava()` performs a full-page redirect but creates no request state. Root
  `handleAuth()` accepts any non-empty `code` query and exchanges it. It removes the query only
  after a successful exchange and Token acceptance, so a failed callback can leave the code in the
  address bar/history.
- The current server exchange returns the provider response to the browser. The auth lifecycle
  stores only access token, refresh token, and expiry, but the transient response may include a
  broader athlete summary. A C1 live boundary must return only the exact Token fields, granted
  scopes, and normalized athlete identity required by later identity binding.
- `api/strava-auth.js` accepts any non-empty string code without a fixed length/character contract.
  It does not accept or validate request state; request state must be created and consumed by the
  browser before code exchange because it binds the browser session, not the server secret.
- Existing synthetic callback tests prove only the present root behavior. There is no failure-first
  evidence for missing/mismatched/replayed/expired state, duplicate query parameters, denied scope,
  URL scrubbing before failure, Source Manager Demo isolation, or concurrent callback processing.

#### C1-F3 — official provider behavior requires a new revocation decision

- The current official [Strava authentication documentation](https://developers.strava.com/docs/authentication/)
  documents web authorization-code redirects, optional request `state` echoed in the response,
  scope reduction by the athlete, short-lived one-use codes, and client-secret server exchange. It
  does not document PKCE challenge parameters; C1 must not invent or claim provider PKCE support.
- The same current documentation says that, from 2026-06-01, applications should use
  `POST https://www.strava.com/oauth/revoke`, authenticated with HTTP Basic client ID/secret, and
  that it becomes the only supported deauthorization endpoint on 2027-06-01. Revoking a refresh
  token also revokes associated access tokens.
- A client secret can never enter browser code, CSP, storage, diagnostics, or fixtures. Correct new
  revocation therefore needs a same-origin server endpoint that forwards a bounded Token to the
  provider with server-owned Basic authentication. Reusing the current direct browser
  `/oauth/deauthorize` call would intentionally build on a sunset path and is rejected for C1.
- This public documentation read was read-only. No authorization, Token exchange, revoke, API
  activity request, account, credential, or private data was used.

#### C1-F4 — C1 cannot honestly activate a durable connection before C2/C3

- `createAuthLifecycle()` protects a Legacy library by comparing the exchange athlete ID with the
  stored Legacy athlete ID. It cannot bind an existing Canonical library because V4 has no
  SourceConnection or Canonical athlete-owner record.
- Before C2, a successful Token exchange cannot persist durable connection status or subject
  identity. Before C3, it cannot import provider activities. Enabling Connect in C1 would therefore
  produce a shared credential with no durable SourceConnection and no Source Manager Sync value.
- A Token found after reload proves only `local_credential_present`; it does not prove provider
  authorization, identity, reachability, or sync. The UI cannot label that state `connected`.
- Safe sequencing is controller seam first, then C2 identity/state storage, then a separately
  approved activation correction after C2 and before/with C3. Reordering live activation does not
  change the owner's C1–C4 direction; it prevents a transient unsafe product state.

#### C1-F5 — collision and frozen-boundary evidence

- PR #31's own merge-base diff still changes only
  `docs/tasks/pr-25-release-readiness-audit.md`; it has no direct C1 path overlap.
- `tests/source-manager/source-manager-boundaries.test.js` freezes zero auth/network/Token behavior,
  the PR-10 nine-path historical maximum, and frozen Import/Repository public surfaces. Any C1
  implementation must update only the forward-looking Source Manager assertions while preserving
  the historical PR-10 record.
- Shared `js/app/auth-lifecycle.js`, `api/strava-auth.js`, and their privacy tests are recent
  hardening hotspots. Option A avoids them. Option B intentionally collides and therefore requires
  the larger explicit allowlist and separate security review below.
- No C1 option needs a dependency, Repository/Import API, V2 schema, Worker, Service Worker, root
  `index.html`, `js/app/main.js`, destructive storage, or data migration change.

### C1-D1 — choose exactly one activation package

#### C1-A — fail-closed controller seam first (recommended)

Freeze and later implement an application controller and sanitized Source Manager façade without
enabling live authorization or local credential mutation.

**Exact production behavior**

- The API card status is `authorization_unavailable`; copy says `Connection controller staged;
  authorization remains unavailable until connection identity and provider import are ready.`
- Render one disabled `Connect unavailable` button and no Disconnect action. No Token or provider
  status is read. No OAuth URL, config fetch, callback exchange, revoke, localStorage/sessionStorage,
  external request, or automatic Sync occurs.
- The application controller is side-effect free at module import and receives all capabilities by
  injection. Its exact page façade is:

```text
getConnectionSnapshot()
beginConnect()
disconnect()
close()
```

- `getConnectionSnapshot()` returns the exact deeply frozen production object
  `{ schemaVersion: 1, status: 'authorization_unavailable', code:
  'AUTHORIZATION_UNAVAILABLE', actions: { connect: false, disconnect: false } }`. It contains no
  Token, athlete/account ID, provider response, URL, scope string, underlying error, or storage
  handle.
- In the production C1 adapter, `beginConnect()` and `disconnect()` fail with fixed
  `AUTHORIZATION_UNAVAILABLE` before any I/O. `close()` is idempotent and prevents later actions.
- An unsolicited Source Manager query containing any OAuth-shaped `code`, `state`, `error`, or
  `scope` field is rejected before any auth/storage/network I/O, never rendered/logged, and scrubbed
  through an injected same-origin navigation sanitizer before mode dispatch. It preserves a sole
  valid `mode=real` or `mode=demo` field and otherwise returns to the bare Source Manager path.
  Duplicate, blank, accessor, malformed, and Proxy navigation inputs fail closed. Demo and invalid
  modes do not construct the Real controller; the sanitizer performs history replacement only.
- C2 will supply a durable identity/state port. Live activation remains a separately approved C1.1
  correction after C2; C3 supplies Sync. C1-A does not create dead provider code or a hidden Token
  path.

**Literal implementation candidate allowlist — hard maximum of ten paths**

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

The new PR-41 Task Brief must be the first and sole publication commit on a new isolated branch and
Draft PR. A third runtime module, shared auth/API file, stylesheet, guide, root page, or eleventh
path is a material stop requiring a fresh collision record and owner approval.

**Failure-first and browser evidence**

- Module import performs zero fetch, Token/Web Storage, provider, Worker, timer, console, or DOM I/O.
- Exact façade keys, frozen snapshot, safe statuses/codes, close barrier, repeated action, hostile
  options, and rejected Promise behavior.
- `beginConnect`/`disconnect` prove zero fetch, navigation, history, storage, provider, and Import
  work; existing local file/ZIP behavior is unchanged.
- Unsolicited callback values are scrubbed before error rendering and never appear in DOM,
  diagnostics, console, URL-after-scrub, or thrown public errors.
- Actual-served disposable-profile smoke covers Real, Demo, invalid mode, unsolicited callback,
  offline, narrow screen, keyboard/focus, zero external requests, existing local import, and
  unchanged Service Worker bypass behavior. All inputs are deterministic and synthetic.

No migration or data mutation. Rollback is a ten-path code/docs revert; no Token or data needs
restoration. Public Repository/Import/Storage and all schema/dependency/Worker/Service Worker/server
API boundaries remain frozen. Architecture/collision risk: **low-to-medium**, limited to Source
Manager composition and its historical boundary test.

#### C1-B — activate live authorization and revocation in C1 (not recommended before C2)

This option creates a real-capable Source Manager authorization controller before durable
SourceConnection storage/provider import. It remains selectable only with explicit approval of
every expansion below; actual account/provider execution is still a later separate gate.

**Exact flow and UI contract**

- Use a same-tab full-page redirect, never popup, iframe, mobile webview, or silent authorization.
  Connect appears only in Real mode after an explicit click and pre-consent copy naming requested
  scopes and the absence of automatic Sync.
- The exact pre-C2 UI state set is `unconfigured`, `authorizing`, `callback_processing`,
  `local_credential_present`, `reconnect_required`, `disconnecting`, `disconnected`, and `error`.
  It does not include `connected` or `syncing`. The exact safe error-code set is
  `AUTH_CONFIG_UNAVAILABLE`, `AUTH_STATE_UNAVAILABLE`, `AUTH_STATE_INVALID`,
  `AUTH_ACCESS_DENIED`, `AUTH_SCOPE_INSUFFICIENT`, `AUTH_EXCHANGE_FAILED`,
  `AUTH_IDENTITY_UNCONFIRMED`, `AUTH_IDENTITY_MISMATCH`, `TOKEN_WRITE_FAILED`,
  `TOKEN_REMOVAL_FAILED`, `REVOCATION_UNCONFIRMED`, `NETWORK_UNAVAILABLE`, and
  `CONNECTION_CLOSED`; every other failure maps to `AUTH_EXCHANGE_FAILED`.
- Generate 32 random bytes with injected Crypto, base64url encode them, and store an exact
  single-use state record in sessionStorage with creation time and same-origin return path. State
  expires after ten minutes. Storage/Crypto failure blocks before config/network/navigation.
- Navigate only to `https://www.strava.com/oauth/authorize`. Request only the minimum scopes
  separately approved for C3; the current root scope string is not inherited automatically. The
  callback must contain exactly one nonblank code, exactly one exact state, and the approved scope
  set; denied or reduced scope fails closed without storing a Token. C1-B implementation remains
  blocked until the C3 scope set is frozen.
- Consume/delete state and scrub all OAuth query fields before code exchange. Replayed, expired,
  unsolicited, malformed, duplicate, cross-mode, and concurrent callbacks never call the exchange
  endpoint. Config uses same-origin GET and exchange uses same-origin POST; both use
  `credentials: 'same-origin'`, `cache: 'no-store'`, `redirect: 'error'`,
  `referrerPolicy: 'no-referrer'`, and an abort signal. Exchange alone sends exact
  `Content-Type: application/json`.
- The server validates a bounded code, sends the client secret only to the provider, and returns
  exactly access token, refresh token, expiry, granted scopes, and normalized athlete ID. The
  browser lifecycle writes only the existing `strava_tokens` record after the Legacy identity guard
  and injected Canonical identity gate both pass. Nonempty Canonical data without a C2 identity
  binding returns `identity_unconfirmed` and stores nothing.
- Until C2, a successful session is labeled `local_credential_present`, not `connected`. There is
  no SourceConnection, lastSync, activity count, or Sync. Reload derives only local credential/
  expiry state.
- Disconnect confirms that the origin-shared Legacy credential is affected. A new same-origin
  server endpoint revokes the refresh token through the provider's current server-authenticated
  revoke endpoint, falling back to the access token only when no refresh token exists. The local
  Token is removed even when revocation is unconfirmed; all local data is retained. No client
  secret or Basic header reaches browser code.
- The official provider documentation does not define PKCE parameters. C1-B uses the documented
  confidential-client authorization-code flow plus mandatory state; it makes no PKCE claim. A
  security review rejecting that posture blocks C1-B rather than inventing provider support.

**Literal implementation candidate allowlist — hard maximum of twenty-two paths**

```text
docs/tasks/pr-41-source-manager-connection-controller.md
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/app/source-manager-connection.js
js/app/auth-lifecycle.js
js/pages/source-manager/source-manager.js
api/config.js
api/strava-auth.js
api/strava-revoke.js
tests/source-manager/source-manager-connection.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/legacy/auth-lifecycle.test.js
tests/privacy/server-api-logging.test.js
README.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
docs/guides/known-limitations.md
tests/docs/release-docs.test.js
```

`api/strava-revoke.js` is a new public same-origin server route, and
`js/app/auth-lifecycle.js` changes the shared root/Source Manager Token-revocation contract to
prefer refresh-token revocation. Those are material API/shared-auth expansions. The Source Manager
CSP remains `connect-src 'self'` because all browser fetches are same-origin; authorization itself
is top-level navigation. `scripts/local-dev-server.mjs` dynamically loads API files and must not be
changed. No dependency, Repository/Import/Storage/schema/Worker/Service Worker path is allowed.

Failure-first coverage additionally requires state entropy/TTL/single use; query scrub on every
outcome; denied/reduced scopes; malformed/bounded exchange and response; Canonical/Legacy mismatch;
Token write/remove failures; server Basic-secret isolation; refresh/access revoke selection; revoke
timeout/401/429/5xx/malformed response; local removal after unconfirmed revoke; two tabs; abort;
offline; callback replay; fixed diagnostics; and proof that no activity/source/import record changes.
Browser evidence is synthetic interception only. Real OAuth consent, exchange, refresh/revoke, and
account identity remain unverified and unauthorized.

No V2 migration, but this option writes/removes the shared local Token and adds a public server API.
Rollback removes the Source Manager surface and server route while retaining all data; it cannot
restore a removed/revoked Token. A Token created before C2 may outlive the UI and must be reported as
local credential only. Architecture/collision risk: **high** across shared auth, server privacy,
Source Manager CSP/navigation, and later C2 identity semantics.

### C1 recommendation and owner response required

Select exactly one:

- **C1-A (recommended):** authorize a new PR-41 Task Brief/A1 publication, then separately authorize
  implementation of the ten-path fail-closed controller seam. Live activation waits for C2 and a
  C1.1 material correction.
- **C1-B:** authorize the twenty-two-path live controller/API package and explicitly accept the
  documented confidential-client-plus-state/no-PKCE posture and pre-C2 local-credential-only state.
  This still does not authorize an actual account/provider request.
- **Revise:** provide a different sequencing or auth contract; no implementation starts.

Approval of the parent D-A A2 / D-B C decision is not approval of C1-A or C1-B. Until the owner
selects one and separately authorizes implementation, PR #46 remains docs-only, open, and Draft.
