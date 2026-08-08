# PR-33: Weather External-Egress Consent and Missing-Value Correctness

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R6 |
| Status | A0-A2 complete; Option A selected and frozen; failure-first implementation authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/weather-consent` |
| Exact base | `integration/v2@8b4521ad9f45af9f6056f04cf0c8fd4cd6e6a97e` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | R10 PR #38 Squash Merged; integration push CI run `31249059836`, job `93082375097`, successful |
| Pull request | Draft PR #39; Ready transition authorized only after Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blockers P0-04 and P1-01. An ordinary Real session must make zero Open-Meteo or
other external weather requests until the user has given specific, understandable, and revocable
authorization for the approved scope. Weather values that are missing, invalid, malformed, or
unavailable because of network failure must remain absent, `null`, or explicitly unavailable;
they must never be converted to numeric `0`. A genuine observed numeric zero remains valid.

This task does not authorize R7 AI, R8 external maps, R11 telemetry/CDN, Service Worker lifecycle
or D3, a provider/account/private-data run, deployment, release, merge, cleanup, or a public API,
schema, dependency, Repository, Import, Backup, Diagnostics, Worker, or Service Worker expansion.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit remain required evidence but do not freeze an undecided consent
or persistence contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `8b4521ad9f45af9f6056f04cf0c8fd4cd6e6a97e`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` matched with divergence `0/0`.
- GitHub App evidence verified integration push run `31249059836`, job `93082375097`, as
  `completed/success`, including install, syntax, privacy, and full tests.
- Untouched local gates passed: `npm ci`; syntax for 243 files; privacy; full tests 1615/1615;
  `git diff --check`; clean status.
- Root and all nested `AGENTS.md`, Accepted ADRs, PRD, engineering plan, release gates, test and
  fixture strategy, privacy/migration/rollback documents, the historical PR-25 audit, and the
  merged local-first, Canonical summary/detail, and R3-R10 Task Briefs were read from the exact
  integration tree or their retained read-only historical branch as applicable.
- No real Token, account, provider/private activity, coordinate, route, heart-rate, power, setting
  value, private fixture, export, screenshot, user browser profile, Legacy library, or V2 library
  was read. No real Open-Meteo request was made.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before production or test implementation is committed. GitHub
App 403 during PR creation or update is delegated immediately to the control tower; it does not
authorize Chrome, interactive login, or the user's browser profile.

This boundary was satisfied by Task-Brief-only commit
`21b4ad245f2cd8cfd92422546566f980db4e253e`. The branch was pushed, the GitHub App returned
`Resource not accessible by integration`, and the control tower created Draft PR #39 without a
user browser/login. Authoritative readback recorded `OPEN`, `Draft=true`, `mergedAt=null`, exact
base `8b4521ad9f45af9f6056f04cf0c8fd4cd6e6a97e`, exact head `21b4ad245f2cd8cfd92422546566f980db4e253e`,
and one changed file: this Task Brief.

Until A2 freezes the exact decisions and literal implementation allowlist, the cumulative write
allowlist is exactly:

```text
docs/tasks/pr-33-weather-consent.md
```

## A2 findings-first investigation contract

Read-only audit must trace every production weather path end to end:

```text
root/detail/analysis production entries
-> Demo/Real and Legacy/Shadow/Canonical mode selection
-> consent or user-owned settings lookup
-> activity/stream coordinate and date selection
-> request construction and Open-Meteo fetch
-> in-memory or durable cache
-> normalization and environmental difficulty
-> summary/detail/analysis presentation
-> offline, timeout, malformed, empty, and network-failure behavior
```

The audit must inventory:

1. automatic startup/refresh preprocessing and explicit Weather-tab/detail-map triggers;
2. every coordinate/date source, sampling rule, precision, request parameter, timeout, retry, and
   cache key/lifetime;
3. every existing user-owned durable settings owner and exact key, plus Demo isolation and
   Legacy/Shadow/Canonical behavior;
4. every `Number`, `|| 0`, `?? 0`, default, arithmetic, aggregation, chart, table, map, and
   environmental-difficulty path that may conflate missing, invalid, failure, and real zero;
5. offline, timeout, HTTP failure, malformed JSON/shape, missing arrays, null entries, non-finite
   values, out-of-range coordinates, invalid dates, hostile descriptors/accessors/Proxies, and
   aborted/revoked authorization schedules;
6. privacy, console, Token/provider, Cache Storage, and Service Worker boundaries without changing
   the already merged R5/R9 packages.

