import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const importIndex = new URL('../../js/import/index.js', import.meta.url);

test('Import Core public exports are exact and do not expand Repository', async () => {
    const module = await import(`${importIndex.href}?boundary=${Date.now()}`);
    assert.deepEqual(Object.keys(module).sort(), [
        'IMPORT_ERROR_CODE',
        'IMPORT_ITEM_STATUS',
        'IMPORT_JOB_STATUS',
        'ImportError',
        'SYNTHETIC_JSON_MEDIA_TYPE',
        'assertImportItemTransition',
        'assertImportJobTransition',
        'createBrowserImportWorker',
        'createDecoderRegistry',
        'createImportService',
        'createInlineImportWorker',
        'normalizeImportedActivity',
        'syntheticJsonDecoder'
    ]);
    const repository = await import('../../js/repository/index.js');
    assert.equal(Object.keys(repository).includes('importActivities'), false);
});

test('production Import Core has no provider, network, DOM, logging, or destructive storage seam', async () => {
    const files = [
        'activities-preview.js', 'decoder-registry.js', 'errors.js', 'import-service.js',
        'index.js', 'normalizer.js', 'safe-data.js', 'state-machine.js',
        'synthetic-import-worker.js', 'synthetic-json-decoder.js', 'worker-client.js'
    ];
    const source = (await Promise.all(files.map(file => readFile(
        new URL(`../../js/import/${file}`, import.meta.url),
        'utf8'
    )))).join('\n');
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|Authorization|Bearer/);
    assert.doesNotMatch(
        source,
        /console\.|document\.|localStorage|deleteDatabase|objectStore\([^)]*\)\.clear\s*\(/
    );
    assert.doesNotMatch(source, /strava\.com|activities\.csv|application\/gpx|\.fit\b|\.tcx\b/i);
});

test('PR-07 keeps the deterministic fixture and literal 34-path allowlist', async () => {
    const fixture = await readFile(new URL(
        '../fixtures/synthetic/canonical/import-run-summary.json',
        import.meta.url
    ));
    assert.equal(
        createHash('sha256').update(fixture).digest('hex'),
        'bb9a189dfc89b4948a7fe0a7e43a4c7ea655de34190a822cd08e2eca4d183058'
    );
    const brief = await readFile(new URL(
        '../../docs/tasks/pr-07-import-core.md',
        import.meta.url
    ), 'utf8');
    const allowed = [
        'docs/tasks/pr-07-import-core.md',
        'js/import/AGENTS.md',
        'js/import/activities-preview.js',
        'js/import/decoder-registry.js',
        'js/import/errors.js',
        'js/import/import-service.js',
        'js/import/index.js',
        'js/import/normalizer.js',
        'js/import/safe-data.js',
        'js/import/state-machine.js',
        'js/import/synthetic-import-worker.js',
        'js/import/synthetic-json-decoder.js',
        'js/import/worker-client.js',
        'js/storage/canonical-store.js',
        'js/storage/constants.js',
        'js/storage/database.js',
        'js/storage/import-store.js',
        'js/storage/index.js',
        'js/storage/migrations.js',
        'js/storage/schema.js',
        'tests/fixtures/synthetic/canonical/README.md',
        'tests/fixtures/synthetic/canonical/import-run-summary.json',
        'tests/import/import-boundaries.test.js',
        'tests/import/import-browser-smoke.html',
        'tests/import/import-core.test.js',
        'tests/import/import-state-machine.test.js',
        'tests/import/import-worker.test.js',
        'tests/shadow/shadow-boundaries.test.js',
        'tests/storage/backup-manifest.test.js',
        'tests/storage/canonical-store.test.js',
        'tests/storage/indexeddb-v2-boundaries.test.js',
        'tests/storage/indexeddb-v2-browser-smoke.html',
        'tests/storage/indexeddb-v2-schema.test.js',
        'tests/storage/indexeddb-v2-transactions.test.js'
    ];
    assert.equal(new Set(allowed).size, 34);
    for (const relative of allowed) assert.equal(brief.includes(relative), true);
    assert.match(brief, /cumulative maximum[^\n]*34 paths/i);
    assert.match(brief, /35th path requires a necessity record/i);
});
