# PR-51: TCX Real-Data Compatibility Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | Implementation and private/browser verification complete; inherited release gate blocker documented |
| Base checkpoint | `0d260b9` |
| Feature branch | `codex/v2-tcx-realdata-hardening` |
| Data migration | None |
| Repository API change | None |
| Storage schema change | None |

## Goal

Make the existing production TCX decoder accept bounded Garmin activity-export
variants found during the user's explicitly authorized, private, off-Git
regression while preserving deterministic parsing, Canonical validation, and
fail-closed XML security.

The authorized directory is test input only. No filename, XML, activity ID,
timestamp, route, health value, device identifier, or source byte may enter
Git, logs, screenshots, diagnostics, or error text.

## Baseline evidence

The anonymous read-only baseline contains 691 TCX files. Production decode and
Canonical validation accept 604 and reject 87 with the existing static
`FILE_CORRUPTED` error. The failure clusters are:

- 53 files with a finite negative Garmin TPX speed sample;
- 20 files with conflicting fields at one repeated timestamp;
- 12 files with trackpoints encountered out of timestamp order;
- 2 files with a bounded core-root structural variant.

Resolving those first-order failures exposed three stacked variants in the same
two root-variant files: one alternate Lap summary order, one alternate TPX field
order with a redundant standard namespace declaration, and one bounded Lap
summary overlap. They are included below as exact allowlisted variants rather
than as general XML reordering.

The same directory contains 1,771 FIT files, all of which decode and validate
on the base checkpoint. Those files are a regression oracle only and are not in
this PR's production scope.

## Frozen normalization behavior

- A finite negative `ActivityExtension/v2` trackpoint `Speed` is physically
  unusable. Ignore that field only, preserve the rest of the trackpoint, and
  add one static warning. Do not clamp it to zero and do not derive a speed.
- Accept the exact schema-defined TPX `CadenceSensor` values `Footpod` and
  `Bike` as ignored device metadata. Unknown attributes or values still fail.
- Accept one exact attribute-free TPX order, `RunCadence`, `Speed`, `Watts`,
  when all three fields occur exactly once. The element may have no local
  namespace declaration or one default declaration equal to the standard
  ActivityExtension/v2 namespace. Add one static warning. A still-out-of-order
  partial sequence, repeated or additional field, ordinary attribute, prefixed
  declaration, or any other local namespace declaration still fails. Removing
  `RunCadence` or `Speed` may naturally produce an already-supported standard
  sequence and does not add the normalization warning.
- Collect at most the existing 200,000 trackpoints, then perform a stable
  timestamp sort when document encounter order is not monotonic. Add one
  static warning; never alter timestamp values.
- Repeated timestamps use a stable linear pass. Equal or complementary data is
  collapsed only against the latest retained row. When two non-null fields
  conflict, preserve both rows at the same offset in stable source order, add
  one static warning, and compare the next row only with that latest retained
  row. Never scan backward for a different compatible representative, pick a
  winner, interpolate, average, fabricate a value, or exceed linear work for a
  same-timestamp group.
- Activity elapsed time must cover both the existing Lap-derived end and the
  final retained stream offset. Extending it adds one static warning; Lap
  summaries themselves remain unchanged.
- Accept one exact alternate Lap child order:
  `TotalTimeSeconds`, `DistanceMeters`, optional `MaximumSpeed`,
  `AverageHeartRateBpm`, `MaximumHeartRateBpm`, `Calories`, optional `Cadence`,
  then one or more `Track` elements. Both heart-rate summaries and `Calories`
  immediately after the maximum summary are required for this alternate path.
  Add one static warning. Missing, repeated, additional, or differently ordered
  children still fail unless they independently satisfy the existing standard
  TCX order.
- A single bounded exception may shorten the previous Canonical Lap elapsed
  summary when adjacent declared summaries overlap by more than zero and at
  most 60 seconds. The next Lap start must be later than the previous start,
  the previous Lap must have a trackpoint whose latest timestamp is at or before
  the next start, and the current Lap must have a trackpoint whose earliest
  timestamp equals its declared start. Only the previous Lap elapsed is clipped
  to the next start; distance, trackpoints, Activity start, and the current Lap
  remain unchanged. Add one static warning. Missing trackpoint evidence, a
  larger correction, or any other overlap still fails. This is the sole
  exception to preserving Lap summaries verbatim.
- Ignore only trackpoints whose timestamp precedes the declared Activity start,
  add one static warning, and preserve every later point. If filtering would
  remove every source trackpoint, fail closed instead of producing a silently
  empty stream set. Do not shift the Activity start or clamp timestamps.
- Accept one exact Garmin root variant: a direct, attribute-free core
  `Creator` immediately before `Activities`, with no attributes or children and
  exactly one nonempty bounded scalar text value. Ignore that value and treat
  it as device metadata. An empty, child-bearing, attributed, repeated, or
  differently positioned root Creator still fails. Course-only, Workout-only,
  MultiSport, extra Activity, TCX v1, namespace spoofing, DTD/entity/XInclude,
  and unsafe XML remain rejected.
- All new warnings use fixed code/path/message triples and reveal no source
  values. Parser version advances only if output semantics change.

## Allowed paths

```text
docs/tasks/pr-51-tcx-realdata-hardening.md
js/decoders/tcx/decoder.js
tests/decoders/tcx-decoder.test.js
tests/fixtures/synthetic/tcx/tcx-fixture.js
tests/import/decoder-registry-wiring.test.js
```

No other path is authorized without updating this brief first.

## Acceptance

- Failure-first synthetic tests cover negative speed, `CadenceSensor`, stable
  sorting, compatible and conflicting repeated timestamps, duration extension,
  the exact approved root variant, and hostile near misses.
- The 691 private TCX files pass production decode plus
  `validateImportedActivityBundle`; the 1,771 private FIT files remain green.
- Focused decoder, Registry, Import, Source Manager, privacy, and full repository
  tests pass without network or private fixtures.
- ego-browser starts from an explicitly emptied local activity library, imports
  the authorized TCX and FIT files in bounded batches through the real
  Worker/Storage path, and verifies representative list, detail charts, maps,
  and analysis using anonymous booleans and counts only.
- Required gates are `npm ci`, `npm run check:syntax`,
  `npm run check:privacy`, `npm test`, and `git diff --check`.

## Migration, privacy, and rollback

There is no database or settings migration. Existing imported records are not
rewritten. Rollback is a code revert; newly accepted files remain valid stored
Canonical data, and source files remain untouched. The browser test library is
destructive test state authorized by the user, not committed evidence.

## Verification status

- Focused Decoder and Registry tests: 57/57 pass.
- Authorized private, read-only production decode plus Canonical validation:
  691/691 TCX and 1,771/1,771 FIT pass. Only anonymous counts were retained.
- ego-browser imported all 2,462 supported files in five bounded selections
  through the production Worker and Storage path: 2,462 activities, raw
  artifacts, and Import items; zero failed selections and zero duplicate
  candidates. No screenshot or private value was captured.
- `npm ci`, syntax (293 files), privacy, and `git diff --check` pass on the
  available runtime. `npm ci` reports the known engine mismatch: the project
  requires Node 24.19.0/npm 11.17.0 while this machine provides Node 25.8.1/npm
  11.11.0.
- Full `npm test` passes 2,010/2,011. The only failure is the inherited Alpha
  G1 point-in-time payload count assertion: exact `HEAD` selects 211 payloads
  while `tests/release/alpha-candidate.test.js` still expects 209. The test
  reads committed `HEAD`, so the TCX worktree diff cannot cause that mismatch;
  changing the release freeze is outside this PR's allowlist.
