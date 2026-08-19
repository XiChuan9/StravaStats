# PR-13: GPX Decoder

## Metadata

| Field | Value |
| --- | --- |
| Status | Ready for review |
| Milestone | M10 |
| Base branch | `integration/v2` |
| Exact base SHA | `a5b1c6942980458495777a5285536ef8be301d50` |
| Feature branch | `codex/v2/decoder-gpx` |
| Worktree | `<worktree-root>/<task-name>` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review PASS / no actionable findings |
| Dependency | PR-12 / PR #18 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Deliver one internal, pure, deterministic, synchronous, zero-I/O GPX 1.1
Decoder boundary for later Decoder Registry wiring:

```text
strict plain artifact descriptor
-> bounded XML 1.0 lexical parser and namespace resolver
-> GPX 1.1 Track / Segment / Point profile
-> selected Garmin trackpoint extensions
-> ImportedActivityBundle
-> existing Canonical validators
```

This PR does not register GPX in the production Decoder Registry, Worker, or
Source Manager. It does not change ImportService, Repository, Canonical or
Storage schemas, Service Worker, deployment, pages, feature flags, Legacy
behavior, FIT, or TCX.

## A0 baseline evidence

- The assigned isolated worktree began detached and clean at exact SHA
  `a5b1c6942980458495777a5285536ef8be301d50`.
- Starting HEAD, local `integration/v2`, and `origin/integration/v2` matched the
  exact base; local integration ahead/behind was `0/0`. The locked long-lived
  integration worktree was clean at the same SHA.
- No local or remote `codex/v2/decoder-gpx` branch existed. The branch was then
  created at the exact base in this assigned worktree.
- Baseline `npm ci` passed without changing either package file; syntax passed
  for 192 files; privacy passed; the full suite passed 1,235/1,235; and
  `git diff --check` passed.
- No real GPX/FIT/TCX/ZIP, athlete export, account, Token, route, heart-rate,
  cadence, power, screenshot, private fixture, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed
before implementation and opens a Draft PR with
`integration/v2 <- codex/v2/decoder-gpx`. No implementation path may be staged,
committed, or pushed before the Draft PR exists and the docs-only exact-head CI
passes.

If the GitHub App or `gh` cannot write the PR, execution hands publication to
the control tower. It must not use an existing user Chrome login or browser
profile as a fallback.

## A2 authority and read-only findings

Authority order for this PR is:

1. Accepted ADR-0001, ADR-0002, ADR-0004, and ADR-0006;
2. `docs/product/stravastats-v2-prd.md`;
3. the PR-13 entry in `docs/engineering/v2-development-plan.md` and the release
   gates;
4. architecture overview, fixture policy, test strategy, and regression matrix;
5. existing Canonical/ImportedActivityBundle, Import Core, FIT, and TCX seams;
6. PR-07, PR-11, and PR-12 Task Briefs;
7. this frozen task contract and implementation details.

Primary format/security evidence was downloaded only to `/private/tmp`; it is
not committed, vendored, imported, or installed:

- Topografix GPX 1.1 schema and schema documentation:
  `https://www.topografix.com/GPX/1/1/gpx.xsd` and
  `https://www.topografix.com/gpx/1/1/`;
- Garmin `TrackPointExtensionv2.xsd` for the GPX-specific
  `TrackPointExtension/hr/cad` vocabulary;
- Garmin `ActivityExtensionv2.xsd` for its globally declared `TPX/Watts`
  vocabulary;
- W3C XML 1.0 Fifth Edition, Namespaces in XML 1.0 Third Edition, and XInclude
  1.0 Second Edition;
- OWASP XML External Entity Prevention guidance.

Topografix freezes GPX coordinates as WGS84 decimal degrees, measurements as
metric, root version `1.1`, ordered `trk/trkseg/trkpt` structure, optional point
elevation/time, and `extensions` as a lax `##other` wildcard. A segment is a
continuous span of track data after receiver loss or interruption; it is not a
lap declaration.

Garmin TrackPointExtension v2 is explicitly a GPX 1.1 trackpoint extension. It
defines `hr` as `1..255` bpm and `cad` as `0..254` rpm, but it defines no power
field. This PR therefore rejects non-schema Garmin `<power>` lookalikes. To
meet the frozen M10 power capability without inventing a namespace, it accepts
only Garmin ActivityExtension v2's globally declared `TPX/Watts` unsigned-short
element when that `TPX` is a direct child of a GPX trackpoint's schema-defined
`extensions` wildcard. This is a narrow cross-schema interoperability profile,
not a claim that Watts belongs to GPX or TrackPointExtension v2.

