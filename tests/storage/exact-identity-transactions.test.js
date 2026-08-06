import assert from 'node:assert/strict';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { createCanonicalStore, createImportStore } from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-05T01:02:03.004Z');

function createStores(indexedDB) {
    return {
        imports: createImportStore({
            indexedDB,
            IDBKeyRange,
            now: () => FIXED_TIME,
            applicationVersion: 'exact-identity-transactions@1'
        }),
        canonical: createCanonicalStore({
            indexedDB,
            IDBKeyRange,
            now: () => FIXED_TIME,
            applicationVersion: 'exact-identity-transactions@1'
        })
    };
}

function artifact(sequence) {
    const sha256 = sequence.toString(16).padStart(64, '0');
    const content = `synthetic-artifact-${sequence}`;
    return {
        id: `raw:${sha256}`,
        sha256,
        mediaType: 'application/vnd.stravastats.synthetic+json',
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    };
}

function bundle({
    activityId,
    sourceId,
    rawArtifactId,
    provider,
    externalId = null,
    name = 'Synthetic Exact Identity Activity',
    distanceMeters = 5000,
    device = null
}) {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id: activityId,
            sportCategory: 'run',
            sportVariant: 'road',
            startTimeUtc: '2026-01-15T06:30:00.000Z',
            timeZone: {
                ianaName: 'Etc/UTC',
                utcOffsetMinutes: 0
            },
            capabilities: {
                hasGps: false,
                hasHeartRate: false,
                hasPower: false,
                hasCadence: false,
                hasLaps: false
            },
            name,
            distanceMeters,
            movingTimeSeconds: 1500,
            elapsedTimeSeconds: 1530,
            elevationGainMeters: 0
        },
        streams: { activityId, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: sourceId,
            activityId,
            provider,
            externalId,
            rawArtifactId,
            acquisitionMethod: 'local-file',
            deviceId: device?.id ?? null,
            importedAt: '2026-01-15T07:00:00.000Z'
        }],
        devices: device ? [device] : [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'synthetic-json@1',
            normalizerVersion: 'import-normalizer@1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: rawArtifactId.slice('raw:'.length)
        }
    };
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => {};
    });
}

async function mutateDatabase(indexedDB, storeNames, callback) {
    const database = await requestResult(indexedDB.open('strava-stats-v2'));
    try {
        const transaction = database.transaction(storeNames, 'readwrite');
        callback(transaction);
        await transactionDone(transaction);
    } finally {
        database.close();
    }
}

async function preparePersisting(imports, sequence, rawOverride = null) {
    const jobId = `job-${sequence}`;
    const itemId = `item-${sequence}`;
    const raw = rawOverride ?? artifact(sequence);
    await imports.createImportJob(jobId, [itemId]);
    for (const [current, next] of [
        ['queued', 'validating'],
        ['validating', 'hashing']
    ]) {
        await imports.transitionImportJob(jobId, current, next);
        await imports.transitionImportItem(itemId, current, next);
    }
    await imports.storeRawArtifact(itemId, raw);
    for (const [current, next] of [
        ['hashing', 'decoding'],
        ['decoding', 'normalizing'],
        ['normalizing', 'matching'],
        ['matching', 'persisting']
    ]) {
        await imports.transitionImportJob(jobId, current, next);
        await imports.transitionImportItem(itemId, current, next);
    }
    return { jobId, itemId, raw };
}

async function persist(imports, sequence, options) {
    const prepared = await preparePersisting(imports, sequence);
    const input = bundle({
        ...options,
        rawArtifactId: prepared.raw.id
    });
    const result = await imports.persistImportItem(prepared.itemId, input);
    return { ...prepared, input, result };
}

