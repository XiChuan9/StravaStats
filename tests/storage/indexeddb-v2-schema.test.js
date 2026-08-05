import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBDatabase,
    IDBFactory,
    IDBKeyRange,
    IDBObjectStore,
    IDBTransaction
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_SCHEMA,
    createCanonicalStore
} from '../../js/storage/index.js';
import { runDataMigration } from '../../js/storage/migrations.js';

const FIXED_TIME = Date.parse('2026-08-04T01:02:03.004Z');

function options(indexedDB, applicationVersion = 'test-app@1') {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion
    };
}

function openDatabase(indexedDB, name, version, upgrade) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = event => {
            upgrade?.(request.result, request.transaction, event);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => {};
        transaction.oncomplete = () => resolve();
    });
}

async function readBootstrap(database) {
    const transaction = database.transaction(
        ['metadata', 'migrations'],
        'readonly'
    );
    const metadata = requestResult(
        transaction.objectStore('metadata').get('database')
    );
    const migration = requestResult(
        transaction.objectStore('migrations').get('schema-0001-bootstrap')
    );
    const values = await Promise.all([metadata, migration]);
    await transactionDone(transaction);
    return values;
}

async function readMigration(database, id) {
    const transaction = database.transaction('migrations', 'readonly');
    const record = await requestResult(
        transaction.objectStore('migrations').get(id)
    );
    await transactionDone(transaction);
    return record;
}

async function readAllMigrations(database) {
    const transaction = database.transaction('migrations', 'readonly');
    const records = await requestResult(
        transaction.objectStore('migrations').getAll()
    );
    await transactionDone(transaction);
    return records;
}

function specialSummary(label) {
    const summary = { recordCount: 1 };
    Object.defineProperty(summary, '__proto__', {
        value: { label: `${label}-proto` },
        enumerable: true,
        writable: true,
        configurable: true
    });
    Object.defineProperty(summary, 'constructor', {
        value: { label: `${label}-constructor` },
        enumerable: true,
        writable: true,
        configurable: true
    });
    return summary;
}

function assertSpecialSummary(summary, label, frozen) {
    assert.equal(Object.getPrototypeOf(summary), Object.prototype);
    assert.equal(Object.isFrozen(summary), frozen);
    for (const [key, value] of [
        ['__proto__', { label: `${label}-proto` }],
        ['constructor', { label: `${label}-constructor` }]
    ]) {
        const descriptor = Object.getOwnPropertyDescriptor(summary, key);
        assert.ok(descriptor && Object.hasOwn(descriptor, 'value'));
        assert.equal(descriptor.enumerable, true);
        assert.deepEqual(descriptor.value, value);
        assert.equal(Object.hasOwn(descriptor, 'get'), false);
        assert.equal(Object.hasOwn(descriptor, 'set'), false);
    }
}

async function storeCounts(database) {
    const names = Array.from(database.objectStoreNames);
    const transaction = database.transaction(names, 'readonly');
    const counts = {};
    await Promise.all(names.map(async name => {
        counts[name] = await requestResult(
            transaction.objectStore(name).count()
        );
    }));
    await transactionDone(transaction);
    return counts;
}

function assertPhysicalSchema(database) {
    assert.equal(database.version, V2_DATABASE_VERSION);
    assert.deepEqual(
        Array.from(database.objectStoreNames).sort(),
        V2_SCHEMA.stores.map(store => store.name).sort()
    );

    const transaction = database.transaction(
        V2_SCHEMA.stores.map(store => store.name),
        'readonly'
    );
    for (const descriptor of V2_SCHEMA.stores) {
        const store = transaction.objectStore(descriptor.name);
        assert.deepEqual(store.keyPath, descriptor.keyPath);
        assert.equal(store.autoIncrement, descriptor.autoIncrement);
        assert.deepEqual(
            Array.from(store.indexNames).sort(),
            descriptor.indexes.map(index => index.name).sort()
        );
        for (const descriptorIndex of descriptor.indexes) {
            const index = store.index(descriptorIndex.name);
            assert.deepEqual(index.keyPath, descriptorIndex.keyPath);
            assert.equal(index.unique, descriptorIndex.unique);
            assert.equal(index.multiEntry, descriptorIndex.multiEntry);
        }
    }
}

