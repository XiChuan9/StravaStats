# PR-26: Persistent DOM XSS Safety

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M23 / PR-26 |
| Status | A1 scope and evidence contract frozen; A2 read-only audit authorized |
| Branch | `codex/v2/dom-safety` |
| Exact base | `integration/v2@e083fa0d55c8981f0258af546451ebb0d48e4fa4` |
| Allowed path for A0-A2 | `docs/tasks/pr-26-dom-safety.md` only |
| Product authority | Investigation and repair-contract design only; no implementation or test change |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Independently audit the actual production entry graph for persistent DOM XSS and attribute/URL
injection reachable from imported, Repository-projected, Legacy/provider, user-owned, or safely
reduced error data. Freeze a sink-by-sink exploitability inventory and the smallest ordered repair
contract without changing production code or tests in A0-A2.

The audit does not treat a textual search hit as a vulnerability. Each candidate must be traced
from a real source through validation, persistence, Repository/projection, and the actual served
renderer. Constant strings, closed vocabularies, correctly encoded values, unreachable helpers,
and test-only code are recorded separately from exploitable production sinks.

## A0 authority and exact baseline

Conflicts are resolved in this order: Accepted ADR-0001 through ADR-0006, the product PRD,
engineering plan and release gates, this Task Brief, then implementation details. The PRD,
release-gate, and test-strategy documents still carry `Proposed` status; they remain required
security and release inputs but cannot override an Accepted ADR or freeze an otherwise undecided
contract.

The only baseline is `e083fa0d55c8981f0258af546451ebb0d48e4fa4`. Local Git identifies it as
`docs(v2): complete release candidate documentation (#30)` on `integration/v2`. GitHub App
evidence identifies PR #30 as merged with that exact merge commit. The integration-push workflow
is GitHub Actions run `31157822933`, workflow `CI`, run number 185, conclusion `success`.

The worktree began detached, clean, and exactly at that baseline. The exact task branch was then
created from it. `main`, `maintenance/v1`, and `integration/v2` were not modified.

Untouched-baseline evidence on 2026-08-07:

```text
npm ci                    PASS (6 packages installed)
npm run check:syntax      PASS (239 files)
npm run check:privacy     PASS
npm test                  PASS (1,469/1,469)
git diff --check          PASS
worktree status           CLEAN
```

No real Token, Authorization value, provider response, account, browser profile, activity, route,
GPS track, heart-rate or power history, FIT/TCX/GPX/ZIP/CSV export, screenshot, private fixture,
Legacy library, or V2 library was read.

## A1 publication and hard boundary

The first feature-branch commit contains only this Task Brief. It is pushed before A2 results and
opens a Draft PR targeting `integration/v2`. The PR remains Draft. A GitHub App 403 is delegated
directly to the control tower; it does not authorize Chrome, interactive login, or a user's browser
session.

The cumulative A0-A2 write allowlist is exactly one path:

```text
docs/tasks/pr-26-dom-safety.md
```

A0-A2 do not authorize production or test implementation, dependencies, a sanitizer package,
schema/storage/Repository/import/decoder/analysis changes, public APIs, route/DOM/CSS/copy changes,
Service Worker, deployment, release, protected-branch mutation, Ready, merge, or cleanup.

Legacy and V2 data remain physically and logically preserved. Opaque IDs remain strings. Missing,
absent, `null`, real `0`, and negative zero remain distinct. Disconnecting Strava and deleting
local data remain separate operations. No investigation step may clear, delete, migrate, repair,
overwrite, downgrade, reverse-copy, or otherwise mutate user data.

## Source to projection to renderer graph to verify

The audit begins with the accepted production ownership graph below and must verify every edge in
source rather than assuming the historical contract still matches the exact baseline.

```text
Local files / Strava archive
  -> CSV / ZIP / FIT / TCX / GPX decoders
  -> ImportedActivityBundle validation
  -> Import persistence / Canonical Store
  -> CanonicalRepository
  -> summary-projection / detail-projection
  -> root summary session or DetailReadSession
  -> summary tabs, detail renderers, Run Plus / NSM

Legacy cache / optional provider connector
  -> LegacyRepository and detached Legacy-shaped results
  -> the same root summary/detail composition boundaries
  -> summary tabs, detail renderers, Run Plus / NSM

Demo synthetic source
  -> DemoRepository
  -> the same consumer shapes with Real storage/provider isolation

User-owned settings / filters / tags and safe error codes/messages
  -> page-local state or fixed public envelopes
  -> source, backup, diagnostics, summary, detail, or Run Plus UI
```

