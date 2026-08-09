# PR-25: Release Readiness Audit

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M22 / PR-25 |
| Status | A3 current-tree re-audit complete; Alpha and full-v2.0 release remain blocked |
| Branch | `codex/v2/release-readiness` |
| Current audit base | `integration/v2@cac3fdb97337a358da08a1f6d92c541519282d5a` |
| A1 branch point | `integration/v2@e083fa0d55c8981f0258af546451ebb0d48e4fa4` |
| Allowed path | `docs/tasks/pr-25-release-readiness-audit.md` only |
| Product authority | Audit only; no production implementation or release action |

## A0 intake and authority

This task is a release-wide evidence audit. It does not authorize a production release, a product
or test change, a version bump, a tag, a GitHub Release, deployment, Service Worker rollout,
Ready-for-review transition, merge, cleanup, migration, provider access, or user-data operation.

The only baseline is the exact squash merge commit
`e083fa0d55c8981f0258af546451ebb0d48e4fa4`. Local Git identifies it as the single-parent commit
`docs(v2): complete release candidate documentation (#30)` with parent
`61d7b032305fd8f12d71544315f06d553213801d`. GitHub App evidence identifies PR #30 as merged into
`integration/v2`, with merge commit equal to the exact baseline. The integration push CI is GitHub
Actions run `31157822933`, workflow `CI`, run number 185, conclusion `success`.

The durable evidence hierarchy for this audit is:

1. accepted ADR-0001 through ADR-0006;
2. the V2 product requirements;
3. `docs/engineering/release-gates.md`;
4. `docs/engineering/v2-development-plan.md`;
5. the accepted PR-24 release documentation record;
6. `docs/guides/known-limitations.md` and current exact-base implementation/test evidence.

The PRD and release-gate documents still carry `Proposed` status. They remain required audit inputs
and release-blocking checklists, but cannot override an accepted ADR or be used to freeze an
otherwise undecided implementation contract.

## A1 frozen scope and untouched baseline

The cumulative hard maximum for this PR is exactly one path:

```text
docs/tasks/pr-25-release-readiness-audit.md
```

The baseline worktree was clean and detached at the exact base before branch creation. The following
untouched-baseline checks ran on 2026-08-07 in the assigned worktree:

```text
npm ci                    PASS (6 packages installed)
npm run check:syntax      PASS (239 files)
npm run check:privacy     PASS
npm test                  PASS (1,469/1,469)
git diff --check          PASS
worktree status           CLEAN
```

No real Token, authorization header, provider response, real account, private browser profile,
private activity, GPS track, heart-rate, power, FIT/TCX/GPX/ZIP export, or private Legacy/V2 library
may be read. Deterministic synthetic fixtures, source inspection, repository history, accepted
redacted evidence, isolated disposable-browser checks, and read-only local reproduction are the
only permitted evidence sources.

Legacy and V2 data must remain physically and logically preserved. Missing values must never become
zero, opaque IDs must remain strings, Disconnect and local deletion remain separate, and no audit
step may clear, migrate, repair, overwrite, downgrade, reverse-copy, or otherwise mutate user data.

## Stop and delegation boundary

Stop immediately if any changed path other than the frozen Task Brief appears, or if evidence
collection would require product code, tests, dependencies, package/version, workflow, schema,
Service Worker, deployment/release configuration, tag/Release/deploy, protected branch mutation,
provider access, private data, a real browser profile, or destructive storage/cache operations.

If the GitHub App returns 403 while creating or updating the Draft PR, report the exact blocker to
the control-tower task. Do not use Chrome, another interactive login, or a user's browser session.

Material findings are not implemented here. They become a decision package containing the conflict,
options, recommendation, exact candidate allowlist, dependencies, verification, rollback, privacy
and data impact, and explicit owner decisions. PR-25 remains Draft and stops after that handoff.

## A2 read-only audit plan

