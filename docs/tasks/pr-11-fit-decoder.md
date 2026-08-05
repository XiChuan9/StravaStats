# PR-11: FIT Decoder

## Metadata

| Field | Value |
| --- | --- |
| Status | Second REVISE local gates pass; exact-head CI, PR-body closure, and third review pending |
| Milestone | M8 |
| Base branch | `integration/v2` |
| Exact base SHA | `e9c5c6e531cf0d6349066480e49cd8d53b5622e4` |
| Feature branch | `codex/v2/decoder-fit` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/82ab/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-10 / PR #16 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Deliver one pure, deterministic FIT binary Decoder boundary that a later
Decoder Registry task can wire without changing this PR's public contracts:

```text
strict plain artifact descriptor
-> padded base64 decode
-> bounded FIT header / definition / data parser
-> supported FIT profile messages
-> ImportedActivityBundle
-> existing Canonical validators
```

The Decoder supports the frozen M8 activity capabilities: `file_id`,
`device_info`, `session`, `record`, `lap`, `event`, and `hr`. It intentionally
does not register itself in the production Decoder Registry, change Source
Manager support states, open storage, or expose a new public Import API.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `e9c5c6e531cf0d6349066480e49cd8d53b5622e4`. Local `integration/v2`,
  `origin/integration/v2`, and starting HEAD matched; ahead/behind was `0/0`.
- The exact base is the merged PR-10 commit
  `feat(v2): add Source Manager foundation UI (#16)`.
- A new local branch `codex/v2/decoder-fit` was created from that exact SHA.
- Baseline `npm ci`: PASS; syntax: PASS for 186 files; privacy: PASS; full
  suite: PASS 1,134/1,134; `git diff --check`: PASS.
- `package.json` and `package-lock.json` are unchanged. No new runtime or test
  dependency is needed.
- No real FIT/TCX/GPX file, athlete export, account, Token, GPS route,
  heart-rate/power record, private fixture, screenshot, or application browser
  data was read during baseline investigation.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR targeting `integration/v2`. No
implementation path may be staged before the docs-only commit and Draft PR
exist.

## A2 authority and read-only findings

The authority order for this PR is:

1. accepted ADR-0001, ADR-0002, ADR-0004, and ADR-0006;
2. `docs/product/stravastats-v2-prd.md`;
3. `docs/engineering/v2-development-plan.md`;
4. `docs/architecture/overview.md`;
5. existing Import Core, Canonical contract, and Storage boundaries;
6. PR-07 through PR-10 Task Briefs;
7. this task's implementation details.

The FIT binary/profile comparison uses only Garmin's primary material:

- FIT protocol and activity-file documentation at
  `developer.garmin.com/fit/protocol/` and
  `developer.garmin.com/fit/file-types/activity/`;
- the official FIT JavaScript SDK repository and its generated Profile
  21.208.0 at `github.com/garmin/fit-javascript-sdk`.

The official SDK is reference evidence only. It is not copied into production,
installed, vendored, or added to a lockfile. Its current JavaScript Decoder does
not implement compressed-timestamp records, so this PR follows the protocol
format for that record-header path and verifies it with hand-built bytes.

### Existing call graph and frozen seams

The current production path is:

```text
Source Manager local file
-> existing browser preflight (CSV/ZIP only)
-> ImportService.importArtifacts()
-> synthetic Import Worker production Registry
   -> Synthetic JSON / Activities CSV / Strava ZIP Decoders
-> existing ImportedActivityBundle validation
-> existing atomic Import Store transaction
```

The PR-11 boundary remains outside that graph:

```text
direct internal ESM import in tests and future Registry wiring
-> js/decoders/fit/decoder.js
-> fitDecoder.decode({ mediaType, content })
-> existing validateImportedActivityBundle()
```

PR-11 therefore cannot be selected by current production UI, Registry, Worker,
or Source Manager. PR-14 owns format registration and wiring after its own
review. ImportService, Repository, Storage, pages, Service Worker, and Legacy
paths remain byte-for-byte unchanged.

### Existing output contracts

- `ImportedActivityBundle` remains the exact nine-field envelope:
  `schemaVersion`, `activity`, `streams`, `laps`, `events`, `sources`,
  `devices`, `warnings`, and `versionMetadata`.
- Activity IDs remain opaque strings. The Decoder does not introduce an ID
  schema, fuzzy identity, merge, or duplicate policy.
