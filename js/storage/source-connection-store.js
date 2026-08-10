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

const OPTION_FIELDS = Object.freeze([
    'indexedDB',
    'IDBKeyRange',
    'now',
    'applicationVersion'
]);
const RECORD_FIELDS = Object.freeze([
    'id',
    'provider',
    'subjectId',
    'status',
    'lastSyncAt',
    'errorCode',
    'revision'
]);
const TRANSITION_FIELDS = Object.freeze([
    'id',
    'expectedRevision',
    'status',
    'lastSyncAt',
    'errorCode'
]);
const CONNECTION_ID = 'source-connection:strava';
const PROVIDER = 'strava';
const STATUSES = Object.freeze([
    'connected',
    'reconnect_required',
    'error',
    'disconnected'
]);
const TRANSITIONS = Object.freeze({
    connected: Object.freeze([
        'connected',
        'reconnect_required',
        'error',
        'disconnected'
    ]),
    reconnect_required: Object.freeze(['connected', 'disconnected']),
    error: Object.freeze([
        'connected',
        'reconnect_required',
        'disconnected'
    ]),
    disconnected: Object.freeze(['connected'])
});
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
        if (
            value === null
            || (typeof value !== 'object' && typeof value !== 'function')
        ) return null;
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
    if (!values) return null;
    const open = findDataMethod(values.indexedDB, 'open');
    const bound = findDataMethod(values.IDBKeyRange, 'bound');
    if (
        !open
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

function validStatusError(status, errorCode) {
    if (status === 'connected') return errorCode === null;
    if (status === 'reconnect_required') {
        return errorCode === 'AUTHORIZATION_REQUIRED';
    }
    if (status === 'error') return errorCode === 'CONNECTION_ERROR';
    return status === 'disconnected'
        && (errorCode === null || errorCode === 'REVOCATION_UNCONFIRMED');
}

/**
 * Internal strict validator shared with Backup. It never executes accessors and
 * returns a detached, deeply frozen record or null.
 */
export function normalizeSourceConnectionRecord(value) {
    const record = ownDataValues(value, RECORD_FIELDS);
    if (
        !record
        || record.id !== CONNECTION_ID
        || record.provider !== PROVIDER
        || typeof record.subjectId !== 'string'
        || !/^[1-9]\d*$/.test(record.subjectId)
        || !STATUSES.includes(record.status)
        || (record.lastSyncAt !== null && !strictUtc(record.lastSyncAt))
        || !validStatusError(record.status, record.errorCode)
        || !Number.isSafeInteger(record.revision)
        || record.revision < 1
    ) return null;
    return Object.freeze({
        id: record.id,
        provider: record.provider,
        subjectId: record.subjectId,
        status: record.status,
        lastSyncAt: record.lastSyncAt,
        errorCode: record.errorCode,
        revision: record.revision
    });
}

function normalizeTransition(value) {
    const input = ownDataValues(value, TRANSITION_FIELDS);
    if (
        !input
        || input.id !== CONNECTION_ID
        || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 1
        || !STATUSES.includes(input.status)
        || (input.lastSyncAt !== null && !strictUtc(input.lastSyncAt))
        || !validStatusError(input.status, input.errorCode)
    ) return null;
    return Object.freeze({
        id: input.id,
        expectedRevision: input.expectedRevision,
        status: input.status,
        lastSyncAt: input.lastSyncAt,
        errorCode: input.errorCode
    });
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

function cloneRecord(value, operation) {
    const normalized = normalizeSourceConnectionRecord(value);
    if (!normalized) throw schemaMismatch(operation);
    return normalized;
}

function queuePersistedConnections(context) {
    return context.scanPage(
        V2_STORE_NAME.SOURCE_CONNECTIONS,
        null,
        undefined,
        'next',
        2,
        () => 'include'
    );
}

function readPersistedConnection(token, operation) {
    const records = token.read();
    if (records.length === 0) return null;
    if (records.length !== 1) throw schemaMismatch(operation);
    return cloneRecord(records[0], operation);
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
                STORAGE_OPERATION.CREATE_SOURCE_CONNECTION_STORE,
                true
            ));
            return;
        }
        request.onupgradeneeded = () => {
            try {
                request.transaction.abort();
            } catch {
                // The terminal request event remains authoritative.
            }
        };
        request.onerror = () => reject(storageError(
            STORAGE_ERROR_CODE.OPEN_FAILED,
            STORAGE_OPERATION.CREATE_SOURCE_CONNECTION_STORE,
            true
        ));
        request.onsuccess = () => resolve(request.result);
    });
}

