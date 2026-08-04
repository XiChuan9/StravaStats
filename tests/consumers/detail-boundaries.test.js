import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    access,
    readFile,
    readdir
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const B31_BASELINE_SHA = '779d4ac5ff4c4cd29787553034bb5d69cce337d3';
// Generated from B31_BASELINE_SHA with `git ls-tree -r -z`, excluding exactly
// the ten B3.1 paths, sorting by path with code-unit order, and hashing canonical
// `<mode> <object-id>\t<path>\0` records in order.
const PROTECTED_TREE_SHA256 =
    '2a472f3955d31a2933f634f19f9b74b0cfb0701ae2461e6e0f68ca5bf8860ee6';
const PROTECTED_ENTRY_COUNT = 208;
const projectRootUrl = new URL('../../', import.meta.url);
const projectRoot = fileURLToPath(projectRootUrl);
const B31_ALLOWED_PATHS = new Set([
    'docs/tasks/pr-04b-detail-consumers.md',
    'classifyRun.js',
    'classifyBike.js',
    'js/pages/activity/activity.js',
    'js/pages/run/run.js',
    'js/pages/bike/bike.js',
    'js/pages/swim/swim.js',
    'tests/consumers/detail-consumers.test.js',
    'tests/consumers/detail-boundaries.test.js',
    'tests/consumers/detail-browser-smoke.html'
]);
const PR04B_ALLOWED_PATHS = new Set([
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

function readIndexEntries() {
    const output = execFileSync(
        'git',
        ['ls-files', '-s', '-z'],
        { cwd: projectRoot, encoding: 'utf8' }
    );
    const records = output.split('\0');
    assert.equal(records.pop(), '');

    return records.map(record => {
        const match = /^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/.exec(record);
        assert.notEqual(match, null, `Malformed index entry: ${record}`);
        const [, mode, objectId, stage, relativePath] = match;
        assert.match(mode, /^[0-7]{6}$/);
        assert.match(objectId, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
        assert.equal(stage, '0', `Unmerged index entry: ${relativePath}`);
        return { mode, objectId, relativePath };
    });
}

function protectedTreeDigest(entries) {
    const protectedEntries = entries
        .filter(entry => !B31_ALLOWED_PATHS.has(entry.relativePath))
        .sort((left, right) => (
            left.relativePath < right.relativePath
                ? -1
                : (left.relativePath > right.relativePath ? 1 : 0)
        ));
    const hash = createHash('sha256');
    for (const entry of protectedEntries) {
        hash.update(
            `${entry.mode} ${entry.objectId}\t${entry.relativePath}\0`
        );
    }
    return hash.digest('hex');
}

function assertProtectedTreeDigest() {
    const entries = readIndexEntries();
    const trackedPaths = new Set(entries.map(entry => entry.relativePath));
    for (const relativePath of [
        'docs/tasks/pr-04b-detail-consumers.md',
        'tests/consumers/detail-boundaries.test.js'
    ]) {
        assert.equal(
            trackedPaths.has(relativePath),
            true,
            `Baseline-tracked B3 path is not tracked: ${relativePath}`
        );
    }
    assert.equal(
        entries.filter(entry => !B31_ALLOWED_PATHS.has(entry.relativePath)).length,
        PROTECTED_ENTRY_COUNT
    );
    assert.equal(protectedTreeDigest(entries), PROTECTED_TREE_SHA256);
    return trackedPaths;
}

function assertObservedB31Paths(observed) {
    for (const relativePath of observed) {
        assert.equal(
            B31_ALLOWED_PATHS.has(relativePath),
            true,
            `B3.1 path is not approved: ${relativePath}`
        );
    }
    assert.equal(
        observed.size <= B31_ALLOWED_PATHS.size,
        true,
        'B3.1 worktree contains an eleventh path.'
    );
}

function assertObservedPr04bPaths(observed) {
    for (const relativePath of observed) {
        assert.equal(
            PR04B_ALLOWED_PATHS.has(relativePath),
            true,
            `PR-04B path is not approved: ${relativePath}`
        );
    }
    assert.ok(observed.size <= PR04B_ALLOWED_PATHS.size, 'PR-04B contains a twenty-third path.');
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
const advancedSource = await source('js/pages/activity/advanced-analysis.js');

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
        assert.equal((value.match(/demoModeReader\(\)/g) || []).length, 1, relativePath);
        assert.equal((value.match(/repositoryFactory\(\{/g) || []).length, 1, relativePath);
        assert.equal((value.match(/sessionFactory\(\{/g) || []).length, 1, relativePath);
        assert.equal((value.match(/session\.load\(\)/g) || []).length, 1, relativePath);
        assert.match(value, /allowExternalWeather:\s*!demo/, relativePath);
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
            streams: ['distance', 'time', 'heartrate', 'altitude', 'cadence', 'watts', 'velocity_smooth'],
            athlete: false
        }],
        ['js/pages/bike/index.js', {
            streams: ['distance', 'time', 'heartrate', 'altitude', 'cadence', 'watts', 'velocity_smooth'],
            athlete: false
        }],
        ['js/pages/swim/index.js', {
            streams: ['distance', 'time', 'heartrate', 'cadence'],
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
            /new\s+URLSearchParams/,
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

test('Router depends only on Demo mode and the Repository public Factory boundary', () => {
    assert.match(
        routerSource,
        /import\s*\{\s*isDemoMode\s*\}\s*from\s*['"]\.\.\/demo\/index\.js['"]/
    );
    assert.match(
        routerSource,
        /import\s*\{\s*createRepository\s*\}\s*from\s*['"]\.\.\/repository\/index\.js['"]/
    );
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

test('protected pre-B3.1 implementation remains under the fixed tree digest', async () => {
    const trackedPaths = assertProtectedTreeDigest();
    for (const relativePath of B1_IMPLEMENTATION_PATHS) {
        assert.equal(B31_ALLOWED_PATHS.has(relativePath), false, relativePath);
        assert.equal(trackedPaths.has(relativePath), true, relativePath);
    }

    const browserHarnessPath = 'tests/consumers/detail-browser-smoke.html';
    assert.equal(B31_ALLOWED_PATHS.has(browserHarnessPath), true);
    assert.equal(trackedPaths.has(browserHarnessPath), false);
    const browserHarness = path.join(projectRoot, browserHarnessPath);
    await access(browserHarness);
});

test('working tree and protected index remain inside the exact ten-path B3.1 boundary', () => {
    const status = execFileSync(
        'git',
        ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
        { cwd: projectRoot, encoding: 'utf8' }
    );
    const statusPaths = status
        .split('\0')
        .filter(Boolean)
        .map(entry => entry.slice(3));
    const observed = new Set(statusPaths);
    assertObservedB31Paths(observed);
    assertProtectedTreeDigest();
});

test('protected-tree digest rejects a simulated protected blob change', () => {
    const entries = readIndexEntries();
    const protectedIndex = entries.findIndex(entry => (
        !B31_ALLOWED_PATHS.has(entry.relativePath)
    ));
    assert.notEqual(protectedIndex, -1);
    const mutated = entries.map((entry, index) => (
        index === protectedIndex
            ? { ...entry, objectId: '0'.repeat(entry.objectId.length) }
            : entry
    ));
    assert.notEqual(protectedTreeDigest(mutated), PROTECTED_TREE_SHA256);
});

test('B3.1 path audit rejects a simulated eleventh path', () => {
    const observed = new Set([
        ...B31_ALLOWED_PATHS,
        'tests/consumers/unapproved-b3-path.html'
    ]);
    assert.throws(
        () => assertObservedB31Paths(observed),
        /B3\.1 path is not approved/
    );
});

test('PR-04B total boundary freezes twenty-two paths and rejects a twenty-third', () => {
    assert.equal(PR04B_ALLOWED_PATHS.size, 22);
    for (const relativePath of B31_ALLOWED_PATHS) {
        assert.equal(PR04B_ALLOWED_PATHS.has(relativePath), true, relativePath);
    }
    assert.doesNotThrow(() => assertObservedPr04bPaths(PR04B_ALLOWED_PATHS));
    assert.throws(
        () => assertObservedPr04bPaths(new Set([
            ...PR04B_ALLOWED_PATHS,
            'tests/consumers/unapproved-pr04b-path.html'
        ])),
        /PR-04B path is not approved/
    );
});

test('package, Repository public files, and Service Worker stay protected by the tree digest', () => {
    const trackedPaths = assertProtectedTreeDigest();
    for (const relativePath of [
        'package.json',
        'package-lock.json',
        'sw.js',
        'js/repository/index.js',
        'js/repository/factory.js',
        'js/repository/errors.js',
        'js/repository/legacy/legacy-repository.js',
        'js/repository/demo/demo-repository.js'
    ]) {
        assert.equal(B31_ALLOWED_PATHS.has(relativePath), false, relativePath);
        assert.equal(trackedPaths.has(relativePath), true, relativePath);
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

test('consumer boundary tests contain no private fixtures or external URLs', async () => {
    const entries = await readdir(new URL('tests/consumers/', projectRootUrl));
    for (const name of [
        'detail-consumers.test.js',
        'detail-boundaries.test.js'
    ]) {
        assert.equal(entries.includes(name), true);
        const value = await source(`tests/consumers/${name}`);
        assert.doesNotMatch(value, /fixtures\/private|https?:\/\/(?!synthetic\.invalid)/);
    }
});
