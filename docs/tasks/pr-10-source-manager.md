# PR-10: Source Manager Foundation UI

## Metadata

| Field | Value |
| --- | --- |
| Status | Implementation, local/browser gates, and Final Review passed; exact-head CI and Ready transition pending |
| Milestone | M7 |
| Base branch | `integration/v2` |
| Exact base SHA | `065dbd0475739a594ae1ce3dcf34b025a71b6318` |
| Feature branch | `codex/v2/source-manager` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/5881/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-09 / PR #15 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Deliver one browser-usable, same-origin Source Manager vertical slice without
changing the existing application bootstrap or its Legacy-first read behavior:

```text
empty V2 library / explicit same-origin entry
-> First-run message and four Source Cards
-> shared CSV/ZIP Import Dialog
-> bounded File preflight and safe anonymous labels
-> existing ImportService.importArtifacts()
-> real persisted ImportJob / ImportItem progress and cancellation
-> stable redacted Import Report
-> persisted Import Log after reload
-> aggregate Activities Preview
```

The production page accepts deterministic synthetic `.csv` and `.zip` files by
file picker or drag and drop. FIT, TCX, and GPX are visible as later formats but
remain unsupported. This PR does not add a Decoder, change Canonical defaults,
or wire a site-wide navigation/cutover.

## A0 baseline evidence

- The assigned isolated worktree began detached and clean at exact SHA
  `065dbd0475739a594ae1ce3dcf34b025a71b6318`; local `integration/v2`,
  `origin/integration/v2`, and starting HEAD matched with ahead/behind `0/0`.
- GitHub PR #15 is closed and squash-merged. Its base/head were
  `integration/v2 <- codex/v2/strava-zip`; its merge commit is the exact fixed
  base.
- GitHub Actions run `30972290407` used event `push`, branch
  `integration/v2`, and exact head SHA `065dbd0475739a594ae1ce3dcf34b025a71b6318`;
  it completed successfully.
- The merged M6 local and remote branch `codex/v2/strava-zip` is absent, no M6
  worktree remains, and the locked long-lived v2 worktree is clean with
  local/origin `0/0`.
- Baseline `npm ci`: PASS; syntax: PASS for 181 files; privacy: PASS; full suite:
  PASS 1,118/1,118; `git diff --check`: PASS.
- No real athlete data, file, archive, account, credential, Token, route,
  location, health/power record, private fixture, screenshot, browser profile,
  or provider request was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR targeting `integration/v2`. No
implementation path may be staged before the docs-only commit and Draft PR
exist.

## A2 read-only findings

### Existing Import and V2 read boundaries

- PR-07 owns `createImportService()` and the durable state machine, Worker
  client, exact SHA decision, atomic per-item Canonical transaction, retry,
  cancellation, `getReport()`, `waitForJob()`, and aggregate
  `previewActivities()`.
- PR-08 owns fatal UTF-8/CSV framing. One CSV data row becomes one RawArtifact
  and ImportItem, so a bad semantic row does not contaminate later rows.
- PR-09 owns strict ZIP/base64/container inspection, exact root
  `activities.csv`, row expansion, and opaque child association. FIT/TCX/GPX
  bytes in an accepted archive remain opaque.
- `createImportStore()` exposes the already-reviewed V2 Import Log boundary
  `listImportJobs()`. The composition root may use only this method to discover
  persisted job IDs after reload, then obtain every public report through
  `ImportService.getReport()`. The page renderer never imports Storage or opens
  IndexedDB itself.
- ImportService does not expose pre-import raw hash lookup. PR-10 therefore does
  not read RawArtifact records or reproduce duplicate logic. The dialog states
  that exact duplicate checking runs at import start; the real pipeline outcome
  `skipped_exact_duplicate` is shown as soon as the job report exposes it.
  Moving this result before the user starts import would require a new public
  Import preflight API and is a task pause condition, not an implicit expansion.
- Reports expose only schema version, job status, safe totals, item ordinal,
  outcome, stable error code, and retryability. Activities Preview exposes only
  total and per-sport counts. Neither boundary provides filenames, paths,
  activity IDs, payloads, locations, or health values.

### UI and navigation call graph

The existing root application path is not a safe PR-10 execution surface:

```text
index.html
-> external chart/map/calendar CDNs and existing telemetry
-> js/app/main.js
-> Legacy auth and Repository startup
-> existing tab shell
```

Adding Source Manager to that shell would mix a local-only UI task with auth,
external network, telemetry, current-tab navigation, and a large page DOM. It
would also make the required zero-external-request browser evidence impossible
without changing unrelated production behavior.

