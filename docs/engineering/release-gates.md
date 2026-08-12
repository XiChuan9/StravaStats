# StravaStats v2 Release Gates

| 字段 | 内容 |
| --- | --- |
| Status | Accepted |
| Owner | XiChuan9 |
| Created | 2026-07-28 |
| Last updated | 2026-08-12 |
| Related plan | [V2 Development Plan](./v2-development-plan.md) |
| Decision record | [PR-47 Final V2 Release Roadmap](../tasks/pr-47-final-v2-release-roadmap.md) |

## 1. Purpose and evidence rules

This is the single authoritative current V2 release roadmap. PRD and accepted ADRs remain higher
product/architecture authority; Task Briefs and PR-24 preserve point-in-time evidence. A historical
Task Brief status, merged PR, green CI, Draft-to-Ready transition or synthetic browser record cannot
promote a missing environmental or owner gate.

Every gate records evidence, verifier/owner, date/environment, result and related task. The result
vocabulary is `PASS deterministic`, `PASS verified`, `PARTIAL`, `BLOCKED`, `NOT RUN`,
`NOT APPLICABLE`, or `CLOSED BY DISPOSITION`. Only a specific bounded deterministic row may use
`PASS deterministic`. An executed C/D/F or other environmental gate may use `PASS verified` only
when its exact acceptance evidence, verifier/owner, date, environment and related task are recorded;
it cannot be inferred from synthetic or earlier-head evidence. `PARTIAL`, `BLOCKED` and `NOT RUN`
are non-`PASS` states. A disposition closes a decision, not an unperformed test and not an erased
historical fact.

## 2. Authoritative current baseline

The authoritative postmerge baseline is:

```text
integration commit      f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628
integration tree        58b8339361991c5c34258be579733ccda3cbe066
integration divergence  0/0
npm ci                  PASS; 6 packages
syntax                  PASS; 283 files
privacy                 PASS
full test               PASS; 1,913/1,913
npm audit               PASS; 0 vulnerabilities
diff/worktree           PASS; clean
integration CI          run 31569312683 / job 94027710807 SUCCESS
```

The exact `integration/v2@f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628` tree contains the
deterministic Feature Flag, Repository, V6 Storage/migration, Import, CSV/ZIP/FIT/TCX/GPX,
Backup format 3, Source Manager, consumers, privacy, Service Worker policy/lifecycle and bounded
performance evidence. No unresolved deterministic P0/P1 defect was found on this tree.

| Deterministic closure | Result | Boundary |
| --- | --- | --- |
| PR #57 Retry | PASS deterministic — closed deterministically | Eligible retained-byte Retry is explicit, single-use and lock/lease bounded; committed items are preserved and provider acquisition has no automatic retry |
| PR #58 P1-DOCS | PASS deterministic — closed deterministically | Squash merge is the exact integration head; postmerge 1,913/1,913 and exact integration CI are green |
| Current P0/P1 inventory | PASS deterministic | No unresolved deterministic P0/P1; environmental and owner gates below remain non-`PASS` rather than being reclassified as defects |

PR-24's additive supplement is preserved unchanged as the exact `eb0b6695...` point-in-time
snapshot. It is historical evidence, not the live roadmap or current baseline.

## 3. Evidence classes and current external summary

Class A is automatically closable with repository/static/synthetic/disposable-browser evidence.
Class B requires an owner material decision or waiver. Class C requires real credentials, a private
library or user-device evidence. Class D requires production deployment, Service Worker or rollback
authority. Class E requires destructive/public-history incident action or an explicit no-rewrite
disposition. Class F requires final version, tag, artifact or release-owner approval.

Deterministic evidence cannot promote these environmental rows:

| Evidence class | Result | Current boundary |
| --- | --- | --- |
| Real account / private library | NOT RUN | G2/G3/G5/G6/G7 require separately authorized private execution; the approved G4 protocol definition is not execution authority |
| Browser / platform | BLOCKED | Full V2 still requires Safari, Firefox, Windows, iOS/PWA, mobile and core keyboard/screen-reader evidence; only limited Alpha is macOS Chrome-only |
| Production Service Worker / deployment / combined rollback | BLOCKED | Planning/rehearsal execution, native worker/cache evidence, deployment and rollback remain unauthorized |
| R3 public Git history | CLOSED BY DISPOSITION | XiChuan9 accepted no-rewrite risk; current-tree removal and guard remain mandatory; this is not erasure |
| Version / tag / artifact / release owner | BLOCKED | Route and owner are selected, but package remains `1.0.0` and no V2 artifact, tag, GitHub Release or deployment is authorized |

