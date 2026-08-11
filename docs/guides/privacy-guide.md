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

- Canonical activities, Import records, and optional SourceConnection metadata: IndexedDB
  `strava-stats-v2` V5.
- Preserved Legacy data: separate `strava-dashboard-cache` and established Legacy localStorage.
- Approved durable UI/analysis settings: localStorage; shared Legacy-compatible user settings from
  the explicit allowlist are included in V2 backup.
- Recent Diagnostics errors and import performance: bounded sessionStorage with in-memory fallback.
- Provider Tokens: Legacy auth storage, outside V2 SourceConnection, backup, and Diagnostics.

A V5 SourceConnection can retain the normalized provider subject as private local metadata. A
disconnected tombstone retains that identity and historical `lastSyncAt`; it is separate from Token
revocation and from deleting any local library. C2 does not read, write, exchange, refresh, or revoke
credentials. The Sources page provides no delete-local-data action.

## Source Manager authorization

Real-mode Source Manager authorization is explicit and same-tab. Before any Diagnostics, storage,
DOM, or exchange work, the callback query and fragment are synchronously replaced by the exact
mode-only Source Manager URL. The session state is 32 random bytes encoded as base64url, single-use,
and expires after ten minutes. Only the ordered scopes `read,activity:read_all` are accepted.

The browser fetches the public client ID and sends authorization codes only to same-origin API
routes. The client secret stays server-side. The exchange response is reduced to access token,
refresh token, expiry, normalized subject, and the exact ordered scopes; provider profile and
unknown response fields do not cross into the browser. Those five fields form Source Manager
authority. A Legacy three-field Token remains usable only by V1 and requires explicit reconnect in
Source Manager.

Before a Token is stored, its subject must exactly match both any immutable V5 SourceConnection
subject—including one restored from Backup—and the existing Legacy identity guard. A mismatch
stores nothing and changes neither Token nor SourceConnection. Source Manager authorization and
callback values must never be included in screenshots or test evidence.

Disconnect sends only the refresh token to the same-origin revoke route, then removes the local
origin-shared Token even if provider revocation cannot be confirmed. It preserves all Legacy, V2,
import, source, backup, and settings data. Provider revocation does not mean local-data deletion,
and offline revocation may remain unconfirmed.

## Bounded provider Sync

Real-mode `Sync latest 25` is an explicit foreground action. Connect, startup, reload, restore,
offline/online observation, and Demo mode never start it. Before provider I/O, Source Manager
requires the exact five-field local Token and an exact connected SourceConnection with the same
immutable subject. Missing, Legacy, malformed, reduced, or mismatched authority changes neither
record and sends no request.

The browser sends fixed JSON operations only to same-origin `POST /api/strava-sync`; provider and
activity IDs never enter browser URLs. The server uses the access credential only for the fixed
provider request, removes profile/name/map/gear/device/unknown fields, and returns only the reduced
summary, optional detail/laps, and exact stream set. Responses are no-store and subject to fixed
request, record, point, lap, byte, timeout, concurrency, and total-acquisition limits. There is no
retry, second page, polling, webhook, background Sync, or cross-tab owner claim.

Reduced GPS, heart-rate, power, and other activity values still remain private athlete data. They
may enter the browser only through the bounded same-origin route and reach durable storage only
through the reviewed C3a mapper, C3b provider-artifact builder, and existing ImportService. They
must not enter DOM, Diagnostics, logs, screenshots, PR evidence, or support messages. Cancellation
keeps Import items already committed; a stale history CAS never rolls them back.

## Diagnostics is not a backup

| Property | Diagnostics export | V2 backup |
| --- | --- | --- |
| Purpose | Privacy-safe support snapshot | Complete private library recovery |
| Contents | Fixed codes, safe aggregates, rounded origin estimate | All V5 records, portable connection metadata, raw artifacts, Streams, import/review state, approved settings |
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

Restore adds missing shared Legacy-compatible user settings additively after the database
transaction; an existing different value produces `TARGET_SETTINGS_CONFLICT` before database
mutation. Those restored settings may affect the UI after an explicit Legacy rollback.

