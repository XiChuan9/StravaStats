# PR-27: Detail and Gear Persistent DOM Safety Hardening

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M23 / PR-27 / R2 |
| Status | Approved for implementation; in progress |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/dom-safety-detail-gear` |
| Exact base | `integration/v2@7787ee707c167cca02ba9fd1c1606c94fc2d1411` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/09e9/StravaStats` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependencies | PR #32 R1 squash merged; integration push CI success |
| Pull request | Draft PR to be created after Task-Brief-only first commit is pushed |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Close the production-reachable persistent DOM XSS, dynamic inline-handler, unsafe URL, direct-query
reflection, and Leaflet tooltip sinks owned by Generic/Run/Bike/Swim detail and Gear renderers. Keep
the R1 root-summary seam, DOM structure, classes, copy, routes, algorithms, storage ownership, and
Legacy/Canonical rollback behavior unchanged.

## Why now

PR #32 completed R1 root-summary hardening and was Squash Merged into `integration/v2` at the exact
base above. GitHub Actions push run `31181307923` completed successfully for that exact SHA. R2 is
the strictly ordered follow-up required to prevent direct detail and gear URLs from bypassing the
R1 rendering contract.

## A0 exact-base evidence

- The worktree began detached and clean at `7787ee707c167cca02ba9fd1c1606c94fc2d1411`.
- Local `integration/v2`, `origin/integration/v2`, and `HEAD` were identical with divergence `0/0`.
- GitHub App reports PR #32 closed and Squash Merged with merge commit equal to the exact base.
- Push workflow run `31181307923` is `CI`, event `push`, branch `integration/v2`, exact head SHA,
  status `completed`, conclusion `success`.
- The complete PR #32 squash diff and its sixteen changed paths were read. R1 Closure remains only
  in `docs/tasks/pr-26-dom-safety.md`; PR-27 will not modify, reopen, or replace it.
- `docs/tasks/pr-25-release-readiness-audit.md` is absent from the integration tree but was read
  from its historical `codex/v2/release-readiness` branch. Its R2 candidate and current repository
  numbering both select PR-27; the file is not copied into this branch.
- Untouched-base `npm ci`, syntax, privacy, diff-check, and clean-status checks passed. The first
  full `npm test` attempt was interrupted after an extended high-count run and is not a pass; the
  complete suite remains a mandatory implementation and closure gate.

No real Token, Authorization value, provider response, account, browser profile, activity, GPS,
heart-rate, power, export, screenshot, private fixture, Legacy library, or V2 library was read.

## A1 hard boundary

The cumulative R2 hard allowlist is exactly these thirteen paths:

```text
docs/tasks/pr-27-detail-output-hardening.md
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

Any fourteenth path is a literal-scope collision and a pause condition. Expansion requires a
failure-first minimal collision package stating the failing command/assertion, why no allowed path
can close it, the exact additional path, behavior/contract impact, verification, privacy/data
impact, migration/rollback impact, and control-tower decision required.

## In scope

- Independently re-trace the exact-base source -> validation -> persistence -> Repository or
  page-local read -> projection -> renderer graph for every R2 owner.
- Freeze and repair Generic activity name/info rendering.
- Freeze and repair Run/Bike/Swim gear links.
- Freeze and repair supported-Legacy best-effort and segment name/ID tables.
- Freeze and repair Gear cards for name, brand, model, opaque ID, navigation, and dynamic inline
  handlers.
- Freeze and repair direct Gear not-found query reflection and Gear detail hero/input/activity
  list output.
- Freeze and repair Leaflet Gear tooltip content.
- Add deterministic failure-first regression evidence in the six approved existing test owners.
- Execute focused, full, syntax, privacy, diff, disposable actual-served browser, remote depth-1,
  independent review, Closure, and exact-head CI gates.

## Out of scope

- R1 owners, R1 Task Brief/Closure, or PR #32 state.
- HTML entries, Activity Router, DetailReadSession, Repository/cache ownership, Import, Decoder,
  schema, Storage, persistence, migration, backup, analysis algorithms, exports, Weather, AI,
  Service Worker, CSS, product copy, route names, deployment, release, or dependencies.
- Sanitizer packages, a shared public helper, or a general output-safety abstraction.
- Ready transition, merge, cleanup, deploy, release, or any later R/P package.

## Approved rendering contract

1. Dynamic scalar text uses `textContent` or `createTextNode`.
2. Dynamic structures use `createElement`, fixed element/attribute names, and
   `replaceChildren`/`append`.
3. Dynamic inline handlers are removed and replaced by `addEventListener` with exact values held
   in closures or inert properties.
4. Internal activity links use the current served origin, pathname
   `/html/activity-router.html`, and exactly one `id` query serialized with `URLSearchParams`.
5. Internal gear links use the current served origin, pathname `/html/gear.html`, and exactly one
   `id` query serialized with `URLSearchParams`.
6. Segment links use only `https://www.strava.com/segments/` plus an encoded single path
   component. No field may select a scheme, host, or alternate path prefix.
