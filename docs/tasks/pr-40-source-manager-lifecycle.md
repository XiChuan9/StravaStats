# PR-40: Source Manager Lifecycle Decision Audit

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / release lifecycle decision |
| Status | Investigating; no implementation authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/source-manager-lifecycle` |
| Exact base | `integration/v2@b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df` |
| Exact base tree | `8692ac73a08a4725b68f40cf135be743d3018666` |
| Owner | Product owner; Codex findings-first audit |
| Dependency | PR #45 merged; integration push CI run `31312737153`, job `93242975924`, successful |
| Pull request | Draft, targeting `integration/v2`; creation pending first Task-Brief-only push |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Produce authoritative current-tree evidence and a minimal owner decision package for the Source
Manager connector, disconnect, and import retry/recovery lifecycle. This is an A0/A1/A2
findings-first task. No product implementation, public contract change, provider request, real
account use, or private evidence is authorized until the owner selects both the milestone scope and
one Source Manager contract package.

Conflicts resolve in this order: accepted ADRs, the product PRD, engineering plans and release
gates, this Task Brief, then implementation details. Proposed ADRs and historical conversations do
not freeze an undecided contract.

## Global invariants

- Preserve the working V1 path and every Legacy and V2 record. Disconnecting Strava and deleting
  local data remain separate actions.
- Keep Demo, Legacy, Shadow, and Canonical modes isolated. Default feature flags continue to
  preserve the accepted production behavior.
- Do not add or exercise OAuth, credentials, Tokens, provider/API calls, external network,
  migrations, schema/public API/dependency expansion, Worker or Service Worker changes.
- Use deterministic synthetic/static evidence only. Do not use a real account, private activity,
  private fixture, user browser profile, provider request, deployment, or release action.
- A2 may change only this file. Implementation begins only after the owner selects the exact D-A
  and D-B contracts and separately authorizes the resulting literal path allowlist.

## A0 exact-base and untouched-gate evidence

- The assigned worktree began detached and clean at exact commit
  `b9e4e1d7eedb5051a582e15d39be8c0ffc1a43df`, tree
  `8692ac73a08a4725b68f40cf135be743d3018666`.
- The requested branch did not exist and the worktree was attached to the new isolated branch
  `codex/v2/source-manager-lifecycle`. The unique integration worktree was not modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`.
- Untouched baseline gates passed: `npm ci`; `npm run check:syntax` for 261 files;
  `npm run check:privacy`; full `npm test` 1711/1711; and `git diff --check`.
- Local `gh` authentication is invalid. It will not be repaired through Chrome, interactive login,
  or a user browser/profile. If the GitHub App cannot create the Draft PR, delegate only that exact
  write to the control tower.

## A1 publication boundary

The first feature-branch commit contains exactly this path:

```text
docs/tasks/pr-40-source-manager-lifecycle.md
```

It must be pushed normally and used to open a Draft PR targeting `integration/v2` with the exact
title:

```text
feat(v2): complete Source Manager lifecycle
```

No Ready, merge, cleanup, deploy, release, history rewrite, PR #31 edit, or implementation is
authorized.

## A2 investigation questions

Read the exact current code, tests, PRD, release gates, and accepted architecture records for:

- Source Manager page, bootstrap, modes, First-run, local file/ZIP intake, import progress, log,
  reports, preview, cancellation, reload, and missing recovery/retry controls;
- `ImportService` job/item states, `retryJob`, quota behavior, duplicate handling, cancellation,
  idempotency, resumability, and durable report boundaries;
- existing auth, connector, Token, disconnect, identity, provider/API, Repository, Storage, Backup,
  Diagnostics, browser/network/privacy, Worker, and Service Worker boundaries; and
- the exact Alpha versus full-v2.0 requirements and release evidence.

The final A2 update must present findings before recommendations, then require two separable owner
decisions:

1. **D-A milestone scope:** Alpha-now with exact disclosed deferrals and success criteria; direct
   full v2.0 implementing the PRD P0 lifecycle; or another option only if current evidence proves it
   genuinely distinct.
2. **D-B Source Manager contract:** mutually exclusive A/B/C packages covering Connector status,
   Connect, Disconnect, and import retry/recovery with exact UI, authorization, Token, storage,
   network, data-preservation, privacy, rollback, error, cancellation, and resume semantics.

For every option, derive a collision-audited literal candidate path allowlist, public/schema/
dependency/Worker/Service Worker boundaries, failure-first tests, browser evidence, migration/data
impact, rollback, and architecture/collision risk. Separate deterministic synthetic completion from
evidence that requires a real provider account or private data. Any real OAuth/credential need or
public API/schema/dependency expansion is a stop condition, not inferred authority.

## A2 output and stop condition

The A2 commit remains docs-only and changes only this Task Brief. It records evidence and owner
choices; it does not select or implement a product contract. After normal push, the exact head,
open/Draft PR state, and exact-head CI must be verified. The complete decision package is then
returned directly to the control tower for owner selection.
