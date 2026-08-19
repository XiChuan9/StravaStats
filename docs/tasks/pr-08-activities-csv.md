# PR-08: Strava `activities.csv` Decoder

## Metadata

| Field | Value |
| --- | --- |
| Status | Final Review complete / closure-head CI pending |
| Milestone | M5 |
| Base branch | `integration/v2` |
| Exact base SHA | `8247c03fbaa57b614374b23bb196c44bb824b204` |
| Feature branch | `codex/v2/activities-csv` |
| Worktree | `<worktree-root>/<task-name>` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-07 / PR #13 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Add one deterministic English Strava `activities.csv` profile to the PR-07
Import Core without changing the physical V2 schema, Accepted Canonical
contracts, Repository surface, feature-flag defaults, or any production page:

```text
synthetic activities.csv artifact
-> bounded UTF-8/CSV framing
-> deterministic per-row CSV artifacts
-> DecoderRegistry / activities-csv decoder
-> descriptor-safe header and field mapping
-> Normalizer / validateImportedActivityBundle
-> exact raw SHA and deterministic Strava external identity
-> per-row Canonical transaction
-> persisted Import Log
-> summary-only Activities Preview
```

Each data row becomes one `ImportItem` and, when valid and non-duplicate, one
summary-only Canonical activity. A bad semantic row does not roll back an earlier
or later successful row. This PR never fabricates streams, laps, events, devices,
GPS, heart-rate, power, cadence, or lap capabilities.

## A0 baseline evidence

- The assigned worktree began detached and clean at the exact fixed base
  `8247c03fbaa57b614374b23bb196c44bb824b204`; local and
  `origin/integration/v2` matched that SHA.
- GitHub PR #13 is closed and merged by squash. Its merge commit is the exact
  fixed base and its base/head were
  `integration/v2 <- codex/v2/import-core`.
- The exact integration push CI run `30965834678` completed successfully.
- The merged M4 feature branch is absent locally and remotely, and no M4
  worktree remains. The locked long-lived `integration/v2` worktree was not
  modified.
- Baseline gates: `npm ci` PASS; syntax PASS for 174 files; privacy PASS;
  full suite PASS 1,078/1,078; `git diff --check` PASS.
- The fixed feature branch was created at the exact base. No real archive,
  activity, account, credential, Token, route, location, health record, private
  fixture, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR targeting `integration/v2`. No
implementation path may be staged before the docs-only commit and Draft PR
exist.

## A2 read-only findings

### Existing Import Core boundary

- PR-07 owns the durable `ImportJob`, `ImportItem`, and `RawArtifact` records,
  the PRD state machine, Worker client, DecoderRegistry, Normalizer, exact
  raw-artifact duplicate decision, per-item Canonical transaction, redacted
  report, reload/retry/cancel behavior, and aggregate preview.
- Physical IndexedDB v2 has eleven stores and nine indexes. The import stores are
  exactly `rawArtifacts.bySha256`, `importJobs.byCreatedAt`, and
  `importItems.byJobId`. No new store or index is required by CSV.
- The only Canonical write input remains the Accepted nine-field
  `ImportedActivityBundle`, and every write must pass
  `validateImportedActivityBundle`.
- `createImportService.importArtifacts()` currently accepts one artifact per
  item and PR-07 hard-codes the Synthetic JSON media type. The storage validator
  likewise accepts only that media type. These are the narrow extension points
  for PR-08.
- A `RawArtifact` has one committed `activityId`. Therefore one CSV file cannot
  be stored once and then attached to many activities without a schema change.
  PR-08 instead frames the bounded CSV into deterministic one-header/one-row CSV
  artifacts before job creation. Every framed row then uses the unchanged
  one-artifact/one-item/one-activity transaction model.
- File-level lexical failures are fail-closed before job creation because an
  unterminated quoted field may make later row boundaries unknowable. Once
  framing succeeds, header, date, type, identity, and numeric failures are
  isolated per row.
- Canonical IDs derived from the provider namespace plus the opaque external ID
  make exact source identity deterministic without a new index. Same raw row SHA
  is `skipped_exact_duplicate`; same Strava external ID with different raw row
  content reaches a Canonical conflict and becomes an explicit exact-identity
  conflict. Nothing is fuzzily matched or overwritten.