Three candidates were compared:

| Candidate | Accessibility / execution | Offline and privacy | Scope / rollback | Decision |
| --- | --- | --- | --- | --- |
| Independent same-origin page | Direct stable URL, semantic landmarks/dialog, keyboard and narrow-screen control | Loads only same-origin HTML/CSS/ESM/Worker and V2 IndexedDB | Additive files; no existing shell change | Selected |
| Entry inside existing shell | Familiar tab navigation | Inherits external resources, telemetry, auth, and Legacy startup | Touches hotspot shell and raises regression surface | Rejected for PR-10 |
| New minimal route in current router | Could expose a friendly path | Current router is for activity details and provider-backed shell behavior | Reframes routing contract and risks site-wide semantics | Rejected for PR-10 |

Selected production call graph:

```text
/source-manager.html
-> /styles/source-manager.css
-> /js/source-manager.js (thin browser entry)
-> /js/app/source-manager.js (composition root)
   -> createImportStore(existing public storage entry)
   -> createBrowserImportWorker(existing public Import entry)
   -> createImportService(existing public Import entry)
   -> listImportJobs only for reload discovery
-> /js/pages/source-manager/source-manager.js (injected UI consumer)
   -> file picker / drag-drop preflight
   -> ImportService façade only
   -> safe DOM rendering
```

No root `index.html`, current tab navigation, auth module, Repository Factory,
feature-flag default, provider Connector, Service Worker, or API file changes.

### File intake and browser execution surface

- The shared dialog accepts at most 100 files per selection. The only accepted
  extensions are lowercase-normalized `.csv` and `.zip`; extension is only the
  first signal.
- CSV is limited by the existing `ACTIVITIES_CSV_LIMITS.maxUtf8Bytes`. File
  bytes go through existing fatal UTF-8 decode and existing CSV framing before
  ImportService receives the unchanged whole CSV text. Required exact English
  headers remain owned by the existing decoder.
- ZIP is bounded by the existing `STRAVA_ZIP_LIMITS.maxArchiveBytes`. Preflight
  checks the byte signature `PK\x03\x04`; the existing PR-09 inspector remains
  authoritative for EOCD, central/local headers, CRC, paths, sizes, ratio,
  encryption, manifest, decompression, and child association.
- The page converts accepted ZIP bytes to the already-frozen strict padded
  base64 artifact and calls `importArtifacts()`. It does not inspect entries,
  copy ZIP logic, parse a Decoder format, or operate an object store.
- File objects, names, paths, and parent ZIP/CSV bytes are held only in memory
  until handed to the existing pipeline. The UI never stores them in Web
  Storage, a shadow store, logs, errors, DOM attributes, or evidence.
- User filenames are never rendered. Safe labels are only `CSV file N` and
  `ZIP file N`, derived from selection ordinal and accepted format. The native
  file input is visually hidden and reset after intake so its browser filename
  presentation is not retained.
- `.fit`, `.tcx`, and `.gpx` always produce the stable safe copy
  `This format is not supported yet. FIT, TCX, and GPX support will be added later.`
  No bytes enter ImportService for those files.

## A3 frozen decision

The selected vertical slice fits the existing Import, V2 Storage, Canonical,
and Worker boundaries. It needs no production dependency, public Import method,
Repository method, store/index/schema migration, Decoder, provider behavior,
Service Worker, external resource, telemetry, or current-shell modification.
Implementation is authorized only after the A1 docs-only Draft PR gate.

### Stable session and source states

The page determines one session mode from the URL at startup:

- absent `mode` or exact `mode=real` -> `real`;
- exact `mode=demo` -> `demo`;
- every other value -> stable blocking `INVALID_SESSION_MODE` before storage,
  Worker, or DOM event wiring.

Real mode may initialize the V2 Import boundary and import user-selected local
files. Demo mode is presentation-only in PR-10: it shows the four cards and an
explicit `Demo import is not available in this milestone.` notice, but creates
no real Import store/Worker, reads no provider or Token state, and accepts no
files. This prevents Demo from falling back to Real data while avoiding an
unapproved Demo seed/public Import API contract.

Source Card states are the literal UI set:

```text
not_configured
available
importing
success
error
```

- Local Files and Strava Archive begin `available`, become `importing` during a
  real job, then `success` or `error` from the real final report.
- Strava API is `not_configured`; its connect action is disabled and makes no
  network request. A disabled separate Disconnect control and adjacent copy
  state that deleting local data is a different, unavailable action.
