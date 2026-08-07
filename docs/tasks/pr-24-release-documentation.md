# PR-24: Release Documentation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M21 / PR-24 |
| Status | A1 Task Brief published; A2 read-only evidence inventory pending |
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