The Privacy Guide's pre-M34 sentence that calls the R3 decision `BLOCKED` is superseded for release
status only by this Accepted roadmap and the recorded owner disposition. Its operational privacy,
incident-handling and no-rewrite safety rules remain current. The five-path M34 limit does not
authorize editing that sixth path.

## 4. Canonical remaining gate inventory

Only the rows below genuinely remain. Closed deterministic rows and owner decisions are not
duplicated here.

| ID | Class | Result | Blocks | Gate | Exact acceptance evidence | Prohibited overclaim | Minimum next task / dependencies | Owner decision or frozen disposition | Privacy, data and rollback impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G2 | C | NOT RUN | RC / production | Real Legacy rescue | Authorized Legacy cache export, validation and restore into a fresh isolated target with permitted redacted counts/hashes and unchanged source | Synthetic rescue is not a real private-library drill | `REAL-LEGACY-RESCUE`, after separate execution authority under G4 | Deferred from synthetic-only Alpha to RC; not waived and not `PASS` | Raw private data stays off Git; target is disposable; source Legacy/V2 data is never cleared or overwritten |
| G3 | B + C | PARTIAL | RC / production | Real parity | Export and explain a redacted real-library Shadow/parity report with zero unresolved P0 discrepancy and XiChuan9 sign-off for every explained non-P0 difference | Synthetic parity or equal counts alone is not real semantic parity | `REAL-PARITY-SHADOW`, after separate G4 execution authority | Tolerance rule frozen; execution deferred from Alpha to RC | Read-only private comparison; publish permitted aggregates only; no merge/delete/rewrite |
| G5 | C | NOT RUN | RC / production | Real provider / Disconnect | Authorized Connect/Reconnect, one bounded `Sync latest 25`, auth/rate degradation and Disconnect with preserved Legacy/V2 counts | Provider doubles are not real account evidence; Disconnect is not Delete Local Data | `REAL-PROVIDER-DISCONNECT`, after separate G4 execution authority | Source mix and custodian frozen; actual access not authorized by M34 | Token/provider evidence stays off Git; rollback revokes connection only and preserves local libraries |
| G6 | C | NOT RUN | RC / production | Real import / Backup | Representative FIT/TCX/GPX/CSV/ZIP import plus format-3 Backup/Restore into a fresh isolated target with redacted manifest/count/hash reconciliation | Synthetic formats do not prove a private library or unsupported vendor coverage | `REAL-IMPORT-BACKUP`, after separate G4 execution authority | Required source mix frozen; actual access not authorized by M34 | Private files remain off Git; disposable target only; original files and Legacy data preserved |
| G7 | B + C | BLOCKED | RC / production | Real parity sign-off | XiChuan9 disposition for every G3/G5/G6 discrepancy with zero unresolved P0 discrepancy | Unreviewed warnings, missing tolerances or counts-only comparison cannot be `PASS` | `REAL-PARITY-SIGNOFF`, after G3/G5/G6 | XiChuan9 is sign-off owner | Redacted derived evidence only; no automatic merge/delete; rollback withdraws evidence, not data |
| G8 | B | PARTIAL | RC / production after 2026-11-12 | Performance budget | The waiver temporarily satisfies the absolute 10,000-activity and 1,000-FIT threshold blocker through 2026-11-12 while existing functional/resource hard limits and 5k/200k hard evidence remain; complete a representative real-hardware budget task before expiry or obtain a new explicit disposition | Waiver and record-only 10k/1,000-FIT timings are not performance `PASS` or production-wide speed claims | `PERFORMANCE-REAL-HARDWARE-BUDGET`, before waiver expiry | XiChuan9 waiver through 2026-11-12 | Synthetic until separately authorized; no correctness/privacy weakening; rollback reverts policy/test changes only |
| G9 | B + C | BLOCKED | RC / production | Browser / platform / accessibility | PRD matrix: supported Safari/Firefox/Chrome versions, macOS/Windows, iOS/PWA/mobile basic use and core keyboard/screen-reader evidence, or a separately approved time-bounded waiver | macOS Chrome Alpha or disposable Chromium is not the full matrix | `BROWSER-MATRIX`, after release-head freeze; private smoke additionally requires G4 | No permanent narrowing; any waiver needs owner and expiry | Prefer synthetic disposable profiles; no user profile mutation; private evidence stays off Git |
| G10 | B + D | BLOCKED | RC / production | Production Service Worker / deployment / rollback | Approved non-production Vercel preview/staging plan then authorized rehearsal of two worker generations/tabs, wait/drain, mixed version, cold offline, owned-cache eviction, failed deploy/install, rollback trigger/time objective and preserved Legacy/V2 counts | Injected D3 evidence is not native SW/Cache Storage, deployment, rehearsal or production rollout | Planning/rehearsal Task Brief only after M34 merge; execution needs separate authority | XiChuan9 owns future plan; no public Alpha or rehearsal is authorized now | Isolated staging first; never delete Legacy/V2; rollback restores prior deployment/worker while preserving libraries |
| G12 | A | NOT RUN | Alpha / Beta / RC / production | Exact release-head verification | After the separately authorized G13 candidate build, verify its exact versioned commit and bundle/manifest from a true remote depth-one checkout with focused/syntax/privacy/full/audit/diff/path gates, current P0/P1 inventory and exact-head CI before any tag, Release or publication | Earlier integration, M34 CI or pre-candidate CI does not validate a later version/artifact head | `RELEASE-HEAD-VERIFICATION`, after the G13 candidate-building phase and before G13 publication approval | Mechanical once the exact versioned candidate head exists | Static/synthetic/read-only; rollback reverts candidate commits without data/cache deletion |
| G13 | F | BLOCKED | Alpha / Beta / RC / production | Version / tag / artifact / release | Under separate authority, first create an exact versioned candidate, static Web bundle and SHA-256 manifest; after G12 verifies that exact candidate, obtain XiChuan9 exact-object/final approval before any tag, GitHub Release, publication or, only after G10, deployment; every object binds to one commit | Selected route/owner, package `1.0.0`, CI or a Draft/Ready PR is not an artifact or release | `VERSION-ARTIFACT-RELEASE`: candidate-building phase before environmental/G12 evidence; owner-approval then publication phases after G12, last for each named stage | Alpha → Beta → RC → `v2.0.0`; XiChuan9 owns tag/Release and final production approval | No action under M34; later rollback/revocation must preserve local data and public auditability |

