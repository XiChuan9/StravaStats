# PR-04B：活动详情消费者迁移

## Metadata

| Field | Value |
| --- | --- |
| Status | Awaiting decision |
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

## Goal

- 查明 activity router、通用详情页、Run/Bike/Swim 详情页和 Advanced Analysis 的真实取数链。
- 设计最小迁移，使详情 consumer 只通过 Repository 或明确的页面 read façade 获取数据。
- 避免页面和 Advanced Analysis 重复获取同一活动数据。
- 保持现有详情输出、算法、DOM、CSS、路由和视觉不变。
- 不在 A0–A2 实施迁移。

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

## Allowed files during A0–A2

```text
docs/tasks/pr-04b-detail-consumers.md
```

产品源码、测试、长期文档和治理文件在 A0–A2 只能读取。候选实施路径将在 A2 中作为
proposal 记录，不构成 allowlist，也不授权实现。

## Prohibited files and operations during A0–A2

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
控制塔批准；A2 不会自行新增或冻结该能力。

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

### Evidence boundary

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
  bundle/result promise. Whether PR-04B may expand the generic stream request to that union is an A3
  control-tower decision.

`quick-start-example.js` also uses `parseInt()` and direct API fetches, but no production import or
HTML reference was found. It remains prohibited unless control tower proves it is a supported entry
point and adds an explicit acceptance test.

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
Connector tests freezing the mismatched `types=` URL. This must be decided before migration. The
narrow proposal is an internal Connector query-name correction plus its existing test update; it
does not change the seven-method Repository API or server `api/**`.

### Consumer/provider/storage dependency matrix

| Data/state | Current owner/readers | Classification | Target boundary proposal |
| --- | --- | --- | --- |
| `strava_tokens` | Router + all four pages; Connector also owns it | Provider/auth owned | Connector only, reached through Repository; never page/read façade output |
| `strava_activities`, timestamp, cache version | activity cache service / LegacyRepository; historical consumers | Provider cache | Repository only |
| `strava_athlete_data`, timestamp | Legacy cache; Swim reads directly | Provider metadata | `getAthlete()` via read session only where parity requires it |
| `strava_training_zones`, timestamp | Generic/Run/Bike direct read; Legacy cache | Provider metadata | `getZones()` via read session; normalize only the proven Legacy page projection |
| `strava_zones` | Swim direct read; no active writer found | Historical inconsistent provider key | Explicit compatibility decision; do not silently keep direct access |
| `strava_gears`, `strava_gear_<id>`, timestamps | Legacy cache/gear consumers | Provider metadata | Embedded activity gear remains; no extra detail-page query unless parity test proves required |
| `strava_demo_mode` | Demo selector and summary composition | UI/source selection state | Allowlisted composition-root read once, converted to explicit `sessionMode` |
| `strava_demo_*`, `strava_tokens_demo` | Demo provider namespace | Demo-owned compatibility data | DemoRepository/provider only; no detail consumer access |
| map style, route color, weather toggle, chart selectors/sliders | Current detail DOM/in-memory state | Page UI/user state | Keep in memory; no new storage |
| weather cache | module-local `Map` | Non-provider transient cache | Preserve behavior; decide separately whether Demo may call Open-Meteo |

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
| External weather | Existing pages may call Open-Meteo | Synthetic map can also trigger Open-Meteo | Decide whether Demo must remain zero-external-I/O or preserve current weather behavior |

A mode read once in the destination composition root is enough for page-session stability. To also
guarantee the Router and destination use the identical mode, choices are: carry a validated
`demo|real` query hint (URL change), use ephemeral storage (privacy/staleness cost), or accept two
independent reads of the same UI source setting across the document boundary. This is not silently
decided here.

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
| Missing/empty streams | HTTP failure aborts page; resolved `{}` yields conditional empty states | Preserve resolved-empty degradation; decide whether a streams `NOT_FOUND` is fatal or an empty partial bundle |
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
| All HTML/CSS/copy | Detail HTML and CSS bytes, IDs, classes, static copy and control order remain unchanged | Router script loading may change only if separately approved; safe error detail may be redacted |
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

