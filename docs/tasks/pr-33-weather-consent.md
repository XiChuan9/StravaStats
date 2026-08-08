# PR-33: Weather External-Egress Consent and Missing-Value Correctness

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R6 |
| Status | A0 complete; A1 Task-Brief-only publication pending; A2 findings-first audit authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/weather-consent` |
| Exact base | `integration/v2@8b4521ad9f45af9f6056f04cf0c8fd4cd6e6a97e` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | R10 PR #38 Squash Merged; integration push CI run `31249059836`, job `93082375097`, successful |
| Pull request | Expected Draft PR #39; Ready transition authorized only after Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blockers P0-04 and P1-01. An ordinary Real session must make zero Open-Meteo or
other external weather requests until the user has given specific, understandable, and revocable
authorization for the approved scope. Weather values that are missing, invalid, malformed, or
unavailable because of network failure must remain absent, `null`, or explicitly unavailable;
they must never be converted to numeric `0`. A genuine observed numeric zero remains valid.

This task does not authorize R7 AI, R8 external maps, R11 telemetry/CDN, Service Worker lifecycle
or D3, a provider/account/private-data run, deployment, release, merge, cleanup, or a public API,
schema, dependency, Repository, Import, Backup, Diagnostics, Worker, or Service Worker expansion.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit remain required evidence but do not freeze an undecided consent
or persistence contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `8b4521ad9f45af9f6056f04cf0c8fd4cd6e6a97e`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` matched with divergence `0/0`.
- GitHub App evidence verified integration push run `31249059836`, job `93082375097`, as
  `completed/success`, including install, syntax, privacy, and full tests.
- Untouched local gates passed: `npm ci`; syntax for 243 files; privacy; full tests 1615/1615;
  `git diff --check`; clean status.
- Root and all nested `AGENTS.md`, Accepted ADRs, PRD, engineering plan, release gates, test and
  fixture strategy, privacy/migration/rollback documents, the historical PR-25 audit, and the
  merged local-first, Canonical summary/detail, and R3-R10 Task Briefs were read from the exact
  integration tree or their retained read-only historical branch as applicable.
- No real Token, account, provider/private activity, coordinate, route, heart-rate, power, setting
  value, private fixture, export, screenshot, user browser profile, Legacy library, or V2 library
  was read. No real Open-Meteo request was made.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before production or test implementation is committed. GitHub
App 403 during PR creation or update is delegated immediately to the control tower; it does not
authorize Chrome, interactive login, or the user's browser profile.

Until A2 freezes the exact decisions and literal implementation allowlist, the cumulative write
allowlist is exactly:

```text
docs/tasks/pr-33-weather-consent.md
```

## A2 findings-first investigation contract

Read-only audit must trace every production weather path end to end:

```text
root/detail/analysis production entries
-> Demo/Real and Legacy/Shadow/Canonical mode selection
-> consent or user-owned settings lookup
-> activity/stream coordinate and date selection
-> request construction and Open-Meteo fetch
-> in-memory or durable cache
-> normalization and environmental difficulty
-> summary/detail/analysis presentation
-> offline, timeout, malformed, empty, and network-failure behavior
```

The audit must inventory:

1. automatic startup/refresh preprocessing and explicit Weather-tab/detail-map triggers;
2. every coordinate/date source, sampling rule, precision, request parameter, timeout, retry, and
   cache key/lifetime;
3. every existing user-owned durable settings owner and exact key, plus Demo isolation and
   Legacy/Shadow/Canonical behavior;
4. every `Number`, `|| 0`, `?? 0`, default, arithmetic, aggregation, chart, table, map, and
   environmental-difficulty path that may conflate missing, invalid, failure, and real zero;
5. offline, timeout, HTTP failure, malformed JSON/shape, missing arrays, null entries, non-finite
   values, out-of-range coordinates, invalid dates, hostile descriptors/accessors/Proxies, and
   aborted/revoked authorization schedules;
6. privacy, console, Token/provider, Cache Storage, and Service Worker boundaries without changing
   the already merged R5/R9 packages.

