# StravaStats V2 documentation

| Field | Value |
| --- | --- |
| Status | Local Alpha candidate work; tracked G12 remains `NOT RUN`, and this is not a public Alpha, Beta, Release Candidate, or production release |
| Exact pre-G12 integration source baseline | `integration/v2@57c2cdf9358afef1330d5a71f3799f18d41f6d13`, tree `80224e924d4270c03f1c9b526ae4bb6d20326aa9` |
| Historical PR #61 Closure | `03ccf18c10c6bc146660920b81f409a7d9ca6a0e`; same tree as the integration squash but a distinct candidate-building commit whose evidence cannot be relabeled |
| Package metadata | `2.0.0-alpha.1` (G13 `PARTIAL`; G12 `NOT RUN`; no tag, GitHub Release, publication, hosting or deployment) |
| Post-freeze evidence | Only after every required post-freeze gate passes, the owner-approved exact-SHA PR/check-run/control-tower ledger is the canonical G12 verification record; no future candidate or squash identity is claimed here |
| Current authoritative roadmap | [V2 release gates](./engineering/release-gates.md) |
| Historical evidence | [PR-24 point-in-time ledger and supplement](./tasks/pr-24-release-documentation.md#superseding-current-tree-ledger) |

This directory contains durable product, architecture, migration, testing, and per-PR evidence for
the local-first V2 migration. Accepted ADRs, the PRD, engineering plan and release gates remain the
authority hierarchy. Historical `Proposed` status or an older baseline SHA in a durable record is
not automatically current release evidence.

## Current V2 guides

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
- [Repository changelog](../CHANGELOG.md) — merged V2 work grouped by milestone, with no invented
  tag, publication date, or deployment.

The Privacy Guide's pre-M34 R3 `BLOCKED` status sentence is superseded for release status only by
the Accepted [release-gates.md](./engineering/release-gates.md) roadmap. Its operational privacy and
incident-handling rules remain current; M34's five-path limit does not authorize editing that guide.

The exact pre-G12 integration source tree includes deterministic R3-R11 privacy/network hardening,
D3 Service Worker code lifecycle, C1-C4 Source Manager authorization/identity/provider/recovery
contracts, explicit Retry for eligible failed local imports, and the merged G13 candidate-building
tooling. These are bounded code/test facts, not evidence that a candidate has been frozen or that
every release environment is complete.

Use the [current authoritative release roadmap](./engineering/release-gates.md) for the exact
remaining Alpha and full-`v2.0.0` paths, owner dispositions, evidence classes and non-`PASS` rows.
PR-24 remains historical and must not be used as the live gate inventory.

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
- [PR-24 historical release-gate ledger](./tasks/pr-24-release-documentation.md)

Task Brief statuses capture their point-in-time workflow. A merged first-parent integration commit
is stronger evidence of inclusion than stale phrases such as “Draft” or “Ready handoff pending” in
an older Task Brief. Neither fact is production release authorization.
