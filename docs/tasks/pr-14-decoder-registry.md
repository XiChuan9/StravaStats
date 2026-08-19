# PR-14: Decoder Registry Wiring

## Metadata

| Field | Value |
| --- | --- |
| Status | Implementation and review complete; closure head pending exact-head CI and Ready transition |
| Milestone | M11 |
| Base branch | `integration/v2` |
| Exact base SHA | `76846965023c6a049df4d6a02015ccf54a9994c3` |
| Feature branch | `codex/v2/decoder-registry` |
| Worktree | `<worktree-root>/<task-name>` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-13 / PR #19 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Wire the already-reviewed FIT, TCX, and GPX Decoder seams into the existing
production import graph without copying decoder logic or changing a public
contract:

```text
served Source Manager local-file intake
-> bounded extension / MIME / content-signature preflight
-> existing strict artifact descriptor
-> existing ImportService validation / exact content hash
-> existing module Worker
-> one central Decoder Registry
-> existing FIT / TCX / GPX Decoder
-> existing Normalizer / ImportedActivityBundle validator
-> existing exact-duplicate and atomic Import Store transaction
-> persisted Import Log and aggregate Activities Preview
```

CSV and Strava ZIP keep their current framing, container inspection, Decoder
selection, priority, limits, duplicate semantics, and output behavior.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `76846965023c6a049df4d6a02015ccf54a9994c3`.
- Starting `HEAD`, local `integration/v2`, and `origin/integration/v2` matched
  the exact base; local/remote ahead/behind was `0/0`.
- The locked long-lived `integration/v2` worktree was clean at the same SHA.
- GitHub PR #19 is merged; its merge commit is the exact base. No local or
  remote `codex/v2/decoder-gpx` branch and no GPX feature worktree remained.
- No local or remote `codex/v2/decoder-registry` branch existed before this
  assigned worktree created it from the exact base.
- Baseline gates passed: `npm ci`; syntax for 195 files; privacy; full suite
  1,258/1,258; and `git diff --check`.
- No real activity file, account, Token, route, health/power stream, export,
  private fixture, screenshot, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with
`integration/v2 <- codex/v2/decoder-registry`. No implementation path may be
staged, committed, or pushed before the docs-only commit and Draft PR exist.

The local `gh` credential is invalid, while the GitHub App can read the
repository. Publication uses the GitHub App after the branch is pushed. If the
App write returns 403, the exact PR title/body/base/head/SHA handoff goes to the
control tower; no user Chrome login state or browser profile may be used.

## A2 read-only findings

Authority order is:

1. Accepted ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006;
2. `docs/product/stravastats-v2-prd.md`;
3. the PR-14 entry in `docs/engineering/v2-development-plan.md` and release
   gates;
4. architecture overview, fixture policy, test strategy, and regression matrix;
5. the existing Canonical, Import Core, Storage, Source Manager, CSV, and ZIP
   contracts;
6. PR-07, PR-10, PR-11, PR-12, and PR-13 Task Briefs and tests;
7. this frozen task contract and implementation details.

### Actual production call graph

The current served path is:

```text
/source-manager.html
-> js/source-manager.js
-> js/app/source-manager.js
-> createImportStore / createBrowserImportWorker / createImportService
-> js/import/synthetic-import-worker.js
-> createDecoderRegistry([
     syntheticJsonDecoder,
     activitiesCsvDecoder,
     stravaArchiveRowDecoder
   ])
-> normalizeImportedActivity
-> Import Store atomic transaction
-> Import Log / Activities Preview
```

`ImportService` separately freezes the same three child artifact media types.
`js/storage/import-store.js` accepts the same three media types when validating
RawArtifact records. Source Manager reads and accepts only `.csv` and `.zip`;
it rejects `.fit`, `.tcx`, and `.gpx` before reading their bytes.

The three later Decoder modules are therefore internal seams only:

```text
js/decoders/fit/decoder.js  -> fitDecoder
js/decoders/tcx/decoder.js  -> tcxDecoder
js/decoders/gpx/decoder.js  -> gpxDecoder
```

They have the existing exact Registry descriptor fields `id`, `mediaType`, and
`decode`; accept exact `{ mediaType, content }`; return one validated frozen
`ImportedActivityBundle`; and are currently imported only by focused tests.

### Existing transport and container behavior

- FIT accepts strict padded base64 at
  `application/vnd.ant.fit;base64`; Source Manager must base64-encode the exact
  file bytes without modifying Decoder semantics.
- TCX accepts strict UTF-8 XML text at
  `application/vnd.garmin.tcx+xml`.
