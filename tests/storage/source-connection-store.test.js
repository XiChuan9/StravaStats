import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBFactory,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    createSourceConnectionStore
} from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-10T01:02:03.004Z');
const SUBJECT_ID = '424242';

function options(indexedDB) {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'source-connection-test@1'
    };
}

function connectedRecord(overrides = {}) {
    return {
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: SUBJECT_ID,
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1,
        ...overrides
    };
}

function transition(overrides = {}) {
    return {
        id: 'source-connection:strava',
        expectedRevision: 1,
        status: 'reconnect_required',
        lastSyncAt: null,
        errorCode: 'AUTHORIZATION_REQUIRED',
        ...overrides
    };
}

function assertStorageError(code, operation) {
    return error => {
        assert.equal(error.code, code);
        assert.equal(error.operation, operation);
        assert.equal(Object.isFrozen(error), true);
        assert.equal(JSON.stringify(error).includes(SUBJECT_ID), false);
        return true;
    };
}

test('SourceConnection factory is lazy, exact, and exposes the frozen C2 surface', async () => {
    let openCalls = 0;
    const indexedDB = {
        open() {
            openCalls += 1;
            throw new Error('must remain lazy');
        }
    };
    const store = createSourceConnectionStore(options(indexedDB));
    assert.equal(openCalls, 0);
    assert.equal(Object.isFrozen(store), true);
    assert.deepEqual(Object.keys(store), [
        'initialize',
        'getConnection',
        'createConnection',
        'transitionConnection',
        'close'
    ]);
    await assert.rejects(
        store.getConnection('strava'),
        assertStorageError(STORAGE_ERROR_CODE.CONNECTION_STALE, 'getConnection')
    );
    assert.equal(openCalls, 0);
    assert.deepEqual(await store.close(), { status: 'closed' });
});

test('factory and record validation fail closed without executing accessors', async () => {
    let getterCalls = 0;
    const accessorOptions = {
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'source-connection-test@1'
    };
    Object.defineProperty(accessorOptions, 'indexedDB', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return new IDBFactory();
        }
    });
    assert.throws(
        () => createSourceConnectionStore(accessorOptions),
        assertStorageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            'createSourceConnectionStore'
        )
    );
    assert.equal(getterCalls, 0);

    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    await store.initialize();
    const accessorRecord = connectedRecord();
    Object.defineProperty(accessorRecord, 'subjectId', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return SUBJECT_ID;
        }
    });
    await assert.rejects(
        store.createConnection(accessorRecord),
        assertStorageError(STORAGE_ERROR_CODE.DATA_INVALID, 'createConnection')
    );
    assert.equal(getterCalls, 0);
    assert.equal(await store.getConnection('strava'), null);
    await store.close();
});

test('create/read returns detached frozen data and enforces immutable single-provider identity', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    assert.deepEqual(await store.initialize(), { status: 'ready' });

    const input = connectedRecord();
    const created = await store.createConnection(input);
    assert.deepEqual(created, input);
    assert.notEqual(created, input);
    assert.equal(Object.isFrozen(created), true);
    input.subjectId = '999999';
    assert.equal((await store.getConnection('strava')).subjectId, SUBJECT_ID);

    await assert.rejects(
        store.createConnection(connectedRecord()),
        assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'createConnection')
    );
    for (const record of [
        connectedRecord({ id: 'source-connection:other' }),
        connectedRecord({ provider: 'other' }),
        connectedRecord({ subjectId: '00042' }),
        connectedRecord({ subjectId: '0' }),
        connectedRecord({ status: 'disconnected' }),
        connectedRecord({ lastSyncAt: '2026-08-10T01:02:03.004Z' }),
        connectedRecord({ errorCode: 'CONNECTION_ERROR' }),
        connectedRecord({ revision: 2 }),
        { ...connectedRecord(), unexpected: true }
    ]) {
        await assert.rejects(
            store.createConnection(record),
            assertStorageError(STORAGE_ERROR_CODE.DATA_INVALID, 'createConnection')
        );
    }
    await assert.rejects(
        store.getConnection('other'),
        assertStorageError(STORAGE_ERROR_CODE.DATA_INVALID, 'getConnection')
    );
    await store.close();
});

test('legal transitions compare revisions and preserve tombstone identity and sync history', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    await store.initialize();
    await store.createConnection(connectedRecord());

    const reconnect = await store.transitionConnection(transition());
    assert.deepEqual(reconnect, connectedRecord({
        status: 'reconnect_required',
        errorCode: 'AUTHORIZATION_REQUIRED',
        revision: 2
    }));
    const connected = await store.transitionConnection(transition({
        expectedRevision: 2,
        status: 'connected',
        errorCode: null
    }));
    assert.equal(connected.revision, 3);
    const synced = await store.transitionConnection(transition({
        expectedRevision: 3,
        status: 'connected',
        lastSyncAt: '2026-08-10T02:03:04.005Z',
        errorCode: null
    }));
    assert.equal(synced.lastSyncAt, '2026-08-10T02:03:04.005Z');
    const errored = await store.transitionConnection(transition({
        expectedRevision: 4,
        status: 'error',
        lastSyncAt: synced.lastSyncAt,
        errorCode: 'CONNECTION_ERROR'
    }));
    assert.equal(errored.revision, 5);
    const disconnected = await store.transitionConnection(transition({
        expectedRevision: 5,
        status: 'disconnected',
        lastSyncAt: synced.lastSyncAt,
        errorCode: 'REVOCATION_UNCONFIRMED'
    }));
    assert.deepEqual(disconnected, connectedRecord({
        status: 'disconnected',
        lastSyncAt: synced.lastSyncAt,
        errorCode: 'REVOCATION_UNCONFIRMED',
        revision: 6
    }));
    const restored = await store.transitionConnection(transition({
        expectedRevision: 6,
        status: 'connected',
        lastSyncAt: synced.lastSyncAt,
        errorCode: null
    }));
    assert.equal(restored.subjectId, SUBJECT_ID);
    assert.equal(restored.lastSyncAt, synced.lastSyncAt);
    assert.equal(restored.revision, 7);
    await store.close();
});

