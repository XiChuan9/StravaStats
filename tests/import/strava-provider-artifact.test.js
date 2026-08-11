import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    IMPORT_ERROR_CODE,
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import {
    STRAVA_PROVIDER_ARTIFACT_ERROR_CODE,
    STRAVA_PROVIDER_ARTIFACT_LIMITS,
    STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
    StravaProviderArtifactError,
    createStravaProviderArtifacts,
    stravaProviderArtifactDecoder
} from '../../js/import/strava-provider-artifact.js';
import { createStravaImportMapper } from '../../js/connectors/strava/strava-import-mapper.js';
import { createImportStore } from '../../js/storage/index.js';
import {
    SYNTHETIC_ACQUIRED_AT,
    SYNTHETIC_CONNECTION,
    SYNTHETIC_RICH_ACTIVITY,
    SYNTHETIC_SESSION,
    syntheticActivities
} from '../fixtures/synthetic/strava/api-import-fixture.js';

const MODULE_URL = new URL(
    '../../js/import/strava-provider-artifact.js',
    import.meta.url
);

test('C3b direct module exists with the exact frozen internal surface', async () => {
    const module = await import(`${MODULE_URL.href}?failure-first=${Date.now()}`);
    assert.deepEqual(Object.keys(module).sort(), [
        'STRAVA_PROVIDER_ARTIFACT_ERROR_CODE',
        'STRAVA_PROVIDER_ARTIFACT_LIMITS',
        'STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE',
        'StravaProviderArtifactError',
        'createStravaProviderArtifacts',
        'stravaProviderArtifactDecoder'
    ]);
    assert.deepEqual(STRAVA_PROVIDER_ARTIFACT_LIMITS, {
        maxArtifactsPerJob: 100,
        maxBytesPerArtifact: 33_554_432,
        maxBytesPerJob: 33_554_432,
        maxTraversalDepth: 16,
        maxTraversalNodes: 5_000_000,
        maxSourcesPerBundle: 1,
        maxDevicesPerBundle: 0,
        maxEventsPerBundle: 0,
        maxStreamSeriesPerBundle: 10,
        maxPointsPerSeries: 200_000,
        maxLapsPerBundle: 10_000
    });
    assert.equal(Object.isFrozen(STRAVA_PROVIDER_ARTIFACT_LIMITS), true);
});

function clone(value) {
    return structuredClone(value);
}

function mapped(activities = [SYNTHETIC_RICH_ACTIVITY], acquiredAt = SYNTHETIC_ACQUIRED_AT) {
    return createStravaImportMapper({
        session: clone(SYNTHETIC_SESSION),
        connection: clone(SYNTHETIC_CONNECTION)
    }).mapActivities({
        cancelled: false,
        acquiredAt,
        activities: clone(activities)
    });
}

function artifacts(bundles = mapped(), connection = SYNTHETIC_CONNECTION) {
    return createStravaProviderArtifacts({
        connection: clone(connection),
        bundles
    });
}

function expectBuilderCode(invoke, code, ordinal = null) {
    assert.throws(invoke, error => {
        assert.equal(error instanceof StravaProviderArtifactError, true);
        assert.equal(error.code, code);
        assert.equal(error.ordinal, ordinal);
        assert.equal(error.stage, 'artifact');
        assert.equal(error.retryable, false);
        assert.equal(Object.isFrozen(error), true);
        assert.deepEqual(error.toJSON(), {
            name: 'StravaProviderArtifactError',
            code,
            message: error.message,
            stage: 'artifact',
            ordinal,
            retryable: false
        });
        return true;
    });
}

