# PR-39: Root Privacy Disclosure Correction

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / A3-P0-01 |
| Status | A2 contract frozen; implementation pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/root-privacy-disclosure` |
| Exact base | `integration/v2@cac3fdb97337a358da08a1f6d92c541519282d5a` |
| Exact base tree | `4de9cf52ce5fe50fb223892c94a6d9cb2d3aa8fa` |
| Owner | Codex |
| Dependency | Integration push CI run `31310574630`, job `93237672950`, successful |
| Pull request | Draft PR pending, targeting `integration/v2` |
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

Pending implementation, independent review, remote exact-head verification, and CI.
