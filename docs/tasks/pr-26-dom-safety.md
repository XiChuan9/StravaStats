# PR-26: Persistent DOM XSS Safety

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M23 / PR-26 |
| Status | A3 R1 implementation authorized and active; R2 prohibited |
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

### Verdict and priority

The exact baseline contains production-reachable persistent DOM XSS and attribute/URL injection.
The highest-priority path is imported or shadow-written Canonical activity data rendered by the
root summary and detail routes. Supported Legacy/provider routes add independent gear, athlete,
segment, map, and metadata surfaces. Two strictly ordered implementation packages are required:

1. **R1 — root summary DOM and opaque-ID hardening.** Close every default-Canonical reachable P0
   in the root document first, plus the root-owned supported-Legacy sinks. Freeze a safe internal
   activity-link output seam for R2.
2. **R2 — detail and gear-owned DOM hardening.** Consume the R1 seam, but continue to treat every
   directly constructed activity/gear URL as untrusted. Close generic/sport detail, gear cards,
   gear detail, segment, Leaflet tooltip, and inline-handler sinks.

R2 depends on the R1 link contract and its regression evidence. R1 does not depend on R2. Neither
package may use page age, low traffic, explicit Legacy mode, or an assumed friendly provider value
to lower the priority of a reachable code-execution sink.

### Verified source -> projection -> renderer graph

#### Canonical import and shadow paths

```text
Strava archive activities.csv "Activity Name"
  -> js/import/activities-csv-decoder.js:343-344 (verbatim string or null)
  -> ImportedActivityBundle / CanonicalActivity validation
     js/data/contracts/canonical-activity.js:294-304 (null or arbitrary string; not HTML encoding)
  -> Canonical Store
  -> CanonicalRepository.listActivities/getActivity
  -> js/repository/canonical/summary-projection.js:164-194
     id and name copied as strings; shadow gearExternalId copied as gear_id
  -> js/repository/canonical/detail-projection.js:180-195
     detail reuses the same summary fields
  -> js/app/main.js root composition or DetailReadSession
  -> R1/R2 renderers below

GPX track/metadata name
  -> js/decoders/gpx/decoder.js:935-937 (verbatim normalized XML text)
  -> the same Canonical validation, persistence, projection, and renderer path

Legacy/provider activity
  -> js/shadow/legacy-to-canonical.js:114-124 and 250-270
     numeric Legacy IDs may become strings; existing strings remain exact; gear_id becomes
     shadowCanonicalWriterV1.gearExternalId without HTML or URL encoding
  -> the same Canonical summary/detail projection path
```

Canonical `sportCategory`/`sportVariant` is projected through the finite compatibility tables in
`summary-projection.js`; it is not attacker text in default Canonical mode. Canonical summary does
not project map polylines, coordinates, athlete, zones, full gear objects, descriptions, segment
efforts, or device metadata. FIT `productName` can become an arbitrary stored device `model`
(`js/decoders/fit/decoder.js:925-947`), but no audited production projection renders that field;
that candidate is `UNREACHABLE` on this baseline.

#### Supported Legacy/provider paths

```text
Legacy connector or Legacy metadata/activity cache
  -> LegacyRepository
  -> js/repository/legacy/legacy-projection.js:1-142
     detached JSON-safe descriptor copy; sensitive keys rejected; strings not DOM-encoded
  -> js/app/main.js injected summary activities/athlete/zones/gears
  -> root R1 renderers

Legacy detail activity/streams/metadata
  -> activity-router + DetailReadSession
  -> generic/run/bike/swim R2 renderers

Legacy gear/activity local cache used by the existing gear detail route
  -> html/gear.html URLSearchParams id
  -> js/pages/gear/gear-analysis.js:45-79
  -> R2 hero/health/list/map renderers
```

The existing gear-detail cache read is an inherited, production-reachable page-local path. R2 may
make its DOM output safe but must not migrate it to Repository, probe Legacy databases, change its
storage keys, or combine that architecture issue with this repair.

#### Output seam from R1 to R2

R1 must create internal activity anchors as DOM nodes. It must construct a same-origin
`/html/activity-router.html` URL relative to the served origin, set exactly one `id` search
parameter with `URLSearchParams`, assign the resulting URL to the anchor, and put the label in a
text node. `target="_blank"` links receive `rel="noopener noreferrer"`. The opaque ID is retained
as the exact string; it is never trimmed for output, parsed, compared numerically, or placed in an
HTML/JavaScript string.

`js/pages/activity-router.js` already reads `id` with `URLSearchParams`, compares the decoded
string identity, selects only a page from a closed route table, and applies `encodeURIComponent`
when forwarding the same ID to the detail page. R2 must nevertheless defend direct navigation to
`activity.html`, `run.html`, `bike.html`, `swim.html`, and `gear.html`: query parameters remain
untrusted even when R1 normally produced the link. Gear links follow the same same-origin
`URLSearchParams` rule with `/html/gear.html`; no `javascript:` or protocol-relative target is
accepted or derived from data.

### Severity definitions

