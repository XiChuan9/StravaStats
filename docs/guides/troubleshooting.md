# Troubleshooting

These procedures are intentionally non-destructive. Do not clear site data, delete an IndexedDB
database, overwrite settings, edit a backup, or repeatedly import private files as a first response.
Record the exact safe code and use [Diagnostics](/diagnostics.html) where available.

## First-run or an empty local library

Expected Canonical behavior is a navigation to `/source-manager.html?mode=real`.

1. Open Sources and confirm **Real local library** is shown.
2. Choose FIT, TCX, GPX, English Strava `activities.csv`, or a bounded Strava ZIP.
3. Review preflight results before starting import.
4. After completion, check Activities Preview and Import Log, then open `/`.

Empty Canonical does not automatically inspect or copy Legacy. If you expected Legacy data, follow
the explicit Legacy rollback section below; do not import an unknown private export or clear V2.

## Explicit Legacy rollback

There is no persisted UI mode toggle. A deployment/test operator must inject the exact feature-flag
object before `/js/main.js` imports:

```js
globalThis.__STRAVASTATS_FEATURE_FLAGS__ = Object.freeze({
  dataRepositoryMode: 'legacy',
  localImportEnabled: false,
  canonicalShadowWriteEnabled: false
});
```

Reload only after the bootstrap document or controlled harness guarantees that ordering. Verify the
Legacy Dashboard, then confirm both `strava-dashboard-cache` and `strava-stats-v2` still exist.
Rollback must not delete, repair, overwrite, downgrade, or reverse-copy either database. See the
[Migration Guide](./migration-guide.md).

## Local library will not open

| Safe code | Meaning | Non-destructive action |
| --- | --- | --- |
| `UNAVAILABLE` / `OPEN_FAILED` | Browser storage could not be opened | Close other tabs for the same origin, confirm storage permission, restart the browser, then retry once |
| `OPEN_BLOCKED` | Another connection/build is blocking an upgrade | Close all other StravaStats tabs/windows for that origin; do not delete the database |
| `VERSION_UNSUPPORTED` | Database is newer than this build supports | Use the matching/newer build or explicit Legacy mode; preserve V4 and backups |
| `SCHEMA_MISMATCH` | Same-version stores/indexes do not match the accepted schema | Stop writes, export Diagnostics, preserve the database, and escalate; do not auto-repair |
| `MIGRATION_FAILED` / `MIGRATION_INTERRUPTED` | Additive V2 upgrade aborted or was interrupted | Close competing tabs and retry with the same build; transaction rollback should preserve the prior version |
| `QUOTA_EXCEEDED` | Browser refused a storage transaction | Preserve current data, free unrelated storage outside the app if possible, then retry the single operation |

If the state remains unproved, the blocked UI is safer than pretending the library is empty.

## Import failed

Source Manager exposes safe codes rather than raw filenames or parser messages.

| Code/family | Action |
| --- | --- |
| `UNSUPPORTED_FORMAT`, `FILE_TYPE_UNSUPPORTED` | Select only `.csv`, `.zip`, `.fit`, `.tcx`, or `.gpx` with matching content |
| `FILE_EMPTY`, `FILE_CORRUPTED`, `FILE_HEADER_INVALID` | Keep the original; export it again from its source instead of editing binary/XML bytes blindly |
| `CSV_HEADER_INVALID`, `CSV_COLUMN_MISMATCH`, `CSV_*` | Use the English Strava `activities.csv` profile and keep it under 5 MiB/10,000 rows |
| `ZIP_PATH_INVALID`, `ZIP_BOMB_RISK`, `ZIP_CRC_MISMATCH`, `ZIP_*` | Reject the archive; use a fresh bounded Strava export with root `activities.csv` |
| `EXACT_IDENTITY_CONFLICT`, `HASH_COLLISION` | Stop; preserve both artifacts and the Import Log for investigation |
| `STORAGE_UNAVAILABLE` | Resolve the local-library open issue above, then retry the failed item |
| `STORAGE_QUOTA_EXCEEDED` | Free unrelated browser/disk space; completed items stay committed |
| `IMPORT_CANCELLED` | Expected after cancellation; completed items remain, unfinished items can be reselected |
| `CANDIDATE_LIMIT_EXCEEDED` | Too many possible duplicates; nothing from that activity is committed; split the investigation rather than weakening the limit |

