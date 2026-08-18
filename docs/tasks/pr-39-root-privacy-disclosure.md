# PR-39: Root Privacy Disclosure Correction

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / A3-P0-01 |
| Status | Local Final Review Closure complete; remote exact-head, CI, and Ready gates pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/root-privacy-disclosure` |
| Exact base | `integration/v2@cac3fdb97337a358da08a1f6d92c541519282d5a` |
| Exact base tree | `4de9cf52ce5fe50fb223892c94a6d9cb2d3aa8fa` |
| Owner | Codex |
| Dependency | Integration push CI run `31310574630`, job `93237672950`, successful |
| Pull request | Draft PR [#45](https://github.com/XiChuan9/StravaStats/pull/45), targeting `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close current-tree audit finding A3-P0-01. The root login disclosure claims that Strava data is
processed only in the browser and that nothing is stored or sent to any server. That absolute
claim is false because optional Legacy Strava provider operations and the separately consented R6
Weather, R7 AI Coach, and R8 OpenStreetMap tile boundaries can make bounded external requests.

This correction changes disclosure text only. It must not change egress behavior, destinations,
consent, data shape, storage, provider/auth, schema, public API, dependencies, Service Worker,
algorithms, routes, deployment, or release state. Conflicts resolve in this order: accepted ADRs,
the product PRD, engineering plans and release gates, this Task Brief, then implementation details.

## Global invariants

- Preserve Legacy and V2 data, settings, backups, provider credentials, and all existing separate
  deletion and disconnect semantics. No migration or destructive operation is authorized.
- Keep Demo, Legacy, Shadow, and Canonical behavior and user-facing truth accurate.
- Do not imply that all activity data is transmitted. Do not expose endpoints, IDs, Tokens,
  credentials, private values, routes, or health/power data.
- Do not promise deletion of browser, provider, server, network, or historical retention records.
- R6 Weather, R7 AI Coach, R8 maps, R9 request/response policy, R10 Source Manager, R11
  telemetry/CDN governance, and D3 Service Worker lifecycle remain behaviorally unchanged.
- Use deterministic synthetic/static evidence only. No real external request, account, Token,
  private activity, user profile, or private fixture may be read or used.

## A0 exact-base and untouched-gate evidence

- The assigned isolated worktree began detached and clean at
  `cac3fdb97337a358da08a1f6d92c541519282d5a`, tree
  `4de9cf52ce5fe50fb223892c94a6d9cb2d3aa8fa`.
