# PR-47: Final V2 Release Roadmap

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M34 / FINAL-ROADMAP |
| Status | Ready for investigation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/final-roadmap` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/345f/StravaStats` |
| Exact base | `integration/v2@f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628` |
| Exact base tree | `58b8339361991c5c34258be579733ccda3cbe066` |
| Owner | XiChuan9 |
| Authority | Findings-first release-documentation reconciliation and exact documentation tests only |
| Pull request | Pending Draft PR |

## Goal

Establish one authoritative remaining V2 release roadmap after all deterministic implementation and
documentation work merged. The roadmap must separate the shortest honest V2 Alpha path from the
complete `v2.0.0` path, close PR #57 Retry and PR #58 P1-DOCS only on exact postmerge evidence, and
list only gates that genuinely remain.

This task does not authorize a product change, an Alpha/Beta/RC/production claim, or closure of any
gate that requires owner judgment, real credentials/private data, a user device, deployment,
Service Worker rollout, history mutation/disposition, versioning, artifacts, tags, or release-owner
approval.

## Why now

PR #58 squash-merged at the unique integration baseline above after PR #57. The postmerge baseline
has green local and exact-head CI evidence, while current release documents still contain temporary
P1-DOCS wording and no single dependency-ordered inventory of the remaining external and owner
gates. Further release work needs one durable, non-duplicative roadmap.

## A0 exact baseline

The initial readback, performed before this Task Brief was created, established:

```text
integration commit      f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628
integration tree        58b8339361991c5c34258be579733ccda3cbe066
integration divergence  0/0
worktree state          clean and detached at the exact base before branch creation
PR #58                   MERGED; squash merge f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628
integration CI          run 31569312683 / job 94027710807 SUCCESS at the exact base
main/maintenance        not modified by this task
```

The supplied postmerge local record is `npm ci` PASS, syntax 283 files PASS, privacy PASS, full
`1913/1913` PASS, `npm audit` zero vulnerabilities, `git diff --check` PASS, clean tree, and local/
origin integration 0/0. This task must distinguish that accepted exact-base record from checks run
on the eventual roadmap head.

## Investigation questions

The read-only A2 audit must answer, against PRD, engineering plan, current release gates, known
limitations, merged Task Briefs, exact code/tests, and current GitHub state:

1. Which deterministic Alpha, Beta, RC, privacy, migration, rollback, and documentation gates are
   already closed on the exact integration tree?
2. Which statements are stale after PR #57 and PR #58, and which documents or tests collide with a
   single-roadmap claim?
3. What is the shortest honest Alpha path without silently promoting Beta/RC/production evidence?
4. What additional gates are required for complete `v2.0.0`, in dependency order?
5. For each remaining gate, what exact evidence closes it, what must not be claimed, what release
   stage it blocks, what minimum independent task owns it, and what privacy/data/rollback impact
   applies?
6. Which gates belong to evidence class A, B, C, D, E, or F below, and which require one
   consolidated owner decision package before any implementation can continue?

## Required classification

| Class | Meaning |
| --- | --- |
| A | Automatically closable with repository/static/synthetic/disposable-browser evidence |
| B | Owner material decision or waiver required |
| C | Real credentials, private library, or user-device evidence required |
| D | Production deployment, Service Worker, or rollback authority required |
| E | Destructive/public-history incident action or explicit no-rewrite disposition required |
| F | Final version, tag, artifact, or release-owner approval required |

## Investigation gate and provisional path ceiling

A2 is read-only. No release copy or test may change until this Task Brief records a findings-first
evidence/collision matrix and freezes a literal minimal allowlist. The only candidate paths are:

```text
docs/tasks/pr-47-final-v2-release-roadmap.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
tests/docs/release-docs.test.js
```

The final allowlist may remove candidate paths but may not add a fifth path without stopping for
owner approval. The first commit is restricted further to this Task Brief only.

## In scope

- Read-only exact-tree and GitHub evidence audit.
- A failure-first exact documentation test for the postmerge baseline, deterministic P0/P1 closure,
  the two-stage remaining roadmap, A-F classifications, and exact non-`PASS` external rows.
- Minimal factual updates to the current release-gate source and, only if the audit proves it is a
  direct collision, known limitations.
- Task-Brief evidence, decisions, verification, review, rollback, and Closure records.

## Out of scope and prohibited operations

- Product JavaScript, HTML, CSS, package/version, dependency, workflow, API, schema, Worker, Service
  Worker, deployment, data, migration, tag, artifact, or release changes.
- Any real Token/account/provider/private activity/private file/user browser profile.
- Production deployment, Service Worker rollout, cache or data mutation, history rewrite,
  force-push, ref deletion, merge, tag, GitHub Release, version bump, or cleanup.
- Editing historical PR #31 or PR #56, or re-documenting every historical milestone.
- Calling an environmental/owner gate `PASS` from Node, static inspection, synthetic fixtures, or a
  disposable browser alone.

## Acceptance criteria

The final package must:

1. bind the authoritative baseline to `f7f18392...`, `1913/1913`, and CI run/job
   `31569312683/94027710807`;
2. state that PR #57 Retry and PR #58 P1-DOCS are deterministically closed;
3. enumerate only genuinely remaining gates, split into shortest honest Alpha and complete
   `v2.0.0` paths;
4. give every remaining gate one A-F class, acceptance evidence, prohibited overclaim, blocking
   stage, minimum independent task, dependency order, precise owner decision where applicable, and
   privacy/data/rollback impact;
5. bind every external/environmental row directly to its exact non-`PASS` state;
6. keep stable long-term status in `docs/engineering/release-gates.md` and PR-specific evidence and
   decisions in this Task Brief; and
7. avoid modifying any path or behavior outside the frozen allowlist.

## Failure-first and required checks

The documentation test must fail against the exact base for the intended missing/stale roadmap
facts before release copy is edited. After repair, run:

```text
node --test tests/docs/release-docs.test.js
npm ci
npm run check:syntax
npm run check:privacy
npm test
npm audit --omit=dev
git diff --check
literal changed-path gate against the frozen allowlist
independent findings-first review
fresh independent no-findings re-review
remote depth-one exact-head verification
exact-head GitHub CI
```

No browser, real-data, deployment, history, version, artifact, tag, release, or owner check may be
reported as run unless that exact check actually occurred under separate authority.

## Privacy, data, migration, and rollback

The investigation and authorized documentation repair use only public repository metadata, static
source, deterministic synthetic tests, and disposable-browser records already present in the
repository. They do not read or mutate athlete data, credentials, Legacy IndexedDB, V2 storage,
Cache Storage, provider state, deployment state, or public history.

There is no schema or data migration. Rollback is a normal revert of this task's documentation/test
commits; it requires no data rewrite, cache deletion, deployment action, or history rewrite.

## Stop boundary

If the audit requires a performance threshold or waiver, browser-support matrix or waiver, public-
history disposition, real-data evidence protocol, deployment/rollback plan, version/release-stage
selection, or any other material release-scope choice, stop with one consolidated owner decision
package. Do not infer approval. Draft/Ready is review state only and is never merge authorization.

## Completion evidence

Pending A2 audit, frozen allowlist, failure-first repair, independent reviews, full verification,
remote exact-head evidence, and final Closure.
