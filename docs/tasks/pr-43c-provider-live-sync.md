# PR-43c: Bounded Provider Sync Orchestration

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M30 / narrow C3c live provider sync orchestration |
| Status | A2 readiness package frozen; awaiting explicit C3c A3 implementation authorization |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@df5a27430ff07da05051e9d38d7fe3acf52519ff` |
| Exact base tree | `6b89d83a7e6f797e7568b7cb9cbf0446bac9ee1a` |
| Feature branch | `codex/v2/provider-sync-orchestration` |
| Owner decision | `D-C3c.R-A + D-C3c A` |
| Completed prerequisites | C1.1 PR #53, C2 SourceConnection/Backup, C3a mapper, C3b artifact builder/import |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Current authority | Task-Brief-only A0-A2; no product or test implementation |

## Goal

Activate a separately reviewable, bounded, foreground-only provider sync orchestrator after merged
C1.1. One explicit Real-mode `Sync latest 25` action may acquire a single reduced provider page,
feed only the merged C3a mapper and C3b artifact builder, and submit the resulting descriptors once
to the existing ImportService. No implementation follows until the control tower relays separate,
explicit C3c A3 authority from the exact A2 head.

This first commit changes only this Task Brief. The next authorized step is a short current-tree
readiness and collision audit recorded only here. Production and test implementation, provider
requests, and private evidence remain prohibited.

## Authority and sequence

The authoritative baseline is the squash merge of C1.1 PR #53 at
`integration/v2@df5a27430ff07da05051e9d38d7fe3acf52519ff`. The delegated post-merge evidence records a clean
unique integration worktree, syntax 274, privacy, full 1826/1826 tests, local/origin equality, and
successful integration-push CI run `31472713788`, job `93719378954`, at that exact commit. Those are
baseline facts, not evidence for this feature head.

The owner approved `D-C3c.R-A + D-C3c A` and the following order:

1. C1.1 independently closes authorization, five-field Token authority, restored-subject reconnect,
   and server revoke.
2. C1.1 merges to `integration/v2` and exact integration CI succeeds.
3. Narrow C3c may create a separate branch and Draft PR for bounded provider sync orchestration.
4. A0/A1 and a short A2 readiness audit precede a separate explicit C3c A3 implementation decision.

The first two conditions are satisfied at the exact base. This dispatch authorizes only the third
condition through A2. It does not authorize product/test implementation, live OAuth or provider
calls, real account/private evidence, Ready, merge, cleanup, deployment, release, or C4 work.

## Global invariants

- Preserve the working V1 path and every Legacy, V2, import, source, backup, and settings record.
  Disconnecting Strava and deleting local data remain separate actions.
- Retain the merged C2 Backup subject solely for exact restored-subject reconnect. A mismatch fails
  closed and never overwrites the immutable subject, Token, or SourceConnection.
- Only an exact five-field local Token and the exact C2 connected snapshot are C3c authority. A
  missing, legacy, reduced, mismatched, or otherwise invalid authority fails before provider I/O.
- Activity and provider IDs remain opaque positive-decimal strings. They are never numericized and
  never enter a browser URL.
- Provider data may reach persistence only through the bounded reader, merged C3a mapper, merged C3b
  artifact builder, and existing ImportService. There is no parallel persistence path.
- Missing and null never become zero. True zero remains distinct. Provider order, provenance,
  cancellation, fixed errors, and privacy reductions remain fail closed.
- Token, authorization headers, subject, callback values, private provider values, raw responses or
  errors, precise location, health, and power data never enter DOM, logs, Diagnostics, reports,
  Backup, URLs, Git, or deterministic evidence.
- Startup, reload, restore, Connect, offline observation, and Demo mode perform no automatic Sync.
  Demo constructs no provider, authentication, storage, Worker, or network capability.
- C3c serializes only within one controller. It makes no cross-tab owner, lease, heartbeat, recovery,
  or durable `syncing` claim; those remain C4.

## Frozen narrow C3c behavior

### Explicit foreground action and state

- Real mode exposes exactly one foreground acquisition action, `Sync latest 25`, from an exact
  locally authorized `connected` state. An `error` state may offer explicit Sync again only when the
  same exact local authority still exists; its required C2 recovery CAS must succeed before provider
  I/O.
- C3c adds only ephemeral controller states `syncing` and `cancelling`. While syncing, the only
  competing action is `Cancel sync`; Disconnect remains disabled until cancellation is terminal.
- Connect never starts Sync. Startup, reload, restore, and offline/online events never start Sync.
  A later click is a new bounded operation, not a retry, resume, poll, or background job.

### Exact authority gate

- Before constructing or calling the reader, require the exact local five-field Token: access token,
  refresh token, positive expiry, `subject_id`, and ordered
  `granted_scopes: ['read', 'activity:read_all']`.
- Require the exact C2 Strava slot to be connected with the same immutable positive-decimal subject.
  The Token subject, C2 subject, and mapper session subject must be identical strings.
- A missing Token, legacy three-field Token, non-positive/non-integer expiry,
  reduced/extra/reordered scopes, missing/malformed C2 row, non-connected status, or subject mismatch
  fails before provider, mapper, artifact, Import, or persistence work.
- The restored C2 subject is retained only for an exact reconnect already owned by merged C1.1. C3c
  never creates, replaces, repairs, or rebinds that identity.

### Dedicated browser and server reader

- One dedicated injected reader uses only fixed same-origin `POST /api/strava-sync`. Browser bodies
  select exactly one mutually exclusive operation: list, detail with one opaque activity ID, or
  streams with that ID and the exact ordered stream-key array. There are no query-string IDs or
  provider URLs in browser code.
- Browser requests use exact JSON content type, `credentials: 'same-origin'`, `cache: 'no-store'`,
  `redirect: 'error'`, `referrerPolicy: 'no-referrer'`, a 15-second AbortSignal timeout, and no retry.
- The server validates exact method, content type, operation/body keys, ID form, Token authority,
  provider status, response content type, response size, record counts, and reduced response shape.
  It applies a 12-second upstream timeout, never retries, and returns fixed no-store redacted results.
- The server reduces provider fields before the response reaches the browser or C3a. Names,
  athlete/profile, map/polyline, gear/device, segment efforts, unknown fields, authorization material,
  and raw provider errors do not cross the route.

### Exact provider bounds and ordering

- List performs exactly one `GET /athlete/activities?page=1&per_page=25`. There is no second page,
  cursor, background fetch, webhook, polling, or fetch-all behavior. An empty list creates no mapper,
  artifact, or Import job and does not advance `lastSyncAt`.
- Reject a duplicate activity ID in the list before scheduling any detail request. Preserve provider
  order through acquisition, C3a bundles, C3b descriptors, Import items, and report ordinals.
- Run at most two activity workers. Each worker performs detail and then streams sequentially, so at
  most two provider requests are in flight. Detail is
  `GET /activities/{id}?include_all_efforts=false`; laps come only from detail and are capped at
  10,000. There is no separate laps request.
- Streams request exactly
  `time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth`,
  with `key_by_type=true` and at most 200,000 points per series.
- Provider list and detail bodies are each bounded to 2 MiB, each stream body to 16 MiB, and the
  total reduced foreground acquisition to 32 MiB. No over-limit response reaches mapping or Import.
- The complete provider ceiling is one list plus detail and streams for at most 25 activities: at
  most 51 upstream requests, still subject to the lower concurrency, byte, record, timeout, and
  cancellation bounds.

### Failure and optional-degradation rules

- Any 401 or 403 is fatal, stops scheduling, and yields the fixed `reconnect_required` outcome. C3c
  CASes only the exact current C2 row to `reconnect_required`, preserves identity and history, and
  does not retry.
- Any 429 is fatal, stops scheduling, preserves connected state/history, and yields fixed try-later
  copy. `Retry-After` is neither persisted nor rendered.
- A list network, timeout, 5xx, malformed, duplicate-ID, record-limit, or byte-limit failure is fatal
  and imports nothing.
- Detail and streams are optional enrichments. A non-auth 404, network, timeout, 5xx, malformed, or
  over-limit optional result maps to literal null plus the existing C3a warning; the summary remains
  in provider order. An auth failure or 429 remains fatal even during optional enrichment.

### Only orchestration and `lastSyncAt` pipeline

1. Validate exact Token and C2 authority and capture the original connected snapshot/revision.
2. Run the bounded reader. Abort before every request and stop future scheduling on fatal, cancel,
   close, or pagehide.
3. After complete acquisition, capture one strict millisecond UTC `acquiredAt`. Construct the merged
   C3a mapper with the exact session and same C2 snapshot, then call its all-or-nothing mapper with a
   fresh cancellation snapshot.
4. Pass the ordered bundles and same connection to merged C3b
   `createStravaProviderArtifacts`. Check cancellation immediately before and after this synchronous
   bounded stage.
5. Submit the exact descriptor array once to existing `ImportService.importArtifacts`. Store its job
   ID only inside the controller and use only existing cancel, wait, report, and close boundaries.
6. Advance `lastSyncAt` only after a terminal public ImportReport has total at least one, zero failed,
   zero cancelled, every item outcome in `completed`, `review_required`, or
   `skipped_exact_duplicate`, and
   `completed + reviewRequired + skippedExactDuplicate === total`. Either completed job status is
   eligible only when that entire predicate holds.
7. The success CAS uses the original revision and the shared `acquiredAt`, which must be strictly
   later than the stored value. There is no reread, retry, synthesized timestamp, or connection
   revival. A stale CAS or post-import write failure never rolls back or hides imported data.

Empty selection, partial enrichment only when the existing warning remains truthful, quota partial,
cancel, mapping/artifact failure, nonaccepted item, stale revision, close, pagehide, or write failure
does not advance `lastSyncAt`. Exact duplicates, exact identity linking, conflicts, and fuzzy review
retain the existing C3b/Import semantics; C3c does not reinterpret them.

### Cancellation, close, and Disconnect

- `Cancel sync` aborts the reader and prevents new acquisition requests. Cancellation before Import
  imports nothing. Mapper and artifact construction are synchronous and receive cancellation checks
  immediately before and after their calls.
- After ImportService owns a job, cancellation uses its existing checkpoints. Completed, skipped,
  review-required, or otherwise committed items remain; C3c never rolls them back.
- `pagehide` and close abort the reader, request cancellation of the active Import job, wait for the
  controller/import close boundary, and perform no success CAS or provider revoke.
- Disconnect remains disabled until cancellation is terminal and then uses only the merged C1.1
  disconnect/revoke behavior. C3c does not modify authorization, revoke, Token, or C2 identity rules.

### UI, privacy, rollback, and evidence

- Exact added labels/actions are `Syncing`, `Cancelling`, `Sync latest 25`, and `Cancel sync`.
  Existing C1.1 connection labels and actions remain unchanged.
- Connected copy states that authorization is stored locally, is not automatically checked, and a
  press imports at most the latest 25. Fixed completion copy may expose aggregate counts, safe item
  outcomes/codes, whether completed items were retained, and whether history advanced; it exposes no
  provider/private values.
- Demo remains `Demo — no provider connection` with no live action or injected provider/auth/storage/
  network capability. Local import remains independently available.
- DOM output uses fixed copy and text nodes/textContent. Diagnostics records fixed page/category/code/
  count values only. Backup, Service Worker/cache, CSP, public exports, schema, dependencies, Worker
  protocol/registry, and server routing configuration remain unchanged.
- Deterministic evidence uses only invented synthetic values and injected/disposable same-origin
  seams. Real OAuth, account, Token, provider request, activity, GPS, health/power data, user browser
  profile, and private fixtures remain prohibited.
- Rollback disables the Sync UI/controller/route while preserving every Legacy/V2 record and all
  data already committed by ImportService. It performs no data or schema migration.

## Exact cumulative hard maximum

C3c may cumulatively change no more than these exact 19 paths:

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

There is no twentieth path and no substitution. A listed path may remain unused when current-tree
evidence proves it unnecessary.

Explicit exclusions are C1.1 authorization/revoke implementation except the listed connection
composition seam; C3a/C3b; ImportService/store/public index; Worker/client/protocol; schema,
migrations, SourceConnection store/public index; Backup; Repository; legacy connector/routes;
Service Worker; CSP; dependencies/package/lock; local/deployed server routing or configuration; C4
owner/lease/recovery; real provider/account/private evidence; deploy, release, and cleanup.

Discovery of a required twentieth path, public/schema/dependency/Worker/Service Worker/CSP expansion,
server routing/configuration change, different identity/Token semantics, unbounded provider behavior,
or a C4 ownership requirement is a stop condition. Return the minimum material collision to the
owner; do not expand silently.

## A0 exact-base and untouched-gate evidence

- This isolated worktree began clean and detached at exact commit
  `df5a27430ff07da05051e9d38d7fe3acf52519ff`, tree
  `6b89d83a7e6f797e7568b7cb9cbf0446bac9ee1a`.
- Local `integration/v2`, the existing `origin/integration/v2` tracking ref, and the authenticated
  GitHub App readback all resolved to the exact base. `origin` is
  `https://github.com/XiChuan9/StravaStats.git`; upstream push remains disabled.