- The worktree was attached to the exact authorized branch
  `codex/v2/root-privacy-disclosure`; the unique integration worktree was not modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`.
- `npm ci` passed. `npm run check:syntax` passed for 260 files and
  `npm run check:privacy` passed. The first sandboxed full run reached 1706/1707 with the only
  failure being the environment denial `listen EPERM 127.0.0.1`; the required rerun with the
  synthetic loopback server permitted passed 1707/1707. `git diff --check` and the initial status
  were clean.
- Local `gh` authentication is invalid. It will not be repaired through Chrome, interactive login,
  or a user browser/profile. A GitHub App `403` write must be delegated exactly to the control
  tower.

## A1 Task-Brief publication boundary

The first feature-branch commit contains exactly this path:

```text
docs/tasks/pr-39-root-privacy-disclosure.md
```

It must be pushed normally and used to open a Draft PR targeting `integration/v2` with the exact
title:

```text
fix(v2): correct root privacy disclosure
```

If the GitHub App returns `403` or `Resource not accessible by integration`, delegate only the
exact Draft-PR write to the control tower. Do not use Chrome, interactive login, a user profile, or
another credential path.

## A2 findings-first audit and frozen contract

### Finding

The production root `index.html` login section currently states:

> Privacy Notice: Your Strava data is processed in your browser only. Nothing is stored or sent to
> any server.

That copy collides with the current production boundaries:

- explicit Legacy Strava connection and provider operations can use Strava OAuth and same-origin
  serverless provider routes;
- R6 Weather starts denied and, after its separate affirmative consent, can contact Open-Meteo
  with its already frozen bounded disclosure and request shape;
- R7 AI Coach requires one affirmative action per request and names Google Gemini under its
  existing separate disclosure and bounded aggregate request contract; and
- R8 maps start denied and can request only approved OpenStreetMap tiles after a per-map,
  per-document affirmative action and separate location-egress disclosure.

The V2 PRD requires the activity library to remain local by default, not that every optional feature
is network-free. The Privacy Guide and release contracts already distinguish local Canonical/import
storage from these bounded provider and external-service boundaries. No accepted contract supports
the root's absolute no-server statement.

### Exact user-facing replacement

The root login disclosure is frozen as:

> Privacy Notice: Your activity library is stored locally in your browser by default. Only explicit
> actions or consents may contact external services for Strava provider operations, Weather, AI
> Coach, or OpenStreetMap tiles, each under its existing separate disclosure.

This wording is one narrow correction rather than a material product choice: it preserves the
local-first default, names every current external-service category relevant to the root claim,
requires an explicit action or consent, points to existing detailed disclosures, and does not imply
that all library data is sent. It adds no deletion, offline, retention, provider, or browser promise.

### Collision audit and literal cumulative hard allowlist

The exact maximum is three paths:

```text
docs/tasks/pr-39-root-privacy-disclosure.md
index.html
tests/privacy/root-privacy-disclosure.test.js
```

No fourth path is required. A fourth path, copy/behavior collision, or materially different
disclosure choice stops implementation and requires a minimum A/B/C decision package.

## Failure-first implementation and verification contract

1. Add focused static and actual-served disclosure tests before changing `index.html`; record the
   expected failure against the absolute legacy claim.
2. Freeze the exact replacement copy, absence of the two old absolute sentences, the three-path
   allowlist, unchanged root executable/module/script/style/CSP surfaces, and absence of new
   endpoints, storage, provider/auth, schema/API, dependency, Service Worker, algorithm, or route
   behavior.
3. Verify served root HTML from a synthetic loopback server and, proportionally, a disposable
   browser with zero real external request and no user-owned profile or data.
4. Run the focused test, `npm run check:syntax`, `npm run check:privacy`, full `npm test`,
   `git diff --check`, and an exact path/content audit.
5. Complete a genuinely independent findings-first review, fix every finding, and obtain a fresh
   independent no-findings re-review.
6. Commit implementation changes, then append Final Review Closure in a Task-Brief-only commit.
   Push normally, perform a true remote depth-1 exact-head verification, confirm exact-head CI,
   publish a safe PR body, and request the control tower to mark Ready under standing authorization.

Stop at Ready. Do not merge, clean up, deploy, release, change Source Manager, delete data/cache,
remove a branch/worktree, or rewrite history. Squash Merge remains separate user approval.

## Final Review Closure

Local implementation and independent review closed on 2026-08-09 at review-fix commit
`4cd16ce25fafeac7748d228477999d926001c537`.

- Publication evidence: the first feature-branch commit
  `b0f8a379530f6fb243c0c5dd35f27bf8b4a3ce83` contains only this Task Brief. It was pushed
  normally. The GitHub App returned `403 Resource not accessible by integration`, so the exact
  Draft-PR create was delegated to the control tower. Control-tower readback confirmed PR #45 is
  open and Draft with the exact title, base `integration/v2@cac3fdb97337a358da08a1f6d92c541519282d5a`,
  Task-Brief-only head, one commit, one changed file, and the safe body. No Ready, merge, or other
  PR write occurred.
- Failure-first evidence: before editing production, the new focused suite passed its unchanged
  root-digest and Task-Brief tests but failed its static and served copy assertions against the
  inherited absolute claim, for an expected result of 2/4 pass and 2/4 fail. After the production
  correction, the suite passed 4/4.
- Implementation evidence: commit `22c821fc06437fbbebf8de1da8205431a199b642` changes only
  `index.html` and `tests/privacy/root-privacy-disclosure.test.js`. The exact replacement states
  that the activity library is local by default and that only explicit actions or consents may
  contact the four named external-service categories under their existing separate disclosures.
  The regression freezes the exact text, absence of both old absolute sentences, literal
  three-path allowlist, served `/` and `/ai-coach` output, and a normalized exact-base root digest.
- Review-fix evidence: the first independent findings-first review found two P2 issues: production
  and the initial test added the word `user` beyond the Task Brief's exact frozen text, and the
  normalized-root test could mask arbitrary executable markup placed inside the disclosure. Commit
  `4cd16ce25fafeac7748d228477999d926001c537` aligns production and test text exactly and requires
  the precise `<strong>` plus plain-text structure before normalization. Both focused, syntax, and
  privacy checks passed after the fixes.
- Fresh review evidence: a separate independent reviewer re-audited the exact range
  `cac3fdb97337a358da08a1f6d92c541519282d5a..4cd16ce25fafeac7748d228477999d926001c537`
  from scratch and reported **no findings**. The reviewer independently reproduced the three-path
  scope, exact copy, markup rejection, normalized base digest, product truth, and unchanged
  behavior/CSP/route/script/style/storage/migration/provider/Service Worker surfaces.
- Focused and repository evidence: the post-fix R6/R7/R8/R9/R10/R11/D3 plus PR-39 boundary run
  passed 183/183. The final full suite passed 1711/1711. `npm run check:syntax` passed for 261 files,
  `npm run check:privacy` passed, `git diff --check` passed, and the exact base-to-head path audit
  contains only the three frozen paths.
- Actual-served browser evidence: a fresh in-app browser automation tab loaded the local production
  root from `127.0.0.1:3001` without a user Chrome profile, account, Token, private activity, or real
  external request. The final head rendered exactly one disclosure with the frozen text and exact
  strong-plus-text markup; neither old absolute sentence was present. The page asset inventory
  contained 103 local/same-origin assets and zero external assets, with zero console warnings or
  errors. The browser tab and loopback server were closed after evidence capture.
- Behavior and privacy result: no egress behavior, endpoint, request field, consent, provider/auth,
  storage, schema, public API, dependency, Service Worker, algorithm, route, Demo/Legacy/Shadow/
  Canonical behavior, disconnect, deletion, or retention contract changed. No real external
  service, account, credential, athlete data, location, health/power value, private fixture, or user
  profile was used.
- Migration and rollback result: there is no migration, data mutation, cache operation, or
  destructive action. Legacy and V2 data remain untouched. The change rolls back by reverting only
  the disclosure and its static/served regression; the existing Legacy application rollback path
  is unchanged.
- Remaining gates and limitations: local browser evidence is not a production deployment check.
  Normal push, true remote depth-1 exact-head verification, exact-head GitHub CI success, final safe
  PR body publication, and control-tower Ready transition remain pending. Ready will not authorize
  merge, cleanup, deploy, release, Source Manager work, data/cache deletion, or history rewrite.
