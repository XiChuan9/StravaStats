import { validateImportedActivityBundle } from '../data/contracts/index.js';
import {
    V2_CANONICAL_SCHEMA_VERSION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_METADATA_KEY,
    V2_SCHEMA_ID,
    V2_STORE_NAME
} from '../storage/constants.js';
import {
    createPhysicalSchema,
    verifyPhysicalSchema,
    V2_PHYSICAL_SCHEMA_BY_VERSION,
    V2_SCHEMA
} from '../storage/schema.js';
import { V2_MIGRATION_REGISTRY } from '../storage/migrations.js';
import { normalizeSourceConnectionRecord } from '../storage/source-connection-store.js';
import {
    createIdleSourceOperationRecord,
    normalizeSourceOperationRecord
} from '../storage/source-operation-store.js';
import {
    STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
    stravaProviderArtifactDecoder
} from '../import/strava-provider-artifact.js';
import {
    validDuplicateReviewCandidate,
    validDuplicateReviewDecision
} from '../storage/duplicate-review.js';
import {
    BACKUP_BYTE_LIMIT,
    BACKUP_ENTRY_PATHS_BY_FORMAT,
    BackupCodecError,
    createDeterministicZip,
    decodeCanonicalJson,
    decodeJsonLines,
    encodeCanonicalJson,
    encodeJsonLines,
    encodeTaggedValue,
    parseDeterministicZip,
    sha256
} from './codec.js';

export const BACKUP_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    BACKUP_UNAVAILABLE: 'BACKUP_UNAVAILABLE',
    BACKUP_TOO_LARGE: 'BACKUP_TOO_LARGE',
    BACKUP_CANCELLED: 'BACKUP_CANCELLED',
    BACKUP_CONTAINER_INVALID: 'BACKUP_CONTAINER_INVALID',
    BACKUP_HASH_MISMATCH: 'BACKUP_HASH_MISMATCH',
    BACKUP_SCHEMA_INCOMPATIBLE: 'BACKUP_SCHEMA_INCOMPATIBLE',
    BACKUP_DATA_INVALID: 'BACKUP_DATA_INVALID',
    BACKUP_REFERENCE_INVALID: 'BACKUP_REFERENCE_INVALID',
    TARGET_NOT_EMPTY: 'TARGET_NOT_EMPTY',
    TARGET_SETTINGS_CONFLICT: 'TARGET_SETTINGS_CONFLICT',
    RESTORE_ABORTED: 'RESTORE_ABORTED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    SETTINGS_PENDING: 'SETTINGS_PENDING',
    ACTIVE_SOURCE_OPERATION: 'ACTIVE_SOURCE_OPERATION'
});

export class BackupError extends Error {
    constructor(code, operation, retryable = false) {
        super('Backup operation failed safely.');
        this.name = 'BackupError';
        this.code = code;
        this.operation = operation;
        this.retryable = retryable;
        Object.freeze(this);
    }
}

const OPTION_FIELDS = Object.freeze([
    'indexedDB',
    'IDBKeyRange',
    'crypto',
    'now',
    'applicationVersion',
    'settingsReader',
    'settingsWriter'
]);

const STORE_NAMES = Object.freeze(V2_SCHEMA.stores.map(store => store.name));
const LEGACY_STORE_NAMES = Object.freeze(
    V2_PHYSICAL_SCHEMA_BY_VERSION[4].stores.map(store => store.name)
);
const FORMAT_2_STORE_NAMES = Object.freeze(
    V2_PHYSICAL_SCHEMA_BY_VERSION[5].stores.map(store => store.name)
);
const USER_STORE_NAMES = Object.freeze(STORE_NAMES.filter(name => (
    name !== V2_STORE_NAME.METADATA
    && name !== V2_STORE_NAME.MIGRATIONS
    && name !== V2_STORE_NAME.SOURCE_OPERATIONS
)));

const SETTINGS_KEYS = Object.freeze([
    'dashboard_filters',
    'dashboard_readiness_hrv',
    'dashboard_settings',
    'run_plus_capacity_inputs_v1',
    'run_plus_nsm_activity_tags_v1',
    'run_plus_nsm_interval_analysis_v1',
    'run_plus_nsm_session_inputs_v1',
    'run_plus_nsm_settings_v1',
    'run_plus_nsm_tests_v1',
    'training_goals'
]);
const SETTINGS_GEAR_PREFIX = 'gear-custom-';

const FORMAT_1_PAYLOADS = Object.freeze([
    Object.freeze({ path: 'activities.jsonl', store: V2_STORE_NAME.ACTIVITIES }),
    Object.freeze({ path: 'sources.jsonl', store: V2_STORE_NAME.ACTIVITY_SOURCES }),
    Object.freeze({ path: 'streams/series.jsonl', store: V2_STORE_NAME.STREAM_SERIES }),
    Object.freeze({ path: 'laps.jsonl', store: V2_STORE_NAME.LAPS }),
    Object.freeze({ path: 'events.jsonl', store: V2_STORE_NAME.EVENTS }),
    Object.freeze({ path: 'devices.jsonl', store: V2_STORE_NAME.DEVICES }),
    Object.freeze({ path: 'overrides.jsonl', synthetic: true }),
    Object.freeze({ path: 'analysis/snapshots.jsonl', synthetic: true }),
    Object.freeze({ path: 'settings.json', settings: true }),
    Object.freeze({ path: 'raw/artifacts.jsonl', store: V2_STORE_NAME.RAW_ARTIFACTS }),
    Object.freeze({ path: 'system/metadata.jsonl', store: V2_STORE_NAME.METADATA }),
    Object.freeze({ path: 'system/migrations.jsonl', store: V2_STORE_NAME.MIGRATIONS }),
    Object.freeze({ path: 'imports/jobs.jsonl', store: V2_STORE_NAME.IMPORT_JOBS }),
    Object.freeze({ path: 'imports/items.jsonl', store: V2_STORE_NAME.IMPORT_ITEMS }),
    Object.freeze({ path: 'review/candidates.jsonl', store: V2_STORE_NAME.MERGE_CANDIDATES }),
    Object.freeze({ path: 'review/decisions.jsonl', store: V2_STORE_NAME.MERGE_DECISIONS })
]);

const FORMAT_2_PAYLOADS = Object.freeze([
    ...FORMAT_1_PAYLOADS.slice(0, 2),
    Object.freeze({ path: 'connections.jsonl', store: V2_STORE_NAME.SOURCE_CONNECTIONS }),
    ...FORMAT_1_PAYLOADS.slice(2)
]);

const FORMAT_3_PAYLOADS = Object.freeze([
    ...FORMAT_2_PAYLOADS.slice(0, 3),
    Object.freeze({
        path: 'operations/source-manager.jsonl',
        store: V2_STORE_NAME.SOURCE_OPERATIONS
    }),
    ...FORMAT_2_PAYLOADS.slice(3)
]);

