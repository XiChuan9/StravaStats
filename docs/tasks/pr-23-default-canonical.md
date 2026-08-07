# PR-23: Default Canonical Repository

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M20 / PR-23 |
| Status | A2 complete; proposed seven-path A3 allowlist awaiting control-tower freeze |
| Branch | `codex/v2/default-canonical` |
| Base | `integration/v2` at `3d8e17c5fab243b8605d5ddd1ca99450675ed5d8` |
| Draft PR title | `refactor(v2): make canonical repository the default` |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Change the production default `dataRepositoryMode` from `legacy` to `canonical` after an
evidence-first investigation proves the complete runtime selection graph and an exact literal
implementation allowlist is approved. Explicit Real `legacy`, `shadow`, and `canonical` modes must
remain executable; Demo must remain isolated before any Real Store or provider dependency is
constructed; and every Legacy, V2, backup, and user-owned setting must remain intact.

The default must not imply that Canonical data already exists. An absent or empty V2 library must
follow the accepted local-first and First-run behavior safely. An existing V2 library must start
and remain browsable without Token, provider auth, or network access. A Legacy-only library must
remain available through explicit Legacy rollback without automatic copying, migration, repair,
deletion, overwrite, or reverse-copy behavior.

PR-23 changes no Repository, Storage, Import, Backup, Diagnostics, Canonical, decoder, analysis,
Worker, Service Worker, deployment, or release contract. It does not start PR-24, merge a branch,
release or deploy the application, or clean up branches, worktrees, profiles, or user data.

## A0 exact baseline evidence

- The assigned isolated worktree began clean and detached at exact SHA
  `3d8e17c5fab243b8605d5ddd1ca99450675ed5d8`.
- Local `integration/v2`, `origin/integration/v2`, and the worktree HEAD resolved to the same exact
  SHA before feature-branch creation. `git diff --check` and the worktree status were clean.
- GitHub PR #28, `feat(v2): add diagnostics and performance gates`, was verified `MERGED` into
  `integration/v2` at `2026-08-07T04:12:14Z`; its merge commit is the exact required base SHA.
- The feature branch `codex/v2/default-canonical` was created from that exact detached base in this
  worktree. `main`, `maintenance/v1`, and the locked `integration/v2` worktree were not modified.
- Untouched-base verification passed: `npm ci`; syntax for 237 files; privacy; full suite
  1,451/1,451; and `git diff --check`.
- No real activity, FIT, TCX, GPX, Strava ZIP, GPS route, heart-rate or power value, account,
  credential, Token, Authorization value, export, screenshot, private fixture, user profile, or
  user browser state was read.

## A1 publication rule

The first feature-branch commit contains only this Task Brief. It must be pushed normally and used
to open a Draft PR targeting `integration/v2` before A2 investigation results or implementation
are committed. A GitHub write failure or 403 is delegated directly to the control tower as a
structured GitHub-write handoff; the user's Chrome login and browser profile are never used.

The PR remains Draft through implementation, actual served-browser evidence, independent review,
and Final Review Closure. Final Review Closure must be a later Task-Brief-only commit. Ready for
review is a post-Closure control-tower operation after exact-head CI succeeds and is not merge
authorization.

## Authority and inherited frozen contracts

Conflicts are resolved in this order: accepted ADRs, the product PRD, engineering plan and release
gates, this Task Brief, then implementation details. Proposed ADRs and historical conversations
are evidence only and cannot freeze an undecided contract.

PR-23 inherits and preserves the accepted PR-15 through PR-22 boundaries:

- `DEFAULT_FEATURE_FLAGS` accepts only the established exact flag shape and the Real Repository
  modes `legacy`, `shadow`, and `canonical`. Runtime overrides must continue to fail closed.
- Demo selection takes precedence over Real Store, Repository, Legacy, shadow writer, provider,
  Token, auth, network, Worker, and platform dependency construction.
