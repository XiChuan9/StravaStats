# PR-04B：活动详情消费者迁移

## Metadata

| Field | Value |
| --- | --- |
| Status | In progress |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/detail-consumers` |
| Worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/detail-consumers` |
| Owner | XiChuan9 |
| Reviewer | 控制塔 + 独立审查任务 |
| Related PRD | Sections 4.1、5、8.4、8.6、10 Epic B2、11.2、19 |
| Related plan | Sprint 2 / PR-04B |
| Related ADRs | ADR-0003，以及与 Activity/Streams 合同相关的 ADR-0001/0002 |
| Dependencies | PR-00 至 PR-04A 已合并 |
| Starting baseline | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Pull request | [Draft PR #9](https://github.com/XiChuan9/StravaStats/pull/9) |

### Phase status

| Phase | Status |
| --- | --- |
| A0 | Completed / PASS |
| A1 | Completed / PASS |
| A2 | Completed / PASS |
| A3 | Completed / Accepted |
| A3.1 | Completed / Accepted |
| A3.2 | Completed / Accepted |
| B1.1 | Completed / PASS |
| B1.2 | Completed / PASS |
| B1.3 | Completed / PASS |
| B1 | Completed locally / Awaiting B1.3 exact-head CI |
| B2 | Not started / Not authorized |
| B3 | Not started / Not authorized |

## Goal

- 查明 activity router、通用详情页、Run/Bike/Swim 详情页和 Advanced Analysis 的真实取数链。
- 设计最小迁移，使详情 consumer 只通过 Repository 或明确的页面 read façade 获取数据。
- 避免页面和 Advanced Analysis 重复获取同一活动数据。
- 保持现有详情输出、算法、DOM、CSS、路由和视觉不变。
- A0–A3 只完成调查、决策冻结和记账；implementation has not started。

## Why now

PR-03 已冻结七个 Repository 公共方法和统一 success/error 合同；PR-04A 已合并汇总
consumer 迁移。ADR-0003 要求详情页和 analysis consumer 不再自行选择 provider、
storage、cache 或 API。PR-04B 必须先完成只读调查和控制塔决策，再进入任何实现阶段。

## Investigation questions

- Router 如何解析 ID、读取/写入 Token、请求 activity，并选择详情页？
- 四类详情页分别请求哪些 activity、streams 和 metadata，产生多少 storage/network 副作用？
- Advanced Analysis 是否重复请求 activity/streams，能否安全接收页面已加载数据？
- 现有七方法是否足以在页面 session 内组合一次 Legacy detail bundle？
- Laps 是否继续使用 activity detail 内嵌数据，是否完全不需要独立 `getLaps`？
- Demo/Real 如何冻结一次 session mode，并保持 provider/storage 隔离？
- 哪些候选文件、测试和浏览器证据是后续实施的最小集合？

## In scope

- 本 Task Brief。
- 只读源码、测试和文档调查。
- 当前/目标调用图。
- Repository 能力缺口分析。
- 测试与浏览器验证设计。
- 隐私、migration、rollback 和风险分析。

## Out of scope

- 所有产品代码和测试实现。
- PR-04C Run Plus/NSM。
- IndexedDB v2。
- Canonical storage、decoder 或 import。
- 分析算法、阈值或结果调整。
- HTML、CSS 或视觉重构。
- Service Worker。
- package 或 dependency 变更。
- server `api/**`。
- 真实 Strava 网络、Token、账号、私人数据或用户 browser profile。

## Allowed files during A0–A3

```text
docs/tasks/pr-04b-detail-consumers.md
```

产品源码、测试、长期文档和治理文件在 A0–A3 只能读取。A3 只冻结后续阶段范围，
不授权开始 B1、B2 或 B3。

## Prohibited files and operations during A0–A3

- 不修改 HTML、JavaScript 产品代码、测试、Repository、Connector、Factory、公共 exports、
  package 文件、Service Worker、server `api/**` 或长期治理文档。
- 不创建 page façade、测试文件或 `AGENTS.md`。
- 不新增 `getActivityBundle`、`getLaps` 或任何第八个 Repository 公共方法。
- 不修改 Token/auth lifecycle、算法、charts、copy、CSS、DOM、路由或视觉。
- 不使用真实 Strava Token/account/network、私人 fixture 或用户现有 browser profile。
- 不启动 PR-04C、PR-05 或 B1/B2/B3；不修改 `main`、`maintenance/v1`、`integration/v2`。
- 不使用 rebase、amend、force push、`git add .`，不触碰两个 detached Codex worktree。

## Frozen upstream contracts

PR-03 冻结且只冻结以下七个公共方法：

```text
listActivities({ refresh = false } = {})
getActivity(activityId)
getStreams(activityId, { types })
getAthlete()
getZones()
getGears()
getGear(gearId)
```

所有成功结果使用精确 `{ data, source, warnings, partial }` envelope；失败抛出脱敏的
`RepositoryError`。Laps 当前内嵌于 activity detail。新增第八个公共方法必须重新获得
控制塔批准；A3 已明确拒绝在 PR-04B 新增第八方法、`getActivityBundle` 或 `getLaps`。

## A0 baseline evidence

| Check | Actual result |
| --- | --- |
| Source worktree | `/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` |
| Source branch | `integration/v2` |
| Source worktree status | Clean |
| Local HEAD | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local `origin/integration/v2` ref | `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local/origin ahead/behind | `0/0` |
| GitHub remote `integration/v2` | Identical to `66cdc2c457457a93bec46fdf98c5a508c96770c9` (`0/0`) |
| PR #8 | Merged; merge commit `66cdc2c457457a93bec46fdf98c5a508c96770c9` |
| Local/remote feature branch before creation | Absent / absent |
| Target worktree path before creation | Absent |
| Detached Codex worktrees | Two observed; not modified |
| New branch/worktree | `codex/v2/detail-consumers` at the required manual path |
| New worktree HEAD/status | Required SHA / clean |
| Initial upstream | `origin/integration/v2`, `0/0`; to be replaced by same-name upstream on first push |
| `npm ci` | PASS; 6 packages added; 0 vulnerabilities |
| `npm run check:syntax` | PASS; 133 files |
| `npm run check:privacy` | PASS |
| `npm test` | PASS; 702/702; skipped/cancelled/todo `0/0/0` |
| `git diff --check` | PASS |

## Current-state investigation

The findings below come from static, read-only inspection of the named HTML, page entry modules,
detail consumers, Advanced Analysis, all links to `activity-router.html`, Repository/Connector
implementations, server request parsing, existing tests, ADR-0001/0002/0003, and the PR-02/PR-03
contracts. No browser, real provider, private fixture, Token, account, or user profile was used.

`CanonicalActivity.id`, `CanonicalStreamSet.activityId`, and Imported Activity Bundle IDs are opaque,
non-empty strings. `ImportedActivityBundle` is a Canonical import contract with independent `laps`
and `events`; it is not the Legacy page-local bundle proposed by this investigation. PR-04B must not
silently turn Legacy page DTOs into Canonical objects or move embedded Legacy laps.

### Current Router to Detail Page call graph

```text
link producer
  -> html/activity-router.html?id=<value>
     -> DOMContentLoaded
     -> URLSearchParams.get("id")
     -> parseInt(value, 10)
     -> localStorage.getItem("strava_tokens")
     -> btoa(JSON.stringify(tokens))
     -> GET /api/strava-activity?id=<numeric id>
        Authorization: Bearer <encoded tokens>
     -> response.json().activity
     -> optional localStorage.setItem("strava_tokens", refreshedTokens)
     -> classify activity.sport_type || activity.type
        -> swim.html?id=<numeric id>
        -> run.html?id=<numeric id>
        -> bike.html?id=<numeric id>
        -> activity.html?id=<numeric id>
     -> full-document navigation discards fetched activity
        -> detail page parses ID again with parseInt
        -> reads/encodes Token again
        -> Promise.all(activity request, streams request)
        -> optional Token write for each response
        -> render
```

Router facts:

- The Router directly owns Token read/encoding, Authorization construction, activity fetch, response
  parsing, refreshed-Token write, error copy, sport classification, and navigation.
- It selects swim for `sport_type === "Swim"` or a lower-case type containing `swim`; run for exact
  `Run`/`TrailRun` or a type containing `run`; bike for exact `Ride`/`MountainBikeRide` or a type
  containing `bike`/`ride`; everything else uses the generic page.
- Its fetched activity is never reused. A successful normal click therefore performs two activity
  detail requests: one in the Router and one in the destination page.
- `parseInt()` violates the opaque-ID contract: `abc-123` is rejected, `123abc` silently becomes
  `123`, whitespace/sign/prefix forms are coerced, and integers beyond `Number.MAX_SAFE_INTEGER`
  can lose precision. Repository normalization already preserves a non-blank string exactly.
- Several producers encode the ID (`run-analysis`, `bike-analysis`, `swim-analysis`, `run-plus`),
  while `activities`, `calendar`, `wrapped`, `athlete`, and `gear-analysis` interpolate it directly.
  Router-side exact string validation and destination `encodeURIComponent()` are the narrowest way
  to avoid changing all producers. `run-plus` belongs to PR-04C and is not a PR-04B candidate.

### Current request and side-effect count matrix

Counts are per successful invocation and exclude HTML/JS/CSS/CDN/map-tile resource loads. A detail
map can additionally start `0..14` unauthenticated Open-Meteo `fetch()` calls, depending on route
availability and sampled coordinates; those are external weather side effects, not activity/streams
provider calls.

| Stage / consumer | Activity requests | Streams requests | Same-origin `fetch` | Token reads | Conditional Token writes | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Router | 1 | 0 | 1 | 1 | `0..1` | Fetched activity discarded on navigation |
| Generic Activity page | 1 | 1 | 2 | 1 | `0..2` | Parallel requests share encoded Token; writes can race |
| Run page | 1 | 1 | 2 | 1 | `0..2` | Same pattern |
| Bike page | 1 | 1 | 2 | 1 | `0..2` | Same pattern |
| Swim page | 1 | 1 | 2 | 1 | `0..2` | Same pattern |
| Advanced Analysis, one successful click | 1 | 1 | 2 | 0 | 0 | Sequential; no Authorization; normally fails on first protected request |
| Router + any detail, before Advanced | 2 | 1 | 3 | 2 | `0..3` | Plus `0..14` conditional weather requests |
| Router + Generic + one successful Advanced click | 3 | 2 | 5 | 2 | `0..3` | Each later button click adds the Advanced row again |

Static module resolution also found an existing generic-page blocker:
`advanced-analysis.js` imports `../analysis/index.js` and `../analysis/export/index.js`, which resolve
under nonexistent `js/pages/analysis/**`; the real modules are under `js/analysis/**`. Because the
generic page statically imports Advanced Analysis, a standards browser should reject that module
graph before generic-page initialization. This is static evidence, not a browser PASS; runtime
browser verification is `Not run`.

### Four detail consumers

| Page | Initialization / render start | Activity / streams | Requested stream types | Metadata source | Error and missing-stream behavior |
| --- | --- | --- | --- | --- | --- |
| Generic Activity | `js/pages/activity/index.js` imports `activity.js`; top-level DOM/URL work; `DOMContentLoaded -> main()` | `1 / 1`, two parallel fetches | `distance,time,heartrate,altitude,cadence,watts,velocity_smooth` | `strava_training_zones`; gear/laps/best efforts/segments embedded in activity | Either request failure aborts all rendering. Empty stream object shows “No detailed stream data…” and conditionally omits charts. Error is inserted in `#activity-info`; raw response body is included in the thrown message. |
| Run | `js/pages/run/index.js`; `DOMContentLoaded -> main()` | `1 / 1`, two parallel fetches | Same seven as Generic | `strava_training_zones`; gear/laps/best efforts/segments embedded | Same all-or-nothing fetch. Empty distance stream shows the no-stream message; optional HR/cadence/power charts degrade. Error is inserted in the overview region; no dedicated return button. |
| Bike | `js/pages/bike/index.js`; `DOMContentLoaded -> main()` | `1 / 1`, two parallel fetches | Same seven as Generic/Run | `strava_training_zones`; embedded gear/laps/splits/segments | Same all-or-nothing fetch. Empty distance stream shows the no-stream message; HR/power/cadence/profile/climb outputs are conditional. Error replaces body and includes a Back button. |
| Swim | `js/pages/swim/index.js`; `DOMContentLoaded -> loadActivityPage()` | `1 / 1`, two parallel fetches | `distance,time,heartrate,cadence` | historical `strava_zones`; `strava_athlete_data` for an athlete-specific indoor-pool correction; embedded gear/laps/splits | Same all-or-nothing fetch. Individual HR/cadence containers hide when missing; zones show explicit empty text. Generic error replaces body. |

All four pages read `strava_tokens` once and encode it once. Each page's two API responses may each
write refreshed tokens, so the maximum is two writes and the parallel writes can race. All four use
the server query name `type=` for streams. DOM rendering begins only after both promises resolve.
No page currently obtains provider-owned metadata from Repository.

Laps are already embedded in the activity detail DTO. Generic/Run use laps for variability and lap
tables, with some split fallback; Bike uses laps or metric splits for advanced metrics and uses laps
for the table/chart; Swim mutates embedded laps during its existing pool correction and uses swim
splits for stroke analysis. Advanced Analysis does not make a laps query. PR-04B does not need
`getLaps`; adding it would duplicate the activity-detail provider request and conflict with the
Canonical bundle decision that laps are separate only after a future explicit projection/import
boundary.

### Advanced Analysis duplicate graph and required shape

```text
Generic page main()
  -> already has activity + seven page streams
  -> installs #advanced-analysis-btn click listener
     -> every click constructs new AdvancedActivityAnalyzer(activityId)
     -> fetchActivityData()
        -> GET /api/strava-activity?id=...        (no Authorization)
        -> after success, GET /api/strava-streams?...&type=... (no Authorization)
     -> analyzeActivity(metadata, reconstructed track)
     -> AnalysisResultsUI.renderResults()
     -> GPX / CSV / JSON exports remain analyzer/UI behavior
```

- The first protected request normally fails because the analyzer sends no Authorization; therefore
  the streams call is only reached if the activity call succeeds. The endpoint wraps this path as a
  server error, so the current UI can misrepresent authentication.
- Every click creates a new analyzer and repeats its requests; there is no loading-promise or result
  memoization.
- Base streams are `time,latlng,distance,altitude,velocity_smooth,grade_smooth,moving`; run adds
  `heartrate,cadence`; ride/bike adds `heartrate,cadence,watts`; hike/walk adds `heartrate`; swim adds
  none.
- The generic page's seven streams do not include `latlng`, `grade_smooth`, or `moving`, so they cannot
  safely be injected unchanged. Virtual GPX reconstruction requires `latlng`; it uses activity name,
  start date, sport type, distance and moving time, and tolerates absent optional HR/cadence/power/temp
  values.
- A page-session bundle that requests the approved union once can be injected without changing the
  analyzer algorithm, exports, result UI, DOM, or copy. Repeated clicks can reuse the same settled
  bundle/result promise. A3 approves the exact Generic+Advanced union frozen below.

`quick-start-example.js` also uses `parseInt()` and direct API fetches, but no production import or
HTML reference was found. It remains prohibited, and accepted tests must prove it is not a production
entry point.

### Stream contract and degradation matrix

| Consumer | Required for current primary render | Optional / conditional | Current duplicate | Missing-capability behavior |
| --- | --- | --- | --- | --- |
| Generic | activity; streams request must resolve; `distance.data` for full stream charts | time, HR, altitude, cadence, watts, velocity; map uses activity polyline | Router repeats activity; Advanced repeats both | Empty distance shows no-stream copy; optional charts/zone/map coloring are omitted or downgraded |
| Run | Same activity/request requirement; distance for full stream charts | time, HR, altitude, cadence, watts, velocity | Router repeats activity | Same no-stream copy; classifiers/splits/laps retain embedded-data behavior |
| Bike | Same activity/request requirement; distance for full stream charts | time, HR, altitude, cadence, watts, velocity | Router repeats activity | Same no-stream copy; power/profile/climb/cadence outputs are conditional |
| Swim | Activity/request resolution; distance/time for normal pace series | HR and cadence | Router repeats activity | HR/cadence containers hide; zone panel states no HR/zones; map still uses activity polyline |
| Advanced | `latlng` is functionally required; metadata must identify sport/start | time,distance,altitude,velocity,grade,moving,HR,cadence,watts,temp | Repeats activity and overlapping page streams on every click | Missing lat/lng must fail closed; optional samples use existing defaults |

The public Repository method is `getStreams(id, { types })`. Current Legacy pages and server use
query parameter `type=`, while `StravaApiConnector.fetchStreams()` emits `types=`. The server reads
only `req.query.type`, so current real `Repository.getStreams()` reaches a `400` despite existing
Connector tests freezing the mismatched `types=` URL. A3 approves only the internal Connector
query-name correction plus its existing test update; the seven-method Repository API and server
`api/**` remain unchanged.

### Consumer/provider/storage dependency matrix

| Data/state | Current owner/readers | Classification | A3 accepted boundary |
| --- | --- | --- | --- |
| `strava_tokens` | Router + all four pages; Connector also owns it | Provider/auth owned | Connector only, reached through Repository; never page/read façade output |
| `strava_activities`, timestamp, cache version | activity cache service / LegacyRepository; historical consumers | Provider cache | Repository only |
| `strava_athlete_data`, timestamp | Legacy cache; Swim reads directly | Provider metadata | `getAthlete()` via read session only where parity requires it |
| `strava_training_zones`, timestamp | Generic/Run/Bike direct read; Legacy cache | Provider metadata | `getZones()` via read session; normalize only the proven Legacy page projection |
| `strava_zones` | Swim direct read; no active writer found | Historical inconsistent provider key | Remove direct access; no fallback, adapter, migration, or backfill |
| `strava_gears`, `strava_gear_<id>`, timestamps | Legacy cache/gear consumers | Provider metadata | Embedded activity gear remains; no extra detail-page query unless parity test proves required |
| `strava_demo_mode` | Demo selector and summary composition | UI/source selection state | Allowlisted composition-root read once, converted to explicit `sessionMode` |
| `strava_demo_*`, `strava_tokens_demo` | Demo provider namespace | Demo-owned compatibility data | DemoRepository/provider only; no detail consumer access |
| map style, route color, weather toggle, chart selectors/sliders | Current detail DOM/in-memory state | Page UI/user state | Keep in memory; no new storage |
| weather cache | module-local `Map` | Non-provider transient cache | Gate by session context: Demo external weather 0; Real behavior preserved |

Importing Repository, Factory, Connector, or DemoRepository performs no Token read, storage read,
network call, or DOM access. Constructing the real Repository creates Connector/cache adapters but
does not fetch. Current detail modules do top-level DOM lookup and URL parsing, and attach a
DOMContentLoaded listener; they do not fetch until that event. No cycle was found in the proposed
composition direction (`index -> read session -> Repository`, and `index -> renderer`), provided
renderers never import the index/read session back. One Repository and one memoized bundle promise
per destination document is feasible. Router and destination cannot share an in-memory instance
across full navigation.

### Demo / Real parity matrix

| Question | Real current / Repository | Demo current / Repository | Migration implication |
| --- | --- | --- | --- |
| Detail click today | Router/page read real Token and real endpoints | Same code path; Demo is ignored, so it can fail for no Token or leak into a real session if a Token exists | P0: Router and page must both use explicit Repository session mode |
| `getActivity` | One network detail request, opaque string preserved | Looks up generated activity by normalized string ID, no I/O | Existing method is sufficient |
| `getStreams` | One network request; currently blocked by `types`/`type` mismatch | Returns requested embedded streams or `{}`, no I/O | Fix internal query contract before Real migration; keep Demo empty-safe |
| Detail richness | Provider detail includes laps and other detail fields | Generated activity has summary/detail-like fields, gear, weather and map polyline, but no laps/best efforts/segments | Preserve empty states; do not fabricate capability |
| Stream richness | Provider-dependent | Only distance, time, altitude, velocity and HR; no lat/lng, cadence, watts, moving or grade | Advanced must fail closed/disabled for missing lat/lng |
| Zones shape | Legacy page expects `heart_rate.zones` | Demo provider exposes `heartrate` array | Read-session compatibility projection or approved Demo change is needed |
| Athlete | Repository/cache | Demo athlete available | Swim correction must use repository-provided athlete, never real storage in Demo |
| External weather | Existing pages may call Open-Meteo | Synthetic map can also trigger Open-Meteo | Demo external weather 0; Real behavior preserved and inventoried |

A3 freezes independent document-local mode: Router and destination each call `isDemoMode()` once and
freeze their own result. No URL mode, `sessionStorage`, Router memory, or cross-document bundle is
used.

### Error and authentication mapping

| Condition | Current behavior | Repository mapping / target rule |
| --- | --- | --- |
| 401 | Direct page throws status plus raw body; Router shows API error | `UNAUTHENTICATED`; retain safe sign-in/navigation copy |
| 403 | Same generic HTTP path | `FORBIDDEN`; do not label as missing Token |
| 404 / missing activity | Generic HTTP path; null activity can fail later | `NOT_FOUND`; safe not-found state and existing navigation |
| 429 | Generic HTTP path | `RATE_LIMITED` with safe retry metadata only |
| 500/provider failure | Often generic/API error; Advanced auth omission becomes server error | `PROVIDER_HTTP_ERROR`; never report as authentication |
| Network failure | Raw caught Error may reach console/UI | `NETWORK_UNAVAILABLE`; retryable, no raw cause |
| Malformed JSON/envelope | Native JSON/shape failure | `RESPONSE_INVALID`; fail closed |
| Missing/empty streams | HTTP failure aborts page; resolved `{}` yields conditional empty states | `getStreams` error is fatal; successful `{}` preserves current degraded UI |
| Token absent/invalid | Redirect or page-specific message | `UNAUTHENTICATED` / `TOKEN_INVALID` |
| Token read/encode/write failure | Storage/`btoa` error can leak raw message; parallel writes can race | `TOKEN_READ_FAILED`, `TOKEN_ENCODING_FAILED`, `TOKEN_WRITE_FAILED`; safe message only |

The target adapter may branch only on stable `RepositoryError` code and safe fields
(`operation`, `retryable`, `httpStatus`, `retryAfterSeconds`). It must not expose Token,
Authorization, response body/payload, or raw cause; must not clear or delete Local Library; and must
not turn a network/500/invalid-response error into an auth redirect. The security improvement of
removing raw response text is an intentional exception to byte-for-byte error detail, while visible
page copy/navigation should otherwise remain as close as possible.

### Output, DOM, and visual parity matrix

| Surface | Frozen parity requirement | Data-boundary-only allowance |
| --- | --- | --- |
| Generic Activity | Existing title, overview, classifier, zones, map/weather, splits, 11 canvas elements, laps/best efforts/segments, Advanced UI/exports | Replace acquisition/injection only; no algorithm/chart configuration change |
| Run | Existing hero/meta, summary, classifier/zones, map/weather, splits, dynamic chart, 12 canvases, laps/best efforts/segments | Same |
| Bike | Existing hero/meta, classifier/zones/climbs, map/weather/profile, splits/dynamic charts, 15 canvases, power curve, laps/best efforts/segments | Same |
| Swim | Existing hero/meta, zones, map/weather, strokes, laps, 4 canvases | Same; athlete correction must receive equivalent athlete data |
| All HTML/CSS/copy | Detail HTML and CSS bytes, IDs, classes, static copy and control order remain unchanged | Approved Router module extraction and safe error redaction are the only boundary exceptions |
| Charts/maps/tables | Same fixture yields same chart count, labels, dataset values/order, map polyline/controls, lap/split rows and visibility | Missing capability keeps current empty/hide behavior |
| Navigation | Same destination page selection, Back behavior and opaque `id` round trip | Optional mode hint would be an approved query-only exception |
| Loading/error/empty | Same visible placement and navigation; no stale partial DOM | Error source changes to safe Repository classification |

### Existing test coverage

- No detail-page, Router, Advanced Analysis, native-browser detail ESM, DOM, Chart, Leaflet/map,
  visual, or Demo-detail test exists.
- Repository tests cover real `getActivity`/`getStreams` network-only behavior, opaque ID
  preservation, success envelopes, requested type validation, Demo selection/empty streams, Factory
  mode selection, error/auth mapping, and import/constructor zero-I/O.
- Connector tests cover Authorization, refreshed-Token behavior, stable error mapping and the current
  stream URL, including the now-proven `types=` mismatch.
- Existing boundary/privacy tests do not prevent the five detail consumers from reading Token or
  calling provider endpoints directly.
- Baseline Node suite is 702/702. Browser/CDP, visual/manual, real-data, Safari/Firefox/mobile and
  Service Worker validation are all `Not run` in A0-A2.

## A3 accepted decisions

A3 is **Completed / Accepted**. It approves the exact implementation scope below but does not start
implementation. B1, B2, and B3 each require separate authorization after the preceding phase review.
PR #9 must remain Draft; Ready, merge, PR-04C, and PR-05 are not authorized.

### Approved architecture: Option A

- Keep exactly the seven Repository public methods: `listActivities`, `getActivity`, `getStreams`,
  `getAthlete`, `getZones`, `getGears`, and `getGear`.
- Do not add an eighth public method, `getActivityBundle`, or `getLaps`; do not change Repository
  public exports.
- Each destination detail document creates exactly one Repository and one memoized
  `DetailReadSession` bundle promise. Concurrent consumers share that promise.
- Activity, streams, zones, athlete context, and Advanced Analysis share the document-local read
  session. Repeated Advanced clicks may rerun local analysis but must not request activity or streams.
- Do not pass a detail bundle through `sessionStorage`, a URL payload, or a cross-page global.

“One ActivityBundle” is a destination-detail-document constraint. Router
`listActivities({ refresh: false })` is a routing-summary lookup, not a detail bundle request. A cold
Router cache may cause one list network request. Router must never call `getActivity` or `getStreams`,
and the detail page must not depend on an activity payload from Router.

### Router and document-local mode contract

- Extract the inline Router script from `html/activity-router.html` into
  `js/pages/activity-router.js`.
- Treat the activity ID as an opaque string. Reject only a missing or blank ID; never use
  `parseInt`, `parseFloat`, `Number`, or another numeric conversion. Construct the destination with
  `encodeURIComponent(id)`.
- Each Router document calls `isDemoMode()` once, creates one mode-appropriate Repository, and calls
  `listActivities({ refresh: false })` once.
- Route from summary `sport_type`/`type` using the current sport classification. If no matching
  summary exists, route to Generic Activity.
- Repository failure renders only a stable, safe error. It must not fall back to direct Strava API,
  read Token/Authorization/provider cache, or call a provider endpoint.
- Router and destination independently call `isDemoMode()` once and freeze their own document mode.
  Do not pass mode through URL, `sessionStorage`, or Router memory.
- A Demo document creates Demo Repository only. It must not construct a Real connector or read a
  real Token, real cache, or provider API.

### Connector compatibility and exact stream sets

Approve only the internal `StravaApiConnector.fetchStreams()` query correction from `types=` to
`type=`. Public `getStreams(id, { types })` remains unchanged. Do not modify `api/**`, emit both query
names, or otherwise expand Connector behavior. Only these files are approved for that correction:

```text
js/connectors/strava/strava-api-connector.js
tests/repository/strava-api-connector.test.js
```

Frozen stream sets:

| Consumer | Exact types |
| --- | --- |
| Generic Activity + Advanced | `distance,time,heartrate,altitude,cadence,watts,velocity_smooth,latlng,grade_smooth,moving` |
| Run | `distance,time,heartrate,altitude,cadence,watts,velocity_smooth` |
| Bike | `distance,time,heartrate,altitude,cadence,watts,velocity_smooth` |
| Swim | `distance,time,heartrate,cadence` |

Do not add temperature, change algorithms or stream structure, or generate/normalize streams in a
consumer.

### Missing, metadata, Advanced, weather, and error semantics

- `getActivity` and `getStreams` `RepositoryError` are fatal, preserving request-level
  all-or-nothing behavior. A successful empty streams object uses the current empty/degraded UI;
  absent optional streams use current capability degradation.
- Zones and athlete failures are optional and produce null/empty context without blocking the page.
  Never fabricate streams, laps, zones, or athlete. Laps remain embedded in Legacy activity detail.
- Generic, Run, Bike, and Swim consume only injected `getZones()` results. Swim maps Repository zones
  to its existing `heart_rate.zones` consumer shape. No page may read `strava_training_zones` or
  historical `strava_zones`; do not add fallback, adapter, migration, or backfill for
  `strava_zones`. The safe boundary behavior change from removing that stale read is accepted.
- Swim athlete correction consumes injected `getAthlete()` result and must not read
  `strava_athlete_data`.
- Fix the two `advanced-analysis.js` relative imports to existing `js/analysis/**`, inject the
  already-loaded activity/streams, and remove Advanced internal fetch. Do not change analysis
  algorithm, exports, result DOM, or UI flow. Tests must prove `quick-start-example.js` is not a
  production entry; that file remains prohibited.
- Demo detail Open-Meteo and all external weather requests must be zero. Real mode keeps current
  weather behavior. Gate weather through page session context without modifying
  `weather-analysis.js`. Real external-weather privacy governance is deferred.
- DOM, console, and public errors must not include Token, Authorization, response body, payload,
  cause, raw provider message, raw underlying exception message, or private activity content. Stable
  safe generic copy may replace leaking legacy copy while preserving the existing container, layout,
  Back/navigation behavior, and non-sensitive DOM contract.
- HTTP 500, network, and invalid response must not be classified as authentication failure. Errors
  must never delete Local Library, Legacy cache, or user data.

## Frozen final 20-file allowlist

This is the complete PR-04B allowlist. Encountering a twenty-first path requires an immediate stop and
new control-tower approval.

```text
docs/tasks/pr-04b-detail-consumers.md
js/pages/AGENTS.md
html/activity-router.html
js/pages/activity-router.js
js/pages/detail/detail-read-session.js
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/pages/activity/advanced-analysis.js
js/connectors/strava/strava-api-connector.js
tests/repository/strava-api-connector.test.js
tests/repository/dependency-boundaries.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
```

## Frozen prohibited scope

```text
html/activity.html
html/run.html
html/bike.html
html/swim.html
styles/**
sw.js
.github/**
package.json
package-lock.json
api/**
js/app/**
js/services/**
js/demo/**
js/data/**
js/analysis/**
js/tabs/**
js/repository/**
js/pages/activity/quick-start-example.js
js/pages/activity/analysis-ui-components.js
docs/architecture/**
docs/engineering/**
docs/product/**
docs/tasks/README.md
tests/legacy/**
tests/contracts/**
tests/repository/**
```

The only `tests/repository/**` exceptions are
`tests/repository/strava-api-connector.test.js` and
`tests/repository/dependency-boundaries.test.js`. Do not prohibit `js/pages/**` broadly because only
the exact page paths in the 20-file allowlist are approved.

## Frozen phase allowlists

### B1 — Completed locally / awaiting B1.3 exact-head CI

```text
docs/tasks/pr-04b-detail-consumers.md
js/pages/AGENTS.md
html/activity-router.html
js/pages/activity-router.js
js/pages/detail/detail-read-session.js
js/connectors/strava/strava-api-connector.js
tests/repository/strava-api-connector.test.js
tests/repository/dependency-boundaries.test.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
```

Goals: page governance, Connector `type=` fix, opaque Router ID, Router Repository boundary,
`DetailReadSession`, document mode freeze, memoization, and foundational boundary tests.

### B2 — Not started / not authorized until B1 review

```text
docs/tasks/pr-04b-detail-consumers.md
js/pages/activity/index.js
js/pages/run/index.js
js/pages/bike/index.js
js/pages/swim/index.js
js/pages/activity/activity.js
js/pages/run/run.js
js/pages/bike/bike.js
js/pages/swim/swim.js
js/pages/activity/advanced-analysis.js
tests/consumers/detail-consumers.test.js
tests/consumers/detail-boundaries.test.js
```

Goals: migrate all four detail consumers; remove consumer Token/fetch/provider storage; inject
activity/streams/zones/athlete; reuse the bundle in Advanced; preserve algorithms, DOM, charts, maps,
laps, and exports.

### B3 — Not started / not authorized until B2 review

```text
docs/tasks/pr-04b-detail-consumers.md
tests/consumers/detail-browser-smoke.html
```

Goals: complete Node gates, disposable-profile Browser/CDP gates, deterministic synthetic end-to-end
evidence, and final privacy/migration/rollback/scope audit.

Every phase stops after local implementation and verification. Do not stage, commit, push, update the
PR body, or enter the next phase until control-tower review and separate Finalization authorization.

## Frozen automated and Browser/CDP acceptance

Automated coverage must prove opaque Router IDs and all sport routing; one Repository and one
memoized bundle promise per destination document; concurrent promise sharing; exact activity,
streams, and metadata call counts; exact stream sets; Advanced repeated-click zero provider I/O;
injected zones/athlete; all Repository error/privacy semantics; Demo/Real isolation; Connector
`type=`; import zero-I/O and acyclic boundaries; current output parity; and that
`quick-start-example.js` is not a production entry.

B3 browser acceptance must:

- use a disposable Chrome profile and deterministic synthetic data only;
- prohibit the user's browser profile, real Token, account, network data, and private data;
- verify browser-native ESM, opaque Router IDs, and every current sport route;
- verify Generic, Run, Bike, and Swim in Demo and a synthetic Real seam;
- verify one Repository per document, exact activity/streams/metadata calls, and concurrent
  memoization;
- verify repeated Advanced clicks perform zero provider I/O and injected zones/athlete work;
- cover missing HR/GPS/power/cadence/laps/streams;
- verify DOM, canvas, chart, map, laps, exports, error, empty, and navigation parity;
- verify Demo external/provider network, Token, real-cache, and storage I/O are all zero;
- inspect console error/warning and uncaught exceptions; and
- record before/after snapshots of Local Storage, Session Storage, IndexedDB, Cache Storage, and
  Service Worker.

Existing detail-page CDN requests and Real Open-Meteo requests are recorded as **Legacy External
Resource Inventory**. An isolated smoke harness must not be used to claim that production detail
pages are fully offline.

Browser/CDP, visual/manual, real-data, Safari/Firefox/mobile, and production Service Worker checks
remain `Not run` until an authorized B3 execution.

## A3 privacy, migration, and rollback decisions

- **Privacy:** consumers receive only page data and safe Repository errors. They do not receive Token
  or Authorization, perform provider-owned storage reads, or expose body/payload/cause/private data.
  Demo external weather/provider I/O is zero; Real weather is unchanged and inventoried for later
  governance.
- **Migration:** no IndexedDB, Canonical, cache, Token, or storage-schema migration; no new storage
  key, fallback, adapter, backfill, or cleanup. Legacy embedded laps remain authoritative.
- **Rollback:** B1, B2, B3 and the Connector correction remain separate ordinary revert units. Never
  reset, rebase, force-push, clear Local Library, delete Legacy cache, or delete user data.

## Required automated checks

At A0–A3 and after every authorized implementation-phase update, record actual results for:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

## Manual verification

- Browser/CDP detail-page smoke: frozen for separately authorized B3; A0–A3 result is `Not run`.
- Visual parity, Safari/Firefox/mobile, production Service Worker, real Strava account/network,
  private data, and the user's existing browser profile: `Not run` in A0–A3.

## Privacy and security impact

A0–A3 are documentation, read-only investigation, and decision recording only. They do not read or expose Token,
Authorization, account, activity, GPS, heart-rate, power, private fixture, raw body/payload/cause,
or the user's browser profile. All future test design must use deterministic synthetic data and
fail closed without deleting Local Library data.

## Migration impact

None in A0–A3. No IndexedDB, cache, storage schema, Token lifecycle, Canonical data, Legacy data,
or Local Library content is created, modified, migrated, cleared, or deleted.

## Rollback procedure

A1/A2/A3 change only this Task Brief in ordinary commits. Rollback requires control-tower direction
and an ordinary revert; do not reset/rebase/force-push, delete branches/worktrees, or clear browser
or Legacy storage.

## Independent review checklist

- [x] A0 exact baseline and absence checks passed before creation.
- [x] A0 minimum automated gates passed with actual evidence.
- [x] A1 Task Brief-only commit, push, Draft PR, and exact-head CI recorded.
- [x] A2 required call graphs and matrices completed from read-only evidence.
- [x] A2 diff remains Task Brief only and implementation remains unstarted.
- [x] Final A2 local gates passed against the completed investigation.
- [x] A2 commit, push, Draft PR update, and exact-head CI verified.
- [x] A3 decisions and exact phase/file scopes frozen; implementation remains unstarted.
- [x] A3 local gates passed against the completed decision record.
- [x] A3 Task Brief-only commit/push, PR update, and exact-head CI verified.
- [x] Final A3 worktree clean, local/upstream `0/0`, PR diff Task Brief only.

## Completion evidence

### A0

- Completed at starting baseline `66cdc2c457457a93bec46fdf98c5a508c96770c9`.
- All local/remote safety checks and baseline gates passed as recorded above.

### A1

- Task Brief-only commit: `e9b91d7102c123535f92144c9386b593dc623e6d`
  (`docs(v2): define PR-04B detail consumer investigation`).
- Normal push set upstream to `origin/codex/v2/detail-consumers`; no force push.
- Draft PR #9 opened from `codex/v2/detail-consumers` to `integration/v2`; PR remained Draft and
  its diff contained only this Task Brief.
- GitHub Actions CI run `30807691591` (`CI`, run #46) completed `success`; job `91666768157`
  (`checks`) completed `success`. The CI head was exactly the A1 commit.

### A2

- Read-only investigation and decision package completed; A3 resolved its proposals in the accepted
  decisions above. No eighth Repository method was added.
- Final local gates: `npm ci` PASS (6 packages, 0 vulnerabilities); syntax PASS (133 files);
  privacy PASS; tests PASS (702/702, skipped/cancelled/todo `0/0/0`); `git diff --check` PASS.
- Browser/CDP/manual/visual/real-data checks: `Not run`.
- A2 commit `ad6b37b9cfd7478e0925c622b240cb9217ce3a11`, Draft PR update, and exact-head CI run
  `30808477643` / job `91669274598` completed successfully.
- Implementation had not started and the PR diff remained Task Brief only.

### A3

- Completed / Accepted. Option A, the 19-file total allowlist, prohibited scope, phase allowlists,
  Browser/CDP acceptance, and privacy/migration/rollback decisions are frozen above.
- Start precheck PASS at `ad6b37b9cfd7478e0925c622b240cb9217ce3a11`: clean worktree,
  local/upstream `0/0`, remote base unchanged, and PR #9 OPEN/Draft with Task Brief-only diff.
- Local gates PASS: `npm ci` added 6 packages with 0 vulnerabilities; syntax 133 files; privacy PASS;
  tests 702/702 with skipped/cancelled/todo `0/0/0`; `git diff --check` PASS.
- This Task Brief is the sole A3 change. Implementation has not started; B1 is not authorized.
- A3 commit/push, PR body update, and exact-head CI are post-commit evidence recorded in PR #9 and
  the final control-tower handoff.
- Commit `98eec7a9ebd797e5580310ce1e8e528311ed99fa`; CI run `30809830279`; job
  `91673680107`; PR diff Task Brief only; final worktree clean; local/upstream `0/0`.

### A3.1 / B1.1

- **Completed / Accepted.** The B1 initial control-tower result was **REVISE** because the sole
  failing `tests/repository/dependency-boundaries.test.js` assertion froze the pre-B1 Connector and
  Connector-test SHA-256 values, conflicting with the approved `types=` to `type=` correction.
- The final PR-04B allowlist expands from 19 to 20 paths and the B1 allowlist expands from 9 to 10
  paths by adding only `tests/repository/dependency-boundaries.test.js`. A twenty-first PR path or
  eleventh B1 path requires new control-tower approval.
- This extension authorizes only maintenance of the existing fixed, auditable hash boundary. It
  does not authorize new Repository, Connector, or consumer behavior and does not authorize
  deleting, skipping, dynamically satisfying, or weakening the hash assertions.
- The approved frozen hashes are Connector
  `ea3810a190451cf9bdff9f4f2bdcc3a81a8591c4ec385b14dd07de6324061ba8`, Connector test
  `c9d429b305d959ebb839e178610c37744dcaffbb9e25cc99f314916cc0ab4d7e`, and unchanged Repository
  errors `0a9018b272fd0535a5ff8ff6f8661e3630924db360fded96be3386a96da49839`.

### B1

- Status before the exact-head shallow-checkout result: final control-tower acceptance of B1, B1.1,
  and B1.2. Current status is **Completed locally / awaiting B1.3 exact-head CI** after B1.3
  control-tower PASS; B2 and B3 remain not started and not authorized.
- Authorized implementation: page governance, Connector `type=` compatibility, opaque-ID Router,
  document-local mode/Repository boundary, memoized `DetailReadSession`, and deterministic B1 tests.
- Privacy boundary: deterministic synthetic data only; no real Token, account, network, activity,
  GPS, heart-rate, power, private fixture, or user browser profile.
- Migration impact: none. No storage schema, IndexedDB, Canonical, cache, or key migration; no Legacy
  cleanup or deletion; Service Worker remains unchanged.
- Rollback boundary: only local unstaged B1 allowlist files; no reset, rebase, branch/worktree removal,
  or user-data cleanup.
- Browser/CDP, visual/manual, real-data, and production Service Worker verification: `Not run`.
- Local implementation and B1.1 governance correction are present only in the ten authorized B1
  paths: this Task Brief, page governance, Router HTML/module, `DetailReadSession`, Connector,
  Connector tests, the dependency hash boundary, and two consumer suites. The four detail
  consumers, Advanced Analysis, Repository public API/implementation, package files, Service Worker,
  and all B2/B3 paths remain unchanged.
- Focused evidence: Connector `102/102`; the two consumer suites `49/49`; combined B1 focused run
  `151/151`. Legacy/Auth/Demo regression passed `241/241`. All these runs reported
  skipped/cancelled/todo `0/0/0`.
- Initial B1 gate evidence reproduced Repository regression `252/253` and full `npm test` `751/752`,
  with skipped/cancelled/todo `0/0/0`. The sole failure was the pre-existing
  `tests/repository/dependency-boundaries.test.js` assertion named
  `B1 Connector, errors, and tests remain byte-for-byte unchanged`. It freezes the pre-B1 Connector
  and Connector-test SHA-256 values, while this B1 explicitly requires both files to change from
  `types=` to `type=` and add its regression. The current Connector hash is
  `ea3810a190451cf9bdff9f4f2bdcc3a81a8591c4ec385b14dd07de6324061ba8`; the current Connector-test
  hash is `c9d429b305d959ebb839e178610c37744dcaffbb9e25cc99f314916cc0ab4d7e`.
  A3.1/B1.1 authorized updating only those two fixed hashes while retaining the unchanged errors
  hash and the same byte-for-byte assertion strength.
- B1.1 dependency hash correction is **Completed / PASS**: its focused hash boundary and full
  Repository regression passed while retaining fixed, auditable Connector, Connector-test, and
  Repository-errors hashes.
- B1.1 hash correction evidence: the dependency boundary passed `6/6`; Connector passed `102/102`;
  Repository regression passed `253/253`; Legacy/Auth/Demo passed `241/241`. `npm ci` added 6
  packages with 0 vulnerabilities; syntax passed for 137 files; privacy passed; `git diff --check`
  passed. All reported skipped/cancelled/todo counts are `0/0/0`.
- B1 consumer focused is **blocked at `48/49`**, combined B1 focused at `150/151`, and full
  `npm test` at `751/752`. The sole failure is
  `tests/consumers/detail-boundaries.test.js` asserting an embedded
  `exact nine-path B1 allowlist`; it rejects the newly approved
  `tests/repository/dependency-boundaries.test.js` path. B1.1 explicitly permits actual changes
  only to this Task Brief and the dependency-boundary test and requires the previous nine B1 files
  to remain byte-identical, so the consumer boundary test was not modified. A separate control-tower
  scope decision is required to update that stale nine-path assertion to the accepted ten-path
  contract.

### B1.2

- Status: **Completed / PASS**. This is a contract synchronization, not a
  new scope expansion: the total allowlist remains 20 and the B1 allowlist remains 10.
- Root cause: after `tests/repository/dependency-boundaries.test.js` became an approved working-tree
  path, `tests/consumers/detail-boundaries.test.js` still embedded the pre-A3.1 nine-path Set. The
  consumer suites passed `49/49` before the new path appeared and then failed `48/49` solely on that
  stale assertion.
- B1.2 authorizes changes only to this Task Brief and
  `tests/consumers/detail-boundaries.test.js`: add the already-approved dependency-boundary path to
  the fixed Set and rename the assertion from nine-path to ten-path. Product code, Connector,
  Repository, and all other tests remain unauthorized.
- B1.2 changed only the fixed Set and test name: the scope check still collects tracked/untracked
  paths through `git status`, committed paths through `START_SHA...HEAD`, requires every observed
  path to be a member of the fixed Set, and caps observed size at the ten-path Set size. No wildcard,
  dynamic Task Brief/diff allowlist, skipped test, or weakened assertion was introduced.
- Final focused evidence: consumer boundary `14/14`; dependency boundary `6/6`; Connector
  `102/102`; consumer suites `49/49`; B1 combined `151/151`; all four focused files `157/157`.
  Regression evidence: Repository `253/253`; Legacy/Auth/Demo `241/241`; full tests `752/752`.
  Every run reported skipped/cancelled/todo `0/0/0`.
- Final gates: `npm ci` added 6 packages with 0 vulnerabilities; syntax passed for 137 files;
  privacy passed; `git diff --check` passed. B1.2 isolation and final Git state confirm exactly ten
  approved unstaged paths, no protected-path changes, empty staging, and local/upstream `0/0`.
- B1.2 and B1 received final control-tower PASS.

### B1 Finalization — local PASS / awaiting B1.3 exact-head CI

- Final control-tower acceptance: Router Repository boundary PASS; opaque activity ID PASS;
  `DetailReadSession` same-Promise memoization PASS; Connector single `type=` compatibility PASS;
  Demo isolation PASS; error/privacy boundary PASS; the 20-file total allowlist and 10-file B1
  allowlist Accepted; dependency fixed-hash boundary PASS; consumer ten-path boundary PASS.
- Final local gates: `npm ci` added 6 packages with 0 vulnerabilities; syntax passed for 137 files;
  privacy passed; Connector `102/102`; dependency boundary `6/6`; consumer suites `49/49`; B1
  combined `151/151`; all four focused files `157/157`; Repository `253/253`;
  Legacy/Auth/Demo `241/241`; full tests `752/752`; skipped/cancelled/todo `0/0/0`;
  `git diff --check` passed.
- Browser/CDP, manual, visual, real Token/account/data, and production Service Worker verification
  remain `Not run`. B2 and B3 have not started. The Draft PR must remain Draft; Ready, merge,
  PR-04C, and PR-05 are not authorized.
- The B1 Finalization commit and exact-head CI are post-commit evidence recorded in the Draft PR
  body and final handoff report.

### A3.2 / B1.3

- **A3.2: Completed / Accepted. B1.3: Completed / PASS.** B1 is completed locally and awaits the
  B1.3 correction commit's exact-head CI. B2 and B3 remain not started and not authorized.
- B1 commit `bcd572fa2108f01d7e657fc2d2e3f5f4ec50f5d3` produced exact-head pull-request CI run
  `30863157208`, job `91849280317`. Install dependencies, syntax, and repository privacy passed;
  the test step failed at `749/752`, with skipped/cancelled/todo `0/0/0`.
- The three failures are confined to `tests/consumers/detail-boundaries.test.js`. GitHub Actions'
  depth-1 checkout does not contain A3 start commit
  `98eec7a9ebd797e5580310ce1e8e528311ed99fa`, so the test's `git show START_SHA:path` and
  `git diff START_SHA...HEAD` history reads fail. This is a CI checkout compatibility defect in the
  boundary test, not a Router, `DetailReadSession`, Connector, Repository, Demo, privacy, or consumer
  behavior failure.
- A3.2 authorizes changing only this Task Brief and
  `tests/consumers/detail-boundaries.test.js`. It does not extend the frozen 20-file total allowlist
  or 10-file B1 allowlist and does not authorize product, Connector, Repository, workflow, package,
  or any other test change.
- The accepted correction does not change `.github/**`, checkout depth, or fetch history. It replaces
  history-dependent protected-file comparisons with fixed protected-tree SHA-256
  `c36cf8c22cbfe1b907728bb48569b442f713a71e8b374fda155ae17074c555e2`, derived independently
  from the A3 tree with `git ls-tree -r -z`, excluding exactly the frozen ten B1 paths, sorting paths
  by JavaScript code-unit order, and hashing canonical `<mode> <object-id>\t<path>\0` records.
- The working-tree audit remains based on `git status --porcelain=v1 -z --untracked-files=all`; every
  observed path must belong to the fixed ten-path Set and the observed count cannot exceed ten. The
  protected index is read with `git ls-files -s -z`, requires stage-zero entries, excludes only the
  same fixed ten paths, and must match the fixed digest. No wildcard, dynamic Task Brief/diff
  allowlist, current-equals-current assertion, warning downgrade, skipped test, or weakened boundary
  is authorized.
- The package files, Repository public files/implementation, Service Worker, B2 product files, and B3
  browser harness remain protected by the fixed tree digest and explicit scope assertions. Any
  protected-file mutation changes the digest, and any eleventh working-tree path still fails the
  fixed ten-path audit.
- Independent digest evidence: the A3 baseline and current protected index each contain 207 protected
  entries and both produce `c36cf8c22cbfe1b907728bb48569b442f713a71e8b374fda155ae17074c555e2`.
  A synthetic in-memory protected-object mutation produces
  `d0f5e4b1e88fe9a64f47ace0abd0c089953d30ba7f6511191ef78edb53f538ca`, proving the fixed
  comparison rejects protected-tree changes.
- Depth-1 reproduction at exact B1 HEAD confirmed `--is-shallow-repository=true` and confirmed A3
  start commit is absent. With only the two authorized B1.3 files overlaid, the boundary passed
  `14/14` and full tests passed `752/752`, with skipped/cancelled/todo `0/0/0`. Adding a synthetic
  eleventh untracked path in that disposable clone failed the boundary at `13/14` with
  `B1 path is not approved`; the clone was then deleted.
- Formal-worktree final gates: `npm ci` added 6 packages and found 0 vulnerabilities; syntax passed
  for 137 files; privacy passed; consumer boundary `14/14`; consumer suites `49/49`; all four
  focused files `157/157`; Repository `253/253`; Legacy/Auth/Demo `241/241`; full tests `752/752`;
  skipped/cancelled/todo `0/0/0`; and `git diff --check` passed.
- Control-tower independent verification passed: A3 baseline protected entries `207`; independent
  digest `c36cf8c22cbfe1b907728bb48569b442f713a71e8b374fda155ae17074c555e2`; boundary
  `14/14`; fixed digest, stage-zero parsing, exact ten-path exclusion, working-tree audit, shallow
  boundary/full verification, and the B1.3 two-path isolation all `PASS`.
- The protected-tree digest is a B1 phase guard. B2 may update that phase guard only through its
  already approved `tests/consumers/detail-boundaries.test.js` path. The currently frozen B3 phase
  allowlist contains only this Task Brief and `tests/consumers/detail-browser-smoke.html`. Because B3
  will add that browser harness, the control tower must review the B3 phase allowlist before B3 is
  authorized; if B3 also needs `tests/consumers/detail-boundaries.test.js`, that path must first be
  added through a separate B3 scope extension. This B1.3 finalization does not pre-exclude or
  pre-authorize the B3 harness in the digest guard.
- The B1.3 correction commit and its exact-head CI are post-commit evidence. The new CI must not be
  recorded as passing before it completes. PR #9 must remain Draft; Ready, merge, PR-04C, PR-05,
  B2, and B3 remain unauthorized. Browser/CDP, manual, visual, real Token/account/data, user browser
  profile, real Strava network, and production Service Worker verification remain `Not run`.