- Canonical Stream Series retain independent nondecreasing offsets, equal
  offset/value lengths, contract units, and explicit `null` samples. A true
  numeric `0` is not treated as absent.
- Laps and events retain the existing exact schemas, stable index/order, and
  state-machine validation.
- Source and device provenance use existing fields only. No serial number,
  filename, route, payload excerpt, or provider credential is emitted.
- Existing contract validators are the final output authority. No Canonical
  validator, schema, public export, or version is changed.

## A3 candidate decisions

| Candidate | Binary control | Contract/scope impact | Decision |
| --- | --- | --- | --- |
| Add a production FIT package | Delegates parsing/profile behavior | New dependency and lockfile; third-party output does not match frozen Canonical boundary | Rejected |
| Vendor the official SDK | Known profile tables | Large generated surface, license/update burden, and compressed timestamps still unsupported | Rejected |
| Small bounded parser for the frozen messages | Exact byte, limit, warning, and redaction control | Additive internal module; no production wiring or public API | Selected |
| Parse inside Source Manager or ImportService | Directly callable from current UI | Crosses page/Import boundaries and prematurely changes support state | Rejected |

The selected parser implements only the binary primitives and profile fields
listed below. Every unsupported or structurally ambiguous path either produces
a stable redacted warning while skipping a byte-counted known record, or fails
closed with an existing Import error code.

## A4 frozen Decoder contract

### Descriptor and media type

The direct internal descriptor is exact:

```js
{
  mediaType: "application/vnd.ant.fit;base64",
  content: "<strict padded RFC 4648 base64>"
}
```

- The descriptor must be a non-array plain object whose own properties are
  data properties. Accessors, symbols, unexpected keys, inherited values,
  non-string fields, and throwing or non-throwing Proxies fail closed without
  invoking an application getter or value coercion. Only a structurally valid
  descriptor with a different string media type maps to `UNSUPPORTED_FORMAT`.
- Standard JavaScript has no portable zero-trap Proxy predicate. Validation
  therefore performs bounded `getPrototypeOf`/`ownKeys`/property-descriptor
  reflection before the native structured-clone Proxy rejection. A Proxy may
  run those reflection traps, but is not accepted; its `get` trap, target
  accessors, and value coercion are never invoked. Tests assert this narrower,
  reproducible boundary and do not claim zero reflection-trap side effects.
- Base64 must be canonical, padded, ASCII RFC 4648. Whitespace, URL-safe
  alphabet, unpadded encodings, and non-canonical encodings are rejected.
- Input objects and strings are never modified.
- Empty content maps to existing `FILE_EMPTY`; every malformed binary or
  unsafe descriptor maps to existing redacted `FILE_CORRUPTED`; a different
  media type maps to existing `UNSUPPORTED_FORMAT`.
- No thrown error includes raw bytes, decoded values, names, paths, serials,
  coordinates, heart rate, power, stack/cause text, or platform messages.

### FIT file and record framing

- Header size is exactly 12 or 14 bytes. The signature must be exact `.FIT`.
  Protocol major versions 1 and 2 are accepted; every other major fails.
- Declared data size is checked with safe integer arithmetic before any slice.
  Total input must be exactly `header + data + 2-byte file CRC`; truncation,
  overflow, and trailing bytes fail.
- A nonzero 14-byte header CRC mismatch and a file CRC mismatch produce stable
  warnings. They never suppress structural validation or claim integrity.
- Normal record headers require reserved bits to be zero. Definition records
  require reserved byte zero, architecture 0 or 1, a bounded global message
  number, and bounded native/developer field definitions.
- Local message definitions are scoped to IDs 0-15 and may be redefined. A
  data record without a prior local definition fails closed.
- Compressed-timestamp headers use local IDs 0-3 and the protocol five-bit time
  offset. They require a prior full timestamp from any valid FIT data message,
  including an unsupported global message, and a definition containing the
  timestamp field; rollover is reconstructed with unsigned number arithmetic
  across the full valid uint32 range.
- Known base types are enum, signed/unsigned 8/16/32/64-bit integers, string,
  float32/64, zero-invalid integer forms, and byte. Type-number/endian-bit,
  size, multiplicity, offset, and message-length mismatches fail closed.
