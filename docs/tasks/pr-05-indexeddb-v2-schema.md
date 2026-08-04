# PR-05: IndexedDB v2 Schema

## Metadata

| Field | Value |
| --- | --- |
| Status | Investigating |
| Milestone | M2 |
| Base branch | `integration/v2` |
| Exact base SHA | `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110` |
| Feature branch | `codex/v2/storage` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/09cc/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Control tower decision; independent implementation review required later |
| Related PRD | [StravaStats v2 PRD](../product/stravastats-v2-prd.md) |
| Related ADRs | [ADR-0001](../architecture/adr/0001-canonical-activity.md), [ADR-0002](../architecture/adr/0002-stream-model.md), [ADR-0003](../architecture/adr/0003-repository-boundary.md), [ADR-0004](../architecture/adr/0004-import-pipeline.md), [ADR-0005](../architecture/adr/0005-analysis-versioning.md), [ADR-0006](../architecture/adr/0006-source-provenance.md) |
| Dependencies | PR-00 through PR-04C merged into `integration/v2` at the exact base SHA |
| Pull request | To be created as Draft during A1 |
| Created | 2026-08-04 |
| Last updated | 2026-08-04 |

## Goal

Freeze and implement the smallest independently testable physical IndexedDB v2
schema for the new `strava-stats-v2` database, together with its storage boundary,
transaction primitive, idempotent migration foundation, Repository adapter seam,
and backup-manifest metadata foundation, without changing any page read source or
opening the Legacy `strava-dashboard-cache` database for write, upgrade, clear, or
delete operations.

This brief is currently an investigation contract only. Implementation is not
authorized until the control tower accepts the A3 decision package and changes
the status to `Approved for implementation`.

## Why now

PR-00 through PR-04C established repository safety, rescued the Legacy cache,
accepted the Canonical contracts, created the Repository boundary, and migrated
current consumers away from provider and persistence selection. PR-05 is the next
serial dependency before shadow writing and import work can safely begin.

## Investigation questions

- What IndexedDB, Legacy cache, Repository, and Canonical boundaries exist at the
  exact base, and what is their true runtime call graph?
- Which proposed stores and indexes are justified by an already accepted contract
  or an immediate PR-05 query, and which remain future-only proposals?
- What exact public storage API, transaction surface, migration state machine,
  stable error codes, and backup-manifest contract can PR-05 safely freeze?
- How can tests prove empty initialization, idempotency, upgrade, interruption,
  retry, rollback, quota/error handling, multi-connection `versionchange`, index
  queries, Legacy database preservation, and Legacy feature-flag fallback?
- Which checks require real browser IndexedDB evidence rather than
  `fake-indexeddb`, and is an approved isolated Browser/CDP surface available?
- Does PR-05 need a storage-specific nested `AGENTS.md`, any package change, or a
  change to an Accepted ADR? Any such expansion requires an explicit decision.

## Confirmed current-state facts

The A2 investigation will append the complete evidence and call graph. A0 already
confirmed:

- the worktree began clean at exact SHA
  `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110`;
- local `integration/v2`, `origin/integration/v2`, and the starting HEAD all point
  to that exact SHA;
- the remote feature branch did not exist before this task;
- PR-00 through PR-04C are present in the first-parent history of the base;
- `fake-indexeddb@6.2.5` is already a dev dependency;
- CI uses Node 24 and runs install, syntax, privacy, and the full Node test suite;
- the A0 local baseline passed 965 tests and left the tracked tree clean.

## Decisions required before implementation

The A2 result must present a control-tower decision package covering:

- exact public API and adapter ownership;
- physical schema version, stores, key paths, and indexes;
- transaction and migration state machines;
- stable redacted error codes;
- minimum backup-manifest contract;
- phase B1/B2/B3 allowlists and acceptance commands;
- browser evidence requirements;
- rollback boundaries and every unresolved contract question.

No implementation decision is accepted merely because it appears in a Proposed
document.

## In scope

### A0-A2 investigation scope

