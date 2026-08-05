# PR-15: Local-first Bootstrap

## Metadata

| Field | Value |
| --- | --- |
| Status | A1 docs gate; read-only investigation and contract freeze pending |
| Milestone | M12 |
| Base branch | `integration/v2` |
| Exact base SHA | `52334bbc7671231745bad96327afa4fa31d1a73c` |
| Feature branch | `codex/v2/local-first-bootstrap` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/32b9/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent findings-first Final Review before Ready transition |
| Dependency | PR-14 / PR #20 merged into `integration/v2` |
| Created | 2026-08-06 |

## Goal

Deliver the smallest conservative local-first startup slice:

```text
application startup
-> initialize the existing Local Library boundary
-> determine whether a local activity exists
-> empty library: deterministic First-run / Source Manager entry
-> non-empty library: existing Dashboard shell
-> optional, safely reported Strava source state
```

Provider or network failure must not block local capabilities. The existing
Legacy path remains available and PR-16 retains ownership of Canonical summary
page cutover.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `52334bbc7671231745bad96327afa4fa31d1a73c`.
- Starting `HEAD` and fetched `origin/integration/v2` matched with ahead/behind
  `0/0`; the exact commit is `feat(v2): wire local decoders into import registry
  (#20)`.
- The locked long-lived `integration/v2` worktree was present at the same exact
  SHA. No local task branch or task worktree existed before branch creation.
- Baseline gates passed: `npm ci`; syntax for 196 files; privacy; full suite
  1,271/1,271; and `git diff --check`.
- The local `gh` credential is invalid. GitHub write operations must use the
  authenticated GitHub App/control-tower handoff and must not use a user Chrome
  profile.
- No real activity, route, account, Token, credential, private fixture, export,
  screenshot, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with
`integration/v2 <- codex/v2/local-first-bootstrap` and title
`feat(v2): add local-first bootstrap`. No implementation path may be staged or
committed before this gate. If GitHub write access is unavailable, the exact
operation is handed to the control tower while local read-only work continues.

## A2 read-only investigation

Pending. Before implementation this section will record the actual served
startup/auth/Repository/Storage/Source Manager call graph, import-time side
effects, First-run definition, Source Status semantics, offline/provider
failure behavior, candidate options, risks, exact candidate files, and the
test/browser plan.

## A3 frozen contract and literal allowlist

Pending the A2 investigation. The implementation may begin only after this
section contains the smallest literal path allowlist and exact contracts.

The following scope is prohibited unless an evidence-backed decision package
is accepted separately: public API or export changes; IndexedDB database,
schema, store, index, version, or migration changes; Canonical contract changes;
analysis changes; provider auth contract changes; production dependencies;
Service Worker, release, deployment, or telemetry changes; Legacy data writes,
deletion, migration, clearing, or overwrite; PR-16 consumer cutover; M13 work.

Activity IDs remain opaque strings. Missing, null, and zero remain distinct.
Demo and Real modes remain isolated. Public errors and Source Status must be
descriptor-safe, immutable/detached where applicable, deterministic, stable,
and redacted.

## Verification contract

Required local evidence:

```text
npm ci
npm run check:syntax
npm run check:privacy
focused startup/auth/Repository/Storage/Source Manager/Import tests
npm test
git diff --check
literal path and prohibited-surface audits
```

A disposable-profile served-path Browser/CDP run must exercise empty and
non-empty V2 storage, optional/disconnected/failing provider state, Demo/Real
isolation, offline local behavior, and synthetic Legacy/V2 sentinels. It must
record network, authorization/provider, console/runtime, IndexedDB, Cache, and
Service Worker observations without real credentials or private data.

After implementation, an independent reviewer performs a findings-first review
of the exact-base diff. Every actionable finding receives a focused failing
test before repair and a fresh independent re-review. Closure requires no
actionable findings, clean local gates, exact-head CI success, a final closure
ledger/PR body, and a second exact-head CI success for any closure commit before
the Draft PR moves to Ready for review.

## Privacy, migration, rollback, and stop conditions

Tests and browser evidence use only deterministic synthetic data. No user data,
filename, activity ID, route, health/power stream, Token, Authorization value,
raw provider error, or private payload may enter committed fixtures, DOM error
copy, console output, screenshots, reports, CI logs, or the PR body.

No data migration is planned. Rollback is a normal revert of this bounded code
slice or selection of the existing Legacy behavior, while retaining the entire
Legacy and V2 Local Library. Rollback never deletes, clears, repairs, downgrades,
reverse-copies, or overwrites data and never couples Strava disconnect with
local deletion.

Pause for a material architecture/product decision, scope outside the frozen
allowlist, a required public/schema/auth/deployment contract change, real
credentials/private data, Service Worker release strategy, production
deployment, merge, or destructive cleanup.

## Closure ledger

Pending investigation, implementation, deterministic verification, browser
evidence, independent review and re-review, exact-head CI, and Ready transition.
Ready is not merge authorization. Do not merge, clean the branch/worktree,
modify a protected long-lived branch, deploy/release, or start M13 / PR-16.