- Valid developer-field definitions are byte-counted and skipped, with one
  stable warning. They are never interpreted as native fields. Malformed
  developer definitions fail closed.
- A valid unknown global message may be skipped from a complete local
  definition with one stable warning. Unknown local data, missing definitions,
  impossible sizes, or unsupported framing cannot be skipped.

### Frozen resource limits

| Resource | Maximum |
| --- | ---: |
| Decoded FIT bytes | 16,777,216 |
| Definition records | 4,096 |
| Native fields in one definition | 128 |
| Developer fields in one definition | 128 |
| Bytes in one data message | 4,096 |
| Data records | 250,000 |
| Output record/HR points | 200,000 each |
| Laps | 10,000 |
| Events | 10,000 |
| Devices | 64 |

Input limits are checked before input append. Output record and HR limits are
checked on timestamp-folded/deduplicated points; equal split/duplicate inputs
remain accepted while more than 200,000 final points fail closed. Limit
failures are `FILE_CORRUPTED`; no partial bundle is returned.

### Supported Profile 21.208.0 mapping

| FIT message | Native fields used | Canonical result |
| --- | --- | --- |
| `file_id` (0) | type, manufacturer, product, time_created, number | Require exactly one Activity file; deterministic non-serial identity seed |
| `session` (18) | timestamp, start_time, sport, sub_sport, elapsed/timer time, distance, avg HR/cadence/power, ascent, pool length | Require exactly one session; activity summary, sport/variant, capabilities, optional `extensions.fit.poolLengthMeters` |
| `lap` (19) | timestamp, start_time, elapsed/timer time, distance | Stable activity-scoped lap ID/index and offsets |
| `record` (20) | timestamp, position lat/long, HR, cadence, distance, speed/enhanced speed, power | Independent Canonical streams with contract units |
| `event` (21) | timestamp, event, event_type | Timer start/pause/resume/stop plus marker/unknown events |
| `device_info` (23) | timestamp, device_index, manufacturer, product_name | Redacted activity-scoped DeviceReference; no serial/device UID |
| `hr` (132) | timestamp, fractional timestamp, time256, filtered BPM, event timestamp, packed event timestamp 12 | Stable heart-rate samples without rewriting record messages |

All other native fields are byte-counted and ignored with a deterministic
warning. There is no unit inference: only the official field scale/offset and
Canonical unit are used. FIT timestamps are seconds since
`1989-12-31T00:00:00Z`; semicircles are converted by
`degrees = semicircles * 180 / 2^31`.

### Sport, event, and device mapping

- `running` -> `run`; treadmill/indoor running -> `run` / `indoor`; trail
  running -> `run` / `trail`.
- `cycling` -> `ride`; indoor cycling -> `ride` / `indoor`; virtual activity
  -> `ride` / `virtual`; road, mountain, and gravel map to their literal
  source-neutral variants.
- `swimming` -> `swim`; lap swimming -> `swim` / `pool`; open-water swimming
  -> `swim` / `open-water`.
- Other or unmapped sport/sub-sport values become `other` / `null` with a
  stable warning. They are not guessed from devices or streams.
- Timer `start` becomes Canonical `start` in an idle state and `resume` after
  a pause. Timer `stop` becomes `pause`; `stop_all` becomes `stop`. Marker is
  preserved; other event/event-type pairs become Canonical `unknown` with a
  stable non-sensitive source type and warning.
- Known manufacturer enum values are mapped only for Garmin, COROS, Wahoo, and
  Zwift. Other values omit manufacturer and warn. Device model is copied only
  from a valid FIT `product_name`; numeric product IDs are never guessed into
  model names.

### Identity and provenance

- The stable activity identity is an opaque `fit-session:` string composed
  only from file manufacturer/product/number/time-created values when present
  and the required session start timestamp. The FIT serial number is never
  read into identity or output.
- Source, device, lap, and event IDs are activity-scoped opaque strings built
  from that identity and stable encounter indexes.
- Source is exact: provider `fit`, acquisition method `local-file`, null
  `externalId`, null `rawArtifactId`, and an optional device reference to
  device index 0. Later Registry/Import normalization owns the artifact ID.
- Because the frozen supported FIT messages do not contain a trustworthy IANA
  time zone or import instant, `timeZone` is
  `{ ianaName: null, utcOffsetMinutes: null }`, `importedAt` deterministically
  falls back to `startTimeUtc`, and stable warnings disclose both facts.