Evidence uses only deterministic synthetic coordinates, fixed dates, fixed canaries, loopback
requests, and intercepted external-request observations. A real Open-Meteo request, real route,
provider/account, private data, or user profile is prohibited.

## A2 findings-first results

### Production request graph and triggers

There are exactly three production Open-Meteo request constructors, all targeting
`https://archive-api.open-meteo.com/v1/archive`:

1. `js/app/main.js` calls `preprocessActivities(...)` on every ordinary initialization and refresh.
   `js/shared/preprocessing/core.js` selects every `type === 'Run'` with truthy `start_latlng`, then
   automatically fetches batches of five. The per-request abort is four seconds and the loop has a
   twelve-second check between batches, but a batch already in flight is not revoked by a later
   consent state. This path runs before the user opens Weather UI.
2. `js/app/main.js` lazy-renders `js/tabs/weather.js` on first Weather-tab activation. That renderer
   fetches every activity with truthy `start_latlng` and `start_date_local`, not only runs, in
   batches of five and without a request timeout. The WIP confirmation discloses only incomplete
   metrics. It does not name Open-Meteo, coordinates, date, purpose, scope, persistence, or
   revocation and therefore is not consent. Direct initial navigation to `/weather` bypasses the
   click confirmation entirely.
3. Each Real composition root under `js/pages/{activity,run,bike,swim}/index.js` injects
   `allowExternalWeather: !demo`. Each corresponding renderer invokes
   `renderWeatherAnalysis(...)` during initial map rendering. `js/shared/utils/weather-analysis.js`
   selects between two and fourteen samples from the full route based on route length and moving
   time, then fetches each sample serially without a timeout. The `Show weather` checkbox controls
   only map markers; the summary requests have already happened before the checkbox is used.

Demo preprocessing skips weather when the `strava_demo_mode` storage key is literal `true`, and
Demo detail composition injects `false`. Every ordinary Real Legacy, Shadow, and Canonical session
uses the same permissive paths. Canonical summary input is cloned before preprocessing, but the
weather result still mutates the renderer-local activity copy. No production weather result is
written to Repository or IndexedDB.

### Data disclosed, validation, and caching

- Summary preprocessing and Weather tab use the raw first `start_latlng` pair and derive a single
  `start_date=end_date` query value from `start_date_local`. They send the unrounded latitude,
  longitude, date, `timezone=auto`, and eight hourly field names. There is no finite/range/type
  coordinate validation.
- Detail analysis reads exact route points from injected canonical/Legacy streams or decoded
  provider polylines. It sends two to fourteen unrounded route coordinates and one or more local
  date keys with the same eight hourly fields. Missing activity date falls back to `Date.now()`;
  invalid dates can form an invalid query instead of failing closed.
- Preprocessing and Weather tab have no weather cache. Detail has only a module-lifetime `Map`.
  Its key rounds coordinates to three decimal places, but the request URL still sends the original
  coordinate. It caches the raw response, has no TTL, consent binding, revocation/abort hook, or
  malformed-response guard, and is not durable.
- The only existing general dashboard setting owner is the `dashboard_settings` JSON record in
  `localStorage`; filters use `dashboard_filters`. The backup boundary copies an exact fixed list
  including those records but no weather-consent key. A new durable key would not be backed up
  unless the prohibited Backup surface expanded; adding a field to `dashboard_settings` would
  require preserving it across that record's current whole-object saves. No current weather
  consent or revocation state exists.

### Missing, invalid, failure, and real-zero behavior

- Both summary fetchers use `numericSafe`, which maps `null`, `undefined`, and non-numeric values
  to numeric zero. Preprocessing also writes `run.difficulty = 0` for missing/HTTP/timeout/network
  failure. A Real missing value is therefore indistinguishable from observed zero.
- The Weather tab drops whole failed responses, but all-empty aggregates use zero-valued `mean`,
  `sum`, and correlation defaults; table difficulty also uses `?? 0`. Partial malformed hourly
  arrays become zero fields and participate in charts, correlations, predictor output, and
  environmental difficulty.
- Detail selection applies `Number(...)` to hourly entries, so `Number(null)` becomes zero while
  missing values become `NaN`. Summary cards then use `mean(...) ?? 0` and rain reduction uses a
  zero fallback. Point cards may say `N/A` while the summary simultaneously reports numeric zero.
- A genuine numeric `0` for temperature, precipitation, wind, direction, weather code, humidity,
  cloud cover, or pressure currently survives and must continue to survive. Future validation must
  distinguish a finite number from `null`, missing, a numeric string, `NaN`, and infinity.
