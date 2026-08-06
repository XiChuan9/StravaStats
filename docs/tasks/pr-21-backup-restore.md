# PR-21: Backup / Restore

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M18 / PR-21 |
| Status | A1 Task Brief; A2 investigation pending |
| Branch | `codex/v2/backup-restore` |
| Base | `integration/v2` at `7c22c85bda85667921db6b0768c9b2f895b00991` |
| Draft PR title | `feat(v2): add full backup and restore` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Investigate and, only after explicit approval of every material contract, implement the PR-21
full-library backup and restore workflow described by the product PRD, development plan, IndexedDB
migration authority, and rollback plan. A user must be able to create a self-contained private
backup of every V2 record needed to reconstruct the local library, validate exact version and
per-file integrity metadata before mutation, and restore it safely in a fresh isolated browser.

Restore must never overwrite or corrupt the current usable library on validation failure, schema
incompatibility, interruption, cancellation, transaction abort, quota failure, or repeated
execution. Legacy storage remains physically separate, readable, and untouched. Disconnecting
Strava and deleting local data remain separate actions.

PR-21 does not start PR-22 diagnostics/performance, PR-23 default switching, Service Worker work,
deployment, release, merge, cleanup, destructive data maintenance, or a broad UI redesign.

## A0 exact baseline evidence

- The assigned isolated worktree began clean and detached at exact SHA
  `7c22c85bda85667921db6b0768c9b2f895b00991`; local `integration/v2`,
  `origin/integration/v2`, and the live remote branch resolved to the same SHA with local/origin
  divergence `0/0`.
- The protected source and long-lived integration worktrees were clean and were not modified.
  The feature branch `codex/v2/backup-restore` was created at the exact base in this isolated
  worktree; no local or remote branch with that name previously existed.
- GitHub PR #26, `feat(v2): add duplicate review workflow`, was verified `MERGED` with squash merge
  commit exactly `7c22c85bda85667921db6b0768c9b2f895b00991`, so the required M17 physical V4 state is present.
- Untouched-base gates passed: `npm ci`; syntax for 217 files; privacy; full suite 1,385/1,385;
  and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, health or power value, account, Token,
  Authorization value, export, screenshot, private fixture, user profile, or user browser state
  was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open
a Draft PR targeting `integration/v2` before investigation results or implementation are
committed. GitHub App write failures are delegated to the control tower without using the user's
browser login or profile. The PR remains Draft through implementation, independent review, and
Final Review Closure. Ready is a later control-tower operation and is never merge authorization.

## Authority and inherited frozen contracts

Conflict order is accepted ADRs, product PRD, engineering plan and release gates, this Task Brief,
then implementation details. The investigation must preserve these already-frozen boundaries:

- physical V4, its thirteen stores and indexes, current version-specific descriptors, migrations,
  transaction behavior, Import and Repository boundaries, and the existing Backup Manifest
  foundation are authoritative current state;
- the backup must contain every V2 record needed to reconstruct the full library, including the
  PRD inventory `manifest.json`, `activities.jsonl`, `sources.jsonl`, `streams/`, `laps.jsonl`,
  `events.jsonl`, `devices.jsonl`, `overrides.jsonl`, `analysis/`, `settings.json`, and `raw/`;
- the manifest records exact backup, physical IndexedDB, Canonical schema, application and relevant
  data-version metadata, record counts, and per-file hashes; validation completes before any
  restore target mutation and incompatible versions never force-restore;
- activity, source, relation, and RawArtifact IDs remain non-empty opaque strings and are never
  numerically parsed, normalized, or defaulted; absent, missing, `null`, real zero, and negative
  zero remain distinct where the existing contract distinguishes them;
- backup and restore preserve RawArtifact binary/media bytes exactly and maintain every internal
  reference, activity graph, source association, import log, duplicate-review record, setting,
  feature flag, user-owned state, override, and analysis snapshot required by current V4;
- failure, interruption, cancellation, crash, quota error, malformed input, hash mismatch, schema
  incompatibility, and repeat restore must leave the current usable library intact;
- no restore may clear existing stores, delete or overwrite an existing database, destructively
  rename/activate storage, or mutate Legacy storage without an explicitly approved recovery and
  rollback contract;
- no raw filenames or paths, Tokens, credentials, provider payloads, routes, GPS points, health
  streams, internal causes, or private identifiers may enter logs, errors, DOM, reports, evidence,
  or PR prose. They may exist only inside the private backup bytes explicitly requested by the
  user;
- no public Repository, Canonical, Import, Backup, or Storage API; physical schema/store/index or
  version; algorithm; dependency; Service Worker; deploy/release boundary; or next-PR scope changes
  without explicit approval.

## A2 read-only investigation gate

Before production or test implementation changes, the evidence package must establish:

1. every current V4 store, index, key path, version-specific descriptor, migration, database-open,
   connection-close, transaction, cursor, and error-mapping contract;
