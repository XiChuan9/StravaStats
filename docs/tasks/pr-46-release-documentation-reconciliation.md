# PR-46: Current-Tree Release Documentation Reconciliation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / P1-DOCS |
| Status | Final Review Closure complete; exact-head verification pending |
| Branch | `codex/v2/release-documentation-reconciliation` |
| Exact base | `integration/v2@eb0b6695b5dbf618877ff794dbc76935babeb793` |
| Exact base tree | `6cdee026ec61604e016c20204e722816264a9f0c` |
| PR #57 source | `70b81c9341803e470b3ddc6eea43b2ba34e40bbb` |
| Authority | Documentation and exact documentation tests only |

## Outcome

Reconcile the public and release-owner documentation with the actual integration tree after
R3-R11, D3, C1-C4, and explicit Source Manager Retry. The resulting documents must state what is
closed by deterministic current-tree evidence without promoting absent real-account, private-data,
cross-browser, production deployment, public-history, version, artifact, or release-owner evidence.

This task does not authorize a product change, a release claim, or closure of an environmental gate.
Ready is review state only and is not merge, tag, release, deployment, Service Worker rollout, or
cleanup authorization.

## Exact authority and evidence order

Resolve conflicts in this order:

1. accepted ADRs;
2. the product PRD;
3. `docs/engineering/release-gates.md` and `docs/engineering/v2-development-plan.md`;
4. the final current-tree audit in Draft PR #56;
5. this Task Brief;
6. current implementation details.

Every current-state statement must be supported by exact-source inspection, a deterministic test,
an accepted browser record whose production tree is byte-identical, or exact-head CI. Historical
evidence remains labelled historical. Missing environmental or owner evidence remains `PARTIAL`,
`BLOCKED`, or `NOT RUN`; it never becomes `PASS` because Node or disposable Chromium is green.

## Frozen literal maximum allowlist

No path outside this list may change:

```text
docs/tasks/pr-46-release-documentation-reconciliation.md
README.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
docs/guides/privacy-guide.md
docs/tasks/pr-24-release-documentation.md
tests/docs/release-docs.test.js
docs/README.md
CHANGELOG.md
```

The first commit is restricted further to this Task Brief only. Later commits may use the remainder
only after the Draft PR exists and the findings-first copy matrix is recorded here. Production
JavaScript, HTML, CSS, package/version, workflow, schema, API, Worker, Service Worker, deployment,
release configuration, and user data are expressly outside scope.

### Option A scope expansion

The first independent implementation review found that `docs/README.md` and `CHANGELOG.md` are
linked release-documentation surfaces and are included by the exact documentation test, but both
still described the historical `61d7b032...`/V4/PR-24 state as current. The task stopped without
editing either path.

The owner then selected scope Option A and authorized exactly those two additional paths. The
cumulative hard maximum is now the nine literal paths above. This authorization does not change
product or release behavior and does not permit a tenth path.

## Baseline readback

```text
integration commit      eb0b6695b5dbf618877ff794dbc76935babeb793
integration tree        6cdee026ec61604e016c20204e722816264a9f0c
PR #57 source head      70b81c9341803e470b3ddc6eea43b2ba34e40bbb
integration divergence  0/0
integration worktree    clean
integration CI          run 31552831032 / job 93978992223 SUCCESS
main/maintenance        unchanged
```

Untouched exact-base checks executed in the isolated worktree:

```text
npm ci                  PASS; 6 packages; 0 vulnerabilities reported
npm run check:syntax    PASS; 283 files
npm run check:privacy   PASS
npm test                PASS; 1,912/1,912
git diff --check        PASS
```

PR #57 is CLOSED/merged with merge SHA equal to the exact base. Historical PR #31 and audit PR #56
were read back OPEN/Draft and remain untouched.

## Findings-first reconciliation plan

A2 is read-only until the current copy matrix is complete. It must inspect the exact base, not old
PR summaries, and record for each affected statement:

- current wording and why it is stale, ambiguous, or accurate;
- authoritative current-tree evidence;
- replacement wording and status vocabulary;
- whether the statement is deterministic, reused actual-served Chromium, or external/NOT RUN;
- the exact document and exact test assertion that must change together.

At minimum the matrix must reconcile:

- Canonical V2 default, explicit Legacy/Shadow fallback, V6 and Backup format 3;
- Source Manager Connect, Disconnect, bounded Sync latest 25, recovery lease, and explicit Retry;
- R3 current-tree removal versus separate public-history incident disposition;
- R4/R5 redacted logging, R6 weather consent, R7 AI consent, R8 map consent;
- R9 private-cache boundary, R10 accepted non-destructive Legacy-probe residual, R11 telemetry/CDN;
- D3 deterministic Service Worker lifecycle versus production-like lifecycle still not run;
- current deterministic tests/performance evidence versus unapproved thresholds or missing platforms;
- real account/private library/Disconnect/parity, browser/platform, production deployment/rollback,
  history, version/tag/artifact, and release-owner gates.

## A2 current-tree evidence and copy matrix

The read-only investigation inspected the exact base, accepted ADR-0001 through ADR-0006, PRD,
development plan, release gates, current source/tests, the R3-R11 and D3 Task Briefs, C1-C4, PR-45,
and the six target documents. An independent read-only reviewer repeated the target-document audit
with `git show` at the exact base. Neither investigation used a provider, private data, browser
profile, deployment, or repository mutation.

| Surface | Stale baseline statement | Authoritative current statement | Required status |
| --- | --- | --- | --- |
| README release label | “integrated V2 release candidate” can imply the RC gate closed | Integrated V2 code candidate; not Alpha, Beta, RC, or production release | BLOCKED for release |
| README Sources | Strava API card is `Connect later` | Real Sources supports explicit Connect/Reconnect, `Sync latest 25`, Disconnect, Recover/Abandon, and eligible retained-byte Retry; none starts automatically; Demo has no capability | PASS deterministic; real provider NOT RUN |
| Release-gate capability | Only Flag/SW/Demo tests exist; Repository, Storage, Import, Decoder, security and performance are not implemented | The current 1,912-test suite covers those deterministic boundaries; environmental and threshold gates remain separate | PASS only per evidenced row |
| Release-gate governance | Status is `Proposed` | This task has no authority to accept policy; retain `Proposed`, update only current capability/evidence | NOT APPLICABLE |
| Service Worker | Current worker uses fixed `strava-dashboard-v1`; same-origin API-cache risk remains | Current cache is `stravastats-static-v2-000001`; the legacy name is recognized but not blindly deleted; R9 static-only admission bypasses API/private/dynamic requests; D3 waiting/drained lifecycle is deterministic only | PARTIAL overall; production-like NOT RUN |
| Logging | Raw client/server logging remains a production privacy blocker | R4/R5 reviewed production responsibility paths emit fixed/redacted events; no additional current-tree raw-log defect was found | CLOSED deterministic |
| Weather | Exact coordinates/date remain an unresolved defect | After exact tab-scoped consent, R6 sends one start coordinate rounded to two decimals and one exact local calendar date; this remains disclosed external egress, not local-only | CLOSED selected code contract; real external evidence NOT RUN |
| Map and AI | Old inherited external behavior is undifferentiated | R8 map and R7 AI each require their own explicit, memory-only consent and bounded payload; neither implies local-only or zero external I/O | CLOSED deterministic; real external evidence NOT RUN |
| Telemetry/CDN | Inherited telemetry/CDN baseline is current | R11 disables runtime telemetry and serves pinned visualization assets same-origin with integrity and no CDN fallback | CLOSED deterministic |
| Legacy probe | Residual is absent from release copy | R10 is non-destructive; accepted Option B can leave only an empty V1 database shell with zero stores/user records after the narrow external-delete/abort race | CLOSED with accepted residual |
| Retry | Provider “no retry” wording is ambiguous | Provider acquisition has no automatic retry; separately, eligible failed local imports expose explicit single-use Retry from retained pending bytes under the C4 lock/lease | CLOSED deterministic |
| Defect inventory | No release-wide P0/P1 inventory exists | M22 inventory exists; P0 Retry is closed by PR #57; this P1 documentation drift remains open until this PR's fresh no-findings review and exact-head CI | BLOCKED until Closure |
| R3 identity | Current tree and public history are conflated | R3 current-tree tracked identity is removed and privacy guard passes; public Git-history incident disposition is a separate owner gate | CLOSED current tree; history BLOCKED |
| PR-24 ledger | The V4-era ledger is called current | Preserve the original evidence as a historical snapshot and append a superseding exact-`eb0b669...` ledger; do not rewrite old SHAs/counts | Historical + current supplement |