- Explicit Real `legacy` continues to use the accepted Legacy read path. Explicit Real `shadow`
  continues to use Legacy reads plus the accepted best-effort shadow observation/write behavior.
  Explicit Real `canonical` continues to use only the accepted local Canonical read path.
- Local-first bootstrap inspects local V2 and Legacy state before auth. An absent or empty V2
  library is not an error and must not be presented as existing Canonical data. An unproved local
  state must fail closed rather than invent emptiness.
- The Repository remains exactly seven public methods. Storage, Import, Backup, Diagnostics, and
  Canonical public exports and physical schema remain unchanged.
- Missing or absent values, literal `null`, real zero, negative zero, and opaque string identifiers
  remain distinct wherever the accepted contract distinguishes them. IDs are never parsed,
  numerically normalized, or arithmetically coerced.
- Summary, detail, Run Plus, and NSM consumers select data only through their accepted public
  composition boundaries. Pages and analysis code may not select persistence or provider-specific
  behavior directly.
- Provider, auth, Token, and network absence or failure cannot prevent startup or browsing of an
  existing local Canonical library and cannot trigger destructive local-data behavior.
- Disconnecting Strava and deleting local data remain separate actions. No Legacy IndexedDB, V2
  IndexedDB, backup, or user-owned setting may be deleted, cleared, repaired, overwritten,
  downgraded, migrated, automatically copied, or reverse-copied by this PR.
- No new dependency, public API, schema/store/index/version, migration, decoder, analysis formula,
  Worker protocol, Service Worker behavior, deployment, release, or PR-24 documentation scope is
  allowed without a separate material decision and explicit approval.

## A2 read-only investigation gate

Before any production or test implementation change, read-only evidence must trace the actual
served call graph and freeze the precise default-canonical product contract. The investigation
must establish:

1. every declaration, clone, validation, override, read, and consumer of
   `DEFAULT_FEATURE_FLAGS` and `dataRepositoryMode`, including absent, malformed, accessor, Proxy,
   extra-key, stale-value, and document/runtime override behavior;
2. the root local-first bootstrap sequence from module import through Demo/Real orchestration,
   local V2 and Legacy inspection, First-run/Dashboard/blocked dispatch, Source Status and Source
   Manager navigation, and auth/provider startup;
3. the exact Demo, Legacy, Shadow, and Canonical construction and read graph, including whether
   storage, provider, Token, auth, network, Worker, timers, console, or DOM I/O occurs at import,
   construction, bootstrap, dispatch, or first read;
4. actual summary, Router/detail, Run Plus, and NSM mode selection and reads, including missing,
   `null`, real zero, opaque string IDs, optional capability degradation, and error rendering;
5. Source Manager, Import, Backup/Restore, and Diagnostics entry and composition boundaries,
   including whether any surface assumes Legacy, Canonical existence, provider availability, or a
   connected account;
6. behavior for absent V2, empty readable V2, existing V2-only data, Legacy-only data, both
   libraries, locally unreadable or inconsistent state, damaged settings/overrides, and storage
   denial or failure;
7. behavior when Token is absent or invalid, provider/auth startup fails, the provider is
   unavailable, or the browser is offline, proving that local Canonical startup and browsing do
   not depend on those boundaries;
8. the non-destructive rollback path for explicit Legacy and Shadow, with proof that selecting or
   reverting modes does not mutate, migrate, clear, repair, overwrite, or reverse-copy either
   library, backups, or user-owned settings;
9. the smallest collision-free literal exact cumulative path allowlist, the failure-first test
   matrix, deterministic synthetic actual-served disposable-profile browser plan, privacy proof,
   migration impact, rollback evidence, and cross-PR regression set.

The A2 record must distinguish source facts, executed evidence, and inference. Presence and absence
claims require evidence. No implementation path is allowed merely because changing the default
appears to be a one-line edit.

## A2 evidence and actual call graph