- The GitHub App reports push/admin permission and no remote branch matching
  `provider-sync-orchestration`. GitHub CLI 2.96.0 is installed but its saved keyring session is
  invalid; no interactive browser/profile authentication is used.
- `npm ci` completed; `npm run check:syntax` passed for 274 files; `npm run check:privacy` passed;
  full `npm test` passed 1826/1826; and `git diff --check` passed on the untouched tree.
- The new unused branch `codex/v2/provider-sync-orchestration` was created only after those gates at
  the exact base. The unique integration worktree was not opened or modified.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

Draft PR title:

```text
feat(v2): activate bounded provider sync
```

The PR targets `integration/v2` and remains open and Draft. Its body describes the Task-Brief-only
C3c activation, the separately merged C1.1 prerequisite, the zero implementation/provider/private
impact, and the exact local checks. No reviewer, label, assignment, Ready transition, merge,
cleanup, deployment, release, or C4 work is part of A1.

## A2 readiness-audit contract

After A1 publication, perform only a short read-only audit of the current merged C1.1/C2/C3a/C3b
tree needed to verify the literal narrow contract and 19-path maximum. Inspect only the named paths,
their direct composition imports, existing public Import and SourceConnection boundaries, current
server/privacy conventions, and historical PR #52 Package A as decision provenance.

