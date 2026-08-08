# PR-30: Client Raw-Log Redaction

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening R5 |
| Status | Final Review Closure complete; exact Closure-head CI pending |
| Branch | `codex/v2/client-log-redaction` |
| Exact base | `integration/v2@c04be67a71b672933a908d7c976dcd36cea69a53` |
| Product authority | Client production logging and debug-exposure hardening only |

## Goal and authority

Remove production-reachable browser/client raw logging and default-reachable global debug exposure
without changing user-visible behavior, network behavior, data contracts, or the closed PR-22
Diagnostics boundary. Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the
product PRD, engineering plan and release gates, this Task Brief, then implementation details.

R3 and R4 are merged dependencies and remain separate responsibility surfaces. This task does not
change server/API logging, weather egress or missing-value semantics, AI, maps, Service Worker,
Legacy probing, telemetry/CDN, deployment, release, or retained feature branches/worktrees.

## A0 baseline evidence

The worktree started detached and clean at the exact base. Local `integration/v2` and
`origin/integration/v2` resolved to the exact base with divergence `0/0`. GitHub Actions push run
`31239118763`, job `93056939136`, completed successfully at that exact SHA.

Untouched checks passed:

```text
npm ci                    PASS (6 packages installed)
npm run check:syntax      PASS (241 files)
npm run check:privacy     PASS
npm test                  PASS (1,522/1,522)
git diff --check          PASS
worktree status           CLEAN
```

No real credential, account, provider response, identity, activity, route, coordinate, date,
health/power value, export, private fixture, user browser profile, Legacy library, or V2 library
may be read or reproduced. Evidence uses only paths, categories, counts, fixed safe codes, hashes,
and existence facts.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief and is published to a Draft PR before
production or test implementation. A GitHub App 403 is delegated to the control tower; it does not
authorize Chrome, interactive login, or the user's browser profile.

The historical release audit proposed these candidate paths; they are investigation inputs, not an
implementation allowlist:

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

Until A2 freezes a smaller literal allowlist, the cumulative write allowlist is only this Task
Brief. A required additional path must be justified by a minimum source-to-runtime-to-sink failure
trace and must not collide with R4 or R6-R11.

## A2 findings and implementation authorization

### Complete inventory result

Static inspection enumerated 110 explicit client-side console call sites outside tests, server/API,
and tooling. Three belong exclusively to the Service Worker and remain R9. The remaining browser
graph was traced from the root tab barrel, detail entry documents, and the Advanced Analysis dynamic
import. Calls were classified as production-reachable raw/dynamic, production-reachable closed
fixed/coarse, R8/R9-owned, or example-only. No captured runtime value was printed.

The production-reachable raw/dynamic responsibility surface is:

| Category | Paths | Source -> runtime -> sink | Minimum disposition |
| --- | --- | --- | --- |
| Legacy API cache | `js/services/api.js` | storage key/error -> root and detail metadata reads -> console | Remove raw key and caught value output |
| Legacy activity cache | `js/services/activity-cache.js` | storage operation/error/rollback descriptor -> Legacy repository -> console | Preserve fallback behavior; emit no raw caught value/object |
| Automatic weather preprocessing | `js/shared/preprocessing/core.js` | activity name/date and thrown value -> root preprocessing -> console | Remove raw output only; do not change request or missing-value behavior |
| Detail weather rendering | `js/shared/utils/weather-analysis.js` | caught value -> detail weather UI -> console | Replace with fixed safe event code; preserve fixed UI recovery copy |
| Summary analysis tabs | `js/tabs/bike-analysis.js`, `js/tabs/weather.js`, `js/tabs/athlete.js`, `js/tabs/run-analysis.js` | activity arrays/names/dates/health or chart values/caught values -> root tabs -> console | Remove unnecessary output; retain only exact fixed safe categories |
| Advanced analysis | `js/analysis/analyzers/index.js`, `js/models/climb.js` | provider sport or activity distance/elevation -> detail Advanced Analysis -> console | Remove dynamic debug output; retain analysis results and algorithms |
| Run Plus debug publication | `js/tabs/run-plus.js` | diagnostics and NSM summary -> root element property + DOM dataset + `window` | Remove default-reachable debug publication; retain internal render model |

Other client call sites use fixed copy, necessary coarse non-identifying counts, internal fixed DOM
IDs, or are not imported by a production entry. `js/app/main.js` receives only internal fixed
categories, a closed Repository operation vocabulary and bounded counts; it does not receive raw
caught values. `classifyRun.js` and `classifyBike.js` use required classic-script globals consumed by
detail pages and are product runtime interfaces rather than debug publication. Maps and Service
Worker calls remain owned by R8 and R9 and are not changed.

The Run Plus publication has no documented product contract and no production reader anywhere in
the repository. Its three copies expose the same private analysis structures through a DOM element
property, serialized DOM attribute, and `window`; removing them leaves the internal render model,
visible UI, settings, algorithms and exports unchanged. This is therefore the minimum default-debug
repair, not a material observability product decision.

### Frozen source-to-sink trace

