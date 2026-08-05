import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBDatabase,
    IDBFactory,
    IDBIndex,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    createCanonicalStore
} from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-04T09:10:11.012Z');

function options(indexedDB) {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'canonical-store-test@1'
    };
}

function activity(id, overrides = {}) {
    return {
        schemaVersion: 1,
        id,
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: '2026-08-04T06:00:00.000Z',
        timeZone: {
            ianaName: 'Etc/UTC',
            utcOffsetMinutes: 0
        },
        capabilities: {
            hasGps: false,
            hasHeartRate: true,
            hasPower: true,
            hasCadence: false,
            hasLaps: true
        },
        name: `Synthetic ${id}`,
        elapsedTimeSeconds: 120,
        extensions: {
            syntheticNull: null,
            syntheticZero: 0
        },
        ...overrides
    };
}

function bundle(id = 'opaque-activity-a', overrides = {}) {
    const deviceId = overrides.deviceId ?? 'opaque-shared-device';
    const activityOverrides = overrides.activity;
    const bundleOverrides = { ...overrides };
    delete bundleOverrides.deviceId;
    delete bundleOverrides.activity;
    const value = {
        schemaVersion: 1,
        activity: activity(id, activityOverrides),
        streams: {
            activityId: id,
            series: [
                {
                    streamType: 'power',
                    unit: 'watts',
                    offsetsSeconds: [0, 60],
                    values: [0, 200]
                },
                {
                    streamType: 'heartRate',
                    unit: 'bpm',
                    offsetsSeconds: [0, 60],
                    values: [100, 120]
                }
            ]
        },
        laps: [
            {
                id: `${id}-lap-0`,
                activityId: id,
                index: 0,
                startOffsetSeconds: 0,
                elapsedTimeSeconds: 60
            },
            {
                id: `${id}-lap-1`,
                activityId: id,
                index: 1,
                startOffsetSeconds: 60,
                elapsedTimeSeconds: 60
            }
        ],
        events: [
            {
                id: `${id}-event-0`,
                activityId: id,
                index: 0,
                type: 'start',
                offsetSeconds: 0
            },
            {
                id: `${id}-event-1`,
                activityId: id,
                index: 1,
                type: 'stop',
                offsetSeconds: 120
            }
        ],
        sources: [
            {
                id: `${id}-source`,
                activityId: id,
                provider: 'synthetic-provider',
                acquisitionMethod: 'synthetic-import',
                deviceId,
                importedAt: '2026-08-04T05:00:00.000Z'
            }
        ],
        devices: [
            {
                id: deviceId,
                manufacturer: 'synthetic-maker',
                model: 'synthetic-model'
            }
        ],
        warnings: [
            {
                code: 'SYNTHETIC_WARNING',
                path: '/synthetic',
                message: 'Synthetic test warning.'
            }
        ],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'parser-v1',
            normalizerVersion: 'normalizer-v1',
            analysisVersion: null,
            settingsVersion: 'settings-v1',
            inputHash: null
        }
    };
    return { ...value, ...bundleOverrides };
}

function openDatabase(indexedDB, version = V2_DATABASE_VERSION, upgrade) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(V2_DATABASE_NAME, version);
        request.onupgradeneeded = event => {
            upgrade?.(request.result, request.transaction, event);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.onerror = () => {};
        transaction.onabort = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
    });
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function addRaw(database, storeName, record) {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).add(record);
    await transactionDone(transaction);
}

async function putRaw(database, storeName, record) {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    await transactionDone(transaction);
}

async function deleteRaw(database, storeName, key) {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
}

function assertDeepFrozen(value, seen = new Set()) {
    if (value === null || typeof value !== 'object') return;
    assert.equal(seen.has(value), false);
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        assert.ok(descriptor && Object.hasOwn(descriptor, 'value'));
        assertDeepFrozen(descriptor.value, seen);
    }
    seen.delete(value);
}

