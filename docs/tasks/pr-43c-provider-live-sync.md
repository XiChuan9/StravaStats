# PR-43c: Bounded Provider Live Sync Activation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M28 / C3c live provider-to-import activation audit and material freeze |
| Status | A1 Task Brief publication pending; no implementation authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae` |
| Exact base tree | `14f60e943fea98a3d35d1c116f04493c8b523154` |
| Feature branch | `codex/v2/provider-live-sync` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/35cd/StravaStats` |
| Parent decision | D-A A2 / D-B C; D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A |
| Completed prerequisites | C1 controller, C2 SourceConnection/Backup, C3a mapper, C3b artifact import |
| Pull request | Draft PR against `integration/v2` to be created after the Task-Brief-only first commit |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Owner approval | A0-A2 investigation and material freeze only |

## Goal

Produce a findings-first, materially complete owner decision package for C3c: an explicit and
bounded live provider acquisition may feed only the already merged C3a mapper, C3b artifact builder,
and existing ImportService pipeline. Freeze the live authentication boundary, provider request
contract, orchestration and SourceConnection transitions, UI and privacy behavior, evidence gates,
and the smallest collision-audited literal candidate allowlist before any implementation begins.

This first commit creates only this Task Brief. A2 is read-only except for updates to this same file.
No live implementation starts until the owner explicitly approves every material choice and the
exact literal path hard maximum.

## Authority and boundary

The authoritative baseline is merged PR #51 at
`integration/v2@43455a6c9f513cca57d661a1aef179bb588897ae`. The delegated integration evidence records
successful integration-push CI run `31449313043`, job `93650164736`, plus an independently clean
integration worktree with syntax 271 and full 1782/1782 tests. Those are baseline facts, not evidence
for this feature head.

The owner selected staged P0 closure through separate C1-C4 tranches and later selected:

> D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A

That authority permits only this isolated branch, a Task-Brief-only Draft PR, read-only current-code
investigation, and updates to this Task Brief containing the C3c material package. It does not
authorize production or test implementation, live OAuth/Token/account/provider calls, private data,
schema/public API/dependency/Worker/Service Worker/server/CSP expansion, Ready, merge, cleanup,
deployment, release, or C4 ownership/lease work.

## Global invariants

- Provider data may enter persistence only through C3a mapping, C3b artifact construction, and the
  existing ImportService. No parallel persistence or page-selected storage path is allowed.
- Legacy and V2 data are preserved. No migration shortcut, deletion, clear, overwrite, cleanup, or
  provenance reinterpretation is allowed. Disconnecting Strava and deleting local data remain
  separate actions.
- Missing and null never become zero. True zero and negative zero remain distinct wherever frozen.
  Activity and provider IDs remain opaque strings and are never numericized.
- Connect, Sync, Disconnect, startup, reload, restore, and offline transitions are explicit. Connect
  must never trigger automatic sync, and startup/reload/restore must never trigger provider I/O.
- Token, authorization header, subject, private provider values, precise location, health/power data,
  and raw provider errors must not enter DOM, logs, reports, errors, Diagnostics, Backup, URLs, Git,
  or deterministic synthetic evidence.
- Identity, granted scope, provenance, cancellation, error redaction, and bounded acquisition remain
  fail closed. No implementation option may weaken them to avoid a server or public-boundary decision.
- Public APIs, schema, algorithms, dependencies, Worker, Service Worker, server, and CSP remain
  unchanged unless A2 proves a minimum expansion unavoidable and returns it as an explicit owner
  option. Discovery is a stop, not implicit authorization.
- Only deterministic synthetic evidence is permitted in this phase. No user Chrome/profile or real
  account/provider evidence is authorized.

## A0 exact-base and untouched-gate evidence

- The isolated worktree began clean and detached at exact commit
  `43455a6c9f513cca57d661a1aef179bb588897ae`, tree
  `14f60e943fea98a3d35d1c116f04493c8b523154`.
- Local `integration/v2` and `origin/integration/v2` both resolved to the exact base. `origin` is
  `https://github.com/XiChuan9/StravaStats.git`; upstream push is disabled.
- The narrow feature branch `codex/v2/provider-live-sync` was created at that exact commit. The
  dedicated integration worktree was not opened or modified.
