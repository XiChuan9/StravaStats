import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    IDBFactory,
    IDBKeyRange
} from 'fake-indexeddb';

const FIXED_TIME = Date.parse('2026-08-04T04:05:06.007Z');

function options(indexedDB) {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'boundary-test@1'
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

async function createSyntheticSentinel(indexedDB) {
    const database = await openDatabase(
        indexedDB,
        'synthetic-independent-sentinel',
        1,
        (created, transaction) => {
            const store = created.createObjectStore('sentinelEntries', {
                keyPath: 'key'
            });
            store.createIndex('byRevision', 'revision', { unique: true });
            store.add({
                key: 'unchanged',
                value: 'synthetic-only',
                revision: 7
            });
            assert.equal(transaction.mode, 'versionchange');
        }
    );
    database.close();
}

async function readSyntheticSentinel(indexedDB) {
    const database = await openDatabase(
        indexedDB,
        'synthetic-independent-sentinel',
        1
    );
    const transaction = database.transaction('sentinelEntries', 'readonly');
    const store = transaction.objectStore('sentinelEntries');
    const storeDescriptor = {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames).map(name => {
            const index = store.index(name);
            return {
                name,
                keyPath: index.keyPath,
                unique: index.unique,
                multiEntry: index.multiEntry
            };
        })
    };
    const countPromise = requestResult(store.count());
    const recordsPromise = requestResult(store.getAll());
    const count = await countPromise;
    const records = await recordsPromise;
    await transactionDone(transaction);
    const snapshot = {
        version: database.version,
        stores: Array.from(database.objectStoreNames),
        store: storeDescriptor,
        count,
        recordBytes: records.map(record => (
            Buffer.from(JSON.stringify(record)).toString('hex')
        ))
    };
    database.close();
    return snapshot;
}

test('public import is side-effect free and exports exactly the frozen API', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    let getterCalls = 0;
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        get() {
            getterCalls += 1;
            throw new Error('global IndexedDB must not be read during import');
        }
    });

    let storageModule;
    try {
        storageModule = await import(
            '../../js/storage/index.js?zero-io-boundary'
        );
    } finally {
        if (original) {
            Object.defineProperty(globalThis, 'indexedDB', original);
        } else {
            delete globalThis.indexedDB;
        }
    }

    assert.equal(getterCalls, 0);
    assert.deepEqual(Object.keys(storageModule).sort(), [
        'STORAGE_ERROR_CODE',
        'StorageError',
        'V2_DATABASE_NAME',
        'V2_DATABASE_VERSION',
        'V2_SCHEMA',
        'createCanonicalStore'
    ]);
    assert.equal(Object.isFrozen(storageModule.STORAGE_ERROR_CODE), true);
    assert.equal(Object.isFrozen(storageModule.V2_SCHEMA), true);
});

test('factory data methods require ready state and perform zero implicit I/O', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    let openCalls = 0;
    const indexedDB = {
        open() {
            openCalls += 1;
            throw new Error('B2 skeleton must not open storage');
        }
    };

    const storage = createCanonicalStore(options(indexedDB));
    assert.equal(Object.isFrozen(storage), true);
    assert.deepEqual(Object.keys(storage), [
        'initialize',
        'putBundle',
        'getBundle',
        'listActivities',
        'createBackupManifest',
        'close'
    ]);
    assert.equal(openCalls, 0);

    for (const [method, args] of [
        ['putBundle', [{ activityId: 'synthetic' }]],
        ['getBundle', ['synthetic']],
        ['listActivities', [{}]],
        ['createBackupManifest', []]
    ]) {
        await assert.rejects(storage[method](...args), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
            assert.equal(error.operation, method);
            assert.equal(Object.isFrozen(error), true);
            return true;
        });
    }
    assert.equal(openCalls, 0);
    const closed = await storage.close();
    assert.deepEqual(closed, { status: 'closed' });
    assert.equal(Object.isFrozen(closed), true);
});