A2 will record every gate as exactly one of `PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, or
`NOT APPLICABLE`. Every row will cite authoritative evidence, identify the gap, state whether
deterministic synthetic or isolated-browser automation can close it, and identify evidence that
requires a real account/private library, production Service Worker/deployment, supported-browser
environment, or release-owner authorization.

The audit covers:

- Alpha, Beta, Release Candidate, and Production release gates plus PR/integration prerequisites;
- release-wide P0/P1 defect inventory against the current production entry graph;
- privacy, raw console/server logging, Token/Authorization and identifier handling;
- third-party CDN, telemetry, external-feature and exact date/location egress;
- Service Worker API caching, update, eviction, mixed-version, cold-offline, and rollback lifecycle;
- real-account disconnect, real import/private-library, parity and Shadow review evidence;
- supported browser/platform, PWA, accessibility, responsive and visual evidence boundaries;
- backup, migration, application, deployment and Service Worker rollback as one complete rehearsal;
- version/tag/artifact/deployment/approval evidence and release-owner roles.

Read-only reproduction may run repository tests, source-graph inspection, static searches, local
server checks, deterministic synthetic harnesses, or disposable isolated Chromium evidence. It may
not access a real provider, production deployment, user profile, private fixture, or user database.

## A2 result

### Release decision

**Production release is `BLOCKED`.** The exact-base build has strong deterministic Canonical,
Import, Storage, Backup, Diagnostics, consumer and rollback-mode evidence, but it does not have zero
P0/P1 defects. This audit confirmed production-entry P0 privacy/security/data-safety issues in
addition to the already documented Service Worker, real-library, cross-browser, rollback and
release-artifact gaps. A passing full suite or Draft PR CI cannot override those findings.

The audit reused accepted deterministic-synthetic Chromium evidence where the implementation has
not changed, and reran only read-only source/test checks. It did not access a provider, production
deployment, real account, private library, real file, user browser profile, or user storage.

### Evidence executed during A2

```text
exact base                                  e083fa0d55c8981f0258af546451ebb0d48e4fa4
PR #30                                      merged; squash SHA equals exact base
integration push CI                         PASS run 31157822933
A1 Draft PR #31                             OPEN, Draft=true, one changed path
A1 exact-head CI                            PASS run 31169928387
focused auth/SW/diagnostics/consumer/docs   PASS 62/62
npm audit --omit=dev                        PASS, 0 reported vulnerabilities
A2 syntax                                   PASS, 239 files
A2 privacy                                  PASS
A2 release-document contract                PASS 12/12
A2 full test                                PASS 1,469/1,469
A2 git diff --check                         PASS
tracked v2 tags                             NONE
public GitHub Releases API                  empty list on 2026-08-07
package version                             1.0.0
worktree changed paths during investigation docs/tasks/pr-25-release-readiness-audit.md only
```

The focused 62-test pass is deliberately narrow. It proves, among other things, synthetic
Disconnect token-only removal, local Service Worker registration policy, safe Diagnostics seams,
and existing consumer boundaries. It also proves that the current auth test explicitly expects the
probe-abort-failure path to delete the Legacy database; therefore that passing test is evidence for
the data-safety finding below, not evidence that the release risk is closed.

## Current production entry graph

| Entry | Production graph and external boundary | Audit result |
| --- | --- | --- |
| `/`, tab routes | `index.html` -> `/js/main.js` -> `js/app/main.js` and all tab modules | Root declares D3, Cal-Heatmap, Chart.js, Leaflet, GTM, Google Analytics and Vercel Insights; real initialization always runs preprocessing, which automatically requests historical weather for GPS runs |
| `/html/activity-router.html?id=...` | router reads opaque ID -> Repository -> Run/Bike/Swim/Generic detail document | Router and every detail document load Vercel Insights/Speed Insights; target documents also load third-party CDN assets; query string contains the private opaque activity ID |
| `/html/gear.html?id=...` | Repository gear/activity reads -> gear detail renderer | Vercel/Speed Insights and external Leaflet/Chart.js resources; unsafe inline HTML/handler sinks exist |
| `/source-manager.html?mode=real` | local Source Manager -> Registry/Worker/Import/Storage | Same-origin CSP-protected surface; accepted deterministic synthetic evidence; no provider or selected-file upload in the reviewed path |
| `/storage-backup.html` | local Backup service -> exact-current V4 archive/restore | Same-origin CSP-protected surface; deterministic and served synthetic evidence; private output must remain outside Git |
| `/diagnostics.html` | safe Diagnostics session snapshot | Same-origin CSP-protected surface; no raw V2 database read and no network in the reviewed Diagnostics boundary |
| Service Worker | non-local pages register `./sw.js`; fixed `strava-dashboard-v1` network-first cache | Intercepts GET requests broadly, excludes only URLs containing `api.strava.com`, stores other 200 responses, calls `skipWaiting`/`clients.claim`, and deletes every other origin cache name during activate |

The local-first Repository boundary is real, but the whole production application is not local-only
or fully offline. Eager module import also means the Weather, Map and AI code is part of the root
production graph even when its tab is not opened; weather network activity additionally occurs
during normal preprocessing rather than only on explicit Weather-tab use.

## Release-wide P0/P1 inventory

| ID | Severity | Finding and exact evidence | Release impact | Closure class |
| --- | --- | --- | --- | --- |
| P0-01 | P0 | Imported/provider-controlled activity names, gear names and opaque IDs are interpolated into `innerHTML`, Leaflet popup HTML and inline `onclick` in `js/tabs/activities.js`, `calendar.js`, `wrapped.js`, `athlete.js`, `gear.js`, `maps.js`, `run-analysis.js`, `bike-analysis.js`, `swim-analysis.js`, and `js/pages/gear/gear-analysis.js`; several URLs also omit `encodeURIComponent` | Persistent DOM injection can execute in the trusted origin and read local libraries, settings or credentials; URL-special opaque IDs can be truncated or reinterpreted | Deterministic synthetic browser and static tests can close after code repair |
| P0-02 | P0 | Tracked production/demo source embeds a specific athlete ID, name and usernames in `js/shared/preprocessing/core.js`, `js/pages/swim/swim.js`, and `js/demo/generator.js`; the preprocessing path also coerces the provider identity with `Number(profile.id)` | Violates the repository/Privacy Guide prohibition on identifiable athlete data in Git and the string-ID boundary; existing public history requires owner incident assessment even after code removal | Code repair is automatable; history/incident decision requires owner |
| P0-03 | P0 | `api/_shared.js` logs raw token-refresh response text; `api/strava-auth.js` logs raw provider data/cause; other `api/strava-*` paths log raw errors or return provider details; `js/tabs/bike-analysis.js` logs the full rides array; weather/client paths log names, exact dates and raw errors | Token/provider/activity/health/location values can enter server or browser logs; safe Diagnostics does not sanitize these independent logs | Deterministic static and injected-error tests can close after separate server/client repairs |
| P0-04 | P0 | `preprocessActivities()` always calls `groupByDay()` for real sessions; it sends each GPS run's exact latitude, longitude and activity date to `archive-api.open-meteo.com` during ordinary initialization/refresh, without an explicit external-egress authorization | Non-waivable unauthorized activity-data transmission; release gate explicitly forbids it | Safe default is automatable; user-consent/product behavior requires owner decision |
| P0-05 | P0 | `js/tabs/ai-chat.js` sends activity names, exact dates, HR aggregates, gear names, PBs and recent-activity summaries to Google Gemini. UI says “Runs in your browser · No data sent to servers”; only a generic WIP prompt precedes use, and the API key/history are persisted in localStorage | Materially false disclosure and no specific informed authorization for health/activity-data egress; credential exposure is amplified by P0-01 | Automatable disclosure/deny-by-default tests after owner selects disable-versus-consent behavior |
| P0-06 | P0 | `js/tabs/maps.js` fits external OSM/Carto/Stamen tile requests to activity coordinates and renders route/name/date popup HTML | Tile coordinates reveal route regions to third parties and popup HTML shares the P0-01 injection surface | Requires an explicit external-map decision; implementation/test work is automatable afterward |
| P0-07 | P0 | `sw.js` caches every successful GET except direct `api.strava.com`; same-origin `/api/strava-*` responses, query URLs and CORS weather responses are therefore eligible for Cache Storage, including responses containing provider payloads or refreshed tokens | Private responses and exact query metadata may persist outside the reviewed Legacy/V2/Backup boundaries; production privacy gate remains blocked | Emergency request-classification repair is automatable; lifecycle evidence remains separate |
| P0-08 | P0 | `sw.js` activate deletes every cache whose name is not the fixed cache name and immediately claims clients; no production mixed-version or multi-app-origin proof exists | Can delete unrelated same-origin Cache Storage and run mixed old/new resources; conflicts with non-destructive rollback | Code repair automatable; production-like lifecycle/rollback requires deployment authority |
| P0-09 | P0 | `inspectLegacyIndexedDbPresence()` calls `deleteDatabase('strava-dashboard-cache')` if its missing-database upgrade could not be aborted; the passing auth test freezes this behavior | A concurrent writer/open can turn probe compensation into Legacy data deletion; violates the release non-destructive invariant | Deterministic race/failure tests and code repair are automatable |
| P1-01 | P1 | Weather normalization converts absent/invalid readings to `0`, and a failed weather request assigns `run.difficulty = 0` | Missing, unavailable and real zero become indistinguishable, contrary to accepted absent/null/zero semantics | Automatable with focused failure-first tests; belongs with weather repair, not storage/schema work |
| P1-02 | P1 | GTM/Google Analytics, Vercel Insights/Speed Insights and third-party CDN resources are enabled on production entries; activity IDs appear in detail query URLs; root CDN URLs include unpinned `chart.js` and no SRI/CSP on the inherited shell/detail pages | Telemetry/referrer behavior and supply-chain/offline risks are not bounded by current tests | Needs privacy/support decision, then isolated-network browser evidence |
| P1-03 | P1 | PRD support is latest two Chrome/Safari/Firefox, macOS/Windows desktop and basic iOS Safari/PWA, but actual served evidence is only disposable Chromium/Chrome on macOS | Published support cannot be claimed | Requires actual browser/platform matrix or time-bounded owner waiver |
| P1-04 | P1 | 10,000 activities and 1,000 FIT throughput remain record-only; browser Chart, Leaflet and Canonical Store include disclosed recording stubs | RC performance row lacks a frozen threshold/waiver for every required workload | Deterministic automation can gather data; budget/waiver is owner decision |
| P1-05 | P1 | App-shell first-interactive, broad responsive/visual, keyboard-only, screen-reader, localization and mobile matrices are incomplete | PRD performance/accessibility/support claims remain partial | Browser/platform/manual evidence or scoped waiver required |

`npm audit` reporting zero known package advisories does not close P0-01 through P1-05. Most of
those findings are application behavior, external-resource policy, or unpinned runtime CDN risks
rather than installed-package advisories.

## External network, telemetry and cache matrix

| Boundary | Trigger | Private/sensitive input | Current control | Status |
| --- | --- | --- | --- | --- |
| Open-Meteo archive | automatic root preprocessing and Weather tab | exact latitude, longitude and date | no specific consent; failure can be coerced to zero | BLOCKED |
| Google Gemini | AI Coach message | names, dates, HR, gear, PB and recent history; API key in URL query | user supplies key, but UI falsely denies server egress and has no field disclosure | BLOCKED |
| OSM/Carto/Stamen tiles | Map tab render | tile coordinates derived from route bounds | no location-egress disclosure/consent | BLOCKED |
| GTM/Google Analytics | root document load | page/referrer/session data; possible route state | unconditional inherited scripts | BLOCKED pending privacy decision |
| Vercel Insights/Speed Insights | root/router/detail/gear entries | performance/navigation metadata; detail URL carries opaque ID | same-origin script path, but production collection contract not audited | BLOCKED pending production evidence |
| Third-party CDN | root/detail document load | origin/referrer and runtime dependency requests | no shell CSP/SRI; some resources unpinned | PARTIAL |
| Strava provider APIs | explicit Legacy auth/connector operation | Token, provider DTO, identifiers and Streams | Repository/Connector tests exist; raw API logs and SW cache remain | BLOCKED |
| Service Worker Cache Storage | any controlled successful GET not direct `api.strava.com` | same-origin API/provider responses and exact query keys | broad network-first policy | BLOCKED |

## Release-gate matrix

Status vocabulary is exactly `PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, and `NOT APPLICABLE`.
“Auto” below means deterministic synthetic/static/isolated-browser work can close the remaining
evidence after an authorized fix. “External” means a real account/private library, supported
browser, production Service Worker/deployment, or release-owner act is inherently required.

