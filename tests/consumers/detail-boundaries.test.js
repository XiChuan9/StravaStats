import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    access,
    readFile,
    readdir
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRootUrl = new URL('../../', import.meta.url);
const projectRoot = fileURLToPath(projectRootUrl);
const PR04B_CONTRACT_PATHS = new Set([
    'docs/tasks/pr-04b-detail-consumers.md',
    'classifyRun.js',
    'classifyBike.js',
    'js/pages/AGENTS.md',
    'html/activity-router.html',
    'js/pages/activity-router.js',
    'js/pages/detail/detail-read-session.js',
    'js/pages/activity/index.js',
    'js/pages/run/index.js',
    'js/pages/bike/index.js',
    'js/pages/swim/index.js',
    'js/pages/activity/activity.js',
    'js/pages/run/run.js',
    'js/pages/bike/bike.js',
    'js/pages/swim/swim.js',
    'js/pages/activity/advanced-analysis.js',
    'js/connectors/strava/strava-api-connector.js',
    'tests/repository/strava-api-connector.test.js',
    'tests/repository/dependency-boundaries.test.js',
    'tests/consumers/detail-consumers.test.js',
    'tests/consumers/detail-boundaries.test.js',
    'tests/consumers/detail-browser-smoke.html'
]);
const B1_IMPLEMENTATION_PATHS = Object.freeze([
    'js/pages/AGENTS.md',
    'html/activity-router.html',
    'js/pages/activity-router.js',
    'js/pages/detail/detail-read-session.js',
    'js/connectors/strava/strava-api-connector.js',
    'tests/repository/strava-api-connector.test.js',
    'tests/repository/dependency-boundaries.test.js'
]);
const PR17_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-17-canonical-detail-cutover.md',
    'js/pages/activity-router.js',
    'js/pages/activity/index.js',
    'js/pages/run/index.js',
    'js/pages/bike/index.js',
    'js/pages/swim/index.js',
    'js/pages/activity/activity.js',
    'js/pages/run/run.js',
    'js/pages/bike/bike.js',
    'js/pages/swim/swim.js',
    'js/repository/canonical/canonical-repository.js',
    'js/repository/canonical/detail-projection.js',
    'tests/repository/canonical-repository.test.js',
    'tests/repository/dependency-boundaries.test.js',
    'tests/consumers/detail-consumers.test.js',
    'tests/consumers/detail-boundaries.test.js',
    'tests/consumers/canonical-detail-browser-smoke.html'
]);

function readTrackedPaths() {
    const output = execFileSync(
        'git',
        ['ls-files', '-z'],
        { cwd: projectRoot, encoding: 'utf8' }
    );
    const records = output.split('\0');
    assert.equal(records.pop(), '');
    return new Set(records);
}

function assertPr04bContractsTracked(trackedPaths) {
    for (const relativePath of PR04B_CONTRACT_PATHS) {
        assert.equal(
            trackedPaths.has(relativePath),
            true,
            `PR-04B contract file is not tracked: ${relativePath}`
        );
    }
}

async function source(relativePath) {
    return readFile(new URL(relativePath, projectRootUrl), 'utf8');
}

const routerSource = await source('js/pages/activity-router.js');
const sessionSource = await source('js/pages/detail/detail-read-session.js');
const routerHtml = await source('html/activity-router.html');
const connectorSource = await source(
    'js/connectors/strava/strava-api-connector.js'
);
const pageIndexPaths = [
    'js/pages/activity/index.js',
    'js/pages/run/index.js',
    'js/pages/bike/index.js',
    'js/pages/swim/index.js'
];
const rendererPaths = [
    'js/pages/activity/activity.js',
    'js/pages/run/run.js',
    'js/pages/bike/bike.js',
    'js/pages/swim/swim.js'
];
const pageIndexSources = new Map(
    await Promise.all(pageIndexPaths.map(async relativePath => [
        relativePath,
        await source(relativePath)
    ]))
);
const rendererSources = new Map(
    await Promise.all(rendererPaths.map(async relativePath => [
        relativePath,
        await source(relativePath)
    ]))
);
const gearTabSource = await source('js/tabs/gear.js');
const gearDetailSource = await source('js/pages/gear/gear-analysis.js');
const advancedSource = await source('js/pages/activity/advanced-analysis.js');
const streamPresentationSource = await source('js/pages/detail/stream-presentation.js');