7. New-window links use `rel="noopener noreferrer"`.
8. Leaflet receives a DOM node/text node, never a name-bearing HTML string.
9. Opaque strings are preserved byte-for-byte. No trimming, parsing, numeric conversion,
   normalization, sanitizing rewrite, truthy fallback, or identity manufacture is allowed.
10. Each owner must preserve its existing distinction among absent, `null`, string `"0"`, string
    `"000123"`, numeric `0`, and `-0`; no cross-owner semantic unification is authorized.
11. Direct query strings remain untrusted even when R1 normally constructs the navigation.

## A2 investigation questions

For every candidate sink, record the actual served entry, source field, transformations,
validation, persistence/read boundary, projection, DOM/URL/JavaScript/Leaflet context,
exploitability, exact owner-local missing/zero behavior, safe primitive, and parity risk.

The independent exact-base inventory must include:

```text
js/pages/activity/activity.js
  generic activity name/info
  Legacy best-effort/segment name and ID tables

js/pages/run/run.js
  gear hero link
  Legacy best-effort/segment name and ID tables

js/pages/bike/bike.js
  gear hero link
  Legacy best-effort/segment name and ID tables

js/pages/swim/swim.js
  gear hero link and any detail-owned dynamic output

js/tabs/gear.js
  card name/brand/model/id, gear URL, and inline onclick

js/pages/gear/gear-analysis.js
  direct not-found query reflection
  hero, edit input, activity list, inline window.open, and Leaflet tooltip
```

Search hits are candidates, not findings. Constant HTML, fixed closed vocabularies, safely reduced
errors, canvas-only labels, and unreachable helpers must be classified separately.

## Failure-first canary contract

Tests use only inline deterministic synthetic values and independently cover:

- opening/closing tags and event-bearing markup;
- double quote, single quote, backtick, backslash, parentheses, comments, U+2028, and U+2029;
- dynamic inline JavaScript breakouts;
- URL-reserved `? # % & = + /` values and Unicode;
- scheme-like `javascript:`, `data:`, and `//outside.invalid` strings;
- `__proto__`, `constructor`, and `prototype` as own keys and opaque identities;
- combining marks, bidi/control text, astral emoji, and normalization lookalikes;
- missing, `null`, string `"0"`, string `"000123"`, numeric `0`, and `-0`.

Each repair must have a pre-repair failing assertion or executable failure proof. The final tests
must assert exact visible text/identity, no injected node/attribute/handler, no canary execution,
no unexpected popup/navigation/request, fixed route origin/path, exactly one `id`, safe new-window
rel, and unchanged owner-local absent/null/zero presentation.

## Acceptance criteria

- Every exact-base R2 P0 sink is closed in its owner file with the approved native primitive.
- Direct crafted detail and Gear URLs cannot bypass the root-summary seam.
- Generic, Run, Bike, Swim, Gear card, Gear detail/list, segment, and Leaflet tooltip paths retain
  structure, classes, copy, routes, ordering, algorithms, charts, maps, and empty-state behavior.
- No dynamic inline handler remains in repaired owned output.
- No sanitizer dependency or shared public helper is added.
- Changed paths equal the literal thirteen-path allowlist or an approved smaller subset.
- Findings-first independent review is followed by failure-first fixes and a fresh no-findings
  re-review.
- The final documentation change is Task-Brief-only and records exact evidence without modifying
  the historical PR-26 Closure.