### PR gate for PR-25

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| Task Brief approved for implementation | NOT APPLICABLE | PR-25 is an audit-only task and authorizes no implementation | None |
| Dependency PR merged | PASS | PR #30 squash is the exact integration baseline | None |
| Required ADRs accepted | PASS | ADR-0001 through ADR-0006 are Accepted | None |
| Literal scope respected | PASS | only this Task Brief is changed | Auto recheck |
| `npm ci` | PASS | untouched baseline completed | Auto |
| Syntax | PASS | 239 files | Auto |
| Privacy check | PASS | repository path/extension guard passes; this result does not close content-level P0-02/P0-03 | Auto |
| Full tests | PASS | 1,469/1,469 on untouched base | Auto |
| Audit-focused tests | PASS | 62/62 auth/SW/diagnostics/consumer/docs | Auto |
| `git diff --check` | PASS | untouched base and A1 scope | Auto |
| PR diff contains no private evidence | PASS | one docs-only Task Brief using no real values beyond already public commit/run identifiers | Auto |
| Migration impact stated | PASS | none; read-only audit | None |
| Rollback stated | PASS | docs-only revert; no product/data operation | None |
| Manual/external acceptance listed | PASS | separated below into five decision packages | External |
| Unrun work reported | PASS | no real/private/production/cross-browser claim is promoted to pass | None |

### Integration gate

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| `integration/v2` CI | PASS | run 31157822933 concluded success at exact base | Auto |
| Default feature flag matches stage | PASS | Canonical default; explicit Legacy/Shadow retained | Auto |
| Legacy path starts | PASS | accepted PR-23 deterministic served evidence | Auto rerun possible |
| Canonical failure preserves Legacy | PASS | Repository/storage/auth failure tests; physical isolation | Auto |
| Cross-PR Repository/Storage/Import integration | PASS | current full suite passes | Auto |
| No unresolved integration conflict | PASS | linear first-parent integration history through PR #30 | Auto |
| Database migration is repeatable | PASS | additive V1-V4 transaction/idempotence tests | Auto |
| New errors observable without privacy leakage | PARTIAL | V2 Diagnostics/import/backup safe codes pass, but production graph still contains P0-03 raw logs | Auto after repair |

### Alpha gate

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| Baseline tag and `maintenance/v1` | PASS | tag `baseline-strava-api-2026-07-28`; branch at `fe34535...` | None |
| Legacy export/validate/restore | PARTIAL | deterministic PR-01 implementation/tests pass; real Legacy recovery drill not run | External |
| Canonical contracts accepted | PASS | six Accepted ADRs and current contract suites | Auto |
| Repository convergence complete | PASS | seven-method boundary and consumer suites | Auto |
| V2 DB physically isolated | PASS | `strava-stats-v2` V4 vs Legacy DB | Auto |
| Shadow writer preserves Legacy reads | PASS | PR-06 deterministic integration evidence | Auto |
| Parity report exports explainable differences | PASS | redacted report contract passes; real-library review is a later RC/Production gate | Auto |
| Feature flag can select Legacy | PASS | explicit PR-23 Legacy/Shadow served evidence | Auto |

