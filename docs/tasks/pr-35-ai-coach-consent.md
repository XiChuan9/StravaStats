# PR-35: AI Coach External-Egress Consent and Retained-Data Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R7 |
| Status | Approved for findings-first investigation; implementation blocked on material A/B/C decisions |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/ai-coach-consent` |
| Exact base | `integration/v2@9a52e2ecf15dc2f44e9c61a7b8bb691f72cb5704` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required after implementation |
| Dependency | PR #40 Squash Merged; integration push CI run `31256561492`, job `93100678131`, successful |
| Pull request | Expected Draft PR #41; Ready transition authorized only after final Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blocker P0-05. AI Coach must be deny-by-default and make zero external AI request
until the user has received an accurate provider/destination and field-level disclosure and has
given the specifically approved affirmative authorization. Any authorized request must contain
only a frozen, minimized, testable allowlist. Consent must be revocable, in-flight work abortable,
and API-key plus retained-response/history behavior explicit, bounded, removable, and excluded from
unrelated storage, backup, diagnostics, DOM, console, telemetry, Cache Storage, and Service Worker
boundaries.

This task corrects the inherited false claim that AI Coach sends no data to servers. It does not
authorize R8 external maps, R11 telemetry/CDN, P0-08 Service Worker lifecycle/D3, deployment,
release, merge, cleanup, a real provider request, a real credential/account/private-data run, or
the public-history incident disposition recorded by R3.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit are required evidence but do not freeze an undecided consent,
credential, retention, or field-minimization contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `9a52e2ecf15dc2f44e9c61a7b8bb691f72cb5704`.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` matched with divergence `0/0`.
- The exact base is the single-parent squash commit for PR #40, parent
  `166af12a5a42dcef865af09991c4142282e8b265`, with tree
  `235d8b3d8478dc09a2b0de7c88448e987eb1ec00`. Its three-path diff matches the authorized PR #40
  task/test-only change.
- Integration push CI run `31256561492`, job `93100678131`, is recorded successful by the control
  tower. Final remote verification is required again before Closure.
- Untouched local gates passed: `npm ci`; syntax for 245 files; privacy; full tests 1644/1644 with
  the repository's synthetic loopback permission; `git diff --check`; clean status.
- Root and nested `AGENTS.md`, Accepted ADRs, PRD, engineering plan, release gates, test strategy,
  privacy/migration/rollback/backup guidance, historical PR-25 audit, and merged R3-R10 including
  the R6 Task Brief were read from the exact integration tree or retained read-only history.
- No real API key, Token, Authorization value, account, provider response, private activity, GPS,
  route, heart-rate, power, settings value, export, screenshot, private fixture, browser profile,
  Legacy library, or V2 library was read. No real Gemini or other AI-provider request was made.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before A2 findings or any production/test implementation are
committed. A GitHub App 403 during PR creation or update is delegated immediately to the control
tower; it does not authorize Chrome, interactive login, or the user's browser profile.

Until A2 records the complete graph and the control tower returns the user's material decisions,
the cumulative write allowlist is exactly:

```text
docs/tasks/pr-35-ai-coach-consent.md
```

## A2 findings-first investigation contract

Read-only audit must trace every production AI Coach path end to end:

```text
production entry / tab / button
-> Demo/Real and Legacy/Shadow/Canonical mode selection
-> disclosure / consent / credential state
-> activity and user-context selection
-> field validation, minimization, aggregation, rounding and prompt construction
-> provider endpoint, URL, headers and request body
-> response parsing, cancellation, timeout, retry and error handling
-> response/history retention and rendering
-> clear/revoke/export/backup/diagnostics/cache/telemetry boundaries
```

The audit must inventory:

1. every page, route, tab, direct navigation, button, keyboard/programmatic trigger, and eager or
   lazy import that can reach AI code;
2. every prompt/context source, including athlete name, activity name/ID, exact or local date,
   route/GPS, heart rate, power, streams, equipment, PB, goals, training history, settings, file or
   source metadata, and provider-derived values;
3. all missing, `null`, genuine numeric zero, numeric string, non-finite, malformed, accessor,
   Proxy, revoked, sparse, and opaque-string-ID behavior before any side effect;
4. Gemini or other endpoint construction, method, query parameters, headers, API-key placement,
   body shape, model name, timeout, abort, retry, response parsing, and error paths;
5. API-key capture, validation, read, write, overwrite, delete, migration, compatibility, DOM,
   console, diagnostics, backup, telemetry, Cache Storage, and Service Worker exposure;
6. prompt/response/history capture, storage key, format, retention limit, TTL, ordering, rendering,
   export, backup inclusion/exclusion, clear semantics, and existing-user compatibility;
7. Demo isolation and Real Legacy/Shadow/Canonical behavior, including offline, cancel, revoke,
   timeout, retry, malformed response, navigation, refresh, and concurrent requests;
8. all existing tests and browser harnesses that freeze the false disclosure, consent-free request,
   durable credential/history, unsafe request fields, or another release-blocking outcome.

Evidence is limited to deterministic synthetic canaries, loopback endpoints, request interception,
static source inspection, and disposable served-browser state. It must never print a request body,
credential, private activity value, exact route/location, health/power value, or user setting.

## Material decision gate

Before any production or test implementation, A2 must send the control tower one minimum A/B/C
decision package that freezes all of the following together:

- deny-by-default, who may authorize, the exact affirmative gesture, and consent granularity:
  one request, one labeled data selection, current tab/session, or durable;
- consent expiry and revocation, including what happens to queued/in-flight requests and already
  transmitted data;
- exact outbound field allowlist plus aggregation, rounding, de-identification, bounds, ordering,
  and missing/`null`/real-zero handling;
