# PR-24: Release Documentation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M21 / PR-24 |
| Status | A2 evidence and exact scope frozen; docs-contract implementation pending |
| Branch | `codex/v2/release-documentation` |
| Base | `integration/v2` at `61d7b032305fd8f12d71544315f06d553213801d` |
| Draft PR title | `docs(v2): complete release candidate documentation` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce the release-candidate documentation required by the V2 development plan: README,
CHANGELOG, Migration Guide, Backup Guide, Known Limitations, Privacy Guide, and Troubleshooting.
The documents must be executable, mutually consistent, privacy-safe, and grounded in the exact
merged PR-00 through PR-23 implementation and evidence. They must distinguish implemented and
verified behavior from known limitations, checks not run, future work, and gates that still require
manual release-owner approval.

PR-24 is documentation work, not release authorization. It does not change product behavior,
package or application version, schema, API, dependency, Worker or Service Worker behavior,
workflow, deployment configuration, default branch, or data. It does not create a tag, GitHub
Release, deployment, production Service Worker rollout, merge, or cleanup operation.

## A0 exact baseline evidence

- The assigned isolated worktree began clean and detached at exact SHA
  `61d7b032305fd8f12d71544315f06d553213801d`.
- Before feature-branch creation, worktree HEAD, local `integration/v2`, and
  `origin/integration/v2` resolved to that same exact SHA.
- GitHub PR #29, `refactor(v2): make canonical repository the default`, was verified `MERGED` into
  `integration/v2` at `2026-08-07T06:06:26Z`; its merge commit is the exact required base SHA.
- The feature branch `codex/v2/release-documentation` was created from that exact detached base.
  `main`, `maintenance/v1`, and `integration/v2` were not modified.
- Untouched-base verification passed: `npm ci`; syntax for 238 files; privacy; full suite
  1,457/1,457; and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, heart-rate or power value, account,
  credential, Token, Authorization value, export, screenshot, private fixture, user profile, or
  user browser state was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed normally and used
to open a Draft PR targeting `integration/v2` before A2 investigation results or documentation
changes are committed. A GitHub write failure or 403 is delegated directly to the control tower as
a structured GitHub-write handoff; the user's Chrome login and browser profile are never used.

The PR remains Draft through documentation implementation, served-path validation where needed,
independent review, and Final Review Closure. Final Review Closure must be a later Task-Brief-only
commit. Ready is a post-Closure control-tower operation after exact-head CI succeeds and is not
merge, tag, release, or deployment authorization.

## Authority and inherited frozen contracts

Conflicts are resolved in this order: accepted ADRs, product PRD, engineering plan and release
gates, this Task Brief, then implementation details. Proposed ADRs and historical conversations
are evidence only and cannot freeze an undecided contract.

PR-24 preserves every accepted PR-00 through PR-23 product boundary. In particular:

- Legacy and V2 storage remain physically isolated. There is no automatic Legacy-to-V2 copy,
  reverse copy, repair, deletion, overwrite, or destructive rollback.
- Canonical is the default Real Repository mode; explicit Legacy and Shadow remain rollback modes;
  Demo remains isolated from Real storage, provider, Token, auth, and network construction.
- An absent or empty Canonical library is a valid First-run state, not proof of migrated data.
- Repository, Storage, Import, Backup, Diagnostics, decoder, analysis, and feature-flag public
  contracts remain unchanged.
- Disconnecting Strava and deleting local data remain separate actions.
- Tokens, Authorization data, raw identifiers, filenames, routes, GPS, health and power data,
  private payloads, credentials, and user-owned settings must not enter documentation, fixtures,
  diagnostics examples, logs, Git history, or external telemetry.
- Only synthetic deterministic data may be used for tests or browser evidence.

## Authoritative scope

The development plan requires these seven documentation surfaces:

```text
README
CHANGELOG
Migration Guide
Backup Guide
Known Limitations
Privacy Guide
Troubleshooting
```

