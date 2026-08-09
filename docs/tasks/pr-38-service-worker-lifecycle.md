# PR-38: Service Worker Lifecycle Governance

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / D3 / P0-08 |
| Status | A1 investigation contract; implementation prohibited |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/service-worker-lifecycle` |
| Exact base | `integration/v2@d8bcdb221e49f7ed664eeb43733918eabd0ccf30` |
| Exact base tree | `9fe7ccb41e38e3606c371f8cbcb8dbdbf7c6f103` |
| Owner | Codex |
| Dependency | Integration push CI run `31305831264`, job `93225954586`, successful |
| Pull request | Draft, targeting `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Investigate the production Service Worker lifecycle from registration through install, waiting,
activation, controller changes, fetch/cache handling, update, failure, and rollback. Produce a
complete, mutually exclusive A/B/C owner decision package before any implementation or test
change. This Task Brief freezes the investigation contract and stop conditions only; it does not
select, imply, or authorize a lifecycle implementation.

Conflicts resolve in this order: accepted ADRs, product PRD, engineering plans and release gates,
this Task Brief, then implementation details. Proposed ADRs and historical conversations are
context, not authority to freeze an undecided lifecycle contract.

## Global invariants

- Preserve Legacy, V2, settings, backup, and all user-owned data. Do not delete, clear, migrate,
  overwrite, or mutate a real cache, database, storage area, browser profile, or registration.
- Missing or `null` values never become numeric zero. Genuine finite numeric zero remains
  distinct. Activity IDs remain opaque strings.
- R6 weather, R7 AI, R8 maps, R9 cache request/response boundaries, and R11 telemetry/CDN
  contracts remain unchanged unless a material collision is identified and routed for a new
  decision.
- No public API, schema, dependency, Worker, Repository, Import, Backup, Diagnostics, provider,
  deployment, or release contract expands by inference.
- `main` and `maintenance/v1` remain unchanged. The working base is the unique authorized
  `integration/v2` commit and tree recorded above.

## A0 exact-base evidence

- The assigned Codex worktree began detached and clean at
  `d8bcdb221e49f7ed664eeb43733918eabd0ccf30`, tree
  `9fe7ccb41e38e3606c371f8cbcb8dbdbf7c6f103`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` independently resolved to that exact
  commit and tree before branch creation.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`; the isolated worktree was attached to
  the exact branch `codex/v2/service-worker-lifecycle`.
- Status was clean before branch creation. The supplied untouched-baseline evidence records
  `npm ci` passing, syntax checking 259 files, privacy passing, the full suite passing 1696/1696,
  and clean diff/status.
- Local `gh` authentication is invalid. It will not be repaired through Chrome, interactive
  login, or a user browser/profile. A GitHub App `403` write must be delegated exactly to the
  control tower.

## A1 Task-Brief publication boundary

The first feature-branch commit contains exactly this path:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
```

It must be pushed normally and used to open a Draft PR targeting `integration/v2` with the exact
title:

```text
fix(v2): govern Service Worker lifecycle
```

If the GitHub App returns `403` or `Resource not accessible by integration`, delegate the exact
GitHub write to the control tower. Do not use Chrome, interactive login, a user profile, or another
credential path.

## A2 findings-first read-only investigation contract

Audit the actual production call graph end to end:

```text
registration and update checks
-> install and install seeding
-> installed/waiting worker and activation trigger
-> activate cleanup and client adoption
-> controllerchange and page reload/update UX
-> controlled and uncontrolled fetch
-> request classification and response/cache behavior
-> multi-tab and mixed-version coexistence
-> failure, cancellation, timeout, observability, eviction, and rollback
```

The audit must inventory exact current source, tests, authoritative documentation, and browser
standards for:

1. `skipWaiting`, `clients.claim`, install seeding, fixed or versioned cache names, activate-time
   deletion, registration/update checks, `controllerchange`, and fetch handlers;
2. R9 request/response policy, R11 same-origin vendor assets, query/private bypasses, local
   development policy, cache keys, and response admission;
3. controlled/uncontrolled clients, old/new worker coexistence, waiting-worker behavior,
   multi-tab mixed-version behavior, page reloads, update prompts, and scope;
4. cold and warm offline behavior, partial or failed install/update/activate, fetch failures,
   cancellation/timeouts, retry and observability;
5. precise cache ownership, entry ownership, eviction eligibility and timing, owner-scoped
   cleanup, unrelated cache preservation, storage/user-data boundaries, and rollback to a prior
   build; and
6. material browser/platform limitations and every dependency on deployment, immutable asset
   publication, release ordering, rollback retention, hosting headers, and release policy.

Read the current PRD, release gates, relevant Task Briefs, and exact source/tests. Do not rely on
stale PR summaries. Evidence is limited to repository/static/standards analysis and deterministic
synthetic or in-memory probes. No production deployment, real Service Worker rollout, user browser
or profile, credentials, account/private activity, provider/network telemetry, or real cache,
database, storage, or registration mutation is permitted.

## Material A/B/C owner decision gate

Before any production, test, package, workflow, or Service Worker change, deliver one complete,
mutually exclusive A/B/C package directly to the control tower. It must include one recommendation
and explain tradeoffs. Each option must explicitly freeze:

- activation and update UX, including waiting, prompting, reload, and cancellation semantics;
- cache version/naming, exact ownership, entry ownership, eviction timing, and untouched caches;
- old/new worker coexistence, controlled/uncontrolled clients, and mixed-tab behavior;
- install/update/activate failure, timeout, retry, fallback, and observability semantics;
- precise cold/warm offline claims and rollback-to-prior-build behavior;
- browser/platform scope, privacy and complete user-data preservation boundaries;
- deployment and release dependencies, including publication order and retained rollback assets;
  and
- a collision-audited exact candidate implementation path allowlist and verification boundary.

The options must be materially distinct and cannot silently mix. A required extra path, dependency,
public surface, storage mutation, deployment promise, or collision with R6/R7/R8/R9/R11 or an
accepted contract stops implementation and must be routed as a new minimum decision.

## Stop and write boundary

During A2, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-38-service-worker-lifecycle.md
```

A2 may add findings and the decision package to this Task Brief in one docs-only commit and push
it. It may not edit production code, tests, fixtures, packages, lockfiles, workflows, Service
Worker files, generated artifacts, or other documentation. Keep the PR open and Draft. Do not
mark Ready, merge, clean up, deploy, release, change a default branch, clear caches/data, or begin
another risk surface. Stop before implementation until the owner explicitly selects A, B, or C.
