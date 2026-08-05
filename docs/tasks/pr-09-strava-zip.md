# PR-09: Strava ZIP Archive

## Metadata

| Field | Value |
| --- | --- |
| Status | A2 complete / Task Brief publication pending |
| Milestone | M6 |
| Base branch | `integration/v2` |
| Exact base SHA | `fa336abfa5f3349234e5c08ef6d8fad7047bfbd4` |
| Feature branch | `codex/v2/strava-zip` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/d4a2/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-08 / PR #14 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Add one deterministic, bounded Strava archive ZIP container profile around the
existing PR-07/PR-08 import seams:

```text
synthetic Strava ZIP artifact
-> strict bounded central-directory inspection
-> exact root activities.csv recognition
-> CRC-verified stored/raw-DEFLATE extraction
-> one deterministic archive-row child RawArtifact per CSV row
-> existing activities.csv Decoder / Normalizer
-> existing exact duplicate and per-item Canonical transaction
-> persisted Import Log
-> summary-only Activities Preview
```

The archive-row child RawArtifact preserves the exact framed CSV row and, when
the CSV `Activity Filename` resolves safely, one opaque original activity child
payload. It is the existing ImportItem artifact and the existing
`ActivitySource.rawArtifactId` provenance target. FIT, TCX, GPX, and gzip payloads
are preserved as bytes encoded inside that local-only artifact, but this PR never
decodes them or fabricates streams, laps, events, devices, or capabilities.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `fa336abfa5f3349234e5c08ef6d8fad7047bfbd4`; local `integration/v2`,
  `origin/integration/v2`, and starting HEAD matched that SHA.
- GitHub PR #14 is closed and squash-merged. Its base/head were
  `integration/v2 <- codex/v2/activities-csv`, and its merge commit is the exact
  fixed base.
- Exact integration push CI run `30969548158` used event `push`, branch
  `integration/v2`, and the exact base SHA; it completed successfully.
- The merged M5 branch is absent locally and remotely, and no M5 worktree
  remains. The locked long-lived `integration/v2` worktree was not modified.
- Baseline `npm ci`: PASS; syntax: PASS for 177 files; privacy: PASS; full suite:
  PASS 1,104/1,104; `git diff --check`: PASS.
- No real archive, activity, account, Token, credential, route, location,
  heart-rate, power, private fixture, screenshot, or user browser profile was
  read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with base `integration/v2`. No
implementation path may be staged before that docs-only commit and Draft PR
exist.

## A2 read-only findings

### Existing Import and storage boundaries

- PR-07 owns the durable state machine, Worker client, DecoderRegistry,
  Normalizer, exact SHA decision, atomic per-item Canonical transaction, retry,
  cancel, reload, redacted report, and aggregate preview.
- PR-08 frames one CSV row into one RawArtifact/ImportItem. The English CSV
  decoder already produces the accepted nine-field summary-only bundle.
- Physical V2 remains version `2`, with exactly eleven stores and nine indexes.
  `rawArtifacts` has key `id` plus non-unique `bySha256`; ImportItem has one
  `artifactId`; RawArtifact has one nullable/committed `activityId`.
- A parent ZIP cannot be attached to many activities as one RawArtifact without
  changing the record graph. Persisting parent, CSV, and original activity as
  independent related records would require a new field, index, or public
  storage seam and is prohibited here.
- The existing shape can instead store one deterministic row-scoped compound
  child RawArtifact. Its JSON-safe content contains exact framed CSV text and at
  most one validated child descriptor/payload. Retry and reload therefore retain
  the association without adding a store, index, record field, Repository
  method, or public ImportService method.
- `importArtifacts()` already returns a Promise. Archive inspection can be made
  asynchronous internally while keeping its exact public method and artifact
  object shape (`mediaType`, `content`) unchanged. ZIP input is strict standard
  padded base64 text under one exact media type, avoiding a general binary public
  API expansion and keeping caller inputs descriptor-safe plain data.
