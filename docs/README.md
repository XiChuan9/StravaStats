# StravaStats V2 documentation

| Field | Value |
| --- | --- |
| Status | Integrated release-candidate documentation; not a production release |
| Exact implementation baseline | `integration/v2@61d7b032305fd8f12d71544315f06d553213801d` |
| Package metadata | `1.0.0` (not a published V2 version) |
| Current evidence ledger | [PR-24 Task Brief](./tasks/pr-24-release-documentation.md) |

This directory contains durable product, architecture, migration, testing, and per-PR evidence for
the local-first V2 migration. Accepted ADRs, the PRD, engineering plan and release gates remain the
authority hierarchy. Historical `Proposed` status or an older baseline SHA in a durable record is
not automatically current release evidence.

## Release-candidate guides

- [Migration Guide](./guides/migration-guide.md) — physical isolation, First-run, modes, V4, and
  non-destructive rollback.
- [Backup Guide](./guides/backup-guide.md) — exact-current backup, 256 MiB bound, protected restore,
  and recovery statuses.
- [Known Limitations](./guides/known-limitations.md) — blockers, unverified matrices, and deferred
  product capabilities.
- [Privacy Guide](./guides/privacy-guide.md) — local data, Diagnostics versus Backup, external
  boundaries, and synthetic evidence rules.
- [Troubleshooting](./guides/troubleshooting.md) — executable non-destructive recovery steps and
  safe error codes.
- [Repository changelog](../CHANGELOG.md) — merged V2 work grouped by milestone, with no invented
  tag, publication date, or deployment.

## Authority and engineering

- [Product requirements](./product/stravastats-v2-prd.md)
- [V2 development plan](./engineering/v2-development-plan.md)
- [Release gates](./engineering/release-gates.md)
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
- [PR-24 release-gate ledger](./tasks/pr-24-release-documentation.md)

Task Brief statuses capture their point-in-time workflow. A merged first-parent integration commit
is stronger evidence of inclusion than stale phrases such as “Draft” or “Ready handoff pending” in
an older Task Brief. Neither fact is production release authorization.
