# PR-25: Release Readiness Audit

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 M22 / PR-25 |
| Status | A1 scope and evidence contract frozen; A2 read-only audit authorized |
| Branch | `codex/v2/release-readiness` |
| Exact base | `integration/v2@e083fa0d55c8981f0258af546451ebb0d48e4fa4` |
| Allowed path | `docs/tasks/pr-25-release-readiness-audit.md` only |
| Product authority | Audit only; no production implementation or release action |

## A0 intake and authority

This task is a release-wide evidence audit. It does not authorize a production release, a product
or test change, a version bump, a tag, a GitHub Release, deployment, Service Worker rollout,
Ready-for-review transition, merge, cleanup, migration, provider access, or user-data operation.

The only baseline is the exact squash merge commit
`e083fa0d55c8981f0258af546451ebb0d48e4fa4`. Local Git identifies it as the single-parent commit
`docs(v2): complete release candidate documentation (#30)` with parent
`61d7b032305fd8f12d71544315f06d553213801d`. GitHub App evidence identifies PR #30 as merged into
`integration/v2`, with merge commit equal to the exact baseline. The integration push CI is GitHub
Actions run `31157822933`, workflow `CI`, run number 185, conclusion `success`.

The durable evidence hierarchy for this audit is:

1. accepted ADR-0001 through ADR-0006;
2. the V2 product requirements;
3. `docs/engineering/release-gates.md`;
4. `docs/engineering/v2-development-plan.md`;
5. the accepted PR-24 release documentation record;
6. `docs/guides/known-limitations.md` and current exact-base implementation/test evidence.

The PRD and release-gate documents still carry `Proposed` status. They remain required audit inputs
and release-blocking checklists, but cannot override an accepted ADR or be used to freeze an
otherwise undecided implementation contract.

## A1 frozen scope and untouched baseline

The cumulative hard maximum for this PR is exactly one path:

```text
docs/tasks/pr-25-release-readiness-audit.md
```

The baseline worktree was clean and detached at the exact base before branch creation. The following
untouched-baseline checks ran on 2026-08-07 in the assigned worktree:

```text
npm ci                    PASS (6 packages installed)
npm run check:syntax      PASS (239 files)
npm run check:privacy     PASS
npm test                  PASS (1,469/1,469)
git diff --check          PASS
worktree status           CLEAN
```

No real Token, authorization header, provider response, real account, private browser profile,
private activity, GPS track, heart-rate, power, FIT/TCX/GPX/ZIP export, or private Legacy/V2 library
may be read. Deterministic synthetic fixtures, source inspection, repository history, accepted
redacted evidence, isolated disposable-browser checks, and read-only local reproduction are the
only permitted evidence sources.

Legacy and V2 data must remain physically and logically preserved. Missing values must never become
zero, opaque IDs must remain strings, Disconnect and local deletion remain separate, and no audit
step may clear, migrate, repair, overwrite, downgrade, reverse-copy, or otherwise mutate user data.

## Stop and delegation boundary

Stop immediately if any changed path other than the frozen Task Brief appears, or if evidence
collection would require product code, tests, dependencies, package/version, workflow, schema,
Service Worker, deployment/release configuration, tag/Release/deploy, protected branch mutation,
provider access, private data, a real browser profile, or destructive storage/cache operations.

If the GitHub App returns 403 while creating or updating the Draft PR, report the exact blocker to
the control-tower task. Do not use Chrome, another interactive login, or a user's browser session.

Material findings are not implemented here. They become a decision package containing the conflict,
options, recommendation, exact candidate allowlist, dependencies, verification, rollback, privacy
and data impact, and explicit owner decisions. PR-25 remains Draft and stops after that handoff.

## A2 read-only audit plan

A2 will record every gate as exactly one of `PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, or
`NOT APPLICABLE`. Every row will cite authoritative evidence, identify the gap, state whether
deterministic synthetic or isolated-browser automation can close it, and identify evidence that
requires a real account/private library, production Service Worker/deployment, supported-browser
environment, or release-owner authorization.

The audit covers:

- Alpha, Beta, Release Candidate, and Production release gates plus PR/integration prerequisites;
- release-wide P0/P1 defect inventory against the current production entry graph;
- privacy, raw console/server logging, Token/Authorization and identifier handling;
- third-party CDN, telemetry, external-feature and exact date/location egress;
- Service Worker API caching, update, eviction, mixed-version, cold-offline, and rollback lifecycle;
- real-account disconnect, real import/private-library, parity and Shadow review evidence;
- supported browser/platform, PWA, accessibility, responsive and visual evidence boundaries;
- backup, migration, application, deployment and Service Worker rollback as one complete rehearsal;
- version/tag/artifact/deployment/approval evidence and release-owner roles.

Read-only reproduction may run repository tests, source-graph inspection, static searches, local
server checks, deterministic synthetic harnesses, or disposable isolated Chromium evidence. It may
not access a real provider, production deployment, user profile, private fixture, or user database.

## A2 result

Pending read-only audit.