## Candidate target designs

All designs below are proposals. None expands the approved allowlist or authorizes implementation.

### Target graph candidate (recommended shape, pending approval)

```text
Router document
  -> preserve/validate opaque string ID
  -> freeze session mode for this document
  -> createRepository({ sessionMode }) once
  -> listActivities({ refresh: false }) for sport summary
  -> navigate to existing detail URL

Destination detail document
  -> page index is composition root
  -> freeze/validate sessionMode once
  -> createRepository({ sessionMode }) once
  -> create one memoized DetailReadSession / bundle promise
     -> getActivity(id) exactly once
     -> getStreams(id, { types: page-approved exact list }) exactly once
     -> getZones() once where used
     -> getAthlete() once for Swim compatibility only
     -> aggregate safe warnings/partial semantics without exposing auth data
  -> inject Legacy page-local detail bundle into existing renderer
  -> inject same activity/streams into Advanced Analyzer
  -> repeated Advanced clicks reuse bundle/result; zero provider requests
```

This is a Legacy compatibility composition, not an eighth Repository method and not a Canonical
ImportedActivityBundle. Router uses only activity summaries; the destination owns the only detail
bundle. On a warm activity-list cache the Router adds no provider request; on a cold cache it can add
one list request, but it does not duplicate the activity-detail request.

### Design comparison

| Option | One destination bundle | Router reuse / duplicate provider work | Demo/Real parity | Public API / Connector | Storage, partial semantics, test/rollback risk |
| --- | --- | --- | --- | --- | --- |
| A. Page-local read façade over seven methods; Router uses `listActivities` | Yes: memoized `getActivity` + exact `getStreams`, plus needed metadata | No cross-document object reuse; avoids duplicate detail fetch. Warm cache adds 0 Router provider calls, cold cache may add 1 list call | Natural through existing Factory; requires zones-shape and missing-capability compatibility | No eighth method. Internal Connector `types` -> `type` fix is a prerequisite. No Connector bundle method | No new storage. Façade must define fatal activity vs empty/partial streams and safe warning aggregation. Smallest rollback surface |
| B. Add public `getActivityBundle` eighth method | Yes | Router still cannot reuse it through navigation without transport; calling it in both documents duplicates the whole bundle | Requires Legacy and Demo implementation/parity contract | Expands public Repository API and tests; may internally call existing Connector methods, so no network saving by itself | Must freeze requested-stream, metadata, laps, warning and partial contract. Highest governance and rollback cost; requires new control-tower approval |
| C. Router fetches bundle and passes via `sessionStorage` nonce | Yes across Router and page if consume-once succeeds | True handoff can remove Router/page duplication | Requires strict Real/Demo namespace and mode binding | Can keep seven methods; Connector mismatch remains | Stores provider-owned activity/streams, adds size/TTL/stale/reload/crash/malformed cleanup semantics and privacy surface. High test/migration risk; not recommended |
| D. Change every link producer to route directly by sport/type | Yes in destination; Router usually skipped | Zero Router request when producer has trustworthy type; deep links still need fallback | Works if every producer has equivalent Demo summaries | No eighth method; Connector mismatch remains | Broad producer allowlist, includes PR-04C `run-plus`, stale/missing-type risks and more rollback points. Violates minimal PR-04B scope |
| E. Router direct `getActivity`, page fetches only streams using URL/storage payload | Not safely without transporting the activity | Activity can be reused only through query/storage/global state; query is too large/private and global dies on navigation | Requires serialization parity | Seven methods possible | Equivalent to C or unsafe URL disclosure; rejected |

### Recommendation

Recommend Option A, subject to A3 approval, with these explicit constraints:

1. Keep the seven-method Repository public contract unchanged; do not add `getActivityBundle` or
   `getLaps`.