const BACKUP_PROFILES = Object.freeze({
    1: Object.freeze({
        backupFormatVersion: 1,
        indexedDbVersion: 4,
        schemaId: 'strava-stats-v2@4',
        schema: V2_PHYSICAL_SCHEMA_BY_VERSION[4],
        storeNames: LEGACY_STORE_NAMES,
        payloads: FORMAT_1_PAYLOADS,
        entryPaths: BACKUP_ENTRY_PATHS_BY_FORMAT[1],
        migrationRegistry: Object.freeze(V2_MIGRATION_REGISTRY.slice(0, 4))
    }),
    2: Object.freeze({
        backupFormatVersion: 2,
        indexedDbVersion: 5,
        schemaId: 'strava-stats-v2@5',
        schema: V2_PHYSICAL_SCHEMA_BY_VERSION[5],
        storeNames: FORMAT_2_STORE_NAMES,
        payloads: FORMAT_2_PAYLOADS,
        entryPaths: BACKUP_ENTRY_PATHS_BY_FORMAT[2],
        migrationRegistry: Object.freeze(V2_MIGRATION_REGISTRY.slice(0, 5))
    }),
    3: Object.freeze({
        backupFormatVersion: 3,
        indexedDbVersion: V2_DATABASE_VERSION,
        schemaId: V2_SCHEMA_ID,
        schema: V2_SCHEMA,
        storeNames: STORE_NAMES,
        payloads: FORMAT_3_PAYLOADS,
        entryPaths: BACKUP_ENTRY_PATHS_BY_FORMAT[3],
        migrationRegistry: V2_MIGRATION_REGISTRY
    })
});

const MANIFEST_FIELDS = Object.freeze([
    'applicationVersion',
    'backupFormatVersion',
    'canonicalSchemaVersion',
    'createdAt',
    'databaseName',
    'files',
    'hashes',
    'indexedDbVersion',
    'schemaId',
    'stores'
]);

const JOB_STATUSES = new Set([
    'queued', 'validating', 'hashing', 'decoding', 'normalizing', 'matching',
    'persisting', 'analyzing', 'completed', 'completed_with_warnings',
    'failed_validation', 'failed_decode', 'failed_storage', 'retrying',
    'cancelled'
]);
const ITEM_STATUSES = new Set([
    'queued', 'validating', 'hashing', 'decoding', 'normalizing', 'matching',
    'persisting', 'completed', 'review_required', 'skipped_exact_duplicate',
    'failed_validation', 'failed_decode', 'failed_storage', 'retrying',
    'cancelled'
]);
const TERMINAL_ITEM_STATUSES = new Set([
    'completed', 'review_required', 'skipped_exact_duplicate',
    'failed_validation', 'failed_decode', 'failed_storage', 'cancelled'
]);
const RAW_MEDIA_TYPES = new Set([
    'application/vnd.stravastats.synthetic+json',
    'text/csv;profile=strava-activities',
    'application/vnd.stravastats.strava-archive-row+json',
    'application/vnd.ant.fit;base64',
    'application/vnd.garmin.tcx+xml',
    'application/gpx+xml',
    STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
]);

function backupError(code, operation, retryable = false) {
    return new BackupError(code, operation, retryable);
}

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function codeUnitCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function exactArray(value, length) {
    if (!Array.isArray(value) || value.length !== length) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === length + 1
        && keys.every((key, index) => (
            index === length ? key === 'length' : key === String(index)
        ));
}

function decodeProviderTaggedNode(node) {
    if (!Array.isArray(node) || node.length < 1 || typeof node[0] !== 'string') {
        throw new TypeError();
    }
    if (node[0] === 'n' && exactArray(node, 1)) return null;
    if (node[0] === 'b' && exactArray(node, 2) && typeof node[1] === 'boolean') {
        return node[1];
    }
    if (node[0] === 's' && exactArray(node, 2) && typeof node[1] === 'string') {
        return node[1];
    }
    if (node[0] === 'd' && exactArray(node, 2) && typeof node[1] === 'string') {
        if (node[1] === '-0') return -0;
        if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(node[1])) {
            throw new TypeError();
        }
        const number = Number(node[1]);
        if (!Number.isFinite(number) || String(number) !== node[1]) throw new TypeError();
        return number;
    }
    if (node[0] === 'a' && exactArray(node, 2) && Array.isArray(node[1])) {
        return node[1].map(decodeProviderTaggedNode);
    }
    if (node[0] === 'o' && exactArray(node, 2) && Array.isArray(node[1])) {
        const result = {};
        let previous = null;
        for (const pair of node[1]) {
            if (
                !exactArray(pair, 2)
                || typeof pair[0] !== 'string'
                || (previous !== null && codeUnitCompare(previous, pair[0]) >= 0)
            ) throw new TypeError();
            previous = pair[0];
            Object.defineProperty(result, pair[0], {
                value: decodeProviderTaggedNode(pair[1]),
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return result;
    }
    throw new TypeError();
}

function decodeProviderJsonLines(bytes) {
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        throw new TypeError();
    }
    if (text.length === 0) return [];
    if (!text.endsWith('\n') || text.includes('\r')) throw new TypeError();
    const lines = text.slice(0, -1).split('\n');
    if (lines.some(line => line.length === 0)) throw new TypeError();
    const records = lines.map(line => decodeProviderTaggedNode(JSON.parse(line)));
    const canonical = encodeJsonLines(records);
    if (
        canonical.byteLength !== bytes.byteLength
        || canonical.some((value, index) => value !== bytes[index])
    ) throw new TypeError();
    return records;
}

function ownValues(value, fields, allowSubset = false) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string' || !fields.includes(key))
            || (!allowSubset && !sameArray(
                keys.slice().sort(codeUnitCompare),
                fields.slice().sort(codeUnitCompare)
            ))
        ) return null;
        const output = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            output[key] = descriptor.value;
        }
        return output;
    } catch {
        return null;
    }
}

function opaque(value) {
    return typeof value === 'string' && value.length > 0;
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function exactTagged(left, right) {
    try {
        return encodeTaggedValue(left) === encodeTaggedValue(right);
    } catch {
        return false;
    }
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

function findDataValue(value, key) {
    let cursor = value;
    try {
        for (
            let depth = 0;
            cursor !== null
                && (typeof cursor === 'object' || typeof cursor === 'function')
                && depth < 32;
            depth += 1
        ) {
            const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
            }
            cursor = Object.getPrototypeOf(cursor);
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function inspectOptions(options) {
    const values = ownValues(options, OPTION_FIELDS);
    if (!values) throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, 'create');
    const open = findDataValue(values.indexedDB, 'open');
    const bound = findDataValue(values.IDBKeyRange, 'bound');
    let subtle = findDataValue(values.crypto, 'subtle');
    if (subtle === undefined && values.crypto === globalThis.crypto) {
        subtle = globalThis.crypto.subtle;
    }
    const digest = findDataValue(subtle, 'digest');
    if (
        typeof open !== 'function'
        || typeof bound !== 'function'
        || typeof digest !== 'function'
        || typeof values.now !== 'function'
        || !opaque(values.applicationVersion)
        || typeof values.settingsReader !== 'function'
        || typeof values.settingsWriter !== 'function'
    ) throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, 'create');
    return Object.freeze({
        ...values,
        crypto: Object.freeze({
            subtle: Object.freeze({
                digest: (...args) => digest.call(subtle, ...args)
            })
        }),
        open,
        bound
    });
}

function signalAborted(signal, operation) {
    if (signal === undefined) return false;
    try {
        const descriptor = Object.getOwnPropertyDescriptor(signal, 'aborted');
        if (descriptor?.enumerable && Object.hasOwn(descriptor, 'value')) {
            if (typeof descriptor.value !== 'boolean') {
                throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
            }
            return descriptor.value;
        }
        if (typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal) {
            return signal.aborted;
        }
    } catch (error) {
        if (error instanceof BackupError) throw error;
    }
    throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
}

function checkCancelled(signal, operation) {
    if (signalAborted(signal, operation)) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_CANCELLED, operation);
    }
}

