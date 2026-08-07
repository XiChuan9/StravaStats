import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createImportService, createInlineImportWorker, SYNTHETIC_JSON_MEDIA_TYPE } from '../../js/import/index.js';
import { createImportStore } from '../../js/storage/index.js';
import {
    FIT_START_TIMESTAMP,
    createSyntheticFitActivity,
    syntheticFitDescriptor
} from '../fixtures/synthetic/fit/fit-fixture.js';
import {
    beginImportPerformanceSelection,
    configureImportPerformance,
    finishImportPerformanceSelection,
    readImportPerformanceRecords,
    resetImportPerformanceForTests
} from '../../js/diagnostics/import-performance.js';

test.afterEach(() => resetImportPerformanceForTests());

async function countStoredActivities(importStore) {
    let cursor = null;
    let count = 0;
    while (true) {
        const options = { direction: 'asc', limit: 500 };
        if (cursor !== null) options.cursor = cursor;
        const page = await importStore.listActivities(options);
        count += page.length;
        if (page.length < 500) return count;
        const last = page.at(-1);
        cursor = { startTimeUtc: last.startTimeUtc, id: last.id };
    }
}

test('Import Core contributes fixed stage, decoder, persistence and Worker observations', async () => {
    let time = 0;
    configureImportPerformance({ storage: null, now: () => ++time });
    beginImportPerformanceSelection(1);
    const importStore = createImportStore({
        indexedDB: new IDBFactory(), IDBKeyRange, now: () => 1,
        applicationVersion: 'import-performance-test@1'
    });
    let sequence = 0;
    const core = createImportService({
        importStore, worker: createInlineImportWorker(), crypto: webcrypto,
        createId: kind => `performance-${kind}-${++sequence}`
    });
    await core.initialize();
    const content = await readFile(new URL('../fixtures/synthetic/canonical/import-run-summary.json', import.meta.url), 'utf8');
    const started = await core.importArtifacts([{ mediaType: SYNTHETIC_JSON_MEDIA_TYPE, content }]);
    const report = await core.waitForJob(started.jobId);
    finishImportPerformanceSelection({ outcome: 'completed', terminalCounts: report.totals });
    const [record] = readImportPerformanceRecords();
    assert.equal(record.decoderMilliseconds.sum > 0, true);
    assert.equal(record.persistenceMilliseconds.sum > 0, true);
    assert.equal(record.peakWorkerRequests, 1);
    for (const stage of ['validation', 'hashing', 'decoding', 'normalizing', 'matching', 'persistence']) {
        assert.equal(Number.isFinite(record.stageMilliseconds[stage]), true, stage);
    }
    await core.close();
});

test('1,000 ordinary FIT artifacts complete atomically with descriptive timing only', async t => {
    configureImportPerformance({ storage: null, now: () => performance.now() });
    beginImportPerformanceSelection(1_000);
    const importStore = createImportStore({
        indexedDB: new IDBFactory(), IDBKeyRange, now: () => 1,
        applicationVersion: 'import-performance-1000@1'
    });
    let sequence = 0;
    const core = createImportService({
        importStore, worker: createInlineImportWorker(), crypto: webcrypto,
        createId: kind => `performance-1000-${kind}-${++sequence}`
    });
    await core.initialize();
    const artifacts = Array.from({ length: 1_000 }, (_, index) => syntheticFitDescriptor(
        createSyntheticFitActivity({ start: FIT_START_TIMESTAMP + index * 86_400 })
    ));
    const startedAt = performance.now();
    const started = await core.importArtifacts(artifacts);
    const report = await core.waitForJob(started.jobId);
    const samples = [performance.now() - startedAt].sort((left, right) => left - right);
    const median = samples[Math.floor((samples.length - 1) * 0.5)];
    const p95 = samples[Math.floor((samples.length - 1) * 0.95)];
    finishImportPerformanceSelection({ outcome: 'completed', terminalCounts: report.totals });
    assert.equal(report.totals.total, 1_000);
    assert.equal(
        report.totals.completed
            + report.totals.reviewRequired
            + report.totals.skippedExactDuplicate,
        1_000
    );
    assert.equal(report.totals.failed, 0);
    assert.equal(await countStoredActivities(importStore), 1_000);
    assert.equal(Number.isFinite(median) && Number.isFinite(p95), true);
    t.diagnostic(`1,000 FIT descriptive milliseconds: median=${median.toFixed(1)}, p95=${p95.toFixed(1)}`);
    await core.close();
});