test('put commits one detached bundle and get rebuilds a deterministic frozen projection', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const input = bundle();
    const before = structuredClone(input);

    const committed = await storage.putBundle(input);
    assert.deepEqual(committed, {
        status: 'committed',
        activityId: 'opaque-activity-a'
    });
    assert.equal(Object.isFrozen(committed), true);
    assert.deepEqual(input, before);
    assert.equal(Object.isFrozen(input), false);

    const physicalDatabase = await openDatabase(indexedDB);
    const physicalTransaction = physicalDatabase.transaction(
        ['activities', 'streamSeries'],
        'readonly'
    );
    const physicalDone = transactionDone(physicalTransaction);
    const physicalActivity = await requestResult(
        physicalTransaction.objectStore('activities').get('opaque-activity-a')
    );
    const physicalStream = await requestResult(
        physicalTransaction.objectStore('streamSeries').get([
            'opaque-activity-a',
            'power'
        ])
    );
    await physicalDone;
    assert.deepEqual(Object.keys(physicalActivity).sort(), [
        'activity',
        'deviceIds',
        'schemaVersion',
        'versionMetadata',
        'warnings'
    ]);
    assert.deepEqual(physicalActivity.deviceIds, ['opaque-shared-device']);
    assert.deepEqual(Object.keys(physicalActivity.versionMetadata).sort(), [
        'analysisVersion',
        'inputHash',
        'normalizerVersion',
        'parserVersion',
        'schemaVersion',
        'settingsVersion'
    ]);
    assert.deepEqual(Object.keys(physicalStream).sort(), [
        'activityId',
        'series',
        'streamType'
    ]);
    assert.equal(Array.isArray(physicalStream.series.values), true);
    physicalDatabase.close();

    input.activity.name = 'Caller mutation after commit';
    input.streams.series[0].values[0] = 999;
    const stored = await storage.getBundle('opaque-activity-a');
    assert.equal(stored.activity.name, 'Synthetic opaque-activity-a');
    assert.deepEqual(
        stored.streams.series.map(series => series.streamType),
        ['heartRate', 'power']
    );
    assert.deepEqual(stored.laps.map(lap => lap.index), [0, 1]);
    assert.deepEqual(stored.events.map(event => event.index), [0, 1]);
    assert.deepEqual(stored.sources.map(source => source.id), [
        'opaque-activity-a-source'
    ]);
    assert.deepEqual(stored.versionMetadata, before.versionMetadata);
    assert.deepEqual(stored.warnings, before.warnings);
    assertDeepFrozen(stored);
    await storage.close();
});

test('put detects already-present and every differing or partial graph as conflict', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const original = bundle();
    await storage.putBundle(original);

    const originalAdd = IDBObjectStore.prototype.add;
    const originalPut = IDBObjectStore.prototype.put;
    let writeCalls = 0;
    IDBObjectStore.prototype.add = function (...args) {
        writeCalls += 1;
        return originalAdd.apply(this, args);
    };
    IDBObjectStore.prototype.put = function (...args) {
        writeCalls += 1;
        return originalPut.apply(this, args);
    };
    let repeated;
    try {
        repeated = await storage.putBundle(structuredClone(original));
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
        IDBObjectStore.prototype.put = originalPut;
    }
    assert.deepEqual(repeated, {
        status: 'already-present',
        activityId: 'opaque-activity-a'
    });
    assert.equal(Object.isFrozen(repeated), true);
    assert.equal(writeCalls, 0);

    const changed = bundle();
    changed.activity.extensions.syntheticNull = 0;
    await assert.rejects(storage.putBundle(changed), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONFLICT);
        return true;
    });
    assert.equal(
        (await storage.getBundle('opaque-activity-a')).activity
            .extensions.syntheticNull,
        null
    );
    const changedAbsent = bundle();
    delete changedAbsent.activity.extensions.syntheticNull;
    await assert.rejects(storage.putBundle(changedAbsent), error => (
        error.code === STORAGE_ERROR_CODE.CONFLICT
    ));
    const changedNegativeZero = bundle();
    changedNegativeZero.activity.extensions.syntheticZero = -0;
    await assert.rejects(storage.putBundle(changedNegativeZero), error => (
        error.code === STORAGE_ERROR_CODE.CONFLICT
    ));

    const reordered = structuredClone(original);
    reordered.activity.timeZone = {
        utcOffsetMinutes: 0,
        ianaName: 'Etc/UTC'
    };
    assert.equal(
        (await storage.putBundle(reordered)).status,
        'already-present'
    );

    const database = await openDatabase(indexedDB);
    await addRaw(database, 'activitySources', {
        id: 'opaque-activity-a-extra-source',
        activityId: 'opaque-activity-a',
        provider: 'synthetic-provider',
        acquisitionMethod: 'synthetic-import',
        importedAt: '2026-08-04T05:00:00.000Z'
    });
    database.close();
    await assert.rejects(storage.putBundle(original), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONFLICT);
        return true;
    });
    await storage.close();
});

