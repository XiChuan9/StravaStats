import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBFactory,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    StorageError,
    V2_DATABASE_NAME,
    createCanonicalStore
} from '../../js/storage/index.js';
import { runTransaction } from '../../js/storage/transaction.js';

const FIXED_TIME = Date.parse('2026-08-04T08:09:10.011Z');

function options(indexedDB) {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'transaction-test@1'
    };
}

function openDatabase(indexedDB) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(V2_DATABASE_NAME, 1);
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

async function deviceCount(database) {
    const transaction = database.transaction('devices', 'readonly');
    return requestResult(transaction.objectStore('devices').count());
}

function transactionOptions(mode = 'readwrite') {
    return {
        storeNames: ['devices'],
        mode,
        operation: 'putBundle'
    };
}

test('runTransaction aborts queued writes after a synchronous mid-queue failure', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB);

    await assert.rejects(runTransaction(
        database,
        transactionOptions(),
        context => {
            context.add('devices', { id: 'synthetic-queued-device' });
            throw new Error('synthetic private queue detail');
        }
    ), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.TRANSACTION_ABORTED);
        assert.equal(JSON.stringify(error).includes('private queue detail'), false);
        return true;
    });
    assert.equal(await deviceCount(database), 0);
    database.close();
});

test('hostile thrown values map safely while issued StorageError keeps semantics', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB);
    const secret = 'synthetic-secret-error-message';
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const throwingPrototype = new Proxy({}, {
        getPrototypeOf() {
            throw new Error(secret);
        }
    });
    const throwingName = {};
    Object.defineProperty(throwingName, 'name', {
        get() {
            throw new Error(secret);
        }
    });
    const issuedConflict = new StorageError(STORAGE_ERROR_CODE.CONFLICT, {
        operation: 'putBundle',
        retryable: false
    });
    const proxiedConflict = new Proxy(issuedConflict, {});

    for (const thrown of [
        revoked.proxy,
        throwingPrototype,
        throwingName,
        proxiedConflict
    ]) {
        await assert.rejects(runTransaction(
            database,
            transactionOptions(),
            () => {
                throw thrown;
            }
        ), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.TRANSACTION_ABORTED);
            assert.equal(Object.isFrozen(error), true);
            assert.equal(JSON.stringify(error).includes(secret), false);
            assert.notEqual(error, thrown);
            return true;
        });
    }

    await assert.rejects(runTransaction(
        database,
        transactionOptions(),
        () => {
            throw issuedConflict;
        }
    ), error => {
        assert.equal(error, issuedConflict);
        assert.equal(error.code, STORAGE_ERROR_CODE.CONFLICT);
        assert.equal(Object.isFrozen(error), true);
        return true;
    });

    for (const [name, code] of [
        ['QuotaExceededError', STORAGE_ERROR_CODE.QUOTA_EXCEEDED],
        ['ConstraintError', STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION]
    ]) {
        const platformError = Object.freeze({ name, message: secret });
        await assert.rejects(runTransaction(
            database,
            transactionOptions(),
            () => {
                throw platformError;
            }
        ), error => {
            assert.equal(error.code, code);
            assert.equal(Object.isFrozen(error), true);
            assert.equal(JSON.stringify(error).includes(secret), false);
            return true;
        });
    }
    assert.equal(await deviceCount(database), 0);
    database.close();
});

test('runTransaction maps constraint failure and rolls back the whole transaction', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB);

    await runTransaction(database, transactionOptions(), context => {
        context.add('devices', { id: 'synthetic-existing-device' });
        return () => 'committed';
    });
    await assert.rejects(runTransaction(
        database,
        transactionOptions(),
        context => {
            context.add('devices', { id: 'synthetic-second-device' });
            context.add('devices', { id: 'synthetic-existing-device' });
            return () => 'must-not-resolve';
        }
    ), error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION);
        return true;
    });
    assert.equal(await deviceCount(database), 1);
    database.close();
});

test('runTransaction maps synchronous quota failure without partial output', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB);
    const originalAdd = IDBObjectStore.prototype.add;

    IDBObjectStore.prototype.add = function (...args) {
        if (this.name === 'devices') {
            throw new DOMException('synthetic private quota', 'QuotaExceededError');
        }
        return originalAdd.apply(this, args);
    };
    try {
        await assert.rejects(runTransaction(
            database,
            transactionOptions(),
            context => {
                context.add('devices', { id: 'synthetic-quota-device' });
                return () => 'must-not-resolve';
            }
        ), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.QUOTA_EXCEEDED);
            assert.equal(JSON.stringify(error).includes('private quota'), false);
            return true;
        });
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
    }
    assert.equal(await deviceCount(database), 0);
    database.close();
});

test('runTransaction resolves only after complete and after-read writes settle', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await storage.close();
    const database = await openDatabase(indexedDB);
    const events = [];

    const result = await runTransaction(
        database,
        transactionOptions(),
        context => {
            const existing = context.get('devices', 'synthetic-after-read');
            context.afterReads(() => {
                events.push('reads');
                assert.equal(existing.read(), undefined);
                context.add('devices', { id: 'synthetic-after-read' });
            });
            return () => {
                events.push('complete');
                return Object.freeze({ status: 'complete' });
            };
        }
    );
    assert.deepEqual(events, ['reads', 'complete']);
    assert.deepEqual(result, { status: 'complete' });
    assert.equal(await deviceCount(database), 1);
    database.close();
});

test('complete-before-request-result fails closed and exposes no raw handles', async () => {
    const request = {
        result: { id: 'synthetic-late-result' },
        error: null,
        onsuccess: null,
        onerror: null
    };
    const transaction = {
        error: null,
        onerror: null,
        onabort: null,
        oncomplete: null,
        objectStore() {
            return {
                get() {
                    return request;
                }
            };
        },
        abort() {}
    };
    const database = {
        transaction() {
            return transaction;
        }
    };
    const operation = runTransaction(
        database,
        transactionOptions('readonly'),
        context => {
            const record = context.get('devices', 'synthetic-late-result');
            return () => record.read();
        }
    );

    transaction.oncomplete();
    request.onsuccess();
    await assert.rejects(operation, error => {
        assert.equal(error.code, STORAGE_ERROR_CODE.TRANSACTION_ABORTED);
        assert.equal(Object.hasOwn(error, 'transaction'), false);
        assert.equal(Object.hasOwn(error, 'request'), false);
        return true;
    });
});

test('transaction options reject unsafe or unknown stores before database I/O', async () => {
    let transactionCalls = 0;
    const database = {
        transaction() {
            transactionCalls += 1;
            throw new Error('must not run');
        }
    };
    for (const storeNames of [
        [],
        ['unknownStore'],
        ['devices', 'devices'],
        new Array(1)
    ]) {
        await assert.rejects(runTransaction(database, {
            storeNames,
            mode: 'readonly',
            operation: 'getBundle'
        }, () => () => null), error => {
            assert.equal(error.code, STORAGE_ERROR_CODE.INVALID_REQUEST);
            return true;
        });
    }
    assert.equal(transactionCalls, 0);
});