function checkPostCommitCancelled(signal, operation) {
    if (signalAborted(signal, operation)) {
        throw backupError(BACKUP_ERROR_CODE.SETTINGS_PENDING, operation, true);
    }
}

function idbErrorCode(error, fallback, operation) {
    const name = typeof error?.name === 'string' ? error.name : '';
    if (name === 'QuotaExceededError') {
        return backupError(BACKUP_ERROR_CODE.QUOTA_EXCEEDED, operation, true);
    }
    if (name === 'AbortError') {
        return backupError(BACKUP_ERROR_CODE.RESTORE_ABORTED, operation, true);
    }
    if (name === 'VersionError') {
        return backupError(BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE, operation);
    }
    return backupError(fallback, operation);
}

function mapCodecError(error, operation) {
    if (error instanceof BackupError) return error;
    if (error instanceof BackupCodecError) {
        const code = Object.hasOwn(BACKUP_ERROR_CODE, error.code)
            ? BACKUP_ERROR_CODE[error.code]
            : BACKUP_ERROR_CODE.BACKUP_DATA_INVALID;
        return backupError(code, operation);
    }
    return backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
}

function readAll(database, mode = 'readonly') {
    return new Promise((resolve, reject) => {
        let transaction;
        try {
            transaction = database.transaction(STORE_NAMES, mode);
        } catch (error) {
            reject(idbErrorCode(error, BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, 'export'));
            return;
        }
        const output = Object.create(null);
        let failed = false;
        for (const storeName of STORE_NAMES) {
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => { output[storeName] = request.result; };
        }
        transaction.oncomplete = () => resolve(output);
        transaction.onabort = () => {
            if (!failed) reject(idbErrorCode(
                transaction.error,
                BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE,
                'export'
            ));
        };
        transaction.onerror = () => { failed = false; };
    });
}

function openExisting(dependencies, operation) {
    return new Promise((resolve, reject) => {
        let request;
        let upgradeVersion = null;
        let blocked = false;
        try {
            request = dependencies.open.call(dependencies.indexedDB,
                V2_DATABASE_NAME,
                V2_DATABASE_VERSION
            );
        } catch (error) {
            reject(idbErrorCode(error, BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation));
            return;
        }
        request.onupgradeneeded = event => {
            upgradeVersion = event.oldVersion;
            try { request.transaction.abort(); } catch { /* terminal event */ }
        };
        request.onerror = () => {
            const code = upgradeVersion === 0
                ? BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE
                : upgradeVersion === null
                    ? null
                    : BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE;
            reject(code
                ? backupError(code, operation)
                : idbErrorCode(
                    request.error,
                    BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE,
                    operation
                ));
        };
        request.onblocked = () => {
            blocked = true;
            reject(backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation, true));
        };
        request.onsuccess = () => {
            const database = request.result;
            if (blocked) {
                database.close();
                return;
            }
            if (database.version !== V2_DATABASE_VERSION || !verifyPhysicalSchema(database)) {
                database.close();
                reject(backupError(
                    BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE,
                    operation
                ));
                return;
            }
            resolve(database);
        };
    });
}

function validMetadata(record, profile = BACKUP_PROFILES[3]) {
    const fields = [
        'key', 'databaseName', 'schemaId', 'indexedDbVersion',
        'canonicalSchemaVersion', 'createdAt', 'createdByApplicationVersion'
    ];
    const value = ownValues(record, fields);
    return value !== null
        && value.key === V2_METADATA_KEY
        && value.databaseName === V2_DATABASE_NAME
        && value.schemaId === profile.schemaId
        && value.indexedDbVersion === profile.indexedDbVersion
        && value.canonicalSchemaVersion === V2_CANONICAL_SCHEMA_VERSION
        && strictUtc(value.createdAt)
        && opaque(value.createdByApplicationVersion);
}

function validMigration(record, expected) {
    const fields = [
        'id', 'fromVersion', 'toVersion', 'status', 'startedAt', 'completedAt',
        'applicationVersion', 'inputSummary', 'outputSummary', 'errorCode',
        'retryCount'
    ];
    const value = ownValues(record, fields);
    return value !== null
        && value.id === expected.id
        && value.fromVersion === expected.fromVersion
        && value.toVersion === expected.toVersion
        && value.status === 'completed'
        && strictUtc(value.startedAt)
        && strictUtc(value.completedAt)
        && value.completedAt === value.startedAt
        && opaque(value.applicationVersion)
        && ownValues(value.inputSummary, ['storeCount']) !== null
        && ownValues(value.outputSummary, ['storeCount']) !== null
        && value.inputSummary.storeCount === (expected.fromVersion === 0
            ? 0
            : V2_PHYSICAL_SCHEMA_BY_VERSION[expected.fromVersion].stores.length)
        && value.outputSummary.storeCount
            === V2_PHYSICAL_SCHEMA_BY_VERSION[expected.toVersion].stores.length
        && value.errorCode === null
        && value.retryCount === 0;
}

function validSystem(records, profile = BACKUP_PROFILES[3]) {
    return records[V2_STORE_NAME.METADATA].length === 1
        && validMetadata(records[V2_STORE_NAME.METADATA][0], profile)
        && records[V2_STORE_NAME.MIGRATIONS].length === profile.migrationRegistry.length
        && profile.migrationRegistry.every((expected, index) => (
            validMigration(records[V2_STORE_NAME.MIGRATIONS][index], expected)
        ));
}

function validRawArtifact(record, profile) {
    const fields = [
        'id', 'sha256', 'mediaType', 'byteLength', 'content', 'acquiredVia',
        'importedAt', 'state', 'activityId'
    ];
    const value = ownValues(record, fields);
    if (
        !value
        || !/^[a-f0-9]{64}$/.test(value.sha256)
        || value.id !== `raw:${value.sha256}`
        || !RAW_MEDIA_TYPES.has(value.mediaType)
        || !Number.isSafeInteger(value.byteLength)
        || value.byteLength <= 0
        || typeof value.content !== 'string'
        || new TextEncoder().encode(value.content).byteLength !== value.byteLength
        || !strictUtc(value.importedAt)
    ) return false;
    if (value.mediaType === STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE) {
        if (
            profile.backupFormatVersion < 2
            || value.acquiredVia !== 'provider-artifact'
        ) return false;
        try {
            stravaProviderArtifactDecoder.decode({
                mediaType: value.mediaType,
                content: value.content
            });
        } catch {
            return false;
        }
    } else if (value.acquiredVia !== 'local-file') return false;
    return (value.state === 'pending' && value.activityId === null)
        || (value.state === 'committed' && opaque(value.activityId));
}