- The Draft PR head and its GitHub Actions CI are exact and successful.

## Required automated checks

```text
npm ci
node --test tests/consumers/detail-consumers.test.js tests/consumers/detail-boundaries.test.js tests/consumers/summary-consumers.test.js tests/legacy/demo-isolation.test.js
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

The two approved browser harnesses must also run through the repository's served deterministic
browser procedure. A static source assertion or injected-only seam is supporting evidence, not a
substitute for actual served navigation.

## Actual-served disposable browser gate

Use a fresh loopback port and disposable profile, install observation before the first navigation,
seed only deterministic synthetic Canonical and supported-Legacy data through accepted production
boundaries, and visit Router plus Generic/Run/Bike/Swim and Gear card/detail/direct-missing routes.
Exercise rerender, list click, back/direct navigation, segment links, edit input, and Leaflet
tooltip open. Record navigation/popups, Network/Fetch/XHR/WebSocket/EventSource, console/runtime,
IndexedDB names/versions and safe counts, Local/Session Storage key names, Cache Storage, and
Service Worker registrations.

Assert zero canary execution/injected nodes/attributes, unexpected navigation/popup, external or
provider request, Token/Authorization access, private-data log, and uncaught error. Assert exact
text and ID round-trip plus existing absent/null/0/-0 behavior. Stop the server/browser and remove
only the disposable profile. Never use user Chrome, login, real data, a private fixture, or a user
storage profile.

## True remote depth-1 and CI gates

After the implementation head and Closure head are pushed, clone the actual remote branch into a
new disposable directory with `--depth 1 --branch codex/v2/dom-safety-detail-gear`. Require exact
head SHA, history count one, clean status, install, syntax, privacy, focused tests, full tests, and
diff-check. Local `file://` evidence is not a relabelled true-remote pass. Confirm GitHub Actions on
the exact remote head concludes success.

## Privacy and security impact

The intended change removes executable DOM/parser contexts while preserving stored strings as
text/data. Tests are synthetic and deterministic. No Token, provider payload, precise real
location, activity, heart-rate, power, account, export, screenshot, private fixture, or raw cause
may enter source, logs, artifacts, browser evidence, or CI output.

## Migration impact

None. No schema, database version, persistence representation, backfill, cache rewrite, stored
value rewrite, data copy, deletion, cleanup, downgrade, reverse-copy, or provider state changes.

## Rollback procedure

Rollback is an ordinary PR revert. It does not delete or mutate Legacy/V2 data. Reverting R2 while
R1 remains would re-expose direct detail/Gear sinks, so release remains blocked until R2 is repaired
again. Do not clear storage, unregister broadly, or delete caches/databases as rollback.

## Independent review checklist

- Trace every changed dynamic source through the final DOM/URL/Leaflet context.
- Search all six production owners for remaining untrusted `innerHTML`, inline `on*`, URL
  interpolation, `window.open` strings, and string `bindTooltip`/`bindPopup` use.
- Verify direct-query defense independently from R1 navigation.
- Verify same-origin/path/exactly-one-query and fixed Strava segment prefix contracts.
- Verify every owner-local opaque/missing/null/string-zero/numeric-zero/negative-zero outcome.
- Verify classes, structure, copy, routes, ordering, algorithms, maps, charts, and inputs are
  unchanged except the approved event/URL mechanics.
- Verify literal path scope, privacy, migration, rollback, actual-served, remote depth-1, and CI
  evidence.

## Stop conditions

Pause and delegate a minimal decision package only for a material product/API/schema/dependency/
algorithm/Service Worker/destructive/private-data/browser exception or literal-scope collision.
If the GitHub App returns 403 for PR creation/update, delegate immediately to the control tower and
do not use Chrome, interactive login, or a user's browser session.

Stop finally at Ready-for-review handoff with the PR still Draft. Ready transition, merge,
cleanup, deploy, release, and starting another package require explicit control-tower/user
authorization.

## Completion evidence

To be appended after implementation, review, browser, remote-depth, Closure, and exact-head CI
finish. The appended record must distinguish PASS, FAIL, BLOCKED, and NOT RUN and name exact SHAs,
commands, counts, run IDs, changed paths, limitations, privacy/migration/rollback impact, and Draft
PR state.