test('factory options fail closed without executing accessors or throwing Proxy traps', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    let getterCalls = 0;
    const accessorOptions = {
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'boundary-test@1'
    };
    Object.defineProperty(accessorOptions, 'indexedDB', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return new IDBFactory();
        }
    });

    assert.throws(() => createCanonicalStore(accessorOptions), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.INVALID_REQUEST);
        assert.equal(error.operation, 'createCanonicalStore');
        return true;
    });
    assert.equal(getterCalls, 0);

    const throwingProxy = new Proxy({}, {
        ownKeys() {
            throw new Error('sensitive reflection failure');
        }
    });
    assert.throws(() => createCanonicalStore(throwingProxy), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.INVALID_REQUEST);
        assert.equal(
            JSON.stringify(error).includes('sensitive reflection failure'),
            false
        );
        return true;
    });
});

test('StorageError is immutable, detached, and never retains unsafe details', async () => {
    const {
        STORAGE_ERROR_CODE,
        StorageError
    } = await import('../../js/storage/index.js');
    const marker = 'Token private-activity-id precise-location';
    const unsafe = new StorageError(STORAGE_ERROR_CODE.OPEN_FAILED, {
        operation: 'initialize',
        retryable: true,
        cause: new Error(marker)
    });

    assert.equal(unsafe.code, STORAGE_ERROR_CODE.INVALID_REQUEST);
    assert.equal(Object.hasOwn(unsafe, 'cause'), false);
    assert.equal(JSON.stringify(unsafe).includes(marker), false);
    assert.equal(Object.isFrozen(unsafe), true);

    const safe = new StorageError(STORAGE_ERROR_CODE.OPEN_FAILED, {
        operation: 'initialize',
        retryable: true
    });
    const json = safe.toJSON();
    assert.deepEqual(json, {
        name: 'StorageError',
        code: 'OPEN_FAILED',
        message: 'The storage database could not be opened.',
        operation: 'initialize',
        retryable: true
    });
    assert.equal(Object.isFrozen(json), true);
    assert.notEqual(safe.toJSON(), json);
});

test('blocked requests remain pending and cancelled late success is closed before rejection', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    const request = {
        error: null,
        result: null,
        transaction: null,
        onblocked: null,
        onupgradeneeded: null,
        onerror: null,
        onsuccess: null
    };
    const indexedDB = {
        open() {
            return request;
        }
    };
    const storage = createCanonicalStore(options(indexedDB));
    const initialization = storage.initialize();

    request.onblocked();
    const state = await Promise.race([
        initialization.then(
            () => 'settled',
            () => 'settled'
        ),
        new Promise(resolve => setImmediate(() => resolve('pending')))
    ]);
    assert.equal(state, 'pending');

    const closing = storage.close();
    assert.equal(await Promise.race([
        closing.then(() => 'settled'),
        Promise.resolve('pending')
    ]), 'pending');
    let closeCalls = 0;
    request.result = {
        onversionchange: null,
        close() {
            closeCalls += 1;
        }
    };
    request.onsuccess();
    await assert.rejects(initialization, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
        return true;
    });
    assert.deepEqual(await closing, { status: 'closed' });
    assert.equal(closeCalls, 1);
});

test('cancelled late error settles close and permits explicit reinitialization', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    const firstRequest = {
        error: null,
        result: null,
        transaction: null,
        onblocked: null,
        onupgradeneeded: null,
        onerror: null,
        onsuccess: null
    };
    const realFactory = new IDBFactory();
    let calls = 0;
    const storage = createCanonicalStore(options({
        open(name, version) {
            calls += 1;
            return calls === 1
                ? firstRequest
                : realFactory.open(name, version);
        }
    }));
    const initialization = storage.initialize();
    const firstClose = storage.close();
    assert.equal(firstClose, storage.close());

    firstRequest.error = {
        name: 'AbortError',
        message: 'synthetic late private detail'
    };
    firstRequest.onerror();
    await assert.rejects(initialization, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
        assert.equal(JSON.stringify(error).includes('private detail'), false);
        return true;
    });
    assert.deepEqual(await firstClose, { status: 'closed' });
    await storage.initialize();
    await storage.close();
});

