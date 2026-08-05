# PR-12: TCX Decoder

## Metadata

| Field | Value |
| --- | --- |
| Status | Scope and contract frozen / Draft publication pending |
| Milestone | M9 |
| Base branch | `integration/v2` |
| Exact base SHA | `c428f44ed35ba5d60c10611c3d3370f210bea08f` |
| Feature branch | `codex/v2/decoder-tcx` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/f761/StravaStats` |
| Owner | XiChuan9 / Codex execution |
| Reviewer | Independent Final Review before Ready transition |
| Dependency | PR-11 / PR #17 merged into `integration/v2` |
| Created | 2026-08-05 |

## Goal

Deliver one pure, deterministic, zero-I/O TCX v2 Decoder boundary for later
Decoder Registry wiring:

```text
strict plain artifact descriptor
-> bounded XML 1.0 lexical parser and namespace resolver
-> one TCX v2 Activity with multiple Laps and Tracks
-> selected Garmin activity/trackpoint extensions
-> ImportedActivityBundle
-> existing Canonical validators
```

This PR does not register TCX in the production Decoder Registry, Worker, or
Source Manager. It does not change ImportService, Repository, Canonical or
Storage schemas, Service Worker, deployment, pages, feature flags, or Legacy
behavior.

## A0 baseline evidence

- The assigned worktree began detached and clean at exact SHA
  `c428f44ed35ba5d60c10611c3d3370f210bea08f`.
- Starting HEAD, local `integration/v2`, and `origin/integration/v2` matched the
  exact fixed base. The base is the squash merge of PR-11 / PR #17.
- The isolated branch `codex/v2/decoder-tcx` was created from that exact SHA;
  neither long-lived branch was modified.
- `package.json` contains no XML parser and remains unchanged. No real TCX,
  athlete export, account, Token, route, health/power history, device serial,
  screenshot, private fixture, or user browser profile was read.

## A1 publication rule

The first branch commit contains only this Task Brief. It must be pushed before
implementation, and it opens a Draft PR with
`integration/v2 <- codex/v2/decoder-tcx`. No implementation path may be staged
before that docs-only commit and Draft PR exist.

## A2 authority and read-only findings

Authority order for this PR is:

1. accepted ADR-0001, ADR-0002, ADR-0004, and ADR-0006;
2. the product PRD and v2 development plan PR-12 entry;
3. architecture overview;
4. existing Canonical, Import, and Storage contracts;
5. PR-07 through PR-11 Task Briefs and the FIT/CSV/ZIP decoders;
6. this frozen task contract and implementation details.

Primary format evidence was downloaded only to `/private/tmp` and is not
vendored or committed:

- Garmin
  [`TrainingCenterDatabasev2.xsd`](https://www8.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd);
- Garmin
  [`ActivityExtensionv2.xsd`](https://www8.garmin.com/xmlschemas/ActivityExtensionv2.xsd);
- Garmin
  [`TrackPointExtensionv1.xsd`](https://www8.garmin.com/xmlschemas/TrackPointExtensionv1.xsd);
- W3C XML 1.0, Namespaces in XML, and XInclude specifications;
- OWASP XML External Entity Prevention guidance;
- Strava's TCX upload documentation as interoperability evidence only.

The Garmin TCX v2 schema freezes the core namespace, `Activities / Activity /
Lap / Track / Trackpoint` graph, source `Id`, lap/point times, metres, seconds,
heart rate, cadence, and the generic `Extensions` wildcard. ActivityExtension
v2 freezes `Speed` as a double, `RunCadence`, and `Watts` as unsigned short.

TCX core and ActivityExtension v2 do not define temperature. This PR therefore
does not claim a generic TCX temperature field. It accepts only Garmin
TrackPointExtension v1 `TrackPointExtension/atemp` and `/wtemp`, whose XSD
defines degrees Celsius, when nested beneath a TCX v2 Trackpoint's schema-
defined `Extensions` wildcard. Garmin documents that schema for GPX 1.1; this
is a deliberately narrow cross-schema interoperability profile, not a claim
that temperature belongs to Garmin TCX core or ActivityExtension v2.

### Existing seam and one-Activity contract

The current production graph remains:

```text
Source Manager (CSV/ZIP only)
-> ImportService
-> production Decoder Registry / Worker
-> existing CSV/ZIP/Synthetic decoders
-> Canonical transaction
```

PR-12 remains outside that graph:

```text
direct internal ESM import / future PR-14 wiring
-> js/decoders/tcx/decoder.js
-> tcxDecoder.decode({ mediaType, content })
-> one ImportedActivityBundle
```

The existing Decoder seam returns one bundle. A TCX document with zero or more
than one direct `Activities/Activity`, any `MultiSportSession`, or a Course-only
document fails closed. This PR does not add `decodeAll`, return an array, split
one artifact into many ImportItems, or change a public Import contract.

## A3 parser decision

| Candidate | Node/browser equivalence | Security/resource control | Scope | Decision |
| --- | --- | --- | --- | --- |
| Browser `DOMParser` plus a Node equivalent | Browser-native, but Node has no equivalent in the current dependency graph | Parser-specific DTD/entity behavior; full DOM allocation precedes semantic limits | Requires dependency or injectable parser contract | Rejected |
| Add a SAX/XML production dependency | Equivalent when bundled | Depends on third-party security settings and license/update review | Package/lockfile change is a pause condition | Rejected |
| Browser-only DOM plus test shim | Different parser in Node and browser | Cannot prove one lexical/security boundary | Misleading verification | Rejected |
| Small internal bounded XML 1.0 tokenizer and namespace resolver | Same native ESM in Node and browsers | Rejects dangerous syntax before semantic mapping and applies exact limits | One additive internal module | Selected |

The selected parser is not a general XML library. It supports only the lexical
features required by the frozen TCX profile: optional UTF-8 BOM, an optional
XML 1.0 declaration, start/end/empty tags, namespace declarations, attributes,
character data, comments, the five predefined XML entities, and bounded numeric
character references. It does not expose a DOM or general XPath API.

## A4 frozen Decoder contract

### Descriptor, media type, and output

The exact direct descriptor is:

```js
{
  mediaType: "application/vnd.garmin.tcx+xml",
  content: "<TrainingCenterDatabase ...>...</TrainingCenterDatabase>"
}
```

- The descriptor must be an exact non-array plain object with own enumerable
  data properties `mediaType` and `content` only.
- Accessors, symbols, custom prototypes, unexpected/missing keys, non-strings,
  and reflection-failing or structured-clone-rejected Proxies fail closed.
  As in PR-11, portable JavaScript cannot promise zero Proxy reflection traps;
  no property `get`, target accessor, iterator, coercion, or application method
  is intentionally invoked.
- Empty content is `FILE_EMPTY`; a structurally valid different media type is
  `UNSUPPORTED_FORMAT`; every unsafe descriptor, XML, semantic conflict, or
  resource breach is the existing static redacted `FILE_CORRUPTED`.
- The input object and string are not modified. The returned bundle is detached
  and deeply frozen, and it passes `validateImportedActivityBundle`.
- Errors never retain or expose XML, element/attribute/text values, IDs,
  timestamps, coordinates, health/power/temperature values, filenames, causes,
  platform messages, or stacks beyond the existing static `ImportError` stack.

### XML security and namespace boundary

The parser rejects before output:

```text
DOCTYPE or any DTD subset
ENTITY declarations or any non-predefined named entity reference
external identifiers and external parsed entities
XInclude namespace/elements
all processing instructions other than the initial XML declaration
CDATA and every other declaration form
unbound prefixes, duplicate attributes, duplicate namespace declarations
namespace undeclaration, reserved-prefix misuse, malformed names
malformed comments, tags, attributes, entities, or truncation
NUL, forbidden XML controls, noncharacters, and unpaired UTF-16 surrogates
```

The XML declaration is XML syntax, not an application processing instruction.
It may appear only first (after one BOM), use XML version `1.0`, and may declare
only UTF-8 plus optional `standalone=yes|no`.

No namespace URI, `xsi:schemaLocation`, attribute, entity, or text is ever
dereferenced. The Decoder has no fetch, DNS, filesystem, DOM, storage, Worker,
Service Worker, Cache, logger, console, timer, or telemetry call.

Exact semantic namespace mappings are:

| Namespace | Accepted semantic use |
| --- | --- |
| `http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2` | Root and frozen core Activity paths |
| `http://www.garmin.com/xmlschemas/ActivityExtension/v2` | `TPX` with `Speed`, `RunCadence`, and `Watts`; `LX` is bounded and ignored |
| `http://www.garmin.com/xmlschemas/TrackPointExtension/v1` | `TrackPointExtension` with `atemp` and `wtemp` only under a core Trackpoint `Extensions` |
| `http://www.w3.org/2001/XMLSchema-instance` | Inert `type` and `schemaLocation` attributes only |
| `http://www.w3.org/XML/1998/namespace` | Reserved XML namespace only |

