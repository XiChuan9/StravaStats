# PR-46: Current-Tree Release Documentation Reconciliation

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / P1-DOCS |
| Status | A1 scope freeze complete; A2 reconciliation pending |
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
```

The first commit is restricted further to this Task Brief only. Later commits may use the remainder
only after the Draft PR exists and the findings-first copy matrix is recorded here. Production
JavaScript, HTML, CSS, package/version, workflow, schema, API, Worker, Service Worker, deployment,
release configuration, and user data are expressly outside scope.

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