Do not reopen broad authorization or C1.1 decisions. Record findings and any correction only in this
file, publish a second Task-Brief-only commit, run the exact repository gates, read back remote
depth-one and exact-head CI, and return an explicit C3c A3 implementation authorization package to
the control tower. Implementation does not follow automatically.

### A1 publication readback

- First commit `e0badf1b753e4371cac2bf756d94af52c50343b2` has exact parent
  `df5a27430ff07da05051e9d38d7fe3acf52519ff` and changes only this Task Brief.
- The branch was pushed normally. The authenticated GitHub App created open Draft PR #54 against
  exact `integration/v2`, with one commit, one changed file, the requested title/body, Draft true,
  merged false, and no reviewer/team request.
- Connected-app compare readback reports the branch exactly one commit ahead, zero behind, with the
  merge base equal to the authorized base and only this Task Brief in the diff.
- No label, assignment, Ready transition, merge, cleanup, deployment, release, C4, or other PR
  mutation was made.

## A2 current-tree collision and readiness findings

The audit used exact A1 head `e0badf1b753e4371cac2bf756d94af52c50343b2` and the merged C1.1/C2/
C3a/C3b code. Historical PR #52 Package A was used only as decision provenance. The audit did not
reopen authorization/revoke behavior, C4 ownership, or any excluded implementation surface.

