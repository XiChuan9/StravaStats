import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { recoverImportServiceJob } from '../../js/import/import-service.js';
import { createSourceManagerRecoveryController } from
    '../../js/app/source-manager-recovery.js';
import {
    createImportStore,
    createSourceOperationStore
} from '../../js/storage/index.js';

const START_MS = Date.parse('2026-08-11T08:09:10.111Z');

function bundle() {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id: 'synthetic:recovery:activity',
            sportCategory: 'run',
            sportVariant: null,
            startTimeUtc: '2026-08-11T08:00:00.000Z',
            timeZone: { ianaName: 'Etc/UTC', utcOffsetMinutes: 0 },
            capabilities: {
                hasGps: false,
                hasHeartRate: false,
                hasPower: false,
                hasCadence: false,
                hasLaps: false
            },
            name: 'Synthetic recovery activity',
            distanceMeters: 0,
            movingTimeSeconds: 0,
            elapsedTimeSeconds: 0
        },
        streams: { activityId: 'synthetic:recovery:activity', series: [] },
        laps: [],
        events: [],
        sources: [{
            id: 'synthetic:recovery:source',
            activityId: 'synthetic:recovery:activity',
            provider: 'synthetic-provider',
            acquisitionMethod: 'synthetic-import',
            deviceId: null,
            importedAt: '2026-08-11T08:00:00.000Z'
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'recovery-test@1',
            normalizerVersion: 'recovery-test@1',
            analysisVersion: null,
            settingsVersion: 'recovery-test@1',
            inputHash: null
        }
    };
}

class SyntheticDocument {
    constructor() {
        this.visibilityState = 'visible';
        this.listeners = new Map();
    }
    addEventListener(type, listener) {
        const values = this.listeners.get(type) ?? new Set();
        values.add(listener);
        this.listeners.set(type, values);
    }
    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }
    dispatch(type) {
        for (const listener of this.listeners.get(type) ?? []) listener();
    }
}

class SyntheticLocks {
    constructor() {
        this.held = false;
        this.requests = [];
    }
    async request(name, options, callback) {
        this.requests.push({ name, options });
        if (this.held) return callback(null);
        this.held = true;
        try {
            return await callback(Object.freeze({ name, mode: 'exclusive' }));
        } finally {
            this.held = false;
        }
    }
}

function timers() {
    const pending = [];
    return {
        pending,
        setTimeoutImpl(callback, delay) {
            const token = { callback, delay, cancelled: false };
            pending.push(token);
            return token;
        },
        clearTimeoutImpl(token) { token.cancelled = true; }
    };
}

function uuidSequence() {
    const values = [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ];
    let index = 0;
    return { randomUUID: () => values[index++] ?? values.at(-1) };
}

async function harness({
    indexedDB = new IDBFactory(),
    locks = new SyntheticLocks(),
    initialNow = START_MS,
    failHeartbeat = false,
    cancelProviderAcquisition = async () => undefined,
    advanceProviderHistory = async () => false
} = {}) {
    let now = initialNow;
    let sequence = 0;
    const document = new SyntheticDocument();
    const clock = timers();
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => now,
        applicationVersion: 'recovery-test@1'
    });
    const service = createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: kind => `recovery:${kind}:${++sequence}`
    });
    await service.initialize();
    const operationStore = createSourceOperationStore({
        indexedDB,
        IDBKeyRange,
        now: () => now,
        applicationVersion: 'recovery-test@1'
    });
    const importFacade = Object.freeze({
        importArtifacts: (...args) => service.importArtifacts(...args),
        cancelJob: jobId => service.cancelJob(jobId),
        waitForJob: jobId => service.waitForJob(jobId),
        recoverJob: jobId => recoverImportServiceJob(service, jobId)
    });
    const controllerOperationStore = failHeartbeat
        ? Object.freeze({
            initialize: (...args) => operationStore.initialize(...args),
            getOperation: (...args) => operationStore.getOperation(...args),
            claimOperation: (...args) => operationStore.claimOperation(...args),
            heartbeatOperation: async () => {
                throw Object.freeze({ code: 'CONFLICT' });
            },
            beginHistoryCommit: (...args) => operationStore.beginHistoryCommit(...args),
            completeOperation: (...args) => operationStore.completeOperation(...args),
            listOrphanImportJobs: (...args) => operationStore.listOrphanImportJobs(...args),
            recoverOperation: (...args) => operationStore.recoverOperation(...args),
            abandonOperation: (...args) => operationStore.abandonOperation(...args),
            close: (...args) => operationStore.close(...args)
        })
        : operationStore;
    const controller = createSourceManagerRecoveryController({
        operationStore: controllerOperationStore,
        importFacade,
        locks,
        crypto: uuidSequence(),
        now: () => now,
        document,
        setTimeoutImpl: clock.setTimeoutImpl,
        clearTimeoutImpl: clock.clearTimeoutImpl,
        isOnline: () => true,
        cancelProviderAcquisition,
        advanceProviderHistory
    });
    return {
        controller,
        operationStore,
        importStore,
        service,
        document,
        clock,
        locks,
        setNow(value) { now = value; }
    };
}

