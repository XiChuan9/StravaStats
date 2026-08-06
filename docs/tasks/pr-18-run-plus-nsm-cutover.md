# PR-18: Run Plus / NSM Canonical Cutover

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M15 / PR-18 |
| Status | A3 frozen; Task Brief publication pending |
| Branch | `codex/v2/cutover-run-plus-nsm` |
| Base | `integration/v2` at `2d7176a3978a424d4ae8ff6bd2ee0f6c41579ad7` |
| Draft PR title | `refactor(v2): cut over Run Plus and NSM to canonical data` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

When a Real document explicitly selects `dataRepositoryMode: "canonical"`, make the actual
Run Plus and NSM routes consume Canonical summary, detail, lap, and stream projections through
the existing seven-method Repository and the PR-04C injected Run Plus facade. Preserve Demo
isolation and preserve Legacy and Shadow as Legacy reads. Keep Run Plus filters and NSM Settings,
Activity Tags, Interval Analysis, Impact Load, TSS, CTL, ATL, and TSB behavior and presentation
unchanged.

This is the final consumer read cutover after PR-16 summary and PR-17 detail. It does not change
Canonical contracts, Store schema, import APIs, analysis formulas or thresholds, the Repository
public surface, provider/auth behavior, global defaults, Service Worker, deployment, release, or
PR-19 identity behavior.

## A0 exact baseline evidence

- The assigned worktree began clean and detached at exact SHA
  `2d7176a3978a424d4ae8ff6bd2ee0f6c41579ad7`.
- The locked long-lived `integration/v2` worktree and `origin/integration/v2` resolved to the same
  SHA. `main`, `maintenance/v1`, and `integration/v2` were not modified.
- The task branch `codex/v2/cutover-run-plus-nsm` did not exist locally or remotely and was
  created at the exact base.
- Untouched-base gates passed: `npm ci`; syntax for 204 files; privacy; full suite 1,331/1,331;
  and `git diff --check`.
- No real activity, GPS route, heart-rate or power stream, account, Token, Authorization value,
  private fixture, export, screenshot, or user browser profile was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It is pushed before product or
test implementation and opens a Draft PR targeting `integration/v2` with the frozen title above.
Draft remains Draft through implementation, independent review, and Closure. If a GitHub App
write returns 403, the exact write is delegated to the control tower; the user's browser login is
never used. Ready for review is a post-Closure control-tower operation, not merge authorization.

## A2 read-only investigation

### Current composition and cutover graph

`DEFAULT_FEATURE_FLAGS.dataRepositoryMode` remains the literal `legacy`. The root composition
selects Demo before Real dependencies and maps only explicit Real `canonical` to the
CanonicalRepository. Real `legacy` and `shadow` retain Legacy reads, and Shadow retains its
existing observation/write behavior.

The actual served Run Plus graph is:

```text
/run-plus or /run-plus/nsm
-> js/main.js
-> js/app/main.js
-> one Summary Repository session selected once per document
-> listActivities
-> current preprocessing
-> js/tabs/index.js
-> renderRunPlusTab
   -> existing Run Plus / NSM algorithms and DOM
   -> immutable session gears snapshot
   -> on-demand getActivity(activityId)
   -> on-demand getStreams(activityId, existing six stream types)
-> embedded renderRunAnalysisTab uses the same already-loaded summary array
```

PR-04C already removed Token, Authorization, provider fetch, cache, Connector, and IndexedDB
selection from `run-plus.js`. `main.js` owns the narrow frozen facade and validates Repository
success envelopes before returning only the data payload. The tab never receives or retains a
Repository.

PR-16 now supplies the Canonical summary projection through that same session. PR-17 now
implements Canonical `getActivity` and `getStreams` over one coalesced Canonical Store bundle
read and the source-neutral detail projection. Therefore the existing PR-04C facade is already
the cutover boundary. No eighth Repository method, new export, Store method, schema, index,
version, migration, or direct storage read is required.

### Repository, projection, and I/O requirements

