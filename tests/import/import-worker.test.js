import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    IMPORT_ERROR_CODE,
    SYNTHETIC_JSON_MEDIA_TYPE,
    createBrowserImportWorker,
    createDecoderRegistry,
    createInlineImportWorker,
    normalizeImportedActivity,
    syntheticJsonDecoder
} from '../../js/import/index.js';

const fixtureUrl = new URL(
    '../fixtures/synthetic/canonical/import-run-summary.json',
    import.meta.url
);

test('synthetic decoder and normalizer detach, freeze, and validate input', async () => {
    const content = await readFile(fixtureUrl, 'utf8');
    const decoded = syntheticJsonDecoder.decode({
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content
    });
    const before = JSON.stringify(decoded);
    const normalized = normalizeImportedActivity({
        decoded,
        rawArtifactId: 'raw:synthetic-hash'
    });
    assert.equal(JSON.stringify(decoded), before);
    assert.equal(normalized.sources[0].rawArtifactId, 'raw:synthetic-hash');
    assert.equal(Object.isFrozen(normalized), true);
    assert.notEqual(normalized, decoded);
});

test('decoder registry accepts only exact registered media types', () => {
    const registry = createDecoderRegistry([syntheticJsonDecoder]);
    assert.equal(registry.select(SYNTHETIC_JSON_MEDIA_TYPE).id, 'synthetic-json');
    assert.throws(
        () => registry.select('application/gpx+xml'),
        error => error.code === IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
});

test('inline worker redacts malformed input and closes terminally', async () => {
    const worker = createInlineImportWorker();
    const result = await worker.process({
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content: '{private-payload',
        rawArtifactId: 'raw:synthetic'
    });
    assert.deepEqual(result, {
        ok: false,
        code: IMPORT_ERROR_CODE.FILE_CORRUPTED,
        retryable: false
    });
    assert.doesNotMatch(JSON.stringify(result), /private-payload|raw:synthetic/);
    worker.close();
    await assert.rejects(
        worker.process({}),
        error => error.code === IMPORT_ERROR_CODE.WORKER_CRASHED
            && error.retryable === true
    );
});

test('browser worker client maps raw error events to one stable crash', async () => {
    const fake = {
        postMessage() {
            queueMicrotask(() => this.onerror({ message: 'secret raw cause' }));
        },
        terminate() {}
    };
    const worker = createBrowserImportWorker(fake);
    await assert.rejects(
        worker.process({ content: 'secret payload' }),
        error => error.code === IMPORT_ERROR_CODE.WORKER_CRASHED
            && !JSON.stringify(error).includes('secret')
    );
    worker.close();
});

test('accessors and hostile decoder registry input fail without execution', () => {
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'mediaType', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return SYNTHETIC_JSON_MEDIA_TYPE;
        }
    });
    Object.defineProperty(hostile, 'content', {
        enumerable: true,
        value: '{}'
    });
    assert.throws(
        () => syntheticJsonDecoder.decode(hostile),
        error => error.code === IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
    assert.equal(getterCalls, 0);
});
