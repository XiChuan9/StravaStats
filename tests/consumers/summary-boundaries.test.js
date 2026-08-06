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
const runPlusSource = await source('js/tabs/run-plus.js');
const speedInsightsSource = await source('js/shared/utils/speed-insights.js');

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

test('PR-16 has one isolated Canonical harness and an exact actual-root route plan', async () => {
    const harnessPath = 'tests/consumers/canonical-summary-browser-smoke.html';
    const harness = await source(harnessPath);
    assert.match(harness, /ACTIVITY_COUNT = 503/);
    assert.match(harness, /createCanonicalStore/);
    assert.match(harness, /createRepositoryWithDependencies/);
    assert.match(harness, /dataRepositoryMode:\s*'canonical'/);
    assert.match(harness, /requiresActualRootNavigation:\s*true/);
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
        '/planner'
    ]) {
        assert.equal(harness.includes(`'${route}'`), true, route);
    }
    assert.doesNotMatch(harness, /tests\/fixtures\/private/);
    assert.doesNotMatch(mainSource, /canonical-summary-browser-smoke/);
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
        /Run Plus gear labels and options use only the immutable session gear snapshot/,
        /injected `getActivity` and `getStreams`\s+callbacks/,
        /Activity IDs.*opaque non-empty strings/,
        /Demo and Real use the same injected shape/
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
    assert.match(runPlusSource, /import\s*\{\s*renderRunAnalysisTab\s*\}\s*from\s*['"]\.\/run-analysis\.js['"]/);
    assert.match(
        runPlusSource,
        /renderRunAnalysisTab\(\s*allActivities,[\s\S]*?\{\s*idPrefix:\s*RUN_PLUS_ID_PREFIX/
    );
});

test('PR-04C removes the final Run Plus provider boundary without changing the B3 seam', () => {
    for (const pattern of [
        /from\s*['"]\.\/api\.js['"]/,
        /getCachedGears|strava_gears|strava_tokens/,
        /\/api\/strava-/,
        /Authorization|\bfetch\s*\(/,
        /indexedDB|createRepository|new\s+\w*Connector/
    ]) {
        assert.doesNotMatch(runPlusSource, pattern);
    }
    assert.match(runPlusSource, /options\.getActivity\(activityId\)/);
    assert.match(runPlusSource, /options\.getStreams\(activityId\)/);
    assert.doesNotMatch(mainSource, /summary-browser-smoke/);
});

test('Speed Insights stays local-offline and production telemetry is same-origin only', () => {
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
    assert.match(
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