Default and prefixed forms are equivalent after namespace resolution. TCX v1,
no-namespace TCX, namespace spoofing, XInclude, core elements in an extension
namespace, or known extension elements at an unapproved path fail closed.

The TCX `Extensions_t` XSD explicitly permits `##other`. A bounded subtree in
an otherwise unknown nonempty namespace is accepted only as a direct child of
an approved core or Garmin extension `Extensions` element, is never mapped, and
adds one static `TCX_UNKNOWN_EXTENSION_IGNORED` warning. The same namespace
outside that wildcard path is an uncontrolled namespace and fails closed.

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
| Activities / Activity | 1 / 1 |
| Laps | 10,000 |
| Tracks | 20,000 |
| final Trackpoint rows | 200,000 |
| extension elements | 400,000 total, 32 direct children per `Extensions` |

Limits are checked before append or output growth. A breach returns no partial
bundle. There is no timeout that can leave background parsing alive; parsing is
synchronous and zero-I/O.

### Exact core structure and values

- Root must be TCX v2 `TrainingCenterDatabase`, with exactly one direct
  `Activities` and exactly one direct `Activity`.
- `Activity` requires one exact `Sport` attribute and one `Id`. Supported XSD
  sports are `Running -> run`, `Biking -> ride`, and `Other -> other`, all with
  null variant. Values are case-sensitive and never guessed from streams or
  creator/device metadata.