## 5. Shortest honest V2 Alpha path

The selected `v2.0.0-alpha.1` target is a **limited local, non-production static Web bundle**. Its
supported surface is **current macOS Chrome only**, and its evidence is explicitly
**synthetic-only**. A public web Alpha is not authorized.

G2 real Legacy rescue and G3 real parity are deferred to RC. They remain `NOT RUN`/`PARTIAL`, are
not waived and must never be called `PASS` for Alpha. The selected Alpha contract closes the B-class
scope decision only; version and artifact actions remain **BLOCKED** pending separate authorization.

Dependency order:

```text
M34 canonical roadmap merge
→ separately authorized G13 versioned Alpha candidate and static-bundle/SHA-256-manifest build
→ G12 exact candidate-head, artifact and current P0/P1 verification
→ XiChuan9 exact-object approval
→ separately authorized G13 tag/Release/publication action
```

This path permits no public deployment, real/private access, broader browser-support claim, version
bump, artifact build/publication, tag or GitHub Release under M34.

## 6. Complete v2.0 path

The approved release sequence is **Alpha → Beta → RC → v2.0.0**. The eventual artifact is a static
Web bundle with a SHA-256 manifest; XiChuan9 owns tag/GitHub Release and is final production
approver. All actual version, artifact, tag, Release, deployment and rollback actions remain
separately unauthorized.

### Owner dispositions that constrain the path

- **Private evidence:** the approved protocol names XiChuan9 as custodian, keeps raw Tokens,
  accounts, private activity/files and browser profiles out of Git, uses an authorized disposable
  profile/isolated target, and publishes only permitted redacted aggregate counts/statuses/hashes.
  The protocol is approved, but real/private evidence execution is **NOT RUN** and not authorized by
  M34.