function assertDeepFrozenJson(value, seen = new Set()) {
    if (value === null || typeof value !== 'object') {
        assert.notEqual(typeof value, 'function');
        return;
    }
    assert.equal(value instanceof Set, false);
    assert.equal(value instanceof Map, false);
    assert.equal(seen.has(value), false, 'schema descriptor must be acyclic');
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const key of Reflect.ownKeys(value)) {
        assert.equal(typeof key, 'string');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        assert.ok(descriptor && Object.hasOwn(descriptor, 'value'));
        assertDeepFrozenJson(descriptor.value, seen);
    }
    seen.delete(value);
}

test('V2_SCHEMA is the exact deeply frozen JSON-safe physical descriptor', () => {
    assert.equal(V2_SCHEMA.databaseName, 'strava-stats-v2');
    assert.equal(V2_SCHEMA.indexedDbVersion, 2);
    assert.equal(V2_SCHEMA.stores.length, 11);
    assert.deepEqual(
        JSON.parse(JSON.stringify(V2_SCHEMA)),
        V2_SCHEMA
    );
    assertDeepFrozenJson(V2_SCHEMA);

    assert.deepEqual(
        V2_SCHEMA.stores.map(({ name, keyPath }) => ({ name, keyPath })),
        [
            { name: 'metadata', keyPath: 'key' },
            { name: 'migrations', keyPath: 'id' },
            { name: 'activities', keyPath: 'activity.id' },
            { name: 'activitySources', keyPath: 'id' },
            {
                name: 'streamSeries',
                keyPath: ['activityId', 'streamType']
            },
            { name: 'laps', keyPath: 'id' },
            { name: 'events', keyPath: 'id' },
            { name: 'devices', keyPath: 'id' },
            { name: 'rawArtifacts', keyPath: 'id' },
            { name: 'importJobs', keyPath: 'id' },
            { name: 'importItems', keyPath: 'id' }
        ]
    );
});

test('fresh initialization applies v1 then additive physical v2 atomically', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));

    const result = await storage.initialize();
    assert.deepEqual(result, {
        status: 'ready',
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 2,
        schemaId: 'strava-stats-v2@2',
        canonicalSchemaVersion: 1
    });
    assert.equal(Object.isFrozen(result), true);
    assert.deepEqual(await storage.close(), { status: 'closed' });

    const database = await openDatabase(
        indexedDB,
        V2_DATABASE_NAME,
        V2_DATABASE_VERSION
    );
    assertPhysicalSchema(database);
    const [metadata, migration] = await readBootstrap(database);
    assert.deepEqual(metadata, {
        key: 'database',
        databaseName: 'strava-stats-v2',
        schemaId: 'strava-stats-v2@2',
        indexedDbVersion: 2,
        canonicalSchemaVersion: 1,
        createdAt: '2026-08-04T01:02:03.004Z',
        createdByApplicationVersion: 'test-app@1'
    });
    assert.deepEqual(migration, {
        id: 'schema-0001-bootstrap',
        fromVersion: 0,
        toVersion: 1,
        status: 'completed',
        startedAt: '2026-08-04T01:02:03.004Z',
        completedAt: '2026-08-04T01:02:03.004Z',
        applicationVersion: 'test-app@1',
        inputSummary: { storeCount: 0 },
        outputSummary: { storeCount: 8 },
        errorCode: null,
        retryCount: 0
    });
    assert.deepEqual(await readMigration(database, 'schema-0002-import-core'), {
        id: 'schema-0002-import-core',
        fromVersion: 1,
        toVersion: 2,
        status: 'completed',
        startedAt: '2026-08-04T01:02:03.004Z',
        completedAt: '2026-08-04T01:02:03.004Z',
        applicationVersion: 'test-app@1',
        inputSummary: { storeCount: 8 },
        outputSummary: { storeCount: 11 },
        errorCode: null,
        retryCount: 0
    });
    database.close();
});

