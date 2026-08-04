# Summary Tab Boundary Rules

These rules add to the repository-root `AGENTS.md`; they do not replace or weaken it.

## Provider and storage boundary

- Tabs must not call `/api/strava-*` or read/write Tokens or Authorization data.
- Tabs must not select a provider, Connector, Repository implementation, Factory, activity
  cache, metadata cache, storage implementation, or IndexedDB database.
- Tabs must not call `createRepository` or retain a Repository reference.
- Provider-owned activities, athlete, zones, and gears must come only from data/read context
  injected by the application composition root.
- Demo data must never fall back to real Token storage, provider storage, caches, or Connector.

## UI and user-owned state

- UI preferences, filter state, and user overrides require explicit key names and documented
  ownership. They must not be represented as or confused with provider cache.
- Missing metadata or capabilities must use the existing explicit degradation and empty-state
  behavior; tabs must not recover them through provider or storage access.

## Tests, privacy, and parity

- Tests must be offline, deterministic, and synthetic.
- Do not use real activities, GPS tracks, heart-rate, power, Tokens, account data, or private
  fixtures. Do not enumerate or read `tests/fixtures/private/**`.
- A data-boundary migration must not change algorithms, thresholds, HTML, CSS, copy, routes,
  chart configuration, DOM IDs/classes, ordering, or visual output.
- Browser or visual verification that did not actually run must be recorded as `Not run`.

## Run Plus / NSM read boundary

- Run Plus gear labels and options use only the immutable session gear snapshot injected by the
  application composition root. They must not fall back to a provider or metadata cache.
- NSM activity and stream enrichment uses only the narrow injected `getActivity` and `getStreams`
  callbacks. Run Plus must not retain a Repository, construct a provider boundary, or read auth.
- Activity IDs crossing the injected boundary are opaque non-empty strings; do not parse, compare
  numerically, or manufacture a missing value as zero.
- Demo and Real use the same injected shape. Missing callbacks, malformed descriptors, malformed
  Repository envelopes, and read failures fail closed with stable safe UI behavior.
