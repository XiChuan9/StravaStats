# PR-29: Server/API Log Redaction

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R4 |
| Status | Investigation authorized; implementation pending A2 scope freeze |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/server-log-redaction` |
| Exact base | `integration/v2@35cef332b1e9214e32040baeff67dc2c3e35a0ed` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/d176/StravaStats` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependencies | R3 PR #34 Squash Merged; exact-base integration push CI successful |
| Pull request | Draft required; Ready transition and merge are not authorized |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Remove production-reachable raw logging and disclosure from the serverless/API responsibility
surface. Server/API output must retain only closed fixed event categories, safe fixed codes, and
strictly necessary coarse status classes or non-identifying counts. Existing endpoint, HTTP status,
and safe response-body behavior must remain unchanged except where failure-first evidence proves
that a current body itself discloses provider details and the smallest response contraction is
required.

This task does not begin client logging, weather, AI, map, Service Worker, Legacy probe,
telemetry/CDN, deployment, release, or another release-hardening package.

## Why now

The release-readiness audit classified inherited production server/API raw logging as a release
blocker. PR-22 established privacy-safe local diagnostics but explicitly did not remediate untouched
inherited production log sinks. R1 through R3 are now Squash Merged into the exact base, so this
server/API package can be repaired independently without changing client, storage, migration, or
analysis contracts.

## A0 exact-base evidence