The public Repository remains exactly seven methods:

```text
listActivities
getActivity
getStreams
getAthlete
getZones
getGears
getGear
```

The active Run Plus callbacks use only `getActivity` and `getStreams`. Each click performs at
most one applicable public Repository call. PR-17 may coalesce same-turn detail calls internally,
but Run Plus does not depend on or observe that implementation. Local/manual/lap/stream analysis
continues to short-circuit Repository reads exactly as before.

The frozen six Legacy stream names are:

```text
time
distance
velocity_smooth
heartrate
cadence
altitude
```

PR-17's accepted projection maps these to stored Canonical series and emits only timelines that
match the selected reference. Missing series remain absent. Missing GPS, heart rate, power,
cadence, altitude, or laps never trigger provider/Legacy fallback and never fabricate values.
The Repository success envelope remains `{ data, source, warnings, partial }`; Canonical success
uses `source: "canonical"`, empty warnings, and `partial: false`.

Target I/O per successful explicit Real Canonical document/action:

| Path | Target |
| --- | --- |
| Startup / Run Plus render | one Canonical summary traversal; zero provider, Token, Auth, or Legacy reads |
| NSM Analyze Intervals with manual/local laps | zero detail/stream reads |
| NSM Analyze Intervals without usable local laps | at most one `getActivity`; one Canonical bundle read |
| NSM Deep HR with usable local streams | zero Repository reads |
| NSM Deep HR without local streams | at most one `getStreams`; one Canonical bundle read |
| Re-render/filter/settings/tag update | zero provider/Token/Auth/Legacy reads |
| Demo | existing Demo Repository only; zero Real Canonical/Legacy/provider I/O |
| Legacy / Shadow | existing Legacy read behavior; Shadow observation/write unchanged |

### Algorithms, DOM, and user-owned persistence inventory

`js/tabs/run-plus.js` owns the preserved Run Plus and NSM calculations and presentation,
including filtering, weekly/monthly/daily aggregation, rolling means, TSS load, metabolic
CTL/ATL/TSB, Impact Load Points, mechanical CTL/ATL/TSB and capacity buffer, activity quality,
NSM classification, session registry, lap/stream interval analysis, charts, exports, and the
current empty/error degradation.

PR-18 freezes every formula, threshold, regex, analyzer version, chart configuration, section
ordering, route, DOM ID/class, copy, and visual contract. Data-boundary tests may assert stable
outputs, but must not recalculate or redefine the algorithms.

The current user-owned LocalStorage allowlist is exact and unchanged:

```text
run_plus_capacity_inputs_v1
run_plus_nsm_settings_v1
run_plus_nsm_activity_tags_v1
run_plus_nsm_session_inputs_v1
run_plus_nsm_tests_v1
run_plus_nsm_interval_analysis_v1
```

These keys are not provider cache. Existing JSON shapes and the interval analyzer version stay
unchanged. Activity-keyed records already use JavaScript string property keys; a Canonical
opaque string ID that equals an existing Legacy external ID reads the same record without a key
migration. A local-import Canonical ID with no existing match receives no invented association.
Mapping unrelated Legacy and Canonical IDs would require PR-19 identity work and is prohibited.
There is therefore no LocalStorage migration in PR-18. Compatibility means retaining the exact
keys, shapes, read/write behavior, and switch-back usability.

### ID, missing-value, capability, and error semantics

- Canonical IDs are non-empty opaque strings and pass unchanged through summaries, tags, facade
  callbacks, Repository requests, cache fingerprints, DOM data attributes, and exports. They are
  never numerically parsed, sorted, compared, or synthesized.
- The historical Legacy path may adapt its existing safe-integer provider ID to the Repository's
  string request boundary exactly as PR-04C already does. This compatibility behavior is not a
  Canonical ID contract and must not change in this cutover.
- Missing, absent, `null`, real zero, and negative zero remain distinct. Capability absence is
  represented by omitted data/empty-safe UI, not fabricated values or partial success.
