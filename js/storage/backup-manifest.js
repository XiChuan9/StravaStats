import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_CANONICAL_SCHEMA_VERSION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_METADATA_KEY,
    V2_SCHEMA_ID,
    V2_STORE_NAME
} from './constants.js';
import { storageError } from './errors.js';
import { V2_SCHEMA } from './schema.js';
import { runTransaction } from './transaction.js';

const METADATA_FIELDS = Object.freeze([
    'key',
    'databaseName',
    'schemaId',
    'indexedDbVersion',
    'canonicalSchemaVersion',
    'createdAt',
    'createdByApplicationVersion'
]);

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

function validMetadata(value) {
    const metadata = ownDataValues(value, METADATA_FIELDS);
    return metadata !== null
        && metadata.key === V2_METADATA_KEY
        && metadata.databaseName === V2_DATABASE_NAME
        && metadata.schemaId === V2_SCHEMA_ID
        && metadata.indexedDbVersion === V2_DATABASE_VERSION
        && metadata.canonicalSchemaVersion === V2_CANONICAL_SCHEMA_VERSION
        && isStrictUtcInstant(metadata.createdAt)
        && typeof metadata.createdByApplicationVersion === 'string'
        && metadata.createdByApplicationVersion.length > 0;
}

function manifestTimestamp(now) {
    let value;
    try {
        value = now();
    } catch {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
        );
    }
    if (!Number.isFinite(value)) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
        );
    }
    const result = new Date(value).toISOString();
    if (!isStrictUtcInstant(result)) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
        );
    }
    return result;
}

function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && Object.hasOwn(descriptor, 'value')) {
            deepFreeze(descriptor.value);
        }
    }
    return Object.freeze(value);
}

export function buildBackupManifest(database, dependencies) {
    let createdAt;
    try {
        createdAt = manifestTimestamp(dependencies.now);
    } catch (error) {
        return Promise.reject(error);
    }
    return runTransaction(database, {
        storeNames: STORE_NAMES,
        mode: 'readonly',
        operation: STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
    }, context => {
        const metadata = context.get(
            V2_STORE_NAME.METADATA,
            V2_METADATA_KEY
        );
        const counts = STORE_NAMES.map(name => context.count(name));
        return () => {
            if (!validMetadata(metadata.read())) {
                throw storageError(
                    STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                    STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
                );
            }
            const stores = STORE_NAMES.map((name, index) => {
                const recordCount = counts[index].read();
                if (!Number.isSafeInteger(recordCount) || recordCount < 0) {
                    throw storageError(
                        STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
                        STORAGE_OPERATION.CREATE_BACKUP_MANIFEST
                    );
                }
                return { name, recordCount };
            });
            return deepFreeze({
                backupFormatVersion: 2,
                databaseName: V2_DATABASE_NAME,
                indexedDbVersion: V2_DATABASE_VERSION,
                canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
                createdAt,
                applicationVersion: dependencies.applicationVersion,
                stores,
                files: [],
                hashes: []
            });
        };
    });
}