- `P0`: a production route places an externally controlled persisted or query value into an HTML,
  event-handler, or Leaflet-HTML parser context capable of creating markup or executable behavior.
  Default Canonical reachability is called out separately from supported Legacy reachability.
- `P1`: the sink is real but exploitation requires a producer-contract violation, a dependency
  error string that has not been shown attacker-controlled, or an indirect malformed-shape path.
- `SAFE`: current production value is constant/closed, uses a context-safe primitive, or is canvas
  text only.
- `UNREACHABLE`: data exists upstream but is not projected into an actual served renderer.

Static analysis proves the source-to-parser condition for P0. The actual-served browser proof is
deliberately `NOT RUN` in A2 and is a mandatory implementation gate.

### P0 sink inventory

| Package | Mode / production route | File and function | Source -> sink and exploitability | Required repair |
| --- | --- | --- | --- | --- |
| R1 | Default Canonical root Run/Bike filters | `js/app/main.js:936-969`, `setOptions` | Canonical `gear_id`, including shadow `gearExternalId`, is placed in option text and a quoted `value` inside `innerHTML`. A closing-option/tag canary reaches the HTML parser. | Build `option` nodes; assign `.value` and `.textContent`; preserve the exact ID. |
| R1 | Default Canonical `/activities` | `js/tabs/activities.js:397-400, 475-849`, `COLUMNS.name` / `renderActivitiesTab` | Imported `name` becomes anchor body; opaque `id` becomes quoted `href`; the combined table is assigned to `innerHTML`. Both tag and attribute breakouts are reachable. | DOM-build the activity link/cells; URLSearchParams seam; text nodes. |
| R1 | Default Canonical `/calendar` | `js/tabs/calendar.js:329-343, 382-401, 450-468, 487-522` | Imported name enters `title` and element text; ID enters `href`; month/week/year/day-detail strings are parsed with `innerHTML`. | Create nodes; set `.title`/text safely; create seam anchors. |
| R1 | Default Canonical `/wrapped` | `js/tabs/wrapped.js:465-467, 748-874` | `activityLink` places ID and name into anchor HTML used by records, top sessions, and the all-activities table. | Return/append an anchor element, not HTML; seam URL plus text node. |
| R1 | Default Canonical `/run` and Run Plus embedded Run analysis | `js/tabs/run-analysis.js:1857-1947` | IDs are URL-encoded, but imported names remain raw anchor HTML in top runs and the all-runs table. | Retain exact ID through the seam; render names with text nodes. |
| R1 | Default Canonical `/bike` | `js/tabs/bike-analysis.js:690-787` | Top-ride names are raw anchor HTML. The later all-rides table separately escapes name and encodes ID and is not the vulnerable sink. | DOM-build top-ride anchors; keep the safe all-rides outcome. |
| R1 | Default Canonical `/swim` | `js/tabs/swim-analysis.js:978-1084` | Imported names are raw in both top-swim and all-swim anchor HTML; IDs are encoded but name markup still executes. | DOM-build anchors/cells; preserve numeric/null presentation. |
| R1 | Default Canonical `/trends` | `js/tabs/athlete.js:489-566` | Longest/fastest/elevation activity IDs are inserted unencoded in `href` within `innerHTML`. A quoted-attribute plus closing-tag ID canary reaches HTML. | Seam anchors with fixed “View” text. |
| R1 | Supported Legacy `/trends` | `js/tabs/athlete.js:1875-1944` | Provider/cache firstname, lastname, city, country, `profile_medium`, and zone fields are interpolated into element, `src`, `title`, style-value, and text contexts. Canonical `getAthlete/getZones` returns `null`, so this is not default-Canonical reachable but remains a supported production P0. | DOM-build profile/zones; text nodes; image URL policy; finite numeric style assignment only. |
| R1 | Supported Legacy `/map` | `js/tabs/maps.js:145-174`, `renderMapTab` | Activity name/date is passed as a string to Leaflet `bindPopup`, which treats it as HTML. Canonical summary lacks coordinates/map data, so current default Canonical cannot reach this popup. | Pass an `HTMLElement` whose children use text nodes; retain closed map styles. |
| R2 | Default Canonical generic detail | `js/pages/activity/activity.js:790-824`, `renderActivityInfo` | Imported Canonical name is inserted into `DOM.info.innerHTML`. Legacy description/type/gear add independent persisted strings in the same sink. | Build the fixed info list with elements/text nodes. |
| R2 | Default Canonical run/bike/swim detail | `js/pages/run/run.js:844-884`, `js/pages/bike/bike.js:452-504`, `js/pages/swim/swim.js:643-684` | Canonical/shadow `gear_id` and Legacy gear label are placed in anchor `href` and body via `heroGear.innerHTML`. | Build anchor; gear URLSearchParams; text node; direct-query defense. |
| R2 | Supported Legacy generic/run/bike detail | `js/pages/activity/activity.js:1232-1266, 1391-1436`, `js/pages/run/run.js:1372-1406, 1531-1576`, `js/pages/bike/bike.js:1360-1417` | Best-effort/segment names and segment IDs are interpolated into table HTML and external Strava URLs. Provider-controlled names can create markup; opaque/reserved IDs can corrupt attributes/paths. | DOM-build rows; text names; permit only fixed `https://www.strava.com/segments/` origin and encode the path component. |
| R2 | Supported Legacy root `/gear` | `js/tabs/gear.js:385-475`, `createGearCard` | Gear id is embedded in inline `onclick` JavaScript and a gear URL; name/brand/model are raw HTML. Persistent gear fields can execute on parse or click. | Remove inline handler; DOM-build card; addEventListener closure; URLSearchParams gear URL; text nodes. |
| R2 | Direct `/html/gear.html?id=...` and supported Legacy gear detail | `js/pages/gear/gear-analysis.js:45-132, 169-213, 490-539` | A direct query ID is reflected into not-found HTML; persisted gear id/name/brand/model create hero/input/id markup; persisted activity id/name creates inline `window.open` and list HTML. Direct URL is untrusted independently of R1. | `replaceChildren` safe error UI; DOM-build hero/inputs/list; addEventListener; URLSearchParams; retain exact localStorage key identity. |
| R2 | Supported Legacy gear map | `js/pages/gear/gear-analysis.js:335-360`, `renderGearMap` | Activity name is passed to Leaflet `bindTooltip` as HTML for polylines/markers. | Pass a text-only `HTMLElement`/text node as tooltip content. |

