# Public Local Import Core Scope Freeze

## Metadata

| Field | Value |
| --- | --- |
| Status | Implementation authorized; release and deployment are not authorized |
| Public repository | `XiChuan9/StravaStats` |
| Feature branch | `codex/public/local-import-core` |
| Base ref | `origin/integration/v2` |
| Base commit | `6924e7c77036c9a743f908936a28a2719936b726` |
| Base tree | `7e771d4202e6b2be45521aaedf1fb0704fbf6426` |
| Data migration | None |
| Storage schema change | None |
| Repository or Import API change | None |
| License change | Not part of this pull request |

## Purpose

Freeze the public StravaStats product line around the source-neutral local
import core already present at the exact base above. This task removes the Run
Plus and NSM product surfaces from the public current runtime without replacing
them, redesigning the application, changing analysis algorithms, or continuing
V2 feature development.

The complete pre-freeze tree was verified before implementation through two
private backup branches, one annotated private backup tag, and a complete local
Git bundle. Private repository locations and private user data are not public
documentation.

## Public scope

The public current product retains:

- the existing source-neutral sports analytics and visualization pages;
- Canonical activities and streams;
- the IndexedDB V2 local library;
- Repository, Projection, and Source Manager boundaries;
- local FIT and TCX import;
- the already integrated generic CSV, ZIP, and GPX import paths;
- Exact Identity, duplicate handling, Backup/Restore, and Diagnostics;
- the optional Strava source and the existing Legacy, Shadow, Canonical, and
  Demo compatibility boundaries; and
- CI, privacy, Service Worker, logging, DOM, opaque-ID, and general security
  hardening.

## Private scope removed from the public current runtime

The public tree no longer exposes:

- Run Plus or NSM pages;
- Run Plus or NSM navigation, tabs, routes, callbacks, state, or styles;
- Run Plus or NSM runtime modules;
- tests dedicated only to those product surfaces; or
- documentation that presents those surfaces as current public functionality.

Historical records may retain either a concise scope-freeze notice or clearly
labeled, non-runtime point-in-time content. Such records must not claim that a
former private extension is current public functionality or disclose a private
repository address.

## Literal allowed paths

Only the following paths may change for this scope freeze. Deleting a listed
path is permitted where explicitly required below; listing a path does not
require changing it.

```text
docs/tasks/public-local-import-core-freeze.md

index.html
js/app/main.js
js/tabs/AGENTS.md
js/tabs/index.js
js/tabs/run-plus.js
styles/run-plus.css
scripts/local-dev-server.mjs
scripts/alpha-candidate.mjs

tests/public/local-import-core-freeze.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/run-plus-canonical-browser-smoke.html
tests/consumers/run-plus-canonical-cutover.test.js
tests/consumers/run-plus-consumers.test.js
tests/consumers/run-plus.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/summary-browser-smoke.html
tests/consumers/summary-consumers.test.js
tests/default-canonical-browser-smoke.html
tests/default-canonical.test.js
tests/docs/release-docs.test.js
tests/legacy/demo-isolation.test.js
tests/pages/main.test.js
tests/privacy/client-logging.test.js
tests/privacy/root-privacy-disclosure.test.js
tests/release/alpha-candidate.test.js
tests/server/local-dev-server.test.js
tests/shadow/shadow-boundaries.test.js

README.md
CHANGELOG.md
docs/README.md
docs/architecture/overview.md
docs/engineering/git-worktree-workflow.md
docs/engineering/release-gates.md
docs/engineering/v2-development-plan.md
docs/guides/known-limitations.md
docs/guides/migration-guide.md
docs/guides/privacy-guide.md
docs/product/stravastats-v2-prd.md
docs/tasks/pr-00-repository-safety.md
docs/tasks/pr-01-legacy-cache-rescue.md
docs/tasks/pr-03-legacy-repository.md
docs/tasks/pr-04a-summary-consumers.md
docs/tasks/pr-04b-detail-consumers.md
docs/tasks/pr-04c-run-plus-consumers.md
docs/tasks/pr-05-indexeddb-v2-schema.md
docs/tasks/pr-06-shadow-canonical-writer.md
docs/tasks/pr-16-canonical-summary-cutover.md
docs/tasks/pr-17-canonical-detail-cutover.md
docs/tasks/pr-18-run-plus-nsm-cutover.md
docs/tasks/pr-19-exact-identity.md
docs/tasks/pr-22-diagnostics-performance.md
docs/tasks/pr-23-default-canonical.md
docs/tasks/pr-24-release-documentation.md
docs/tasks/pr-26-dom-safety.md
docs/tasks/pr-30-client-log-redaction.md
docs/tasks/pr-35-ai-coach-consent.md
docs/tasks/pr-36-map-location-boundary.md
docs/tasks/pr-39-root-privacy-disclosure.md
docs/tasks/pr-47-final-v2-release-roadmap.md
docs/tasks/pr-50-analysis-profile.md
docs/tasks/pr-53-real-import-consumer-numeric-hardening.md
docs/tasks/pr-54-global-map-canonical-routes.md
docs/testing/regression-matrix.md
```

