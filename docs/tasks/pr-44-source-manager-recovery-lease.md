# PR-44: Source Manager Durable Recovery Lease

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M31 / C4 durable owner, heartbeat, lease, and explicit recovery |
| Status | A1 Task-Brief Draft; A2 findings-first audit authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994` |
| Exact base tree | `11434bb7cbce1cef2e72904182df089b17a7e2e9` |
| Feature branch | `codex/v2/source-manager-recovery-lease` |
| Parent decision | `D-A A2 / D-B C`, staged C1–C4 closure |
| Completed prerequisites | C1, C2, C3a, C3b, C1.1, and C3c merged |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Current authority | A0, A1 Draft publication, and read-only A2 decision package only |

## Goal

Define a materially complete owner decision for C4 durable Source Manager coordination after merged
C3c. C4 owns durable owner identity, heartbeat and lease semantics, plus explicit `Recover` and
`Abandon` actions. Startup, reload, visibility, online, restore, and lease expiry must never resume,
retry, or start provider acquisition or Import work automatically.

This first commit changes only this Task Brief. A2 may inspect the exact merged tree read-only and
may update only this same document. No production, test, schema, migration, public API, Backup,
Worker, Service Worker, dependency, provider, or browser-profile change is authorized.

## Authority and sequence

The authoritative baseline is C3c PR #54 squash-merged at
`integration/v2@c2df4ea16920d4b5c80ea06eae1059c1940e1994`. The owner route remains:

> D-A A2 / D-B C: staged full P0 closure through separate C1–C4 tranches, with no release claim.

C1, C2, C3a, C3b, C1.1, and C3c are merged. This dispatch authorizes only:

1. independent A0 verification of the exact base, remote, clean state, and untouched gates;
2. an A1 Task-Brief-only first commit and open Draft PR against `integration/v2`; and
3. a findings-first, source-to-state A2 audit recorded only in this Task Brief.

It does not authorize C4 implementation or tests, schema/public API expansion, migration, Ready,
merge, cleanup, deployment, release, real provider/account/private data, or a user browser/profile.

## Global invariants

- Preserve the working V1 path and every Legacy and V2 record. No delete, clear, overwrite,
  downgrade, implicit migration, destructive cleanup, or rollback of committed import items.
- Disconnecting Strava, abandoning a recovery claim, removing authorization material, and deleting
  local data remain distinct decisions and actions.
- Provider, subject, activity, Import job, item, owner, and lease IDs remain opaque strings. Missing
  or null values never become `0`; true zero remains distinct.
- Provider data may persist only through the merged C3a → C3b → existing ImportService path.
  Source Manager and pages must not choose persistence directly.
- Startup, reload, restore, `pageshow`, visibility, online, heartbeat observation, lease expiry, and
  cross-tab messages perform no automatic provider read, Import resume, retry, or new scheduling.
- A durable record must not contain Token values, authorization headers, raw provider responses,
  filenames, precise location, health/power data, private errors, or identifiable athlete data.
- C4 cannot promise cancellation of already committed items, a running IndexedDB transaction that
  has crossed its commit boundary, or work continuing in a crashed/closed browsing context.
- Demo remains isolated from Real storage, provider, authentication, recovery, and lease capability.
- Draft status, passing tests, or successful CI is not implementation, merge, deployment, or release
  authorization.

## A0 exact-base and untouched-gate evidence

- This isolated worktree began clean and detached at exact commit
  `c2df4ea16920d4b5c80ea06eae1059c1940e1994`, the exact local and remote-tracking
  `integration/v2` head. The integration worktree was not opened or modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`; upstream push is disabled.
- GitHub App readback confirms PR #54 is closed and merged, with squash merge commit
  `c2df4ea16920d4b5c80ea06eae1059c1940e1994` into `integration/v2`.
- Local and remote-tracking `main` and `maintenance/v1` remain at
  `fe34535c39db421434a5e28cd26a57b3f71130e2`.
- The delegated postmerge record reports `npm ci`, syntax 279, privacy, full 1864/1864 tests,
  `git diff --check`, and integration push CI run `31482670964`, job `93750958046`, successful at
  the exact base. These remain baseline facts until independently read back; they are not evidence
  for this feature head.
- GitHub CLI 2.96.0 is installed, but its API credential is invalid. No interactive login or user
  browser/profile may be used. GitHub App operations are preferred.
- The feature branch was created from the exact base only after local and GitHub branch-name
  collision checks returned no existing `codex/v2/source-manager-recovery-lease` branch.

