import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOWLIST = Object.freeze([
    'docs/tasks/pr-15-local-first-bootstrap.md',
    'index.html',
    'js/app/main.js',
    'js/app/local-first-bootstrap.js',
    'tests/bootstrap/local-first-bootstrap.test.js',
    'tests/bootstrap/local-first-bootstrap-boundaries.test.js',
    'tests/bootstrap/local-first-bootstrap-browser-smoke.html',
    'tests/import/decoder-registry-wiring.test.js'
]);

async function source(relativePath) {
    return readFile(path.join(ROOT, relativePath), 'utf8');
}

test('bootstrap module import performs zero storage, Token, network, DOM, Worker, timer, or console I/O', async () => {
    const calls = [];
    const originals = new Map();
    for (const [name, replacement] of [
        ['fetch', () => calls.push('fetch')],
        ['indexedDB', { open: () => calls.push('indexedDB') }],
        ['localStorage', { getItem: () => calls.push('localStorage') }],
        ['document', { getElementById: () => calls.push('document') }],
        ['Worker', function Worker() { calls.push('Worker'); }]
    ]) {
        originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, {
            value: replacement,
            configurable: true,
            writable: true
        });
    }
    const originalTimeout = globalThis.setTimeout;
    const originalConsole = globalThis.console;
    globalThis.setTimeout = () => calls.push('timer');
    globalThis.console = new Proxy(originalConsole, {
        get() { calls.push('console'); return () => {}; }
    });

    try {
        await import(`${pathToFileURL(path.join(ROOT, 'js/app/local-first-bootstrap.js')).href}?zero-io=${Date.now()}`);
        assert.deepEqual(calls, []);
    } finally {
        globalThis.setTimeout = originalTimeout;
        globalThis.console = originalConsole;
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('production bootstrap imports only approved existing read boundaries', async () => {
    const bootstrap = await source('js/app/local-first-bootstrap.js');
    assert.match(bootstrap, /from ['"]\.\.\/storage\/index\.js['"]/);
    assert.match(bootstrap, /from ['"]\.\.\/services\/legacy-cache\/index\.js['"]/);
    assert.doesNotMatch(
        bootstrap,
        /fetch\s*\(|\/api\/|oauth|deauthorize|Authorization|createRepository|ImportService|Worker|serviceWorker|caches\.|indexedDB\.deleteDatabase/
    );
});

test('root application wires local-first before auth and keeps Source Manager same-origin', async () => {
    const main = await source('js/app/main.js');
    const html = await source('index.html');
    assert.match(main, /runLocalFirstBootstrap/);
    assert.match(main, /inspectLocalFirstBootstrap/);
    assert.match(main, /initializeLocalDashboard/);
    assert.match(
        main,
        /if \(state\.legacyActivities\.length === 0\) \{\s*showLocalDashboardShell\(state\);\s*return;\s*\}\s*await initializeApp/
    );
    assert.match(main, /data: structuredClone\(localActivities\)/);
    assert.match(main, /localOnly\s*\? 'Loading local activities\.\.\.'/);
    assert.match(
        main,
        /const documentSessionMode = \(\(\) => \{\s*try \{\s*return isDemoMode\(\)/
    );
    assert.match(main, /tabLinks\.forEach\(link => \{\s*link\.disabled = true;\s*link\.setAttribute\('aria-disabled', 'true'\)/);
    assert.match(main, /function activateTab\([^)]*\) \{\s*if \(!consumerRenderingEnabled\) return;/);
    assert.match(main, /function loadSettings\(\) \{\s*let saved;\s*try \{/);
    assert.match(main, /function saveFilterState\(\) \{\s*try \{/);
    assert.match(main, /function loadFilterState\(\) \{\s*let filters = \{\};\s*try \{/);
    assert.doesNotMatch(main, /indexedDB\.open|strava-stats-v2|strava-dashboard-cache/);
    assert.match(html, /id="source-status"/);
    assert.match(html, /href="\/source-manager\.html\?mode=real"/);
});

test('served smoke covers actual first-run, V2 shell, Legacy, Demo, and safe evidence surfaces', async () => {
    const smoke = await source('tests/bootstrap/local-first-bootstrap-browser-smoke.html');
    assert.match(smoke, /\.\.\/\.\.\/\?pr15=/);
    assert.match(smoke, /FIRST_RUN_EXACT_SOURCE_MANAGER_ROUTE/);
    assert.match(smoke, /CANONICAL_SHELL_NOT_FALSE_CONSUMER_SUCCESS/);
    assert.match(smoke, /CANONICAL_SUMMARY_CUTOVER_NOT_STARTED/);
    assert.match(smoke, /LEGACY_STARTUP_ZERO_PROVIDER_FETCH/);
    assert.match(smoke, /DEMO_REAL_LEGACY_SENTINEL_UNCHANGED/);
    assert.match(smoke, /authorizationSourceMatches/);
    assert.match(smoke, /parentRealmConsoleErrors/);
    assert.doesNotMatch(smoke, /harnessConsoleErrors/);
    assert.match(smoke, /serviceWorkers/);
});

test('Task Brief freezes the exact eight-path allowlist and prohibited surfaces', async () => {
    const brief = await source('docs/tasks/pr-15-local-first-bootstrap.md');
    for (const file of ALLOWLIST) assert.match(brief, new RegExp(file.replaceAll('.', '\\.')));
    assert.match(brief, /No allowlist glob/);
    assert.match(brief, /PR-16 owns Canonical summary/);
    assert.match(brief, /Service Worker, release, deployment/);
});

test('Repository, Storage schema, Import, auth lifecycle, and Service Worker public boundaries stay frozen', async () => {
    const [repository, storage, importEntry, authLifecycle, serviceWorker] = await Promise.all([
        source('js/repository/index.js'),
        source('js/storage/index.js'),
        source('js/import/index.js'),
        source('js/app/auth-lifecycle.js'),
        source('js/app/service-worker-policy.js')
    ]);
    assert.deepEqual(
        [...repository.matchAll(/export\s*\{([^}]+)\}/gs)].length > 0,
        true
    );
    assert.match(repository, /createRepository/);
    assert.doesNotMatch(repository, /CanonicalRepository|localFirst/);
    assert.match(storage, /createCanonicalStore/);
    assert.match(storage, /createImportStore/);
    assert.doesNotMatch(importEntry, /localFirst|bootstrap/);
    assert.doesNotMatch(authLifecycle, /localFirst|bootstrap/);
    assert.doesNotMatch(serviceWorker, /localFirst|bootstrap/);
});
