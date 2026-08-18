import assert from 'node:assert/strict';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { validateImportedActivityBundle } from '../../js/data/contracts/index.js';
import { createShadowCanonicalWriter } from '../../js/shadow/index.js';
import { mapLegacyActivityToCanonicalBundle } from '../../js/shadow/legacy-to-canonical.js';
import { createCanonicalStore } from '../../js/storage/index.js';

const FIXED_NOW = Date.parse('2026-08-05T08:09:10.011Z');

function legacyActivity(overrides = {}) {
    return {
        id: 'opaque-shadow-a',
        sport_type: 'Run',
        type: 'Run',
        start_date: '2026-08-05T06:00:00Z',
        start_date_local: '2026-08-05T14:00:00',
        utc_offset: 8 * 60 * 60,
        name: 'PRIVATE_ACTIVITY_NAME_SENTINEL',
        distance: 0,
        moving_time: 60,
        elapsed_time: 70,
        total_elevation_gain: null,
        average_heartrate: 120,
        average_watts: null,
        average_cadence: 0,
        gear_id: null,
        map: { summary_polyline: '' },
        ignored_private_field: 'PRIVATE_RAW_PAYLOAD_SENTINEL',
        ...overrides
    };
}

function store(indexedDB, overrides = {}) {
    return createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_NOW,
        applicationVersion: 'shadow-writer-test@1',
        ...overrides
    });
}

function writer(canonicalStore) {
    return createShadowCanonicalWriter({
        canonicalStore,
        now: () => FIXED_NOW
    });
}

function importedBundle(id = 'opaque-imported-a') {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id,
            sportCategory: 'ride',
            sportVariant: null,
            startTimeUtc: '2026-08-05T05:00:00.000Z',
            timeZone: { ianaName: null, utcOffsetMinutes: null },
            capabilities: {
                hasGps: false,
                hasHeartRate: false,
                hasPower: true,
                hasCadence: false,
                hasLaps: false
            },
            distanceMeters: null,
            movingTimeSeconds: 0,
            elapsedTimeSeconds: 0,
            averagePowerWatts: 0,
            extensions: {
                shadowCanonicalWriterV1: { gearExternalId: 'synthetic-gear' }
            }
        },
        streams: { activityId: id, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: `${id}-source`,
            activityId: id,
            provider: 'synthetic',
            externalId: null,
            rawArtifactId: null,
            acquisitionMethod: 'synthetic-test',
            deviceId: null,
            importedAt: '2026-08-05T05:00:00.000Z'
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'synthetic-parser-v1',
            normalizerVersion: 'synthetic-normalizer-v1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
}

test('Legacy summary maps to an accepted deterministic bundle without input mutation', () => {
    const input = legacyActivity();
    const before = structuredClone(input);
    const mapped = mapLegacyActivityToCanonicalBundle(input);

    assert.equal(mapped.ok, true);
    assert.deepEqual(input, before);
    assert.equal(validateImportedActivityBundle(mapped.bundle).ok, true);
    assert.equal(mapped.bundle.activity.id, 'opaque-shadow-a');
    assert.equal(mapped.bundle.activity.startTimeUtc, '2026-08-05T06:00:00.000Z');
    assert.equal(mapped.bundle.activity.distanceMeters, 0);
    assert.equal(mapped.bundle.activity.averagePowerWatts, null);
    assert.equal(mapped.bundle.activity.extensions.shadowCanonicalWriterV1.gearExternalId, null);
    assert.equal(mapped.bundle.sources[0].externalId, 'opaque-shadow-a');
    assert.equal(mapped.bundle.sources[0].importedAt, mapped.bundle.activity.startTimeUtc);
    assert.deepEqual(mapped.warnings.map(item => item.reason), [
        'IMPORTED_AT_ACTIVITY_TIME_FALLBACK'
    ]);
});

test('impossible calendar dates fail mapping instead of rolling forward', () => {
    const mapped = mapLegacyActivityToCanonicalBundle(legacyActivity({
        start_date: '2026-02-30T06:00:00Z'
    }));

    assert.deepEqual(mapped, {
        ok: false,
        field: 'date',
        reason: 'START_DATE_INVALID'
    });
});

