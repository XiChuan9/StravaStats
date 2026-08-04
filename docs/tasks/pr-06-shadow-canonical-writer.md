# PR-06: Shadow Canonical Writer

## Metadata

| Field | Value |
| --- | --- |
| Status | Ready for review |
| Milestone | M3 |
| Base branch | `integration/v2` |
| Exact base SHA | `25e1b24d876ddad1c429c7ddadd2061ef99c21a9` |
| Feature branch | `codex/v2/shadow-writer` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/52ff/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Control tower + independent Final Review |
| Dependency | PR-05 / PR #11 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Add a best-effort Canonical shadow writer to approved real Strava API activity-list
write events and provide the same internal writer seam for a future accepted
`ImportedActivityBundle`, while every page continues to read only the Legacy
Repository. Canonical mapping, validation, storage, read-back verification, or
parity failure must never reject, replace, delay on, clear, or overwrite the
successful Legacy result.

The writer produces a deterministic, exportable, redacted Parity Report covering
activity count, opaque string ID mapping, distance, moving and elapsed time, date,
sport, heart rate, power, and gear. Missing, `null`, zero, value, invalid, and
unavailable states remain distinct. Every difference receives a stable category;
raw activity values, IDs, names, payloads, causes, credentials, and private fields
never enter the report, error, log, or DOM contract.

## A0 baseline and remote evidence

- The assigned worktree started detached and clean at exact SHA
  `25e1b24d876ddad1c429c7ddadd2061ef99c21a9`.
- Local and `origin/integration/v2` both pointed to that SHA; the locked long-lived
  `integration/v2` worktree also pointed to it and was not modified.
- PR #11 was merged into `integration/v2` at that exact merge commit on
  2026-08-04T22:51:46Z.
- PR #11 merge check `30926543735 / 92050227364` succeeded.
- Exact integration push CI run `30957975591` and pull-request run `30957979809`
  both succeeded at the base SHA.
- A0 local baseline: `npm ci` PASS; syntax PASS for 151 files; privacy PASS;
  full suite PASS 1,016/1,016; `git diff --check` PASS.
- No real Token, account, activity, route, heart-rate, power, device, export,
  private fixture, or user browser profile was read.

## A1 publication gate

The first feature-branch commit must contain only this Task Brief. It must be
pushed to `origin/codex/v2/shadow-writer`, then opened as a Draft PR targeting
`integration/v2`. No implementation path may be staged before that docs-only
commit and Draft PR exist.

## A2 read-only investigation

### Actual read and write call graph

```text
app/main.js initialize or refresh
  -> createSummaryRepositorySession(sessionMode)
  -> public createRepository({ sessionMode, mode: "legacy" })
  -> LegacyRepository.listActivities({ refresh })
     -> cache hit: Legacy activity cache -> Legacy result
     -> cache miss/refresh:
        StravaApiConnector.fetchActivities()
        -> one same-origin /api/strava-activities request
        -> detached Legacy DTO array
        -> Legacy cache save attempt
        -> Legacy result { data, source: "network", warnings, partial: false }
  -> app summary-envelope validation
  -> preprocessActivities
  -> existing pages/tabs (Legacy DTO only)
```

PR-05 independently provides:

```text
createCanonicalStore(options)
  -> initialize()
  -> putBundle(accepted ImportedActivityBundle)
  -> getBundle(opaque activity ID)
  -> close()
```

No production path currently constructs an `ImportedActivityBundle`, calls the
Canonical store, reads Canonical data into a page, or uses the existing feature
flags to choose a Repository implementation.

### Chosen insertion point

The only approved insertion point is after `app/main.js` has received and safely
adapted a successful `listActivities` envelope with `source: "network"`. The
observer takes an immediate descriptor-safe detached snapshot, schedules work,
and returns the original Legacy envelope without awaiting Canonical work.

Reasons:

- Connector remains network-only and unaware of persistence.
- LegacyRepository keeps exact cache ownership and seven-method behavior.
- Page reads, preprocessing, output references, warnings, and errors remain
  Legacy-only.
- Cache hits do not invent an API write event; cache miss and refresh network
  successes do.
- Demo never creates or opens a Canonical writer.
- Future PR-07 code can call the writer's internal imported-bundle enqueue seam
  without adding an eighth Repository method.

Rejected candidates:

- Connector hook: violates network-only ownership.
- Legacy cache adapter hook: couples Canonical writes to Legacy persistence and
  risks changing cache success semantics.