- Activity `Id`, every Lap `StartTime`, and every Trackpoint `Time` use a strict
  Gregorian `xsd:dateTime` subset with an explicit `Z` or numeric offset. The
  parser validates calendar fields and offsets itself, never uses host locale or
  host time zone, and normalizes instants to fixed-millisecond UTC.
- Activity source `externalId` preserves the exact nonempty `Id` text as an
  opaque string. Canonical/source/lap IDs use a deterministic percent-encoded
  prefix and stable encounter indexes; no value is parsed as an integer ID.
- `timeZone.ianaName` is null. `utcOffsetMinutes` is the explicit Activity Id
  offset, including true zero for `Z`; no IANA zone is guessed.
- Each Lap requires StartTime, TotalTimeSeconds, DistanceMeters, Calories,
  Intensity, and TriggerMethod. Total time and distance must be finite and
  non-negative. Laps keep source order, contiguous indexes, nondecreasing starts,
  and no overlap. Optional summary HR/cadence and unrepresentable lap extension
  aggregates are validated but not promoted into invented activity fields.
- Each present Track must contain at least one Trackpoint. A Lap may contain no
  Track at all and remains a valid summary-only lap.
- Each Trackpoint requires one Time. Position requires both latitude and
  longitude. Longitude follows the XSD `[-180, 180)` bound; latitude is
  `[-90, 90]`. Distance and speed are finite/non-negative; HR is integer
  `1..255`; cadence/RunCadence is integer `0..254`; Watts is integer
  `0..65535`; altitude and temperatures are finite numbers.
- Missing point fields become `null` only in a series that exists elsewhere.
  A stream with no non-null sample is absent. Numeric zero is always preserved.
- Trackpoint input time must be globally nondecreasing across Laps/Tracks.
  Equal-time points are folded in encounter order only when their non-null
  values do not conflict. A conflicting duplicate or a decreasing time fails.
- Position is non-null only when both coordinates are present and valid.
- Polar-style missing `TPX/Speed` remains missing. Speed is never derived from
  distance/time, GPS, power, or cadence.