```text
storage key / storage failure / rollback descriptor
  -> Legacy cache compatibility and fallback
  -> current raw console arguments

activity collection / name / date / location / health and analysis values
  -> root preprocessing, summary tabs, Advanced Analysis
  -> current interpolated or object console arguments

hostile caught value
  -> cache, weather, and gear failure recovery
  -> current raw console argument

Run Plus diagnostics and NSM summary
  -> render-local model
  -> current DOM property + serialized dataset + window global
```

### Frozen literal cumulative allowlist

The smallest cumulative hard maximum is exactly these thirteen paths:

```text
docs/tasks/pr-30-client-log-redaction.md
js/analysis/analyzers/index.js
js/models/climb.js
js/services/api.js
js/services/activity-cache.js
js/shared/preprocessing/core.js
js/shared/utils/weather-analysis.js
js/tabs/athlete.js
js/tabs/bike-analysis.js
js/tabs/run-analysis.js
js/tabs/run-plus.js
js/tabs/weather.js
tests/privacy/client-logging.test.js
```

The five production paths beyond the historical candidate list are required by direct
production-entry traces above. No schema, dependency, public API, network, storage, algorithm,
weather semantics, map, Service Worker, telemetry, or Diagnostics expansion is authorized. A
fourteenth path requires a new minimum failure/collision package and delegation before modification.

### Frozen output and test decision

Unnecessary dynamic/debug calls are removed. Necessary failure observability uses only exact fixed
one-argument codes; storage and weather recovery behavior does not inspect the caught value for
logging. Fixed UI copy/status is unchanged. Tests will combine a complete static production
inventory with executable cache, weather-render and Run Plus exposure seams. Hostile accessor,
Proxy, revoked and thrown-value canaries must remain absent from console, DOM, globals, storage and
network capture; existing functional access required by serialization/rendering is not broadened.

Implementation is now authorized only within the thirteen-path allowlist.

## A2 findings-first investigation

Inventory the complete production browser graph for:

- `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug`;
- `window` or `globalThis` debug/test exposure reachable in production;
- raw `Error`, message, stack, cause, thrown values, objects, arrays, opaque IDs, query strings,
  names, dates, route/GPS, heart-rate, power, settings, provider/auth and Token values;
- every source-to-runtime-to-console/DOM/window/storage/network sink flow;
- production-reachable, test-only, and closed fixed-safe classifications.

The inventory records only path, line, category, reachability, flow, count, and intended fixed safe
code. Captured values are never printed. Imports, runtime dispatch, actual-served seams, and hostile
input behavior must be traced before the smallest literal implementation allowlist is frozen.

## Default safe client-output contract

Subject to A2 findings:

1. Production client output is absent unless a necessary closed event category and fixed safe code
   is justified. Unnecessary logs are removed.
2. Output never reads, serializes, stringifies, retains, or emits raw Error/message/stack/cause,
   thrown values, objects/arrays, IDs, query strings, names/dates, route/GPS, heart-rate, power,
   settings, provider/auth, Token, or arbitrary user values.
3. Accessors, descriptors, Proxies, revoked inputs, custom inspection, coercion, and hostile thrown
   values fail closed without trap or getter execution.
4. PR-22 Diagnostics remains unchanged and does not ingest console, DOM, window, or arbitrary
   caught values. No logger, Diagnostics sink, telemetry, dependency, public API, or schema is added.
5. Existing fixed page error copy, status, rendering, and behavior remain unchanged. Weather, AI,
   maps, telemetry, and external egress behavior are not changed here.
6. Production-reachable window/global debug exposure is removed or made default-unreachable. Any
   developer-observability product decision is material and delegated before implementation.

## Failure-first verification contract

Before production repair, deterministic synthetic tests must fail for current defects and prove:

- the static production inventory contains no prohibited sink or default-reachable debug exposure;
- each touched entry is covered across success, ordinary failure, and hostile thrown values;
- raw values are neither accessed nor emitted; accessor/Proxy/revoked trap counts remain zero;
- console, DOM, window, sessionStorage, localStorage, and network capture contain no synthetic
  category canary;
- imports and ordinary paths perform no added I/O, storage, telemetry, dependency, or network work;
- existing fixed UI copy/status and all out-of-scope external behavior remain unchanged.

If static and unit seams cannot prove the served graph, use a fresh loopback origin and disposable
profile with deterministic synthetic-only data. Record only console/runtime/network counts, never
payloads. User profiles, logins, Tokens, providers, private fixtures, and production are prohibited.

## Frozen non-goals and prohibited operations

- No public API, Canonical schema, physical database, migration, Repository, Import, analysis
  algorithm, Worker, Service Worker, dependency, deploy/release, route, or default-mode change.
- No server/API, weather-egress/missing-value, AI, map, Legacy-probe, telemetry, or CDN repair.
- No data deletion, clearing, overwrite, migration, downgrade, reverse-copy, provider access,
  private-data access, history rewrite, rebase, amend, force push, merge, cleanup, deployment,
  release, or next-package work.
- R3/R4 feature branches and worktrees remain retained and untouched.