- Demo is `available` in Demo mode and `not_configured` in Real mode; its notice
  performs no persistence or provider operation.

First-run is only the safe empty-library state where
`previewActivities().total === 0`. It never connects, imports, migrates, clears,
deletes, or invokes a provider automatically. A non-empty library shows the same
Source Manager without the First-run message.

### Stable UI errors and safe copy

UI preflight codes are the exact set:

```text
FILE_TYPE_UNSUPPORTED
FILE_HEADER_INVALID
FILE_TOO_LARGE
TOO_MANY_FILES
FILE_READ_FAILED
DEMO_IMPORT_UNAVAILABLE
INVALID_SESSION_MODE
```

Existing Import error codes may be displayed verbatim only when they are values
of `IMPORT_ERROR_CODE`; each maps to fixed local copy. Unknown thrown values,
platform messages, getters, causes, stacks, bodies, filenames, paths, rows,
entries, IDs, and payloads map to `IMPORT_FAILED` and
`The import could not be completed.` without inspection or interpolation.

Success and duplicate copy are literal:

```text
Import completed.
Import completed with warnings.
This file was already imported exactly; no second activity was created.
Import cancelled. Completed items were kept.
```

### Import façade contract

The injected UI façade is exact and contains only:

```text
initialize()
importArtifacts(artifacts)
cancelJob(jobId)
getReport(jobId)
waitForJob(jobId)
previewActivities()
listPersistedReports()
close()
```

`listPersistedReports()` is app-composition glue, not a new ImportService API:
it calls the existing Import Store `listImportJobs()`, retains job IDs only in
the closure, and calls existing `getReport()` for detached redacted reports.
The page receives no Store, Repository, object-store handle, RawArtifact,
Canonical record, job ID list, or Token boundary.

Progress is never simulated. The page polls `getReport(jobId)` while the real
job is active and derives completed count solely from terminal item outcomes.
The stage label is the real job status. Cancellation calls only
`cancelJob(jobId)` and waits for the persisted report. Retry is not exposed in
this foundational UI because current retry is job-level and this task does not
change its contract.

### Accessibility and layout contract

- Semantic `main`, headings, labelled Source Cards, a native `dialog`, explicit
  file-input label, drag/drop alternative, and native buttons are required.
- Dialog open moves focus to its heading/first actionable control. Closing
  returns focus to the Source Card action that opened it.
- Escape and the visible Cancel/Close buttons close only an idle dialog; an
  active import requires the explicit `Cancel import` action.
- A polite live region announces selection/preflight changes; a separate
  assertive region announces errors. Import status and progress use labelled
  `status`/`progress` semantics.
- Keyboard activation must reach the picker without drag-and-drop. Dropzone
  hover/drag styling is never the sole state signal.
- At widths down to 320 CSS pixels, cards, dialog, report filters, cancel, close,
  and import actions remain visible without horizontal page scrolling.

## Approved literal allowlist

### A3: Task Brief publication

```text
docs/tasks/pr-10-source-manager.md
```

### B1: production same-origin page and injected UI boundary

```text
source-manager.html
styles/source-manager.css
js/source-manager.js
js/app/source-manager.js
js/pages/source-manager/source-manager.js
```

### B2: deterministic consumer and boundary tests

```text
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
```

### B3: durable browser harness

```text
tests/source-manager/source-manager-browser-smoke.html
```

The cumulative maximum is exactly nine paths. A tenth path requires a necessity
record in this Task Brief before modification and must remain inside the frozen
PR-10 product scope. Scope checks use this literal list, never current diff
output, a directory glob, dynamic expectation, skip, or bypass.

## Prohibited scope

- Package/lockfile, production dependency, `api/**`, Repository file/export/
  method/Factory mode, Accepted Canonical contract, storage schema/store/index/
  migration/record field, public/aggregate Import API, Decoder/ZIP/CSV core, or
  Service Worker change.
- Root `index.html`, current app bootstrap/navigation/tab/detail/analysis files,
  feature-flag defaults, Canonical cutover, local-first bootstrap, dashboard
  cutover, or existing Legacy read semantics.
- FIT/TCX/GPX/XML/gzip Decoder, provider connection/auth/Token behavior, external
  CDN, telemetry, network request, backup/restore, merge review, destructive
  delete/clear/disconnect coupling, or cleanup.
- UI direct IndexedDB/object-store access, RawArtifact/private payload reads,
  duplicate reimplementation, filename/path persistence, Web Storage shadow
  state, background retry, fake progress, or raw error interpolation.