- The assigned isolated worktree began detached and clean at exact SHA
  `35cef332b1e9214e32040baeff67dc2c3e35a0ed`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` were identical with divergence `0/0`.
- GitHub Actions integration push run `31236602647`, job `93050094617`, completed successfully on
  the exact base, including install, syntax, privacy, and full tests.
- Untouched local gates passed: `npm ci`; syntax for 240 files; privacy; full tests 1482/1482; and
  `git diff --check`.
- The historical release-readiness Task Brief was read from the retained
  `codex/v2/release-readiness` branch because it is not present in the integration tree.
- Current integration Task Brief numbering ends at PR-28. The historical audit proposed PR-29 for
  this server/API package, and no local or fetched branch named
  `codex/v2/server-log-redaction` existed before branch creation.
- No real Token, Authorization value, provider response, account, identity, activity, route, GPS,
  heart-rate, power, export, screenshot, private fixture, Legacy library, or V2 library was read.

## Authority and inherited frozen contracts

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical audit are required evidence, but do not independently freeze an undecided contract.

R4 preserves these inherited boundaries:

- Legacy remains the default and recoverable path. Legacy and V2 data, provider connection, Tokens,
  local settings, backups, and caches are not logging-cleanup targets.
- Physical V4, schema, stores, indexes, migrations, Repository and Import public APIs, Canonical
  contracts, backup/restore, analysis algorithms, Worker protocol, and Service Worker behavior are
  frozen.
- Activity, athlete, provider, and external IDs are private opaque strings. They are never logged,
  parsed, normalized, truncated, hashed into correlation values, or included in evidence.
- PR-22 diagnostics remains a separate closed safe-code boundary. It does not ingest console or
  arbitrary caught values and is not broadened by this task.
- Existing client-facing safe error contracts are not expanded. Endpoint paths, methods, status
  codes, headers, and safe body semantics remain unchanged unless a current response-body leak is
  proved failure-first and repaired minimally within the frozen R4 responsibility surface.
- No new logger, dependency, public endpoint, telemetry, remote diagnostics, schema, migration,
  feature flag, provider lifecycle, deployment, or release behavior is authorized.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It is pushed and used to open a Draft
PR targeting `integration/v2` before A2 findings or implementation are committed. A GitHub App 403
is delegated immediately to the control tower; it does not authorize Chrome, interactive login, or
the user's browser profile.

The cumulative A0-A2 write allowlist is exactly:

```text
docs/tasks/pr-29-server-log-redaction.md
```

A2 is findings-first and read-only. Production and test changes begin only after this document
records the exact-base inventory, source-to-sink trace, smallest literal cumulative implementation
allowlist, failure-first test matrix, and any material collision decision.

## A2 investigation contract

Inspect the complete current-tree server/API responsibility surface:

1. serverless/API handlers, token refresh, provider proxies, shared server utilities, error
   middleware, and development server paths;
2. every `console` or logger call, classified as production reachable, test-only, or closed fixed
   telemetry;
3. each source-to-runtime-to-log-sink flow involving request or response bodies, headers,
   credentials, provider payloads, raw errors, messages, stacks, causes, IDs, queries, routes,
   activity/identity data, or health values;
4. each server/API response path that may expose raw provider details to the browser;
5. imports, runtime dispatch, test seams, and actual-served behavior needed to exercise every
   production sink without network access or real credentials;
6. the smallest collision-free literal path allowlist and failure-first matrix.

Findings report only category, path, line, reachability, flow, count, safe fixed code, and when
useful a non-reversible digest or existence fact. Findings, tests, commits, PR prose, command output,
and CI evidence never repeat a real or suspected credential, identity, provider payload, route,
path, GPS, heart-rate, or power value.

## Default product contract pending A2 freeze

Subject to exact-base A2 findings:

1. Outside the frozen PR-22 diagnostics contract, production server/API output permits only closed
   fixed event categories, fixed safe codes, coarse status classes, and necessary bounded
   non-identifying counts.
2. Output must not read, serialize, stringify, retain, or emit raw `Error`, message, stack, cause,
   thrown value, request/response body, Authorization or Token data, provider payload/details,
   identity/activity/route/health values, opaque IDs, query strings, or arbitrary user values.
3. Hostile thrown values, accessors, throwing descriptors, and Proxies fail closed. Logging and
   response handling do not execute traps or getters and do not interpolate the value.
4. Success, ordinary failure, token-refresh failure, and provider failure retain sufficient closed
   fixed categorization for operations without exposing underlying data.
5. Existing endpoint, status, and safe body semantics remain unchanged. Removal of a currently
   exposed provider-details field is authorized only where A2 and failure-first evidence prove the
   disclosure identified by the audit. Any broader public API behavior decision is material and is
   delegated before implementation.
6. R5 client logging, R6 weather, R7 AI, R8 map, R9 Service Worker, R10 Legacy probe, and R11
   telemetry/CDN remain separate packages and are prohibited here.

## Failure-first test contract

Before production repair, add deterministic synthetic tests that fail for the exact current-tree
defects and prove:

- every production-reachable server/API log sink is covered across success, ordinary failure,
  token-refresh failure, provider error, and hostile thrown-value behavior where applicable;
- emitted arguments have only an exact closed literal shape and approved primitive values;
- raw error/message/stack/cause, bodies, headers, credential categories, provider payloads,
  identity/activity/route/health categories, IDs, queries, and arbitrary user values cannot reach
  logs or client responses;
- provider details are absent from affected browser responses without changing the endpoint or
  status contract;
- accessor, throwing descriptor, and Proxy trap invocation counts remain zero;
- imports and ordinary success paths perform no added I/O, dependency, storage, telemetry, or
  network work.

Tests use only inline deterministic synthetic category markers. They must not contain or print a
real or suspected credential, identity, provider response, private activity, path, coordinate,
heart-rate, or power value. Failure output uses only safe assertion labels, paths, categories,
counts, and fixed codes.

## A2 findings and implementation authorization

### Findings-first inventory

The exact-base audit found nine explicit production-reachable `console.error` sinks across the
deployed API graph. None uses a closed safe contract:

| Category | Current-tree owners | Reachability and flow | Minimum disposition |
| --- | --- | --- | --- |
| Token-refresh response logging | `api/_shared.js` | Provider failure body is read and passed to the console before a fixed throw | Do not read the failure body; emit one closed fixed event |
| Token-exchange logging and response | `api/strava-auth.js` | Raw thrown cause/message or provider object reaches the console and browser failure body | Emit closed events and fixed failure bodies without inspecting thrown values |
| Activities provider/catch logging | `api/strava-activities.js` | Provider failure message is embedded in an Error; the raw Error and message reach console/browser | Preserve status behavior with fixed event and fixed failure body |
| Detail/metadata provider responses | `api/strava-activity.js`, `api/strava-athlete.js`, `api/strava-gear.js`, `api/strava-streams.js`, `api/strava-zones.js` | Provider details/messages or caught messages reach browser responses; caught messages reach console | Remove provider details and use fixed events/bodies while preserving statuses |

`api/config.js` has no log sink and requires no change. There is no logger abstraction or existing
server/API logging test. Existing tests do not invoke the API handlers as a closed logging contract.
Tool-only syntax/privacy output and browser/client console paths are outside this package.

The direct development adapter in `scripts/local-dev-server.mjs` imports and dispatches the same
`api/*.js` handlers. Its handler boundary logs a request-derived route plus the raw caught value and
returns a raw caught message. URL/route decoding and the async server callback also lack a closed
outer error boundary. This is the same server/API responsibility surface required by the A2
contract, not R5 client logging. The historical candidate list omitted this path, so the exact
runtime trace is the minimum failure evidence authorizing its inclusion. Its fixed local-ready
notice is development-only coarse telemetry and is not a disclosure finding.

### Source-to-sink trace

```text
Authorization header
  -> shared decode / token validation / optional refresh
  -> provider request
  -> fixed handler success response
  -> current provider/raw failure log and response sinks

Authorization-code request body
  -> token exchange provider request
  -> current raw cause/provider-object log and response sinks

Opaque query values
  -> provider request URL
  -> current provider failure details/message response sinks

Local development HTTP request
  -> URL/body parsing and dynamic API dispatch
  -> the same handler graph
  -> current raw route/error console and response sink
```

Success provider payloads and refreshed tokens are existing endpoint semantics and are not removed
or broadened by R4. Failure sinks never need their values. The repair therefore changes only
failure observability and proven failure-body disclosures.

### Frozen literal allowlist

The minimum cumulative hard maximum is exactly these eleven paths:

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
scripts/local-dev-server.mjs
tests/privacy/server-api-logging.test.js
```

The shared API utility owns the internal literal event allowlist. No logger dependency or public
client API is introduced. The single test path owns unit handler capture, hostile-value proofs,
static boundary guards, and isolated loopback actual-served synthetic HTTP evidence. A twelfth path
requires a new minimum failure/collision package and delegation before modification.

### Frozen safe output contract

- The server event vocabulary is a literal closed set with one fixed console string per failure
  category. Calls accept no raw value, ID, route, status, body, count, or arbitrary context.
- Provider non-success status codes stay unchanged. Their bodies retain only the endpoint's fixed
  error category and never include `details` or a provider-derived message.
- Handler-caught 500 and token-network 502 bodies use fixed existing-category copy and never inspect
  the thrown value. Auth provider rejection remains 400 with fixed auth-failure copy.
- Successful payloads, refreshed-token envelopes, methods, endpoint paths, query requirements, and
  request/provider behavior remain unchanged.
- Local development handler failures emit one fixed event and fixed 500 body. Route/body parsing,
  dynamic import, handler execution, and response serialization are contained by the same safe
  boundary. The fixed ready notice remains development-only coarse telemetry.
- No accessor, descriptor, Proxy trap, custom inspection hook, coercion, or stringification is
  performed on a caught value for logging or response construction.

### Implementation authorization

The delegated R4 contract authorizes implementation after this exact findings-first freeze. The
development runtime path expansion is supported by the direct same-handler raw-sink evidence above
and does not change schema, dependencies, client behavior, Service Worker, provider lifecycle,
migration, data, rollback, deployment, or release scope. Implementation may proceed only within
the eleven-path allowlist.

## Prohibited scope and operations

- No modification of `main`, `maintenance/v1`, or `integration/v2`.
- No schema, database version, migration, Repository/Import public API, analysis algorithm,
  dependency, Worker, Service Worker, auth/provider lifecycle, deploy, release, route, default mode,
  or product UI change.
- No real credential/account/provider request, private fixture, user browser profile, local library,
  export, screenshot, telemetry inspection, or production evidence.
- No delete, clear, overwrite, downgrade, reverse-copy, history rewrite, rebase, amend, force push,
  branch/worktree cleanup, deployment, release, Ready transition, merge, or R5 work.
- The retained R3 feature branch and worktree are not cleanup targets.

## Verification gates

After the failure-first repair:

```text
npm ci
focused server/API logging tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

If unit seams do not prove the actual served handler runtime, run an isolated actual-served
synthetic HTTP procedure on loopback with no provider network or credentials. Record any unrun
served/browser evidence as `NOT RUN`.

After implementation and Closure heads are pushed, create a true remote depth-one checkout of the
actual branch, require exact SHA, history count one, clean status, install, focused/full tests,
syntax, privacy, and diff checks. Confirm GitHub Actions succeeds on the exact Closure head.

Independent review is findings-first. Each finding receives a minimal failure-first repair. A fresh
review must return no findings across the complete cumulative implementation surface before the
final Task-Brief-only Closure commit.

## Privacy and security impact

The intended change removes a production privacy release blocker while preserving closed safe
operational categorization. Passing privacy and runtime tests does not authorize external incident
handling, credential action, or public-history remediation. If any real exposure is discovered,
push, merge, release, and deploy stop and the matter is delegated without copying the value.

## Migration impact

None. No database, schema, record, cache, setting, provider state, backup, Legacy library, or V2
library is read, rewritten, migrated, cleared, deleted, downgraded, or reverse-copied.

## Rollback procedure

The mechanical rollback is an ordinary code revert and never a data operation. Reintroducing raw
server/API logging is not an acceptable production rollback; a safe rollback retains redaction or
disables the affected server/API path. Feature flags, databases, created user data, Cache Storage,
Service Worker, and data recovery are not applicable to this change.

## Stop and delegation conditions

Pause and return a minimal decision package only for:

- a material endpoint/status/body, product/API/schema/dependency/algorithm/Service Worker change;
- a required path outside the frozen implementation allowlist;
- real credential/account/provider/private-data access, external notification, incident handling,
  deployment, release, or history rewriting;
- a destructive Git/data operation; or
- GitHub App 403 during PR creation or update.

The task otherwise advances automatically through investigation, repair, verification, two-stage
independent review, Closure, and exact-head CI. It stops finally at a Ready-for-review handoff while
the PR remains Draft. Ready transition, merge, cleanup, deploy, release, and R5 require explicit
control-tower or user authorization.