The read-only investigation completed against exact base behavior before any production or test
implementation change. The following focused baseline set passed 405/405:

```text
tests/feature-flags.test.js
tests/bootstrap/local-first-bootstrap.test.js
tests/bootstrap/local-first-bootstrap-boundaries.test.js
tests/repository/repository-factory.test.js
tests/shadow/shadow-app-integration.test.js
tests/consumers/summary-consumers.test.js
tests/consumers/summary-boundaries.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/run-plus-canonical-cutover.test.js
tests/source-manager/source-manager-boundaries.test.js
tests/backup/backup-boundaries.test.js
tests/diagnostics/diagnostics-boundaries.test.js
```

Source inspection and those executed tests establish this actual selection graph:

```text
module import
  -> DEFAULT_FEATURE_FLAGS / Factory / page imports perform zero storage, Token,
     provider, network, Worker, timer, or DOM I/O at the guarded boundaries

root document
  -> isDemoMode() exactly once
  -> Demo: runLocalFirstBootstrap(sessionMode='demo')
       -> Demo dispatch before Real inspection or dependency construction
       -> createRepository({sessionMode:'demo', mode:'legacy'}) -> DemoRepository
  -> Real + effective canonical:
       -> initializeApp(null) without Legacy bootstrap, Token read, auth, or provider startup
       -> createSummaryRepositorySession -> createRepository(real, canonical)
       -> CanonicalRepository -> existing Canonical Store -> local listActivities
       -> summary tabs receive projected activities
       -> Run Plus / NSM receive the same frozen narrow session façade
  -> Real + effective legacy or shadow:
       -> V2-first local-first inspection plus accepted Legacy read/status inspection
       -> First-run / blocked / Dashboard dispatch
       -> explicit Legacy activities enter the existing Legacy summary façade
       -> shadow remains Legacy read; only accepted network success may enqueue best-effort shadow

activity Router and four detail documents
  -> determine Demo once
  -> Real reads effective feature flags once
  -> canonical maps to CanonicalRepository; legacy/shadow map to LegacyRepository
  -> Demo maps to DemoRepository before Real dependencies
  -> DetailReadSession supplies summary/detail/streams/laps/zones/athlete to renderers

Source Manager / Backup / Diagnostics
  -> do not read dataRepositoryMode
  -> Source Manager uses its explicit ?mode=real|demo Import composition
  -> Backup uses its explicit Real/Demo session boundary and frozen V2/settings APIs
  -> Diagnostics uses its session error/performance records and origin estimate only
```

`getFeatureFlags()` has one runtime override seam: the own data descriptor
`globalThis.__STRAVASTATS_FEATURE_FLAGS__`. The override must be an ordinary exact-key data object;
accessors, Proxies, symbols, extra keys, non-enumerable properties, invalid prototypes, and invalid
values fail closed without getter execution. There is no persisted mode setting and no provider,
auth, URL, LocalStorage, IndexedDB, or network lookup in flag resolution.

The Repository Factory deliberately keeps its separate omitted-mode fallback as `legacy`; PR-23
does not change that lower-level safety contract. Every production Real composition root passes an
explicit mode derived from the application feature flags. Demo selection precedes that Real mode
and the Factory returns DemoRepository regardless of the passed Real-mode value.

## A2 frozen product behavior matrix

