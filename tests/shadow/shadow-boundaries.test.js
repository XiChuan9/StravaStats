import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function shadowSources() {
    const directory = path.join(ROOT, 'js/shadow');
    const names = (await readdir(directory)).filter(name => name.endsWith('.js'));
    return Promise.all(names.map(async name => ({
        name,
        source: await readFile(path.join(directory, name), 'utf8')
    })));
}

test('shadow entry exposes only the frozen internal M3 seam', async () => {
    const module = await import('../../js/shadow/index.js');
    assert.deepEqual(Object.keys(module).sort(), [
        'closeApplicationShadowWriter',
        'createShadowCanonicalWriter',
        'exportApplicationShadowParityReport',
        'flushApplicationShadowWrites',
        'getApplicationShadowWriter'
    ]);
});

test('PR-07 preserves Repository API and approved public storage exports', async () => {
    const [storage, repository] = await Promise.all([
        import('../../js/storage/index.js'),
        import('../../js/repository/index.js')
    ]);
    assert.deepEqual(Object.keys(storage).sort(), [
        'STORAGE_ERROR_CODE',
        'StorageError',
        'V2_DATABASE_NAME',
        'V2_DATABASE_VERSION',
        'V2_SCHEMA',
        'createCanonicalStore',
        'createImportStore',
        'createSourceConnectionStore',
        'createSourceOperationStore'
    ]);
    assert.deepEqual(Object.keys(repository).sort(), [
        'REPOSITORY_ERROR_CODE',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'RepositoryError',
        'createRepository'
    ]);
});

test('shadow production source has no logging, destructive storage, Legacy database, provider endpoint, or DOM path', async () => {
    for (const { name, source } of await shadowSources()) {
        assert.doesNotMatch(source, /\bconsole\.(?:log|warn|error)\b/, name);
        assert.doesNotMatch(source, /deleteDatabase|\.clear\s*\(/, name);
        assert.doesNotMatch(source, /strava-dashboard-cache/, name);
        assert.doesNotMatch(source, /\/api\/strava-|Authorization|strava_tokens/, name);
        assert.doesNotMatch(source, /\bdocument\b|innerHTML|textContent/, name);
        assert.doesNotMatch(source, /\beval\s*\(|\bnew Function\b/, name);
    }
});

test('shadow report schema contains every required parity field and fixed difference category', async () => {
    const source = await readFile(path.join(ROOT, 'js/shadow/parity-report.js'), 'utf8');
    for (const field of [
        'activityCount',
        'opaqueId',
        'distance',
        'movingTime',
        'elapsedTime',
        'date',
        'sportType',
        'heartRate',
        'power',
        'gear'
    ]) assert.match(source, new RegExp(`['\"]${field}['\"]`));
    for (const category of [
        'MAPPING_FAILURE',
        'VALIDATION_FAILURE',
        'STORAGE_FAILURE',
        'VERIFICATION_FAILURE',
        'PARITY_MISMATCH',
        'NORMALIZATION_WARNING'
    ]) assert.match(source, new RegExp(category));
});

test('Task Brief keeps a literal cumulative allowlist and prohibited scope', async () => {
    const source = await readFile(
        path.join(ROOT, 'docs/tasks/pr-06-shadow-canonical-writer.md'),
        'utf8'
    );
    const allowed = [
        'docs/tasks/pr-06-shadow-canonical-writer.md',
        'js/shadow/index.js',
        'js/shadow/legacy-to-canonical.js',
        'js/shadow/parity-report.js',
        'js/shadow/shadow-canonical-writer.js',
        'tests/shadow/shadow-canonical-writer.test.js',
        'tests/shadow/shadow-boundaries.test.js',
        'js/app/feature-flags.js',
        'js/app/main.js',
        'tests/feature-flags.test.js',
        'tests/shadow/shadow-app-integration.test.js',
        'tests/consumers/summary-consumers.test.js',
        ['tests/consumers/run', 'plus-consumers.test.js'].join('-'),
        'tests/legacy/demo-isolation.test.js',
        'tests/shadow/shadow-writer-browser-smoke.html'
    ];
    for (const relative of allowed) assert.match(source, new RegExp(relative.replaceAll('/', '\\/')));
    assert.match(source, /cumulative maximum allowlist is exactly 15 paths/);
    assert.match(source, /Any sixteenth path/);
    assert.match(source, /no Repository method\/export/i);
});
