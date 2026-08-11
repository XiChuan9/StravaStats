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
import { ACTIVITIES_CSV_MEDIA_TYPE } from '../../js/import/activities-csv-decoder.js';
import { frameActivitiesCsv } from '../../js/import/csv-tokenizer.js';
import {
    STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
    expandStravaZipArtifact
} from '../../js/import/strava-zip.js';
import { syntheticStravaZipArtifact } from '../fixtures/synthetic/strava/archive-fixture.js';
import {
    STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
    createStravaProviderArtifacts
} from '../../js/import/strava-provider-artifact.js';
import { createStravaImportMapper } from '../../js/connectors/strava/strava-import-mapper.js';
import {
    SYNTHETIC_ACQUIRED_AT,
    SYNTHETIC_CONNECTION,
    SYNTHETIC_RICH_ACTIVITY,
    SYNTHETIC_SESSION
} from '../fixtures/synthetic/strava/api-import-fixture.js';

const fixtureUrl = new URL(
    '../fixtures/synthetic/canonical/import-run-summary.json',
    import.meta.url
);
const csvFixtureUrl = new URL(
    '../fixtures/synthetic/strava/activities.csv',
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

test('Worker decode result stays separate from the observable normalizing stage', async () => {
    const worker = createInlineImportWorker();
    const result = await worker.process({
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content: await readFile(fixtureUrl, 'utf8'),
        rawArtifactId: 'raw:synthetic-stage-seam'
    });
    assert.equal(result.ok, true);
    assert.ok(result.decoded);
    assert.equal(Object.hasOwn(result, 'bundle'), false);
    assert.equal(Object.isFrozen(result.decoded), true);
    worker.close();
});

test('inline Worker selects activities.csv through the registered media type', async () => {
    const worker = createInlineImportWorker();
    const [content] = frameActivitiesCsv(await readFile(csvFixtureUrl, 'utf8'));
    const result = await worker.process({
        mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
        content,
        rawArtifactId: 'raw:synthetic-csv'
    });
    assert.equal(result.ok, true);
    assert.equal(result.decoded.activity.id, 'strava-archive:00042');
    assert.equal(Object.isFrozen(result.decoded), true);
    worker.close();
});

test('inline Worker selects only archive-generated row children and reuses CSV decoding', async () => {
    const worker = createInlineImportWorker();
    const [artifact] = await expandStravaZipArtifact(
        syntheticStravaZipArtifact({ method: 8 }).content
    );
    assert.equal(artifact.mediaType, STRAVA_ARCHIVE_ROW_MEDIA_TYPE);
    const result = await worker.process({
        ...artifact,
        rawArtifactId: 'raw:synthetic-archive-row'
    });
    assert.equal(result.ok, true);
    assert.equal(result.decoded.activity.id, 'strava-archive:00042');
    assert.ok(result.decoded.warnings.some(warning => (
        warning.code === 'ZIP_ACTIVITY_FILE_UNSUPPORTED'
    )));
    assert.equal(result.decoded.streams.series.length, 0);
    worker.close();
});

test('inline Worker registers only canonical C3b provider artifact bytes', async () => {
    const mapper = createStravaImportMapper({
        session: structuredClone(SYNTHETIC_SESSION),
        connection: structuredClone(SYNTHETIC_CONNECTION)
    });
    const bundles = mapper.mapActivities({
        cancelled: false,
        acquiredAt: SYNTHETIC_ACQUIRED_AT,
        activities: [structuredClone(SYNTHETIC_RICH_ACTIVITY)]
    });
    const [descriptor] = createStravaProviderArtifacts({
        connection: structuredClone(SYNTHETIC_CONNECTION),
        bundles
    });
    const worker = createInlineImportWorker();
    try {
        const result = await worker.process({
            ...descriptor,
            rawArtifactId: 'raw:synthetic-provider'
        });
        assert.equal(result.ok, true);
        assert.equal(result.decoded.activity.id, 'strava-api:910000000000000001');
        assert.equal(Object.is(result.decoded.activity.elevationGainMeters, -0), true);
        const malformed = await worker.process({
            mediaType: STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
            content: ` ${descriptor.content}`,
            rawArtifactId: 'raw:private-canary'
        });
        assert.deepEqual(malformed, {
            ok: false,
            code: IMPORT_ERROR_CODE.FILE_CORRUPTED,
            retryable: false
        });
        assert.doesNotMatch(JSON.stringify(malformed), /private-canary|910000000000000001/);
    } finally {
        worker.close();
    }
});

test('browser worker client maps raw error events to one stable crash', async () => {
    let terminations = 0;
    const fake = {
        postMessage() {
            queueMicrotask(() => this.onerror({ message: 'secret raw cause' }));
        },
        terminate() { terminations += 1; }
    };
    const worker = createBrowserImportWorker(fake);
    await assert.rejects(
        worker.process({ content: 'secret payload' }),
        error => error.code === IMPORT_ERROR_CODE.WORKER_CRASHED
            && !JSON.stringify(error).includes('secret')
    );
    worker.close();
    assert.equal(terminations, 1);
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