- Read-only repository, history, package, test, and GitHub inspection.
- This Task Brief and its investigation evidence.
- A Draft PR targeting `integration/v2`.
- A precise candidate implementation plan for later control-tower approval.

### Candidate implementation scope after explicit A3 approval

- Physical schema for the independent `strava-stats-v2` database.
- Storage connection lifecycle and version-change handling.
- Narrow transaction and migration foundations.
- A Canonical Repository adapter boundary without consumer wiring.
- Minimal backup-manifest metadata describing the current physical schema.
- Deterministic synthetic offline storage tests using `fake-indexeddb` and any
  separately approved browser evidence.

## Out of scope

- PR-06 shadow writing or parity reporting.
- PR-07+ import jobs, decoders, normalizers, workers, identity, merge, restore, or
  source-management behavior.
- Page, tab, detail, analysis, or application read-source changes.
- Canonical cutover, dual write, feature-flag default changes, or Legacy fallback
  removal.
- Backup archive creation, restore execution, user-facing deletion, or automatic
  cleanup.
- Stream compression, Blob/TypedArray/chunk performance decisions without
  evidence and approval.
- Real athlete data, private fixtures, credentials, tokens, browser profiles, or
  network-backed tests.

## Allowed files

During A0-A2 the only writable repository path is:

```text
docs/tasks/pr-05-indexeddb-v2-schema.md
```

The candidate implementation allowlist will be proposed by A2 and remains
unauthorized until A3 acceptance.

## Prohibited files and operations

During A0-A2, do not modify:

```text
package.json
package-lock.json
docs/architecture/adr/**
docs/migrations/indexeddb-v2.md
js/**
tests/**
.github/**
integration/v2
main
maintenance/v1
```

Never read, write, upgrade, clear, overwrite, rename, or delete
`strava-dashboard-cache` as part of PR-05 implementation. Never delete user or
Legacy data, switch page reads to Canonical, rebase, amend, force-push, merge the
PR, or clean up the branch/worktree without explicit authorization.

## Interfaces and expected outputs

The exact public API is intentionally not frozen during A1. A2 must derive the
smallest API from accepted contracts and immediate PR-05 tests, and must keep:

- application IDs as opaque non-empty strings;
- stored contract data plain and JSON-safe unless a separately approved physical
  encoding stays entirely behind the storage adapter;
- accessor, Proxy, symbol, custom-prototype, cyclic, and non-finite inputs
  fail-closed without getter execution or mutation;
- public errors deterministic and redacted;
- the Repository boundary as the only future consumer access path.

## Acceptance criteria

### A0-A2

- [x] Exact local/base/remote SHA and clean starting state verified.
- [x] Minimum baseline commands executed and results recorded truthfully.
- [ ] Draft PR exists and contains only this Task Brief.
- [ ] Current storage and Repository call graph is documented with file evidence.
- [ ] Candidate schema/API/state machine/error/backup contracts are explicit.
- [ ] Proposal-only decisions are separated from accepted facts.
- [ ] Candidate allowlists, phase plan, tests, rollback, and open decisions are
      ready for control-tower review.
- [ ] Status is `Awaiting decision`; implementation has not started.

### Candidate implementation acceptance after A3

- Empty database initialization and repeated initialization are safe.
- Physical schema upgrade and migration retry are deterministic and idempotent.
- Failed transactions and quota/error injection leave no partial activity.
- Multi-connection `versionchange` behavior is explicit and tested.
- Every index has a demonstrated query and deterministic result.
- Legacy database remains unchanged and is never opened for readwrite/upgrade.
- Legacy remains the default and fallback page read path.
- Backup metadata can describe the exact implemented schema.
- Errors are actionable but disclose no record values, locations, credentials, or
  underlying private messages.

## Required automated checks

Repository minimum, both before implementation and at exact implementation head:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Candidate targeted commands and browser evidence will be frozen by A3. A Node
`fake-indexeddb` pass must never be reported as real-browser IndexedDB evidence.

## Manual verification