test('same provider and external ID links a new raw artifact without replacing canonical payload', async () => {
    const indexedDB = new IDBFactory();
    const { imports, canonical } = createStores(indexedDB);
    await imports.initialize();
    const first = await persist(imports, 1, {
        activityId: 'activity-original',
        sourceId: 'source-original',
        provider: 'strava',
        externalId: '0',
        name: 'Original Synthetic Payload',
        distanceMeters: 5000
    });
    const second = await persist(imports, 2, {
        activityId: 'activity-incoming',
        sourceId: 'source-incoming',
        provider: 'strava',
        externalId: '0',
        name: 'Incoming Synthetic Payload',
        distanceMeters: 5000.01
    });

    assert.equal(first.result.status, 'completed');
    assert.equal(second.result.status, 'completed');
    assert.equal((await imports.getRawArtifact(second.raw.id)).activityId, 'activity-original');
    assert.equal((await imports.getImportItem(second.itemId)).activityId, 'activity-original');
    await canonical.initialize();
    const stored = await canonical.getBundle('activity-original');
    assert.equal(stored.activity.name, 'Original Synthetic Payload');
    assert.equal(stored.activity.distanceMeters, 5000);
    assert.deepEqual(
        stored.sources.map(source => source.id).sort(),
        ['source-incoming', 'source-original']
    );
    assert.equal(await canonical.getBundle('activity-incoming'), null);
    assert.equal((await canonical.listActivities()).length, 1);
    await canonical.close();
    await imports.close();
});

test('trusted FIT session identity links across different raw hashes when externalId is null', async () => {
    const indexedDB = new IDBFactory();
    const { imports, canonical } = createStores(indexedDB);
    await imports.initialize();
    const activityId = 'fit-session:1:2:3:4:5';
    await persist(imports, 3, {
        activityId,
        sourceId: 'fit-source-original',
        provider: 'fit',
        externalId: null
    });
    const replay = await persist(imports, 4, {
        activityId,
        sourceId: 'fit-source-second-file',
        provider: 'fit',
        externalId: null,
        name: 'Different Decode Must Not Replace Canonical'
    });

    assert.equal((await imports.getRawArtifact(replay.raw.id)).activityId, activityId);
    await canonical.initialize();
    const stored = await canonical.getBundle(activityId);
    assert.equal(stored.activity.name, 'Synthetic Exact Identity Activity');
    assert.deepEqual(
        stored.sources.map(source => source.id).sort(),
        ['fit-source-original', 'fit-source-second-file']
    );
    await canonical.close();
    await imports.close();
});

test('two exact signals resolving to different activities fail closed without partial writes', async () => {
    const indexedDB = new IDBFactory();
    const { imports, canonical } = createStores(indexedDB);
    await imports.initialize();
    await persist(imports, 5, {
        activityId: 'activity-left',
        sourceId: 'source-left',
        provider: 'strava',
        externalId: 'external-left'
    });
    await persist(imports, 6, {
        activityId: 'activity-right',
        sourceId: 'source-right',
        provider: 'garmin',
        externalId: 'external-right'
    });
    const incoming = await preparePersisting(imports, 7);
    const conflicting = bundle({
        activityId: 'activity-incoming-conflict',
        sourceId: 'source-right',
        rawArtifactId: incoming.raw.id,
        provider: 'strava',
        externalId: 'external-left'
    });

    await assert.rejects(
        imports.persistImportItem(incoming.itemId, conflicting),
        error => error.code === 'CONFLICT'
            && !JSON.stringify(error).includes('external-left')
    );
    assert.equal((await imports.getRawArtifact(incoming.raw.id)).state, 'pending');
    assert.equal((await imports.getImportItem(incoming.itemId)).status, 'persisting');
    await canonical.initialize();
    assert.equal((await canonical.listActivities()).length, 2);
    assert.equal(await canonical.getBundle('activity-incoming-conflict'), null);
    await canonical.close();
    await imports.close();
});

test('late link failure aborts the new source, raw association, item, and job updates together', async () => {
    const indexedDB = new IDBFactory();
    const { imports, canonical } = createStores(indexedDB);
    await imports.initialize();
    await persist(imports, 8, {
        activityId: 'activity-target',
        sourceId: 'source-target',
        provider: 'strava',
        externalId: 'external-target'
    });
    await persist(imports, 9, {
        activityId: 'activity-device-owner',
        sourceId: 'source-device-owner',
        provider: 'garmin',
        externalId: 'external-device-owner',
        device: { id: 'device-shared', manufacturer: 'Alpha', model: 'One' }
    });
    const incoming = await preparePersisting(imports, 10);
    const lateConflict = bundle({
        activityId: 'activity-never-written',
        sourceId: 'source-must-rollback',
        rawArtifactId: incoming.raw.id,
        provider: 'strava',
        externalId: 'external-target',
        device: { id: 'device-shared', manufacturer: 'Beta', model: 'Two' }
    });

    await assert.rejects(
        imports.persistImportItem(incoming.itemId, lateConflict),
        error => error.code === 'CONFLICT'
    );
    assert.equal((await imports.getRawArtifact(incoming.raw.id)).state, 'pending');
    assert.equal((await imports.getImportItem(incoming.itemId)).status, 'persisting');
    await canonical.initialize();
    assert.equal((await canonical.listActivities()).length, 2);
    assert.equal(await canonical.getBundle('activity-never-written'), null);
    assert.deepEqual(
        (await canonical.getBundle('activity-target')).sources.map(source => source.id),
        ['source-target']
    );
    await canonical.close();
    await imports.close();
});