## Verification and completion gates

Required after implementation:

```text
npm ci
focused client logging/privacy tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Then verify a true remote depth-one checkout at the exact branch head, run an independent
findings-first review, repair every finding failure-first, and require a fresh no-findings review.
The final commit changes only this Task Brief to record Closure. Exact Closure-head CI must pass.
After all gates pass, the control tower may update the PR body and move Draft to Ready under the
existing one-time authorization. Merge, cleanup, deploy, release, and R6/R9 remain unauthorized.

## Privacy, migration, and rollback

The intended privacy impact is removal of a production raw-log release blocker. Migration impact is
none: no database, record, cache, setting, backup, provider state, Legacy data, or V2 data is read or
changed. Mechanical rollback is an ordinary code revert, but reintroducing raw logging or global
debug exposure is not an acceptable production rollback; disable the affected client path or retain
the safe redaction instead.

## Stop and delegation conditions

Pause and delegate only for a material observable product decision, a path collision outside the
eventual frozen allowlist, real credentials/account/provider/private data, production/deployment,
external incident action, history rewrite, destructive operation, or GitHub App 403. Otherwise the
task advances automatically through investigation, failure-first repair, verification, review,
Closure, exact-head CI, and Ready handoff.

## Final Review Closure

### Implementation result

- The Task-Brief-only first commit was `33ec06d`; the findings-first scope freeze was `3f48d60`.
- Failure-first focused tests initially failed 3/3 on the eleven production responsibility paths,
  Run Plus diagnostics/NSM debug publication, and seven hostile storage console outputs. Failure
  evidence contained only paths, categories, counts, and fixed assertion codes.
- Implementation commit `3a3bcfc` removed unnecessary console output, stopped caught-value/key/
  object publication, preserved the one existing fixed one-argument cache rollback event, and
  removed diagnostics/NSM DOM and window publication.
- The first independent review found remaining Run Plus Chart.js `window` publication and missing
  runtime verification. New static assertions failed on both direct and computed window exposure.
  Repair commit `64724cd` made five chart holders module-private and added deterministic cache,
  weather, and Run Plus runtime capture across console, DOM, window, storage, and network seams.
- A fresh review found only that the weather success label covered no-data rather than populated
  rendering. Test commit `57ded2a` added deterministic `ok:true` populated output, alongside
  no-data, hostile thrown, and revoked-input paths. The final independent exact-range review returned
  no actionable findings.

The final implementation head before this Closure is
`57ded2af4b4b3ee35e8370d53c6ad600de2da75d`. The exact range from the frozen base changes only the
thirteen-path allowlist. No server/API, external-egress behavior, missing-value behavior, AI, maps,
Service Worker, Legacy probe, telemetry/CDN, public API, schema, migration, Repository, Import,
analysis algorithm, dependency, route, default mode, deployment, release, or user-data contract
changed.

### Verification evidence

Final local evidence at the implementation head:

```text
npm ci                                      PASS (6 packages installed)
focused client logging/privacy              PASS (5/5)
focused Legacy/Repository/consumer           PASS (232/232 before review repair)
focused final Run Plus/Legacy/privacy        PASS (103/103)
npm run check:syntax                         PASS (242 files)
npm run check:privacy                        PASS
npm test                                    PASS (1,527/1,527)
git diff --check                            PASS
worktree status                             CLEAN
```

One earlier full-suite run passed 1,524/1,525 with only the unchanged 200k Stream performance
sample above its latency threshold. The isolated performance test immediately passed at its normal
budget, and the next full run passed 1,525/1,525. After the review repairs, final local and remote
full suites passed 1,527/1,527.

A fresh true remote depth-one clone resolved exactly to the implementation head, had history count
one and clean start/end status, and passed install, focused 5/5, syntax 242, privacy, diff, and full
1,527/1,527. The first sandboxed remote full attempt was blocked only by `listen EPERM` in the
inherited R4 loopback test; the approved ephemeral-loopback rerun passed the full suite. Pull-request
CI run `31240292373` completed successfully on the exact implementation head.

Static inventory, Node runtime seams, existing consumer tests, and the inherited loopback test were
sufficient for the changed sinks. A disposable-browser run was not required and is recorded as
`NOT RUN`; no user profile, login, Token, provider, private fixture, private storage, screenshot, or
production environment was used.

### Review, privacy, migration, and rollback closure

The final independent review confirmed the weather populated/no-data/hostile/revoked paths, zero
console/storage/window output, zero hostile getter/coercion/Proxy/descriptor reads, module-private
Run Plus charts, the single frozen fixed cache event, and no remaining raw output or debug exposure
inside the complete thirteen-path range.

Privacy impact is removal of the R5 production release blocker within this package. Migration and
data impact remain none. Rollback remains code-only; raw logging or global debug publication must
not be restored. R3/R4 branches and worktrees remain retained. This Closure changes only this Task
Brief. Exact Closure-head remote/CI validation and the authorized control-tower Ready transition
remain after this commit; merge, cleanup, deploy, release, and R6/R9 remain unauthorized.