async function createAcceptedV1(indexedDB) {
    return openDatabase(indexedDB, V2_DATABASE_NAME, 1, (database, transaction) => {
        for (const descriptor of V2_SCHEMA.stores.slice(0, 8)) {
            const objectStore = database.createObjectStore(descriptor.name, {
                keyPath: descriptor.keyPath,
                autoIncrement: descriptor.autoIncrement
            });
            for (const index of descriptor.indexes) {
                objectStore.createIndex(index.name, index.keyPath, {
                    unique: index.unique,
                    multiEntry: index.multiEntry
                });
            }
        }
        transaction.objectStore('metadata').put({
            key: 'database',
            databaseName: 'strava-stats-v2',
            schemaId: 'strava-stats-v2@1',
            indexedDbVersion: 1,
            canonicalSchemaVersion: 1,
            createdAt: '2026-08-04T01:02:03.004Z',
            createdByApplicationVersion: 'accepted-v1@1'
        });
        transaction.objectStore('migrations').put({
            id: 'schema-0001-bootstrap',
            fromVersion: 0,
            toVersion: 1,
            status: 'completed',
            startedAt: '2026-08-04T01:02:03.004Z',
            completedAt: '2026-08-04T01:02:03.004Z',
            applicationVersion: 'accepted-v1@1',
            inputSummary: { storeCount: 0 },
            outputSummary: { storeCount: 8 },
            errorCode: null,
            retryCount: 0
        });
        transaction.objectStore('activities').add({
            activity: { id: 'opaque-v1-preserved-sentinel' }
        });
    });
}

test('accepted physical v1 upgrades additively and preserves all prior records', async () => {
    const indexedDB = new IDBFactory();
    const versionOne = await createAcceptedV1(indexedDB);
    versionOne.close();

    const storage = createCanonicalStore(options(indexedDB, 'upgrade-v2@1'));
    await storage.initialize();
    await storage.close();

    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, 2);
    assertPhysicalSchema(database);
    const transaction = database.transaction('activities', 'readonly');
    assert.deepEqual(
        await requestResult(
            transaction.objectStore('activities').get('opaque-v1-preserved-sentinel')
        ),
        { activity: { id: 'opaque-v1-preserved-sentinel' } }
    );
    await transactionDone(transaction);
    const [metadata] = await readBootstrap(database);
    assert.equal(metadata.createdByApplicationVersion, 'accepted-v1@1');
    assert.equal(metadata.schemaId, 'strava-stats-v2@2');
    assert.equal((await readAllMigrations(database)).length, 2);
    database.close();
});

test('failed physical v1-to-v2 upgrade rolls back and explicit retry preserves v1', async () => {
    const indexedDB = new IDBFactory();
    const versionOne = await createAcceptedV1(indexedDB);
    versionOne.close();
    const originalCreateObjectStore = IDBDatabase.prototype.createObjectStore;
    IDBDatabase.prototype.createObjectStore = function (...args) {
        if (args[0] === 'importJobs') {
            throw new Error('synthetic v2 upgrade interruption');
        }
        return originalCreateObjectStore.apply(this, args);
    };
    try {
        const interrupted = createCanonicalStore(options(indexedDB));
        await assert.rejects(
            interrupted.initialize(),
            error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED
                && !JSON.stringify(error).includes('synthetic v2 upgrade interruption')
        );
    } finally {
        IDBDatabase.prototype.createObjectStore = originalCreateObjectStore;
    }

    const afterFailure = await openDatabase(indexedDB, V2_DATABASE_NAME, 1);
    assert.equal(afterFailure.version, 1);
    assert.equal(afterFailure.objectStoreNames.contains('rawArtifacts'), false);
    assert.equal(afterFailure.objectStoreNames.contains('importJobs'), false);
    assert.equal(afterFailure.objectStoreNames.contains('importItems'), false);
    afterFailure.close();

    const retried = createCanonicalStore(options(indexedDB));
    await retried.initialize();
    await retried.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, 2);
    assertPhysicalSchema(database);
    const transaction = database.transaction('activities', 'readonly');
    assert.ok(await requestResult(
        transaction.objectStore('activities').get('opaque-v1-preserved-sentinel')
    ));
    await transactionDone(transaction);
    database.close();
});

