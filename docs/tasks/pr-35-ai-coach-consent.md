# PR-35: AI Coach External-Egress Consent and Retained-Data Boundary

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R7 |
| Status | Option A explicitly approved and frozen; authorized for failure-first implementation |
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

## A2 findings-first results

### Production entry and authorization graph

The root document eagerly imports `js/app/main.js`, the tab barrel, and `js/tabs/ai-chat.js`, but
the AI module performs no import-time I/O. The first AI render has three reachable triggers:

```text
AI Coach tab click
  -> generic WIP confirm
  -> activateTab
  -> renderAIChatTab(allActivities)

direct /ai-coach initial route
  -> activateTab without WIP confirm
  -> renderAIChatTab(allActivities)

popstate to /ai-coach
  -> activateTab without WIP confirm
  -> renderAIChatTab(allActivities)
```

The generic WIP confirm mentions only unstable responses/features. It does not name Google,
Gemini, the API endpoint, credential placement, outbound fields, prompt/history, purpose,
retention, cancellation, or revocation. It is not informed authorization. Direct and popstate
routes bypass even that prompt.

Real Legacy, Shadow, and Canonical sessions pass the same projected `allActivities` collection.
Demo passes deterministic Demo activities but does not inject its frozen session mode into the AI
renderer. The renderer immediately reads the two Real durable AI keys in every mode. Consequently,
a same-tab Demo session can restore Real AI history and can use an existing Real API key to send
Demo context. This violates the required Demo zero-consent/key/provider/history-I/O boundary.

### Current outbound field and transformation inventory

`buildStravaContext` constructs one large free-form system instruction from the complete summary
collection. Current outbound activity-derived categories are:

| Context section | Source fields and transformations | Privacy/correctness result |
| --- | --- | --- |
| Overall | collection length; sums of `distance`, `moving_time`, `total_elevation_gain`; first/last `start_date_local` calendar date | all-time training history and exact date range sent |
| By sport | free-form `type`; count; distance/time/elevation sums; mean `average_heartrate` | HR aggregate and unbounded source-controlled sport label sent |
| Run PBs | distance, average speed/pace, exact local date for fastest 5K/10K and longest run | PB performance plus exact dates sent |
| Ride PBs | longest/fastest distance or speed plus exact local date | PB performance plus exact dates sent |
| Gear | `gear_id` groups locally; free-form `gear_name`, distance and count sent | gear ID is not serialized, but private gear name and history are sent |
| Recent 30 | exact local date, free-form activity `name` and `type`, distance, moving time, pace/speed, average HR, elevation | activity names, dates, HR and detailed recent history sent |
| Last 12 months | exact `YYYY-MM`, distance, time and activity count | month-level training history sent |
| Conversation | every in-memory role/text pair, including the latest user prompt and prior model replies | full restored history can be resent without a field preview |

The renderer does not currently receive the athlete profile and therefore does not directly send
an athlete display name. It also does not serialize activity IDs, gear IDs, filenames, provider
Tokens, routes/GPS, raw streams, raw HR, or power. Free-form activity/gear/type text is neither
bounded nor neutralized before becoming a system instruction, so it is also a prompt-injection
surface.

Missing-value handling is unsafe. `(value || 0)`, truthy filters, numeric arithmetic, implicit
coercion, `Date`, `substring`, `sort`, and plain `{}` maps conflate absent, `null`, invalid,
numeric-string and genuine zero cases or throw after accessing hostile values. Accessors and
Proxies are not rejected before context reads. Current-month selection depends on the ambient
clock. There is no deterministic, descriptor-safe field boundary.

### Provider request, response, timeout, and error graph

Every send or suggestion with a stored key performs one browser-side request:

```text
POST https://generativelanguage.googleapis.com/
     v1beta/models/gemini-3-flash-preview:generateContent?key=<API key>
headers: Content-Type: application/json
body:
  system_instruction.parts[0].text = complete generated context
  contents[] = complete current conversation role/text
  generationConfig = { temperature: 0.7, maxOutputTokens: 1024 }
```