function validProviderArtifactLink(artifact, sources) {
    if (
        artifact.mediaType !== STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
        || artifact.state === 'pending'
    ) return true;
    let expectedSource;
    try {
        const bundle = stravaProviderArtifactDecoder.decode({
            mediaType: artifact.mediaType,
            content: artifact.content
        });
        expectedSource = bundle.sources[0];
    } catch {
        return false;
    }
    const acceptedIds = new Set([
        expectedSource.id,
        `exact-source:${artifact.id}:0`
    ]);
    return sources.some(source => (
        acceptedIds.has(source.id)
        && source.rawArtifactId === artifact.id
        && source.activityId === artifact.activityId
        && source.provider === expectedSource.provider
        && source.externalId === expectedSource.externalId
        && source.acquisitionMethod === expectedSource.acquisitionMethod
        && source.deviceId === expectedSource.deviceId
        && source.importedAt === expectedSource.importedAt
    ));
}

function validJob(record) {
    const fields = [
        'id', 'status', 'totalItems', 'completedItems', 'createdAt',
        'completedAt', 'retryCount', 'errorCode'
    ];
    const value = ownValues(record, fields);
    return value !== null
        && opaque(value.id)
        && JOB_STATUSES.has(value.status)
        && strictUtc(value.createdAt)
        && (value.completedAt === null || strictUtc(value.completedAt))
        && Number.isSafeInteger(value.totalItems)
        && value.totalItems > 0
        && Number.isSafeInteger(value.completedItems)
        && value.completedItems >= 0
        && value.completedItems <= value.totalItems
        && Number.isSafeInteger(value.retryCount)
        && value.retryCount >= 0
        && (value.errorCode === null || opaque(value.errorCode));
}

function validItem(record) {
    const fields = [
        'id', 'jobId', 'ordinal', 'artifactId', 'status', 'errorCode',
        'retryable', 'activityId'
    ];
    const value = ownValues(record, fields);
    return value !== null
        && opaque(value.id)
        && opaque(value.jobId)
        && Number.isSafeInteger(value.ordinal)
        && value.ordinal >= 0
        && (value.artifactId === null || opaque(value.artifactId))
        && ITEM_STATUSES.has(value.status)
        && (value.errorCode === null || opaque(value.errorCode))
        && typeof value.retryable === 'boolean'
        && (value.activityId === null || opaque(value.activityId));
}

function validCanonicalGraph(records) {
    const activities = new Map();
    const devices = new Map();
    for (const record of records[V2_STORE_NAME.DEVICES]) {
        if (!opaque(record?.id) || devices.has(record.id)) return false;
        devices.set(record.id, record);
    }
    const referencedDevices = new Set();
    for (const envelope of records[V2_STORE_NAME.ACTIVITIES]) {
        const values = ownValues(envelope, [
            'schemaVersion', 'activity', 'warnings', 'versionMetadata', 'deviceIds'
        ]);
        if (!values || !opaque(values.activity?.id) || activities.has(values.activity.id)) {
            return false;
        }
        activities.set(values.activity.id, values);
    }
    for (const [activityId, envelope] of activities) {
        const streams = records[V2_STORE_NAME.STREAM_SERIES]
            .filter(record => record.activityId === activityId)
            .map(record => record.series)
            .sort((left, right) => codeUnitCompare(left.streamType, right.streamType));
        const laps = records[V2_STORE_NAME.LAPS]
            .filter(record => record.activityId === activityId)
            .sort((left, right) => left.index - right.index);
        const events = records[V2_STORE_NAME.EVENTS]
            .filter(record => record.activityId === activityId)
            .sort((left, right) => left.index - right.index);
        const sources = records[V2_STORE_NAME.ACTIVITY_SOURCES]
            .filter(record => record.activityId === activityId)
            .sort((left, right) => codeUnitCompare(left.id, right.id));
        if (!Array.isArray(envelope.deviceIds)) return false;
        envelope.deviceIds.forEach(id => referencedDevices.add(id));
        const bundle = {
            schemaVersion: envelope.schemaVersion,
            activity: envelope.activity,
            streams: { activityId, series: streams },
            laps,
            events,
            sources,
            devices: envelope.deviceIds.map(id => devices.get(id)),
            warnings: envelope.warnings,
            versionMetadata: envelope.versionMetadata
        };
        let validation;
        try { validation = validateImportedActivityBundle(bundle); } catch { return false; }
        if (validation.ok !== true) return false;
    }
    return [
        V2_STORE_NAME.ACTIVITY_SOURCES,
        V2_STORE_NAME.STREAM_SERIES,
        V2_STORE_NAME.LAPS,
        V2_STORE_NAME.EVENTS
    ].every(store => records[store].every(record => activities.has(record.activityId)))
        && records[V2_STORE_NAME.DEVICES].every(record => referencedDevices.has(record.id));
}

function primaryKey(record, descriptor) {
    const readPath = path => path.split('.').reduce(
        (value, part) => value?.[part],
        record
    );
    return Array.isArray(descriptor.keyPath)
        ? descriptor.keyPath.map(readPath)
        : readPath(descriptor.keyPath);
}

function compareCurrentIdbKeys(left, right) {
    if (typeof left === 'string' && typeof right === 'string') {
        return codeUnitCompare(left, right);
    }
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return null;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (typeof left[index] !== 'string' || typeof right[index] !== 'string') return null;
        const comparison = codeUnitCompare(left[index], right[index]);
        if (comparison !== 0) return comparison;
    }
    return 0;
}

function canonicalStoreKeys(records, descriptor) {
    let previous = null;
    for (const record of records) {
        const key = primaryKey(record, descriptor);
        const parts = Array.isArray(key) ? key : [key];
        if (!parts.every(opaque)) return false;
        if (previous !== null) {
            const comparison = compareCurrentIdbKeys(previous, key);
            if (comparison === null || comparison >= 0) return false;
        }
        previous = key;
    }
    return true;
}