The production consumer inventory begins with:

```text
Root summary routes:
  Activities, Calendar, Wrapped, Dashboard, Run, Bike, Swim, Gear, Map, Planner

Detail routes:
  Activity Router -> Generic Activity / Run / Bike / Swim
  DetailReadSession -> activity / streams / optional zones and athlete
  Generic Advanced Analysis reuses injected detail data

Run Plus / NSM:
  root summary array + immutable gear snapshot
  + narrow on-demand getActivity/getStreams callbacks

Local-first/support routes:
  First-run / Source Manager / Import Report / Duplicate Review
  Storage & Backup / Diagnostics / safe blocked and error states
```

The audit must trace at least activity names; gear name, brand, and model; activity/gear/source and
other opaque string IDs; import/report labels; user-owned labels/settings; and every error/message
that reaches a candidate sink. Provider or storage provenance is not itself proof of taint, and a
field is not safe merely because a current producer usually emits a friendly value.

## A2 read-only audit method

### Production reachability first

Start from actual served HTML/module entries and follow imports, composition roots, Repository
calls, projections, and renderer calls. Search results are candidate discovery only. For every
candidate, record:

1. exact file, function, and sink;
2. actual production entry and route that reaches it;
3. source field and every transformation/validation step;
4. whether the value is constant, a finite closed vocabulary, structurally encoded, or externally
   controllable through Import, Legacy/provider, Canonical storage, user state, or a safe error;
5. the HTML, attribute, URL, selector, CSS, JavaScript, Chart, Leaflet, or text context;
6. required characters and a deterministic synthetic proof concept;
7. exploitability as `P0`, `P1`, `SAFE`, `UNREACHABLE`, or `NEEDS BROWSER PROOF`;
8. smallest safe rendering primitive and likely owner path;
9. semantic invariants at risk, especially opaque IDs and missing/null/zero;
10. whether repairing the sink changes public API, DOM, route, CSS, copy, or behavior.

### Sink classes

Audit all production uses and wrappers of:

```text
innerHTML / outerHTML / insertAdjacentHTML / document.write
inline on* event attributes and JavaScript-bearing string handlers
href / src / srcdoc / style / data-* and other interpolated attributes
window.open / location assignment / URL templates / URLSearchParams boundaries
querySelector / querySelectorAll / matches / closest with interpolated selectors
setAttribute and DOM property assignment where the attribute has executable or URL semantics
Chart.js labels, legends, external tooltips, plugins, and HTML tooltip helpers
Leaflet bindTooltip / bindPopup / DivIcon / HTML marker and layer helpers
Markdown, AI, rich-text, or HTML-to-DOM rendering if production-reachable
```

For `textContent`, `createTextNode`, ordinary form-control `.value`, and DOM construction with
fixed element/attribute names, verify the complete context before recording the sink safe. For URL
and selector construction, distinguish encoding from scheme/origin allowlisting. For `data-*`,
distinguish inert storage from later interpretation by selector, HTML, URL, or JavaScript code.

### Source and validation classes

Trace sources across:

```text
Import: CSV cells, ZIP metadata/linked files, FIT/TCX/GPX text and device/session metadata
Canonical: activity, source, device, extension, projected summary/detail/lap/stream values
Legacy/provider: activity, athlete, zone, gear, stream, cache, connector response projections
User-owned: feature overrides, Run Plus/NSM labels/tags/settings, filters and query strings
Errors: fixed code/message maps versus retained or concatenated underlying values
Demo/constants: deterministic fixture fields and closed UI vocabularies
```

Descriptor-safe validation is not HTML encoding. JSON safety is not DOM safety. An opaque string
ID is permitted to contain punctuation and URL-reserved characters and must never be made numeric,
trimmed into a different identity, silently replaced, or treated as safe HTML merely because it
passed an ID validator.

### Deterministic failure-first canary design