- Repository failures are reduced to the existing fixed safe warning/button degradation. No raw
  error, payload, ID, location, stream value, Token, Authorization value, provider response, or
  underlying cause may enter DOM, console, exports, test logs, PR text, or evidence.

### Candidate decisions and risks

| Candidate | Decision | Reason |
| --- | --- | --- |
| Add `getLaps` or `getActivityBundle` | Rejected | Existing `getActivity` includes projected laps |
| Add a Run Plus-specific Canonical projection | Rejected | Accepted summary/detail projections already match the facade |
| Give Run Plus a Repository or Store | Rejected | Violates PR-04C and ADR-0003 boundaries |
| Migrate tag IDs heuristically | Rejected | PR-19 identity work; unsafe association |
| Change algorithms for missing Canonical data | Rejected | Existing capability degradation suffices |
| Reuse PR-04C facade with focused compatibility hardening | Selected | Smallest explicit cutover boundary |

Primary risks are accidental Legacy/provider fallback, numeric handling of Canonical IDs,
missing-capability fabrication, user-owned settings/tag loss, duplicate on-demand reads, unsafe
errors, stale whole-file boundary tests, and browser evidence that tests only an injected seam
instead of the actual root route. Focused tests, stable literal audits, exact call counts, and a
served synthetic actual-root gate cover these risks.

## A3 frozen implementation boundary

Implementation, tests, findings-first repairs, and Closure may modify exactly these seven paths
and no eighth path:

```text
docs/tasks/pr-18-run-plus-nsm-cutover.md
js/app/main.js
js/tabs/run-plus.js
tests/consumers/run-plus-consumers.test.js
tests/consumers/run-plus-canonical-cutover.test.js
tests/consumers/run-plus-canonical-browser-smoke.html
tests/legacy/demo-isolation.test.js
```

This is a literal cumulative allowlist, not a directory glob. `js/app/main.js` and
`js/tabs/run-plus.js` are authorized only for minimal evidence-backed compatibility repairs;
investigation indicates no new composition or Repository surface is needed. The two canonical
cutover test paths are new. Stable public-boundary and literal path/source assertions are
required. Whole-tree manifests and whole-file hashes of mutable implementation files are
prohibited.

### Prohibited paths and operations

The following remain unmodified unless a new evidence-backed control-tower decision expands
scope before the change:

```text
package.json
package-lock.json
.github/**
api/**
sw.js
manifest.json
index.html
html/**
styles/**
js/app/feature-flags.js
js/app/local-first-bootstrap.js
js/repository/**
js/storage/**
js/data/**
js/import/**
js/decoders/**
js/shadow/**
js/analysis/**
js/pages/**
js/tabs/run-analysis.js
js/tabs/index.js
tests/fixtures/**
tests/consumers/canonical-summary-browser-smoke.html
tests/consumers/canonical-detail-browser-smoke.html
docs/architecture/**
docs/product/**
docs/engineering/**
docs/migrations/**
```

Also prohibited: an eighth Repository method/export; Canonical or storage contract/schema/store/
index/version/migration change; Import API change; formula, threshold, analyzer-version, chart,
DOM/CSS/copy/route/visual change; provider/auth change; dependency; Service Worker/deployment/
release behavior; PR-19 identity mapping; real credentials/account/provider network/user browser
profile/private sports data; destructive or reverse-copy data action; merge/auto-merge;
amend/rebase/force-push; branch/worktree cleanup.

## Frozen implementation phases

### B1: failure-first Canonical cutover regressions

- Add deterministic tests that execute the current PR-04C facade with the actual Canonical
  Repository/Store and accepted projections.
- Cover opaque strings, same-key user persistence, missing/null/zero, missing GPS/HR/power/laps,
  exact envelopes, exact I/O counts, local/manual short-circuits, filtering, and safe failures.
- Freeze the exact six user-owned keys, default Legacy mode, Demo-first isolation, Shadow Legacy
  reads, seven methods/five exports, and the literal PR-18 path allowlist without global hashes.