- Suunto-style missing altitude remains missing. `NaN`, `INF`, `-INF`, numeric
  overflow, and every other non-finite altitude or numeric field fail closed;
  no preceding value, interpolation, clamp, or elevation correction is used.
- No moving stream/time, events, elevation gain, calories, device identity,
  serial, manufacturer/model, external time zone name, or analysis value is
  inferred.

### Stream, lap, provenance, and summary mapping

The only emitted point series are:

| TCX source | Canonical stream/unit |
| --- | --- |
| Position | `position` / `wgs84` |
| AltitudeMeters | `altitude` / `m` |
| DistanceMeters | `distance` / `m` |
| HeartRateBpm/Value | `heartRate` / `bpm` |
| Cadence or TPX/RunCadence | `cadence` / `rpm` |
| TPX/Speed | `speed` / `m/s` |
| TPX/Watts | `power` / `W` |
| TrackPointExtension/atemp | `temperature` / `C` |
| TrackPointExtension/wtemp | `waterTemperature` / `C` |

Base Cadence and RunCadence at the same point must agree or the file fails.
Both temperature fields may coexist because they have distinct semantics.

Activity `distanceMeters` is the exact sum of required lap distances.
`elapsedTimeSeconds` is the maximum non-overlapping Lap end offset from Activity
Id. No average or moving summary is derived. Canonical Laps preserve the TCX
Lap start, elapsed time, and distance. Events and devices are empty.

The one source is exact:

```text
provider = tcx
acquisitionMethod = local-file
externalId = exact Activity/Id text
rawArtifactId = null
deviceId = null
importedAt = normalized Activity start instant
```

`importedAt` is a deterministic fallback and receives a static warning. Creator
and Author trees are accepted only in their XSD positions and ignored; UnitId,
ProductID, names, part numbers, and other device/application identity are never
copied or exposed.

Successful bundles may contain only these static warnings:

```text
TCX_IMPORT_TIME_FALLBACK
TCX_DEVICE_METADATA_IGNORED
TCX_LAP_EXTENSION_IGNORED
TCX_UNKNOWN_EXTENSION_IGNORED
```

Warnings contain no source value.

## A5 deterministic synthetic verification matrix

All fixtures are authored from invented literals and explain their construction
in the synthetic fixture README. No real TCX or copied athlete export is used.

Positive and mapping evidence covers:

1. default and prefixed TCX namespaces with inert schemaLocation/type attrs;
2. one Activity contract and explicit rejection of multiple Activities;
3. multiple non-overlapping Laps and multiple nonempty Tracks;
4. Polar-style missing speed without derivation;
5. Suunto-style missing altitude plus non-finite altitude rejection;
6. Garmin ActivityExtension v2 Speed/RunCadence/Watts;
7. TrackPointExtension v1 air/water temperature;
8. no GPS, HR, cadence, speed, distance point, power, or temperature;
9. true zero for coordinates/distance/speed/cadence/power/temperature;
10. equal-time compatible folding, equal-time conflict, decreasing time, and
    missing Time;
11. summary-only Lap, empty present Track rejection, and unknown extension
    warning.

Adversarial evidence covers:

- empty/malformed/truncated XML, mismatched tags, duplicate attributes,
  namespace spoofing/unbound prefixes, TCX v1/no namespace, unsupported paths;
- DOCTYPE, internal/external ENTITY, entity expansion, external DTD, XInclude,
  processing instructions, CDATA, schemaLocation URLs, and encoded attack text;
- invalid dates/offsets/calendar overflow, invalid decimals/integers, NaN/INF,
  coordinate/range violations, duplicate fields, and semantic conflicts;
- every byte/depth/width/text/attribute/name/Activity/Lap/Track/Trackpoint/
  extension limit at and over the boundary;
- accessor descriptors, symbols, special prototypes, mutation attempts,
  reflection failures, Proxies, and redaction canaries;
- byte-identical output under UTC/C and a non-UTC/non-English environment;
- Node ESM import/decode with network, DOM, storage, IndexedDB, Worker, console,
  timer, and module side-effect sentinels at zero.