- Preprocessing constructs the date and URL before its `try`; an invalid/missing date can reject
  `Promise.all` and fail the whole initialization/refresh rather than producing unavailable
  weather. Weather tab catches the same failure per activity. Detail catches at the outer renderer
  and shows a fixed failure message, but has no fetch abort/timeout.
- HTTP failure, rejected fetch, malformed JSON, missing `hourly`/`time`, mismatched arrays,
  invalid hourly timestamps, out-of-range coordinates, hostile accessors/Proxies, and revocation
  during scheduled/in-flight work do not have complete failure-first coverage. Existing R5 tests
  freeze fixed console/DOM behavior but explicitly execute five consent-free weather requests.

### Privacy, cache, Service Worker, and regression boundaries

R5 already removes unsafe browser console sinks from the three weather responsibility files; R6
must keep console, thrown-value inspection, Token, Authorization, provider/private values, and
window debug publication at zero. R9 already requires cross-origin weather requests to bypass the
Service Worker and Cache Storage; R6 must not change that policy or add a durable weather cache.
Current detail boundary and browser tests explicitly expect `allowExternalWeather === true` for
every Real composition, so those assertions encode the release blocker and must be replaced by the
approved deny-by-default contract. Existing Demo tests already prove zero weather/provider I/O and
must remain green. No focused weather-egress or missing-value correctness test/harness exists.

The implementation candidate surface below is investigative only and is not an authorization or
frozen allowlist. The exact subset must be selected in the material decision package:

```text
docs/tasks/pr-33-weather-consent.md
index.html
html/activity.html
html/run.html
html/bike.html
html/swim.html
js/app/main.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/weather.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
tests/privacy/weather-egress.test.js
tests/privacy/client-logging.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/weather-consent-browser-smoke.html
```

## Material decision gate

Before production or test implementation, A2 must record and delegate one minimum A/B/C package
covering all of the following together:

- deny-by-default and the exact affirmative authorization gesture;
- consent copy and the disclosed destination/fields/purpose;
- single-session, per-request, or durable scope and the exact revocation behavior;
- whether and where a user-owned durable setting may be stored;
- exact versus minimized/rounded coordinates and the approved date/time range;
- cache location, key, lifetime, consent binding, and revocation treatment;
- behavior for existing users and all Demo/Legacy/Shadow/Canonical modes;
- the exact literal path allowlist, verification, privacy/data impact, migration impact, and
  non-destructive rollback.

The recommendation may be deny-by-default with no request before explicit consent, but no consent
copy, persistence key, precision, date range, or cache behavior is self-authorized. The control
tower must obtain and return the user's decision before implementation begins.

## A3 material decision package and frozen selection

The control tower returned the user's explicit selection of **Option A**. The decision is not an
inference, default, or mixed profile. Option A's copy, session scope, exact storage key, one-point
precision/date contract, cache limits, revocation behavior, existing-user behavior, and literal
19-path allowlist below are frozen together. Options B and C remain rejected alternatives and do
not authorize any of their persistence, automatic-enrichment, route-sampling, or cache behavior.

All three options share these non-negotiable correctness and safety rules:

- absent consent is deny; Demo uses embedded synthetic weather and performs no consent-storage or
  weather request; Legacy, Shadow, and Canonical Real modes use the same selected consent rule;
- only literal finite numeric hourly values are present, including genuine numeric zero; missing,
  `null`, numeric strings, non-finite values, malformed shapes/times, rejected/aborted fetches,
  HTTP failure, and timeout remain `null`/unavailable and never enter aggregates as zero;
- coordinates and dates fail closed before URL construction; no activity ID/name, full provider
  payload, Token, Authorization, heart rate, or power is sent; activity IDs remain opaque strings;
- the query requests only the existing eight UI inputs: temperature, precipitation, wind speed,
  wind direction, weather code, humidity, cloud cover, and surface pressure, plus
  `timezone=auto`; there is no retry and each request has a four-second abortable timeout; and
- responses are never written to IndexedDB, Repository, Cache Storage, Service Worker, Backup,
  Diagnostics, or logs. Revocation/cancellation aborts registered in-flight work before clearing
  only the selected weather module's own memory/consent state.

### Option A — session-scoped, one approximate point (selected and frozen)

- Default/startup: dashboard initialization and refresh never fetch weather. An inline Weather
  card in the Weather tab or a detail page is the only grant surface. The exact positive button is
  `Allow for this tab`; `Not now` leaves the state denied. Direct `/weather` navigation is safe.