function validateRecords(records, operation = 'validate', profile = BACKUP_PROFILES[3], {
    portableConnections = false,
    portableOperation = false
} = {}) {
    if (!validSystem(records, profile) || !validCanonicalGraph(records)) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    if (!profile.schema.stores.every(descriptor => (
        canonicalStoreKeys(records[descriptor.name], descriptor)
    ))) throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    if (profile.backupFormatVersion >= 2) {
        const connections = records[V2_STORE_NAME.SOURCE_CONNECTIONS];
        if (!Array.isArray(connections) || !connections.every(record => {
            const normalized = normalizeSourceConnectionRecord(record);
            return normalized !== null
                && (!portableConnections
                    || normalized.status === 'reconnect_required'
                    || normalized.status === 'disconnected');
        })) throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    if (profile.backupFormatVersion === 3) {
        const operations = records[V2_STORE_NAME.SOURCE_OPERATIONS];
        if (!Array.isArray(operations) || operations.length !== 1) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
        }
        const normalized = normalizeSourceOperationRecord(operations[0]);
        if (!normalized || (portableOperation && normalized.status !== 'idle')) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
        }
    }
    if (!records[V2_STORE_NAME.RAW_ARTIFACTS].every(record => (
        validRawArtifact(record, profile)
    ))) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    if (
        profile.backupFormatVersion >= 2
        && records[V2_STORE_NAME.RAW_ARTIFACTS].some(record => (
            record.mediaType === STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
        ))
        && !records[V2_STORE_NAME.SOURCE_CONNECTIONS].some(record => (
            record.id === 'source-connection:strava'
        ))
    ) throw backupError(BACKUP_ERROR_CODE.BACKUP_REFERENCE_INVALID, operation);
    if (!records[V2_STORE_NAME.IMPORT_JOBS].every(validJob)
        || !records[V2_STORE_NAME.IMPORT_ITEMS].every(validItem)
        || !records[V2_STORE_NAME.MERGE_CANDIDATES].every(validDuplicateReviewCandidate)
        || !records[V2_STORE_NAME.MERGE_DECISIONS].every(validDuplicateReviewDecision)) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    const activityIds = new Set(records[V2_STORE_NAME.ACTIVITIES].map(r => r.activity.id));
    const deviceIds = new Set(records[V2_STORE_NAME.DEVICES].map(r => r.id));
    const artifactIds = new Set(records[V2_STORE_NAME.RAW_ARTIFACTS].map(r => r.id));
    const jobIds = new Set(records[V2_STORE_NAME.IMPORT_JOBS].map(r => r.id));
    const itemIds = new Set(records[V2_STORE_NAME.IMPORT_ITEMS].map(r => r.id));
    const candidateIds = new Set(records[V2_STORE_NAME.MERGE_CANDIDATES].map(r => r.id));
    const itemsByJob = new Map();
    for (const item of records[V2_STORE_NAME.IMPORT_ITEMS]) {
        const values = itemsByJob.get(item.jobId) ?? [];
        values.push(item);
        itemsByJob.set(item.jobId, values);
    }
    const importLogsValid = records[V2_STORE_NAME.IMPORT_JOBS].every(job => {
        const items = (itemsByJob.get(job.id) ?? []).slice()
            .sort((left, right) => left.ordinal - right.ordinal);
        return items.length === job.totalItems
            && items.every((item, index) => item.ordinal === index)
            && items.filter(item => TERMINAL_ITEM_STATUSES.has(item.status)).length
                === job.completedItems;
    });
    const decisionsByCandidate = new Map();
    for (const decision of records[V2_STORE_NAME.MERGE_DECISIONS]) {
        const values = decisionsByCandidate.get(decision.candidateId) ?? [];
        values.push(decision);
        decisionsByCandidate.set(decision.candidateId, values);
    }
    const reviewAuditValid = records[V2_STORE_NAME.MERGE_CANDIDATES]
        .every(candidate => {
            const decisions = decisionsByCandidate.get(candidate.id) ?? [];
            return candidate.status === 'review_required'
                ? decisions.length === 0
                : decisions.length === 1
                    && decisions[0].decision === candidate.status;
        });
    const providerLinksValid = records[V2_STORE_NAME.RAW_ARTIFACTS].every(artifact => (
        validProviderArtifactLink(
            artifact,
            records[V2_STORE_NAME.ACTIVITY_SOURCES]
        )
    ));
    const referencesValid = records[V2_STORE_NAME.ACTIVITY_SOURCES].every(record => (
        (record.rawArtifactId === undefined || record.rawArtifactId === null
            || artifactIds.has(record.rawArtifactId))
        && (record.deviceId === undefined || record.deviceId === null
            || deviceIds.has(record.deviceId))
    )) && records[V2_STORE_NAME.RAW_ARTIFACTS].every(record => (
        record.activityId === null || activityIds.has(record.activityId)
    )) && records[V2_STORE_NAME.IMPORT_ITEMS].every(record => (
        jobIds.has(record.jobId)
        && (record.artifactId === null || artifactIds.has(record.artifactId))
        && (record.activityId === null || activityIds.has(record.activityId))
    )) && records[V2_STORE_NAME.MERGE_CANDIDATES].every(record => (
        activityIds.has(record.activityAId)
        && activityIds.has(record.activityBId)
        && itemIds.has(record.createdFromImportItemId)
    )) && records[V2_STORE_NAME.MERGE_DECISIONS].every(record => (
        candidateIds.has(record.candidateId)
    ));
    if (!referencesValid || !providerLinksValid || !importLogsValid || !reviewAuditValid) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_REFERENCE_INVALID, operation);
    }
}

function normalizeSettings(value, operation) {
    let keys;
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) throw new Error();
        keys = Reflect.ownKeys(value);
    } catch {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation);
    }
    if (keys.some(key => typeof key !== 'string')) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation);
    }
    keys.sort(codeUnitCompare);
    const output = [];
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
            || typeof descriptor.value !== 'string'
            || (!SETTINGS_KEYS.includes(key) && !key.startsWith(SETTINGS_GEAR_PREFIX))
            || (key.startsWith(SETTINGS_GEAR_PREFIX) && key.length === SETTINGS_GEAR_PREFIX.length)
        ) throw backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation);
        output.push({ key, value: descriptor.value });
    }
    return output;
}

async function readSettings(dependencies, operation) {
    let value;
    try { value = await dependencies.settingsReader(); } catch {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation, true);
    }
    return normalizeSettings(value, operation);
}

function portableConnection(record) {
    const normalized = normalizeSourceConnectionRecord(record);
    if (!normalized) return null;
    if (normalized.status !== 'connected' && normalized.status !== 'error') {
        return normalized;
    }
    return Object.freeze({
        ...normalized,
        status: 'reconnect_required',
        errorCode: 'AUTHORIZATION_REQUIRED'
    });
}

function portableSourceOperation(record, operation) {
    const normalized = normalizeSourceOperationRecord(record);
    if (!normalized) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    if (normalized.status === 'active') {
        throw backupError(BACKUP_ERROR_CODE.ACTIVE_SOURCE_OPERATION, operation);
    }
    return normalized;
}

function portableRecords(records, operation) {
    const output = Object.create(null);
    for (const name of STORE_NAMES) output[name] = records[name];
    output[V2_STORE_NAME.SOURCE_CONNECTIONS] = records[V2_STORE_NAME.SOURCE_CONNECTIONS]
        .map(portableConnection);
    if (output[V2_STORE_NAME.SOURCE_CONNECTIONS].some(record => record === null)) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    output[V2_STORE_NAME.SOURCE_OPERATIONS] = records[V2_STORE_NAME.SOURCE_OPERATIONS]
        .map(record => portableSourceOperation(record, operation));
    return output;
}

