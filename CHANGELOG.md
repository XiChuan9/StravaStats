# Changelog

This file records merged repository changes. It does not claim a package publication, Git tag,
GitHub Release, deployment, or production release.

## Unreleased — V2 integration candidate

Exact documented baseline: `integration/v2@61d7b032305fd8f12d71544315f06d553213801d`.
The package remains `1.0.0`. The planned names `v2.0.0-alpha.1`, `v2.0.0-beta.1`,
`v2.0.0-rc.1`, and `v2.0.0` are release stages, not existing tags or artifacts.

### Repository safety, contracts, and migration foundations

- PR-00 established repository privacy guards, CI/test commands, feature-flag scaffolding, and a
  local-development Service Worker policy.
- [PR-01](./docs/tasks/pr-01-legacy-cache-rescue.md) added read-only Legacy rescue,
  deterministic export/validation/empty-target restore, and separated auth disconnect from local
  data deletion.
- [PR-02](./docs/tasks/pr-02-canonical-contracts.md) implemented and accepted the source-neutral
  Canonical Activity, Streams, Imported bundle, version, and provenance contracts.
- [PR-03](./docs/tasks/pr-03-legacy-repository.md) introduced the seven-method Repository boundary.
- [PR-04A](./docs/tasks/pr-04a-summary-consumers.md),
  [PR-04B](./docs/tasks/pr-04b-detail-consumers.md), and
  [PR-04C](./docs/tasks/pr-04c-run-plus-consumers.md) moved summary, detail, Run Plus, and NSM
  consumers behind Repository-owned composition boundaries.
- [PR-05](./docs/tasks/pr-05-indexeddb-v2-schema.md) created the physically isolated Canonical
  IndexedDB and additive migration framework.
- [PR-06](./docs/tasks/pr-06-shadow-canonical-writer.md) added best-effort Shadow writes and a
  redacted parity report without changing Legacy page reads.

### Local import and Source Manager

- [PR-07](./docs/tasks/pr-07-import-core.md) added the source-neutral Import Core, Worker boundary,
  durable jobs/items, and per-item transactional persistence.
- [PR-08](./docs/tasks/pr-08-activities-csv.md) added bounded English Strava
  `activities.csv` import.
- [PR-09](./docs/tasks/pr-09-strava-zip.md) added bounded Strava ZIP inspection and root
  `activities.csv` association.
- [PR-10](./docs/tasks/pr-10-source-manager.md) added the same-origin Sources UI, preflight,
  batching, progress, cancellation, Import Log, and activity preview.
- [PR-11](./docs/tasks/pr-11-fit-decoder.md),
  [PR-12](./docs/tasks/pr-12-tcx-decoder.md), and
  [PR-13](./docs/tasks/pr-13-gpx-decoder.md) added bounded local FIT, TCX, and GPX decoders.
- [PR-14](./docs/tasks/pr-14-decoder-registry.md) wired CSV, ZIP, FIT, TCX, and GPX through the
  production Registry/Worker/Import path with deterministic synthetic served evidence.

### Local-first consumer cutover

- [PR-15](./docs/tasks/pr-15-local-first-bootstrap.md) made startup inspect local state before auth,
  with explicit First-run, Dashboard, blocked, and Demo paths.
- [PR-16](./docs/tasks/pr-16-canonical-summary-cutover.md) cut summary consumers over to Canonical
  Repository projections.
- [PR-17](./docs/tasks/pr-17-canonical-detail-cutover.md) cut activity detail and local Streams over
  to Canonical reads with capability degradation.
- [PR-18](./docs/tasks/pr-18-run-plus-nsm-cutover.md) cut Run Plus and NSM over to the same Canonical
  session façade.

### Identity, review, backup, diagnostics, and default Canonical

- [PR-19](./docs/tasks/pr-19-exact-identity.md) added exact source/FIT identity resolution and the
  additive V3 provenance index.
- [PR-20](./docs/tasks/pr-20-duplicate-review.md) added bounded possible-duplicate review and the
  additive V4 candidate/decision stores; confirmation records intent without merging data.
- [PR-21](./docs/tasks/pr-21-backup-restore.md) added deterministic full V4 exact-current backup and
  protected absent/empty-target restore.
- [PR-22](./docs/tasks/pr-22-diagnostics-performance.md) added privacy-safe local Diagnostics,
  bounded session performance records, presentation-only Stream reduction, and disclosed synthetic
  performance gates.
- [PR-23](./docs/tasks/pr-23-default-canonical.md) made Canonical the default Real Repository mode,
  added empty-Canonical First-run behavior, and retained explicit Legacy/Shadow rollback.
- PR-24 documents the integrated release candidate and its remaining release blockers. It does not
  publish, tag, deploy, or approve V2.

## Preserved V1 baseline

The baseline tag and `maintenance/v1` remain separate from V2 integration. V2 does not upgrade,
copy, clear, or overwrite Legacy storage in place. See the
[Migration Guide](./docs/guides/migration-guide.md) and
[Known Limitations](./docs/guides/known-limitations.md).