### R1 — merged C1.1 already contains the UI, lifecycle, and cancellation composition seams

- `js/source-manager.js` remains the synchronous sanitizer and pagehide barrier. It arms pagehide
  before asynchronous composition, requests startup close, and awaits a late application close. C3c
  needs no edit to this excluded root entry.
- `js/app/source-manager-connection.js` already carries the inert `sync` action bit and the injected
  `awaitInactiveSyncBoundary` used before Disconnect. `source-manager.html` already contains one
  disabled/hidden Sync button, and the page consumes only the injected facade. The listed connection,
  page, HTML, CSS, and composition files can add `syncing`/`cancelling`, start/cancel methods, and the
  terminal Disconnect barrier without changing C1.1 authorization or revoke modules.
- Real composition creates the Import facade and connection store in `js/app/source-manager.js`;
  Demo constructs neither a connection controller nor any live capability. The same listed
  composition root can inject Import, mapper, artifact, reader, Token, clock, and C2 seams only in
  Real mode.
- One current ordering collision is contained: the page initializes the connection before the Import
  facade and can render connection actions while Import initialization is still pending. C3c must
  keep Sync disabled until its injected Import/sync controller is ready. The listed app/page/provider-
  sync files are sufficient; no root, Import, Worker, or public API edit is required.