- Archive inspection occurs before ImportJob creation, just like PR-08 lexical
  framing. Archive structural failure creates no job and no Canonical write.
  Once expansion succeeds, every CSV row remains an independent ImportItem and
  reuses all PR-07/08 state transitions.

### Platform and dependency decision

- The current production dependency graph has no ZIP library. Adding one would
  trigger the task pause condition.
- Node `v25.8.1` supports `DecompressionStream('deflate-raw')`.
- A disposable in-app Chromium `150.0.0.0` capability probe confirmed native
  `File`, module `Worker`, `ReadableStream`, stream cancellation, and
  `DecompressionStream('deflate-raw')`; the tab and loopback server were closed.
- The WHATWG Compression Standard defines `deflate-raw` as RFC 1951 DEFLATE and
  exposes the API in workers. PKWARE APPNOTE defines the local header, central
  directory, EOCD, CRC32, flags, ZIP64, and multi-disk structures used below.

Decision: use a small internal ZIP structure inspector plus the standard
`DecompressionStream('deflate-raw')`. Do not add a production dependency, use a
platform ZIP filesystem API, shell out, or implement a general archive library.
Stored method `0` and DEFLATE method `8` are the only accepted compression
methods.

### Exact ZIP profile

Input media type is exactly:

```text
application/zip;profile=strava-archive;base64
```

The `content` value is strict RFC 4648 standard padded base64 with no whitespace,
URL alphabet, ignored characters, or non-canonical padding. The decoded bytes
must be one ordinary single-disk ZIP with this literal profile:

- one EOCD at the physical end, no archive comment, no leading stub, no trailing
  bytes, no digital signature, no central-directory encryption;
- disk numbers zero, per-disk and total entry counts equal, and no split/spanned
  marker;
- no ZIP64 sentinel, ZIP64 locator/EOCD, data descriptor, encryption, patching,
  strong encryption, masked header, or unsupported general-purpose bit;
- methods only stored `0` and raw-DEFLATE `8`; DEFLATE level bits 1/2 are allowed
  only with method 8; UTF-8 bit 11 is allowed;
- local and central filenames must be byte-identical; flags, method, timestamp,
  CRC32, compressed size, uncompressed size, and empty extra fields must match;
- central and local records must parse to exact declared boundaries. Local
  header/data ranges are strictly increasing, non-overlapping, non-aliasing, and
  fill the bytes before the central directory without gaps;
- entry comments and extra fields are empty. This deliberately excludes ZIP64,
  Unicode-path extra fields, extended timestamps, UID/GID fields, and every
  unknown extension rather than partially interpreting them;
- directory entries end in `/`, have stored method, zero sizes, zero CRC, and no
  payload; they are validated then ignored;
- Unix entries are only regular files or directories. Symlink, socket, FIFO,
  block/character device, volume-label, and other special-file attributes fail;
- DOS entries reject volume-label/special attributes and require the directory
  bit to agree with the trailing slash. Other host systems fail closed.

Filename decoding is exact:

- bit 11 set: fatal UTF-8 decode, round-trip bytes, and NFC form are required;
- bit 11 clear: every byte must be printable ASCII `0x20..0x7e`;
- NUL/control characters, backslash, leading slash, `//`, drive prefix, UNC,
  empty segment, `.`/`..`, non-NFC text, and names exceeding the fixed limits
  fail;
- collision key is NFC name with locale-independent lowercase. Exact duplicate
  names and case-colliding names fail before extraction;
- nested archive suffixes `.zip`, `.zipx`, `.7z`, `.rar`, `.tar`, `.tgz`, and
  `.tar.gz` are prohibited case-insensitively.

The only accepted manifest is exact, case-sensitive root `activities.csv`.
Nested or renamed CSV is not recognized. Zero matches fails
`ZIP_ACTIVITIES_CSV_MISSING`; more than one exact/case-colliding manifest fails
`ZIP_ACTIVITIES_CSV_DUPLICATE`.

