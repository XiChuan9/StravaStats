# PR-45: Source Manager Explicit Failed-Import Retry

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M33 / P0-RETRY Option A |
| Status | Awaiting material contract decision; implementation blocked |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@1669d1636188184232d76b3c05305496d26ff313` |
| Exact base tree | `d62d29bee122ee2d9abcd76d805309564d91dbe9` |
| Feature branch | `codex/v2/source-manager-retry` |
| Product decision | Retain the PRD requirement and implement isolated explicit user Retry |
| Audit authority | PR #56 final audit Task Brief at `33db355c7e3e7a27ba40d726594750dd99535b5d` |
| Pull request | [#57](https://github.com/XiChuan9/StravaStats/pull/57), OPEN/Draft |

## Authority and sequence

The owner selected P0-RETRY Option A: retain the PRD requirement and implement a bounded explicit
failed-job Retry. The delegated implementation is limited to the literal candidate allowlist and
the product contract actually frozen in PR #56's final audit Task Brief. This Task Brief does not
infer missing API, state-machine, copy, error-code, or durable-operation decisions.

The required sequence is:

1. independently verify the exact base, tree, clean state, remotes, and baseline gates;
2. make this Task Brief the only path in the first commit and open a Draft PR against
   `integration/v2`;
3. revalidate the audit's literal allowlist, behavior, privacy, data, rollback, and verification
   contract against the current tree; and
4. stop before implementation if an exact executable contract is absent or ambiguous.

Draft-to-Ready is authorized only after implementation, all required checks, genuinely independent
findings-first review, fresh no-findings re-review, exact remote-head verification, and exact-head
CI all pass. Ready is not merge authorization.

## Exact-base evidence

The isolated worktree began clean and detached at exact commit
`1669d1636188184232d76b3c05305496d26ff313`, tree
`d62d29bee122ee2d9abcd76d805309564d91dbe9`. A refreshed `origin/integration/v2`
resolved to the same commit and tree, with local/origin divergence `0/0`. The refreshed audit branch
resolved to `33db355c7e3e7a27ba40d726594750dd99535b5d`. `origin` is
`https://github.com/XiChuan9/StravaStats.git`; upstream push remains disabled. The exact suggested
feature branch was absent locally, absent from the remote-tracking refs, and absent from the live
remote before creation.

Executed directly on the exact base:

```text
npm ci                       PASS; 6 packages
npm run check:syntax         PASS; 283 files
npm run check:privacy        PASS
npm test                     PASS; 1,897/1,897
git diff --check             PASS
```

GitHub CLI 2.96.0 is installed, but its configured GitHub credential is invalid. No user browser or
profile may be used to repair authentication. Draft publication must use an available repository
connector or stop as blocked.