### Existing seam and one-bundle constraint

The production graph remains unchanged and continues to reject GPX:

```text
Source Manager (CSV/ZIP only)
-> ImportService
-> production Decoder Registry / Worker
-> existing registered decoders
```

PR-13 remains outside that graph:

```text
direct internal ESM import / future PR-14 wiring
-> js/decoders/gpx/decoder.js
-> gpxDecoder.decode({ mediaType, content })
-> one ImportedActivityBundle
```

The accepted Decoder seam returns one bundle, not an array. Multiple GPX Tracks
and Segments in one document are therefore one source activity only when their
explicit sport metadata is compatible and their timed points form one globally
nondecreasing timeline. A mixed-sport or temporally contradictory document
fails closed. This PR does not add `decodeAll`, split artifacts, or change a
public Import contract.

### Existing output constraints and missing time

- `CanonicalActivity.startTimeUtc` is required and cannot represent an unknown
  activity start.
- Every present Canonical Stream Series requires explicit nonnegative offsets.
  Position/elevation/health data cannot be emitted without a real point time.
- GPX metadata time is the file creation time, not the activity start, and is
  never substituted for a missing trackpoint time.
- A document with no timed trackpoint therefore fails closed. No timestamp,
  offset, elapsed/moving time, duration, distance, or speed is fabricated.
- An otherwise valid untimed point is validated, omitted from all Canonical
  streams, and produces one static `GPX_UNTIMED_TRACKPOINT_IGNORED` warning.
  Timed points remain usable; no interpolation or neighboring-time assignment
  occurs.

## A3 parser and scope decision

| Candidate | Equivalence/control | Scope impact | Decision |
| --- | --- | --- | --- |
| Browser `DOMParser` plus Node substitute | Different parsers and pre-limit DOM allocation | Dependency or injected parser contract | Rejected |
| New SAX/XML dependency | One parser but package/lockfile and security review | Seventh path and dependency expansion | Rejected |
| Extract/modify the TCX parser | Could share XML mechanics | Changes reviewed TCX or creates a public XML API | Rejected |
| Independent restricted GPX tokenizer | Same native ESM in Node/browser; exact limits | One additive internal module | Selected |

The selected parser may duplicate small reviewed lexical techniques, but it
does not import, modify, or expose TCX internals. It is not a general XML API.
Any demonstrated need to modify TCX or extract a shared parser is a pause
condition and requires control-tower approval.

## A4 frozen Decoder contract

### Descriptor, media type, and output

The exact direct descriptor is:

```js
{
  mediaType: "application/gpx+xml",
  content: "<gpx ...>...</gpx>"
}
```

- The descriptor is an exact non-array plain object with own enumerable data
  properties `mediaType` and `content` only.
- Accessors, symbols, custom prototypes, missing/extra keys, non-strings, and
  reflection-failing or structured-clone-rejected Proxies fail closed. No
  property getter, target accessor, iterator, coercion, or application method
  is intentionally invoked. Portable JavaScript cannot promise zero Proxy
  reflection traps, and tests make only the narrower reproducible claim.
- Empty content is existing `FILE_EMPTY`; a safe descriptor with another media
  type is `UNSUPPORTED_FORMAT`; every unsafe descriptor, malformed/unsupported
  XML, semantic conflict, or resource breach is static `FILE_CORRUPTED`.
- Input is unchanged. Output is detached, deeply frozen, structured-cloneable,
  JSON round-trippable, and passes `validateImportedActivityBundle`,
  `validateCanonicalActivity`, and `validateCanonicalStreamSet`.
- Errors retain no raw XML, filename, name, creator, ID, coordinate, time,
  elevation, heart rate, cadence, power, cause, platform message, or stack
  beyond the existing static `ImportError` stack.

### XML security and namespaces

The restricted XML 1.0 tokenizer accepts one optional BOM, an optional first
XML 1.0 UTF-8 declaration, elements, attributes, text, comments, the five
predefined entities, and bounded numeric character references. It rejects:

```text
DOCTYPE / DTD / ENTITY
external identifiers or external parsed entities
XInclude namespace/elements
all processing instructions except the initial XML declaration
CDATA and every other declaration form
unbound prefixes, duplicate attributes/declarations, namespace undeclaration
reserved-prefix misuse, malformed names/comments/entities/tags/truncation
NUL, forbidden XML controls/noncharacters, and unpaired UTF-16 surrogates
```