### R2 — exact Token and C2 authority can be shared without changing C1.1 or Storage

- Merged `auth-lifecycle.js` validates exactly the five Token fields and ordered scopes, but its
  deliberately narrow `inspectTokenAuthority()` exposes only status and subject. C3c therefore must
  not expand that C1.1 API. The new dedicated connector can snapshot and exact-validate the injected
  `strava_tokens` value, keep the credential only in its same-origin authorization boundary, and
  expose only a detached subject/scope authority to the orchestrator.
- `createSourceConnectionStore` is already exported by the frozen Storage index. Its `getConnection`
  and `transitionConnection` methods provide the exact immutable identity, connected/error recovery,
  connected-to-connected monotonic `lastSyncAt`, reconnect-required, and stale-revision CAS behavior.
  The existing store instance can be shared by injection from the listed composition root.
- The public connection UI snapshot intentionally contains no subject or revision. Provider sync
  must use the injected Token snapshot and exact C2 record, not DOM state. Subject equality is checked
  before constructing/calling the reader. No schema, SourceConnection store/index, Backup, Legacy
  connector, or auth-lifecycle change is required.
- Merged C2 Backup still retains only the immutable restored subject and projects credential-
  dependent state to reconnect-required. C3c neither reads Backup directly nor writes/rebinds the
  subject, so `D-C3c.R-A` remains contained.

### R3 — merged C3a and C3b accept the bounded reader output directly

- `createStravaImportMapper` is a side-effect-free direct export from
  `js/connectors/strava/strava-import-mapper.js`. It requires the exact session/C2 authority, accepts
  the exact ordered `{ summary, detail, streams }` array, preserves opaque IDs and input order, and
  freezes the existing ceilings of 100 activities, two later-orchestrator activity operations,
  200,000 stream points, and 10,000 laps.
- `createStravaProviderArtifacts` is a side-effect-free direct export from
  `js/import/strava-provider-artifact.js`. It accepts 1..100 ordered bundles, permits the ten mapped
  value series plus the time offsets, and freezes 32 MiB per artifact/job, 200,000 points, and 10,000
  laps. The C3c 25-activity/32-MiB bounds fit without editing C3a or C3b.
- The listed composition/provider-sync modules may import and inject those already merged factories
  directly. They do not need a new public Import export, Worker registry/protocol change, Repository,
  schema, migration, or persistence path.

### R4 — the existing Import facade and public report are sufficient after one literal correction

- The Real Import facade already exposes `importArtifacts`, `cancelJob`, `getReport`, `waitForJob`,
  and `close` over the single existing ImportService. The provider-sync controller can receive only
  those injected methods, submit the complete descriptor array once, and keep the active job ID
  controller-local. Page close already awaits connection close before Import close, which lets C3c
  abort acquisition and request active-job cancellation before the Import barrier drains.
- The public report has exact totals `total`, `completed`, `reviewRequired`,
  `skippedExactDuplicate`, `failed`, and `cancelled`; it has no separate `accepted` field. The frozen
  predicate is therefore recorded literally as
  `completed + reviewRequired + skippedExactDuplicate === total`, together with total at least one,
  failed/cancelled zero, every item in the three accepted outcomes, and either completed job status.
  This is a Task-Brief clarification, not an Import API or behavior change.