The Task-Brief-only first commit is
`121ce2d9e726f274ea3f57d355990b1ba4e1deb5`. Its exact diff is this one new path. The GitHub
repository connector created [Draft PR #57](https://github.com/XiChuan9/StravaStats/pull/57) with
base `integration/v2@1669d1636188184232d76b3c05305496d26ff313` and initial head
`121ce2d9e726f274ea3f57d355990b1ba4e1deb5`. Readback reported OPEN, Draft, unmerged, one commit,
one changed file, and no requested reviewers. PR #56 and historical PR #31 were not modified.

## Audit-frozen Option-A behavior

The final audit records these exact P0 facts and boundaries:

- PRD sections 4.1, 7.1, 8.3, 13.4, and 13.5 retain user-visible failed-import Retry as a P0.
- ImportService already implements and tests programmatic `retryJob`; the real Source Manager
  facade/page does not expose or invoke it.
- The target terminal ImportJob states are exactly `failed_validation`, `failed_decode`, and
  `failed_storage`.
- Retry is explicit user action only. It never runs automatically, at startup, on reload, after a
  crash, from observation, or in the background.
- Retry reuses persisted pending bytes only, preserves completed/committed items, does not read a
  provider, and keeps Demo zero-capability.
- It operates under the same C4 exclusive Web Lock, durable SourceOperation lease/revision CAS,
  heartbeat, cancellation, and no-steal rules.
- Existing normally terminal failed linked jobs remain distinct from C4 stale nonterminal recovery;
  C4's Recover/Abandon crash-gap is not a substitute for failed-job Retry.
- Legacy, Shadow, Canonical, local/provider, persistence-selection, schema V6, Backup format 3,
  public Import/Storage/Repository APIs, dependencies, Worker protocol, and Service Worker contracts
  remain frozen unless expressly included in this package.

The current implementation contract additionally requires all reports and visible failures to be
fixed and redacted: no filename, job/item/artifact/activity/owner ID, hash, raw error or cause, path,
payload, coordinate, health/power value, Token, Authorization material, provider response, or other
identifiable athlete data may reach the DOM, console, or a public report.

## Literal hard allowlist

The audit's exact candidate allowlist is the hard maximum. The audit names
`docs/tasks/pr-45-source-manager-explicit-retry.md`; that authoritative filename is used instead of
the delegation's non-binding suggested filename.

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

No substitute, generated file, fixture, screenshot, dependency, manifest, schema, migration,
Backup, Worker, Service Worker, provider/auth, release, deployment, or historical-PR path is
implicitly allowed. A need for any twelfth path is an immediate stop.

## Data, privacy, and rollback boundaries

- Preserve every Legacy and V2 record, RawArtifact, ImportJob, ImportItem, SourceOperation,
  Canonical record, SourceConnection, setting, and both libraries. Never delete, clear, overwrite,
  downgrade, repair-by-reset, or make Disconnect delete local data.
- Retry may schedule only already-retained durable pending RawArtifact bytes accepted by existing
  ImportService semantics. It must preserve every successful/committed item and exact duplicate or
  review result.
- IDs remain opaque strings. Missing and null remain distinct from true zero.
- Demo constructs no Retry capability and performs no Retry storage, lock, timer, provider, Worker,
  or other I/O.
- No real Token, account, provider call, private activity/file/library, user browser profile, or
  production origin is permitted.
- Rollback is an ordinary code revert. It must preserve every Import record, RawArtifact, Canonical
  record, SourceOperation, and both libraries; V6 must never be cleared or downgraded.

## Required verification matrix

The audit requires failure-first normal failed-job UI, reload, two-tab exclusion, lease/CAS loss,
preserved and missing bytes, partial completed items, cancellation, quota/abort, pagehide, Demo,
provider-zero-I/O, frozen public API/schema boundaries, focused and full gates, disposable synthetic
browser evidence, and depth-one/exact-head CI.

The delegated evidence matrix further requires eligible, ineligible, conflict, cancellation,
reload, and Demo cases in an actual-served disposable synthetic Chromium environment. Interception
must be installed before navigation. Evidence must use only synthetic data and a disposable profile,
must prove zero external/provider requests, and must not be labelled real quota, real account,
production-origin, private-library, or cross-browser evidence.

Minimum local and publication gates:

```text
focused Retry/Import/Source Manager/Storage tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
literal changed-path allowlist
exact data-retention invariants
actual-served disposable synthetic Chromium matrix
independent findings-first review
fresh independent no-findings re-review
true remote depth-one exact-head verification
exact-head CI
```

## Material contract gap found during revalidation

The final audit supplies a literal executable path allowlist and the high-level behavior and
verification boundaries above. It does **not** freeze the following implementation-critical details
that the delegated package says must be copied from that audit:

1. the opaque internal failed-job handle type, creation/lifetime rules, page-to-facade method shape,
   lookup semantics, and reload reconstruction seam that prevents durable job IDs from entering the
   DOM or public reports;
2. the exact safe result/error code and user-visible copy matrix for unavailable, ineligible,
   conflict, quota, cancellation, and generic Retry failures;
3. the exact SourceOperation phase/audit transition used to claim an existing terminal failed job,
   how the existing job is linked without weakening C4's atomic-link invariant, and the precise
   losing-tab/lease-CAS-loss terminal result; and
4. whether Retry eligibility follows only the three terminal job statuses, or also requires at
   least one current `retryable: true` item with retained RawArtifact bytes before the action is
   rendered, including how mixed retryable/non-retryable failed items are reported.

These are observable product, privacy, concurrency, and durable-state contracts. Choosing them from
current implementation details would invent a broader package and could make tests freeze an
unapproved design. They cannot be repaired safely by implementation inference.

## Minimum material decision package

Implementation remains blocked until the owner or higher-authority contract supplies one exact,
internally consistent table covering:

- the opaque handle value domain, ownership, reconstruction, expiry, and exact internal methods;
- eligibility inputs and outputs for each of the three failed terminal job states, no retryable
  items, missing bytes, malformed report, cancelled/warning/success/nonterminal jobs, Demo, and
  coordination unavailable;
- the literal safe code and UI copy for eligible/running/success, unavailable, ineligible,
  conflict, quota/storage, cancelled, and generic failure;
- the SourceOperation claim/link/heartbeat/release/audit transitions for an existing terminal job,
  including revision CAS, simultaneous-tab winner, no queue/no steal, pagehide/reload, cancellation,
  and lease loss; and
- the public-report/DOM redaction proof and exact reload rule without exposing a durable raw job ID.

The decision must explicitly confirm that it fits the eleven-path hard maximum and changes no
public API, schema, Backup format, dependency, Worker, Service Worker, provider/auth, retention, or
terminal-state contract. If any item requires another path or contract expansion, this PR must
remain Draft and blocked.

## Stop conditions

Stop before implementation, Ready, or any broader mutation if:

- the minimum material decision package above remains unresolved;
- any path outside the exact eleven-path allowlist is needed;
- any public API, schema, Backup, dependency, Worker, Service Worker, provider/auth, retention, or
  material retry-state expansion is required;
- evidence would require real credentials, provider/private data, a user browser/profile, or user
  data/cache mutation; or
- an action would merge, auto-merge, clean up, deploy, release, tag, modify a default/protected
  branch, or edit/mark Ready/merge PR #56 or historical PR #31.

## Completion evidence

The Task-Brief-only first commit and OPEN/Draft PR #57 record exact-base verification and the
pre-implementation material decision blocker. No production or test behavior has changed. The PR
must remain Draft and implementation must remain absent until the minimum material decision package
is supplied.