No namespace URI, schemaLocation, link, entity, or text is dereferenced. The
Decoder has no fetch, DNS, filesystem, DOM, storage, IndexedDB, Worker, Service
Worker, Cache, logger, console, timer, telemetry, or analysis call.

Exact semantic namespaces are:

| Namespace | Accepted semantic use |
| --- | --- |
| `http://www.topografix.com/GPX/1/1` | GPX 1.1 root, metadata, Track/Segment/Point paths |
| `http://www.garmin.com/xmlschemas/TrackPointExtension/v2` | Direct `TrackPointExtension/hr/cad` under `trkpt/extensions` |
| `http://www.garmin.com/xmlschemas/ActivityExtension/v2` | Direct `TPX/RunCadence/Watts`; Speed is validated but ignored |
| `http://www.w3.org/2001/XMLSchema-instance` | Inert `type` and `schemaLocation` attributes only |
| `http://www.w3.org/XML/1998/namespace` | Reserved XML namespace only |

Default and prefixed forms are equivalent after resolution. GPX 1.0, absent or
spoofed core namespace, known extension roots at any other path, XInclude, and
namespace fallback fail closed.

GPX `extensionsType` permits `##other`. A bounded unknown nonempty-namespace
subtree is ignored only as a direct child of an approved GPX or Garmin
`Extensions/extensions` element and produces one static warning. Unknown
wrappers may not contain GPX, Garmin TPE/AE, XInclude, XSI, XML, or no-namespace
descendants; controlled-namespace smuggling fails closed.

### Frozen resource limits

| Resource | Maximum |
| --- | ---: |
| UTF-8 XML bytes | 16,777,216 |
| XML depth | 32 |
| XML elements | 500,000 |
| attributes on one element | 32 |
| total attributes | 500,000 |
| UTF-8 bytes in one text node | 262,144 |
| UTF-8 bytes in one attribute value | 4,096 |
| QName bytes | 128 |
| children on one element | 200,000 |
| Tracks | 10,000 |
| Segments | 20,000 |
| Trackpoints | 225,000 |
| final timed rows | 200,000 |
| extension elements | 400,000 total |
| direct children per `extensions` | 32 |

Every limit is checked before append/output growth. Every exact boundary and
`+1` has executable focused evidence; large cases run in isolated child
processes so one limit does not mask another. A breach returns no partial
bundle. Parsing is synchronous; no timeout or background task survives failure.
The 225,000 structural Trackpoint cap is intentionally distinct from the
200,000 final timed-row cap so each guard has independent exact and `+1`
evidence, including files whose untimed points cannot enter Canonical streams.

### GPX core structure, metadata, and values

- Root is exact GPX 1.1 `gpx`, with required literal `version="1.1"` and a
  required string `creator`. GPX child sequence and singleton/cardinality rules
  are enforced.
- At least one Track, Segment, Trackpoint, and timed Trackpoint are required for
  this activity Decoder. Schema-valid waypoints and routes are validated and
  ignored with a static warning; they never become activity points.
- Multiple Tracks/Segments are traversed in document order. Segment boundaries
  express continuity only and do not create Canonical Laps or Events.
- Metadata order and values are validated. Metadata `time` is never activity
  time. Bounds require all four legal WGS84 coordinates and `min <= max`; they
  are not trusted to repair, reject, clamp, or replace actual points.
- Activity name uses the one unique nonempty Track `name`; if no Track has a
  name, metadata `name` is the fallback. Distinct Track names are omitted and
  produce a static conflict warning. Names are not copied to IDs or errors.
- Track `type` uses a fixed ASCII, locale-independent mapping after XML-space
  trim and ASCII lowercase only:
  `run|running -> run`, `ride|riding|bike|biking|cycling -> ride`,
  `walk|walking -> walk`, `hike|hiking -> hike`, and `workout -> workout`.
  Missing type contributes no vote. Unknown type maps to `other` with a static
  warning. More than one resulting category across Tracks fails closed. Variant
  is always null; sport is never guessed from name, speed, sensors, or route.
- Trackpoint `lat` is finite `[-90, 90]`; `lon` is finite `[-180, 180)` per the
  GPX schema. Both are required and numeric zero is preserved.