2. every physical record represented by the PRD backup inventory, including which records and
   settings exist, which are absent, how compound/internal references are encoded, and how raw
   binary/media values are currently stored;
3. the existing Backup Manifest call graph and its metadata-only limits, plus all ZIP/archive,
   Strava ZIP import, Source Manager, Storage & Backup, download/upload, Blob, stream, chunk,
   cancellation, and browser capability seams;
4. Legacy rescue, localStorage, feature-flag, user-owned setting, disconnect/delete, Cache Storage,
   and Service Worker boundaries that backup/restore must not cross;
5. exact large-data behavior: whole-buffer versus bounded streaming/chunking, archive and per-entry
   size/count limits, memory amplification, backpressure, cancellation timing, and whether a
   browser implementation can avoid constructing the entire library or archive in memory;
6. evidence-backed comparisons of deterministic ZIP/archive versus another bounded container,
   whole-buffer versus streaming/chunked export, and empty-target restore versus staging database
   plus atomic activation versus direct batched restore;
7. validation order and failure behavior for malformed/accessor/Proxy inputs, traversal names,
   duplicate entries, container bombs, truncated bytes, per-file hash and count mismatch, schema
   incompatibility, quota, transaction abort, interruption/crash/cancellation, non-empty current
   library, idempotent repeat, and new-browser restore;
8. the narrowest UI and runtime seams, the smallest literal cumulative path allowlist, a
   failure-first test matrix, deterministic served-browser evidence plan, privacy impact,
   migration impact, and code/data rollback limits.

The evidence must prove what exists and what is absent. Proposed ADR language and historical
discussion do not freeze an undecided contract.

## Decisions required before implementation

No value below is Accepted by this initial brief. Each material choice must be delegated to the
control tower with authority citations, exact call-graph and storage evidence, A/B/C options,
risks, reversibility, failure behavior, test consequences, and a recommendation. Production and
test implementation remain untouched until A3 approval freezes:

- backup container, deterministic byte rules, path/framing rules, compression policy, entry order,
  timestamps and metadata normalization, filename policy, hash algorithm and exact hashed bytes;
- backup format/schema/application compatibility matrix, version negotiation, validation order,
  maximum entries/sizes/ratios, reference-integrity checks, and safe public error taxonomy;
- export memory model, streaming/chunking and backpressure, cancellation semantics, partial-file
  handling, browser API fallback, and resumability or explicit non-resumability;
- restore strategy: empty-target-only, staging database plus atomic activation, or direct batches;
  exact database naming/activation model; current-nonempty protection; crash/quota/abort recovery;
  staging retention/cleanup ownership; and whether activation needs any schema or public API change;
- repeat-restore idempotency or explicit safe conflict result, restore concurrency, cancellation
  boundaries, and any retry/resume contract;
- exact representation and fidelity rules for every V4 store and record type, binary raw bytes,
  missing/null/zero, opaque IDs, settings, feature flags, user-owned state, and unsupported or
  absent PRD inventory categories;
- Storage & Backup location, Source Manager relationship, download/file-picker UI, accessible copy,
  progress/result presentation, and what the fresh-browser success path opens;
- any new public API, schema/store/index/version, migration, database activation or rename seam,
  dependency, algorithm, destructive/overwrite behavior, or path outside the later approved exact
  literal allowlist.

## Non-negotiable verification and closure

- Freeze the exact literal cumulative path allowlist only after collision audit; any additional
  path pauses implementation and requires approval.
- Add failure-first coverage for deterministic archive bytes and hashes, every V4 record type,
  binary RawArtifact fidelity, missing/null/zero, opaque IDs, hostile inputs, path traversal and
  container bombs, hash mismatch, incompatible schema, current-library protection, transaction
  abort, quota/interruption/cancellation, repeat restore, new-browser restore, privacy, and safe
  redacted errors.
- Use deterministic synthetic data only. Actual served disposable-profile browser evidence must
  inspect storage before and after a real backup download/import, open major restored Canonical
  routes, and prove zero provider/auth/external telemetry plus clean console/runtime and protected
  Service Worker/Cache/Legacy boundaries.
- Run exact-head focused, full, privacy, syntax, diff, depth-1 checkout, and CI gates. Independent
  findings-first review must be followed by failure-first repairs and a fresh no-findings re-review.
- Final Review Closure changes only this Task Brief. Publication, Ready transition, CI observation,
  merge, cleanup, data deletion, deploy, release, and PR-22 remain separate authorization gates.

## A3 literal cumulative allowlist

Not frozen. A2 must perform a collision audit and propose the smallest exact literal path set.
No production or test path is authorized by this initial Task Brief.

## Current authorization boundary

Authorized now: this docs-only Task Brief, its commit and push, Draft PR creation, and read-only A2
investigation. Not authorized now: implementation, test changes, schema/API/dependency changes,
destructive restore, database deletion/overwrite, production Service Worker or deploy/release work,
PR Ready, merge, branch/worktree/task cleanup, user data cleanup, or PR-22.