### P1 and non-P0 candidates

| Package | Candidate | Classification and reason | Contract |
| --- | --- | --- | --- |
| R1 | `js/tabs/activities.js:450-742` inferred Legacy column keys/labels | `P1`. Canonical projection keys are fixed. Legacy projection accepts descriptor-safe JSON keys, but the current provider schema owns a fixed field set; a contract-violating key can enter checkbox/data-attribute HTML. | R1 DOM construction must make keys inert without deleting `__proto__`, `constructor`, or other valid own keys. |
| R1 | `js/tabs/athlete.js:386-486, 1966-1985` transition/type rows and sport options | `P1`. Default Canonical sport type is closed. Legacy Repository does not locally enforce the provider enum, so malformed Legacy type strings can enter HTML. | Use option/text nodes while preserving the same labels/order. |
| R1 | `js/tabs/wrapped.js:549-641` detailed sport types | `P1` for the same Legacy type-contract gap; default Canonical is closed. | Text nodes for dynamic labels when the owning renderer is repaired. |
| R1 | `js/tabs/athlete.js:1520-1529, 1948-1963` Chart catch messages | `P1 / NEEDS BROWSER PROOF`. Raw `error.message` enters `innerHTML`; audited Chart configs use fixed IDs and numeric/closed data, and no deterministic imported-string-to-error path was established. | Replace with fixed safe copy or `.textContent`; never retain underlying/provider payload. |
| R1 | Athlete `profile_medium` URL | `P1` for scheme/origin behavior in addition to the P0 HTML-context problem. A quoted breakout is removed by DOM creation, but an arbitrary remote URL could still fetch. | Freeze an explicit permitted image scheme/origin or omit invalid URLs. External-profile egress policy beyond this image is a separate decision. |
| R2 | Static inline `window.close/history.back` handlers in served HTML | `SAFE` for DOM XSS because code and values are constants. They are not evidence of persisted injection. | Do not expand R2 to unrelated CSP cleanup; only remove dynamic inline handlers in owned repaired renderers. |

### Safe and unreachable audit record

| Area | Result |
| --- | --- |
| Activity Router | `SAFE`: query is parsed with `URLSearchParams`, page selection is closed, forwarding uses `encodeURIComponent`, and error UI uses `createElement`, `textContent`, and `addEventListener`. |
| Run Analysis Leaflet popup | `SAFE`: only fixed “Start Point” / “End Point” text reaches `bindPopup`. |
| Weather popup/prediction | `SAFE` for DOM XSS on the verified path: popup values are finite numbers or an internal weather-code/relation vocabulary; run names in the weather table use `textContent`. Weather/network/location egress is expressly outside R1/R2. |
| Chart.js | `SAFE` for name/gear strings in current default canvas tooltips/legends. The custom HTML legend overlays create elements and assign label `textContent`. No external HTML tooltip renderer was found. |
| AI/chat | Message text escapes `&`, `<`, and `>` before the limited bold/italic transform. Roles are produced only by the closed `user`/`model` app path. AI data egress, API-key storage, logging, and malformed localStorage recovery are outside R1/R2. |
| Run Plus / NSM | `SAFE` for audited names/IDs/settings: `esc` is applied to name links, gear option values/labels, and user notes; IDs are `encodeURIComponent`-encoded. Its selector IDs are internal constants. Do not change it in R1/R2. |
| Dashboard / Planner | `SAFE` for the investigated persistent name/gear/ID sources. Dynamic strings are numeric/closed or canvas data URLs; no activity name/opaque-ID HTML sink was found. |
| Source Manager / Import Report / Duplicate Review | `SAFE`: imported labels/codes and review tokens use created elements, `textContent`, or inert dataset properties; source selectors use a closed app vocabulary. Do not mix import/report redesign into this work. |
| Backup / Diagnostics / blocked/error states | `SAFE`: audited public errors are fixed/reduced and rendered as text. Token, provider body, raw activity, and underlying cause remain excluded. |
| `js/services/api.js` athlete renderer | `UNREACHABLE` from the actual root composition; the root uses `js/tabs/athlete.js`. Its HTML escaping is not a shared security primitive and must not be reused in inline handlers. |
| FIT device manufacturer/model | `UNREACHABLE`: stored in Canonical device metadata but not projected to a production summary/detail renderer on this baseline. |
| Demo | `SAFE` as a closed deterministic producer, but repaired renderers must remain equally safe if future synthetic canaries use Demo-shaped values. Demo safety does not excuse a Real sink. |
| Selector interpolation | No externally controlled selector was established. Source/tab/chart/Run Plus IDs are closed internal values or validated years/indexes. Opaque activity/gear IDs must continue to avoid selector interpolation. |

