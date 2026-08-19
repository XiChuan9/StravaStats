import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
    IDBFactory,
    IDBIndex,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import { createImportStore } from '../../js/storage/index.js';

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

async function openCurrent(indexedDB) {
    const request = indexedDB.open('strava-stats-v2');
    return requestResult(request);
}

test('10k sources and 1k lookups use only the bounded compound index', async () => {
    const indexedDB = new IDBFactory();
    const store = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => Date.parse('2026-08-05T01:02:03.004Z'),
        applicationVersion: 'exact-identity-performance@1'
    });
    await store.initialize();
    await store.close();
    const database = await openCurrent(indexedDB);
    const seedTransaction = database.transaction('activitySources', 'readwrite');
    const sources = seedTransaction.objectStore('activitySources');
    for (let index = 0; index < 10_000; index += 1) {
        sources.add({
            id: `source-${index}`,
            provider: 'synthetic-provider',
            externalId: `identity-${index}`
        });
    }
    await transactionDone(seedTransaction);

    const originalStoreGetAll = IDBObjectStore.prototype.getAll;
    const originalIndexGetAll = IDBIndex.prototype.getAll;
    let fullStoreRequests = 0;
    let indexRequests = 0;
    IDBObjectStore.prototype.getAll = function (...args) {
        if (this.name === 'activitySources') fullStoreRequests += 1;
        return originalStoreGetAll.apply(this, args);
    };
    IDBIndex.prototype.getAll = function (...args) {
        if (this.name === 'byProviderAndExternalId') indexRequests += 1;
        return originalIndexGetAll.apply(this, args);
    };

    let results;
    const startedAt = performance.now();
    try {
        const lookupTransaction = database.transaction(
            'activitySources',
            'readonly'
        );
        const identityIndex = lookupTransaction.objectStore('activitySources')
            .index('byProviderAndExternalId');
        const requests = [];
        for (let index = 0; index < 1_000; index += 1) {
            const externalId = index < 500
                ? `identity-${index}`
                : `absent-${index}`;
            requests.push(requestResult(identityIndex.getAll([
                'synthetic-provider',
                externalId
            ])));
        }
        results = await Promise.all(requests);
        await transactionDone(lookupTransaction);
    } finally {
        IDBObjectStore.prototype.getAll = originalStoreGetAll;
        IDBIndex.prototype.getAll = originalIndexGetAll;
        database.close();
    }
    const elapsedMilliseconds = performance.now() - startedAt;
    const materialized = results.reduce((sum, rows) => sum + rows.length, 0);

    assert.equal(fullStoreRequests, 0);
    assert.equal(indexRequests, 1_000);
    assert.equal(materialized, 500);
    assert.ok(results.every(rows => rows.length <= 1));
    assert.ok(elapsedMilliseconds < 5_000);
});