### Frozen archive limits and budgets

All limits are checked from central-directory metadata before entry allocation
or Canonical/IndexedDB work, then rechecked against actual streamed output:

```text
maximum decoded ZIP bytes              67,108,864
maximum entries                         10,000
maximum compressed bytes per entry     16,777,216
maximum uncompressed bytes per entry   16,777,216
maximum total uncompressed bytes      268,435,456
maximum per-entry compression ratio           100
maximum aggregate compression ratio           100
maximum directory depth                         4
maximum UTF-8 filename bytes                   240
maximum archive inspection wall time        10,000 ms
CRC/cancel/time check output quantum        65,536 bytes
```

Existing CSV limits remain authoritative after extraction, including maximum
5,242,880 CSV bytes and 10,000 data rows. A non-empty entry with zero compressed
bytes, a declared or actual ratio above 100, arithmetic overflow, size mismatch,
output beyond a declared size, or any limit breach fails before Canonical write.
The inspector yields between bounded quanta and checks a service-close cancel
latch. Closing during inspection returns stable `IMPORT_CANCELLED`; after a job
exists, `cancelJob` keeps the unchanged PR-07/08 behavior. There is no early
timeout that permits background extraction to continue.

### Activity Filename association

- The existing English profile recognizes one exact, case-sensitive optional
  header `Activity Filename`. It is provider input used only by the archive
  adapter and is never placed in Canonical data, a report, error, warning,
  evidence, DOM, or log.
- The cell is interpreted as an archive entry name using the same path rules. It
  must resolve by exact normalized name; the adapter never performs basename,
  suffix-only, fuzzy, locale, or filesystem lookup.
- The only association suffixes are `.fit`, `.tcx`, `.gpx`, `.fit.gz`,
  `.tcx.gz`, and `.gpx.gz`, case-insensitively. Bytes remain opaque and are not
  parsed or gunzipped.
- One archive entry may be referenced by at most one CSV row. Repeated reference,
  invalid path, missing entry, case-only/normalization ambiguity, and unsupported
  suffix do not read another entry and produce one stable row warning.
- An associated child descriptor contains only a fixed safe media token, exact
  raw SHA-256, original byte length, and strict base64 payload inside the
  row-scoped RawArtifact. The wrapper validator recomputes length/SHA before
  delegating exact CSV text to the existing `activitiesCsvDecoder`.
- The archive-row decoder appends only stable warning objects to the accepted
  bundle. Normalizer then attaches the row RawArtifact ID to the existing source.
  No filename, path, child hash, payload, or new top-level field enters Canonical.

Association warning codes are the literal set:

```text
ZIP_ACTIVITY_FILENAME_MISSING
ZIP_ACTIVITY_FILENAME_INVALID
ZIP_ACTIVITY_FILE_NOT_FOUND
ZIP_ACTIVITY_FILE_DUPLICATE
ZIP_ACTIVITY_FILE_AMBIGUOUS
ZIP_ACTIVITY_FILE_UNSUPPORTED
```

### Stable archive errors

New public error codes are the literal set:

```text
ZIP_INVALID_ENCODING
ZIP_INVALID
ZIP_UNSUPPORTED
ZIP_ENCRYPTED
ZIP_MULTI_DISK
ZIP64_UNSUPPORTED
ZIP_DATA_DESCRIPTOR_UNSUPPORTED
ZIP_PATH_INVALID
ZIP_DUPLICATE_ENTRY
ZIP_SPECIAL_FILE
ZIP_NESTED_ARCHIVE
ZIP_LIMIT_EXCEEDED
ZIP_BOMB_RISK
ZIP_CRC_MISMATCH
ZIP_ACTIVITIES_CSV_MISSING
ZIP_ACTIVITIES_CSV_DUPLICATE
ZIP_DECOMPRESSION_FAILED
ZIP_TIME_BUDGET_EXCEEDED
```

