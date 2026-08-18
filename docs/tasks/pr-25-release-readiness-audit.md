# PR-25: Final Current-Tree Release Readiness Audit

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M22 / PR-25 final core audit after C4 |
| Status | Audit complete; current tree remains release-blocked |
| Branch | `codex/v2/release-readiness-c4-audit` |
| Exact base | `integration/v2@1669d1636188184232d76b3c05305496d26ff313` |
| Exact base tree | `d62d29bee122ee2d9abcd76d805309564d91dbe9` |
| Allowed path | `docs/tasks/pr-25-release-readiness-audit.md` only |
| Product authority | Audit and publication only; no implementation or release action |

## Authority and stop boundary

This document is a findings-first audit of the actual current integration tree. It does not
authorize product or test changes, dependency or version edits, schema or Service Worker changes,
deployment configuration, a tag, GitHub Release, production deployment, Ready transition, merge,
cleanup, real OAuth/provider access, private-library access, or user-browser/profile access.

Conflicts resolve in this order: Accepted ADRs, product PRD, engineering release gates and plan,
this audit, then implementation details. A later task brief cannot silently waive a retained PRD
P0 requirement. Missing real-data, browser, deployment, rollback, or owner evidence remains
`PARTIAL`, `BLOCKED`, or `NOT RUN`; a passing deterministic suite never promotes it to `PASS`.

The previous PR-25 branch and Draft PR #31 remain based on the historical
`e083fa0d55c8981f0258af546451ebb0d48e4fa4` branch point. Rebasing, merging integration into it, or
rewriting it would obscure the current audit base. This audit therefore uses a new ordinary branch
created directly from the exact current integration commit. PR #31 remains untouched, OPEN/Draft,
and historical.

Stop if any repository path other than this Task Brief changes, or if additional evidence would
require a real Token/account, provider call, private activity/file/library, user browser profile,
production origin, data/cache mutation, branch rewrite, protected-branch mutation, deployment,
release, or cleanup.

## Exact baseline and executed evidence

The unique integration worktree was read back at:

```text
commit                 1669d1636188184232d76b3c05305496d26ff313
tree                   d62d29bee122ee2d9abcd76d805309564d91dbe9
parent                 c2df4ea16920d4b5c80ea06eae1059c1940e1994
local/origin divergence 0/0
worktree               clean
main                   fe34535c39db421434a5e28cd26a57b3f71130e2
maintenance/v1         fe34535c39db421434a5e28cd26a57b3f71130e2
```

GitHub App evidence identifies PR #55 as merged with squash SHA equal to the exact base.
Integration push CI run `31544200202`, job `93953078352`, concluded `success`; every step passed.
The merged commit tree is byte-identical to PR #55 final head
`2d0ed22b21d14195ca37d2bd84d486585e4fc8ea`, so its final actual-served C4 browser evidence applies
to the current integration tree without a post-review source delta.

Checks executed directly against the exact integration tree during this audit:

```text
npm ci                                  PASS; 6 packages; 0 vulnerabilities
npm run check:syntax                    PASS; 283 files
npm run check:privacy                   PASS
npm test                                PASS; 1,897/1,897
focused release matrix                  PASS; effective 512/512
npm audit --omit=dev                    PASS; 0 vulnerabilities
git diff --check                        PASS
integration worktree after checks       clean; local/origin 0/0
package version                         1.0.0
tracked tags                            baseline-strava-api-2026-07-28 only
public GitHub Releases API              empty
```

The focused matrix covered Canonical default and Legacy fallback, local-first bootstrap, auth and
Disconnect, Source Manager authorization/connection/provider sync/recovery, bounded provider
connector, Import, V6 migration and stores, format-1/2/3 Backup, Service Worker cache/lifecycle,
root/weather/AI/map/external-runtime/logging privacy, and release docs. Two served tests initially
recorded only sandbox `listen EPERM` at `127.0.0.1`; their exact files then passed 54/54 with isolated
loopback permission, making the focused matrix effectively 512/512. No external provider request or
private evidence was used.

## Current architecture and public-boundary audit