- GPX accepts strict UTF-8 XML text at `application/gpx+xml`.
- CSV is fatal-UTF-8 decoded, structurally framed into one artifact per row,
  and decoded through its existing media type.
- ZIP remains a strict Strava archive container. Its existing EOCD, CRC, path,
  compression, size/count, timeout, and child-row behavior remain authoritative.
  M11 does not decode arbitrary FIT/TCX/GPX children inside a ZIP and does not
  accept gzip or nested containers.

### Existing lifecycle behavior retained

- Import cancellation remains allowed only at the frozen PRD boundaries;
  hashing cancellation stays latched until decoding. Persisting and analyzing
  remain non-cancellable finalization phases.
- A Worker crash remains redacted, persisted, and explicitly retryable.
- Exact duplicate remains exact SHA-256 over the stored transport content plus
  exact byte length/media/content verification. Deterministic base64 makes the
  same FIT bytes the same artifact; XML text remains exact-text identity.
- Every Canonical write still passes `validateImportedActivityBundle` and the
  same per-item nine-store transaction. No partial activity is written.
- Import Report stays ID/payload/filename-free. Activities Preview remains an
  aggregate count projection and exposes no activity graph.
- Demo creates no Real Import Store or Worker. Source Manager Real mode remains
  the only served M11 file-import surface.

## A3 frozen decisions

### Registry and API decision

Use the existing internal Registry and Worker seam. Register the three existing
Decoder descriptor objects once in the same central Registry instance that
already owns Synthetic JSON, CSV, and ZIP-row selection. Extend the existing
internal ImportService and RawArtifact media allowlists by the same three exact
media types.

No new public Import export, method, Registry method, Repository method,
Canonical field, Storage field/store/index/version, migration, package, Worker
message shape, or Decoder signature is required. `js/import/index.js` remains
byte-for-byte unchanged. The three Decoder implementations are reused and are
not copied or modified.

### Local-file detection trust and priority

The Source Manager uses an all-signals-agree policy:

1. A literal case-insensitive extension allowlist (`csv`, `zip`, `fit`, `tcx`,
   `gpx`) selects the pre-read resource budget. An absent/unknown extension is
   `FILE_TYPE_UNSUPPORTED` and its bytes are not read.
2. An empty, generic, or platform-variable MIME is only advisory. A recognized
   format-specific MIME that contradicts the extension fails
   `FILE_HEADER_INVALID`; MIME never overrides extension or authorizes a file.
3. After one bounded read, content is authoritative: ZIP requires existing
   `PK\x03\x04`; FIT requires a 12/14-byte header candidate and exact `.FIT`
   magic at bytes 8-11; TCX/GPX require fatal UTF-8 plus an exact resolved root
   local name/core namespace signature; CSV requires its existing strict
   English activities header/profile.
4. A recognized extension, recognized MIME, and recognized content signature
   must agree. Conflicting or multiple recognized signatures fail closed as
   `FILE_HEADER_INVALID`; the file is never silently reclassified.

Preflight identifies transport only. The selected Decoder remains the sole
authority for complete FIT framing/CRC/profile validation, XML lexical/
namespace/semantic validation, and all Decoder resource bounds.

### Size, resource, and container bounds

| Surface | Bound | Owner |
| --- | ---: | --- |
| files per selection | 100 | existing Source Manager |
| CSV UTF-8 bytes | 5,242,880 | existing CSV limits |
| Strava ZIP bytes | 67,108,864 | existing ZIP limits |
| raw FIT bytes | 16,777,216 | existing FIT Decoder limit |
| TCX UTF-8 bytes | 16,777,216 | existing TCX Decoder limit |
| GPX UTF-8 bytes | 16,777,216 | existing GPX Decoder limit |

Every deeper FIT/XML/ZIP count, depth, width, point, entry, compression, and
time bound remains owned by its existing implementation. `.gz`, gzip magic,
generic ZIP-as-file-bundle, nested archives, and a ZIP child Decoder expansion
remain unsupported. No decompressed or decoded resource may bypass an existing
Decoder/container bound.

### Error mapping

| Condition | Source Manager preflight | Direct Import/Worker/Decoder |
| --- | --- | --- |
| unknown/absent extension | `FILE_TYPE_UNSUPPORTED` | `UNSUPPORTED_FORMAT` for unregistered media |
| recognized signal conflict/ambiguity | `FILE_HEADER_INVALID` | registered Decoder fails `FILE_CORRUPTED` |
| empty file/content | fixed safe empty/header copy | existing `FILE_EMPTY` |
| over preflight byte bound | `FILE_TOO_LARGE` | existing Decoder/container fail-closed code |
| malformed registered content | artifact reaches Decoder | static format error, normally `FILE_CORRUPTED` |
| Worker/platform failure | n/a | `WORKER_CRASHED` with no cause/payload |

