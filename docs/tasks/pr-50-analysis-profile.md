# PR-50: Local Heart Rate Analysis Profile

## Metadata

| Field | Value |
| --- | --- |
| Status | Local implementation and browser acceptance complete; exact-head CI pending |
| Base checkpoint | `ba7b8cf` |
| Feature branch | `codex/v2-analysis-profile` |
| Worktree | `<repo-root>` |
| Data migration | None |
| Repository API change | None |
| Backup format change | None |

## Goal

Add a user-owned, local heart-rate training profile for Real + Canonical sessions
and inject one frozen `AnalysisContextV1` into Dashboard preprocessing, Run Plus,
detail pages, classifiers, heart-rate zone charts, and Advanced Analysis.

The first version contains maximum heart rate, optional resting and lactate-
threshold heart rates, and five global heart-rate zones. It contains no identity,
location, activity, provider, or equipment data.

## Frozen behavior

- Persist `AnalysisProfileV1` only inside
  `dashboard_settings.analysisProfile`; preserve all unrelated settings.
- Generate the four automatic boundaries with rounded 60%, 70%, 80%, and 90%
  of configured maximum heart rate. Manual editing is explicit.
- Require an explicit save. The old top-level `hrMax` is only a draft prefill and
  compatibility mirror.
- Only Real + Canonical reads the local profile. Legacy and Shadow retain their
  provider behavior. Demo uses a deterministic synthetic context and performs no
  Real profile read.
- Missing or malformed Canonical settings fail closed as `unconfigured`; raw
  activity metrics remain available while personalized HR outputs are withheld.
- Save recomputes the current local Canonical views without import, provider
  refresh, token access, or network I/O.
- Reset requires confirmation and removes only `analysisProfile` and `hrMax`.

## Allowed paths

```text
docs/tasks/pr-50-analysis-profile.md
index.html
styles/style.css
js/app/analysis-profile.js
js/app/main.js
js/shared/preprocessing/core.js
js/tabs/run-plus.js
js/tabs/athlete.js
js/tabs/dashboard.js
js/tabs/planner.js
js/tabs/activities.js
js/tabs/calendar.js
js/tabs/wrapped.js
classifyBike.js
js/analysis/index.js
js/analysis/analyzers/base-analyzer.js
js/analysis/analyzers/index.js
js/analysis/engines/physiology.js
js/pages/detail/heart-rate-zone-presentation.js
js/pages/activity/index.js
js/pages/activity/activity.js
js/pages/activity/advanced-analysis.js
js/pages/run/index.js
js/pages/run/run.js
js/pages/bike/index.js
js/pages/bike/bike.js
js/pages/swim/index.js
js/pages/swim/swim.js
tests/analysis-profile.test.js
tests/analysis/analysis-context.test.js
tests/backup/backup-service.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/heart-rate-zone-presentation.test.js
tests/consumers/run-plus.test.js
tests/consumers/summary-boundaries.test.js
tests/legacy/demo-isolation.test.js
tests/pages/main.test.js
tests/privacy/root-privacy-disclosure.test.js
```

No other path is authorized without updating this brief first.

## Explicitly out of scope

- IndexedDB V7 or any store/schema migration;
- new Repository methods, feature flags, or provider fallback;
- reading or migrating `strava_athlete_data` or `strava_training_zones`;
- AnalysisSnapshot persistence, settings invalidation queues, FTP, body weight,
  threshold pace, or equipment profiles;
- redesigning the Settings or analysis pages;
- changing Legacy/Shadow calculation behavior.

## Acceptance gates

- Synthetic contract tests cover hostile descriptors, proxies, cycles, sparse
  arrays, range relationships, five continuous zones, open Z5, no-op revision,
  merge preservation, and confirmed reset.
- Backup format 3 round-trips the nested profile without changing its format or
  conflict policy.
- Mode tests prove Canonical configured/unconfigured/corrupt behavior, unchanged
  Legacy/Shadow behavior, and zero Real storage I/O in Demo.
- Calculation tests prove the same context drives HR TSS, VO2max, recovery,
  zones, classifiers, Run Plus, and Advanced physiology without manufacturing HR.
- Browser acceptance uses ego-browser. Private FIT smoke records only anonymous
  pass/fail counts and never captures private screenshots or values.
- Required gates: `npm ci`, `npm run check:syntax`, `npm run check:privacy`,
  `npm test`, and `git diff --check`.

## Privacy and rollback

Heart-rate settings are private health data. They must not enter Git fixtures,
logs, diagnostics, telemetry, URLs, screenshots, or error text. Committed tests
use deterministic synthetic values only.

Rollback is a code revert. Older versions safely ignore the nested setting; no
automatic deletion occurs, and Legacy/Canonical databases, imported artifacts,
and source files remain byte-for-byte untouched.