2. Treat the destination page index as composition root and create one Repository plus one memoized
   page-local Legacy bundle/read session. The renderer and analyzer receive data; they do not choose
   provider, Token, cache, mode, or storage.
3. Route using a Repository activity summary rather than a discarded detail. Preserve the opaque ID
   exactly and encode only when constructing the destination URL.
4. Correct the internal Connector stream query name only if control tower approves the proven
   compatibility fix; do not change server `api/**` or the public `{ types }` method.
5. Continue using embedded Legacy laps. Preserve resolved-empty stream behavior; fail activity
   absence closed. Do not fabricate Demo streams/laps.
6. Request the existing per-page stream list unchanged, except the Generic+Advanced union requires a
   specific approval. Without that union, Advanced cannot meet the no-repeat requirement because
   `latlng` is absent from the current page request.
7. Avoid sessionStorage and provider payload handoff. Decide separately whether an explicit validated
   mode query hint is acceptable; otherwise freeze mode independently once per document.

### Candidate allowed files (proposal only)

| Candidate | Why it may be necessary / why not elsewhere | Acceptance evidence | Phase |
| --- | --- | --- | --- |
| `docs/tasks/pr-04b-detail-consumers.md` | Phase bookkeeping and evidence | Gates/CI and decision record | B1-B3 |
| `js/pages/AGENTS.md` (new) | `js/pages/**` has no nested ownership rules; exact consumer/storage/import constraints cannot be safely scoped in a broader root rule | Privacy/boundary review | B1, only if governance file creation is approved |
| `html/activity-router.html` | Existing inline script is the actual Router and only place to switch it to a module without changing DOM | Router destination/DOM snapshot | B1 |
| `js/pages/activity-router.js` (new, optional extraction) | Pure exported ID/classification/routing helpers are unit-testable; inline code cannot be imported safely. If extraction is rejected, keep logic inline and use browser tests | Opaque-ID and sport-routing tests | B1 |
| `js/pages/detail/detail-read-session.js` (new) | Single narrow composition façade provides promise memoization, safe errors and metadata projection without expanding Repository API | Call-count, mode, partial/warning, Demo/Real tests | B1 |
| `js/pages/activity/index.js`, `js/pages/run/index.js`, `js/pages/bike/index.js`, `js/pages/swim/index.js` | These are the existing composition roots; only they can create/inject one page-session Repository without making renderers select providers | Import zero-I/O and one-construction tests | B1/B2 |
| `js/pages/activity/activity.js`, `js/pages/run/run.js`, `js/pages/bike/bike.js`, `js/pages/swim/swim.js` | Each large module independently owns direct Token/fetch/storage/init behavior, so all four must remove it while retaining renderer logic | Per-page direct-I/O boundary and fixture parity tests | B2 |
| `js/pages/activity/advanced-analysis.js` | Owns duplicate fetches and broken import paths; must accept injected activity/streams for no-repeat Advanced behavior | Repeated-click/network-zero and algorithm input tests | B2, import fix requires explicit scope approval |
| `js/connectors/strava/strava-api-connector.js` | Only internal client location can correct `types=` to server-compatible `type=` without changing public API or prohibited server | Existing Connector URL test plus Repository Real test | B1 prerequisite, explicit approval required |
| `tests/repository/strava-api-connector.test.js` | Existing test currently freezes the mismatched URL and must change with the approved compatibility correction | Exact URL/auth/error regression | B1 prerequisite |
| `tests/consumers/detail-consumers.test.js` (new) | No current consumer test can prove bundle memoization, exact calls, per-page streams, Advanced reuse or Demo parity | Consumer acceptance suite | B1/B2 |
| `tests/consumers/detail-boundaries.test.js` (new) | Separate static boundary test can forbid Token/storage/direct endpoint/import-time I/O without mixing behavior tests | Privacy and dependency assertions | B1/B2 |
| `tests/browser/detail-consumers-smoke.html` (new, optional) | Native ESM/DOM/Chart/Leaflet behavior cannot be proven by Node alone; deterministic local harness avoids real data/profile | Browser smoke matrix | B3, only if browser harness is approved |