### Beta gate

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| Synthetic JSON vertical slice | PASS | Import Core deterministic suite | Auto |
| English `activities.csv` | PASS | decoder/Registry/served synthetic evidence | Auto |
| Strava ZIP safety/association | PASS | bounded ZIP matrix and served synthetic evidence | Auto |
| FIT/TCX/GPX decoder matrix | PASS | format suites and served synthetic evidence | Auto |
| Same file creates no duplicate | PASS | exact identity/replay tests | Auto |
| One file failure preserves batch successes | PASS | per-item transaction/cancellation/quota tests | Auto |
| Start/browse without Token | PASS | default Canonical deterministic served evidence | Auto |
| Summary-only/missing capabilities degrade | PASS | consumer/detail matrices | Auto |
| Source Manager/Import Report usable | PASS | PR-10/14/20 deterministic served evidence | Auto |

### Release Candidate gate

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| CSV/FIT/TCX/GPX regression | PASS | current full suite and accepted served synthetic evidence | Auto |
| Full-library backup/fresh restore | PASS | exact-current deterministic and fresh-profile synthetic evidence; not real-library proof | Auto |
| Exact Identity Resolver | PASS | transaction/performance/browser evidence | Auto |
| Fuzzy similarity never auto-merges | PASS | candidate/decision contracts and UI behavior | Auto |
| Summary Legacy/Canonical parity reviewed | PARTIAL | projection and synthetic Shadow evidence only | External private library |
| Detail reads local Streams | PASS | PR-17 Canonical detail evidence | Auto |
| Run Plus/NSM regression | PASS | PR-18/23 deterministic routes | Auto |
| SW update and old-cache eviction | BLOCKED | P0-07/P0-08 plus no production-like lifecycle evidence | Mixed |
| 5k/10k/large Stream performance | PARTIAL | 5k and 200k budgets pass; 10k and 1k FIT record-only/stub limitations remain | Mixed |
| Migration/release rollback drill | BLOCKED | no combined deployment/SW/backup/disconnect rollback | External production-like |
| Zero unresolved P0/P1 | BLOCKED | P0-01 through P0-09 and P1-01 through P1-05 are open | Mixed |

### Production release gate

| Gate | Status | Authority/evidence and gap | Closure |
| --- | --- | --- | --- |
| Start without Token | PASS | default Canonical served synthetic evidence | Auto |
| Disconnect does not delete local library | PARTIAL | synthetic lifecycle passes; real-account disconnect not run; P0-09 probe deletion remains | Mixed |
| Legacy Cache recoverable | PARTIAL | deterministic rescue passes; real cache drill missing | External |
| All CI passes | PARTIAL | integration and A1 heads pass; final A2 commit CI is not yet available | Auto post-push |
| All P0 imports pass | PARTIAL | deterministic Node/Chromium matrix passes; real files/private library/supported browsers not run | External |
| Database backup/restore | PASS | exact-current deterministic actual-served synthetic evidence | Auto |
| Exact duplicate | PASS | exact identity/import regression | Auto |
| Summary parity | PARTIAL | no authorized real-library parity sign-off | External |
| Detail degradation | PASS | deterministic detail/browser matrix | Auto |
| Run Plus/NSM | PASS | deterministic served route evidence | Auto |
| Shadow differences reviewed | PARTIAL | safe synthetic report only | External |
| Canonical can switch to Legacy | PASS | deterministic non-destructive mode evidence | Auto |
| No private data in Git/logs/telemetry | BLOCKED | P0-02 through P0-08 and P1-02 | Mixed |
| Migration/Backup/Privacy/Troubleshooting docs | PASS | PR-24 reviewed release documentation | Auto |
| Final rollback drill | BLOCKED | production deployment/SW/data-owner exercise not run | External |
| Release owner approval | BLOCKED | no version/tag/artifact/deploy approval; package remains `1.0.0`, no v2 tag or GitHub Release | External owner |

## Minimum follow-up PR route

The following are candidate packages, not authorization. Each package owns one risk surface. A
future Task Brief must revalidate and freeze its literal allowlist before implementation.

### R1 — Root summary DOM and opaque-ID hardening (automatable P0)

Candidate allowlist:

```text
docs/tasks/pr-26-summary-output-hardening.md
js/shared/utils/output-safety.js
js/tabs/activities.js
js/tabs/calendar.js
js/tabs/wrapped.js
js/tabs/athlete.js
js/tabs/gear.js
js/tabs/maps.js
js/tabs/run-analysis.js
js/tabs/bike-analysis.js
js/tabs/swim-analysis.js
tests/consumers/summary-output-safety.test.js
tests/consumers/summary-output-safety-browser-smoke.html
```

Dependency: exact PR-25 decision acceptance only. Verification: hostile deterministic names,
quotes, markup and URL-special opaque IDs through actual render/navigation; CSP/network/storage
instrumentation; full suite/privacy. Rollback: ordinary code revert, no storage change. Material
decision: none if limited to output encoding, DOM APIs and exact string-ID preservation.

### R2 — Detail and gear DOM hardening (automatable P0, depends on R1 utility)

Candidate allowlist:

```text
docs/tasks/pr-27-detail-output-hardening.md
js/pages/activity/activity.js
js/pages/activity/analysis-ui-components.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/pages/gear/gear-analysis.js
tests/consumers/detail-output-safety.test.js
tests/consumers/detail-output-safety-browser-smoke.html
```

Dependency: R1 shared output-safety boundary. Verification/rollback mirror R1 across Generic, Run,
Bike, Swim and Gear. Material decision: whether external Strava segment links remain enabled for
Canonical opaque activities; default recommendation is hide them unless provenance explicitly
proves the provider link.

### R3 — Remove committed athlete identity and implicit personalization (automatable P0 after decision)

Candidate allowlist:

```text
docs/tasks/pr-28-athlete-identity-removal.md
js/shared/preprocessing/core.js
js/pages/swim/swim.js
js/demo/generator.js
tests/legacy/demo-isolation.test.js
tests/consumers/detail-consumers.test.js
tests/privacy/tracked-identity.test.js
```

Dependency: incident/behavior decision. Recommendation: remove all specific IDs/names/usernames and
ship no implicit athlete-specific correction; design an explicit source-neutral user override in a
later PR. Verification: tracked-content guard, string-ID tests, no accessors/coercion, deterministic
Demo. Rollback: ordinary revert would reintroduce the privacy issue and is not an acceptable
production rollback. Owner must decide whether public Git history needs coordinated remediation.

