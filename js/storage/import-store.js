import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_STORE_NAME
} from './constants.js';
import { createCanonicalStore } from './database.js';
import { storageError } from './errors.js';
import {
    enqueueCanonicalBundleWrite,
    prepareCanonicalBundleWrite
} from './canonical-store.js';
import {
    DUPLICATE_REVIEW_DECISION_VERSION,
    DUPLICATE_REVIEW_MAX_CANDIDATES,
    compareDuplicateReviewMatches,
    createDuplicateReviewCandidate,
    createDuplicateReviewMatch,
    createDuplicateReviewTimeRange,
    validDuplicateReviewCandidate,
    validDuplicateReviewDecision
} from './duplicate-review.js';
import {
    enqueueExactIdentityLink,
    enqueueExactIdentityLookup,
    enqueueExactIdentityTargetValidation
} from './exact-identity-resolver.js';
import { runTransaction } from './transaction.js';

const OPTION_FIELDS = Object.freeze([
    'indexedDB',
    'IDBKeyRange',
    'now',
    'applicationVersion'
]);
const ARTIFACT_FIELDS = Object.freeze([
    'id',
    'sha256',
    'mediaType',
    'byteLength',
    'content'
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
const STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE =
    'application/vnd.stravastats.strava-provider-artifact+json;version=1';
const TRANSITION_FIELDS = Object.freeze([
    'errorCode',
    'retryable',
    'activityId'
]);
const JOB_STATUSES = Object.freeze([
    'queued',
    'validating',
    'hashing',
    'decoding',
    'normalizing',
    'matching',
    'persisting',
    'analyzing',
    'completed',
    'completed_with_warnings',
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'retrying',
    'cancelled'
]);
const ITEM_STATUSES = Object.freeze([
    'queued',
    'validating',
    'hashing',
    'decoding',
    'normalizing',
    'matching',
    'persisting',
    'completed',
    'review_required',
    'skipped_exact_duplicate',
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'retrying',
    'cancelled'
]);
const TERMINAL_JOB_STATUSES = Object.freeze([
    'completed',
    'completed_with_warnings',
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'cancelled'
]);
const TERMINAL_ITEM_STATUSES = Object.freeze([
    'completed',
    'review_required',
    'skipped_exact_duplicate',
    'failed_validation',
    'failed_decode',
    'failed_storage',
    'cancelled'
]);
const JOB_TRANSITIONS = Object.freeze({
    queued: Object.freeze(['validating', 'cancelled']),
    validating: Object.freeze(['hashing', 'failed_validation', 'cancelled']),
    hashing: Object.freeze(['decoding']),
    decoding: Object.freeze(['normalizing', 'failed_decode', 'cancelled']),
    normalizing: Object.freeze(['matching', 'cancelled']),
    matching: Object.freeze(['persisting', 'cancelled']),
    persisting: Object.freeze(['analyzing', 'failed_storage', 'cancelled']),
    analyzing: Object.freeze(['completed', 'completed_with_warnings']),
    failed_validation: Object.freeze(['retrying']),
    failed_decode: Object.freeze(['retrying']),
    failed_storage: Object.freeze(['retrying']),
    retrying: Object.freeze(['validating']),
    completed: Object.freeze([]),
    completed_with_warnings: Object.freeze([]),
    cancelled: Object.freeze([])
});
const ITEM_TRANSITIONS = Object.freeze({
    queued: Object.freeze(['validating', 'cancelled']),
    validating: Object.freeze(['hashing', 'failed_validation', 'cancelled']),
    hashing: Object.freeze([
        'decoding', 'skipped_exact_duplicate', 'failed_validation',
        'failed_storage', 'retrying', 'cancelled'
    ]),
    decoding: Object.freeze([
        'normalizing', 'failed_decode', 'retrying', 'cancelled'
    ]),
    normalizing: Object.freeze([
        'matching', 'failed_validation', 'retrying', 'cancelled'
    ]),
    matching: Object.freeze(['persisting', 'retrying', 'cancelled']),
    persisting: Object.freeze([
        'completed', 'review_required', 'skipped_exact_duplicate',
        'failed_storage', 'retrying', 'cancelled'
    ]),
    failed_validation: Object.freeze(['retrying']),
    failed_decode: Object.freeze(['retrying']),
    failed_storage: Object.freeze(['retrying']),
    retrying: Object.freeze(['validating']),
    completed: Object.freeze([]),
    review_required: Object.freeze([]),
    skipped_exact_duplicate: Object.freeze([]),
    cancelled: Object.freeze([])
});
const IMPORT_TRANSACTION_STORES = Object.freeze([
    V2_STORE_NAME.ACTIVITIES,
    V2_STORE_NAME.ACTIVITY_SOURCES,
    V2_STORE_NAME.STREAM_SERIES,
    V2_STORE_NAME.LAPS,
    V2_STORE_NAME.EVENTS,
    V2_STORE_NAME.DEVICES,
    V2_STORE_NAME.RAW_ARTIFACTS,
    V2_STORE_NAME.IMPORT_JOBS,
    V2_STORE_NAME.IMPORT_ITEMS,
    V2_STORE_NAME.MERGE_CANDIDATES,
    V2_STORE_NAME.MERGE_DECISIONS
]);
const COMPARISON_SOURCE_FIELDS = Object.freeze([
    'id',
    'activityId',
    'provider',
    'externalId',
    'rawArtifactId',
    'acquisitionMethod',
    'deviceId',
    'importedAt'
]);
const COMPARISON_SOURCE_REQUIRED_FIELDS = Object.freeze([
    'id',
    'activityId',
    'provider',
    'acquisitionMethod',
    'importedAt'
]);
const COMPARISON_DEVICE_FIELDS = Object.freeze([
    'id',
    'manufacturer',
    'model'
]);

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ownDataValues(value, fields, allowSubset = false) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string' || !fields.includes(key))
            || (!allowSubset && !sameArray(
                keys.slice().sort(),
                fields.slice().sort()
            ))
        ) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function denseStrings(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            || keys.length !== value.length + 1
            || value.length === 0
        ) return null;
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
                || !opaqueString(descriptor.value)
            ) return null;
            result.push(descriptor.value);
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