The four `tests/consumers/run-plus*` files and the two dedicated task documents
are deletion candidates. Generic coverage in mixed test files must be preserved
or moved before any dedicated test is removed.

## Prohibited paths and changes

Unless a direct compilation failure is first reported and separately approved,
this task must not modify:

```text
js/data/contracts/
js/decoders/fit/
js/decoders/tcx/
js/decoders/gpx/
js/import/
js/storage/
js/repository/
js/backup/
js/connectors/
js/pages/source-manager/
api/
source-manager.html
storage-backup.html
package-lock.json
sw.js
```

The task also must not change Decoder Registry behavior, Canonical contracts,
Repository or Import APIs, analysis formulas, IndexedDB version/schema,
migrations, backup format, Service Worker cache generation, Strava API
behavior, feature development, application framework, or `LICENSE`.

`js/tabs/run-analysis.js` remains unchanged unless a direct compilation failure
proves a smaller edit is unavoidable. Its generic scoped-rendering seam may
remain even when the former embedded consumer is removed.

## Data invariants

- Legacy and Canonical data are never deleted, copied, repaired, rewritten, or
  migrated by this scope freeze.
- IndexedDB V2 version, schema, stores, indexes, migrations, and persisted
  records remain byte-for-byte outside this task's changed paths.
- Disconnect, source removal, local-data deletion, and this UI removal remain
  separate operations.
- Backup/Restore remains additive and keeps its existing format and compatibility
  boundary.
- Existing Cache Storage entries are not cleared or migrated. Removing a
  public asset reference does not authorize a Service Worker cache change.
- Tests and browser evidence use only deterministic synthetic fixtures. No real
  Token, account, activity, route, health value, export, screenshot, filename,
  or private fixture enters Git or logs.

## LocalStorage non-deletion rule

The public runtime stops using the following historical user-owned settings,
but this task must not read, remove, rename, rewrite, migrate, or exclude them
from the existing Backup/Restore and Legacy rescue compatibility boundaries:

```text
run_plus_capacity_inputs_v1
run_plus_nsm_settings_v1
run_plus_nsm_activity_tags_v1
run_plus_nsm_session_inputs_v1
run_plus_nsm_tests_v1
run_plus_nsm_interval_analysis_v1
```

Tests may inspect source-level allowlists to prove non-deletion, but must not
read a user's browser storage.

## Automated verification

The untouched base and the final implementation both require:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Final focused verification additionally covers FIT and TCX decoders, Registry
wiring, all Import, Storage, and Repository tests, and a literal changed-path
guard against the prohibited areas. Scope regressions prove:

- root HTML has no Run Plus navigation, tab, or stylesheet;
- the tabs index and main runtime no longer import, export, route, or call the
  removed product surface;
- retired routes do not render private content or cause a runtime exception;
- ordinary `/run` behavior remains available;
- FIT and TCX remain accepted by Source Manager and flow through Import and
  Repository to Activities;
- no IndexedDB migration is introduced;
- the six historical LocalStorage keys are not deleted; and
- Demo, Legacy, Shadow, and Canonical boundaries remain intact.

Every remaining case-insensitive Run Plus/NSM search hit must be reported. Only
concise scope-freeze notices and non-runtime point-in-time historical records
that do not claim current public functionality may remain.

## Actual-browser acceptance

Browser evidence uses a fresh disposable profile, a new loopback port, and only
synthetic tracked fixtures. It must not reuse a personal profile, real activity
file, real Token, credential, or existing private library.

Acceptance covers application startup; Source Manager; synthetic FIT and TCX
imports; exact duplicate behavior; Activities, Dashboard, Run, and one Activity
Detail with streams; Backup and Diagnostics; retired routes; absence of deleted
asset requests; zero console errors; and zero external data upload. Before and
after counts for Legacy, V2, LocalStorage, and Cache Storage must show no
destructive reduction attributable to this change.

## Delivery and rollback

Implementation uses at most four non-squashed logical commits: this Task Brief,
runtime removal, test reconciliation, and public documentation reconciliation.
No amend, rebase, force-push, history rewrite, merge, release, tag, deployment,
Alpha, Beta, RC, or production claim is authorized.

Rollback is an ordinary reverse-order `git revert` of the public-scope commits.
It does not delete branches, rewrite history, clear caches, remove LocalStorage
keys, or change Legacy/Canonical data. The verified private refs and complete
local bundle are independent recovery evidence, not public runtime dependencies.

After final verification, the feature branch may be pushed normally and a Draft
PR may be opened against `main`. The PR must remain Draft and unmerged. Its
description must record exact base/head, scope, backup verification, unchanged
data/schema, automated and browser evidence, limitations, rollback, no-release
status, and unchanged license status.
