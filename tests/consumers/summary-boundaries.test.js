import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function source(path) {
    return readFile(new URL(path, projectRoot), 'utf8');
}

const summaryTabs = Object.freeze([
    'js/tabs/dashboard.js',
    'js/tabs/activities.js',
    'js/tabs/calendar.js',
    'js/tabs/run-analysis.js',
    'js/tabs/bike-analysis.js',
    'js/tabs/swim-analysis.js',
    'js/tabs/athlete.js',
    'js/tabs/maps.js',
    'js/tabs/gear.js',
    'js/tabs/wrapped.js',
    'js/tabs/planner.js'
]);
const tabSources = new Map(await Promise.all(summaryTabs.map(async path => (
    [path, await source(path)]
))));
const mainSource = await source('js/app/main.js');
const tabsIndexSource = await source('js/tabs/index.js');
const speedInsightsSource = await source('js/shared/utils/speed-insights.js');

const domSafetyCanaries = Object.freeze([
    '<img src=x onerror=globalThis.__domSafetyExecuted=1>',
    'double\" single\' backtick`',
    'onclick=globalThis.__domSafetyExecuted=2',
    'alpha/beta ?#%&=+;',
    'javascript:globalThis.__domSafetyExecuted=3',
    '__proto__',
    'constructor',
    'prototype',
    '运动🏃‍♀️ é',
    null,
    0,
    -0
]);

test('M23 failure-first canary corpus freezes hostile text, opaque IDs, and null/zero semantics', () => {
    assert.equal(domSafetyCanaries.length, 12);
    assert.equal(Object.is(domSafetyCanaries.at(-2), 0), true);
    assert.equal(Object.is(domSafetyCanaries.at(-1), -0), true);
    assert.equal(domSafetyCanaries.includes(null), true);
    for (const token of [
        '<img src=x onerror=',
        'double\" single\' backtick`',
        'onclick=',
        'alpha/beta ?#%&=+;',
        'javascript:',
        '__proto__',
        'constructor',
        'prototype',
        '运动🏃‍♀️ é'
    ]) {
        assert.equal(domSafetyCanaries.some(value => String(value).includes(token)), true, token);
    }
});

