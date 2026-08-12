# PR-47: Final V2 Release Roadmap

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M34 / FINAL-ROADMAP |
| Status | Approved for implementation |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/final-roadmap` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/345f/StravaStats` |
| Exact base | `integration/v2@f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628` |
| Exact base tree | `58b8339361991c5c34258be579733ccda3cbe066` |
| Owner | XiChuan9 |
| Authority | Findings-first release-documentation reconciliation and exact documentation tests only |
| Pull request | [Draft PR #59](https://github.com/XiChuan9/StravaStats/pull/59) |

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

## Investigation gate and approved path ceiling

A2 is read-only. No release copy or test may change until this Task Brief records a findings-first
evidence/collision matrix and freezes a literal minimal allowlist. The only candidate paths are:

```text
docs/tasks/pr-47-final-v2-release-roadmap.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
tests/docs/release-docs.test.js
```

The investigation was authorized to narrow this candidate list or stop for a fifth path. The owner
has now approved the exact cumulative five-path allowlist recorded below. The first commit remained
restricted to this Task Brief only.

## A2 findings-first completion audit

The audit was read-only outside this Task Brief. It inspected the exact integration tree, PRD,
development plan, release gates, known limitations, accepted ADRs, PR-24's additive ledger, merged
Task Brief closures, exact source/test boundaries, tags/Releases, protected historical PR state,
and the current GitHub integration CI. It used no real Token, provider, private file/library,
athlete data, user browser profile, Cache Storage, deployment, or history mutation.

### Exact postmerge findings

1. PR #57 Retry is deterministically closed. It merged as `eb0b6695...`; its exact retained-byte,
   single-use, lock/lease-bounded behavior remains covered in the 1,913-test tree.
2. PR #58 P1-DOCS is deterministically closed. It squash-merged as the exact current integration
   head `f7f18392...`; integration CI run `31569312683`, job `94027710807`, passed at that SHA.
3. No unresolved deterministic P0 or P1 code/documentation defect was found on the exact tree. The
   non-`PASS` rows below are missing owner/environment/release evidence, not defects that can be
   converted to `PASS` by weakening copy or re-running Node tests.
4. PR #31 and PR #56 remain OPEN/Draft historical audits and were not changed. `main` and
   `maintenance/v1` remain at `fe34535...`; `integration/v2` remains at `f7f18392...` and 0/0 with
   origin. The baseline tag exists; no V2 tag or GitHub Release exists; package metadata is `1.0.0`.
5. The exact-tree deterministic architecture/import/consumer/privacy/Service Worker code evidence
   is complete at its bounded rows. It does not supply real-library, cross-platform, native
   production worker, deployment, history, version, artifact, or release-owner evidence.

### Deterministic rows closed on `f7f18392...`

| Family | Result | Exact boundary |
| --- | --- | --- |
| Baseline, ADRs and rollback seams | PASS deterministic | Baseline tag and V1 branch exist; ADR-0001 through ADR-0006 are Accepted; explicit `legacy`/`shadow`/`canonical` modes remain tested |
| Repository, V6 storage and migration | PASS deterministic | Repository convergence, physical V1/V2 isolation, additive/idempotent V1-V6 migration, transaction rollback and Canonical default/fallback suites pass |
| Shadow, parity export and consumers | PASS deterministic capability | Synthetic redacted Shadow/parity export plus summary/detail/Run Plus/NSM degradation regressions pass; no real-library sign-off is implied |
| Import and identity | PASS deterministic | JSON, CSV, ZIP, FIT, TCX, GPX, provider-artifact, exact duplicate, fuzzy-review safety, batch isolation, cancellation and explicit Retry suites pass |
| Source Manager | PASS deterministic | Connect/Reconnect, callback scrub, Disconnect lifecycle, bounded `Sync latest 25`, shared lock/lease, Recover/Abandon and Retry pass; real OAuth/provider evidence is NOT RUN |
| Backup and Legacy rescue | PASS deterministic capability | V6 format 3 plus additive formats 1/2, exact-empty restore and non-destructive Legacy rescue pass; real private-library drills are NOT RUN |
| Privacy hardening R3-R11 | PASS deterministic current tree | Current tracked identity removal, logging, consented weather/map/AI boundaries, static-only cache admission, accepted empty-shell residual, disabled telemetry and same-origin pinned assets pass |
| Service Worker D3 | PASS deterministic code lifecycle | Waiting/drained-client and owned-cache policies pass with injected synthetic boundaries; native production-like lifecycle is NOT RUN |
| Performance rows with budgets | PASS only where frozen | 5,000 activities, Activities first render and 200,000 points pass their disclosed deterministic/Chromium budgets; 10,000 activities and 1,000 FIT remain record-only |
| P0/P1 reconciliation | PASS deterministic current tree | PR #57 P0 Retry and PR #58 P1-DOCS are merged and exact integration CI is green; environmental gates remain non-`PASS` |

### Authority and copy collision matrix

| Surface | Current collision | Required disposition |
| --- | --- | --- |
| `docs/engineering/release-gates.md` | Names `eb0b6695...`, 1,912 tests and PR-24 as the exact current source; it has no dependency-ordered Alpha/full-V2 roadmap | Make this the durable single authoritative roadmap at `f7f18392...`, 1,913/1,913 and exact integration CI; preserve every external row as non-`PASS` |
| `docs/guides/known-limitations.md` | Calls PR-24 authoritative and says P1-DOCS is still open | Point authority to release gates; mark Retry/P1-DOCS closed and retain only genuine limitations |
| `docs/README.md` | Labels PR-24's now-point-in-time supplement as the “Current evidence ledger” | Minimal pointer-only correction to the authoritative release gates/new Task Brief is required for a single-roadmap claim |
| `docs/tasks/pr-24-release-documentation.md` | Correct historical/current-at-`eb0b6695...` snapshot, but no longer the live baseline | Preserve unchanged as additive historical evidence; do not rewrite its SHAs, counts or then-current statuses |
| `README.md` and `CHANGELOG.md` | Correctly describe an integrated code candidate and the post-Retry implementation baseline without claiming release | Leave unchanged; they are not the item-level roadmap and need no repetition of M34 details |
| `tests/docs/release-docs.test.js` | Passes 13/13 while requiring `eb0b6695...` and PR-24 as “current”; it cannot detect reopened P0/P1 or promoted external rows after #58 | Failure-first bind the new authority, exact baseline/count/CI, deterministic closures, two paths and exact non-`PASS` gate rows |

### Minimal allowlist finding

The investigation proved that the initial four-path ceiling is one path too narrow: leaving
`docs/README.md` unchanged would retain a competing “Current evidence ledger” pointer. The minimal
implementation package is therefore exactly these five paths:

```text
docs/tasks/pr-47-final-v2-release-roadmap.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
docs/README.md
tests/docs/release-docs.test.js
```

The owner approved this exact cumulative five-path scope. No sixth path is authorized. No
implementation or failure-first test edit had begun when the approval was recorded.

## Pre-approval remaining-gate inventory from the audit

The table below is the proposed unique inventory. A gate remains non-`PASS` until its exact evidence
exists. Stage means the earliest release stage it blocks under the current gate wording; decisions
below may make Alpha stricter but may not silently weaken RC/production.

| ID | Class | Remaining gate and exact acceptance evidence | Prohibited overclaim | Blocks | Minimum next independent task and dependencies | Precise decision needed | Privacy, data and rollback impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | B + F | Freeze Alpha distribution, support, version and artifact contract; owner-signed scope names `v2.0.0-alpha.1`, audience, delivery channel and non-production rollback | A merged PR, green CI or docs label is not an Alpha artifact or production approval | Alpha | `ALPHA-CONTRACT`; first, before G2/G3/G10 | Local/limited artifact or public web deployment; supported Alpha browser(s); release owner and artifact type | No data mutation in decision task; artifact withdrawal/revert must not clear Legacy/V2/cache data |
| G2 | C | Authorized real Legacy cache export, validation and restore into a fresh disposable profile with redacted counts/hashes and original library unchanged | Synthetic rescue tests are not real Legacy recovery; no private bytes/screenshots enter Git | Alpha under current `PARTIAL` ledger, otherwise no later than RC | `REAL-LEGACY-RESCUE`; after G1 and G4 | Whether real rescue is mandatory for Alpha or explicitly deferred to RC while Alpha is labelled synthetic-only | Reads private local data under separate consent; restore only to fresh/empty target; rollback discards disposable target, never source |
| G3 | B + C | Export and explain a redacted real-library Shadow/parity report; owner records tolerances and zero unresolved P0 discrepancy | Synthetic parity is not representative real parity; count equality alone is not semantic parity | Alpha if owner retains the current `PARTIAL` interpretation; otherwise RC and production | `REAL-PARITY-SHADOW`; after G4, before final defect inventory | Whether Alpha needs a real parity review; exact tolerances and sign-off owner | Read-only private comparison; publish aggregates only; rollback is evidence withdrawal, not data rewriting |
| G4 | B | Approve one private-evidence protocol covering data minimization, authorized operator/device, retention, redaction and public summary format | Approval to test is not approval to commit raw activities, GPS, health data, Tokens or browser profiles | Before any C task; therefore Alpha if G2/G3 are Alpha gates | `PRIVATE-EVIDENCE-PROTOCOL`; first policy dependency | Approve protocol and evidence custodian, or decline real-data evidence and accept that dependent stages stay blocked | No data access in protocol task; raw evidence remains outside Git and is recoverably destroyed only under separate owner policy |
| G5 | C | Real OAuth Connect/Reconnect, one bounded `Sync latest 25`, rate/auth degradation, and Disconnect proving both Legacy and V2 libraries/counts remain intact | Deterministic auth/provider doubles are not real account evidence; Disconnect is not Delete Local Data | RC and production | `REAL-PROVIDER-DISCONNECT`; after G4, independent of G6/G7 | Authorized test account/operator and whether provider sync is required in Beta or first required at RC | Uses real credentials/provider data outside Git; read/import is additive; rollback revokes Token/connection only and preserves local data |
| G6 | C | Representative real FIT/TCX/GPX/CSV/ZIP imports plus format-3 Backup and fresh-environment restore, with redacted manifest/count/hash reconciliation | Synthetic formats do not prove a private library; successful restore must not imply merge restore or unsupported vendor coverage | RC and production | `REAL-IMPORT-BACKUP`; after G4, can run parallel with G5/G7 | Representative source mix/device criteria and authorized operator | Private files stay off Git; import/restore use disposable isolated V2 target; rollback discards target, preserves originals and Legacy |
| G7 | B + C | Execute the approved real-library parity/Shadow matrix and record owner disposition for every discrepancy | No “parity PASS” with missing tolerances, unreviewed warnings or unresolved P0 discrepancy | RC and production | `REAL-PARITY-SIGNOFF`; after G3 protocol/tolerances and G5/G6 evidence | Final tolerances and who may accept non-P0 differences | Read-only/redacted analysis; no automatic merge/delete; rollback removes only derived evidence |
| G8 | B | Approve absolute 10,000-activity and 1,000-FIT budgets in a frozen representative environment, or a time-bounded waiver with owner, impact, mitigation and expiry | Record-only timings, a fast developer machine or the passing 5k/200k rows do not close this gate | RC and production | `PERFORMANCE-BUDGET`; decision before `PERFORMANCE-EVIDENCE` | Exact thresholds, or exact waiver owner/expiry/follow-up | Synthetic data only; no migration; rollback reverts test/policy changes, not user data |
| G9 | B + C | Freeze and execute the supported browser/platform/accessibility matrix, or record a time-bounded edge-support waiver; retain actual version/device evidence | Disposable Chromium is not Safari/Firefox/Windows/iOS/PWA/mobile or assistive-technology coverage | RC and production; Alpha support is set by G1 | `BROWSER-SUPPORT-DECISION`, then one or more `BROWSER-MATRIX` tasks; after G1 | Full PRD matrix versus explicit exclusions/waiver, versions, devices, owner and expiry | Prefer synthetic/disposable profiles; any private smoke requires G4; no user profile mutation; rollback removes test profiles only |
| G10 | B + D | Approve target deployment and rehearse native Service Worker install/update with two generations/tabs, mixed-version drain, cold offline, cache eviction, failed deploy/install and combined app/data rollback; record preserved Legacy/V2 counts | Injected D3 tests are not native SW/Cache Storage or production-like deployment evidence; rehearsal is not production rollout | RC rehearsal and production v2.0 rollout | `DEPLOYMENT-SW-ROLLBACK-PLAN`, then `STAGING-REHEARSAL`, then separately authorized production rollout | Target environment, deployment owner, rollback trigger/time objective, cache ownership and whether public Alpha invokes this gate | Uses isolated staging data first; never deletes Legacy/V2; rollback restores prior deployment/worker generation and preserves libraries |
| G11 | E | Privacy/security owner records explicit public-history incident disposition: approved no-rewrite risk acceptance or a separately planned coordinated rewrite/remediation | Current-tree removal and privacy PASS do not close public history; this task cannot rewrite, force-push or repeat the value | Production v2.0 | `R3-HISTORY-DISPOSITION`; independent, complete before final approval | No-rewrite acceptance versus coordinated incident/history remediation and accountable owner | No data mutation for no-rewrite decision; rewrite option is destructive/public and needs backups, coordination and separate explicit authority |
| G12 | A | On each selected release head: exact remote depth-one checkout, syntax/privacy/full/focused gates, audit/diff/path checks, current-tree P0/P1 inventory and exact-head CI with zero unresolved P0/P1 | Earlier integration CI does not validate a later version/artifact head; environmental non-`PASS` rows are not defects | Alpha for Alpha head; RC and production for later heads | `RELEASE-HEAD-VERIFICATION`; after applicable evidence and before G13 | No material choice once stage contract is frozen | Synthetic/static only; read-only except build outputs authorized by G13; rollback reverts candidate commit |
| G13 | F | Release owner approves exact version, package change, signed/hashed artifact, tag, GitHub Release and—only after G10—production deployment; evidence binds every object to one commit | `1.0.0`, a Draft/Ready PR, tag name, artifact draft or CI alone is not release approval | Every named artifact; final row blocks production v2.0 | `VERSION-ARTIFACT-RELEASE`; last after G2/G3 for Alpha as selected, and after G5-G12 for production | Staged Alpha→Beta→RC→v2.0 sequence or another explicit sequence; artifact format; tag/Release/deploy owner | Versioning/artifact only until separately authorized deploy; rollback/revocation plan must preserve all local data and public auditability |

### Dependency-ordered two-path roadmap

**Shortest honest Alpha path (proposed):**

```text
G1 Alpha contract/distribution decision
→ G4 private-evidence protocol
→ G2 real Legacy rescue and G3 real parity capability/sign-off if owner keeps them as Alpha gates
→ M34 five-path roadmap repair and failure-first docs test
→ G12 exact Alpha-head verification/current defect inventory
→ G13 authorized alpha version/tag/artifact and owner approval
```

The recommended shortest distribution is a limited, non-production Alpha artifact with an explicit
desktop-Chrome support statement. A public web Alpha would additionally require G10 before Alpha.
Deferring G2 or G3 is possible only through an explicit owner Alpha contract that labels the
artifact synthetic-only; it does not close those rows for RC or production.

**Complete `v2.0.0` path (proposed):**

```text
G1/G4/G8/G9/G10/G11/G13 policy and ownership decisions
→ M34 authoritative roadmap repair
→ Alpha evidence/artifact as selected
→ G5 real provider/Disconnect, G6 real import/Backup and G7 real parity sign-off
→ G8 performance evidence and G9 browser/platform evidence or approved waivers
→ G10 staging Service Worker/deployment/combined rollback rehearsal
→ G12 final exact-head verification and zero-P0/P1 inventory
→ G11 closed history disposition
→ G13 exact v2.0.0 version/artifact/tag/deployment/release-owner approval
```

Beta/RC naming does not erase a gate. The owner may stage intermediate artifacts, but RC must retain
G5-G10 and production must retain every G5-G13 result. Data-loss, Legacy destruction, private data
in Git/logs, inability to roll back, duplicate activity creation, Disconnect deletion and
unauthorized external egress remain non-waivable.

## Consolidated owner decision package

Implementation is stopped. One response must resolve or deliberately defer all items below; a
deferred item keeps its dependent stage blocked.

1. **Allowlist:** authorize the exact five-path minimum above, including pointer-only
   `docs/README.md`, or explicitly accept that M34 cannot claim a single current evidence source.
2. **Alpha contract:** select a limited local/non-production `v2.0.0-alpha.1` artifact (recommended)
   or a public web Alpha; name supported Alpha browsers and release owner; decide whether G2/G3 real
   evidence blocks Alpha or is explicitly deferred to RC with a synthetic-only label.
3. **Private evidence:** approve G4's off-Git, redacted, disposable-profile protocol; name the
   evidence custodian, representative source/device mix and parity tolerance/sign-off owner.
4. **Performance:** choose approved absolute budgets for 10,000 activities and 1,000 FIT, or provide
   a time-bounded waiver owner, expiry, user impact, mitigation and follow-up task.
5. **Browser/platform:** require the PRD matrix as written, or list explicit exclusions/time-bounded
   waivers with owner and expiry; state whether accessibility evidence is RC or production blocking.
6. **History:** select explicit no-rewrite risk acceptance or a separately authorized coordinated
   incident/history-remediation plan; name the privacy/security owner.
7. **Deployment/SW/rollback:** select the target environment and owner; approve creation of a
   non-production plan/rehearsal task; state whether any public Alpha must pass it.
8. **Version/artifact/release:** approve the staged Alpha→Beta→RC→`v2.0.0` route (recommended) or an
   alternative; name artifact type, tag/Release owner and final production release approver.

None of these choices authorizes the follow-on real-data test, deployment, history action, version
bump, tag, Release, artifact publication, production rollout, merge, or cleanup. Each is a separate
bounded task and authority gate.

## Owner approval and frozen implementation contract — 2026-08-12

Owner XiChuan9 approved the complete recommended default package. This approval resolves the eight
questions above only as stated here and authorizes failure-first documentation implementation
inside the exact five-path allowlist. It does not authorize any real/private evidence access,
artifact build/publication, version bump, tag, GitHub Release, deployment, Service Worker or cache/
data mutation, history rewrite, merge, cleanup, or change to `main`, `maintenance/v1`, or
`integration/v2`.

### 1. Exact cumulative allowlist

```text
docs/tasks/pr-47-final-v2-release-roadmap.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
docs/README.md
tests/docs/release-docs.test.js
```

These five paths are the cumulative hard maximum. A sixth path requires a new owner decision.

### 2. Alpha contract

- The Alpha target is a limited local, non-production `v2.0.0-alpha.1` static Web bundle.
- The supported Alpha surface is current macOS Chrome only.
- Alpha evidence is explicitly synthetic-only.
- G2 real Legacy rescue and G3 real parity are deferred to RC. They are neither waived nor `PASS`.
- A public web Alpha is not authorized.
- Release owner is XiChuan9.
- Version change, bundle build/publication, SHA-256 manifest, tag and GitHub Release remain separate
  future authorizations.

The shortest honest Alpha path is therefore M34 closure, an exact release-head verification/current
P0/P1 inventory, and a separately authorized version/artifact task. It must continue to disclose G2
and G3 as RC blockers and cannot claim real-data, public deployment or cross-platform evidence.

### 3. Private-evidence protocol definition

The G4 protocol definition is approved; execution is not:

- custodian and sign-off owner: XiChuan9;
- raw Tokens, accounts, private activities/files and browser profiles never enter Git;
- use only a separately authorized disposable profile and isolated target;
- eventual source mix: real Legacy cache, one bounded provider Sync/Disconnect, FIT, TCX, GPX,
  CSV, ZIP, and format-3 Backup/Restore;
- publish only permitted redacted aggregate counts, statuses and hashes;
- zero unresolved P0 discrepancies; and
- every non-P0 parity difference must be explicitly explained and signed off by XiChuan9.

This records an evidence protocol only. G2, G3 and G5-G7 remain non-`PASS` and no real/private
evidence may be accessed under this task.

### 4. Performance disposition

XiChuan9 approves a time-bounded waiver through **2026-11-12** for absolute 10,000-activity and
1,000-FIT thresholds. The existing functional/resource hard limits and 5,000-activity/200,000-point
hard evidence remain unchanged. Large libraries or batches may be slower or encounter memory/quota
limits earlier. Mitigations remain bounded imports/chunks, cancellation, explicit Retry/Recover/
Abandon, and no release performance overclaim. A representative real-hardware budget task must
complete before expiry. The waiver does not weaken data, privacy or correctness gates.

### 5. Browser and platform disposition

Full `v2.0.0` requires the PRD browser/platform matrix as written; no permanent narrowing is
approved. Current macOS Chrome is permitted only for the limited synthetic Alpha. Safari, Firefox,
Windows, iOS/PWA/mobile and core keyboard/screen-reader evidence remain RC and production blockers.
Any later time-bounded waiver requires a separate owner, expiry and approval.

### 6. R3 public-history disposition

Privacy/security owner XiChuan9 approves explicit **no-rewrite risk acceptance** for the R3 public-
history identity exposure. Current-tree removal and the regression guard remain mandatory. No
credential exposure was found. This is an owner disposition, not erasure: do not rewrite history,
force-push, delete refs/tags/Releases/PR artifacts, repeat exposed values, or notify externally
under this authorization.

The E-class decision is closed by disposition. Historical exposure remains a disclosed accepted
risk; no claim may say it was removed from public history.

### 7. Deployment, Service Worker and rollback disposition

The target future rehearsal is a non-production Vercel preview/staging environment, owned by
XiChuan9. After M34 merges, authority extends only to creating a planning/rehearsal Task Brief. That
future plan must require two Service Worker generations/tabs, waiting/drain, mixed-version,
cold-offline, owned-cache eviction, failed deploy/install, rollback trigger/time objective and
preserved Legacy/V2 counts.

No public Alpha, production deployment, Service Worker rollout, cache/data mutation, planning Task
Brief, or rehearsal execution is authorized now. G10 remains `BLOCKED` for RC/production.

### 8. Version, artifact and release disposition

The approved route is Alpha → Beta → RC → `v2.0.0`. The artifact type is a static Web bundle with a
SHA-256 manifest. Tag/GitHub Release owner and final production approver are XiChuan9. Actual version
bump, artifact build/publication, tag, GitHub Release, deployment, release and rollback remain
separately unauthorized. G13 therefore remains `BLOCKED` until a future exact-object approval.

### Frozen post-decision gate interpretation

- G1's Alpha contract decision is closed, but the Alpha artifact/version action remains F-class
  `BLOCKED` and separately unauthorized.
- G2 and G3 are `NOT RUN`/`PARTIAL` and block RC/production, not the limited synthetic Alpha.
- G4 protocol definition is closed; every real/private execution remains C-class `NOT RUN`.
- G5-G7 remain C-class RC/production blockers.
- G8 has a B-class waiver through 2026-11-12; it is not a performance `PASS` and requires the named
  follow-up before expiry.
- G9 remains a B/C RC/production blocker; only the limited Alpha is macOS Chrome-only.
- G10 remains D-class `BLOCKED`; only a later planning Task Brief is approved after M34 merge.
- G11 is closed by E-class explicit no-rewrite disposition, not by erasure.
- G12 remains A-class work on each future release head.
- G13 route/ownership is selected, while every version/artifact/tag/Release/deployment action stays
  F-class `BLOCKED` pending separate authorization.

Implementation may now add the failure-first assertions, repair the three approved documentation
surfaces, run the full gates and reviews, and write a Task-Brief-only Closure. Draft-to-Ready is
authorized only after true remote depth-one and exact-head CI succeed. Ready is not merge authority.

## Audit verification record

```text
Task-Brief-only first commit    d4269eb; exactly one new path
Draft PR                        #59 OPEN/Draft against integration/v2
npm ci                          PASS; 6 packages
npm run check:syntax            PASS; 283 files
npm run check:privacy           PASS
npm test in restricted sandbox  1,911/1,913; only two localhost listen EPERM environment failures
npm test outside sandbox        PASS; 1,913/1,913
focused current docs test       PASS; 13/13 (and proved it still accepts the stale authority)
npm audit --omit=dev            PASS; 0 vulnerabilities
git diff --check                PASS before findings record
real/private/browser profile    NOT RUN
deployment/SW/cache/data        NOT RUN / unchanged
history/version/tag/Release     NOT RUN / unchanged
```

The restricted-sandbox result is not a product failure and is not reused as a pass. The authorized
rerun outside that network-listen restriction passed all 1,913 tests.

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