test('canonical version-1 bytes round-trip missing, null, zero, negative zero, and opaque IDs', () => {
    const before = clone(mapped());
    const [descriptor] = artifacts(mapped());
    assert.equal(descriptor.mediaType, STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE);
    assert.equal(descriptor.content.startsWith('{"bundle":'), true);
    assert.match(descriptor.content, /"format":"stravastats-provider-artifact"/);
    assert.match(descriptor.content, /"formatVersion":1/);
    assert.match(descriptor.content, /"sourceConnectionId":"source-connection:strava"/);
    assert.match(descriptor.content, /"elevationGainMeters":-0/);
    assert.equal(Object.isFrozen(descriptor), true);

    const decoded = stravaProviderArtifactDecoder.decode(descriptor);
    assert.equal(decoded.activity.id, 'strava-api:910000000000000001');
    assert.equal(Object.hasOwn(decoded.activity, 'name'), false);
    assert.equal(decoded.activity.averageHeartRateBpm, null);
    assert.equal(decoded.activity.distanceMeters, 0);
    assert.equal(Object.is(decoded.activity.elevationGainMeters, -0), true);
    assert.equal(Object.is(decoded.streams.series[0].values[0], 0), true);
    assert.deepEqual(mapped(), before);
    assert.equal(Object.isFrozen(decoded), true);
    assert.equal(Object.isFrozen(decoded.streams.series[0].values), true);
    assert.equal(artifacts(mapped())[0].content, descriptor.content);
});

test('builder requires the exact connected C2 snapshot and exact C3a provenance profile', () => {
    for (const connection of [
        { ...SYNTHETIC_CONNECTION, status: 'reconnect_required', errorCode: 'AUTHORIZATION_REQUIRED' },
        { ...SYNTHETIC_CONNECTION, status: 'error', errorCode: 'CONNECTION_ERROR' },
        { ...SYNTHETIC_CONNECTION, status: 'disconnected' }
    ]) {
        expectBuilderCode(
            () => artifacts(mapped(), connection),
            STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.CONNECTION_REQUIRED
        );
    }
    expectBuilderCode(
        () => artifacts(mapped(), { ...SYNTHETIC_CONNECTION, id: 'other' }),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH
    );
    expectBuilderCode(
        () => artifacts(mapped(), { ...SYNTHETIC_CONNECTION, subjectId: '0' }),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST
    );
    const wrongSource = clone(mapped());
    wrongSource[0].sources[0].externalId = '0001';
    expectBuilderCode(
        () => artifacts(wrongSource),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH,
        0
    );
    const wrongNormalizer = clone(mapped());
    wrongNormalizer[0].versionMetadata.normalizerVersion = 'other@1';
    expectBuilderCode(
        () => artifacts(wrongNormalizer),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID,
        0
    );
});

test('builder enforces zero, 100, 101, traversal depth, sparse, cycle, and hostile bounds', () => {
    expectBuilderCode(
        () => artifacts([]),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST
    );
    assert.equal(artifacts(mapped(syntheticActivities(100))).length, 100);
    expectBuilderCode(
        () => artifacts(Array.from({ length: 101 }, () => mapped()[0])),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED
    );

    const deep = clone(mapped());
    let cursor = deep[0];
    for (let index = 0; index < 16; index += 1) {
        cursor.syntheticDepth = {};
        cursor = cursor.syntheticDepth;
    }
    expectBuilderCode(
        () => artifacts(deep),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED,
        0
    );

    const sparse = mapped();
    const sparseBundles = [sparse[0], sparse[0]];
    delete sparseBundles[1];
    expectBuilderCode(
        () => artifacts(sparseBundles),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST
    );
    const cyclic = clone(mapped());
    cyclic[0].cycle = cyclic[0];
    expectBuilderCode(
        () => artifacts(cyclic),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID,
        0
    );
    let getters = 0;
    const hostile = clone(mapped());
    Object.defineProperty(hostile[0], 'syntheticAccessor', {
        enumerable: true,
        get() { getters += 1; return 'private-canary'; }
    });
    expectBuilderCode(
        () => artifacts(hostile),
        STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID,
        0
    );
    assert.equal(getters, 0);
});

test('decoder rejects wrong media, empty, malformed, noncanonical, duplicate-key, and future bytes', () => {
    const [descriptor] = artifacts();
    for (const [input, code] of [
        [{ ...descriptor, mediaType: 'application/json' }, IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT],
        [{ ...descriptor, content: '' }, IMPORT_ERROR_CODE.FILE_EMPTY],
        [{ ...descriptor, content: '{private-canary' }, IMPORT_ERROR_CODE.FILE_CORRUPTED],
        [{ ...descriptor, content: ` ${descriptor.content}` }, IMPORT_ERROR_CODE.FILE_CORRUPTED],
        [{
            ...descriptor,
            content: descriptor.content.replace('"formatVersion":1', '"formatVersion":2')
        }, IMPORT_ERROR_CODE.FILE_CORRUPTED],
        [{
            ...descriptor,
            content: `{"format":"duplicate",${descriptor.content.slice(1)}`
        }, IMPORT_ERROR_CODE.FILE_CORRUPTED]
    ]) {
        assert.throws(
            () => stravaProviderArtifactDecoder.decode(input),
            error => error.code === code
                && error.retryable === false
                && !JSON.stringify(error).includes('private-canary')
        );
    }
    assert.throws(
        () => stravaProviderArtifactDecoder.decode({
            ...descriptor,
            content: 'x'.repeat(STRAVA_PROVIDER_ARTIFACT_LIMITS.maxBytesPerArtifact + 1)
        }),
        error => error.code === IMPORT_ERROR_CODE.FILE_CORRUPTED
    );
});