### Supported English header profile

PR-08 supports only the literal English profile below. Header matching is exact,
case-sensitive, BOM-free after the tokenizer removes one leading UTF-8 BOM, and
does not trim or locale-fold names. A decoder factory accepts a descriptor-safe
profile so later work can register another tested locale without modifying CSV
tokenization. This PR registers only the frozen English profile and makes no
all-language claim.

| Canonical target | Header selection | Presence | Raw unit |
| --- | --- | --- | --- |
| source `externalId` | `Activity ID` occurrence 1 | required | opaque text |
| `startTimeUtc` | `Activity Date` occurrence 1 | required | English archive date interpreted as UTC |
| sport mapping | `Activity Type` occurrence 1 | required | exact English text |
| `name` | `Activity Name` occurrence 1 | optional | text |
| `elapsedTimeSeconds` | `Elapsed Time` occurrence 2, else 1 | optional | seconds |
| `movingTimeSeconds` | `Moving Time` occurrence 1 | optional | seconds |
| `distanceMeters` | `Distance` occurrence 2, else 1 | optional | kilometres |
| `elevationGainMeters` | `Elevation Gain` occurrence 1 | optional | metres |
| `averageHeartRateBpm` | `Average Heart Rate` occurrence 1 | optional | bpm |
| `averagePowerWatts` | `Average Watts` occurrence 1 | optional | watts |
| `averageCadence` | `Average Cadence` occurrence 1 | optional | rpm/strokes per minute |
| `timeZone` | `Activity Time Zone` occurrence 1 | optional | fixed offset plus optional IANA name |

Strava's known repeated `Elapsed Time` and `Distance` columns are occurrence
mapped, not silently deduplicated. A third occurrence, a duplicate of any other
mapped header, or duplicate required identity/date/type headers is ambiguous and
fails that row with a stable header error. Unmapped extra headers are ignored
with one stable warning and are never copied into Canonical extensions, errors,
reports, logs, or the DOM.

The registered sport mapping is literal and reuses the source-neutral variants
already established by the Canonical/shadow contracts:

```text
Run -> run/null
Trail Run -> run/trail-run
Virtual Run -> run/virtual-run
Ride -> ride/null
Mountain Bike Ride -> ride/mountain-bike
Gravel Ride -> ride/gravel
Virtual Ride -> ride/virtual
Indoor Ride -> ride/indoor
E-Bike Ride -> ride/e-bike
E-Mountain Bike Ride -> ride/e-mountain-bike
Swim -> swim/null
Pool Swim -> swim/pool
Open Water Swim -> swim/open-water
Walk -> walk/null
Hike -> hike/null
Workout -> workout/null
Weight Training -> workout/strength
Crossfit -> workout/cross-training
Elliptical -> workout/elliptical
Stair Stepper -> workout/stair-stepper
Yoga -> workout/yoga
Pilates -> workout/pilates
High Intensity Interval Training -> workout/hiit
Alpine Ski -> winter/alpine-ski
Nordic Ski -> winter/nordic-ski
Snowboard -> winter/snowboard
Snowshoe -> winter/snowshoe
Soccer -> team/football
Football -> team/football
Basketball -> team/basketball
Volleyball -> team/volleyball
Tennis -> racket/tennis
Badminton -> racket/badminton
Pickleball -> racket/pickleball
Padel -> racket/padel
Racquetball -> racket/racquetball
Squash -> racket/squash
Table Tennis -> racket/table-tennis
```

### CSV grammar and safety limits

The parser accepts UTF-8 text with an optional single leading BOM, LF or CRLF,
RFC-4180-style quoted fields, escaped double quotes, embedded commas, and
embedded CRLF/LF inside quoted fields. It does not evaluate formulas, dereference
links, fetch URLs, interpret HTML, access the DOM, open storage, or log.

