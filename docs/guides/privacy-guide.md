# Privacy Guide

StravaStats V2 keeps Canonical storage and local file import in the user's browser. That local-first
boundary reduces unnecessary upload, but it does not make every application page or exported file
public-safe or fully offline.

## Data that must never enter public evidence

Do not put any of the following in Git, issues, PR prose, CI logs, console output, screenshots,
Diagnostics, telemetry, or public support messages:

- Strava Token, refresh token, Authorization header, cookie, credential, or OAuth response;
- raw activity/source/athlete/device IDs, raw hashes, filenames, file paths, or private URLs;
- activity payloads, private settings, analysis values, or backup bytes;
- GPS coordinates, routes/polylines, exact locations, heart-rate or power series/values;
- athlete names, emails, device serials, private exports, or browser-profile state;
- platform exception messages, response bodies, stacks, causes, or accessor/proxy output.

Use fixed safe error codes and non-identifying counts. Opaque identifiers remain private even when
they do not look like a person's name.

## Where data lives

- Canonical activities and Import records: IndexedDB `strava-stats-v2` V4.
- Preserved Legacy data: separate `strava-dashboard-cache` and established Legacy localStorage.
- Approved durable UI/analysis settings: localStorage; an allowlist is included in V2 backup.
- Recent Diagnostics errors and import performance: bounded sessionStorage with in-memory fallback.
- Provider Tokens: Legacy auth storage, outside V2 backup and Diagnostics.

Disconnecting Strava removes/revokes connection credentials through the auth lifecycle; it is a
separate action from deleting any local library. The current Sources page provides no delete-local-
data action.

## Diagnostics is not a backup

| Property | Diagnostics export | V2 backup |
| --- | --- | --- |
| Purpose | Privacy-safe support snapshot | Complete private library recovery |
| Contents | Fixed codes, safe aggregates, rounded origin estimate | All V4 records, raw artifacts, Streams, import/review state, approved settings |
| Size bound | 256 KiB | 256 MiB exact preflight |
| Safe to publish | Review first; designed to exclude raw private data | No — always private athlete data |
| Restore capable | No | Yes, exact-current absent/empty target only |

Diagnostics is not a backup and never reads the V2 database for raw activity data. Global error
listeners record category-only events and do not inspect error message, reason, filename, stack, or
cause. The Storage Estimate is rounded and origin-wide.

## Backup privacy

A backup may contain the complete athlete library: activity metadata, raw artifacts, Streams,
GPS, heart-rate, power, devices, import logs, duplicate decisions, and settings. Store it encrypted
or otherwise access-controlled outside the repository. Do not attach it to a bug report. Do not
rename it to bypass the privacy guard.

The backup intentionally excludes Token/Authorization material, provider connection, Legacy
storage, Cache Storage, Service Worker state, and session Diagnostics. Read the
[Backup Guide](./backup-guide.md) before sharing or restoring anything.

## Provider, external service, and telemetry boundary

Source Manager local import does not call a provider or upload selected file bytes. Existing local
Canonical startup and browsing do not require Token/auth/provider network.

Other established pages are not fully offline:

- root/detail documents declare third-party CDN assets such as Chart.js, D3, Cal-Heatmap, and
  Leaflet;
- root declares Google Tag Manager/Analytics and same-origin Vercel Insights;
- Legacy provider features use same-origin serverless API routes;
- weather/maps can use external services;
- the existing AI Chat uses an explicitly user-supplied external AI key and sends prepared context
  to that service when the user invokes it.

These are inherited external and telemetry boundaries, not evidence that private activity data is
uploaded by local import. They remain production privacy-review blockers. Never include filename,
route, user identity, Token, raw payload, or health/power data in product analytics events.

## Console, DOM, and error handling

Public errors use closed safe codes. Do not add `console.log(error)`, raw caught objects, provider
responses, activity objects, storage records, identifiers, or filenames. User-facing recovery copy
must not echo a malicious filename or platform message. Use [Diagnostics](/diagnostics.html) and
[Troubleshooting](./troubleshooting.md) instead of asking users to paste their full console or
storage contents.

## Synthetic fixtures and browser evidence

Committed tests, screenshots, docs, and benchmarks use deterministic synthetic data under
`tests/fixtures/synthetic/`. Automated tests must never read or enumerate
`tests/fixtures/private/`. Real FIT/TCX/GPX, Strava ZIP, GPS, heart-rate, power, account, or browser
profile evidence stays outside the repository and requires explicit authorization and private
handling.

Before committing:

```bash
npm run check:privacy
git diff --check
```

Stage only exact approved paths. A passing privacy guard cannot prove prose, screenshots, binary
metadata, telemetry, or external services are safe; human review remains required.

## If private data is exposed

1. Stop push, merge, release, and deployment.
2. Identify whether the material reached remote Git history, CI artifacts, logs, telemetry, or a
   third party.
3. Revoke exposed credentials immediately.
4. Preserve a minimal private incident record; do not paste the secret again.
5. Coordinate Git-history/artifact removal if needed. A later deletion commit alone is insufficient.
6. Add the smallest guard/regression and re-run privacy plus affected release gates.

Privacy, data-loss risk, destructive Legacy behavior, and unauthorized external activity-data
transmission are non-waivable release gates.
