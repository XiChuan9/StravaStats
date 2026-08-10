# PR-43b: Versioned Provider Artifact Import

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M27 / C3b provider artifact to existing ImportService integration |
| Status | A1 Task-Brief-only publication in progress; implementation not authorized |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@e28a047c21ad4bd6f92fdfe368f94593e6c9f80a` |
| Exact base tree | `a9a92bf7ce7cae98711cb5ab5a06619168923eb4` |
| Feature branch | `codex/v2/provider-artifact-import` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/2e78/StravaStats` |
| Parent decision | `D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A` |
| Completed prerequisite | C3a / merged PR #50 at the exact base |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce a findings-first, materially complete owner decision package for C3b. The selected direction
uses a deterministic, versioned provider artifact to carry C3a `ImportedActivityBundle` values into
the existing public `ImportService` pipeline. It must not create a parallel persistence path.

This first commit creates only this Task Brief. A2 is read-only except for updates to this same file.
No decoder, registry, Import, Storage, schema, public API, Worker, provider, auth, UI, dependency, or
test implementation begins until the owner approves every material item and an exact literal path
maximum.

## Authority and boundary

The owner approved the parent C3 choices:

> D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A

For C3b, `D-C3.2 B` freezes the direction only: a deterministic versioned provider artifact enters
the existing ImportService pipeline. It does not freeze the artifact contract or authorize its
implementation.

The authoritative baseline is merged PR #50 at
`integration/v2@e28a047c21ad4bd6f92fdfe368f94593e6c9f80a`. C3a remains pure: injected synthetic
authority plus C2 `SourceConnection`, exact scopes, reduced provider envelopes, at most 100
activities, bounded series/laps, and no Token, Storage, network, or Import side effects.

This task does not authorize C3c live activation, C4 recovery, OAuth, Token access, a provider
request, a real account, private activity data, user browser/profile use, Ready, merge, cleanup,
deployment, or release.

## Global invariants

- Reuse the existing public ImportService and V5 contracts. No page, mapper, connector, or analysis
  module may choose persistence or write Canonical records directly.
- Preserve Legacy and V2 data. No migration shortcut, delete, clear, overwrite, cleanup, or
  reinterpretation of existing provenance is allowed.
- Missing and null never become zero. True zero and negative zero remain distinct wherever the
  accepted contracts require that distinction. Activity IDs remain opaque strings.
- `ActivitySource` provenance and the authenticated `SourceConnection` identity are distinct facts.
  C3b must not weaken or invent their linkage.
- Artifact bytes, validation, decoding, normalization, hashing, duplicate handling, cancellation,
  quota, retry, reporting, and error redaction must be deterministic, bounded, and failure-first.
- Synthetic fixtures and browser evidence are deterministic inventions. No credential, Token,
  authorization header, real provider response, precise GPS track, health/power record, private
  error, or identifiable athlete data enters Git, CI, diagnostics, logs, DOM, or artifacts.
- Public APIs, schema, Backup format, algorithms, dependencies, Worker, Service Worker, server,
  provider, and auth boundaries remain unchanged unless a later owner-approved material package
  proves a minimum expansion unavoidable.
- No implementation path outside the owner-approved literal maximum may be edited. A collision or
  required extra path stops the tranche and returns a new minimum decision.

## A0 exact-base and untouched-gate evidence

- The isolated worktree began clean and detached at exact commit
  `e28a047c21ad4bd6f92fdfe368f94593e6c9f80a`, tree
  `a9a92bf7ce7cae98711cb5ab5a06619168923eb4`.
- The feature branch `codex/v2/provider-artifact-import` was created at that exact commit. The
  integration worktree was not opened or modified.
- `origin` is `https://github.com/XiChuan9/StravaStats.git`; upstream push is disabled.
- The delegated baseline records successful integration-push CI run `31441255627`, job
  `93626250720`, and an independently clean integration worktree with syntax 269 and full
  1764/1764 tests. Those facts are baseline context, not a claim that this feature head has passed.
- Local A1 gates passed on the one-file working-tree diff: `npm ci`; syntax for 269 files;
  privacy; full `npm test` 1764/1764; and `git diff --check`. The first full test attempt had one
  timing-sensitive failure in `tests/legacy/legacy-cache-rescue.test.js` (1763/1764); the focused
  file immediately passed 59/59 and the required full rerun passed 1764/1764. No product source or
  test was changed. Exact-head CI is recorded only after it actually runs.