Framing validates the whole file, then preserves lexical identity: each row
artifact is the optional original BOM plus the original header record (including
its line ending) plus the original logical data record (including its line
ending when present). It never parse-and-reserializes a row before SHA-256.
Therefore alternative quoting or line endings remain different raw hashes and
reach the exact external-identity conflict path instead of becoming a fuzzy
duplicate. Ignored blank physical records have no activity identity and are not
attached to a framed row.

The frozen limits are:

```text
maximum UTF-8 bytes        5,242,880
maximum data rows          10,000
maximum columns            128
maximum UTF-8 bytes/field  262,144
maximum UTF-8 bytes/row    1,048,576
```

NUL, replacement character U+FFFD, unpaired UTF-16 surrogates, forbidden C0
controls other than TAB/LF/CR, bare CR record separators, malformed quoting,
column-count mismatch, an empty file, a header-only file, and every exceeded
limit fail closed. The byte-oriented helper uses fatal UTF-8 decoding; string
inputs apply the same forbidden-character checks.

### Date, time zone, numeric, and missing-value contract

- `Activity Date` accepts only the English month grammar
  `Mon DD, YYYY, h:mm:ss AM|PM` and the strict ISO UTC forms
  `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ`. Calendar components are
  validated explicitly, then constructed with `Date.UTC`; parsing never depends
  on host locale or host time zone.
- The archive English date is interpreted as a UTC wall-clock instant because
  the frozen project corpus contains no authoritative offset for that column.
  Missing time-zone metadata produces `{ ianaName: null,
  utcOffsetMinutes: null }` plus `CSV_TIMEZONE_UNAVAILABLE`. A present time-zone
  field is accepted only when its fixed offset and optional IANA-format suffix
  are internally valid; it never consults host tzdb.
- Unit conversions use only `KILOMETRES_TO_METRES = 1000`; seconds, metres, bpm,
  watts, and cadence are identity units. No speed, calorie, route, sensor,
  temperature, or derived value is invented.
- A missing optional header omits the Canonical summary field and emits
  `CSV_OPTIONAL_HEADER_MISSING`. A present empty cell maps to explicit `null`.
  Text `0` maps to numeric zero. Every other numeric cell must match the frozen
  decimal grammar, convert to a finite number, and satisfy the Canonical range
  rules. There is no truthy coercion, `parseInt`, unit guessing, default zero, or
  calculation from another field.
- `movingTimeSeconds > elapsedTimeSeconds`, heart rate outside the Accepted
  Canonical range, negative non-negative fields, non-finite values, or a unit
  marker in a numeric cell fail only that row.

### Identity, sport, provenance, and summary-only bundle

- External activity ID is the exact non-empty trimmed cell string and is never
  parsed or used arithmetically. Leading zeros and URL-special characters remain
  significant.
- Canonical activity ID and source ID are deterministic opaque strings derived
  by prefixing and percent-encoding the exact external ID. Percent-encoding is
  reversible and prevents delimiter ambiguity; it is not numeric normalization.
- Source is exactly `provider: "strava"`,
  `acquisitionMethod: "archive-csv"`, the exact external ID, current row
  `rawArtifactId`, no device ID, and a deterministic `importedAt` equal to the
  normalized activity instant. A stable provenance warning states that this is
  a deterministic fallback rather than an observed acquisition time.
- Registered English sports map to the Accepted ten categories and normalized
  variants. Plain Run/Ride/Swim/Walk/Hike map to their category with null
  variant. Known variants map deterministically. Unknown or blank optional
  variants map to `other`/null plus `CSV_UNKNOWN_SPORT_TYPE`; they never fail the
  batch or invent a provider-specific Canonical top-level field.
- Every bundle has `streams: { activityId, series: [] }`, empty laps/events/
  devices, five false capabilities, fixed parser/normalizer versions, and no
  fabricated detail. Summary HR/power/cadence values do not imply stream
  capabilities.

### Stable errors and warnings

New public error codes are the literal set:

```text
CSV_INVALID_ENCODING
CSV_INVALID_CHARACTER
CSV_TOO_LARGE
CSV_TOO_MANY_ROWS
CSV_TOO_MANY_COLUMNS
CSV_FIELD_TOO_LARGE
CSV_ROW_TOO_LARGE
CSV_MALFORMED
CSV_HEADER_INVALID
CSV_COLUMN_MISMATCH
CSV_ACTIVITY_ID_INVALID
CSV_DATE_INVALID
CSV_NUMBER_INVALID
CSV_UNIT_INVALID
EXACT_IDENTITY_CONFLICT
```

New bundle warning codes are the literal set:

```text
CSV_OPTIONAL_HEADER_MISSING
CSV_EXTRA_HEADER_IGNORED
CSV_TIMEZONE_UNAVAILABLE
CSV_UNKNOWN_SPORT_TYPE
CSV_IMPORT_TIME_FALLBACK
```

Messages and paths are static and redacted. Errors, reports, logs, DOM, browser
evidence, and CI output never contain CSV text, header values, names, activity/
source/raw IDs, filenames, locations, health/power values, causes, URLs, Tokens,
or Authorization.

## A3 decision

The vertical slice fits the accepted Import Core, physical v2, and Canonical
contracts. It needs no new store/index/version, Repository method, Canonical
schema field, production dependency, production page, or feature default.
Implementation is authorized under the literal allowlist below.

### B1: tokenizer, decoder, mapping, and Worker registry

The CSV tokenizer/decoder remain import-submodule seams. The aggregate
`js/import/index.js` export set stays byte-for-byte at the PR-07 contract; no new
Repository method or public Import Core method is introduced.

```text
docs/tasks/pr-08-activities-csv.md
js/import/AGENTS.md
js/import/index.js
js/import/errors.js
js/import/csv-tokenizer.js
js/import/activities-csv-decoder.js
js/import/synthetic-import-worker.js
tests/fixtures/synthetic/strava/activities.csv
tests/fixtures/synthetic/strava/README.md
tests/import/activities-csv.test.js
tests/import/import-worker.test.js
```

### B2: per-row Import Core and exact identity storage integration

```text
docs/tasks/pr-08-activities-csv.md
js/import/import-service.js
js/storage/import-store.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/storage/indexeddb-v2-boundaries.test.js
```

`js/storage/import-store.js` may only extend the frozen RawArtifact media-type
allowlist to the CSV profile; it may not change record fields, stores, indexes,
transactions, or expose another method. Exact external identity remains enforced
by deterministic Canonical IDs and the existing atomic Canonical conflict path.

### B3: real-browser vertical slice

```text
docs/tasks/pr-08-activities-csv.md
tests/import/import-browser-smoke.html
```

### B4: historical frozen-source compatibility

```text
tests/shadow/shadow-boundaries.test.js
```

Necessity: PR-06/07 intentionally freeze the reviewed import/storage public
surface and source hashes. PR-08 is the authorized next owner of the CSV decoder
and RawArtifact media-type extension. Fixed expectations may move only to the
new literal PR-08 contract; guards may not be removed, weakened, skipped, or
generated from the current diff.

The cumulative maximum is exactly the 18 paths above. A nineteenth path requires
a necessity record here before modification. Scope checks use this literal list,
never the current diff, a directory glob, dynamic expected values, or a bypass.

## Prohibited scope

- Any database version/store/index/keyPath/migration or existing record-field
  change; any Legacy database operation; deletion, clearing, downgrade, restore,
  cleanup, reverse copy, or overwrite-as-recovery.
- Any Accepted Canonical contract, ADR, PRD, development plan, Repository export
  or eighth method, Factory mode, production page/tab/analysis/UI, Source
  Manager, Import Dialog, bootstrap, cutover, feature default, Service Worker,
  cache, deployment, workflow, package, lockfile, or production dependency.
- ZIP, archive traversal, FIT, TCX, GPX, XML, API import, source management,
  fuzzy duplicate, auto-merge, merge review, analysis enqueue, backup/restore,
  or real-file performance claims.
- All locale profiles except the registered frozen English profile.
- Real archives, credentials, accounts, Tokens, private activities, GPS tracks,
  health/power history, exports, screenshots, private fixtures, user browser
  profiles, provider traffic, or network-backed tests.

## Test matrix

Deterministic Node/fake IndexedDB coverage must prove:

- BOM, LF/CRLF, quoted comma/newline, escaped quote, formula-like text treated as
  inert text, known repeated headers, ambiguous duplicate headers, missing
  required/optional headers, extra headers, empty lines, empty/header-only files;
- byte/row/column/field/row limits, fatal invalid UTF-8, replacement/NUL/control/
  surrogate rejection, bare CR, malformed quote, and column mismatch;
- strict English/ISO dates across host time zones, impossible dates, AM/PM
  boundaries, absent/valid/invalid time zone, explicit unit constants, finite
  decimals, negative values, unit-bearing cells, and moving/elapsed relation;
- absent header vs empty/null cell vs zero vs value, leading-zero and URL-special
  opaque IDs, deterministic Canonical/source IDs, known sport variants and
  unknown sport warnings;
- summary-only empty streams/laps/events/devices and all-false capabilities even
  when average HR, power, or cadence exists;
- one CSV with valid/invalid/valid rows, per-row ImportItems, committed-item
  retention, exact row SHA duplicate, repeated file, concurrent repeated file,
  same external ID/different row conflict, and no second Canonical activity;
- cancel at every existing boundary, Worker crash/explicit retry, reload/log,
  quota/abort rollback, and PR-07 Synthetic JSON behavior unchanged;
- hostile artifact/profile/decoder/Worker/store accessors and Proxies, getter
  count zero, input non-mutation, frozen detached results, and stable redaction;
- exact public exports, literal decoder/media/header/error/warning allowlists,
  Repository seven methods, physical eleven stores/nine indexes, Legacy/API/
  Token/Service Worker non-impact, and exact 18-path scope.