test('partial activity graph and non-device orphan collision are never incorporated', async () => {
    const partialFactory = new IDBFactory();
    const partialStore = createCanonicalStore(options(partialFactory));
    await partialStore.initialize();
    const partialBundle = bundle('opaque-partial');
    const partialDatabase = await openDatabase(partialFactory);
    await addRaw(partialDatabase, 'activities', {
        schemaVersion: 1,
        activity: partialBundle.activity,
        warnings: partialBundle.warnings,
        versionMetadata: partialBundle.versionMetadata
    });
    partialDatabase.close();
    await assert.rejects(partialStore.putBundle(partialBundle), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONFLICT);
        return true;
    });
    await partialStore.close();

    const orphanFactory = new IDBFactory();
    const orphanStore = createCanonicalStore(options(orphanFactory));
    await orphanStore.initialize();
    const orphanBundle = bundle('opaque-orphan');
    const orphanDatabase = await openDatabase(orphanFactory);
    await addRaw(orphanDatabase, 'activitySources', {
        ...orphanBundle.sources[0],
        activityId: 'different-opaque-activity'
    });
    orphanDatabase.close();
    await assert.rejects(orphanStore.putBundle(orphanBundle), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONFLICT);
        return true;
    });
    assert.equal(await orphanStore.getBundle('opaque-orphan'), null);
    await orphanStore.close();
});

test('an identical device can be shared across two committed activities', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.putBundle(bundle('opaque-shared-a'));
    assert.deepEqual(await storage.putBundle(bundle('opaque-shared-b')), {
        status: 'committed',
        activityId: 'opaque-shared-b'
    });
    assert.deepEqual(
        (await storage.getBundle('opaque-shared-b')).devices,
        [{
            id: 'opaque-shared-device',
            manufacturer: 'synthetic-maker',
            model: 'synthetic-model'
        }]
    );
    await storage.close();
});

test('unreferenced accepted devices round-trip through explicit envelope association', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const input = bundle('opaque-unreferenced', {
        devices: [
            {
                id: 'z-unreferenced-device',
                manufacturer: 'synthetic-maker',
                model: 'synthetic-z'
            },
            {
                id: 'a-unreferenced-device',
                manufacturer: 'synthetic-maker',
                model: 'synthetic-a'
            }
        ]
    });
    delete input.sources[0].deviceId;

    assert.deepEqual(await storage.putBundle(input), {
        status: 'committed',
        activityId: 'opaque-unreferenced'
    });
    assert.deepEqual(await storage.putBundle(structuredClone(input)), {
        status: 'already-present',
        activityId: 'opaque-unreferenced'
    });
    const stored = await storage.getBundle('opaque-unreferenced');
    assert.deepEqual(stored.devices, [
        {
            id: 'a-unreferenced-device',
            manufacturer: 'synthetic-maker',
            model: 'synthetic-a'
        },
        {
            id: 'z-unreferenced-device',
            manufacturer: 'synthetic-maker',
            model: 'synthetic-z'
        }
    ]);
    assert.equal(Object.hasOwn(stored.sources[0], 'deviceId'), false);

    const database = await openDatabase(indexedDB);
    const transaction = database.transaction('activities', 'readonly');
    const envelope = await requestResult(
        transaction.objectStore('activities').get('opaque-unreferenced')
    );
    await transactionDone(transaction);
    assert.deepEqual(envelope.deviceIds, [
        'a-unreferenced-device',
        'z-unreferenced-device'
    ]);
    database.close();
    await storage.close();
});

