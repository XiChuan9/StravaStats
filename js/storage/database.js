import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_BOOTSTRAP_MIGRATION_ID,
    V2_CANONICAL_SCHEMA_VERSION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_EXACT_IDENTITY_MIGRATION_ID,
    V2_IMPORT_MIGRATION_ID,
    V2_METADATA_KEY,
    V2_SCHEMA_ID,
    V2_STORE_NAME
} from './constants.js';
import {
    StorageError,
    storageError
} from './errors.js';
import {
    applyStructuralMigrations,
    resolveMigrationTimestamp
} from './migrations.js';
import { verifyPhysicalSchema } from './schema.js';
import {
    getCanonicalBundle,
    listCanonicalActivities,
    putCanonicalBundle
} from './canonical-store.js';
import { buildBackupManifest } from './backup-manifest.js';

const FACTORY_OPTION_KEYS = Object.freeze([
    'indexedDB',
    'IDBKeyRange',
    'now',
    'applicationVersion'
]);

const DATABASE_METADATA_FIELDS = Object.freeze([
    'key',
    'databaseName',
    'schemaId',
    'indexedDbVersion',
    'canonicalSchemaVersion',
    'createdAt',
    'createdByApplicationVersion'
]);

const MIGRATION_FIELDS = Object.freeze([
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

const READY_RESULT = Object.freeze({
    status: 'ready',
    databaseName: V2_DATABASE_NAME,
    indexedDbVersion: V2_DATABASE_VERSION,
    schemaId: V2_SCHEMA_ID,
    canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION
});

const CLOSED_RESULT = Object.freeze({ status: 'closed' });

function sameStrings(left, right) {
    return (
        left.length === right.length
        && left.every((value, index) => value === right[index])
    );
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
        if (prototype !== Object.prototype && prototype !== null) {
            return null;
        }

        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || !sameStrings(
                keys.slice().sort(),
                fields.slice().sort()
            )
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

function findDataMethod(value, name) {
    try {
        if (
            value === null
            || (typeof value !== 'object' && typeof value !== 'function')
        ) {
            return null;
        }

        let current = value;
        for (let depth = 0; current !== null && depth < 32; depth += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return (
                    Object.hasOwn(descriptor, 'value')
                    && typeof descriptor.value === 'function'
                )
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

function normalizeFactoryOptions(options) {
    const values = ownDataValues(options, FACTORY_OPTION_KEYS);
    if (!values) return null;

    const open = findDataMethod(values.indexedDB, 'open');
    const bound = findDataMethod(values.IDBKeyRange, 'bound');
    if (!open || !bound) return null;
    if (
        values.IDBKeyRange === null
        || (
            typeof values.IDBKeyRange !== 'object'
            && typeof values.IDBKeyRange !== 'function'
        )
        || typeof values.now !== 'function'
        || typeof values.applicationVersion !== 'string'
        || values.applicationVersion.length === 0
    ) {
        return null;
    }

    return Object.freeze({
        indexedDB: values.indexedDB,
        open,
        keyRange: Object.freeze({
            bound(lower, upper) {
                return bound.call(values.IDBKeyRange, lower, upper);
            }
        }),
        now: values.now,
        applicationVersion: values.applicationVersion
    });
}

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

function isOpaqueString(value) {
    return typeof value === 'string' && value.length > 0;
}

function validSummary(value, expectedStoreCount) {
    const summary = ownDataValues(value, ['storeCount']);
    return summary !== null && summary.storeCount === expectedStoreCount;
}

function validMetadata(value) {
    const metadata = ownDataValues(value, DATABASE_METADATA_FIELDS);
    return metadata !== null
        && metadata.key === V2_METADATA_KEY
        && metadata.databaseName === V2_DATABASE_NAME
        && metadata.schemaId === V2_SCHEMA_ID
        && metadata.indexedDbVersion === V2_DATABASE_VERSION
        && metadata.canonicalSchemaVersion === V2_CANONICAL_SCHEMA_VERSION
        && isStrictUtcInstant(metadata.createdAt)
        && isOpaqueString(metadata.createdByApplicationVersion);
}

function validBootstrapMigration(value) {
    const migration = ownDataValues(value, MIGRATION_FIELDS);
    return migration !== null
        && migration.id === V2_BOOTSTRAP_MIGRATION_ID
        && migration.fromVersion === 0
        && migration.toVersion === 1
        && migration.status === 'completed'
        && isStrictUtcInstant(migration.startedAt)
        && migration.completedAt === migration.startedAt
        && isOpaqueString(migration.applicationVersion)
        && validSummary(migration.inputSummary, 0)
        && validSummary(migration.outputSummary, 8)
        && migration.errorCode === null
        && migration.retryCount === 0;
}

function validImportMigration(value) {
    const migration = ownDataValues(value, MIGRATION_FIELDS);
    return migration !== null
        && migration.id === V2_IMPORT_MIGRATION_ID
        && migration.fromVersion === 1
        && migration.toVersion === 2
        && migration.status === 'completed'
        && isStrictUtcInstant(migration.startedAt)
        && migration.completedAt === migration.startedAt
        && isOpaqueString(migration.applicationVersion)
        && validSummary(migration.inputSummary, 8)
        && validSummary(migration.outputSummary, 11)
        && migration.errorCode === null
        && migration.retryCount === 0;
}

function validExactIdentityMigration(value) {
    const migration = ownDataValues(value, MIGRATION_FIELDS);
    return migration !== null
        && migration.id === V2_EXACT_IDENTITY_MIGRATION_ID
        && migration.fromVersion === 2
        && migration.toVersion === 3
        && migration.status === 'completed'
        && isStrictUtcInstant(migration.startedAt)
        && migration.completedAt === migration.startedAt
        && isOpaqueString(migration.applicationVersion)
        && validSummary(migration.inputSummary, 11)
        && validSummary(migration.outputSummary, 11)
        && migration.errorCode === null
        && migration.retryCount === 0;
}

function closeDatabase(database) {
    try {
        database.onversionchange = null;
        database.close();
    } catch {
        // The handle may already be closed or supplied by a failing platform.
    }
}

function abortUpgrade(transaction) {
    try {
        transaction?.abort();
        return true;
    } catch {
        return false;
    }
}

function requestErrorName(request) {
    try {
        return typeof request.error?.name === 'string'
            ? request.error.name
            : null;
    } catch {
        return null;
    }
}

function mapOpenError(request, blocked) {
    const name = requestErrorName(request);
    if (name === 'VersionError') {
        return storageError(
            STORAGE_ERROR_CODE.VERSION_UNSUPPORTED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    if (name === 'QuotaExceededError') {
        return storageError(
            STORAGE_ERROR_CODE.QUOTA_EXCEEDED,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    if (name === 'ConstraintError') {
        return storageError(
            STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION,
            STORAGE_OPERATION.INITIALIZE
        );
    }
    if (blocked) {
        return storageError(
            STORAGE_ERROR_CODE.OPEN_BLOCKED,
            STORAGE_OPERATION.INITIALIZE,
            true
        );
    }
    return storageError(
        STORAGE_ERROR_CODE.OPEN_FAILED,
        STORAGE_OPERATION.INITIALIZE,
        true
    );
}

function verifyDatabaseState(database) {
    if (!verifyPhysicalSchema(database)) {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
            STORAGE_OPERATION.INITIALIZE
        ));
    }

    return new Promise((resolve, reject) => {
        let transaction;
        let metadataRequest;
        let migrationRequest;
        let importMigrationRequest;
        let exactIdentityMigrationRequest;
        let requestFailed = false;

        try {
            transaction = database.transaction([
                V2_STORE_NAME.METADATA,
                V2_STORE_NAME.MIGRATIONS
            ], 'readonly');
            metadataRequest = transaction
                .objectStore(V2_STORE_NAME.METADATA)
                .get(V2_METADATA_KEY);
            migrationRequest = transaction
                .objectStore(V2_STORE_NAME.MIGRATIONS)
                .get(V2_BOOTSTRAP_MIGRATION_ID);
            importMigrationRequest = transaction
                .objectStore(V2_STORE_NAME.MIGRATIONS)
                .get(V2_IMPORT_MIGRATION_ID);
            exactIdentityMigrationRequest = transaction
                .objectStore(V2_STORE_NAME.MIGRATIONS)
                .get(V2_EXACT_IDENTITY_MIGRATION_ID);
        } catch {
            reject(storageError(
                STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                STORAGE_OPERATION.INITIALIZE
            ));
            return;
        }

        metadataRequest.onerror = () => {
            requestFailed = true;
        };
        migrationRequest.onerror = () => {
            requestFailed = true;
        };
        importMigrationRequest.onerror = () => {
            requestFailed = true;
        };
        exactIdentityMigrationRequest.onerror = () => {
            requestFailed = true;
        };
        transaction.onerror = () => {
            requestFailed = true;
        };
        transaction.onabort = () => {
            reject(storageError(
                STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                STORAGE_OPERATION.INITIALIZE
            ));
        };
        transaction.oncomplete = () => {
            let metadata;
            let migration;
            let importMigration;
            let exactIdentityMigration;
            try {
                metadata = metadataRequest.result;
                migration = migrationRequest.result;
                importMigration = importMigrationRequest.result;
                exactIdentityMigration = exactIdentityMigrationRequest.result;
            } catch {
                requestFailed = true;
            }

            if (
                requestFailed
                || !validMetadata(metadata)
                || !validBootstrapMigration(migration)
                || !validImportMigration(importMigration)
                || !validExactIdentityMigration(exactIdentityMigration)
            ) {
                reject(storageError(
                    STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                    STORAGE_OPERATION.INITIALIZE
                ));
                return;
            }
            resolve();
        };
    });
}

function openAndVerify(dependencies, state, generation, expectExisting) {
    return new Promise((resolve, reject) => {
        let request;
        let settled = false;
        let blocked = false;
        let created = false;
        let upgradeFailure = null;

        const finishResolve = result => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        const finishReject = error => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const cancelled = () => generation !== state.generation;

        try {
            request = dependencies.open.call(
                dependencies.indexedDB,
                V2_DATABASE_NAME,
                V2_DATABASE_VERSION
            );
        } catch {
            finishReject(storageError(
                STORAGE_ERROR_CODE.OPEN_FAILED,
                STORAGE_OPERATION.INITIALIZE,
                true
            ));
            return;
        }

        request.onblocked = () => {
            if (!settled) blocked = true;
        };

        request.onupgradeneeded = event => {
            const transaction = request.transaction;
            const migrationOptions = {
                applicationVersion: dependencies.applicationVersion,
                timestamp: null,
                oldVersion: event.oldVersion,
                newVersion: event.newVersion
            };
            try {
                migrationOptions.timestamp = resolveMigrationTimestamp(
                    dependencies.now
                );
                applyStructuralMigrations(
                    request.result,
                    transaction,
                    migrationOptions
                );
                created = true;
            } catch (error) {
                upgradeFailure = error instanceof StorageError
                    ? error
                    : storageError(
                        STORAGE_ERROR_CODE.MIGRATION_FAILED,
                        STORAGE_OPERATION.INITIALIZE
                    );
                try {
                    if (migrationOptions.timestamp === null) {
                        migrationOptions.timestamp = resolveMigrationTimestamp(
                            dependencies.now
                        );
                    }
                    applyStructuralMigrations(
                        request.result,
                        transaction,
                        migrationOptions
                    );
                    created = true;
                    upgradeFailure = null;
                } catch {
                    abortUpgrade(transaction);
                }
            }
        };

        request.onerror = () => {
            if (cancelled()) {
                finishReject(storageError(
                    STORAGE_ERROR_CODE.CONNECTION_STALE,
                    STORAGE_OPERATION.INITIALIZE
                ));
                return;
            }
            finishReject(upgradeFailure || mapOpenError(request, blocked));
        };

        request.onsuccess = () => {
            let database;
            try {
                database = request.result;
            } catch {
                finishReject(storageError(
                    STORAGE_ERROR_CODE.OPEN_FAILED,
                    STORAGE_OPERATION.INITIALIZE,
                    true
                ));
                return;
            }

            if (settled) {
                closeDatabase(database);
                return;
            }
            if (upgradeFailure) {
                closeDatabase(database);
                finishReject(upgradeFailure);
                return;
            }
            if (created && !expectExisting && !cancelled()) {
                closeDatabase(database);
                openAndVerify(dependencies, state, generation, true)
                    .then(finishResolve, finishReject);
                return;
            }

            if (cancelled()) {
                const finishCancelled = () => {
                    closeDatabase(database);
                    finishReject(storageError(
                        STORAGE_ERROR_CODE.CONNECTION_STALE,
                        STORAGE_OPERATION.INITIALIZE
                    ));
                };
                if (created) {
                    verifyDatabaseState(database).then(
                        finishCancelled,
                        finishCancelled
                    );
                } else {
                    finishCancelled();
                }
                return;
            }

            let connectionStale = false;
            database.onversionchange = () => {
                connectionStale = true;
                closeDatabase(database);
                if (state.database === database) {
                    state.database = null;
                }
                state.stale = true;
            };

            verifyDatabaseState(database).then(() => {
                if (cancelled() || connectionStale) {
                    closeDatabase(database);
                    finishReject(storageError(
                        STORAGE_ERROR_CODE.CONNECTION_STALE,
                        STORAGE_OPERATION.INITIALIZE
                    ));
                    return;
                }
                state.database = database;
                state.stale = false;
                finishResolve(READY_RESULT);
            }, error => {
                closeDatabase(database);
                finishReject(error instanceof StorageError
                    ? error
                    : storageError(
                        STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                        STORAGE_OPERATION.INITIALIZE
                    ));
            });
        };
    });
}

export function createCanonicalStore(options) {
    const dependencies = normalizeFactoryOptions(options);
    if (!dependencies) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_CANONICAL_STORE
        );
    }

    const state = {
        database: null,
        opening: null,
        closing: null,
        operations: new Set(),
        generation: 0,
        stale: false
    };

    function initialize() {
        if (state.closing) {
            const closing = state.closing;
            return closing.then(() => initialize());
        }
        if (state.database && !state.stale) {
            return Promise.resolve(READY_RESULT);
        }
        if (state.opening) return state.opening;

        const generation = state.generation + 1;
        state.generation = generation;
        state.stale = false;
        const opening = openAndVerify(
            dependencies,
            state,
            generation,
            false
        );
        state.opening = opening;
        opening.then(() => {
            if (state.opening === opening) state.opening = null;
        }, () => {
            if (state.opening === opening) state.opening = null;
        });
        return opening;
    }

    function close() {
        if (state.closing) return state.closing;

        state.generation += 1;
        state.stale = true;
        if (state.database) {
            closeDatabase(state.database);
            state.database = null;
        }
        const finalize = () => {
            if (state.database) {
                closeDatabase(state.database);
                state.database = null;
            }
            return CLOSED_RESULT;
        };
        const terminals = [...state.operations];
        if (state.opening) terminals.push(state.opening);
        const closing = terminals.length === 0
            ? Promise.resolve(finalize())
            : Promise.allSettled(terminals).then(finalize);
        state.closing = closing;
        closing.then(() => {
            if (state.closing === closing) state.closing = null;
        }, () => {
            if (state.closing === closing) state.closing = null;
        });
        return closing;
    }

    function runReady(operation, callback) {
        if (
            !state.database
            || state.stale
            || state.opening
            || state.closing
        ) {
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
        tracked.then(() => {
            state.operations.delete(tracked);
        }, () => {
            state.operations.delete(tracked);
        });
        return tracked;
    }

    return Object.freeze({
        initialize,
        putBundle(bundle) {
            return runReady(STORAGE_OPERATION.PUT_BUNDLE, database => (
                putCanonicalBundle(database, dependencies.keyRange, bundle)
            ));
        },
        getBundle(activityId, options) {
            return runReady(STORAGE_OPERATION.GET_BUNDLE, database => (
                getCanonicalBundle(
                    database,
                    dependencies.keyRange,
                    activityId,
                    options
                )
            ));
        },
        listActivities(options) {
            return runReady(STORAGE_OPERATION.LIST_ACTIVITIES, database => (
                listCanonicalActivities(
                    database,
                    dependencies.keyRange,
                    options
                )
            ));
        },
        createBackupManifest() {
            return runReady(
                STORAGE_OPERATION.CREATE_BACKUP_MANIFEST,
                database => buildBackupManifest(database, dependencies)
            );
        },
        close
    });
}