test('writer commits, verifies, exports redacted parity, and distinguishes missing/null/zero', async () => {
    const indexedDB = new IDBFactory();
    const canonicalStore = store(indexedDB);
    const shadowWriter = writer(canonicalStore);
    const input = legacyActivity();
    const before = structuredClone(input);

    const accepted = shadowWriter.enqueueLegacyActivities([input]);
    assert.deepEqual(accepted, { accepted: true, sequence: 1, reason: null });
    assert.deepEqual(input, before);
    const exported = await shadowWriter.flush();
    const report = JSON.parse(exported);
    const stored = await canonicalStore.getBundle('opaque-shadow-a');

    assert.equal(stored.activity.distanceMeters, 0);
    assert.equal(stored.activity.averagePowerWatts, null);
    assert.equal(Object.hasOwn(stored.activity, 'averageHeartRateBpm'), true);
    assert.equal(report.status, 'differences');
    assert.equal(report.totals.committed, 1);
    assert.equal(report.fields.activityCount.matched, 1);
    assert.equal(report.fields.distance.legacyStates.zero, 1);
    assert.equal(report.fields.distance.canonicalStates.zero, 1);
    assert.equal(report.fields.power.legacyStates.null, 1);
    assert.equal(report.fields.gear.legacyStates.null, 1);
    assert.deepEqual(Object.keys(report.fields), [
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
    ]);
    for (const sentinel of [
        'opaque-shadow-a',
        'PRIVATE_ACTIVITY_NAME_SENTINEL',
        'PRIVATE_RAW_PAYLOAD_SENTINEL',
        'synthetic-gear'
    ]) {
        assert.equal(exported.includes(sentinel), false);
    }
    await shadowWriter.close();
});

test('parity states distinguish missing, null, and valid zero across applicable fields', async () => {
    const indexedDB = new IDBFactory();
    const shadowWriter = writer(store(indexedDB));
    const missing = legacyActivity({ id: 'opaque-state-missing' });
    for (const key of [
        'distance',
        'moving_time',
        'elapsed_time',
        'average_heartrate',
        'average_watts',
        'gear_id'
    ]) delete missing[key];
    const nullable = legacyActivity({
        id: 'opaque-state-null',
        distance: null,
        moving_time: null,
        elapsed_time: null,
        average_heartrate: null,
        average_watts: null,
        gear_id: null
    });
    const zero = legacyActivity({
        id: 'opaque-state-zero',
        distance: 0,
        moving_time: 0,
        elapsed_time: 0,
        average_heartrate: null,
        average_watts: 0,
        gear_id: 0
    });

    shadowWriter.enqueueLegacyActivities([missing, nullable, zero]);
    const report = JSON.parse(await shadowWriter.flush());

    for (const field of ['distance', 'movingTime', 'elapsedTime', 'power']) {
        assert.equal(report.fields[field].legacyStates.missing, 1, field);
        assert.equal(report.fields[field].legacyStates.null, 1, field);
        assert.equal(report.fields[field].legacyStates.zero, 1, field);
        assert.equal(report.fields[field].matched, 3, field);
    }
    assert.equal(report.fields.heartRate.legacyStates.missing, 1);
    assert.equal(report.fields.heartRate.legacyStates.null, 2);
    assert.equal(report.fields.gear.legacyStates.missing, 1);
    assert.equal(report.fields.gear.legacyStates.null, 1);
    assert.equal(report.fields.gear.legacyStates.value, 1);
    await shadowWriter.close();
});

test('identical retry, concurrency, and a new writer after close remain deterministic', async () => {
    const indexedDB = new IDBFactory();
    const firstStore = store(indexedDB);
    const first = writer(firstStore);
    const activity = legacyActivity({ id: 'opaque-retry' });

    const one = first.enqueueLegacyActivities([activity]);
    const two = first.enqueueLegacyActivities([activity]);
    const three = first.enqueueLegacyActivities([
        legacyActivity({ id: 'opaque-later', start_date: '2026-08-05T07:00:00Z' })
    ]);
    assert.deepEqual([one.sequence, two.sequence, three.sequence], [1, 2, 3]);
    const firstReport = JSON.parse(await first.flush());
    assert.deepEqual(firstReport.batches.map(batch => batch.sequence), [1, 2, 3]);
    assert.equal(firstReport.totals.committed, 2);
    assert.equal(firstReport.totals.alreadyPresent, 1);
    await first.close();

    const secondStore = store(indexedDB);
    const second = writer(secondStore);
    second.enqueueLegacyActivities([activity]);
    const secondReport = JSON.parse(await second.flush());
    assert.equal(secondReport.totals.alreadyPresent, 1);
    await second.close();
});

