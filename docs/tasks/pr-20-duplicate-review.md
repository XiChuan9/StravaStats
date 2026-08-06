# PR-20: Duplicate Review

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M17 / PR-20 |
| Status | Ready for investigation; implementation not authorized |
| Branch | `codex/v2/duplicate-review` |
| Base | `integration/v2` at `a686b19a6f2ab6ecb2c724cc940db3ab5c09eafe` |
| Draft PR title | `feat(v2): add duplicate review workflow` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Investigate and, only after explicit approval of every material contract, implement the PR-20
Duplicate Review workflow described by the product PRD and development plan. Possible or fuzzy
duplicates may become review candidates, but they must remain two intact Canonical activities
until the user explicitly confirms otherwise. PR-19's four exact identities continue to use the
existing Exact Identity Resolver and must not be changed, weakened, rescored, or routed through
fuzzy review.

The planned user surface includes candidate review, an explainable confidence/category,
side-by-side comparison, Confirm same activity, Keep separate, Later, and a durable audit record.
Those labels do not freeze algorithms, thresholds, persistence, merge semantics, source/field
preference, stream handling, rollback, route, DOM, or public APIs. The authority documents do not
yet resolve all of those contracts, so implementation remains prohibited until the investigation
and material-decision gate is complete.

PR-20 does not start PR-21 backup/restore, PR-22 diagnostics/performance, PR-23 default switching,
Service Worker work, deployment, release, merge, cleanup, or a broad UI redesign.

## A0 exact baseline evidence

- The assigned worktree began clean and detached at exact SHA
  `a686b19a6f2ab6ecb2c724cc940db3ab5c09eafe`; local `integration/v2` and
  `origin/integration/v2` resolved to the same SHA.
- The base is the merged PR-19 commit `feat(v2): add exact identity resolver (#25)`, so the exact
  identity dependency is present before PR-20 begins.
- The protected long-lived branches were not modified. The feature branch
  `codex/v2/duplicate-review` was created at the exact base in this isolated worktree.
- Untouched-base gates passed: `npm ci`; syntax for 211 files; privacy; full suite 1,363/1,363;
  and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, health or power value, account, Token,
  Authorization value, export, screenshot, private fixture, user profile, or user browser state
  was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open
a Draft PR targeting `integration/v2` before investigation results or implementation are
committed. GitHub writes are delegated to the control tower; the user's browser login and Chrome
profile are prohibited. Draft remains Draft through implementation, independent review, and
Closure. Ready is a later control-tower operation and is never merge authorization.

## Authority and inherited frozen contracts

Conflict order is accepted ADRs, product PRD, engineering plan and release gates, this Task Brief,
then implementation details. The investigation must preserve these already-frozen boundaries:

- PR-19 exact source ID, provider/external ID, committed RawArtifact SHA-256, and trusted FIT
  session/file identity continue to link exactly and atomically; PR-20 does not alter that resolver;
- fuzzy or possible similarity never authorizes automatic merge, source association, Canonical
  replacement, stream replacement, deletion, or analysis change;
- Canonical, ImportedActivityBundle, RawArtifact, ActivitySource, Import, Storage, Source Manager,
  Repository, Demo, Legacy, default-mode, disconnect, and rollback contracts remain unchanged
  unless a material decision explicitly authorizes the minimum necessary change;
- activity IDs remain non-empty opaque strings and are never numerically parsed, compared,
  synthesized from arithmetic, or defaulted; missing, absent, `null`, and real zero are distinct;
- RawArtifacts, ActivitySources, Import logs, Canonical data, and Legacy data are never deleted or
  overwritten as candidate, merge, rejection, rollback, or error recovery;
- every confirmed action must preserve full provenance, an explainable decision, and a
  non-destructive recovery path before it can be implemented;
- errors, DOM, logs, reports, evidence, review findings, and PR prose must not expose raw IDs,
  hashes, filenames, routes, payloads, causes, Tokens, Authorization values, or private activity
  content.

## Investigation gate

The read-only investigation must produce:

1. the current served Source Manager/Import Report call graph and the narrowest viable Duplicate
   Review composition boundary;
2. current Canonical, ImportedActivityBundle, RawArtifact, ActivitySource, ImportItem/ImportJob,
   ImportStore, Exact Identity Resolver, Storage, Source Manager, and Repository contracts;
3. existing indexes, transactions, candidate/decision storage capability, merge/reversal
   capability, and data-preservation limits;
4. the PRD-versus-development-plan gap for P0/P1, candidate status, confidence/category, Confirm,
   Keep separate, Later, audit, merge, and reversibility;
5. evidence-backed A/B/C options for candidate discovery, persistence, decision application, and
   rollback, including complexity/benchmark evidence where algorithmic or index choices are
   material;
6. false-positive defenses, cross-sport policy, missing-value behavior, deterministic tie-breaks,
   re-review/retry/idempotency/concurrency behavior, and candidate lifecycle;
7. the smallest literal cumulative path allowlist, focused/failure-first test matrix, actual
   served browser evidence plan, privacy impact, migration impact, and code rollback limits.

## Decisions required before implementation