test('concurrent and repeated initialization is idempotent and read-only', async () => {
    const indexedDB = new IDBFactory();
    const first = createCanonicalStore(options(indexedDB, 'test-app@first'));

    const [left, right] = await Promise.all([
        first.initialize(),
        first.initialize()
    ]);
    assert.deepEqual(left, right);
    await first.initialize();
    await first.close();

    const second = createCanonicalStore(options(indexedDB, 'test-app@second'));
    await second.initialize();
    await second.close();

    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    const [metadata] = await readBootstrap(database);
    assert.equal(
        metadata.createdByApplicationVersion,
        'test-app@first'
    );
    assert.deepEqual(await storeCounts(database), {
        activities: 0,
        activitySources: 0,
        devices: 0,
        events: 0,
        laps: 0,
        metadata: 1,
        importItems: 0,
        importJobs: 0,
        migrations: 2,
        rawArtifacts: 0,
        streamSeries: 0
    });
    database.close();
});

test('same-version schema mismatch fails closed without repairing the database', async () => {
    const indexedDB = new IDBFactory();
    const malformed = await openDatabase(
        indexedDB,
        V2_DATABASE_NAME,
        V2_DATABASE_VERSION,
        database => {
            database.createObjectStore('metadata', { keyPath: 'key' });
        }
    );
    malformed.close();

    const storage = createCanonicalStore(options(indexedDB));
    await assert.rejects(storage.initialize(), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.SCHEMA_MISMATCH);
        return true;
    });

    const after = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    assert.equal(after.version, V2_DATABASE_VERSION);
    assert.deepEqual(Array.from(after.objectStoreNames), ['metadata']);
    after.close();
});

test('interrupted bootstrap aborts all structural work and explicit retry succeeds', async () => {
    const indexedDB = new IDBFactory();
    const originalCreateObjectStore = IDBDatabase.prototype.createObjectStore;

    IDBDatabase.prototype.createObjectStore = function (...args) {
        if (args[0] === 'activitySources') {
            throw new Error('synthetic migration interruption');
        }
        return originalCreateObjectStore.apply(this, args);
    };

    try {
        const interrupted = createCanonicalStore(options(indexedDB));
        await assert.rejects(interrupted.initialize(), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.MIGRATION_FAILED);
            assert.equal(
                JSON.stringify(error).includes('synthetic migration interruption'),
                false
            );
            return true;
        });
    } finally {
        IDBDatabase.prototype.createObjectStore = originalCreateObjectStore;
    }

    const retried = createCanonicalStore(options(indexedDB));
    await retried.initialize();
    await retried.close();

    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    assertPhysicalSchema(database);
    assert.deepEqual(await storeCounts(database), {
        activities: 0,
        activitySources: 0,
        devices: 0,
        events: 0,
        laps: 0,
        metadata: 1,
        importItems: 0,
        importJobs: 0,
        migrations: 2,
        rawArtifacts: 0,
        streamSeries: 0
    });
    database.close();
});

test('multiple connections close on versionchange and reject unsupported reopen', async () => {
    const indexedDB = new IDBFactory();
    const first = createCanonicalStore(options(indexedDB));
    const second = createCanonicalStore(options(indexedDB));
    await Promise.all([first.initialize(), second.initialize()]);

    const upgraded = await openDatabase(
        indexedDB,
        V2_DATABASE_NAME,
        V2_DATABASE_VERSION + 1
    );
    assert.equal(upgraded.version, V2_DATABASE_VERSION + 1);
    upgraded.close();

    for (const storage of [first, second]) {
        await assert.rejects(storage.initialize(), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.VERSION_UNSUPPORTED);
            return true;
        });
        await storage.close();
    }
});

test('close is repeatable and the same instance can explicitly initialize again', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));

    await storage.initialize();
    const firstClose = storage.close();
    const repeatedClose = storage.close();
    assert.equal(firstClose, repeatedClose);
    assert.deepEqual(await firstClose, { status: 'closed' });
    assert.deepEqual(await storage.close(), { status: 'closed' });

    assert.deepEqual((await storage.initialize()).status, 'ready');
    assert.deepEqual(await storage.close(), { status: 'closed' });
});

