# PR-43a: Synthetic Provider Bundle Mapper

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C3a pure provider mapper |
| Status | A0/A1 Task Brief frozen; implementation prohibited pending A2 and explicit A3 |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@92a735fb4d4809173c5fddf868416bf44642faed` |
| Exact base tree | `568cf2457f418130ec0a6641478eb45a60e676c1` |
| Feature branch | `codex/v2/provider-bundle-mapper` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr43a/StravaStats` |
| Parent decision | PR-43 / `D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A` |
| Parent Draft | PR #49 |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Freeze the separately approvable C3a contract for a pure, deterministic, synthetic-only Strava
provider mapper. C3a accepts an injected synthetic authorization/identity snapshot and bounded
synthetic provider records, proves exact SourceConnection subject/scope authorization before
mapping, and returns accepted `ImportedActivityBundle` values without network, Token, storage,
Worker, DOM, or provider side effects.

This Task Brief is the only authorized A0/A1/A2 write. No mapper, fixture, test, ImportService,
Source Manager, auth, provider, storage, backup, or server implementation is authorized until the
owner separately approves the completed C3a A3 package.

## Authority

The owner selected verbatim:

> 批准 D-C3.1 A + D-C3.2 B + D-C3.3 A + D-C3.4 A

For C3a this freezes only:

- injected deterministic synthetic authorization/identity authority;
- a pure bounded summary + detail + supported-stream mapping contract;
- at most 100 activities per foreground acquisition and at most two concurrent per-activity
  operations in the later orchestrator;
- deterministic reduced provider input and `ImportedActivityBundle` output; and
- separate C3a, C3b, and C3c approvals.

It does not authorize C3a implementation, C3b provider-artifact/ImportService integration, C3c live
read/auth/UI, OAuth, Token, account/provider/private evidence, schema/public/dependency/Worker/
Service Worker/server changes, Ready, merge, cleanup, deployment, release, or any data mutation.

## Frozen cumulative candidate maximum

The C3a candidate hard maximum is exactly these eight literal paths:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
js/connectors/strava/strava-import-mapper.js
tests/connectors/strava-import-mapper.test.js
tests/fixtures/synthetic/strava/api-import-fixture.js
tests/fixtures/synthetic/strava/README.md
tests/contracts/imported-activity-bundle.test.js
tests/import/import-boundaries.test.js
tests/privacy/privacy-guard.test.js
```

No ninth path is authorized. The Task Brief is the only path allowed before a separate explicit A3.
If A2 finds that a listed path is unnecessary it remains unused; it may not be replaced implicitly.
If a necessary path is absent, stop and return a minimum collision decision.

## A2 read-only audit

A2 must verify from exact current code/tests/docs:

1. `ImportedActivityBundle`, Canonical activity/streams, ActivitySource, DeviceReference, warning,
   version, JSON-safety, opaque-ID, null/missing/zero, unit, timestamp, and capability contracts.
2. Current Strava connector envelopes and operations only as shape inputs; no call may be issued.
3. C2 SourceConnection identity/status/CAS boundaries and the exact synthetic session/subject/scope
   check that occurs before mapper input is accepted.
4. Deterministic bounded collection semantics: maximum 100 activity inputs, concurrency-two promise
   scheduling contract for the later orchestrator, exact ordering, supported streams, detail/lap
   reduction, unknown-field policy, and input/output non-mutation.
5. Fixed safe warning/error/cancellation behavior, including malformed/hostile values, partial
   optional capability degradation, and fatal identity/authorization failures.
6. Existing test locations, module/export boundaries, privacy guard behavior, fixture rules, and
   literal eight-path collision surface.
7. Failure-first tests, actual-served disposable synthetic browser evidence, migration/data/privacy/
   rollback impact, and the boundary between synthetic completion and later private evidence.

Findings precede the frozen implementation contract. A2 may update only this Task Brief.

## Global invariants

- The mapper is a pure injected module: no fetch/XHR/WebSocket, Token/Web Storage, IndexedDB,
  Worker, DOM, timer, console, process environment, provider route, or import-time side effect.
- Synthetic subject/provider/activity/device values are deterministic inventions, never derived from
  a real account/export. No precise location, realistic health/power trace, credential, header, raw
  provider error, or private payload enters Git, CI, diagnostics, DOM, or logs.
- Authorization is fail closed and precedes provider-record inspection. Token presence,
  ActivitySource provenance, and Canonical records never establish identity.
- Mapper output is exactly one accepted, deeply detached/frozen `ImportedActivityBundle` per accepted
  input activity. It performs no persistence, hashing, artifact creation, dedup, Import job/report,
  SourceConnection transition, or analysis.
- Legacy, Demo, Shadow, Canonical storage, local file/ZIP imports, Backup, Diagnostics, Repository,
  Service Worker, and C4 remain untouched.

## A1 publication contract

The first commit changes exactly:

```text
docs/tasks/pr-43a-provider-bundle-mapper.md
```

Draft PR title:

```text
feat(v2): define synthetic provider bundle mapper
```

Draft PR body:

```markdown
## What changed

Adds the C3a Task Brief for the synthetic-only provider-to-ImportedActivityBundle mapper contract.

## Why

The owner selected the staged C3 contract, but mapper authorization, identity, normalization, privacy, and evidence semantics require a separate bounded A3 before implementation.

## Impact

Docs only. No mapper implementation, ImportService integration, live provider/auth/UI, Token/account/private data, schema/public API, dependency, Worker, Service Worker, server, deployment, or release change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of
A1.

## Verification

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

After A2, push normally, verify true remote depth-1 exact head and exact-head CI, and keep the PR
OPEN/Draft. Return the bounded C3a A3 implementation authorization package to control tower.