async function createLinkedCrash(value, {
    jobId = 'terminal-job',
    itemId = 'terminal-item',
    content = JSON.stringify(bundle()),
    kind = 'local_import',
    sourceConnectionRevision = null,
    acquiredAt = null
} = {}) {
    const startedAt = new Date(START_MS).toISOString();
    await value.operationStore.initialize();
    await value.operationStore.claimOperation({
        expectedRevision: 0,
        ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        kind,
        startedAt,
        heartbeatAt: startedAt,
        leaseExpiresAt: new Date(START_MS + 90_000).toISOString()
    });
    const started = await value.service.importArtifacts([{
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content
    }], {
        expectedRevision: 1,
        ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        sourceConnectionRevision,
        acquiredAt
    });
    assert.equal(typeof started.jobId, 'string');
    await value.service.waitForJob(started.jobId);
    return Object.freeze({
        jobId: started.jobId,
        itemId: (await value.importStore.listImportItems(started.jobId))[0].id
    });
}

test('initialization is read-only, creates one document owner, and exposes only redacted state', async () => {
    const value = await harness();
    assert.deepEqual(Object.keys(value.controller), [
        'initialize', 'getRecoveryState', 'refresh', 'runLocalImport',
        'runProviderSync', 'importArtifacts', 'beginHistoryCommit',
        'recover', 'abandon', 'close'
    ]);
    assert.equal((await value.controller.initialize()).status, 'idle');
    assert.equal(value.locks.requests.length, 0);
    assert.doesNotMatch(
        JSON.stringify(value.controller.getRecoveryState()),
        /aaaaaaaa|source-operation:manager|recovery:job/
    );
    await value.controller.close();
    await value.service.close();
});

test('one exclusive lock covers atomic local job link through terminal completion', async () => {
    const value = await harness();
    await value.controller.initialize();
    const report = await value.controller.runLocalImport(async () => {
        const started = await value.controller.importArtifacts([{
            mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
            content: JSON.stringify(bundle())
        }]);
        return value.service.waitForJob(started.jobId);
    });
    assert.equal(report.status, 'completed');
    assert.equal(value.locks.requests.length, 1);
    assert.deepEqual(value.locks.requests[0], {
        name: 'stravastats-source-manager-v1',
        options: { mode: 'exclusive', ifAvailable: true }
    });
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.equal(operation.lastAction, 'completed');
    assert.equal(operation.ownerId, null);
    assert.equal(operation.jobId, null);
    await value.controller.close();
    await value.service.close();
});