| Context | Effective mode/read | Startup and empty behavior | Forbidden side effects |
| --- | --- | --- | --- |
| No runtime override | Canonical | Existing V2 starts locally; absent/empty V2 navigates exact `/source-manager.html?mode=real` after one local Canonical summary read and before metadata/analysis | No Legacy read, Token/auth/provider/network startup, copy, repair, clear, or migration |
| Explicit `canonical` | Canonical | Same contract as the production default | No shadow writer or Legacy fallback |
| Explicit `legacy` | Legacy | Accepted local-first inspection; Legacy data starts through its detached façade; empty state enters First-run | No V2-to-Legacy copy, V2 delete, or Legacy rewrite |
| Explicit `shadow` | Legacy read plus accepted shadow observation/write | Same local-first and rollback behavior as Legacy; existing shadow write remains best effort and only observes accepted network success | Canonical never becomes the read source; shadow failure never changes Legacy success |
| Demo with any Real flag | DemoRepository | Demo dispatch occurs before Real inspection/dependency construction | Zero Real V2/Legacy/provider/auth/Token/network/Worker construction or reads |
| Invalid/hostile/absent override shape | Canonical default | Fail closed to the frozen production default without executing accessors | No error detail disclosure or recovery mutation |
| Canonical Store/list failure | Safe blocked Dashboard error path | Fixed Diagnostics code and safe UI; no retry or provider fallback | No raw cause, Token, payload, ID, or private data disclosure |
| Provider/auth/Token/network failure or offline | Canonical local behavior unchanged | Existing local V2 remains startable and browsable; absent/empty V2 keeps local Source Manager usable | No provider request is required to determine local availability |

For default or explicit Canonical, a zero-length successful `source: "canonical"` summary envelope
is the precise First-run signal. The redirect occurs immediately after validating the Repository
envelope and before `getAthlete`, `getZones`, `getGears`, preprocessing, tab rendering, Run Plus,
NSM, or any provider/auth boundary. Missing/absent values, literal `null`, real zero, negative zero,
and opaque string IDs are not involved in this count and retain their existing projections.

The base currently lacks that zero-length Canonical redirect because explicit Canonical bypasses
the Legacy-aware bootstrap to preserve zero Legacy reads and calls `initializeApp(null)` directly.
Changing only the default literal would therefore render an empty Dashboard. The smallest
collision-free repair is a root-composition guard after the existing validated Canonical
`listActivities` result. Changing the local-first inspection result shape or exposing Canonical
records/counts is unnecessary and prohibited.

Source Manager, Import, Backup/Restore, and Diagnostics already use independent accepted public
boundaries and do not consult the Repository-mode flag. Summary, Router/detail, Run Plus, and NSM
already route explicit Canonical end to end. No schema, public API, dependency, decoder, algorithm,
Worker, Service Worker, deployment, release, migration, automatic Legacy copy, provider/auth, or
PR-24 change is required. There is therefore no material A/B/C decision package.

## Material decision and pause gate

If A2 shows that completion requires any physical schema, public API, dependency, Canonical
contract, Repository method, Storage/Import/Backup/Diagnostics export, decoder, analysis algorithm,
Worker protocol, Service Worker, deployment, release, data migration, automatic Legacy copy,
provider/auth requirement, destructive data action, or PR-24 scope change, prepare an A/B/C
material decision package for the control tower and pause.

The package must include source and runtime evidence, the exact collision, failure behavior,
privacy and data impact, migration and rollback impact, literal candidate paths, recommendation,
and tradeoffs. No material option may be implemented without explicit approval.

## A3 implementation gate and proposed literal scope

A2 proposes exactly these seven cumulative paths for investigation evidence, implementation,
tests, browser evidence, findings-first repairs, and Final Review Closure:

```text
docs/tasks/pr-23-default-canonical.md
js/app/feature-flags.js
js/app/main.js
tests/feature-flags.test.js
tests/consumers/run-plus-canonical-cutover.test.js
tests/default-canonical.test.js
tests/default-canonical-browser-smoke.html
```

The seven-path list is a hard maximum with no glob and no implicit generated file. It keeps the
Factory's omitted-mode Legacy fallback, local-first result schema, Repository/Storage/Import/
Backup/Diagnostics exports, physical schema, detail and tab modules, user-owned settings, Worker,
Service Worker, dependencies, deployment, release, and PR-24 outside the diff.

Implementation remains prohibited until the control tower freezes this exact list and behavior
matrix. Any eighth path, future-hostile boundary collision, or uncovered contract gap requires the
smallest control-tower supplement and pauses implementation.