test('illegal transitions, stale revision, and decreasing sync fail atomically', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    await store.initialize();
    await store.createConnection(connectedRecord());
    await store.transitionConnection(transition({
        status: 'connected',
        lastSyncAt: '2026-08-10T02:03:04.005Z',
        errorCode: null
    }));

    for (const input of [
        transition({ expectedRevision: 1 }),
        transition({ expectedRevision: 2, status: 'connected', lastSyncAt: null, errorCode: null }),
        transition({ expectedRevision: 2, status: 'connected', lastSyncAt: '2026-08-10T01:03:04.005Z', errorCode: null }),
        transition({ expectedRevision: 2, status: 'reconnect_required', lastSyncAt: null }),
        transition({ expectedRevision: 2, status: 'error', lastSyncAt: '2026-08-10T02:03:04.005Z', errorCode: 'AUTHORIZATION_REQUIRED' }),
        transition({ expectedRevision: 2, status: 'syncing', lastSyncAt: '2026-08-10T02:03:04.005Z', errorCode: null }),
        { ...transition({ expectedRevision: 2 }), subjectId: SUBJECT_ID }
    ]) {
        await assert.rejects(store.transitionConnection(input), error => {
            assert.ok([
                STORAGE_ERROR_CODE.DATA_INVALID,
                STORAGE_ERROR_CODE.CONFLICT
            ].includes(error.code));
            assert.equal(error.operation, 'transitionConnection');
            return true;
        });
    }
    const persisted = await store.getConnection('strava');
    assert.equal(persisted.revision, 2);
    assert.equal(persisted.status, 'connected');
    assert.equal(persisted.lastSyncAt, '2026-08-10T02:03:04.005Z');
    await store.close();
});

test('missing and malformed persisted records fail without leaking record details', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    await store.initialize();
    await assert.rejects(
        store.transitionConnection(transition()),
        assertStorageError(STORAGE_ERROR_CODE.NOT_FOUND, 'transitionConnection')
    );
    await store.close();

    const request = indexedDB.open('strava-stats-v2', 6);
    const database = await new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('sourceConnections', 'readwrite');
    transaction.objectStore('sourceConnections').put({
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: SUBJECT_ID,
        status: 'connected',
        lastSyncAt: null,
        errorCode: 'synthetic-private-provider-message',
        revision: 1
    });
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    const reopened = createSourceConnectionStore(options(indexedDB));
    await reopened.initialize();
    await assert.rejects(
        reopened.getConnection('strava'),
        assertStorageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, 'getConnection')
    );
    await reopened.close();
});

test('an unexpected persisted key poisons the strict single-slot boundary', async () => {
    const indexedDB = new IDBFactory();
    const initialized = createSourceConnectionStore(options(indexedDB));
    await initialized.initialize();
    await initialized.close();

    const request = indexedDB.open('strava-stats-v2', 6);
    const database = await new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('sourceConnections', 'readwrite');
    transaction.objectStore('sourceConnections').add({
        id: 'synthetic-unexpected-key',
        provider: 'synthetic-unexpected-provider',
        subjectId: SUBJECT_ID,
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1
    });
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    const reopened = createSourceConnectionStore(options(indexedDB));
    await reopened.initialize();
    for (const [operation, action] of [
        ['getConnection', () => reopened.getConnection('strava')],
        ['createConnection', () => reopened.createConnection(connectedRecord())],
        ['transitionConnection', () => reopened.transitionConnection(transition())]
    ]) {
        await assert.rejects(
            action(),
            assertStorageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, operation)
        );
    }
    await reopened.close();
});

test('quota failures abort create and transition without partial state', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceConnectionStore(options(indexedDB));
    await store.initialize();
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
        if (this.name === 'sourceConnections') {
            throw Object.freeze({
                name: 'QuotaExceededError',
                message: 'synthetic private quota detail'
            });
        }
        return originalAdd.apply(this, args);
    };
    try {
        await assert.rejects(
            store.createConnection(connectedRecord()),
            assertStorageError(
                STORAGE_ERROR_CODE.QUOTA_EXCEEDED,
                'createConnection'
            )
        );
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
    }
    assert.equal(await store.getConnection('strava'), null);
    await store.createConnection(connectedRecord());

    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'sourceConnections') {
            throw Object.freeze({
                name: 'QuotaExceededError',
                message: 'synthetic private quota detail'
            });
        }
        return originalPut.apply(this, args);
    };
    try {
        await assert.rejects(
            store.transitionConnection(transition()),
            assertStorageError(
                STORAGE_ERROR_CODE.QUOTA_EXCEEDED,
                'transitionConnection'
            )
        );
    } finally {
        IDBObjectStore.prototype.put = originalPut;
    }
    assert.deepEqual(await store.getConnection('strava'), connectedRecord());
    await store.close();
});