## A1 publication contract

The first commit and initial Draft PR diff must contain exactly:

```text
docs/tasks/pr-44-source-manager-recovery-lease.md
```

Draft PR title:

```text
feat(v2): define Source Manager recovery lease
```

Draft PR body:

```markdown
## What changed

Adds the C4 Task Brief for durable Source Manager owner/heartbeat/lease coordination and explicit Recover or Abandon decisions.

## Why

C3c is merged, but durable owner provenance, lease expiry, cross-tab takeover, terminalization, recovery UX, and schema/API boundaries require a separate findings-first owner decision. No automatic resume is allowed.

## Impact

Docs only. No Source Manager, Import, Storage, schema, migration, Backup, public API, Worker, Service Worker, dependency, provider/auth, Token, browser-profile, or user-data change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
A1.

## A2 findings-first audit contract

A2 must establish from the exact current code, tests, and accepted documentation:

1. the source-to-state call graph from Source Manager and merged C3c into C3a, C3b, ImportService,
   ImportJob, ImportItem, Storage, Repository, SourceConnection, and public report surfaces;
2. every existing durable and ephemeral job/item/controller state, transition, timestamp, error
   code, cancellation checkpoint, transaction boundary, and terminal report predicate;
3. current IndexedDB schema, migration, Storage Factory, Backup/restore, public/internal API, Demo,
   startup, reload, close, pagehide, visibility, offline, and cross-tab capabilities;
4. what survives reload/crash/close, what cannot survive, which committed items remain, and whether
   any uncommitted item can be safely scheduled only after an explicit user action;
5. SourceConnection C2 history and C3c success-CAS interactions, including stale revision, authority
   loss, reconnect, disconnect, restore, quota, storage, and malformed-record behavior;
6. browser/platform primitives and limits for owner identity, clocks, heartbeats, leases, CAS,
   BroadcastChannel/storage observation, timer throttling, transaction cancellation, and crash
   detection; and
7. exact test topology, actual-served disposable synthetic browser seams, privacy boundaries, and
   literal-path collision candidates.

Historical summaries are context, not evidence. Findings must precede recommendations.

## Required A2 material decision package

The Task Brief update must present mutually exclusive complete owner options. Each option must fix:

- owner/tab identity provenance, generation, lifetime, storage, redaction, and privacy;
- heartbeat and lease timestamps, duration, clock source, skew handling, visibility throttling,
  sleep/wake, offline behavior, and expiry calculation;
- exact eligible nonterminal ImportJob and ImportItem states;
- the invariant that observation never resumes work automatically;
- exact `Recover` and `Abandon` visibility, confirmation, preconditions, action effects, idempotency,
  and unavailable/conflict copy;
- cross-tab conflict, CAS revision, expiry, takeover, losing-tab behavior, and simultaneous action
  linearization;
- limits on aborting provider requests, active Workers, ImportService work, and IndexedDB
  transactions, including commit-boundary uncertainty;
- reload, crash, close, `pagehide`, `pageshow`, visibility, and browser process-loss semantics;
- retention of committed items and the exact future scheduling rule for remaining work;
- exact ImportJob/ImportItem terminalization, totals, audit fields, and fixed redacted error codes;
- quota/storage failure behavior, partial-write handling, and what action remains available;
- Backup/restore inclusion or exclusion and SourceConnection/C3c authority/history interaction;
- exact schema/store/index/migration, public API, internal API, dependency, Worker, Service Worker,
  and browser-runtime impact;
- browser/platform limitations, unsupported cases, privacy, rollback, and failure-first tests;
- actual-served disposable synthetic browser evidence with interception before navigation and no
  user profile, credentials, real provider, or private data; and
- a collision-audited literal cumulative path allowlist, with no glob or implicit substitute.

Every option must state what it cannot guarantee. Any required schema, migration, Backup format,
public API, Worker protocol, Service Worker, dependency, provider/private evidence, or additional
path remains a separate owner decision and is not inferred from this audit.

## Stop conditions

Stop and return to the control tower before:

- any product or test implementation before an explicit owner selection;
- any real Token/account/provider/private activity or user browser/profile use;
- any schema, migration, public API, Backup format, dependency, Worker protocol, Service Worker,
  deployment, or release mutation;
- any path outside this Task Brief during A2;
- any Ready transition, merge, auto-merge, prior-PR closure, branch/worktree cleanup, final release
  audit, rebase, amend, force-push, or destructive Git/data action.