test('one explicit multi-batch local import atomically rolls its active link across terminal jobs', async () => {
    const value = await harness();
    await value.controller.initialize();
    const jobIds = [];
    const reports = await value.controller.runLocalImport(async () => {
        const results = [];
        for (let index = 0; index < 2; index += 1) {
            const started = await value.controller.importArtifacts([{
                mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
                content: JSON.stringify(bundle())
            }]);
            jobIds.push(started.jobId);
            results.push(await value.service.waitForJob(started.jobId));
        }
        return results;
    });
    assert.equal(new Set(jobIds).size, 2);
    assert.equal(reports.length, 2);
    assert.ok(reports.every(report => (
        ['completed', 'completed_with_warnings'].includes(report.status)
    )));
    assert.equal((await value.importStore.listImportJobs()).length, 2);
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.equal(operation.lastAction, 'completed');
    assert.equal(value.locks.requests.length, 1);
    await value.controller.close();
    await value.service.close();
});

test('visible and hidden heartbeat timing derives every expiry from the current clock', async () => {
    const value = await harness();
    await value.controller.initialize();
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    const running = value.controller.runLocalImport(() => hold);
    while (value.clock.pending.length === 0) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(value.clock.pending.at(-1).delay, 15_000);
    value.document.visibilityState = 'hidden';
    value.setNow(START_MS + 15_000);
    value.clock.pending.at(-1).callback();
    while (value.clock.pending.length < 2) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(value.clock.pending.at(-1).delay, 30_000);
    const heartbeat = await value.operationStore.getOperation();
    assert.equal(
        Date.parse(heartbeat.leaseExpiresAt) - Date.parse(heartbeat.heartbeatAt),
        90_000
    );
    release(Object.freeze({ status: 'done' }));
    await running;
    await value.controller.close();
    await value.service.close();
});

test('lock contention never queues or steals and startup never resumes stale work', async () => {
    const indexedDB = new IDBFactory();
    const locks = new SyntheticLocks();
    const first = await harness({ indexedDB, locks });
    const second = await harness({ indexedDB, locks });
    await first.controller.initialize();
    await second.controller.initialize();
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    const running = first.controller.runLocalImport(() => hold);
    await Promise.resolve();
    await Promise.resolve();
    await assert.rejects(
        second.controller.runLocalImport(async () => {}),
        error => error.code === 'SOURCE_OPERATION_ACTIVE'
    );
    assert.equal(locks.requests[1].options.ifAvailable, true);
    assert.equal(Object.hasOwn(locks.requests[1].options, 'steal'), false);
    release(Object.freeze({ status: 'done' }));
    await running;
    await first.controller.close();
    await second.controller.close();
    await first.service.close();
    await second.service.close();
});

test('provider acquisition is blocked while offline before requesting a lock', async () => {
    const value = await harness();
    await value.controller.initialize();
    const controller = createSourceManagerRecoveryController({
        operationStore: value.operationStore,
        importFacade: Object.freeze({
            importArtifacts: () => Promise.reject(new Error()),
            cancelJob: () => Promise.resolve(),
            waitForJob: () => Promise.resolve(),
            recoverJob: () => Promise.resolve()
        }),
        locks: value.locks,
        crypto: uuidSequence(),
        now: () => START_MS,
        document: new SyntheticDocument(),
        setTimeoutImpl: () => 1,
        clearTimeoutImpl: () => {},
        isOnline: () => false,
        cancelProviderAcquisition: async () => undefined,
        advanceProviderHistory: async () => false
    });
    await controller.initialize();
    await assert.rejects(
        controller.runProviderSync(async () => {}),
        error => error.code === 'SOURCE_OPERATION_UNAVAILABLE'
    );
    assert.equal(value.locks.requests.length, 0);
    await controller.close();
    await value.controller.close();
    await value.service.close();
});

test('missing coordination capabilities keep every operation action at fixed unavailable', async () => {
    const value = await harness();
    const controller = createSourceManagerRecoveryController({
        operationStore: value.operationStore,
        importFacade: Object.freeze({
            importArtifacts: () => Promise.reject(new Error()),
            cancelJob: () => Promise.resolve(),
            waitForJob: () => Promise.resolve(),
            recoverJob: () => Promise.resolve()
        }),
        locks: null,
        crypto: uuidSequence(),
        now: () => START_MS,
        document: new SyntheticDocument(),
        setTimeoutImpl: () => 1,
        clearTimeoutImpl: () => {},
        isOnline: () => true,
        cancelProviderAcquisition: async () => undefined,
        advanceProviderHistory: async () => false
    });
    const initialized = await controller.initialize();
    assert.equal(initialized.status, 'unavailable');
    assert.equal(initialized.code, 'SOURCE_OPERATION_UNAVAILABLE');
    for (const action of [
        () => controller.runLocalImport(async () => undefined),
        () => controller.runProviderSync(async () => undefined)
    ]) {
        await assert.rejects(
            action(),
            error => error.code === 'SOURCE_OPERATION_UNAVAILABLE'
        );
    }
    await controller.close();
    await value.controller.close();
    await value.service.close();
});