### R4 — Server/API log redaction (automatable P0)

Candidate allowlist:

```text
docs/tasks/pr-29-server-log-redaction.md
api/_shared.js
api/strava-auth.js
api/strava-activities.js
api/strava-activity.js
api/strava-athlete.js
api/strava-gear.js
api/strava-streams.js
api/strava-zones.js
tests/privacy/server-api-logging.test.js
```

Dependency: none. Replace raw objects/bodies/messages with fixed server-side codes and safe status
classes; provider `details` must not be returned to the browser. Verification injects Token,
Authorization, ID/body/stack canaries and proves absence from logs and responses. Rollback is a
code revert only, but raw logging must not be restored.

### R5 — Client raw-log redaction (automatable P0)

Candidate allowlist:

```text
docs/tasks/pr-30-client-log-redaction.md
js/services/api.js
js/services/activity-cache.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/bike-analysis.js
js/tabs/weather.js
tests/privacy/client-logging.test.js
```

Dependency: none; do not mix with external-egress behavior. Verification injects names, opaque IDs,
coordinates, dates, HR/power, storage errors and proxy/accessor canaries. Only fixed safe codes or
non-identifying bounded counts may reach console. Rollback: code-only.

### R6 — Automatic weather egress and missing-value repair (P0/P1; material behavior decision)

Candidate allowlist:

```text
docs/tasks/pr-31-weather-egress-consent.md
index.html
js/app/main.js
js/app/feature-flags.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/weather.js
tests/privacy/weather-egress.test.js
tests/consumers/weather-consent-browser-smoke.html
```

Recommendation: default to zero weather requests during startup/refresh and keep missing weather as
missing; require a specific, revocable disclosure before sending rounded-or-exact location/date.
Owner must choose whether exact coordinates are ever allowed or the production feature is disabled.
Verification: zero-network startup, deny/accept/revoke states, no missing-to-zero conversion, no raw
logs, and isolated-browser request capture. Rollback: feature flag off; never clear activity data.

### R7 — AI Coach external-data consent and credential boundary (P0; material behavior decision)

Candidate allowlist:

```text
docs/tasks/pr-32-ai-egress-consent.md
index.html
js/tabs/ai-chat.js
tests/privacy/ai-egress.test.js
tests/consumers/ai-consent-browser-smoke.html
```

Recommendation: disable the feature by default until a field-level disclosure/preview, explicit
per-destination consent, key-storage policy and deletion path are approved. Verification must prove
zero Gemini request before consent and exact allowlisted outbound fields after consent. Rollback:
disable the tab/flag without deleting local libraries. Do not combine this with telemetry or maps.

### R8 — External map location boundary (P0; material behavior decision)

Candidate allowlist:

```text
docs/tasks/pr-33-map-egress-consent.md
index.html
js/tabs/maps.js
tests/privacy/map-egress.test.js
tests/consumers/map-consent-browser-smoke.html
```

Recommendation: no third-party tiles until explicit location disclosure/consent; local route
geometry can render on a neutral canvas without a remote basemap. Verification captures all
requests and proves no route-derived request on deny. Rollback: default remote tiles off; no data
mutation.

### R9 — Service Worker private-request exclusion (automatable P0, separate from lifecycle)

Candidate allowlist:

```text
docs/tasks/pr-34-service-worker-private-cache.md
sw.js
tests/service-worker-fetch-policy.test.js
```

Dependency: none. Recommendation: cache only a literal same-origin static-shell allowlist; never
cache `/api/`, auth/provider responses, query-bearing user routes, weather/AI/map traffic, or any
response with authorization/private semantics; delete only explicitly owned historical app cache
names. Verification uses synthetic Request/Response/CacheStorage objects and canaries. Rollback:
previous worker is not safe; emergency rollback is stop registration and serve the known stable
deployment while preserving IndexedDB/localStorage.

### R10 — Legacy presence probe non-deletion (automatable P0)

Candidate allowlist:

```text
docs/tasks/pr-35-auth-presence-nondestructive.md
js/app/auth-lifecycle.js
tests/legacy/auth-lifecycle.test.js
```

Dependency: none. Replace delete compensation with a method that cannot create/delete the Legacy
database, or fail closed when presence cannot be proven. Verification must include abort failure,
blocked/versionchange and concurrent-writer schedules with `deleteDatabase` exactly zero. Rollback:
code-only, preserve every database.

### R11 — Telemetry/CDN governance (P1 privacy/supply chain; separate decision)

Candidate allowlist:

```text
docs/tasks/pr-36-external-runtime-governance.md
index.html
html/activity-router.html
html/activity.html
html/run.html
html/bike.html
html/swim.html
html/gear.html
js/main.js
js/shared/utils/speed-insights.js
package.json
package-lock.json
tests/privacy/external-runtime.test.js
tests/consumers/external-runtime-browser-smoke.html
```

Owner must choose disabled-by-default telemetry, self-hosted pinned assets, or a documented
time-bounded exception. Verification requires request/referrer capture, no private ID in telemetry,
CSP/SRI or local asset integrity, cold-network behavior and supported-browser runs. Rollback:
disable telemetry/external assets; do not clear storage or Service Worker caches broadly.

## Decision-only evidence packages

These packages must not be merged into any implementation PR above.

### D1 — Real account, Disconnect, private library and parity

Public candidate allowlist: `docs/tasks/pr-37-private-release-evidence.md` only. Private artifacts
remain outside Git. Required decisions: authorized account/library owner, evidence retention,
redaction reviewer, representative Legacy/V2/import formats, parity tolerances and P0 discrepancy
owner. Required runs: real Disconnect with before/after counts, Legacy rescue/restore, real
FIT/TCX/GPX/ZIP import, exact duplicate, Shadow report and summary parity. No evidence package may
delete, migrate or overwrite either library.

### D2 — Supported browser/platform matrix

Public candidate allowlist: `docs/tasks/pr-38-browser-support-matrix.md` only until support scope is
approved. Owner chooses either the PRD matrix or a narrower time-bounded release claim with waiver,
owner and expiry. Required environments are the chosen Chrome/Safari/Firefox versions, macOS and
Windows desktop, and any retained iOS Safari/PWA claim; import, storage, backup, detail, offline,
keyboard and responsive evidence must be mapped per supported environment.

### D3 — Production Service Worker lifecycle