test('committed raw identity conflicts with another exact activity signal and does not pick one', async () => {
    const indexedDB = new IDBFactory();
    const { imports, canonical } = createStores(indexedDB);
    await imports.initialize();
    const left = await persist(imports, 11, {
        activityId: 'activity-raw-left',
        sourceId: 'source-raw-left',
        provider: 'strava',
        externalId: 'external-raw-left'
    });
    await persist(imports, 12, {
        activityId: 'activity-signal-right',
        sourceId: 'source-signal-right',
        provider: 'garmin',
        externalId: 'external-signal-right'
    });
    const replay = await preparePersisting(imports, 13, left.raw);
    const conflicting = bundle({
        activityId: 'activity-incoming-replay',
        sourceId: 'source-signal-right',
        rawArtifactId: replay.raw.id,
        provider: 'garmin',
        externalId: 'external-signal-right'
    });

    await assert.rejects(
        imports.persistImportItem(replay.itemId, conflicting),
        error => error.code === 'CONFLICT'
    );
    assert.equal((await imports.getRawArtifact(left.raw.id)).activityId, 'activity-raw-left');
    assert.equal((await imports.getImportItem(replay.itemId)).status, 'persisting');
    await canonical.initialize();
    assert.equal((await canonical.listActivities()).length, 2);
    await canonical.close();
    await imports.close();
});

test('committed raw replay fails closed when its canonical target is missing', async () => {
    const indexedDB = new IDBFactory();
    const { imports } = createStores(indexedDB);
    await imports.initialize();
    const first = await persist(imports, 14, {
        activityId: 'activity-corrupt-target',
        sourceId: 'source-corrupt-target',
        provider: 'strava',
        externalId: 'external-corrupt-target'
    });
    await mutateDatabase(indexedDB, ['activities'], transaction => {
        transaction.objectStore('activities').delete('activity-corrupt-target');
    });
    const replay = await preparePersisting(imports, 15, first.raw);
    const input = bundle({
        activityId: 'activity-corrupt-target',
        sourceId: 'source-corrupt-target',
        rawArtifactId: replay.raw.id,
        provider: 'strava',
        externalId: 'external-corrupt-target'
    });

    await assert.rejects(
        imports.persistImportItem(replay.itemId, input),
        error => error.code === 'SCHEMA_MISMATCH'
    );
    assert.equal((await imports.getImportItem(replay.itemId)).status, 'persisting');
    await imports.close();
});

test('generated source ID colliding with another incoming source fails as exact conflict', async () => {
    const indexedDB = new IDBFactory();
    const { imports } = createStores(indexedDB);
    await imports.initialize();
    await persist(imports, 16, {
        activityId: 'activity-source-collision-target',
        sourceId: 'source-source-collision-target',
        provider: 'strava',
        externalId: 'external-source-collision-target'
    });
    const incoming = await preparePersisting(imports, 17);
    const input = bundle({
        activityId: 'activity-source-collision-incoming',
        sourceId: 'source-source-collision-target',
        rawArtifactId: incoming.raw.id,
        provider: 'strava',
        externalId: 'external-source-collision-target'
    });
    input.sources.push({
        ...input.sources[0],
        id: `exact-source:${incoming.raw.id}:0`,
        provider: 'synthetic-provider',
        externalId: null
    });

    await assert.rejects(
        imports.persistImportItem(incoming.itemId, input),
        error => error.code === 'CONFLICT'
    );
    assert.equal((await imports.getRawArtifact(incoming.raw.id)).state, 'pending');
    assert.equal((await imports.getImportItem(incoming.itemId)).status, 'persisting');
    await imports.close();
});

