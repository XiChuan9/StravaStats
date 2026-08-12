# PR-50: Exact Alpha Candidate Head Verification

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M37 / G12-RELEASE-HEAD-VERIFICATION |
| Status | Ready for investigation; A2 not yet recorded |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/release-head-verification` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/2ccf/StravaStats` |
| Exact base | `integration/v2@57c2cdf9358afef1330d5a71f3799f18d41f6d13` |
| Exact base tree | `80224e924d4270c03f1c9b526ae4bb6d20326aa9` |
| Owner / release owner | XiChuan9 |
| Draft PR title | `build(v2): verify exact Alpha candidate head` |
| Authority | G12 findings-first investigation and, only after a separate explicit owner decision, bounded exact-candidate verification; no tag, Release, publication, hosting, deployment, cleanup or production rehearsal |

## Goal

Determine and then execute the shortest honest G12 verification path for the limited local,
non-production `v2.0.0-alpha.1` candidate. Evidence must bind one immutable candidate commit, its
exact tree, manifest, ZIP and external evidence record. Tree equality must never be used to relabel
evidence from another commit.

This task begins only from the authorized post-PR-61 integration baseline above. It preserves the
accepted G1/G13 boundaries, Legacy and V2 data, opaque string IDs, missing/null/zero semantics, and
the separate owner authority required for any tag, GitHub Release, artifact delivery/publication,
hosting or deployment.

## Authority and required source review

Before mutation, read the complete product PRD, Accepted release gates, current release
documentation and PR-49 candidate-planning Task Brief. Accepted ADRs and the PRD remain higher
authority; the Accepted release gates are the live roadmap; historical Task Brief evidence cannot
promote an unrun gate.

The exact collision to investigate in A2 is whether the G13 builder's branch/head authorization can
honestly generate or verify candidate bytes for the squash-merged integration commit or any later
Task-Brief commit. PR-head, squash-head, integration-head and G12-head evidence remain distinct even
when two commits have the same tree.

## A0 exact-base record

Read-only and dependency-install verification before this Task Brief commit established:

```text
repository                XiChuan9/StravaStats
integration commit        57c2cdf9358afef1330d5a71f3799f18d41f6d13
integration tree          80224e924d4270c03f1c9b526ae4bb6d20326aa9
local/origin divergence   0/0
remote integration head   57c2cdf9358afef1330d5a71f3799f18d41f6d13
worktree                  clean; feature branch created from exact integration commit
remote feature branch     absent before first push
PR #61                    squash merged; merge commit has the exact integration tree
integration CI            run 31595421366 / job 94109625266 SUCCESS
npm ci                    PASS; 6 packages; expected engine warning under local Node/npm
syntax                    PASS; 285 files
privacy                   PASS
focused performance retry PASS; 1/1; p95 9.348 ms
full test serial rerun     PASS; 1,936/1,936
npm audit                 PASS; 0 vulnerabilities
git diff --check          PASS
```

The local A0 shell is Node `v25.8.1` with npm `11.11.0`, so it is not eligible to create candidate
bytes. The first parallel full-suite attempt recorded one performance-gate failure: 1,935/1,936,
with the 200k-stream p95 at 68.284 ms against 25 ms. The same focused gate passed in isolation and
the complete suite then passed serially. Both outcomes remain part of the A0 record; no threshold,
test or product code was changed.

The locked unique integration worktree remains verification-only at the same exact base. `main`,
`maintenance/v1` and `integration/v2` were not modified.

## A1 staged authority

The first feature-branch commit may create only this Task Brief. It must be pushed and used to open
an open Draft PR against `integration/v2` before A2 findings are written.

Until an explicit owner authorization after A2, the only writable repository path is:

```text
docs/tasks/pr-50-release-head-verification.md
```

A2 may append findings and one exact mutually exclusive owner-decision package to this file. It may
not change tooling, CI, release documentation or candidate bytes.

## A2 findings-first investigation plan

A2 is read-only except for recording its findings in this Task Brief. It must prove:

1. exact commit, tree, parent and branch facts for the PR-61 Closure head, squash commit,
   `integration/v2`, this Task-Brief head and any proposed immutable candidate head;
2. the builder/verifier branch-authority behavior for local branches, detached heads, GitHub Actions
   pull-request heads, integration CI and true remote depth-one checkouts;
3. whether any existing external candidate/evidence bytes exist, which exact commit/tree they name,
   and whether two fresh remote checkouts can reproduce them;
4. payload selection, exclusions, file modes, provenance schema, manifest grammar, ZIP profile,
   external evidence, hashes and two-build determinism;
5. CI trigger and exact-head semantics, including whether candidate build/verify actually ran or was
   skipped on every cited run;
6. the current P0/P1 inventory from the exact tree, open issues/PRs, tests, privacy/data/migration/
   rollback boundaries and release documentation; and
7. the minimum failure-first verification strategy, exact Node `v24.19.0` / npm `11.17.0`
   disposable environment, remote depth-one method, browser evidence boundary and independent
   review lifecycle.

If the existing contract cannot verify one immutable candidate object without a tool, CI,
documentation or path change, A2 must stop and send the control tower a precise mutually exclusive
owner-decision package. No implementation begins from an inferred preference.

## Post-A2 implementation gate

No implementation allowlist exists yet. A2 must freeze a literal cumulative path list and exact
candidate-object model, or recommend a read-only/docs-only completion. Any later changed path not in
the explicitly owner-approved list is a hard stop. Dependencies, schemas, public APIs, algorithms,
workflows and product behavior may not expand silently.

After explicit owner approval only, verification uses exact Node `v24.19.0` and npm `11.17.0` in
disposable temporary locations. Generated bundle, ZIP and evidence output remains external and
starts in an empty directory. No artifact is uploaded, published, delivered or deployed.

## Required verification lifecycle

The eventual approved path must include, on the frozen immutable candidate object:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
npm audit
git diff --check
literal changed-path gate
payload selection/exclusion/mode gate
manifest and ZIP recomputation/no-extra-file gates
two independent build and byte/hash comparison
two fresh true remote depth-one exact-commit checkouts
exact-head CI whose semantics actually exercise the required candidate gates
current zero-unresolved-P0/P1 inventory
independent findings-first review and fresh no-findings re-review
Task-Brief-only Final Review Closure
```

The limited Alpha browser record, if and only if the approved G12 path reaches it, uses synthetic
data and newly created disposable profiles only, omits `enable-sw=1`, serves only on loopback, and
requires zero `/api`, provider, Weather, AI, map-tile, telemetry or other non-loopback requests. It
never uses a real account, Token, private activity/file or user browser profile.

## Hard boundaries

- No tag, GitHub Release, artifact upload/delivery/publication, hosting, deploy, Service Worker or
  cache mutation, data mutation, branch/worktree cleanup, public Alpha claim or G10 rehearsal.
- No real credentials, provider account, private athlete data, identifiable screenshots, private
  fixtures or user browser profile.
- Do not clear, overwrite, migrate or delete Legacy/V2 data, Cache Storage or settings; Disconnect
  and Delete Local Data remain separate.
- Do not modify `main`, `maintenance/v1`, `integration/v2` or the unique integration worktree.
- Do not rebase, amend, force-push, rewrite history or relabel evidence from another commit.
- G12 remains `NOT RUN` until every approved exact-object gate is complete. G13 remains `PARTIAL`;
  Ready, CI, tree equality or an earlier candidate build is not release authorization.

## Rollback and privacy impact

This initial commit is documentation-only and has no runtime, storage, migration, cache, provider
or private-data effect. Its rollback is an ordinary revert of this single Task Brief. A later
approved G12 verification may remove only its own external disposable outputs/profiles and must
never invoke Disconnect, Delete Local Data or any Legacy/V2/cache clearing action.

## Completion boundary

Draft remains mandatory until Final Review Closure, exact-head CI and fresh independent no-findings
review pass. Ready may then be delegated under standing authority. Squash Merge, tag, Release,
publication, delivery, hosting and deployment remain separate owner-authorized actions.
