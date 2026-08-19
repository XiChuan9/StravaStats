# Public Local Import Core Browser Acceptance

| Field | Result |
| --- | --- |
| Date | 2026-08-19 |
| Tested implementation | `a32cacbbae1b95aaceb18087f24dd6ebc7707338` |
| Tested implementation tree | `5393c41042cd0a17fcf04429807d64f312e8635c` |
| Browser | Isolated Codex in-app browser session; Chrome `151.0.0.0` engine |
| Profile/data | Fresh loopback origin; no personal profile, Token, account, or real activity file |
| Application server | `127.0.0.1:43241`, Node `24.19.0` |
| Acceptance origin | `127.0.0.1:43242`, temporary same-origin test proxy, Node `24.19.0` |
| npm used for repository gates | `11.17.0` |
| Release status | Evidence only; no release or deployment authorization |

## Synthetic fixtures

Both files were generated from the tracked deterministic fixture builders. The
temporary files and acceptance proxy were outside the repository and were not
committed.

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| `synthetic-acceptance.fit` | 307 | `509d54298ffbb1f7f36e24cdedb9fd98704eb686027344f374e39e31a85346cf` |
| `synthetic-acceptance.tcx` | 1,698 | `ecc89b82be770bf051e3c1fe4d5eb3f6e71901e6be9274c6ca8f2ab2a2c99f9c` |

The browser automation surface did not return a usable native file-chooser
handle. After that attempt failed, a temporary same-origin test-only control
created browser `File` objects from the two deterministic fixture responses and
dispatched the production `#file-input` change event. Source Manager preflight,
Import, Worker decoding, Repository writes, IndexedDB reads, and all page
rendering remained the production browser flow. No acceptance helper was added
to the repository or public runtime.

## Page and import results

| Check | Actual result |
| --- | --- |
| Application startup | PASS — the empty-library root entered the Source Manager first-run flow without a runtime error. |
| Source Manager | PASS — Real local library opened and advertised FIT, TCX, GPX, CSV, and ZIP inputs. |
| FIT import | PASS — one file completed; Activities Preview became `1 activity`. |
| TCX import | PASS — one file completed; Activities Preview became `2 activities`, both Run. |
| Exact duplicate | PASS — importing the identical FIT again returned `skipped_exact_duplicate`; activity count remained 2. |
| Activities | PASS — `2 / 2 activities`; one FIT row and one TCX row were rendered. |
| Dashboard | PASS — custom range `01/01/2025`–`31/12/2031` rendered 2 activities and 2.0 km. |
| Run | PASS — `/run` rendered 2 runs, 2 km, charts, rankings, and both activity rows. |
| Activity Detail | PASS — the synthetic FIT activity routed to Run detail, rendered its stats and 12 stream/chart canvases. |
| Backup | PASS — Storage & Backup reported physical database V6 and 2 activities. |
| Diagnostics | PASS — page opened, reported 0 recent errors, and retained three synthetic Import performance records. |

The FIT and TCX reports ended `completed_with_warnings` because the deliberately
minimal fixtures omit optional fields. Both activities were committed and
visible through Repository-backed public consumers.

## Retired routes and assets

Top-level navigation attempts to `/run-plus` and `/run-plus/nsm` were rejected
by the browser-control client with `net::ERR_BLOCKED_BY_CLIENT`; neither route
rendered content. A same-origin script running in the actual browser document
then fetched the exact paths and recorded the server responses:

| Path | Browser HTTP status |
| --- | ---: |
| `/run-plus` | 404 |
| `/run-plus/nsm` | 404 |
| `/js/tabs/run-plus.js` | 404 |
| `/styles/run-plus.css` | 404 |

The Source Manager loaded 74 resource entries and `/run` loaded 107. Every
resource origin was the acceptance loopback origin, and neither inventory
contained a Run Plus/NSM asset. No external data upload or external runtime
request occurred.

## Storage before and after

The fresh origin was seeded with deterministic sentinels before the application
started. These are synthetic deletion detectors, not user data.

| Boundary | Before | After | Result |
| --- | --- | --- | --- |
| Historical LocalStorage values | 6/6 sentinel values present | The identical 6/6 values present | PASS — no read-modify-delete effect observed |
| Total LocalStorage keys | 6 | 8 | PASS — no destructive reduction; two generic app settings were added |
| Legacy IndexedDB | `strava-dashboard-cache`, V1, sentinel present | Same database/version and identical sentinel | PASS |
| V2 IndexedDB | Absent | `strava-stats-v2`, V6, 2 activities | PASS — expected local import creation; no new schema version |
| IndexedDB database count | 1 | 2 | PASS — no destructive reduction |
| Cache Storage | `public-scope-freeze-sentinel-v1` | Same single cache and sentinel | PASS — no destructive reduction |

The local development policy reported that Service Worker registration was
disabled. Therefore this run proves Cache Storage preservation on the fresh
origin and is paired with the static guard that `sw.js` and cache generation
were unchanged; it is not a production Service Worker installation claim.

## Console and limitations

- Console errors: 0.
- Console warnings: 2 instances of `No data to render` while Dashboard initially
  used its current default period, before the synthetic 2025–2031 range was
  applied. The Dashboard then rendered both activities.
- Recent Diagnostics errors: 0.
- Loaded resource origins: loopback acceptance origin only.
- Native chooser limitation: handled with the same-origin synthetic `File`
  control described above.
- Retired-route top-level limitation: the browser-control client blocked the
  404 documents; exact browser-side fetch status and absence of rendered content
  are recorded above.

This evidence does not authorize Alpha, Beta, RC, production release,
deployment, or a change to the license.
