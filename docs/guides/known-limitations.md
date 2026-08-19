# Known Limitations

This list records current limitations of the public local-import core and preserves older release
planning as clearly labeled history. Passing unit tests, a merged PR, or this scope-freeze document
does not authorize an Alpha, Beta, Release Candidate, production release, publication, hosting, or
deployment. The current public boundary is the
[Public Local Import Core Task Brief](../tasks/public-local-import-core-freeze.md); the
[integration gate](../engineering/release-gates.md) governs this freeze.

## Pre-freeze production-release blockers (historical)

The following table is retained as a point-in-time record of the earlier V2 release program. It is
not a current roadmap, does not reintroduce retired public functionality, and cannot authorize new
release work. Its historical status text and package references must be read in that context.

| Blocker | Historical evidence | Historical requirement |
| --- | --- | --- |
| No verified or published V2 release artifact | Package metadata is `2.0.0-alpha.1` on an unverified local candidate-building head; G13 is `PARTIAL` and G12 is `NOT RUN`. There is no tag, GitHub Release, publication, hosting, deployment, or exact-object release-owner approval | G12 exact-head and exact-object verification, later owner approval, and separately authorized tag/Release/publication actions |
| Production Service Worker lifecycle | R9 admits only approved same-origin static assets; API/private/dynamic requests never enter cache handling. D3 has deterministic evidence for the waiting/drained lifecycle with current cache `stravastats-static-v2-000001`; `strava-dashboard-v1` is recognized as the preserved legacy cache, not treated as the current cache or blindly deleted. Production update, mixed-version, cold-offline, eviction, deployment, and rollback are not run | Rehearsed production-like worker/cache/deployment matrix without deleting user data |
| Real account and private-library evidence | Auth lifecycle and imports pass deterministic synthetic tests; real OAuth, disconnect, private Legacy/V2 libraries, and real FIT/TCX/GPX/CSV/ZIP were not run. G2 blocks RC for real Legacy rescue; G5/G6 remain `NOT RUN` | Separately authorized private evidence outside Git under the approved protocol, with redacted public summary |
| Cross-browser support | Actual-served evidence is disposable Chromium/Chrome; Safari, Firefox, Windows, iOS/PWA, mobile, and broad assistive-technology matrices are not verified | Release matrix for supported browsers/platforms or an approved, time-bounded waiver |
| Real parity and Shadow review | Projection and redacted Shadow reports pass synthetic tests; G3 blocks RC for real parity and remains `PARTIAL` without real-library sign-off | Private parity review with zero unresolved P0 discrepancy and XiChuan9 explanation/sign-off for every non-P0 difference |
| Full rollback rehearsal | Explicit Legacy/Shadow behavior is tested, but production deployment, Service Worker, backup, disconnect, and final rollback drill are not run together | Recorded end-to-end rollback exercise with owners and preserved data counts |
| Performance budget/waiver | 5,000 activities and 200,000 points pass in disclosed synthetic environments; 10,000 activities and 1,000 FIT throughput remain record-only. XiChuan9 approved a time-bounded waiver through 2026-11-12 | Complete a representative real-hardware budget task before expiry; do not weaken correctness/privacy gates or claim performance `PASS` |
| Final defect and release-head closure | PR #57 Retry closed deterministically. PR #58 P1-DOCS closed deterministically at `f7f18392...`; no unresolved deterministic P0/P1 was found there | G12 exact verification and a fresh zero-P0/P1 inventory on each future release head, followed by release-owner approval |

These blockers are outside PR-24's docs-only authority. They must not be “fixed” by weakening a
gate, deleting data, editing a test result, or describing unrun work as passed.

## Pre-freeze owner dispositions (historical)

- **R3 public Git history:** privacy/security owner XiChuan9 approved a no-rewrite risk acceptance
  disposition after no evidence of credential exposure was found. Current-tree removal and the
  regression guard remain mandatory. This is not erasure: the historical exposure was not removed
  from public history, and this authorization permits no rewrite, force-push, ref/tag/Release/PR
  deletion, value repetition, or external notification.
- **Limited Alpha candidate:** `v2.0.0-alpha.1` is an unverified local, non-production static Web
  candidate-building head, current macOS Chrome-only and explicitly synthetic-only. G2 and G3 are
  deferred to RC, not waived or `PASS`. G12 final status, public web Alpha, artifact publication,
  tag, Release, hosting and deployment remain unauthorized.
- **Private evidence protocol:** XiChuan9 is custodian. Raw Tokens/accounts/private files and browser
  profiles never enter Git; only separately authorized disposable/isolated execution and permitted
  redacted aggregate counts/statuses/hashes may be used. Protocol approval is not real-data access.

## Current product limitations (non-blocking for documentation)