test('missing or malformed envelope device association fails closed', async () => {
    const missingFactory = new IDBFactory();
    const missingStore = createCanonicalStore(options(missingFactory));
    await missingStore.initialize();
    await missingStore.putBundle(bundle('opaque-missing-listed-device'));
    const missingDatabase = await openDatabase(missingFactory);
    await deleteRaw(
        missingDatabase,
        'devices',
        'opaque-shared-device'
    );
    missingDatabase.close();
    await assert.rejects(
        missingStore.getBundle('opaque-missing-listed-device'),
        error => error.code === STORAGE_ERROR_CODE.SCHEMA_MISMATCH
    );
    await missingStore.close();

    for (const deviceIds of [
        ['opaque-shared-device', 'opaque-shared-device'],
        ['z-device', 'a-device'],
        ['opaque-shared-device', 0]
    ]) {
        const indexedDB = new IDBFactory();
        const storage = createCanonicalStore(options(indexedDB));
        await storage.initialize();
        const input = bundle('opaque-tampered-device-ids');
        await storage.putBundle(input);
        const database = await openDatabase(indexedDB);
        await putRaw(database, 'activities', {
            schemaVersion: input.schemaVersion,
            activity: input.activity,
            warnings: input.warnings,
            versionMetadata: input.versionMetadata,
            deviceIds
        });
        database.close();
        await assert.rejects(
            storage.getBundle('opaque-tampered-device-ids'),
            error => error.code === STORAGE_ERROR_CODE.SCHEMA_MISMATCH
        );
        await assert.rejects(
            storage.listActivities(),
            error => error.code === STORAGE_ERROR_CODE.SCHEMA_MISMATCH
        );
        await storage.close();
    }
});

test('get supports exact requested streams, missing activity, and opaque IDs', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.putBundle(bundle('000123'));

    const selected = await storage.getBundle('000123', {
        streamTypes: ['power']
    });
    assert.deepEqual(selected.streams.series.map(series => series.streamType), [
        'power'
    ]);
    assert.equal(await storage.getBundle('123'), null);
    assert.equal(await storage.getBundle('opaque-missing'), null);

    for (const [activityId, getOptions] of [
        [123, undefined],
        ['', undefined],
        ['000123', { extra: true }],
        ['000123', { streamTypes: ['power', 'power'] }],
        ['000123', { streamTypes: new Array(1) }]
    ]) {
        await assert.rejects(
            storage.getBundle(activityId, getOptions),
            error => error.code === STORAGE_ERROR_CODE.INVALID_REQUEST
        );
    }
    await storage.close();
});

test('get fails closed for broken stored envelope or relations', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const database = await openDatabase(indexedDB);
    await addRaw(database, 'activities', {
        activity: activity('opaque-broken')
    });
    database.close();
    await assert.rejects(storage.getBundle('opaque-broken'), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.SCHEMA_MISMATCH);
        return true;
    });
    await storage.close();

    const orphanFactory = new IDBFactory();
    const orphanStore = createCanonicalStore(options(orphanFactory));
    await orphanStore.initialize();
    const orphanDatabase = await openDatabase(orphanFactory);
    await addRaw(orphanDatabase, 'events', {
        id: 'opaque-missing-event',
        activityId: 'opaque-missing',
        index: 0,
        type: 'marker',
        offsetSeconds: 0
    });
    orphanDatabase.close();
    await assert.rejects(orphanStore.getBundle('opaque-missing'), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.SCHEMA_MISMATCH);
        return true;
    });
    await orphanStore.close();
});