The backup does not include Legacy activity or provider cache payloads. Format 2 includes the
private SourceConnection subject and a credential-safe portable state, but excludes Token/
Authorization material, scopes, provider responses/error text, Cache Storage, Service Worker state,
and session Diagnostics. Connected/error status is restored as `reconnect_required`; the archive
never implies that authorization was backed up. Read the [Backup Guide](./backup-guide.md) before
sharing or restoring anything.

## Provider, external service, and telemetry boundary

Source Manager local-file import does not call a provider or upload selected file bytes. The
separate explicit `Sync latest 25` action uses the bounded same-origin route described above.
Existing local Canonical startup and browsing do not require Token/auth/provider network.

Other established pages are not fully offline. Runtime telemetry is completely disabled: root,
detail, Gear, Source Manager, Backup, and Diagnostics do not load Google Tag Manager, Google
Analytics, Microsoft Clarity, Vercel Analytics, Vercel Insights, or Vercel Speed Insights. There
is no telemetry opt-in or fallback. Chart.js, D3, Cal-Heatmap, Leaflet, Leaflet.heat, html2canvas,
and jsPDF are exact-version-pinned, integrity checked, and served same-origin with no CDN fallback.

- a cold first-ever offline load may lack uncached local visualization assets;
- Legacy provider features use same-origin serverless API routes;
- weather can send an exact activity date and coordinates to its external service after its
  separate consent flow;
- external map tiles begin denied. A Real map with valid local geometry can request only
  OpenStreetMap PNG tiles from the exact `a`, `b`, or `c.tile.openstreetmap.org` hosts after the
  user chooses **“Load approximate OpenStreetMap tiles for this map”**. The map computes the full
  local bounds first, limits tiles to zoom 11 or lower, sends no activity ID/name/date, route
  vertices/order, Token, heart-rate, or power, and stores no permission or tile response durably.
  Tile paths still reveal the approximate displayed region and request timing. Demo has no grant
  control or map-location request. Revocation cancels registered work and blocks later tiles but
  cannot retract provider/browser records already created;
- AI Coach names Google Gemini and `generativelanguage.googleapis.com`, shows a local preview, and
  requires `Send this request to Google Gemini` for every request. The request contains only the
  current question (maximum 4,000 UTF-16 code units) plus two relative 28-day buckets of closed sport,
  activity-count, and rounded distance/time/elevation aggregates. It excludes names, IDs, calendar
  dates, gear, PBs, routes/GPS, Tokens, heart rate, power, raw activity/streams, and earlier chat.
  The API key and bounded conversation remain only in current-page memory; Demo performs zero AI
  consent, key, provider, history, or storage I/O.

These external feature boundaries are not evidence that private activity data is uploaded by local
import. Exact weather location/date external requests remain a production privacy release blocker.
R8 governs declared tile-location requests only; same-origin Leaflet code does not authorize a
tile request. Never add product analytics events containing a filename, route, user identity,
Token, raw payload, or health/power data; R11 authorizes no runtime telemetry event at all.

Existing browsers may still contain the inherited `gemini_api_key` or `ai_chat_history` records.
AI Coach does not read, copy, migrate, overwrite, or delete either record during normal rendering
or sending. `Review previously saved AI data` is the only entry that inspects those exact keys; its
copy-key, delete-key, and delete-history actions are separate and explicit. Copy never deletes.

## Console, DOM, and error handling

The reviewed V2 import, restore, and Diagnostics surfaces use closed safe codes, but that guarantee
does not cover every inherited application path. Inherited raw console and server/API logging is a
production privacy release blocker: established analysis/weather code can log activity values, and
serverless provider routes can log provider response/error values. Safe Diagnostics does not make all application logs safe.

Do not add `console.log(error)`, raw caught objects, provider responses, activity objects, storage
records, identifiers, or filenames. User-facing recovery copy in a reviewed safe-code boundary must
not echo a malicious filename or platform message. Use Diagnostics at `/diagnostics.html` and
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
