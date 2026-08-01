# PR-04A：汇总页面消费者迁移

## Metadata

| Field | Value |
| --- | --- |
| Status | Investigating |
| Base branch | `integration/v2` |
| Base SHA | `2178858f29d6c8efe5cf45de5ff07443387d2577` |
| Feature branch | `codex/v2/summary-consumers` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/summary-consumers` |
| Owner | XiChuan9 |
| Reviewer | Control tower + independent review |
| Related PRD | Sections 4.1, 5, 8.4, 8.6, 11.2, 19 |
| Related plan | Sprint 2 / PR-04A |
| Related ADRs | ADR-0003 (Accepted) |
| Dependencies | PR-00, PR-01, PR-02, and PR-03 merged into `integration/v2` |
| Pull request | Pending creation as Draft |
| Investigation Gate | In progress |
| Implementation Gate | Not approved |
| Implementation | Not started |
| A3 | Pending control-tower approval |

## Goal

Determine the smallest safe migration that routes the summary-page consumers through the
PR-03 Repository boundary or an explicit application-layer read context while preserving
all observable output, analysis, navigation, and visual behavior.

## Why now

PR-03 has implemented the Legacy/Demo Repository, Factory, Connector boundary, cache
ownership, success envelope, and error contract. ADR-0003 requires consumers to stop
choosing providers, stores, caches, and APIs. PR-04A is the first consumer migration and
also owns the browser application-path verification deferred by PR-02 and PR-03.

## Investigation questions

- Which listed summary consumers actually depend on provider APIs or provider-owned cache?
- Where do initialize, refresh, Demo, authentication, metadata, and preprocessing flows
  currently cross source/storage boundaries?
- Should the composition root construct one Repository per page session or per operation?
- Should tabs receive Repository methods or already-loaded detached data/read context?
- How should `data`, `source`, `warnings`, and `partial` be adapted without exposing private
  payloads or changing UI output?
- Which activity, athlete, zone, and gear reads/writes become redundant after PR-03 cache
  ownership moves into LegacyRepository?
- How can browser-native ESM, application-path, network, storage, Cache Storage, IndexedDB,
  and Service Worker gates run against isolated synthetic/offline state?
- What exact files and tests are minimally necessary for implementation?

## Confirmed current-state facts

- `integration/v2` and `origin/integration/v2` both resolve to the fixed base SHA above.
- ADR-0003 is Accepted and requires Repository/read-projection consumer boundaries.
- PR-03 freezes seven Repository methods and the exact success envelope
  `{ data, source, warnings, partial }`.
- PR-03 keeps activities cache ownership in `main.js` only until PR-04A; the implemented
  LegacyRepository is cache-aware and owns the future read/write path.
- PR-02/PR-03 browser dynamic-import and application-path checks remain `Not run` and are
  explicitly carried into PR-04A.
- A0 baseline evidence and the complete consumer investigation will be recorded in A2.

## Decisions required before implementation

- Repository lifecycle and the point at which `sessionMode` is frozen.
- Whether main injects detached data/read context or tabs receive a Repository reference.
- Exact success-envelope adaptation, safe observability, warning, partial, and error policy.
- Exact initialize/refresh/Demo/auth call-count contracts.
- Exact gear/metadata injection boundary and ownership of user custom gear metadata.
- Exact browser verification execution surface and merge-blocking subset.
- Exact Allowed files and B1/B2/B3 phase scope.
- Whether any new public Repository capability is required. If so, stop for control-tower
  decision; PR-04A must not implement it without separately frozen authorization.

## In scope

- Read-only inventory of `main.js`, Dashboard, Activities, Calendar, Run/Bike/Swim summary,
  Map, Gear, Wrapped, `js/tabs/index.js`, and `js/tabs/api.js`.
- Read-only call-graph, direct API/storage boundary, cache ownership, output parity, browser
  carry-over, testing, risk, and minimal-scope analysis.
- Design-only candidate rules for `js/tabs/AGENTS.md`; do not create it in A0-A2.
- A0-A2 documentation updates to this Task Brief only.

## Out of scope

- Product or test implementation before A3 and separately authorized B phases.
- PR-04B detail pages under `js/pages/**`.
- PR-04C `js/tabs/run-plus.js` and Run Plus / NSM.
- Trends (`js/tabs/athlete.js`), Planner, Weather, AI Chat, analysis changes, visual changes,
  routing, copy, HTML, CSS, and Service Worker changes.
- Canonical Repository/IndexedDB v2, import/decoder/storage/migration, shadow writer,
  parity framework, feature-mode expansion, server proxy hardening, version/dependency update.
- Real Strava network, credentials, accounts, private fixtures, or browser-profile data.

## Candidate allowed files

A2 will narrow this candidate pool with evidence. None is approved for implementation yet:

```text
docs/tasks/pr-04a-summary-consumers.md
js/tabs/AGENTS.md
js/app/main.js
js/tabs/dashboard.js
js/tabs/activities.js
js/tabs/calendar.js
js/tabs/run-analysis.js
js/tabs/bike-analysis.js
js/tabs/swim-analysis.js
js/tabs/maps.js
js/tabs/gear.js
js/tabs/wrapped.js
js/tabs/index.js
js/tabs/api.js
tests/consumers/<exact-files-to-be-decided>
necessary evidence-backed existing Legacy/Demo regression test
```

## Prohibited files and operations

During A0-A2 every repository path except this Task Brief is prohibited. In particular:

```text
AGENTS.md
js/tabs/AGENTS.md
js/app/main.js
js/tabs/**
tests/**
package.json
package-lock.json
index.html
styles/**
sw.js
api/**
.github/**
js/repository/**
js/connectors/**
js/data/**
js/services/**
js/demo/**
js/pages/**
js/analysis/**
js/models/**
js/shared/**
docs/architecture/**
docs/product/**
docs/engineering/**
docs/migrations/**
all other Task Briefs
```

Also prohibited: rebase, amend, force-push, merge, Ready conversion, branch/worktree deletion,
real tokens/network/accounts/private data, private fixture enumeration, existing browser-profile
mutation, Legacy cache deletion, IndexedDB v2 creation, migration, dependency changes, and
`git add .` / `git add -A`.

## Interfaces and expected outputs

- Existing public Repository entry remains `js/repository/index.js`.
- Existing factory remains `createRepository({ sessionMode, mode: 'legacy' })`.
- Existing public methods and `{ data, source, warnings, partial }` success envelope remain
  unchanged unless the control tower separately approves a contract expansion.
- Summary consumers must preserve activity order, filters, totals, chart datasets, maps,
  labels, empty/error behavior, Demo output, DOM identifiers/classes, routes, and styles.
- Provider-owned activity/athlete/zones/gears data must originate from Repository/read context.
- UI preferences and user overrides may remain in UI-owned storage only with an explicit,
  documented boundary; Demo must never fall back to real provider storage.

## Acceptance criteria

- A0 evidence includes exact SHAs, ahead/behind, object-existence audit, actual results from
  all five baseline commands, and final clean V2 status.
- A2 contains the ten-consumer matrix, current/target call graphs, static audit, storage
  classification, Repository lifecycle/envelope/error recommendation, call-count matrix,
  gear injection, output parity, browser plan, tests, risks, exact candidate Allowed files,
  prohibited files, phased proposal, decisions, and `Not run` items.
- Investigation Gate is complete; status becomes `Awaiting decision`.
- Implementation Gate remains unapproved; Implementation remains `Not started`; A3 remains
  pending control-tower approval.
- Only this Task Brief differs from the fixed base after A2.
- Draft PR remains Draft and is neither marked Ready nor merged.

## Required automated checks

At A0 and after each documentation commit, record actual results for:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Also audit exact changed/staged/untracked paths and wait for GitHub Actions at each pushed
head. Future implementation tests are to be decided in A2 and require A3 approval.

## Manual/browser verification

A2 will produce an executable isolated synthetic/offline plan for native browser ESM imports,
exact validator exports/calls, application-path module loading, network instrumentation,
local/session storage, IndexedDB, Cache Storage and Service Worker snapshots, plus Manual
DevTools evidence. Nothing not actually run may be reported as Pass.

## Privacy and security impact

A0-A2 are documentation-only. They read no real Token, account, activity, GPS, heart-rate,
power, device, private fixture, or existing browser-profile data. No external activity data
or payload is logged. Browser probing, if any, must use an isolated fresh profile and fully
synthetic/offline inputs.

## Migration impact

A0-A2 perform no migration, do not create IndexedDB v2, and do not read, modify, clean, or
delete Legacy cache or any existing browser storage.

## Rollback procedure

The only repository change in A0-A2 is this Task Brief in ordinary commits. Roll back with an
ordinary revert commit. Do not delete the branch or worktree as an investigation rollback and
do not clear any browser or Legacy storage.

## Independent review checklist

- [ ] Fixed base/local/remote/worktree/branch/PR audit is complete.
- [ ] Five A0 baseline commands passed with actual evidence.
- [ ] Only this Task Brief changed in A0-A2.
- [ ] Consumer inventory and current/target call graphs are evidence-backed.
- [ ] Provider, UI preference, user override, and Demo storage are distinctly classified.
- [ ] Repository lifecycle, success envelope, errors, and call counts are explicit.
- [ ] Gear and metadata injection preserves custom data and observable output.
- [ ] Browser carry-over plan is executable and does not use a real profile or private data.
- [ ] Test plan is deterministic, offline, dependency-free, and does not claim Node as browser.
- [ ] Exact candidate Allowed and Prohibited files are justified.
- [ ] P0/P1/P2 risks, privacy, migration, rollback, and `Not run` evidence are complete.
- [ ] Implementation Gate remains unapproved and no B phase has started.

## Completion evidence

Pending A0/A1/A2 evidence.

## Stop conditions

Stop immediately if the fixed base differs, V2 is dirty, a same-name object/PR exists, a
baseline or CI fails, any non-Task-Brief diff appears, real credentials/private data/profile
access is needed, provider-vs-UI ownership cannot be determined, Repository public API or
Repository/Connector/Factory changes are required, a dependency or prohibited path is needed,
or PR base/head/Draft state is wrong. Preserve evidence; do not self-expand scope.