| Boundary | Current exact-tree result | Status |
| --- | --- | --- |
| Default read mode | `DEFAULT_FEATURE_FLAGS.dataRepositoryMode` is `canonical`; hostile or absent overrides fail to the same default | PASS |
| Legacy fallback | Explicit `legacy` and `shadow` modes remain; Legacy database inspection is non-destructive and unknown state fails closed | PASS |
| Repository | Public module remains the fixed factory/error/constants surface; consumers use the seven-method Repository instance contract | PASS |
| Import | Public service supports deterministic import, cancellation and programmatic `retryJob`; Import has no provider/network/DOM/logging/destructive seam | PASS at core; UI retry gap below |
| Storage | IndexedDB `strava-stats-v2` V6, schema `strava-stats-v2@6`, fifteen stores; accepted V1-V5 upgrades are additive, atomic and repeatable | PASS |
| SourceConnection | One exact private Strava slot, immutable subject, legal transitions, revision CAS and disconnected tombstone | PASS deterministic |
| SourceOperation | One privacy-minimal V6 operation row, exclusive Web Lock, owner/heartbeat/90-second lease, explicit stale recovery, no automatic resume | PASS deterministic |
| Backup | Three public exports and four-method service; format 3/V6 current plus narrow format 1/V4 and format 2/V5 additive restore | PASS deterministic |
| Disconnect | Removes provider credentials/revokes when possible and preserves Legacy/V2 libraries; deletion remains separate | PASS deterministic; real account NOT RUN |
| Service Worker | Immutable owned cache, strict static request/response admission, API/query/credential/external bypass, drained-client activation, no unknown-cache enumeration | PASS deterministic; production-like lifecycle NOT RUN |
| Offline truth | Local Canonical browsing/import is local-first; provider, weather, AI and consented map tiles are separate external boundaries; cold first-ever offline is not claimed | PASS as disclosure; environment PARTIAL |

Module import readback recorded these exact public exports:

```text
Repository  REPOSITORY_ERROR_CODE, REPOSITORY_SOURCE, REPOSITORY_WARNING_CODE,
            RepositoryError, createRepository
Import      IMPORT_ERROR_CODE, IMPORT_ITEM_STATUS, IMPORT_JOB_STATUS, ImportError,
            SYNTHETIC_JSON_MEDIA_TYPE, transition helpers, worker/registry/service factories,
            normalizer and synthetic decoder
Storage     STORAGE_ERROR_CODE, StorageError, V2 constants/schema,
            createCanonicalStore, createImportStore, createSourceConnectionStore,
            createSourceOperationStore
Backup      BACKUP_ERROR_CODE, BackupError, createBackupService
```

## R1-R11, D3 and C1-C4 reconciliation

`CLOSED` means the earlier code defect or bounded implementation contract is no longer open in the
current tree and current deterministic evidence passes. It does not close an external evidence gate.

| Item | Current disposition | Current-tree evidence and residual |
| --- | --- | --- |
| R1/R2 DOM and opaque-ID safety | CLOSED | Hostile text/IDs remain native-DOM and encoded-navigation data; current consumer/privacy tests pass |
| R3 tracked identity | CLOSED in current tree | Privacy guard and source audit pass; public-history incident disposition remains external and BLOCKED |
| R4/R5 server/client raw logging | CLOSED for audited production responsibility paths | Fixed server events and redacted client boundaries pass; non-identifying fixed messages/counts remain |
| R6 weather | CLOSED | Ordinary startup is zero-request; session consent gates one rounded point and one date; missing remains missing and real zero remains zero |
| R7 AI Coach | CLOSED | Per-request Gemini preview/consent; bounded aggregates/question only; memory-only key/history; Demo zero I/O |
| R8 map location | CLOSED | Per-map memory-only coarse OSM grant, bounded hosts/zoom/requests, revoke/timeout/navigation closure |
| R9 SW private cache | CLOSED | API, query, credential, navigation and external-feature requests bypass; only approved same-origin static classes are admitted |
| R10 Legacy probe | CLOSED with accepted Option B residual | Zero `deleteDatabase`; unproved presence fails closed; accepted race can leave only an empty V1 shell with zero stores/user records |
| R11 telemetry/CDN | CLOSED | Runtime telemetry unreachable/disabled; visualization assets exact-version, same-origin, integrity checked and no-referrer |
| D3 deterministic SW lifecycle | CLOSED in code | Immutable worker/cache lifecycle and waiting UI pass; native production deployment/update/rollback remains NOT RUN |
| C1 authorization shell | CLOSED | Callback scrub is first capability; exact state/scope, no-referrer and same-tab lifecycle pass |
| C2 identity and Backup | CLOSED | V5 identity store, portable reconnect state and additive format-1/2 restore are incorporated into V6/format 3 |
| C3a/C3b provider mapping/import | CLOSED | Bounded provider DTO reduction maps through versioned RawArtifact and the existing Import pipeline |
| C3c bounded live sync | CLOSED deterministic | Explicit `Sync latest 25`, exact authority/subject/revision gates, bounded concurrency/bytes/time, cancellation and history CAS pass; real provider NOT RUN |
| C4 durable recovery lease | CLOSED for the approved crash-gap contract | One operation fence, explicit stale Recover/Abandon, no automatic action, portable idle Backup and two-tab exclusion pass |

