# PR-30: Client Raw-Log Redaction

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening R5 |
| Status | A1 scope frozen; A2 findings-first investigation pending |
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