function timestamp(dependencies, operation) {
    let value;
    try { value = dependencies.now(); } catch {
        throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
    }
    if (!Number.isFinite(value)) {
        throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
    }
    const result = new Date(value).toISOString();
    if (!strictUtc(result)) throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
    return result;
}

async function exportSnapshot(dependencies, signal) {
    const operation = 'export';
    checkCancelled(signal, operation);
    const settingsBefore = await readSettings(dependencies, operation);
    let database;
    try {
        database = await openExisting(dependencies, operation);
        const records = await readAll(database);
        checkCancelled(signal, operation);
        if (!validSystem(records)) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE, operation);
        }
        validateRecords(records, operation, BACKUP_PROFILES[3]);
        const projectedRecords = portableRecords(records, operation);
        validateRecords(projectedRecords, operation, BACKUP_PROFILES[3], {
            portableConnections: true,
            portableOperation: true
        });
        const settingsAfter = await readSettings(dependencies, operation);
        if (!exactTagged(settingsBefore, settingsAfter)) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE, operation, true);
        }
        const payloadEntries = [];
        const files = [];
        const hashes = [];
        for (const payload of FORMAT_3_PAYLOADS) {
            checkCancelled(signal, operation);
            const values = payload.synthetic
                ? []
                : payload.settings
                    ? settingsBefore
                    : projectedRecords[payload.store];
            const bytes = encodeJsonLines(values);
            const digest = await sha256(bytes, dependencies.crypto);
            const digestHex = Array.from(digest, byte => (
                byte.toString(16).padStart(2, '0')
            )).join('');
            payloadEntries.push({ path: payload.path, bytes });
            files.push({
                path: payload.path,
                mediaType: 'application/vnd.stravastats.tagged-jsonl;version=1',
                recordCount: values.length,
                byteLength: bytes.byteLength
            });
            hashes.push({ path: payload.path, sha256: digestHex });
        }
        const createdAt = timestamp(dependencies, operation);
        const manifest = {
            backupFormatVersion: 3,
            databaseName: V2_DATABASE_NAME,
            indexedDbVersion: V2_DATABASE_VERSION,
            schemaId: V2_SCHEMA_ID,
            canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
            createdAt,
            applicationVersion: dependencies.applicationVersion,
            stores: STORE_NAMES.map(name => ({
                name,
                recordCount: projectedRecords[name].length
            })),
            files,
            hashes
        };
        const manifestBytes = encodeCanonicalJson(manifest);
        const entries = [
            { path: BACKUP_ENTRY_PATHS_BY_FORMAT[3][0], bytes: manifestBytes },
            ...payloadEntries
        ];
        const archive = await createDeterministicZip(entries, dependencies.crypto);
        checkCancelled(signal, operation);
        const filename = `stravastats-backup-${createdAt.replace(/[-:.]/g, '')}.stravastats-backup.zip`;
        return deepFreeze({
            status: 'exported',
            blob: new Blob([archive], { type: 'application/zip' }),
            filename,
            byteLength: archive.byteLength,
            createdAt,
            activityCount: records[V2_STORE_NAME.ACTIVITIES].length
        });
    } catch (error) {
        throw mapCodecError(error, operation);
    } finally {
        database?.close();
    }
}

async function fileBytes(file, operation) {
    if (file instanceof Uint8Array) {
        if (file.byteLength > BACKUP_BYTE_LIMIT) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_TOO_LARGE, operation);
        }
        return file.slice();
    }
    if (file instanceof ArrayBuffer) return fileBytes(new Uint8Array(file), operation);
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
        if (file.size > BACKUP_BYTE_LIMIT) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_TOO_LARGE, operation);
        }
        return new Uint8Array(await file.arrayBuffer());
    }
    throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
}

function validManifest(manifest, entries, profile) {
    const value = ownValues(manifest, MANIFEST_FIELDS);
    if (
        !value
        || value.backupFormatVersion !== profile.backupFormatVersion
        || value.databaseName !== V2_DATABASE_NAME
        || value.indexedDbVersion !== profile.indexedDbVersion
        || value.schemaId !== profile.schemaId
        || value.canonicalSchemaVersion !== V2_CANONICAL_SCHEMA_VERSION
        || !strictUtc(value.createdAt)
        || !opaque(value.applicationVersion)
        || !Array.isArray(value.stores)
        || !Array.isArray(value.files)
        || !Array.isArray(value.hashes)
        || value.stores.length !== profile.storeNames.length
        || value.files.length !== profile.payloads.length
        || value.hashes.length !== profile.payloads.length
    ) return null;
    const stores = value.stores.every((store, index) => {
        const fields = ownValues(store, ['name', 'recordCount']);
        return fields
            && fields.name === profile.storeNames[index]
            && Number.isSafeInteger(fields.recordCount)
            && fields.recordCount >= 0;
    });
    const files = value.files.every((file, index) => {
        const fields = ownValues(file, [
            'path', 'mediaType', 'recordCount', 'byteLength'
        ]);
        return fields
            && fields.path === profile.payloads[index].path
            && fields.mediaType === 'application/vnd.stravastats.tagged-jsonl;version=1'
            && Number.isSafeInteger(fields.recordCount)
            && fields.recordCount >= 0
            && Number.isSafeInteger(fields.byteLength)
            && fields.byteLength === entries[index + 1].byteLength;
    });
    const hashes = value.hashes.every((hash, index) => {
        const fields = ownValues(hash, ['path', 'sha256']);
        return fields
            && fields.path === profile.payloads[index].path
            && /^[0-9a-f]{64}$/.test(fields.sha256);
    });
    return stores && files && hashes ? value : null;
}

