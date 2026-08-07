import assert from 'node:assert/strict';
import test from 'node:test';

import {
    beginImportPerformanceSelection,
    configureImportPerformance,
    finishImportPerformanceSelection,
    observeImportCancellation,
    readImportPerformanceRecords,
    recordImportPerformanceOperation,
    resetImportPerformanceForTests,
    sanitizeImportPerformanceRecords,
    trackImportWorkerRequest
} from '../../js/diagnostics/import-performance.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); }
    };
}

test.afterEach(() => resetImportPerformanceForTests());

test('one selection produces one closed, identifier-free session aggregate', async () => {
    let time = 10;
    configureImportPerformance({ storage: memoryStorage(), now: () => time });
    beginImportPerformanceSelection(3);
    await recordImportPerformanceOperation('validation', async () => { time += 2; });
    let releaseWorkers;
    const workers = new Promise(resolve => { releaseWorkers = resolve; });
    const requests = [
        trackImportWorkerRequest(async () => workers),
        trackImportWorkerRequest(async () => workers)
    ];
    time += 5;
    releaseWorkers();
    await Promise.all(requests);
    await recordImportPerformanceOperation('persistence', async () => { time += 7; });
    observeImportCancellation();
    time += 11;
    finishImportPerformanceSelection({
        outcome: 'cancelled',
        terminalCounts: {
            completed: 1,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: 0,
            cancelled: 1,
            notStarted: 1
        }
    });

    const [record] = readImportPerformanceRecords();
    assert.deepEqual(Object.keys(record), [
        'version', 'outcome', 'artifactCount', 'terminalCounts',
        'totalMilliseconds', 'stageMilliseconds', 'decoderMilliseconds',
        'persistenceMilliseconds', 'cancellationObservedMilliseconds',
        'peakWorkerRequests'
    ]);
    assert.deepEqual(record.terminalCounts, {
        completed: 1, reviewRequired: 0, skippedExactDuplicate: 0,
        failed: 0, cancelled: 1, notStarted: 1
    });
    assert.equal(record.artifactCount, 3);
    assert.equal(record.outcome, 'cancelled');
    assert.equal(record.stageMilliseconds.validation, 2);
    assert.equal(record.decoderMilliseconds.sum, 10);
    assert.equal(record.decoderMilliseconds.maximum, 5);
    assert.equal(record.persistenceMilliseconds.sum, 7);
    assert.equal(record.persistenceMilliseconds.maximum, 7);
    assert.equal(record.cancellationObservedMilliseconds, 14);
    assert.equal(record.peakWorkerRequests, 2);
    assert.doesNotMatch(JSON.stringify(Object.values(record)), /private|athlete|route|secret/i);
});

test('session records retain only the newest fifty and fall back in memory', () => {
    configureImportPerformance({
        storage: { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); } },
        now: (() => { let value = 0; return () => ++value; })()
    });
    for (let index = 0; index < 55; index += 1) {
        beginImportPerformanceSelection(index + 1);
        finishImportPerformanceSelection({ outcome: 'completed', terminalCounts: { completed: 1 } });
    }
    const records = readImportPerformanceRecords();
    assert.equal(records.length, 50);
    assert.equal(records[0].artifactCount, 6);
    assert.equal(records[49].artifactCount, 55);
});

test('a denied session write keeps the new record in the memory fallback', () => {
    const storage = {
        getItem() { return null; },
        setItem() { throw new Error('synthetic'); }
    };
    configureImportPerformance({ storage, now: () => 2 });
    beginImportPerformanceSelection(2);
    finishImportPerformanceSelection({
        outcome: 'completed',
        terminalCounts: { completed: 2 }
    });

    const records = readImportPerformanceRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0].artifactCount, 2);
});

test('Diagnostics can read the Source Manager session records after navigation', () => {
    const storage = memoryStorage();
    configureImportPerformance({ storage, now: () => 5 });
    beginImportPerformanceSelection(4);
    finishImportPerformanceSelection({
        outcome: 'completed',
        terminalCounts: { completed: 4 }
    });
    resetImportPerformanceForTests();

    const records = readImportPerformanceRecords({ storage });
    assert.equal(records.length, 1);
    assert.equal(records[0].artifactCount, 4);
});

test('export sanitization rejects hostile records without executing getters', () => {
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'version', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 1;
        }
    });
    assert.deepEqual(sanitizeImportPerformanceRecords([hostile]), []);
    assert.equal(getterCalls, 0);
});