- Exact copy: “To retrieve historical weather, StravaStats uses Open-Meteo. If you choose ‘Allow
  for this tab’, it sends one approximate start coordinate (rounded to 2 decimals) and the local
  calendar date for each eligible activity in the Weather view you open. It does not send activity
  IDs or names, full routes, tokens, heart rate, or power. You can revoke here at any time;
  revocation cancels requests still in progress and blocks future requests.”
- Persistence/revocation: strict versioned state in `sessionStorage` under the exact key
  `stravastats_weather_egress_consent_v1`; it lasts only for the current browser tab. Every Weather
  grant surface changes to `Revoke weather access` after grant. Revocation records denied state,
  aborts in-flight requests, clears the weather memory cache, and requires a new affirmative click.
- Precision/range: one valid route/start point rounded to two decimals (roughly one-kilometre
  latitude granularity) and exactly one valid local calendar date per activity with
  `start_date=end_date`. No route shape, additional samples, current-date fallback, or cross-day
  expansion is sent. Detail route-point/wind panels are hidden as unavailable because this option
  does not collect the samples required to support them honestly.
- Cache: per-document memory only, keyed by the rounded coordinate/date/field contract, maximum
  256 entries and 30-minute TTL, bound to the current granted epoch. Navigation naturally drops
  it; revocation aborts and clears it. No weather response is durable.
- Existing behavior: users without the exact setting are denied. Existing automatically enriched
  `run.weather`/`run.difficulty` output becomes absent until an explicit Weather view is granted;
  historical activity records and all user-owned settings remain untouched. This intentionally
  trades route-level weather fidelity for the minimum disclosed location/date surface.
- Exact literal implementation allowlist if selected:

```text
docs/tasks/pr-33-weather-consent.md
js/app/weather-consent.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/weather.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
tests/privacy/weather-egress.test.js
tests/privacy/client-logging.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/weather-consent-browser-smoke.html
```

### Option B — durable opt-in, approximate route fidelity (not selected)

- Default/startup: absent consent is still deny. The exact positive button is
  `Always allow weather`; after grant, dashboard initialization/refresh may enrich eligible runs,
  and Weather/detail views may request without another prompt. `Not now` remains denied.
- Exact copy: “Historical weather is provided by Open-Meteo. If you choose ‘Always allow
  weather’, StravaStats may send an activity’s approximate start or route coordinates (rounded to
  3 decimals, up to 14 samples) and the local calendar date or dates needed for that activity when
  the dashboard or a Weather view loads. It does not send activity IDs or names, tokens, heart
  rate, or power. This choice is stored only in this browser and is not included in StravaStats
  backups. You can revoke it from any Weather view; revocation cancels in-progress and future
  requests.”
- Persistence/revocation: strict versioned state in `localStorage` under the exact key
  `stravastats_weather_egress_consent_v1`. It is intentionally outside the frozen Backup setting
  allowlist. Every Weather surface exposes `Revoke weather access`; revocation records denied
  state, aborts in-flight work, clears memory results, and prevents later automatic requests.
- Precision/range: summary preprocessing/Weather tab use one start point; detail may use two to
  fourteen route samples. Coordinates are rounded to three decimals (roughly one-hundred-metre
  latitude granularity). Each request has equal valid `start_date`/`end_date`; detail may send a
  second local date only if a sampled route time actually crosses midnight. There is no
  current-date fallback.
- Cache: per-document memory only, maximum 512 rounded-coordinate/date entries with 30-minute TTL,
  bound to the current consent epoch and cleared on revoke. Consent is durable; weather responses
  are not.
- Existing behavior: all existing users begin denied because there is no pre-existing grant.
  Users who opt in recover automatic enrichment and approximate route-level panels. Demo remains
  isolated; Real Legacy, Shadow, and Canonical behave identically.
- Exact literal implementation allowlist if selected:

```text
docs/tasks/pr-33-weather-consent.md
js/app/main.js
js/app/weather-consent.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/weather.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
tests/privacy/weather-egress.test.js
tests/privacy/client-logging.test.js
tests/consumers/summary-consumers.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/weather-consent-browser-smoke.html
```

### Option C — one-view authorization, no stored consent (not selected)

- Default/startup: dashboard initialization and refresh never fetch weather. Each Weather tab or
  detail render offers `Fetch this Weather view once`; `Not now` performs no request. A later view
  requires another affirmative click, including after direct `/weather` navigation.
