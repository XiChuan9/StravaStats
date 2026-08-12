# PR-50: Exact Alpha Candidate Head Verification

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M37 / G12-RELEASE-HEAD-VERIFICATION |
| Status | A2 hard stop; implementation awaits an explicit owner choice |
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
integration push CI       run 31595417799 / job 94109614445 SUCCESS
integration PR CI         run 31595421366 / job 94109625266 SUCCESS
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

Both exact-integration CI runs skipped the candidate-build step. Run `31595417799` is the actual
`push` event; run `31595421366` is the `pull_request` event for the long-lived integration-to-main
PR #4. The locked unique integration worktree remains verification-only at the same exact base. `main`,
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

The Task-Brief-only first commit is
`ddb74f5eee6d505e6e978bd1a421fea3e06f6cc5` (tree
`a4986fff44e45cd2a1c8fab54b9aed7023bf2361`). It was pushed without changing the base branches and
opened Draft PR #62, `build(v2): verify exact Alpha candidate head`, against `integration/v2`.
PR-head CI run `31596407554` / job `94112891771` passed the ordinary repository gates but skipped
the candidate-build step because the workflow authorizes only the earlier G13 branch.

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

## A2 findings and hard stop

A2 completed the required read-only inspection and reached the material decision gate. It did not
create candidate bytes or change tooling, CI, product code, data, dependencies or release state.
No P0 was found. The following exact-object facts are frozen:

| Object | Commit | Parent | Tree | Commit time | Native candidate build |
| --- | --- | --- | --- | --- | --- |
| PR-61 Final Review Closure | `03ccf18c10c6bc146660920b81f409a7d9ca6a0e` | `99270bd323b0e108a4fc854f29f979ceae4ece82` | `80224e924d4270c03f1c9b526ae4bb6d20326aa9` | `1786533974` | Yes, only through the old G13 branch/PR context |
| PR-61 squash / exact integration base | `57c2cdf9358afef1330d5a71f3799f18d41f6d13` | `de9b47f3551d08102364f0b0794f487935d167a9` | `80224e924d4270c03f1c9b526ae4bb6d20326aa9` | `1786536798` | No under its honest integration ref/CI context |
| G12 Task-Brief-only first head | `ddb74f5eee6d505e6e978bd1a421fea3e06f6cc5` | `57c2cdf9358afef1330d5a71f3799f18d41f6d13` | `a4986fff44e45cd2a1c8fab54b9aed7023bf2361` | `1786537513` | No under its honest G12 ref/CI context |

The Closure and squash commits have the same tree but different parents, commit identities and
timestamps. Candidate provenance contains the exact commit, full tree and commit time; provenance
is itself manifested and zipped. Consequently their candidate bytes cannot be equal and evidence
for one cannot be relabeled as evidence for the other. The G12 Task Brief creates a third tree and
identity even though documentation is excluded from the selected static payload.

Existing external G13 evidence was located and inspected without regeneration. Four candidate
outputs, including two outputs associated with clean true remote depth-one checkouts, have equal
ZIP, manifest and evidence bytes; complete extracted-root comparison is empty; and their
PROVENANCE files are equal and bind only the PR-61 Closure commit:

```text
candidate commit   03ccf18c10c6bc146660920b81f409a7d9ca6a0e
candidate tree     80224e924d4270c03f1c9b526ae4bb6d20326aa9
Node / npm         v24.19.0 / 11.17.0
ZIP sha256         947ddcbbc72b95c5fc192058673fc844699cc6fd64e3b05f89adfd2382d4b48c
manifest sha256    7f2fdd67893be83b9a19d0cc0dadcb7c5dd012d98de36730b8c81cf12fed0029
evidence sha256    b1300293b511e110a69f6c7e53bfccac21a728bcb449e1c6861493feb86ab1a8
manifest rows      210
bundle files       211
selected blobs     209 regular 100644 blobs; no selected symlink
```

The sibling evidence JSON was independently parsed as the exact ordered seven-key record. Its
commit, tree and canonical filenames match the provenance/bundle, and its manifest and ZIP digests
were independently recomputed from the named files and equal the values above. That external check
is necessary because the repository verifier does not currently authenticate the evidence file.

Two existing remote checkouts are clean, shallow, single-commit clones of the repository's HTTPS
G13 branch at `03ccf18...`. They establish feasibility only for that exact old PR head. A branch
rename or locally spoofed GitHub Actions variables can mechanically bypass the current label-based
guard, but neither is honest candidate authority and neither can substitute for exact-head CI.

CI evidence is also commit- and semantics-specific. PR-61 head run `31592349203` / job
`94099945541` ran the exact-toolchain double build, verify and comparison at `03ccf18...`.
Integration push run `31595417799` / job `94109614445`, integration-to-main PR run `31595421366`
/ job `94109625266`, and G12 run `31596407554` / job `94112891771` passed but skipped that step.
Green status on those runs is not candidate evidence. The repository's ordinary release test
deliberately asserts build refusal and returns on unauthorized integration/G12 contexts.

### Current findings inventory

- **P1 — candidate identity and CI authority:** the builder hard-codes
  `codex/v2/alpha-candidate-planning`, and CI runs it only for a pull request from that branch.
  Neither the integration squash nor any G12 head can natively build, and current G12 CI does not
  exercise the candidate gate.