test('terminal open errors map by safe name and redact platform messages', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    const marker = 'Token athlete-999 private payload';
    for (const [name, expectedCode] of [
        ['VersionError', STORAGE_ERROR_CODE.VERSION_UNSUPPORTED],
        ['QuotaExceededError', STORAGE_ERROR_CODE.QUOTA_EXCEEDED],
        ['ConstraintError', STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION],
        ['UnknownError', STORAGE_ERROR_CODE.OPEN_FAILED]
    ]) {
        const request = {
            error: null,
            result: null,
            transaction: null,
            onblocked: null,
            onupgradeneeded: null,
            onerror: null,
            onsuccess: null
        };
        const storage = createCanonicalStore(options({
            open() {
                return request;
            }
        }));
        const initialization = storage.initialize();
        request.error = { name, message: marker };
        request.onerror();

        await assert.rejects(initialization, error => {
            assert.equal(error.code, expectedCode);
            assert.equal(JSON.stringify(error).includes(marker), false);
            assert.equal(Object.hasOwn(error, 'cause'), false);
            return true;
        });
    }
});

test('blocked maps only after a terminal platform error', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    const request = {
        error: null,
        result: null,
        transaction: null,
        onblocked: null,
        onupgradeneeded: null,
        onerror: null,
        onsuccess: null
    };
    const storage = createCanonicalStore(options({
        open() {
            return request;
        }
    }));
    const initialization = storage.initialize();
    request.onblocked();
    request.error = { name: 'AbortError', message: 'private blocked detail' };
    request.onerror();

    await assert.rejects(initialization, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.OPEN_BLOCKED);
        assert.equal(error.retryable, true);
        assert.equal(JSON.stringify(error).includes('private blocked detail'), false);
        return true;
    });
});

test('V2 success and failure preserve a same-realm synthetic Legacy sentinel', async () => {
    const {
        STORAGE_ERROR_CODE,
        createCanonicalStore
    } = await import('../../js/storage/index.js');
    const indexedDB = new IDBFactory();
    await createSyntheticSentinel(indexedDB);
    const before = await readSyntheticSentinel(indexedDB);

    const initialized = createCanonicalStore(options(indexedDB));
    await initialized.initialize();
    await initialized.close();
    assert.deepEqual(await readSyntheticSentinel(indexedDB), before);

    const cancelled = createCanonicalStore(options(indexedDB));
    const initialization = cancelled.initialize();
    const closing = cancelled.close();
    await assert.rejects(initialization, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONNECTION_STALE);
        return true;
    });
    await closing;

    const after = await readSyntheticSentinel(indexedDB);
    assert.deepEqual(after, before);
    assert.deepEqual(after, {
        version: 1,
        stores: ['sentinelEntries'],
        store: {
            keyPath: 'key',
            autoIncrement: false,
            indexes: [{
                name: 'byRevision',
                keyPath: 'revision',
                unique: true,
                multiEntry: false
            }]
        },
        count: 1,
        recordBytes: [Buffer.from(JSON.stringify({
            key: 'unchanged',
            value: 'synthetic-only',
            revision: 7
        })).toString('hex')]
    });
});

test('production storage sources contain no destructive or Legacy boundary', async () => {
    const sourceFiles = [
        'constants.js',
        'errors.js',
        'schema.js',
        'migrations.js',
        'database.js',
        'transaction.js',
        'canonical-store.js',
        'backup-manifest.js',
        'index.js'
    ];
    const sources = await Promise.all(sourceFiles.map(async file => ({
        file,
        source: await readFile(
            new URL(`../../js/storage/${file}`, import.meta.url),
            'utf8'
        )
    })));

    for (const { file, source } of sources) {
        assert.equal(
            source.includes('strava-dashboard-cache'),
            false,
            `${file} must not name the Legacy database`
        );
        assert.equal(
            source.includes('deleteDatabase'),
            false,
            `${file} must not expose database deletion`
        );
        assert.equal(
            /\.clear\s*\(/.test(source),
            false,
            `${file} must not clear object stores`
        );
        assert.equal(
            /from\s+['"]\.\.\/(?:repository|services|pages|tabs|analysis)\//.test(source),
            false,
            `${file} must not import a consumer or Legacy boundary`
        );
    }
});