- Canonical Repository/factory cutover: expands the accepted public API and page
  read source.
- Page/tab hooks: violate the Repository boundary and duplicate writes.

### Existing feature-flag facts and frozen mode behavior

The base exposes `dataRepositoryMode`, `localImportEnabled`, and
`canonicalShadowWriteEnabled`, but accepts stale `legacy` / `v2` mode values and
the application does not consult them for Repository selection.

PR-06 freezes fail-closed behavior without Canonical read cutover:

| Requested mode | Shadow boolean | Page read | Canonical shadow write |
| --- | ---: | --- | --- |
| `legacy` | any | Legacy | disabled |
| `shadow` | `true` | Legacy | enabled for real network results |
| `shadow` | not `true` | Legacy | disabled |
| `canonical` | any | Legacy | disabled; Canonical read is not yet authorized |
| `v2` or unknown/unsafe | any | Legacy | disabled |

Both the exact `shadow` mode and strict boolean `true` are required. Demo is
always isolated and disabled. Feature-flag inputs are descriptor-safe;
accessors, custom prototypes, symbols, sparse shapes, and Proxies fail closed.

### Canonical mapping gap and frozen mapping

PR-06 adds an internal Legacy summary mapper; it does not change Accepted
Canonical contracts or the PR-05 physical schema.

- Legacy IDs become opaque strings only from a non-empty string or a non-negative
  safe integer. Unsafe numeric IDs fail mapping rather than losing precision.
- `start_date` becomes a fixed-millisecond UTC instant; local-only or invalid
  dates fail mapping.
- Known Strava sports map to the ten Accepted categories and stable
  source-neutral variants. Unknown sports map to `other` with an explicit
  normalization warning.
- Distance, moving time, elapsed time, heart rate, power, cadence, and name keep
  absent, `null`, zero, and value semantics without coercion.
- Gear is preserved only under a namespaced Canonical `extensions` object; no
  provider field is added to the activity top level and no schema change occurs.
- Summary-derived capabilities are explicit booleans; no streams, laps, events,
  or device data are fabricated.
- One deterministic Strava API `ActivitySource` is retained. Because the Legacy
  summary has no acquisition timestamp, `importedAt` uses the normalized activity
  instant as a deterministic fallback and the bundle/report records a stable
  provenance warning. The value is never silently represented as an observed
  acquisition time.
- Version metadata identifies the PR-06 mapper; it does not invent an input hash
  or analysis version.

### Failure, retry, concurrency, and lifecycle model

- Enqueue snapshots synchronously and never awaits storage on the Legacy path.
- Events receive monotonic internal sequence numbers; a single Promise queue
  makes concurrent and out-of-order callers deterministic.
- Activities inside an API batch retain original order for report references;
  Canonical IDs are never parsed or numerically sorted.
- Per-activity mapping, validation, storage, conflict, verification, and parity
  failures are caught, classified, and do not stop later activities.
- Repeated identical bundles use PR-05 `already-present`; a differing collision
  stays an explicit conflict and parity/storage difference.
- `flush()` waits for all accepted work. `close()` stops new work, waits for the
  queue, then awaits the Canonical store terminal close barrier.
- Reload creates a new writer, explicitly initializes the retained V2 database,
  and verifies identical data as already present. Neither database is cleared.

### Parity field semantics

The exact fields are:

```text
activityCount
opaqueId
distance
movingTime
elapsedTime
date
sportType
heartRate
power
gear
```

Each comparable value is represented internally and summarized as one of:

```text
missing
null
zero
value
invalid
unavailable
```

The report contains only batch/activity ordinals, stable outcome/category/reason
codes, aggregate counts, field-state counts, and safe version/mode metadata. It
does not contain the compared values. Difference categories are exactly:

```text
MAPPING_FAILURE
VALIDATION_FAILURE
STORAGE_FAILURE
VERIFICATION_FAILURE
PARITY_MISMATCH
NORMALIZATION_WARNING
```

### Primary risks

- Numeric provider IDs may already have lost precision before PR-06 sees them;
  unsafe numbers therefore fail closed.
- Existing Canonical rows may conflict with newly mapped summaries; PR-06 must
  report and preserve them, never overwrite.
- A slow/blocked IndexedDB open must not hold the Legacy page result; background
  work may remain pending until the platform reaches a terminal event.
- A report can become a privacy leak if it includes values or raw errors; fixed
  schemas and source scans prohibit them.
