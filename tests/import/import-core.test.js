import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';

import {
    IMPORT_ERROR_CODE,
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { ACTIVITIES_CSV_MEDIA_TYPE } from '../../js/import/activities-csv-decoder.js';
import { createCanonicalStore, createImportStore } from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-05T01:02:03.004Z');
const fixtureUrl = new URL(
    '../fixtures/synthetic/canonical/import-run-summary.json',
    import.meta.url
);
const csvFixtureUrl = new URL(
    '../fixtures/synthetic/strava/activities.csv',
    import.meta.url
);

function ids() {
    let sequence = 0;
    return kind => `opaque-${kind}-${++sequence}`;
}

function store(indexedDB, overrides = {}) {
    return createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'import-core-test@1',
        ...overrides
    });
}

function service(importStore, overrides = {}) {
    return createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids(),
        ...overrides
    });
}

async function artifact() {
    return {
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content: await readFile(fixtureUrl, 'utf8')
    };
}

async function csvArtifact(content = null) {
    return {
        mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
        content: content ?? await readFile(csvFixtureUrl, 'utf8')
    };
}

test('activities.csv lexical failure happens before job creation', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    await assert.rejects(
        core.importArtifacts([await csvArtifact(
            'Activity ID,Activity Date,Activity Type\nopaque,"unterminated,Run'
        )]),
        error => error.code === IMPORT_ERROR_CODE.CSV_MALFORMED
    );
    assert.deepEqual(await importStore.listImportJobs(), []);
    assert.equal((await core.previewActivities()).total, 0);
    await core.close();
});

test('activities.csv expands rows into durable ImportItems and summary-only preview', async () => {
    const indexedDB = new IDBFactory();
    const firstStore = store(indexedDB);
    const first = service(firstStore);
    await first.initialize();
    const run = await first.importArtifacts([await csvArtifact()]);
    const report = await first.waitForJob(run.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.deepEqual(report.totals, {
        total: 2,
        completed: 2,
        skippedExactDuplicate: 0,
        failed: 0,
        cancelled: 0
    });
    assert.equal((await firstStore.listImportItems(run.jobId)).length, 2);
    assert.deepEqual(await first.previewActivities(), {
        total: 2,
        bySportCategory: [
            { sportCategory: 'other', count: 1 },
            { sportCategory: 'run', count: 1 }
        ]
    });
    assert.doesNotMatch(
        JSON.stringify(report),
        /00042|alpha\/beta|Synthetic Run|Average Heart Rate/
    );
    await first.close();

    const canonical = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'csv-readback@1'
    });
    await canonical.initialize();
    const bundle = await canonical.getBundle('strava-archive:00042');
    assert.deepEqual(bundle.streams.series, []);
    assert.deepEqual(bundle.laps, []);
    assert.deepEqual(bundle.events, []);
    assert.deepEqual(bundle.devices, []);
    assert.equal(bundle.activity.capabilities.hasHeartRate, false);
    assert.equal(bundle.activity.capabilities.hasPower, false);
    assert.ok(bundle.warnings.some(warning => (
        warning.code === 'CSV_EXTRA_HEADER_IGNORED'
    )));
    await canonical.close();

    const reloadedStore = store(indexedDB);
    const reloaded = service(reloadedStore);
    await reloaded.initialize();
    assert.deepEqual(await reloaded.getReport(run.jobId), report);
    assert.equal((await reloaded.previewActivities()).total, 2);
    await reloaded.close();
});