No new public error code is introduced. UI copy is static and never includes a
filename, MIME, root name, XML, byte, ID, cause, stack, coordinate, health, or
power value.

### Source Manager support-state rule

The Local Files card and picker copy may list FIT/TCX/GPX as supported only in
the same implementation head that proves the complete served path. Strava
Archive remains CSV/ZIP only. Demo and Strava API states remain unchanged.

## Literal implementation allowlist

Only these fifteen paths may change:

```text
docs/tasks/pr-14-decoder-registry.md
source-manager.html
js/import/decoder-registry.js
js/import/synthetic-import-worker.js
js/import/import-service.js
js/storage/import-store.js
js/pages/source-manager/source-manager.js
tests/import/decoder-registry-wiring.test.js
tests/import/import-worker.test.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/source-manager/source-manager.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
```

The maximum is the literal union above: fifteen paths. A sixteenth path needs a
necessity record in this Task Brief before modification and must remain inside
M11. The scope/phase harness uses this literal list, never current diff output,
a directory glob, a generated allowlist, a skip, or a dynamic expectation.

The new harness must pass in both lifecycle states: before its first commit it
may exist as the exact expected untracked path; after commit/CI it must be
tracked. It must not require `HEAD^`, the exact base object, more than a depth-1
checkout, or a merge-base. This prevents a shallow checkout or pre-commit
untracked state from weakening/falsely failing the guard.

## Prohibited scope

- Package/lockfile/dependency, public Import API/export/method, Accepted ADR,
  Canonical contract/validator/schema, Storage schema/store/index/version/
  migration, GitHub workflow, Service Worker, deployment, or release change.
- Decoder implementation changes or copied FIT/TCX/GPX parsing logic; a new
  format, general MIME sniffer, general XML parser, gzip/container expansion,
  Strava ZIP child-file decoding, or multiple-bundle public contract.
- Repository/Factory, current root app/bootstrap/navigation, Canonical cutover,
  feature-flag default, page/tab/detail/analysis algorithm, provider/auth/Token,
  telemetry, backup/restore, fuzzy identity/merge, M12/PR-15, or UI redesign.
- Legacy or V2 deletion/clear/downgrade/repair/reverse-copy, overwrite recovery,
  raw error interpolation, hidden retry, fake progress, or cancellation that
  deletes a completed item.
- Real FIT/TCX/GPX/ZIP/CSV, account, credential, Token, export, route, location,
  health/power history, private fixture, committed screenshot, user browser
  profile, provider call, or external-network test.

## Test matrix

Test-first implementation must prove:

- the single production Registry has exact unique registrations for Synthetic
  JSON, CSV, ZIP row, FIT, TCX, and GPX; each selected Decoder is called exactly
  once and unknown media remains unsupported;
- FIT/TCX/GPX pass Worker -> ImportService -> Normalizer -> Canonical validator
  -> atomic Storage -> Import Log -> Preview using deterministic synthetic
  fixture builders already in the repository;
- CSV row framing and ZIP expansion/priority remain unchanged;
- extension case normalization, empty/generic/specific MIME, FIT magic, ZIP
  magic, XML root namespace, unsupported, ambiguous/conflicting, malformed,
  empty, and every format preflight size boundary and `+1`;
- no gzip/nested/container bypass and no arbitrary FIT/TCX/GPX ZIP child wiring;
- exact duplicate once/ten/concurrent, same-media hash collision, Canonical
  identity conflict, per-item failure isolation, quota rollback, reload,
  cancellation at frozen boundaries, real progress, Worker crash/retry, and no
  second activity;
- descriptor/file accessors, symbols, custom prototypes, reflection failures,
  Proxies, sparse arrays, hostile Worker results, and hostile storage errors fail
  closed with getter/value reads zero where the existing portable contract says
  so;
- input immutability, frozen/detached/JSON-safe output, redacted errors/reports,
  zero network/provider/auth/telemetry, and Demo/Real isolation;
- Import public exports, Repository surface, Canonical validators, physical V2
  version/stores/indexes, Feature Flag defaults, Service Worker source, package
  files, and all three Decoder source hashes remain unchanged;
- literal fifteen-path scope and pre-commit/post-commit depth-1-compatible
  harness lifecycle.