test('page module imports perform zero Token, storage, network, or provider I/O', async () => {
    const guardedNames = [
        'fetch',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'btoa',
        'XMLHttpRequest',
        'WebSocket'
    ];
    const originals = new Map(guardedNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    let accesses = 0;
    try {
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    accesses += 1;
                    throw new Error('synthetic import-time I/O');
                }
            });
        }

        for (const relativePath of [
            'js/pages/activity-router.js',
            'js/pages/detail/detail-read-session.js',
            ...pageIndexPaths
        ]) {
            const url = new URL(relativePath, projectRootUrl);
            await import(`${url.href}?boundary=${Date.now()}-${relativePath}`);
        }
        assert.equal(accesses, 0);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
});

test('four page composition roots use only public Factory and DetailReadSession boundaries', () => {
    for (const [relativePath, value] of pageIndexSources) {
        assert.match(
            value,
            /import\s*\{\s*createRepository,\s*REPOSITORY_SOURCE\s*\}\s*from\s*['"]\.\.\/\.\.\/repository\/index\.js['"]/
        );
        assert.match(
            value,
            /import\s*\{\s*createDetailReadSession\s*\}\s*from\s*['"]\.\.\/detail\/detail-read-session\.js['"]/
        );
        assert.match(
            value,
            /import\s*\{\s*getFeatureFlags\s*\}\s*from\s*['"]\.\.\/\.\.\/app\/feature-flags\.js['"]/
        );
        assert.equal((value.match(/demoModeReader\(\)/g) || []).length, 1, relativePath);
        assert.equal((value.match(/featureFlagsReader\(\)/g) || []).length, 1, relativePath);
        assert.equal((value.match(/repositoryFactory\(\{/g) || []).length, 1, relativePath);
        assert.equal((value.match(/sessionFactory\(\{/g) || []).length, 1, relativePath);
        assert.equal((value.match(/session\.load\(\)/g) || []).length, 1, relativePath);
        assert.match(value, /allowExternalWeather:\s*!demo/, relativePath);
        assert.match(value, /descriptor\.value\s*===\s*'canonical'\s*\?\s*'canonical'\s*:\s*'legacy'/, relativePath);
        assert.match(value, /Reflect\.ownKeys\(value\)/, relativePath);
        assert.match(value, /Object\.getOwnPropertyDescriptor\(value, key\)/, relativePath);
        assert.match(value, /REPOSITORY_SOURCES\.has\(record\.source\)/, relativePath);
        assert.match(value, /isDenseNativeArray\(record\.warnings\)/, relativePath);
        assert.doesNotMatch(value, /bundle\?\./, relativePath);
        for (const prohibited of [
            /from\s*['"][^'"]*connectors\//,
            /from\s*['"][^'"]*repository\/(?:factory|legacy|demo|errors)/,
            /parseInt|parseFloat|BigInt|\bNumber\s*\(/,
            /strava_tokens|strava_training_zones|strava_zones|strava_athlete_data/,
            /Authorization|\/api\/strava-/,
            /\bfetch\s*\(|\bbtoa\s*\(|indexedDB|sessionStorage|localStorage/
        ]) {
            assert.doesNotMatch(value, prohibited, relativePath);
        }
    }
});

test('page stream contracts and metadata flags remain exact and ordered', () => {
    const expected = new Map([
        ['js/pages/activity/index.js', {
            streams: ['distance', 'time', 'heartrate', 'altitude', 'cadence', 'watts', 'velocity_smooth', 'latlng', 'grade_smooth', 'moving'],
            athlete: false
        }],
        ['js/pages/run/index.js', {
            streams: ['distance', 'time', 'heartrate', 'altitude', 'cadence', 'watts', 'velocity_smooth', 'latlng'],
            athlete: false
        }],
        ['js/pages/bike/index.js', {
            streams: ['distance', 'time', 'heartrate', 'altitude', 'cadence', 'watts', 'velocity_smooth', 'latlng'],
            athlete: false
        }],
        ['js/pages/swim/index.js', {
            streams: ['distance', 'time', 'heartrate', 'cadence', 'latlng'],
            athlete: true
        }]
    ]);
    for (const [relativePath, contract] of expected) {
        const value = pageIndexSources.get(relativePath);
        const listMatch = /STREAM_TYPES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/.exec(value);
        assert.notEqual(listMatch, null, relativePath);
        const streams = [...listMatch[1].matchAll(/['"]([^'"]+)['"]/g)]
            .map(match => match[1]);
        assert.deepEqual(streams, contract.streams, relativePath);
        assert.match(value, /includeZones:\s*true/, relativePath);
        assert.match(
            value,
            new RegExp(`includeAthlete:\\s*${contract.athlete}`),
            relativePath
        );
        assert.doesNotMatch(value, /['"]temperature['"]|['"]temp['"]/, relativePath);
    }
});

test('detail renderers are injected-only consumers with no provider fallback', () => {
    const exports = new Map([
        ['js/pages/activity/activity.js', 'renderActivityPage'],
        ['js/pages/run/run.js', 'renderRunPage'],
        ['js/pages/bike/bike.js', 'renderBikePage'],
        ['js/pages/swim/swim.js', 'renderSwimPage']
    ]);
    for (const [relativePath, value] of rendererSources) {
        assert.match(
            value,
            new RegExp(`export\\s+async\\s+function\\s+${exports.get(relativePath)}\\s*\\(\\{`),
            relativePath
        );
        assert.match(value, /structuredClone\(activity\)/, relativePath);
        assert.match(value, /structuredClone\(streams\)/, relativePath);
        assert.match(value, /allowExternalWeatherForPage\s*=\s*allowExternalWeather\s*===\s*true/, relativePath);
        for (const prohibited of [
            /new\s+URLSearchParams\(window\.location\.search\)/,
            /getAuthPayload|fetchFromApi|fetchActivityDetails|fetchActivityStreams/,
            /strava_tokens|strava_training_zones|strava_zones|strava_athlete_data/,
            /Authorization|\/api\/strava-/,
            /\bfetch\s*\(|\bbtoa\s*\(|indexedDB|sessionStorage|localStorage/,
            /createRepository|createDetailReadSession|DOMContentLoaded/
        ]) {
            assert.doesNotMatch(value, prohibited, relativePath);
        }
    }
});

test('weather, zones, and Swim athlete behavior stays behind injected boundaries', () => {
    for (const [relativePath, value] of rendererSources) {
        assert.match(value, /if\s*\(allowExternalWeatherForPage\)/, relativePath);
        assert.doesNotMatch(value, /strava_training_zones|strava_zones|strava_athlete_data/, relativePath);
    }
    for (const relativePath of [
        'js/pages/activity/activity.js',
        'js/pages/run/run.js',
        'js/pages/bike/bike.js'
    ]) {
        assert.match(
            rendererSources.get(relativePath),
            /configuredZones\s*=\s*zones\?\.heart_rate\?\.zones[\s\S]*Array\.isArray\(configuredZones\)/,
            relativePath
        );
    }
    const swimSource = rendererSources.get('js/pages/swim/swim.js');
    assert.match(swimSource, /zones\?\.heart_rate\?\.zones/);
    assert.match(swimSource, /maybeCorrectIndoorSwimForAlex\(structuredClone\(activity\), athlete\)/);
    assert.match(swimSource, /Object\.getOwnPropertyDescriptor\(athlete, key\)/);
    assert.match(swimSource, /function\s+decodePolyline\(value\)/);
    assert.match(swimSource, /function\s+getRouteColorSeries\(streams, mode, pointCount\)/);
});

test('detail classifiers receive injected Repository zones and have no provider storage fallback', async () => {
    const genericSource = rendererSources.get('js/pages/activity/activity.js');
    const runSource = rendererSources.get('js/pages/run/run.js');
    const bikeSource = rendererSources.get('js/pages/bike/bike.js');
    assert.match(genericSource, /classifyRun\(activityData, streamData, zones\)/);
    assert.match(runSource, /classifyRun\(activityData, streamData, zones\)/);
    assert.match(bikeSource, /classifyBike\(activity, streams, zones\)/);

    for (const relativePath of [
        'classifyRun.js',
        'classifyBike.js',
        ...rendererSources.keys()
    ]) {
        const value = relativePath.startsWith('classify')
            ? await source(relativePath)
            : rendererSources.get(relativePath);
        assert.doesNotMatch(
            value,
            /localStorage|sessionStorage|strava_training_zones|strava_zones|strava_athlete_data|strava_tokens|Authorization/,
            relativePath
        );
    }
});

test('Advanced default adapter uses static UI methods and instance-free export bindings', () => {
    const genericSource = rendererSources.get('js/pages/activity/activity.js');
    for (const method of [
        'renderSummary',
        'renderInsights',
        'renderClimbs',
        'renderSegments',
        'renderExports'
    ]) {
        assert.match(
            genericSource,
            new RegExp(`AnalysisResultsUI\\.${method}\\(analyzer, sections\\.`),
            method
        );
    }
    assert.doesNotMatch(genericSource, /new\s+AnalysisResultsUI\s*\(/);
    assert.match(genericSource, /button\.removeAttribute\('onclick'\)/);
    assert.match(genericSource, /analyzer\.downloadExport\(format\)/);
});

test('Advanced Analysis consumes injected bundle data and contains no provider I/O', () => {
    assert.match(advancedSource, /from\s*['"]\.\.\/\.\.\/analysis\/index\.js['"]/);
    assert.match(advancedSource, /from\s*['"]\.\.\/\.\.\/analysis\/export\/index\.js['"]/);
    assert.match(advancedSource, /constructor\(activity_id, metadata, streams,/);
    for (const prohibited of [
        /fetchActivityData/,
        /\/api\/strava-/,
        /Authorization|strava_tokens/,
        /\bfetch\s*\(|\bbtoa\s*\(|localStorage|sessionStorage|indexedDB/,
        /console\.log|console\.error/
    ]) {
        assert.doesNotMatch(advancedSource, prohibited);
    }
    const genericSource = rendererSources.get('js/pages/activity/activity.js');
    assert.match(
        genericSource,
        /new\s+AdvancedActivityAnalyzer\(activityId, activity, streams\)/
    );
    assert.doesNotMatch(genericSource, /fetchActivityData/);
    assert.doesNotMatch(genericSource, /error\.message|console\.error/);
});

test('Router depends only on Demo, feature flags, and the Repository public Factory boundary', () => {
    assert.match(
        routerSource,
        /import\s*\{\s*isDemoMode\s*\}\s*from\s*['"]\.\.\/demo\/index\.js['"]/
    );
    assert.match(
        routerSource,
        /import\s*\{\s*createRepository\s*\}\s*from\s*['"]\.\.\/repository\/index\.js['"]/
    );
    assert.match(
        routerSource,
        /import\s*\{\s*getFeatureFlags\s*\}\s*from\s*['"]\.\.\/app\/feature-flags\.js['"]/
    );
    assert.equal((routerSource.match(/normalized\.featureFlagsReader\(\)/g) || []).length, 1);
    assert.match(routerSource, /demoMode\s*\?\s*'legacy'/);
    for (const prohibited of [
        /from\s*['"][^'"]*services\//,
        /from\s*['"][^'"]*connectors\//,
        /from\s*['"][^'"]*repository\/(?:factory|legacy|demo|errors)/,
        /createRepositoryWithDependencies/,
        /StravaApiConnector/,
        /\/api\/strava-/,
        /Authorization/,
        /strava_tokens/,
        /\bfetch\s*\(/,
        /\bbtoa\s*\(/,
        /indexedDB/,
        /localStorage/,
        /sessionStorage/
    ]) {
        assert.doesNotMatch(routerSource, prohibited);
    }
});

test('DetailReadSession uses only the Repository public error boundary', () => {
    assert.match(
        sessionSource,
        /import\s*\{\s*RepositoryError\s*\}\s*from\s*['"]\.\.\/\.\.\/repository\/index\.js['"]/
    );
    for (const prohibited of [
        /from\s*['"][^'"]*services\//,
        /from\s*['"][^'"]*connectors\//,
        /from\s*['"][^'"]*repository\/(?:factory|legacy|demo|errors)/,
        /\/api\/strava-/,
        /Authorization/,
        /strava_tokens/,
        /\bfetch\s*\(/,
        /localStorage|sessionStorage|indexedDB|\bbtoa\s*\(/,
        /console\./,
        /document\.|window\./
    ]) {
        assert.doesNotMatch(sessionSource, prohibited);
    }
});

test('opaque ID paths contain no numeric conversion or arithmetic coercion', () => {
    for (const [name, value] of [
        ['Router', routerSource],
        ['DetailReadSession', sessionSource]
    ]) {
        assert.doesNotMatch(value, /parseInt|parseFloat|BigInt/, name);
        assert.doesNotMatch(value, /\bNumber\s*\(/, name);
        assert.doesNotMatch(value, /activityId\s*[+*/%-]/, name);
        assert.doesNotMatch(value, /[+*/%-]\s*activityId/, name);
    }
    assert.match(routerSource, /Number\.isSafeInteger\(value\)/);
    assert.match(routerSource, /encodeURIComponent\(activityId\)/);
});

test('M23 R2 detail and gear renderers keep persistent strings out of HTML and inline handlers', () => {
    const genericSource = rendererSources.get('js/pages/activity/activity.js');
    const runSource = rendererSources.get('js/pages/run/run.js');
    const bikeSource = rendererSources.get('js/pages/bike/bike.js');
    const swimSource = rendererSources.get('js/pages/swim/swim.js');

    assert.doesNotMatch(genericSource, /DOM\.info\.innerHTML\s*=/);
    for (const [relativePath, value] of [
        ['js/pages/activity/activity.js', genericSource],
        ['js/pages/run/run.js', runSource],
        ['js/pages/bike/bike.js', bikeSource]
    ]) {
        assert.doesNotMatch(value, /segments\/\$\{effort\.segment\.id\}/, relativePath);
        assert.doesNotMatch(value, /<td>\$\{effort\.name\}<\/td>/, relativePath);
        assert.match(value, /encodeURIComponent\(String\(effort\.segment\.id\)\)/, relativePath);
        assert.match(value, /segmentLink\.rel\s*=\s*'noopener noreferrer'/, relativePath);
    }
    for (const [relativePath, value] of [
        ['js/pages/run/run.js', runSource],
        ['js/pages/bike/bike.js', bikeSource],
        ['js/pages/swim/swim.js', swimSource]
    ]) {
        assert.doesNotMatch(value, /heroGear\.innerHTML\s*=/, relativePath);
        assert.match(value, /new URLSearchParams\(\)/, relativePath);
        assert.match(value, /gearLink\.textContent\s*=/, relativePath);
    }

    assert.doesNotMatch(gearTabSource, /onclick\s*=/i);
    assert.doesNotMatch(gearTabSource, /window\.open\('html\/gear\.html\?id=/);
    assert.match(gearTabSource, /new URLSearchParams\(\)/);
    assert.match(gearTabSource, /card\.addEventListener\('click'/);

    assert.doesNotMatch(gearDetailSource, /onclick\s*=|onmouseover\s*=|onmouseout\s*=/i);
    assert.doesNotMatch(gearDetailSource, /document\.body\.innerHTML\s*=/);
    assert.doesNotMatch(gearDetailSource, /bindTooltip\(`\$\{act\.name/);
    assert.doesNotMatch(gearDetailSource, /window\.open\('activity-router\.html\?id=/);
    assert.match(gearDetailSource, /new URLSearchParams\(\)/);
    assert.match(gearDetailSource, /tooltip\.textContent\s*=/);
});

test('Router HTML has one module boundary and no Legacy provider implementation', () => {
    assert.equal(
        (routerHtml.match(/js\/pages\/activity-router\.js/g) || []).length,
        1
    );
    for (const prohibited of [
        /parseInt|parseFloat/,
        /strava_tokens|Authorization/,
        /\/api\/strava-/,
        /\bfetch\s*\(/,
        /\bbtoa\s*\(/,
        /innerHTML|onclick=/
    ]) {
        assert.doesNotMatch(routerHtml, prohibited);
    }
});

test('Connector stream URL uses one type parameter and never types', () => {
    const fetchStreamsBody = connectorSource.slice(
        connectorSource.indexOf('fetchStreams(activityId, options)'),
        connectorSource.indexOf('fetchAthlete()')
    );
    assert.match(fetchStreamsBody, /&type=\$\{encodeURIComponent\(types\.join\(','\)\)\}/);
    assert.doesNotMatch(fetchStreamsBody, /[?&]types=/);
    assert.equal((fetchStreamsBody.match(/this\.#request\(/g) || []).length, 1);
});

test('Repository public entry remains exactly the seven-method boundary exports', async () => {
    const repositoryModule = await import('../../js/repository/index.js');
    assert.deepEqual(Object.keys(repositoryModule).sort(), [
        'REPOSITORY_ERROR_CODE',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'RepositoryError',
        'createRepository'
    ].sort());
    const repositoryIndex = await source('js/repository/index.js');
    assert.doesNotMatch(repositoryIndex, /getActivityBundle|getLaps/);
});

test('B1 adds no session handoff and quick-start remains outside production entries', async () => {
    assert.doesNotMatch(routerSource, /sessionStorage|URL payload|postMessage/);
    assert.doesNotMatch(sessionSource, /sessionStorage|postMessage/);

    const productionEntries = [
        'html/activity-router.html',
        'html/activity.html',
        'html/run.html',
        'html/bike.html',
        'html/swim.html',
        'js/pages/activity-router.js',
        'js/pages/activity/index.js',
        'js/pages/run/index.js',
        'js/pages/bike/index.js',
        'js/pages/swim/index.js'
    ];
    for (const entry of productionEntries) {
        assert.doesNotMatch(
            await source(entry),
            /quick-start-example\.js/,
            entry
        );
    }
});

test('durable PR-04B contract files and finalized browser harness remain tracked', async () => {
    const trackedPaths = readTrackedPaths();
    assertPr04bContractsTracked(trackedPaths);
    for (const relativePath of B1_IMPLEMENTATION_PATHS) {
        assert.equal(trackedPaths.has(relativePath), true, relativePath);
    }

    const browserHarnessPath = 'tests/consumers/detail-browser-smoke.html';
    assert.equal(
        trackedPaths.has(browserHarnessPath),
        true,
        'The approved B3 browser evidence must be tracked after Finalization.'
    );
    const browserHarness = path.join(projectRoot, browserHarnessPath);
    await access(browserHarness);
});

test('tracked-file guard rejects a simulated missing PR-04B contract', () => {
    const trackedPaths = new Set(PR04B_CONTRACT_PATHS);
    trackedPaths.delete('js/pages/detail/detail-read-session.js');
    assert.throws(
        () => assertPr04bContractsTracked(trackedPaths),
        /PR-04B contract file is not tracked/
    );
});

test('completed PR-04B governance and public boundaries remain present without a global-tree freeze', () => {
    const trackedPaths = readTrackedPaths();
    for (const relativePath of [
        'js/repository/index.js',
        'js/repository/factory.js',
        'js/repository/errors.js',
        'js/repository/legacy/legacy-repository.js',
        'js/repository/demo/demo-repository.js'
    ]) {
        assert.equal(trackedPaths.has(relativePath), true, relativePath);
    }
});

test('PR-17 freezes the literal 17-path allowlist and stable boundaries', async () => {
    const brief = await source('docs/tasks/pr-17-canonical-detail-cutover.md');
    const match = /modify exactly these 17 paths[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), PR17_ALLOWLIST);
    for (const pattern of [
        /no eighth Repository method/,
        /DEFAULT_FEATURE_FLAGS\.dataRepositoryMode.*literal `legacy`/,
        /Demo always selects Demo/,
        /js\/storage\/\*\*/,
        /js\/analysis\/\*\*/,
        /js\/tabs\/\*\*/,
        /tests\/fixtures\/\*\*/,
        /Whole-tree manifests and whole-file\s+hashes.*prohibited/s
    ]) {
        assert.match(brief, pattern);
    }
});

test('PR-17 Canonical detail browser harness freezes instrumented evidence and blocks actual claims', async () => {
    const harness = await source('tests/consumers/canonical-detail-browser-smoke.html');
    const moduleScript = /<script type="module" nonce="pr17-detail">([\s\S]*?)<\/script>/.exec(harness);
    assert.notEqual(moduleScript, null);
    execFileSync(
        process.execPath,
        ['--input-type=module', '--check'],
        { input: moduleScript[1], encoding: 'utf8' }
    );
    for (const pattern of [
        /DISPOSABLE_LOOPBACK_ORIGIN_REQUIRED/,
        /EXPLICIT_SYNTHETIC_MODE_REQUIRED/,
        /dataRepositoryMode:\s*'canonical'/,
        /V2_DATABASE\s*=\s*'strava-stats-v2'/,
        /\/html\/activity-router\.html/,
        /\/html\/activity\.html/,
        /\/html\/run\.html/,
        /\/html\/bike\.html/,
        /\/html\/swim\.html/,
        /instrumentedServedFrame/,
        /verifyInstrumentedRouter/,
        /verifyInstrumentedDetail/,
        /INSTRUMENTED_ADVANCED_ZERO_DATABASE_IO/,
        /INSTRUMENTED_ADVANCED_ZERO_PROVIDER_IO/,
        /ACTUAL_SERVED_NAVIGATION_BLOCKED/,
        /DATABASE_ENUMERATION_REQUIRED/,
        /ROLLBACK_MODE_/,
        /DEMO_FLAG_ISOLATION_/,
        /navigator\.serviceWorker\.getRegistrations/,
        /caches\.keys\(\)/,
        /databaseOpens/,
        /storageReads/,
        /authorization/
    ]) {
        assert.match(harness, pattern);
    }
    assert.doesNotMatch(harness, /strava_tokens|strava_athlete_data|strava_training_zones/);
    assert.doesNotMatch(harness, /stream\('heartRate',\s*'bpm',\s*\[0,/);
    assert.doesNotMatch(harness, /ACTUAL_(?!SERVED_NAVIGATION_BLOCKED)/);
    assert.doesNotMatch(harness, /document\.body\.dataset\.status = 'passed'/);
    for (const destructivePattern of [
        /indexedDB\.deleteDatabase/,
        /localStorage\.clear\(/,
        /sessionStorage\.clear\(/,
        /caches\.delete\(/,
        /\.unregister\(/
    ]) {
        assert.doesNotMatch(harness, destructivePattern);
    }
});

test('page governance freezes provider, privacy, ID, mode, and B1 scope rules', async () => {
    const rules = await source('js/pages/AGENTS.md');
    for (const pattern of [
        /Tokens or Authorization/,
        /\/api\/strava-\*/,
        /provider, Connector, cache, storage implementation/,
        /public Repository entry.*page-local read façade/s,
        /Activity IDs are non-empty opaque strings/,
        /parseInt.*parseFloat.*Number.*BigInt/s,
        /exactly once per document/,
        /Demo document must not construct a Real\s+connector/,
        /provider-owned storage keys/,
        /response body, payload, cause/,
        /Local Library, Legacy cache, IndexedDB/,
        /detail renderer, analysis algorithm.*public Repository API/s,
        /B1 authorizes only Router.*It does not authorize migration/s
    ]) {
        assert.match(rules, pattern);
    }
});

function localImports(sourceText) {
    const imports = [];
    const pattern = /(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g;
    for (const match of sourceText.matchAll(pattern)) imports.push(match[2]);
    return imports;
}

async function assertAcyclic(entryPaths) {
    const visiting = new Set();
    const visited = new Set();

    async function visit(absolutePath) {
        const normalized = path.normalize(absolutePath);
        if (visiting.has(normalized)) {
            assert.fail(`Circular import detected at ${normalized}`);
        }
        if (visited.has(normalized)) return;

        visiting.add(normalized);
        const value = await readFile(normalized, 'utf8');
        for (const specifier of localImports(value)) {
            const resolved = path.resolve(path.dirname(normalized), specifier);
            await visit(resolved);
        }
        visiting.delete(normalized);
        visited.add(normalized);
    }

    for (const entryPath of entryPaths) {
        await visit(path.join(projectRoot, entryPath));
    }
}

test('Router, DetailReadSession, and page composition module graph is acyclic', async () => {
    await assertAcyclic([
        'js/pages/activity-router.js',
        'js/pages/detail/detail-read-session.js',
        ...pageIndexPaths,
        ...rendererPaths,
        'js/pages/activity/advanced-analysis.js'
    ]);
});

test('Stream presentation reduction remains confined to renderer construction seams', async () => {
    for (const [relativePath, value] of rendererSources) {
        assert.match(value, /\.\.\/detail\/stream-presentation\.js/, relativePath);
        assert.match(value, /prepareStreamMapPresentation\(/, relativePath);
        if (relativePath !== 'js/pages/swim/swim.js') {
            const chartAdapter = /function createStreamPresentationChart[\s\S]*?\n}\n/.exec(value)?.[0] ?? '';
            const stateAdapter = /function renderStreamPresentationState[\s\S]*?\n}\n/.exec(value)?.[0] ?? '';
            assert.match(`${chartAdapter}\n${stateAdapter}`, /presentation\.status === 'too-fragmented'/, relativePath);
            assert.match(`${chartAdapter}\n${stateAdapter}`, /Too fragmented to plot\./, relativePath);
        }
    }
    const swimRenderer = rendererSources.get('js/pages/swim/swim.js');
    const swimCharts = /function renderStreamCharts[\s\S]*?\n}\n/.exec(swimRenderer)?.[0] ?? '';
    assert.match(swimCharts, /presentation\.status === 'too-fragmented'/);
    assert.match(swimCharts, /Too fragmented to plot\./);
    const bikeRenderer = rendererSources.get('js/pages/bike/bike.js');
    const cadenceSpeed = /function renderCadenceSpeedChart[\s\S]*?\n}\n/.exec(bikeRenderer)?.[0] ?? '';
    assert.match(cadenceSpeed, /presentation\.status === 'too-fragmented'/);
    assert.match(cadenceSpeed, /renderStreamPresentationState\('chart-cadence-speed'/);
    for (const relativePath of [
        'js/pages/activity/advanced-analysis.js',
        'js/tabs/run-plus.js',
        'js/analysis/index.js',
        'js/repository/index.js'
    ]) {
        assert.doesNotMatch(
            await source(relativePath),
            /stream-presentation|reduceAlignedStreamData|prepareStreamChartPresentation|prepareStreamMapPresentation/,
            relativePath
        );
    }
    assert.doesNotMatch(
        streamPresentationSource,
        /repository|storage|indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket|console\./
    );
});

test('Stream performance harnesses are deterministic native modules with recording boundaries', async () => {
    const nodeGate = await source('tests/performance/stream-performance.test.js');
    for (const pattern of [
        /POINT_COUNT\s*=\s*200_000/,
        /WARMUPS\s*=\s*10/,
        /SAMPLES\s*=\s*30/,
        /p95.*<=\s*25/s,
        /maximum.*<=\s*50/s
    ]) {
        assert.match(nodeGate, pattern);
    }

    const browserHarness = await source('tests/performance/performance-browser-smoke.html');
    const moduleScript = /<script type="module">([\s\S]*?)<\/script>/.exec(browserHarness);
    assert.notEqual(moduleScript, null);
    execFileSync(
        process.execPath,
        ['--input-type=module', '--check'],
        { input: moduleScript[1], encoding: 'utf8' }
    );
    for (const pattern of [
        /POINT_COUNT\s*=\s*200_000/,
        /ACTIVITY_COUNTS\s*=\s*Object\.freeze\(\[5_000,\s*10_000\]\)/,
        /REPETITIONS\s*=\s*5/,
        /repositoryEnvelopeP95Ms\s*<=\s*1_000/,
        /activitiesSecondRafP95Ms\s*<=\s*1_500/,
        /startupGetStreams\s*===\s*0/,
        /createRepositoryWithDependencies/,
        /deterministicCanonicalStore/,
        /repositoryPageReads/,
        /establishSummaryRepositorySession/,
        /loadActivitiesForSession/,
        /RecordingChart/,
        /RecordingLeaflet/,
        /PerformanceObserver/,
        /chartPointMaximum/,
        /mapPointMaximum/,
        /uncaught/
    ]) {
        assert.match(browserHarness, pattern);
    }
    assert.doesNotMatch(browserHarness, /function repositoryFor\(|storageWrites:\s*0/);
    assert.match(browserHarness, /DeterministicCanonicalStore/);
    assert.doesNotMatch(browserHarness, /https?:\/\/|fixtures\/private|indexedDB|localStorage|sessionStorage/);
});

test('consumer boundary tests contain no private fixtures or external URLs', async () => {
    const entries = await readdir(new URL('tests/consumers/', projectRootUrl));
    for (const name of [
        'detail-consumers.test.js',
        'detail-boundaries.test.js',
        'stream-presentation.test.js'
    ]) {
        assert.equal(entries.includes(name), true);
        const value = await source(`tests/consumers/${name}`);
        assert.doesNotMatch(value, /fixtures\/private|https?:\/\/(?!synthetic\.invalid)/);
    }
});