- GitHub CLI 2.96.0 is installed, but its local credential is invalid. No interactive login, Chrome,
  or user browser profile may be used. Draft creation should use the GitHub App; an App write failure
  is returned to the control tower as an exact Draft-only write request.

## A1 publication contract

The first commit and initial Draft PR diff contain exactly:

```text
docs/tasks/pr-43b-provider-artifact-import.md
```

Draft PR title:

```text
feat(v2): import versioned provider artifacts
```

Draft PR body:

```markdown
## What changed

Adds the C3b Task Brief for a deterministic versioned provider artifact entering the existing ImportService pipeline.

## Why

The owner selected D-C3.2 B, but artifact bytes, identity, provenance, duplicate, validation, cancellation, quota, retry, reporting, and boundary effects require a separate frozen material package before implementation.

## Impact

Docs only. No Import, Storage, schema, Backup, public API, Worker, dependency, provider/auth, Token, network, UI, migration, or user-data change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
A1.

## A2 findings-first audit

A2 must read the exact current code, tests, and accepted documentation before recommending a
contract. It must establish:

1. the exact C3a mapper output and `ImportedActivityBundle` validator behavior;
2. `ImportService`, `ImportJob`, `ImportItem`, `RawArtifact`, decoder registry, normalization,
   Repository, and Worker call graphs and public/internal seams;
3. raw-artifact identity and hashing, exact duplicate detection/reselection/resolution semantics,
   and deterministic job/item ordering;
4. V5 `SourceConnection`, `ActivitySource`, and Canonical provenance semantics, including whether
   the current contracts can carry the required connection linkage without schema/public expansion;
5. Backup format 2, restore compatibility, browser storage migration, quota, transaction,
   cancellation, retry, error, redaction, and rollback boundaries;
6. Source Manager integration, public exports, dependencies, Service Worker, server, privacy guard,
   CSP, and browser-runtime boundaries; and
7. current test topology and every literal-path collision candidate.

Historical summaries are not evidence. Findings must precede the frozen package.

## Required material decision package

The A2 update must freeze one complete package, with mutually exclusive alternatives wherever the
current contracts leave a material choice:

- exact artifact format name, version, media type, byte representation, canonical encoding, and
  per-artifact/per-job activity, byte, series, lap, and nesting limits;
- mapping of one or many C3a bundles to artifacts, jobs, and items, including ordering, item labels,
  identity, digest, duplicate, conflict, and reselection semantics;
- exact `SourceConnection`/`ActivitySource` provenance linkage and its validation authority;
- artifact validation, decoder, bundle revalidation, normalization, Repository-write, and internal
  versus public API boundaries;
- cancellation checkpoints, quota preflight/failure, transaction/atomicity, partial-result,
  retry/resume/reselection, report ordering, and safe error codes;
- treatment of missing, null, true zero, negative zero, unsafe numbers, opaque string IDs, unknown
  fields, future versions, malformed bytes, duplicate keys, and hostile values;
- schema, migration, Backup format 2, public API, Worker, dependency, Service Worker, server,
  provider/auth, Source Manager, and C3c/C4 effects;
- exact redaction rules so no artifact byte, private field/value, identifier, file name, provider
  response, Token, or path leaks through errors, logs, reports, diagnostics, or DOM;
- a collision-audited literal candidate allowlist and exact hard maximum with no implicit extra
  path; and
- failure-first automated tests, actual-served disposable synthetic browser evidence, independent
  review plan, migration/data/privacy/rollback impact, and exact C3b completion gates.

If the existing contracts cannot carry required `SourceConnection` provenance without public or
schema expansion, A2 stops with a precise mutually exclusive A/B/C owner decision. It must not
weaken provenance or infer authority.

## Required verification

For A1 and the later Task-Brief-only A2 head:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

After A2, publish the Task-Brief-only head, verify the true remote depth-1 exact head and exact-head
CI, and keep the PR open and Draft. Browser evidence is not claimed unless it actually runs against
the exact relevant head from an actually served local origin and a disposable synthetic profile.

## Stop condition

Stop after publishing the complete A2 decision package. No implementation starts before the owner
approves every material item and the exact literal path maximum. Do not Ready, merge, clean, deploy,
release, use real provider/account/Token/private evidence, make a provider request, or start C3c/C4.