async function validateBytes(dependencies, file, signal, operation) {
    checkCancelled(signal, operation);
    let bytes;
    let entries;
    try {
        bytes = await fileBytes(file, operation);
        checkCancelled(signal, operation);
        entries = await parseDeterministicZip(bytes, dependencies.crypto);
        checkCancelled(signal, operation);
    } catch (error) {
        throw mapCodecError(error, operation);
    }
    let manifest;
    try { manifest = decodeCanonicalJson(entries[0].bytes); } catch (error) {
        throw mapCodecError(error, operation);
    }
    const format = manifest?.backupFormatVersion;
    const profile = Object.hasOwn(BACKUP_PROFILES, format)
        ? BACKUP_PROFILES[format]
        : null;
    if (
        !profile
        || entries.length !== profile.entryPaths.length
        || manifest?.databaseName !== V2_DATABASE_NAME
        || manifest?.indexedDbVersion !== profile.indexedDbVersion
        || manifest?.schemaId !== profile.schemaId
        || manifest?.canonicalSchemaVersion !== V2_CANONICAL_SCHEMA_VERSION
    ) throw backupError(BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE, operation);
    const valid = validManifest(manifest, entries, profile);
    if (!valid) throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    if (manifest.hashes.some((hash, index) => (
        hash.sha256 !== entries[index + 1].sha256
    ))) throw backupError(BACKUP_ERROR_CODE.BACKUP_HASH_MISMATCH, operation);
    let providerArtifactArchive = false;
    if (profile.backupFormatVersion >= 2) {
        const rawIndex = profile.payloads.findIndex(payload => (
            payload.store === V2_STORE_NAME.RAW_ARTIFACTS
        ));
        try {
            providerArtifactArchive = decodeJsonLines(entries[rawIndex + 1].bytes)
                .some(record => record?.mediaType === STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE);
        } catch (error) {
            throw mapCodecError(error, operation);
        }
    }
    const records = Object.create(null);
    let settings = null;
    for (let index = 0; index < profile.payloads.length; index += 1) {
        checkCancelled(signal, operation);
        const payload = profile.payloads[index];
        let decoded;
        try {
            decoded = decodeJsonLines(entries[index + 1].bytes);
        } catch (error) {
            if (!providerArtifactArchive) throw mapCodecError(error, operation);
            try {
                decoded = decodeProviderJsonLines(entries[index + 1].bytes);
            } catch {
                throw mapCodecError(error, operation);
            }
        }
        if (decoded.length !== manifest.files[index].recordCount) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
        }
        if (payload.synthetic) {
            if (decoded.length !== 0) {
                throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
            }
        } else if (payload.settings) {
            settings = decoded;
        } else {
            records[payload.store] = decoded;
        }
    }
    if (!profile.storeNames.every(name => Array.isArray(records[name]))) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    profile.storeNames.forEach((name, index) => {
        if (records[name].length !== manifest.stores[index].recordCount) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
        }
    });
    validateRecords(records, operation, profile, {
        portableConnections: profile.backupFormatVersion >= 2,
        portableOperation: profile.backupFormatVersion === 3
    });
    for (const artifact of records[V2_STORE_NAME.RAW_ARTIFACTS]) {
        const digest = await sha256(
            new TextEncoder().encode(artifact.content),
            dependencies.crypto
        );
        checkCancelled(signal, operation);
        const actual = Array.from(digest, byte => (
            byte.toString(16).padStart(2, '0')
        )).join('');
        if (actual !== artifact.sha256) {
            throw backupError(BACKUP_ERROR_CODE.BACKUP_HASH_MISMATCH, operation);
        }
    }
    if (!Array.isArray(settings) || settings.some(record => {
        const fields = ownValues(record, ['key', 'value']);
        return !fields
            || typeof fields.value !== 'string'
            || (!SETTINGS_KEYS.includes(fields.key)
                && !(
                    fields.key.startsWith(SETTINGS_GEAR_PREFIX)
                    && fields.key.length > SETTINGS_GEAR_PREFIX.length
                ));
    })) throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    const sortedSettings = settings.slice().sort((a, b) => codeUnitCompare(a.key, b.key));
    if (!sameArray(settings.map(r => r.key), sortedSettings.map(r => r.key))
        || new Set(settings.map(r => r.key)).size !== settings.length) {
        throw backupError(BACKUP_ERROR_CODE.BACKUP_DATA_INVALID, operation);
    }
    return { bytes, manifest, records, settings, profile };
}

async function validateOnly(dependencies, file, signal) {
    const snapshot = await validateBytes(dependencies, file, signal, 'validate');
    return deepFreeze({
        status: 'validated',
        byteLength: snapshot.bytes.byteLength,
        createdAt: snapshot.manifest.createdAt,
        activityCount: snapshot.records[V2_STORE_NAME.ACTIVITIES].length
    });
}

function recordsForCurrentRestore(snapshot) {
    if (snapshot.profile.backupFormatVersion === 3) return snapshot.records;
    const records = Object.create(null);
    for (const name of snapshot.profile.storeNames) records[name] = snapshot.records[name];
    if (snapshot.profile.backupFormatVersion === 1) {
        records[V2_STORE_NAME.SOURCE_CONNECTIONS] = [];
    }
    records[V2_STORE_NAME.SOURCE_OPERATIONS] = [createIdleSourceOperationRecord()];
    const priorMetadata = snapshot.records[V2_STORE_NAME.METADATA][0];
    records[V2_STORE_NAME.METADATA] = [{
        ...priorMetadata,
        schemaId: V2_SCHEMA_ID,
        indexedDbVersion: V2_DATABASE_VERSION
    }];
    records[V2_STORE_NAME.MIGRATIONS] = [
        ...snapshot.records[V2_STORE_NAME.MIGRATIONS]
    ];
    for (
        let index = snapshot.profile.migrationRegistry.length;
        index < V2_MIGRATION_REGISTRY.length;
        index += 1
    ) {
        const migration = V2_MIGRATION_REGISTRY[index];
        records[V2_STORE_NAME.MIGRATIONS].push({
            id: migration.id,
            fromVersion: migration.fromVersion,
            toVersion: migration.toVersion,
            status: 'completed',
            startedAt: snapshot.manifest.createdAt,
            completedAt: snapshot.manifest.createdAt,
            applicationVersion: snapshot.manifest.applicationVersion,
            inputSummary: {
                storeCount: V2_PHYSICAL_SCHEMA_BY_VERSION[migration.fromVersion]
                    .stores.length
            },
            outputSummary: {
                storeCount: V2_PHYSICAL_SCHEMA_BY_VERSION[migration.toVersion]
                    .stores.length
            },
            errorCode: null,
            retryCount: 0
        });
    }
    validateRecords(records, 'restore', BACKUP_PROFILES[3], {
        portableConnections: true,
        portableOperation: true
    });
    return records;
}

function targetSettingsPlan(current, desired) {
    const currentMap = new Map(current.map(record => [record.key, record.value]));
    const missing = [];
    for (const record of desired) {
        if (!currentMap.has(record.key)) missing.push(record);
        else if (currentMap.get(record.key) !== record.value) return null;
    }
    return missing;
}

function compareStoreSnapshots(left, right) {
    return STORE_NAMES.every(name => exactTagged(left[name], right[name]));
}

function writeSnapshotToTransaction(transaction, records, putSystem) {
    for (const storeName of STORE_NAMES) {
        const store = transaction.objectStore(storeName);
        for (const record of records[storeName]) {
            if (putSystem && (
                storeName === V2_STORE_NAME.METADATA
                || storeName === V2_STORE_NAME.MIGRATIONS
                || storeName === V2_STORE_NAME.SOURCE_OPERATIONS
            )) store.put(record);
            else store.add(record);
        }
    }
}

function enqueueSnapshotReadback(transaction, records, onMismatch) {
    const observed = Object.create(null);
    let pending = STORE_NAMES.length;
    for (const storeName of STORE_NAMES) {
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => {
            observed[storeName] = request.result;
            pending -= 1;
            if (pending === 0 && !compareStoreSnapshots(observed, records)) {
                onMismatch();
                try { transaction.abort(); } catch { /* terminal */ }
            }
        };
    }
}