No `outerHTML`, production `document.write`, `srcdoc`, or production rich Markdown renderer was
found in the actual graph. `innerHTML` occurrences that receive only constants, finite numeric
formatting, or closed vocabularies are not included as vulnerabilities.

### Minimal rendering strategy

1. Keep fixed container markup where practical, then create only the dynamic rows/cells/links with
   `createElement`, `createTextNode`, `replaceChildren`, and `append`.
2. Use `.textContent`, `.value`, `.title`, and inert DOM properties for untrusted scalar values.
   `setAttribute` is allowed only with a fixed attribute name and a value already safe for that
   exact attribute; it is not an HTML-string substitute.
3. Build internal links with same-origin `URL` plus `URLSearchParams`; build fixed-origin Strava
   segment links with an encoded path component. Assign the DOM `href` property.
4. Remove data-bearing inline handlers. Retain IDs/objects in closures and attach
   `addEventListener`. Do not copy values into `onclick`, `data-*` for later interpretation, or a
   selector string.
5. Pass DOM elements/text nodes to Leaflet popup/tooltip APIs. Do not pass a name-bearing HTML
   string.
6. Do not introduce a shared/general sanitizer or new dependency. R1 and R2 use native primitives
   and private, route-local builders. This avoids freezing a public helper API or encouraging
   context reuse. The seam is behavioral and test-enforced, not a new shared module.
7. Preserve opaque strings byte-for-JavaScript-string exactly. No `Number`, `parseInt`, truthy
   fallback that manufactures zero, normalization, or sanitizing rewrite. Use explicit
   missing/absent/null checks and preserve existing display semantics for real numeric `0` and
   `-0`.

The literal URL allowlist is: current served origin plus pathname
`/html/activity-router.html` for activity links; current served origin plus pathname
`/html/gear.html` for gear links; and origin `https://www.strava.com` plus pathname prefix
`/segments/` for segment links. Each internal link permits exactly one data-bearing query key,
`id`. Athlete profile images may retain only the `https:` scheme in R1; an origin allowlist or
proxy would be a separate external-resource/egress decision and is not silently frozen here.

### Exact candidate implementation allowlists

These are proposed implementation-package allowlists, not A2 write authority. Each package needs
new control-tower authorization and its own clean exact-base verification.

#### R1 — root summary DOM and opaque-ID hardening

```text
js/app/main.js
js/tabs/activities.js
js/tabs/calendar.js
js/tabs/wrapped.js
js/tabs/run-analysis.js
js/tabs/bike-analysis.js
js/tabs/swim-analysis.js
js/tabs/athlete.js
js/tabs/maps.js
tests/consumers/summary-consumers.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/canonical-summary-browser-smoke.html
tests/consumers/run-plus-consumers.test.js
tests/consumers/run-plus-canonical-browser-smoke.html
```

R1 acceptance: every default-Canonical P0 in the R1 table is closed in the first implementation
commit series; supported Legacy root sinks in these same owner files are closed before R1 merges.
Dashboard, Planner, `js/tabs/run-plus.js` and Run Plus/NSM algorithms, Weather, AI, Gear tab,
Repository, decoders, schemas, storage, CSS, and HTML entries are outside R1. Run Plus tests are
included only because it embeds the repaired `renderRunAnalysisTab`; they freeze parity without
authorizing a Run Plus source change.

#### R2 — detail and gear-owned DOM hardening

```text
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/tabs/gear.js
js/pages/gear/gear-analysis.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/canonical-detail-browser-smoke.html
tests/consumers/summary-consumers.test.js
tests/legacy/demo-isolation.test.js
```

R2 acceptance: direct query navigation, R1-produced navigation, default Canonical detail, supported
Legacy detail, gear cards, gear not-found, gear activity list, and Leaflet gear tooltips all pass.
`html/gear.html`, `js/pages/activity-router.js`, DetailReadSession, Repository/cache ownership,
analysis algorithms, exports, weather, CSS, and product copy are outside R2 unless a new material
decision explicitly expands the allowlist.

The split is necessary: R1 owns the root composition and summary route seam; R2 owns independent
documents and the gear-local renderer. Combining them would obscure the first mandatory
default-Canonical closure and make rollback/cross-PR regression less attributable.