The focused suite validates every successful output with both
`validateImportedActivityBundle` and the activity/stream validators. Contract,
Import, and Storage regressions prove no public/schema/wiring change.

## A6 implementation allowlist

Only these six paths may change:

```text
docs/tasks/pr-12-tcx-decoder.md
js/decoders/tcx/decoder.js
tests/fixtures/synthetic/tcx/README.md
tests/fixtures/synthetic/tcx/tcx-fixture.js
tests/decoders/tcx-decoder.test.js
tests/decoders/tcx-decoder-browser-smoke.html
```

A seventh path, production dependency/package file, public API/export/schema,
Registry/Worker/Source Manager wiring, or material semantic expansion is a
pause condition requiring control-tower authorization.

## Prohibited scope

- `package.json`, lockfile, any production/test dependency, Accepted ADR, PRD,
  development plan, GitHub workflow, Service Worker, deployment, or release.
- Production Decoder Registry/Worker registration, Source Manager support
  state, ImportService/public Import API, Repository, Canonical contract or
  validator, Storage schema/store/index/migration, feature default, page, tab,
  analysis, bootstrap, cutover, or Legacy path.
- FIT/GPX work, general XML/DOM/SAX library, Course/Workout/MultiSport decoding,
  fuzzy identity, merge, backup/restore, provider/auth/network behavior.
- Unit/timezone/device/serial inference, speed/elevation/moving-time derivation,
  silent repair, value clamping, namespace fallback, DTD/entity/XInclude/PI
  processing, partial output after failure, or raw error interpolation.
- Real TCX/FIT/GPX/ZIP, credentials, accounts, Tokens, routes, locations,
  health/power history, private fixtures, screenshots in Git, user profiles, or
  provider/network-backed tests.

## A7 browser and reference gates

The test-only same-origin browser harness imports the internal Decoder as native
ESM and decodes deterministic synthetic TCX. An external CDP driver uses a newly
created disposable browser profile outside the repository. It records only safe
counts/codes and proves:

```text
external/provider/auth requests     0
fetch/XHR/WebSocket                  0
Token/Authorization observations    0
console warning/error                0
uncaught/unhandled failures          0
Local/Session Storage                0
IndexedDB                            0
Cache Storage                        0
Service Worker registrations         0
```

All pages, CDP sessions, browser processes, profiles, servers, and ports are
closed. The harness does not use Source Manager or claim production wiring.

Temporary XSD/reference validators may run only outside the repository against
synthetic fixtures. They are evidence, not dependencies or production code. A
reference tool's different recovery behavior never weakens the frozen fail-
closed Decoder contract.

## Required gates

```bash
npm ci
npm run check:syntax
npm run check:privacy
node --test tests/decoders/tcx-decoder.test.js
node --test tests/import/*.test.js tests/contracts/*.test.js tests/storage/*.test.js
npm test
git diff --check
```

Exact implementation and closure heads must pass pull-request CI.

## Privacy, migration, and rollback

Only deterministic synthetic XML is committed or used in automated/browser
verification. No raw XML or private value enters errors, warnings, logs, DOM,
browser evidence, CI evidence, or the PR body.

There is no data/schema migration, persistence operation, production format
registration, or feature behavior change. Existing Source Manager continues to
reject TCX. Legacy and V2 data are never opened, altered, cleared, overwritten,
reverse-copied, downgraded, or deleted.

Rollback is an additive six-path revert. No data conversion, cleanup, repair,
or cache operation is required.

## Completion gate

After implementation, run an independent exact-base Final Review of the parser,
namespace/path allowlist, XML attacks and limits, time/unit/source mapping,
missing/null/zero behavior, multi-Lap/Track semantics, Canonical output,
redaction, zero-I/O/browser evidence, and exact six-path scope. Reproduce every
actionable finding with a minimal failing test before repair.

Only after no actionable findings, all local gates, disposable-browser evidence,
complete closure ledger and PR body, clean worktree, local/upstream `0/0`,
exact-head CI success, and GitHub `OPEN / MERGEABLE / CLEAN` may the Draft PR
move to Ready for review.

Stop after Ready. Do not merge, modify or clean `integration/v2`, remove this
branch/worktree, or start PR-13/M10.