function restoreExisting(database, records) {
    return new Promise((resolve, reject) => {
        let transaction;
        try { transaction = database.transaction(STORE_NAMES, 'readwrite'); } catch (error) {
            reject(idbErrorCode(error, BACKUP_ERROR_CODE.RESTORE_ABORTED, 'restore'));
            return;
        }
        const current = Object.create(null);
        let pending = STORE_NAMES.length;
        let decision = null;
        let writeFailure = null;
        for (const storeName of STORE_NAMES) {
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => {
                current[storeName] = request.result;
                pending -= 1;
                if (pending !== 0) return;
                if (compareStoreSnapshots(current, records)) {
                    decision = 'already_restored';
                    return;
                }
                const exactEmpty = validSystem(current)
                    && USER_STORE_NAMES.every(name => current[name].length === 0)
                    && current[V2_STORE_NAME.SOURCE_OPERATIONS].length === 1
                    && normalizeSourceOperationRecord(
                        current[V2_STORE_NAME.SOURCE_OPERATIONS][0]
                    )?.status === 'idle';
                if (!exactEmpty) {
                    decision = 'conflict';
                    try { transaction.abort(); } catch { /* terminal */ }
                    return;
                }
                decision = 'restored';
                try {
                    writeSnapshotToTransaction(transaction, records, true);
                    enqueueSnapshotReadback(transaction, records, () => {
                        writeFailure = new DOMException('', 'AbortError');
                    });
                } catch (error) {
                    writeFailure = error;
                    try { transaction.abort(); } catch { /* terminal */ }
                }
            };
        }
        transaction.oncomplete = () => resolve(decision);
        transaction.onabort = () => {
            if (decision === 'conflict') {
                reject(backupError(BACKUP_ERROR_CODE.TARGET_NOT_EMPTY, 'restore'));
            } else reject(idbErrorCode(
                writeFailure ?? transaction.error,
                BACKUP_ERROR_CODE.RESTORE_ABORTED,
                'restore'
            ));
        };
    });
}

function openAndRestore(dependencies, records) {
    return new Promise((resolve, reject) => {
        let request;
        let fresh = false;
        let result = null;
        let writeFailure = null;
        let incompatible = false;
        let blocked = false;
        try {
            request = dependencies.open.call(
                dependencies.indexedDB,
                V2_DATABASE_NAME,
                V2_DATABASE_VERSION
            );
        } catch (error) {
            reject(idbErrorCode(error, BACKUP_ERROR_CODE.RESTORE_ABORTED, 'restore'));
            return;
        }
        request.onupgradeneeded = event => {
            if (event.oldVersion !== 0) {
                incompatible = true;
                try { request.transaction.abort(); } catch { /* terminal */ }
                return;
            }
            fresh = true;
            try {
                createPhysicalSchema(request.result);
                writeSnapshotToTransaction(request.transaction, records, false);
                enqueueSnapshotReadback(request.transaction, records, () => {
                    writeFailure = new DOMException('', 'AbortError');
                });
                result = 'restored';
            } catch (error) {
                writeFailure = error;
                try { request.transaction.abort(); } catch { /* terminal */ }
            }
        };
        request.onerror = () => reject(incompatible
            ? backupError(BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE, 'restore')
            : idbErrorCode(
                writeFailure ?? request.error,
                BACKUP_ERROR_CODE.RESTORE_ABORTED,
                'restore'
            ));
        request.onblocked = () => {
            blocked = true;
            reject(backupError(BACKUP_ERROR_CODE.RESTORE_ABORTED, 'restore', true));
        };
        request.onsuccess = async () => {
            const database = request.result;
            if (blocked) {
                database.close();
                return;
            }
            try {
                if (!verifyPhysicalSchema(database)) {
                    throw backupError(
                        BACKUP_ERROR_CODE.BACKUP_SCHEMA_INCOMPATIBLE,
                        'restore'
                    );
                }
                if (!fresh) result = await restoreExisting(database, records);
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                database.close();
            }
        };
    });
}

async function restoreSnapshot(dependencies, file, signal) {
    const operation = 'restore';
    const snapshot = await validateBytes(dependencies, file, signal, operation);
    const records = recordsForCurrentRestore(snapshot);
    checkCancelled(signal, operation);
    const currentSettings = await readSettings(dependencies, operation);
    const plan = targetSettingsPlan(currentSettings, snapshot.settings);
    if (plan === null) {
        throw backupError(BACKUP_ERROR_CODE.TARGET_SETTINGS_CONFLICT, operation);
    }
    checkCancelled(signal, operation);
    const databaseStatus = await openAndRestore(dependencies, records);
    checkPostCommitCancelled(signal, operation);
    for (const record of plan) {
        checkPostCommitCancelled(signal, operation);
        try { await dependencies.settingsWriter(record.key, record.value); } catch {
            throw backupError(BACKUP_ERROR_CODE.SETTINGS_PENDING, operation, true);
        }
        checkPostCommitCancelled(signal, operation);
    }
    let finalSettings;
    checkPostCommitCancelled(signal, operation);
    try { finalSettings = await readSettings(dependencies, operation); } catch {
        throw backupError(BACKUP_ERROR_CODE.SETTINGS_PENDING, operation, true);
    }
    checkPostCommitCancelled(signal, operation);
    if (targetSettingsPlan(finalSettings, snapshot.settings)?.length !== 0) {
        throw backupError(BACKUP_ERROR_CODE.SETTINGS_PENDING, operation, true);
    }
    return deepFreeze({
        status: databaseStatus === 'already_restored' ? 'already_restored' : 'restored',
        createdAt: snapshot.manifest.createdAt,
        activityCount: snapshot.records[V2_STORE_NAME.ACTIVITIES].length,
        byteLength: snapshot.bytes.byteLength
    });
}

export function createBackupService(options) {
    const dependencies = inspectOptions(options);
    let closed = false;
    let active = false;
    async function run(operation, callback) {
        if (closed || active) {
            throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, operation);
        }
        active = true;
        try { return await callback(); } finally { active = false; }
    }
    return Object.freeze({
        exportLibrary(options = undefined) {
            const values = options === undefined
                ? Object.freeze({ signal: undefined })
                : ownValues(options, ['signal'], true);
            if (!values) return Promise.reject(backupError(
                BACKUP_ERROR_CODE.INVALID_REQUEST,
                'export'
            ));
            return run('export', () => exportSnapshot(dependencies, values.signal));
        },
        validateBackup(file, options = undefined) {
            const values = options === undefined
                ? Object.freeze({ signal: undefined })
                : ownValues(options, ['signal'], true);
            if (!values) return Promise.reject(backupError(
                BACKUP_ERROR_CODE.INVALID_REQUEST,
                'validate'
            ));
            return run('validate', () => validateOnly(dependencies, file, values.signal));
        },
        restoreBackup(file, options = undefined) {
            const values = options === undefined
                ? Object.freeze({ signal: undefined })
                : ownValues(options, ['signal'], true);
            if (!values) return Promise.reject(backupError(
                BACKUP_ERROR_CODE.INVALID_REQUEST,
                'restore'
            ));
            return run('restore', () => restoreSnapshot(dependencies, file, values.signal));
        },
        async close() {
            if (active) throw backupError(BACKUP_ERROR_CODE.INVALID_REQUEST, 'close');
            closed = true;
            return Object.freeze({ status: 'closed' });
        }
    });
}