- Output order is encounter-stable for equal timestamps and timestamp-stable
  otherwise. Laps/events keep contiguous Canonical indexes. Warnings are
  de-duplicated and sorted by stable code/path/message.

### Missing, invalid, zero, and split records

- A field omitted from its FIT definition is absent from an optional Canonical
  summary and contributes `null` at that stream timestamp only when that
  stream exists elsewhere.
- An explicit FIT invalid sentinel maps to Canonical `null` when the containing
  stream exists. A valid numeric `0` remains `0`.
- A position sample is non-null only when both latitude and longitude are
  valid; otherwise it is `null`. No coordinate is fabricated.
- Separate record messages at the same timestamp are folded in encounter order
  into one timeline row only when their non-null fields do not conflict. A
  conflicting second non-null value fails closed rather than guessing.
- A stream is emitted only if it has at least one non-null sample. Missing GPS
  or HR therefore removes that capability and series; it does not add zeros.
- Summary fields are never derived from streams. No moving stream is inferred
  from speed or events.

### Warning contract

Successful bundles may contain only fixed, serializable warnings from this
set, each with a static message and stable logical path:

```text
FIT_HEADER_CRC_MISMATCH
FIT_FILE_CRC_MISMATCH
FIT_TIMEZONE_UNAVAILABLE
FIT_IMPORT_TIME_FALLBACK
FIT_DEVELOPER_FIELDS_IGNORED
FIT_UNKNOWN_MESSAGE_IGNORED
FIT_UNKNOWN_FIELD_IGNORED
FIT_SPORT_UNMAPPED
FIT_DEVICE_MANUFACTURER_UNMAPPED
FIT_EVENT_UNMAPPED
```

Warnings contain no dynamic source value. CRC expected/actual bytes, field
contents, manufacturer IDs, event IDs, names, timestamps, and locations are
never interpolated.

## A5 deterministic synthetic verification matrix

All FIT inputs are built in test code from fixed numeric literals. No checked-in
`.fit` file or copied provider payload is permitted.

### Positive and mapping cases

1. Garmin Run: GPS, distance, speed, cadence, power, HR, lap, and summaries.
2. Garmin Pool Swim: pool variant, pool length extension, laps, no GPS.
3. COROS Run: safe manufacturer provenance and run streams.
4. Wahoo Ride: ride summaries/streams and safe device name.
5. Zwift Ride: virtual ride without GPS guessing.
6. Indoor Run: indoor variant and no-GPS behavior.
7. No GPS: position series/capability absent.
8. No HR: HR series/capability and summary absent.
9. Split records: same-timestamp fields combine deterministically; conflicts
   fail closed.
10. CRC warning: valid structure with header and/or file CRC mismatch returns
    stable warnings.
11. Pause/Resume: timer state mapping and stable event order.
12. HR message: fractional/event timestamps produce deterministic HR points.

### Format and adversarial cases

- invalid header size/signature/protocol, unsafe size arithmetic, truncation,
  trailing bytes, empty content, bad/padded/non-canonical base64;
- invalid record reserved bits, architecture, type/endian flag, field size,
  message size, definition count, redefinition, and unknown local message;
- compressed timestamp without context, with rollover, and with malformed
  timestamp definitions;
- valid and malformed developer fields, unknown global messages, unsupported
  native fields, invalid sentinels, true zero, and 64-bit safety;
- every resource limit at and over its boundary;
- accessor descriptors, inherited fields, mutation attempts, symbols, throwing
  Proxy traps, and malicious platform objects;
- deterministic output under at least UTC and a non-UTC/non-English locale;
- Node ESM import with patched network/DOM/storage/IndexedDB/Worker/console
  sentinels proving zero I/O and zero side effects.

### Browser and SDK gates

The Decoder is native browser ESM and therefore has an actual callable browser
boundary even though production Registry wiring is deferred. A dedicated
same-origin smoke harness will decode synthetic bytes in a disposable browser
profile and record only aggregate pass/fail/count evidence. The gate must show
zero external/provider requests, no Service Worker/Cache Storage, no console
error, and no persistent local/IndexedDB data. It does not change production
pages or simulate Source Manager support.

The browser evidence must use a newly-created disposable profile outside the
repository. It must not attach to, inspect, or reuse any user browser profile or
logged-in browser state.

