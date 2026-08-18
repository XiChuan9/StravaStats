import assert from 'node:assert/strict';
import test from 'node:test';

import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    createImportStore,
    createSourceOperationStore
} from '../../js/storage/index.js';

const START_MS = Date.parse('2026-08-11T01:02:03.004Z');
const START = new Date(START_MS).toISOString();
const EXPIRES = new Date(START_MS + 90_000).toISOString();
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OPERATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECOVERY_OWNER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECOVERY_OPERATION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function options(indexedDB, now = () => START_MS) {
    return {
        indexedDB,
        IDBKeyRange,
        now,
        applicationVersion: 'source-operation-test@1'
    };
}

function overwriteRecord(indexedDB, storeName, value) {
    return new Promise((resolve, reject) => {
        const opened = indexedDB.open('strava-stats-v2', 6);
        opened.onerror = () => reject(opened.error);
        opened.onsuccess = () => {
            const database = opened.result;
            const transaction = database.transaction(storeName, 'readwrite');
            transaction.objectStore(storeName).put(value);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onabort = () => {
                database.close();
                reject(transaction.error);
            };
        };
    });
}

function claim(overrides = {}) {
    return {
        expectedRevision: 0,
        ownerId: OWNER,
        operationId: OPERATION,
        kind: 'local_import',
        startedAt: START,
        heartbeatAt: START,
        leaseExpiresAt: EXPIRES,
        ...overrides
    };
}

function link(overrides = {}) {
    return {
        expectedRevision: 1,
        ownerId: OWNER,
        operationId: OPERATION,
        sourceConnectionRevision: null,
        acquiredAt: null,
        ...overrides
    };
}

function assertStorageError(code, operation) {
    return error => {
        assert.equal(error.code, code);
        assert.equal(error.operation, operation);
        assert.equal(Object.isFrozen(error), true);
        assert.equal(JSON.stringify(error).includes(OWNER), false);
        return true;
    };
}

test('V6 migration creates one exact idle operation and the public factory is frozen', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceOperationStore(options(indexedDB));
    assert.equal(Object.isFrozen(store), true);
    assert.deepEqual(Object.keys(store), [
        'initialize',
        'getOperation',
        'claimOperation',
        'heartbeatOperation',
        'prepareRetryOperation',
        'linkOperationJob',
        'beginHistoryCommit',
        'completeOperation',
        'listOrphanImportJobs',
        'recoverOperation',
        'abandonOperation',
        'close'
    ]);
    assert.deepEqual(await store.initialize(), { status: 'ready' });
    assert.deepEqual(await store.getOperation(), {
        id: 'source-operation:manager',
        status: 'idle',
        kind: null,
        phase: null,
        ownerId: null,
        operationId: null,
        jobId: null,
        sourceConnectionRevision: null,
        acquiredAt: null,
        startedAt: null,
        heartbeatAt: null,
        leaseExpiresAt: null,
        revision: 0,
        lastAction: null,
        lastActionKind: null,
        lastActionAt: null,
        lastResultCode: null
    });
    await store.close();
});

test('claim and heartbeat require exact UUIDs, 90-second expiry, owner, and revision CAS', async () => {
    const indexedDB = new IDBFactory();
    const store = createSourceOperationStore(options(indexedDB));
    await store.initialize();
    const active = await store.claimOperation(claim());
    assert.equal(active.status, 'active');
    assert.equal(active.phase, 'acquiring');
    assert.equal(active.revision, 1);

    for (const value of [
        claim({ expectedRevision: 1 }),
        claim({ ownerId: 'owner' }),
        claim({ leaseExpiresAt: new Date(START_MS + 89_999).toISOString() })
    ]) {
        await assert.rejects(store.claimOperation(value), error => {
            assert.ok([
                STORAGE_ERROR_CODE.DATA_INVALID,
                STORAGE_ERROR_CODE.CONFLICT
            ].includes(error.code));
            return true;
        });
    }

    const heartbeatAt = new Date(START_MS + 15_000).toISOString();
    const heartbeat = await store.heartbeatOperation({
        expectedRevision: 1,
        ownerId: OWNER,
        operationId: OPERATION,
        heartbeatAt,
        leaseExpiresAt: new Date(START_MS + 105_000).toISOString()
    });
    assert.equal(heartbeat.revision, 2);
    await assert.rejects(store.heartbeatOperation({
        expectedRevision: 1,
        ownerId: OWNER,
        operationId: OPERATION,
        heartbeatAt,
        leaseExpiresAt: new Date(START_MS + 105_000).toISOString()
    }), assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'heartbeatSourceOperation'));
    await store.close();
});