Public candidate allowlist: `docs/tasks/pr-39-production-sw-lifecycle.md` only for the decision
phase. This follows R9 and cannot share its implementation PR. Required matrix: clean install,
current-to-new update, old-tab/new-worker, new-tab/old-assets, cold offline, cache eviction limited
to owned caches, provider/API exclusion, failed deploy, rollback worker, and user-data counts before
and after. Requires production-like origin/deployment authority.

### D4 — Complete deployment and rollback rehearsal

Public candidate allowlist: `docs/tasks/pr-40-release-rollback-rehearsal.md` only. Required owners:
release, migration, rollback decision, verifier and communications. Exercise application Feature
Flag rollback, prior deployment, Service Worker version, V2 backup/fresh restore, Legacy startup,
real Disconnect, failure injection and preserved Legacy/V2/settings counts as one sequence. No
step may use clear-site-data or database deletion as recovery.

### D5 — Version, tag, artifact and release-owner authorization

Public candidate allowlist: `docs/tasks/pr-41-release-artifact-approval.md` only until every prior
blocker is closed. Owner must choose the version/stage, exact commit, changelog/date, artifact,
deployment target, signatures/checksums, release notes, rollback target and approval record. Current
facts are package `1.0.0`, no tracked `v2.0.0-*` tag and an empty GitHub Releases list. This audit
does not authorize a version edit, tag, Release, deployment, Ready transition or merge.

## A2 verification, privacy, migration and rollback impact

- Changed path remains exactly this Task Brief; product, tests, package/version, workflow, schema,
  Service Worker and deployment/release configuration are untouched.
- No real credential, account, provider response, private activity, file, library, browser profile,
  location, HR or power value was read. The committed identifier finding was discovered by static
  source inspection; this audit does not repeat those values outside their already tracked source.
- Legacy, V2, settings, backup and Cache Storage were not opened, migrated, copied, cleared,
  repaired, overwritten, downgraded or reverse-copied by A2.
- Audit rollback is an ordinary revert of this docs-only PR. It does not change the underlying P0/P1
  status, which remains release-blocking until separately repaired and verified.
- PR #31 must remain Draft. A2 authorizes no implementation package and no release action.

## A3 current-tree re-audit after R1-R11 and D3

### Authority, exact state and method

This resumed audit reads the actual current `integration/v2` tree rather than treating the earlier
A2 inventory or merged-PR descriptions as proof. The unique integration baseline is
`cac3fdb97337a358da08a1f6d92c541519282d5a`, tree
`4de9cf52ce5fe50fb223892c94a6d9cb2d3aa8fa`. Its first-parent history contains the squash merges
for R1/R2, R3, R4/R5, R9, R10 and its residual stabilization, R6, R7, R8, R11, and D3. PR #44 is
merged at the exact baseline. Integration push CI run `31310574630`, job `93237672950`, concluded
`success` with every job step successful.

The locked integration worktree was clean at that exact commit. The feature branch intentionally
remains based on its original A1 branch point and was not rebased or merged with integration; this
avoids creating an unauthorized contract-resolution commit. PR #31 remains the docs-only audit
vehicle and must stay OPEN/Draft.

Evidence executed or read authoritatively for A3:

```text
integration worktree/head/status       cac3fdb97337a358da08a1f6d92c541519282d5a; clean
integration push CI                    PASS run 31310574630 / job 93237672950
postmerge npm ci                       PASS (control-tower exact-base evidence)
postmerge syntax                       PASS, 260 files (control-tower exact-base evidence)
postmerge privacy                      PASS (control-tower exact-base evidence)
postmerge full test                    PASS, 1,707/1,707 (control-tower exact-base evidence)
postmerge diff check                   PASS (control-tower exact-base evidence)
A3 focused current-tree matrix         PASS, 632/632
server-log served test rerun           PASS, 40/40 on isolated loopback
npm audit --omit=dev                   PASS, 0 reported vulnerabilities
package version                        1.0.0
remote tags                            baseline-strava-api-2026-07-28 only
public GitHub Releases API             empty
real/private/provider/profile evidence NOT RUN
```

The first focused invocation recorded 631 passes and one environment-only `listen EPERM` at
`127.0.0.1`; the exact affected 40-test server-log file then passed 40/40 with isolated loopback
permission. This is a complete focused 632/632 result, not a hidden product failure. No provider,
real Token, private activity/file/library, user browser profile, production deployment, or user
storage was accessed.

### Earlier inventory reconciliation against the current tree

`CLOSED` below means the earlier code defect is no longer present in the current production tree
and its deterministic evidence passes. It does not promote a real-data, browser, deployment, or
release-owner gate to PASS.

| Earlier item | Current-tree disposition | Authoritative current evidence and remaining boundary |
| --- | --- | --- |
| P0-01 / R1-R2 DOM and opaque IDs | CLOSED | Hostile provider text and opaque string IDs use native DOM assignment and encoded navigation; root, detail and gear boundary tests pass. No new reachable persistent-injection P0 was found in the audited production entry graph. |
| P0-02 / R3 tracked identity | CLOSED in current code; incident BLOCKED | Current production/demo sources and privacy guard contain no specific athlete identity or numeric identity coercion. Whether already-public Git history requires incident action remains a separate owner decision; this audit neither repeats values nor authorizes history rewrite. |
| P0-03 / R4-R5 raw logs | CLOSED | Server paths emit fixed safe events; browser paths emit fixed messages or non-identifying bounded counts. Canary/error tests pass. The raw quick-start example is not imported by a production entry. |
| P0-04 and P1-01 / R6 weather | CLOSED | Ordinary startup performs zero weather request. A session-only, specific consent gates the bounded Open-Meteo request; missing remains missing and genuine zero remains zero. Exact approved fields are one rounded point and one date. |
| P0-05 / R7 AI | CLOSED | Demo performs zero I/O. A user gesture and per-request Google Gemini preview/consent gate only a question plus two rounded relative aggregate buckets; names, IDs, dates, gear, PB, GPS, HR, power and history are excluded. Key and history are memory-only. |
| P0-06 / R8 maps | CLOSED | Remote OSM tiles require per-map, memory-only coarse-location consent; zoom, hosts, request count, referrer, timeout, revoke and navigation boundaries pass. No activity fields are sent. |
| P0-07 / R9 SW private cache | CLOSED | Only queryless same-origin static request classes are eligible. API, query, telemetry, weather, AI, map, credential and navigation traffic bypass; response admission is bounded. |
| P0-08 / D3 SW lifecycle | CLOSED for deterministic code; environmental gate PARTIAL | Immutable owned cache `stravastats-static-v2-000001`, required seed install, drained-client activation and fixed waiting UI replace broad cache deletion, `skipWaiting` and `clients.claim`. Native production-like update, multi-tab, cold-offline, failed-deploy and combined rollback evidence is still not run. |
| P0-09 / R10 Legacy probe | CLOSED with accepted Option B residual | Auth/reader code contains zero `deleteDatabase`. Presence must be safely proven; otherwise state is unknown. The accepted TOCTOU residual can at worst leave an empty version-1 database with zero stores/user records after an external deletion plus abort failure; it is never classified first-run and no user data is deleted. |
| P1-02 / R11 telemetry/CDN | CLOSED | Production runtime telemetry is unreachable/disabled. Runtime assets are exact same-origin vendored files with integrity, CSP and no-referrer controls. The tracked Speed Insights helper has no production-entry import. Consent-gated weather/AI/map remain separate disclosed destinations. |
| P1-03 browser/platform | PARTIAL | Deterministic disposable macOS Chromium/Chrome evidence exists; the PRD Safari/Firefox, Windows, iOS/PWA and broader assistive-technology claims were not executed. |
| P1-04 performance | PARTIAL | Synthetic 5,000 and 200,000 activity checks pass. The 10,000-activity and 1,000-FIT records still lack approved absolute budgets; some browser evidence uses disclosed Chart/Leaflet/Canonical Store stubs. |
| P1-05 interactive/accessibility/visual | PARTIAL | Focused keyboard, responsive and accessibility contracts pass, but app-shell interactive/long-task, screen-reader, full responsive/visual/mobile and localization matrices are incomplete. |

