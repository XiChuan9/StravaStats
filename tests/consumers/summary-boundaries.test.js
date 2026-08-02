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
    'js/tabs/wrapped.js'
]);
const tabSources = new Map(await Promise.all(summaryTabs.map(async path => (
    [path, await source(path)]
))));
const mainSource = await source('js/app/main.js');

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
});

test('B1 provider-gear-cache exceptions are limited to Run and Gear summary tabs', () => {
    const exceptionPaths = [...tabSources]
        .filter(([, value]) => (
            value.includes('getCachedGears')
            || value.includes('strava_gears')
        ))
        .map(([path]) => path)
        .sort();
    assert.deepEqual(exceptionPaths, [
        'js/tabs/gear.js',
        'js/tabs/run-analysis.js'
    ]);
});

test('tabs/api.js importers are exactly Run, Gear, and the PR-04C Run Plus exception', async () => {
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
    assert.deepEqual(importers.sort(), [
        'gear.js',
        'run-analysis.js',
        'run-plus.js'
    ]);
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
        /Run and Gear provider-gear-cache reads.*pending B2/s,
        /`run-plus\.js` belongs to PR-04C/
    ]) {
        assert.match(rules, pattern);
    }
    assert.match(rules, /add to the repository-root `AGENTS\.md`/);
});

test('B1 source keeps B2 and B3 implementation seams absent', () => {
    assert.doesNotMatch(mainSource, /setRunSessionGears/);
    assert.doesNotMatch(mainSource, /summary-browser-smoke/);
    assert.equal(tabSources.get('js/tabs/run-analysis.js').includes('getCachedGears'), true);
    assert.equal(tabSources.get('js/tabs/gear.js').includes('getCachedGears'), true);
});