The UI says `Gemini 2.0 Flash` while the endpoint names `gemini-3-flash-preview`. The credential is
placed in the URL query. Current Google API documentation instead defines `x-goog-api-key` as the
authentication header for Gemini requests. R7 can remove the query credential while retaining the
existing endpoint/model as an explicitly disclosed, unverified compatibility choice; changing to
a different model is a separate product/provider decision.

There is no `AbortSignal`, timeout, cancellation action, response-size bound, or retry. There is
also no hidden automatic retry: one user send produces at most one `fetch`. HTTP failures parse a
raw provider JSON error message and display it in the visible chat; malformed success bodies become
`(no response)`. Network and storage exceptions display their raw `.message`. Response shape,
text length, roles, history entries, and stored data are not descriptor-safe or bounded before
render or retention.

R9 correctly makes this cross-origin AI request network-only: it does not enter Service Worker
`respondWith` or Cache Storage. The AI implementation itself has no telemetry or Diagnostics call,
but the inherited root still loads GTM/Analytics and Vercel telemetry; route-level telemetry remains
R11 and is not closed by R7.

### Credential, retained history, render, and deletion graph

- `gemini_api_key` is an unversioned durable localStorage string with no expiry, bound, consent
  record, or storage-failure handling. Save overwrites an existing value; Change removes it and
  immediately rerenders. The value is masked in the input and is not intentionally rendered.
- `ai_chat_history` is an unversioned durable JSON array. It is read and rendered immediately in
  Real and Demo. Malformed JSON can abort render. Existing arrays have no entry or byte bound before
  they are rendered and resent. After a successful response only, the stored array is truncated to
  the last 40 messages, but there is no text-size limit or TTL.
- Clear removes all durable history. Key change and history clear are separate explicit actions,
  but there is no preview, confirmation, expiry, migration/versioning, or combined revoke.
- A failed send appends the user message only in memory. A successful send appends both sides and
  then writes history; localStorage quota/write failure is caught as a raw visible error.
- Message text is entity-escaped before limited bold/italic rendering. Stored `role` is interpolated
  into an `innerHTML` class without validation, so a modified/malformed durable record can create an
  HTML injection surface. Serialized history is not placed in a hidden DOM attribute, but visible
  restored messages are rendered and provider error text is echoed.

Both V2 Backup and Legacy Rescue use literal setting allowlists that exclude the two AI keys; the
existing Legacy test explicitly proves their absence. Diagnostics reads only its own bounded
session key and never enumerates these localStorage records. Those exclusions are already correct
and must remain frozen.

### Documentation and exact implementation collision

`docs/guides/privacy-guide.md`, `docs/guides/known-limitations.md`, `TECHNICAL_GUIDE.md`, and
`PWA_GUIA.md` describe the inherited durable key/history or still call general external-AI consent
future work. They would become inaccurate after any selected R7 behavior. This direct accuracy
collision expands the historical five-path candidate; it does not authorize a broader release-doc
rewrite.

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

## A/B/C decision package

All options keep the exact current `v1beta/models/gemini-3-flash-preview:generateContent` endpoint
for R7 scope control, correct the UI to that exact model identifier, move the key from query text to
the `x-goog-api-key` header, set `store: false`, keep fixed generation configuration, use a four-
second abortable timeout, and perform no retry. No option claims that `store: false` overrides the
provider's legal or operational retention policy. A real provider call remains Not run.

### Option A — one-request consent, memory-only, minimum aggregates (recommended)

- Authorization: every request shows a local preview and requires the exact positive action
  `Send this request to Google Gemini`. Leaving, cancelling, or closing the preview sends nothing.
  No consent record is stored.
- Exact disclosure copy: “AI Coach uses the Google Gemini API. If you choose ‘Send this request to
  Google Gemini’, StravaStats sends your question and the approximate 28-day training aggregates
  shown below to `generativelanguage.googleapis.com`. It does not send activity or athlete names,
  IDs, dates, gear, personal bests, routes, tokens, heart rate, power, or raw activity/stream data.
  Your API key is sent only in the request header. This permission applies once and can be cancelled
  before or during the request.”
- Outbound data: fixed system instruction; current user question (maximum 4,000 code units); and
  two relative buckets, `recent_28_days` and `previous_28_days`. Each bucket contains only closed
  normalized sport category, activity count, and distance/moving-time/elevation aggregate objects
  with valid-sample count. Rounding is 1 km, 15 minutes, and 100 m. Genuine finite zero survives;
  no-valid-sample is `null`, never manufactured zero. No chat transcript is resent.
