import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_BOOTSTRAP_MIGRATION_ID,
    V2_CANONICAL_SCHEMA_VERSION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_IMPORT_MIGRATION_ID,
    V2_METADATA_KEY,
    V2_SCHEMA_ID,
    V2_STORE_NAME
} from './constants.js';
import { storageError } from './errors.js';
import { V2_SCHEMA } from './schema.js';

export const V2_MIGRATION_REGISTRY = Object.freeze([
    Object.freeze({
        id: V2_BOOTSTRAP_MIGRATION_ID,
        fromVersion: 0,
        toVersion: 1
    }),
    Object.freeze({
        id: V2_IMPORT_MIGRATION_ID,
        fromVersion: 1,
        toVersion: 2
    })
]);

const V1_SCHEMA_ID = 'strava-stats-v2@1';
const V1_STORE_NAMES = Object.freeze([
    V2_STORE_NAME.METADATA,
    V2_STORE_NAME.MIGRATIONS,
    V2_STORE_NAME.ACTIVITIES,
    V2_STORE_NAME.ACTIVITY_SOURCES,
    V2_STORE_NAME.STREAM_SERIES,
    V2_STORE_NAME.LAPS,
    V2_STORE_NAME.EVENTS,
    V2_STORE_NAME.DEVICES
]);
const IMPORT_STORE_NAMES = Object.freeze([
    V2_STORE_NAME.RAW_ARTIFACTS,
    V2_STORE_NAME.IMPORT_JOBS,
    V2_STORE_NAME.IMPORT_ITEMS
]);

const DATA_MIGRATION_DEFINITION_FIELDS = Object.freeze([
    'id',
    'storeNames',
    'inputSummary',
    'execute'
]);

const DATA_MIGRATION_CONTEXT_FIELDS = Object.freeze([
    'applicationVersion',
    'now',
    'faultInjector'
]);

const DATA_MIGRATION_RECORD_FIELDS = Object.freeze([
    'id',
    'fromVersion',
    'toVersion',
    'status',
    'startedAt',
    'completedAt',
    'applicationVersion',
    'inputSummary',
    'outputSummary',
    'errorCode',
    'retryCount'
]);

const DATA_MIGRATION_STATUSES = Object.freeze([
    'pending',
    'running',
    'completed',
    'failed',
    'rolled_back'
]);

const DATA_MIGRATION_STORE_NAMES = Object.freeze(
    V2_SCHEMA.stores
        .map(store => store.name)
        .filter(name => (
            name !== V2_STORE_NAME.METADATA
            && name !== V2_STORE_NAME.MIGRATIONS
        ))
);

function isStrictUtcInstant(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) {
        return false;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function sameArray(left, right) {
    return (
        left.length === right.length
        && left.every((value, index) => value === right[index])
    );
}

function sameKeyPath(actual, expected) {
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && sameArray(actual, expected);
    }
    return actual === expected;
}

function listNames(value) {
    return Array.from(value).sort();
}

function createStore(database, descriptor) {
    const store = database.createObjectStore(descriptor.name, {
        keyPath: descriptor.keyPath,
        autoIncrement: descriptor.autoIncrement
    });
    for (const index of descriptor.indexes) {
        store.createIndex(index.name, index.keyPath, {
            unique: index.unique,
            multiEntry: index.multiEntry
        });
    }
    return store;
}