- Point time uses a strict Gregorian `xsd:dateTime` subset with explicit `Z` or
  numeric offset, validates calendar and offset bounds without host locale/time
  zone, and normalizes to fixed-millisecond UTC. More than three nonzero
  fractional digits fail rather than round.
- Timed point instants are globally nondecreasing across all Tracks/Segments.
  Equal-time points fold in encounter order only when every non-null field is
  compatible; any conflict fails closed.
- Elevation is optional GPX decimal metres. Missing is `null` in an emitted
  altitude series; any finite negative, zero, or positive value is preserved
  exactly as parsed. `NaN`, `INF`, `-INF`, overflow, or non-finite conversion
  fails. There is no previous-value substitution, clamp, smoothing,
  interpolation, geoid correction, or elevation-gain derivation.
- Other schema-defined point/metadata fields are validated and ignored. Links
  and schema locations are inert strings. No summary distance, elapsed/moving
  time, elevation gain, averages, speed, or device identity is derived.

### Extensions and conflicts

Only these point mappings are emitted:

| Literal path | Validation | Canonical stream/unit |
| --- | --- | --- |
| `trkpt/@lat,@lon` | GPX WGS84 bounds | `position` / `wgs84` |
| `trkpt/ele` | finite decimal metres | `altitude` / `m` |
| `trkpt/extensions/gpxtpx:TrackPointExtension/gpxtpx:hr` | integer `1..255` | `heartRate` / `bpm` |
| `.../gpxtpx:cad` | integer `0..254` | `cadence` / `rpm` |
| `trkpt/extensions/gpxax:TPX/gpxax:RunCadence` | integer `0..254` | `cadence` / `rpm` |
| `.../gpxax:Watts` | integer `0..65535` | `power` / `W` |

Garmin extension sequence and singleton rules are enforced. TPE cadence and AE
RunCadence at one point must agree. Duplicate extension roots or conflicting
non-null values fail closed. TPE temperature/depth/speed/course/bearing and AE
Speed are validated against their official types but ignored with one static
warning; no speed stream is emitted or derived.

A stream is emitted only if at least one timed row has a non-null value for the
field. Every emitted stream uses the same real timed-row offsets and contains
explicit `null` for a missing field. Missing, null, and true numeric zero remain
distinct. Untimed extension values are not moved to another timestamp.

### Identity, source, and output mapping

- Activity identity is the opaque string
  `gpx-track:<encoded-first-UTC>:<track-count>:<segment-count>:<timed-row-count>`.
  It contains no name, creator, coordinate, health value, or power value.
- Source ID is activity-scoped and a string. Provider is `gpx`, acquisition is
  `local-file`, external/raw artifact/device IDs are null, and `importedAt`
  deterministically falls back to the first real point time with a warning.
- `timeZone.ianaName` is null. `utcOffsetMinutes` preserves the explicit first
  timed-point offset, including true zero. A static warning records unavailable
  IANA name.
- `laps`, `events`, and `devices` are empty. `hasLaps` is false. Other
  capabilities exactly reflect emitted streams.
- Output order is document encounter order after compatible equal-time folding.
  Warnings are de-duplicated and sorted by stable code/path/message.

Successful output warnings are limited to fixed definitions from this set:

```text
GPX_IMPORT_TIME_FALLBACK
GPX_TIMEZONE_NAME_UNAVAILABLE
GPX_UNTIMED_TRACKPOINT_IGNORED
GPX_TRACK_NAME_CONFLICT_IGNORED
GPX_SPORT_UNMAPPED
GPX_NON_TRACK_CONTENT_IGNORED
GPX_EXTENSION_FIELD_IGNORED
GPX_UNKNOWN_EXTENSION_IGNORED
```

No warning interpolates source values.

## A5 deterministic synthetic verification matrix

All committed GPX is generated from invented literals. No real athlete export
or copied route is used.

Positive/mapping evidence covers:

1. default and prefixed GPX 1.1 namespaces plus inert schemaLocation;
2. multiple Tracks, Segments, and Points with stable document order;
3. position/elevation plus Garmin TPE v2 HR/cadence and AE v2 Watts;
4. missing optional GPS point fields other than required coordinates, elevation,
   HR, cadence, and power with explicit nulls only in existing series;