- Key: memory only for the current document. Existing `gemini_api_key` and `ai_chat_history` are
  not read automatically, migrated, overwritten, or deleted. A separate
  `Review previously saved AI data` action may read only those exact keys and offer three explicit
  actions: copy the old key into memory for this document, delete the old key, or delete old
  history. Copy does not delete; deletion never follows automatically.
- Response/history: visible document-memory conversation only, maximum 12 messages and 64 KiB total;
  response text maximum 16,384 code units. Reload, Clear, or Revoke discards it. Previous messages
  are not outbound context. No localStorage/sessionStorage/IndexedDB/cookie write.
- Tradeoff: strongest minimization and easiest rollback, but each question is independent and
  requires confirmation.

### Option B — tab consent, session storage, 12-week HR-aware aggregates

- Authorization: exact positive action `Allow AI Coach for this tab`; every later send still shows
  the field/value preview, but does not repeat the full consent modal. Revocation records denied in
  sessionStorage, aborts in-flight work, removes only the new AI session keys, and blocks later send.
- Exact disclosure copy: “AI Coach uses the Google Gemini API. If you choose ‘Allow AI Coach for
  this tab’, StravaStats may send your question, up to six earlier messages from this tab, and the
  12-week sport, distance, duration, elevation, and average-heart-rate aggregates shown in each
  request preview to `generativelanguage.googleapis.com`. It does not send names, IDs, calendar
  dates, gear, personal bests, routes, tokens, power, or raw activity/stream data. The API key,
  consent, and conversation are kept only in this browser tab and can be revoked here.”
- Outbound data: user question; up to six previous session turns, maximum 16 KiB combined; twelve
  relative `weekAgo` buckets; closed sport category; activity count; distance rounded to 0.1 km;
  moving time to 5 minutes; elevation to 10 m; and average HR to 1 bpm only when at least three
  valid HR-bearing activities exist, with sample count. No exact/month date, gear, PB, name, ID,
  route, raw HR/power/stream, file or source field.
- Key/consent/history: strict new versioned sessionStorage records, current tab only, maximum 20
  messages/128 KiB. Existing durable keys remain unused and untouched. The separate review action
  can copy the old key/history into session state; deleting old durable copies requires a second
  explicit checked confirmation after the session copy is verified.
- Tradeoff: more useful conversational continuity and HR context, with a larger health-data surface
  and more session persistence than A.

### Option C — durable consent and broad compatibility context (not recommended)

- Authorization: exact positive action `Always allow selected AI Coach data`; consent expires after
  30 days and every request still shows a preview. Revoke aborts work, records denied, and clears
  only new versioned consent/history/key records selected by the user.
- Exact disclosure copy: “AI Coach uses the Google Gemini API. If you choose ‘Always allow selected
  AI Coach data’, StravaStats may send your question, recent conversation, exact activity calendar
  dates, sport, distance, duration, elevation, average heart rate, gear display names, and personal-
  best values/dates shown in each request preview to `generativelanguage.googleapis.com`. It never
  sends athlete or activity names, IDs, routes, tokens, power, or raw activity/stream data. Your
  choice, API key, and bounded conversation are stored in this browser, excluded from StravaStats
  backup, and removable here.”
- Outbound data: current question; up to twelve prior turns/32 KiB; current all-time/coarse monthly
  aggregates; maximum 30 recent rows with exact local calendar date, closed sport category,
  distance rounded 0.1 km, duration 1 minute, elevation 10 m and average HR 1 bpm; gear display
  names with aggregate distance/count; and run/ride PB values plus exact local date. Activity names,
  athlete names, every ID, route/GPS, filename, Token, power and raw streams remain denied.
- Key/consent/history: new versioned localStorage records; consent/history TTL 30 days; maximum 40
  messages/256 KiB. Existing keys are never trusted automatically. An explicit import flow copies
  them to the new format; old copies remain until the user separately selects verified deletion.
- Tradeoff: closest to inherited behavior, but deliberately externalizes materially more health,
  history, date, gear and PB data and retains credential/history durably.