One failed file should not remove successful siblings. Check the persisted Import Log before
retrying so exact duplicates are not mistaken for failures.

## Possible duplicate review

- **Confirm same activity** records identity intent only; both activities/sources remain.
- **Keep separate** records a durable rejection.
- **Later** makes no terminal decision.
- `REVIEW_STALE` means the queue changed; refresh Sources and reopen the item.

There is no field-level merge, unmerge, split, hide, or delete recovery action in this release
candidate.

## Backup restore conflict or failure

| Code/result | Action |
| --- | --- |
| `TARGET_NOT_EMPTY` | Stop. Create backups of both libraries and restore only into a genuinely absent/exact empty V4 target |
| `already_restored` | No database rewrite is needed; verify the library and settings |
| `SETTINGS_PENDING` | Retry the same backup; do not delete the restored database or overwrite existing settings |
| `TARGET_SETTINGS_CONFLICT` | Preserve the existing setting and stop for an owner decision |
| `BACKUP_TOO_LARGE` | The exact 256 MiB whole-buffer limit was exceeded; do not split or modify the archive |
| `BACKUP_HASH_MISMATCH`, `BACKUP_DATA_INVALID` | Use another verified backup; do not force or rehash the damaged file |
| `BACKUP_SCHEMA_INCOMPATIBLE` | Use a matching exact-current build in isolation; a backup is not a version migration |
| `QUOTA_EXCEEDED`, `RESTORE_ABORTED` | Keep the backup and target unchanged; resolve quota/competing tabs, then retry |

See the [Backup Guide](./backup-guide.md) for the complete state machine.

## Provider is offline or Token is missing

An existing Canonical library should still open and local imports should remain usable. The Source
Status may say `provider offline`; this is not a reason to delete or reconnect local data.

1. Open `/` and confirm local summaries render.
2. Open Sources or Storage & Backup directly if provider UI is unavailable.
3. Do not paste Token/Authorization data into Diagnostics or support messages.
4. Reconnect only through the explicit provider flow when it is intentionally available. The
   current Sources API card is disabled `Connect later`.

Legacy weather, maps, CDN assets, telemetry, provider detail, or external AI features may still
require network. The whole app is not fully offline.

## Diagnostics export

1. Open `/diagnostics.html`.
2. Select **Refresh**.
3. Note whether the origin-wide Storage Estimate is `available`, `unsupported`, or `unavailable`.
4. Select **Export diagnostics** only if a support snapshot is needed.
5. Review the JSON before sharing. It should contain safe codes/aggregates, not IDs, filenames,
   routes, GPS, heart-rate, power, Tokens, Authorization, payloads, or backup bytes.

Diagnostics is not a backup and cannot restore data. If it contains private material, stop sharing
and follow the [Privacy Guide](./privacy-guide.md).

## Stale local page or Service Worker

On localhost, the app disables its Service Worker by default and clears only caches whose names
start with `strava-dashboard-`. Restart `npm run dev`, close other local tabs, and reload the printed
loopback URL. Use `?enable-sw=1` only for an intentional worker test.

For a non-local deployment, do not tell users to clear all site data: that can erase both local
libraries. Record the deployment, worker script/cache version, and affected route, stop rollout,
and use the release-owner Service Worker rollback procedure. Production update/old-cache eviction
remains a blocked release gate.

## Escalate without exposing data

Provide only: commit/deployment, browser/version, route, safe code, operation stage, whether the
library was empty/non-empty, and a reviewed Diagnostics export. Keep real backups, files, database
contents, screenshots, and account/provider evidence private and out of Git.