### Current gate interpretation

- Deterministic Alpha/Beta architecture, local imports, Source Manager, explicit Retry, V6,
  format-3 Backup, consumer regressions, privacy controls, R9 cache boundary, and D3 code lifecycle
  may be marked `PASS` only at their bounded current-source/test rows.
- Performance remains `PARTIAL`: 5,000 activities and 200,000 points pass; 10,000 activities and
  1,000 FIT throughput have record-only evidence without an approved absolute budget or waiver.
- Real account/private library, real Disconnect, real import, Legacy rescue, Backup restore, and
  parity/Shadow review remain `PARTIAL` or `NOT RUN`.
- Safari, Firefox, Windows, iOS/PWA, mobile, broad accessibility, responsive and pixel-level visual
  evidence remains `BLOCKED` absent a matrix or time-bounded waiver.
- Production-like Service Worker, mixed-version/cold-offline, deployment and combined rollback
  rehearsal remain `BLOCKED`/`NOT RUN`.
- R3 public-history incident disposition remains `BLOCKED`.
- Version, tag, artifact, deployment and release-owner approval remain `BLOCKED`.

### Resolved authority questions

No unresolved material copy choice remains:

1. `release-gates.md` stays `Proposed`; documentation reconciliation is not policy acceptance.
2. The exact local date in R6 is an already selected consented-egress contract and must be
   disclosed. Further minimization would require a separate product/privacy decision.
3. D3 evidence closes deterministic code rows only; the RC/production Service Worker row remains
   `PARTIAL` because native production-like evidence is not run.
4. PR-24 historical evidence is immutable as evidence; a clearly labelled superseding current
   ledger is additive and does not rewrite history.

The exact documentation test must stop requiring the obsolete logging/exact-coordinate blockers,
reject their reintroduction, require the selected R6 disclosure, distinguish provider acquisition
from retained-byte Retry, require R3 history separation, and preserve every external gate above.

The first implementation review additionally requires:

- `docs/README.md` and `CHANGELOG.md` to use the exact current integration baseline and describe
  R3-R11, D3, C1-C4 and explicit Retry without claiming an Alpha/Beta/RC/release;
- release-gate assertions to bind each private, browser/platform, production Service Worker,
  deployment/rollback, history, version/artifact and owner category directly to a non-PASS state;
- README to distinguish current V2 Source Manager provider I/O from Legacy provider paths and from
  separately consented weather, map and AI egress;
- current-ledger assertions to inspect only the appended current supplement, never historical
  PR-24 prose;
- package `1.0.0`, absent V2 tag/GitHub Release/release-owner approval and no milestone claim to
  remain explicit.

## Option A failure-first repair evidence

The expanded exact documentation test was run before either newly authorized surface was repaired.
It failed `3/13` cases for the intended reasons: the root README did not freeze the package/release
contract, `docs/README.md` and `CHANGELOG.md` still named the historical `61d7b032...` baseline, and
the current provider/external-gate boundaries were not directly asserted. After repairing only the
frozen nine-path package, the focused test passes `13/13`.

The repair:

- labels the root README, documentation index and changelog as an integrated V2 code candidate,
  explicitly not Alpha, Beta, RC or production release;
- freezes package `1.0.0`, no `v2.0.0-*` tag, no GitHub Release or artifact, no production
  deployment and no release-owner approval;
- updates the documentation index and changelog to exact baseline `eb0b669...`, V6/format 3,
  R3-R11, D3, C1-C4 and explicit Retry while preserving all external blockers;
- binds five release-gate rows directly to non-PASS states in `release-gates.md`, so aggregated
  keywords elsewhere cannot produce a false green;
- scopes current-ledger assertions to the appended superseding supplement only; and
- separates current V2 Source Manager provider I/O, Legacy provider paths, and the independently
  consented weather, map and AI destinations.

Markdown line wrapping initially exposed three bounded test-regex defects after the content repair.
Those assertions were corrected to accept whitespace/newlines without weakening the required facts;
the final focused result remains `13/13`. No production source, package, workflow, schema, Service
Worker, deployment configuration, private data, provider or browser profile was used or changed.