test('list uses frozen indexes, filters, limits, and opaque ID tie-breaking', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    for (const [id, startTimeUtc, sportCategory] of [
        ['2', '2026-08-04T06:00:00.000Z', 'run'],
        ['10', '2026-08-04T06:00:00.000Z', 'run'],
        ['opaque-ride', '2026-08-04T07:00:00.000Z', 'ride'],
        ['opaque-old', '2026-08-04T05:00:00.000Z', 'run']
    ]) {
        await storage.putBundle(bundle(id, {
            activity: { startTimeUtc, sportCategory }
        }));
    }

    assert.deepEqual(
        (await storage.listActivities()).map(item => item.id),
        ['opaque-ride', '2', '10', 'opaque-old']
    );
    const ascendingRun = await storage.listActivities({
        sportCategory: 'run',
        direction: 'asc',
        limit: 2
    });
    assert.deepEqual(ascendingRun.map(item => item.id), ['opaque-old', '10']);
    assertDeepFrozen(ascendingRun);
    assert.equal(Object.hasOwn(ascendingRun[0], 'warnings'), false);

    for (const listOptions of [
        { limit: 0 },
        { limit: 501 },
        { limit: 1.5 },
        { direction: 'sideways' },
        { sportCategory: null },
        { sportCategory: 'rowing' },
        { extra: true }
    ]) {
        await assert.rejects(storage.listActivities(listOptions), error => (
            error.code === STORAGE_ERROR_CODE.INVALID_REQUEST
        ));
    }
    await storage.close();
});

test('special ordinary keys, null, zero, and negative zero round-trip exactly', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const value = bundle('opaque-special');
    const extensions = value.activity.extensions;
    extensions.negativeZero = -0;
    Object.defineProperty(extensions, '__proto__', {
        value: { synthetic: null },
        enumerable: true,
        writable: true,
        configurable: true
    });
    Object.defineProperty(extensions, 'constructor', {
        value: { synthetic: 0 },
        enumerable: true,
        writable: true,
        configurable: true
    });
    const beforeDescriptors = Object.getOwnPropertyDescriptors(extensions);

    await storage.putBundle(value);
    const stored = await storage.getBundle('opaque-special');
    assert.equal(Object.getPrototypeOf(stored.activity.extensions), Object.prototype);
    assert.equal(Object.hasOwn(stored.activity.extensions, '__proto__'), true);
    assert.equal(Object.hasOwn(stored.activity.extensions, 'constructor'), true);
    assert.equal(stored.activity.extensions.syntheticNull, null);
    assert.equal(stored.activity.extensions.syntheticZero, 0);
    assert.equal(Object.is(stored.activity.extensions.negativeZero, -0), true);
    assert.deepEqual(
        Object.getOwnPropertyDescriptors(extensions),
        beforeDescriptors
    );
    await storage.close();
});

test('unsafe bundle inputs fail before readwrite I/O without getter execution', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const originalTransaction = IDBDatabase.prototype.transaction;
    let transactionCalls = 0;
    let getterCalls = 0;
    IDBDatabase.prototype.transaction = function (...args) {
        transactionCalls += 1;
        return originalTransaction.apply(this, args);
    };
    try {
        const accessor = bundle('opaque-accessor');
        Object.defineProperty(accessor, 'activity', {
            enumerable: true,
            get() {
                getterCalls += 1;
                return activity('opaque-accessor');
            }
        });
        const cyclic = bundle('opaque-cycle');
        cyclic.activity.extensions.cycle = cyclic;
        const special = bundle('opaque-special-object');
        special.activity.extensions.date = new Date(0);
        const nonFinite = bundle('opaque-non-finite');
        nonFinite.activity.extensions.number = Infinity;
        const proxy = new Proxy(bundle('opaque-proxy'), {
            ownKeys() {
                throw new Error('synthetic private reflection detail');
            }
        });
        for (const invalid of [accessor, cyclic, special, nonFinite, proxy]) {
            await assert.rejects(storage.putBundle(invalid), error => {
                assert.equal(error.code, STORAGE_ERROR_CODE.DATA_INVALID);
                return true;
            });
        }
    } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
    }
    assert.equal(getterCalls, 0);
    assert.equal(transactionCalls, 0);
    await storage.close();
});