No value below is Accepted by this initial brief. Any material ambiguity must be packaged with
authority citations, call-graph evidence, options, risks, reversibility, tests, and a recommended
choice, then delegated to the control tower while production and test implementation remain
untouched:

- candidate comparison fields, weights, thresholds, confidence values/categories, tie-breaks,
  candidate ordering, cross-sport matching, time window, distance/duration tolerance, missing data,
  and suppression/reappearance rules;
- whether and where MergeCandidate and MergeDecision persist, their exact schema/index/version,
  status lifecycle, retention, uniqueness, concurrency, and import/report association;
- route, public API, Repository/Storage boundary, Source Manager/Import Report integration, review
  UI copy/DOM, pagination, and refresh behavior;
- exact effects of Confirm same activity and Keep separate, including Canonical identity,
  ActivitySource ownership, summary/metadata source preference, streams/laps/events/devices,
  analysis invalidation, audit evidence, and idempotent replay;
- the contradiction between the development plan deferring field-level merge and Unmerge, PRD
  classifying fuzzy review/reversible merge as P1, and PRD P0/state/release language that still
  requires review suggestions and reversible merge behavior;
- the non-destructive reversal available in PR-20 if a confirmed merge changes durable data. If
  the current model cannot make Confirm fully reversible without new schema or a later PR, the
  task must pause rather than implement an irreversible approximation;
- any new schema, store, index, physical version, migration, public API, Canonical contract,
  analysis algorithm, production dependency, provider/auth lifecycle, delete/disconnect behavior,
  or path outside the later approved literal allowlist.

## Initial allowed path

Before the implementation gate, the only writable path is:

```text
docs/tasks/pr-20-duplicate-review.md
```

The A3 decision record must replace this investigation-only scope with one literal cumulative
allowlist before any implementation or failure-first test is edited. Directory globs, whole-tree
manifests, and mutable whole-file hashes are prohibited.

## Prohibited paths and operations

Until A3 approval, every production and test path is prohibited. Throughout PR-20 the following
remain out of scope unless an evidence-backed material decision explicitly says otherwise:

- `package.json`, lockfile, dependency, API/provider/auth, Service Worker, deployment, release,
  backup/restore, diagnostics, global default, Legacy database, delete/clear/downgrade, and user
  browser/profile changes;
- weakening or bypassing PR-19 exact resolution; using similarity for automatic merge; treating a
  missing value as zero; numeric conversion of opaque IDs; destructive Canonical/RawArtifact/
  provenance/Import/Legacy mutation;
- real credentials, provider network, private fixtures, real activity/route/health/power data,
  identifiable screenshots, external telemetry, merge, cleanup, deploy, release, or PR-21 start.

## Acceptance criteria to freeze at A3

The approved A3 record must turn each item into an observable test or explicit Not applicable
statement:

- PR-19 four-signal exact linkage is byte-for-byte behaviorally preserved;
- possible similarity creates at most a deterministic review candidate and never changes either
  Canonical graph before explicit confirmation;
- false-positive and boundary fixtures cover near-but-distinct activities, cross-sport cases,
  missing/null/zero values, opaque IDs, ties, retries, stale candidates, concurrent decisions,
  malformed stored data, and privacy-safe errors;
- Confirm/Keep separate/Later are deterministic, idempotent, explainable, atomic where applicable,
  and preserve all provenance and required rollback evidence;
- Legacy, Demo, Canonical/Legacy feature-flag rollback, Source Manager/Import behavior, public
  Repository, disconnect/delete separation, and local-only privacy boundaries remain safe;
- only deterministic synthetic offline fixtures are used; no private fixture or user browser
  profile is read;
- the actual served browser surface is exercised on an isolated same-origin origin if PR-20 owns a
  browser surface; source inspection, Node-only evidence, and `srcdoc` do not count as browser pass.

## Required checks

Baseline and final minimum gates are:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

A3 must add focused candidate, decision, merge/reversal, boundary, negative, privacy, concurrency,
and actual-browser commands for every approved surface. Final verification also requires a true
depth-1 checkout at the exact implementation/Closure head and exact-head CI. Unrun checks must be
reported as `Not run` and never presented as Pass.

## Rollback, migration, and privacy

No migration or production behavior is authorized by this initial Task Brief. Application
rollback continues to select Legacy through the existing feature flag and deletes nothing. The V2
and Legacy databases remain physically retained. A future approved candidate/decision migration
must be additive, idempotent, observable, abort-safe, explicitly retryable, and must document code
rollback compatibility before it is implemented.

Privacy impact at this stage is documentation only. Future evidence must remain deterministic,
synthetic, offline, local-only, and redacted. No new telemetry or external data flow is authorized.

## Independent review and Closure

After implementation, an independent findings-first reviewer must inspect the complete approved
diff and tests. Every finding is reproduced failure-first where feasible, repaired, and followed
by a fresh independent re-review. The final Task Brief-only Closure commit records exact paths and
contracts, false-positive defenses, reversibility, tests, browser evidence, privacy, migration,
rollback, commit/PR/CI state, clean worktree/index counts, and every `Not run` item. The control
tower owns the final Ready transition; Ready is not merge authorization.