### Failure-first deterministic canaries

Implementation tests must use synthetic inline fixtures only. Each value gets a unique inert
counter/token so the failing sink is attributable.

| Canary class | Synthetic shape | Required assertion |
| --- | --- | --- |
| Element/tag | `</a><img src=x onerror="globalThis.__m23Tag+=1">` and a closing `option/select` shape | Exact visible text; no injected element, handler, counter, image request, or DOM sibling. |
| Double-quoted attribute | `opaque-&quot;-canary` represented as a real `"` plus ` autofocus onfocus=...` | One anchor/option only; no extra attribute/focus handler. |
| Single-quoted inline JS | `');globalThis.__m23Click+=1;//` | Click performs only the intended same-origin navigation; no counter or popup side effect. |
| Backtick/line separator | Backtick plus `\\`, U+2028, U+2029, parentheses, and comment markers | Exact text/ID survives; no parse/runtime error. |
| URL reserved | `id/a?b=c&d=e#frag%25=✓` | `URLSearchParams.get('id')` equals the original string after root -> router -> detail; one `id` parameter only. |
| Scheme-like | `javascript:...`, `//outside.invalid/x`, `data:text/html,...` used as names and opaque IDs | Values remain text/query data; navigation origin/path stays on the fixed internal route; zero external request. |
| Special keys | `__proto__`, `constructor`, `prototype` as opaque IDs and Legacy own keys | No prototype mutation/collision, no dropped ID, correct filter/link lookup. |
| Unicode | Bidi/control marker, combining text, astral emoji, CJK, and normalization lookalikes | Exact JavaScript string round-trip and inert visual text; no normalization used for identity. |
| Semantic sentinels | absent, `null`, string `"0"`, string `"000123"`, numeric `0`, and `-0` in fields where each is legal | Existing missing/null/zero presentation remains distinct; opaque strings never become numbers. |
| Gear fields | Independent canaries in id, name, brand, and model | Card/detail/list remain inert; edit/save uses the exact original localStorage key; no inline handler exists. |
| Error/message | Fixed public error plus a synthetic underlying Error containing a tag canary | Only the fixed/reduced copy is visible; underlying message/cause never reaches DOM or console evidence. |

Depth-1 adversarial coverage must repeat the checks after sort, filter, view switch, rerender, card
click, back navigation, direct detail URL, missing-record URL, and Leaflet popup/tooltip open. It
must verify both the immediate renderer and the next consumer across the R1 -> Router -> R2 seam.

### Actual-served disposable browser gate

The implementation gate, not A2, will:

1. start the repository's local server on a fresh loopback port;
2. launch a disposable browser profile with observation installed before the first navigation;
3. seed only deterministic synthetic Canonical data through the accepted public Canonical storage
   boundary, and separately seed the minimum synthetic Legacy metadata/cache needed for supported
   Legacy R1/R2 routes;
4. visit actual `/activities`, `/calendar`, `/wrapped`, `/run`, `/bike`, `/swim`, `/trends`, `/map`,
   `/html/activity-router.html?id=...`, `/html/activity.html`, `/html/run.html`, `/html/bike.html`,
   `/html/swim.html`, `/gear`, and `/html/gear.html?id=...` routes as applicable;
5. exercise filter/sort/calendar views, map popup, gear card/list, tooltip, missing gear, and direct
   crafted query paths;
6. record Network, Fetch/XHR, WebSocket/EventSource, popup and navigation events, console/runtime,
   IndexedDB database names/versions and safe synthetic counts, Local/Session Storage key names,
   Cache Storage, and Service Worker registrations;
7. assert zero canary execution, injected node/attribute, unexpected navigation/popup, provider or
   external request, Token/Authorization access, private-data log, and uncaught error; then assert
   exact text and ID round-trip plus unchanged absent/null/0/-0 behavior;
8. stop the server/browser and remove only the disposable profile.

It must not read or clean a user profile, existing Legacy/V2 database, real account, Token, route,
activity, health/power data, export, screenshot, or private fixture. A static fixture page,
`srcdoc`-only seam, unit DOM stub, or injected renderer call is supporting evidence, not a
substitute for actual served navigation.

A2 browser status: **NOT RUN**. No browser, server, provider, credential, storage seed, or canary
execution occurred in this investigation.

### Verification, independent review, CI, and rollback

For each implementation PR:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

- Focused R1: summary consumer/boundary tests plus both summary browser harnesses and the full R1
  route matrix.
- Focused R2: detail consumer/boundary tests, both detail browser harnesses, synthetic Legacy gear
  coverage, direct-query/missing-record coverage, and the full R2 route matrix.
- Cross-PR: after R2 is based on merged R1, repeat root -> router -> every detail page and root gear
  -> gear detail with reserved/Unicode IDs; assert R1 alone cannot be bypassed by direct R2 URLs.
- Depth review: an independent reviewer traces each changed dynamic value from source to final DOM,
  searches the changed files for remaining name/id interpolation, inline `on*`, string
  `bindPopup/bindTooltip`, and URL templates, and validates every allowlist path and no others.