### Browser evidence reuse

- PR #55 final head and the integration squash have the identical tree. Its disposable synthetic
  Chromium evidence for two-tab exclusion, reload/crash, explicit Recover/Abandon, terminal gaps,
  consecutive local batches, provider use of the same lease, active-export refusal and format-3
  restore is valid current-tree evidence.
- The current full and focused Node suites re-read all C1-C4 production sources and browser harness
  contracts. Earlier browser evidence is reused only where the relevant production path is unchanged;
  historical browser claims whose paths were replaced by C4 are not independently promoted.
- This remains disposable Chromium evidence. Safari, Firefox, Windows, iOS/PWA, mobile, broad
  assistive-technology and production-origin Service Worker evidence remain NOT RUN.

## Current-tree P0/P1 findings

### P0-RETRY — user-visible failed-import retry remains absent

**Status: BLOCKED for full v2.0.** PRD sections 4.1, 7.1, 8.3, 13.4 and 13.5 require failed import
work to be retryable and expose retry in progress/report UI. ImportService implements and tests
`retryJob`, but the real Source Manager façade/page never exposes or invokes it. C4 handles a
different crash-gap: stale nonterminal work may be explicitly recovered, while a normally terminal
`failed_validation`, `failed_decode`, or `failed_storage` linked job is explicitly Abandon-only.
The Import Log renders `retryable` facts but has no Retry action.

C1-C4 task language cannot silently replace this higher-authority P0. The owner must choose one:

1. retain the PRD and implement explicit failed-job Retry under the same C4 Web Lock/lease and
   durable atomic-link rules; or
2. formally amend the PRD so terminal failure is intentionally Abandon/reselect-only, with exact
   user impact, recovery semantics and release-owner approval.

Recommendation: retain the PRD and implement the bounded explicit Retry. It must never retry
automatically, must reuse only persisted pending bytes, must preserve completed/committed items,
must not read a provider, and must keep Demo zero-capability.

Exact candidate allowlist for the recommended isolated task:

```text
docs/tasks/pr-45-source-manager-explicit-retry.md
js/app/source-manager-recovery.js
js/app/source-manager.js
js/import/import-service.js
js/pages/source-manager/source-manager.js
js/storage/source-operation-store.js
tests/import/import-core.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/source-manager/source-manager-browser-smoke.html
tests/source-manager/source-manager-recovery.test.js
tests/storage/source-operation-store.test.js
```

Required verification: failure-first normal failed-job UI, reload, two-tab exclusion, lease/CAS
loss, preserved/missing bytes, partial completed items, cancellation, quota/abort, pagehide, Demo,
provider-zero-I/O, current public API/schema boundaries, full gates, disposable synthetic browser,
depth-one and exact-head CI. Rollback is a normal code revert while preserving every Import record,
RawArtifact, Canonical record, SourceOperation and both libraries; never clear or downgrade V6.

### P1-DOCS — release documentation describes a pre-R/C tree

**Status: BLOCKED as release documentation.** Current docs contain materially false current-state
claims even though their tests pass:

- README still says the Strava API card is `Connect later`, while current Sources supports Connect,
  Disconnect and bounded Sync.
- `release-gates.md` says Repository/Storage/Import/Decoder/security/performance tests are not
  implemented, despite the 1,897-test current suite.
- Known Limitations still attributes the fixed `strava-dashboard-v1` policy to the current worker,
  and still lists old raw logging, automatic/exact weather and missing defect-inventory blockers.
- Privacy Guide still calls exact weather location/date and inherited raw server/client logging
  current release blockers, although R4-R6 current tests prove fixed logging and consented rounded
  location.
- The PR-24 ledger still carries the same old SW/privacy/defect inventory. Its docs test explicitly
  requires those stale statements, so a green docs test is evidence of drift rather than accuracy.

