import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBDatabase,
    IDBFactory,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    createCanonicalStore,
    createSourceConnectionStore
} from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-04T10:11:12.013Z');

function options(indexedDB, now = () => FIXED_TIME) {
    return {
        indexedDB,
        IDBKeyRange,
        now,
        applicationVersion: 'backup-manifest-test@1'
    };
}

function minimalBundle() {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id: 'opaque-manifest-activity',
            sportCategory: 'walk',
            sportVariant: null,
            startTimeUtc: '2026-08-04T06:00:00.000Z',
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
            }
        },
        streams: {
            activityId: 'opaque-manifest-activity',
            series: []
        },
        laps: [],
        events: [],
        sources: [{
            id: 'opaque-manifest-source',
            activityId: 'opaque-manifest-activity',
            provider: 'synthetic-provider',
            acquisitionMethod: 'synthetic-import',
            importedAt: '2026-08-04T05:00:00.000Z'
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: null,
            normalizerVersion: null,
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
}

function openDatabase(indexedDB) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            V2_DATABASE_NAME,
            V2_DATABASE_VERSION
        );
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

test('backup manifest has the exact frozen metadata-only shape and counts', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();

    assert.deepEqual(await storage.createBackupManifest(), {
        backupFormatVersion: 2,
        databaseName: 'strava-stats-v2',
        indexedDbVersion: 5,
        canonicalSchemaVersion: 1,
        createdAt: '2026-08-04T10:11:12.013Z',
        applicationVersion: 'backup-manifest-test@1',
        stores: [
            { name: 'metadata', recordCount: 1 },
            { name: 'migrations', recordCount: 5 },
            { name: 'activities', recordCount: 0 },
            { name: 'activitySources', recordCount: 0 },
            { name: 'streamSeries', recordCount: 0 },
            { name: 'laps', recordCount: 0 },
            { name: 'events', recordCount: 0 },
            { name: 'devices', recordCount: 0 },
            { name: 'rawArtifacts', recordCount: 0 },
            { name: 'importJobs', recordCount: 0 },
            { name: 'importItems', recordCount: 0 },
            { name: 'mergeCandidates', recordCount: 0 },
            { name: 'mergeDecisions', recordCount: 0 },
            { name: 'sourceConnections', recordCount: 0 }
        ],
        files: [],
        hashes: []
    });

    await storage.putBundle(minimalBundle());
    const connections = createSourceConnectionStore(options(indexedDB));
    await connections.initialize();
    await connections.createConnection({
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: '424242',
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1
    });
    await connections.close();
    const manifest = await storage.createBackupManifest();
    assertDeepFrozen(manifest);
    assert.deepEqual(manifest.stores, [
        { name: 'metadata', recordCount: 1 },
        { name: 'migrations', recordCount: 5 },
        { name: 'activities', recordCount: 1 },
        { name: 'activitySources', recordCount: 1 },
        { name: 'streamSeries', recordCount: 0 },
        { name: 'laps', recordCount: 0 },
        { name: 'events', recordCount: 0 },
        { name: 'devices', recordCount: 0 },
        { name: 'rawArtifacts', recordCount: 0 },
        { name: 'importJobs', recordCount: 0 },
        { name: 'importItems', recordCount: 0 },
        { name: 'mergeCandidates', recordCount: 0 },
        { name: 'mergeDecisions', recordCount: 0 },
        { name: 'sourceConnections', recordCount: 1 }
    ]);
    assert.deepEqual(manifest.files, []);
    assert.deepEqual(manifest.hashes, []);
    await storage.close();
});

test('backup manifest reads metadata and counts without reading payloads', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.putBundle(minimalBundle());
    const originalGet = IDBObjectStore.prototype.get;
    const originalGetAll = IDBObjectStore.prototype.getAll;
    const originalOpenCursor = IDBObjectStore.prototype.openCursor;
    const originalCount = IDBObjectStore.prototype.count;
    const calls = { get: [], getAll: 0, openCursor: 0, count: [] };

    IDBObjectStore.prototype.get = function (...args) {
        calls.get.push(this.name);
        return originalGet.apply(this, args);
    };
    IDBObjectStore.prototype.getAll = function (...args) {
        calls.getAll += 1;
        return originalGetAll.apply(this, args);
    };
    IDBObjectStore.prototype.openCursor = function (...args) {
        calls.openCursor += 1;
        return originalOpenCursor.apply(this, args);
    };
    IDBObjectStore.prototype.count = function (...args) {
        calls.count.push(this.name);
        return originalCount.apply(this, args);
    };
    try {
        await storage.createBackupManifest();
    } finally {
        IDBObjectStore.prototype.get = originalGet;
        IDBObjectStore.prototype.getAll = originalGetAll;
        IDBObjectStore.prototype.openCursor = originalOpenCursor;
        IDBObjectStore.prototype.count = originalCount;
    }

    assert.deepEqual(calls.get, ['metadata']);
    assert.equal(calls.getAll, 0);
    assert.equal(calls.openCursor, 0);
    assert.deepEqual(calls.count, [
        'metadata',
        'migrations',
        'activities',
        'activitySources',
        'streamSeries',
        'laps',
        'events',
        'devices',
        'rawArtifacts',
        'importJobs',
        'importItems',
        'mergeCandidates',
        'mergeDecisions',
        'sourceConnections'
    ]);
    await storage.close();
});

test('backup manifest fails closed for metadata mismatch without hashes', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const database = await openDatabase(indexedDB);
    const transaction = database.transaction('metadata', 'readwrite');
    transaction.objectStore('metadata').put({
        key: 'database',
        databaseName: 'synthetic-wrong-database',
        schemaId: 'strava-stats-v2@3',
        indexedDbVersion: 3,
        canonicalSchemaVersion: 1,
        createdAt: '2026-08-04T10:11:12.013Z',
        createdByApplicationVersion: 'backup-manifest-test@1'
    });
    await transactionDone(transaction);
    database.close();

    await assert.rejects(storage.createBackupManifest(), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.SCHEMA_MISMATCH);
        assert.equal(Object.hasOwn(error, 'hashes'), false);
        return true;
    });
    await storage.close();
});

test('backup manifest clock fails before transaction I/O', async () => {
    const indexedDB = new IDBFactory();
    let failClock = false;
    const storage = createCanonicalStore(options(indexedDB, () => {
        if (failClock) throw new Error('synthetic private clock');
        return FIXED_TIME;
    }));
    await storage.initialize();
    failClock = true;
    const originalTransaction = IDBDatabase.prototype.transaction;
    let transactionCalls = 0;
    IDBDatabase.prototype.transaction = function (...args) {
        transactionCalls += 1;
        return originalTransaction.apply(this, args);
    };
    try {
        await assert.rejects(storage.createBackupManifest(), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.INVALID_REQUEST);
            assert.equal(JSON.stringify(error).includes('private clock'), false);
            return true;
        });
    } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
    }
    assert.equal(transactionCalls, 0);
    await storage.close();
});