The earlier privacy, logging, external-network, cache and lifecycle code fixes therefore close the
corresponding old findings. Passing 1,707 tests and current integration CI does not close the
environmental or owner-authorized rows below.

### New current-tree P0/P1 findings

| ID | Severity/status | Current-tree finding | Minimum closure |
| --- | --- | --- | --- |
| A3-P0-01 | P0 / BLOCKED | The production root still states: “Your Strava data is processed in your browser only. Nothing is stored or sent to any server.” This absolute statement is false for the optional same-origin Legacy provider connector and the now-consented weather, AI and map destinations. | A dedicated product PR must replace it with exact, stage-appropriate disclosure and freeze the truthfulness contract with a deterministic privacy test. No public Alpha or v2.0 should ship with the current claim. |
| A3-P0-02 | P0 for full v2.0 / BLOCKED | PRD section 4.1 requires the existing Strava API to remain as an optional connector, and section 8.2 requires source connection states and Disconnect. The Canonical Source Manager still labels provider connection outside PR-10 and exposes disabled `Connect later`/`Disconnect` controls. | Choose mutually exclusively: implement the canonical connector lifecycle; formally amend/narrow the v2.0 P0 contract; or release only a clearly scoped Alpha that defers this full-v2.0 requirement. |
| A3-P0-03 | P0 for full v2.0 / PARTIAL | Import Core persists failed work and supports explicit `retryJob`, but Source Manager exposes cancellation/reports and no retry/recovery action. PRD sections 4.1, 7.1, 13.4 and 13.5 require recovery/retry and per-report retry. The accepted PR-10 brief explicitly deferred retry UI. | If full v2.0 retains the PRD contract, add a separate bounded Source Manager recovery UI task with deterministic reload/failure/idempotency tests. An Alpha deferral must be explicit and time-bounded. |
| A3-P1-01 | P1 / BLOCKED | `known-limitations.md`, `privacy-guide.md`, the PR-24 ledger and its docs test still describe several pre-R3-R11/D3 blockers as current, including old logging, automatic weather and broad SW behavior. Release documentation is no longer an accurate current-tree ledger. | After the product/scope decisions, use a separate docs-reconciliation PR to state closed code findings, retained residuals and still-unrun environmental evidence. Do not falsify history in this A3 audit. |
| A3-P1-02 | P1 / PARTIAL | Performance, supported-browser, PWA/mobile, broad accessibility/visual and production-like lifecycle evidence remains incomplete. | Run the authorized environments or record explicit, owner-named, time-bounded scope waivers with expiry. |

No other code-level privacy, raw-log, unauthorized-egress, private-cache, destructive-Legacy-probe,
telemetry/CDN or SW-lifecycle P0 was found in the current tree. `A3-P0-01` is an immediate release
blocker for both Alpha and full v2.0. `A3-P0-02` and `A3-P0-03` are full-v2.0 product-completeness
blockers; they may be deferred only by explicitly choosing an Alpha scope, not by inference from
passing tests.

### Alpha versus full-v2.0 remaining roadmap

| Gate | Alpha | Full v2.0 | Closure authority |
| --- | --- | --- | --- |
| Truthful root privacy disclosure | BLOCKED | BLOCKED | Deterministic product fix and privacy contract test |
| R1-R2 and R4-R11 current-tree code safety | PASS | PASS | Current deterministic tests and source inspection |
| R3 public-history incident disposition | BLOCKED | BLOCKED | Privacy/security owner; no history rewrite is authorized here |
| Canonical Source Manager Strava Connector | PARTIAL if explicitly deferred and labeled | BLOCKED | Product owner chooses Alpha deferral, implementation, or formal PRD amendment |
| Import retry/recovery UI | PARTIAL if explicitly deferred and labeled | BLOCKED | Product owner chooses Alpha deferral or retained P0 implementation |
| R10 Option B residual | PARTIAL, disclosed accepted residual | PARTIAL, disclosed accepted residual | Already accepted; retain limitation and monitoring language |
| Deterministic performance/accessibility/visual work | PARTIAL | PARTIAL | Engineering runs after budgets/scope are frozen |
| Real Disconnect/import/private-library parity | BLOCKED | BLOCKED | Authorized account/library owner and redaction reviewer |
| Cross-browser/platform claim | BLOCKED absent a scoped waiver | BLOCKED absent chosen matrix/waiver | Product/release owner and actual environments |
| Native production-like SW and combined rollback | BLOCKED | BLOCKED | Deployment-policy authorization and named release/rollback owners |
| Current release documentation | BLOCKED | BLOCKED | Separate current-tree documentation reconciliation |
| Version/tag/artifact/release approval | BLOCKED | BLOCKED | Final release owner after all retained stage gates close |

