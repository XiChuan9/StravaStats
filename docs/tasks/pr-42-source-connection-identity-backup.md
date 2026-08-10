# PR-42: SourceConnection Identity, State, and Backup Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C2 additive SourceConnection and backup decision |
| Status | A2 findings and material owner decisions frozen; implementation prohibited |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@7dcb90ff171599a38eae31fadd09adc2f2ba7edb` |
| Exact base tree | `941e5a6934f4e781629f42ddbec764736f815393` |
| Feature branch | `codex/v2/source-connection-identity-backup` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr42/StravaStats` |
| Parent decision | PR-40 / D-A A2 / D-B C, staged C1-C4 |
| Completed prerequisite | C1 / PR #47 squash-merged as `7dcb90ff171599a38eae31fadd09adc2f2ba7edb` |
| Pull request | [Draft PR #48](https://github.com/XiChuan9/StravaStats/pull/48), open against `integration/v2` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce a findings-first, materially complete owner decision package for C2: the durable identity and
state semantics of an additive V5 `SourceConnection`, together with its backup/restore treatment.
The package must define what can be represented safely before C3 provider import and C4 ownership/
lease recovery, without enabling live authorization or changing production schema, public APIs, or
backup bytes.

This first commit creates only this Task Brief. A2 is read-only except for later updates to this same
file. No C2 implementation begins until the owner selects an exact A3 option and separately approves
its literal path allowlist.

## Authority and current limit

The owner selected staged P0 closure through C1-C4 and, after C1 merged, authorized only the next C2
planning stage:

> Proceed only to the next authorized C2 stage: create/freeze a Task-Brief-first read-only
> identity/state + backup material decision package from exact integration head 7dcb90ff..., with a
> separate Draft PR if required. Do not implement C2 schema/public/backup changes until a new explicit
> owner A3 decision.

Authorized now:

- create this isolated branch/worktree from the exact integration head;
- publish a Task-Brief-only first commit and an open Draft PR targeting `integration/v2`;
- inspect current code, tests, PRD, accepted ADRs, plans, release gates, schema, Storage, Backup,
  Source Manager, C1 controller, provenance, and migration contracts read-only; and
- update only this Task Brief with findings, mutually exclusive owner decisions, literal candidate
  allowlists, failure-first tests, browser evidence, migration/privacy/rollback impact, and risks.

Not authorized:

- any production or test implementation outside this Task Brief;
- V5/schema/store/index/record changes, data migration, public Storage/Repository/Backup/Import API
  changes, Worker or Service Worker changes, dependencies, server APIs, or root auth changes;
- OAuth/config/exchange/revoke, credentials, Token/status reads or writes, real provider/account calls,
  private data, private fixtures, user browser profiles, deployment, release, Ready, merge, or cleanup;
- C3 provider-to-`ImportedActivityBundle` work or C4 durable ownership/heartbeat/lease recovery.

## Global invariants

- Preserve every Legacy and V2 record. Migration proposals must be additive, idempotent, observable,
  recoverable, and must not reinterpret existing `ActivitySource` provenance as authenticated identity.
- Disconnecting a provider, removing authorization material, deleting a `SourceConnection`, and
  deleting local activities are separate decisions and actions.
- A durable connection record must not contain Tokens, authorization headers, raw provider responses,
  athlete profile payloads, activity payloads, precise location, health/power data, or private errors.
- Backup/restore must remain deterministic, local-first, explicit, bounded, and safe for archives made
  before or after the selected schema version. A connection record must never imply that credentials
  or provider authorization were backed up.
- Legacy, Shadow, Canonical, Demo, local file imports, provider identities, and future connection
  ownership remain isolated behind explicit boundaries.
- C2 must not claim provider reachability, granted scopes, token validity, last successful sync, activity
  ownership, retry/resume, or lease authority unless an approved authoritative source exists.

## Required A2 findings

The read-only audit must establish exact current behavior and call graphs for:

1. V2 V4 schema descriptors, physical migrations, Storage Factory/public surfaces, Repository, and all
   current uses of provider/external identity.
2. `ActivitySource`, raw-artifact identity, duplicate/link resolution, Import job provenance, and the
   boundary between imported provenance and authenticated connection identity.
3. Backup archive manifest/payload, compatibility/version checks, validation, restore planning,
   idempotency, settings treatment, cancellation/quota/rollback, and public Backup API.
4. C1 Source Manager controller snapshot/lifecycle, existing root auth/Token behavior, Demo isolation,
   local-first startup, diagnostics, Service Worker, and privacy/network boundaries.
5. PRD P0, accepted ADRs, engineering plans, release gates, historical backup/schema requirements, and
   any collision with open work.

Findings must precede recommendations. Old summaries and historical conversations are not evidence.

## Required owner decisions

The A2/A3 update must present mutually exclusive packages for at least these separable questions:

- **D-C2.1 identity/state:** the exact durable identity key, provider vocabulary, lifecycle states,
  transitions, timestamps, capabilities, disconnect/tombstone semantics, multi-account policy,
  uniqueness/conflict rules, malformed/unknown/future values, and what remains unavailable before C3.
- **D-C2.2 backup/restore:** whether and how non-secret connection metadata is included, archive/schema
  compatibility, restore conflict policy, redaction, determinism, ordering, empty/existing-library
  behavior, cancellation/quota/rollback, and treatment when credentials are deliberately absent.
- **D-C2.3 delivery boundary:** one combined C2 implementation or separately approved schema/storage and
  backup tranches, with collision-audited literal path maximums for each option.

Each option must name its public/schema/dependency/Worker/Service Worker boundaries, failure-first
tests, actual browser evidence, data migration, privacy, rollback, architecture risk, collision risk,
and what requires real credentials/private/provider evidence. No option may infer authorization for
such evidence.

## A1 publication contract

First commit changed path:

```text
docs/tasks/pr-42-source-connection-identity-backup.md
```

Draft PR title:

```text
feat(v2): define SourceConnection identity and backup contract
```

Draft PR body:

```markdown
## What changed

Adds the C2 Task Brief for the SourceConnection identity/state and backup material decision package.

## Why

C1 is merged, but V5 schema, public Storage/Backup surfaces, migration, and provider identity semantics remain separately gated. This Draft freezes the read-only C2 audit and owner-decision boundary before implementation.

## Impact

Docs only. No schema, migration, Storage/Repository/Backup/Import API, OAuth, Token, provider, Worker, Service Worker, dependency, or data change.

## Checks

- exact-base and one-path diff audit
- `npm run check:privacy`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
the A1 publication.

## Required verification

For A1 and each later docs-only A2/A3 update:

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Tests remain offline and synthetic. No browser pass may be claimed unless it actually runs against the
exact relevant head; A2 planning does not require private or provider evidence.

## Stop condition

After the Task-Brief-only Draft is published, continue only with the authorized read-only audit and
same-file A2/A3 decision freeze. Stop before any schema, Storage, Backup, migration, auth, provider,
test, browser, or other implementation path until a new explicit owner decision approves one exact
package and literal allowlist.

## A1 publication and untouched-gate readback

- The isolated branch was created from exact `integration/v2@7dcb90ff171599a38eae31fadd09adc2f2ba7edb`,
  tree `941e5a6934f4e781629f42ddbec764736f815393`. The locked integration worktree was not modified.
- First commit `4b1e4a949005d91bf04352e67600c7aabf64499e` contains exactly this Task Brief and was
  pushed normally.
- GitHub App Draft creation returned exact `403 Resource not accessible by integration`. The
  already-authorized `gh` fallback created [Draft PR #48](https://github.com/XiChuan9/StravaStats/pull/48)
  with the exact title above. Readback showed `OPEN`, Draft, unmerged, `MERGEABLE/CLEAN`, exact base,
  one commit, and this sole changed path. No reviewer, label, assignment, Ready, merge, cleanup,
  deployment, or release write occurred.
- `npm ci`, syntax for 263 files, privacy, and `git diff --check` passed. The first full test run
  passed 1720/1721 and exposed one timing-sensitive Legacy cache-rescue failure: the late-success
  timeout case observed zero closes instead of one. Its isolated file immediately passed 59/59,
  and a clean full rerun passed 1721/1721. No code was changed to mask the first observation.

## A2 findings

Findings precede recommendations. They describe the exact base above and do not authorize C2
implementation.

### C2-F1 — current V2 is a tightly verified V4 database

- `V2_DATABASE_VERSION` is `4`, `V2_SCHEMA_ID` is `strava-stats-v2@4`, and the physical schema has
  exactly thirteen stores. The registry has four ordered structural migrations ending at
  `schema-0004-duplicate-review`; database verification hard-codes all four records and their
  8-to-11-to-11-to-13 store-count summaries.
- Adding `sourceConnections` requires more than a descriptor: V5 must update constants, versioned
  schemas, the structural registry/handler, metadata verification, exact schema/browser assertions,
  and backup compatibility.
- The upgrade can remain additive and record-free: V4-to-V5 creates one empty store plus the fifth
  migration record, changes only V2 metadata to `strava-stats-v2@5`, and preserves every existing
  store, index, key, and record. Delete, clear, rename, repair-by-overwrite, and downgrade remain
  prohibited.

### C2-F2 — the public Storage surface has no connection port

- `js/storage/index.js` exports constants/errors/schema plus `createCanonicalStore` and
  `createImportStore`. Neither factory can read or write connection state.
- C2 is therefore a public Storage API expansion. The narrow current pattern is a separate factory
  over the same verified database, with strict input validation, transaction ownership,
  stale-handle behavior, and an idempotent close barrier. Pages and Repository consumers must not
  receive an IndexedDB handle or select the store directly.
- Repository remains the consumer activity-read boundary and has no connection method. C2 does not
  need a Repository change because SourceConnection is application control state, not an activity
  read projection.

### C2-F3 — ActivitySource is provenance, not authenticated identity

- Accepted ADR-0006 and the bundle validator freeze ActivitySource to `id`, `activityId`,
  `provider`, optional `externalId`, optional `rawArtifactId`, `acquisitionMethod`, optional
  `deviceId`, and `importedAt`. Provider/acquisition method express provenance; disconnect and merge
  must not delete the audit records.
- V3's non-unique `[provider, externalId]` index resolves activity identity. An external activity ID
  does not identify an authenticated athlete/account. Existing file/archive imports can produce
  Strava provenance without proving which account owns a credential.
- There is no `sourceConnectionId` in ActivitySource and no relation store. C2 must not reinterpret
  every matching provider string as proven account ownership. An explicit link would change an
  accepted Canonical contract and collide with C3 Import/identity work.

### C2-F4 — a safe single-account identity needs an explicit limitation

- The root OAuth response can provide a normalized Strava athlete ID, and the Legacy lifecycle
  compares it before accepting a Token for a populated Legacy library. V2 has no equivalent owner
  record.
- The smallest useful V2 binding is one connection slot per provider with an immutable normalized
  provider subject ID. It lets a later C1.1 controller reject a different subject before Token
  acceptance. It still cannot prove ownership of a pre-existing Canonical-only library that has
  Strava provenance but no SourceConnection; that case remains `IDENTITY_UNCONFIRMED`.
- Hashing a numeric provider ID in browser code does not make it anonymous: the space is enumerable,
  and a reconnect/restore salt must itself be retained. The honest privacy contract treats the
  normalized subject as private local metadata and never exposes it through page snapshots,
  diagnostics, logs, errors, committed fixtures, or CI.
- Multi-account-per-provider behavior is not defined by the PRD/current UI. A unique provider slot
  is the smallest P0 contract. Multiple Strava accounts require explicit source ownership and new
  conflict/UI semantics.

### C2-F5 — not all UI states are durable connection states

- C1 remains the exact `authorization_unavailable` snapshot and reads no Token, account, provider,
  or storage state. C2 does not authorize changing that production behavior.
- Absence of a SourceConnection is `unconfigured`; storing an unconfigured row creates a phantom
  identity. `syncing` is transient work. Persisting it in C2 would create a stale post-crash value
  before C4 supplies owner/heartbeat/lease recovery.
- Stable durable states can be `connected`, `reconnect_required`, `error`, and `disconnected`.
  A later controller composes absence, credentials, C3 work, and this record into PRD card states.
  C2 has no production writer and cannot claim authorization, reachability, or successful sync.
- `lastSyncAt` is historical and nullable. Only C3 may set it after an accepted provider bundle is
  committed. Disconnect preserves it. Stored error codes are bounded and never contain a provider
  message or identifier.

### C2-F6 — existing auth/connector code cannot become C2 authority

- `js/app/auth-lifecycle.js` owns the origin-shared `strava_tokens` Legacy credential. Disconnect
  removes it even when revocation is unconfirmed and does not delete activities; its Canonical
  inspection cannot establish a V2 subject.
- `StravaApiConnector` reads/writes that Token and calls same-origin provider APIs for the Legacy
  path. It has no connect, disconnect, status, SourceConnection, or ImportedActivityBundle API, and
  Source Manager does not construct it.
- C2 must not import either module, inspect Web Storage, call a server/provider, or infer connected
  from Token presence. C1.1 activation and C3 ingestion remain separately gated.

### C2-F7 — backup format 1 is an exact V4 physical snapshot

- The service reads all thirteen stores in one readonly transaction, validates the system and
  Canonical/import/review graph, then writes a deterministic stored ZIP with a fixed seventeen-entry
  path list. The manifest requires format `1`, physical V4, `strava-stats-v2@4`, Canonical schema
  `1`, exact counts, and per-payload hashes.
- Restore validates the whole bounded archive before mutation. It accepts only an absent database
  or exact empty V4, writes all stores in one transaction, returns `already_restored` for an exact
  repeat, and rejects any other nonempty target. Quota, constraint, cancellation, and transaction
  failure never authorize clearing or overwriting.
- Tokens, credentials, provider state, Legacy, Demo, Cache Storage, and Service Worker state are
  excluded. Settings use a separate additive allowlist after the database commit.

### C2-F8 — V5 creates two backup compatibility decisions

- A literal V5 row with `status: connected` cannot be restored honestly because no credential is
  archived. The restored operational state must be `reconnect_required`, or the connection store
  must be explicitly excluded/reset. Hiding a stale value only in the UI leaves other consumers
  with a false durable claim.
- A V5-only implementation would strand valid format-1/V4 backups: updating global constants makes
  current exact-version checks reject them. Recovery preservation needs a bounded one-way
  V4-backup-to-V5 transformation or an explicit decision to require an older restore tool.
- A deterministic portable projection can map `connected` or `error` to `reconnect_required` with
  `AUTHORIZATION_REQUIRED`, preserve reconnect-required/disconnected, immutable identity, and
  historical `lastSyncAt`, and exclude all credentials. Restore then writes exactly the projection.
- Supporting seventeen-entry format 1 and eighteen-entry format 2 requires codec dispatch. The
  codec currently hard-codes one count/path array before interpreting the manifest. This required
  path was absent from the parent C2 candidate list.

### C2-F9 — V4-backup transformation must be narrow and observable

- A validated format-1/V4 archive can restore to absent/exact-empty V5 by preserving all V4 user
  records, adding an empty SourceConnection store, updating only V2 metadata, and appending the
  exact fifth migration record. It must not infer a subject/connection from ActivitySource.
- This is one-way/additive. It does not accept arbitrary versions, upgrade a nonempty target,
  overwrite settings, or negotiate Canonical versions. Cancellation remains pre-commit and whole
  operation; rollback remains transaction abort.

### C2-F10 — local-first and isolation boundaries stay frozen

- Local import, Canonical reads, and Storage & Backup remain provider-independent. Demo constructs
  neither the Real Import store nor connection controller. C2 adds no Source Manager production
  read, so C1's unavailable snapshot remains unchanged.
- Diagnostics retain bounded page/category/code/count values. Subject IDs, records, backup rows,
  Tokens, and provider errors remain outside diagnostics/DOM.
- No C2 option needs a dependency, Import/Repository/provider API, Worker, server route, CSP, or
  Service Worker change. Discovery of one is a stop, not an allowlist extension.

### C2-F11 — collision audit

- Open Draft PR #31 changes only `docs/tasks/pr-25-release-readiness-audit.md`; open Draft PR #46
  changes only `docs/tasks/pr-40-source-manager-lifecycle.md`. Neither overlaps production paths.
- Schema/migration verification and backup codec/service are exact-contract hotspots. Existing V4,
  exact-identity, duplicate-review, import, and backup tests freeze counts/version literals across
  thousands of assertions.
- The parent C2 list omitted `js/storage/database.js`, `js/storage/backup-manifest.js`,
  `js/backup/codec.js`, its codec test, and a focused SourceConnection test. Current call graphs
  prove these paths are required. This is a planning correction, not implementation authority.

## D-C2.1 — owner decision: durable identity and state

Choose exactly one. No choice enables production Connect, Token access, Sync, or a provider request.

### C2-I1 — subject-bound single-provider slot (recommended)

Freeze one Strava connection per local V2 library. V5 adds:

```text
store: sourceConnections
keyPath: id
autoIncrement: false
unique index: byProvider -> provider
```

Exact plain-data record:

```text
id              exact "source-connection:strava"
provider        exact "strava"
subjectId       normalized positive-decimal string; private local metadata
status          connected | reconnect_required | error | disconnected
lastSyncAt      null or fixed-millisecond UTC instant
errorCode       null | AUTHORIZATION_REQUIRED | CONNECTION_ERROR |
                REVOCATION_UNCONFIRMED
revision        positive safe integer
```

Absence means unconfigured. ID/provider/subject are immutable. Create requires revision 1; each
transition compares an expected revision and increments once atomically. Stale, concurrent,
malformed, accessor, Proxy, unknown-field/state, subject-change, or revision-skip input fails before
mutation.

- Create accepts only connected with null last-sync/error. C2 cannot call it in production.
- Exact transition graph: connected to connected/reconnect-required/error/disconnected;
  reconnect-required to connected/disconnected; error to connected/reconnect-required/disconnected;
  and disconnected to connected. A same-state connected transition is reserved for a successful C3
  sync update. Every other edge fails without a write.
- Connected requires null error.
- Reconnect-required requires `AUTHORIZATION_REQUIRED`; error requires `CONNECTION_ERROR`.
- Disconnected permits only null or `REVOCATION_UNCONFIRMED` and retains identity/last-sync as a
  tombstone. No local data is deleted.
- `lastSyncAt` changes only on a transition to connected, never decreases, and remains null until C3.
- Syncing/auth progress, activity counts, scopes, Token validity, and capabilities are derived, not
  stored.

Public addition: `createSourceConnectionStore(options)`. Its frozen surface is `initialize()`,
`getConnection(provider)`, `createConnection(record)`, `transitionConnection(input)`, and `close()`.
Reads return frozen clones/null; writes use one transaction and touch no other store. No delete
method exists. Factory options are the exact existing Storage dependency set `indexedDB`,
`IDBKeyRange`, `now`, and `applicationVersion`. Transition input is exactly `id`,
`expectedRevision`, `status`, `lastSyncAt`, and `errorCode`; a successful create/transition returns
the frozen stored record, initialize returns `{ status: 'ready' }`, and close returns
`{ status: 'closed' }`.

This enables later same-subject reconnect. A nonempty Canonical-only library without a record stays
identity-unconfirmed. Architecture/collision risk: **medium-high**. Privacy risk: **medium** because
local/private-backup subject identity is retained; public/log/DOM exposure is prohibited.

### C2-I2 — state-only provider slot

Use the same store, ID/provider, states, revision, tombstone, and API but omit subjectId. This
minimizes account metadata yet cannot bind OAuth to a prior account or safely activate Connect for a
nonempty Canonical library. C1.1 remains blocked and C3 must later add identity. Architecture risk:
**medium**; product-completion risk: **high**. This is a privacy-first deferral, not identity closure.

### C2-I3 — explicit multi-account/source ownership

Allow multiple connections and add `sourceConnectionId` to provider-origin ActivitySource (or a new
relation store). This changes ADR-0006, ImportedActivityBundle validation, exact identity,
Canonical persistence, C3 decoding/import, backup references, and migration of unbound sources.
No evidence can infer owners for existing archive/file provenance.

This option is **blocked for C2 implementation** pending an accepted architecture decision and a
separate C2/C3 collision package. Architecture/collision risk: **very high**.

## D-C2.2 — owner decision: backup and restore

Choose exactly one independently of identity.

### C2-B1 — portable projection plus V4 compatibility (recommended)

- Add format 2/V5 with eighteen exact ordered entries; `connections.jsonl` follows `sources.jsonl`.
- Include the non-credential record but normalize credential-dependent status as in C2-F8. Tokens,
  scopes, headers, provider responses, and provider error text remain absent.
- Validate formats 1 and 2 through separate exact profiles. Format 1 receives only C2-F9's narrow
  V4-to-V5 transformation; format 2 restores its validated projected V5 graph. Unknown, mixed,
  duplicate, reordered, or malformed profiles fail before target creation.
- Restore accepts only absent/exact-empty V5, uses one transaction, and compares idempotency against
  transformed/projected records. A different nonempty connection tombstone is a conflict.

This preserves old backups and avoids false connected state. Risk: **high** codec/service collision,
but strongest recovery safety.

### C2-B2 — exclude connection metadata from backup

Format 2 declares SourceConnection excluded/reset and restores it empty; activities and provenance
remain. This guarantees unconfigured restore and lowest identity exposure, but loses same-account
reconnect and weakens complete-library/SourceConnection expectations. No connections entry is
added, but the manifest needs an exact exclusion declaration. Risk: **medium-high** architecture,
**high** recovery/product, **lowest** privacy.

### C2-B3 — exact V5-only round trip

Add connections entry and restore the exact V5 row while rejecting format-1/V4 backups. This either
restores connected without credentials or depends on an out-of-band override and strands prior
backups. It conflicts with recovery/no-false-status invariants and is **not recommended**. Selection
requires explicit acceptance and an authorized older-build restore tool before implementation.

## D-C2.3 — owner decision: delivery boundary

Choose exactly one after identity and backup.

### C2-T1 — one atomic V5 Storage + Backup PR (recommended)

Implement the selected identity store, migration, public factory, backup compatibility, tests,
browser evidence, and docs on one exact head. Backup never observes a merged V5 it cannot handle.

**Literal cumulative candidate allowlist — hard maximum of 27 paths**

```text
docs/tasks/pr-42-source-connection-identity-backup.md
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/source-connection-store.js
js/storage/backup-manifest.js
js/storage/index.js
js/backup/codec.js
js/backup/backup-service.js
tests/storage/source-connection-store.test.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
tests/backup/codec.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
docs/migrations/indexeddb-v2.md
docs/migrations/rollback-plan.md
docs/guides/backup-guide.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
README.md
tests/docs/release-docs.test.js
```

README/docs-test are optional within the maximum if implementation inspection shows indexed public
text needs no change. No twenty-eighth path is allowed.

### C2-T2 — two approved PRs with a fail-closed compatibility gap

Deliver V5 schema/store first, then backup. Between merges Storage & Backup must return
`BACKUP_SCHEMA_INCOMPATIBLE` for V5 instead of emitting/restoring incomplete archives; that
temporary regression blocks release claims.

**T2a schema/storage hard maximum — 17 paths**

```text
docs/tasks/pr-42a-source-connection-storage.md
js/storage/constants.js
js/storage/schema.js
js/storage/migrations.js
js/storage/database.js
js/storage/source-connection-store.js
js/storage/backup-manifest.js
js/storage/index.js
tests/storage/source-connection-store.test.js
tests/storage/indexeddb-v2-schema.test.js
tests/storage/indexeddb-v2-transactions.test.js
tests/storage/indexeddb-v2-boundaries.test.js
tests/storage/indexeddb-v2-browser-smoke.html
tests/storage/backup-manifest.test.js
docs/migrations/indexeddb-v2.md
docs/migrations/rollback-plan.md
docs/guides/migration-guide.md
```

**T2b backup hard maximum — 15 paths**

```text
docs/tasks/pr-42b-source-connection-backup.md
js/storage/backup-manifest.js
js/backup/codec.js
js/backup/backup-service.js
tests/storage/backup-manifest.test.js
tests/backup/codec.test.js
tests/backup/backup-service.test.js
tests/backup/backup-boundaries.test.js
tests/backup/backup-browser-smoke.html
docs/migrations/indexeddb-v2.md
docs/migrations/rollback-plan.md
docs/guides/backup-guide.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
tests/docs/release-docs.test.js
```

T2a/T2b need separate Task-Brief-first Drafts and approvals. Shared docs are an intentional normal
merge collision. Risk: **high** architecture and **very high** sequencing/release.

## Failure-first evidence for any later approved implementation

- Fresh V5; exact V1/V2/V3/V4-to-V5; V4 record/index preservation; fifth migration; idempotent
  reopen; interrupted upgrade/retry; blocked/stale handles; malformed prior metadata; future version;
  and zero Legacy access.
- Exact factory/instance keys; import-time zero I/O; invalid options before open; strict descriptors;
  immutable identity; unique provider; revision compare-and-swap; legal/illegal transitions;
  last-sync monotonicity; close/versionchange; quota/abort/constraint/readback mismatch; no delete/clear.
- Deterministic selected format/order; V4 transformation when selected; mixed/unknown/duplicate/
  reordered/traversal/appended/truncated/hash/count/order/record/reference failures before mutation.
- Connected/error projection; tombstone/identity/last-sync retention; absent/empty target; nonempty
  conflict; repeat zero writes; cancellation/quota atomicity; settings conflict/pending; no Token,
  provider, Legacy, Demo, Cache, or Service Worker access.
- Privacy scans: no real ID, Token, credential/header, provider payload/message, private fixture,
  route, health/power value, or connection record in errors, logs, diagnostics, DOM, Git, or CI.

Actual-served browser evidence must use a fresh disposable synthetic profile and exact-head server.
It must inspect synthetic V4 before/after V5, create/transition/read one synthetic connection through
the public factory, export/validate/restore into a second isolated factory/profile, prove portable
reconnect state and repeat, exercise offline/failure injection, and confirm zero external requests
and unchanged Service Worker behavior. Demo and Source Manager retain C1 unavailable. No user
Chrome/profile, real account, Token, provider call, or private backup is permitted.

## Migration, privacy, rollback, and evidence limits

- **Migration/data:** V5 adds one empty store and migration record. It does not backfill from
  ActivitySource, create a connection, change Canonical/import/review records, touch Legacy, or
  mutate a Token. Later authorized writes affect only SourceConnection.
- **Disconnect:** a disconnected tombstone retains all activities, ActivitySources, artifacts,
  jobs/logs, review data, settings, backups, Legacy, and Demo. Delete-source-data stays unavailable.
- **Privacy/network:** I1 stores a subject locally and under B1/B3 in a private backup; it is never
  public/logged. I2/B2 reduce exposure at stated product cost. C2 has zero network/credential I/O.
- **Rollback:** use normal revert/feature disable; never downgrade/delete/clear V5. Older V4 builds
  receive `VersionError`, so rollback keeps a V5-aware fail-closed build or returns consumers to the
  untouched Legacy/default path. V5 and user-owned format-2 backups remain for forward recovery.
- **Synthetic completion:** schema, state, migration, backup, restore, redaction, browser, rollback,
  and collision evidence need no private data.
- **Still unavailable:** real OAuth binding, cross-account behavior, Token refresh/revoke, provider
  reachability/import, private-backup migration, and Production/full-v2.0 evidence require separate
  authority.

## Owner response required

Record one identity choice (`C2-I1`, `C2-I2`, or `C2-I3`), one backup choice (`C2-B1`, `C2-B2`, or
`C2-B3`), and one delivery choice (`C2-T1` or `C2-T2`). Recommended bounded package:

```text
C2-I1 + C2-B1 + C2-T1
```

This recommendation authorizes nothing. Implementation requires a new explicit A3 approval of the
selected semantics and literal maximum. C2-I3 first requires a new architecture/C3 collision
package. PR #48 remains open/Draft; no Ready, merge, C1.1, C3/C4, provider/private activity,
deployment, release, or cleanup is part of this handoff.
