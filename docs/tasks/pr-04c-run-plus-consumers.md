# PR-04C: Run Plus / NSM consumer migration

## Execution contract

| Field | Value |
| --- | --- |
| Status | Ready for review / Closure Completed |
| Base branch | `integration/v2` |
| Base SHA | `eb78e19482f470edf4ae5f2483a579db5efec648` |
| Feature branch | `codex/v2/run-plus-consumers` |
| Implementation commit | `7ddce6c0e477d30480dad0b7a49f1b3aaf2e148d` |
| Draft PR | [#10](https://github.com/XiChuan9/StravaStats/pull/10) |
| Owner | Codex execution thread |
| Related ADRs | ADR-0001, ADR-0002, ADR-0003 |
| Dependencies | PR-04A and PR-04B merged |

## Goal

Remove the final Run Plus and NSM provider-data boundaries while preserving the existing
algorithms, thresholds, storage-owned user settings and outputs, DOM, CSS, copy, routes, charts,
ordering, and visual behavior.

## Baseline and investigation facts

- The worktree was clean and detached at `eb78e19482f470edf4ae5f2483a579db5efec648`;
  `origin/integration/v2` resolved to the same commit before branch creation.
- `main.js` already owns one session Repository and the session gear result used by Run and Gear.
- `run-plus.js` is the only importer of `js/tabs/api.js`. That one-line module only re-exports
  `getCachedGears`, so it has no remaining purpose after this migration.
- Run Plus currently reads gear metadata from `getCachedGears()` with a `strava_gears` fallback.
- NSM currently reads Tokens, creates Authorization, calls the Strava proxy with `fetch`, and
  writes refreshed Tokens inside `run-plus.js`.
- The existing Repository already has `getActivity` and `getStreams`; no public Repository method
  or Canonical contract change is required.
- `tests/consumers/detail-boundaries.test.js` contains a historical whole-index digest and
  worktree phase allowlist. It must be narrowed to durable PR-04B file/contract checks so this
  approved PR and later work do not invalidate an unrelated completed phase.

## Frozen implementation decisions

- `main.js` remains the sole composition root. Its existing session façade adds the already-public
  Repository `getActivity` and `getStreams` operations and applies the same descriptor-safe
  success-envelope validation used by summary reads.
- Run Plus receives a frozen render-options object containing:
  - a frozen, order- and duplicate-preserving snapshot of the current session gears;
  - one `getActivity(activityId)` callback returning detached activity data;
  - one `getStreams(activityId)` callback requesting the existing six NSM stream types;
  - the existing filter-change callback.
- The façade never exposes or retains the Repository in the tab. It validates opaque string IDs,
  request options, injected descriptors, and Repository envelopes without executing accessors or
  coercing Proxies. Callback failures become the existing safe generic NSM degradation/error UI.
- Demo uses the Demo session Repository through the same callbacks and cannot touch real Tokens,
  provider caches, Connector, or provider network. Real mode uses the Legacy session Repository.
- Each NSM action performs at most one applicable Repository read. Local/manual/lap/stream data
  continues to short-circuit remote enrichment exactly as before.
- Run Plus user-owned localStorage keys remain unchanged. Provider-owned keys are forbidden.
- `requestRunPlusRemote`, its Token/fetch implementation, and its test-only error exports are
  removed. Repository-backed callbacks are the replacement; there is no production importer of
  those exports.

## Frozen final allowlist

This is the complete ten-path PR-04C allowlist. An eleventh listed candidate is not needed; an
unlisted path requires a scope-expansion stop before editing.

```text
docs/tasks/pr-04c-run-plus-consumers.md
js/app/main.js
js/tabs/run-plus.js
js/tabs/api.js
js/tabs/AGENTS.md
tests/consumers/run-plus-consumers.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/detail-boundaries.test.js
tests/legacy/demo-isolation.test.js
```

`js/tabs/api.js` is authorized only for deletion after its importer count reaches zero.

## Prohibited scope

- No algorithm, threshold, chart configuration, DOM, CSS, copy, route, or visual redesign.
- No Repository public API, Connector, Canonical contract, persistence, provider service, server
  proxy, Service Worker, dependency, workflow, or package change.
- No Legacy or V2 data deletion, migration, overwrite, cleanup, or provider-key fallback.
- No real Token, account, activity, GPS, HR, power, private fixture, or user browser profile.
- No merge, Ready transition, rebase, amend, force-push, worktree deletion, or branch cleanup.

## Verification contract

Run `npm ci`, syntax, privacy, focused Run Plus/summary/Demo/detail boundary tests, Repository
regression, the complete test suite, and `git diff --check`. The browser gate must use a disposable
profile and deterministic synthetic data to prove Demo zero provider I/O, Real callback reads,
gear order/duplicates, bounded repeated NSM actions, safe failures, DOM/chart parity, and zero page
console exceptions. Evidence stays outside the repository.

## Privacy, migration, and rollback

The change is read-boundary-only. It creates no schema, key, migration, or cleanup and does not
write provider data. User-owned Run Plus/NSM settings and cached analysis outputs keep their current
keys and behavior. Rollback is an ordinary revert of this PR; Legacy data and session Repository
behavior remain intact.

## Final review closure evidence

- Draft PR [#10](https://github.com/XiChuan9/StravaStats/pull/10) targets
  `integration/v2` from `codex/v2/run-plus-consumers` and remains Draft at closure.
- Reviewed implementation head: `7ddce6c0e477d30480dad0b7a49f1b3aaf2e148d`; exact changed-file
  scope: all ten frozen paths and no additional path.
- Exact-head GitHub Actions CI: Run
  [30908287609](https://github.com/XiChuan9/StravaStats/actions/runs/30908287609), Job
  [91988475609](https://github.com/XiChuan9/StravaStats/actions/runs/30908287609/job/91988475609),
  completed successfully; install, syntax, privacy, and tests all passed.
- Control-tower Final Review: **Accepted / PASS**, with no P0-P3 actionable findings.
- Closure status `Ready for review` records review readiness only. It does not authorize marking
  the PR Ready, merging, releasing, branch/worktree cleanup, or modifying `integration/v2`.

- `npm ci`: PASS, 6 packages installed.
- Syntax: PASS, 137 files; privacy: PASS; `git diff --check`: PASS.
- Focused Run Plus / summary / Demo / detail boundary matrix: 100/100 PASS.
- Repository regression: 253/253 PASS.
- Full suite: 965/965 PASS; failures/cancelled/skipped/todo all zero.
- Fresh-origin native browser smoke: PASS with initially empty Local Storage, Session Storage,
  IndexedDB, Cache Storage, and Service Workers; zero provider-key reads, Token events, provider
  network, external module requests, and console errors/exceptions. The two deliberate stream
  failures produced only the fixed safe warning and label.
- Browser evidence: `/private/tmp/pr04c-run-plus-browser-eb78e19` (outside the repository).
- Security/privacy review: no raw error or secret propagation, no provider-owned storage access,
  no new public Repository method, no Canonical/schema change, and no private/real data.
- Diff review: no algorithm, threshold, chart configuration, DOM, CSS, route, or user-visible copy
  change; the historical PR-04B global-tree digest is replaced by direct tracked contract checks
  with a simulated missing-contract negative case.
- Not run: real account/Token/provider data, user browser profile, production Service Worker,
  pixel-perfect manual comparison, migration, merge, and release.