test('ImportJob creation and operation link commit atomically', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());

    const created = await importStore.createImportJob(
        'opaque-job',
        ['opaque-item'],
        link()
    );
    assert.equal(created.job.id, 'opaque-job');
    assert.equal(created.sourceOperation.jobId, 'opaque-job');
    assert.equal(created.sourceOperation.phase, 'importing');
    assert.equal((await operationStore.getOperation()).revision, 2);

    await assert.rejects(
        importStore.createImportJob('other-job', ['other-item'], link()),
        assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'createImportJob')
    );
    assert.equal(await importStore.getImportJob('other-job'), null);
    await importStore.close();
    await operationStore.close();
});

test('explicit Retry atomically claims the operation and schedules only retryable pending bytes', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await importStore.createImportJob('retry-job', ['retry-item', 'kept-item']);
    await importStore.transitionImportJob('retry-job', 'queued', 'validating');
    for (const id of ['retry-item', 'kept-item']) {
        await importStore.transitionImportItem(id, 'queued', 'validating', {
            errorCode: null,
            retryable: false,
            activityId: null
        });
        await importStore.transitionImportItem(id, 'validating', 'hashing', {
            errorCode: null,
            retryable: false,
            activityId: null
        });
    }
    const content = '{"synthetic":true}';
    await importStore.storeRawArtifact('retry-item', {
        id: `raw:${'a'.repeat(64)}`,
        sha256: 'a'.repeat(64),
        mediaType: 'application/vnd.stravastats.synthetic+json',
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    });
    await importStore.transitionImportItem(
        'retry-item', 'hashing', 'failed_validation', {
            errorCode: 'FILE_CORRUPTED',
            retryable: true,
            activityId: null
        }
    );
    await importStore.transitionImportItem(
        'kept-item', 'hashing', 'failed_validation', {
            errorCode: 'FILE_CORRUPTED',
            retryable: false,
            activityId: null
        }
    );
    await importStore.transitionImportJob(
        'retry-job', 'validating', 'failed_validation', 'FILE_CORRUPTED'
    );

    const prepared = await operationStore.prepareRetryOperation({
        expectedRevision: 0,
        ownerId: OWNER,
        operationId: OPERATION,
        jobId: 'retry-job',
        actionAt: START,
        leaseExpiresAt: EXPIRES
    });
    assert.equal(prepared.operation.status, 'active');
    assert.equal(prepared.operation.phase, 'importing');
    assert.equal(prepared.operation.jobId, 'retry-job');
    assert.equal(prepared.job.status, 'retrying');
    assert.equal(prepared.job.retryCount, 1);
    assert.equal(prepared.job.completedItems, 1);
    assert.equal(prepared.scheduledItems, 1);
    const items = await importStore.listImportItems('retry-job');
    assert.equal(items[0].status, 'retrying');
    assert.equal(items[0].retryable, false);
    assert.equal(items[1].status, 'failed_validation');
    assert.equal(items[1].retryable, false);
    await importStore.close();
    await operationStore.close();
});