function opaqueString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function exactUtf8ByteLength(content, byteLength) {
    try {
        return new TextEncoder().encode(content).byteLength === byteLength;
    } catch {
        return false;
    }
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function timestamp(now, operation) {
    let value;
    try {
        value = now();
    } catch {
        throw storageError(STORAGE_ERROR_CODE.INVALID_REQUEST, operation);
    }
    if (!Number.isFinite(value)) {
        throw storageError(STORAGE_ERROR_CODE.INVALID_REQUEST, operation);
    }
    const result = new Date(value).toISOString();
    if (!strictUtc(result)) {
        throw storageError(STORAGE_ERROR_CODE.INVALID_REQUEST, operation);
    }
    return result;
}

function cloneJsonSafe(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('unsafe');
        return value;
    }
    if (typeof value !== 'object' || ancestors.has(value)) {
        throw new TypeError('unsafe');
    }
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw new TypeError('unsafe');
            }
            const keys = Reflect.ownKeys(value);
            if (
                keys.some(key => typeof key !== 'string')
                || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
                || keys.length !== value.length + 1
            ) throw new TypeError('unsafe');
            const result = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                    throw new TypeError('unsafe');
                }
                result.push(cloneJsonSafe(descriptor.value, ancestors));
            }
            return result;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError('unsafe');
        }
        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') throw new TypeError('unsafe');
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError('unsafe');
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

function normalizeOptions(options) {
    const values = ownDataValues(options, OPTION_FIELDS);
    if (!values) return null;
    const open = findDataMethod(values.indexedDB, 'open');
    const bound = findDataMethod(values.IDBKeyRange, 'bound');
    if (
        !open
        || !bound
        || typeof values.now !== 'function'
        || !opaqueString(values.applicationVersion)
    ) return null;
    return Object.freeze({ ...values, open, bound });
}

function dataInvalid(operation) {
    return storageError(STORAGE_ERROR_CODE.DATA_INVALID, operation);
}

function schemaMismatch(operation) {
    return storageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, operation);
}

function notFound(operation) {
    return storageError(STORAGE_ERROR_CODE.NOT_FOUND, operation);
}

function conflict(operation) {
    return storageError(STORAGE_ERROR_CODE.CONFLICT, operation);
}

function validJob(value) {
    const fields = [
        'id', 'status', 'totalItems', 'completedItems', 'createdAt',
        'completedAt', 'retryCount', 'errorCode'
    ];
    const job = ownDataValues(value, fields);
    return job
        && opaqueString(job.id)
        && JOB_STATUSES.includes(job.status)
        && Number.isSafeInteger(job.totalItems)
        && job.totalItems > 0
        && Number.isSafeInteger(job.completedItems)
        && job.completedItems >= 0
        && job.completedItems <= job.totalItems
        && strictUtc(job.createdAt)
        && (job.completedAt === null || strictUtc(job.completedAt))
        && Number.isSafeInteger(job.retryCount)
        && job.retryCount >= 0
        && (job.errorCode === null || opaqueString(job.errorCode))
        ? job
        : null;
}

function validItem(value) {
    const fields = [
        'id', 'jobId', 'ordinal', 'artifactId', 'status', 'errorCode',
        'retryable', 'activityId'
    ];
    const item = ownDataValues(value, fields);
    return item
        && opaqueString(item.id)
        && opaqueString(item.jobId)
        && Number.isSafeInteger(item.ordinal)
        && item.ordinal >= 0
        && (item.artifactId === null || opaqueString(item.artifactId))
        && ITEM_STATUSES.includes(item.status)
        && (item.errorCode === null || opaqueString(item.errorCode))
        && typeof item.retryable === 'boolean'
        && (item.activityId === null || opaqueString(item.activityId))
        ? item
        : null;
}

function validArtifactInput(value) {
    const artifact = ownDataValues(value, ARTIFACT_FIELDS);
    return artifact
        && typeof artifact.sha256 === 'string'
        && /^[a-f0-9]{64}$/.test(artifact.sha256)
        && artifact.id === `raw:${artifact.sha256}`
        && IMPORT_MEDIA_TYPES.includes(artifact.mediaType)
        && Number.isSafeInteger(artifact.byteLength)
        && artifact.byteLength > 0
        && typeof artifact.content === 'string'
        && artifact.content.length > 0
        && exactUtf8ByteLength(artifact.content, artifact.byteLength)
        ? artifact
        : null;
}

function validStoredArtifact(value) {
    const fields = [
        ...ARTIFACT_FIELDS,
        'acquiredVia', 'importedAt', 'state', 'activityId'
    ];
    const artifact = ownDataValues(value, fields);
    return artifact
        && typeof artifact.sha256 === 'string'
        && /^[a-f0-9]{64}$/.test(artifact.sha256)
        && artifact.id === `raw:${artifact.sha256}`
        && IMPORT_MEDIA_TYPES.includes(artifact.mediaType)
        && Number.isSafeInteger(artifact.byteLength)
        && artifact.byteLength > 0
        && typeof artifact.content === 'string'
        && artifact.content.length > 0
        && exactUtf8ByteLength(artifact.content, artifact.byteLength)
        && artifact.acquiredVia === (
            artifact.mediaType === STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
                ? 'provider-artifact'
                : 'local-file'
        )
        && strictUtc(artifact.importedAt)
        && (
            (artifact.state === 'pending' && artifact.activityId === null)
            || (
                artifact.state === 'committed'
                && opaqueString(artifact.activityId)
            )
        )
        ? artifact
        : null;
}

function sameArtifact(left, right) {
    return ARTIFACT_FIELDS.every(field => Object.is(left[field], right[field]));
}

function normalizeTransitionDetails(details) {
    if (details === undefined) {
        return Object.freeze({
            errorCode: null,
            retryable: false,
            activityId: null
        });
    }
    const values = ownDataValues(details, TRANSITION_FIELDS, true);
    if (!values) return null;
    const result = {
        errorCode: Object.hasOwn(values, 'errorCode') ? values.errorCode : null,
        retryable: Object.hasOwn(values, 'retryable') ? values.retryable : false,
        activityId: Object.hasOwn(values, 'activityId') ? values.activityId : null
    };
    if (
        (result.errorCode !== null && !opaqueString(result.errorCode))
        || typeof result.retryable !== 'boolean'
        || (result.activityId !== null && !opaqueString(result.activityId))
    ) return null;
    return Object.freeze(result);
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
                STORAGE_OPERATION.CREATE_IMPORT_STORE,
                true
            ));
            return;
        }
        request.onupgradeneeded = () => {
            try {
                request.transaction.abort();
            } catch {
                // Terminal request events own settlement.
            }
        };
        request.onerror = () => reject(storageError(
            STORAGE_ERROR_CODE.OPEN_FAILED,
            STORAGE_OPERATION.CREATE_IMPORT_STORE,
            true
        ));
        request.onsuccess = () => resolve(request.result);
    });
}