- `canonical` mode cannot be honored as a read mode without PR-15/16 work; it is
  explicitly fail-closed to Legacy in PR-06.

## A3 definitive scope freeze

The recommended solution is fully inside the delegated PR-06 boundary. It adds
no Repository method/export, Canonical schema/store/index/version, page read
cutover, provider decoder, dependency, Service Worker, deployment behavior, or
Legacy cleanup. Implementation is therefore approved under this Task Brief.

### B1: mapper, writer, report, and internal boundary

Allowed paths:

```text
docs/tasks/pr-06-shadow-canonical-writer.md
js/shadow/index.js
js/shadow/legacy-to-canonical.js
js/shadow/parity-report.js
js/shadow/shadow-canonical-writer.js
tests/shadow/shadow-canonical-writer.test.js
tests/shadow/shadow-boundaries.test.js
```

### B2: feature mode and real application insertion point

Additional allowed paths:

```text
js/app/feature-flags.js
js/app/main.js
tests/feature-flags.test.js
tests/shadow/shadow-app-integration.test.js
tests/consumers/summary-consumers.test.js
tests/consumers/run-plus-consumers.test.js
tests/legacy/demo-isolation.test.js
```

### B3: real-browser native ESM/CDP evidence

Additional allowed path:

```text
tests/shadow/shadow-writer-browser-smoke.html
```

The cumulative maximum allowlist is exactly 15 paths. Any sixteenth path must
first be added here with a concrete necessity proof before it is modified.
Allowlist guards must use this literal list; they must not derive scope from the
current diff, Git status, dynamic directory scans, or skip rules.

The thirteenth path was formally added before modification because the existing
summary-consumer suite compiles the marked `app/main.js` boundary with explicit
dependency injection. B2 adds two imported shadow composition dependencies inside
that boundary; the established regression suite must inject them to continue
proving Legacy return identity, Demo isolation, and zero provider fallback. A new
parallel test cannot replace that existing contract without weakening coverage.

The fourteenth and fifteenth paths were formally added before modification after
the first full-suite B2 run demonstrated that the existing Run Plus consumer and
Demo-isolation suites independently compile the same marked `main.js` boundary.
Their four failures were missing injected shadow composition symbols, not product
behavior failures. Both paths may only receive the same default no-shadow
dependency injection used by the established boundary compiler; their Run Plus,
Demo, Legacy cache, and provider-isolation assertions must remain unchanged.

## Prohibited scope

- Any public Repository export or eighth method; any Canonical Repository/read
  projection/cutover.
- IndexedDB database version, store, index, schema descriptor, migration, or
  backup-manifest contract changes.
- PR-07 Import Core, RawArtifact/ImportJob/ImportItem, decoder, Worker, identity,
  source UI, or local-first bootstrap work.
- Legacy cache deletion, overwrite, clearing, reverse write, or ownership change.
- Real credentials, account/profile state, private fixtures, provider network,
  or identifiable sports data.
- Page/tab/analysis algorithm, HTML/CSS/product UI, Service Worker, deployment,
  dependency, package, lockfile, Accepted ADR, or release-plan change.
- Logging raw payloads, errors, IDs, names, coordinates, health/power values,
  Authorization, Tokens, causes, or DOM report values.

## Test matrix

Deterministic synthetic offline Node coverage must include:

- mode matrix: legacy, shadow two-key enable, canonical, v2, unknown, accessor,
  Proxy, Demo;
- successful API batch mapping/write/read-back/parity and non-blocking Legacy
  return identity;
- accepted imported bundle write seam;
- validation, initialization, transaction/storage, conflict, verification, and
  parity failures;
- missing vs `null` vs zero for every numeric parity field and gear;
- opaque string, safe numeric, unsafe numeric, duplicate, retry, concurrent, and
  out-of-order IDs/events;
- partial batch continuation, Legacy cache/result unaffected, and Demo zero V2
  I/O;
- close barrier, enqueue-after-close, reload/new-writer already-present behavior;
- deterministic report ordering, export parseability, fixed field coverage, and
  absence of raw values/private sentinel strings;
- accessor/getter/Proxy/custom-prototype/cycle/symbol/non-finite fail-closed
  behavior before Canonical readwrite I/O;
- dependency, public export, schema, database-name, no-delete/clear, no-log, and
  exact allowlist guards.