function legalTransition(current, next) {
    if (!TRANSITIONS[current.status].includes(next.status)) return false;
    if (next.status !== 'connected') {
        return next.lastSyncAt === current.lastSyncAt;
    }
    if (
        current.lastSyncAt !== null
        && (
            next.lastSyncAt === null
            || next.lastSyncAt < current.lastSyncAt
        )
    ) return false;
    if (current.status === 'connected') {
        return next.lastSyncAt !== null
            && (
                current.lastSyncAt === null
                || next.lastSyncAt > current.lastSyncAt
            );
    }
    return true;
}

export function createSourceConnectionStore(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_SOURCE_CONNECTION_STORE
        );
    }
    const safeOptions = {
        indexedDB: dependencies.indexedDB,
        IDBKeyRange: dependencies.IDBKeyRange,
        now: dependencies.now,
        applicationVersion: dependencies.applicationVersion
    };
    const canonicalStore = createCanonicalStore(safeOptions);
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
                    STORAGE_OPERATION.INITIALIZE
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
        try {
            result = callback(state.database);
        } catch {
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

    function getConnection(provider) {
        const operation = STORAGE_OPERATION.GET_CONNECTION;
        if (provider !== PROVIDER) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_CONNECTIONS],
            mode: 'readonly',
            operation
        }, context => {
            const token = queuePersistedConnections(context);
            return () => {
                const normalized = readPersistedConnection(token, operation);
                if (normalized === null) return null;
                if (normalized.provider !== provider) throw schemaMismatch(operation);
                return normalized;
            };
        }));
    }

    function createConnection(value) {
        const operation = STORAGE_OPERATION.CREATE_CONNECTION;
        const record = normalizeSourceConnectionRecord(value);
        if (
            !record
            || record.status !== 'connected'
            || record.lastSyncAt !== null
            || record.errorCode !== null
            || record.revision !== 1
        ) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_CONNECTIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queuePersistedConnections(context);
            context.afterReads(() => {
                const existing = readPersistedConnection(token, operation);
                if (existing !== null) throw conflict(operation);
                context.add(V2_STORE_NAME.SOURCE_CONNECTIONS, { ...record });
            });
            return () => record;
        }));
    }

    function transitionConnection(value) {
        const operation = STORAGE_OPERATION.TRANSITION_CONNECTION;
        const input = normalizeTransition(value);
        if (!input) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [V2_STORE_NAME.SOURCE_CONNECTIONS],
            mode: 'readwrite',
            operation
        }, context => {
            const token = queuePersistedConnections(context);
            let result;
            context.afterReads(() => {
                const current = readPersistedConnection(token, operation);
                if (current === null) {
                    throw storageError(STORAGE_ERROR_CODE.NOT_FOUND, operation);
                }
                if (
                    current.revision !== input.expectedRevision
                    || !legalTransition(current, input)
                ) throw conflict(operation);
                result = normalizeSourceConnectionRecord({
                    ...current,
                    status: input.status,
                    lastSyncAt: input.lastSyncAt,
                    errorCode: input.errorCode,
                    revision: current.revision + 1
                });
                if (!result) throw dataInvalid(operation);
                context.put(V2_STORE_NAME.SOURCE_CONNECTIONS, { ...result });
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
        getConnection,
        createConnection,
        transitionConnection,
        close
    });
}