function cloneFrozen(value, operation) {
    try {
        return deepFreeze(cloneJsonSafe(value));
    } catch {
        throw schemaMismatch(operation);
    }
}

function candidateLimitExceeded() {
    return storageError(
        STORAGE_ERROR_CODE.CANDIDATE_LIMIT_EXCEEDED,
        STORAGE_OPERATION.PERSIST_IMPORT_ITEM
    );
}

function ownValue(value, field) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function codeUnitCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function denseOpaqueIds(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            || keys.length !== value.length + 1
        ) return null;
        const ids = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
                || !opaqueString(descriptor.value)
            ) return null;
            ids.push(descriptor.value);
        }
        if (
            new Set(ids).size !== ids.length
            || !sameArray(ids, ids.slice().sort(codeUnitCompare))
        ) return null;
        return ids;
    } catch {
        return null;
    }
}

function providerFamilyLabel(provider) {
    if (provider === 'strava') return 'Strava';
    if (provider === 'fit') return 'FIT file';
    if (provider === 'tcx') return 'TCX file';
    if (provider === 'gpx') return 'GPX file';
    return 'Local import';
}

function comparisonSource(value, activityId, deviceIds) {
    const source = ownDataValues(value, COMPARISON_SOURCE_FIELDS, true);
    if (
        !source
        || COMPARISON_SOURCE_REQUIRED_FIELDS.some(field => (
            !Object.hasOwn(source, field)
        ))
        || !opaqueString(source.id)
        || source.activityId !== activityId
        || !opaqueString(source.provider)
        || !opaqueString(source.acquisitionMethod)
        || !strictUtc(source.importedAt)
    ) return null;
    for (const field of ['externalId', 'rawArtifactId', 'deviceId']) {
        if (
            Object.hasOwn(source, field)
            && source[field] !== null
            && !opaqueString(source[field])
        ) return null;
    }
    if (
        typeof source.deviceId === 'string'
        && !deviceIds.includes(source.deviceId)
    ) return null;
    return {
        id: source.id,
        providerLabel: providerFamilyLabel(source.provider)
    };
}

function validComparisonDevice(value, expectedId) {
    const device = ownDataValues(value, COMPARISON_DEVICE_FIELDS, true);
    if (!device || device.id !== expectedId || !opaqueString(device.id)) return false;
    return ['manufacturer', 'model'].every(field => (
        !Object.hasOwn(device, field)
        || device[field] === null
        || typeof device[field] === 'string'
    ));
}

function safeComparisonActivity(envelope, sources, devices, laps) {
    const activity = ownValue(envelope, 'activity');
    const deviceIds = denseOpaqueIds(ownValue(envelope, 'deviceIds'));
    const capabilities = ownValue(activity, 'capabilities');
    if (
        deviceIds === null
        || !Array.isArray(sources)
        || sources.length === 0
        || !Array.isArray(devices)
        || devices.length !== deviceIds.length
        || !Array.isArray(laps)
    ) return null;
    const safeSources = sources.map(source => (
        comparisonSource(source, ownValue(activity, 'id'), deviceIds)
    ));
    if (
        safeSources.some(source => source === null)
        || new Set(safeSources.map(source => source.id)).size !== safeSources.length
        || devices.some((device, index) => (
            !validComparisonDevice(device, deviceIds[index])
        ))
    ) return null;
    const sourceLabels = [...new Set(safeSources.map(source => (
        source.providerLabel
    )))].sort(codeUnitCompare);
    const sourceCount = safeSources.length;
    const lapCount = laps.length;
    const projection = {
        startTimeUtc: ownValue(activity, 'startTimeUtc'),
        sportCategory: ownValue(activity, 'sportCategory'),
        distanceMeters: ownValue(activity, 'distanceMeters'),
        movingTimeSeconds: ownValue(activity, 'movingTimeSeconds'),
        capabilities: {
            hasGps: ownValue(capabilities, 'hasGps'),
            hasHeartRate: ownValue(capabilities, 'hasHeartRate'),
            hasPower: ownValue(capabilities, 'hasPower'),
            hasCadence: ownValue(capabilities, 'hasCadence'),
            hasLaps: ownValue(capabilities, 'hasLaps')
        },
        sourceCount,
        sourceLabel: `${sourceLabels.join(', ')} · ${sourceCount} ${
            sourceCount === 1 ? 'source' : 'sources'
        }`,
        devicePresent: deviceIds.length > 0,
        deviceLabel: deviceIds.length === 0
            ? 'No device details'
            : deviceIds.length === 1
                ? 'Recorded device'
                : `${deviceIds.length} recorded devices`,
        lapCount
    };
    if (
        !strictUtc(projection.startTimeUtc)
        || !opaqueString(projection.sportCategory)
        || typeof projection.distanceMeters !== 'number'
        || !Number.isFinite(projection.distanceMeters)
        || projection.distanceMeters < 0
        || typeof projection.movingTimeSeconds !== 'number'
        || !Number.isFinite(projection.movingTimeSeconds)
        || projection.movingTimeSeconds < 0
        || !Object.values(projection.capabilities).every(value => (
            typeof value === 'boolean'
        ))
        || laps.some(lap => (
            ownValue(lap, 'activityId') !== ownValue(activity, 'id')
        ))
    ) {
        return null;
    }
    return projection;
}