test('M23 R1 root summary renders persistent names and opaque IDs only through native DOM seams', () => {
    const activities = tabSources.get('js/tabs/activities.js');
    const calendar = tabSources.get('js/tabs/calendar.js');
    const wrapped = tabSources.get('js/tabs/wrapped.js');
    const run = tabSources.get('js/tabs/run-analysis.js');
    const bike = tabSources.get('js/tabs/bike-analysis.js');
    const swim = tabSources.get('js/tabs/swim-analysis.js');
    const athlete = tabSources.get('js/tabs/athlete.js');
    const maps = tabSources.get('js/tabs/maps.js');

    assert.match(mainSource, /document\.createElement\('option'\)/);
    assert.match(mainSource, /selectEl\.replaceChildren\(\.\.\.optionElements\)/);
    assert.doesNotMatch(mainSource, /selectEl\.innerHTML\s*=\s*options/);

    for (const [path, value] of [
        ['activities', activities],
        ['calendar', calendar],
        ['wrapped', wrapped],
        ['run', run],
        ['bike', bike],
        ['swim', swim],
        ['athlete', athlete]
    ]) {
        assert.match(value, /URLSearchParams/, `${path}: URLSearchParams`);
        assert.match(value, /rel\s*=\s*['"]noopener noreferrer['"]/, `${path}: rel`);
        assert.match(value, /Number\.isSafeInteger/, `${path}: Legacy numeric ID`);
        assert.doesNotMatch(
            value,
            /<a[^>]*href\s*=\s*[`'"][^`'"\n]*activity-router[^\n]*\$\{/,
            `${path}: interpolated activity-router href`
        );
    }

    for (const [path, value] of [
        ['wrapped', wrapped],
        ['run', run],
        ['bike', bike],
        ['swim', swim]
    ]) {
        assert.match(value, /Number\.isSafeInteger\(activity\?\.id\)[^\n]*activity\.id > 0/, `${path}: zero stays inert`);
    }

    for (const [path, value] of [
        ['run', run],
        ['bike', bike],
        ['swim', swim]
    ]) {
        assert.doesNotMatch(value, /<a[^>]*activity-router[\s\S]*?\$\{[as]\.name\}/, path);
        assert.match(value, /replaceChildren/, `${path}: replaceChildren`);
    }

    assert.doesNotMatch(athlete, /<img\s+src=[^\n]*athlete\.profile_medium/);
    assert.doesNotMatch(athlete, /innerHTML\s*=\s*`[^`]*\$\{error\.message\}/);
    assert.match(athlete, /athlete\.profile_medium === ['"]\/icon-sport\.svg['"]/);
    assert.doesNotMatch(athlete, /profileUrl|new URL\(String\(athlete\.profile_medium\)\)/);
    assert.match(athlete, /contentDiv\.replaceChildren/);
    assert.doesNotMatch(athlete, /createChartError\([^)]*error\.message/);
    assert.doesNotMatch(athlete, /console\.error\([^\n]*,\s*error\s*\)/);
    assert.match(athlete, /Error rendering chart\./);
    assert.match(athlete, /Number\.isFinite\(zone\?\.min\)/);
    assert.match(athlete, /Number\.isFinite\(zone\?\.max\)/);
    assert.match(athlete, /Number\.isFinite\(zoneWidth\)/);

    assert.doesNotMatch(maps, /bindPopup\s*\(\s*`/);
    assert.match(maps, /bindPopup\(popup\)/);
    assert.match(maps, /sportSel\.replaceChildren/);
    assert.match(activities, /document\.createElement\('small'\)/);
    assert.match(run, /params\.set\('id', activityId\)/);
    assert.match(run, /link\.textContent = label/);
    assert.match(run, /link\.rel = 'noopener noreferrer'/);
});

test('Global Map filters before Canonical loading and reuses one route snapshot for visual controls', () => {
    const maps = tabSources.get('js/tabs/maps.js');
    const reloadStart = maps.indexOf('async function reloadRoutes()');
    const reloadEnd = maps.indexOf("listen(applyButton, 'click'", reloadStart);
    assert.notEqual(reloadStart, -1);
    assert.notEqual(reloadEnd, -1);
    const reload = maps.slice(reloadStart, reloadEnd);

    assert.ok(reload.indexOf('const visible = visibleActivities()') < reload.indexOf('loadCanonicalRoutes('));
    assert.match(reload, /loadCanonicalRoutes\(visible\.map\(activity => activity\.id\)\)/);
    assert.match(maps, /listen\(applyButton, 'click', reloadRoutes\)/);
    assert.match(maps, /listen\(sportSel, 'change', reloadRoutes\)/);
    assert.match(maps, /listen\(viewSelect, 'change', presentSnapshot\)/);
    assert.match(maps, /listen\(densitySlider, 'input', presentSnapshot\)/);
    assert.match(maps, /listen\(radiusSlider, 'input', presentSnapshot\)/);
    assert.match(maps, /listen\(blurSlider, 'input', presentSnapshot\)/);
    assert.match(maps, /listen\(colorBySport, 'change', presentSnapshot\)/);
    assert.match(maps, /result\?\.status === 'superseded'/);
    assert.match(maps, /Too many activities to map at once/);
    assert.doesNotMatch(maps, /Repository|createRepository|indexedDB/);
});

test('main obtains provider-owned data only through the Repository public entry', () => {
    assert.match(
        mainSource,
        /import\s*\{[\s\S]*?createRepository[\s\S]*?\}\s*from\s*['"]\.\.\/repository\/index\.js['"]/
    );
    for (const prohibited of [
        'fetchAllActivities',
        'fetchAthleteData',
        'fetchTrainingZones',
        'fetchAllGears',
        'setCachedGears',
        'getCachedActivities',
        'saveCachedActivities',
        'getDemoActivities'
    ]) {
        assert.equal(mainSource.includes(prohibited), false, prohibited);
    }
    assert.match(mainSource, /repository\.listActivities\(\{ refresh \}\)/);
    assert.match(mainSource, /repository\.getAthlete\(\)/);
    assert.match(mainSource, /repository\.getZones\(\)/);
    assert.match(mainSource, /repository\.getGears\(\)/);
    assert.match(
        mainSource,
        /documentSessionMode === APP_SESSION_MODE\.REAL[\s\S]*?dataRepositoryMode === 'canonical'[\s\S]*?\? initializeApp\(null\)[\s\S]*?: runLocalFirstBootstrap/
    );
    assert.match(
        mainSource,
        /activityLoad\.source === REPOSITORY_SOURCE\.CANONICAL\s*\? structuredClone\(activities\)\s*:\s*activities/
    );
    assert.equal(
        (mainSource.match(/activityLoad\.source === REPOSITORY_SOURCE\.CANONICAL\s*\? structuredClone\(activities\)/g) || []).length,
        2
    );
    assert.equal((mainSource.match(/isDemoMode\(\)/g) || []).length, 1);
});

test('main has no direct Strava API, Token, Authorization, or IndexedDB boundary', () => {
    for (const pattern of [
        /\/api\/strava-/i,
        /strava_tokens/i,
        /Authorization/,
        /indexedDB/i,
        /new\s+StravaApiConnector/,
        /createRepositoryWithDependencies/
    ]) {
        assert.doesNotMatch(mainSource, pattern);
    }
});

test('summary tabs do not construct Repository or access auth/provider APIs', () => {
    for (const [path, value] of tabSources) {
        assert.doesNotMatch(value, /createRepository/i, path);
        assert.doesNotMatch(value, /strava_tokens/i, path);
        assert.doesNotMatch(value, /Authorization/, path);
        assert.doesNotMatch(value, /\/api\/strava-/i, path);
        assert.doesNotMatch(value, /indexedDB/i, path);
    }
});

test('PR-16 has one isolated Canonical harness with exact actual-root route evidence', async () => {
    const harnessPath = 'tests/consumers/canonical-summary-browser-smoke.html';
    const harness = await source(harnessPath);
    assert.match(harness, /ACTIVITY_COUNT = 503/);
    assert.match(harness, /createCanonicalStore/);
    assert.match(harness, /createRepositoryWithDependencies/);
    assert.match(harness, /dataRepositoryMode:\s*'canonical'/);
    assert.match(harness, /requiresActualRootNavigation:\s*true/);
    assert.match(harness, /async function actualRootFrame\(\)/);
    assert.match(harness, /ACTUAL_ROOT_DOCUMENT_LOADED/);
    assert.match(harness, /frame\.srcdoc = rootDocument\.replace/);
    assert.match(harness, /ACTUAL_ROOT_INSTRUMENTED_BEFORE_BOOTSTRAP/);
    assert.match(harness, /ACTUAL_ROOT_503_CONSUMER_ROWS/);
    assert.match(harness, /ACTUAL_ROOT_ELEVEN_ROUTE_PARITY/);
    assert.match(harness, /ACTUAL_ROOT_CANARY_RENDERED_AS_TEXT/);
    assert.match(harness, /ACTUAL_ROOT_OPAQUE_ID_URLSEARCHPARAMS_ROUND_TRIP/);
    assert.match(harness, /ACTUAL_ROOT_ZERO_CANARY_EXECUTION/);
    assert.match(harness, /ACTUAL_ROOT_ONLY_V2_DATABASE/);
    assert.match(harness, /ACTUAL_ROOT_ZERO_PROVIDER_OR_AUTHORIZATION_IO/);
    assert.match(harness, /ACTUAL_ROOT_ZERO_TOKEN_READ/);
    assert.match(harness, /ACTUAL_ROOT_ZERO_RUNTIME_ERRORS/);
    assert.match(harness, /ACTUAL_ROOT_SAME_ORIGIN_SERVICE_WORKER_ONLY/);
    assert.match(harness, /ZERO_PROVIDER_OR_AUTHORIZATION_IO/);
    assert.match(harness, /ZERO_TOKEN_READ/);
    assert.match(harness, /DEMO_ZERO_REAL_V2_OPEN/);
    assert.match(harness, /CANONICAL_503_COMPLETE/);
    for (const route of [
        '/activities',
        '/calendar',
        '/wrapped',
        '/dashboard',
        '/run',
        '/bike',
        '/swim',
        '/gear',
        '/map',
        '/trends',
        '/planner'
    ]) {
        assert.equal(harness.includes(`'${route}'`), true, route);
    }
    assert.doesNotMatch(harness, /tests\/fixtures\/private/);
    assert.doesNotMatch(mainSource, /canonical-summary-browser-smoke/);
});

test('M23 browser harnesses freeze Canonical and supported-Legacy DOM canary evidence', async () => {
    const canonicalHarness = await source('tests/consumers/canonical-summary-browser-smoke.html');
    const legacyHarness = await source('tests/consumers/summary-browser-smoke.html');
    for (const harness of [canonicalHarness, legacyHarness]) {
        for (const token of [
            'DOM_XSS_CANARY',
            'OPAQUE_ID_CANARY',
            '<img src=x onerror=',
            'double" single\\\' backtick`',
            'onclick=',
            'javascript:',
            '__proto__',
            'constructor',
            'prototype',
            '运动🏃‍♀️'
        ]) {
            assert.equal(harness.includes(token), true, token);
        }
    }
    assert.match(legacyHarness, /legacyAthleteAndMapDomSafety/);
    assert.match(legacyHarness, /nonHttpsProfileOmitted:\s*true/);
    assert.match(legacyHarness, /leafletPopupUsesDom:\s*true/);
    assert.match(legacyHarness, /canaryExecutions:\s*0/);
});

test('UI and user-owned storage stays on the explicit allowlist', () => {
    assert.match(mainSource, /localStorage\.getItem\('dashboard_settings'\)/);
    assert.match(mainSource, /localStorage\.setItem\('dashboard_settings'/);
    assert.match(mainSource, /localStorage\.getItem\('dashboard_filters'\)/);
    assert.match(mainSource, /localStorage\.setItem\('dashboard_filters'/);

    const dashboard = tabSources.get('js/tabs/dashboard.js');
    assert.match(dashboard, /dashboard_readiness_hrv/);
    assert.match(dashboard, /training_goals/);

    const gear = tabSources.get('js/tabs/gear.js');
    assert.match(gear, /gear-custom-\$\{gearId\}/);
    assert.match(gear, /gearEditMode/);
    assert.equal((gear.match(/localStorage\./g) || []).length, 4);
    assert.doesNotMatch(gear, /strava_gears|getCachedGears/);
});

test('B2 removes provider gear-cache access from every summary tab', () => {
    for (const [path, value] of tabSources) {
        assert.doesNotMatch(value, /getCachedGears|strava_gears/, path);
        assert.doesNotMatch(value, /from\s*['"]\.\/api\.js['"]/, path);
    }
});

test('PR-04C removes the tabs/api.js exception and all tab importers', async () => {
    const entries = await readdir(new URL('js/tabs/', projectRoot), {
        withFileTypes: true
    });
    const importers = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const value = await source(`js/tabs/${entry.name}`);
        if (/from\s*['"]\.\/api\.js['"]/.test(value)) {
            importers.push(entry.name);
        }
    }
    assert.deepEqual(importers, []);
    await assert.rejects(
        source('js/tabs/api.js'),
        error => error?.code === 'ENOENT'
    );
});

test('tabs governance file contains every frozen B1 boundary and parity rule', async () => {
    const rules = await source('js/tabs/AGENTS.md');
    for (const pattern of [
        /\/api\/strava-\*/,
        /Tokens or Authorization/,
        /provider, Connector, Repository implementation, Factory/,
        /activity\s+cache, metadata cache/,
        /IndexedDB/,
        /must not call `createRepository`/,
        /activities, athlete, zones, and gears/,
        /UI preferences, filter state, and user overrides/,
        /Demo data must never fall back/,
        /offline, deterministic, and synthetic/,
        /real activities, GPS tracks, heart-rate, power, Tokens/,
        /algorithms, thresholds, HTML, CSS, copy, routes/,
        /chart configuration, DOM IDs\/classes, ordering, or visual output/,
        /Missing metadata or capabilities/,
        /`Not run`/,
        /Activity IDs.*opaque non-empty strings/
    ]) {
        assert.match(rules, pattern);
    }
    assert.match(rules, /add to the repository-root `AGENTS\.md`/);
});

test('B2 wires the Run gear context through the existing tab public entry', () => {
    assert.match(
        mainSource,
        /import\s*\{[\s\S]*?setRunSessionGears[\s\S]*?\}\s*from\s*['"]\.\.\/tabs\/index\.js['"]/
    );
    assert.match(
        tabsIndexSource,
        /export\s*\{\s*renderRunAnalysisTab\s*,\s*setRunSessionGears\s*\}\s*from\s*['"]\.\/run-analysis\.js['"]/
    );
    assert.equal(
        (
            mainSource.match(
                /sessionGears = resetSummarySessionGears\(\);\s*setRunSessionGears\(sessionGears\);/g
            ) || []
        ).length,
        2
    );
    assert.equal(
        (
            mainSource.match(
                /sessionGears = applySummarySessionGearLoad\(gearLoad\);\s*setRunSessionGears\(sessionGears\);/g
            ) || []
        ).length,
        2
    );
    assert.match(mainSource, /renderGearTab\(allActivities, sessionGears\)/);

    const runAnalysis = tabSources.get('js/tabs/run-analysis.js');
    assert.match(runAnalysis, /export function setRunSessionGears\(gears\)/);
    assert.doesNotMatch(runAnalysis, /getCachedGears|strava_gears/);
    assert.doesNotMatch(mainSource, /summary-browser-smoke/);
});

test('Speed Insights utility stays local-offline and is unreachable from production entry', () => {
    assert.doesNotMatch(speedInsightsSource, /esm\.sh|vercel-scripts\.com/);
    assert.doesNotMatch(speedInsightsSource, /https?:\/\//);
    assert.doesNotMatch(speedInsightsSource, /(?:from|import\s*\()\s*['"](?:https?:)?\/\//);
    for (const prohibited of [
        /\bfetch\b/,
        /XMLHttpRequest/,
        /WebSocket/,
        /localStorage|sessionStorage/,
        /strava_tokens|Authorization/,
        /Repository|Connector/
    ]) {
        assert.doesNotMatch(speedInsightsSource, prohibited);
    }

    assert.equal(
        (speedInsightsSource.match(/\/_vercel\/speed-insights\/script\.js/g) || []).length,
        1
    );
    for (const hostname of [
        'localhost',
        '.localhost',
        '127.0.0.1',
        '::1',
        '[::1]'
    ]) {
        assert.equal(speedInsightsSource.includes(hostname), true, hostname);
    }
    assert.match(speedInsightsSource, /isLocalHostname\(window\.location\?\.hostname\)/);
    assert.match(speedInsightsSource, /Array\.from\(documentObject\.scripts\)\.some/);
    assert.match(speedInsightsSource, /if \(hasSpeedInsightsScript\(document, scriptUrl\)\) return/);
    assert.match(
        speedInsightsSource,
        /if \(scriptUrl\.origin !== window\.location\.origin\) return/
    );
    assert.match(speedInsightsSource, /export function setupSpeedInsights\(\)/);
    assert.match(speedInsightsSource, /setupSpeedInsights\(\);\s*$/);
    assert.doesNotMatch(
        mainSource,
        /import\s*['"]\.\.\/shared\/utils\/speed-insights\.js['"]/
    );
});

test('Speed Insights import is a Node and loopback no-op', async () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
        Reflect.deleteProperty(globalThis, 'window');
        Reflect.deleteProperty(globalThis, 'document');
        await import(new URL(
            'js/shared/utils/speed-insights.js?node-noop',
            projectRoot
        ));

        let domCalls = 0;
        globalThis.document = {
            get scripts() {
                domCalls += 1;
                throw new Error('Loopback import touched scripts.');
            },
            createElement() {
                domCalls += 1;
                throw new Error('Loopback import created a script.');
            }
        };
        for (const [index, hostname] of [
            'localhost',
            'dashboard.localhost',
            '127.0.0.1',
            '::1',
            '[::1]'
        ].entries()) {
            globalThis.window = {
                location: {
                    hostname,
                    origin: 'http://127.0.0.1:3001'
                }
            };
            const module = await import(new URL(
                `js/shared/utils/speed-insights.js?loopback=${index}`,
                projectRoot
            ));
            module.setupSpeedInsights();
        }
        assert.equal(domCalls, 0);
    } finally {
        if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
        else Reflect.deleteProperty(globalThis, 'window');
        if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});

test('Speed Insights production injection is same-origin, queued, and idempotent', async () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const scripts = [];
    try {
        globalThis.window = {
            location: {
                hostname: 'synthetic.example.test',
                origin: 'https://synthetic.example.test'
            }
        };
        globalThis.document = {
            scripts,
            head: {
                appendChild(script) {
                    scripts.push(script);
                }
            },
            createElement(tagName) {
                assert.equal(tagName, 'script');
                return {
                    dataset: {},
                    addEventListener(type, callback, options) {
                        assert.equal(type, 'error');
                        assert.equal(typeof callback, 'function');
                        assert.deepEqual(options, { once: true });
                    },
                    getAttribute(name) {
                        return name === 'src' ? this.src || null : null;
                    }
                };
            }
        };

        const first = await import(new URL(
            'js/shared/utils/speed-insights.js?production=first',
            projectRoot
        ));
        assert.equal(typeof first.setupSpeedInsights, 'function');
        assert.equal(scripts.length, 1);
        assert.equal(
            scripts[0].src,
            'https://synthetic.example.test/_vercel/speed-insights/script.js'
        );
        assert.equal(scripts[0].defer, true);
        assert.equal(scripts[0].dataset.sdkn, '@vercel/speed-insights');
        assert.equal(scripts[0].dataset.sdkv, '2.0.0');
        assert.equal(typeof globalThis.window.si, 'function');
        assert.deepEqual(globalThis.window.siq, []);
        globalThis.window.si('synthetic-event');
        assert.deepEqual(globalThis.window.siq, [['synthetic-event']]);
        first.setupSpeedInsights();
        assert.equal(scripts.length, 1);

        const existingSi = globalThis.window.si;
        await import(new URL(
            'js/shared/utils/speed-insights.js?production=second',
            projectRoot
        ));
        assert.equal(scripts.length, 1);
        assert.equal(globalThis.window.si, existingSi);
    } finally {
        if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
        else Reflect.deleteProperty(globalThis, 'window');
        if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});

test('R7 main injects one frozen AI Coach session while the tab owns no provider or storage I/O', async () => {
    const aiTabSource = await source('js/tabs/ai-chat.js');
    const aiBoundarySource = await source('js/app/ai-coach-egress.js');
    assert.match(
        mainSource,
        /import\s*\{\s*createAICoachSession\s*\}\s*from\s*['"]\.\/ai-coach-egress\.js['"]/
    );
    assert.match(
        mainSource,
        /let aiCoachSession = createAICoachSession\(\{[\s\S]*?sessionMode:\s*documentSessionMode[\s\S]*?legacyStorage:[\s\S]*?APP_SESSION_MODE\.REAL/
    );
    assert.match(
        mainSource,
        /renderAIChatTab\(aiCoachActivitySnapshot,\s*\{\s*sessionMode:\s*activeSessionMode,\s*aiCoach:\s*aiCoachSession\s*\}\)/
    );
    assert.doesNotMatch(
        aiTabSource,
        /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|caches\s*\.|serviceWorker|Authorization/
    );
    assert.match(aiTabSource, /prepared\.confirmLabel/);
    assert.match(aiTabSource, /Request preview — nothing has been sent/);
    assert.match(aiBoundarySource, /x-goog-api-key/);
    assert.match(aiBoundarySource, /store:\s*false/);
    assert.match(aiBoundarySource, /REQUEST_TIMEOUT_MS = 4_000/);
    assert.doesNotMatch(aiBoundarySource, /\?key=|Authorization/);
    assert.match(
        mainSource,
        /demoButton\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*aiCoachSession\.revoke\(\);\s*aiCoachActivitySnapshot = null;\s*loginWithDemo\(\(\) => \{\s*window\.location\.reload\(\);\s*\}\)/
    );
    assert.match(mainSource, /function buildAICoachActivitySnapshot\(activities\)[\s\S]*?try\s*\{[\s\S]*?createActivitySnapshot\(\)[\s\S]*?builder\.add\([\s\S]*?builder\.finish\(\)[\s\S]*?catch\s*\{\s*return null/);
    assert.match(mainSource, /activeTabId === 'ai-chat-tab'[\s\S]*?aiCoachSession\.cancelPending\(\)/);
    assert.match(mainSource, /refreshButton\.addEventListener\('click',[\s\S]*?aiCoachSession\.cancelPending\(\)/);
    assert.match(
        mainSource,
        /tabId === activeTabId[\s\S]*?tabId === 'ai-chat-tab'[\s\S]*?!renderedTabs\.has\(tabId\)[\s\S]*?tabConfig\[tabId\]\.render\(\)/
    );
});