test('close before upgrade waits for a complete late schema and can recover', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    const initialization = storage.initialize();
    const closing = storage.close();

    assert.equal(await Promise.race([
        closing.then(() => 'settled'),
        new Promise(resolve => setImmediate(() => resolve('pending')))
    ]), 'pending');
    await assert.rejects(initialization, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
        return true;
    });
    assert.deepEqual(await closing, { status: 'closed' });

    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    assertPhysicalSchema(database);
    database.close();
    await storage.initialize();
    await storage.close();
});

test('close during upgrade ignores abort failure and settles after valid late success', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    const originalCreateObjectStore = IDBDatabase.prototype.createObjectStore;
    const originalPut = IDBObjectStore.prototype.put;
    const originalAbort = IDBTransaction.prototype.abort;
    const originalClose = IDBDatabase.prototype.close;
    const counts = { creates: 0, metadataWrites: 0, closes: 0, aborts: 0 };
    let closing;

    IDBDatabase.prototype.createObjectStore = function (...args) {
        counts.creates += 1;
        const result = originalCreateObjectStore.apply(this, args);
        if (counts.creates === 3) closing = storage.close();
        return result;
    };
    IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'metadata') counts.metadataWrites += 1;
        return originalPut.apply(this, args);
    };
    IDBTransaction.prototype.abort = function () {
        counts.aborts += 1;
        throw new Error('synthetic abort is too late');
    };
    IDBDatabase.prototype.close = function (...args) {
        counts.closes += 1;
        return originalClose.apply(this, args);
    };

    try {
        const initialization = storage.initialize();
        await assert.rejects(initialization, error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
            return true;
        });
        assert.ok(closing);
        assert.deepEqual(await closing, { status: 'closed' });
        assert.equal(counts.aborts, 0);

        const terminalCounts = { ...counts };
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(counts, terminalCounts);
    } finally {
        IDBDatabase.prototype.createObjectStore = originalCreateObjectStore;
        IDBObjectStore.prototype.put = originalPut;
        IDBTransaction.prototype.abort = originalAbort;
        IDBDatabase.prototype.close = originalClose;
    }

    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    assertPhysicalSchema(database);
    database.close();
    await storage.initialize();
    await storage.close();
});

test('data migration abort records failed and retries without partial output', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    let shouldFail = true;
    let writes = 0;
    const definition = {
        id: 'data-synthetic-device-v1',
        storeNames: ['devices'],
        inputSummary: { recordCount: 0 },
        execute({ store }) {
            const devices = store('devices');
            if (shouldFail) {
                devices.add({ id: 'opaque-device-a', label: 'synthetic' });
                throw new Error('synthetic step abort');
            }
            const request = devices.get('opaque-device-a');
            request.onsuccess = () => {
                if (request.result === undefined) {
                    writes += 1;
                    devices.add({ id: 'opaque-device-a', label: 'synthetic' });
                }
            };
            return () => ({ recordCount: 1, writes });
        }
    };
    const context = {
        applicationVersion: 'test-app@migration',
        now: () => FIXED_TIME,
        faultInjector: null
    };

    await assert.rejects(runDataMigration(database, definition, context), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.MIGRATION_FAILED);
        assert.equal(JSON.stringify(error).includes('synthetic step abort'), false);
        return true;
    });
    assert.deepEqual(await readMigration(database, definition.id), {
        id: definition.id,
        fromVersion: V2_DATABASE_VERSION,
        toVersion: V2_DATABASE_VERSION,
        status: 'failed',
        startedAt: '2026-08-04T01:02:03.004Z',
        completedAt: '2026-08-04T01:02:03.004Z',
        applicationVersion: 'test-app@migration',
        inputSummary: { recordCount: 0 },
        outputSummary: null,
        errorCode: 'MIGRATION_FAILED',
        retryCount: 0
    });
    assert.equal((await storeCounts(database)).devices, 0);

    shouldFail = false;
    const completed = await runDataMigration(database, definition, context);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.retryCount, 1);
    assert.deepEqual(completed.outputSummary, { recordCount: 1, writes: 1 });
    assert.equal(Object.isFrozen(completed), true);
    assert.equal((await storeCounts(database)).devices, 1);
    database.close();
});