test('mapping, validation, and partial-batch failures are explicit and do not stop later writes', async () => {
    const indexedDB = new IDBFactory();
    const canonicalStore = store(indexedDB);
    const shadowWriter = writer(canonicalStore);
    const invalidId = legacyActivity({ id: Number.MAX_SAFE_INTEGER + 1 });
    const invalidHeartRate = legacyActivity({
        id: 'opaque-invalid-hr',
        average_heartrate: 0
    });
    const valid = legacyActivity({ id: 'opaque-valid-after-failures' });

    shadowWriter.enqueueLegacyActivities([invalidId, invalidHeartRate, valid]);
    const report = JSON.parse(await shadowWriter.flush());

    assert.equal(report.totals.mappingFailed, 1);
    assert.equal(report.totals.validationFailed, 1);
    assert.equal(report.totals.committed, 1);
    assert.equal(report.fields.activityCount.mismatched, 1);
    assert.equal(
        report.batches[0].activities[0].differences[0].category,
        'MAPPING_FAILURE'
    );
    assert.equal(
        report.batches[0].activities[1].differences.some(item => item.category === 'VALIDATION_FAILURE'),
        true
    );
    assert.ok(await canonicalStore.getBundle('opaque-valid-after-failures'));
    await shadowWriter.close();
});

test('storage failure is redacted, best-effort, and leaves the caller value unchanged', async () => {
    const calls = [];
    const canonicalStore = Object.freeze({
        initialize: async () => { calls.push('initialize'); },
        putBundle: async () => {
            calls.push('putBundle');
            const error = new Error('PRIVATE_CAUSE_SENTINEL');
            error.code = 'QUOTA_EXCEEDED';
            throw error;
        },
        getBundle: async () => null,
        close: async () => Object.freeze({ status: 'closed' })
    });
    const shadowWriter = writer(canonicalStore);
    const input = legacyActivity({ id: 'opaque-storage-failure' });
    const before = structuredClone(input);

    shadowWriter.enqueueLegacyActivities([input]);
    const exported = await shadowWriter.flush();
    const report = JSON.parse(exported);
    assert.deepEqual(input, before);
    assert.deepEqual(calls, ['initialize', 'putBundle']);
    assert.equal(report.totals.storageFailed, 1);
    assert.equal(
        report.batches[0].activities[0].differences.some(item => item.reason === 'QUOTA_EXCEEDED'),
        true
    );
    assert.equal(exported.includes('PRIVATE_CAUSE_SENTINEL'), false);
    await shadowWriter.close();
});

test('unapproved storage error codes are redacted to a fixed reason', async () => {
    const canonicalStore = Object.freeze({
        initialize: async () => undefined,
        putBundle: async () => {
            const error = new Error('PRIVATE_CAUSE_SENTINEL');
            error.code = 'PRIVATE_TOKEN_SENTINEL';
            throw error;
        },
        getBundle: async () => null,
        close: async () => Object.freeze({ status: 'closed' })
    });
    const shadowWriter = writer(canonicalStore);

    shadowWriter.enqueueLegacyActivities([
        legacyActivity({ id: 'opaque-private-error-code' })
    ]);
    const exported = await shadowWriter.flush();
    const report = JSON.parse(exported);

    assert.equal(exported.includes('PRIVATE'), false);
    assert.equal(
        report.batches[0].activities[0].differences.some(
            item => item.reason === 'STORAGE_OPERATION_FAILED'
        ),
        true
    );
    await shadowWriter.close();
});

test('real-store conflict is explicit and records field parity mismatch', async () => {
    const indexedDB = new IDBFactory();
    const canonicalStore = store(indexedDB);
    await canonicalStore.initialize();
    const existing = importedBundle('opaque-conflict');
    existing.activity.distanceMeters = 2000;
    await canonicalStore.putBundle(existing);
    const shadowWriter = writer(canonicalStore);

    shadowWriter.enqueueLegacyActivities([
        legacyActivity({ id: 'opaque-conflict', distance: 1000 })
    ]);
    const report = JSON.parse(await shadowWriter.flush());
    const activityReport = report.batches[0].activities[0];

    assert.equal(report.totals.storageFailed, 1);
    assert.equal(report.totals.parityMismatched, 1);
    assert.equal(
        activityReport.differences.some(item => (
            item.category === 'STORAGE_FAILURE'
            && item.reason === 'CONFLICT'
        )),
        true
    );
    assert.equal(
        activityReport.differences.some(item => (
            item.category === 'PARITY_MISMATCH'
            && item.field === 'distance'
        )),
        true
    );
    const retained = await canonicalStore.getBundle('opaque-conflict');
    assert.equal(retained.activity.distanceMeters, 2000);
    await shadowWriter.close();
});

test('initialization failure stays not-ready and the next activity retries explicitly', async () => {
    let initializeCalls = 0;
    let stored = null;
    const canonicalStore = Object.freeze({
        async initialize() {
            initializeCalls += 1;
            if (initializeCalls === 1) {
                const error = new Error('PRIVATE_OPEN_FAILURE');
                error.code = 'OPEN_FAILED';
                throw error;
            }
        },
        async putBundle(bundle) {
            stored = structuredClone(bundle);
            return Object.freeze({ status: 'committed', activityId: bundle.activity.id });
        },
        async getBundle() {
            return structuredClone(stored);
        },
        async close() {
            return Object.freeze({ status: 'closed' });
        }
    });
    const shadowWriter = writer(canonicalStore);
    shadowWriter.enqueueLegacyActivities([
        legacyActivity({ id: 'opaque-open-failure' }),
        legacyActivity({ id: 'opaque-open-retry' })
    ]);
    const exported = await shadowWriter.flush();
    const report = JSON.parse(exported);

    assert.equal(initializeCalls, 2);
    assert.equal(report.totals.storageFailed, 1);
    assert.equal(report.totals.committed, 1);
    assert.equal(exported.includes('PRIVATE_OPEN_FAILURE'), false);
    await shadowWriter.close();
});