- Existing cancellation keeps completed work, and `waitForJob` yields the terminal public report.
  Empty acquisition creates no job. Quota, cancellation, nonaccepted items, stale C2 CAS, pagehide,
  close, and write failure can all leave committed items intact while withholding `lastSyncAt`.

### R5 — the dedicated route fits current CSP, Service Worker, and privacy boundaries

- Source Manager CSP already permits same-origin connections only. The Service Worker accepts only
  allowlisted static GET requests and bypasses POST, sensitive authorization headers, query/hash,
  and unlisted paths, so `/api/strava-sync` is network-only without a CSP or Service Worker edit.
- Platform `api/*.js` discovery supplies the deployed route. The excluded local-development server
  has no claim to support C3c and requires no routing/configuration change; deterministic server tests
  can invoke the handler directly as existing C1.1 tests do.
- The Legacy routes and `_shared.js` helper are broader, URL-ID based, and do not enforce the frozen
  per-operation timeout/byte/reduction contract. C3c must leave them untouched and implement the
  exact POST operation validation, provider paths, status mapping, timeouts, response reduction, and
  fixed no-store responses wholly inside the new listed route and connector.
- The listed privacy tests can extend the existing no-raw-log, same-origin, no-cache, no-DOM-secret,
  and synthetic-only evidence gates. No shared logger expansion is required; the new route must not
  emit raw input/provider values.

### R6 — the exact 19-path maximum is collision-free

- The literal block parses to exactly 19 paths and 19 unique paths in the delegated order. Fourteen
  paths already exist and the only five new paths are
  `js/app/source-manager-provider-sync.js`,
  `js/connectors/strava/strava-sync-connector.js`, `api/strava-sync.js`,
  `tests/source-manager/source-manager-provider-sync.test.js`, and
  `tests/connectors/strava-sync-connector.test.js`.
- Every identified production edit is already listed. The sanitizer/root bootstrap, C1.1
  authorization/revoke/auth lifecycle, C2 store/index/Backup, C3a, C3b, ImportService/public index,
  Worker, Repository, Service Worker, CSP, routing, and dependency files remain read-only boundaries.
- No twentieth path, public/schema/dependency/Worker/Service Worker/CSP expansion, server routing or
  configuration change, different identity/Token semantics, unbounded provider behavior, or C4
  ownership requirement was found. Every stop condition remains mandatory if later implementation
  evidence proves otherwise.

## A2 local scope evidence

- The A2 working diff changes only this Task Brief. The literal maximum audit reports 19 paths and
  19 unique paths, with fourteen existing and the exact five expected new paths.
- The full A1 docs-only head passed syntax for 274 files, privacy, 1826/1826 tests, and
  `git diff --check`. The exact A2 gates are run again on the final Task-Brief-only content before
  publication and reported to the control tower rather than inferred here.
- No OAuth, Token, provider, account, private fixture, user browser/profile, server handler,
  application/test implementation, Storage, Import, Backup, Repository, Worker, Service Worker,
  migration, deployment, release, or integration-worktree action was performed.

## Explicit C3c A3 authorization package

The control tower may relay implementation authority only in a new explicit instruction that names
all of the following:

```text
C3c A3 authorized on the open Draft PR from its exact A2 head.
Implement only the frozen bounded provider sync contract in
docs/tasks/pr-43c-provider-live-sync.md, with the exact cumulative 19-path hard maximum.
Retain the merged C2 Backup subject solely for exact restored-subject reconnect.
Require exact five-field Token and exact connected C2 subject equality before provider I/O.
Use only POST /api/strava-sync -> merged C3a -> merged C3b -> existing ImportService.
Stop on any twentieth path, excluded-boundary expansion, different identity/Token semantics,
unbounded provider behavior, or C4 ownership requirement.
Run the exact local and exact-head CI gates; keep the PR open and Draft.
No real/private provider evidence, Ready, merge, cleanup, deploy, or release.
```

Until that explicit authorization is relayed from the exact A2 head, no production or test
implementation is authorized.