test('explicit Retry rejects malformed terminal semantics and quota with zero partial writes', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await importStore.createImportJob('strict-retry-job', ['strict-retry-item']);
    await importStore.transitionImportJob('strict-retry-job', 'queued', 'validating');
    await importStore.transitionImportItem(
        'strict-retry-item', 'queued', 'validating'
    );
    await importStore.transitionImportItem(
        'strict-retry-item', 'validating', 'hashing'
    );
    const content = '{"strict":true}';
    await importStore.storeRawArtifact('strict-retry-item', {
        id: `raw:${'c'.repeat(64)}`,
        sha256: 'c'.repeat(64),
        mediaType: 'application/vnd.stravastats.synthetic+json',
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    });
    await importStore.transitionImportItem(
        'strict-retry-item', 'hashing', 'failed_validation', {
            errorCode: 'FILE_CORRUPTED',
            retryable: true,
            activityId: null
        }
    );
    await importStore.transitionImportJob(
        'strict-retry-job', 'validating', 'failed_validation', 'FILE_CORRUPTED'
    );
    const validItem = await importStore.getImportItem('strict-retry-item');
    const input = {
        expectedRevision: 0,
        ownerId: OWNER,
        operationId: OPERATION,
        jobId: 'strict-retry-job',
        actionAt: START,
        leaseExpiresAt: EXPIRES
    };
    await overwriteRecord(indexedDB, 'importItems', {
        ...validItem,
        errorCode: null
    });
    const idle = await operationStore.getOperation();
    const job = await importStore.getImportJob('strict-retry-job');
    await assert.rejects(
        operationStore.prepareRetryOperation(input),
        assertStorageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, 'linkSourceOperationJob')
    );
    assert.deepEqual(await operationStore.getOperation(), idle);
    assert.deepEqual(await importStore.getImportJob('strict-retry-job'), job);
    await overwriteRecord(indexedDB, 'importItems', validItem);

    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'importJobs') {
            throw Object.freeze({ name: 'QuotaExceededError' });
        }
        return originalPut.apply(this, args);
    };
    try {
        await assert.rejects(
            operationStore.prepareRetryOperation(input),
            assertStorageError(STORAGE_ERROR_CODE.QUOTA_EXCEEDED, 'linkSourceOperationJob')
        );
    } finally {
        IDBObjectStore.prototype.put = originalPut;
    }
    assert.deepEqual(await operationStore.getOperation(), idle);
    assert.deepEqual(await importStore.getImportJob('strict-retry-job'), job);
    assert.deepEqual(await importStore.getImportItem('strict-retry-item'), validItem);
    await importStore.close();
    await operationStore.close();
});

test('explicit Recover schedules only nonterminal items with valid pending bytes', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());
    await importStore.createImportJob(
        'recover-job',
        ['recover-item', 'missing-item'],
        link()
    );
    await importStore.transitionImportJob('recover-job', 'queued', 'validating');
    await importStore.transitionImportJob('recover-job', 'validating', 'hashing');
    for (const id of ['recover-item', 'missing-item']) {
        await importStore.transitionImportItem(id, 'queued', 'validating');
        await importStore.transitionImportItem(id, 'validating', 'hashing');
    }
    const content = '{"synthetic":true}';
    await importStore.storeRawArtifact('recover-item', {
        id: `raw:${'a'.repeat(64)}`,
        sha256: 'a'.repeat(64),
        mediaType: 'application/vnd.stravastats.synthetic+json',
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    });

    const actionAt = new Date(START_MS + 90_000).toISOString();
    const recovered = await operationStore.recoverOperation({
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'recover-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    });
    assert.equal(recovered.mode, 'scheduled');
    assert.equal(recovered.scheduledItems, 1);
    assert.equal(recovered.job.status, 'retrying');
    assert.equal(recovered.job.retryCount, 1);
    assert.equal(recovered.operation.ownerId, RECOVERY_OWNER);
    const items = await importStore.listImportItems('recover-job');
    assert.equal(items[0].status, 'retrying');
    assert.equal(items[1].status, 'cancelled');
    assert.equal(items[1].errorCode, 'RECOVERY_SOURCE_UNAVAILABLE');
    assert.equal(items[1].retryable, false);
    await importStore.close();
    await operationStore.close();
});