### B2: minimal product repair and algorithm/DOM regressions

- Reproduce each actual Canonical incompatibility before product repair.
- Repair only the narrow facade/consumer compatibility defect inside the two authorized product
  paths. Do not change analysis meaning or presentation.
- Add stable outcome assertions for NSM Settings, Activity Tags, Interval Analysis, Impact Load,
  TSS, CTL, ATL, TSB, filtering, missing capabilities, and zero provider/auth/Legacy I/O.
- If B1 proves the current product already satisfies the cutover, B2 may contain no product diff;
  the PR remains a valid explicit cutover and regression boundary.

### B3: served browser evidence

- Add one deterministic synthetic harness for the actual served root `/run-plus` and
  `/run-plus/nsm` routes under explicit Canonical, Demo, Legacy, and Shadow modes.
- The policy-compliant in-app Browser is attempted first. If it lacks required IndexedDB,
  LocalStorage, frame, instrumentation, or served-navigation capability, record the exact
  blocker and request only the separately bounded disposable Chrome/CDP equivalent described
  by the task contract.
- Observation begins before navigation and records same-origin/provider requests,
  Authorization presence, Fetch/XHR/WebSocket, console/runtime events, Local/Session Storage
  key inventory, IndexedDB names/versions and safe synthetic counts, Cache Storage, and Service
  Worker registrations. No screenshot is required or retained.
- Exercise settings/tags persistence, filter/rerender, interval and deep-HR analysis, Impact
  Load, TSS/CTL/ATL/TSB, missing GPS/HR/power, opaque IDs, and safe failures.

### B4: findings-first review and Closure

An independent reviewer examines the exact-base diff findings-first. Every actionable finding
receives a focused failing regression before a minimal repair. A fresh independent re-review must
report no actionable findings. Then update only this Task Brief with exact commits, changed
paths, local/browser/depth-1 evidence, findings/repairs, privacy/migration/rollback impact, CI,
and Not-run items. That Closure is one Task Brief-only commit and must receive fresh exact-head CI
before the control tower updates the final PR body and moves Draft to Ready for review.

## Verification contract

Required local gates:

```text
npm ci
npm run check:syntax
npm run check:privacy
focused Run Plus / NSM canonical cutover tests
focused Repository / Storage / summary / detail regressions
focused Legacy / Demo / Shadow regressions
npm test
git diff --check
literal allowlist and prohibited-surface audit
depth-1/shallow-clone CI-safe boundary verification
```

Browser and CI results are reported only if actually run. Do not claim full visual parity, real
provider/auth behavior, production Service Worker behavior, Safari, Firefox, mobile, real quota
pressure, crash durability, large-library performance, or migration unless that exact check ran.

## Privacy, migration, rollback, and stop conditions

- **Privacy:** only inline deterministic synthetic fixtures are allowed. Public/DOM/console/PR
  evidence is redacted and contains no private ID, route, GPS, heart-rate or power history,
  Token, Authorization value, provider payload, raw cause, filename, account, or browser profile.
- **Migration:** none. The six existing user-owned LocalStorage keys and shapes stay unchanged.
  No Canonical/Legacy data, key, schema, index, version, Store, Import, or identity migration is
  added. Reads do not delete, clear, repair, overwrite, downgrade, or reverse-copy either library.
- **Rollback:** `DEFAULT_FEATURE_FLAGS.dataRepositoryMode` remains literal `legacy`; explicit
  `legacy` and `shadow` keep Legacy reads and Demo remains isolated. Select Legacy or ordinarily
  revert this PR while retaining both databases and every user-owned LocalStorage key.
- **Stop:** pause and send the smallest decision package to the control tower before a required
  eighth path, public Repository/Store method or export, schema/index/version/migration change,
  new persistence or LocalStorage contract, algorithm/provider-auth/dependency/SW/release change,
  PR-19 work, destructive data action, real credential/private-data use, merge/cleanup, or another
  material product/architecture expansion.

## Implementation ledger

Pending after the Task Brief-only publication gate.
