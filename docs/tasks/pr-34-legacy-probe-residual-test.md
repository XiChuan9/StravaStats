# PR-34: Legacy Probe Residual Test Stabilization

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R10 regression stabilization |
| Status | Approved for test-only investigation and implementation under the frozen gates below |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/legacy-probe-residual-test` |
| Exact base | `integration/v2@166af12a5a42dcef865af09991c4142282e8b265` |
| Owner | Codex |
| Reviewer | Independent findings-first review and fresh no-findings re-review required |
| Dependency | PR #39 Squash Merged; integration push CI run `31255261244`, job `93097591353`, successful |
| Pull request | Expected Draft PR #40; Ready transition authorized only after final Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Stabilize the two R10 Option B accepted-residual tests that are individually green but can fail in
the default concurrent full suite when the final database list is empty. The accepted production
contract is unchanged: after a safe positive preflight, a concurrent delete followed by an abort
failure may leave a version 1 database with zero stores and zero user records, but it is not
required to leave one. A successful abort may leave no database. Both outcomes remain unknown or
unavailable and cannot establish first-login or First-run.

This task is test-only. It does not authorize any change under `js/**` or another production/runtime
path, any physical schema/version/migration, data deletion/repair, dependency change, browser
compatibility decision, provider/account/private-data run, deployment, release, merge, cleanup, or
R7/R8/R11/D3 work. Until this regression is closed, `integration/v2` remains regression-blocked and
no next release-hardening risk surface may start.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `166af12a5a42dcef865af09991c4142282e8b265`.
- `HEAD`, local `integration/v2`, cached `origin/integration/v2`, and a live read-only remote ref
  query all matched; local/origin divergence was `0/0`.
- GitHub connector evidence verified PR #39 as squash merged to the exact base. Integration push CI
  run `31255261244`, job `93097591353`, completed successfully, including install, syntax, privacy,
  and full tests.
- The supplied post-merge evidence recorded `npm ci`, syntax for 245 files, and privacy as passing.
  Two independent default-concurrency full runs each failed only one of the two residual tests with
  `actual=[]` versus the former mandatory singleton database expectation; both individual tests and
  the R10 focused matrix passed 108/108.
- No real credential, account, Token, provider/private activity, GPS track, heart-rate, power,
  setting value, private fixture, export, screenshot, user browser profile, or user database is in
  scope.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before either test is modified. A GitHub App 403 during PR
creation or update is delegated immediately to the control tower; it does not authorize Chrome,
interactive login, or the user's browser profile.

The cumulative literal write allowlist is frozen to exactly:

```text
docs/tasks/pr-34-legacy-probe-residual-test.md
tests/legacy/auth-lifecycle.test.js
tests/legacy/legacy-cache-rescue.test.js
```

There is no fourth path unless failure-first evidence proves it is necessary and the control tower
returns explicit authorization.

## A2 findings-first and failure-first contract

Read-only investigation must trace fake-indexeddb and Node test-runner concurrency scheduling for
the two named tests, including database enumeration, unversioned open, `onupgradeneeded`, abort,
success/error completion, connection close, and final database enumeration. Before changing the
assertions, a default-concurrency or bounded pressure run must reproduce the former assertion
receiving `[]`.

The minimum test repair must accept exactly two final states:

1. no database exists; or
2. the database list contains only `strava-dashboard-cache` at version 1, and an actual unversioned
   open proves `objectStoreNames.length === 0` and zero user records before closing it.

The tests must not skip, retry away, or conditionally swallow another state. Any non-target
database, any target version other than 1, any object store, or any user record still fails. Both
schedules must continue to prove `deleteDatabase === 0`, zero repair/clear/write/upgrade behavior,
zero persistent/user-data change, and the original unknown/error classification. Missing,
rejected, malformed, non-finite, descriptor-hostile, accessor, Proxy, and reflection-hostile
enumeration must still perform zero open. Existing-database before/after equality, valid-empty,
first-login/First-run/Rescue classification, Demo isolation, and privacy boundaries must remain
strict.

All evidence uses only fake-indexeddb and deterministic synthetic state. Real credentials, account
data, Tokens, Legacy records, browser profiles, and network access are prohibited.

## Required verification and Closure

Run the two residual tests in failure-first pressure loops, then the R10 focused suite and related
weather/regression coverage. Final local gates require:

```text
npm ci
two consecutive default-concurrency full-suite passes
npm run check:syntax
npm run check:privacy
git diff --check
```

Closure additionally requires an independent findings-first review, repair of every valid finding,
a fresh no-findings re-review, a Task-Brief-only Closure commit, true remote depth-1 exact-head
evidence, and exact-head CI. After all gates pass, the control tower may safely update the PR body
and transition Draft to Ready. Squash merge still requires separate user approval.

## Privacy, migration, and rollback impact

The intended change is assertions and synthetic test inspection only. It changes no production
behavior, data, schema, version, migration, persistence owner, provider path, or privacy boundary.
Rollback is an ordinary test commit revert; Legacy and V2 data remain untouched. The former
mandatory-residual expectation must not be treated as a production rollback contract.

## Pause and delegation boundary

Pause and delegate a minimum evidence package to the control tower if completion requires a fourth
path, production/runtime behavior, real credentials/account/private data, browser-profile access,
data deletion/repair/migration, a new compatibility/product decision, or architecture-level scope.
Do not merge, clean any branch/worktree, deploy, release, or start R7/R8/R11/D3.

## Closure evidence

Pending implementation, review, remote depth-1 verification, and exact-head CI.
