import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const EXACT_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-23-default-canonical.md',
    'js/app/feature-flags.js',
    'js/app/main.js',
    'tests/feature-flags.test.js',
    'tests/consumers/run-plus-canonical-cutover.test.js',
    'tests/default-canonical.test.js',
    'tests/default-canonical-browser-smoke.html',
    'tests/shadow/shadow-app-integration.test.js',
    'tests/import/decoder-registry-wiring.test.js'
]);

async function source(relativePath) {
    return readFile(new URL(relativePath, ROOT), 'utf8');
}

test('PR-23 freezes the exact nine-path hard maximum and unchanged protected surfaces', async () => {
    const brief = await source('docs/tasks/pr-23-default-canonical.md');
    const match = /cumulative literal allowlist\s+is therefore exactly nine paths:[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), EXACT_ALLOWLIST);
    for (const pattern of [
        /No schema, public API, dependency, decoder, algorithm/,
        /No Legacy IndexedDB, V2\s+IndexedDB, backup, or user-owned setting may be deleted/,
        /Explicit Real `legacy` continues to use the accepted Legacy read path/,
        /Demo selection takes precedence/,
        /Ready is not merge authorization/
    ]) {
        assert.match(brief, pattern);
    }
});

test('default and explicit Canonical inspect local-first without Legacy or Token reads', async () => {
    const main = await source('js/app/main.js');
    assert.match(
        main,
        /async function inspectApplicationStart\(\)[\s\S]*?documentSessionMode === APP_SESSION_MODE\.REAL[\s\S]*?getFeatureFlags\(\)\.dataRepositoryMode === 'canonical'[\s\S]*?inspectLocalFirstBootstrap\(\{[\s\S]*?localStorage: canonicalInspectionStorage,[\s\S]*?legacyIndexedDbReader:[\s\S]*?canonicalInspectionNotFound,[\s\S]*?legacyLocalStorageReader:[\s\S]*?canonicalInspectionNotFound/
    );
    assert.match(
        main.slice(main.indexOf('const applicationStart =')),
        /const applicationStart = runLocalFirstBootstrap\(\{[\s\S]*?inspect: inspectApplicationStart,[\s\S]*?startDashboard: initializeLocalDashboard/
    );
    assert.doesNotMatch(main, /\?\s*initializeApp\(null\)\s*:\s*runLocalFirstBootstrap/);
});

test('an empty validated Canonical summary keeps one actionable root First-run entry', async () => {
    const main = await source('js/app/main.js');
    const firstRun = main.split('function showLocalFirstEntry(state)')[1]
        ?.split('async function inspectApplicationStart()')[0];
    assert.notEqual(firstRun, undefined);
    assert.match(firstRun, /appSection\?\.classList\.add\('hidden'\)/);
    assert.match(firstRun, /loginSection\?\.classList\.remove\('hidden'\)/);
    assert.match(firstRun, /document\.getElementById\('first-run-sources-link'\)/);
    assert.match(firstRun, /sourcesLink === null[\s\S]*?document\.createElement\('a'\)/);
    assert.match(firstRun, /sourcesLink\.href = '\/source-manager\.html\?mode=real'/);
    assert.match(firstRun, /sourcesLink\.textContent = 'Open Sources \/ import files'/);
    assert.match(firstRun, /sourcesLink\.hidden = false/);
    assert.match(
        main.slice(main.indexOf('const applicationStart =')),
        /navigateFirstRun: showLocalFirstEntry/
    );
    assert.match(
        main,
        /activityLoad\.source === REPOSITORY_SOURCE\.CANONICAL[\s\S]*?activities\.length === 0[\s\S]*?showLocalFirstEntry\(applicationInspectionState\)[\s\S]*?return;/
    );
    assert.doesNotMatch(main, /window\.location\.assign\('\/source-manager\.html\?mode=real'\)/);
});

test('the default switch does not change lower Repository, storage, provider, or public boundaries', async () => {
    const [factory, repository, main, localFirst] = await Promise.all([
        source('js/repository/factory.js'),
        source('js/repository/index.js'),
        source('js/app/main.js'),
        source('js/app/local-first-bootstrap.js')
    ]);
    assert.match(factory, /const mode = values\.mode \?\? 'legacy'/);
    assert.doesNotMatch(
        main,
        /strava_tokens|Authorization|\/api\/strava-|indexedDB\.(?:open|deleteDatabase)/i
    );
    assert.match(repository, /createRepository/);
    assert.doesNotMatch(repository, /local-first-bootstrap|feature-flags/);
    assert.doesNotMatch(localFirst, /dataRepositoryMode|DEFAULT_FEATURE_FLAGS/);
});

test('served PR-23 harness freezes synthetic default, rollback, Demo, detail, and route evidence', async () => {
    const harness = await source('tests/default-canonical-browser-smoke.html');
    for (const pattern of [
        /DISPOSABLE_LOOPBACK_ORIGIN_REQUIRED/,
        /EXPLICIT_SYNTHETIC_MODE_REQUIRED/,
        /DEFAULT_CANONICAL_V2_ONLY/,
        /EMPTY_CANONICAL_FIRST_RUN/,
        /EMPTY_CANONICAL_ONLY_V2_DATABASE/,
        /EMPTY_CANONICAL_NO_TOKEN_READ/,
        /EMPTY_CANONICAL_ZERO_RUNTIME_ERRORS/,
        /EMPTY_CANONICAL_ZERO_CONSOLE_ERRORS/,
        /name:\s*'empty-source-manager'/,
        /EMPTY_SOURCE_MANAGER_ONLY_V2_DATABASE/,
        /EMPTY_SOURCE_MANAGER_NO_TOKEN_READ/,
        /EMPTY_SOURCE_MANAGER_ZERO_RUNTIME_ERRORS/,
        /EMPTY_SOURCE_MANAGER_ZERO_CONSOLE_ERRORS/,
        /LEGACY_ROLLBACK_NON_DESTRUCTIVE/,
        /SHADOW_ROLLBACK_NON_DESTRUCTIVE/,
        /DEMO_PRECEDENCE_ZERO_REAL_DATABASE/,
        /PROVIDER_OFFLINE_LOCAL_CANONICAL/,
        /DEFAULT_CANONICAL_DETAIL/,
        /\/run-plus\/nsm/,
        /NO_TOKEN_OR_AUTHORIZATION_READ/,
        /OPAQUE_ID_PRESERVED/,
        /MISSING_NULL_REAL_ZERO_PRESERVED/,
        /EXTERNAL_RESOURCE_BASELINE/
    ]) {
        assert.match(harness, pattern);
    }
    assert.doesNotMatch(harness, /tests\/fixtures\/private|Authorization:\s*['"]/);
});
