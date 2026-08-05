import assert from 'node:assert/strict';
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