test('heartbeat CAS loss before job creation cancels active provider acquisition', async () => {
    let cancelCount = 0;
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const value = await harness({
        failHeartbeat: true,
        cancelProviderAcquisition: async () => {
            cancelCount += 1;
            release(Object.freeze({ status: 'cancelled' }));
        }
    });
    await value.controller.initialize();
    const running = value.controller.runProviderSync(() => held);
    while (value.clock.pending.length === 0) {
        await new Promise(resolve => setImmediate(resolve));
    }
    value.setNow(START_MS + 15_000);
    await value.clock.pending.at(-1).callback();
    while (cancelCount === 0) await new Promise(resolve => setImmediate(resolve));
    assert.equal(cancelCount, 1);
    await assert.rejects(
        running,
        error => error.code === 'SOURCE_OPERATION_CONFLICT'
    );
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.jobId, null);
    assert.equal(operation.lastAction, 'failed');
    assert.equal(operation.lastResultCode, 'SOURCE_OPERATION_CONFLICT');
    await value.controller.close();
    await value.service.close();
});

test('finite out-of-range clocks fail closed with the fixed clock code', async () => {
    const value = await harness();
    value.setNow(Number.MAX_VALUE);
    const initialized = await value.controller.initialize();
    assert.equal(initialized.status, 'unavailable');
    assert.equal(initialized.code, 'SOURCE_OPERATION_CLOCK_INVALID');
    await value.controller.close();
    await value.service.close();
});

test('finite lease overflow fails before durable claim with the fixed clock code', async () => {
    const value = await harness();
    value.setNow(Date.parse('9999-12-31T23:59:30.000Z'));
    assert.equal((await value.controller.initialize()).status, 'idle');
    await assert.rejects(
        value.controller.runLocalImport(async () => Object.freeze({ status: 'unused' })),
        error => error.code === 'SOURCE_OPERATION_CLOCK_INVALID'
    );
    assert.equal((await value.operationStore.getOperation()).status, 'idle');
    await value.controller.close();
    await value.service.close();
});

test('terminal completed crash offers Recover and preserves all Import records', async () => {
    const value = await harness();
    const crash = await createLinkedCrash(value);
    const beforeJob = await value.importStore.getImportJob(crash.jobId);
    const beforeItems = await value.importStore.listImportItems(crash.jobId);
    assert.equal(beforeJob.status, 'completed');
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    assert.equal(initial.status, 'recovery_available');
    assert.equal(initial.candidates[0].jobStatus, 'completed');
    assert.equal(initial.candidates[0].recover, true);
    assert.equal(initial.candidates[0].abandon, true);
    await value.controller.recover(initial.candidates[0].token);
    assert.deepEqual(await value.importStore.getImportJob(crash.jobId), beforeJob);
    assert.deepEqual(await value.importStore.listImportItems(crash.jobId), beforeItems);
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.equal(operation.lastAction, 'recovered');
    assert.equal(operation.lastResultCode, null);
    await value.controller.close();
    await value.service.close();
});

