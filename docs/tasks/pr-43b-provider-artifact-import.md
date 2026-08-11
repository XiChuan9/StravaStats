# PR-43b: Versioned Provider Artifact Import

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M27 / C3b provider artifact to existing ImportService integration |
| Status | C3b-P1 implemented and independently closed; exact-head publication/CI verification pending |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@e28a047c21ad4bd6f92fdfe368f94593e6c9f80a` |
| Exact base tree | `a9a92bf7ce7cae98711cb5ab5a06619168923eb4` |
| Feature branch | `codex/v2/provider-artifact-import` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/2e78/StravaStats` |
| Parent decision | `D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A` |
| Completed prerequisite | C3a / merged PR #50 at the exact base |
| Pull request | [Draft PR #51](https://github.com/XiChuan9/StravaStats/pull/51), open against `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |
| Owner approval | `批准 C3b-P1 及完整合同和精确 16 路径上限` |

## Goal

Implement the owner-approved C3b-P1 package: a deterministic, versioned provider artifact carries
C3a `ImportedActivityBundle` values into the existing public `ImportService` pipeline without a
parallel persistence path.

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

### A1 publication readback

- First commit `ce80d6c41d83966b9477b1eb118936c8ed0dbfcf` contains exactly this Task Brief.
- The branch was pushed normally. GitHub App creation succeeded and assigned open Draft PR #51.
- App readback reported exact base `e28a047c21ad4bd6f92fdfe368f94593e6c9f80a`, exact head
  `ce80d6c41d83966b9477b1eb118936c8ed0dbfcf`, one commit, one changed file, 200 additions, Draft
  true, merged false, and the exact requested title/body. No reviewer, label, assignment, Ready,
  merge, or other PR write was made.

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

## A2 findings first

### C3b-F1 — C3a output is accepted Canonical data, not an artifact

- C3a returns a frozen dense array of zero through 100 accepted bundles in input order. Each bundle
  has exactly one Strava source with deterministic activity/source IDs, opaque positive-decimal
  external ID, `acquisitionMethod: strava-api`, the injected `acquiredAt`, and
  `rawArtifactId: null`. Its normalizer version is `strava-import-mapper@1`.
- C3a validates an exact connected C2 snapshot and exact `read`, `activity:read_all` scopes before
  provider-record inspection, but it deliberately does not retain session scopes, Token material,
  connection revision, or subject in the returned bundle.
- Per-series 200,000-point and per-activity 10,000-lap bounds do not bound encoded artifact bytes:
  opaque string length and the number of present bounded series still affect bytes. C3b therefore
  needs its own byte/node/depth limits and may explicitly reject an otherwise accepted C3a bundle;
  it must never truncate it.

### C3b-F2 — ImportedActivityBundle cannot hold a direct connection relation

- The accepted exact `ActivitySource` fields are `id`, `activityId`, `provider`, optional
  `externalId`, optional `rawArtifactId`, `acquisitionMethod`, optional `deviceId`, and `importedAt`.
  There is no `sourceConnectionId` and unknown fields produce contract warnings.
- C2 explicitly froze `ActivitySource` as provenance rather than authenticated identity. It also
  recorded that interpreting every `provider: strava` source as account ownership is invalid and
  that a direct relation changes the accepted Canonical contract and collides with C3.
- The current single C2 slot is exact `source-connection:strava`, immutable provider/subject, and a
  retained tombstone. A durable artifact can therefore name that slot explicitly and be reached by
  the existing `ActivitySource.rawArtifactId`; this is an audit-provenance chain, not a direct
  Canonical relation or proof that current credentials exist.

### C3b-F3 — the existing public ImportService is the only authorized write path

- Public Import exports and the service surface are frozen. `createImportService` exposes
  `initialize`, `importArtifacts`, `cancelJob`, `retryJob`, `getReport`, `previewActivities`,
  `waitForJob`, and `close`; the Repository has no import write method.
- `importArtifacts` accepts a dense nonempty array of exact `{ mediaType, content }` data, snapshots
  it before job creation, creates one job plus one item per expanded artifact, hashes UTF-8 content,
  stores the RawArtifact, dispatches the Worker registry, normalizes, exact-matches, and calls the
  storage-owned per-item transaction seam.
- The current six accepted media types do not include a provider artifact. Import Core's nested
  instructions also freeze the older PR-09 format set, so an approved C3b implementation must make
  one narrow documented exception in `js/import/AGENTS.md`; silently bypassing it is not allowed.

### C3b-F4 — normalization already supplies the correct RawArtifact reference

- A decoder returns a detached decoded bundle. `normalizeImportedActivity` clones it, replaces every
  source `rawArtifactId` with the digest-derived RawArtifact ID, revalidates the complete bundle, and
  returns a frozen copy. C3b does not need a second normalizer or Canonical write path.
- A strict provider decoder can return the C3a bundle with its required null artifact reference;
  normalization then makes the durable reference exact. Adding an artifact ID earlier would either
  duplicate hashing or trust caller-supplied identity.

### C3b-F5 — current raw persistence is truthful only for local files

- RawArtifact identity is `raw:<lowercase SHA-256 of exact UTF-8 content>`. The stored record has
  exact content, media type, byte length, import time, `state: pending|committed`, nullable activity
  ID, and currently hard-coded `acquiredVia: local-file`.
- The Import Store exact validator and Backup format-2 validator both allow only the existing six
  media types and `local-file`. Recording a generated provider artifact as a local file would be
  false provenance. The minimum truthful internal expansion is the exact new media type paired only
  with source-neutral `acquiredVia: provider-artifact`.
- No physical IndexedDB descriptor changes: the V5 RawArtifact object already stores strings and the
  record field set is unchanged. No V6 migration, store, index, public Storage export, or database
  repair is needed.

### C3b-F6 — exact duplicate and reselection semantics already exist

- Identical canonical bytes have one SHA-256 identity. A committed existing RawArtifact ends the
  new item as `skipped_exact_duplicate` before decode; a pending existing artifact is reused and
  continues through decode/persist.
- Different bytes for the same Strava provider/external ID reach exact identity resolution. They
  link the new artifact/source to the existing Canonical activity without overwriting its Canonical
  payload. If the deterministic C3a source ID already exists with different import time/artifact,
  the existing resolver uses `exact-source:<rawArtifactId>:<index>`.
- Agreeing raw/source/external signals select one target. Conflicting exact signals fail the entire
  item transaction. Fuzzy matches create bounded review candidates; no automatic merge occurs.
  Canonical opaque IDs are never numerically normalized.

### C3b-F7 — Import atomicity is per item, not per job

- Job/items creation is one transaction. Raw storage and item association are one transaction.
  Canonical graph, source/artifact link, item/job audit update, and duplicate candidates are one
  per-item transaction. A failed item does not undo prior successful items in the same job.
- Quota while storing raw content leaves no partial raw/item association; quota during Canonical
  persistence rolls back that item. The service then marks remaining viable items failed-storage
  best-effort and the job failed-storage. No path clears successful data.
- C3b cannot promise all-or-nothing for 1–100 activities without replacing the existing pipeline.
  The selected package keeps truthful existing per-item atomicity and reports partial outcomes.

### C3b-F8 — cancellation and retry are checkpointed and explicit

- Active cancellation is observed between validation, hashing, decode, normalization, matching, and
  persistence work. It cannot interrupt an already-running digest, Worker decoder call, or IndexedDB
  transaction. A checkpoint cancels unfinished items while retaining successful items and stored
  pending artifacts.
- Cancelled items are terminal and non-retryable. `retryJob` is allowed only for a failed job with at
  least one retryable item and a retained artifact; it reuses exact stored bytes and increments job
  retry count. Malformed provider bytes are non-retryable. Worker/storage transient failures may be
  retryable under the existing fixed codes.
- Reselection means an explicit new `importArtifacts` call. The same pending bytes resume through a
  new job; corrected/different bytes receive a new hash. There is no hidden retry, timer, sleep,
  resume daemon, or C4 ownership claim.

### C3b-F9 — reports and failures are already redacted

- Public reports contain schema version, aggregate counts, job status, and per-item ordinal,
  outcome, fixed code, and retryable boolean. They contain no job/item/artifact/activity ID,
  connection, subject, filename, content, or raw cause.
- Existing Import codes cover the new path without expanding the public error enum:
  `INVALID_REQUEST`, `UNSUPPORTED_FORMAT`, `FILE_EMPTY`, `FILE_CORRUPTED`, `HASH_FAILED`,
  `HASH_COLLISION`, `NORMALIZATION_FAILED`, `WORKER_CRASHED`, `STORAGE_UNAVAILABLE`,
  `STORAGE_QUOTA_EXCEEDED`, `EXACT_IDENTITY_CONFLICT`, `IMPORT_CANCELLED`, `NOT_FOUND`, and
  `RETRY_NOT_ALLOWED`.
- Decoder results are reduced to code/retryable. Import, Storage, and Backup errors have fixed
  messages and retain no input/cause. Source Manager allowlists displayed codes and otherwise uses a
  fixed fallback.

### C3b-F10 — Backup format 2 can carry the new records without a new format

- Format 2 already stores all V5 RawArtifact bytes, ActivitySources, Import jobs/items, and the
  portable SourceConnection row in deterministic tagged JSONL. It recomputes every RawArtifact
  digest during validation and preserves negative zero.
- The entry list, manifest version, record field set, and store set need not change. The minimum
  change is strict format-aware validation: format 1/V4 must continue rejecting provider artifacts;
  format 2 may accept only the exact provider media/acquired-via pair, canonical provider bytes, and
  an existing matching `sourceConnectionId` row. Connected/error still restore as
  reconnect-required with the immutable slot identity retained.
- Pending provider artifacts may have no ActivitySource. A committed one must retain its current
  RawArtifact/activity/source references. Restore never creates a connection from provider bytes,
  infers a subject, or restores credentials.

### C3b-F11 — Source Manager, C3c, C4, and connection state stay separate

- The actual composition root is `js/app/source-manager.js`. It constructs the public
  ImportService, browser Worker, and Import Store; the page receives only a façade. Its C1 connection
  controller remains `authorization_unavailable` and reads no C2 store.
- C3b adds no UI or application activation. A later C3c orchestrator may directly import the
  internal artifact builder after successful C3a mapping and pass its exact descriptors to the
  existing public `importArtifacts` method.
- C3b does not transition SourceConnection or advance `lastSyncAt`. C3c may propose a separate
  post-report transition only after defining partial-success, CAS, cancellation, and recovery
  semantics. C4 remains the owner/lease recovery tranche.

### C3b-F12 — no dependency, server, Service Worker, or live-provider change is needed

- The existing Worker message/result shapes can dispatch one additional pure decoder. No new Worker
  constructor, transferable, thread, protocol field, or fallback is needed.
- No package dependency is needed: exact canonical JSON can be encoded internally with code-unit key
  order, descriptor-safe traversal, finite JSON numbers, and literal `-0` handling. Decode re-encodes
  and byte-compares, rejecting whitespace, duplicate keys, alternate number spelling, malformed
  UTF-8-equivalent strings, and noncanonical order.
- The current Service Worker policy already treats same-origin JavaScript as static and provider/API
  requests as bypass-only. C3b adds no precache entry, cache name, lifecycle, route, CSP, server API,
  Token/auth module, provider request, page, or aggregate public export.

## D-C3b.1 — mutually exclusive provenance decision

Choose exactly one. No choice by itself authorizes implementation.

### C3b-P1 — artifact-bound SourceConnection provenance (recommended)

Keep the accepted Canonical schema unchanged and freeze this durable audit chain:

```text
ActivitySource.rawArtifactId
  -> RawArtifact.id / immutable canonical content
  -> provider artifact sourceConnectionId
  -> exact V5 SourceConnection.id
```

The artifact builder accepts a complete connected C2 snapshot, validates it exactly, but serializes
only the fixed connection ID—not subject, revision, status, last-sync, scopes, Token, or session.
The row named by the ID retains the private immutable subject. The provider artifact and Backup
validators require the exact fixed ID and format-2 requires the referenced connection row.

This is explicit artifact provenance. It is not authenticated account ownership, a credential
backup, proof of current authorization, or a direct ActivitySource foreign key. Existing file/archive
Strava sources remain unbound. This option preserves accepted ADR-0006 and current schema/public
surfaces. Architecture risk: **medium**; privacy risk: **low-medium** because no subject is duplicated;
product risk: **medium** until C3c supplies the authoritative live orchestration.

### C3b-P2 — direct ActivitySource-to-SourceConnection relation

Add `sourceConnectionId` to provider-origin ActivitySource or a new relation store. This is the only
choice if the owner requires a direct Canonical ownership relation rather than P1's artifact audit
chain. It changes an accepted contract, bundle/mapper validation, Canonical schema/versioning,
Storage preparation and identity/link logic, Backup references, public/schema evidence, and the
treatment of existing unbound file/archive provenance.

P2 is **not implementation-ready** in this PR. Selecting it authorizes only a separate findings-first
ADR/schema/public collision package; it supplies no path maximum and therefore cannot authorize an
edit. No existing record may be backfilled or inferred. Architecture/collision risk: **very high**.

### C3b-P3 — defer durable provider import

Keep C3a pure and do not create provider artifacts or Import jobs until a later ownership model is
selected. This makes no product/test change and uses only this Task Brief to record the deferral.
Architecture risk: **low**; P0 completion risk: **high**.

## Frozen C3b-P1 material package

The rest of this package applies only if the owner selects P1 and separately approves its exact
sixteen-path hard maximum.

### Owner implementation authorization

The owner selected C3b-P1 and approved the complete frozen contract plus the exact cumulative
sixteen-path hard maximum with the exact response quoted in Metadata. This authorizes implementation
only inside the listed paths. It does not authorize a substitution, seventeenth path, Ready before
all closure gates, merge, cleanup, deployment, release, C3c, C4, or live/private evidence.

### Exact format, encoding, and bounds

One C3a bundle maps to exactly one provider artifact and one ImportItem. One nonempty C3a mapping run
maps in the same order to one `ImportService.importArtifacts` call, one ImportJob, and 1–100 items.
Zero bundles create no artifact or job and are reported by the later caller as a no-op; mixed provider
and local-file artifacts in one call are invalid.

Exact media type:

```text
application/vnd.stravastats.strava-provider-artifact+json;version=1
```

Exact decoded top-level shape:

```js
{
  format: 'stravastats-provider-artifact',
  formatVersion: 1,
  provider: 'strava',
  sourceConnectionId: 'source-connection:strava',
  bundle: ImportedActivityBundle
}
```

Every field is required; no extra/symbol/non-enumerable/accessor field is accepted. The content is a
UTF-8 JavaScript string containing compact canonical JSON: object keys sort by UTF-16 code-unit order;
arrays retain dense order; strings use JSON escaping; null/boolean/string remain exact; finite
numbers use exact JSON spelling except negative zero is the literal JSON number `-0`. Decode uses
`JSON.parse`, strict ordinary-data inspection, canonical re-encoding, and exact UTF-8 byte equality.
Thus absent stays absent, null stays null, `0` stays `0`, `-0` round-trips as negative zero, and opaque
strings never enter a numeric conversion. Duplicate keys, whitespace, alternate escaping/order/
number spelling, non-finite data, sparse arrays, special prototypes, accessors, symbols, cycles, and
hostile Proxies fail closed.

Hard limits are exactly:

```text
artifacts per provider job     1..100
UTF-8 bytes per artifact       1..33,554,432 (32 MiB)
UTF-8 bytes per provider job   1..33,554,432 (32 MiB total)
canonical traversal depth      <= 16 containers
canonical traversal nodes      <= 5,000,000
sources per bundle             exactly 1
devices/events per bundle      exactly 0 / exactly 0
stream series per bundle       <= 10
points per series              <= 200,000 (inherited C3a)
laps per bundle                <= 10,000 (inherited C3a)
```

Limits are checked by the builder before it returns any descriptor and rechecked by ImportService
before job creation. The decoder repeats artifact/shape/bundle bounds before returning. The 32 MiB
per-job ceiling reuses the current Source Manager ordinary-job memory budget. A larger valid C3a
bundle fails as `LIMIT_EXCEEDED`; C3b does not truncate, split one activity, or silently widen the
budget. Raising it is a new material decision.

### Exact builder and decoder boundary

The new direct internal module `js/import/strava-provider-artifact.js` exports exactly:

```text
STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
STRAVA_PROVIDER_ARTIFACT_LIMITS
STRAVA_PROVIDER_ARTIFACT_ERROR_CODE
StravaProviderArtifactError
createStravaProviderArtifacts
stravaProviderArtifactDecoder
```

It is deliberately absent from `js/import/index.js`; the public Import aggregate stays exact. The
builder input is exact `{ connection, bundles }`. `connection` must be a complete C2 record for the
fixed slot/provider, positive-decimal subject, connected/null-error status, strict nullable last-sync,
and positive safe revision. `bundles` is a dense 1–100 array.

Each bundle must pass `validateImportedActivityBundle` with no validator-generated unknown-field
warning and the exact C3a profile: schema 1; one deterministic Strava source; positive opaque external
ID; matching `strava-api:<E>` activity ID and `strava-api-source:<E>` source ID; null raw/device ID;
`strava-api` acquisition; strict import time; no devices/events; the exact C3a warning allowlist;
and `strava-import-mapper@1` normalizer with other C3a version fields null. The builder never mutates
or trusts object methods and returns a deeply frozen descriptor array.

Internal builder errors are exactly `INVALID_REQUEST`, `CONNECTION_REQUIRED`,
`PROVENANCE_MISMATCH`, `BUNDLE_INVALID`, and `LIMIT_EXCEEDED`. They serialize only frozen name, code,
fixed message, fixed stage, nullable nonnegative ordinal, and `retryable: false`. No value, ID,
subject, content, path, cause, or stack serialization is retained.

The Worker registry adds only the exact decoder. Wrong media is `UNSUPPORTED_FORMAT`, empty content is
`FILE_EMPTY`, and every malformed/noncanonical/version/provenance/bundle failure is the existing
non-retryable `FILE_CORRUPTED`. The Worker returns only the existing reduced result. The existing
normalizer then injects the computed RawArtifact ID and revalidates.

### Identity, duplicate, reselection, and provenance semantics

- Raw identity is SHA-256 of exact canonical UTF-8 content; item ordinal equals C3a bundle order.
- Exact repeated bytes use existing pending-reuse/committed-skip behavior. No decode result changes
  RawArtifact bytes and no hash is computed from a parsed object.
- Different bytes with the same provider/external ID use the current exact-link path and preserve the
  original Canonical payload. Multiple exact targets fail `EXACT_IDENTITY_CONFLICT`; fuzzy matches
  remain review-only.
- The new stored RawArtifact pair is exactly the new media type plus
  `acquiredVia: provider-artifact`. Existing media types remain paired only with `local-file`.
- The decoded artifact must name the fixed connection slot, but neither ImportService nor the
  artifact is an authentication authority. Only a later C3c caller may create descriptors after C3a
  authorization. The persisted link is audit provenance and never substitutes for current
  connection/session/Token validation.
- No SourceConnection is created, changed, inferred, or deleted. `lastSyncAt` and revision remain
  unchanged in C3b.

### Validation, cancellation, quota, retry, and reporting

All-or-nothing preflight applies only before job creation: an invalid descriptor, mixed media,
count/byte/node/depth overflow, or builder failure creates no job, item, raw record, or Canonical
record. Once the job exists, the existing per-item state machine and transaction boundaries are
authoritative; successful items survive later failures/cancellation.

Cancellation is observed at existing checkpoints, never claims mid-digest/Worker/transaction abort,
and retains successful or already stored data. Cancelled items are not retried. Explicit retry uses
retained exact bytes only for existing retryable failed jobs. Structural/version/provenance failures
are non-retryable; correction is a new selection/job. Quota uses existing rollback and fixed
`STORAGE_QUOTA_EXCEEDED`; no cleanup or deletion follows.

Public job/item reports retain existing schema/order and codes only. No provider-specific report
field, source/connection/artifact/activity ID, filename, content, or subject is added. Job outcomes
remain truthful: all preflight-invalid inputs fail before a job; item failures in a viable job may
produce completed-with-warnings; quota may terminalize failed-storage; exact byte duplicates are
skipped; exact links complete; fuzzy matches are review-required.

### Backup, migration, public API, Worker, and other effects

- **Schema/migration:** no physical or Canonical schema/version change, store/index/field addition,
  migration, backfill, or repair. The RawArtifact field set is unchanged; only one exact internal
  media/acquired-via pair is added.
- **Backup:** format 2 remains 18 entries and exact version 2/V5. It preserves canonical provider
  bytes, recalculates their hash, validates the connection ID reference, and restores the portable
  connection row without credentials. Format 1 rejects the new media/acquisition pair. No codec or
  public Backup export change.
- **Public:** `js/import/index.js`, `js/storage/index.js`, Backup index, Repository, data-contract
  exports, Source Manager façade, and application feature flags stay exact. The new module is an
  internal direct seam for the later orchestrator.
- **Worker:** one registered pure decoder only; message/result protocol and worker-client surface stay
  exact. Worker crash behavior remains retryable and redacted.
- **Dependencies/SW/server/provider/auth:** no package/lock, Service Worker, server, CSP, page, Source
  Manager, mapper, connector, Token/auth, route, or network change. No real account/provider evidence
  is needed or permitted.

### Exact safe redaction

Builder/decoder/Import/Storage/Backup code must never log or retain a raw error/cause. Fixed public or
serializable errors may contain only approved code/message/stage/retryable and nullable ordinal.
Reports/diagnostics/DOM/console must not contain artifact content/bytes/hash, provider field/value,
connection ID/subject/revision, activity/source/external ID, import time, GPS/health/power values,
filename/path, Token/header/scope, provider error/URL, or private canary. Raw bytes remain only in the
RawArtifact store and user-created private Backup. Tests assert negative disclosure with synthetic
canaries; the global privacy guard remains authoritative.

## Failure-first evidence plan for C3b-P1

1. Add a failing focused test before production code because the direct provider-artifact module is
   absent. Freeze exact exports, exact media/shape/encoding, no aggregate export, and import-time zero
   I/O.
2. Cover descriptor safety; connection state/identity; zero/one/100/101 bundles; deterministic order;
   exact 32 MiB and +1 byte; depth 16/17; node 5,000,000/+1 using bounded generators; hostile
   accessors/Proxies/prototypes/symbols/cycles/sparse arrays; and no partial descriptor return.
3. Cover canonical key/string/number encoding, duplicate keys, whitespace/reorder/escape/number
   alternatives, malformed JSON, future/wrong format, missing/extra fields, and direct plus decoded
   preservation of missing/null/0/-0/opaque IDs.
4. Cover every exact C3a provenance relation and warning/version field; fabricated local/archive/
   multi-source/device/event bundle; mismatched deterministic IDs/provider/acquisition/connection;
   rawArtifactId already present; validator warning/error; mutation; freeze; repeat byte identity; and
   fixed redacted errors.
5. Traverse the actual Inline and browser Worker, public ImportService, real fake-indexeddb Import
   Store, normalizer, exact identity, duplicate/reselection, cancellation, quota, Worker failure,
   retry, report, and close paths. Prove one bundle/artifact/item and 100 ordered items.
6. Prove exact repeated bytes skip; pending bytes reselect; different acquisition bytes exact-link
   without Canonical overwrite; conflicting signals fail atomically; fuzzy review remains bounded;
   and no SourceConnection transition occurs.
7. Export/validate/restore deterministic format 2 with committed and pending provider artifacts,
   reject format 1/new media, wrong acquired-via pair, malformed canonical bytes, digest mismatch,
   missing/mismatched connection, broken source/raw reference, and credential-dependent restore state
   before target mutation.
8. Run boundary/privacy assertions for public exports, direct-module dependency direction, documented
   Import-rule exception, Worker protocol, no schema/migration/Backup-format/dependency/SW/server/
   mapper/page/provider/auth expansion, and no private fixture or disclosure.

### Actual-served disposable synthetic browser evidence

Use a temporary untracked harness outside the worktree, serve the exact code head on loopback, and
launch installed Chromium headlessly with a newly created disposable profile. Never use Chrome, a
user profile, login, Token, account, provider request, or private activity.

The served flow must create one synthetic connected C2 record through the public factory, map only
the existing deterministic C3a fixture, build canonical artifacts, submit them through the public
ImportService and real module Worker, wait for reports, read back Canonical/Raw/Import records, repeat
identical bytes, reselect pending bytes, and export/validate/restore format 2 on a separate disposable
origin. It must exercise malformed/future/limit/cancel/quota injection without deletion.

Evidence records direct/round-trip bundle validity, 0 versus -0, opaque IDs, exact provenance chain,
ordered reports, no Canonical overwrite, unchanged connection revision/last-sync, deterministic
backup bytes, portable reconnect state, and repeat restore. Instrumentation must report only expected
same-origin static requests and zero external/provider HTTP, fetch/XHR/WebSocket, Token/Web Storage,
console error/warning, uncaught/unhandled, Service Worker, Cache Storage, or unapproved DOM/URL data.
Subject/content/private canaries must be absent from output. No tracked browser-harness path is added.

### Independent review and completion gates

After an approved implementation code head passes focused and full gates, obtain a fresh independent
findings-first review of the exact base-to-head diff, format parser, Import/Storage/Backup call graph,
provenance claim, literal scope, hostile/limit/privacy evidence, and actual browser record. Fix every
material finding inside the allowlist, rerun affected and full gates, and obtain a genuinely fresh
no-findings re-review. The reviewer must not implement or infer an extra path.

C3b is complete only after:

```text
failure-first test witnessed
focused artifact/Import/Storage/Backup/privacy tests pass
npm ci passes
syntax passes for the exact head
privacy passes
full npm test passes
git diff --check passes
literal 16-path audit passes
actual-served disposable synthetic browser evidence passes
independent review returns no findings
Task-Brief-only Closure is published
remote depth-1 head equals local exact head
exact-head GitHub CI succeeds
PR remains OPEN; Ready transition occurs only under the later standing owner authorization
```

No completion gate authorizes Ready, merge, cleanup, deployment, release, C3c, C4, live provider,
Token/account/private evidence, or an Alpha/full-v2.0 claim.

## Collision-audited literal C3b-P1 candidate maximum

The cumulative hard maximum is exactly these sixteen literal paths:

```text
docs/tasks/pr-43b-provider-artifact-import.md
js/import/AGENTS.md
js/import/strava-provider-artifact.js
js/import/import-service.js
js/import/synthetic-import-worker.js
js/storage/import-store.js
js/backup/backup-service.js
tests/import/strava-provider-artifact.test.js
tests/import/import-core.test.js
tests/import/import-worker.test.js
tests/import/decoder-registry-wiring.test.js
tests/import/exact-identity-import.test.js
tests/import/import-boundaries.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/privacy/privacy-guard.test.js
```

Collision audit:

- `js/import/AGENTS.md` is required because its current historical PR-09 rule explicitly excludes a
  provider format. An approved edit may add only this exact versioned, synthetic-testable artifact
  exception; it may not authorize network/provider/controller behavior generally.
- The new direct module owns encoder, decoder, canonical codec, limits, and internal errors in one
  path. No Import aggregate export or shared Backup codec refactor is needed.
- `import-service.js` supplies untrusted mixed/count/byte preflight and the new exact accepted media;
  `synthetic-import-worker.js` is the one production decoder registry. Both are unavoidable.
- `import-store.js` owns exact RawArtifact media/acquired-via validation and persistence;
  `backup-service.js` owns format-aware RawArtifact/connection/reference validation. Schema,
  migrations, constants, Storage index, Backup codec/index, Repository, and data contracts remain
  untouched.
- The seven existing focused test paths are current owners for service/store/worker/registry/exact
  identity/Backup behavior. The new focused test owns codec/profile/limits. The boundary and privacy
  tests prove frozen public/dependency/disclosure surfaces. Existing C3a fixture and tests are read
  unchanged.
- Source Manager, browser harness, package/lock, Service Worker, server, mapper, SourceConnection
  store, schema, migration, public index, ADR, and repository paths are intentionally absent. If any
  is required, implementation stops before the edit and returns a new minimum collision decision.

No seventeenth path is authorized. A listed path may remain unused, but may not be substituted. This
candidate list is not implementation authority.

## Owner authorization choices

Return exactly one of:

```text
Approve C3b-P1 and the complete frozen provider-artifact-to-existing-ImportService package, including
the literal cumulative sixteen-path hard maximum.
```

```text
Select C3b-P2; do not implement. Prepare a separate direct ActivitySource/SourceConnection
ADR-schema-public collision package.
```

```text
Select C3b-P3 and defer durable provider import.
```

P1 approval must cover every material item above; a partial approval or a different byte/count/path
maximum returns to planning. P2/P3 authorize no implementation in this branch.

## A2 migration, data, privacy, and rollback impact

- **A0–A2 now:** docs only. No database, Legacy, V2, SourceConnection, RawArtifact, Import,
  Canonical, Backup, setting, Token, cache, or user data was read or changed.
- **P1 future migration/data:** no schema migration or existing-record rewrite. New user-triggered
  provider artifacts/jobs/sources are additive through ImportService. Exact links do not overwrite
  Canonical payloads; disconnect/delete-local-data remain separate; no cleanup exists.
- **P1 future privacy:** provider artifact bytes contain the Canonical C3a bundle and fixed connection
  ID, but no subject/session/scope/Token/header/provider response. They remain local and in an
  explicit private Backup. Fixed errors/reports/diagnostics disclose none of them.
- **Rollback:** disable/stop the later caller or revert code while retaining every V5 record and
  format-2 backup. Never delete pending/committed artifacts, jobs, sources, activities, connection
  tombstones, or downgrade V5. Older code must fail closed on the unknown media/acquired-via record;
  the Legacy/default path remains available.
- **Evidence limit:** synthetic Node/browser evidence can complete C3b mechanics. It cannot prove
  OAuth identity, scope sufficiency, real response drift, provider pagination/rate limits, live
  cancellation, private-data scale, connection last-sync policy, C3c UI, C4 recovery, deployment, or
  release.

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

### A2 local publication evidence

The Task-Brief-only A2 working tree passed `npm ci`, syntax for 269 files, privacy, full `npm test`
1764/1764, and `git diff --check`. No implementation or browser evidence was run or claimed in A2.
The remote depth-1 head and exact-head CI are verified after this package is committed and pushed;
their exact identifiers are returned directly to the control tower rather than predicted here.

## Final Review Closure

The exact owner response `批准 C3b-P1 及完整合同和精确 16 路径上限` authorized the frozen P1
contract and literal cumulative sixteen-path ceiling. The later standing authorization also permits
the PR body update and Draft-to-Ready transition after every closure gate; it does not authorize
merge, cleanup, deployment, release, C3c, C4, or live/private evidence.

### Implementation and failure-first record

- Implementation commit `0818587eeff8840be444f3a74628cbf83d2c2e35` added the direct internal
  canonical builder/decoder, the narrow ImportService/Worker/Import Store integration, truthful
  `provider-artifact` RawArtifact acquisition, format-2 Backup validation, and focused privacy and
  boundary evidence. It added no public aggregate export or parallel write path.
- The first provider-artifact focused run failed as required with `ERR_MODULE_NOT_FOUND` for the
  absent direct module. Later smallest witnesses distinguished one incorrect expected report status
  (`completed` versus the mapper's truthful `completed_with_warnings`) from the real pre-existing
  Backup codec incompatibility at tagged number `-0.001`; the repair stayed inside approved
  `backup-service.js` by using an exact-reencoding, provider-archive-gated decoder fallback. Ordinary
  archives retain the existing decoder.
- Review-repair commit `9932564` followed two new failing witnesses: a hostile over-limit provider
  descriptor proved content cloning occurred before the 100-artifact ceiling (`true !== false`), and
  a rehashed format-2 archive with `ActivitySource.rawArtifactId = null` produced `Missing expected
  rejection`. Count/mixed-media validation now precedes content cloning, and committed provider raw
  records require a matching source/raw/activity link.
- Review-repair commit `4a88c1d` followed a third failing witness: a fully rehashed archive with a
  mismatched stored `externalId` again produced `Missing expected rejection`. Backup now derives the
  expected source from decoder-validated artifact content and requires the preserved provider,
  external ID, acquisition method, device ID, import time, raw/activity links, and either the
  original deterministic source ID or existing `exact-source:<artifact-id>:0` resolver ID. A
  positive generated exact-link archive remains valid.

### Independent review closure

- The first independent findings-first review of `0818587` found the two material issues above:
  incomplete committed Backup provenance linkage and provider count enforcement after content
  cloning. Both repairs stayed within four already approved paths.
- A genuinely fresh re-review of `9932564` cleared the count repair and found the remaining
  content/source mismatch in Backup provenance. The second repair stayed within the two approved
  Backup paths.
- A third genuinely fresh read-only review of exact code head `4a88c1d` returned **NO FINDINGS**.
  It found no parallel persistence, public/schema/dependency/Worker-protocol/Service Worker/server/
  provider/auth expansion, or path collision. Its residual notes were test granularity only: it did
  not independently rerun repository-wide/browser gates, and the one strict provenance predicate is
  not separately mutated once per compared field. The local gates below independently cover the
  complete code head and the predicate has both negative mismatch and positive generated-link
  evidence.

### Exact-head local and browser evidence

- Focused artifact/Import/Worker/Backup/boundary/privacy suites pass **62/62** after all repairs.
- On exact reviewed code head `4a88c1d`, `npm ci` passed; syntax passed for **271 files**; privacy
  passed; full `npm test` passed **1782/1782**; and `git diff --check` passed.
- The exact base-to-code-head diff uses twelve paths, all literal members of the approved cumulative
  sixteen. Four listed paths remain unused; there is no substitution or seventeenth path.
- An actual-served disposable in-app browser run against exact code head `4a88c1d` and fresh loopback
  origins `127.0.0.1:43201`/`:43202` passed: one completed import, one exact duplicate skip, one
  pending-artifact reselection completion, malformed/future/101 preflight with no job, cancellation,
  quota reporting, unchanged connection revision/last-sync, deterministic validated/restored Backup
  2, negative zero, and opaque ID preservation. Source and target counters were all zero for
  fetch/XHR/WebSocket/Web Storage, console warning/error, uncaught/unhandled failure, Cache Storage,
  Service Worker, and external requests. The server log contained only loopback `GET` requests for
  the disposable harness and repository modules.
- One diagnostic rerun on previously used ports returned the fixed temp-harness marker
  `source-import`; it was stale IndexedDB origin state from the earlier pass. No tracked code was
  changed. Switching only the disposable untracked harness to fresh origins produced the passing
  exact-head record above, after which the browser context and server were closed.

### Impact and publication handoff

- Migration/schema impact remains none: no store, index, physical/Canonical version, migration,
  backfill, repair, overwrite, delete, or cleanup. Legacy/default behavior is unchanged.
- New records are additive through ImportService. Exact links do not overwrite Canonical payloads;
  cancellation/quota/retry retain the existing per-item atomicity and reporting semantics.
- Provider artifacts contain the accepted reduced Canonical bundle plus fixed connection slot, but
  no subject, scope, Token, header, provider response, or credential. Errors/reports stay fixed and
  redacted; all evidence is deterministic synthetic data.
- Rollback remains code/caller disable or revert while retaining all V5 records and private format-2
  Backups. No downgrade or record deletion is authorized.
- This closure changes only this Task Brief. After its commit, the same local gates are rerun on the
  closure head, the branch is pushed normally, true remote depth-1 equality and exact-head GitHub CI
  are verified, the safe PR body is updated, and PR #51 may transition Draft to Ready under the
  standing authorization. Merge remains a separate owner decision.

## Stop condition

Stop after publishing the complete A2 decision package. No implementation starts before the owner
approves every material item and the exact literal path maximum. Do not Ready, merge, clean, deploy,
release, use real provider/account/Token/private evidence, make a provider request, or start C3c/C4.
