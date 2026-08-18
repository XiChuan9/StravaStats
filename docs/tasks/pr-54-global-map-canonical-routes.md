# PR-54: Canonical Global Map Routes

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved; implementation and verification in progress |
| Base checkpoint | `af81271` |
| Feature branch | `codex/v2-global-map-canonical-routes` |
| Data migration | None |
| Repository API change | None |
| Storage schema change | None |

## Goal

Complete the local-import MVP by allowing the existing global Map tab to read
Canonical `position` streams through an app-owned, narrow read boundary. The
Map must automatically load all activities in the current date and sport
filter, render a deterministic bounded overview, and preserve the existing
per-map OpenStreetMap consent boundary.

The authorized private Garmin directory is browser input only. No filename,
activity ID, date, route, coordinate, health value, device value, screenshot,
or source byte may enter Git, logs, diagnostics, error text, or committed test
evidence.

## Frozen behavior

- Do not modify IndexedDB V6, Canonical contracts, Repository methods, summary
  projection, FIT/TCX/GPX decoders, or persisted activities and RawArtifacts.
- Only Real + Canonical creates the local route reader. Legacy and Shadow keep
  their existing summary polyline/start/end behavior. Demo performs zero Real
  storage, Repository, route-reader, or external-map I/O.
- Startup and non-Map tabs perform zero route stream reads. Opening Map, Apply,
  Reset, and sport-filter changes automatically read the current visible set.
  View, color, density, radius, and blur changes reuse the loaded snapshot.
- The app-owned route session accepts a dense, unique array of non-empty opaque
  string IDs. The current visible set is limited to 5,000 activities; 5,001 or
  more returns `limit-exceeded` before any stream read and leaves filters usable.
- Every read is exactly `getStreams(id, { types: ['latlng'] })`. Reads run with
  concurrency two. A new generation stops pending scheduling; at most two
  already-running IndexedDB reads may settle, and stale results never render.
- Route results are plain, frozen, index-aligned data with status
  `ready`, `partial`, `empty`, `failed`, `limit-exceeded`, or `superseded` and
  anonymous counts only. A failed activity cannot fail the remaining set.
- Global presentation uses at most 30,000 points total and 2,000 per activity.
  Per-route target is
  `min(2000, max(6, floor(30000 / visibleActivityCount)))`. Deterministic
  reduction preserves the first, last, minimum/maximum latitude, and
  minimum/maximum longitude points. Full-resolution Canonical streams remain
  untouched for detail pages.
- The in-memory LRU stores reduced geometries only and is capped at 30,000
  points. Valid no-GPS results are cached; failures are retried. Activity
  refresh, Repository/session/mode replacement, pagehide, clear, and dispose
  invalidate it. Analysis-profile recomputation does not.
- Canonical start/end points come from the reduced route first/last values.
  No route ID, name, date, coordinate, raw error, or private value is logged.
- Local routes may be read before consent, but no Leaflet/tile work or external
  request occurs until the existing exact OSM action is clicked. Filter or
  geometry changes revoke old consent; visual-only controls retain it.
- Map loading, ready, partial, empty, failed, and limit states use an
  `aria-live` status and fixed copy. Counts may be shown; coordinates and IDs
  may not.

## Allowed paths

```text
docs/tasks/pr-54-global-map-canonical-routes.md
docs/guides/known-limitations.md
index.html
js/app/global-map-routes.js
js/app/main.js
js/tabs/maps.js
tests/consumers/global-map-routes.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/canonical-summary-browser-smoke.html
tests/consumers/summary-boundaries.test.js
tests/legacy/demo-isolation.test.js
tests/pages/main.test.js
tests/performance/performance-browser-smoke.html
tests/privacy/map-location-egress.test.js
tests/release/alpha-candidate.test.js
```

No other production, decoder, importer, storage, Repository, schema, analysis,
feature-flag, service-worker, provider, or test path is authorized.

## Acceptance

- Route-session tests cover strict inputs, exact `latlng` reads, stable output
  order, concurrency two, generation supersession, retry/cache/clear/dispose,
  no-GPS and partial failures, hostile geometry, input immutability, the 5,000
  activity boundary, 30,000 aggregate budget, and 2,000-point single-route cap.
- Composition tests prove only Real + Canonical can create the loader and that
  startup, Legacy, Shadow, Demo, and unrelated tabs do not read streams.
- Map consumer/browser tests cover no-summary-GPS Canonical routes, every view,
  filters, repeated renders, fixed degradation copy, no invalid number, consent
  before external work, and no duplicate listeners or stale layers.
- The deterministic performance harness covers 5,000-route hydration with at
  most two reads, 30,000 points, no repeat reads, no external request, no
  runtime exception, and no new long task of 100 ms or more.
- The authorized private folder is rerun anonymously: 1,771 FIT and 691 TCX
  files must decode and validate; production browser import and `/map` evidence
  is counts/booleans only. Real OSM consent is not clicked and no screenshot is
  captured.
- Required gates are exact Node `24.19.0` and npm `11.17.0`, `npm ci`, focused
  tests, `npm run check:syntax`, `npm run check:privacy`, `npm test`,
  `npm audit`, and `git diff --check`.
- Adding `js/app/global-map-routes.js` changes the exact Alpha static payload
  count from 211 to 212 without changing the selection rule.

## Migration, privacy, rollback, and delivery

There is no migration and no persisted-data rewrite. Rollback is a code revert;
it leaves Legacy, Canonical, RawArtifact, settings, Token, and source files
unchanged. Private acceptance is off-Git and cannot become Alpha evidence.

The final local branch keeps its logical commits and prepares the PR title
`feat(v2): import local activity files into canonical analytics` targeting
`integration/v2`. Push, PR creation, GitHub CI, candidate build, and merge are
not authorized in this task and must remain `NOT RUN`.

## Verification

Pending implementation.