All messages are fixed and redacted. Errors never retain a raw cause, platform
message, filename/path, payload, entry offset, CRC, size, ID, Token, location,
heart-rate, or power value. Unsafe reflection and platform failures map to a
stable code without inspecting hostile properties.

## A3 decision

The vertical slice fits the existing physical V2 schema and internal Import
seams. It requires no production dependency, physical/store/index migration,
RawArtifact record field, Accepted Canonical change, Repository method, public
ImportService method, aggregate Import Core export, production page, Feature
Flag, Service Worker, or deployment change. Implementation is authorized under
the literal allowlist below after the docs-only Draft PR gate.

## Approved implementation allowlist

### B1: ZIP structure, extraction, association, and delegated decoder

```text
docs/tasks/pr-09-strava-zip.md
js/import/AGENTS.md
js/import/errors.js
js/import/activities-csv-decoder.js
js/import/zip-inspector.js
js/import/strava-zip.js
js/import/synthetic-import-worker.js
tests/fixtures/synthetic/strava/archive-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/import/strava-zip.test.js
tests/import/import-worker.test.js
```

### B2: archive expansion and existing Import/storage integration

```text
docs/tasks/pr-09-strava-zip.md
js/import/import-service.js
js/storage/import-store.js
tests/import/import-core.test.js
tests/import/import-boundaries.test.js
tests/storage/indexeddb-v2-boundaries.test.js
```

`js/storage/import-store.js` may only accept the row-scoped archive child media
type. It may not add a method, field, store, index, migration, transaction store,
or change the existing Synthetic JSON/CSV behavior.

### B3: real-browser vertical slice

```text
docs/tasks/pr-09-strava-zip.md
tests/import/import-browser-smoke.html
```

### B4: historical fixed-source compatibility

```text
tests/shadow/shadow-boundaries.test.js
```

Necessity: the PR-06/07/08 guards intentionally freeze reviewed Import/storage
sources and the prior PR allowlists. PR-09 is the next authorized owner of the
internal archive modules and exact media allowlist. Fixed expectations may move
only to the literal PR-09 contract; guards may not be removed, weakened,
skipped, or generated from the current diff.

The cumulative maximum is exactly 18 paths. A nineteenth path requires a
necessity record here before modification. Scope checks use this literal list,
never the current diff, a glob, a skip, or a generated expected value.

## Prohibited scope

- Any production dependency, package/lockfile, database version/store/index/
  keyPath/migration, existing record field, Accepted Canonical/ADR/PRD/plan,
  Repository export/method, or aggregate/public Import API expansion.
- FIT/TCX/GPX/XML/gzip decoding; streams/laps/events/devices; fuzzy duplicate;
  merge/review; analysis enqueue; Source Manager; Import Dialog; bootstrap;
  page cutover; backup/restore; Service Worker; deployment; cleanup.
- Dynamic allowlists, silent archive recovery, path sanitization by rewriting,
  lossy filename fallback, implicit locale/filesystem lookup, partial CRC, or
  continuing after an archive safety failure.
- Actual Legacy database access, deletion, clearing, downgrade, overwrite,
  reverse copy, or rollback by data removal.
- Real Strava archive/CSV/activity files, credentials, accounts, Tokens, GPS,
  locations, heart-rate/power history, exports, screenshots, private fixtures,
  user profiles, provider traffic, or network-backed tests.

## Test matrix

Deterministic code-generated synthetic ZIP coverage must prove:

- stored and platform raw-DEFLATE success, strict base64, CRC mismatch, truncated
  EOCD/central/local headers, spoofed signature, size mismatch, trailing/leading
  bytes, gaps, overlap, alias, and duplicate local offset;
- ZIP64 sentinels/records, data descriptor, unsupported method/flags/extra field,
  encrypted/masked/strong-encrypted entries, split/multi-disk, comments, and
  unsupported host attributes;