test('hostile readback fails verification without executing accessors', async () => {
    let getterCalls = 0;
    const hostileActivity = {};
    Object.defineProperty(hostileActivity, 'id', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'PRIVATE_READBACK_ID';
        }
    });
    const canonicalStore = Object.freeze({
        initialize: async () => undefined,
        putBundle: async bundle => Object.freeze({
            status: 'committed',
            activityId: bundle.activity.id
        }),
        getBundle: async () => ({ activity: hostileActivity }),
        close: async () => Object.freeze({ status: 'closed' })
    });
    const shadowWriter = writer(canonicalStore);
    shadowWriter.enqueueLegacyActivities([
        legacyActivity({ id: 'opaque-hostile-readback' })
    ]);
    const exported = await shadowWriter.flush();
    const report = JSON.parse(exported);

    assert.equal(getterCalls, 0);
    assert.equal(report.totals.verificationFailed, 1);
    assert.equal(exported.includes('PRIVATE_READBACK_ID'), false);
    await shadowWriter.close();
});

test('accepted ImportedActivityBundle uses the same atomic write and parity seam', async () => {
    const indexedDB = new IDBFactory();
    const canonicalStore = store(indexedDB);
    const shadowWriter = writer(canonicalStore);
    const input = importedBundle();
    const before = structuredClone(input);

    assert.equal(validateImportedActivityBundle(input).ok, true);
    assert.deepEqual(
        shadowWriter.enqueueImportedBundle(input),
        { accepted: true, sequence: 1, reason: null }
    );
    const report = JSON.parse(await shadowWriter.flush());
    assert.deepEqual(input, before);
    assert.equal(report.totals.committed, 1);
    assert.equal(report.fields.power.legacyStates.zero, 1);
    assert.equal(report.fields.distance.legacyStates.null, 1);
    assert.ok(await canonicalStore.getBundle('opaque-imported-a'));
    await shadowWriter.close();
});

test('accessors, Proxies, cycles, and non-finite imported values fail closed before storage', async () => {
    let getterCalls = 0;
    const activity = legacyActivity();
    Object.defineProperty(activity, 'distance', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 10;
        }
    });
    const revoked = Proxy.revocable(legacyActivity(), {});
    revoked.revoke();
    const calls = [];
    const canonicalStore = Object.freeze({
        initialize: async () => { calls.push('initialize'); },
        putBundle: async () => { calls.push('put'); },
        getBundle: async () => null,
        close: async () => Object.freeze({ status: 'closed' })
    });
    const shadowWriter = writer(canonicalStore);

    shadowWriter.enqueueLegacyActivities([activity, revoked.proxy]);
    const cyclic = importedBundle('opaque-cyclic');
    cyclic.activity.extensions.cycle = cyclic;
    assert.equal(shadowWriter.enqueueImportedBundle(cyclic).accepted, false);
    const nonFinite = importedBundle('opaque-infinite');
    nonFinite.activity.elapsedTimeSeconds = Infinity;
    assert.equal(shadowWriter.enqueueImportedBundle(nonFinite).accepted, false);
    const report = JSON.parse(await shadowWriter.flush());

    assert.equal(getterCalls, 0);
    assert.deepEqual(calls, []);
    assert.equal(report.totals.mappingFailed, 2);
    assert.equal(report.totals.validationFailed, 2);
    assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
    await shadowWriter.close();
});

test('close is a terminal barrier and rejects later enqueue without new storage work', async () => {
    const indexedDB = new IDBFactory();
    const shadowWriter = writer(store(indexedDB));
    shadowWriter.enqueueLegacyActivities([legacyActivity({ id: 'opaque-close' })]);
    assert.deepEqual(await shadowWriter.close(), { status: 'closed' });
    assert.deepEqual(
        shadowWriter.enqueueLegacyActivities([legacyActivity({ id: 'opaque-after-close' })]),
        { accepted: false, sequence: null, reason: 'WRITER_CLOSED' }
    );
    const report = JSON.parse(shadowWriter.exportReport());
    assert.equal(report.totals.committed, 1);
    assert.equal(report.batches.length, 1);
});