function ensurePhysicalSchema(database, transaction, storeNames) {
    for (const descriptor of V2_SCHEMA.stores.filter(candidate => (
        storeNames.includes(candidate.name)
    ))) {
        let store;
        if (database.objectStoreNames.contains(descriptor.name)) {
            store = transaction.objectStore(descriptor.name);
            if (
                !sameKeyPath(store.keyPath, descriptor.keyPath)
                || store.autoIncrement !== descriptor.autoIncrement
            ) {
                throw storageError(
                    STORAGE_ERROR_CODE.MIGRATION_FAILED,
                    STORAGE_OPERATION.INITIALIZE
                );
            }
        } else {
            store = createStore(database, descriptor);
        }

        const expectedIndexNames = descriptor.indexes
            .map(index => index.name)
            .sort();
        for (const index of descriptor.indexes) {
            if (!store.indexNames.contains(index.name)) {
                store.createIndex(index.name, index.keyPath, {
                    unique: index.unique,
                    multiEntry: index.multiEntry
                });
                continue;
            }
            const existing = store.index(index.name);
            if (
                !sameKeyPath(existing.keyPath, index.keyPath)
                || existing.unique !== index.unique
                || existing.multiEntry !== index.multiEntry
            ) {
                throw storageError(
                    STORAGE_ERROR_CODE.MIGRATION_FAILED,
                    STORAGE_OPERATION.INITIALIZE
                );
            }
        }
        if (!sameArray(listNames(store.indexNames), expectedIndexNames)) {
            throw storageError(
                STORAGE_ERROR_CODE.MIGRATION_FAILED,
                STORAGE_OPERATION.INITIALIZE
            );
        }
    }
    if (!sameArray(listNames(database.objectStoreNames), storeNames.slice().sort())) {
        throw storageError(
            STORAGE_ERROR_CODE.MIGRATION_FAILED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
}

export function resolveMigrationTimestamp(now) {
    let value;
    try {
        value = now();
    } catch {
        throw storageError(
            STORAGE_ERROR_CODE.MIGRATION_FAILED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    if (!Number.isFinite(value)) {
        throw storageError(
            STORAGE_ERROR_CODE.MIGRATION_FAILED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    const timestamp = new Date(value).toISOString();
    if (!isStrictUtcInstant(timestamp)) {
        throw storageError(
            STORAGE_ERROR_CODE.MIGRATION_FAILED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    return timestamp;
}

function applyBootstrapMigration(database, transaction, {
    applicationVersion,
    timestamp
}) {
    ensurePhysicalSchema(database, transaction, V1_STORE_NAMES);

    const metadata = {
        key: V2_METADATA_KEY,
        databaseName: V2_DATABASE_NAME,
        schemaId: V1_SCHEMA_ID,
        indexedDbVersion: 1,
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        createdAt: timestamp,
        createdByApplicationVersion: applicationVersion
    };
    const migration = {
        id: V2_BOOTSTRAP_MIGRATION_ID,
        fromVersion: 0,
        toVersion: 1,
        status: 'completed',
        startedAt: timestamp,
        completedAt: timestamp,
        applicationVersion,
        inputSummary: { storeCount: 0 },
        outputSummary: { storeCount: V1_STORE_NAMES.length },
        errorCode: null,
        retryCount: 0
    };

    transaction.objectStore(V2_STORE_NAME.METADATA).put(metadata);
    transaction.objectStore(V2_STORE_NAME.MIGRATIONS).put(migration);
}

function applyImportCoreMigration(database, transaction, {
    applicationVersion,
    timestamp
}) {
    ensurePhysicalSchema(database, transaction, [
        ...V1_STORE_NAMES,
        ...IMPORT_STORE_NAMES
    ]);

    const metadataStore = transaction.objectStore(V2_STORE_NAME.METADATA);
    const metadataRequest = metadataStore.get(V2_METADATA_KEY);
    metadataRequest.onsuccess = () => {
        try {
            const metadata = ownDataValues(metadataRequest.result, [
                'key',
                'databaseName',
                'schemaId',
                'indexedDbVersion',
                'canonicalSchemaVersion',
                'createdAt',
                'createdByApplicationVersion'
            ]);
            if (
                !metadata
                || metadata.key !== V2_METADATA_KEY
                || metadata.databaseName !== V2_DATABASE_NAME
                || metadata.schemaId !== V1_SCHEMA_ID
                || metadata.indexedDbVersion !== 1
                || metadata.canonicalSchemaVersion !== V2_CANONICAL_SCHEMA_VERSION
                || !isStrictUtcInstant(metadata.createdAt)
                || typeof metadata.createdByApplicationVersion !== 'string'
                || metadata.createdByApplicationVersion.length === 0
            ) {
                throw new TypeError('invalid prior metadata');
            }
            metadataStore.put({
                ...metadata,
                schemaId: V2_SCHEMA_ID,
                indexedDbVersion: V2_DATABASE_VERSION
            });
        } catch {
            try {
                transaction.abort();
            } catch {
                // The versionchange terminal event remains authoritative.
            }
        }
    };

    transaction.objectStore(V2_STORE_NAME.MIGRATIONS).put({
        id: V2_IMPORT_MIGRATION_ID,
        fromVersion: 1,
        toVersion: 2,
        status: 'completed',
        startedAt: timestamp,
        completedAt: timestamp,
        applicationVersion,
        inputSummary: { storeCount: V1_STORE_NAMES.length },
        outputSummary: { storeCount: V2_SCHEMA.stores.length },
        errorCode: null,
        retryCount: 0
    });
}

export function applyStructuralMigrations(database, transaction, {
    applicationVersion,
    timestamp,
    oldVersion,
    newVersion
}) {
    if (
        !Number.isInteger(oldVersion)
        || !Number.isInteger(newVersion)
        || oldVersion < 0
        || newVersion !== V2_DATABASE_VERSION
    ) {
        throw storageError(
            STORAGE_ERROR_CODE.VERSION_UNSUPPORTED,
            STORAGE_OPERATION.INITIALIZE
        );
    }

    let currentVersion = oldVersion;
    while (currentVersion < newVersion) {
        const migration = V2_MIGRATION_REGISTRY.find(candidate => (
            candidate.fromVersion === currentVersion
            && candidate.toVersion <= newVersion
        ));
        if (!migration) {
            throw storageError(
                STORAGE_ERROR_CODE.VERSION_UNSUPPORTED,
                STORAGE_OPERATION.INITIALIZE
            );
        }

        if (migration.id === V2_BOOTSTRAP_MIGRATION_ID) {
            applyBootstrapMigration(database, transaction, {
                applicationVersion,
                timestamp
            });
        } else if (migration.id === V2_IMPORT_MIGRATION_ID) {
            applyImportCoreMigration(database, transaction, {
                applicationVersion,
                timestamp
            });
        } else {
            throw storageError(
                STORAGE_ERROR_CODE.MIGRATION_FAILED,
                STORAGE_OPERATION.INITIALIZE
            );
        }
        currentVersion = migration.toVersion;
    }
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

function cloneJsonSafe(value, ancestors = new Set()) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('not JSON-safe');
        return value;
    }
    if (typeof value !== 'object' || ancestors.has(value)) {
        throw new TypeError('not JSON-safe');
    }

    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw new TypeError('not JSON-safe');
            }
            const keys = Reflect.ownKeys(value);
            if (
                keys.some(key => typeof key !== 'string')
                || keys.some(key => key !== 'length' && !/^\d+$/.test(key))
                || keys.length !== value.length + 1
            ) {
                throw new TypeError('not JSON-safe');
            }
            const result = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(
                    value,
                    String(index)
                );
                if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                    throw new TypeError('not JSON-safe');
                }
                result.push(cloneJsonSafe(descriptor.value, ancestors));
            }
            return result;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError('not JSON-safe');
        }
        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') throw new TypeError('not JSON-safe');
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError('not JSON-safe');
            }
            Object.defineProperty(result, key, {
                value: cloneJsonSafe(descriptor.value, ancestors),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
        return result;
    } finally {
        ancestors.delete(value);
    }
}

function sameJsonSafe(left, right) {
    if (Object.is(left, right)) return true;
    if (
        left === null
        || right === null
        || typeof left !== 'object'
        || typeof right !== 'object'
        || Array.isArray(left) !== Array.isArray(right)
    ) {
        return false;
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return sameArray(leftKeys, rightKeys) && leftKeys.every(key => (
        sameJsonSafe(left[key], right[key])
    ));
}

function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
}

function migrationError(code = STORAGE_ERROR_CODE.MIGRATION_FAILED) {
    return storageError(code, STORAGE_OPERATION.INITIALIZE);
}

function normalizeDataMigrationUnsafe(definition, context) {
    const values = ownDataValues(definition, DATA_MIGRATION_DEFINITION_FIELDS);
    const dependencies = ownDataValues(context, DATA_MIGRATION_CONTEXT_FIELDS);
    if (!values || !dependencies) throw migrationError();

    let inputSummary;
    try {
        inputSummary = cloneJsonSafe(values.inputSummary);
    } catch {
        throw migrationError();
    }
    if (
        typeof values.id !== 'string'
        || values.id.length === 0
        || !Array.isArray(values.storeNames)
        || Object.getPrototypeOf(values.storeNames) !== Array.prototype
        || values.storeNames.length === 0
        || typeof values.execute !== 'function'
        || typeof dependencies.applicationVersion !== 'string'
        || dependencies.applicationVersion.length === 0
        || typeof dependencies.now !== 'function'
        || (
            dependencies.faultInjector !== null
            && typeof dependencies.faultInjector !== 'function'
        )
    ) {
        throw migrationError();
    }

    let storeNames;
    try {
        storeNames = cloneJsonSafe(values.storeNames);
    } catch {
        throw migrationError();
    }
    if (
        storeNames.some(name => (
            typeof name !== 'string'
            || name.length === 0
            || !DATA_MIGRATION_STORE_NAMES.includes(name)
        ))
        || new Set(storeNames).size !== storeNames.length
    ) {
        throw migrationError();
    }

    return Object.freeze({
        id: values.id,
        storeNames: Object.freeze(storeNames),
        inputSummary: deepFreeze(inputSummary),
        execute: values.execute,
        applicationVersion: dependencies.applicationVersion,
        now: dependencies.now,
        faultInjector: dependencies.faultInjector
    });
}

function normalizeDataMigration(definition, context) {
    try {
        return normalizeDataMigrationUnsafe(definition, context);
    } catch {
        throw migrationError();
    }
}

function validDataMigrationRecord(value, id) {
    const record = ownDataValues(value, DATA_MIGRATION_RECORD_FIELDS);
    if (!record) return null;
    let inputSummary;
    let outputSummary;
    try {
        inputSummary = cloneJsonSafe(record.inputSummary);
        outputSummary = record.outputSummary === null
            ? null
            : cloneJsonSafe(record.outputSummary);
    } catch {
        return null;
    }
    if (
        record.id !== id
        || record.fromVersion !== record.toVersion
        || !Number.isInteger(record.fromVersion)
        || record.fromVersion < 1
        || record.fromVersion > V2_DATABASE_VERSION
        || !DATA_MIGRATION_STATUSES.includes(record.status)
        || !isStrictUtcInstant(record.startedAt)
        || (
            record.completedAt !== null
            && !isStrictUtcInstant(record.completedAt)
        )
        || typeof record.applicationVersion !== 'string'
        || record.applicationVersion.length === 0
        || !Number.isSafeInteger(record.retryCount)
        || record.retryCount < 0
        || (
            record.errorCode !== null
            && record.errorCode !== STORAGE_ERROR_CODE.MIGRATION_FAILED
            && record.errorCode !== STORAGE_ERROR_CODE.MIGRATION_INTERRUPTED
        )
    ) {
        return null;
    }
    if (
        (
            (record.status === 'pending' || record.status === 'running')
            && (
                record.completedAt !== null
                || record.outputSummary !== null
                || record.errorCode !== null
            )
        )
        || (
            record.status === 'completed'
            && (
                record.completedAt === null
                || record.outputSummary === null
                || record.errorCode !== null
            )
        )
        || (
            record.status === 'failed'
            && (record.completedAt === null || record.errorCode === null)
        )
        || (record.status === 'rolled_back' && record.completedAt === null)
    ) {
        return null;
    }
    return {
        ...record,
        inputSummary,
        outputSummary
    };
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(migrationError());
        transaction.onerror = () => {};
    });
}

function readMigrationRecord(database, id) {
    return new Promise((resolve, reject) => {
        let transaction;
        let request;
        let failed = false;
        try {
            transaction = database.transaction(
                V2_STORE_NAME.MIGRATIONS,
                'readonly'
            );
            request = transaction.objectStore(V2_STORE_NAME.MIGRATIONS).get(id);
        } catch {
            reject(migrationError());
            return;
        }
        request.onerror = () => {
            failed = true;
        };
        transaction.onerror = () => {
            failed = true;
        };
        transaction.onabort = () => reject(migrationError());
        transaction.oncomplete = () => {
            if (failed) {
                reject(migrationError());
                return;
            }
            try {
                resolve(request.result);
            } catch {
                reject(migrationError());
            }
        };
    });
}

function writeMigrationRecord(database, record) {
    let transaction;
    try {
        transaction = database.transaction(
            V2_STORE_NAME.MIGRATIONS,
            'readwrite'
        );
        transaction.objectStore(V2_STORE_NAME.MIGRATIONS).put(record);
    } catch {
        return Promise.reject(migrationError());
    }
    return transactionDone(transaction);
}

function invokeFault(faultInjector, stage) {
    if (faultInjector === null) return;
    try {
        faultInjector(stage);
    } catch {
        throw migrationError();
    }
}

async function executeDataStep(database, migration) {
    let transaction;
    let output;
    try {
        transaction = database.transaction(migration.storeNames, 'readwrite');
        const allowed = new Set(migration.storeNames);
        const step = Object.freeze({
            store(name) {
                if (!allowed.has(name)) throw migrationError();
                return transaction.objectStore(name);
            }
        });
        output = migration.execute(step);
    } catch {
        try {
            transaction?.abort();
        } catch {
            // A terminal event still controls settlement.
        }
        if (transaction) {
            try {
                await transactionDone(transaction);
            } catch {
                // The caller receives only the stable migration error below.
            }
        }
        throw migrationError();
    }

    await transactionDone(transaction);
    try {
        const summary = typeof output === 'function' ? output() : output;
        return deepFreeze(cloneJsonSafe(summary));
    } catch {
        throw migrationError();
    }
}

function nextRecord(current, changes) {
    return {
        ...current,
        ...changes
    };
}

function snapshotRecord(record) {
    return deepFreeze(cloneJsonSafe(record));
}

async function runDataMigrationUnsafe(database, definition, context) {
    const migration = normalizeDataMigration(definition, context);
    let rawRecord;
    try {
        rawRecord = await readMigrationRecord(database, migration.id);
    } catch {
        throw migrationError();
    }

    let record = rawRecord === undefined
        ? null
        : validDataMigrationRecord(rawRecord, migration.id);
    if (rawRecord !== undefined && record === null) throw migrationError();
    if (record !== null && !sameJsonSafe(
        record.inputSummary,
        migration.inputSummary
    )) {
        throw migrationError();
    }
    if (record?.status === 'completed' || record?.status === 'rolled_back') {
        return snapshotRecord(record);
    }

    if (record === null) {
        const timestamp = resolveMigrationTimestamp(migration.now);
        record = {
            id: migration.id,
            fromVersion: V2_DATABASE_VERSION,
            toVersion: V2_DATABASE_VERSION,
            status: 'pending',
            startedAt: timestamp,
            completedAt: null,
            applicationVersion: migration.applicationVersion,
            inputSummary: migration.inputSummary,
            outputSummary: null,
            errorCode: null,
            retryCount: 0
        };
        await writeMigrationRecord(database, record);
        invokeFault(migration.faultInjector, 'after-pending-status');
    } else if (record.status === 'running') {
        record = nextRecord(record, {
            status: 'failed',
            completedAt: resolveMigrationTimestamp(migration.now),
            errorCode: STORAGE_ERROR_CODE.MIGRATION_INTERRUPTED
        });
        await writeMigrationRecord(database, record);
        invokeFault(migration.faultInjector, 'after-interrupted-status');
    }

    const retryCount = record.status === 'failed'
        ? record.retryCount + 1
        : record.retryCount;
    record = nextRecord(record, {
        status: 'running',
        completedAt: null,
        applicationVersion: migration.applicationVersion,
        errorCode: null,
        retryCount
    });
    await writeMigrationRecord(database, record);
    invokeFault(migration.faultInjector, 'after-running-status');

    let outputSummary;
    try {
        outputSummary = await executeDataStep(database, migration);
    } catch {
        record = nextRecord(record, {
            status: 'failed',
            completedAt: resolveMigrationTimestamp(migration.now),
            errorCode: STORAGE_ERROR_CODE.MIGRATION_FAILED
        });
        await writeMigrationRecord(database, record);
        throw migrationError();
    }

    invokeFault(migration.faultInjector, 'before-completed-status');
    record = nextRecord(record, {
        status: 'completed',
        completedAt: resolveMigrationTimestamp(migration.now),
        outputSummary,
        errorCode: null
    });
    await writeMigrationRecord(database, record);
    return snapshotRecord(record);
}

export async function runDataMigration(database, definition, context) {
    try {
        return await runDataMigrationUnsafe(database, definition, context);
    } catch {
        throw migrationError();
    }
}