test('idempotent existing source still validates a referenced device primary key', async () => {
    const indexedDB = new IDBFactory();
    const { imports } = createStores(indexedDB);
    await imports.initialize();
    await persist(imports, 18, {
        activityId: 'activity-device-validation-target',
        sourceId: 'source-device-validation-target',
        provider: 'strava',
        externalId: 'external-device-validation-target'
    });
    const incoming = await preparePersisting(imports, 19);
    const input = bundle({
        activityId: 'activity-device-validation-incoming',
        sourceId: 'source-idempotent-device',
        rawArtifactId: incoming.raw.id,
        provider: 'strava',
        externalId: 'external-device-validation-target',
        device: { id: 'device-idempotent', manufacturer: 'Beta', model: 'Two' }
    });
    await mutateDatabase(
        indexedDB,
        ['activitySources', 'devices'],
        transaction => {
            transaction.objectStore('activitySources').add({
                ...input.sources[0],
                activityId: 'activity-device-validation-target'
            });
            transaction.objectStore('devices').add({
                id: 'device-idempotent',
                manufacturer: 'Alpha',
                model: 'One'
            });
        }
    );

    await assert.rejects(
        imports.persistImportItem(incoming.itemId, input),
        error => error.code === 'CONFLICT'
    );
    assert.equal((await imports.getRawArtifact(incoming.raw.id)).state, 'pending');
    assert.equal((await imports.getImportItem(incoming.itemId)).status, 'persisting');
    await imports.close();
});

test('committed replay rejects a malformed Canonical envelope instead of skipping', async () => {
    const indexedDB = new IDBFactory();
    const { imports } = createStores(indexedDB);
    await imports.initialize();
    const first = await persist(imports, 20, {
        activityId: 'activity-malformed-replay',
        sourceId: 'source-malformed-replay',
        provider: 'strava',
        externalId: 'external-malformed-replay'
    });
    await mutateDatabase(indexedDB, ['activities'], transaction => {
        transaction.objectStore('activities').put({
            schemaVersion: 999,
            activity: { id: 'activity-malformed-replay' },
            warnings: null,
            versionMetadata: null,
            deviceIds: []
        });
    });
    const replay = await preparePersisting(imports, 21, first.raw);
    const input = bundle({
        activityId: 'activity-malformed-replay',
        sourceId: 'source-malformed-replay',
        rawArtifactId: replay.raw.id,
        provider: 'strava',
        externalId: 'external-malformed-replay'
    });

    await assert.rejects(
        imports.persistImportItem(replay.itemId, input),
        error => error.code === 'SCHEMA_MISMATCH'
    );
    assert.equal((await imports.getImportItem(replay.itemId)).status, 'persisting');
    await imports.close();
});

test('pending exact link rejects a malformed Canonical envelope without partial association', async () => {
    const indexedDB = new IDBFactory();
    const { imports } = createStores(indexedDB);
    await imports.initialize();
    await persist(imports, 22, {
        activityId: 'activity-malformed-link',
        sourceId: 'source-malformed-link',
        provider: 'strava',
        externalId: 'external-malformed-link'
    });
    await mutateDatabase(indexedDB, ['activities'], transaction => {
        transaction.objectStore('activities').put({
            schemaVersion: 999,
            activity: { id: 'activity-malformed-link' },
            warnings: null,
            versionMetadata: null,
            deviceIds: []
        });
    });
    const incoming = await preparePersisting(imports, 23);
    const input = bundle({
        activityId: 'activity-malformed-link-incoming',
        sourceId: 'source-malformed-link-incoming',
        rawArtifactId: incoming.raw.id,
        provider: 'strava',
        externalId: 'external-malformed-link'
    });

    await assert.rejects(
        imports.persistImportItem(incoming.itemId, input),
        error => error.code === 'SCHEMA_MISMATCH'
    );
    assert.equal((await imports.getRawArtifact(incoming.raw.id)).state, 'pending');
    assert.equal((await imports.getImportItem(incoming.itemId)).status, 'persisting');
    await imports.close();
});