Exact candidate allowlist for a separate docs reconciliation after P0-RETRY disposition:

```text
docs/tasks/pr-46-release-documentation-reconciliation.md
README.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
docs/guides/privacy-guide.md
docs/tasks/pr-24-release-documentation.md
tests/docs/release-docs.test.js
```

It must preserve historical evidence while replacing current-state claims, record C1-C4/V6/format
3, retain every external NOT-RUN gate, and never convert synthetic evidence into real/provider/
browser/deployment PASS. Rollback is docs/test-only; restoring false current-state claims is not an
acceptable release rollback.

### Other P1/environmental rows

- Performance remains `PARTIAL`: 5,000 activities and 200,000 points pass; 10,000 activities and
  1,000 FIT throughput remain record-only without an approved absolute budget/waiver. App-shell
  first-interactive, Activities first render and long-task budgets lack complete current evidence.
- Compatibility/accessibility/visual remains `PARTIAL`: disposable Chromium and deterministic
  keyboard/responsive contracts exist, but the published browser/platform and broad manual matrix
  is incomplete.
- No additional current-tree P0/P1 privacy, destructive-data, unauthorized-egress, DOM, raw-log,
  telemetry/CDN, SW-cache, migration, Backup or provider-boundary code defect was found in this
  audit. This statement is bounded to source/static/synthetic evidence and is not a real-data claim.

## Release-gate matrix

