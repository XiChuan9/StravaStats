import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION
} from './constants.js';
import { isStorageError, storageError } from './errors.js';
import { V2_SCHEMA } from './schema.js';

const TRANSACTION_OPTION_FIELDS = Object.freeze([
    'storeNames',
    'mode',
    'operation'
]);

const MODES = Object.freeze(['readonly', 'readwrite']);
const OPERATIONS = Object.freeze(Object.values(STORAGE_OPERATION));
const STORE_NAMES = Object.freeze(V2_SCHEMA.stores.map(store => store.name));

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ownDataValues(value, fields) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || !sameArray(keys.slice().sort(), fields.slice().sort())
        ) {
            return null;
        }
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

function cloneStoreNames(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            || keys.length !== value.length + 1
            || value.length === 0
        ) {
            return null;
        }
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(
                value,
                String(index)
            );
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            if (
                typeof descriptor.value !== 'string'
                || !STORE_NAMES.includes(descriptor.value)
                || result.includes(descriptor.value)
            ) {
                return null;
            }
            result.push(descriptor.value);
        }
        return Object.freeze(result);
    } catch {
        return null;
    }
}

function normalizeOptions(options) {
    const values = ownDataValues(options, TRANSACTION_OPTION_FIELDS);
    if (!values) return null;
    const storeNames = cloneStoreNames(values.storeNames);
    if (
        !storeNames
        || !MODES.includes(values.mode)
        || !OPERATIONS.includes(values.operation)
    ) {
        return null;
    }
    return Object.freeze({
        storeNames,
        mode: values.mode,
        operation: values.operation
    });
}

function errorName(value) {
    try {
        return typeof value?.name === 'string' ? value.name : null;
    } catch {
        return null;
    }
}

function mapFailure(error, operation) {
    try {
        if (isStorageError(error)) return error;
    } catch {
        // Hostile values are mapped below without retaining the raw object.
    }
    const name = errorName(error);
    if (name === 'QuotaExceededError') {
        return storageError(STORAGE_ERROR_CODE.QUOTA_EXCEEDED, operation);
    }
    if (name === 'ConstraintError') {
        return storageError(
            STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION,
            operation
        );
    }
    return storageError(STORAGE_ERROR_CODE.TRANSACTION_ABORTED, operation);
}

function requestFailure(request) {
    try {
        return request.error;
    } catch {
        return null;
    }
}

