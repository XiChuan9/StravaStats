# Migration Guide

This guide explains how the integrated V2 candidate coexists with the preserved Legacy path. It is
an operator/user guide, not an instruction to publish or deploy V2.

## The essential rule: two physically separate libraries

Legacy and V2 are physically isolated:

| Library | Browser storage | Role |
| --- | --- | --- |
| Legacy | IndexedDB `strava-dashboard-cache` plus established Legacy localStorage keys | Preserved V1-compatible read and rollback path |
| V2 Canonical | IndexedDB `strava-stats-v2`, physical V5, schema `strava-stats-v2@5` | Current local-first default |

There is no automatic copy or migration from Legacy to V2. Opening V2, switching modes, importing a
file, disconnecting Strava, or rolling back does not clear, repair, overwrite, downgrade, or
reverse-copy either library. V2 never upgrades the Legacy database in place.

## Before changing modes or builds

1. Do not clear browser site data. That can remove both local libraries, settings, and backups that
   have not been saved outside the browser.
2. If V2 is readable, create and safely store a current [V2 backup](./backup-guide.md).
3. If Legacy is the only valuable copy, use the accepted Legacy Rescue/export path and verify its
   private export before any deployment change. Real Legacy recovery remains a release-gate item;
   do not use a private export as public evidence.
4. Record the exact commit/deployment, origin, browser, current mode, and visible failure code.
5. Keep the V2 database and Legacy cache intact until recovery is verified.

## First-run and empty Canonical behavior

Canonical is the default Real mode. Startup behavior is:

```text
existing readable Canonical activities -> Dashboard
absent or readable empty Canonical library -> /source-manager.html?mode=real
unproved or unsafe local state -> blocked recovery UI and Diagnostics path
```

An empty Canonical library is a normal First-run state. It does not mean Legacy activities were
lost, copied, or inspected. Use Sources to import FIT, TCX, GPX, English Strava `activities.csv`, or
a bounded Strava ZIP. The current Sources Strava API buttons are disabled; they are not a migration
tool.

## Explicit Legacy, Shadow, and Canonical modes

The accepted Real mode values are `legacy`, `shadow`, and `canonical`:

- `canonical` reads only the V2 local library and is the default.
- `legacy` reads through the preserved Legacy Repository boundary.
- `shadow` keeps Legacy as the read path and may perform only the accepted best-effort Canonical
  observation/write when separately enabled.

The operator/test runtime override must exist **before** the application entry module is imported:

```js
globalThis.__STRAVASTATS_FEATURE_FLAGS__ = Object.freeze({
  dataRepositoryMode: 'legacy',
  localImportEnabled: false,
  canonicalShadowWriteEnabled: false
});
```

For Shadow comparison, use `dataRepositoryMode: 'shadow'` and explicitly set
`canonicalShadowWriteEnabled: true`. An ordinary-object override can be partial; omitted fields use
their frozen defaults. Unknown keys, accessors, proxies, or invalid object shapes reject the entire
override, while invalid field values resolve to safe field defaults. A late override cannot alter
flags already frozen during import. There is no persisted end-user mode setting and no supported UI
toggle, so a deployment owner must inject the override in the bootstrap document or controlled test
harness before `/js/main.js` loads.

## IndexedDB physical V5 and compatibility

The current V2 database version is 5 and contains fourteen stores. The implementation can create a
fresh V5 database or upgrade accepted V1, V2, V3, and V4 physical layouts additively and
transactionally. Failed upgrades abort without partially rewriting the prior accepted version.
V4-to-V5 adds only the empty `sourceConnections` store, its unique `byProvider` index, and the fifth
structural migration record. It does not infer an account from activities or provenance.

Compatibility is forward-only at the browser database boundary:

- a build that expects an older physical version may be unable to open a V5 database;
- an unsupported higher version or same-version schema mismatch fails closed with
  `VERSION_UNSUPPORTED` or `SCHEMA_MISMATCH`;
- the application does not downgrade, delete, rename, or recreate a database as recovery;
- newly created V2 backups are format 2/V5 exact-current archives. Restore also accepts the frozen
  format 1/V4 profile through one narrow additive transformation that preserves every V4 record,
  creates no connection identity, and appends only the V5 metadata/migration state.

If an older build cannot read V5, select explicit Legacy mode or restore a V5-aware application
deployment while retaining V5. Do not delete or downgrade V5 to make an old build start.

## SourceConnection is local control state

V5 can retain one private Strava subject identity and a stable connection state in
`sourceConnections`. Absence means unconfigured. A disconnected row is a retained tombstone: it
does not remove Canonical activities, ActivitySource provenance, RawArtifacts, Import history,
duplicate decisions, settings, backups, or Legacy data. C2 performs no OAuth, Token, provider,
account, or network operation, and the Source Manager remains fail-closed until a later separately
approved controller integration exists.

## Non-destructive rollback

The preferred product rollback is explicit Legacy mode:

```text
stop new imports/writes
-> record Diagnostics and current deployment
-> inject explicit legacy mode before application bootstrap
-> verify Legacy Dashboard with provider/network blocked where possible
-> verify V2 and Legacy storage still exist
-> preserve V2 backup and failure evidence
```

Shadow may be used when Legacy reads plus accepted comparison are required. A normal revert commit
or deployment rollback may restore earlier code, but must not delete Canonical data. Service Worker
and deployment rollback require a separate rehearsed runbook; production mixed-version and
cold-offline evidence is currently blocked in [Known Limitations](./known-limitations.md).

This is non-destructive rollback: no library, backup, RawArtifact, Import Log, duplicate decision,
or user setting is cleared. Disconnecting Strava remains separate from deleting local data.

## What this migration does not provide

- no automatic Legacy-to-Canonical conversion;
- no reverse migration from V2 to Legacy;
- no merge of Legacy and V2 libraries;
- no cross-origin or cross-browser synchronization;
- no compatibility beyond the exact format 1/V4 and format 2/V5 backup profiles;
- no release tag, deployment, or production approval.

For error-specific recovery, use [Troubleshooting](./troubleshooting.md). For protected restore,
use the [Backup Guide](./backup-guide.md). The release-state evidence remains in the
[PR-24 ledger](../tasks/pr-24-release-documentation.md).