- Exact copy: “Fetch this Weather view once from Open-Meteo? StravaStats will send approximate
  activity start or route coordinates (rounded to 2 decimals, up to 14 samples) and only the local
  calendar date or dates needed for this view. It does not send activity IDs or names, tokens,
  heart rate, or power. No permission is saved. You can cancel requests still in progress, but
  data already sent cannot be recalled.”
- Persistence/revocation: no `localStorage`, `sessionStorage`, IndexedDB, or cookie state. The grant
  is an in-memory single-view capability. `Cancel weather request` aborts outstanding work; the
  capability expires when that render completes or the user leaves the view.
- Precision/range: Weather tab uses one rounded start point/date per eligible activity; detail may
  use two to fourteen route samples rounded to two decimals and only the valid local date(s) those
  samples occupy. There is no exact coordinate or current-date fallback.
- Cache: only a render-local promise/result map may coalesce duplicate analysis/marker work for
  that single view. It is discarded after render, cancellation, or navigation and is never reused
  as authorization.
- Existing behavior: every existing user is denied until each one-shot action. Demo stays entirely
  synthetic; all Real repository modes behave identically. This minimizes consent persistence but
  requires repeated prompts and may make multi-activity Weather views more cumbersome.
- Exact literal implementation allowlist if selected is the same 19 paths as Option A.

The cumulative implementation and Closure write allowlist is now exactly Option A's 19 literal
paths. Mixed behavior or any twentieth path requires a revised package and a new user decision.
Failure-first test work may begin only after this selection freeze is committed by itself.

## Failure-first implementation and verification contract

After the decision is frozen, add deterministic tests that fail first for every approved path and
prove:

- ordinary Real startup/refresh and every denied/revoked state make zero external weather request;
- the authorized path sends only the approved minimum fields at the approved precision/range;
- missing, invalid, malformed, timeout, abort, and network failure remain absent, `null`, or
  explicitly unavailable; genuine numeric zero remains distinguishable and is not dropped;
- activity IDs remain exact opaque strings and are never parsed or manufactured as zero;
- Demo uses only synthetic embedded weather and performs zero Real storage/provider/weather I/O;
- Legacy, Shadow, and Canonical keep their approved data-source behavior and non-destructive
  rollback; and
- console/runtime, Token, Authorization, provider/private data, Cache Storage, and Service Worker
  observations contain zero prohibited canaries.

Required gates after implementation include focused weather/summary/detail/analysis and
Legacy/Demo/Canonical tests, `npm ci`, syntax, privacy, full tests, `git diff --check`, literal-path
audits, and an actual-served disposable-browser run with interception installed before navigation.
The browser gate must prove default zero requests, the exact approved authorized request shape,
revocation, offline/failure degradation, zero unsafe console/runtime output, and zero real external
network. It must stop the loopback server and remove only its disposable profile.

## Final Review and Closure contract

An independent reviewer must perform a findings-first exact-base review after implementation.
Every actionable finding receives a focused failing regression and minimum repair. A fresh
independent re-review must report no findings. Closure is a Task-Brief-only commit recording exact
local/browser/privacy/path/depth-1/CI evidence, findings and repairs, migration/rollback impact, and
Not-run items. The actual remote branch must pass a true depth-one exact-head verification and
GitHub Actions must succeed on the exact Closure head before the control tower updates the PR body
and moves Draft to Ready under the standing authorization.

Ready is not merge authorization. Squash Merge requires a separate user decision. Merge,
auto-merge, cleanup of this or retained R3/R4/R5/R9/R10 worktrees/branches, deployment, release,
R7, R8, R11, and D3 remain prohibited.

## Privacy, migration, and rollback

No data migration is authorized. No Legacy/V2 record, schema, store, index, version, migration,
provider state, backup, private setting value, or Cache Storage entry may be deleted, cleared,
overwritten, repaired, downgraded, or reverse-copied. Rollback must be a code/flag or consent-state
behavior defined by the approved decision package and must never clear activity data. Revocation
semantics must be specific and non-destructive.

## Pause and delegation boundary

Pause and return the minimum evidence package to the control tower if completion requires the
material consent decision above, any path outside the eventual frozen literal allowlist, a public
API/schema/dependency/Repository/Import/Backup/Diagnostics/Worker/Service Worker change, real
credentials/account/provider/private data, a real external weather request, user profile access,
destructive data/cache/Git action, deployment, release, or GitHub App authorization bypass.