The Browser/CDP harness uses a fresh loopback origin and a disposable in-app
browser surface. It constructs one synthetic `File`, obtains bytes, performs
fatal UTF-8 decode, uses native ESM, an actual module Worker, Web Crypto SHA-256,
real browser IndexedDB, first-load import, automatic reload, Import Log,
summary-only Preview, and exact duplicate re-import. It records only safe
counts/codes and proves first-load/reload/aggregate zero external/provider/auth
traffic, Token/Authorization observations, console warning/error, uncaught or
unhandled failure, Service Workers, and Cache Storage. It inventories only safe
store/index/count metadata and a synthetic Legacy-like sentinel, closes all
database connections/tabs, and stops the server and port.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/import/*.test.js
node --test tests/storage/*.test.js
npm test
git diff --check
```

Exact implementation and closure heads must pass pull-request CI. Node/fake
IndexedDB evidence is never labelled browser persistence, browser quota, or
browser crash evidence.

## Privacy, migration, and rollback

Only small deterministic synthetic CSV is committed or used in browser tests.
No row content is copied into reports, logs, DOM, evidence, or PR text. Raw row
artifacts remain local in the independent V2 database. The actual Legacy
database is never opened by PR-08.

There is no physical migration. Existing V2 records remain valid; only the
frozen RawArtifact media-type validation accepts the additional CSV profile.
Every Canonical write remains an existing atomic per-item transaction. Failure,
cancel, retry, reload, quota, and abort retain already committed items.

Rollback is code/flag-only: stop new CSV imports, close V2 connections, and
revert PR-08 while retaining all V2 RawArtifacts, Import Logs, Canonical rows,
and all Legacy data. Never downgrade, clear, overwrite, delete, or reverse-copy
either database. Existing pages remain Legacy before, during, and after rollback.

## Completion gate

After B1-B3, independently review the exact-base diff, CSV state machine and
limits, header/date/unit/identity contracts, one-file/many-item isolation,
storage atomicity, duplicate/conflict behavior, Worker lifecycle, redaction,
browser evidence, and literal allowlist. Reproduce each actionable defect with a
minimal failing test before fixing it. Only after `No actionable findings`, all
local gates, clean Git state, local/upstream `0/0`, complete Task Brief/PR body
Closure, and exact-head CI success may the Draft PR move to Ready for review.

Do not merge, modify `integration/v2`, clean the task branch/worktree, or start
M6.

## Final Review Closure

### Delivered behavior

- The frozen English `activities.csv` profile now enters the existing
  DecoderRegistry/Worker/Normalizer pipeline as one lexically exact framed
  artifact and ImportItem per logical data row.
- UTF-8 fatal decoding, BOM, CRLF/LF, RFC-4180 quoting, escaped quotes, embedded
  commas/newlines, forbidden characters, and every frozen byte/row/column/field
  limit are deterministic and fail closed.
- Header occurrence mapping, UTC-only date parsing, fixed time-zone metadata,
  `KILOMETRES_TO_METRES = 1000`, finite numeric rules, missing/null/zero/value,
  opaque external identity, sport taxonomy, and five stable warning classes are
  frozen by tests.
- Valid rows become Accepted summary-only ImportedActivityBundles with empty
  streams/laps/events/devices and all-false detail capabilities. Invalid rows are
  isolated; successful siblings remain committed.
- Exact raw SHA repetition, concurrent first import, external-identity conflict,
  cancel, Worker crash/retry, reload, quota/abort, Import Log, and Activities
  Preview reuse the PR-07 contracts. No fuzzy match or automatic merge exists.

### Review audit

The exact-base implementation received a separate read-only Final Review over
CSV framing, public boundaries, identity, mapping, storage, privacy, and browser
state. Review findings were reproduced before repair:

1. browser harness top-level control flow produced an illegal `return`;
2. an all-empty comma-delimited record was incorrectly discarded as a blank
   physical line;
3. parse-and-reserialize framing collapsed lexically different rows to one raw
   SHA;
4. several sport variants did not reuse established source-neutral mappings;
5. aggregate Import Core exports had expanded despite the frozen public API.

Each was corrected locally and reverified. Final disposition: **No actionable
findings**. The aggregate Import Core exports and Repository seven-method API
remain exact; physical V2 remains eleven stores and nine indexes. Actual changes
occupy fifteen of the literal eighteen allowed paths.

### Verification evidence

- `npm ci` — PASS, six packages installed from the existing lockfile.
- `npm run check:syntax` — PASS, 177 files.
- `npm run check:privacy` — PASS.
- `node --test tests/import/*.test.js` — PASS, 57/57.
- `node --test tests/storage/*.test.js` — PASS, 54/54.
- `node --test tests/shadow/*.test.js` — PASS, 26/26.
- `npm test` — PASS, 1,104/1,104.
- `git diff --check` — PASS.
- Implementation commit `4b1de117ae1bc740c35197ff58b37480e3645209`
  — exact-head GitHub Actions CI run `30968842485` succeeded.

The final disposable in-app-browser run used only the deterministic synthetic
fixture, native `File`, fatal byte decode, module Worker, Web Crypto, and real
IndexedDB on a fresh loopback origin. First load completed two of two rows with
two summary activities; automatic reload preserved two Import Log entries and
the Preview; exact re-import skipped two of two with activity/raw-artifact
counts unchanged at two. Streams, laps, events, and devices stayed at zero.
External/provider/auth requests, console warnings/errors, uncaught/unhandled
failures, XHR, WebSocket, Service Workers, and Cache Storage were all zero. The
synthetic Legacy-like sentinel was unchanged. All browser pages/connections and
loopback servers/ports were closed.

### Privacy, migration, rollback, and limitations

No real archive, account, credential, Token, private activity, route, location,
health history, screenshot, private fixture, or user browser profile was used or
committed. Public errors, warnings, reports, logs, browser DOM, and evidence
contain only stable codes and aggregate metadata.

There is no physical/data migration, new store/index/version, Canonical schema
change, Repository/public Import Core method, production dependency, page
cutover, Service Worker, or Legacy database operation. Rollback remains
code-only and retains every Legacy and V2 record; nothing is cleared,
overwritten, reverse-copied, or downgraded.

Intentional limitations are the frozen English header profile and summary-only
activities. ZIP/FIT/TCX/GPX, additional locales, source UI, bootstrap/cutover,
analysis enqueue, fuzzy duplicate, backup/restore, deployment, and M6 remain out
of scope. The commit containing this Closure must receive exact-head CI success,
and the PR body must record that immutable result before Ready for review.
