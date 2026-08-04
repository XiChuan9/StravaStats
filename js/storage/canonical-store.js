import {
    validateCanonicalActivity,
    validateImportedActivityBundle
} from '../data/contracts/index.js';
import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_CANONICAL_SCHEMA_VERSION,
    V2_STORE_NAME
} from './constants.js';
import { storageError } from './errors.js';
import { runTransaction } from './transaction.js';

const DATA_STORES = Object.freeze([
    V2_STORE_NAME.ACTIVITIES,
    V2_STORE_NAME.ACTIVITY_SOURCES,
    V2_STORE_NAME.STREAM_SERIES,
    V2_STORE_NAME.LAPS,
    V2_STORE_NAME.EVENTS,
    V2_STORE_NAME.DEVICES
]);

const ACTIVITY_ENVELOPE_FIELDS = Object.freeze([
    'schemaVersion',
    'activity',
    'warnings',
    'versionMetadata',
    'deviceIds'
]);

const STREAM_RECORD_FIELDS = Object.freeze([
    'activityId',
    'streamType',
    'series'
]);

const GET_OPTION_FIELDS = Object.freeze(['streamTypes']);
const LIST_OPTION_FIELDS = Object.freeze([
    'sportCategory',
    'limit',
    'direction'
]);

const SPORT_CATEGORIES = Object.freeze([
    'run',
    'ride',
    'swim',
    'walk',
    'hike',
    'workout',
    'winter',
    'team',
    'racket',
    'other'
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
        ) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => !fields.includes(key))
            || (
                !allowSubset
                && !sameArray(keys.slice().sort(), fields.slice().sort())
            )
        ) {
            return null;
        }
        const result = Object.create(null);
        for (const field of keys) {
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
                || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
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

function strictEqual(left, right) {
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
    if (Array.isArray(left)) {
        let leftKeys;
        let rightKeys;
        try {
            leftKeys = Reflect.ownKeys(left);
            rightKeys = Reflect.ownKeys(right);
        } catch {
            return false;
        }
        if (
            left.length !== right.length
            || !sameArray(leftKeys, rightKeys)
            || leftKeys.some(key => (
                typeof key !== 'string'
                || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            ))
        ) {
            return false;
        }
        for (let index = 0; index < left.length; index += 1) {
            const leftDescriptor = Object.getOwnPropertyDescriptor(
                left,
                String(index)
            );
            const rightDescriptor = Object.getOwnPropertyDescriptor(
                right,
                String(index)
            );
            if (
                !leftDescriptor?.enumerable
                || !rightDescriptor?.enumerable
                || !Object.hasOwn(leftDescriptor, 'value')
                || !Object.hasOwn(rightDescriptor, 'value')
                || !strictEqual(leftDescriptor.value, rightDescriptor.value)
            ) {
                return false;
            }
        }
        return true;
    }
    let leftKeys;
    let rightKeys;
    try {
        leftKeys = Reflect.ownKeys(left);
        rightKeys = Reflect.ownKeys(right);
    } catch {
        return false;
    }
    if (
        leftKeys.some(key => typeof key !== 'string')
        || rightKeys.some(key => typeof key !== 'string')
        || !sameArray(leftKeys.slice().sort(), rightKeys.slice().sort())
    ) {
        return false;
    }
    for (const key of leftKeys) {
        const leftDescriptor = Object.getOwnPropertyDescriptor(left, key);
        const rightDescriptor = Object.getOwnPropertyDescriptor(right, key);
        if (
            !leftDescriptor?.enumerable
            || !rightDescriptor?.enumerable
            || !Object.hasOwn(leftDescriptor, 'value')
            || !Object.hasOwn(rightDescriptor, 'value')
            || !strictEqual(leftDescriptor.value, rightDescriptor.value)
        ) {
            return false;
        }
    }
    return true;
}

function opaqueString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function codeUnitCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function dataInvalid(operation) {
    return storageError(STORAGE_ERROR_CODE.DATA_INVALID, operation);
}

function conflict() {
    return storageError(
        STORAGE_ERROR_CODE.CONFLICT,
        STORAGE_OPERATION.PUT_BUNDLE
    );
}

function schemaMismatch(operation) {
    return storageError(STORAGE_ERROR_CODE.SCHEMA_MISMATCH, operation);
}

function validatedBundleSnapshot(bundle) {
    let validation;
    try {
        validation = validateImportedActivityBundle(bundle);
    } catch {
        throw dataInvalid(STORAGE_OPERATION.PUT_BUNDLE);
    }
    if (validation.ok !== true) {
        throw dataInvalid(STORAGE_OPERATION.PUT_BUNDLE);
    }
    try {
        return cloneJsonSafe(bundle);
    } catch {
        throw dataInvalid(STORAGE_OPERATION.PUT_BUNDLE);
    }
}

function physicalRecords(bundle) {
    const activityId = bundle.activity.id;
    const deviceIds = bundle.devices
        .map(device => device.id)
        .sort(codeUnitCompare);
    if (
        deviceIds.some(id => !opaqueString(id))
        || new Set(deviceIds).size !== deviceIds.length
    ) {
        throw dataInvalid(STORAGE_OPERATION.PUT_BUNDLE);
    }
    return Object.freeze({
        activityId,
        activityEnvelope: {
            schemaVersion: bundle.schemaVersion,
            activity: bundle.activity,
            warnings: bundle.warnings,
            versionMetadata: bundle.versionMetadata,
            deviceIds
        },
        streams: bundle.streams.series.map(series => ({
            activityId,
            streamType: series.streamType,
            series
        })),
        laps: bundle.laps,
        events: bundle.events,
        sources: bundle.sources,
        devices: bundle.devices
    });
}

function allOwnDataValues(record) {
    try {
        return ownDataValues(record, Reflect.ownKeys(record));
    } catch {
        return null;
    }
}

function recordKey(record, field) {
    const values = allOwnDataValues(record);
    if (!values || !Object.hasOwn(values, field)) return null;
    return values[field];
}

function sameRecordSet(existing, candidate, keyField) {
    if (!Array.isArray(existing) || existing.length !== candidate.length) {
        return false;
    }
    const candidates = new Map();
    for (const record of candidate) {
        const key = recordKey(record, keyField);
        if (key === null || candidates.has(key)) return false;
        candidates.set(key, record);
    }
    for (const record of existing) {
        const key = recordKey(record, keyField);
        if (key === null || !candidates.has(key)) return false;
        if (!strictEqual(record, candidates.get(key))) return false;
    }
    return true;
}

function allPrimaryRecordsMatch(tokens, records, allowMissing) {
    return tokens.every((token, index) => {
        const existing = token.read();
        if (existing === undefined) return allowMissing;
        return strictEqual(existing, records[index]);
    });
}

function relationRange(keyRange, activityId, operation) {
    try {
        return keyRange.bound(
            [activityId, 0],
            [activityId, Number.MAX_VALUE]
        );
    } catch {
        throw storageError(STORAGE_ERROR_CODE.INVALID_REQUEST, operation);
    }
}

export function putCanonicalBundle(database, keyRange, bundle) {
    let records;
    try {
        records = physicalRecords(validatedBundleSnapshot(bundle));
    } catch (error) {
        return Promise.reject(error);
    }
    let indexedRelations;
    try {
        indexedRelations = relationRange(
            keyRange,
            records.activityId,
            STORAGE_OPERATION.PUT_BUNDLE
        );
    } catch (error) {
        return Promise.reject(error);
    }
    let result = null;
    return runTransaction(database, {
        storeNames: DATA_STORES,
        mode: 'readwrite',
        operation: STORAGE_OPERATION.PUT_BUNDLE
    }, context => {
        const activity = context.get(
            V2_STORE_NAME.ACTIVITIES,
            records.activityId
        );
        const sourcesForActivity = context.getAll(
            V2_STORE_NAME.ACTIVITY_SOURCES,
            'byActivityId',
            records.activityId
        );
        const streamsForActivity = context.getAll(
            V2_STORE_NAME.STREAM_SERIES,
            'byActivityId',
            records.activityId
        );
        const lapsForActivity = context.getAll(
            V2_STORE_NAME.LAPS,
            'byActivityIdAndIndex',
            indexedRelations
        );
        const eventsForActivity = context.getAll(
            V2_STORE_NAME.EVENTS,
            'byActivityIdAndIndex',
            indexedRelations
        );
        const sourceRecords = records.sources.map(record => (
            context.get(V2_STORE_NAME.ACTIVITY_SOURCES, record.id)
        ));
        const lapRecords = records.laps.map(record => (
            context.get(V2_STORE_NAME.LAPS, record.id)
        ));
        const eventRecords = records.events.map(record => (
            context.get(V2_STORE_NAME.EVENTS, record.id)
        ));
        const deviceRecords = records.devices.map(record => (
            context.get(V2_STORE_NAME.DEVICES, record.id)
        ));

        context.afterReads(() => {
            const existingActivity = activity.read();
            const relationSetsMatch = (
                sameRecordSet(
                    sourcesForActivity.read(),
                    records.sources,
                    'id'
                )
                && sameRecordSet(
                    streamsForActivity.read(),
                    records.streams,
                    'streamType'
                )
                && sameRecordSet(
                    lapsForActivity.read(),
                    records.laps,
                    'id'
                )
                && sameRecordSet(
                    eventsForActivity.read(),
                    records.events,
                    'id'
                )
            );

            if (existingActivity !== undefined) {
                if (
                    !strictEqual(existingActivity, records.activityEnvelope)
                    || !relationSetsMatch
                    || !allPrimaryRecordsMatch(
                        sourceRecords,
                        records.sources,
                        false
                    )
                    || !allPrimaryRecordsMatch(
                        lapRecords,
                        records.laps,
                        false
                    )
                    || !allPrimaryRecordsMatch(
                        eventRecords,
                        records.events,
                        false
                    )
                    || !allPrimaryRecordsMatch(
                        deviceRecords,
                        records.devices,
                        false
                    )
                ) {
                    throw conflict();
                }
                result = Object.freeze({
                    status: 'already-present',
                    activityId: records.activityId
                });
                return;
            }

            if (
                sourcesForActivity.read().length !== 0
                || streamsForActivity.read().length !== 0
                || lapsForActivity.read().length !== 0
                || eventsForActivity.read().length !== 0
                || !allPrimaryRecordsMatch(
                    sourceRecords,
                    records.sources,
                    true
                )
                || sourceRecords.some(token => token.read() !== undefined)
                || lapRecords.some(token => token.read() !== undefined)
                || eventRecords.some(token => token.read() !== undefined)
                || !allPrimaryRecordsMatch(
                    deviceRecords,
                    records.devices,
                    true
                )
            ) {
                throw conflict();
            }

            context.add(V2_STORE_NAME.ACTIVITIES, records.activityEnvelope);
            for (const record of records.sources) {
                context.add(V2_STORE_NAME.ACTIVITY_SOURCES, record);
            }
            for (const record of records.streams) {
                context.add(V2_STORE_NAME.STREAM_SERIES, record);
            }
            for (const record of records.laps) {
                context.add(V2_STORE_NAME.LAPS, record);
            }
            for (const record of records.events) {
                context.add(V2_STORE_NAME.EVENTS, record);
            }
            records.devices.forEach((record, index) => {
                if (deviceRecords[index].read() === undefined) {
                    context.add(V2_STORE_NAME.DEVICES, record);
                }
            });
            result = Object.freeze({
                status: 'committed',
                activityId: records.activityId
            });
        });
        return () => result;
    });
}

function normalizeGetOptions(options) {
    if (options === undefined) return Object.freeze([]);
    const values = ownDataValues(options, GET_OPTION_FIELDS, true);
    if (!values) return null;
    if (!Object.hasOwn(values, 'streamTypes')) return Object.freeze([]);
    let streamTypes;
    try {
        streamTypes = cloneJsonSafe(values.streamTypes);
    } catch {
        return null;
    }
    if (
        !Array.isArray(streamTypes)
        || streamTypes.some(type => !opaqueString(type))
        || new Set(streamTypes).size !== streamTypes.length
    ) {
        return null;
    }
    return Object.freeze(streamTypes);
}

function assertEnvelope(envelope, activityId, operation) {
    const values = ownDataValues(envelope, ACTIVITY_ENVELOPE_FIELDS);
    let deviceIds;
    try {
        deviceIds = cloneJsonSafe(values?.deviceIds);
    } catch {
        throw schemaMismatch(operation);
    }
    if (
        !values
        || values.schemaVersion !== V2_CANONICAL_SCHEMA_VERSION
        || !values.activity
        || values.activity.id !== activityId
        || values.activity.schemaVersion !== values.schemaVersion
        || !values.versionMetadata
        || values.versionMetadata.schemaVersion !== values.schemaVersion
        || !Array.isArray(deviceIds)
        || deviceIds.some(id => !opaqueString(id))
        || new Set(deviceIds).size !== deviceIds.length
        || !sameArray(deviceIds, deviceIds.slice().sort(codeUnitCompare))
    ) {
        throw schemaMismatch(operation);
    }
    values.deviceIds = deviceIds;
    return values;
}

function streamSeries(record, activityId, operation) {
    const values = ownDataValues(record, STREAM_RECORD_FIELDS);
    if (
        !values
        || values.activityId !== activityId
        || !opaqueString(values.streamType)
        || !values.series
        || values.series.streamType !== values.streamType
    ) {
        throw schemaMismatch(operation);
    }
    return values.series;
}

function numericIndex(record, operation) {
    const values = allOwnDataValues(record);
    if (!values || !Number.isInteger(values.index) || values.index < 0) {
        throw schemaMismatch(operation);
    }
    return values.index;
}

function opaqueId(record, operation) {
    const values = allOwnDataValues(record);
    if (!values || !opaqueString(values.id)) throw schemaMismatch(operation);
    return values.id;
}

function sortedRecords(records, selector, operation) {
    const result = records.slice();
    result.sort((left, right) => {
        const leftValue = selector(left, operation);
        const rightValue = selector(right, operation);
        return typeof leftValue === 'number'
            ? leftValue - rightValue
            : codeUnitCompare(leftValue, rightValue);
    });
    return result;
}

function finalizedBundle(bundle, operation) {
    let snapshot;
    try {
        snapshot = cloneJsonSafe(bundle);
    } catch {
        throw schemaMismatch(operation);
    }
    let validation;
    try {
        validation = validateImportedActivityBundle(snapshot);
    } catch {
        throw schemaMismatch(operation);
    }
    if (validation.ok !== true) throw schemaMismatch(operation);
    return deepFreeze(snapshot);
}

export function getCanonicalBundle(database, keyRange, activityId, options) {
    if (!opaqueString(activityId)) {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.GET_BUNDLE
        ));
    }
    const streamTypes = normalizeGetOptions(options);
    if (streamTypes === null) {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.GET_BUNDLE
        ));
    }
    let indexedRelations;
    try {
        indexedRelations = relationRange(
            keyRange,
            activityId,
            STORAGE_OPERATION.GET_BUNDLE
        );
    } catch (error) {
        return Promise.reject(error);
    }
    let deviceTokens = [];
    return runTransaction(database, {
        storeNames: DATA_STORES,
        mode: 'readonly',
        operation: STORAGE_OPERATION.GET_BUNDLE
    }, context => {
        const activity = context.get(V2_STORE_NAME.ACTIVITIES, activityId);
        const sources = context.getAll(
            V2_STORE_NAME.ACTIVITY_SOURCES,
            'byActivityId',
            activityId
        );
        const laps = context.getAll(
            V2_STORE_NAME.LAPS,
            'byActivityIdAndIndex',
            indexedRelations
        );
        const events = context.getAll(
            V2_STORE_NAME.EVENTS,
            'byActivityIdAndIndex',
            indexedRelations
        );
        const allStreams = streamTypes.length === 0
            ? context.getAll(
                V2_STORE_NAME.STREAM_SERIES,
                'byActivityId',
                activityId
            )
            : null;
        const selectedStreams = streamTypes.map(streamType => (
            context.get(V2_STORE_NAME.STREAM_SERIES, [activityId, streamType])
        ));

        context.afterReads(() => {
            const envelope = activity.read();
            if (envelope === undefined) return;
            const stored = assertEnvelope(
                envelope,
                activityId,
                STORAGE_OPERATION.GET_BUNDLE
            );
            deviceTokens = stored.deviceIds
                .map(id => context.get(V2_STORE_NAME.DEVICES, id));
        });

        return () => {
            const envelope = activity.read();
            const sourceRecords = sources.read();
            const lapRecords = laps.read();
            const eventRecords = events.read();
            const streamRecords = allStreams
                ? allStreams.read()
                : selectedStreams
                    .map(token => token.read())
                    .filter(record => record !== undefined);
            if (envelope === undefined) {
                if (
                    sourceRecords.length !== 0
                    || lapRecords.length !== 0
                    || eventRecords.length !== 0
                    || streamRecords.length !== 0
                ) {
                    throw schemaMismatch(STORAGE_OPERATION.GET_BUNDLE);
                }
                return null;
            }
            const stored = assertEnvelope(
                envelope,
                activityId,
                STORAGE_OPERATION.GET_BUNDLE
            );
            const devices = deviceTokens.map(token => token.read());
            if (devices.some(device => device === undefined)) {
                throw schemaMismatch(STORAGE_OPERATION.GET_BUNDLE);
            }
            const bundle = {
                schemaVersion: stored.schemaVersion,
                activity: stored.activity,
                streams: {
                    activityId,
                    series: streamRecords
                        .map(record => streamSeries(
                            record,
                            activityId,
                            STORAGE_OPERATION.GET_BUNDLE
                        ))
                        .sort((left, right) => (
                            codeUnitCompare(left.streamType, right.streamType)
                        ))
                },
                laps: sortedRecords(
                    lapRecords,
                    numericIndex,
                    STORAGE_OPERATION.GET_BUNDLE
                ),
                events: sortedRecords(
                    eventRecords,
                    numericIndex,
                    STORAGE_OPERATION.GET_BUNDLE
                ),
                sources: sortedRecords(
                    sourceRecords,
                    opaqueId,
                    STORAGE_OPERATION.GET_BUNDLE
                ),
                devices: sortedRecords(
                    devices,
                    opaqueId,
                    STORAGE_OPERATION.GET_BUNDLE
                ),
                warnings: stored.warnings,
                versionMetadata: stored.versionMetadata
            };
            return finalizedBundle(bundle, STORAGE_OPERATION.GET_BUNDLE);
        };
    });
}

