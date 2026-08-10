# PR-42: SourceConnection Identity, State, and Backup Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C2 additive SourceConnection and backup decision |
| Status | A1 Task-Brief-only publication; A2 read-only audit authorized; implementation prohibited |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@7dcb90ff171599a38eae31fadd09adc2f2ba7edb` |
| Exact base tree | `941e5a6934f4e781629f42ddbec764736f815393` |
| Feature branch | `codex/v2/source-connection-identity-backup` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr42/StravaStats` |
| Parent decision | PR-40 / D-A A2 / D-B C, staged C1-C4 |
| Completed prerequisite | C1 / PR #47 squash-merged as `7dcb90ff171599a38eae31fadd09adc2f2ba7edb` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce a findings-first, materially complete owner decision package for C2: the durable identity and
state semantics of an additive V5 `SourceConnection`, together with its backup/restore treatment.
The package must define what can be represented safely before C3 provider import and C4 ownership/
lease recovery, without enabling live authorization or changing production schema, public APIs, or
backup bytes.

This first commit creates only this Task Brief. A2 is read-only except for later updates to this same
file. No C2 implementation begins until the owner selects an exact A3 option and separately approves
its literal path allowlist.

## Authority and current limit

The owner selected staged P0 closure through C1-C4 and, after C1 merged, authorized only the next C2
planning stage:

> Proceed only to the next authorized C2 stage: create/freeze a Task-Brief-first read-only
> identity/state + backup material decision package from exact integration head 7dcb90ff..., with a
> separate Draft PR if required. Do not implement C2 schema/public/backup changes until a new explicit
> owner A3 decision.

Authorized now:

- create this isolated branch/worktree from the exact integration head;
- publish a Task-Brief-only first commit and an open Draft PR targeting `integration/v2`;
- inspect current code, tests, PRD, accepted ADRs, plans, release gates, schema, Storage, Backup,
  Source Manager, C1 controller, provenance, and migration contracts read-only; and
- update only this Task Brief with findings, mutually exclusive owner decisions, literal candidate
  allowlists, failure-first tests, browser evidence, migration/privacy/rollback impact, and risks.

Not authorized:

- any production or test implementation outside this Task Brief;
- V5/schema/store/index/record changes, data migration, public Storage/Repository/Backup/Import API
  changes, Worker or Service Worker changes, dependencies, server APIs, or root auth changes;
- OAuth/config/exchange/revoke, credentials, Token/status reads or writes, real provider/account calls,
  private data, private fixtures, user browser profiles, deployment, release, Ready, merge, or cleanup;
- C3 provider-to-`ImportedActivityBundle` work or C4 durable ownership/heartbeat/lease recovery.

## Global invariants

- Preserve every Legacy and V2 record. Migration proposals must be additive, idempotent, observable,
  recoverable, and must not reinterpret existing `ActivitySource` provenance as authenticated identity.
- Disconnecting a provider, removing authorization material, deleting a `SourceConnection`, and
  deleting local activities are separate decisions and actions.
- A durable connection record must not contain Tokens, authorization headers, raw provider responses,
  athlete profile payloads, activity payloads, precise location, health/power data, or private errors.
- Backup/restore must remain deterministic, local-first, explicit, bounded, and safe for archives made
  before or after the selected schema version. A connection record must never imply that credentials
  or provider authorization were backed up.
- Legacy, Shadow, Canonical, Demo, local file imports, provider identities, and future connection
  ownership remain isolated behind explicit boundaries.
- C2 must not claim provider reachability, granted scopes, token validity, last successful sync, activity
  ownership, retry/resume, or lease authority unless an approved authoritative source exists.

## Required A2 findings

The read-only audit must establish exact current behavior and call graphs for:

1. V2 V4 schema descriptors, physical migrations, Storage Factory/public surfaces, Repository, and all
   current uses of provider/external identity.
2. `ActivitySource`, raw-artifact identity, duplicate/link resolution, Import job provenance, and the
   boundary between imported provenance and authenticated connection identity.
3. Backup archive manifest/payload, compatibility/version checks, validation, restore planning,
   idempotency, settings treatment, cancellation/quota/rollback, and public Backup API.
4. C1 Source Manager controller snapshot/lifecycle, existing root auth/Token behavior, Demo isolation,
   local-first startup, diagnostics, Service Worker, and privacy/network boundaries.
5. PRD P0, accepted ADRs, engineering plans, release gates, historical backup/schema requirements, and
   any collision with open work.

Findings must precede recommendations. Old summaries and historical conversations are not evidence.

## Required owner decisions

The A2/A3 update must present mutually exclusive packages for at least these separable questions:

- **D-C2.1 identity/state:** the exact durable identity key, provider vocabulary, lifecycle states,
  transitions, timestamps, capabilities, disconnect/tombstone semantics, multi-account policy,
  uniqueness/conflict rules, malformed/unknown/future values, and what remains unavailable before C3.
- **D-C2.2 backup/restore:** whether and how non-secret connection metadata is included, archive/schema
  compatibility, restore conflict policy, redaction, determinism, ordering, empty/existing-library
  behavior, cancellation/quota/rollback, and treatment when credentials are deliberately absent.
- **D-C2.3 delivery boundary:** one combined C2 implementation or separately approved schema/storage and
  backup tranches, with collision-audited literal path maximums for each option.

Each option must name its public/schema/dependency/Worker/Service Worker boundaries, failure-first
tests, actual browser evidence, data migration, privacy, rollback, architecture risk, collision risk,
and what requires real credentials/private/provider evidence. No option may infer authorization for
such evidence.

## A1 publication contract

First commit changed path:

```text
docs/tasks/pr-42-source-connection-identity-backup.md
```

Draft PR title:

```text
feat(v2): define SourceConnection identity and backup contract
```

Draft PR body:

```markdown
## What changed

Adds the C2 Task Brief for the SourceConnection identity/state and backup material decision package.

## Why

C1 is merged, but V5 schema, public Storage/Backup surfaces, migration, and provider identity semantics remain separately gated. This Draft freezes the read-only C2 audit and owner-decision boundary before implementation.

## Impact

Docs only. No schema, migration, Storage/Repository/Backup/Import API, OAuth, Token, provider, Worker, Service Worker, dependency, or data change.

## Checks

- exact-base and one-path diff audit
- `npm run check:privacy`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
the A1 publication.

## Required verification

For A1 and each later docs-only A2/A3 update:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Tests remain offline and synthetic. No browser pass may be claimed unless it actually runs against the
exact relevant head; A2 planning does not require private or provider evidence.

## Stop condition

After the Task-Brief-only Draft is published, continue only with the authorized read-only audit and
same-file A2/A3 decision freeze. Stop before any schema, Storage, Backup, migration, auth, provider,
test, browser, or other implementation path until a new explicit owner decision approves one exact
package and literal allowlist.