The release-gates document defines Alpha, Beta, Release Candidate, and Production gates. PR-24
must build an evidence ledger for every gate item using only `PASS`, `PARTIAL`, `BLOCKED`,
`NOT RUN`, or `NOT APPLICABLE`. Every `PASS` must cite a code boundary, deterministic test, CI run,
merged Task Brief, or actual served-browser record. Historical or reused evidence must be labelled
as such. Draft, Ready, merge, CI, browser-harness source, and production release are distinct facts.

No real-account, cross-browser, production Service Worker, production deployment, full rollback
drill, pixel-level visual, or private-data gate may be marked `PASS` without actual evidence.

## A2 read-only investigation gate

Before any documentation or docs-contract test change other than this Task Brief, read-only
evidence must establish:

1. the current README, CHANGELOG, migration, backup, privacy, troubleshooting, limitation, release,
   deployment, Service Worker, browser-support, feature-flag, public-route, version, and package
   claims;
2. accepted ADR, PRD, engineering-plan, release-gate, migration, and rollback contracts;
3. the final facts, verification, reused browser evidence, `Not run` items, residual boundaries,
   and release exclusions recorded by every merged PR-00 through PR-23 Task Brief;
4. actual user-visible Source Manager, Import, Duplicate Review, Backup/Restore, Diagnostics,
   First-run, Dashboard, detail, Run Plus, NSM, Legacy, Shadow, Canonical, and Demo behavior;
5. exact supported CSV/ZIP/FIT/TCX/GPX limits, safe error codes, backup/restore state machine,
   physical IndexedDB version, feature-flag modes, local development and test commands, and served
   routes;
6. all external CDN, telemetry, console, provider, auth, browser, production Service Worker,
   deployment, versioning, compatibility, performance, visual, real-data, and release-evidence
   boundaries;
7. a status and evidence citation for every Alpha, Beta, Release Candidate, and Production gate;
8. the smallest literal exact docs-only cumulative path allowlist and the minimum failure-first
   docs-contract verification needed to keep commands, links, versions, paths, routes, and critical
   limitations consistent.

The A2 record must separate source facts, executed evidence, reused accepted evidence, and
inference. Presence and absence claims require citations. Documentation prose may not turn an
unexecuted instruction, historical expectation, or test harness into a passed runtime claim.

## A2 outputs and literal-scope freeze

After read-only investigation, this Task Brief will record:

- the evidence inventory and release-gate ledger;
- conflicts found and how authoritative sources resolve them;
- the exact documentation information architecture and cross-link map;
- reused versus newly executed served-path evidence;
- the literal exact cumulative allowlist, with no glob or implicit generated file;
- focused docs-contract, link, command, path, route, version, privacy, scope, and full-suite gates.

Documentation implementation may begin only after that record is committed. The default scope is
docs-only, with the narrow exception of an approved docs-contract verification file if A2 proves it
is needed. A path outside the frozen list pauses implementation.

## A2 evidence inventory

The read-only investigation completed against exact base `61d7b032305fd8f12d71544315f06d553213801d`
after the Task-Brief-only A1 commit and Draft PR #30 were published. Evidence sources were the
complete tracked tree; six Accepted ADRs; PRD; engineering plan and release gates; migration,
rollback, testing, and fixture policies; merged PR-00 through PR-23 Task Briefs; first-parent
integration history; product HTML and modules; tests; package, Service Worker, manifest, and Vercel
configuration. No documentation, product, test, configuration, or data file changed during the
inventory.

### Repository and release state

- First-parent `integration/v2` contains every planned PR from repository safety through default
  Canonical, merged as GitHub PR #3 and #5 through #29. PR-23 is exact head `61d7b032...`.
- `maintenance/v1` exists at `fe34535...`; tag `baseline-strava-api-2026-07-28` exists at
  `78760f4...`. Their existence is proved, but this task does not reinterpret why their SHAs differ
  or perform a production rollback.
- All ADR-0001 through ADR-0006 are `Accepted`. Their own caveat remains binding: acceptance does
  not imply every downstream or release gate is complete.
- `package.json` remains private package `strava-dashboard-app` version `1.0.0`. No V2 package
  version, `v2.0.0-*` tag, GitHub Release, release artifact, production deployment, or release-owner
  approval exists in the inspected evidence. PR-24 may not change the version.