- Privacy review: no real fixture, Token, Authorization, provider request, precise location, raw
  activity, or underlying error enters source, tests, logs, artifacts, screenshots, or CI output.
- CI: required GitHub checks must run on each implementation head and conclude success. A local
  pass is not CI evidence; the actual-served browser evidence must be attached separately if CI
  does not run it.

Rollback is code-only: revert R2 first, then R1 if necessary. There is no schema version,
migration, backfill, storage rewrite, cache clear, data cleanup, reverse-copy, or provider state to
undo. Rollback must never delete Legacy or V2 data. If R2 is reverted while R1 remains, the seam
continues to emit encoded internal links but direct detail routes again become unsafe; therefore
R2 rollback blocks release until repaired.

### Privacy, data, and behavior impact

- A2 changed documentation only. No production behavior, data, DOM, route, CSS, copy, dependency,
  public API, schema, persistence, Repository, import, analysis, Service Worker, deploy, or release
  state changed.
- Planned R1/R2 do not rewrite stored values. Names and opaque IDs remain available exactly as
  text/data. Legacy/V2 coexistence and rollback ownership remain unchanged.
- Synthetic tests must be deterministic and contain no realistic GPS track, heart-rate, power,
  athlete profile, export, credential, or private fixture.
- AI/provider logging, weather/map external egress, Service Worker policy, and Legacy database
  probing are explicit non-goals. A DOM repair may not silently claim to close them.

### Material-decision package

| Decision | Recommendation | Material? |
| --- | --- | --- |
| Accept ordered R1 -> R2 split and literal allowlists | Approve. It is required for ownership, first-default-Canonical closure, and attributable rollback. | Task/scope decision; no product behavior by itself. |
| Native DOM primitives; no sanitizer dependency/shared public helper | Approve. Keep route-local private builders and a behavior/test seam. | No public API/dependency change. |
| Replace dynamic inline handlers with `addEventListener`; add `rel="noopener noreferrer"`; serialize query values with `URLSearchParams` | Approve. Intended navigation/click behavior and routes stay the same; executable DOM attributes are removed and reserved IDs begin round-tripping correctly. | **Yes:** DOM attribute mechanics and malformed/reserved-ID behavior change, although structure/classes/copy/routes remain frozen. |
| Preserve fixed DOM structure, IDs/classes, CSS, copy, ordering, charts, maps, and empty states | Require. Any exception needs a new explicit decision before implementation. | No change authorized. |
| Athlete profile image URL policy | Approve the literal `https:` scheme check and omission of invalid/non-HTTPS values; do not add an origin allowlist, proxy, or new fetch in this task. | **Yes:** malformed/non-HTTPS profile image behavior changes on supported Legacy. |
| Keep gear detail on its inherited cache path for this repair | Approve. Repair output only; do not combine Repository/storage migration. | No architecture change authorized. |
| Leave AI/logging/weather or map egress/SW/Legacy probe issues outside R1/R2 | Approve and track separately if owners require. | No behavior change authorized. |

No public API, schema, dependency, route, CSS, product copy, persistence, Repository, or analysis
algorithm change is required for the recommended repair. The two bold material behavior/DOM
decisions require control-tower acceptance before implementation; A2 does not authorize them.

### A2 completion and stop statement

A2 is complete as a read-only investigation. The only modified path is this Task Brief. No test or
product implementation was added; no actual-served browser or implementation CI was run. After
the docs-only A2 commit is pushed and Draft PR #32 is re-verified, the complete package is returned
to the control tower. The PR remains Draft; Ready, merge, release, deploy, implementation, branch
cleanup, and worktree cleanup remain prohibited.

## A3 R1 implementation authorization

The user explicitly approved the default M23 A3 contract: **“批准 M23 A3 默认方案。”** This
authorization supersedes only the A2 implementation pause for R1. R2 remains prohibited until R1
is Squash Merged, the resulting `integration/v2` push CI succeeds, and a separate task is opened.

Approved decisions are:

1. the strict R1 -> R2 split;
2. removal of dynamic inline handlers in favor of `addEventListener`, internal links serialized
   with `URLSearchParams`, and `rel="noopener noreferrer"` on new-window links;
3. a literal `https:`-only policy for the supported-Legacy athlete profile image, omitting invalid
   or non-HTTPS values;
4. native DOM primitives only, with no sanitizer/dependency and no public API, schema, Repository,
   Import, analysis, Service Worker, route, CSS, copy, or persistence change;
5. exact opaque string IDs and existing missing/absent/`null`/numeric `0`/`-0` semantics.

The cumulative A3 R1 hard allowlist is exactly these sixteen paths:

```text
docs/tasks/pr-26-dom-safety.md
js/app/main.js
js/tabs/activities.js
js/tabs/calendar.js
js/tabs/wrapped.js
js/tabs/run-analysis.js
js/tabs/bike-analysis.js
js/tabs/swim-analysis.js
js/tabs/athlete.js
js/tabs/maps.js
tests/consumers/summary-consumers.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/canonical-summary-browser-smoke.html
tests/consumers/run-plus-consumers.test.js
tests/consumers/run-plus-canonical-browser-smoke.html
```