export function createImportStore(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) {
        throw storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.CREATE_IMPORT_STORE
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
        if (state.database && !state.stale) {
            return Object.freeze({ status: 'ready' });
        }
        if (state.opening) return state.opening;
        state.stale = false;
        const opening = (async () => {
            await canonicalStore.initialize();
            const database = await openCurrent(dependencies);
            if (state.stale) {
                database.close();
                throw storageError(
                    STORAGE_ERROR_CODE.CONNECTION_STALE,
                    STORAGE_OPERATION.CREATE_IMPORT_STORE
                );
            }
            database.onversionchange = () => {
                database.close();
                if (state.database === database) state.database = null;
                state.stale = true;
            };
            state.database = database;
            return Object.freeze({ status: 'ready' });
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

    function enqueueDuplicateReviewLookup(context, incomingActivity) {
        const range = createDuplicateReviewTimeRange({
            bound(lower, upper) {
                return dependencies.bound.call(
                    dependencies.IDBKeyRange,
                    lower,
                    upper
                );
            }
        }, incomingActivity);
        if (range === null) return () => [];
        const token = context.scanPage(
            V2_STORE_NAME.ACTIVITIES,
            'bySportCategoryAndStartTimeUtc',
            range,
            'next',
            DUPLICATE_REVIEW_MAX_CANDIDATES + 1,
            (_indexKey, _primaryKey, envelope) => (
                createDuplicateReviewMatch(incomingActivity, envelope) === null
                    ? 'skip'
                    : 'include'
            )
        );
        return () => {
            const matches = token.read().map(envelope => (
                createDuplicateReviewMatch(incomingActivity, envelope)
            ));
            if (matches.some(match => match === null)) {
                throw schemaMismatch(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
            }
            if (matches.length > DUPLICATE_REVIEW_MAX_CANDIDATES) {
                throw candidateLimitExceeded();
            }
            return matches.sort(compareDuplicateReviewMatches);
        };
    }

    function enqueueDuplicateReviewWrites(
        context,
        matches,
        itemId,
        createdAt
    ) {
        const existingTokens = matches.map(match => context.getAll(
            V2_STORE_NAME.MERGE_CANDIDATES,
            'byActivityPair',
            [match.activityAId, match.activityBId]
        ));
        let result;
        context.afterReads(() => {
            let reviewRequired = false;
            const candidates = [];
            matches.forEach((match, index) => {
                const existingRows = existingTokens[index].read();
                if (existingRows.length > 1) {
                    throw schemaMismatch(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                }
                if (existingRows.length === 1) {
                    const existing = existingRows[0];
                    if (!validDuplicateReviewCandidate(existing)) {
                        throw schemaMismatch(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                    }
                    if (existing.status === 'review_required') {
                        reviewRequired = true;
                    }
                    candidates.push(existing);
                    return;
                }
                const candidate = createDuplicateReviewCandidate({
                    id: `duplicate-candidate:${itemId}:${index}`,
                    itemId,
                    createdAt,
                    match
                });
                if (!candidate) {
                    throw schemaMismatch(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                }
                context.add(V2_STORE_NAME.MERGE_CANDIDATES, candidate);
                candidates.push(candidate);
                reviewRequired = true;
            });
            result = Object.freeze({
                reviewRequired,
                candidates: Object.freeze(candidates.slice())
            });
        });
        return () => result;
    }

    function createImportJob(jobId, itemIds) {
        const ids = denseStrings(itemIds);
        if (
            !opaqueString(jobId)
            || !ids
            || new Set(ids).size !== ids.length
        ) {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.CREATE_IMPORT_JOB));
        }
        const createdAt = timestamp(
            dependencies.now,
            STORAGE_OPERATION.CREATE_IMPORT_JOB
        );
        const job = {
            id: jobId,
            status: 'queued',
            totalItems: ids.length,
            completedItems: 0,
            createdAt,
            completedAt: null,
            retryCount: 0,
            errorCode: null
        };
        const items = ids.map((id, ordinal) => ({
            id,
            jobId,
            ordinal,
            artifactId: null,
            status: 'queued',
            errorCode: null,
            retryable: false,
            activityId: null
        }));
        return runReady(STORAGE_OPERATION.CREATE_IMPORT_JOB, database => (
            runTransaction(database, {
                storeNames: [
                    V2_STORE_NAME.IMPORT_JOBS,
                    V2_STORE_NAME.IMPORT_ITEMS
                ],
                mode: 'readwrite',
                operation: STORAGE_OPERATION.CREATE_IMPORT_JOB
            }, context => {
                context.add(V2_STORE_NAME.IMPORT_JOBS, job);
                for (const item of items) {
                    context.add(V2_STORE_NAME.IMPORT_ITEMS, item);
                }
                return () => cloneFrozen(
                    { job, items },
                    STORAGE_OPERATION.CREATE_IMPORT_JOB
                );
            })
        ));
    }

    function transitionImportJob(jobId, expectedStatus, nextStatus, errorCode = null) {
        if (
            !opaqueString(jobId)
            || !JOB_STATUSES.includes(expectedStatus)
            || !JOB_STATUSES.includes(nextStatus)
            || (errorCode !== null && !opaqueString(errorCode))
            || !JOB_TRANSITIONS[expectedStatus]?.includes(nextStatus)
        ) {
            return Promise.reject(dataInvalid(
                STORAGE_OPERATION.TRANSITION_IMPORT_JOB
            ));
        }
        return runReady(STORAGE_OPERATION.TRANSITION_IMPORT_JOB, database => (
            runTransaction(database, {
                storeNames: [V2_STORE_NAME.IMPORT_JOBS],
                mode: 'readwrite',
                operation: STORAGE_OPERATION.TRANSITION_IMPORT_JOB
            }, context => {
                const token = context.get(V2_STORE_NAME.IMPORT_JOBS, jobId);
                let next;
                context.afterReads(() => {
                    const current = validJob(token.read());
                    if (!current) throw notFound(STORAGE_OPERATION.TRANSITION_IMPORT_JOB);
                    if (current.status !== expectedStatus) {
                        throw conflict(STORAGE_OPERATION.TRANSITION_IMPORT_JOB);
                    }
                    next = {
                        ...current,
                        status: nextStatus,
                        completedAt: TERMINAL_JOB_STATUSES.includes(nextStatus)
                            ? timestamp(
                                dependencies.now,
                                STORAGE_OPERATION.TRANSITION_IMPORT_JOB
                            )
                            : null,
                        retryCount: nextStatus === 'retrying'
                            ? current.retryCount + 1
                            : current.retryCount,
                        errorCode
                    };
                    context.put(V2_STORE_NAME.IMPORT_JOBS, next);
                });
                return () => cloneFrozen(
                    next,
                    STORAGE_OPERATION.TRANSITION_IMPORT_JOB
                );
            })
        ));
    }

    function transitionImportItem(
        itemId,
        expectedStatus,
        nextStatus,
        details
    ) {
        const normalized = normalizeTransitionDetails(details);
        if (
            !opaqueString(itemId)
            || !ITEM_STATUSES.includes(expectedStatus)
            || !ITEM_STATUSES.includes(nextStatus)
            || !normalized
            || !ITEM_TRANSITIONS[expectedStatus]?.includes(nextStatus)
        ) {
            return Promise.reject(dataInvalid(
                STORAGE_OPERATION.TRANSITION_IMPORT_ITEM
            ));
        }
        return runReady(STORAGE_OPERATION.TRANSITION_IMPORT_ITEM, database => (
            runTransaction(database, {
                storeNames: [
                    V2_STORE_NAME.IMPORT_JOBS,
                    V2_STORE_NAME.IMPORT_ITEMS
                ],
                mode: 'readwrite',
                operation: STORAGE_OPERATION.TRANSITION_IMPORT_ITEM
            }, context => {
                const itemToken = context.get(V2_STORE_NAME.IMPORT_ITEMS, itemId);
                let jobToken;
                let nextItem;
                let nextJob;
                context.afterReads(() => {
                    const current = validItem(itemToken.read());
                    if (!current) throw notFound(STORAGE_OPERATION.TRANSITION_IMPORT_ITEM);
                    if (current.status !== expectedStatus) {
                        throw conflict(STORAGE_OPERATION.TRANSITION_IMPORT_ITEM);
                    }
                    jobToken = context.get(V2_STORE_NAME.IMPORT_JOBS, current.jobId);
                });
                context.afterReads(() => {
                    const current = validItem(itemToken.read());
                    const job = validJob(jobToken.read());
                    if (!current || !job) {
                        throw schemaMismatch(STORAGE_OPERATION.TRANSITION_IMPORT_ITEM);
                    }
                    const before = TERMINAL_ITEM_STATUSES.includes(current.status) ? 1 : 0;
                    const after = TERMINAL_ITEM_STATUSES.includes(nextStatus) ? 1 : 0;
                    nextItem = {
                        ...current,
                        status: nextStatus,
                        errorCode: normalized.errorCode,
                        retryable: normalized.retryable,
                        activityId: normalized.activityId
                    };
                    nextJob = {
                        ...job,
                        completedItems: job.completedItems + after - before
                    };
                    if (
                        nextJob.completedItems < 0
                        || nextJob.completedItems > nextJob.totalItems
                    ) throw schemaMismatch(STORAGE_OPERATION.TRANSITION_IMPORT_ITEM);
                    context.put(V2_STORE_NAME.IMPORT_ITEMS, nextItem);
                    context.put(V2_STORE_NAME.IMPORT_JOBS, nextJob);
                });
                return () => cloneFrozen(
                    { item: nextItem, job: nextJob },
                    STORAGE_OPERATION.TRANSITION_IMPORT_ITEM
                );
            })
        ));
    }

    function cancelImportJob(jobId, expectedStatus) {
        if (
            !opaqueString(jobId)
            || !['queued', 'validating', 'decoding', 'normalizing', 'matching', 'persisting']
                .includes(expectedStatus)
        ) {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.CANCEL_IMPORT_JOB));
        }
        return runReady(STORAGE_OPERATION.CANCEL_IMPORT_JOB, database => (
            runTransaction(database, {
                storeNames: [
                    V2_STORE_NAME.IMPORT_JOBS,
                    V2_STORE_NAME.IMPORT_ITEMS
                ],
                mode: 'readwrite',
                operation: STORAGE_OPERATION.CANCEL_IMPORT_JOB
            }, context => {
                const jobToken = context.get(V2_STORE_NAME.IMPORT_JOBS, jobId);
                const itemsToken = context.getAll(
                    V2_STORE_NAME.IMPORT_ITEMS,
                    'byJobId',
                    jobId
                );
                let result;
                context.afterReads(() => {
                    const job = validJob(jobToken.read());
                    const items = itemsToken.read();
                    if (!job) throw notFound(STORAGE_OPERATION.CANCEL_IMPORT_JOB);
                    if (
                        job.status !== expectedStatus
                        || !JOB_TRANSITIONS[expectedStatus].includes('cancelled')
                    ) throw conflict(STORAGE_OPERATION.CANCEL_IMPORT_JOB);
                    if (
                        items.length !== job.totalItems
                        || items.some(item => !validItem(item) || item.jobId !== jobId)
                    ) throw schemaMismatch(STORAGE_OPERATION.CANCEL_IMPORT_JOB);
                    const nextItems = items.map(item => {
                        if (TERMINAL_ITEM_STATUSES.includes(item.status)) return item;
                        if (!ITEM_TRANSITIONS[item.status]?.includes('cancelled')) {
                            throw conflict(STORAGE_OPERATION.CANCEL_IMPORT_JOB);
                        }
                        return {
                            ...item,
                            status: 'cancelled',
                            errorCode: 'IMPORT_CANCELLED',
                            retryable: false,
                            activityId: null
                        };
                    });
                    const nextJob = {
                        ...job,
                        status: 'cancelled',
                        completedItems: nextItems.filter(item => (
                            TERMINAL_ITEM_STATUSES.includes(item.status)
                        )).length,
                        completedAt: timestamp(
                            dependencies.now,
                            STORAGE_OPERATION.CANCEL_IMPORT_JOB
                        ),
                        errorCode: 'IMPORT_CANCELLED'
                    };
                    for (const item of nextItems) {
                        if (!TERMINAL_ITEM_STATUSES.includes(
                            items.find(candidate => candidate.id === item.id).status
                        )) context.put(V2_STORE_NAME.IMPORT_ITEMS, item);
                    }
                    context.put(V2_STORE_NAME.IMPORT_JOBS, nextJob);
                    result = { job: nextJob, items: nextItems };
                });
                return () => cloneFrozen(result, STORAGE_OPERATION.CANCEL_IMPORT_JOB);
            })
        ));
    }

    function storeRawArtifact(itemId, input) {
        const artifactInput = validArtifactInput(input);
        if (!opaqueString(itemId) || !artifactInput) {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.STORE_RAW_ARTIFACT));
        }
        const candidate = {
            ...cloneJsonSafe(artifactInput),
            acquiredVia: artifactInput.mediaType === STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE
                ? 'provider-artifact'
                : 'local-file',
            importedAt: timestamp(
                dependencies.now,
                STORAGE_OPERATION.STORE_RAW_ARTIFACT
            ),
            state: 'pending',
            activityId: null
        };
        return runReady(STORAGE_OPERATION.STORE_RAW_ARTIFACT, database => (
            runTransaction(database, {
                storeNames: [
                    V2_STORE_NAME.RAW_ARTIFACTS,
                    V2_STORE_NAME.IMPORT_ITEMS
                ],
                mode: 'readwrite',
                operation: STORAGE_OPERATION.STORE_RAW_ARTIFACT
            }, context => {
                const itemToken = context.get(V2_STORE_NAME.IMPORT_ITEMS, itemId);
                const matches = context.getAll(
                    V2_STORE_NAME.RAW_ARTIFACTS,
                    'bySha256',
                    candidate.sha256
                );
                let result;
                context.afterReads(() => {
                    const item = validItem(itemToken.read());
                    if (!item) throw notFound(STORAGE_OPERATION.STORE_RAW_ARTIFACT);
                    if (item.status !== 'hashing') {
                        throw conflict(STORAGE_OPERATION.STORE_RAW_ARTIFACT);
                    }
                    const records = matches.read();
                    if (records.length > 1) {
                        result = Object.freeze({ status: 'hash-collision' });
                        return;
                    }
                    const existing = records.length === 0
                        ? null
                        : validStoredArtifact(records[0]);
                    if (records.length === 1 && !existing) {
                        throw schemaMismatch(STORAGE_OPERATION.STORE_RAW_ARTIFACT);
                    }
                    if (existing && !sameArtifact(existing, candidate)) {
                        result = Object.freeze({ status: 'hash-collision' });
                        return;
                    }
                    const artifact = existing || candidate;
                    if (!existing) context.add(V2_STORE_NAME.RAW_ARTIFACTS, artifact);
                    context.put(V2_STORE_NAME.IMPORT_ITEMS, {
                        ...item,
                        artifactId: artifact.id
                    });
                    result = Object.freeze({
                        status: existing?.state === 'committed'
                            ? 'committed-existing'
                            : existing
                                ? 'pending-existing'
                                : 'stored'
                    });
                });
                return () => result;
            })
        ));
    }

    function persistImportItem(itemId, bundle) {
        if (!opaqueString(itemId)) {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.PERSIST_IMPORT_ITEM));
        }
        let prepared;
        try {
            prepared = prepareCanonicalBundleWrite(
                {
                    bound(lower, upper) {
                        return dependencies.bound.call(
                            dependencies.IDBKeyRange,
                            lower,
                            upper
                        );
                    }
                },
                bundle
            );
        } catch {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.PERSIST_IMPORT_ITEM));
        }
        return runReady(STORAGE_OPERATION.PERSIST_IMPORT_ITEM, database => (
            runTransaction(database, {
                storeNames: IMPORT_TRANSACTION_STORES,
                mode: 'readwrite',
                operation: STORAGE_OPERATION.PERSIST_IMPORT_ITEM
            }, context => {
                const itemToken = context.get(V2_STORE_NAME.IMPORT_ITEMS, itemId);
                let jobToken;
                let artifactToken;
                let currentItem;
                let currentJob;
                let currentArtifact;
                let result;

                const finalize = (outcome, activityId, commitArtifact) => {
                    if (
                        !currentItem
                        || !currentJob
                        || !currentArtifact
                        || !opaqueString(activityId)
                    ) {
                        throw schemaMismatch(
                            STORAGE_OPERATION.PERSIST_IMPORT_ITEM
                        );
                    }
                    if (commitArtifact) {
                        context.put(V2_STORE_NAME.RAW_ARTIFACTS, {
                            ...currentArtifact,
                            state: 'committed',
                            activityId
                        });
                    }
                    context.put(V2_STORE_NAME.IMPORT_ITEMS, {
                        ...currentItem,
                        status: outcome,
                        errorCode: null,
                        retryable: false,
                        activityId
                    });
                    context.put(V2_STORE_NAME.IMPORT_JOBS, {
                        ...currentJob,
                        completedItems: currentJob.completedItems + 1
                    });
                    result = Object.freeze({ status: outcome });
                };

                context.afterReads(() => {
                    currentItem = validItem(itemToken.read());
                    if (!currentItem) throw notFound(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                    if (currentItem.status !== 'persisting' || !currentItem.artifactId) {
                        throw conflict(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                    }
                    jobToken = context.get(
                        V2_STORE_NAME.IMPORT_JOBS,
                        currentItem.jobId
                    );
                    artifactToken = context.get(
                        V2_STORE_NAME.RAW_ARTIFACTS,
                        currentItem.artifactId
                    );
                });
                context.afterReads(() => {
                    currentJob = validJob(jobToken.read());
                    currentArtifact = validStoredArtifact(artifactToken.read());
                    if (!currentJob || !currentArtifact) {
                        throw schemaMismatch(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                    }
                    if (currentJob.status !== 'persisting') {
                        throw conflict(STORAGE_OPERATION.PERSIST_IMPORT_ITEM);
                    }
                    const identityResult = enqueueExactIdentityLookup(
                        context,
                        prepared,
                        currentArtifact.state === 'committed'
                            ? currentArtifact.activityId
                            : null
                    );
                    context.afterReads(() => {
                        const identity = identityResult();
                        if (identity.status === 'unmatched') {
                            const candidateCreatedAt = timestamp(
                                dependencies.now,
                                STORAGE_OPERATION.PERSIST_IMPORT_ITEM
                            );
                            const candidateLookup = enqueueDuplicateReviewLookup(
                                context,
                                prepared.records.activityEnvelope.activity
                            );
                            context.afterReads(() => {
                                const matches = candidateLookup();
                                const candidateResult =
                                    enqueueDuplicateReviewWrites(
                                        context,
                                        matches,
                                        itemId,
                                        candidateCreatedAt
                                    );
                                const canonicalResult = enqueueCanonicalBundleWrite(
                                    context,
                                    prepared
                                );
                                context.afterReads(() => {
                                    const candidates = candidateResult();
                                    const canonical = canonicalResult();
                                    if (!candidates || !canonical) {
                                        throw schemaMismatch(
                                            STORAGE_OPERATION.PERSIST_IMPORT_ITEM
                                        );
                                    }
                                    finalize(
                                        candidates.reviewRequired
                                            ? 'review_required'
                                            : 'completed',
                                        canonical.activityId,
                                        true
                                    );
                                });
                            });
                            return;
                        }
                        if (identity.status !== 'exact-match') {
                            throw schemaMismatch(
                                STORAGE_OPERATION.PERSIST_IMPORT_ITEM
                            );
                        }
                        if (currentArtifact.state === 'committed') {
                            const targetResult =
                                enqueueExactIdentityTargetValidation(
                                    context,
                                    identity.activityId
                                );
                            context.afterReads(() => {
                                const target = targetResult();
                                finalize(
                                    'skipped_exact_duplicate',
                                    target.activityId,
                                    false
                                );
                            });
                            return;
                        }
                        const linkResult = enqueueExactIdentityLink(
                            context,
                            prepared,
                            currentArtifact,
                            identity.activityId
                        );
                        context.afterReads(() => {
                            const linked = linkResult();
                            if (!linked) {
                                throw schemaMismatch(
                                    STORAGE_OPERATION.PERSIST_IMPORT_ITEM
                                );
                            }
                            finalize(
                                'completed',
                                linked.activityId,
                                true
                            );
                        });
                    });
                });
                return () => result;
            })
        ));
    }

    function readOne(storeName, id, operation, validator) {
        if (!opaqueString(id)) return Promise.reject(dataInvalid(operation));
        return runReady(operation, database => runTransaction(database, {
            storeNames: [storeName],
            mode: 'readonly',
            operation
        }, context => {
            const token = context.get(storeName, id);
            return () => {
                const value = token.read();
                if (value === undefined) return null;
                if (!validator(value)) throw schemaMismatch(operation);
                return cloneFrozen(value, operation);
            };
        }));
    }

    function listImportItems(jobId) {
        if (!opaqueString(jobId)) {
            return Promise.reject(dataInvalid(STORAGE_OPERATION.LIST_IMPORT_ITEMS));
        }
        return runReady(STORAGE_OPERATION.LIST_IMPORT_ITEMS, database => (
            runTransaction(database, {
                storeNames: [V2_STORE_NAME.IMPORT_ITEMS],
                mode: 'readonly',
                operation: STORAGE_OPERATION.LIST_IMPORT_ITEMS
            }, context => {
                const token = context.getAll(
                    V2_STORE_NAME.IMPORT_ITEMS,
                    'byJobId',
                    jobId
                );
                return () => {
                    const items = token.read();
                    if (items.some(item => !validItem(item))) {
                        throw schemaMismatch(STORAGE_OPERATION.LIST_IMPORT_ITEMS);
                    }
                    items.sort((left, right) => left.ordinal - right.ordinal);
                    return cloneFrozen(items, STORAGE_OPERATION.LIST_IMPORT_ITEMS);
                };
            })
        ));
    }

    function listImportJobs() {
        return runReady(STORAGE_OPERATION.LIST_IMPORT_JOBS, database => (
            runTransaction(database, {
                storeNames: [V2_STORE_NAME.IMPORT_JOBS],
                mode: 'readonly',
                operation: STORAGE_OPERATION.LIST_IMPORT_JOBS
            }, context => {
                const token = context.getAll(
                    V2_STORE_NAME.IMPORT_JOBS,
                    'byCreatedAt'
                );
                return () => {
                    const jobs = token.read();
                    if (jobs.some(job => !validJob(job))) {
                        throw schemaMismatch(STORAGE_OPERATION.LIST_IMPORT_JOBS);
                    }
                    jobs.sort((left, right) => {
                        if (left.createdAt !== right.createdAt) {
                            return left.createdAt < right.createdAt ? 1 : -1;
                        }
                        return left.id < right.id ? 1 : left.id === right.id ? 0 : -1;
                    });
                    return cloneFrozen(jobs, STORAGE_OPERATION.LIST_IMPORT_JOBS);
                };
            })
        ));
    }

    function listDuplicateReviewCandidates() {
        let range;
        try {
            range = dependencies.bound.call(
                dependencies.IDBKeyRange,
                ['review_required', ''],
                ['review_required', '\uffff']
            );
        } catch {
            return Promise.reject(dataInvalid(
                STORAGE_OPERATION.LIST_DUPLICATE_REVIEW_CANDIDATES
            ));
        }
        return runReady(
            STORAGE_OPERATION.LIST_DUPLICATE_REVIEW_CANDIDATES,
            database => runTransaction(database, {
                storeNames: [V2_STORE_NAME.MERGE_CANDIDATES],
                mode: 'readonly',
                operation: STORAGE_OPERATION.LIST_DUPLICATE_REVIEW_CANDIDATES
            }, context => {
                const token = context.scanPage(
                    V2_STORE_NAME.MERGE_CANDIDATES,
                    'byStatusAndCreatedAt',
                    range,
                    'next',
                    DUPLICATE_REVIEW_MAX_CANDIDATES,
                    () => 'include'
                );
                return () => {
                    const candidates = token.read();
                    if (candidates.some(value => (
                        !validDuplicateReviewCandidate(value)
                        || value.status !== 'review_required'
                    ))) {
                        throw schemaMismatch(
                            STORAGE_OPERATION.LIST_DUPLICATE_REVIEW_CANDIDATES
                        );
                    }
                    return cloneFrozen(
                        candidates,
                        STORAGE_OPERATION.LIST_DUPLICATE_REVIEW_CANDIDATES
                    );
                };
            })
        );
    }

    function getDuplicateReviewCandidate(candidateId) {
        const operation = STORAGE_OPERATION.GET_DUPLICATE_REVIEW_CANDIDATE;
        if (!opaqueString(candidateId)) {
            return Promise.reject(dataInvalid(operation));
        }
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.MERGE_CANDIDATES,
                V2_STORE_NAME.ACTIVITIES,
                V2_STORE_NAME.ACTIVITY_SOURCES,
                V2_STORE_NAME.DEVICES,
                V2_STORE_NAME.LAPS
            ],
            mode: 'readonly',
            operation
        }, context => {
            const candidateToken = context.get(
                V2_STORE_NAME.MERGE_CANDIDATES,
                candidateId
            );
            let candidate;
            let activityTokens;
            let sourceTokens;
            let deviceTokens;
            let lapTokens;
            let comparisonRows;
            let result;
            context.afterReads(() => {
                candidate = candidateToken.read();
                if (candidate === undefined) throw notFound(operation);
                if (!validDuplicateReviewCandidate(candidate)) {
                    throw schemaMismatch(operation);
                }
                const activityIds = [
                    candidate.activityAId,
                    candidate.activityBId
                ];
                activityTokens = activityIds.map(id => context.get(
                    V2_STORE_NAME.ACTIVITIES,
                    id
                ));
                sourceTokens = activityIds.map(id => context.getAll(
                    V2_STORE_NAME.ACTIVITY_SOURCES,
                    'byActivityId',
                    id
                ));
                lapTokens = activityIds.map(id => {
                    let range;
                    try {
                        range = dependencies.bound.call(
                            dependencies.IDBKeyRange,
                            [id, 0],
                            [id, Number.MAX_VALUE]
                        );
                    } catch {
                        throw dataInvalid(operation);
                    }
                    return context.getAll(
                        V2_STORE_NAME.LAPS,
                        'byActivityIdAndIndex',
                        range
                    );
                });
            });
            context.afterReads(() => {
                const ids = [candidate.activityAId, candidate.activityBId];
                comparisonRows = ids.map((id, index) => {
                    const envelope = activityTokens[index].read();
                    const sources = sourceTokens[index].read();
                    const laps = lapTokens[index].read();
                    const deviceIds = envelope === undefined
                        ? null
                        : denseOpaqueIds(ownValue(envelope, 'deviceIds'));
                    if (deviceIds === null) throw schemaMismatch(operation);
                    return { envelope, sources, laps, deviceIds };
                });
                deviceTokens = comparisonRows.map(row => row.deviceIds.map(id => (
                    context.get(V2_STORE_NAME.DEVICES, id)
                )));
            });
            context.afterReads(() => {
                const activities = comparisonRows.map((row, index) => {
                    const devices = deviceTokens[index].map(token => token.read());
                    if (devices.some(device => device === undefined)) {
                        throw schemaMismatch(operation);
                    }
                    const projection = safeComparisonActivity(
                        row.envelope,
                        row.sources,
                        devices,
                        row.laps
                    );
                    if (projection === null) throw schemaMismatch(operation);
                    return projection;
                });
                result = {
                    id: candidate.id,
                    confidence: candidate.confidence,
                    status: candidate.status,
                    createdAt: candidate.createdAt,
                    evidence: candidate.evidence,
                    activities
                };
            });
            return () => cloneFrozen(result, operation);
        }));
    }

    function decideDuplicateReviewCandidate(candidateId, decision) {
        const operation = STORAGE_OPERATION.DECIDE_DUPLICATE_REVIEW_CANDIDATE;
        if (
            !opaqueString(candidateId)
            || (decision !== 'confirmed_same' && decision !== 'rejected')
        ) {
            return Promise.reject(dataInvalid(operation));
        }
        return runReady(operation, database => runTransaction(database, {
            storeNames: [
                V2_STORE_NAME.MERGE_CANDIDATES,
                V2_STORE_NAME.MERGE_DECISIONS
            ],
            mode: 'readwrite',
            operation
        }, context => {
            const candidateToken = context.get(
                V2_STORE_NAME.MERGE_CANDIDATES,
                candidateId
            );
            const decisionsToken = context.getAll(
                V2_STORE_NAME.MERGE_DECISIONS,
                'byCandidateId',
                candidateId
            );
            let result;
            context.afterReads(() => {
                const candidate = candidateToken.read();
                const decisions = decisionsToken.read();
                if (candidate === undefined) throw notFound(operation);
                if (
                    !validDuplicateReviewCandidate(candidate)
                    || decisions.some(value => !validDuplicateReviewDecision(value))
                    || decisions.some(value => value.candidateId !== candidateId)
                    || decisions.length > 1
                ) {
                    throw schemaMismatch(operation);
                }
                if (candidate.status !== 'review_required') {
                    const existing = decisions[0];
                    if (
                        decisions.length !== 1
                        || existing.decision !== candidate.status
                    ) {
                        throw schemaMismatch(operation);
                    }
                    if (decision !== candidate.status) throw conflict(operation);
                    result = {
                        status: candidate.status,
                        decision: existing
                    };
                    return;
                }
                const decidedAt = timestamp(dependencies.now, operation);
                if (decisions.length !== 0 || decidedAt < candidate.createdAt) {
                    throw conflict(operation);
                }
                const record = {
                    id: `duplicate-decision:${candidate.id}:${decision}`,
                    candidateId,
                    decision,
                    decidedAt,
                    decisionVersion: DUPLICATE_REVIEW_DECISION_VERSION
                };
                const nextCandidate = {
                    ...candidate,
                    status: decision,
                    updatedAt: decidedAt
                };
                if (
                    !validDuplicateReviewDecision(record)
                    || !validDuplicateReviewCandidate(nextCandidate)
                ) {
                    throw schemaMismatch(operation);
                }
                context.add(V2_STORE_NAME.MERGE_DECISIONS, record);
                context.put(V2_STORE_NAME.MERGE_CANDIDATES, nextCandidate);
                result = { status: decision, decision: record };
            });
            return () => cloneFrozen(result, operation);
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
        ]).then(() => Object.freeze({ status: 'closed' }));
        state.closing = closing;
        closing.finally(() => {
            if (state.closing === closing) state.closing = null;
        }).catch(() => {});
        return closing;
    }

    return Object.freeze({
        initialize,
        createImportJob,
        transitionImportJob,
        transitionImportItem,
        cancelImportJob,
        storeRawArtifact,
        persistImportItem,
        getImportJob(id) {
            return readOne(
                V2_STORE_NAME.IMPORT_JOBS,
                id,
                STORAGE_OPERATION.GET_IMPORT_JOB,
                validJob
            );
        },
        getImportItem(id) {
            return readOne(
                V2_STORE_NAME.IMPORT_ITEMS,
                id,
                STORAGE_OPERATION.GET_IMPORT_ITEM,
                validItem
            );
        },
        getRawArtifact(id) {
            return readOne(
                V2_STORE_NAME.RAW_ARTIFACTS,
                id,
                STORAGE_OPERATION.GET_RAW_ARTIFACT,
                validStoredArtifact
            );
        },
        listImportItems,
        listImportJobs,
        listDuplicateReviewCandidates,
        getDuplicateReviewCandidate,
        decideDuplicateReviewCandidate,
        listActivities(optionsValue) {
            return canonicalStore.listActivities(optionsValue);
        },
        close
    });
}