Extracting the Router is recommended for pure opaque-ID and routing tests, but not required for
runtime architecture. The four index modules should change if composition-root injection is
accepted. All four large page modules must change because direct provider/storage ownership is
duplicated in each. The list above is deliberately file-specific; it is not `js/pages/**`.

### Explicit prohibited files for implementation unless separately re-scoped

```text
html/activity.html
html/run.html
html/bike.html
html/swim.html
css/**
js/pages/activity/quick-start-example.js
js/pages/activity/analysis-ui-components.js
js/analysis/**
js/tabs/**
js/tabs/run-plus.js
js/repository/index.js
js/repository/factory.js
js/repository/errors.js
js/repository/legacy/legacy-repository.js
js/repository/demo/demo-repository.js
js/data/contracts/**
js/demo/**
api/**
service-worker.js
package.json
package-lock.json
docs/tasks/README.md
docs/engineering/**
docs/architecture/**
docs/product/**
```

Repository public files, Demo generator/Repository, server, detail HTML/CSS, algorithms, link
producers, PR-04C, dependencies and long-lived governance remain prohibited under the recommended
path. Any evidence that forces one of them must return to A3 rather than expand the allowlist during
implementation.

### Proposed implementation phases (not authorized)

- **B1 - boundary and prerequisite:** approve/create page rules if required; resolve the Connector
  query-name blocker; add Router/read-session pure composition, opaque-ID preservation, stable mode,
  memoization and boundary tests. Do not migrate render algorithms.
- **B2 - consumer migration:** inject the read session through all four indexes; remove direct
  Token/fetch/provider-owned storage from the four renderers; inject Generic activity/streams into
  Advanced; preserve exact output and missing-capability behavior. No algorithm/DOM/CSS change.
- **B3 - closure evidence:** run full automated gates and approved deterministic browser/CDP smoke;
  compare DOM/chart/map/laps/export/loading/error/empty/navigation parity; update only the Task Brief
  with evidence. Real account/private data/production profile remain out of scope.

### Automated test plan

1. Pure Router tests: preserve opaque IDs (`abc-123`, `123abc`, unsafe-length digits), reject only
   missing/blank IDs, encode destination, and preserve all current sport routing cases/fallback.
2. Read-session tests: one Repository construction, exact `getActivity`/`getStreams`/metadata call
   counts, one memoized promise under concurrency/retry policy, exact per-page stream arrays, safe
   warning/partial aggregation, and no public eighth method.
3. Advanced tests: injected required shape, missing `latlng` fail closed, repeated clicks create no
   activity/streams calls, and analyzer/exports receive unchanged values.
4. Demo/Real parity tests: explicit session mode, Demo zero Token/cache/network access, missing Demo
   streams/laps empty-safe, zones/athlete compatibility, Real calls Connector only.
5. Error tests: all Repository codes, missing activity/streams, malformed envelope, Token lifecycle
   failures, 401/403/404/429/5xx/network; assert no Token/body/payload/raw cause in DOM/logs.
6. Boundary/import tests: native Node ESM import with storage/fetch/DOM sentinels, no direct
   `/api/strava-*`, Authorization, `strava_tokens`, provider-owned keys, or `parseInt(activityId)` in
   migrated consumers; dependency graph remains acyclic.
7. Connector regression: exact `type=` URL, encoded opaque ID/type list, Authorization, refreshed
   Token and full error mapping.
8. Fixture parity: snapshot current IDs/classes/visibility and chart datasets for Generic, Run, Bike,
   Swim with full, missing-HR, missing-GPS, missing-power, missing-cadence, no-laps and empty-stream
   fixtures.
9. Always run `npm ci`, syntax, privacy, full tests and `git diff --check`; add no dependency.

### Browser / CDP / manual plan

Status in A0-A2: **Not run**.