- The current root README is V1-centric and materially stale: it describes provider-first startup
  and says there is no application database, while the merged implementation defaults to local
  Canonical and uses independent physical V4 IndexedDB. `CHANGELOG.md` and the requested five
  standalone guides do not exist.
- Several durable governance documents still carry historical `Proposed`, old baseline SHA, or
  pre-implementation capability language. They remain useful authority/context but are not current
  release-state evidence. The new guides must cite accepted implementation without rewriting those
  historical records in this PR.

### Current user-visible and storage facts

- Default Real mode is literal `canonical`. Valid explicit modes are `legacy`, `shadow`, and
  `canonical`; `localImportEnabled` and `canonicalShadowWriteEnabled` default false. The lower-level
  Repository Factory deliberately retains omitted-mode Legacy fallback.
- Empty Canonical redirects to exact `/source-manager.html?mode=real`. Sources is same-origin and
  supports local FIT, TCX, GPX, English Strava `activities.csv`, and bounded Strava ZIP import.
  Its Strava API buttons remain disabled `Connect later`/`Disconnect`; Demo seed import is also
  unavailable. Those cards must not be documented as current V2 ingestion capabilities.
- Source Manager accepts at most 1,000 selected files and 256 MiB total; ordinary jobs contain at
  most 25 files and 32 MiB. Individual current maxima are CSV 5 MiB/10,000 rows, ZIP 64 MiB archive
  with a 256 MiB total expansion bound, and FIT/TCX/GPX 16 MiB each. Import is local, bounded,
  cancellable, per-item durable, and uses fixed safe error codes.
- Exact duplicate resolution uses committed exact identity; similarity creates review candidates.
  Confirming same activity records intent only. It does not merge, hide, replace, or delete either
  activity or source. Keep-separate is durable; field-level merge/unmerge/split is future work.
- Physical Canonical storage is database `strava-stats-v2`, IndexedDB version 4, schema ID
  `strava-stats-v2@4`, Canonical schema version 1, with thirteen stores. It is physically separate
  from Legacy `strava-dashboard-cache`; upgrades v1 through v4 are additive and transactional.
- Full backup is deterministic exact-current format version 1 over all thirteen V4 stores plus an
  approved durable-settings allowlist. Whole-buffer export/validation/restore has an exact
  268,435,456-byte (256 MiB) preflight. Restore allows only absent or exact empty V4, treats an
  identical prior restore as `already_restored`, rejects a different non-empty library with
  `TARGET_NOT_EMPTY`, and reports resumable post-database settings work as `SETTINGS_PENDING`.
- Diagnostics is an explicit-click, local JSON snapshot capped at 256 KiB. Storage estimate is
  rounded and origin-wide, recent safe errors are session-bounded, and import performance contains
  safe aggregates. Diagnostics is not a backup and deliberately excludes raw payloads and IDs.
- Stable served user routes needed by these documents are `/`, `/source-manager.html?mode=real`,
  `/storage-backup.html`, and `/diagnostics.html`. Local development is `npm run dev`; automated
  gates are `npm run check:syntax`, `npm run check:privacy`, and `npm test`.

### Compatibility, network, and evidence boundaries

- The PRD lists current-two Chrome/Safari/Firefox, macOS/Windows desktop, and basic iOS Safari/PWA
  as target support. Merged evidence actually exercises Node/fake-indexeddb and disposable
  Chromium/Chrome only. Safari, Firefox, Windows, mobile, iOS/PWA, assistive-technology, and broad
  responsive/visual matrices are not verified release evidence.
- Local development disables and unregisters application Service Workers by default, clearing only
  app-prefixed caches; `?enable-sw=1` opts in. Non-local origins register existing `./sw.js`.
  Production Service Worker update, mixed-version, cold-offline, cache eviction, and deployment
  rollback gates were not run. The worker still has fixed cache name `strava-dashboard-v1`; its
  same-origin API caching risk recorded by PR-01 remains unresolved.