test('activities.csv semantic row failure is isolated between successful rows', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const content = 'Activity ID,Activity Date,Activity Type,Distance\n'
        + 'valid-left,2026-01-01T00:00:00Z,Run,1\n'
        + 'invalid-middle,2026-02-30T00:00:00Z,Run,2\n'
        + 'valid-right,2026-01-03T00:00:00Z,Ride,3';
    const run = await core.importArtifacts([await csvArtifact(content)]);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal(report.totals.total, 3);
    assert.equal(report.totals.completed, 2);
    assert.equal(report.totals.failed, 1);
    assert.equal(report.items[1].errorCode, IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('repeated and concurrent CSV imports preserve exact row SHA idempotency', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const input = await csvArtifact();
    const [left, right] = await Promise.all([
        core.importArtifacts([input]),
        core.importArtifacts([input])
    ]);
    const reports = await Promise.all([
        core.waitForJob(left.jobId),
        core.waitForJob(right.jobId)
    ]);
    assert.equal(
        reports.reduce((sum, report) => sum + report.totals.completed, 0),
        2
    );
    assert.equal(
        reports.reduce((sum, report) => (
            sum + report.totals.skippedExactDuplicate
        ), 0),
        2
    );
    const repeated = await core.importArtifacts([input]);
    assert.equal(
        (await core.waitForJob(repeated.jobId)).totals.skippedExactDuplicate,
        2
    );
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('same Strava identity with lexically different raw row fails without merge', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const header = 'Activity ID,Activity Date,Activity Type,Distance';
    const first = await core.importArtifacts([await csvArtifact(
        `${header}\nopaque-same,2026-01-01T00:00:00Z,Run,1`
    )]);
    assert.equal((await core.waitForJob(first.jobId)).totals.completed, 1);
    const second = await core.importArtifacts([await csvArtifact(
        `${header}\nopaque-same,2026-01-01T00:00:00Z,"Run",1`
    )]);
    const report = await core.waitForJob(second.jobId);
    assert.equal(report.totals.failed, 1);
    assert.equal(
        report.items[0].errorCode,
        IMPORT_ERROR_CODE.EXACT_IDENTITY_CONFLICT
    );
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('CSV Worker crash is persisted and explicit retry processes every framed row', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const inline = createInlineImportWorker();
    let calls = 0;
    const worker = {
        async process(input) {
            calls += 1;
            if (calls === 1) throw new Error(`private ${input.content}`);
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const core = service(importStore, { worker });
    await core.initialize();
    const run = await core.importArtifacts([await csvArtifact()]);
    let report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'failed_decode');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.WORKER_CRASHED);
    assert.doesNotMatch(JSON.stringify(report), /00042|Synthetic Run|private/);
    await core.retryJob(run.jobId);
    report = await core.waitForJob(run.jobId);
    assert.equal(report.totals.completed, 2);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('CSV cancellation retains no unfinished row and performs no Canonical write', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const inline = createInlineImportWorker();
    let release;
    let reached;
    const gate = new Promise(resolve => { release = resolve; });
    const reachedGate = new Promise(resolve => { reached = resolve; });
    let first = true;
    const worker = {
        async process(input) {
            if (first) {
                first = false;
                reached();
                await gate;
            }
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const core = service(importStore, { worker });
    await core.initialize();
    const run = await core.importArtifacts([await csvArtifact()]);
    await reachedGate;
    assert.deepEqual(await core.cancelJob(run.jobId), {
        status: 'cancellation-requested'
    });
    release();
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'cancelled');
    assert.equal(report.totals.cancelled, 2);
    assert.equal((await core.previewActivities()).total, 0);
    await core.close();
});

test('Synthetic JSON persists job, item, raw artifact, Canonical graph, report and reload preview', async () => {
    const indexedDB = new IDBFactory();
    const firstStore = store(indexedDB);
    const first = service(firstStore);
    await first.initialize();
    const run = await first.importArtifacts([await artifact()]);
    const report = await first.waitForJob(run.jobId);
    assert.deepEqual(report.totals, {
        total: 1,
        completed: 1,
        skippedExactDuplicate: 0,
        failed: 0,
        cancelled: 0
    });
    assert.equal(report.status, 'completed');
    assert.doesNotMatch(JSON.stringify(report), /opaque-|synthetic-import-activity|Five Kilometre/);
    assert.deepEqual(await first.previewActivities(), {
        total: 1,
        bySportCategory: [{ sportCategory: 'run', count: 1 }]
    });
    await first.close();

    const reloadedStore = store(indexedDB);
    const reloaded = service(reloadedStore);
    await reloaded.initialize();
    assert.deepEqual(await reloaded.getReport(run.jobId), report);
    assert.deepEqual(await reloaded.previewActivities(), {
        total: 1,
        bySportCategory: [{ sportCategory: 'run', count: 1 }]
    });
    assert.equal((await reloadedStore.listImportJobs()).length, 1);
    await reloaded.close();
});

test('one or ten identical imports produce exactly one activity', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const input = await artifact();
    const reports = [];
    for (let index = 0; index < 10; index += 1) {
        const run = await core.importArtifacts([input]);
        reports.push(await core.waitForJob(run.jobId));
    }
    assert.equal(reports[0].totals.completed, 1);
    assert.equal(reports.slice(1).every(value => (
        value.totals.skippedExactDuplicate === 1
    )), true);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('concurrent exact imports serialize to one Canonical activity', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const input = await artifact();
    const [left, right] = await Promise.all([
        core.importArtifacts([input]),
        core.importArtifacts([input])
    ]);
    const reports = await Promise.all([
        core.waitForJob(left.jobId),
        core.waitForJob(right.jobId)
    ]);
    assert.equal(reports.reduce((sum, value) => (
        sum + value.totals.completed + value.totals.skippedExactDuplicate
    ), 0), 2);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('a bad item is isolated and a later item commits', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const run = await core.importArtifacts([
        { mediaType: SYNTHETIC_JSON_MEDIA_TYPE, content: '{bad' },
        await artifact()
    ]);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.failed, 1);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('worker crash is redacted, persisted, and explicitly retryable', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    let calls = 0;
    const worker = {
        async process(input) {
            calls += 1;
            if (calls === 1) throw new Error(`secret ${input.content}`);
            return createInlineImportWorker().process(input);
        },
        close() {}
    };
    const core = service(importStore, { worker });
    await core.initialize();
    const run = await core.importArtifacts([await artifact()]);
    let report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'failed_decode');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.WORKER_CRASHED);
    assert.doesNotMatch(JSON.stringify(report), /secret|Five Kilometre/);
    await core.retryJob(run.jobId);
    report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed');
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('multi-item Worker crash retries every persisted unfinished item idempotently', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    let calls = 0;
    const inline = createInlineImportWorker();
    const worker = {
        async process(input) {
            calls += 1;
            if (calls === 1) throw new Error('synthetic worker interruption');
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const core = service(importStore, { worker });
    await core.initialize();
    const input = await artifact();
    const run = await core.importArtifacts([input, input]);
    assert.equal((await core.waitForJob(run.jobId)).status, 'failed_decode');
    await core.retryJob(run.jobId);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed');
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.skippedExactDuplicate, 1);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('hostile artifact accessors fail closed without execution or storage I/O', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    let calls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'mediaType', {
        enumerable: true,
        get() {
            calls += 1;
            return SYNTHETIC_JSON_MEDIA_TYPE;
        }
    });
    Object.defineProperty(hostile, 'content', { enumerable: true, value: '{}' });
    await assert.rejects(
        core.importArtifacts([hostile]),
        error => error.code === IMPORT_ERROR_CODE.INVALID_REQUEST
    );
    assert.equal(calls, 0);
    assert.equal((await importStore.listImportJobs()).length, 0);
    await core.close();
});

test('storage-owned import transitions reject illegal state changes without mutation', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    await importStore.initialize();
    await importStore.createImportJob('opaque-job-transition', ['opaque-item-transition']);
    await assert.rejects(
        importStore.transitionImportJob(
            'opaque-job-transition',
            'queued',
            'completed'
        ),
        error => error.code === 'DATA_INVALID'
            && !Object.hasOwn(error, 'cause')
    );
    await assert.rejects(
        importStore.transitionImportItem(
            'opaque-item-transition',
            'queued',
            'completed'
        ),
        error => error.code === 'DATA_INVALID'
    );
    assert.equal((await importStore.getImportJob('opaque-job-transition')).status, 'queued');
    assert.equal((await importStore.getImportItem('opaque-item-transition')).status, 'queued');
    await importStore.close();
});

test('RawArtifact storage enforces digest-derived ID and exact UTF-8 byte length', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    await importStore.initialize();
    await importStore.createImportJob('opaque-job-artifact', ['opaque-item-artifact']);
    await importStore.transitionImportJob(
        'opaque-job-artifact', 'queued', 'validating'
    );
    await importStore.transitionImportItem(
        'opaque-item-artifact', 'queued', 'validating'
    );
    await importStore.transitionImportJob(
        'opaque-job-artifact', 'validating', 'hashing'
    );
    await importStore.transitionImportItem(
        'opaque-item-artifact', 'validating', 'hashing'
    );
    const sha256 = 'a'.repeat(64);
    await assert.rejects(
        importStore.storeRawArtifact('opaque-item-artifact', {
            id: 'raw:not-the-digest',
            sha256,
            mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
            byteLength: 1,
            content: '{}'
        }),
        error => error.code === 'DATA_INVALID'
    );
    await assert.rejects(
        importStore.storeRawArtifact('opaque-item-artifact', {
            id: `raw:${sha256}`,
            sha256,
            mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
            byteLength: 1,
            content: '{}'
        }),
        error => error.code === 'DATA_INVALID'
    );
    assert.equal(
        (await importStore.getImportItem('opaque-item-artifact')).artifactId,
        null
    );
    await importStore.close();
});

test('cancellation during hashing latches until decoding and retains stored artifacts', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    let release;
    const digest = new Promise(resolve => { release = resolve; });
    const crypto = {
        subtle: {
            digest: async () => digest
        }
    };
    const core = service(importStore, { crypto });
    await core.initialize();
    const run = await core.importArtifacts([await artifact()]);
    while ((await importStore.getImportJob(run.jobId)).status !== 'hashing') {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepEqual(await core.cancelJob(run.jobId), {
        status: 'cancellation-requested'
    });
    release(new Uint8Array(32).buffer);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'cancelled');
    assert.equal(report.totals.cancelled, 1);
    const [item] = await importStore.listImportItems(run.jobId);
    assert.ok(await importStore.getRawArtifact(item.artifactId));
    assert.equal((await core.previewActivities()).total, 0);
    await core.close();
});

for (const boundary of ['queued', 'validating', 'decoding', 'normalizing', 'matching']) {
    test(`cancellation at ${boundary} stops unfinished items without a Canonical write`, async () => {
        const indexedDB = new IDBFactory();
        const realStore = store(indexedDB);
        let release;
        let reached;
        const gate = new Promise(resolve => { release = resolve; });
        const reachedGate = new Promise(resolve => { reached = resolve; });
        let firstList = true;
        const wrappedStore = {
            ...realStore,
            async listImportItems(...args) {
                if (boundary === 'queued' && firstList) {
                    firstList = false;
                    reached();
                    await gate;
                }
                return realStore.listImportItems(...args);
            },
            async transitionImportJob(jobId, expected, next, errorCode) {
                const result = await realStore.transitionImportJob(
                    jobId,
                    expected,
                    next,
                    errorCode
                );
                if (next === boundary) {
                    reached();
                    await gate;
                }
                return result;
            }
        };
        const core = service(wrappedStore);
        await core.initialize();
        const run = await core.importArtifacts([await artifact()]);
        await reachedGate;
        assert.deepEqual(await core.cancelJob(run.jobId), {
            status: 'cancellation-requested'
        });
        release();
        const report = await core.waitForJob(run.jobId);
        assert.equal(report.status, 'cancelled');
        assert.equal(report.totals.cancelled, 1);
        assert.equal((await core.previewActivities()).total, 0);
        await core.close();
    });
}

test('defensive SHA-256 collision fails closed without a second Canonical activity', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const crypto = {
        subtle: {
            digest: async () => new Uint8Array(32).buffer
        }
    };
    const core = service(importStore, { crypto });
    await core.initialize();
    const firstInput = await artifact();
    const first = await core.importArtifacts([firstInput]);
    assert.equal((await core.waitForJob(first.jobId)).totals.completed, 1);
    const secondInput = {
        ...firstInput,
        content: `${firstInput.content}\n`
    };
    const second = await core.importArtifacts([secondInput]);
    const report = await core.waitForJob(second.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.HASH_COLLISION);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('quota fault aborts the per-item Canonical transaction and reports a safe code', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const originalAdd = IDBObjectStore.prototype.add;
    let injected = false;
    IDBObjectStore.prototype.add = function (...args) {
        if (!injected && this.name === 'activities') {
            injected = true;
            throw new DOMException('private platform text', 'QuotaExceededError');
        }
        return originalAdd.apply(this, args);
    };
    let report;
    try {
        const run = await core.importArtifacts([await artifact()]);
        report = await core.waitForJob(run.jobId);
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
    }
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED);
    assert.doesNotMatch(JSON.stringify(report), /private platform text/);
    assert.equal((await core.previewActivities()).total, 0);
    await core.close();
});

test('completed work cannot be cancelled and remains committed', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const run = await core.importArtifacts([await artifact()]);
    await core.waitForJob(run.jobId);
    await assert.rejects(
        core.cancelJob(run.jobId),
        error => error.code === IMPORT_ERROR_CODE.INVALID_TRANSITION
    );
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('hostile Worker results do not execute getters and fail as redacted decode errors', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    let getterCalls = 0;
    const result = {};
    Object.defineProperty(result, 'ok', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return true;
        }
    });
    const worker = {
        async process() { return result; },
        close() {}
    };
    const core = service(importStore, { worker });
    await core.initialize();
    const run = await core.importArtifacts([await artifact()]);
    const report = await core.waitForJob(run.jobId);
    assert.equal(getterCalls, 0);
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.DECODER_FAILED);
    assert.doesNotMatch(JSON.stringify(report), /synthetic-import-activity/);
    await core.close();
});

test('hostile storage errors are redacted without executing accessors', async () => {
    const indexedDB = new IDBFactory();
    const realStore = store(indexedDB);
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'code', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'QUOTA_EXCEEDED';
        }
    });
    const wrappedStore = {
        ...realStore,
        async persistImportItem() { throw hostile; }
    };
    const core = service(wrappedStore);
    await core.initialize();
    const run = await core.importArtifacts([await artifact()]);
    const report = await core.waitForJob(run.jobId);
    assert.equal(getterCalls, 0);
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE);
    assert.doesNotMatch(JSON.stringify(report), /QUOTA_EXCEEDED/);
    await core.close();
});
