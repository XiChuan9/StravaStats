import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
    IDBFactory,
    IDBIndex,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import {
    createDuplicateReviewMatch,
    createDuplicateReviewTimeRange
} from '../../js/storage/duplicate-review.js';
import { createImportStore } from '../../js/storage/index.js';

const BASE = Date.parse('2026-01-01T00:00:00.000Z');

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

function activity(index) {
    return {
        id: `performance-${String(index).padStart(5, '0')}`,
        sportCategory: index % 2 === 0 ? 'run' : 'ride',
        startTimeUtc: new Date(BASE + index * 300_000).toISOString(),
        distanceMeters: 10_000 + index,
        movingTimeSeconds: 3_000 + index
    };
}

function cursorMatches(index, query, range) {
    return new Promise((resolve, reject) => {
        const matches = [];
        const request = index.openCursor(range, 'next');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor === null || matches.length === 21) {
                resolve(matches);
                return;
            }
            const match = createDuplicateReviewMatch(query, cursor.value);
            if (match !== null) matches.push(match);
            cursor.continue();
        };
    });
}

test('10k summaries and 1k queries use only bounded compound-index cursors', async () => {
    const indexedDB = new IDBFactory();
    const store = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => BASE,
        applicationVersion: 'duplicate-review-performance@1'
    });
    await store.initialize();
    await store.close();
    const database = await requestResult(indexedDB.open('strava-stats-v2'));
    const seed = database.transaction('activities', 'readwrite');
    const activities = seed.objectStore('activities');
    for (let index = 0; index < 10_000; index += 1) {
        activities.add({ activity: activity(index) });
    }
    await transactionDone(seed);

    const originalStoreGetAll = IDBObjectStore.prototype.getAll;
    const originalIndexGetAll = IDBIndex.prototype.getAll;
    const originalOpenCursor = IDBIndex.prototype.openCursor;
    let fullStoreReads = 0;
    let indexGetAllReads = 0;
    let cursorReads = 0;
    IDBObjectStore.prototype.getAll = function (...args) {
        if (this.name === 'activities') fullStoreReads += 1;
        return originalStoreGetAll.apply(this, args);
    };
    IDBIndex.prototype.getAll = function (...args) {
        if (this.name === 'bySportCategoryAndStartTimeUtc') {
            indexGetAllReads += 1;
        }
        return originalIndexGetAll.apply(this, args);
    };
    IDBIndex.prototype.openCursor = function (...args) {
        if (this.name === 'bySportCategoryAndStartTimeUtc') cursorReads += 1;
        return originalOpenCursor.apply(this, args);
    };

    let results;
    const startedAt = performance.now();
    try {
        const transaction = database.transaction('activities', 'readonly');
        const compound = transaction.objectStore('activities')
            .index('bySportCategoryAndStartTimeUtc');
        results = await Promise.all(Array.from({ length: 1_000 }, (_, index) => {
            const query = activity(index * 2);
            const range = createDuplicateReviewTimeRange(IDBKeyRange, query);
            return cursorMatches(compound, query, range);
        }));
        await transactionDone(transaction);
    } finally {
        IDBObjectStore.prototype.getAll = originalStoreGetAll;
        IDBIndex.prototype.getAll = originalIndexGetAll;
        IDBIndex.prototype.openCursor = originalOpenCursor;
        database.close();
    }
    const elapsedMilliseconds = performance.now() - startedAt;

    assert.equal(fullStoreReads, 0);
    assert.equal(indexGetAllReads, 0);
    assert.equal(cursorReads, 1_000);
    assert.ok(results.every(matches => matches.length <= 20));
    assert.ok(elapsedMilliseconds < 5_000);
});