5. true zero for coordinates, elevation, cadence, and power;
6. one or more untimed points with warning and no invented time/offset/value;
7. all points untimed fail closed;
8. finite negative/large elevation preservation and non-finite/overflow failure;
9. Track-name/metadata-name precedence and conflict warning;
10. exact sport mapping, unknown warning, and mixed-sport failure;
11. metadata time/bounds validation without activity-time substitution;
12. compatible equal-time folding, equal-time conflict, and decreasing time;
13. schema-valid waypoints/routes ignored and unknown extension wildcard warning.

Adversarial evidence covers:

- empty/malformed/truncated XML, mismatched tags, raw `<` in attributes,
  literal `]]>` in text, malformed comments, duplicate attributes;
- GPX 1.0/no namespace, spoofing/unbound/reserved prefixes, known extension
  roots outside literal paths, and controlled namespace smuggling;
- DOCTYPE/internal/external ENTITY/entity expansion/external DTD, XInclude,
  PI, CDATA, and encoded attack text;
- invalid dates/offsets/calendar overflow, coordinates, decimals, integers,
  duplicates, sequence/cardinality errors, and semantic conflicts;
- exact and `+1` for every frozen resource;
- accessors, symbols, custom prototypes, mutation attempts, reflection failures,
  Proxies, redaction canaries, structuredClone, and JSON round-trip;
- byte-identical output under UTC/C and a non-UTC/non-English environment;
- Node ESM import/decode with network, DOM, filesystem-facing globals, storage,
  IndexedDB, Worker, Service Worker, Cache, console, logger, timer, and telemetry
  sentinels at zero where the platform exposes them.

## A6 literal implementation allowlist

Only these six paths may change:

```text
docs/tasks/pr-13-gpx-decoder.md
js/decoders/gpx/decoder.js
tests/fixtures/synthetic/gpx/README.md
tests/fixtures/synthetic/gpx/gpx-fixture.js
tests/decoders/gpx-decoder.test.js
tests/decoders/gpx-decoder-browser-smoke.html
```

A seventh path requires a necessity record and explicit control-tower approval
before modification. The allowlist is literal; it is never generated from the
current diff, a directory pattern, or skip rule.

## Prohibited scope

- `package.json`, `package-lock.json`, any production/test dependency, Accepted
  ADR, PRD, development plan, GitHub workflow, Service Worker, deployment, or
  release configuration.
- Production Decoder Registry/Worker registration, Source Manager support
  state, ImportService/public Import API, Repository, Canonical contract or
  validator, Storage schema/store/index/migration, feature default, page, tab,
  analysis, bootstrap, cutover, or Legacy path.
- FIT/TCX product code or public API, shared/general XML parser, route-only or
  waypoint-only activity decoding, decode-all/public split contract, fuzzy
  identity, merge, backup/restore, provider/auth/network behavior, or M11/PR-14.
- Timestamp/duration/distance/speed/elevation/lap inference; silent repair,
  clamp, interpolation, namespace fallback, DTD/entity/XInclude/PI/CDATA
  processing, partial output, raw error interpolation, or external schema fetch.
- Real GPX/FIT/TCX/ZIP, credentials, accounts, Tokens, routes, location/health/
  power history, private fixtures, committed screenshots, user profiles, or
  provider/network-backed tests.

## A7 privacy, migration, and rollback

Only deterministic synthetic XML may be committed or used in Node/browser/XSD
evidence. Raw XML and private values never enter errors, warnings, logs, DOM,
CI evidence, or the PR body.

There is no data/schema migration, persistence operation, production format
registration, or feature behavior change. Existing Source Manager continues to
reject GPX. Legacy and V2 persistence are not opened or modified.

Rollback is an additive six-path revert. No data conversion, deletion, repair,
cache cleanup, downgrade, or reverse copy is required.

## A8 browser, XSD, and required gates

A test-only same-origin harness imports the internal Decoder and existing
validators as native ESM and decodes deterministic synthetic GPX. A disposable
browser profile outside the repository must prove zero external/provider/auth
requests, fetch/XHR/WebSocket, Worker, console warning/error, uncaught/unhandled
failure, Local/Session Storage, IndexedDB, Cache Storage, and Service Worker.
Every tab/session/process/profile/server/port is closed. No user profile or
logged-in browser state is used.

A synthetic core-only GPX is validated with Topografix's official XSD downloaded
to `/private/tmp`. Garmin extension fixtures are checked against the selected
official Garmin schemas through temporary wrappers/imports outside the
repository when the validator supports them. Recovery differences never weaken
the Decoder's fail-closed contract.