Status vocabulary is exactly `PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, and `NOT APPLICABLE`.

### Integration and PR-25 publication

| Gate | Status | Exact evidence or gap |
| --- | --- | --- |
| Exact integration CI | PASS | run `31544200202`, job `93953078352`, every step success |
| Canonical default and Legacy rollback | PASS | current feature-flag, bootstrap, Repository and consumer tests |
| Legacy/V2 isolation and failure preservation | PASS | non-destructive auth/probe, V6 migration and storage suites |
| Cross-PR Repository/Storage/Import integration | PASS | full 1,897/1,897 suite |
| Repeatable migration | PASS | V1-V6 additive/abort/retry/schema-mismatch matrix |
| Safe current diagnostics/errors | PASS | fixed server/client/import/storage/backup error tests |
| PR-25 literal scope | PASS | this Task Brief is the only changed path; recheck before commit |
| Real/private evidence | NOT APPLICABLE | prohibited in this audit PR and separated below |

### Alpha and Beta

| Gate group | Status | Exact evidence or gap |
| --- | --- | --- |
| Baseline tag, maintenance/v1 and Accepted Canonical contracts | PASS | tag exists; main/maintenance remain `fe34535...`; ADR contracts unchanged |
| Repository, V2 isolation, Shadow and Legacy flag | PASS | current deterministic suites |
| Legacy rescue/export/restore | PARTIAL | deterministic contract passes; real Legacy drill NOT RUN |
| Synthetic JSON, CSV, ZIP, FIT, TCX, GPX | PASS | full decoder/import matrix passes |
| Exact duplicate, per-item isolation and local no-Token use | PASS | current Import/Repository/bootstrap suites |
| Source Manager Connect/Disconnect/Sync/Report | PASS deterministic | C1-C4 current tests and exact-tree browser evidence; real provider NOT RUN |
| Failed import Retry from UI | BLOCKED | P0-RETRY above |

### Release Candidate

| Gate | Status | Exact evidence or gap |
| --- | --- | --- |
| Import regression and Exact Identity | PASS | current deterministic matrix |
| Full Backup/new-environment restore | PARTIAL | V6 format 3 and formats 1/2 synthetic browser/tests pass; private real library NOT RUN |
| Duplicate safety | PASS | fuzzy candidates never auto-merge; decisions preserve both activities |
| Summary/detail/Run Plus/NSM | PASS deterministic | current Repository consumer suites |
| Legacy/Canonical parity and Shadow review | BLOCKED | synthetic reports pass; representative private-library review NOT RUN |
| Service Worker update/eviction | PARTIAL | deterministic D3 passes; production-like mixed-version/cold-offline/rollback NOT RUN |
| Performance budgets | PARTIAL | required rows incomplete or lack approved waiver |
| Migration/deployment rollback rehearsal | BLOCKED | combined production-like rehearsal NOT RUN |
| Zero unresolved P0/P1 | BLOCKED | P0-RETRY and P1-DOCS remain; environmental P1 rows are incomplete |

### Production

| Gate group | Status | Exact evidence or gap |
| --- | --- | --- |
| CI, deterministic import/storage/consumer/privacy | PASS | exact integration CI and current local suites |
| Real Disconnect, real imports and private library | BLOCKED | requires authorized private evidence |
| Real parity/Shadow discrepancy sign-off | BLOCKED | requires private-library owner and tolerances |
| Supported browser/platform | BLOCKED | matrix or time-bounded waiver absent |
| Production SW/deployment/full rollback | BLOCKED | deployment authority and rehearsal absent |
| R3 public-history disposition | BLOCKED | privacy/security owner decision absent |
| Accurate release documentation | BLOCKED | P1-DOCS above |
| Version/tag/artifact/deploy/owner approval | BLOCKED | package `1.0.0`, no v2 tag/Release/deployment/approval |

## External decision packages — keep separate

These packages must not be combined with P0-RETRY, P1-DOCS, or each other.

### D1 — real account, private library, Disconnect and parity

Candidate public path: `docs/tasks/pr-48-private-release-evidence.md` only. Private artifacts remain
outside Git. Name the account/library owner, redaction reviewer, retention rule and parity
tolerances. Run real OAuth/reconnect/Disconnect with before/after counts, real FIT/TCX/GPX/ZIP,
Legacy rescue/restore, representative Shadow/parity and discrepancy sign-off. No run may clear,
migrate, overwrite or delete either library.

### D2 — browser/platform support or waiver

Candidate public path: `docs/tasks/pr-49-browser-platform-release-evidence.md` only until scope is
approved. Choose exact Chrome/Safari/Firefox versions, macOS/Windows and retained iOS/PWA/mobile/
assistive-technology claims, or record a narrower time-bounded waiver with owner, reason, expiry and
promotion criteria. Execute import, storage, Backup, Source Manager, detail, offline, keyboard and
responsive evidence in every retained environment.

### D3/D4 — production-like Service Worker, deployment and rollback

Candidate public path: `docs/tasks/pr-50-production-rollout-rollback-rehearsal.md` only until
deployment policy is authorized. Exercise clean install, waiting update, drained clients, multi-tab
old/new states, cold offline, owned-cache eviction, failed deployment and rollback worker. Then run
Feature Flag Legacy fallback, prior deployment, V2 Backup/fresh restore, Legacy startup, Disconnect
and preserved Legacy/V2/settings counts as one rehearsal. `clear-site-data`, broad cache deletion
and database deletion are prohibited.

### R3-H — public Git-history incident disposition

Candidate public path: `docs/tasks/pr-51-public-history-incident-disposition.md` only. A privacy/
security owner must choose retained-history assessment/mitigation, separately authorized coordinated
history remediation, or another incident path. This audit authorizes no value repetition, rewrite,
force-push or branch cleanup.

### D5 — version, tag, artifact and release-owner approval

Candidate public path: `docs/tasks/pr-52-release-artifact-approval.md` only and last. After every
retained stage gate closes, name release, migration, rollback, verification and communications
owners and approve exact stage/version, commit, changelog/date, tag, artifact, checksums/signatures,
deployment target, notes and rollback target. This audit authorizes none of those actions.

## Honest milestone and owner decision package

**Current milestone: still current-tree blocked.** The tree is not honestly Alpha-ready, Beta-ready,
or “v2.0 code-complete but external-gated” because a retained P0 user-visible Retry contract is not
implemented and release documentation materially misstates the current tree. C1-C4 did close the
Connector, bounded Sync and crash-gap recovery core, but they do not erase the distinct failed-job
Retry requirement.

Minimum decision/order:

1. Decide P0-RETRY: retain the PRD and authorize the exact isolated retry package (recommended), or
   formally amend the PRD with explicit Abandon/reselect semantics and owner approval.
2. After that disposition, authorize the exact P1-DOCS reconciliation package so current release
   docs and tests describe the actual R1-R11/D3/C1-C4 tree.
3. Freeze performance thresholds or a time-bounded stage waiver. Keep browser support separate.
4. Authorize D1, D2, D3/D4 and R3-H separately. Only after their results may D5 approve a release
   artifact.

This audit changes no runtime behavior, schema, data, cache, provider, deployment or release state.
Rollback is an ordinary revert of the Task-Brief-only commit. The new audit PR must remain Draft;
Ready, merge, release, deployment, tag and cleanup remain prohibited.
