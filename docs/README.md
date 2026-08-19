# StravaStats public local-import core documentation

| Field | Value |
| --- | --- |
| Status | Public Local Import Core scope freeze; not an Alpha, Beta, Release Candidate, production release, publication, hosting, or deployment |
| Exact scope-freeze base | `integration/v2@6924e7c77036c9a743f908936a28a2719936b726` (tree `7e771d4202e6b2be45521aaedf1fb0704fbf6426`) |
| Current public-scope authority | [Public Local Import Core Task Brief](./tasks/public-local-import-core-freeze.md) |
| Current integration gate | [Scope-freeze integration gate](./engineering/release-gates.md) |
| Pre-freeze historical evidence | [PR-24 point-in-time ledger and supplement](./tasks/pr-24-release-documentation.md#superseding-current-tree-ledger) |

This directory contains durable product, architecture, migration, testing, and per-PR evidence for
the local-first codebase. The scope-freeze Task Brief defines the current public product boundary.
The V2 PRD, development plan, old release roadmap, and older Task Briefs remain point-in-time
pre-freeze history; they do not declare current public functionality or authorize release work.
Accepted ADRs continue to govern the retained source-neutral contracts and Repository boundaries.

## Current public guides

- [Migration Guide](./guides/migration-guide.md) — physical isolation, First-run, modes, V6, and
  non-destructive rollback.
- [Backup Guide](./guides/backup-guide.md) — exact-current format 3/V6 backup, frozen format 1/V4
  and format 2/V5 restore profiles, 256 MiB bound, and protected recovery statuses.
- [Known Limitations](./guides/known-limitations.md) — blockers, unverified matrices, and deferred
  product capabilities.
- [Privacy Guide](./guides/privacy-guide.md) — local data, Diagnostics versus Backup, external
  boundaries, and synthetic evidence rules.
- [Troubleshooting](./guides/troubleshooting.md) — executable non-destructive recovery steps and
  safe error codes.
- [Repository changelog](../CHANGELOG.md) — the public scope freeze and earlier V2 milestones, with
  no invented tag, publication date, or deployment.

The retained current tree includes the reviewed privacy/network hardening, Service Worker policy,
Source Manager authorization/identity/provider/recovery contracts, and explicit Retry for eligible
failed local imports. These are bounded code/test facts, not release or deployment evidence. The
[integration gate](./engineering/release-gates.md) records the scope-freeze checks; its preserved
G1-G13 material is labeled pre-freeze history and is not a live release route.

## Pre-freeze product planning and current engineering references

- [Product requirements](./product/stravastats-v2-prd.md) — pre-freeze point-in-time product plan
- [V2 development plan](./engineering/v2-development-plan.md) — pre-freeze point-in-time plan
- [Scope-freeze integration gate and preserved release history](./engineering/release-gates.md)
- [Architecture overview](./architecture/overview.md)
- [Git/worktree workflow](./engineering/git-worktree-workflow.md)

## Accepted architecture decisions

- [ADR-0001: Canonical Activity](./architecture/adr/0001-canonical-activity.md)
- [ADR-0002: Stream model](./architecture/adr/0002-stream-model.md)
- [ADR-0003: Repository boundary](./architecture/adr/0003-repository-boundary.md)
- [ADR-0004: Import Pipeline](./architecture/adr/0004-import-pipeline.md)
- [ADR-0005: Analysis versioning](./architecture/adr/0005-analysis-versioning.md)
- [ADR-0006: Source provenance](./architecture/adr/0006-source-provenance.md)

All six are Accepted. Acceptance of a contract does not assert that production release gates,
cross-browser tests, deployment, Service Worker rollout, or real-data validation are complete.

## Migration and rollback records

- [IndexedDB V2 record](./migrations/indexeddb-v2.md)
- [Legacy cache rescue record](./migrations/legacy-cache-rescue.md)
- [Rollback plan](./migrations/rollback-plan.md)

The records above preserve historical decisions and task updates. Use the current
[Migration Guide](./guides/migration-guide.md) and [Backup Guide](./guides/backup-guide.md) for
operator steps.

## Testing and PR evidence

- [Test strategy](./testing/test-strategy.md)
- [Regression matrix](./testing/regression-matrix.md)
- [Fixture policy](./testing/fixture-policy.md)
- [Task Brief index](./tasks/README.md)
- [PR-24 historical release-gate ledger](./tasks/pr-24-release-documentation.md)

Task Brief statuses capture their point-in-time workflow. Older Task Briefs and merged integration
commits remain evidence of their historical scope only; they do not override the current public
scope-freeze Task Brief. Neither history nor the current freeze is production release authorization.