export function runTransaction(database, options, enqueue) {
    const normalized = normalizeOptions(options);
    if (!normalized || typeof enqueue !== 'function') {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            normalized?.operation ?? null
        ));
    }

    return new Promise((resolve, reject) => {
        let transaction;
        let failure = null;
        let pendingRequests = 0;
        let enqueueFinished = false;
        let resultBuilder = null;
        const afterReads = [];

        const fail = error => {
            if (failure === null) {
                failure = mapFailure(error, normalized.operation);
            }
            try {
                transaction?.abort();
            } catch {
                // Settlement remains owned by the transaction terminal event.
            }
        };

        const readSource = (storeName, indexName) => {
            if (!normalized.storeNames.includes(storeName)) {
                throw storageError(
                    STORAGE_ERROR_CODE.INVALID_REQUEST,
                    normalized.operation
                );
            }
            const store = transaction.objectStore(storeName);
            return indexName === null ? store : store.index(indexName);
        };

        const drainAfterReads = () => {
            if (
                !enqueueFinished
                || pendingRequests !== 0
                || failure !== null
            ) {
                return;
            }
            while (afterReads.length > 0 && pendingRequests === 0) {
                const callback = afterReads.shift();
                try {
                    callback();
                } catch (error) {
                    fail(error);
                    return;
                }
            }
        };

        const queueRequest = createRequest => {
            let request;
            let ready = false;
            let value;
            try {
                request = createRequest();
            } catch (error) {
                fail(error);
                throw mapFailure(error, normalized.operation);
            }
            pendingRequests += 1;
            request.onsuccess = () => {
                try {
                    value = request.result;
                    ready = true;
                    pendingRequests -= 1;
                    drainAfterReads();
                } catch (error) {
                    fail(error);
                }
            };
            request.onerror = () => {
                pendingRequests -= 1;
                fail(requestFailure(request));
            };
            return Object.freeze({
                read() {
                    if (!ready) {
                        throw storageError(
                            STORAGE_ERROR_CODE.TRANSACTION_ABORTED,
                            normalized.operation
                        );
                    }
                    return value;
                }
            });
        };

        const queueCursorPage = (
            createRequest,
            limit,
            select,
            resumeKey,
            resumePrimaryKey
        ) => {
            let request;
            let ready = false;
            const values = [];
            let settled = false;

            const finish = () => {
                if (settled) return;
                settled = true;
                ready = true;
                pendingRequests -= 1;
                drainAfterReads();
            };

            try {
                request = createRequest();
            } catch (error) {
                fail(error);
                throw mapFailure(error, normalized.operation);
            }
            pendingRequests += 1;
            request.onsuccess = () => {
                if (settled) return;
                try {
                    const cursor = request.result;
                    if (cursor === null) {
                        finish();
                        return;
                    }
                    const decision = select(
                        cursor.key,
                        cursor.primaryKey,
                        cursor.value
                    );
                    if (decision === 'stop') {
                        finish();
                        return;
                    }
                    if (decision === 'seek') {
                        if (
                            resumeKey === undefined
                            || resumePrimaryKey === undefined
                            || typeof cursor.continuePrimaryKey !== 'function'
                        ) {
                            throw storageError(
                                STORAGE_ERROR_CODE.INVALID_REQUEST,
                                normalized.operation
                            );
                        }
                        cursor.continuePrimaryKey(
                            resumeKey,
                            resumePrimaryKey
                        );
                        return;
                    }
                    if (decision !== 'include' && decision !== 'skip') {
                        throw storageError(
                            STORAGE_ERROR_CODE.INVALID_REQUEST,
                            normalized.operation
                        );
                    }
                    if (decision === 'include') values.push(cursor.value);
                    if (values.length === limit) {
                        finish();
                        return;
                    }
                    cursor.continue();
                } catch (error) {
                    if (!settled) {
                        settled = true;
                        pendingRequests -= 1;
                    }
                    fail(error);
                }
            };
            request.onerror = () => {
                if (!settled) {
                    settled = true;
                    pendingRequests -= 1;
                }
                fail(requestFailure(request));
            };
            return Object.freeze({
                read() {
                    if (!ready) {
                        throw storageError(
                            STORAGE_ERROR_CODE.TRANSACTION_ABORTED,
                            normalized.operation
                        );
                    }
                    return values;
                }
            });
        };

        const context = Object.freeze({
            get(storeName, key) {
                return queueRequest(() => (
                    readSource(storeName, null).get(key)
                ));
            },
            getAll(storeName, indexName = null, query = undefined) {
                return queueRequest(() => {
                    const source = readSource(storeName, indexName);
                    return query === undefined
                        ? source.getAll()
                        : source.getAll(query);
                });
            },
            scanPage(
                storeName,
                indexName,
                query,
                direction,
                limit,
                select,
                resumeKey = undefined,
                resumePrimaryKey = undefined
            ) {
                if (
                    (direction !== 'next' && direction !== 'prev')
                    || !Number.isSafeInteger(limit)
                    || limit < 1
                    || typeof select !== 'function'
                ) {
                    throw storageError(
                        STORAGE_ERROR_CODE.INVALID_REQUEST,
                        normalized.operation
                    );
                }
                return queueCursorPage(
                    () => readSource(storeName, indexName)
                        .openCursor(query, direction),
                    limit,
                    select,
                    resumeKey,
                    resumePrimaryKey
                );
            },
            count(storeName) {
                return queueRequest(() => (
                    readSource(storeName, null).count()
                ));
            },
            add(storeName, value) {
                if (normalized.mode !== 'readwrite') {
                    throw storageError(
                        STORAGE_ERROR_CODE.INVALID_REQUEST,
                        normalized.operation
                    );
                }
                return queueRequest(() => (
                    readSource(storeName, null).add(value)
                ));
            },
            put(storeName, value) {
                if (normalized.mode !== 'readwrite') {
                    throw storageError(
                        STORAGE_ERROR_CODE.INVALID_REQUEST,
                        normalized.operation
                    );
                }
                return queueRequest(() => (
                    readSource(storeName, null).put(value)
                ));
            },
            afterReads(callback) {
                if (typeof callback !== 'function') {
                    throw storageError(
                        STORAGE_ERROR_CODE.INVALID_REQUEST,
                        normalized.operation
                    );
                }
                afterReads.push(callback);
            }
        });

        try {
            transaction = database.transaction(
                normalized.storeNames,
                normalized.mode
            );
        } catch (error) {
            reject(mapFailure(error, normalized.operation));
            return;
        }

        transaction.onerror = () => {
            if (failure === null) {
                let error;
                try {
                    error = transaction.error;
                } catch {
                    error = null;
                }
                failure = mapFailure(error, normalized.operation);
            }
        };
        transaction.onabort = () => {
            let error = failure;
            if (error === null) {
                try {
                    error = mapFailure(
                        transaction.error,
                        normalized.operation
                    );
                } catch {
                    error = mapFailure(null, normalized.operation);
                }
            }
            reject(error);
        };
        transaction.oncomplete = () => {
            if (
                failure !== null
                || pendingRequests !== 0
                || afterReads.length !== 0
            ) {
                reject(failure || mapFailure(null, normalized.operation));
                return;
            }
            try {
                resolve(resultBuilder());
            } catch (error) {
                reject(mapFailure(error, normalized.operation));
            }
        };

        try {
            resultBuilder = enqueue(context);
            if (typeof resultBuilder !== 'function') {
                throw storageError(
                    STORAGE_ERROR_CODE.INVALID_REQUEST,
                    normalized.operation
                );
            }
            enqueueFinished = true;
            drainAfterReads();
        } catch (error) {
            enqueueFinished = true;
            fail(error);
        }
    });
}