The post-commit independent findings-first review found one P1 copy/test gap: the Source Manager
paragraph conflated direct Connect/Reconnect provider authorization with the same-origin callback
exchange, and omitted Disconnect revocation from the network inventory. A new direct assertion
failed `1/13` against that wording. The bounded repair now distinguishes provider authorization,
callback exchange, Disconnect revocation, and `Sync latest 25`; it also preserves the separate
Legacy and weather/map/AI boundaries. No other actionable finding was reported.

## Failure-first and verification contract

Before editing release copy, add or update the exact documentation test so it fails against the
known stale baseline for the intended reason. The failure must prove that old pre-R/C assertions are
no longer accepted and that external gates cannot be accidentally promoted. Then update only the
frozen documents until the focused test passes.

Required verification:

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
fresh independent no-findings review
remote depth-one exact-head verification
exact-head GitHub CI
```

The Closure section must record the exact head, changed paths, test counts, review disposition,
reused evidence, external NOT-RUN gates, rollback, PR state, and CI. Only after a fresh no-findings
review and green exact-head CI may standing authorization move the new PR from Draft to Ready.

## Privacy, data, rollback, and stop boundary

Use only static, deterministic synthetic, and read-only evidence. Do not read or use a real Token,
account, provider response, private activity/library/file, or user browser profile. Do not mutate
Legacy/V2 data, Cache Storage, browser state, deployment state, Git history, branches other than this
task branch, tags, Releases, or worktrees.

Rollback is a normal revert of documentation/test commits. It requires no migration, data rewrite,
cache deletion, version change, or deployment action. Stop immediately for:

- any required path outside the frozen maximum;
- any copy choice that changes PRD/ADR product scope or release policy;
- any attempt to describe environmental evidence as deterministic PASS;
- any need for real/private/browser-profile/deployment evidence;
- any request to merge, deploy, release, tag, rewrite history, or clean up.

## Final Review Closure

Closure was performed after the repair head `2982292b0c114c191750df9757d018ebd4e7038b`
received a fresh independent `NO FINDINGS` re-review. The earlier independent findings-first review
reported one P1 Source Manager network-inventory ambiguity; commit `2982292` repaired it within
`README.md`, the exact documentation test, and this Task Brief. No P0, additional P1, P2, or tenth
path remained in the fresh review.

### Closed package

- Exact base: `integration/v2@eb0b6695b5dbf618877ff794dbc76935babeb793`.
- Reviewed repair head: `2982292b0c114c191750df9757d018ebd4e7038b`.
- Changed paths relative to the exact base: exactly the nine paths in the frozen allowlist.
- Product, package/version, workflow, schema, API, Service Worker, deployment, release and data
  behavior: unchanged.
- Privacy/data impact: documentation and deterministic documentation assertions only; no Token,
  account, provider call, private library/activity, browser profile, data or cache mutation.
- Rollback: revert the scoped documentation/test commits; no migration, data rewrite, cache action,
  deployment or version change is required.

### Review and local verification

```text
Option A failure-first         FAIL 3/13 for the intended stale-baseline reasons
Option A repair focused       PASS 13/13
independent findings-first    one P1 provider-network inventory ambiguity
finding failure-first         FAIL 1/13 for the intended missing boundary
repair focused                PASS 13/13
fresh independent re-review   NO FINDINGS at 2982292b0c11...
npm ci                        PASS; 6 packages; 0 vulnerabilities reported
npm run check:syntax          PASS; 283 files
npm run check:privacy         PASS
npm test                      PASS; 1,913/1,913
npm audit --omit=dev          PASS; 0 vulnerabilities
git diff --check              PASS
exact changed-path gate       PASS; exactly 9/9 authorized paths
```

The previous repair head `4db3277ae2b5ae4203395b48c4da09f80e3d5862` also completed GitHub CI
run `31567981075`, job `94023737271`, with every step successful. That run is supporting evidence,
not the required final exact-head CI. Remote depth-one verification and GitHub CI for the final
Task-Brief-only Closure head must still pass before Draft-to-Ready.

### Gates deliberately left open

This documentation Closure does not close real account/private library/Disconnect/parity,
Safari/Firefox/Windows/iOS/PWA/platform or waiver, production-like Service Worker/deployment/
combined rollback, R3 public Git-history incident disposition, performance budget/waiver, or final
version/tag/artifact/release-owner approval. It makes no Alpha, Beta, RC, production, deployment or
release claim. Ready, when reached after exact-head verification, remains a review state and is not
merge authorization.