If B3 is approved, use a disposable profile and local deterministic synthetic fixtures only. Block
and count `fetch`, XHR, WebSocket, storage and navigation; stub Chart/Leaflet/Open-Meteo where the
test targets detail acquisition. Load all four native ESM entry points and assert no module-resolution
error, one bundle, zero direct provider calls from renderers, exact static DOM IDs/classes, 11/12/15/4
canvas baselines, chart dataset parity, map/lap/split/zones/empty/error states, exports and repeated
Advanced clicks. Exercise Router with opaque IDs and all sport fallbacks in Real and Demo session
modes. Capture desktop/mobile screenshots only for review; do not claim pixel parity from Node.

Manual checklist remains `Not run`: keyboard/control behavior, Back links, URL/query round trip,
loading/error copy placement, visual comparison, Safari, Firefox, mobile viewport, production Service
Worker and real provider/account. Real Token/network/private activity and the user's existing browser
profile remain prohibited, not merely pending.

### Privacy, migration, rollback

- **Privacy:** recommended design removes Token/Authorization/provider-owned storage from consumers,
  passes only page data and safe Repository errors, adds no payload handoff/storage, redacts raw body
  and cause, and uses synthetic fixtures. Demo and Real are explicitly separated. Open-Meteo behavior
  and mode propagation require control-tower decisions.
- **Migration:** no data/schema/IndexedDB/Canonical migration is required. Legacy Repository and
  embedded laps remain. No storage key is created, renamed, cleared or backfilled. `strava_zones`
  remains a documented compatibility question rather than an implicit migration.
- **Rollback:** land phases as ordinary separable commits. Revert B2 to restore legacy consumers,
  B1 Router/façade independently, and Connector correction independently if needed. Never reset,
  rebase, force-push, clear Local Library or delete provider caches as rollback.

### A2 risk register

#### P0

- Opaque string IDs are currently corrupted by `parseInt()` in Router and all four pages.
- Demo detail navigation currently bypasses DemoRepository and can read a real Token/call real APIs.
- Real Repository streams are blocked by the Connector `types=` versus server `type=` mismatch.
- Generic page static imports point to nonexistent Advanced Analysis module paths.
- Advanced Analysis duplicates data requests, lacks Authorization and repeats work on every click.
- An unapproved eighth Repository method or `getLaps` would violate the frozen PR-03 contract.

#### P1

- Generic Advanced needs additional `latlng/grade_smooth/moving`; unapproved stream expansion or
  missing lat/lng can change/fail analysis.
- Parallel refreshed-Token writes, direct raw-body errors and error misclassification are security
  and compatibility risks.
- Real/Demo zones shapes and Swim's historical `strava_zones`/athlete correction can change outputs.
- Cross-document mode/bundle reuse choices can add URL or storage semantics.
- Weather can add external calls and may violate a strict Demo zero-I/O expectation.
- Large renderer refactors can alter DOM/chart/map/laps behavior without browser coverage.

#### P2

- Link producers inconsistently encode IDs, though Router-side preservation can contain the issue.
- Browser/visual harness and governance file expand candidate scope and need explicit approval.
- `quick-start-example.js` is stale direct-fetch sample code but appears unreachable.

### Decisions required from control tower before B1

1. Approve Option A or choose another bundle boundary; define whether “one ActivityBundle” permits
   the Router's separate summary-list lookup on cold cache.
2. Confirm the seven-method Repository API remains frozen and reject/approve an eighth method.
3. Confirm no `getLaps`; keep Legacy embedded laps.
4. Approve the internal Connector `types=` -> `type=` compatibility change and exact test file, or
   provide another server-compatible path without modifying `api/**`.
5. Decide Router inline versus extracted module, and approve exact Router files.
6. Decide cross-document mode propagation: validated URL hint, independent per-document freeze, or a
   separately reviewed alternative; reject/approve any sessionStorage use.
7. Approve exact Generic+Advanced stream union, especially `latlng`, `grade_smooth`, and `moving`.
8. Define missing-stream semantics: fatal Repository error versus resolved empty/partial page bundle;
   define warning aggregation shown/logged without sensitive detail.
