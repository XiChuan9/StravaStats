# Known Limitations

This list distinguishes release blockers from accepted product/verification limitations. Passing
unit tests, a merged PR, Draft-to-Ready, or a release-candidate document does not close a blocker.
The authoritative item-level status is the [PR-24 release-gate ledger](../tasks/pr-24-release-documentation.md).

## Production release blockers

| Blocker | Current evidence | Required before production release |
| --- | --- | --- |
| No V2 release artifact | Package metadata remains `1.0.0`; there is no `v2.0.0-*` tag, GitHub Release, production deployment, or release-owner approval | Version/release decision, authorized tag/artifact/deployment, exact release evidence, owner approval |
| Production Service Worker lifecycle | Local policy is tested; existing `sw.js` keeps fixed cache `strava-dashboard-v1`; production update, mixed-version, cold-offline, eviction, and rollback are not run | Rehearsed production-like worker/cache/deployment matrix without deleting user data |
| External privacy baseline | R11 disables runtime telemetry and serves exact-version-pinned visualization libraries same-origin; weather, map tiles, AI Coach, and Legacy provider features retain their separate affirmative controls or inherited boundaries; PR-01 also records unresolved same-origin Service Worker API-cache risk | Close the remaining external-feature and cache boundaries without weakening R6/R7/R8/R9 contracts |
| Inherited logging and weather location egress | Inherited raw console and server/API logging can expose activity/provider values, while weather can still send exact activity dates and coordinates to an external service; R8 now denies map tiles until a per-map coarse OSM grant | Treat remaining logging/weather behavior as a production privacy release blocker; obtain release-owner privacy sign-off |
| Real account and private-library evidence | Auth lifecycle and imports pass deterministic synthetic tests; real OAuth, disconnect, private Legacy/V2 libraries, and real FIT/TCX/GPX/ZIP were not run | Private, authorized evidence outside Git with redacted public summary |
| Cross-browser support | Actual-served evidence is disposable Chromium/Chrome; Safari, Firefox, Windows, iOS/PWA, mobile, and broad assistive-technology matrices are not verified | Release matrix for supported browsers/platforms or an approved, time-bounded waiver |
| Real parity and Shadow review | Projection and redacted Shadow reports pass synthetic tests; no real-library Legacy/Canonical parity or Shadow difference sign-off exists | Private parity review with owner decision and zero unresolved P0 discrepancy |
| Full rollback rehearsal | Explicit Legacy/Shadow behavior is tested, but production deployment, Service Worker, backup, disconnect, and final rollback drill are not run together | Recorded end-to-end rollback exercise with owners and preserved data counts |
| Defect closure | No release-wide P0/P1 inventory and sign-off was provided | Release-owner defect audit showing zero unresolved P0/P1 issues |

These blockers are outside PR-24's docs-only authority. They must not be “fixed” by weakening a
gate, deleting data, editing a test result, or describing unrun work as passed.

## Current product limitations (non-blocking for documentation)

### Sources and provider connection

- Sources currently imports local FIT, TCX, GPX, English Strava `activities.csv`, and bounded
  Strava ZIP.
- Real-mode Sources supports explicit connect, disconnect, and `Sync latest 25`. Sync reads exactly
  one provider page, uses at most two activity workers, and never starts automatically.
- Provider Sync has no second page, fetch-all, automatic retry, background polling, webhook, or
  automatic resume. Real local import and provider Sync share one same-origin Web Lock and durable
  90-second V6 lease; stale linked work and restored orphans require explicit Recover or Abandon.
  This does not coordinate other profiles, browsers, devices, origins, or storage buckets.
- Non-auth detail or stream failures degrade that optional enrichment to unavailable warnings.
  Authentication failures require reconnect, rate limiting requires a later explicit press, and a
  stale SourceConnection history CAS can leave imported items committed without advancing
  `lastSyncAt`.
- Demo seed import is unavailable. Demo remains isolated from Real storage and provider state.
- No background continuous import, directory watcher, or cloud multi-device sync is provided.

### Import bounds and format coverage

- Selection: 1,000 files and 256 MiB total.
- Ordinary job: 25 files and 32 MiB.
- CSV: 5 MiB, 10,000 rows, 128 columns; current profile is English Strava export.
- ZIP: 64 MiB archive, 10,000 entries, 256 MiB total expansion, ratio/depth/name/time limits;
  encrypted, multi-disk, ZIP64, nested archives, special files, and data descriptors are rejected.
