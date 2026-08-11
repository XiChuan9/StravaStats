import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_STORE_NAME
} from './constants.js';
import { createCanonicalStore } from './database.js';
import { storageError } from './errors.js';
import { runTransaction } from './transaction.js';

export const SOURCE_OPERATION_ID = 'source-operation:manager';
export const SOURCE_OPERATION_LOCK_NAME = 'stravastats-source-manager-v1';
export const SOURCE_OPERATION_LEASE_MS = 90_000;

const OPTION_FIELDS = Object.freeze([
    'indexedDB',
    'IDBKeyRange',
    'now',
    'applicationVersion'
]);
const RECORD_FIELDS = Object.freeze([
    'id',
    'status',
    'kind',
    'phase',
    'ownerId',
    'operationId',
    'jobId',
    'sourceConnectionRevision',
    'acquiredAt',
    'startedAt',
    'heartbeatAt',
    'leaseExpiresAt',
    'revision',
    'lastAction',
    'lastActionKind',
    'lastActionAt',
    'lastResultCode'
]);
const CLAIM_FIELDS = Object.freeze([
    'expectedRevision',
    'ownerId',
    'operationId',
    'kind',
    'startedAt',
    'heartbeatAt',
    'leaseExpiresAt'
]);
const OWNER_MUTATION_FIELDS = Object.freeze([
    'expectedRevision',
    'ownerId',
    'operationId'
]);
const HEARTBEAT_FIELDS = Object.freeze([
    ...OWNER_MUTATION_FIELDS,
    'heartbeatAt',
    'leaseExpiresAt'
]);
const LINK_FIELDS = Object.freeze([
    ...OWNER_MUTATION_FIELDS,
    'jobId',
    'sourceConnectionRevision',
    'acquiredAt'
]);
const COMPLETE_FIELDS = Object.freeze([
    ...OWNER_MUTATION_FIELDS,
    'lastAction',
    'lastActionAt',
    'lastResultCode'
]);
const ACTION_FIELDS = Object.freeze([
    'expectedRevision',
    'ownerId',
    'operationId',
    'jobId',
    'actionAt',
    'leaseExpiresAt'
]);
const STATUS = Object.freeze({ IDLE: 'idle', ACTIVE: 'active' });
const KINDS = Object.freeze(['local_import', 'provider_sync']);
const PHASES = Object.freeze(['acquiring', 'importing', 'history_commit']);
const LAST_ACTIONS = Object.freeze([
    'completed',
    'recovered',
    'abandoned',
    'failed'
]);
const RESULT_CODES = Object.freeze([
    'SOURCE_OPERATION_ACTIVE',
    'SOURCE_OPERATION_RECOVERY_REQUIRED',
    'SOURCE_OPERATION_CLOCK_INVALID',
    'SOURCE_OPERATION_CONFLICT',
    'SOURCE_OPERATION_UNAVAILABLE',
    'SOURCE_OPERATION_STORAGE_FAILED',
    'RECOVERY_NOT_AVAILABLE',
    'RECOVERY_REQUEUED',
    'RECOVERY_SOURCE_UNAVAILABLE',
    'RECOVERY_ABANDONED',
    'RECOVERY_HISTORY_NOT_ADVANCED'
]);
const NONTERMINAL_JOBS = Object.freeze([
    'queued',
    'validating',
    'hashing',
    'decoding',
    'normalizing',
    'matching',
    'persisting',
    'analyzing',
    'retrying'
]);
const COMPLETED_TERMINAL_JOBS = Object.freeze([
    'completed',
    'completed_with_warnings'
]);
const FAILED_TERMINAL_JOBS = Object.freeze([
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'cancelled'
]);
const TERMINAL_JOBS = Object.freeze([
    ...COMPLETED_TERMINAL_JOBS,
    ...FAILED_TERMINAL_JOBS
]);
const NONTERMINAL_ITEMS = Object.freeze([
    'queued',
    'validating',
    'hashing',
    'decoding',
    'normalizing',
    'matching',
    'persisting',
    'retrying'
]);
const TERMINAL_ITEMS = Object.freeze([
    'completed',
    'review_required',
    'skipped_exact_duplicate',
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'cancelled'
]);
const IMPORT_MEDIA_TYPES = Object.freeze([
    'application/vnd.stravastats.synthetic+json',
    'text/csv;profile=strava-activities',
    'application/vnd.stravastats.strava-archive-row+json',
    'application/vnd.ant.fit;base64',
    'application/vnd.garmin.tcx+xml',
    'application/gpx+xml',
    'application/vnd.stravastats.strava-provider-artifact+json;version=1'
]);
const PROVIDER_ARTIFACT_MEDIA_TYPE =
    'application/vnd.stravastats.strava-provider-artifact+json;version=1';
const READY_RESULT = Object.freeze({ status: 'ready' });
const CLOSED_RESULT = Object.freeze({ status: 'closed' });

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ownDataValues(value, fields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || !sameArray(keys.slice().sort(), fields.slice().sort())
        ) return null;
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function findDataMethod(value, name) {
    try {
        let current = value;
        for (let depth = 0; current !== null && depth < 32; depth += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value')
                    && typeof descriptor.value === 'function'
                    ? descriptor.value
                    : null;
            }
            current = Object.getPrototypeOf(current);
        }
        return null;
    } catch {
        return null;
    }
}