function ids() {
    let sequence = 0;
    return kind => `provider-${kind}-${++sequence}`;
}

function importCore(indexedDB, overrides = {}) {
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => Date.parse(SYNTHETIC_ACQUIRED_AT),
        applicationVersion: 'provider-artifact-test@1'
    });
    const core = createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids(),
        ...overrides
    });
    return { importStore, core };
}

test('provider artifacts use ImportService, truthful raw provenance, exact duplicate and exact-link paths', async () => {
    const indexedDB = new IDBFactory();
    const { importStore, core } = importCore(indexedDB);
    await core.initialize();
    const firstDescriptor = artifacts()[0];
    const first = await core.importArtifacts([firstDescriptor]);
    const firstReport = await core.waitForJob(first.jobId);
    assert.equal(firstReport.totals.completed, 1);
    const [firstItem] = await importStore.listImportItems(first.jobId);
    const raw = await importStore.getRawArtifact(firstItem.artifactId);
    assert.equal(raw.mediaType, STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE);
    assert.equal(raw.acquiredVia, 'provider-artifact');
    assert.equal(raw.state, 'committed');

    const duplicate = await core.importArtifacts([firstDescriptor]);
    assert.equal(
        (await core.waitForJob(duplicate.jobId)).totals.skippedExactDuplicate,
        1
    );
    const changed = artifacts(mapped(
        [SYNTHETIC_RICH_ACTIVITY],
        '2026-08-10T12:00:00.001Z'
    ))[0];
    const linked = await core.importArtifacts([changed]);
    const linkedReport = await core.waitForJob(linked.jobId);
    assert.equal(linkedReport.totals.completed, 1);
    assert.equal(linkedReport.totals.failed, 0);
    assert.equal((await core.previewActivities()).total, 1);
    assert.doesNotMatch(
        JSON.stringify(linkedReport),
        /910000000000000001|source-connection|provider-artifact/
    );
    await core.close();
});

test('provider exact source and external signals conflict atomically without a third activity', async () => {
    const { core } = importCore(new IDBFactory());
    await core.initialize();
    const incoming = mapped(syntheticActivities(1))[0];
    const externalId = incoming.sources[0].externalId;
    const sourceId = incoming.sources[0].id;
    const left = clone(incoming);
    left.activity.id = 'synthetic-conflict-left';
    left.streams.activityId = left.activity.id;
    left.sources[0].activityId = left.activity.id;
    left.sources[0].externalId = '111111';
    const right = clone(incoming);
    right.activity.id = 'synthetic-conflict-right';
    right.streams.activityId = right.activity.id;
    right.sources[0].activityId = right.activity.id;
    right.sources[0].id = 'synthetic-other-source';
    assert.equal(left.sources[0].id, sourceId);
    assert.equal(right.sources[0].externalId, externalId);
    for (const bundle of [left, right]) {
        const run = await core.importArtifacts([{
            mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
            content: JSON.stringify(bundle)
        }]);
        assert.equal((await core.waitForJob(run.jobId)).totals.completed, 1);
    }
    const run = await core.importArtifacts(artifacts([incoming]));
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.totals.failed, 1);
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.EXACT_IDENTITY_CONFLICT);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('provider preflight is atomic for mixed, malformed, count, and total-byte failures', async () => {
    const { importStore, core } = importCore(new IDBFactory());
    await core.initialize();
    const descriptor = artifacts()[0];
    for (const input of [
        [descriptor, { mediaType: 'application/vnd.stravastats.synthetic+json', content: '{}' }],
        [{ ...descriptor, content: ` ${descriptor.content}` }],
        Array.from({ length: 101 }, () => descriptor)
    ]) {
        await assert.rejects(core.importArtifacts(input));
        assert.deepEqual(await importStore.listImportJobs(), []);
    }
    const maximum = STRAVA_PROVIDER_ARTIFACT_LIMITS.maxBytesPerJob;
    await assert.rejects(
        core.importArtifacts([{
            ...descriptor,
            content: ' '.repeat(maximum)
        }]),
        error => error.code === IMPORT_ERROR_CODE.FILE_CORRUPTED
    );
    await assert.rejects(
        core.importArtifacts([{
            ...descriptor,
            content: ' '.repeat(maximum + 1)
        }]),
        error => error.code === IMPORT_ERROR_CODE.INVALID_REQUEST
    );
    await assert.rejects(
        core.importArtifacts([
            { ...descriptor, content: ' '.repeat(maximum / 2) },
            { ...descriptor, content: ' '.repeat(maximum / 2 + 1) }
        ]),
        error => error.code === IMPORT_ERROR_CODE.INVALID_REQUEST
    );
    assert.deepEqual(await importStore.listImportJobs(), []);
    await core.close();
});