### Public scope freeze and retained browser state

- Retired personal-extension navigation, routes, runtime modules, styles, dedicated tests, and
  current-feature documentation are not part of the public local-import core.
- The scope freeze performs no IndexedDB version or schema change and introduces no data migration.
  Canonical and Legacy activities, Sources, RawArtifacts, Import records, duplicate decisions,
  backups, and connection state are neither cleared nor rewritten.
- Historical personal-extension LocalStorage settings are not read, copied, migrated, overwritten,
  or deleted by the public runtime. They may remain in an existing browser until the user applies a
  separate, explicit site-data policy.
- No cache-cleanup migration is introduced. Previously cached files may remain unreachable and may
  age out through the browser or the already-established Service Worker lifecycle; this freeze does
  not enumerate or delete them.

### Sources and provider connection

- Sources currently imports local FIT, TCX, GPX, English Strava `activities.csv`, and bounded
  Strava ZIP.
- Real-mode Sources supports explicit connect, disconnect, and `Sync latest 25`. Sync reads exactly
  one provider page, uses at most two activity workers, and never starts automatically.
- Provider Sync has no second page, fetch-all, automatic retry, background polling, webhook, or
  automatic resume. Real local import and provider Sync share one same-origin Web Lock and durable
  90-second V6 lease; stale linked work and restored orphans require explicit Recover or Abandon.
  This does not coordinate other profiles, browsers, devices, origins, or storage buckets.
- “No automatic retry” above applies to provider acquisition. Separately, an eligible failed local
  import can expose an explicit single-use Retry from retained pending bytes. Retry uses the same
  lock/lease, never starts automatically, preserves committed items, and is unavailable without the
  exact retained bytes.
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

### Legacy presence probe residual

The R10 Legacy presence probe is non-destructive and never calls `deleteDatabase`. Under accepted
Option B, the narrow race in which another context deletes the V1 database while the inspection
open is later aborted can leave an empty V1 database shell. That shell has zero object stores and
zero user records; existing Legacy and V2 data are never cleared or overwritten.

### Consented weather egress

Weather starts denied and makes no request during ordinary startup. After the user explicitly
chooses `Allow for this tab`, one request may send one approximate start coordinate rounded to two decimals
and the exact local calendar date to Open-Meteo. Consent is tab-scoped and revocable.
This is an accepted R6 external boundary, not local-only behavior; no real-account or production
external-service evidence was run for release.

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
  GPS; the Real Canonical global Map instead reads the filtered activities' local position streams
  on first use, with at most 5,000 activities, 30,000 aggregate display points, 2,000 points per
  route, and two concurrent local reads. This local hydration does not request tiles: the existing
  per-map consent remains required before any OpenStreetMap request. Swim has no direct external
  map.
- Leaflet/Leaflet.heat are exact-version-pinned and served same-origin. R8 per-map consent still
  governs the separate OpenStreetMap tile requests. Cold first-ever offline documents may lack an
  uncached local rendering runtime. No third-party CDN is used for that runtime, and there is no
  CDN fallback.

### Performance evidence

- The 5,000-activity and 200,000-point gates passed in the disclosed synthetic Chromium and Node
  environments.
- Canonical Global Map hydration is lazy and proportional to the visible activity count. In the
  authorized counts-only 2,462-file browser smoke, the cold local load took about 31.5 seconds and
  included an observed 182 ms long task while IndexedDB returned full position streams; repeated
  views in the same page session reuse the bounded reduced-route cache. This hardware/library
  observation is not evidence of data loss or an external request, but cold-load responsiveness
  remains an optimization target.
- 10,000 activities and 1,000 FIT throughput are record-only. The waiver through 2026-11-12 keeps
  the rows `PARTIAL`, not `PASS`; a representative real-hardware budget task is due before expiry.
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

The public local-import core does not implement the pre-freeze PRD's later field-level provenance,
reversible merge/split, data-quality center, complete Analysis v2 invalidation, local directory
watcher, or reusable cross-provider external-AI consent system. AI Coach has only its narrow
per-request Google Gemini disclosure/preview boundary; it does not establish a general provider
framework.
Garmin/COROS/Polar cloud connectors, Apple Health/HealthKit,
Android Health Connect, cloud sync, multi-user/coaching workspaces, native mobile apps, medical
diagnosis, and automated prescriptions remain P2 or later work.

## Evidence interpretation

In the historical ledger, `PASS` means a specific row had traceable evidence; `PARTIAL`, `BLOCKED`,
and `NOT RUN` retain their point-in-time meanings. None of those labels is current release
authorization. The scope-freeze branch does not authorize tag, publication, deployment, Service
Worker rollout, cache cleanup, or user-data cleanup.
