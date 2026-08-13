# Changelog

This file records merged repository changes. It does not claim a package publication, Git tag,
GitHub Release, deployment, or production release.

## Unreleased — local Alpha candidate work

The exact pre-G12 integration source baseline is
`integration/v2@57c2cdf9358afef1330d5a71f3799f18d41f6d13`, tree
`80224e924d4270c03f1c9b526ae4bb6d20326aa9`. PR #61's historical Final Review Closure and local
candidate-building evidence bind to commit `03ccf18c10c6bc146660920b81f409a7d9ca6a0e`. That commit
has the same tree but is a different Git object; its evidence is not integration-head or future G12
candidate evidence.

The package metadata is `2.0.0-alpha.1`. G13 is `PARTIAL`; G12 exact-candidate verification remains
`NOT RUN`. The owner-approved Option A sequence freezes at most one exact G12 commit, but this
document neither identifies that commit nor predicts a later squash identity. Only after every
post-freeze gate passes may the exact-SHA PR/check-run/control-tower ledger become the canonical
verification record.
This is not a public Alpha, Beta, Release Candidate, or production release. There is no
`v2.0.0-alpha.1` tag, GitHub Release, publication, hosting, deployment, or exact-object
release-owner approval.

The G13 implementation adds a deterministic stdlib-only build/verify/loopback-serve tool, exact
Node/npm pins, external-only candidate outputs and the single missing Dashboard-background repair.
It changes no Service Worker, cache, storage, schema, Legacy, provider or private-data behavior.

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
- PR-24 documents the then-integrated code candidate and its remaining release blockers. It does not
  publish, tag, deploy, or approve V2.

### Release hardening after PR-24

- R3-R11 removed the identified current-tree identity, redacted reviewed server/client logging,
  added explicit consent and bounded egress for weather, AI Coach and maps, constrained the Service
  Worker to approved static assets, made the Legacy presence probe non-destructive, disabled runtime
  telemetry and replaced third-party visualization CDN loading with pinned same-origin assets.
  R3 current-tree closure does not resolve the separate public Git history incident.
- D3 added the deterministic waiting/drained-client Service Worker code lifecycle and immutable
  current cache contract. Production-like update, mixed-version, cold-offline, deployment and
  combined rollback evidence remains unrun.
- C1-C4 added explicit Source Manager authorization, durable source identity and format 3/V6 Backup
  portability, bounded provider mapping/import and `Sync latest 25`, plus one shared lock and
  durable recovery lease with explicit Recover/Abandon.
- PR #57 added explicit Retry for eligible failed local imports from exact retained pending bytes.
  Retry is user-triggered, single-use, shares the C4 lock/lease, preserves committed items, performs
  no provider acquisition, and never starts automatically.

These merged code/test changes do not close authorized real account/private-library/Disconnect/
parity evidence; Safari, Firefox, Windows, iOS/PWA, mobile or broad accessibility evidence; the R3
public Git history decision; production-like Service Worker/deployment/rollback rehearsal;
performance budgets or waiver; version/tag/artifact; or release-owner approval.

## Preserved V1 baseline

The baseline tag and `maintenance/v1` remain separate from V2 integration. V2 does not upgrade,
copy, clear, or overwrite Legacy storage in place. See the
[Migration Guide](./docs/guides/migration-guide.md) and
[Known Limitations](./docs/guides/known-limitations.md).