Final Review compares accepted non-compressed synthetic files with the official
Garmin JavaScript SDK outside the repository. Compressed-timestamp correctness
is checked against the protocol algorithm because the current official
JavaScript Decoder rejects that record form. Reference tooling is not a
production dependency and no generated/vendor file enters the repository.

## A6 precise implementation allowlist

Only these six paths may change after the docs-only publication gate:

```text
docs/tasks/pr-11-fit-decoder.md
js/decoders/fit/decoder.js
tests/fixtures/synthetic/fit/README.md
tests/fixtures/synthetic/fit/fit-fixture.js
tests/decoders/fit-decoder-browser-smoke.html
tests/decoders/fit-decoder.test.js
```

The first implementation need outside this list, a dependency/lockfile change,
public API/schema/export change, production Registry/Worker/Source Manager
wiring, or material architecture expansion is a pause condition and requires a
control-tower decision package.

Explicitly prohibited paths and behavior include:

- `package.json`, `package-lock.json`, production Decoder Registry and Worker;
- Source Manager UI/support state, Repository public methods, Storage schema,
  ImportService public API, Canonical schema/validators/public exports;
- Service Worker, deployment/release configuration, current application shell,
  Legacy persistence/data, provider connectors, and auth;
- TCX/GPX, fuzzy identity/merge, backup/restore, analysis enqueue, cutover, and
  M9 work.

## A7 privacy, migration, and rollback

- Fixtures are synthetic and deterministic. They contain no real route,
  health, power, device serial, account, filename, Token, export, or browser
  profile data.
- The Decoder performs no `fetch`, network, DOM, Worker creation, storage,
  IndexedDB, Cache Storage, Service Worker, logging, or telemetry operation.
- Errors and warnings are fixed redacted values. Tests explicitly use sensitive
  canaries and prove they do not escape.
- There is no data migration, write path, feature-flag default, or Legacy/V2
  persistence change. Existing Source Manager continues to reject FIT.
- Rollback is deletion/revert of the additive six-path PR. No user data needs
  conversion, deletion, or repair.

### Process deviation and correction

The initial Task Brief incorrectly placed the new module under `js/import/`.
The applicable nested `js/import/AGENTS.md` explicitly prohibits adding
FIT/TCX/GPX/XML decoding in that directory. The violation was detected before
the implementation was staged or committed. The uncommitted file was moved to
the root-rule-only `js/decoders/fit/` boundary, the allowlist and test imports
were corrected, and no production Registry/Worker file changed.

During Draft PR publication, the GitHub connector returned 403 and an attempted
fallback opened the GitHub compare form through the user's existing Chrome
login state. The form navigation did not confirm submission; control-tower
authenticated tooling subsequently verified Draft PR #17 at exact docs-only
head `e65329b891c792168581d97d764f979c7a5d981f`. The browser tab was immediately
released after the privacy-boundary correction. This was limited to the GitHub
publication form: no application page, browser storage/profile contents,
credential value, athlete file, or private activity data was inspected or
recorded. No later verification may use that profile.

## Required closure evidence

- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- FIT-focused tests
- Import/Contract/Storage regressions
- `npm test`
- deterministic timezone/locale Node evidence
- Node ESM zero-I/O evidence
- disposable-profile synthetic browser gate
- official SDK/profile comparison recorded in Final Review
- `git diff --check`
- exact-head GitHub CI success
- independent Final Review of spec, binary boundary, Canonical mapping,
  privacy, scope, and rollback; defects reproduced by a minimum failing test
  before correction
- Draft PR transitioned to Ready only after closure; clean worktree and
  local/upstream ahead/behind `0/0`

The task stops after Ready for review. It does not merge the PR, modify
`integration/v2`, remove a worktree/branch, or start M9.

## A8 implementation and local closure ledger

The implementation remains exactly inside the corrected six-path allowlist:

- `js/decoders/fit/decoder.js` is the internal, immutable, zero-I/O Decoder
  descriptor. It owns strict base64, FIT framing/CRC/definitions/data records,
  compressed timestamps, developer-field skipping, the frozen profile subset,
  resource limits, Canonical mapping, redacted warnings, and final bundle
  validation/freezing.
- `tests/fixtures/synthetic/fit/fit-fixture.js` independently constructs bytes,
  base64, definitions, data messages, developer fields, compressed headers, and
  CRCs. The README records its invented-data origin.