A seventeenth path is a stop condition. A historical-test conflict or browser-surface blocker must
be returned to the control tower as a minimal evidence/decision package; it does not expand scope.
Implementation must be failure-first with the already frozen tag, double/single quote, backtick,
inline-JavaScript, URL-reserved, scheme-like, `__proto__`/`constructor`/`prototype`, Unicode,
missing/`null`/`0`/`-0` canaries. R1 ends only after focused/full/privacy/syntax/diff/path checks,
actual-served disposable-browser evidence or an explicitly accepted equivalent-evidence decision,
independent findings-first review, fresh no-findings re-review, exact-head depth-1 and CI success,
and a Task-Brief-only Final Review Closure. Draft, no merge/cleanup/deploy/release, and no R2 remain
hard boundaries.

## A3 R1 implementation evidence

### Implemented R1 seam

R1 changes only the approved root-summary owners. Persistent activity names, Legacy activity type
strings, gear option labels/IDs, athlete metadata, and Map popup names now enter native DOM nodes.
Activity links retain values in closures/DOM properties, serialize one `id` with
`URLSearchParams`, attach listeners with `addEventListener`, and add
`rel="noopener noreferrer"` for new windows. Leaflet receives `HTMLElement` popup content, not an
HTML string. The supported-Legacy athlete image is created only for an absolute literal `https:`
URL; every other value is omitted.

The Router's existing compatibility contract is preserved locally in each R1 owner: a non-empty
string ID is retained byte-for-byte as a string and positive safe-integer Legacy IDs retain their
existing `String(id)` behavior. Activities, Calendar, and Athlete historically emitted numeric
zero links, so their `0`/`-0` values continue to route as `id=0`; Wrapped, Run, Bike, and Swim used
truthy-ID guards, so numeric `0`/`-0` remain inert text there. Missing/invalid/null IDs never invent
an empty query after repair. Opaque string `"0"` and `"000123"` are never parsed. Activities
retains the existing emoji plus `<small>` Sport-cell DOM/CSS hook, with only the dynamic type
assigned through `textContent`.

Athlete Chart failures now expose and log only fixed public copy. A synthetic underlying Error
whose message is the complete tag/quote/inline-JavaScript/Unicode canary is absent from both DOM
and captured console payloads. Supported-Legacy training-zone min/max values, the aggregate range,
and every computed `flexBasis` width must be finite before the style property is assigned; the
browser canary rejects string and infinite bounds and retains only two finite `50%` segments. No
public API, dependency, schema, storage, Repository, Import,
analysis algorithm, Service Worker, route, CSS, product copy, persistence, migration, or stored
value changed. R2 files and behavior remain untouched.

### Failure-first and regression evidence

The deterministic corpus covers tag and closing-tag shapes, double/single quotes, backtick,
inline-JavaScript syntax, URL-reserved and scheme-like strings, `__proto__`, `constructor`,
`prototype`, Unicode controls/combining/astral text, missing, `null`, string/numeric zero, and
`-0`. Before the product repair, the focused boundary run failed specifically because
`js/tabs/activities.js` still rejected the required Legacy numeric-ID contract. After repair, the
focused summary/Run Plus set passes `59/59`.

Executable supported-Legacy rendering covers ID `24681357`, numeric `0`, numeric `-0`, null,
absent, and opaque string `"0"`: the numeric IDs route as `24681357`, `0`, and `0`; null/absent
produce no anchor; exact text, `<small>` structure, and zero canary execution remain intact.
Canonical rendering seeds independent Run, Ride, and Swim hostile names/opaque IDs and asserts
the exact link text, query round-trip, and `rel` within Activities, Calendar, Wrapped, Run, Bike,
and Swim after refresh, sort, filter, Calendar month/year/week plus day-detail switches, and
rerender. The embedded Run Plus consumer repeats
the exact-name/query/`rel`/zero-execution assertions after gear-filter rerender and NSM view switch.

### Disposable-browser evidence and exact limitation

All browser work used only `127.0.0.1`, fresh profiles under `/private/tmp`, deterministic
synthetic storage, and no user Chrome/profile, login, Token, provider, private fixture, real
activity/profile, GPS/health/power history, export, or screenshot.

- The served supported-Legacy/Demo/Real seam harness passed with no failed gate: Legacy numeric,
  zero, negative-zero, null/missing, Athlete profile, Map popup, and embedded Run Plus canaries were
  inert; page network attempts were zero and captured console errors were zero.
- The served Canonical harness passed its complete 11-route matrix. Independent Run/Ride/Swim
  canaries round-tripped on their owning routes, all routes reported zero execution/injected
  elements, the forced Athlete Chart failure exposed fixed copy only, underlying canary text was
  absent from console, Repository I/O used only `strava-stats-v2`, and provider/Authorization/Token
  observations were zero. Its rewritten `srcdoc` root remains supporting evidence, not a relabelled
  actual-served result.