function normalizeOptions(options) {
    const values = ownDataValues(options, OPTION_FIELDS);
    const open = values && findDataMethod(values.indexedDB, 'open');
    const bound = values && findDataMethod(values.IDBKeyRange, 'bound');
    if (
        !values
        || !open
        || !bound
        || typeof values.now !== 'function'
        || typeof values.applicationVersion !== 'string'
        || values.applicationVersion.length === 0
    ) return null;
    return Object.freeze({ ...values, open });
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function uuid(value) {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function opaque(value) {
    return typeof value === 'string' && value.length > 0;
}

function exactUtf8ByteLength(content, byteLength) {
    try {
        return new TextEncoder().encode(content).byteLength === byteLength;
    } catch {
        return false;
    }
}

function normalizeImportJobRecord(value) {
    const record = ownDataValues(value, [
        'id', 'status', 'totalItems', 'completedItems', 'createdAt',
        'completedAt', 'retryCount', 'errorCode'
    ]);
    return record
        && opaque(record.id)
        && [...NONTERMINAL_JOBS,
            'completed', 'completed_with_warnings', 'failed_validation',
            'failed_decode', 'failed_storage', 'cancelled'].includes(record.status)
        && Number.isSafeInteger(record.totalItems)
        && record.totalItems > 0
        && Number.isSafeInteger(record.completedItems)
        && record.completedItems >= 0
        && record.completedItems <= record.totalItems
        && strictUtc(record.createdAt)
        && (record.completedAt === null || strictUtc(record.completedAt))
        && Number.isSafeInteger(record.retryCount)
        && record.retryCount >= 0
        && (record.errorCode === null || opaque(record.errorCode))
        ? Object.freeze({ ...record })
        : null;
}

function normalizeImportItemRecord(value) {
    const record = ownDataValues(value, [
        'id', 'jobId', 'ordinal', 'artifactId', 'status', 'errorCode',
        'retryable', 'activityId'
    ]);
    return record
        && opaque(record.id)
        && opaque(record.jobId)
        && Number.isSafeInteger(record.ordinal)
        && record.ordinal >= 0
        && (record.artifactId === null || opaque(record.artifactId))
        && [...NONTERMINAL_ITEMS, ...TERMINAL_ITEMS].includes(record.status)
        && (record.errorCode === null || opaque(record.errorCode))
        && typeof record.retryable === 'boolean'
        && (record.activityId === null || opaque(record.activityId))
        ? Object.freeze({ ...record })
        : null;
}

function normalizeRawArtifactRecord(value) {
    const record = ownDataValues(value, [
        'id', 'sha256', 'mediaType', 'byteLength', 'content', 'acquiredVia',
        'importedAt', 'state', 'activityId'
    ]);
    return record
        && typeof record.sha256 === 'string'
        && /^[a-f0-9]{64}$/.test(record.sha256)
        && record.id === `raw:${record.sha256}`
        && IMPORT_MEDIA_TYPES.includes(record.mediaType)
        && Number.isSafeInteger(record.byteLength)
        && record.byteLength > 0
        && typeof record.content === 'string'
        && record.content.length > 0
        && exactUtf8ByteLength(record.content, record.byteLength)
        && record.acquiredVia === (
            record.mediaType === PROVIDER_ARTIFACT_MEDIA_TYPE
                ? 'provider-artifact'
                : 'local-file'
        )
        && strictUtc(record.importedAt)
        && (
            (record.state === 'pending' && record.activityId === null)
            || (record.state === 'committed' && opaque(record.activityId))
        )
        ? Object.freeze({ ...record })
        : null;
}

function exactLease(heartbeatAt, leaseExpiresAt) {
    return strictUtc(heartbeatAt)
        && strictUtc(leaseExpiresAt)
        && Date.parse(leaseExpiresAt) - Date.parse(heartbeatAt)
            === SOURCE_OPERATION_LEASE_MS;
}

function validAudit(action, kind, at, code) {
    if (action === null) {
        return kind === null && at === null && code === null;
    }
    return LAST_ACTIONS.includes(action)
        && KINDS.includes(kind)
        && strictUtc(at)
        && (code === null || RESULT_CODES.includes(code));
}

/** Internal exact validator shared with Backup. */
export function normalizeSourceOperationRecord(value) {
    const record = ownDataValues(value, RECORD_FIELDS);
    if (
        !record
        || record.id !== SOURCE_OPERATION_ID
        || ![STATUS.IDLE, STATUS.ACTIVE].includes(record.status)
        || !Number.isSafeInteger(record.revision)
        || record.revision < 0
        || !validAudit(
            record.lastAction,
            record.lastActionKind,
            record.lastActionAt,
            record.lastResultCode
        )
    ) return null;

    if (record.status === STATUS.IDLE) {
        if ([
            'kind', 'phase', 'ownerId', 'operationId', 'jobId',
            'sourceConnectionRevision', 'acquiredAt', 'startedAt',
            'heartbeatAt', 'leaseExpiresAt'
        ].some(field => record[field] !== null)) return null;
    } else {
        if (
            !KINDS.includes(record.kind)
            || !PHASES.includes(record.phase)
            || !uuid(record.ownerId)
            || !uuid(record.operationId)
            || !strictUtc(record.startedAt)
            || !exactLease(record.heartbeatAt, record.leaseExpiresAt)
            || Date.parse(record.heartbeatAt) < Date.parse(record.startedAt)
            || (record.jobId !== null && !opaque(record.jobId))
        ) return null;
        if (record.kind === 'local_import') {
            if (
                record.sourceConnectionRevision !== null
                || record.acquiredAt !== null
            ) return null;
        } else if (
            (record.sourceConnectionRevision !== null && (
                !Number.isSafeInteger(record.sourceConnectionRevision)
                || record.sourceConnectionRevision < 1
            ))
            || (record.acquiredAt !== null && !strictUtc(record.acquiredAt))
            || ((record.sourceConnectionRevision === null)
                !== (record.acquiredAt === null))
        ) return null;
        if (
            record.phase === 'acquiring'
            && record.jobId !== null
        ) return null;
        if (
            (record.phase === 'importing' || record.phase === 'history_commit')
            && record.jobId === null
        ) return null;
        if (
            record.phase === 'history_commit'
            && (
                record.kind !== 'provider_sync'
                || record.sourceConnectionRevision === null
            )
        ) return null;
    }
    return Object.freeze({ ...record });
}

export function createIdleSourceOperationRecord(overrides = {}) {
    const record = normalizeSourceOperationRecord({
        id: SOURCE_OPERATION_ID,
        status: STATUS.IDLE,
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
        lastResultCode: null,
        ...overrides
    });
    return record;
}

function dataInvalid(operation) {
    return storageError(STORAGE_ERROR_CODE.DATA_INVALID, operation);
}

function schemaMismatch(operation) {
    return storageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, operation);
}

function conflict(operation) {
    return storageError(STORAGE_ERROR_CODE.CONFLICT, operation);
}

function notFound(operation) {
    return storageError(STORAGE_ERROR_CODE.NOT_FOUND, operation);
}

function queueOperation(context) {
    return context.scanPage(
        V2_STORE_NAME.SOURCE_OPERATIONS,
        null,
        undefined,
        'next',
        2,
        () => 'include'
    );
}

function readOperation(token, operation) {
    const records = token.read();
    if (records.length !== 1) throw schemaMismatch(operation);
    const record = normalizeSourceOperationRecord(records[0]);
    if (!record) throw schemaMismatch(operation);
    return record;
}

function normalizeClaim(value) {
    const input = ownDataValues(value, CLAIM_FIELDS);
    if (
        !input
        || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 0
        || !uuid(input.ownerId)
        || !uuid(input.operationId)
        || !KINDS.includes(input.kind)
        || !strictUtc(input.startedAt)
        || input.heartbeatAt !== input.startedAt
        || !exactLease(input.heartbeatAt, input.leaseExpiresAt)
    ) return null;
    return Object.freeze({ ...input });
}

function normalizeHeartbeat(value) {
    const input = ownDataValues(value, HEARTBEAT_FIELDS);
    if (
        !input
        || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 0
        || !uuid(input.ownerId)
        || !uuid(input.operationId)
        || !exactLease(input.heartbeatAt, input.leaseExpiresAt)
    ) return null;
    return Object.freeze({ ...input });
}

function normalizeLink(value) {
    const input = ownDataValues(value, LINK_FIELDS);
    if (
        !input
        || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 0
        || !uuid(input.ownerId)
        || !uuid(input.operationId)
        || !opaque(input.jobId)
        || (
            input.sourceConnectionRevision !== null
            && (
                !Number.isSafeInteger(input.sourceConnectionRevision)
                || input.sourceConnectionRevision < 1
            )
        )
        || (input.acquiredAt !== null && !strictUtc(input.acquiredAt))
        || ((input.sourceConnectionRevision === null) !== (input.acquiredAt === null))
    ) return null;
    return Object.freeze({ ...input });
}

function owned(current, input) {
    return current.status === STATUS.ACTIVE
        && current.revision === input.expectedRevision
        && current.ownerId === input.ownerId
        && current.operationId === input.operationId;
}

function activeRecord(current, values) {
    const next = normalizeSourceOperationRecord({
        ...current,
        ...values,
        status: STATUS.ACTIVE,
        revision: current.revision + 1
    });
    if (!next) throw dataInvalid(STORAGE_OPERATION.CLAIM_SOURCE_OPERATION);
    return next;
}

function idleAfter(current, action, actionAt, resultCode) {
    const next = createIdleSourceOperationRecord({
        revision: current.revision + 1,
        lastAction: action,
        lastActionKind: current.kind,
        lastActionAt: actionAt,
        lastResultCode: resultCode
    });
    if (!next) throw schemaMismatch(STORAGE_OPERATION.COMPLETE_SOURCE_OPERATION);
    return next;
}

function openCurrent(dependencies) {
    return new Promise((resolve, reject) => {
        let request;
        try {
            request = dependencies.open.call(
                dependencies.indexedDB,
                V2_DATABASE_NAME,
                V2_DATABASE_VERSION
            );
        } catch {
            reject(storageError(
                STORAGE_ERROR_CODE.OPEN_FAILED,
                STORAGE_OPERATION.CREATE_SOURCE_OPERATION_STORE,
                true
            ));
            return;
        }
        request.onupgradeneeded = () => {
            try { request.transaction.abort(); } catch {}
        };
        request.onerror = () => reject(storageError(
            STORAGE_ERROR_CODE.OPEN_FAILED,
            STORAGE_OPERATION.CREATE_SOURCE_OPERATION_STORE,
            true
        ));
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Queue the atomic ImportJob -> SourceOperation link inside ImportStore's job
 * creation transaction. The caller must include sourceOperations in the same
 * readwrite transaction.
 */
export function enqueueSourceOperationJobLink(context, value, operation) {
    const input = normalizeLink(value);
    if (!input) throw dataInvalid(operation);
    const token = queueOperation(context);
    let current;
    let previousJobToken = null;
    let previousItemsToken = null;
    let result;
    context.afterReads(() => {
        current = readOperation(token, operation);
        if (!owned(current, input)) {
            throw conflict(operation);
        }
        if (
            current.kind === 'local_import'
            && input.sourceConnectionRevision !== null
        ) throw dataInvalid(operation);
        if (
            current.kind === 'provider_sync'
            && input.sourceConnectionRevision === null
        ) throw dataInvalid(operation);
        if (current.phase === 'acquiring') return;
        if (
            current.kind !== 'local_import'
            || current.phase !== 'importing'
            || current.jobId === null
        ) throw conflict(operation);
        previousJobToken = context.get(
            V2_STORE_NAME.IMPORT_JOBS,
            current.jobId
        );
        previousItemsToken = context.getAll(
            V2_STORE_NAME.IMPORT_ITEMS,
            'byJobId',
            current.jobId
        );
    });
    context.afterReads(() => {
        if (previousJobToken !== null) {
            const previousJob = normalizeImportJobRecord(previousJobToken.read());
            if (!previousJob || !TERMINAL_JOBS.includes(previousJob.status)) {
                throw conflict(operation);
            }
            const previousItems = exactItemsForJob(
                previousItemsToken.read(),
                previousJob,
                operation
            );
            assertExactTerminalJob(previousJob, previousItems, operation);
        }
        result = activeRecord(current, {
            phase: 'importing',
            jobId: input.jobId,
            sourceConnectionRevision: input.sourceConnectionRevision,
            acquiredAt: input.acquiredAt
        });
        context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
    });
    return () => result;
}

function normalizeAction(value) {
    const input = ownDataValues(value, ACTION_FIELDS);
    if (
        !input
        || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 0
        || !uuid(input.ownerId)
        || !uuid(input.operationId)
        || (input.jobId !== null && !opaque(input.jobId))
        || !strictUtc(input.actionAt)
        || !exactLease(input.actionAt, input.leaseExpiresAt)
    ) return null;
    return Object.freeze({ ...input });
}

function exactItemsForJob(items, job, operation) {
    const normalized = items.map(normalizeImportItemRecord);
    if (
        normalized.some(item => item === null)
        || normalized.length !== job.totalItems
        || normalized.some(item => item.jobId !== job.id)
    ) throw schemaMismatch(operation);
    const ordered = normalized.slice().sort((left, right) => (
        left.ordinal - right.ordinal
    ));
    if (ordered.some((item, index) => item.ordinal !== index)) {
        throw schemaMismatch(operation);
    }
    return ordered;
}

function assertExactTerminalJob(job, items, operation) {
    if (
        !TERMINAL_JOBS.includes(job.status)
        || job.completedItems !== job.totalItems
        || job.completedAt === null
        || items.some(item => !TERMINAL_ITEMS.includes(item.status))
        || (COMPLETED_TERMINAL_JOBS.includes(job.status) && job.errorCode !== null)
        || (FAILED_TERMINAL_JOBS.includes(job.status) && job.errorCode === null)
    ) throw schemaMismatch(operation);
}

export function createSourceOperationStore(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_SOURCE_OPERATION_STORE
        );
    }
    const canonicalStore = createCanonicalStore({
        indexedDB: dependencies.indexedDB,
        IDBKeyRange: dependencies.IDBKeyRange,
        now: dependencies.now,
        applicationVersion: dependencies.applicationVersion
    });
    const state = {
        database: null,
        opening: null,
        operations: new Set(),
        stale: false,
        closing: null
    };

    async function initialize() {
        if (state.closing) await state.closing;
        if (state.database && !state.stale) return READY_RESULT;
        if (state.opening) return state.opening;
        state.stale = false;
        const opening = (async () => {
            await canonicalStore.initialize();
            const database = await openCurrent(dependencies);
            if (state.stale) {
                database.close();
                throw storageError(
                    STORAGE_ERROR_CODE.CONNECTION_STALE,
                    STORAGE_OPERATION.CREATE_SOURCE_OPERATION_STORE
                );
            }
            database.onversionchange = () => {
                database.close();
                if (state.database === database) state.database = null;
                state.stale = true;
            };
            state.database = database;
            return READY_RESULT;
        })();
        state.opening = opening;
        opening.finally(() => {
            if (state.opening === opening) state.opening = null;
        }).catch(() => {});
        return opening;
    }

    function runReady(operation, callback) {
        if (!state.database || state.stale || state.opening || state.closing) {
            return Promise.reject(storageError(
                STORAGE_ERROR_CODE.CONNECTION_STALE,
                operation
            ));
        }
        let result;
        try { result = callback(state.database); } catch {
            return Promise.reject(storageError(
                STORAGE_ERROR_CODE.TRANSACTION_ABORTED,
                operation
            ));
        }
        const tracked = Promise.resolve(result);
        state.operations.add(tracked);
        tracked.finally(() => state.operations.delete(tracked)).catch(() => {});
        return tracked;
    }

    function getOperation() {
        const operation = STORAGE_OPERATION.GET_SOURCE_OPERATION;
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_OPERATIONS],
            mode: 'readonly',
            operation
        }, context => {
            const token = queueOperation(context);
            return () => readOperation(token, operation);
        }));
    }

    function claimOperation(value) {
        const operation = STORAGE_OPERATION.CLAIM_SOURCE_OPERATION;
        const input = normalizeClaim(value);
        if (!input) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_OPERATIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queueOperation(context);
            let result;
            context.afterReads(() => {
                const current = readOperation(token, operation);
                if (
                    current.status !== STATUS.IDLE
                    || current.revision !== input.expectedRevision
                ) throw conflict(operation);
                result = activeRecord(current, {
                    kind: input.kind,
                    phase: 'acquiring',
                    ownerId: input.ownerId,
                    operationId: input.operationId,
                    jobId: null,
                    sourceConnectionRevision: null,
                    acquiredAt: null,
                    startedAt: input.startedAt,
                    heartbeatAt: input.heartbeatAt,
                    leaseExpiresAt: input.leaseExpiresAt
                });
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
            });
            return () => result;
        }));
    }

    function heartbeatOperation(value) {
        const operation = STORAGE_OPERATION.HEARTBEAT_SOURCE_OPERATION;
        const input = normalizeHeartbeat(value);
        if (!input) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_OPERATIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queueOperation(context);
            let result;
            context.afterReads(() => {
                const current = readOperation(token, operation);
                if (
                    !owned(current, input)
                    || Date.parse(input.heartbeatAt) < Date.parse(current.heartbeatAt)
                    || Date.parse(input.heartbeatAt) < Date.parse(current.startedAt)
                ) throw conflict(operation);
                result = activeRecord(current, {
                    heartbeatAt: input.heartbeatAt,
                    leaseExpiresAt: input.leaseExpiresAt
                });
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
            });
            return () => result;
        }));
    }

    function linkOperationJob(value) {
        const operation = STORAGE_OPERATION.LINK_SOURCE_OPERATION_JOB;
        if (!normalizeLink(value)) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.SOURCE_OPERATIONS,
                V2_STORE_NAME.IMPORT_JOBS,
                V2_STORE_NAME.IMPORT_ITEMS
            ],
            mode: 'readwrite',
            operation
        }, context => {
            const jobToken = context.get(V2_STORE_NAME.IMPORT_JOBS, value.jobId);
            const result = enqueueSourceOperationJobLink(context, value, operation);
            context.afterReads(() => {
                const job = normalizeImportJobRecord(jobToken.read());
                if (!job || !NONTERMINAL_JOBS.includes(job.status)) {
                    throw notFound(operation);
                }
            });
            return result;
        }));
    }

    function beginHistoryCommit(value) {
        const operation = STORAGE_OPERATION.LINK_SOURCE_OPERATION_JOB;
        const input = ownDataValues(value, OWNER_MUTATION_FIELDS);
        if (
            !input
            || !Number.isSafeInteger(input.expectedRevision)
            || input.expectedRevision < 0
            || !uuid(input.ownerId)
            || !uuid(input.operationId)
        ) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_OPERATIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queueOperation(context);
            let result;
            context.afterReads(() => {
                const current = readOperation(token, operation);
                if (
                    !owned(current, input)
                    || current.kind !== 'provider_sync'
                    || current.phase !== 'importing'
                    || current.sourceConnectionRevision === null
                ) throw conflict(operation);
                result = activeRecord(current, { phase: 'history_commit' });
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
            });
            return () => result;
        }));
    }

    function completeOperation(value) {
        const operation = STORAGE_OPERATION.COMPLETE_SOURCE_OPERATION;
        const input = ownDataValues(value, COMPLETE_FIELDS);
        if (
            !input
            || !Number.isSafeInteger(input.expectedRevision)
            || input.expectedRevision < 0
            || !uuid(input.ownerId)
            || !uuid(input.operationId)
            || !LAST_ACTIONS.includes(input.lastAction)
            || !strictUtc(input.lastActionAt)
            || (input.lastResultCode !== null
                && !RESULT_CODES.includes(input.lastResultCode))
        ) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_OPERATIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queueOperation(context);
            let result;
            context.afterReads(() => {
                const current = readOperation(token, operation);
                if (
                    !owned(current, input)
                    || Date.parse(input.lastActionAt) < Date.parse(current.startedAt)
                    || Date.parse(input.lastActionAt) < Date.parse(current.heartbeatAt)
                ) throw conflict(operation);
                result = idleAfter(
                    current,
                    input.lastAction,
                    input.lastActionAt,
                    input.lastResultCode
                );
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
            });
            return () => result;
        }));
    }

    function listOrphanImportJobs() {
        const operation = STORAGE_OPERATION.LIST_ORPHAN_IMPORT_JOBS;
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.SOURCE_OPERATIONS,
                V2_STORE_NAME.IMPORT_JOBS,
                V2_STORE_NAME.IMPORT_ITEMS,
                V2_STORE_NAME.RAW_ARTIFACTS
            ],
            mode: 'readonly',
            operation
        }, context => {
            const operationToken = queueOperation(context);
            const jobsToken = context.getAll(V2_STORE_NAME.IMPORT_JOBS);
            const itemsToken = context.getAll(V2_STORE_NAME.IMPORT_ITEMS);
            const rawToken = context.getAll(V2_STORE_NAME.RAW_ARTIFACTS);
            return () => {
                const current = readOperation(operationToken, operation);
                const jobs = jobsToken.read().map(normalizeImportJobRecord);
                const items = itemsToken.read().map(normalizeImportItemRecord);
                const artifacts = rawToken.read().map(normalizeRawArtifactRecord);
                if (
                    jobs.some(job => job === null)
                    || items.some(item => item === null)
                    || artifacts.some(artifact => artifact === null)
                ) throw schemaMismatch(operation);
                const rawById = new Map(artifacts.map(artifact => [artifact.id, artifact]));
                return Object.freeze(jobs
                    .filter(job => (
                        NONTERMINAL_JOBS.includes(job.status)
                        || (
                            TERMINAL_JOBS.includes(job.status)
                            && current.status === STATUS.ACTIVE
                            && current.jobId === job.id
                        )
                    ))
                    .sort((left, right) => (
                        left.createdAt === right.createdAt
                            ? (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
                            : left.createdAt < right.createdAt ? -1 : 1
                    ))
                    .map(job => {
                        const jobItems = exactItemsForJob(
                            items.filter(item => item.jobId === job.id),
                            job,
                            operation
                        );
                        let recoveryMode;
                        if (TERMINAL_JOBS.includes(job.status)) {
                            assertExactTerminalJob(job, jobItems, operation);
                            recoveryMode = COMPLETED_TERMINAL_JOBS.includes(job.status)
                                ? 'terminal'
                                : null;
                        } else if (job.status === 'analyzing') {
                            recoveryMode = jobItems.every(item => (
                                TERMINAL_ITEMS.includes(item.status)
                            )) ? 'finalized' : null;
                        } else {
                            recoveryMode = jobItems.some(item => {
                                if (!NONTERMINAL_ITEMS.includes(item.status)) return false;
                                const artifact = item.artifactId === null
                                    ? null
                                    : rawById.get(item.artifactId);
                                return artifact?.state === 'pending';
                            })
                                ? 'scheduled'
                                : null;
                        }
                        return Object.freeze({
                            ...job,
                            orphan: job.id !== current.jobId,
                            recoveryMode
                        });
                    }));
            };
        }));
    }

    function recoverOperation(value) {
        const operation = STORAGE_OPERATION.RECOVER_SOURCE_OPERATION;
        const input = normalizeAction(value);
        if (!input || input.jobId === null) {
            return Promise.reject(dataInvalid(operation));
        }
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.SOURCE_OPERATIONS,
                V2_STORE_NAME.IMPORT_JOBS,
                V2_STORE_NAME.IMPORT_ITEMS,
                V2_STORE_NAME.RAW_ARTIFACTS
            ],
            mode: 'readwrite',
            operation
        }, context => {
            const operationToken = queueOperation(context);
            const jobToken = context.get(V2_STORE_NAME.IMPORT_JOBS, input.jobId);
            const itemsToken = context.getAll(
                V2_STORE_NAME.IMPORT_ITEMS,
                'byJobId',
                input.jobId
            );
            let rawTokens = [];
            let current;
            let job;
            let items;
            context.afterReads(() => {
                current = readOperation(operationToken, operation);
                job = normalizeImportJobRecord(jobToken.read());
                if (
                    !job
                    || ![
                        ...NONTERMINAL_JOBS,
                        ...COMPLETED_TERMINAL_JOBS
                    ].includes(job.status)
                ) {
                    throw notFound(operation);
                }
                items = exactItemsForJob(itemsToken.read(), job, operation);
                const linkedStale = current.status === STATUS.ACTIVE
                    && current.revision === input.expectedRevision
                    && current.jobId === input.jobId
                    && Date.parse(input.actionAt) >= Date.parse(current.leaseExpiresAt);
                const orphan = current.status === STATUS.IDLE
                    && current.revision === input.expectedRevision;
                if (!linkedStale && !orphan) throw conflict(operation);
                if (COMPLETED_TERMINAL_JOBS.includes(job.status)) {
                    if (!linkedStale) throw conflict(operation);
                    assertExactTerminalJob(job, items, operation);
                }
                rawTokens = items.map(item => (
                    NONTERMINAL_ITEMS.includes(item.status) && item.artifactId !== null
                        ? context.get(V2_STORE_NAME.RAW_ARTIFACTS, item.artifactId)
                        : null
                ));
            });
            let result;
            context.afterReads(() => {
                if (COMPLETED_TERMINAL_JOBS.includes(job.status)) {
                    const nextOperation = activeRecord(current, {
                        ownerId: input.ownerId,
                        operationId: input.operationId,
                        startedAt: input.actionAt,
                        heartbeatAt: input.actionAt,
                        leaseExpiresAt: input.leaseExpiresAt,
                        lastAction: 'recovered',
                        lastActionKind: current.kind,
                        lastActionAt: input.actionAt,
                        lastResultCode: null
                    });
                    context.put(
                        V2_STORE_NAME.SOURCE_OPERATIONS,
                        { ...nextOperation }
                    );
                    result = Object.freeze({
                        mode: 'terminal',
                        operation: nextOperation,
                        job
                    });
                    return;
                }
                if (job.status === 'analyzing') {
                    if (items.some(item => !TERMINAL_ITEMS.includes(item.status))) {
                        throw conflict(operation);
                    }
                    const nextJob = {
                        ...job,
                        status: 'completed_with_warnings',
                        completedItems: items.length,
                        completedAt: input.actionAt,
                        errorCode: null
                    };
                    context.put(V2_STORE_NAME.IMPORT_JOBS, nextJob);
                    const base = current.status === STATUS.ACTIVE
                        ? current
                        : createIdleSourceOperationRecord({ revision: current.revision });
                    const kind = current.status === STATUS.ACTIVE
                        ? current.kind
                        : 'local_import';
                    result = activeRecord(base, {
                        kind,
                        phase: 'importing',
                        ownerId: input.ownerId,
                        operationId: input.operationId,
                        jobId: input.jobId,
                        sourceConnectionRevision: current.status === STATUS.ACTIVE
                            ? current.sourceConnectionRevision
                            : null,
                        acquiredAt: current.status === STATUS.ACTIVE
                            ? current.acquiredAt
                            : null,
                        startedAt: input.actionAt,
                        heartbeatAt: input.actionAt,
                        leaseExpiresAt: input.leaseExpiresAt,
                        lastAction: 'recovered',
                        lastActionKind: kind,
                        lastActionAt: input.actionAt,
                        lastResultCode: 'RECOVERY_REQUEUED'
                    });
                    context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...result });
                    result = Object.freeze({
                        mode: 'finalized',
                        operation: result,
                        job: Object.freeze(nextJob)
                    });
                    return;
                }

                let schedulable = 0;
                let terminalCount = 0;
                items.forEach((item, index) => {
                    if (TERMINAL_ITEMS.includes(item.status)) {
                        terminalCount += 1;
                        return;
                    }
                    const artifact = rawTokens[index]
                        ? normalizeRawArtifactRecord(rawTokens[index].read())
                        : null;
                    const recoverable = artifact
                        && artifact.id === item.artifactId
                        && artifact.state === 'pending';
                    const nextItem = recoverable
                        ? {
                            ...item,
                            status: 'retrying',
                            errorCode: null,
                            retryable: false,
                            activityId: null
                        }
                        : {
                            ...item,
                            status: 'cancelled',
                            errorCode: 'RECOVERY_SOURCE_UNAVAILABLE',
                            retryable: false,
                            activityId: null
                        };
                    if (recoverable) schedulable += 1;
                    else terminalCount += 1;
                    context.put(V2_STORE_NAME.IMPORT_ITEMS, nextItem);
                });
                if (schedulable === 0) throw conflict(operation);
                const nextJob = {
                    ...job,
                    status: 'retrying',
                    completedItems: terminalCount,
                    completedAt: null,
                    retryCount: job.retryCount + 1,
                    errorCode: null
                };
                context.put(V2_STORE_NAME.IMPORT_JOBS, nextJob);
                const base = current.status === STATUS.ACTIVE
                    ? current
                    : createIdleSourceOperationRecord({ revision: current.revision });
                const kind = current.status === STATUS.ACTIVE
                    ? current.kind
                    : 'local_import';
                const nextOperation = activeRecord(base, {
                    kind,
                    phase: 'importing',
                    ownerId: input.ownerId,
                    operationId: input.operationId,
                    jobId: input.jobId,
                    sourceConnectionRevision: current.status === STATUS.ACTIVE
                        ? current.sourceConnectionRevision
                        : null,
                    acquiredAt: current.status === STATUS.ACTIVE
                        ? current.acquiredAt
                        : null,
                    startedAt: input.actionAt,
                    heartbeatAt: input.actionAt,
                    leaseExpiresAt: input.leaseExpiresAt,
                    lastAction: 'recovered',
                    lastActionKind: kind,
                    lastActionAt: input.actionAt,
                    lastResultCode: 'RECOVERY_REQUEUED'
                });
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...nextOperation });
                result = Object.freeze({
                    mode: 'scheduled',
                    operation: nextOperation,
                    job: Object.freeze(nextJob),
                    scheduledItems: schedulable
                });
            });
            return () => result;
        }));
    }

    function abandonOperation(value) {
        const operation = STORAGE_OPERATION.ABANDON_SOURCE_OPERATION;
        const input = normalizeAction(value);
        if (!input) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.SOURCE_OPERATIONS,
                V2_STORE_NAME.IMPORT_JOBS,
                V2_STORE_NAME.IMPORT_ITEMS
            ],
            mode: 'readwrite',
            operation
        }, context => {
            const operationToken = queueOperation(context);
            const jobToken = input.jobId === null
                ? null
                : context.get(V2_STORE_NAME.IMPORT_JOBS, input.jobId);
            const itemsToken = input.jobId === null
                ? null
                : context.getAll(
                    V2_STORE_NAME.IMPORT_ITEMS,
                    'byJobId',
                    input.jobId
                );
            let result;
            context.afterReads(() => {
                const current = readOperation(operationToken, operation);
                const linkedStale = current.status === STATUS.ACTIVE
                    && current.revision === input.expectedRevision
                    && current.jobId === input.jobId
                    && Date.parse(input.actionAt) >= Date.parse(current.leaseExpiresAt);
                const orphan = current.status === STATUS.IDLE
                    && current.revision === input.expectedRevision
                    && input.jobId !== null;
                if (!linkedStale && !orphan) throw conflict(operation);

                let kind = current.status === STATUS.ACTIVE
                    ? current.kind
                    : 'local_import';
                let nextJob = null;
                if (input.jobId !== null) {
                    const job = normalizeImportJobRecord(jobToken.read());
                    if (
                        !job
                        || ![...NONTERMINAL_JOBS, ...TERMINAL_JOBS]
                            .includes(job.status)
                    ) {
                        throw notFound(operation);
                    }
                    const items = exactItemsForJob(itemsToken.read(), job, operation);
                    if (TERMINAL_JOBS.includes(job.status)) {
                        if (!linkedStale) throw conflict(operation);
                        assertExactTerminalJob(job, items, operation);
                        nextJob = job;
                    } else {
                        for (const item of items) {
                            if (TERMINAL_ITEMS.includes(item.status)) continue;
                            context.put(V2_STORE_NAME.IMPORT_ITEMS, {
                                ...item,
                                status: 'cancelled',
                                errorCode: 'RECOVERY_ABANDONED',
                                retryable: false,
                                activityId: null
                            });
                        }
                        nextJob = {
                            ...job,
                            status: 'cancelled',
                            completedItems: job.totalItems,
                            completedAt: input.actionAt,
                            errorCode: 'RECOVERY_ABANDONED'
                        };
                        context.put(V2_STORE_NAME.IMPORT_JOBS, nextJob);
                    }
                }
                const auditBase = current.status === STATUS.ACTIVE
                    ? current
                    : normalizeSourceOperationRecord({
                        ...current,
                        kind,
                        status: 'active',
                        phase: 'importing',
                        ownerId: input.ownerId,
                        operationId: input.operationId,
                        jobId: input.jobId,
                        startedAt: input.actionAt,
                        heartbeatAt: input.actionAt,
                        leaseExpiresAt: input.leaseExpiresAt
                    });
                if (!auditBase) throw schemaMismatch(operation);
                const idle = idleAfter(
                    auditBase,
                    'abandoned',
                    input.actionAt,
                    'RECOVERY_ABANDONED'
                );
                context.put(V2_STORE_NAME.SOURCE_OPERATIONS, { ...idle });
                result = Object.freeze({
                    operation: idle,
                    job: nextJob ? Object.freeze(nextJob) : null
                });
            });
            return () => result;
        }));
    }

    function close() {
        if (state.closing) return state.closing;
        state.stale = true;
        if (state.database) {
            state.database.close();
            state.database = null;
        }
        const closing = Promise.allSettled([
            ...state.operations,
            ...(state.opening ? [state.opening] : []),
            canonicalStore.close()
        ]).then(() => CLOSED_RESULT);
        state.closing = closing;
        closing.finally(() => {
            if (state.closing === closing) state.closing = null;
        }).catch(() => {});
        return closing;
    }

    return Object.freeze({
        initialize,
        getOperation,
        claimOperation,
        heartbeatOperation,
        linkOperationJob,
        beginHistoryCommit,
        completeOperation,
        listOrphanImportJobs,
        recoverOperation,
        abandonOperation,
        close
    });
}