test('putBundle maps quota and constraint faults with atomic rollback', async () => {
    for (const [name, expectedCode] of [
        ['QuotaExceededError', STORAGE_ERROR_CODE.QUOTA_EXCEEDED],
        ['ConstraintError', STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION]
    ]) {
        const indexedDB = new IDBFactory();
        const storage = createCanonicalStore(options(indexedDB));
        await storage.initialize();
        const originalAdd = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...args) {
            if (this.name === 'events') {
                throw new DOMException('synthetic private write fault', name);
            }
            return originalAdd.apply(this, args);
        };
        try {
            await assert.rejects(
                storage.putBundle(bundle(`opaque-${name}`)),
                error => {
                    assert.equal(error.code, expectedCode);
                    assert.equal(
                        JSON.stringify(error).includes('private write fault'),
                        false
                    );
                    return true;
                }
            );
        } finally {
            IDBObjectStore.prototype.add = originalAdd;
        }
        assert.equal(await storage.getBundle(`opaque-${name}`), null);
        assert.deepEqual(await storage.listActivities(), []);
        await storage.close();
    }
});

test('unsafe get and list options fail before I/O without reflection effects', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const originalTransaction = IDBDatabase.prototype.transaction;
    let transactionCalls = 0;
    let getterCalls = 0;
    IDBDatabase.prototype.transaction = function (...args) {
        transactionCalls += 1;
        return originalTransaction.apply(this, args);
    };
    const accessor = {};
    Object.defineProperty(accessor, 'streamTypes', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return [];
        }
    });
    const proxy = new Proxy({}, {
        ownKeys() {
            throw new Error('synthetic private options');
        }
    });
    try {
        await assert.rejects(
            storage.getBundle('opaque-id', accessor),
            error => error.code === STORAGE_ERROR_CODE.INVALID_REQUEST
        );
        await assert.rejects(
            storage.listActivities(proxy),
            error => error.code === STORAGE_ERROR_CODE.INVALID_REQUEST
        );
    } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
    }
    assert.equal(transactionCalls, 0);
    assert.equal(getterCalls, 0);
    await storage.close();
});

test('listActivities never reads stream or relation stores', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.putBundle(bundle('opaque-list-boundary'));
    const originalGetAll = IDBIndex.prototype.getAll;
    const calls = [];
    IDBIndex.prototype.getAll = function (...args) {
        calls.push([this.objectStore.name, this.name]);
        return originalGetAll.apply(this, args);
    };
    try {
        await storage.listActivities();
    } finally {
        IDBIndex.prototype.getAll = originalGetAll;
    }
    assert.deepEqual(calls, [['activities', 'byStartTimeUtc']]);
    await storage.close();
});

test('all data methods require an explicit current ready connection', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    for (const operation of [
        () => storage.putBundle(bundle()),
        () => storage.getBundle('opaque-activity-a'),
        () => storage.listActivities(),
        () => storage.createBackupManifest()
    ]) {
        await assert.rejects(operation(), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
            return true;
        });
    }

    await storage.initialize();
    await storage.close();
    await assert.rejects(storage.getBundle('opaque-activity-a'), error => (
        error.code === STORAGE_ERROR_CODE.CONNECTION_STALE
    ));

    await storage.initialize();
    const upgraded = await openDatabase(indexedDB, V2_DATABASE_VERSION + 1);
    upgraded.close();
    await assert.rejects(storage.listActivities(), error => (
        error.code === STORAGE_ERROR_CODE.CONNECTION_STALE
    ));
    await storage.close();
});

test('close remains a terminal barrier for an in-flight B2 write', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const write = storage.putBundle(bundle('opaque-close-barrier'));
    const closing = storage.close();
    assert.equal(await Promise.race([
        closing.then(() => 'settled'),
        Promise.resolve('pending')
    ]), 'pending');
    assert.deepEqual(await write, {
        status: 'committed',
        activityId: 'opaque-close-barrier'
    });
    assert.deepEqual(await closing, { status: 'closed' });

    await storage.initialize();
    assert.equal(
        (await storage.getBundle('opaque-close-barrier')).activity.id,
        'opaque-close-barrier'
    );
    await storage.close();
});