test('100 provider bundles preserve artifact, item, and public report ordinal order', async () => {
    const { importStore, core } = importCore(new IDBFactory());
    await core.initialize();
    const descriptors = artifacts(mapped(syntheticActivities(100)));
    const run = await core.importArtifacts(descriptors);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.totals.total, 100);
    assert.equal(report.totals.completed, 100);
    assert.deepEqual(report.items.map(item => item.ordinal), Array.from({ length: 100 }, (_, i) => i));
    assert.deepEqual(
        (await importStore.listImportItems(run.jobId)).map(item => item.ordinal),
        Array.from({ length: 100 }, (_, i) => i)
    );
    assert.equal((await core.previewActivities()).total, 100);
    await core.close();
});

test('provider Worker failure retries exact retained bytes with redacted reporting', async () => {
    const inline = createInlineImportWorker();
    let calls = 0;
    const worker = {
        async process(input) {
            calls += 1;
            if (calls === 1) throw new Error(`private ${input.content}`);
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const { core } = importCore(new IDBFactory(), { worker });
    await core.initialize();
    const run = await core.importArtifacts(artifacts());
    let report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'failed_decode');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.WORKER_CRASHED);
    assert.equal(report.items[0].retryable, true);
    assert.doesNotMatch(JSON.stringify(report), /private|910000000000000001/);
    await core.retryJob(run.jobId);
    report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('provider cancellation retains raw bytes and commits no Canonical activity', async () => {
    let releaseDigest;
    const digestGate = new Promise(resolve => { releaseDigest = resolve; });
    const crypto = { subtle: { digest: async () => digestGate } };
    const { importStore, core } = importCore(new IDBFactory(), { crypto });
    await core.initialize();
    const run = await core.importArtifacts(artifacts());
    while ((await importStore.getImportJob(run.jobId)).status !== 'hashing') {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepEqual(await core.cancelJob(run.jobId), {
        status: 'cancellation-requested'
    });
    releaseDigest(new Uint8Array(32).buffer);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'cancelled');
    assert.equal(report.totals.cancelled, 1);
    const [item] = await importStore.listImportItems(run.jobId);
    assert.equal(
        (await importStore.getRawArtifact(item.artifactId)).acquiredVia,
        'provider-artifact'
    );
    assert.equal((await core.previewActivities()).total, 0);
    await core.close();
});

test('provider per-item quota failure preserves the earlier committed item atomically', async () => {
    const indexedDB = new IDBFactory();
    const real = importCore(indexedDB);
    let calls = 0;
    const wrappedStore = {
        ...real.importStore,
        async persistImportItem(...args) {
            calls += 1;
            if (calls === 2) throw Object.freeze({ code: 'QUOTA_EXCEEDED' });
            return real.importStore.persistImportItem(...args);
        }
    };
    const core = createImportService({
        importStore: wrappedStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids()
    });
    await core.initialize();
    const run = await core.importArtifacts(artifacts(mapped(syntheticActivities(2))));
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'failed_storage');
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.failed, 1);
    assert.equal(report.items[1].errorCode, IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});