- Actual root and detail documents declare third-party Chart.js, D3, Cal-Heatmap, Leaflet, Google
  Tag Manager, Google Analytics, and same-origin Vercel Insights resources. Accepted browser runs
  recorded these as inherited external-resource/telemetry baselines. The app must not be described
  as fully offline or as making zero external requests in production.
- Actual-served synthetic Chromium evidence exists for Source Manager/import, local-first states,
  Canonical summary/detail/Run Plus/NSM, exact identity, duplicate review, backup/restore,
  diagnostics, and performance. PR-24 reuses those accepted records for factual documentation; it
  does not claim they were rerun during A2.
- No real account, provider OAuth, real disconnect, real FIT/TCX/GPX/ZIP, real private library,
  production Service Worker, production deployment, pixel-perfect visual comparison, cross-browser
  matrix, or end-to-end release rollback drill was run by PR-24 or proved by merged evidence.

## A2 release-gate evidence ledger

Status vocabulary is frozen to `PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, and `NOT APPLICABLE`.
`PASS` below means the exact gate has accepted code/test/CI/served evidence; it never means a
production release occurred. `PARTIAL` names the missing evidence. Release-blocking rows stay
blocked even though PR-24 can document them.

### Alpha gate

| Gate | Status | Evidence and boundary |
| --- | --- | --- |
| Baseline tag and `maintenance/v1` exist | PASS | Exact local refs above; repository history |
| Legacy Cache export, validation, restore | PARTIAL | PR-01 deterministic tests and implementation pass; real cache/browser restore drill not run |
| Canonical Contracts accepted | PASS | ADR-0001 through ADR-0006 are Accepted; contract suites pass |
| Repository convergence complete | PASS | PR-03/04A/04B/04C and current Repository/consumer suites |
| V2 IndexedDB physically isolated | PASS | `strava-stats-v2` V4 versus Legacy database; PR-05/19/20 migration tests |
| Shadow Writer preserves page reads | PASS | PR-06 and shadow integration tests; Shadow remains Legacy read |
| Parity Report exports explainable differences | PASS | redacted JSON report contract and shadow tests; not a real-library review |
| Feature Flag can select Legacy | PASS | PR-23 actual-served explicit Legacy/Shadow evidence and flag tests |

### Beta gate

| Gate | Status | Evidence and boundary |
| --- | --- | --- |
| Synthetic JSON vertical slice | PASS | PR-07 Import Core and deterministic synthetic fixture tests |
| English `activities.csv` import | PASS | PR-08 decoder and Source Manager end-to-end synthetic evidence |
| Strava ZIP safety and association | PASS | PR-09 ZIP matrix and PR-14 actual-served synthetic import |
| FIT, TCX, GPX decoder matrix | PASS | PR-11/12/13/14 regression and served synthetic evidence |
| Same file does not create a duplicate activity | PASS | exact-hash/source identity and import replay tests |
| One file failure does not roll back batch successes | PASS | Import transaction/cancellation/quota tests |
| Start and browse local data without Token | PASS | PR-15/16/17/23 actual-served synthetic evidence |
| Summary-only/missing capabilities degrade | PASS | detail regression matrix and actual-served synthetic evidence |
| Source Manager and Import Report usable | PASS | PR-10/14/20 actual-served synthetic evidence |

### Release Candidate gate

| Gate | Status | Evidence and boundary |
| --- | --- | --- |
| CSV/FIT/TCX/GPX regression matrix | PASS | current full suite plus format-focused merged evidence |
| Full-library backup and fresh-environment restore | PASS | PR-21 deterministic exact-current tests and actual-served fresh-profile restore; synthetic only |
| Exact Identity Resolver | PASS | PR-19 transaction, performance, and browser evidence |
| Fuzzy similarity never auto-merges | PASS | PR-20 candidate/decision contracts and actual UI copy |
| Summary Legacy/Canonical parity reviewed | PARTIAL | projection/shadow synthetic evidence exists; no real-library parity sign-off |
| Activity Detail reads local Streams | PASS | PR-17 actual-served Canonical detail matrix |
| Run Plus / NSM regression | PASS | PR-18 and PR-23 actual-served Canonical routes |
| Service Worker update and old-cache eviction | BLOCKED | existing worker unchanged; production/mixed-version/cold-offline lifecycle not run |
| 5k/10k activities and large Stream performance | PARTIAL | 5k and 200k gates pass in disclosed Chromium/stubs; 10k is record-only, no waiver |
| Migration and release rollback drill | BLOCKED | no production deployment/SW/full rollback rehearsal evidence |
| Zero unresolved P0/P1 defects | NOT RUN | no release defect inventory and owner sign-off was provided |

### Production release gate

| Gate | Status | Evidence and boundary |
| --- | --- | --- |
| Start without Strava Token | PASS | local-first and default-Canonical served evidence |
| Disconnect does not delete local library | PARTIAL | auth lifecycle tests pass; real-account disconnect not run |
| Legacy Cache recoverable | PARTIAL | deterministic rescue passes; real-cache recovery drill not run |
| All CI passes | PARTIAL | exact integration baseline passes; PR-24 final exact-head CI is pending |
| All P0 source imports pass | PARTIAL | synthetic Chromium/Node matrix passes; real-data and cross-browser matrices not run |
| Database backup/restore passes | PASS | PR-21 deterministic actual-served fresh-profile evidence; exact-current only |
| Exact duplicate passes | PASS | exact identity/import regression evidence |
| Summary parity passes | PARTIAL | no real-library parity review/sign-off |
| Detail capability degradation passes | PASS | deterministic detail/browser regression evidence |
| Run Plus / NSM passes | PASS | deterministic actual-served route evidence |
| Shadow differences reviewed | PARTIAL | safe report contract passes; no real-library difference review |
| Canonical can switch back to Legacy | PASS | PR-23 explicit non-destructive Legacy/Shadow served evidence |
| No private data enters Git/logs/external telemetry | BLOCKED | privacy guard and diagnostics redaction pass; inherited telemetry/CDN and SW API-cache risks remain |
| Migration/Backup/Privacy/Troubleshooting docs complete | PARTIAL | PR-24 deliverables not implemented at A2 freeze |
| Final rollback drill | BLOCKED | not run; production deployment/SW/data-owner rehearsal required |
| Release owner approval | BLOCKED | no production release approval; Ready/merge would not satisfy this gate |

## A2 frozen documentation architecture and allowlist

The long-lived release-candidate documents will be English, matching product UI and repository
root documentation, with exact cross-links from both README indexes. Existing historical migration
records remain unchanged; the new Migration Guide provides the current user/operator view without
rewriting historical proposals. `CHANGELOG.md` uses `Unreleased` and merged PR groupings only.

The exact cumulative hard maximum is these ten literal paths, with no glob or generated file:

```text
docs/tasks/pr-24-release-documentation.md
README.md
CHANGELOG.md
docs/README.md
docs/guides/migration-guide.md
docs/guides/backup-guide.md
docs/guides/known-limitations.md
docs/guides/privacy-guide.md
docs/guides/troubleshooting.md
tests/docs/release-docs.test.js
```

The single test path is approved because A2 found mutually inconsistent root/package/storage/
release claims and seven missing surfaces. Its failure-first contract must require all documents,
validate relative Markdown links and referenced repository paths, assert executable package
commands and exact user routes, freeze package/V4/backup/status constants used by the guides,
reject release-complete wording and unqualified cross-browser/full-offline claims, and enforce this
literal allowlist. It may not modify product behavior or become a future-hostile whole-tree hash.

Any eleventh path or need to modify product code, historical migration records, package/version,
Service Worker, workflow, deployment, schema/API/dependency, release artifact, or user data pauses
for the material-decision gate. A2 found no need for such a package.

## Required documentation contracts

- **README:** state local-first and Canonical defaults; explain Source Manager, CSV/ZIP/FIT/TCX/GPX,
  Duplicate Review, Backup/Restore, Diagnostics, explicit Legacy rollback, setup/test commands,
  privacy boundaries, and compatibility limits.
- **CHANGELOG:** summarize actual merged milestones and PRs without inventing a publication date,
  version tag, release artifact, deployment, or production status.
- **Migration Guide:** explain Legacy/V2 physical isolation, no automatic copy, explicit
  Legacy/Shadow/Canonical modes, First-run/empty Canonical behavior, physical IndexedDB V4,
  old-version compatibility limits, and non-destructive rollback.
- **Backup Guide:** document PR-21 exact-current deterministic backup, the exact 256 MiB preflight,
  absent/empty-only restore, `already_restored`, `TARGET_NOT_EMPTY`, `SETTINGS_PENDING`, privacy,
  and browser boundaries.
- **Known Limitations:** include every material residual item from PR-22/M19 and later work,
  external CDN/telemetry baseline, unsupported capabilities, browser/real-data/production Service
  Worker/visual/deployment/release evidence, and distinguish blockers from non-blockers.
- **Privacy Guide:** prohibit Token, Authorization, raw ID, route, health, private payload, and
  settings disclosure; state synthetic-fixture rules; distinguish Diagnostics from Backup; and
  explain provider, telemetry, console, local-storage, and export boundaries.
- **Troubleshooting:** give executable, non-destructive steps for First-run/empty library, explicit
  Legacy rollback, storage/version errors, import safe codes, quota, backup conflicts,
  `SETTINGS_PENDING`, provider offline behavior, and Diagnostics export.

Stable long-lived facts belong in the relevant guide. PR-specific evidence, ledger status,
review findings, exact commands, and closure state belong in this Task Brief.

## Material decision and pause gate

If completion requires product code, package/version, Service Worker, workflow, deployment or
release configuration, schema/API/dependency, provider/auth behavior, data deletion or migration,
tag or GitHub Release creation, or modification of `main`, `maintenance/v1`, or `integration/v2`,
prepare an A/B/C decision package and pause. The package must identify the evidence conflict,
options, recommendation, exact paths, user impact, privacy and data impact, migration and rollback
impact, and verification cost. No material option is implemented without explicit approval.

## Verification, review, and closure

Implementation verification must include focused docs-contract checks, link/path/command/version/
route consistency, syntax, privacy, full `npm test`, `git diff --check`, literal scope audit, and a
real remote depth-1 checkout of the exact feature-branch head. Served UI paths or user-operation
steps require a minimal actual-served disposable-browser check with deterministic synthetic data,
unless accepted existing evidence is sufficient and is explicitly labelled reused rather than
rerun.

A findings-first independent reviewer must check factual accuracy, executable commands, valid
links, consistent version and status language, privacy and rollback clarity, and release-gate
honesty. Every actionable finding receives a failure-first reproduction and minimal in-scope fix.
A fresh independent re-review must report no actionable findings.

Final Review Closure is a Task-Brief-only commit after all permitted evidence passes. After it is
pushed, the final remote head must equal the Closure commit and exact-head CI must pass before the
control tower updates the PR body and marks the Draft PR Ready. The control tower then receives a
clear Squash Merge authorization package. Work stops at Ready until merge is separately authorized.
Even after merge, PR-24 does not authorize a tag, GitHub Release, deploy, production Service Worker
rollout, default-branch change, or cleanup.

## Privacy, migration, rollback, and release impact

- **Privacy:** documentation and evidence use only deterministic synthetic or redacted material.
  No private fixture, user profile, provider network, credential, Token, account, or real athlete
  data is permitted.
- **Migration:** documentation-only. It neither copies nor migrates Legacy or V2 data and does not
  change physical V4.
- **Rollback:** documentation changes can be reverted independently. Product rollback remains the
  explicit Legacy or Shadow mode documented from accepted implementation; no data is deleted,
  repaired, overwritten, or reverse-copied.
- **Release:** PR-24 may document release readiness but cannot declare `v2.0.0-alpha.1`,
  `v2.0.0-beta.1`, `v2.0.0-rc.1`, or `v2.0.0` published without an actual tag, artifact,
  deployment, required gate evidence, and release-owner approval.