test('terminal failed crash offers Abandon only and preserves all Import records', async () => {
    const value = await harness();
    await value.operationStore.initialize();
    const startedAt = new Date(START_MS).toISOString();
    await value.operationStore.claimOperation({
        expectedRevision: 0,
        ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        kind: 'local_import',
        startedAt,
        heartbeatAt: startedAt,
        leaseExpiresAt: new Date(START_MS + 90_000).toISOString()
    });
    await value.importStore.createImportJob('failed-job', ['failed-item'], {
        expectedRevision: 1,
        ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        sourceConnectionRevision: null,
        acquiredAt: null
    });
    await value.importStore.transitionImportJob('failed-job', 'queued', 'validating');
    await value.importStore.transitionImportItem(
        'failed-item',
        'queued',
        'validating'
    );
    await value.importStore.transitionImportItem(
        'failed-item',
        'validating',
        'failed_validation',
        { errorCode: 'INVALID_INPUT', retryable: false, activityId: null }
    );
    await value.importStore.transitionImportJob(
        'failed-job',
        'validating',
        'failed_validation',
        'INVALID_INPUT'
    );
    const beforeJob = await value.importStore.getImportJob('failed-job');
    const beforeItems = await value.importStore.listImportItems('failed-job');
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    assert.equal(initial.status, 'recovery_available');
    assert.equal(initial.candidates[0].recover, false);
    assert.equal(initial.candidates[0].abandon, true);
    await value.controller.abandon(initial.candidates[0].token);
    assert.deepEqual(await value.importStore.getImportJob('failed-job'), beforeJob);
    assert.deepEqual(await value.importStore.listImportItems('failed-job'), beforeItems);
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.equal(operation.lastAction, 'abandoned');
    assert.equal(operation.lastResultCode, 'RECOVERY_ABANDONED');
    await value.controller.close();
    await value.service.close();
});

test('terminal completed-with-warnings crash offers both actions and Abandon is operation-only', async () => {
    const value = await harness();
    const crash = await createLinkedCrash(value, { content: '{}' });
    const beforeJob = await value.importStore.getImportJob(crash.jobId);
    const beforeItems = await value.importStore.listImportItems(crash.jobId);
    assert.equal(beforeJob.status, 'completed_with_warnings');
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    assert.equal(initial.candidates[0].recover, true);
    assert.equal(initial.candidates[0].abandon, true);
    await value.controller.abandon(initial.candidates[0].token);
    assert.deepEqual(await value.importStore.getImportJob(crash.jobId), beforeJob);
    assert.deepEqual(await value.importStore.listImportItems(crash.jobId), beforeItems);
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.lastAction, 'abandoned');
    assert.equal(operation.lastResultCode, 'RECOVERY_ABANDONED');
    await value.controller.close();
    await value.service.close();
});

test('terminal provider Recover advances history only through preserved provenance', async () => {
    const calls = [];
    const value = await harness({
        advanceProviderHistory: async input => {
            calls.push(input);
            return true;
        }
    });
    const acquiredAt = new Date(START_MS + 1_000).toISOString();
    const crash = await createLinkedCrash(value, {
        kind: 'provider_sync',
        sourceConnectionRevision: 7,
        acquiredAt
    });
    const beforeJob = await value.importStore.getImportJob(crash.jobId);
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    await value.controller.recover(initial.candidates[0].token);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sourceConnectionRevision, 7);
    assert.equal(calls[0].acquiredAt, acquiredAt);
    assert.equal(calls[0].report.status, 'completed');
    assert.deepEqual(await value.importStore.getImportJob(crash.jobId), beforeJob);
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.lastAction, 'recovered');
    assert.equal(operation.lastResultCode, null);
    await value.controller.close();
    await value.service.close();
});

test('terminal provider Recover preserves imports when history authority does not advance', async () => {
    const value = await harness({ advanceProviderHistory: async () => false });
    const crash = await createLinkedCrash(value, {
        kind: 'provider_sync',
        sourceConnectionRevision: 7,
        acquiredAt: new Date(START_MS + 1_000).toISOString()
    });
    const beforeJob = await value.importStore.getImportJob(crash.jobId);
    const beforeItems = await value.importStore.listImportItems(crash.jobId);
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    await value.controller.recover(initial.candidates[0].token);
    assert.deepEqual(await value.importStore.getImportJob(crash.jobId), beforeJob);
    assert.deepEqual(await value.importStore.listImportItems(crash.jobId), beforeItems);
    assert.equal(
        (await value.operationStore.getOperation()).lastResultCode,
        'RECOVERY_HISTORY_NOT_ADVANCED'
    );
    await value.controller.close();
    await value.service.close();
});