- FIT/TCX/GPX: 16 MiB each with bounded record/XML matrices. The decoders intentionally support the
  accepted P0 subset, not every vendor extension or corrupt-export recovery heuristic.
- Large mobile imports may fail earlier because browser memory/quota is below repository limits.

### Duplicate Review is not merge

Similarity creates a bounded review candidate. Confirm-same and keep-separate append decisions but
do not merge, hide, replace, delete, unmerge, split, or choose field-level provenance. The P1
field-selection and reversible-merge workflow is future work.

### Backup and Diagnostics

- V2 backup is exact-current, whole-buffer, limited to 256 MiB, and restores only to absent or
  exact empty V6. Current export is format 3/V6; frozen format 1/V4 and format 2/V5 archives are
  accepted only through the additive profiles described in the Backup Guide. It is not a general
  merge/import or cross-version conversion format.
- Diagnostics Storage Estimate is coarse, rounded, origin-wide, and not exact app bytes, free disk
  space, or a persistence guarantee.
- Diagnostics records are bounded to the current tab/session and are not a durable audit log.

### External map tiles

- Every Real map starts without external tiles. Permission is explicit, memory-only, and scoped to
  one map in one loaded document; reload, direct navigation, a new detail/Gear document, or a
  region-changing filter/view starts denied again.
- The only tile provider is OpenStreetMap through exact `a`, `b`, and
  `c.tile.openstreetmap.org` HTTPS hosts. Requests are limited to zoom 11 or lower and the initially
  approved coarse envelope. There is no retry, alternate provider, geocoder, durable tile cache, or
  automatic fallback.
- Tile paths disclose an approximate displayed region and timing to the provider. Revocation stops
  new work and cancels registered loads but cannot recall already received requests or erase
  browser/provider records.
- Demo issues no map-location request or grant-state access. Canonical root summaries contain no
  GPS and therefore offer no tile action. Swim and Run Plus/NSM have no direct external map.
- Leaflet/Leaflet.heat are exact-version-pinned and served same-origin. R8 per-map consent still
  governs the separate OpenStreetMap tile requests. Cold first-ever offline documents may lack an
  uncached local rendering runtime. No third-party CDN is used for that runtime, and there is no
  CDN fallback.

### Performance evidence

- The 5,000-activity and 200,000-point gates passed in the disclosed synthetic Chromium and Node
  environments.
- 10,000 activities and 1,000 FIT throughput are record-only. No absolute release threshold or
  approved waiver closes those rows.
- Browser Chart, Leaflet, and Canonical Store measurements disclose recording stubs. They do not
  constitute every-device production measurements.

### Network, offline, and visual behavior

- Local import itself is browser-local, but the whole app is not fully offline because weather,
  map tiles, AI Coach, and Legacy provider features retain separate external request boundaries.
  Runtime telemetry is disabled and visualization assets are served same-origin.
- A cold first-ever offline install and production Service Worker upgrade/rollback are not verified.
- Deterministic functional browser gates ran, but pixel-perfect visual, broad responsive,
  localization, keyboard-only, screen-reader, and manual DevTools matrices are incomplete.

## Deferred capabilities

The current V2 candidate does not implement the PRD's later field-level provenance, reversible
merge/split, data-quality center, complete Analysis v2 invalidation, local directory watcher, or
reusable cross-provider external-AI consent system. AI Coach has only its narrow per-request Google
Gemini disclosure/preview boundary; it does not establish a general provider framework.
Garmin/COROS/Polar cloud connectors, Apple Health/HealthKit,
Android Health Connect, cloud sync, multi-user/coaching workspaces, native mobile apps, medical
diagnosis, and automated prescriptions remain P2 or later work.

## Evidence interpretation

`PASS` means a specific ledger row has traceable evidence. `PARTIAL` means implementation or tests
exist but a required environment/review is missing. `BLOCKED` means release cannot proceed without
external work or approval. `NOT RUN` is never equivalent to pass. Ready is not merge or release
authorization, and merge would still not authorize tag, deploy, Service Worker rollout, or cleanup.
