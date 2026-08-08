# PR-32: Non-destructive Legacy Presence Probe

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R10 |
| Status | Approved for investigation and implementation under the frozen gates below |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/legacy-presence-probe` |
| Exact base | `integration/v2@4efccfe030aa263cc4727fe110ca058b37d3ff30` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependency | R9 PR #37 Squash Merged; integration push CI run `31245240740`, job `93072639116`, reported successful by the control tower |
| Pull request | Expected Draft PR #38; Ready transition authorized only after final Closure gates |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal and authority

Close release blocker P0-09 by making every Legacy presence/readiness probe strictly read-only.
Abort, error, blocked, unsupported, descriptor-hostile, concurrent, and late-event schedules must
never delete, clear, overwrite, repair, upgrade, create-and-compensate, or otherwise mutate Legacy,
V2, settings, Cache Storage, Service Worker state, provider state, or user data. Any state that cannot
be safely proved fails closed as unknown/unavailable and cannot establish First-run or first-login.

This task preserves the Legacy and Shadow rollback paths and keeps Demo at zero Real I/O. It does
not change physical schema/version/migration, Repository, Storage, Import, Backup, Diagnostics,
provider/auth semantics outside the presence decision, analysis, dependencies, Service Worker,
deployment, release, R6 weather, R7 AI, R8 maps, or R11 telemetry/CDN.

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Proposed documents and the
historical release-readiness audit are required evidence but do not freeze an undecided browser or
First-run compatibility contract.

## A0 exact-base evidence

- The assigned worktree began detached and clean at exact SHA
  `4efccfe030aa263cc4727fe110ca058b37d3ff30` with local/origin integration divergence `0/0`.
- Integration push CI run `31245240740`, job `93072639116`, was reported successful by the control
  tower. Remote verification is required again before Closure.
- Untouched local gates passed: `npm ci`; syntax for 243 files; privacy; full tests 1602/1602;
  `git diff --check`; clean status.
- No real credential, account, provider/private activity, Legacy record, GPS, heart-rate, power,
  setting value, private fixture, export, screenshot, browser profile, or user database was read.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It must be pushed and used to open a
Draft PR targeting `integration/v2` before production or test implementation is committed. A GitHub
authorization failure is delegated to the control tower and does not authorize Chrome, interactive
login, or the user's browser profile.

Until A2 records the complete call graph and freezes the minimum decision package, the cumulative
write allowlist is exactly:

```text
docs/tasks/pr-32-legacy-presence-probe.md
```

## A2 findings-first investigation contract

Read-only audit must freeze:

1. every Legacy presence, readiness, rescue, auth-lifecycle, local-first bootstrap, first-login,
   First-run, Legacy/Shadow rollback, and Demo call path;
2. every use of `indexedDB.databases`, `open`, `onupgradeneeded`, `onblocked`, `abort`, `error`,
   `success`, `close`, `versionchange`, and `deleteDatabase` in that graph;
3. Legacy IndexedDB store/key count reads and localStorage fallback classification;
4. existing tests that expect creation compensation, deletion, empty/absent equivalence, or another
   destructive or fail-open outcome;
5. the exact source -> probe -> classification -> bootstrap/auth decision -> side-effect graph;
6. the supported-browser evidence needed to treat `indexedDB.databases()` absence or rejection as
   anything other than unknown.

Evidence is limited to deterministic synthetic categories, paths, state classes, counts, and safe
code. It never reads or emits real identifiers, records, settings, activity values, browser profile
state, or private storage contents.

## Frozen default implementation contract

- The presence probe is read-only: no `deleteDatabase`, `clear`, readwrite transaction, `put`,
  upgrade, repair, overwrite, cache mutation, or storage write.
- A safely preflighted existing compatible Legacy database may be opened without a version, read
  only for the minimum store/key count, and immediately closed.
- Confirmed absent and confirmed empty remain distinguishable internal classifications even if the
  current public compatibility envelope is retained.
- Blocked, abort, error, timeout, late success, unsupported, malformed, non-finite, accessor,
  Proxy, reflection failure, and any unproved state return unknown/unavailable.
- A missing database must never be probed by an `open()` that can create it. Creation followed by
  deletion is prohibited compensation.
- `indexedDB.databases()` absence, rejection, or unsafe output defaults to unknown. Any different
  compatibility or First-run fallback requires a material owner decision and must be delegated.
- An unknown/unavailable probe cannot establish First-run or first-login and cannot authorize a
  Token write or other persistent state change.
- Demo performs zero Real storage, provider, network, Cache Storage, or Service Worker I/O.
- Legacy data and explicit Legacy/Shadow rollback remain intact.

## A2 findings and approved minimum decision package

The source-to-decision graph has two independent Real paths:

```text
OAuth response
  -> js/app/auth.js browserAuthLifecycle
  -> inspectLegacyIndexedDbPresence
  -> localStorage key-name inspection
  -> Legacy IndexedDB presence/count inspection
  -> acceptOAuthTokenResponse
  -> identity guard
  -> firstLogin or blocked Token write

Real application startup
  -> inspectLocalFirstBootstrap
  -> Canonical presence inspection
  -> readLegacyIndexedDb
  -> readLegacyLocalStorage
  -> dashboard | first-run | blocked