test('Recover with no durable pending bytes rolls back without partial terminalization', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());
    await importStore.createImportJob('empty-job', ['empty-item'], link());
    const actionAt = new Date(START_MS + 90_000).toISOString();
    await assert.rejects(operationStore.recoverOperation({
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'empty-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    }), assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'recoverSourceOperation'));
    assert.equal((await importStore.getImportJob('empty-job')).status, 'queued');
    assert.equal((await importStore.getImportItem('empty-item')).status, 'queued');
    assert.equal((await operationStore.getOperation()).ownerId, OWNER);
    await importStore.close();
    await operationStore.close();
});

test('explicit Abandon preserves terminal work and atomically cancels only remaining items', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());
    await importStore.createImportJob('abandon-job', ['done-item', 'open-item'], link());
    await importStore.transitionImportJob('abandon-job', 'queued', 'validating');
    await importStore.transitionImportItem('done-item', 'queued', 'validating');
    await importStore.transitionImportItem(
        'done-item',
        'validating',
        'failed_validation',
        { errorCode: 'INVALID_INPUT', retryable: false, activityId: null }
    );
    const before = await importStore.getImportItem('done-item');
    const actionAt = new Date(START_MS + 90_000).toISOString();
    const abandoned = await operationStore.abandonOperation({
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'abandon-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    });
    assert.equal(abandoned.operation.status, 'idle');
    assert.equal(abandoned.operation.lastAction, 'abandoned');
    assert.equal(abandoned.job.status, 'cancelled');
    assert.deepEqual(await importStore.getImportItem('done-item'), before);
    const open = await importStore.getImportItem('open-item');
    assert.equal(open.status, 'cancelled');
    assert.equal(open.errorCode, 'RECOVERY_ABANDONED');
    await importStore.close();
    await operationStore.close();
});

test('orphan jobs are read-only candidates and never auto-claimed', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await importStore.createImportJob('orphan-job', ['orphan-item']);
    const candidates = await operationStore.listOrphanImportJobs();
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, 'orphan-job');
    assert.equal((await operationStore.getOperation()).status, 'idle');
    await importStore.close();
    await operationStore.close();
});

test('analyzing recovery finalizes exact terminal items without scheduling or rewriting them', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());
    await importStore.createImportJob('analyzing-job', ['analyzing-item'], link());
    await importStore.transitionImportJob('analyzing-job', 'queued', 'validating');
    await importStore.transitionImportItem('analyzing-item', 'queued', 'validating');
    await importStore.transitionImportItem(
        'analyzing-item',
        'validating',
        'failed_validation',
        { errorCode: 'INVALID_INPUT', retryable: false, activityId: null }
    );
    for (const [from, to] of [
        ['validating', 'hashing'],
        ['hashing', 'decoding'],
        ['decoding', 'normalizing'],
        ['normalizing', 'matching'],
        ['matching', 'persisting'],
        ['persisting', 'analyzing']
    ]) {
        await importStore.transitionImportJob('analyzing-job', from, to);
    }
    const beforeItem = await importStore.getImportItem('analyzing-item');
    const actionAt = new Date(START_MS + 90_000).toISOString();
    const result = await operationStore.recoverOperation({
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'analyzing-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    });
    assert.equal(result.mode, 'finalized');
    assert.equal(result.job.status, 'completed_with_warnings');
    assert.equal(result.job.completedItems, 1);
    assert.deepEqual(await importStore.getImportItem('analyzing-item'), beforeItem);
    await importStore.close();
    await operationStore.close();
});

test('stale revision and backward heartbeat fail atomically without changing the operation', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    await operationStore.initialize();
    await operationStore.claimOperation(claim());
    const before = await operationStore.getOperation();
    await assert.rejects(operationStore.heartbeatOperation({
        expectedRevision: 1,
        ownerId: OWNER,
        operationId: OPERATION,
        heartbeatAt: new Date(START_MS - 1).toISOString(),
        leaseExpiresAt: new Date(START_MS + 89_999).toISOString()
    }), assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'heartbeatSourceOperation'));
    await assert.rejects(operationStore.completeOperation({
        expectedRevision: 0,
        ownerId: OWNER,
        operationId: OPERATION,
        lastAction: 'failed',
        lastActionAt: START,
        lastResultCode: 'SOURCE_OPERATION_CONFLICT'
    }), assertStorageError(STORAGE_ERROR_CODE.CONFLICT, 'completeSourceOperation'));
    assert.deepEqual(await operationStore.getOperation(), before);
    await operationStore.close();
});

