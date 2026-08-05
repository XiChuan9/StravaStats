# Import Core Rules

These rules extend the repository root instructions for `js/import/`.

- Import runtime accepts only descriptor-safe plain data and never executes
  caller accessors, iterators, Proxy traps intentionally, or raw error causes.
- PR-09 supports deterministic Synthetic JSON, the frozen English Strava
  `activities.csv` profile, and the strict synthetic Strava ZIP profile frozen
  in `docs/tasks/pr-09-strava-zip.md`. Do not add another locale, a general ZIP
  API, FIT/TCX/GPX/XML decoding, a provider, or network behavior here.
- CSV parsing is bounded and inert: never evaluate formulas, follow links,
  execute markup, guess units/locales, or depend on host locale/timezone.
- Every Canonical write must pass `validateImportedActivityBundle` and use the
  storage-owned per-item transaction seam.
- Reports and public errors must not contain raw artifacts, payloads, IDs,
  filenames, locations, health values, Tokens, Authorization, or causes.
- Cancellation never deletes a successful item or stored data. Retry is explicit
  and idempotent; no hidden automatic retry is permitted.
- Do not import pages, tabs, analysis, Legacy cache, provider connectors, or
  application composition roots.
- Tests are deterministic, synthetic, offline, and must restore mutated globals.