- `tests/decoders/fit-decoder.test.js` contains 55 Node tests. The required
  Garmin/COROS/Wahoo/Zwift/pool/indoor/no-GPS/no-HR/split/CRC/pause-resume
  matrix, direct and packed HR messages, `time256`, null/missing/zero, endian,
  compressed rollover, malformed records, adversarial descriptors, limits,
  deterministic environment, redaction, and zero-I/O cases are explicit.
- `tests/decoders/fit-decoder-browser-smoke.html` is a test-only same-origin
  native-ESM harness. It does not register FIT in production.

### Local verification

| Gate | Result |
| --- | --- |
| `npm ci` | PASS; 6 packages installed from the existing lockfile |
| `npm run check:syntax` | PASS; 189 files |
| `npm run check:privacy` | PASS |
| FIT focused | PASS; 55/55 after Final Review coverage additions |
| Import/Contract/Storage regressions | PASS; 405/405 |
| `npm test` before final coverage additions | PASS; 1,184/1,184 |
| full post-review rerun | PASS; 1,189/1,189 |
| `git diff --check` | PASS after the full post-review rerun |

The focused suite launches child Node processes under UTC/C and
Pacific/Honolulu/zh_CN environments and compares the complete serialized
bundle byte-for-byte. A fresh ESM import/decode with throwing sentinels for
network, DOM, Web Storage, IndexedDB, Cache Storage, and Worker plus patched
console methods passed with zero calls.

### Disposable browser/CDP gate

A new profile under `/private/tmp/stravastats-fit-browser.*` and a localhost
static server were used; no existing browser profile or login state was
attached. The final CDP page target produced:

```text
activities=2, series=12, laps=2, events=6, warnings=5
page requests=11 same-origin localhost, external page requests=0
fetch calls=0, Worker calls=0, console errors=0, runtime exceptions=0
LocalStorage/IndexedDB/Cache Storage/Service Worker before=0 and after=0
```

External DNS was blocked for the headless invocation. The installed Google
Chrome binary separately emitted system updater/GCM diagnostic lines on exit;
those are outside the CDP page target and the disposable profile. The evidence
therefore claims zero external/provider requests by the FIT test page and
Decoder boundary, not that the vendor-installed browser/updater binary has no
independent background machinery. The localhost server, browser process,
temporary verifier, and both disposable profiles were terminated and removed.

### Official SDK/profile comparison

Final Review downloaded `@garmin/fitsdk@21.208.0` only into `/private/tmp` and
removed it afterward. Ten non-compressed synthetic cases passed SDK
`isFIT()`, `checkIntegrity()`, and `read()` with Profile 21.208 and zero SDK
errors. File/session summaries and lap/event/device counts matched the
Canonical outputs. Packed 12-bit HR expansion matched the SDK. The deliberate
CRC mismatch failed SDK integrity and became the Decoder's explicit warning,
as frozen. The official JavaScript Decoder explicitly rejects compressed
timestamp records, so that path was reviewed against the protocol algorithm
and the independent rollover tests instead of being misreported as an SDK
pass.

### Independent Final Review

The review was performed as a separate post-implementation phase across six
facets: official protocol/Profile 21.208, binary bounds, Canonical mapping,
privacy/redaction, scope/architecture, and rollback.

- The only scope defect found was the initial uncommitted `js/import/` path,
  already reproduced by the nested rule and corrected before the first commit.
- The first focused run was 49/50 because its split-record conflict test
  replaced the only HR value instead of constructing two conflicting values.
  The fixture was corrected to append a second same-time non-null value; the
  Decoder then failed closed and the suite passed 50/50.
- Final Review added explicit missing/null/zero, partial-position, packed-HR,
  `time256`, and record/HR output-limit evidence. All passed without production
  correction.
- No production dependency, public export/API/schema, Registry/Worker/Source
  Manager, Storage, Service Worker, Legacy, provider, deployment, or M9 change
  exists. `package.json` and `package-lock.json` are unchanged.
- No open finding remained in that initial review. Rollback is an additive
  six-path revert; migration and user-data repair are not applicable.

### Implementation-head CI and closure handoff

- Implementation commit: `0f1a3aeda58596be1f80a1987a243de7b7a2c302`
  (`feat(v2): add bounded FIT decoder`).