The B3 browser harness must use a unique loopback origin and disposable browser
surface, native ESM, deterministic synthetic records, and actual browser
IndexedDB. It must exercise the `app/main.js` summary-session insertion point,
real PR-05 storage, reload/close, and report export. Before/after evidence must
cover network, provider endpoints, Authorization/Token, IndexedDB inventory,
synthetic Legacy-like sentinel bytes, Cache Storage, Service Workers, console,
uncaught errors, and external resources. It must close every connection and
server. Real user profile/data is prohibited.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/shadow/*.test.js
npm test
git diff --check
```

Exact-head pull-request CI must succeed. Node/fake IndexedDB evidence is labelled
Node/fake and never substituted for browser evidence.

## Migration, privacy, and rollback

PR-06 adds no physical migration. It may add or verify accepted bundles only in
the independent `strava-stats-v2` database. It never opens Legacy storage itself
and never deletes, clears, overwrites, or copies data into Legacy.

Rollback is code/flag-only: set the two-key shadow gate off or revert PR-06.
Retain both databases and all committed records. Do not clear V2 to resolve a
parity mismatch. Page reads remain Legacy before, during, and after rollback.

## Completion gate

After B1, B2, and B3, perform an independent Final Review against the exact base,
Task Brief, report privacy, mode behavior, lifecycle, and cumulative allowlist.
Fix every actionable finding through a minimal reproducer and rerun affected and
full gates. Only after the review returns `No actionable findings` and exact-head
CI succeeds may this Task Brief and PR body be closed and the PR marked Ready for
review. Do not merge, clean the branch/worktree, or begin M4.

## Final Review Closure

PR-06 implementation is complete on the assigned feature branch. The first
commit, `850ad1fe59a5351f6ac452867f243f9ce9fe0199`, contains only this Task Brief.
The implementation commit is
`24969f345204fb4ae6ee50ac85262f4ab43f4250` and changes exactly the 15 paths in
the cumulative allowlist above.

An independent read-only Final Review initially found four implementation
defects plus two missing matrix proofs: synchronous observer exceptions were not
isolated from Legacy success, arbitrary uppercase storage error codes could enter
the report, permissive date parsing could roll an impossible calendar date
forward, and the direct application flag boundary did not require the exact safe
shape; real-store conflict/parity and applicable missing/null/zero field states
also lacked explicit evidence. Minimal regressions reproduced all four defects
before correction. The fixes isolate the observer, whitelist frozen PR-05 storage
codes, strictly validate RFC3339 calendar and offset components, and require the
three exact enumerable feature-flag data properties. The added real PR-05 store
conflict test proves the existing Canonical row is retained while both
`STORAGE_FAILURE/CONFLICT` and `PARITY_MISMATCH` remain observable. The independent
delta review concluded: `No actionable findings`.

Final local verification after correction:

- `npm ci`: PASS;
- `npm run check:syntax`: PASS, 158 files;
- `npm run check:privacy`: PASS;
- `node --test tests/shadow/*.test.js`: PASS, 26/26;
- `npm test`: PASS, 1,044/1,044;
- `git diff --check` and the staged exact-path diff check: PASS.

Final browser evidence used the Codex in-app isolated browser surface at a fresh
loopback origin (`127.0.0.1:60218`), native application ESM, real browser
IndexedDB, the actual `app/main.js` insertion point, deterministic synthetic data,
close, and automatic reload. The post-reload result passed 12 final gates:
Canonical database version `1`, eight stores, one retained activity; the separate
synthetic Legacy-like sentinel remained version `3`, one store, one record with
unchanged bytes. First-load, reload, and aggregate counters were all zero for
external HTTP resources, provider resources/API, fetch, XHR, WebSocket,
Authorization, console errors/warnings, uncaught/unhandled errors, Service
Workers, and Cache Storage. Browser diagnostic logs were empty. The browser
binding exposed production build flavor and session IDs but no browser version;
no real profile, account, credential, Token, athlete record, or provider request
was used.

Exact implementation-head GitHub Actions CI passed at
`24969f345204fb4ae6ee50ac85262f4ab43f4250`: run `30960596218`, job
`92163453576`. The closing documentation commit receives its own final-head CI
before PR #12 is marked Ready.

There is no IndexedDB schema, version, store, index, migration, Repository public
API, or page-read cutover in this PR. Rollback remains code/flag-only: disable the
strict two-key shadow gate or revert PR-06 while retaining Legacy and Canonical
data. No database should be cleared. PR-06 stops here: no merge, branch/worktree
cleanup, or M4 work is authorized.
