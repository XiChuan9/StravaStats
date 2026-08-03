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

const START_SHA = '98eec7a9ebd797e5580310ce1e8e528311ed99fa';
const projectRootUrl = new URL('../../', import.meta.url);
const projectRoot = fileURLToPath(projectRootUrl);
const B1_ALLOWED_PATHS = new Set([
    'docs/tasks/pr-04b-detail-consumers.md',
    'js/pages/AGENTS.md',
    'html/activity-router.html',
    'js/pages/activity-router.js',
    'js/pages/detail/detail-read-session.js',
    'js/connectors/strava/strava-api-connector.js',
    'tests/repository/strava-api-connector.test.js',
    'tests/repository/dependency-boundaries.test.js',
    'tests/consumers/detail-consumers.test.js',
    'tests/consumers/detail-boundaries.test.js'
]);
const B2_PRODUCT_PATHS = Object.freeze([
    'js/pages/activity/index.js',
    'js/pages/run/index.js',
    'js/pages/bike/index.js',
    'js/pages/swim/index.js',
    'js/pages/activity/activity.js',
    'js/pages/run/run.js',
    'js/pages/bike/bike.js',
    'js/pages/swim/swim.js',
    'js/pages/activity/advanced-analysis.js'
]);

async function source(relativePath) {
    return readFile(new URL(relativePath, projectRootUrl), 'utf8');
}

const routerSource = await source('js/pages/activity-router.js');
const sessionSource = await source('js/pages/detail/detail-read-session.js');
const routerHtml = await source('html/activity-router.html');
const connectorSource = await source(
    'js/connectors/strava/strava-api-connector.js'
);

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
            'js/pages/detail/detail-read-session.js'
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

test('B2 product files and B3 browser harness remain untouched at the B1 start SHA', async () => {
    for (const relativePath of B2_PRODUCT_PATHS) {
        const baseline = execFileSync(
            'git',
            ['show', `${START_SHA}:${relativePath}`],
            { cwd: projectRoot, encoding: 'utf8' }
        );
        assert.equal(await source(relativePath), baseline, relativePath);
    }

    const browserHarness = path.join(
        projectRoot,
        'tests/consumers/detail-browser-smoke.html'
    );
    await assert.rejects(access(browserHarness));
});

test('working tree changes remain inside the exact ten-path B1 allowlist', () => {
    const status = execFileSync(
        'git',
        ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
        { cwd: projectRoot, encoding: 'utf8' }
    );
    const statusPaths = status
        .split('\0')
        .filter(Boolean)
        .map(entry => entry.slice(3));
    const committedPaths = execFileSync(
        'git',
        ['diff', '--name-only', `${START_SHA}...HEAD`],
        { cwd: projectRoot, encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);
    const observed = new Set([...statusPaths, ...committedPaths]);

    for (const relativePath of observed) {
        assert.equal(
            B1_ALLOWED_PATHS.has(relativePath),
            true,
            `B1 path is not approved: ${relativePath}`
        );
    }
    assert.equal(observed.size <= B1_ALLOWED_PATHS.size, true);
});

test('package, Repository public files, and Service Worker remain byte-identical to B1 start', async () => {
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
        const baseline = execFileSync(
            'git',
            ['show', `${START_SHA}:${relativePath}`],
            { cwd: projectRoot, encoding: 'utf8' }
        );
        assert.equal(await source(relativePath), baseline, relativePath);
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

test('Router and DetailReadSession module graph is acyclic', async () => {
    await assertAcyclic([
        'js/pages/activity-router.js',
        'js/pages/detail/detail-read-session.js'
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