A2 will determine whether real Browser/CDP verification is necessary and whether
an isolated, synthetic, profile-independent execution surface is available.
Unexecuted browser, migration, and CI checks must be recorded as `Not run`.

## Privacy and security impact

- A0-A2 reads only repository-controlled synthetic code, docs, tests, and Git
  metadata; it does not read tokens, accounts, real activities, GPS, HR, power,
  private fixtures, or the user's browser profile.
- Future tests must use inline or committed deterministic synthetic values and
  remain offline.
- Error and diagnostic contracts must omit raw record values, storage payloads,
  causes, provider messages, credentials, and precise locations.
- No external service receives activity data.

## Migration impact

A0-A2 has no runtime or database impact. Future PR-05 work may create or upgrade
only `strava-stats-v2`. Migration design must be additive, idempotent, observable,
recoverable, and independent of Canonical/parser/analysis/backup format versions.
Legacy `strava-dashboard-cache` remains untouched.

## Rollback procedure

For A0-A2, revert the Task Brief commits if required; there is no runtime or data
rollback. For later implementation, rollback means revert the feature commit and
keep Legacy mode/read paths active. Do not delete either database as rollback and
do not write V2 data back into Legacy storage. Failed initialization or migration
must close the V2 connection, preserve any previously committed V2 data, and
allow the application to continue on Legacy.

## Risks

### P0

- Accidentally opening `strava-dashboard-cache` with a higher version or a
  readwrite transaction could alter user data.
- Freezing a Proposed store/index contract as if it were Accepted could force
  later import or restore behavior without evidence.
- A partial cross-store write or failed upgrade could create unrecoverable or
  misleading migration state.

### P1

- IndexedDB lifecycle semantics differ between `fake-indexeddb` and real
  browsers, especially `blocked`, `versionchange`, crash, quota, and persistence.
- An adapter that leaks raw IDB objects or storage decisions can bypass the
  accepted Repository boundary.
- Accessors, Proxies, unsafe JSON values, or underlying error messages can create
  side effects or disclose private data.

### P2

- Premature indexes increase write cost and migration burden.
- Over-broad storage helpers could pull PR-06+ import, shadow, backup, or cleanup
  behavior into this PR.

## Independent review checklist

- [ ] Reviewer is independent from the implementation pass.
- [ ] Diff is restricted to the approved allowlist.
- [ ] Database name is exactly `strava-stats-v2`.
- [ ] No Legacy database mutation path exists.
- [ ] Stores/indexes map to frozen contracts and demonstrated queries.
- [ ] Upgrade, interruption, retry, rollback, quota, and concurrency behavior is
      covered without overstating fake-browser evidence.
- [ ] IDs, JSON safety, reflection safety, and error redaction are preserved.
- [ ] Page read source and Legacy feature-flag fallback remain unchanged.
- [ ] Privacy, migration, rollback, and Not-run evidence are complete.

## Completion evidence

### A0 baseline

- Start/base/local/remote SHA:
  `84e5e0af23d133a4fdf1e4c0cf371b5b97b26110`.
- Start state: detached clean HEAD; `codex/v2/storage` did not exist remotely.
- Node: `v25.8.1`; npm: `11.11.0`; CI contract: Node 24.
- `npm ci`: PASS, 6 packages installed.
- `npm run check:syntax`: PASS, 137 files.
- `npm run check:privacy`: PASS.
- `npm test`: PASS, 965 passed, 0 failed/skipped/todo.
- `git diff --check`: PASS.
- Browser/CDP: Not run during A0.
- GitHub exact-head CI for this feature branch: Not run before first push.

### A1 publication

- Branch created from exact base: `codex/v2/storage`.
- Task Brief commit, push, Draft PR, PR URL, and exact-head CI will be appended
  after publication.

### Stop condition

After A2 this brief must say `Status = Awaiting decision`, the Draft PR must remain
open and Draft, and implementation must still be unstarted. Ready-for-review,
merge, rebase, amend, force-push, and branch/worktree cleanup are not authorized.
