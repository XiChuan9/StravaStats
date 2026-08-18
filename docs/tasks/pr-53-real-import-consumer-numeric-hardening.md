# PR-53: Real-Import Consumer Numeric Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | Local implementation, browser acceptance, and repository gates complete; exact-head CI pending |
| Base checkpoint | `56f45b5` |
| Feature branch | `codex/v2-import-consumer-hardening` |
| Data migration | None |
| Repository API change | None |
| Storage schema change | None |

## Goal

Keep Run, the Run Plus Overview, and Trends usable when a valid Canonical
activity omits optional numeric summary fields. Real FIT and TCX browser
acceptance found missing distance, moving-time, and elevation values propagating
as `NaN`, `Infinity`, or invalid chart buckets even though import and Canonical
validation had succeeded.

The authorized private Garmin directory is browser input only. No filename,
activity ID, date, route, health value, device value, screenshot, or source byte
may enter Git, logs, diagnostics, or error text.

## Frozen numeric behavior

- A usable aggregate metric is a JavaScript `number` that is finite and
  nonnegative. Do not coerce strings, booleans, `null`, or other values with
  `Number(...)`.
- A missing or unusable metric is excluded from that metric's aggregate; it is
  not a measured zero. A real numeric zero remains valid.
- Cards, records, and table cells with no usable sample display the existing
  unavailable marker `—`. They must never render `NaN`, `Infinity`,
  `undefined`, or a fabricated zero.
- Average pace uses only pairwise-complete activities whose distance is finite
  and positive and whose moving time is finite and nonnegative. Independent
  distance and time populations must not be divided.
- Each record chooses from its own valid candidate set. A missing distance must
  not disqualify a valid elevation record, or vice versa.
- Calendar aggregation uses `start_date_local || start_date` only when the
  resulting `Date#getTime()` is finite. Invalid dates are skipped rather than
  assigned to an invalid bucket.
- Count-mode charts continue to count activities with a valid date even when a
  selected optional metric is missing. Metric-mode charts skip unusable samples.
  Truly empty buckets may retain a numeric zero; no bucket, scale, point,
  tooltip, or captured Chart configuration may contain a non-finite number.
- Scatter and pace series accept only pairwise-complete rows. Time-derived
  transitions require a usable moving time and must not infer an end time from
  a missing value.
- Apply these rules consistently to Run summary cards, histograms, distance and
  elevation series, rolling/accumulated charts, top runs, tables, gear timeline,
  and to Trends all-time cards, records, start-time/yearly/mix charts, and all
  matrices reachable through the public tab entry points.
- Keep validation helpers module-private. Do not expand the tab facade or public
  API, mutate activity inputs, read storage, select a provider, or add network
  behavior.
- Existing Legacy/Shadow behavior for valid finite numeric Strava payloads is
  unchanged. Invalid historic cache values degrade safely instead of relying on
  implicit JavaScript coercion.

## Allowed paths

```text
docs/tasks/pr-53-real-import-consumer-numeric-hardening.md
js/tabs/run-analysis.js
js/tabs/athlete.js
tests/consumers/summary-consumers.test.js
```

No decoder, importer, storage, schema, Repository, AnalysisContext, HTML, CSS,
route, feature-flag, release contract, or other test path is authorized.

## Acceptance

- Failure-first, deterministic synthetic tests invoke the existing public
  `renderRunAnalysisTab` and `renderTrendsTab` entry points with mixed valid,
  missing, `null`, `NaN`, and positive/negative infinity values.
- The public renderers do not throw, visible output contains no invalid-number
  token, unavailable metrics use `—`, real zero remains distinguishable, and
  captured chart numeric values are finite.
- Pairwise pace, per-metric records, count mode, metric mode, missing dates, and
  input immutability are covered without a private fixture or network access.
- ego-browser reuses the explicitly cleared and repopulated local test library
  to verify Run, Run Plus Overview, and Trends. Evidence is anonymous booleans
  and counts only; no private screenshot is captured.
- Required gates are `npm ci`, `npm run check:syntax`,
  `npm run check:privacy`, `npm test`, and `git diff --check`.

## Migration, privacy, and rollback

There is no migration and no persisted-data rewrite. The already imported local
library and original FIT/TCX files remain untouched. Rollback is a code revert;
it restores the previous rendering behavior without deleting settings, Tokens,
Legacy data, Canonical data, or raw artifacts.

## Verification

- Failure-first public renderer tests cover Run, the production `run-plus-`
  prefix, Trends time/distance modes, missing and hostile optional metrics,
  pairwise pace, date fallback, empty rerender cleanup, finite numeric extremes,
  the 200-bucket resource ceiling, and retained ordinary pace, heart-rate, and
  Eddington bin semantics. The focused consumer suites pass 58/58.
- ego-browser reused the production-imported local library. Run rendered 17
  active charts, Run Plus rendered 18, and Trends rendered 16; every active
  Chart dataset and visible page passed the finite-number scan with zero visible
  errors. No screenshot or private value was captured.
- `npm ci` passes with the known engine warning: the project requires Node
  24.19.0/npm 11.17.0 while this machine provides Node 25.8.1/npm 11.11.0.
- Syntax passes for 293 files, privacy passes, the complete repository suite
  passes 2,013/2,013, and `git diff --check` passes.
