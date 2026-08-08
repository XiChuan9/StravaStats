# PR-31: Service Worker Private-Request and Cache Storage Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R9 |
| Status | A1 Task-Brief-only publication; A2 findings-first audit pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/service-worker-cache-boundary` |
| Exact base | `integration/v2@fe32274dabd7f41adcb255572b5a4a6460f492a4` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependency | R5 PR #36 Squash Merged; integration push CI recorded successful by the control tower |
| Pull request | Draft PR #37 expected; Ready transition authorized only after final Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blocker P0-07 by making the production Service Worker fail closed for private,
dynamic, credential-bearing, query-bearing, provider/auth/API, and other non-static requests. Only
an explicitly approved literal same-origin static-shell allowlist may be matched, written to, or
served from Cache Storage. Preserve the allowed offline shell without changing application data,
Repository, Import, Storage, Backup, Diagnostics, analysis, default mode, or provider behavior.

This task does not authorize P0-08 lifecycle work. `skipWaiting`, `clients.claim`, activate-time
cache deletion/eviction, mixed-version behavior, production rollout, deployment, and rollback-worker
strategy remain the separate D3 responsibility surface. R6 weather, R7 AI, R8 maps, R10 Legacy
probe, and R11 telemetry/CDN also remain independent.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit are required evidence but do not freeze an undecided contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `fe32274dabd7f41adcb255572b5a4a6460f492a4`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` matched with divergence `0/0`.
- The control tower supplied integration push CI run `31241351233`, job `93062757174`, as
  successful. Independent API retrieval is currently blocked by invalid local GitHub CLI
  authentication and must be delegated rather than bypassed with an interactive login.
- Untouched local gates passed: `npm ci`; syntax for 242 files; privacy; full tests 1527/1527;
  `git diff --check`; final clean status and `0/0` divergence.
- No real Token, Authorization value, provider response, identity, activity, route, GPS,
  heart-rate, power, settings, export, screenshot, private fixture, browser profile, Legacy
  library, V2 library, or Cache Storage content was read.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before production or test implementation is committed. GitHub
authorization failure is delegated to the control tower and does not authorize Chrome, interactive
login, or the user's browser profile.

Until A2 records the exact request/response/cache call graph and the owner approves the minimum
decision package, the cumulative write allowlist is exactly:

```text
docs/tasks/pr-31-service-worker-cache-boundary.md
```

## A2 findings-first investigation contract

Read-only audit must freeze:

1. install, fetch, activate, Cache Storage, and registration call graphs;
2. every production API, auth, provider, same-origin dynamic, navigation, module, style, image,
   manifest, CDN, weather, AI, map, telemetry, and query route class;
3. request URL/origin, method, mode, destination, credentials, headers, Range, and query handling;
4. response status, type, redirect, content type, and Cache-Control handling;
5. every `match`, `put`, `addAll`, and fallback path, including rejection behavior;
6. the smallest exact static-shell path/extension allowlist and failure-first synthetic matrix.

The audit records only paths, categories, counts, closed safe codes, and fixed synthetic canaries.
It never records a credential, identity, provider/private payload, activity, route/GPS,
heart-rate, power, private setting, or raw Cache Storage value.

## Default recommendation pending owner approval

Prefer a literal same-origin static-shell allowlist. All other requests are network-only and never
call Cache Storage. Eligibility must be based on a complete request and response contract, not URL
name heuristics. A request that cannot be safely inspected fails closed. A response that does not
meet the exact status/type/content/cache-control contract is returned without Cache Storage write.

The implementation allowlist, exact cacheable paths/extensions, and treatment of query,
credentials, Range, navigation, modules, images, CDN, and historical private cache entries remain
unapproved until the A2 decision package is returned. No delete, eviction, activate change,
lifecycle change, storage cleanup, schema cleanup, or deployment strategy may be inferred.

## Failure-first verification contract

Before production repair, deterministic synthetic tests must fail for the exact current defects and
then prove:

- Token/Authorization, query, private-response, opaque-ID, API/auth/provider, weather, AI, map, and
  telemetry categories never reach `cache.match`, `cache.put`, or `cache.addAll`;
- GET and non-GET, navigation/static module/style/image, Range, error, redirect, opaque, and
  Cache-Control `no-store`/`private` cases obey the frozen contract;
- hostile Request/Response/accessor/Proxy inputs fail closed without getter/trap execution or raw
  disclosure;
- `cache.match`, `cache.put`, `cache.addAll`, clone, and fetch failures have deterministic safe
  behavior; and
- approved static assets remain available through the intended offline fallback.

If Node seams cannot prove the served worker boundary, use only a fresh disposable browser profile
and fresh loopback origin with deterministic synthetic data. Record Cache Storage names, entry
counts, and categories only. Never use a user profile, login, Token, provider, private fixture, or
production origin.

## Prohibited scope and stop conditions

- No modification of `main`, `maintenance/v1`, or `integration/v2`.
- No Service Worker lifecycle, cache deletion/eviction, schema/data cleanup, deploy, release,
  production rollout, mixed-version, or rollback-worker implementation.
- No Repository, Import, Storage, Backup, Diagnostics, Worker, analysis, dependency, route,
  feature-default, Legacy/V2 data, provider/auth behavior, weather, AI, map, telemetry, or CDN
  change.
- No real credentials, accounts, provider/private data, private browser state, destructive cache or
  storage operation, history rewrite, rebase, amend, force push, merge, cleanup, deploy, release,
  or next-package work.

Pause and delegate for any path expansion, material cache/product architecture decision, existing
private-cache deletion or eviction, lifecycle/deployment work, private evidence, destructive
operation, or GitHub authorization failure. Otherwise continue automatically through the approved
failure-first implementation, verification, independent review, Task-Brief-only Closure,
exact-head CI, and authorized Draft-to-Ready handoff. Squash Merge always requires separate user
authorization.

## Privacy, migration, and rollback

The intended privacy impact is to prevent private or dynamic responses from entering or being
replayed from Cache Storage. Migration impact is none: no database, schema, record, setting,
provider state, backup, Legacy library, or V2 library is read or changed. Historical Cache Storage
cleanup and production rollback are explicitly not authorized here. Mechanical code rollback is an
ordinary revert, but restoring broad private-response caching is not an acceptable production
state; emergency operational rollback requires the separately approved lifecycle/deployment
runbook.
