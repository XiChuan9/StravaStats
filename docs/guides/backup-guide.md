# Backup Guide

StravaStats V2 backup is a deterministic, integrity-checked archive of the complete local V6
library and an approved durable-settings allowlist. Newly created archives use the exact-current
format 3/V6 profile; restore also accepts the frozen format 2/V5 and format 1/V4 profiles through
narrow additive transformations into V6. Backups are for private local recovery, not for Git,
support tickets, analytics, or general cross-version migration.

## Before you create a backup

- Open the served Storage & Backup page at `/storage-backup.html` in a Real session.
- Explicitly Recover or Abandon any interrupted Source Manager operation. Export refuses every
  active operation, even after its lease timestamp expires.
- Choose a private storage location outside the repository.
- Treat the resulting file as sensitive athlete data: it may contain raw artifacts, activity
  records, Streams, GPS, heart-rate, power, device references, import history, and settings.
- Demo mode deliberately disables Real backup and restore.

## Create a backup

1. Select **Create backup**.
2. Wait for the page to read and validate all physical V6 records and approved settings.
3. Save the downloaded `*.stravastats-backup.zip` file in a private location.
4. Keep the original library until a restore has been verified in a separate empty environment.

The archive is format version 3 and includes a canonical manifest, hashes, all fifteen V6 stores,
and the approved settings snapshot in nineteen fixed ordered entries. `connections.jsonl` follows
`sources.jsonl`, followed by `operations/source-manager.jsonl`. The operation payload is one idle,
privacy-minimized row; current owner, operation, job, phase, provenance, and lease fields are null,
while fixed redacted audit values may remain. Equal portable records, settings, application
version, and timestamp produce deterministic stored ZIP bytes. The timestamp changes a normal
newly created backup.

SourceConnection is private identity metadata, not a credential. Export preserves its immutable
identity, `lastSyncAt`, and revision, but maps `connected` and `error` to
`reconnect_required`/`AUTHORIZATION_REQUIRED`; `reconnect_required` and `disconnected` remain in
their safe portable states. The archive contains no Token, scope, Authorization header, provider
response, or provider error text, so restore never claims usable authorization.

## Exact-current and 256 MiB boundary

Backup, validation, and restore use whole-buffer processing with an exact 268,435,456-byte
(256 MiB) preflight. A larger Blob is rejected before it is read. Individual payloads and the final
archive are also bounded.

For format 3, `exact-current` means the manifest must match the current database name, physical
IndexedDB V6, schema `strava-stats-v2@6`, Canonical schema version, archive layout, hashes, record
ordering, and data/reference contracts. Formats 1 and 2 are validated separately against their
exact V4 and V5 profiles and transformed only after complete validation. A future-version,
mixed-profile, older unknown, reordered, corrupted, truncated, appended, path-traversal,
duplicate-entry, or rehashed-invalid archive fails before target mutation.

## Restore safely

1. Use an absent V2 database or an exact empty V6 target. Do not clear a valuable library to make a
   restore fit.
2. Open Storage & Backup at `/storage-backup.html`.
3. Choose the private `*.stravastats-backup.zip` file.
4. Select **Validate and restore**. The entire archive is validated before any target write.
5. Wait for the result, then open the library and inspect expected summaries and details.
6. Keep the backup and the prior library until verification is complete.

All fifteen stores are committed in one IndexedDB transaction. Validation, quota, constraint,
interruption, or cancellation observed before that commit aborts without a partial library.
Settings are additive and are handled after the database transaction. Cancellation observed after
the database commit, including during a settings write, returns resumable `SETTINGS_PENDING`; retry
the same backup to verify and add only missing approved settings.

An exact format 1/V4 archive restores all validated V4 records unchanged, adds the empty
`sourceConnections` store and an idle `sourceOperations` row, updates only V2 system metadata, and
appends the fifth and sixth structural migration records. Format 2/V5 adds only the idle operation
row and sixth record. Neither profile infers identity or ownership from ActivitySource or Import
history. Preserved nonterminal jobs become explicit orphan candidates and never resume during
restore. Repeating the same transformed or format-3 restore is idempotent; a different non-empty
target remains a safe conflict.

## Result and conflict states

| Result/code | Meaning | Safe next step |
| --- | --- | --- |
| `restored` | Database and approved settings were restored | Open the library and verify it; keep the backup |
| `already_restored` | The exact database content is already present | No database write is needed; verify the library |
| `TARGET_NOT_EMPTY` | A different non-empty V2 library exists | Stop; back up both libraries and choose a genuinely empty target |
| `TARGET_SETTINGS_CONFLICT` | A durable setting has a different existing value | Stop; do not overwrite or delete the setting |
| `SETTINGS_PENDING` | Database commit is safe, but some settings were not durably added or verified | Retry the same backup; do not delete the database |
| `ACTIVE_SOURCE_OPERATION` | An active or expired unresolved Source Manager operation exists | Return to Sources and explicitly Recover or Abandon it; export never resolves it automatically |
| `QUOTA_EXCEEDED` | Browser storage could not commit the restore | Free space outside StravaStats if possible, keep the backup, retry only with the target unchanged |
| `BACKUP_SCHEMA_INCOMPATIBLE` | Archive and current exact contract differ | Use the matching application build in an isolated environment; do not force restore |
| `BACKUP_HASH_MISMATCH` / `BACKUP_DATA_INVALID` | Integrity or data validation failed | Treat the file as damaged; use another verified backup |

`SETTINGS_PENDING` is intentionally resumable: selecting the same backup again detects the already
restored database and continues additive settings work. Never delete V6 or overwrite an existing
setting as a shortcut.

## Shared settings and data backup does not touch

The approved settings snapshot contains shared Legacy-compatible user settings, including the
documented dashboard, analysis, training-goal, and `gear-custom-*` allowlist. Restore adds missing
settings additively after the database transaction. A different existing value stops validation
before database mutation with `TARGET_SETTINGS_CONFLICT`; a post-commit settings verification issue
returns `SETTINGS_PENDING`. Because these settings are shared, a successful restore can affect the
UI settings seen after an explicit rollback to Legacy.

V2 backup does not include Legacy activity or provider cache payloads such as
`strava-dashboard-cache`, `strava_activities`, athlete/zones/gears/demo/provider/token records. It
also does not include or modify:

- Strava Token, Authorization material, scopes, or live provider responses (format 3 includes only
  the portable non-credential SourceConnection projection described above);
- Cache Storage or Service Worker state;
- session-only Diagnostics errors or performance records;
- browser history, downloads, or other origins.

It does not delete, clear, rename, swap, or overwrite a different non-empty V2 library. It is not a
Legacy rescue package and cannot be used as a reverse-copy into Legacy.

## Browser and release limitations

Whole-buffer processing means memory pressure may occur below the 256 MiB file limit, especially on
mobile devices. Storage quota is browser/origin specific and Diagnostics reports only a rounded
origin-wide estimate, not guaranteed free disk space. Deterministic synthetic restore has actual-
served Chromium evidence; Safari, Firefox, mobile, real private libraries, and production release
rollback are not verified. See [Known Limitations](./known-limitations.md) and
[Troubleshooting](./troubleshooting.md).