A2 designs but does not add tests. The later implementation plan must use synthetic deterministic
values covering independent parser contexts:

```text
element text/tag boundary:       <img src=x onerror=...> and closing-tag shapes
quoted attributes:               double quote and single quote breakouts
unquoted/template contexts:      whitespace, equals, backtick, braces, backslash
inline event handlers:           quote/backtick/parenthesis/comment breakouts
URL contexts:                    javascript-like schemes, //host, ?, #, %, &, =, /, Unicode
selector contexts:               quotes, brackets, commas, :not(), escapes, CSS metacharacters
special object keys:             __proto__, constructor, prototype
Unicode:                         bidi/control, combining marks, astral characters, line separators
identity/semantics:              "0", "000123", URL-like opaque IDs, null, absent, 0, -0
```

The browser gate must prove inert rendering and preserved exact text/ID semantics, not merely the
absence of one alert. Assertions include no injected element/attribute/handler, no unexpected
navigation or popup, no external request, no runtime/console error containing canaries, exact
route/query round-trip, and unchanged missing/null/zero presentation.

### Actual-served disposable browser gate design

A2 will specify one later actual-served gate using a fresh loopback origin and disposable browser
profile. Observation begins before navigation and records Network, Fetch/XHR, WebSocket/
EventSource, popup/navigation, console/runtime, IndexedDB names/versions and safe synthetic counts,
Local/Session Storage key names, Cache Storage, and Service Worker registrations. The gate seeds
only inline deterministic synthetic data through accepted public or production storage boundaries,
visits every repaired actual route, and stops/removes the disposable server/profile afterward.

It must not use a user browser profile, login, Token, provider network, private fixture, real
activity, real route, health/power history, export, or screenshot. Browser evidence is `NOT RUN`
until it actually executes; a static harness or injected-only seam cannot be relabelled as actual
served navigation.

## Repair-strategy decision rules

The preferred primitive order is:

```text
textContent / createTextNode
createElement plus fixed DOM structure
safe property assignment for inert properties
setAttribute only after context-specific validation/encoding
addEventListener with values retained in closures or exact data properties
URL / URLSearchParams with explicit permitted scheme/origin where applicable
```

Do not introduce a general sanitizer dependency in the first repair contract. Do not add an
`escapeHTML` helper and then keep interpolating the escaped value into inline `onclick`, another
JavaScript context, a URL, selector, or style string. Do not solve persistent XSS by dropping,
renaming, coercing, or numerically parsing valid imported values or opaque IDs.

An allowlist must be literal, collision-free, and grouped by production route/source ownership.
If one PR would mix unrelated summary, detail, Run Plus, support-route, or shared-primitive owners,
A2 must split them into strictly ordered minimal PRs. The first implementation PR must close every
default-Canonical actually reachable P0 assigned to its route family; age or perceived usage of a
page does not lower severity.

Any public API, schema, dependency, persistence, route, DOM structure, CSS, product copy, or
behavior change is a material decision. A2 records options, recommendation, exact candidate paths,
verification, privacy/data impact, migration/rollback impact, and pauses implementation authority.

## A2 required outputs

This same Task Brief will receive:

- a source -> validation -> persistence -> projection -> renderer call graph with citations;
- a complete production sink inventory, including safe and unreachable candidates;
- P0/P1 tables with per-sink exploitability and actual reachable modes/routes;
- the minimal safe rendering primitive strategy and shared-helper boundaries, if any;
- a literal candidate implementation allowlist or ordered PR split with dependencies;
- the failure-first synthetic canary matrix and actual-served browser matrix;
- focused, full-suite, privacy, depth-1, CI, rollback, and cross-PR regression plans;
- privacy, data, migration, Legacy/Canonical rollback, and Not-run statements;
- every material owner decision required before implementation.

## Stop and delegation boundary

Stop immediately if A2 requires changing any path other than this Task Brief, adding a test,
running product mutation, accessing private/user/provider data, using a real browser profile,
changing a dependency or public contract, mutating a protected branch, or performing a destructive
storage/cache operation.

After A2 is committed and pushed, send the complete decision package to the control tower and
stop. Do not start implementation, mark Ready, merge, release, deploy, or clean the branch/worktree.

## A2 result

Pending read-only audit.