## Browser/CDP plan

Serve the actual `/source-manager.html?mode=real` path on loopback and use a
new disposable browser profile outside the repository. Use native `File` and
picker-equivalent/DataTransfer inputs built from deterministic synthetic FIT,
TCX, and GPX fixture builders. Exercise each through the actual Source Manager,
module Worker, Registry, ImportService, Web Crypto, real browser IndexedDB,
Normalizer/Canonical validation, atomic Storage, Import Log, and Activities
Preview. Exercise duplicate, malformed/ambiguous, cancel, reload, and Demo/Real
isolation without provider/auth state.

Record only safe counts/codes:

```text
external HTTP(S) / provider / auth requests       0
Authorization / Token observations                0
Fetch / XHR / WebSocket / telemetry                0
console warning/error / runtime failures           0
Service Worker registrations / Cache entries       0
V2 physical version/store/index names               exact existing values
Legacy-like sentinel before/after                    preserved
Import jobs/items/artifacts/activities/sources       safe counts only
```

Close database handles, Workers, tabs, CDP sessions, browser processes,
profiles, servers, and ports. Browser evidence stays outside Git. No existing
user Chrome profile or login state may be attached or inspected.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/import/decoder-registry-wiring.test.js
node --test tests/import/*.test.js
node --test tests/source-manager/*.test.js
node --test tests/decoders/*.test.js
node --test tests/contracts/*.test.js tests/storage/*.test.js
npm test
git diff --check
```

Run exact path audit against the frozen fifteen-path list. The docs-only,
implementation, repair, and closure heads each require exact-head pull-request
CI success before the next publication state. No failed or unrun gate may be
reported as passing.

## Privacy, migration, rollback, and Not run

Only deterministic synthetic fixtures already generated from invented literals
may be used. No private content may enter RawArtifact evidence, reports, DOM,
console, errors, screenshots, CI logs, or the PR body.

There is no database/schema/data migration. The existing physical V2 database,
stores, indexes, records, transaction shape, and Legacy database remain
unchanged. The additive code begins accepting three existing transport media
types through the already-reviewed write path.

Rollback is code/flag neutral: stop new FIT/TCX/GPX intake and revert this
fifteen-path PR while retaining all successfully imported V2 data, RawArtifacts,
Import Logs, and Legacy data. Never delete, clear, downgrade, repair, reverse-
copy, or overwrite data during rollback. Already imported Canonical activities
remain readable by existing V2 seams; the current root application remains
Legacy-first throughout M11.

Not run at A1: implementation-focused tests, served Source Manager browser/CDP,
exact implementation-head CI, independent Final Review, closure CI, and Ready
transition. They are mandatory later and are not implied by the clean baseline.

## Closure ledger

### Implementation and exact scope

- The implementation commit is
  `ef38aebf7ef85050555c619c46fd92b7113406a1`.
- The exact-base diff changes eleven of the fifteen allowed paths and no path
  outside the frozen literal allowlist:
  `docs/tasks/pr-14-decoder-registry.md`, `source-manager.html`,
  `js/import/synthetic-import-worker.js`, `js/import/import-service.js`,
  `js/storage/import-store.js`, `js/pages/source-manager/source-manager.js`,
  `tests/import/decoder-registry-wiring.test.js`,
  `tests/import/import-boundaries.test.js`,
  `tests/source-manager/source-manager.test.js`,
  `tests/source-manager/source-manager-boundaries.test.js`, and
  `tests/source-manager/source-manager-browser-smoke.html`.
- FIT, TCX, and GPX use their existing Decoder descriptors in the one central
  production Registry. No Decoder logic is copied and the public Import,
  Canonical, Storage-schema, package, Worker-message, Service Worker, Legacy,
  provider/auth, or deployment contracts change.
- Source Manager advertises the three formats only in the same implementation
  that proved their actual served intake path. CSV and Strava ZIP framing,
  selection, limits, and priority remain unchanged.

### Test-first and independent review evidence

- Minimal failing tests preceded Registry registration, end-to-end media
  acceptance, Source Manager transport detection, and truthful support copy.
- The first browser execution exposed a stale global report-row assertion; the
  correction retained the existing per-report maximum and passed on a fresh
  loopback origin.
- Independent read-only Final Review found two actionable P1 findings: a
  quadratic XML prolog scan and a scope guard that did not protect tracked
  paths outside the allowlist. New focused tests failed `19/21` with exactly
  those findings before the minimal repairs.
- The repaired XML root scan is index-based and bounded to 65,536 characters.
  The repaired scope guard hashes all tracked index entries outside the literal
  allowlist against a fixed baseline, is history-free/depth-1-compatible, and
  preserves its pre-commit/post-commit harness lifecycle.
- Fresh independent read-only re-review of the repaired exact-base diff found
  no actionable findings. The accepted residual bounds are intentional
  rejection of an XML root beyond the 64 KiB scan window and the requirement
  that final exact-path/worktree audits detect any unstaged protected edit.

### Local verification

All commands below completed successfully on the implementation head after the
review repairs:

```text
npm ci                                           6 packages installed
npm run check:syntax                             196 files passed
npm run check:privacy                            passed
decoder-registry focused                         9/9 passed
Source Manager focused                           20/20 passed
Import regression                               80/80 passed
Contract + Storage regression                    334/334 passed
Decoder regression                               124/124 passed
npm test                                         1271/1271 passed
git diff --check                                 passed
literal exact-path audit                         11/15 allowed paths
post-stage and post-commit scope harness          9/9 passed
```

### Served-path browser evidence

The reviewed smoke ran the actual served
`/source-manager.html?mode=real` path on fresh loopback origin
`127.0.0.1:43116` in the in-app disposable browser, not a user Chrome profile.
Deterministic synthetic CSV, ZIP, FIT, TCX, and GPX exercised Source Manager ->
Worker/ImportService -> Registry -> Decoder -> Canonical validation -> real
IndexedDB Storage -> Import Log -> Activities Preview. It also exercised FIT
duplicate, malformed FIT, cancellation, reload, and Demo/Real isolation.

All 44 browser gates passed. Console warning/error records were empty;
Authorization, external HTTP, fetch, provider, telemetry, XHR, and WebSocket
observations were all zero; Service Worker registrations and Cache entries were
zero. IndexedDB remained physical version 2 with 11 stores and 9 indexes. Safe
final counts were activities 5, activitySources 5, devices 1, events 2,
importItems 10,008, importJobs 9, laps 2, metadata 1, migrations 2,
rawArtifacts 6, and streamSeries 20. The Legacy-like sentinel was unchanged.
All database handles, Workers, tabs, browser state, servers, and ports were
closed; no screenshot or profile was committed.

### Implementation-head CI

GitHub Actions run `31014944444` (run number 116) targeted exact implementation
head `ef38aebf7ef85050555c619c46fd92b7113406a1`. Attempt 1 job
`92336446972` reached the workflow timeout after install, syntax, privacy, and
the new PR-14 tests had passed; it reported no test assertion failure. The
control tower reran the same exact-head single job without a code, workflow,
branch, or PR-state change. Attempt 2 job `92343044885` completed successfully,
including install, syntax, privacy, the full test step, post steps, and job
completion.

### Privacy, migration, rollback, and final Not run

- Privacy: only deterministic synthetic invented inputs were used. No real
  activity, route, location, health/power stream, account, Token, export,
  credential, private fixture, user browser profile, provider request, or
  telemetry was read, written, logged, or committed.
- Migration: none. Database version, stores, indexes, validators, data shape,
  transaction shape, and Legacy storage are unchanged.
- Rollback: revert this bounded PR or stop new FIT/TCX/GPX intake while
  retaining all successfully written V2 artifacts, activities, logs, and all
  Legacy data. No cleanup, deletion, downgrade, reverse-copy, or overwrite is
  part of rollback.
- Not run: merge, branch/worktree cleanup, deployment, release, production or
  provider/auth verification, real/private-data verification, user-Chrome
  verification, Legacy/Canonical cutover, or M12/PR-15. The closure-head CI and
  Draft-to-Ready transition remain deliberately pending after this bookkeeping
  commit.

## Completion gate

After implementation, a genuinely independent read-only reviewer inspects the
exact-base diff findings-first: literal scope; Registry/Worker dispatcher;
preflight detection and bounds; CSV/ZIP regressions; FIT/TCX/GPX end-to-end;
cancel/progress/error/duplicate/storage/log/preview behavior; hostile object and
zero-I/O boundaries; browser evidence; privacy; migration; and rollback.

Every actionable finding gets a minimal failing test before repair and a fresh
independent re-review. Only after no actionable findings, all local gates,
complete closure ledger/PR body, clean worktree, local/upstream `0/0`, and final
exact-head CI success may the Draft PR move to Ready for review.

Ready is not merge authorization. Stop after Ready. Do not merge, clean the
branch/worktree, modify `integration/v2`, deploy/release, or start M12/PR-15.
