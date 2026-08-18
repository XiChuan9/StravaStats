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

test('default and explicit Canonical keep the direct zero-Legacy startup boundary', async () => {
    const main = await source('js/app/main.js');
    assert.match(
        main,
        /documentSessionMode === APP_SESSION_MODE\.REAL[\s\S]*?getFeatureFlags\(\)\.dataRepositoryMode === 'canonical'[\s\S]*?\? initializeApp\(null\)[\s\S]*?: runLocalFirstBootstrap/
    );
    assert.doesNotMatch(
        main.slice(main.indexOf('const applicationStart =')),
        /inspectLocalFirstBootstrap\(\)[\s\S]*?initializeApp\(null\)[\s\S]*?dataRepositoryMode === 'canonical'/
    );
});

test('an empty validated Canonical summary enters exact Real First-run before optional reads', async () => {
    const main = await source('js/app/main.js');
    const activityResult = main.indexOf('const activities = activityLoad.data;');
    const firstRunNavigation = main.indexOf(
        "window.location.assign('/source-manager.html?mode=real');",
        activityResult
    );
    const optionalMetadata = main.indexOf(
        'loadInitializeAthleteAndZones(repository)',
        activityResult
    );
    assert.notEqual(activityResult, -1);
    assert.notEqual(firstRunNavigation, -1);
    assert.notEqual(optionalMetadata, -1);
    assert(firstRunNavigation < optionalMetadata);
    assert.match(
        main.slice(activityResult, optionalMetadata),
        /activityLoad\.source === REPOSITORY_SOURCE\.CANONICAL[\s\S]*?activities\.length === 0[\s\S]*?window\.location\.assign\('\/source-manager\.html\?mode=real'\)[\s\S]*?return;/
    );
});

test('the default switch does not change lower Repository, storage, provider, or public boundaries', async () => {
    const [factory, repository, main, localFirst] = await Promise.all([
        source('js/repository/factory.js'),
        source('js/repository/index.js'),
        source('js/app/main.js'),
        source('js/app/local-first-bootstrap.js')
    ]);
    assert.match(factory, /const mode = values\.mode \?\? 'legacy'/);
    assert.doesNotMatch(main, /strava_tokens|Authorization|\/api\/strava-|indexedDB/i);
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
