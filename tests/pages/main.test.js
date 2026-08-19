import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const source = path => readFile(new URL(path, projectRoot), 'utf8');

const [
    html,
    main,
    maps,
    dashboard,
    planner,
    activities,
    activityDetail,
    runDetail,
    css
] = await Promise.all([
    source('index.html'),
    source('js/app/main.js'),
    source('js/tabs/maps.js'),
    source('js/tabs/dashboard.js'),
    source('js/tabs/planner.js'),
    source('js/tabs/activities.js'),
    source('js/pages/activity/activity.js'),
    source('js/pages/run/run.js'),
    source('styles/style.css')
]);

test('Settings exposes an explicit local heart-rate profile form with confirmed reset', () => {
    for (const id of [
        'analysis-profile-section',
        'analysis-profile-form',
        'hr-max',
        'hr-rest',
        'hr-threshold',
        'hr-zone-bound-1',
        'hr-zone-bound-2',
        'hr-zone-bound-3',
        'hr-zone-bound-4',
        'analysis-profile-zone-summary',
        'analysis-profile-auto-zones',
        'analysis-profile-save',
        'analysis-profile-reset',
        'analysis-profile-status',
        'analysis-profile-error'
    ]) {
        assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(html, /Save &amp; recompute/);
    assert.match(html, /Used only for local Canonical analysis/);
    assert.match(main, /window\.confirm\('Reset the local heart-rate training profile\?/);
    assert.match(main, /analysisProfileFacade\.reset\(\{ confirmed: true \}\)/);
    assert.match(main, /`Z1 <\$\{b1\}`/);
    assert.match(main, /`Z5 ≥\$\{b4\}`/);
    assert.match(css, /\.analysis-profile-zone-grid/);
    assert.match(css, /\.analysis-profile-error/);
    assert.match(html, /id="analysis-profile-notice"/);
    assert.match(html, /Personalized HR zones, HR VO₂max and readiness are unavailable/);
    assert.match(html, /generic load estimates remain available/);
    assert.match(main, /readinessPanel\.hidden = unconfigured/);
});

test('profile storage is composed only for Real Canonical and display settings merge existing fields', () => {
    assert.match(
        main,
        /canonicalAnalysisProfileEnabled = requestedSessionMode === APP_SESSION_MODE\.REAL\s*&& getFeatureFlags\(\)\.dataRepositoryMode === 'canonical'/
    );
    assert.match(main, /createAnalysisProfileSettingsFacade\(\{\s*storage: globalThis\.localStorage/);
    assert.match(main, /analysisProfileState = analysisProfileFacade\.read\(\)/);
    assert.match(main, /\.\.\.readDashboardSettings\(\),\s*units:/);
    assert.doesNotMatch(main, /analysisProfile\s*:\s*\{[\s\S]*localStorage\.setItem/);
    assert.match(main, /documentSessionMode === APP_SESSION_MODE\.DEMO\s*\? DEMO_ANALYSIS_CONTEXT_V1/);
    assert.match(main, /function readDashboardSettings\(\) \{\s*if \(requestedSessionMode === APP_SESSION_MODE\.DEMO\) return \{\};/);
    const demoHandler = main.slice(
        main.indexOf("if (demoButton) demoButton.addEventListener('click'"),
        main.indexOf("if (logoutButton)")
    );
    assert.match(demoHandler, /loginWithDemo\(\(\) => \{\s*window\.location\.reload\(\)/);
    assert.doesNotMatch(demoHandler, /initializeApp|sessionAnalysisContext|sessionRepository/);
    assert.equal(
        (main.match(/sessionMode === APP_SESSION_MODE\.DEMO\s*\? DEMO_ANALYSIS_CONTEXT_V1/g) || []).length,
        2
    );
});

test('general estimates and unavailable VO2 are explicit instead of presented as personalized', () => {
    assert.match(dashboard, /export function getDashboardLoadEstimateScope/);
    assert.match(dashboard, /General load estimate\./);
    assert.match(dashboard, /not fully personalized/);
    assert.match(dashboard, /getDashboardLoadEstimateScope\(allActivities\) !== 'general'/);
    assert.match(activityDetail, /Requires local heart-rate profile/);
    assert.match(runDetail, /Requires local heart-rate profile/);
});

test('Save and recompute performs one local Canonical list read and no metadata or provider refresh', () => {
    const start = main.indexOf('async function recomputeCanonicalAnalysisViews()');
    const end = main.indexOf('async function handleAnalysisProfileSave', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const body = main.slice(start, end);

    assert.equal((body.match(/loadActivitiesForSession\(/g) || []).length, 1);
    assert.match(body, /refresh: false/);
    assert.match(body, /profileActivityLoad\.source !== REPOSITORY_SOURCE\.CANONICAL/);
    assert.match(body, /preprocessActivities\([\s\S]*sessionAnalysisContext/);
    assert.doesNotMatch(body, /refreshActivities\(|getAthlete|getZones|getGears|fetch\s*\(|\/api\//);
    assert.equal((body.match(/tabConfig\[tabId\]\.render\(\)/g) || []).length, 1);
    assert.match(body, /LOCAL_ANALYSIS_RECOMPUTE_TABS\.has\(tabId\)/);

    const safeTabsStart = main.indexOf('const LOCAL_ANALYSIS_RECOMPUTE_TABS');
    const safeTabsEnd = main.indexOf('function safeOperationalError', safeTabsStart);
    const safeTabs = main.slice(safeTabsStart, safeTabsEnd);
    for (const prohibited of ['weather-tab', 'map-tab', 'ai-chat-tab']) {
        assert.doesNotMatch(safeTabs, new RegExp(prohibited));
    }
    for (const localTab of [
        'dashboard-tab',
        'run-tab',
        'bike-tab',
        'swim-tab',
        'trends-tab',
        'planner-tab',
        'activities-tab',
        'calendar-tab',
        'wrapped-tab'
    ]) {
        assert.match(safeTabs, new RegExp(localTab));
    }
    assert.doesNotMatch(planner, /addEventListener/);
    assert.match(planner, /currentPlannerRuns = runs/);
    assert.match(activities, /state\.allActivities = allActivities/);
    assert.match(activities, /applyFilters\(state\.allActivities\)/);
});

test('Global Map lazily composes Canonical latlng reads and keeps other modes on summary geometry', () => {
    assert.match(html, /id="global-map"[^>]*role="region"/);
    assert.match(main, /import \{ createGlobalMapRouteSession \} from '\.\/global-map-routes\.js'/);
    assert.match(main, /sessionActivitySource !== REPOSITORY_SOURCE\.CANONICAL[\s\S]*?return null/);
    assert.match(main, /activeSessionMode !== APP_SESSION_MODE\.REAL[\s\S]*?sessionActivitySource !== REPOSITORY_SOURCE\.CANONICAL/);
    assert.match(
        main,
        /repository\.getStreams\(activityId, \{\s*types: \['latlng'\]\s*\}\)/
    );
    assert.match(main, /return readCanonicalGlobalMapRoute\(streamLoad\.data\)/);
    assert.match(main, /if \(keys\.length === 0\) return Object\.freeze\(\[\]\)/);
    assert.match(main, /if \(keys\.length !== 1 \|\| keys\[0\] !== 'latlng'\) throw safeOperationalError\(\)/);
    assert.match(main, /if \(route\.length === 0\) throw safeOperationalError\(\)/);
    assert.match(main, /loadCanonicalRoutes: getCanonicalMapRouteLoader\(\)/);
    assert.match(
        main,
        /disposeGlobalMapView\(\);\s*clearGlobalMapRouteSession\(\);[\s\S]*?refresh: true/
    );
    assert.match(main, /window\.addEventListener\('pagehide', disposeGlobalMapState/);
    assert.match(
        main,
        /function renderGlobalMapView\(\)[\s\S]*?disposeGlobalMapView\(\)[\s\S]*?globalMapViewCleanup = typeof cleanup === 'function'/
    );
    assert.match(
        main,
        /function disposeGlobalMapState\(\)[\s\S]*?disposeGlobalMapView\(\);\s*disposeGlobalMapRouteSession\(\)/
    );

    const recomputeStart = main.indexOf('async function recomputeCanonicalAnalysisViews()');
    const recomputeEnd = main.indexOf('async function handleAnalysisProfileSave', recomputeStart);
    assert.doesNotMatch(main.slice(recomputeStart, recomputeEnd), /GlobalMapRouteSession/);

    assert.match(maps, /typeof loadCanonicalRoutes !== 'function'/);
    assert.match(maps, /visible\.map\(activity => activity\.id\)/);
    assert.match(maps, /start: route\[0\] \|\| null/);
    assert.match(maps, /end: route\.at\(-1\) \|\| null/);
    assert.match(maps, /activeMapRenderCleanup\?\.\(\)/);
    assert.match(maps, /removeEventListener\(eventName, listener\)/);
    assert.match(maps, /void reloadRoutes\(\);\s*return cleanup/);
    assert.match(maps, /if \(!statusElement\) \{/);
    assert.match(maps, /statusElement\.setAttribute\('role', 'status'\)/);
    assert.match(maps, /statusElement\.setAttribute\('aria-live', 'polite'\)/);
});