After approval, each behavior change begins with a test that fails for the intended reason on the
exact PR-22 base behavior. Findings-first repair follows the same rule: reproduce each actionable
finding with a failing test, then make the smallest allowlisted fix.

## Minimum failure-first matrix

The frozen matrix must cover at least:

- literal default `canonical` and explicit Real `legacy`, `shadow`, and `canonical`;
- Demo precedence with zero Real Store, Legacy, shadow, provider/auth, Token, or network work;
- absent/empty V2 First-run and Source Manager behavior without invented Canonical data;
- existing V2-only direct local startup and browsing without provider/auth/Token/network;
- Legacy-only safe explicit rollback with no copy, deletion, overwrite, repair, or migration;
- both libraries present with deterministic explicit mode selection and no cross-library mutation;
- damaged or hostile settings/overrides and local storage failures failing closed with redacted
  errors;
- summary, activity Router/detail, Run Plus, and NSM actual routing in every applicable mode;
- missing/absent values, literal `null`, real zero, negative zero, and opaque string IDs;
- import-time and startup proof of zero Repository/provider/storage/auth/network I/O leakage;
- provider/auth/Token/network/offline failure not affecting local Canonical availability;
- Backup/Restore, Import, Source Manager, and Diagnostics preserving their accepted public and
  persistence boundaries.

## Verification and evidence requirements

Required evidence includes:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Additionally run focused tests, relevant cross-PR regressions, a literal scope audit, and a fresh
remote depth-1 checkout of the exact pushed feature head with the required checks. Tests and
browser fixtures must be deterministic and synthetic and must require no network, Strava
credential, Token, account, or private fixture.

Actual-served browser evidence must use a disposable isolated profile and synthetic data and cover
default Canonical, explicit Legacy and Shadow, Demo, First-run, V2-only local startup,
provider/offline failure, summary, detail, Run Plus, and NSM. Record the external-resource baseline
and prove that no real provider request, credential, user profile, or private activity/GPS/health/
power data is used. A browser-policy exception is requested once through the control tower and is
never worked around with the user's browser state.

After implementation evidence passes, a genuinely independent findings-first review must inspect
the exact diff, contracts, privacy, rollback, runtime selection, browser evidence, and test gaps.
After all actionable findings are repaired failure-first, a fresh independent review must report
no actionable findings.

## Privacy, migration, rollback, and completion

- **Privacy:** only deterministic synthetic fixtures and redacted evidence are permitted. No real
  credentials, account, browser profile, provider payload, activity, filename, route/GPS,
  heart-rate, power, device, athlete, Token, Authorization value, raw cause, or private fixture may
  be read, written, logged, committed, or sent externally.
- **Migration:** none. PR-23 adds no schema, store, index, version, migration, data copy, repair,
  clear, overwrite, downgrade, or reverse-copy operation. All Legacy, V2, backup, and user-owned
  settings remain intact.
- **Rollback:** explicitly select `dataRepositoryMode: "legacy"` to restore the accepted Legacy
  Repository read path, or ordinarily revert this PR. Explicit `shadow` remains a Legacy read with
  accepted best-effort observation/write semantics. Neither operation deletes or rewrites either
  local library or backup.
- **Completion:** Final Review Closure is a Task-Brief-only commit after all local, fresh checkout,
  actual-served browser, privacy, rollback, and fresh independent-review evidence passes. Push the
  closure commit, require exact-head CI success, and delegate PR-body/Ready handling to the control
  tower. Then send the control tower a clear Squash Merge authorization package and stop until
  explicit merge authorization. Ready is not merge authorization.
- **Not claimed:** no production deploy/release, real provider/auth test, real private-data test,
  merge, integration push, PR-24 work, branch/worktree cleanup, or user-data cleanup is performed by
  this PR before separate authorization.