function normalizeListOptions(options) {
    if (options === undefined) {
        return Object.freeze({
            sportCategory: null,
            limit: 100,
            direction: 'desc'
        });
    }
    const values = ownDataValues(options, LIST_OPTION_FIELDS, true);
    if (!values) return null;
    const hasSportCategory = Object.hasOwn(values, 'sportCategory');
    const sportCategory = hasSportCategory ? values.sportCategory : null;
    const limit = Object.hasOwn(values, 'limit') ? values.limit : 100;
    const direction = Object.hasOwn(values, 'direction')
        ? values.direction
        : 'desc';
    if (
        (hasSportCategory && !SPORT_CATEGORIES.includes(sportCategory))
        || !Number.isSafeInteger(limit)
        || limit < 1
        || limit > 500
        || (direction !== 'asc' && direction !== 'desc')
    ) {
        return null;
    }
    return Object.freeze({ sportCategory, limit, direction });
}

function listActivity(envelope) {
    const values = ownDataValues(envelope, ACTIVITY_ENVELOPE_FIELDS);
    let deviceIds;
    try {
        deviceIds = cloneJsonSafe(values?.deviceIds);
    } catch {
        throw schemaMismatch(STORAGE_OPERATION.LIST_ACTIVITIES);
    }
    if (
        !values
        || values.schemaVersion !== V2_CANONICAL_SCHEMA_VERSION
        || values.activity?.schemaVersion !== values.schemaVersion
        || values.versionMetadata?.schemaVersion !== values.schemaVersion
        || !Array.isArray(deviceIds)
        || deviceIds.some(id => !opaqueString(id))
        || new Set(deviceIds).size !== deviceIds.length
        || !sameArray(deviceIds, deviceIds.slice().sort(codeUnitCompare))
        || validateCanonicalActivity(values.activity).ok !== true
    ) {
        throw schemaMismatch(STORAGE_OPERATION.LIST_ACTIVITIES);
    }
    return cloneJsonSafe(values.activity);
}