Required gates are:

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/decoders/gpx-decoder.test.js
node --test tests/import/*.test.js tests/contracts/*.test.js tests/storage/*.test.js
npm test
git diff --check
```

The implementation and final closure heads must each pass exact-head pull-
request CI.

## A9 implementation evidence ledger

- A0 baseline: local and remote `integration/v2` were clean and exactly
  `a5b1c6942980458495777a5285536ef8be301d50`; the target branch did not exist.
- A1 docs-only commit:
  `2a236567ccc80c51987bebc9c0d3c9fc9b9c1663`. Draft PR #19 targets
  `integration/v2`, and exact-head CI run `31002059498` passed.
- The synthetic core-only fixture validated with `xmllint --nonet` against the
  official Topografix GPX 1.1 XSD. Standalone synthetic TPE v2 and Activity
  Extension v2 `TPX` fragments also validated with `--nonet` against their
  selected official Garmin schemas. All schemas remained in `/private/tmp`.
- Native browser ESM smoke passed first in the in-app browser and then in a new
  disposable headless Chrome profile driven through loopback CDP. The latter
  decoded two bundles and six series with `fetch`, XHR, WebSocket, Worker,
  console warning/error, uncaught, and unhandled counts all zero. Local and
  Session Storage, IndexedDB, Cache Storage, and Service Worker counts were zero
  before and after. CDP observed 12 same-origin static requests, zero external
  requests, and zero runtime failures. The server, tabs, processes, ports,
  temporary profile, and CDP script were removed after verification.
- Pre-review local gates passed: clean `npm ci`; syntax over 195 files; privacy;
  23 focused GPX tests; 405 Import/Contract/Storage tests; and 1,258 full tests.
  `git diff --check` passed. Final gate results are recorded in Closure after the
  independent review is closed.

## A10 Final Review Closure

The independent read-only review inspected exact base
`a5b1c6942980458495777a5285536ef8be301d50` through implementation head
`8c44fc152fe0fc83de01267fe0dfa44a84fde76b`. It confirmed the six-path
allowlist and all requested review surfaces, then reported one actionable P1:
the named-entity allowlist used an inherited ordinary-object lookup, allowing
prototype names such as `constructor` and `__proto__` instead of failing closed.

Closure followed the frozen test-first rule. Minimal `&constructor;` and
`&__proto__;` cases were added to the XML-security matrix and first reproduced a
missing expected `FILE_CORRUPTED` failure. The implementation was then changed
to explicit comparisons for exactly `amp`, `lt`, `gt`, `apos`, and `quot`. The
targeted regression and all 23 focused tests passed. Independent read-only
re-review also directly checked `toString`, found the closure diff restricted to
the Decoder and focused test, and returned **PASS / no actionable findings**.

Verified Closure state before this governance-only correction:

- implementation head:
  `8c44fc152fe0fc83de01267fe0dfa44a84fde76b`;
- entity correction head:
  `65ec01321e324fe4a827d62f746921ab5d1ea9d3`;
- implementation exact-head CI run `31003722128`: SUCCESS;
- entity correction exact-head CI run `31004660022`, job `92301534855`:
  SUCCESS;
- PR #19 at the entity correction head: `OPEN`, Draft `false`, `MERGEABLE`,
  `CLEAN`, with exactly 6 changed files.

After closure, the final local gates passed again: clean `npm ci`; syntax over
195 files; privacy; 23 focused GPX tests; 405 Import/Contract/Storage tests;
1,258 full tests; and `git diff --check`.

The final docs-only correction commit SHA and its exact-head CI run/job are
recorded in the PR body after that CI completes. They are intentionally not
self-recorded in this file, because doing so would create a new documentation
head and invalidate the exact-head evidence being cited.

## Completion gate

After implementation, a genuinely independent read-only reviewer inspects the
exact-base diff, literal allowlist, XML security, namespace/path handling,
mapping, missing/null/zero behavior, all resource limits, Canonical output,
redaction, zero-I/O browser evidence, migration/privacy, and rollback.

Every actionable finding is reproduced with a minimal failing test before
repair. Review repeats until PASS with no actionable findings. Only after the
Closure ledger, all final local gates, final exact-head CI success, clean
worktree, local/upstream `0/0`, and GitHub `OPEN / MERGEABLE / CLEAN` may the
Draft PR become Ready for review.

Stop after Ready. Do not merge, clean the branch/worktree, modify
`integration/v2`, deploy, or start PR-14/M11.