```

The auth probe treated `indexedDB.databases()` as an optimization. Missing/rejected enumeration fell
through to `open(LEGACY_DB_NAME)`. A missing-database upgrade was aborted, but an abort failure and
late success invoked `deleteDatabase`; the existing test explicitly required that deletion before
returning confirmed absent. This is the direct P0-09 defect.

The bootstrap Rescue Reader had the same preflight gap: it opened the name without first proving
that the database existed. A missing-database upgrade attempted abort; abort failure could leave a
new empty Legacy database after the reader returned an error. Bootstrap itself correctly maps a
reader error to `blocked`, but that safe classification did not prevent the storage mutation.

The control tower approved the descriptor-safe preflight contract on 2026-08-08. After independent
review proved that IndexedDB has no atomic "open existing only" primitive, the user explicitly chose
compatibility Option B. The cumulative literal implementation allowlist is frozen to:

```text
docs/tasks/pr-32-legacy-presence-probe.md
js/app/auth-lifecycle.js
tests/legacy/auth-lifecycle.test.js
tests/bootstrap/local-first-bootstrap.test.js
tests/bootstrap/local-first-bootstrap-boundaries.test.js
js/services/legacy-cache/reader.js
tests/legacy/legacy-cache-rescue.test.js
```

For both chains, `indexedDB.databases()` missing, rejected, throwing, malformed, non-finite,
descriptor-hostile, accessor, Proxy, or otherwise unsafe means unknown/unavailable. It must perform
zero `open` and cannot establish first-login or First-run. Only a descriptor-safe complete database
list that explicitly contains the Legacy name may authorize an unversioned open followed by the
minimum readonly inspection and close. A descriptor-safe list that omits the name proves absence
without opening it. No shared public module/API, schema, dependency, provider, or unrelated release
surface is approved. Any further path requires a new minimal failure-evidence package and approval.

### Accepted IndexedDB residual

Option B preserves Legacy Rescue and valid-empty authentication/First-run behavior. After a safe
`databases()` result explicitly reports the Legacy database, the probe may issue one unversioned
`open`, perform only the minimum readonly store/key count, and close. There is one accepted residual:
if another context deletes that database after the safe preflight but before `open`, and the
resulting `onupgradeneeded` transaction can no longer be aborted, the browser may leave a version 1
database with zero object stores and zero user records. This residual must be classified unknown or
unavailable and must not establish first-login or First-run.

The residual never authorizes compensation. Production probe and Rescue Reader code must contain
zero `deleteDatabase` calls and must never clear, repair, overwrite, upgrade, or write Legacy, V2,
settings, cache, or user data. Missing, rejected, throwing, or descriptor-hostile enumeration still
performs zero `open`. Any broader residual requires a new material decision.

## Failure-first acceptance matrix

Tests must cover existing compatible DB, absent DB, valid empty DB, malformed store, old/current/
future version descriptors, blocked, abort, error, timeout, late success/error, concurrent close and
versionchange, `databases()` missing/rejecting/non-array/non-finite/descriptor-hostile results, and
accessor/Proxy inputs. They must prove:

- `indexedDB.deleteDatabase`, IDB delete/clear/write/upgrade, localStorage/sessionStorage writes,
  Cache Storage, Service Worker, provider, fetch, and network calls are exactly zero;
- database names, counts, and versions are unchanged before and after every probe schedule except
  the single accepted preflight-delete plus abort-failure residual above; that test must instead
  prove the only possible remainder is version 1 with zero stores and zero user records;
- failure and unproved states do not trigger First-run/first-login or persistent writes;
- compatible existing Legacy data is detected without reading activity payloads;
- imports and Demo paths remain side-effect free and all mutated globals are restored.

## Required verification and Closure

Run the smallest focused tests after each failure-first change, then:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

If deterministic Node evidence cannot prove actual browser scheduling, use only an actual-served
disposable browser with a fresh profile and origin plus deterministic synthetic Legacy/V2 sentinels.
Record only database names, versions, counts, and state categories; prove before/after equality and
zero deletion/upgrade. Never use a user profile or login.

Closure additionally requires true remote depth-1 exact-head evidence, exact-head CI, an independent
findings-first review, failure-first repairs, a fresh no-findings re-review, and a Task-Brief-only
Closure update. After all gates pass, the PR body may be updated and Draft may transition to Ready
without further authorization. Squash merge, cleanup, deploy, release, and starting R6 remain
unauthorized.

## Privacy, migration, and rollback impact

No real data or private browser state is used. This task changes no physical schema, database
version, migration, Repository, Storage, Import, Backup, Diagnostics, provider, Service Worker, or
deployment contract. Rollback is an ordinary code revert while preserving both Legacy and V2 data;
the destructive probe behavior must not be restored as a production rollback.

## Pause and delegation boundary

Pause and delegate the minimum evidence package to the control tower if completion requires real
credentials/account/private data, user data deletion/repair/migration, a browser-support or
First-run product choice, architecture-level change, or a path beyond the frozen hard maximum. A
GitHub App 403 is delegated immediately. Do not use the user's Chrome/login, merge, clean retained
R3/R4/R5/R9 branches or worktrees, deploy, release, or start another release-hardening package.