- **P1 — external-output containment:** the outside-repository check is lexical. An absolute output
  path whose ancestor is a symlink into the checkout passes the check while staging and renaming
  inside the repository. The known outputs used real external directories, but the frozen safety
  contract itself is incomplete.
- **P1 — evidence trust boundary:** `verify:alpha-candidate` verifies the bundle root and ZIP but
  never reads the sibling evidence JSON. A renamed, malformed or tampered evidence record therefore
  does not fail verification, and the canonical seven-key evidence schema is not covered by a
  negative test.
- **P1 — release-document baseline drift:** Accepted release gates still name
  `4375d699...` / `b076c4f8...` as the current baseline, while `docs/README.md` and
  `CHANGELOG.md` name `eb0b6695...` beside the later Alpha candidate state. Documentation tests pin
  those obsolete values, so green tests preserve rather than detect the drift from
  `57c2cdf...` / `80224e92...`.
- **P2 — independent container coverage:** the verifier regenerates ZIP bytes with the same writer
  that created them. Current tests do not independently freeze every central-directory field,
  CRC/size/offset, entry order/count and absence of extras/comments.
- **P2 — negative selector/atomicity coverage:** implementation inspection found the 209 selected
  paths, modes and exclusions consistent with the frozen rule, but tests do not exhaustively cover
  missing required paths, unsafe/duplicate paths, all excluded prefixes/extensions, symlinked
  output ancestors or staged-failure cleanup.

No additional deterministic product, privacy, migration, rollback or data-path P0/P1 was found.
The branch changes only this Task Brief, so it does not touch runtime behavior, IndexedDB, provider
state, Service Worker/cache state or private data. The initial parallel performance outlier is
retained as a one-off environment-sensitive failure; the focused and serial reruns passed, but that
alone neither proves a root cause nor silently dismisses or promotes a product defect. On
2026-08-12, exact query `repo:XiChuan9/StravaStats is:issue is:open` returned zero issues; this does
not prove the absence of defects recorded outside open issues. Open-PR metadata was inventory only
and does not supersede release-gate authority.

### Owner decision package sent to control tower

Implementation is stopped until the owner chooses exactly one of these mutually exclusive models:

1. **Renew G13 and select a new postmerge candidate:** explicitly authorize a bounded renewed G13
   build/freeze phase on the G12 lineage. After all source implementation and fresh source-review
   gates pass, a Task-Brief-only commit `C` freezes the proposed immutable candidate while G12
   remains `NOT RUN` in `C`. The `03ccf18...` object remains historical evidence and is never
   relabeled. A separately explicit G13 build authority then creates candidate bytes from `C`, and
   G12 runs every exact-object, true depth-one, actual exact-head candidate-CI, independent
   evidence, zero-P0/P1 and disposable-browser gate. An owner-authorized exact-SHA
   PR/check-run/control-tower ledger records `PASS verified` because `C` cannot self-record future
   evidence. Any failure withdraws `C` and requires a separately authorized new candidate commit
   and full rerun. No later candidate-branch commit is made while a successfully verified `C`
   remains selected; a later squash commit is a distinct noncandidate identity.
2. **Freeze the existing G13 object (shortest contract-aligned path):** `03ccf18...` and the hashes
   above remain the sole candidate. Repository code and CI stay unchanged, but G12 is not a reused
   or read-only pass: it must independently reproduce the object twice with the exact toolchain in
   two new true remote depth-one checkouts, independently verify evidence/ZIP, run the disposable
   browser matrix and complete the review lifecycle. Earlier G13 outputs prove feasibility only.
   G12 cannot reach zero unresolved P1 until each tooling finding has either a concrete repair or a
   separately approved, recorded disposition plus an independently verified operational control.
   Integration and G12 heads and their green CI remain noncandidate evidence.
3. **Decline both candidate models:** record the collision only and retain G12 `NOT RUN` and G13
   `PARTIAL`; do not create or select a new candidate object.

For option 1, the proposed literal cumulative post-A2 allowlist is:

```text
.github/workflows/ci.yml
CHANGELOG.md
docs/README.md
docs/engineering/release-gates.md
docs/tasks/pr-50-release-head-verification.md
scripts/alpha-candidate.mjs
tests/docs/release-docs.test.js
tests/release/alpha-candidate.test.js
```

Its frozen intent is limited to authenticating the G12 repository/base/branch/SHA context; making
the output boundary realpath/symlink-safe; requiring canonical evidence-file verification and
tamper negatives; independently auditing the ZIP profile; running the exact candidate gate in G12
CI; and correcting stale source-baseline/assertion copy without pretending the feature or a future
squash commit is already the current postmerge baseline. It does not authorize any other path,
package/dependency, schema, public API, product/data algorithm or workflow expansion.

For option 2, no product/tool/CI implementation is authorized. Its exact repository allowlist is:

```text
docs/tasks/pr-50-release-head-verification.md
```

That one path may record A2, the owner disposition, exact external verification evidence and Final
Review Closure. It may not change the old candidate, release-gates status or other release prose.
Option 3 has the same one-path ceiling solely to close the investigation as not run; it authorizes
no candidate generation, selection or verification claim.

## Post-A2 implementation gate

No implementation allowlist is owner-authorized yet. The exact proposed lists and candidate models
above have no effect until one is explicitly selected. Any later changed path not in the selected
owner-approved list is a hard stop. Dependencies, schemas, public APIs, algorithms, workflows and
product behavior may not expand silently.

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