- Real credentials, accounts, Tokens, browser profiles, Strava exports, athlete
  data, GPS, locations, heart-rate/power, private fixtures, screenshots in Git,
  or provider/network-backed tests.

## Test matrix

Deterministic Node consumer/boundary tests must prove:

- production modules import with zero DOM, Worker, IndexedDB, storage, Token,
  provider, network, console, timer, or file I/O;
- invalid and Demo session modes perform zero Real storage/Worker/provider work;
- empty preview produces First-run and non-empty preview produces Source Manager;
- exactly four Source Cards and the frozen source/status/action copy;
- picker and drop selection, CSV success, ZIP success, invalid header/signature,
  unsupported FIT/TCX/GPX, file size, file count, and safe anonymous labels;
- true pipeline progress/status/report, exact duplicate, one failed item followed
  by success, cancellation, persisted reports after reload, and aggregate
  Activities Preview;
- no second Canonical activity on duplicate; missing/null/zero and opaque IDs
  remain owned by the existing pipeline and no detail graph is fabricated;
- no Token/Authorization/provider/Legacy keys, direct IndexedDB, RawArtifact,
  private filename/path/payload, raw error/cause/stack/row/entry, telemetry, or
  external URL in production Source Manager sources;
- input accessors/Proxies and thrown private messages fail closed without getter
  execution or disclosure; DOM text/attributes never receive a raw filename;
- keyboard controls, focus-return hooks, labelled live regions/status/progress,
  Escape/active-cancel rules, and the 320px critical-action CSS contract;
- exact nine-path allowlist, no prohibited path, unchanged Import aggregate
  exports, Repository seven-method boundary, physical V2 version/stores/indexes,
  current Feature Flag defaults, and Service Worker source hash.

The durable browser harness and an external disposable-profile driver exercise
the actual served `/source-manager.html` path with native `File`, picker-equivalent
and `DataTransfer` drop input, native ESM, module Worker, Web Crypto, real
IndexedDB, deterministic synthetic CSV and code-generated ZIP, cancel, reload,
Import Log, and Preview. It records only safe codes/counts and DOM assertions.

Browser evidence must record:

```text
external HTTP(S) requests                 0
provider/API requests                     0
Token/Authorization observations          0
XHR / WebSocket                           0
telemetry                                 0
console warning/error                     0
uncaught/unhandled exceptions             0
Service Worker registrations              0
Cache Storage entries                     0
```