test('stale running migration is interrupted then idempotently retried', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    let writes = 0;
    const definition = {
        id: 'data-synthetic-crash-window-v1',
        storeNames: ['devices'],
        inputSummary: { recordCount: 0 },
        execute({ store }) {
            const devices = store('devices');
            const request = devices.get('opaque-device-crash');
            request.onsuccess = () => {
                if (request.result === undefined) {
                    writes += 1;
                    devices.add({
                        id: 'opaque-device-crash',
                        label: 'synthetic'
                    });
                }
            };
            return () => ({ recordCount: 1, writes });
        }
    };
    const context = faultInjector => ({
        applicationVersion: 'test-app@migration',
        now: () => FIXED_TIME,
        faultInjector
    });

    await assert.rejects(runDataMigration(
        database,
        definition,
        context(stage => {
            if (stage === 'after-pending-status') throw new Error('pause');
        })
    ), error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED);
    const pending = await readMigration(database, definition.id);
    assert.equal(pending.status, 'pending');
    assert.equal(pending.retryCount, 0);
    assert.equal((await storeCounts(database)).devices, 0);

    await assert.rejects(runDataMigration(
        database,
        definition,
        context(stage => {
            if (stage === 'before-completed-status') throw new Error('crash');
        })
    ), error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED);
    assert.equal((await readMigration(database, definition.id)).status, 'running');
    assert.equal((await storeCounts(database)).devices, 1);

    await assert.rejects(runDataMigration(
        database,
        definition,
        context(stage => {
            if (stage === 'after-interrupted-status') throw new Error('stop');
        })
    ), error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED);
    const interrupted = await readMigration(database, definition.id);
    assert.equal(interrupted.status, 'failed');
    assert.equal(interrupted.errorCode, 'MIGRATION_INTERRUPTED');
    assert.equal(interrupted.retryCount, 0);

    writes = 0;
    const completed = await runDataMigration(
        database,
        definition,
        context(null)
    );
    assert.equal(completed.status, 'completed');
    assert.equal(completed.retryCount, 1);
    assert.deepEqual(completed.outputSummary, { recordCount: 1, writes: 0 });
    assert.equal((await storeCounts(database)).devices, 1);

    const repeated = await runDataMigration(
        database,
        definition,
        context(null)
    );
    assert.deepEqual(repeated, completed);
    assert.notEqual(repeated, completed);
    assert.equal((await storeCounts(database)).devices, 1);
    database.close();
});

test('migration summaries preserve special own data keys without pollution', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    const inputSummary = specialSummary('input');
    let outputSummary;
    const inputDescriptors = Object.getOwnPropertyDescriptors(inputSummary);
    const definition = {
        id: 'data-special-summary-keys-v1',
        storeNames: ['devices'],
        inputSummary,
        execute() {
            outputSummary = specialSummary('output');
            return outputSummary;
        }
    };
    const completed = await runDataMigration(database, definition, {
        applicationVersion: 'test-app@migration',
        now: () => FIXED_TIME,
        faultInjector: null
    });

    assertSpecialSummary(inputSummary, 'input', false);
    assertSpecialSummary(outputSummary, 'output', false);
    assert.deepEqual(
        Object.getOwnPropertyDescriptors(inputSummary),
        inputDescriptors
    );
    assertSpecialSummary(completed.inputSummary, 'input', true);
    assertSpecialSummary(completed.outputSummary, 'output', true);
    assert.equal(Object.isFrozen(completed.inputSummary.__proto__), true);
    assert.equal(Object.isFrozen(completed.outputSummary.constructor), true);

    const persisted = await readMigration(database, definition.id);
    assertSpecialSummary(persisted.inputSummary, 'input', false);
    assertSpecialSummary(persisted.outputSummary, 'output', false);
    assert.equal(Object.hasOwn(Object.prototype, 'label'), false);
    assert.equal(Object.hasOwn(Object.prototype, 'recordCount'), false);
    database.close();
});