- A fresh-profile direct real-URL run completed the 11 root routes earlier in A3 with zero canary
  execution/elements, zero provider request, zero runtime/console error, exact opaque-ID link
  round-trip, and no user storage/SW contamination. The independent-review delta then added three
  sport-specific canaries, Legacy numeric sentinels, fixed Chart-error forcing, and stricter
  assertions. A second direct real-URL 503-by-11 stress rerun after that delta exhausted the
  isolated Chromium renderer (V8 OOM) before a final JSON record could be collected. The served
  per-owner harnesses above passed the exact delta. This OOM is reported as a browser-surface
  blocker/equivalent-evidence decision for the control tower; it is not claimed as a second direct
  actual-served pass.
- The canonical Run Plus seed plus direct `/run-plus` -> `/run-plus/nsm` disposable-profile run
  passed with the opaque ID `0007/opaque ?#%`, exact hostile text, `noopener noreferrer`, zero
  execution/injected elements, zero provider request, exact six synthetic user-owned storage keys,
  and no Service Worker control. The seed document itself continues to say
  `ACTUAL_SERVED_NAVIGATION_REQUIRED`; the separate direct navigation supplies the runtime evidence.

### Local verification and review status

```text
npm ci                                                    PASS (6 packages installed)
node --test focused summary/Run Plus consumers            PASS (59/59)
npm run check:syntax                                      PASS (239 files)
npm run check:privacy                                     PASS
npm test                                                  PASS (1,474/1,474)
git diff --check                                          PASS
changed-path audit                                        PASS (exact approved 16; no seventeenth)
```

The first independent findings-first review found: rejected Legacy numeric IDs/Calendar empty
queries; removed Activities `<small>` parity; insufficient per-sport and Run Plus canary evidence;
non-executable null/zero tests; two stale exact-baseline browser expectations; and raw Athlete
Chart Error retention. Each production/test finding received a failing or executable synthetic
contract before repair. The two stale browser expectations are exact-baseline test corrections:
Real defaults to Canonical on this base, and Canonical detail supports lookup so an unknown ID is
`NOT_FOUND`. They do not change product/detail behavior or enter R2, and are returned explicitly to
the control tower rather than treated as silent scope expansion. A fresh review then caught the
owner-specific numeric-zero distinction and missing Wrapped/Calendar depth assertions. A second
failure-first source contract reproduced the zero-parity issue; the four truthy-ID owners were
corrected to keep `0`/`-0` inert, and the Canonical gate now executes Wrapped plus Calendar
month/year/week/day-detail with all three sport canaries.

The final independent review then identified the remaining non-finite Athlete training-zone style
contract. Its source test failed first; the renderer now filters non-finite/reversed bounds and
requires finite positive total/segment ranges before style assignment. A fresh served Legacy gate
passed with exact `finiteTrainingZoneStyles: ["50%", "50%"]`. The reviewer rechecked that delta,
the full production sink set, owner-local ID semantics, the exact 16 paths, and R1/R2 separation,
and returned **NO FINDINGS**.

## A3 R1 Final Review Closure

R1 implementation commit `feff36b37dbaade95356c26d12dc5d963ba859a7` is pushed to
`codex/v2/dom-safety`. GitHub verifies Draft PR #32 as OPEN with base
`integration/v2@e083fa0d55c8981f0258af546451ebb0d48e4fa4`, that exact implementation
head, and exactly the approved sixteen changed paths. GitHub Actions CI run `31179604934`, job
`92869453799`, completed successfully for that head.

The direct remote depth-1 clone transport disconnected while reading the GitHub sideband and is
not claimed as a pass. The exact-head proof was completed without weakening the gate: the GitHub
PR API first attested the remote head OID above, then a local `file://` depth-1 clone of that same
already-pushed branch object reported `HEAD=feff36b37dbaade95356c26d12dc5d963ba859a7`, history count
`1`, and a clean worktree. From that clone, `npm ci`, syntax (239 files), privacy, full tests
(1,474/1,474), diff-check, and final clean-status checks all passed. This is an explicit
equivalent-evidence decision item for the control tower, not a relabelled successful remote clone.

Review closure is findings-first and independent. Three review rounds found and failure-first
closed the Legacy numeric-ID, owner-local zero, Calendar/Wrapped route-depth, per-sport canary,
Run Plus evidence, Activities DOM-parity, safe Chart-error, and finite training-zone style gaps.
The final reviewer then inspected the delta and cumulative R1 surface and returned **NO FINDINGS**.
The final local worktree gate also passed syntax (239), privacy, full tests (1,474/1,474),
diff-check, and exact-sixteen-path audit before the implementation commit.

Control-tower disposition is still required for two disclosed evidence facts before Ready: accept
the served per-owner delta plus the earlier direct 11-route pass after the second direct Chromium
stress run ended in V8 OOM, and accept the exact-baseline browser expectation corrections
(default Real mode is Canonical; unknown Canonical detail is `NOT_FOUND`). No seventeenth path or
product/detail behavior was used to resolve either item. This closure commit is Task-Brief-only;
its final SHA and CI result must be attached to the handoff after publication.

PR #32 remains Draft. No merge, cleanup, deploy, release, or R2 work is authorized here. R2 still
requires R1 Squash Merge, successful `integration/v2` push CI, and a separate task.