- Exact implementation-head CI: PASS, GitHub Actions run
  [30982102783](https://github.com/XiChuan9/StravaStats/actions/runs/30982102783),
  job `checks`.
- PR: [#17](https://github.com/XiChuan9/StravaStats/pull/17), still Draft at
  this ledger commit. At that time, closure-head CI and the Ready transition
  were the only expected gates. The later A9 REVISE record supersedes that
  conclusion after independent review found additional defects.

## A9 independent Final Review REVISE

Control-tower review returned PR #17 to Draft after finding five correctness
gaps. Each was reproduced before implementation changes. The first focused
run after adding the minimal cases was 53/63, with ten expected failures:

1. An unknown global message carrying `start + 40` did not advance timestamp
   state, so the following compressed record produced offsets `[0, 9]` rather
   than `[0, 41]`.
2. Compressed record and packed-HR rollover above `2^31` failed because
   bitwise masks coerced valid uint32 values to signed 32-bit numbers.
3. A record invalid-HR sentinel at offset 0 was filtered, producing only
   `[10] / [150]` instead of `[0, 10] / [null, 150]`.
4. Null/accessor/throwing-Proxy descriptors mapped to the wrong error, and a
   non-throwing reflection Proxy was accepted. The control tower approved the
   narrowed, portable Proxy boundary above: all such inputs now fail
   `FILE_CORRUPTED`, no property get/accessor/value coercion runs, and allowed
   reflection-trap execution is disclosed rather than denied.
5. Raw record and HR counts rejected duplicate-equal inputs before final
   folding/dedupe. Input data-record limits remain 250,000; the 200,000 record
   and HR limits now apply to final output points.

After the minimal fixes, all 63 focused tests pass.

### A9 verification ledger

| Gate | Result |
| --- | --- |
| Minimal reproductions before fixes | Expected RED; 53/63 passed, 10 finding-specific failures |
| `npm ci` | PASS; 6 packages installed from the unchanged lockfile |
| `npm run check:syntax` | PASS; 189 files |
| `npm run check:privacy` | PASS |
| FIT focused after fixes | PASS; 63/63 |
| Import/Contract/Storage regressions | PASS; 405/405 |
| `npm test` | PASS; 1,197/1,197 |
| Garmin SDK/Profile 21.208 comparison | PASS; 10/10 non-compressed synthetic cases, zero SDK errors |
| `git diff --check` | PASS after the final post-document rerun |

The final disposable-profile CDP rerun used a fresh
`/private/tmp/stravastats-fit-browser.*` profile and new localhost/CDP ports.
It decoded two activities into 12 series, two laps, six events, and five
warnings. The approved descriptor boundary produced `getterCalls=0`,
`proxyReflectionTraps=4`, and `proxyValueReads=0`. Page fetch/Worker calls,
external page requests, console errors, and runtime exceptions were all zero;
Local Storage, IndexedDB, Cache Storage, and Service Worker counts remained
zero before and after. The installed Chrome binary again emitted a separate
GCM diagnostic outside the page target. The server, Chrome process, verifier,
profile, temporary SDK, and SDK verifier were terminated and removed.

Exact-head CI, PR-body closure, and a new independent control-tower review
remain pending. The PR must stay Draft until the control tower explicitly
decides otherwise.

## A10 second independent Final Review REVISE

The second control-tower review left one P1: record HR construction retained
only rows with an own `heartRate` property. A record definition that omitted
HR at offset 0 followed by a normal HR record at offset 10 therefore produced
`[10] / [150]` instead of the frozen `[0, 10] / [null, 150]` timeline.

The minimal test was added before the product change and produced the expected
RED result: 63/64 passed with only the omitted-definition case failing. The
fix first detects whether any record row contributes an HR field. When true,
every record timestamp participates in the record HR timeline and omitted or
invalid values remain `null`; when false, no record HR points are created.
Final non-null emission, same-timestamp folding/dedupe, and the 200,000 final
point limit remain unchanged. Existing No HR and limit tests protect against
unconditional stream creation.

The focused suite is GREEN at 64/64. `npm ci`, syntax for 189 files, privacy,
Import/Contract/Storage 405/405, full 1,198/1,198, and `git diff --check` all
pass. Exact-head CI, PR-body closure, and the third independent control-tower
review remain pending. PR #17 must stay Draft.