test('migration summary accessors fail closed without getter execution', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    let getterCalls = 0;
    let executeCalls = 0;
    const accessorSummary = { recordCount: 0 };
    Object.defineProperty(accessorSummary, 'privateValue', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'must-not-run';
        }
    });

    await assert.rejects(runDataMigration(database, {
        id: 'data-accessor-input-v1',
        storeNames: ['devices'],
        inputSummary: accessorSummary,
        execute() {
            executeCalls += 1;
            return { recordCount: 0 };
        }
    }, {
        applicationVersion: 'test-app@migration',
        now: () => FIXED_TIME,
        faultInjector: null
    }), error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED);
    assert.equal(getterCalls, 0);
    assert.equal(executeCalls, 0);
    assert.equal(
        await readMigration(database, 'data-accessor-input-v1'),
        undefined
    );

    await assert.rejects(runDataMigration(database, {
        id: 'data-accessor-output-v1',
        storeNames: ['devices'],
        inputSummary: { recordCount: 0 },
        execute() {
            executeCalls += 1;
            return accessorSummary;
        }
    }, {
        applicationVersion: 'test-app@migration',
        now: () => FIXED_TIME,
        faultInjector: null
    }), error => error.code === STORAGE_ERROR_CODE.MIGRATION_FAILED);
    assert.equal(getterCalls, 0);
    assert.equal(executeCalls, 1);
    assert.equal(
        (await readMigration(database, 'data-accessor-output-v1')).status,
        'failed'
    );
    assert.equal((await storeCounts(database)).devices, 0);
    database.close();
});

test('invalid migration store arrays fail before all database I/O', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB, V2_DATABASE_NAME, V2_DATABASE_VERSION);
    const beforeCounts = await storeCounts(database);
    const beforeMigrations = await readAllMigrations(database);
    let getterCalls = 0;
    let iteratorCalls = 0;
    let forEachCalls = 0;
    let executeCalls = 0;

    const sparse = new Array(1);
    const accessor = ['devices'];
    Object.defineProperty(accessor, '0', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'devices';
        }
    });
    const extra = ['devices'];
    extra.extra = true;
    const symbol = ['devices'];
    symbol[Symbol('extra')] = true;
    const customPrototype = ['devices'];
    Object.setPrototypeOf(customPrototype, { custom: true });
    const throwingProxy = new Proxy(['devices'], {
        ownKeys() {
            throw new Error('synthetic reflection failure');
        }
    });
    const customIterator = ['devices'];
    Object.defineProperty(customIterator, Symbol.iterator, {
        value() {
            iteratorCalls += 1;
            return [][Symbol.iterator]();
        }
    });
    const customForEach = ['devices'];
    Object.defineProperty(customForEach, 'forEach', {
        value() {
            forEachCalls += 1;
        },
        enumerable: true
    });
    const cases = [
        ['unknown', ['unknownStore']],
        ['metadata', ['metadata']],
        ['migrations', ['migrations']],
        ['duplicate', ['devices', 'devices']],
        ['sparse', sparse],
        ['accessor', accessor],
        ['extra', extra],
        ['symbol', symbol],
        ['custom-prototype', customPrototype],
        ['proxy', throwingProxy],
        ['custom-iterator', customIterator],
        ['custom-for-each', customForEach]
    ];
    const originalTransaction = IDBDatabase.prototype.transaction;
    let transactionCalls = 0;
    IDBDatabase.prototype.transaction = function (...args) {
        if (this === database) transactionCalls += 1;
        return originalTransaction.apply(this, args);
    };

    try {
        for (const [label, storeNames] of cases) {
            await assert.rejects(runDataMigration(database, {
                id: `data-invalid-store-${label}-v1`,
                storeNames,
                inputSummary: { recordCount: 0 },
                execute() {
                    executeCalls += 1;
                    return { recordCount: 0 };
                }
            }, {
                applicationVersion: 'test-app@migration',
                now: () => FIXED_TIME,
                faultInjector: null
            }), error => {
                assert.equal(error.code, STORAGE_ERROR_CODE.MIGRATION_FAILED);
                return true;
            });
        }
    } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
    }

    assert.equal(transactionCalls, 0);
    assert.equal(executeCalls, 0);
    assert.equal(getterCalls, 0);
    assert.equal(iteratorCalls, 0);
    assert.equal(forEachCalls, 0);
    assert.deepEqual(await storeCounts(database), beforeCounts);
    assert.deepEqual(await readAllMigrations(database), beforeMigrations);
    database.close();
});