- explicit treatment of dates, heart-rate aggregates, gear, PBs, goals, and training-history
  windows; names, IDs, filenames, route/GPS, Tokens, raw heart-rate/power/streams are denied unless
  the user explicitly broadens the decision;
- API-key storage boundary: memory, session, or existing durable behavior; exact compatibility,
  migration, overwrite, and deletion semantics for an existing durable key;
- AI response/history retention: whether stored, location, maximum entries/bytes, TTL, ordering,
  user-clear semantics, and treatment of existing durable history without destructive migration;
- Demo's unconditional zero consent/key/provider/history I/O;
- exact UI copy naming provider, endpoint/destination, purpose and each outbound field class, plus
  request preview/confirmation, offline/failure/timeout/cancel/revoke copy;
- timeout (target four seconds unless evidence supports another bounded value), abort registration,
  no hidden retry, and Cache Storage/Service Worker zero boundary;
- public API, schema, dependency, Worker, Service Worker, Repository, Storage, Backup, Diagnostics,
  analysis, default-mode, and route boundaries;
- the exact cumulative literal implementation allowlist, focused/browser verification, privacy,
  migration, rollback, and existing-user impact.

The control tower must obtain and return the user's explicit selection. No consent scope, field,
precision, key persistence, history retention, migration, UI copy, or path allowlist is inferred.
If an exact allowlist or material choice conflicts with current code, implementation stops and the
minimum collision package is delegated.

## Non-negotiable safety contract

All options must satisfy:

- absent, expired, malformed, revoked, or unproved consent means zero request;
- disclosure and preview occur before authorization and before any provider request construction
  that would read protected data;
- opaque identifiers remain exact strings and are never parsed, sorted numerically, normalized,
  hashed into correlation identifiers, or sent;
- absent and `null` remain distinct from genuine numeric zero; unsafe values fail closed without
  executing accessors or Proxy traps;
- Demo performs zero Real consent, credential, storage, provider, network, history, Cache Storage,
  Service Worker, telemetry, diagnostics, or backup I/O;
- no Authorization, Strava Token, provider payload, route/GPS, filename, raw stream, raw heart rate,
  raw power, credential, or private setting enters an outbound AI request, DOM, console, error,
  Diagnostics, Backup, telemetry, or cache unless explicitly selected in the returned user
  decision;
- a revoked/cancelled request aborts registered in-flight work and blocks future work; there is no
  hidden automatic retry;
- no existing durable key or history is automatically deleted, overwritten, rewritten, migrated,
  or copied without explicit authorization.

## Failure-first implementation contract

After the material selection and literal allowlist are frozen in a Task-Brief-only commit, add
deterministic tests that fail first and then prove:

- default and existing-user states make zero AI-provider request; request count remains zero before
  the exact affirmative authorization;
- disclosure, preview, provider/destination, and field list exactly match the selected contract;
- intercepted request URL, headers, and body contain exactly the selected literal allowlist and no
  synthetic prohibited canary;
- revoke, abort, offline, HTTP error, timeout, malformed response, invalid/null/zero/opaque-string
  input, navigation, refresh, and concurrency follow the frozen state machine;
- Demo performs zero consent/key/provider/history/storage I/O;
- API key and AI history never enter Diagnostics, Backup, console, DOM attributes/text, errors,
  Service Worker, Cache Storage, telemetry, or unrelated storage;
- Authorization, Strava Token, provider/private payload, filename, route/GPS, raw heart-rate/power,
  streams, opaque IDs, and unapproved settings produce zero outbound or retained spill;
- Legacy, Shadow, and Canonical keep their existing data-source and non-destructive rollback
  behavior.

Actual-served verification must use a fresh disposable profile/origin with interception installed
before navigation. No real AI endpoint may be reached. Evidence records only request counts,
approved field names/categories, fixed states, and safe codes.

## Required verification and Closure

After implementation:

```text
npm ci
focused AI consent/privacy/consumer tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Also run the literal-path and prohibited-boundary audits plus the actual-served disposable-browser
matrix. Independent review is findings-first; every actionable finding receives a focused failing
regression and minimum repair. A different fresh re-review must return no findings. Closure is a
Task-Brief-only commit recording exact local/browser/privacy/path/depth-1/CI evidence, findings and
repairs, migration/rollback impact, and Not-run items.

The actual remote branch must pass a true depth-one exact-head verification and GitHub Actions on
the exact Closure SHA before the control tower updates the PR body and moves Draft to Ready under
the standing authorization. Ready is not merge. Squash Merge requires a separate user decision.

## Privacy, migration, and rollback boundary

No data migration or destructive compatibility action is authorized before the material decision.
Legacy/V2 data, provider state, settings, keys, history, backup, Cache Storage, and Service Worker
state must not be deleted, cleared, overwritten, repaired, downgraded, reverse-copied, or silently
migrated. The default rollback is to disable the AI path or revert code while retaining all local
libraries and user-owned state. Reintroducing false disclosure or consent-free egress is not an
acceptable production rollback.

## Pause and delegation boundary

Pause and delegate the minimum evidence package to the control tower if completion requires:

- any material consent, field, credential, retention, migration, deletion, API/schema/dependency,
  Repository/Storage/Backup/Diagnostics/Worker/Service Worker/default-mode decision;
- a path outside the eventual frozen literal allowlist;
- real credentials, account/provider/private data, a real AI request, or user browser profile;
- destructive Git/data/cache action, history rewrite, deployment, release, or GitHub App
  authorization bypass.

Do not merge, auto-merge, deploy, release, clean this or retained R3/R4/R5/R6/R9/R10 branches or
worktrees, start R8/R11/D3, or modify `main`, `maintenance/v1`, or `integration/v2`.