- path traversal, absolute/drive/UNC, backslash, NUL/control/non-NFC, dot/empty
  segments, duplicate/case collision, symlink/special file, nested archives;
- entry/count/compressed/uncompressed/total/ratio/depth/name/time/cancel limits,
  declared-vs-actual output, no oversized retained allocation, and zero
  Canonical/IndexedDB work on archive-level failure;
- exact root activities.csv, missing/duplicate/nested manifest, existing quoted
  CSV behavior, and no copy of CSV parsing logic;
- exact `Activity Filename` association for six suffixes; missing/empty,
  duplicate reference, invalid, case ambiguity, not found, and unsupported type;
- one row per ImportItem, invalid-row isolation, wrapper validation, raw child
  SHA/length/base64 preservation, no FIT/TCX/GPX/gzip decode, and empty detail
  collections/capabilities;
- same ZIP, repeated ZIP, concurrent ZIP, direct/repeated CSV, exact identity
  conflict, cancel, service-close during inspection, Worker crash/retry, reload,
  quota/abort, Import Log, and Preview with no second Canonical activity;
- hostile artifact/decoder/Worker/store inputs, accessors, revoked/throwing
  Proxies, reflection failure, input non-mutation, frozen detached results,
  opaque leading-zero IDs, and stable redaction;
- exact aggregate exports, Repository seven methods, physical eleven stores/nine
  indexes, exact 18-path scope, and Legacy/API/Token/SW non-impact.

The Browser/CDP harness uses a fresh loopback origin and disposable in-app
browser. It code-generates a small synthetic ZIP, constructs a native `File`,
reads bytes, encodes the exact ZIP media input, uses native ESM, platform raw
DEFLATE, a module Worker, Web Crypto, and real IndexedDB. First load imports the
archive; automatic reload proves Import Log and Preview persistence; exact
re-import skips every row without another Canonical activity. It records only
safe codes/counts and proves first-load/reload/aggregate zero external/provider/
auth traffic, Authorization/Token observations, console warning/error,
uncaught/unhandled failure, Service Workers, and Cache Storage. It closes every
connection, page, browser surface, server, and port.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/import/*.test.js
node --test tests/storage/*.test.js
node --test tests/shadow/*.test.js
npm test
git diff --check
```

Exact implementation and closure heads must pass pull-request CI. Node/fake
IndexedDB evidence is never described as real-browser persistence, quota, crash,
or cross-browser evidence.

## Privacy, migration, rollback, and limitations

Only deterministic code-generated synthetic ZIP/CSV/child bytes are used. Raw
wrapper payload remains local in V2 and is absent from public reports, errors,
warnings, logs, DOM, evidence, and PR text. The actual Legacy database and user
browser profile are never opened.

There is no physical or data migration. Existing V2 records and APIs remain
valid. Rollback is code-only: stop new ZIP imports, close V2, and revert PR-09
while retaining every V2 and Legacy record. Never downgrade, clear, overwrite,
delete, or reverse-copy data.

Intentional limitations: exact root English `activities.csv`; strict ZIP subset;
64 MiB compressed / 256 MiB expanded budget; one safe row-scoped original child;
opaque preservation only for FIT/TCX/GPX and their `.gz` forms. Additional ZIP
extensions, larger-archive performance, locale profiles, decoders, UI, cutover,
analysis, and real-user archive compatibility remain future separately approved
work.

## Completion gate

After B1-B3, independently review each archive risk surface, exact-base diff,
public/storage boundaries, duplicate/recovery behavior, redaction, browser
evidence, and literal allowlist. Reproduce every actionable defect with a
minimal failing test before repair. Only after no actionable findings, all local
gates, complete Closure, clean worktree, local/upstream `0/0`, and exact-head CI
success may the Draft PR move to Ready for review.

Do not merge, modify `integration/v2`, clean the PR-09 branch/worktree, or start
M7.