test('every failed or cancelled terminal job offers operation-only Abandon and never Recover', async () => {
    const cases = [
        {
            status: 'failed_validation',
            jobPath: ['validating'],
            itemPath: ['validating', 'failed_validation'],
            errorCode: 'INVALID_INPUT'
        },
        {
            status: 'failed_decode',
            jobPath: ['validating', 'hashing', 'decoding'],
            itemPath: ['validating', 'hashing', 'decoding', 'failed_decode'],
            errorCode: 'DECODE_FAILED'
        },
        {
            status: 'failed_storage',
            jobPath: [
                'validating', 'hashing', 'decoding', 'normalizing',
                'matching', 'persisting'
            ],
            itemPath: ['validating', 'hashing', 'failed_storage'],
            errorCode: 'STORAGE_QUOTA_EXCEEDED'
        }
    ];
    for (const entry of cases) {
        const indexedDB = new IDBFactory();
        const operationStore = createSourceOperationStore(options(indexedDB));
        const importStore = createImportStore(options(indexedDB));
        await operationStore.initialize();
        await importStore.initialize();
        await operationStore.claimOperation(claim());
        const jobId = `${entry.status}-job`;
        const itemId = `${entry.status}-item`;
        await importStore.createImportJob(jobId, [itemId], link());
        let jobStatus = 'queued';
        for (const nextStatus of entry.jobPath) {
            await importStore.transitionImportJob(jobId, jobStatus, nextStatus);
            jobStatus = nextStatus;
        }
        let itemStatus = 'queued';
        for (const nextStatus of entry.itemPath) {
            await importStore.transitionImportItem(
                itemId,
                itemStatus,
                nextStatus,
                nextStatus === entry.status
                    ? {
                        errorCode: entry.errorCode,
                        retryable: false,
                        activityId: null
                    }
                    : undefined
            );
            itemStatus = nextStatus;
        }
        await importStore.transitionImportJob(
            jobId,
            jobStatus,
            entry.status,
            entry.errorCode
        );
        const beforeJob = await importStore.getImportJob(jobId);
        const beforeItem = await importStore.getImportItem(itemId);
        const candidates = await operationStore.listOrphanImportJobs();
        assert.equal(candidates.length, 1, entry.status);
        assert.equal(candidates[0].status, entry.status);
        assert.equal(candidates[0].recoveryMode, null);
        const actionAt = new Date(START_MS + 90_000).toISOString();
        await operationStore.abandonOperation({
            expectedRevision: 2,
            ownerId: RECOVERY_OWNER,
            operationId: RECOVERY_OPERATION,
            jobId,
            actionAt,
            leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
        });
        assert.deepEqual(await importStore.getImportJob(jobId), beforeJob);
        assert.deepEqual(await importStore.getImportItem(itemId), beforeItem);
        await importStore.close();
        await operationStore.close();
    }

    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();
    await operationStore.claimOperation(claim());
    await importStore.createImportJob('cancelled-job', ['cancelled-item'], link());
    await importStore.cancelImportJob('cancelled-job', 'queued');
    const beforeJob = await importStore.getImportJob('cancelled-job');
    const beforeItem = await importStore.getImportItem('cancelled-item');
    const candidates = await operationStore.listOrphanImportJobs();
    assert.equal(candidates[0].status, 'cancelled');
    assert.equal(candidates[0].recoveryMode, null);
    const actionAt = new Date(START_MS + 90_000).toISOString();
    await operationStore.abandonOperation({
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'cancelled-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    });
    assert.deepEqual(await importStore.getImportJob('cancelled-job'), beforeJob);
    assert.deepEqual(await importStore.getImportItem('cancelled-item'), beforeItem);
    await importStore.close();
    await operationStore.close();
});

test('quota at every SourceOperation mutation aborts atomically without partial records', async () => {
    const indexedDB = new IDBFactory();
    const operationStore = createSourceOperationStore(options(indexedDB));
    const importStore = createImportStore(options(indexedDB));
    await operationStore.initialize();
    await importStore.initialize();

    async function quota(operation, action, storeName = 'sourceOperations') {
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            if (this.name === storeName) {
                throw Object.freeze({
                    name: 'QuotaExceededError',
                    message: 'synthetic private quota detail'
                });
            }
            return originalPut.apply(this, args);
        };
        try {
            await assert.rejects(
                action(),
                assertStorageError(STORAGE_ERROR_CODE.QUOTA_EXCEEDED, operation)
            );
        } finally {
            IDBObjectStore.prototype.put = originalPut;
        }
    }

    const idle = await operationStore.getOperation();
    await quota('claimSourceOperation', () => operationStore.claimOperation(claim()));
    assert.deepEqual(await operationStore.getOperation(), idle);
    await operationStore.claimOperation(claim());

    const claimed = await operationStore.getOperation();
    const heartbeatAt = new Date(START_MS + 15_000).toISOString();
    await quota('heartbeatSourceOperation', () => operationStore.heartbeatOperation({
        expectedRevision: 1,
        ownerId: OWNER,
        operationId: OPERATION,
        heartbeatAt,
        leaseExpiresAt: new Date(START_MS + 105_000).toISOString()
    }));
    assert.deepEqual(await operationStore.getOperation(), claimed);

    await quota('createImportJob', () => importStore.createImportJob(
        'quota-job',
        ['quota-item'],
        link()
    ));
    assert.equal(await importStore.getImportJob('quota-job'), null);
    assert.deepEqual(await operationStore.getOperation(), claimed);
    await importStore.createImportJob('quota-job', ['quota-item'], link());
    await importStore.transitionImportJob('quota-job', 'queued', 'validating');
    await importStore.transitionImportJob('quota-job', 'validating', 'hashing');
    await importStore.transitionImportItem('quota-item', 'queued', 'validating');
    await importStore.transitionImportItem('quota-item', 'validating', 'hashing');
    const content = '{"synthetic":true}';
    await importStore.storeRawArtifact('quota-item', {
        id: `raw:${'b'.repeat(64)}`,
        sha256: 'b'.repeat(64),
        mediaType: 'application/vnd.stravastats.synthetic+json',
        byteLength: new TextEncoder().encode(content).byteLength,
        content
    });
    const beforeOperation = await operationStore.getOperation();
    const beforeJob = await importStore.getImportJob('quota-job');
    const beforeItem = await importStore.getImportItem('quota-item');
    const actionAt = new Date(START_MS + 90_000).toISOString();
    const action = {
        expectedRevision: 2,
        ownerId: RECOVERY_OWNER,
        operationId: RECOVERY_OPERATION,
        jobId: 'quota-job',
        actionAt,
        leaseExpiresAt: new Date(START_MS + 180_000).toISOString()
    };
    await quota('recoverSourceOperation', () => operationStore.recoverOperation(action));
    assert.deepEqual(await operationStore.getOperation(), beforeOperation);
    assert.deepEqual(await importStore.getImportJob('quota-job'), beforeJob);
    assert.deepEqual(await importStore.getImportItem('quota-item'), beforeItem);
    await quota('abandonSourceOperation', () => operationStore.abandonOperation(action));
    assert.deepEqual(await operationStore.getOperation(), beforeOperation);
    assert.deepEqual(await importStore.getImportJob('quota-job'), beforeJob);
    assert.deepEqual(await importStore.getImportItem('quota-item'), beforeItem);
    await quota('completeSourceOperation', () => operationStore.completeOperation({
        expectedRevision: 2,
        ownerId: OWNER,
        operationId: OPERATION,
        lastAction: 'failed',
        lastActionAt: actionAt,
        lastResultCode: 'SOURCE_OPERATION_STORAGE_FAILED'
    }));
    assert.deepEqual(await operationStore.getOperation(), beforeOperation);
    await importStore.close();
    await operationStore.close();
});
