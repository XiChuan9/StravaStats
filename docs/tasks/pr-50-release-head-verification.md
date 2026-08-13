# PR-50: Exact Alpha Candidate Head Verification

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M37 / G12-RELEASE-HEAD-VERIFICATION |
| Status | Option A authorized; bounded pre-freeze implementation in progress; G12 remains `NOT RUN` |
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
storage-backup.html
js/app/storage-backup.js
js/pages/storage-backup/storage-backup.js
js/app/main.js
tests/consumers/summary-boundaries.test.js
tests/legacy/demo-isolation.test.js
README.md
js/demo/polylines.js
tests/default-canonical.test.js
```

Its frozen intent is limited to authenticating the G12 repository/base/branch/SHA context; making
the output boundary realpath/symlink-safe; requiring canonical evidence-file verification and
tamper negatives; independently auditing the ZIP profile; running the exact candidate gate in G12
CI; correcting stale source-baseline/assertion copy without pretending the feature or a future
squash commit is already the current postmerge baseline; making Try Demo seed deterministic Demo
state before a reload/re-entry establishes any Repository; replacing unverified route fixtures with
deliberately fabricated geometry; and keeping the real Demo and Sources actions available in a
verified-empty Canonical First-run before any summary Repository exists. It does not authorize any
other path, package/dependency, schema, public API, product/data algorithm or workflow expansion.

For option 2, no product/tool/CI implementation is authorized. Its exact repository allowlist is:

```text
docs/tasks/pr-50-release-head-verification.md
```

That one path may record A2, the owner disposition, exact external verification evidence and Final
Review Closure. It may not change the old candidate, release-gates status or other release prose.
Option 3 has the same one-path ceiling solely to close the investigation as not run; it authorizes
no candidate generation, selection or verification claim.

## A3 owner decision and source implementation authority

On 2026-08-13, the owner explicitly selected option 1 and then approved seven findings-first repair
expansions. This authorizes the bounded renewed G13 source/freeze phase, the exact seventeen-path
maximum above, and the exact-SHA PR/check-run/control-
tower ledger as the canonical post-freeze evidence record. It does not authorize a candidate build
before freeze commit `C`, and it does not mark G12 `PASS` or G13 complete.

The implementation decisions are frozen as follows:

- Candidate source authority moves only to `codex/v2/release-head-verification`. A local build must
  be on that symbolic branch at an explicitly supplied candidate SHA equal to the exact same commit
  as its `origin` tracking ref from the exact XiChuan9/StravaStats repository. A detached Actions
  build must prove open Draft PR #62, exact base SHA `57c2cdf...`, the exact base/head repositories
  and refs, and checkout `HEAD` equal to the event's PR-head SHA and authorized SHA;
  `GITHUB_SHA` is the synthetic merge identity and is never relabeled as `C`. A branch-name alias or
  a partial/spoofed environment tuple remains a failure. Local checks establish build eligibility;
  only post-freeze GitHub remote-head/check-run readback supplies remote authority.
- Output validation canonicalizes the checkout and output through filesystem real paths before any
  staging path is created. A symlinked ancestor that resolves inside the checkout fails closed;
  the caller-supplied destination must remain an absolute, existing, empty external directory.
- Strict verification requires the canonical bundle-root, ZIP and sibling evidence filenames. It
  parses the evidence as the exact ordered seven-key JSON record, recomputes the manifest and ZIP
  digests, and rejects missing, renamed, malformed, reordered, extra-key or tampered evidence.
- ZIP verification uses an independent stored-ZIP32 parser rather than treating reconstruction by
  the writer as its only oracle. It freezes local header, central directory and EOCD fields;
  filenames/order; regular-file modes; offsets; CRC and sizes; data bytes; entry counts; and the
  absence of directories, data descriptors, encryption, compression, extras, comments, trailing
  bytes and unmanifested entries.
- G12 candidate CI uses a dedicated job only for the exact same-repository G12 pull request into
  `integration/v2`. An unconditional first assertion in that job fails on tuple drift, and the
  candidate step itself is unconditional so a skipped step cannot yield candidate success. It must
  retain the depth-one/exact-head/toolchain assertions, run strict verification for two external
  temporary builds and compare extracted roots, ZIP bytes and evidence bytes. Nothing is uploaded
  or retained as an Actions artifact.
- Exact-toolchain enforcement is unconditional for every build entry, including the exported API;
  no caller option may mint bytes under another runtime while provenance claims Node `v24.19.0` and
  npm `11.17.0`. Output containment derives the canonical Git top-level, worktree Git directory and
  common Git directory from Git itself, so a subdirectory `cwd` cannot redefine the Repository and
  no output can land inside tracked worktree or Git metadata boundaries.
- Release prose and its contract tests name `57c2cdf...` / `80224e92...` as the exact pre-G12
  integration source baseline, keep `03ccf18...` as distinct historical G13 candidate evidence,
  and keep tracked G12 `NOT RUN`. They must not predict commit `C`, a future squash identity, or a
  post-freeze PASS.
- The ninth path changes only the candidate payload's false static V4 backup copy: its loading
  placeholder is neutral and its durable export description says V6, matching format 3 / physical
  IndexedDB V6. An already-authorized documentation test rejects a regression to V4 copy.
- The tenth path changes only Demo's display-state database version from a stale literal `4` to the
  already imported `V2_DATABASE_VERSION`. Demo backup and restore remain unavailable and its
  activity count remains zero. An already-authorized documentation test freezes those boundaries.
- The eleventh path changes only the post-restore display: after either successful restore result,
  Physical database becomes `V6` while the existing status, detail and activity-count updates stay
  intact. An already-authorized documentation test freezes that immediate UI transition.
- Paths twelve through fourteen change only Try Demo entry and its two existing durable assertions.
  The click first revokes the Real AI capability, `loginWithDemo` atomically seeds deterministic
  Demo state, and its callback reloads the document so the new entry selects Demo before any
  Repository is created. In-place Real-to-Demo Repository switching remains prohibited. An
  already-authorized documentation test also freezes the seed-then-reload boundary.
- The fifteenth path changes only the root README candidate-build command contract. It requires an
  exact candidate SHA supplied from the external approval record before build; the value is never
  inferred from local `HEAD`, and the existing fail-closed local HEAD/origin equality remains.
- The sixteenth path replaces every shipped Demo route byte with deterministic, deliberately
  fabricated geometry. Its durable provenance states that no person-derived or real GPS track was
  used, and it removes the prior real-world and named-city claims without changing the exported
  shape, activity schema, network behavior or storage behavior. An already-authorized test freezes
  that provenance and rejects the old route claims and bytes.
- The seventeenth path updates only the conflicting default-Canonical startup assertions for the
  already-authorized `js/app/main.js` repair. Real Canonical entry uses the existing local-first
  inspection: existing Canonical data opens the Dashboard; an unsafe inspection remains blocked;
  and verified-empty Canonical shows the actionable root First-run with its actual Demo button and
  one idempotent visible Sources/import link, without constructing a summary Repository or
  auto-redirecting. Legacy and Shadow behavior remain unchanged. Focused assertions stay within
  the seventeenth path and the already-authorized consumer, Demo-isolation and documentation tests.

Failure-first focused tests cover unauthorized repository/base/head/SHA combinations, a local
branch that is not equal to its trusted remote ref, an output ancestor symlink into the checkout,
evidence absence/schema/order/digest/name tampering, and independent ZIP field/entry/negative-space
mutations before the broader gates run.

After implementation and source review, the implementation commit is created locally but is not
itself a candidate. A later Task-Brief-only commit `C` records source-review Closure and freezes the
sole proposed candidate identity while tracked G12 remains `NOT RUN`. Both local commits are pushed
together so the Draft PR's candidate step first runs at exact `C`. From that push onward, a failure
withdraws `C` and returns to the owner; it is never repaired or relabeled in place.

## Post-A2 implementation gate

Option 1 and its exact seventeen-path maximum are now owner-authorized. Any changed eighteenth path or
material expansion is a hard stop. Dependencies, schemas, public APIs, product/data algorithms and
product behavior remain frozen except for the exact bounded backup-display, synthetic Demo-route
and actionable First-run/Try Demo repairs above; workflow changes are limited to the exact
candidate-CI semantics above.

After explicit owner approval only, verification uses exact Node `v24.19.0` and npm `11.17.0` in
disposable temporary locations. Generated bundle, ZIP and evidence output remains external and
starts in an empty directory. No artifact is uploaded, published, delivered or deployed.

## Required verification lifecycle

Before candidate freeze, the approved path requires all focused and full local gates plus an
independent findings-first source review, repair of every in-scope finding and a fresh no-findings
source re-review. No candidate build is permitted in that phase. Task-Brief-only source-review
Closure commit `C` then freezes the sole candidate identity while tracked G12 stays `NOT RUN`.

On frozen immutable candidate `C`, the required lifecycle is:

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
final current-state readback: origin branch and PR #62 head equal C; exact repo/head/base/open-Draft tuple
both checks and exact-alpha-candidate jobs SUCCESS; auth/checkout/build/two-verifies/compares not skipped
record the workflow run ID, check/job/step conclusions and synthetic GITHUB_SHA separately from C
exact-SHA PR/check-run/control-tower ledger-only Final Verification Closure; no repository commit
```