It also inventories the V2 physical version, store/index names, safe record
counts, and a synthetic Legacy-like sentinel before/after. Evidence and the
disposable profile remain outside the repository. All pages, Workers, database
connections, browser sessions, servers, and ports are closed.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/source-manager/*.test.js
node --test tests/import/*.test.js
node --test tests/storage/*.test.js
npm test
git diff --check
```

The PR exact implementation and closure heads must pass GitHub Actions. A
depth-1 checkout/CI boundary test must not derive its expected scope from the
working diff or require Git history deeper than the base/head comparison
available to the review step.

## Privacy, migration, rollback, and limitations

Only deterministic synthetic CSV/ZIP bytes are used by automated and browser
verification. Filenames are anonymous ordinals in the UI and absent from
reports/evidence. No raw parent file is persisted by UI shadow state; the
existing pipeline remains the sole owner of its already-reviewed row-scoped
RawArtifacts and Canonical writes.

There is no physical or data migration. V2 stays at version 2 with eleven stores
and nine indexes. Legacy and existing V2 records are never cleared, deleted,
overwritten, reverse-copied, or repaired by the UI.

Rollback is code-only: close the Source Manager ImportService, stop using the
additive same-origin page, and revert PR-10. Existing V2 Import Logs,
RawArtifacts, Canonical records, and all Legacy data remain. The existing root
app, Service Worker policy, and Legacy-first default remain unchanged before,
during, and after rollback.

Intentional limitations are: independent `/source-manager.html` entry rather
than site-wide navigation; CSV/ZIP only; FIT/TCX/GPX, Strava API connection,
Demo seed import, destructive data actions, retry UI, full per-file filename
presentation, Canonical page cutover, and general local-first bootstrap remain
future separately approved work.

## Implementation and verification ledger

### Publication and scope

- The docs-only commit is
  `391c688304cf45d9f6fe3a5bd9b0ea58ff2f5d80` on
  `codex/v2/source-manager`; Draft PR #16 targets `integration/v2`.
- B1-B3 changed only the exact nine frozen paths. Package files, API,
  Repository, Import exports, storage schema/store/indexes, Decoder/ZIP core,
  Service Worker, current shell, navigation, analysis, tabs, and detail
  consumers remain unchanged.
- The page is additive at `/source-manager.html`. The root application and its
  Legacy-first/default read path are unchanged.

### Local deterministic gates

Executed after implementation on 2026-08-05:

```text
npm ci                                      PASS (6 packages)
npm run check:syntax                        PASS (186 files)
npm run check:privacy                       PASS
node --test tests/source-manager/*.test.js  PASS (16/16)
node --test tests/import/*.test.js          PASS (71/71)
node --test tests/storage/*.test.js         PASS (54/54)
npm test                                    PASS (1,134/1,134)
git diff --check                            PASS
```

One exploratory focused command used stale guessed filenames and therefore
did not select tests; it was immediately replaced by the required literal
Import/Storage wildcard commands above. No test was skipped or waived.

### Served-path browser evidence

The final clean-origin run served the repository on loopback port 43116 and
used headless Chrome with a new temporary profile. A CDP driver enabled Page,
Network, Runtime, and Log domains before navigation, then loaded the real
same-origin page, native ESM, module Worker, Web Crypto, and IndexedDB. It
passed picker-equivalent CSV, explicit `DataTransfer` ZIP drop, exact duplicate,
unsupported FIT, invalid ZIP, real cancellation, reload, persisted Import Log,
Activities Preview, Demo/Real isolation, and the synthetic Legacy-like sentinel
check.

The run recorded 2 Canonical activities, 2 activity-source associations, 4
Import Jobs, and no fabricated streams, laps, events, or devices. V2 remained
physical version 2 with exactly eleven stores and nine indexes. Reload report
rendering is bounded to 100 visible items per report while persisted totals
remain exact.

Harness-observed unsafe browser counters were zero: external HTTP(S), provider,
telemetry, application-frame Fetch/XHR, and the served-production-source audit
for WebSocket and Authorization/Token use. The pre-navigation CDP driver
separately reported zero external HTTP(S), Authorization header, provider,
telemetry, WebSocket, application data request, console warning/error, Runtime
exception, and Log warning/error events. Service Worker registrations and Cache
Storage entries were also zero.
The 320-by-720 CSS-pixel run had four cards, First-run, both critical import
actions visible, and no horizontal overflow. Opening the dialog focused its
heading; closing returned focus to the originating Local Files button. Polite
and assertive live regions and the keyboard-focusable drop alternative were
present.

Synthetic-only evidence is outside Git at:

```text
/private/tmp/pr10-source-manager-browser-smoke.json
/private/tmp/pr10-source-manager-browser-smoke.png
/private/tmp/pr10-source-manager-320.json
/private/tmp/pr10-source-manager-320.png
```

All browser tabs and loopback servers were closed after capture. No real user
profile, account, Token, private fixture, athlete data, provider request, or
external network was used.

### Independent Final Review

The independent exact-base/staged-diff review initially found three actionable
issues: unknown persisted report codes could reach DOM text, the browser harness
claimed some unobserved startup counters, and the file input lacked an explicit
label. Focused regressions reproduced the contract gaps. The final diff now:

- uses `IMPORT_ERROR_CODE` as a dedicated persisted-report allowlist and maps
  private, unknown, accessor, and preflight-only codes to `IMPORT_FAILED`;
- limits harness counters to observed signals and requires a pre-navigation CDP
  driver for startup console/exception/network evidence;
- gives the native file input the explicit label `Choose CSV or ZIP files`.

The diagnostic CDP run also reproduced one `/favicon.ico` network-log error;
same-origin data favicons now prevent that automatic request. Final independent
re-review reported no actionable findings, Source Manager 16/16, and staged
diff check PASS.

### Pending closure-only gates

- push the implementation head and observe exact-head GitHub Actions success;
- update the PR body/ledger, re-run exact-head closure CI if the ledger changes,
  and move Draft PR #16 to Ready for review.

## Completion gate

After B1-B3, independently review the exact-base diff, UI/Import/storage call
graph, file intake, duplicate/cancel/reload behavior, redaction, accessibility,
browser evidence, and literal allowlist. Reproduce every actionable defect with
a focused failing test before repair. Only after no actionable findings, all
local gates, complete Closure/PR body, clean worktree, local/upstream `0/0`, and
exact-head CI success may the Draft PR move to Ready for review.

Do not merge, modify `integration/v2`, delete the task branch/worktree, or start
M8.