test('simultaneous terminal actions have one Web Lock winner and never double-clear', async () => {
    const indexedDB = new IDBFactory();
    const locks = new SyntheticLocks();
    const first = await harness({ indexedDB, locks });
    const crash = await createLinkedCrash(first);
    first.setNow(START_MS + 90_000);
    const second = await harness({ indexedDB, locks });
    second.setNow(START_MS + 90_000);
    const firstState = await first.controller.initialize();
    const secondState = await second.controller.initialize();
    const outcomes = await Promise.allSettled([
        first.controller.recover(firstState.candidates[0].token),
        second.controller.abandon(secondState.candidates[0].token)
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
    const operation = await first.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.ok(['recovered', 'abandoned'].includes(operation.lastAction));
    assert.equal((await first.importStore.getImportJob(crash.jobId)).status, 'completed');
    await first.controller.close();
    await second.controller.close();
    await first.service.close();
    await second.service.close();
});

test('stale work remains inert until explicit Recover schedules only its pending bytes', async () => {
    const value = await harness();
    await value.operationStore.initialize();
    const startedAt = new Date(START_MS).toISOString();
    await value.operationStore.claimOperation({
        expectedRevision: 0,
        ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        kind: 'local_import',
        startedAt,
        heartbeatAt: startedAt,
        leaseExpiresAt: new Date(START_MS + 90_000).toISOString()
    });
    await value.importStore.createImportJob(
        'stale-recover-job',
        ['stale-recover-item'],
        {
            expectedRevision: 1,
            ownerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            sourceConnectionRevision: null,
            acquiredAt: null
        }
    );
    await value.importStore.transitionImportJob(
        'stale-recover-job', 'queued', 'validating'
    );
    await value.importStore.transitionImportJob(
        'stale-recover-job', 'validating', 'hashing'
    );
    await value.importStore.transitionImportItem(
        'stale-recover-item', 'queued', 'validating'
    );
    await value.importStore.transitionImportItem(
        'stale-recover-item', 'validating', 'hashing'
    );
    const content = JSON.stringify(bundle());
    await value.importStore.storeRawArtifact('stale-recover-item', {
        id: `raw:${'a'.repeat(64)}`,
        sha256: 'a'.repeat(64),
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    });
    value.setNow(START_MS + 90_000);
    const initial = await value.controller.initialize();
    assert.equal(initial.status, 'recovery_available');
    assert.equal(initial.actions.recover, true);
    assert.equal(value.locks.requests.length, 0);
    await value.controller.recover(initial.candidates[0].token);
    const job = await value.importStore.getImportJob('stale-recover-job');
    assert.ok(['completed', 'completed_with_warnings'].includes(job.status));
    const operation = await value.operationStore.getOperation();
    assert.equal(operation.status, 'idle');
    assert.equal(operation.lastAction, 'recovered');
    assert.equal(operation.lastResultCode, 'RECOVERY_REQUEUED');
    await value.controller.close();
    await value.service.close();
});

test('explicit Abandon is the only action for missing bytes and preserves an idle audit', async () => {
    const value = await harness();
    await value.operationStore.initialize();
    await value.importStore.createImportJob('orphan-job', ['orphan-item']);
    const initial = await value.controller.initialize();
    assert.equal(initial.status, 'recovery_available');
    assert.equal(initial.candidates[0].recover, false);
    assert.equal(initial.candidates[0].abandon, true);
    await value.controller.abandon(initial.candidates[0].token);
    const job = await value.importStore.getImportJob('orphan-job');
    assert.equal(job.status, 'cancelled');
    assert.equal(job.errorCode, 'RECOVERY_ABANDONED');
    const item = await value.importStore.getImportItem('orphan-item');
    assert.equal(item.status, 'cancelled');
    assert.equal(item.errorCode, 'RECOVERY_ABANDONED');
    assert.equal((await value.operationStore.getOperation()).lastAction, 'abandoned');
    await value.controller.close();
    await value.service.close();
});