- **Parity:** zero unresolved P0 discrepancies; XiChuan9 must explain and sign off every non-P0
  difference.
- **Performance:** the waiver temporarily satisfies the absolute 10,000-activity and 1,000-FIT
  threshold blocker and therefore does not block RC/production through **2026-11-12**. Large
  libraries or large batches may be slower or reach memory/quota limits earlier. Existing functional/
  resource hard limits and 5k/200k evidence stay unchanged; bounded chunks, cancellation and explicit
  Retry/Recover/Abandon mitigate impact. A representative real-hardware budget task is required
  before expiry, and no release performance overclaim is permitted. Expiry without that evidence or
  a new explicit disposition makes G8 blocking again; it never weakens privacy, correctness or data
  safety gates.
- **Browser/platform:** full V2 requires Safari, Firefox, Windows, iOS/PWA and mobile evidence plus
  core keyboard and screen-reader evidence. macOS Chrome-only applies solely to the limited Alpha;
  any later time-bounded waiver requires separate owner/expiry approval.
- **History:** XiChuan9 approved no-rewrite risk acceptance after no evidence of credential exposure
  was found. Current-tree removal and regression guard remain mandatory. The disposition is not
  erasure and does not authorize rewriting history, force-pushing, deleting refs/tags/Releases/PR
  artifacts, repeating exposed values or external notification.
- **Deployment/SW/rollback:** the future target is non-production Vercel preview/staging. Authority
  extends only to a planning/rehearsal Task Brief after M34 merge. A later authorized rehearsal must
  cover two Service Worker generations and two tabs, waiting/drain, mixed version, cold offline,
  owned-cache eviction, failed deploy/install, rollback trigger/time objective and preserved
  Legacy/V2 counts. Production deployment remains **BLOCKED** and not authorized.

### Dependency order

```text
M34 canonical roadmap merge
→ separately authorized G13 versioned candidate build and release-head freeze
→ separately authorized G2/G3/G5/G6 private evidence tasks
→ G7 XiChuan9 parity sign-off
→ while the G8 waiver is active, schedule its real-hardware follow-up without blocking later gates
→ after 2026-11-12, G8 evidence or a new explicit disposition is required before proceeding
→ G9 PRD browser/platform/accessibility matrix
→ post-M34 G10 planning Task Brief and separately authorized staging rehearsal
→ G12 final exact candidate-head/artifact verification and zero-P0/P1 inventory
→ XiChuan9 final exact-object approval
→ separately authorized G13 publication/tag/Release and, after G10, deployment action
```

Beta/RC naming never erases a row. RC requires G2/G3/G5-G7/G9/G10 plus the G13 candidate-building
phase, G12 verification of that exact candidate, XiChuan9 exact-object approval and only then the G13
RC publication action. G8 additionally blocks RC after waiver expiry unless its evidence or a new
explicit disposition exists. Production requires every non-waived remaining row; G8 likewise becomes
mandatory after expiry. Data loss, Legacy destruction, private data in Git/logs, inability to roll
back, exact duplicate creation, Disconnect deletion and unauthorized external egress remain
non-waivable.

## 7. Pull request and integration gates

Every PR, including documentation-only work, must have an approved Task Brief, literal path scope,
appropriate focused checks, `npm ci`, syntax, privacy, full tests, `git diff --check`, privacy/data/
migration/rollback reporting and exact-head CI. Unrun evidence stays explicit. Ready is not merge,
tag, release, deployment or cleanup authority.

Before merge to `integration/v2`, CI must pass; Legacy startup and rollback must remain available;
V2 writes must not damage Legacy; Repository/Storage/Import integration and additive/idempotent
migrations must remain green; and diagnostics must not expose private data.

## 8. Waiver and failure policy

The following cannot be waived:

- data loss or damage to Legacy Cache;
- private activity, GPS, health data, Tokens or credentials entering Git/logs;
- inability to roll back without deleting user data;
- exact duplicates producing another activity;
- Disconnect deleting local activities; or
- unauthorized activity-data egress.

A permitted time-bounded waiver must record reason, user impact, mitigation, owner, expiry and
follow-up task. On gate failure, stop release work, preserve redacted evidence, classify the failure,
open a bounded task and rerun affected gates. Never weaken status copy or delete a failing test to
manufacture `PASS`.