export function listCanonicalActivities(database, keyRange, options) {
    const normalized = normalizeListOptions(options);
    if (!normalized) {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.LIST_ACTIVITIES
        ));
    }
    let query;
    let indexName;
    try {
        if (normalized.sportCategory === null) {
            indexName = 'byStartTimeUtc';
            query = undefined;
        } else {
            indexName = 'bySportCategoryAndStartTimeUtc';
            query = keyRange.bound(
                [normalized.sportCategory, ''],
                [normalized.sportCategory, '\uffff']
            );
        }
    } catch {
        return Promise.reject(storageError(
            STORAGE_ERROR_CODE.INVALID_REQUEST,
            STORAGE_OPERATION.LIST_ACTIVITIES
        ));
    }
    return runTransaction(database, {
        storeNames: [V2_STORE_NAME.ACTIVITIES],
        mode: 'readonly',
        operation: STORAGE_OPERATION.LIST_ACTIVITIES
    }, context => {
        const records = context.getAll(
            V2_STORE_NAME.ACTIVITIES,
            indexName,
            query
        );
        return () => {
            const activities = records.read().map(listActivity);
            activities.sort((left, right) => {
                const time = codeUnitCompare(
                    left.startTimeUtc,
                    right.startTimeUtc
                );
                const id = codeUnitCompare(left.id, right.id);
                const order = time === 0 ? id : time;
                return normalized.direction === 'asc' ? order : -order;
            });
            return deepFreeze(activities.slice(0, normalized.limit));
        };
    });
}