The post-`C` Closure is external and exact-SHA-bound. It never edits the Task Brief or any other
tracked file. Its final readback must be current at Closure time: `origin/codex/v2/release-head-verification`
and the current PR head both equal `C`; PR #62 remains open Draft in `XiChuan9/StravaStats`, with the
exact head/base repositories and refs and base SHA above; both `checks` and `exact-alpha-candidate`
jobs conclude `SUCCESS`; and event authentication, exact checkout, two builds, two strict verifies
and all root/ZIP/evidence comparisons conclude successfully rather than skip. The ledger records the
run, jobs and step conclusions, and records Actions' synthetic `GITHUB_SHA` separately without ever
calling it `C`. A post-`C` failure or tuple/readback drift withdraws `C` and requires a new owner
decision.

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

The authorized seventeen-path phase changes candidate authority/verification tooling, exact
candidate CI, release documentation/tests, bounded backup display copy/state, deliberately
fabricated Demo geometry and the actionable First-run/Try Demo seed-then-reload boundary. It does
not change dependencies, schemas, storage format, migration, provider, Service Worker/cache or
data algorithms and does not read private data. Demo entry writes only its existing deterministic
Demo namespace before reloading. Before `C`, rollback is an ordinary revert of the bounded branch
commits. After `C`, any failure withdraws that immutable candidate and stops; it is never repaired
in place. Neither path invokes Disconnect, Delete Local Data or any Legacy/V2/cache clearing action.

## Completion boundary

Draft remains mandatory until the external exact-SHA Final Verification Closure, exact-head CI and
fresh independent no-findings review pass. Ready may then be delegated under standing authority.
Squash Merge, tag, Release, publication, delivery, hosting and deployment remain separate
owner-authorized actions.
