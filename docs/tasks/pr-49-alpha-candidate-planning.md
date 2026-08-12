# PR-49: Limited Alpha Candidate Planning

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M36 / G13-ALPHA-CANDIDATE-PLANNING |
| Status | A1 Task-Brief-only publication; A2 findings-first audit pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/alpha-candidate-planning` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/d939/StravaStats` |
| Exact base | `integration/v2@de9b47f3551d08102364f0b0794f487935d167a9` |
| Exact base tree | `4a273bfffe5248ecdb4af7dbe6707c318398c6ac` |
| Owner / release owner | XiChuan9 |
| Authority | A0/A1/A2 planning and audit only; A3 implementation requires later explicit owner authorization |

## Goal

Prepare an exact, bounded candidate-building authorization package for the owner-approved limited
local, non-production `v2.0.0-alpha.1` static Web bundle. This task may verify the baseline, publish
this Task Brief, audit the merged G1 contract and current repository, and freeze one recommended A3
decision package. It does not authorize any candidate implementation or release action.

The authoritative contract is the accepted G1 section of
`docs/engineering/release-gates.md` together with `docs/tasks/pr-48-alpha-contract.md`. The G13
candidate-building phase must precede G12 exact-candidate verification. Tagging, GitHub Release,
artifact delivery/publication, hosting and deployment remain separate later owner approvals.

## Owner-approved stable direction

- Target name: `v2.0.0-alpha.1`.
- Distribution: one owner-provided local static Web bundle only; non-production; no public hosting or
  deployment.
- Support/evidence: current stable macOS Chrome at candidate freeze; synthetic-only; disposable
  browser profile; no real Token, account, provider, private activity/file or user browser profile.
- Payload: exact static source-copy selection/exclusions, acyclic `PROVENANCE.json` plus
  `SHA256SUMS`, exact commit/tree provenance and two-checkout reproducibility.
- Status honesty: real Legacy rescue and real parity/Shadow evidence remain deferred to RC and
  non-`PASS`.
- Safety: preserve Legacy rollback, old data, opaque string IDs, and missing/null/zero semantics.

## A0 exact baseline

Read-only verification before branch creation established:

```text
repository                XiChuan9/StravaStats
integration commit        de9b47f3551d08102364f0b0794f487935d167a9
integration tree          4a273bfffe5248ecdb4af7dbe6707c318398c6ac
integration divergence    local/origin 0/0
worktree                  clean; detached at the exact integration commit
feature branch            absent locally and in the connected GitHub App before creation
PR #60                    closed; squash merged at the exact integration commit
integration CI            run 31583509127 / job 94071851170 SUCCESS
npm ci                    PASS; 6 packages
syntax                    PASS; 283 files
privacy                   PASS
full test                 PASS; 1,924/1,924
npm audit                 PASS; 0 vulnerabilities
git diff --check          PASS
```

The locked unique verification worktree at
`/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` names `integration/v2` at the same exact
commit. `main` and `maintenance/v1` are outside this task and remain unchanged.

## A1 staged authority

The first feature-branch commit creates only this Task Brief. It must be pushed and used to open an
open Draft PR against `integration/v2` before A2 findings are recorded.

Until the owner explicitly authorizes A3, the only writable repository path is:

```text
docs/tasks/pr-49-alpha-candidate-planning.md
```

A2 may update this Task Brief with read-only findings and the exact recommended authorization
package. No other repository path may be edited. A third path, an implementation change, or a
generated candidate requires a new explicit owner decision.

## A2 findings-first audit plan

A2 will inspect without mutation:

1. the merged G1 contract and its contract tests;
2. all version-bearing package/runtime/release metadata and their semantics;
3. the tracked static runtime dependency graph and exact G1 payload selection;
4. package/lock/hash/privacy guards, build scripts and CI/workflows;
5. Service Worker registration, cache naming/lifecycle and data/Legacy boundaries;
6. artifact exclusions, ignore rules and existing release documentation/tests; and
7. the minimum failure-first tests, exact-head CI, remote depth-one reproducibility and G12 handoff
   required by a later A3 task.

A2 must freeze one literal cumulative implementation allowlist and one complete decision package,
including version semantics, deterministic tooling, temporary output handling, payload inventory,
metadata schemas, hashing/container rules, browser evidence, rollback and withdrawal. Findings are
reported by severity before the recommendation. A2 stops before any implementation.

## Hard boundaries

- No version bump, package/lock edit, build-script implementation, candidate generation,
  `PROVENANCE.json`, `SHA256SUMS`, archive or other artifact in this task.
- No tag, GitHub Release, publication, hosting, deployment or public Alpha claim.
- No workflow, product runtime, Service Worker lifecycle, cache, settings, IndexedDB, Legacy or V2
  data action.
- No real Token, account, provider, private activity/file, identifiable athlete data or user browser
  profile.
- No mutation of `main`, `maintenance/v1` or `integration/v2`; no merge, cleanup, rebase, amend,
  force-push or history rewrite.
- No weakening of payload exclusions, synthetic-only evidence, Legacy rollback, old-data
  preservation, opaque string IDs or missing/null/zero semantics.

## Completion and handoff

Completion of this planning task means:

1. this Task-Brief-only first commit remains identifiable in Draft PR history;
2. the Draft PR remains open against `integration/v2`;
3. A2 findings and one recommended exact A3 authorization package are recorded here and reported to
   the control tower;
4. all repository changes remain limited to this Task Brief; and
5. work stops before any candidate implementation or release/publication action.

The later owner decision may authorize, reject or revise A3. Even an authorized candidate build does
not authorize G12 to pass, a tag, GitHub Release, delivery, hosting or deployment.