### Proposed exact cumulative allowlist

The smallest common hard maximum for any selected option is exactly these twelve paths:

```text
docs/tasks/pr-35-ai-coach-consent.md
docs/guides/privacy-guide.md
docs/guides/known-limitations.md
TECHNICAL_GUIDE.md
PWA_GUIA.md
js/app/ai-coach-egress.js
js/app/main.js
js/tabs/ai-chat.js
tests/privacy/ai-egress.test.js
tests/consumers/ai-consent-browser-smoke.html
tests/consumers/summary-boundaries.test.js
tests/legacy/demo-isolation.test.js
```

`js/app/ai-coach-egress.js` is a new side-effect-free provider/consent boundary. Main injects the
frozen Demo or Real session capability; the tab no longer selects the provider, performs fetch, or
reads credential/history storage directly. Existing Backup, Diagnostics, Service Worker, Legacy
Rescue, Repository, Storage, Import, analysis, tab barrel, index markup, and CSS remain unchanged;
their existing tests are rerun as focused guards. Any thirteenth path or model/endpoint change
requires a new minimum collision package and explicit authorization.

## A3 frozen decision

On 2026-08-08 the control tower returned the user's exact material selection: `A`. This freezes
Option A above, the common hard floor, and the twelve-path cumulative allowlist exactly as written.
It authorizes failure-first tests and the minimum implementation needed to satisfy that contract;
it does not authorize selecting any Option B or C behavior by inference.

The implementation contract is therefore:

- every request requires a fresh local preview and the exact affirmative action
  `Send this request to Google Gemini`; consent is never persisted;
- the only outbound user-derived content is the current question, bounded to 4,000 code units, and
  the two relative `recent_28_days` and `previous_28_days` aggregate buckets defined by Option A;
- dates, heart rate, gear, personal bests, names, IDs, filenames, routes/GPS, Tokens, raw activity,
  raw heart-rate/power/streams, provider/private values, and prior chat messages remain denied;
- the API key and visible conversation exist only in current-document memory; conversation is
  limited to twelve messages and 64 KiB, and a provider response to 16,384 code units;
- inherited `gemini_api_key` and `ai_chat_history` values are never read during normal rendering or
  sending, and are never automatically migrated, copied, overwritten, or deleted; only the
  separate explicit review/copy/delete actions may touch those two exact durable keys;
- provider/model remains exactly
  `v1beta/models/gemini-3-flash-preview:generateContent`; any endpoint or model change is outside
  this decision; authentication uses `x-goog-api-key`, the request sets `store: false`, timeout is
  four seconds, cancellation/revocation aborts in-flight work, and there is no retry;
- Demo performs zero consent, API-key, provider, history, or storage I/O; existing public API,
  schema, dependency, Repository, Storage, Backup, Diagnostics, Worker, Service Worker, analysis,
  import, default-mode, and route contracts remain unchanged.

Any thirteenth path, field expansion, stronger precision, durable/session consent or retained-data
behavior, automatic legacy action, or provider/model/endpoint change must stop and return a new
minimum collision package for explicit approval.

### A3 trusted activity snapshot clarification

On 2026-08-08 the control tower returned the user's additional exact selection, case-insensitive
`a`, for the browser-language collision found by failure-first review. This freezes the internal
trusted snapshot/private-brand seam:

- main converts post-Repository/preprocessed activity primitives from the existing trusted
  composition provenance into a module-owned, privately branded minimized snapshot;
- `prepare` accepts only that private brand and rejects a directly supplied unbranded object,
  accessor-bearing value, Proxy, or revoked Proxy through private `WeakSet` membership without
  executing a user accessor or Proxy trap;
- the zero-accessor/zero-Proxy-trap guarantee applies at the AI egress boundary to unbranded input;
  the existing upstream Repository/preprocessing provenance remains the trusted activity source;
- this is an internal injected-capability seam only. It does not change a public API, schema,
  Repository, Storage, provider field, model, or endpoint.

The twelve-path cumulative allowlist remains unchanged. Option B (reflecting on arbitrary raw
activity objects) and Option C (pausing for a future platform primitive) remain rejected.

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
