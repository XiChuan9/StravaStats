# StravaStats

StravaStats is a local-first sports analytics web application. The V2 integration branch stores a
source-neutral Canonical activity library in the browser, imports common activity files locally,
and keeps the existing Dashboard, sport views, activity details, Run Plus, and NSM consumers behind
a Repository boundary.

> **Release status:** this repository contains an integrated V2 code candidate. It is not a production
> release and does not claim an Alpha, Beta, or Release Candidate milestone. The package metadata
> is still `1.0.0`; no `v2.0.0-*` tag, GitHub Release, production deployment, or release-owner
> approval is implied by merged PRs, passing CI, or a Ready PR.

## Start locally

Prerequisite: a Node.js version compatible with the repository lockfile and CI (CI currently uses
Node 24 LTS).

```bash
npm ci
npm run dev
```

Open the loopback URL printed by the development server. Local development disables the
application Service Worker by default so an old worktree cache does not silently serve stale code.
Use `?enable-sw=1` only when intentionally testing the existing worker.

Repository checks:

```bash
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

Tests are offline, deterministic, and do not require Strava credentials or private fixtures.

## Current V2 workflow

### Local-first and Canonical by default

Real sessions default to `dataRepositoryMode: 'canonical'`. The application inspects and reads the
local Canonical library without requiring a Strava Token, provider auth, or network request. A
successful empty Canonical library is a normal First-run state and navigates to Sources; it is not
evidence that Legacy data was migrated.

The three accepted Real modes are:

| Mode | Read path | Purpose |
| --- | --- | --- |
| `canonical` | Local V2 Canonical library | Current default |
| `legacy` | Existing Legacy cache/connector boundary | Explicit non-destructive rollback |
| `shadow` | Legacy reads plus best-effort Canonical observation/write | Comparison and staged rollback |

Mode selection does not copy, clear, repair, overwrite, or reverse-copy either library. The
runtime override is an operator/test bootstrap seam, not a persisted end-user setting or a UI
toggle. See the [Migration Guide](./docs/guides/migration-guide.md) before using it.

### Sources and local import

Open Sources at `/source-manager.html?mode=real` in a served application. It supports:

- English Strava `activities.csv`;
- a bounded Strava ZIP containing an exact root `activities.csv`;
- FIT, TCX, and GPX files;
- batches of up to 1,000 selected files and 256 MiB total.

Files are preflighted, decoded, normalized, matched, and written locally. Import progress,
cancellation, per-item outcomes, and the persisted Import Log come from the real Import boundary.
Real Sources supports explicit Connect/Reconnect, `Sync latest 25`, Disconnect, and stale-operation
Recover/Abandon. An eligible failed local import can expose an explicit, single-use Retry from its
retained pending bytes; it shares the Source Manager lock/lease and never starts automatically.
Connect, Sync, recovery, and Retry remain user actions. Demo constructs none of these capabilities
and Demo seed import remains unavailable.

### Exact identity and Duplicate Review

Exact file/source identities are idempotent: replay does not create a second activity. Similar
time/distance/duration evidence creates a `review_required` candidate rather than an automatic
merge. In Possible duplicates, users can:

- confirm that two records represent the same activity;
- keep them separate; or
- decide later.

Confirmation records identity intent only. It does not merge, hide, replace, or delete either
activity or source. Field-level merge, unmerge, split, and source preference remain future work.

### Backup, restore, and diagnostics

- Storage & Backup at `/storage-backup.html` creates a deterministic, integrity-checked full V6
  format-3 backup and restores format 3/V6 plus frozen format 2/V5 and format 1/V4 profiles only
  into an absent or exact empty V6 target. Portable SourceConnection metadata never includes
  credentials, and an unresolved active Source Manager operation must be explicitly handled first.
- Diagnostics at `/diagnostics.html` shows a rounded origin-wide storage estimate, recent safe
  session errors, and safe import-performance aggregates. Its explicit export is privacy-redacted
  and is not a library backup.

Read the [Backup Guide](./docs/guides/backup-guide.md) before restore. A backup is private athlete
data even though a Diagnostics export is designed to exclude raw athlete data.

## Architecture and data boundaries

The current Canonical database is `strava-stats-v2`, physical IndexedDB V6, schema ID
`strava-stats-v2@6`, with fifteen stores. It is physically separate from the Legacy
`strava-dashboard-cache`. V2 upgrades are additive and transactional; the application never
upgrades the Legacy database in place.

Consumers obtain data through the seven-method Repository contract. Import, Backup, Diagnostics,
and Storage have separate public boundaries. Pages and analysis modules do not choose persistence
or source-specific behavior directly.

The V1 path remains preserved through `maintenance/v1`, the baseline tag, the Legacy Repository,
and explicit Legacy mode. Disconnecting Strava removes connection credentials but is separate from
deleting local activity data.

## Privacy and network boundary

Local import files are processed in the browser and are not uploaded by the Import pipeline. The
repository privacy guard rejects private fixture paths and sports files outside the synthetic
fixture tree. Reviewed V2 Import, Backup/Restore, and Diagnostics boundaries use safe codes.
Source Manager and server/client logging responsibility paths likewise use safe codes or fixed
redacted events rather than raw causes, IDs, filenames, routes, GPS, heart-rate, power, provider
responses, or payloads. This is deterministic current-tree evidence, not real-account or
private-library verification.

That local-first statement does **not** mean the complete application is fully offline. In the
current V2 Source Manager, explicit Connect/Reconnect navigates to provider authorization. The
callback exchange, explicit Disconnect revocation, and explicit `Sync latest 25` use separate
bounded same-origin routes that perform the corresponding provider I/O. Local import and local
Canonical browsing do not call the provider. Legacy provider paths remain separate. Weather, map,
and AI each have separate explicit consent boundaries and distinct external destinations.

Production runtime telemetry is disabled and visualization libraries are exact-version-pinned,
integrity checked, and served same-origin; the visualization runtime makes no third-party CDN
request and has no CDN fallback. Review the [Privacy Guide](./docs/guides/privacy-guide.md) and
[Known Limitations](./docs/guides/known-limitations.md) before production use.

External base-map tiles are denied by default. A Real map with validated local geometry offers the
explicit action **“Load approximate OpenStreetMap tiles for this map”**; the grant is memory-only,
applies to that map in that document, and permits only coarse OpenStreetMap tiles at zoom 11 or
lower. Demo performs no map grant or location request. Revocation cancels registered loads and
blocks future requests, but cannot recall requests already received or erase browser/provider
records. Leaflet and Leaflet.heat are exact-version-pinned and served same-origin; OpenStreetMap
tile requests remain a separate external boundary governed only by the per-map permission.

## Compatibility and verification boundary

The PRD targets recent Chrome, Safari, and Firefox, macOS and Windows desktop, and basic iOS
Safari/PWA viewing. Merged automated and actual-served evidence covers Node/fake-indexeddb and
disposable Chromium/Chrome with deterministic synthetic data. Safari, Firefox, Windows, mobile,
iOS/PWA, broad assistive-technology, pixel-level visual, real-account, real-private-library,
production Service Worker, deployment, and final rollback matrices are not verified release
evidence.

## Documentation

- [Documentation index](./docs/README.md)
- [Changelog](./CHANGELOG.md)
- [Migration Guide](./docs/guides/migration-guide.md)
- [Backup Guide](./docs/guides/backup-guide.md)
- [Known Limitations](./docs/guides/known-limitations.md)
- [Privacy Guide](./docs/guides/privacy-guide.md)
- [Troubleshooting](./docs/guides/troubleshooting.md)
- [Release gates](./docs/engineering/release-gates.md)
- [PR-24 historical ledger and current-tree supplement](./docs/tasks/pr-24-release-documentation.md)

The original PR-24 ledger is a historical V4-era evidence snapshot. Its additive superseding
current-tree ledger records the exact post-R3-R11/D3/C1-C4/Retry status. `PASS` means only that a
specific bounded row has accepted current code, deterministic tests, CI, Task Brief, or qualified
served synthetic evidence. It does not mean the product was released. Ready is not merge or
release authorization.