An Alpha may deliberately retain `Connect later`, the accepted R10 residual, synthetic-only parity,
and a narrower browser/performance claim only when those limitations, owner, expiry and promotion
criteria are explicit. Privacy/data-loss/unauthorized-egress defects are not waivable; therefore the
current root disclosure must be repaired before either stage. Full v2.0 remains blocked by all
retained PRD P0s plus the real/private, platform, deployment/rollback, history, documentation and
artifact gates.

### Six separated remaining evidence and decision packages

These packages are mutually scoped. They must not be combined into one implementation or release
PR, and none is authorized by this audit.

#### 1. Deterministic, no-real-data work

Recommended immediate next task: **root privacy disclosure correction**.

Exact candidate allowlist:

```text
docs/tasks/pr-39-root-privacy-disclosure.md
index.html
tests/privacy/root-privacy-disclosure.test.js
```

Dependency: none. Verification must prove the root copy accurately distinguishes local library
processing, optional same-origin provider operations, and separately consented third-party
weather/AI/map requests; it must not imply that consented egress never occurs. Run repository
minimum gates plus the focused privacy test. Rollback is code/docs-test revert only, but restoring
the false absolute disclosure is not an acceptable release rollback. Privacy/data impact: no data
read or mutation and no network change. Material decision: approve exact Alpha/full-v2.0 copy.

Later deterministic tasks, each separately briefed, are:

- Source Manager optional-provider lifecycle, only after the product decision; candidate production
  paths are `source-manager.html`, its scoped styles/controller/facade, provider connector/auth
  boundary files identified by the new brief, and new synthetic source-state tests. No real OAuth
  evidence belongs in that implementation PR.
- Source Manager retry/recovery UI, separately from provider connection; candidate paths are
  `source-manager.html`, `js/pages/source-manager/source-manager.js`, its import facade, and focused
  deterministic reload/failure/retry UI tests. It must reuse Import Core rather than change schema.
- Performance and interaction gates after exact thresholds/scope are chosen: 10,000 activities,
  1,000 synthetic FIT files, app-shell interactive/long-task, keyboard/accessibility, responsive and
  visual evidence. Missing budgets require an owner decision or time-bounded waiver first.
- Current release-document reconciliation after product scope is frozen. Candidate evidence paths
  are `docs/guides/known-limitations.md`, `docs/guides/privacy-guide.md`,
  `docs/tasks/pr-24-release-documentation.md` and `tests/docs/release-docs.test.js`; any README or
  changelog change requires its later brief to justify and allowlist it explicitly.

#### 2. User/private credential and data evidence

Keep D1 decision-only and public-docs-only until authorized. Required evidence is real OAuth and
Disconnect with before/after local counts, Legacy rescue/restore, real FIT/TCX/GPX/ZIP imports,
duplicate behavior, representative private-library Shadow/parity and discrepancy sign-off. Private
artifacts remain outside Git; the account/library owner, retention policy, redaction reviewer and
parity tolerances must be named. No run may clear, migrate, overwrite or delete Legacy or V2 data.

#### 3. Cross-browser/platform evidence or waiver

Keep D2 separate. Choose exact Chrome/Safari/Firefox versions, macOS/Windows environments and any
retained iOS Safari/PWA/mobile/accessibility claim, or approve a narrower time-bounded stage claim
with owner, reason, expiry and promotion criteria. Execute import, storage, backup, detail, offline,
keyboard and responsive evidence in every retained environment. Disposable macOS Chromium alone is
not parity with this matrix.

#### 4. Production-like deployment, SW and combined rollback

D3 deterministic code work is closed, but native deployment evidence remains in D3 and combined
rollback remains D4. They require explicit deployment-policy authorization. Exercise clean install,
upgrade, waiting worker, drained clients, multi-tab old/new combinations, cold offline, owned-cache
eviction, failed deploy and rollback worker. Then rehearse deployment rollback, Feature Flag
Legacy fallback, V2 backup/fresh restore, Legacy startup, Disconnect and preserved Legacy/V2/settings
counts as one sequence. `clear-site-data`, cache-wide deletion and database deletion are prohibited.

#### 5. R3 public Git-history incident disposition

Current-tree removal is closed; public-history disposition is not. A privacy/security owner must
choose and document: retain history with incident assessment and mitigations; coordinate a separate
repository-history remediation under explicit authorization; or another approved incident path.
This audit recommends formal assessment and credential/account-impact review before any rewrite.
PR-25 authorizes no rewrite, force-push, value repetition or branch cleanup.

#### 6. Final version, tag, artifact and release-owner approval

Keep D5 last and separate. Current facts are package `1.0.0`, only the baseline tag and no public
GitHub Release. After the retained Alpha or v2.0 gates close, named owners must approve exact stage
and version, commit, changelog/date, tag, artifact, checksums/signatures, deployment target, release
notes, rollback target and approval record. PR-25 authorizes none of those actions.

### Minimum mutually exclusive decisions and recommended order

1. Approve exact truthful root privacy disclosure; then execute only the three-path immediate task
   above. This is the recommended next task and is required for both Alpha and full v2.0.
2. Choose **Alpha now** versus **continue directly to full v2.0**. Alpha must publish explicit
   deferrals, owners and promotion criteria. Full v2.0 must retain or formally amend every PRD P0.
3. For the Source Manager connector choose exactly one: implement the canonical optional connector;
   formally amend/narrow the v2.0 P0; or defer only under the Alpha decision. Independently choose
   implementation versus Alpha deferral for import retry/recovery UI.
4. Choose actual browser/platform execution versus a time-bounded narrower support claim. Choose
   performance budgets versus time-bounded stage waivers.
5. Authorize and staff D1, D3/D4 and the R3 incident review as separate packages. Only after those
   outcomes and current docs reconciliation may D5 approve an artifact.

### A3 release decision and stop boundary

**The current integration tree is not release-ready. Alpha and full v2.0 remain `BLOCKED`.** The old
R1-R11 and deterministic D3 code blockers are substantially closed, but A3 found one code-level P0
privacy-disclosure defect that blocks both stages, two retained PRD P0 completeness gaps that block
full v2.0 unless Alpha scope is explicitly chosen, stale release documentation, and multiple
external evidence/owner gates. No test or CI pass converts those environmental gates to PASS.

This Task Brief is the only changed path. A3 makes no product, test, package/version, workflow,
schema, Service Worker, deployment or release change. It reads no real/private data and has no
migration, storage or external-network effect. Audit rollback is an ordinary revert of the one
docs-only commit. PR #31 must remain OPEN/Draft; no Ready transition, merge, tag, Release, deploy,
cleanup or implementation begins in this audit thread.