- GitHub CLI 2.96.0 is installed, but its local credential reports invalid. No interactive login,
  Chrome, or user browser profile will be used. Normal Git push and GitHub App/connector publication
  may be attempted independently; any remaining authentication failure is returned exactly.
- A1 local gates passed on the docs-only working tree: `npm ci`; syntax for 271 files; privacy;
  full `npm test` 1782/1782; and `git diff --check`. Exact-head CI is recorded only after it runs.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

Draft PR title:

```text
feat(v2): activate bounded provider sync
```

Draft PR body:

```markdown
## What changed

Adds the C3c Task Brief for the live provider-to-existing-import activation audit and material freeze.

## Why

C1, C2, C3a, and C3b are merged, but live authentication, bounded provider requests, cancellation, SourceConnection transitions, UI, privacy, and runtime boundaries require a separate owner-approved package before implementation.

## Impact

Docs only. No provider/OAuth/Token/account/private-data call, Import or Storage mutation, schema/public API/dependency/Worker/Service Worker/server/CSP change, migration, deploy, or release.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, release, C4 work, or
real/private evidence is part of A1.

## A2 findings-first audit

A2 must read the exact merged code, tests, and accepted documentation before recommending a
contract. It must establish:

1. Source Manager composition/controller/UI behavior, Demo isolation, CSP, offline/reload behavior,
   and root auth/Token lifecycle including same-origin API/server routes.
2. C2 SourceConnection schema, store/status/CAS transitions, subject and granted-scope semantics,
   Backup treatment, and the boundary with future C4 ownership/lease recovery.
3. C3a mapper authority snapshot, exact scopes, limits, ordering, cancellation, reduced provider
   inputs, opaque IDs, and missing/null/zero rules.
4. C3b artifact builder through existing ImportService/Worker/Backup provenance, including artifact,
   item/job/report, duplicate/reselection/conflict, cancellation, quota, and partial-success behavior.
5. Existing connector and same-origin route behavior for pagination, detail, streams, laps,
   rate-limit/429, timeout, retry, AbortSignal, errors, redaction, and offline boundaries without
   issuing any provider request.
6. Existing public exports, schema, dependencies, server, R9 Service Worker and R11 CSP/runtime
   boundaries, privacy guards, Diagnostics, cache behavior, and collision surfaces.
7. The historical parent Task Brief on `origin/codex/v2/source-manager-lifecycle` only as decision
   provenance; current integration code remains authoritative.

Findings must precede recommendations. The old broad C3 candidate list must not be inherited without
a current collision audit.

## Required material decision package

The A2 update must freeze complete, mutually exclusive owner options for at least:

- exact explicit Connect/Sync/Disconnect states and whether live auth belongs in C3c or a separately
  named minimum C1.1 tranche;
- OAuth/state/confidential-client posture, callback scrub ordering, subject/granted-scope binding,
  Token acceptance/removal, revoke ownership, and safe local-only fallbacks;
- exact provider routes, methods, requested fields, page/detail/stream/lap bounds, concurrency,
  rate-limit/429, timeout, retry/no-retry, AbortSignal, and partial-page semantics;
- exact mapping to artifact to existing ImportService orchestration, item/job ordering,
  duplicate/reselection/conflict/cancellation/quota/partial-success rules;
- exact SourceConnection CAS transitions and `lastSyncAt` rule derived only from public ImportReport
  outcomes, including stale revision, disconnect/cancel/offline/page-close behavior and C4 separation;
- exact UI status/action/copy, Demo zero-I/O, reload/offline, privacy/redaction/DOM/Diagnostics/Backup/
  Service Worker/cache boundaries;
- schema/public API/dependency/Worker/Service Worker/server/CSP effects, migration/data/rollback
  impact, real/private evidence gates; and
- a collision-audited literal candidate allowlist with an exact hard maximum and no substitutions.

If safe live activation unavoidably requires server/auth/public/API expansion, A2 must present that as
an explicit owner option and stop. No package may trade away identity, scope, provenance,
cancellation, or redaction.

## A2 write and publication boundary

Until a new owner decision, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-43c-provider-live-sync.md
```

A2 may publish only a second Task-Brief-only commit on the same Draft PR. It must run the repository
minimum gates, audit exact path scope, read back remote depth one and exact-head CI, and keep the PR
open and Draft. It must return the complete A/B/C decision package to the control tower. No
implementation follows automatically.