9. Decide Real/Demo zones compatibility and Swim athlete correction ownership; decide whether
   historical `strava_zones` needs a read-only compatibility adapter.
10. Decide whether Demo weather must be zero external I/O or preserve current Open-Meteo behavior.
11. Decide whether fixing the pre-existing Advanced import paths is in PR-04B scope.
12. Approve/reject `js/pages/AGENTS.md`, the two consumer test files, and optional browser harness.
13. Freeze the exact candidate allowed-file list by phase; do not approve `js/pages/**` broadly.
14. Confirm safe error redaction may intentionally differ from current raw-body text while visible
    layout/copy/navigation otherwise stay stable.
15. Approve B1/B2/B3 sequence and browser/manual acceptance surface. Until then, no phase begins.

## Acceptance criteria for A0–A2

- A0 exact branch/SHA/clean/sync/PR/absence checks are evidenced before worktree creation.
- A1 and A2 diffs contain only this Task Brief.
- A2 records current and candidate call graphs, request/side-effect matrices, Repository and laps
  capability analysis, Demo/Real/error/output parity, candidate/prohibited paths, test plans,
  privacy/migration/rollback, risks, and all control-tower decisions required.
- Browser/manual/real-data checks not actually run are marked `Not run`.
- Final A2 status is `Awaiting decision`; implementation remains unstarted and Draft PR remains open.

## Required automated checks

At A0 and after each Task Brief update, record actual results for:

```text
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

## Manual verification

- Browser/CDP detail-page smoke: planned for a separately approved implementation phase; A0–A2
  result is `Not run` unless explicitly executed with deterministic synthetic isolated state.
- Visual parity, Safari/Firefox/mobile, production Service Worker, real Strava account/network,
  private data, and the user's existing browser profile: `Not run` in A0–A2.

## Privacy and security impact

A0–A2 are documentation and read-only investigation only. They do not read or expose Token,
Authorization, account, activity, GPS, heart-rate, power, private fixture, raw body/payload/cause,
or the user's browser profile. All future test design must use deterministic synthetic data and
fail closed without deleting Local Library data.

## Migration impact

None in A0–A2. No IndexedDB, cache, storage schema, Token lifecycle, Canonical data, Legacy data,
or Local Library content is created, modified, migrated, cleared, or deleted.

## Rollback procedure

A1/A2 change only this Task Brief in ordinary commits. Rollback requires control-tower direction
and an ordinary revert; do not reset/rebase/force-push, delete branches/worktrees, or clear browser
or Legacy storage.

## Independent review checklist

- [x] A0 exact baseline and absence checks passed before creation.
- [x] A0 minimum automated gates passed with actual evidence.
- [x] A1 Task Brief-only commit, push, Draft PR, and exact-head CI recorded.
- [x] A2 required call graphs and matrices completed from read-only evidence.
- [x] A2 diff remains Task Brief only and implementation remains unstarted.
- [x] Final A2 local gates passed against the completed investigation.
- [ ] A2 commit, push, Draft PR update, and exact-head CI verified after this document is committed.
- [ ] Worktree clean, local/upstream `0/0`, PR diff Task Brief only.

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

- Read-only investigation and decision package completed. All interfaces, paths and phases above are
  proposals only; the Repository eighth method has not been approved or added.
- Final local gates: `npm ci` PASS (6 packages, 0 vulnerabilities); syntax PASS (133 files);
  privacy PASS; tests PASS (702/702, skipped/cancelled/todo `0/0/0`); `git diff --check` PASS.
- Browser/CDP/manual/visual/real-data checks: `Not run`.
- This document is the sole A2 commit payload. Commit/push, PR body update and exact-head CI are
  post-commit verification recorded in the Draft PR and final control-tower handoff.
- Implementation has not started. The PR diff remains Task Brief only and awaits control-tower A2
  acceptance and A3 decisions.