Evidence uses only deterministic synthetic coordinates, fixed dates, fixed canaries, loopback
requests, and intercepted external-request observations. A real Open-Meteo request, real route,
provider/account, private data, or user profile is prohibited.

## Material decision gate

Before production or test implementation, A2 must record and delegate one minimum A/B/C package
covering all of the following together:

- deny-by-default and the exact affirmative authorization gesture;
- consent copy and the disclosed destination/fields/purpose;
- single-session, per-request, or durable scope and the exact revocation behavior;
- whether and where a user-owned durable setting may be stored;
- exact versus minimized/rounded coordinates and the approved date/time range;
- cache location, key, lifetime, consent binding, and revocation treatment;
- behavior for existing users and all Demo/Legacy/Shadow/Canonical modes;
- the exact literal path allowlist, verification, privacy/data impact, migration impact, and
  non-destructive rollback.

The recommendation may be deny-by-default with no request before explicit consent, but no consent
copy, persistence key, precision, date range, or cache behavior is self-authorized. The control
tower must obtain and return the user's decision before implementation begins.

## Failure-first implementation and verification contract

After the decision is frozen, add deterministic tests that fail first for every approved path and
prove:

- ordinary Real startup/refresh and every denied/revoked state make zero external weather request;
- the authorized path sends only the approved minimum fields at the approved precision/range;
- missing, invalid, malformed, timeout, abort, and network failure remain absent, `null`, or
  explicitly unavailable; genuine numeric zero remains distinguishable and is not dropped;
- activity IDs remain exact opaque strings and are never parsed or manufactured as zero;
- Demo uses only synthetic embedded weather and performs zero Real storage/provider/weather I/O;
- Legacy, Shadow, and Canonical keep their approved data-source behavior and non-destructive
  rollback; and
- console/runtime, Token, Authorization, provider/private data, Cache Storage, and Service Worker
  observations contain zero prohibited canaries.

Required gates after implementation include focused weather/summary/detail/analysis and
Legacy/Demo/Canonical tests, `npm ci`, syntax, privacy, full tests, `git diff --check`, literal-path
audits, and an actual-served disposable-browser run with interception installed before navigation.
The browser gate must prove default zero requests, the exact approved authorized request shape,
revocation, offline/failure degradation, zero unsafe console/runtime output, and zero real external
network. It must stop the loopback server and remove only its disposable profile.

## Final Review and Closure contract

An independent reviewer must perform a findings-first exact-base review after implementation.
Every actionable finding receives a focused failing regression and minimum repair. A fresh
independent re-review must report no findings. Closure is a Task-Brief-only commit recording exact
local/browser/privacy/path/depth-1/CI evidence, findings and repairs, migration/rollback impact, and
Not-run items. The actual remote branch must pass a true depth-one exact-head verification and
GitHub Actions must succeed on the exact Closure head before the control tower updates the PR body
and moves Draft to Ready under the standing authorization.

Ready is not merge authorization. Squash Merge requires a separate user decision. Merge,
auto-merge, cleanup of this or retained R3/R4/R5/R9/R10 worktrees/branches, deployment, release,
R7, R8, R11, and D3 remain prohibited.

## Privacy, migration, and rollback

No data migration is authorized. No Legacy/V2 record, schema, store, index, version, migration,
provider state, backup, private setting value, or Cache Storage entry may be deleted, cleared,
overwritten, repaired, downgraded, or reverse-copied. Rollback must be a code/flag or consent-state
behavior defined by the approved decision package and must never clear activity data. Revocation
semantics must be specific and non-destructive.

## Pause and delegation boundary

Pause and return the minimum evidence package to the control tower if completion requires the
material consent decision above, any path outside the eventual frozen literal allowlist, a public
API/schema/dependency/Repository/Import/Backup/Diagnostics/Worker/Service Worker change, real
credentials/account/provider/private data, a real external weather request, user profile access,
destructive data/cache/Git action, deployment, release, or GitHub App authorization bypass.
