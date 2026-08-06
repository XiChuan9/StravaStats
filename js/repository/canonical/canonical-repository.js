import { STORAGE_ERROR_CODE } from '../../storage/index.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    RepositoryError
} from '../errors.js';
import {
    canonicalStreamTypesForLegacy,
    projectCanonicalDetailActivity,
    projectCanonicalDetailStreams
} from './detail-projection.js';
import { projectCanonicalSummaryActivities } from './summary-projection.js';

const CONSTRUCTOR_KEYS = new Set(['storeFactory']);
const LIST_OPTION_KEYS = new Set(['refresh']);
const STREAM_OPTION_KEYS = new Set(['types']);
const STREAM_TYPES = new Set([
    'time',
    'distance',
    'latlng',
    'altitude',
    'velocity_smooth',
    'heartrate',
    'cadence',
    'watts',
    'temp',
    'moving',
    'grade_smooth'
]);
const PAGE_LIMIT = 500;

function repositoryError(code, operation) {
    return new RepositoryError(code, {
        operation,
        retryable: false
    });
}

function readRecord(value, allowedKeys = null) {
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
        if (keys.some(key => (
            typeof key !== 'string'
            || (allowedKeys !== null && !allowedKeys.has(key))
        ))) {
            return null;
        }
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

function findMethod(value, name) {
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

function normalizeListOptions(options, operation) {
    const values = readRecord(options, LIST_OPTION_KEYS);
    if (values === null) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
    }
    const refresh = Object.hasOwn(values, 'refresh') ? values.refresh : false;
    if (typeof refresh !== 'boolean') {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
    }
}

function normalizeId(value, operation) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
}

function normalizeStreamOptions(options, operation) {
    const values = readRecord(options, STREAM_OPTION_KEYS);
    if (values === null || !Object.hasOwn(values, 'types')) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
    }
    try {
        if (
            !Array.isArray(values.types)
            || Object.getPrototypeOf(values.types) !== Array.prototype
            || Reflect.ownKeys(values.types).length !== values.types.length + 1
            || values.types.length === 0
        ) {
            throw new TypeError('invalid types');
        }
        const result = [];
        for (let index = 0; index < values.types.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(
                values.types,
                String(index)
            );
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
                || !STREAM_TYPES.has(descriptor.value)
            ) {
                throw new TypeError('invalid type');
            }
            result.push(descriptor.value);
        }
        if (new Set(result).size !== result.length) {
            throw new TypeError('duplicate type');
        }
        return Object.freeze(result);
    } catch {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
    }
}

function canonicalEnvelope(data) {
    return Object.freeze({
        data,
        source: REPOSITORY_SOURCE.CANONICAL,
        warnings: Object.freeze([]),
        partial: false
    });
}

function storageCode(error) {
    try {
        return typeof error?.code === 'string' ? error.code : null;
    } catch {
        return null;
    }
}

function mapReadFailure(error, operation) {
    if (storageCode(error) === STORAGE_ERROR_CODE.INVALID_REQUEST) {
        return repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
    }
    return repositoryError(REPOSITORY_ERROR_CODE.RESPONSE_INVALID, operation);
}

function normalizePage(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
            || Reflect.ownKeys(value).length !== value.length + 1
        ) {
            return null;
        }
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

function pageTuple(value) {
    const record = readRecord(value);
    if (
        record === null
        || typeof record.id !== 'string'
        || record.id.trim().length === 0
        || typeof record.startTimeUtc !== 'string'
    ) {
        return null;
    }
    return Object.freeze({
        startTimeUtc: record.startTimeUtc,
        id: record.id
    });
}

function compareTuple(left, right) {
    if (left.startTimeUtc !== right.startTimeUtc) {
        return left.startTimeUtc < right.startTimeUtc ? -1 : 1;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
}

export class CanonicalRepository {
    #storeFactory;
    #store = null;
    #pendingBundles = new Map();

    constructor(options) {
        const values = readRecord(options, CONSTRUCTOR_KEYS);
        if (
            values === null
            || !Object.hasOwn(values, 'storeFactory')
            || typeof values.storeFactory !== 'function'
        ) {
            throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, null);
        }
        this.#storeFactory = values.storeFactory;
    }

    async listActivities(options = {}) {
        const operation = 'listActivities';
        normalizeListOptions(options, operation);
        try {
            const store = this.#storeBoundary();
            await store.initialize();
            const canonical = [];
            let cursor;
            while (true) {
                const pageOptions = {
                    limit: PAGE_LIMIT,
                    direction: 'desc'
                };
                if (cursor !== undefined) pageOptions.cursor = cursor;
                const page = normalizePage(
                    await store.listActivities(pageOptions)
                );
                if (page === null) throw new TypeError('invalid canonical page');
                let previous = cursor;
                for (const activity of page) {
                    const tuple = pageTuple(activity);
                    if (
                        tuple === null
                        || (
                            previous !== undefined
                            && compareTuple(tuple, previous) >= 0
                        )
                    ) {
                        throw new TypeError('invalid canonical order');
                    }
                    previous = tuple;
                }
                canonical.push(...page);
                if (page.length < PAGE_LIMIT) break;
                cursor = previous;
            }
            return canonicalEnvelope(
                projectCanonicalSummaryActivities(canonical)
            );
        } catch (error) {
            if (error instanceof RepositoryError) throw error;
            throw mapReadFailure(error, operation);
        }
    }

    async getActivity(activityId) {
        const operation = 'getActivity';
        const id = normalizeId(activityId, operation);
        try {
            const bundle = await this.#loadBundle(id, null);
            if (bundle === null) {
                throw repositoryError(REPOSITORY_ERROR_CODE.NOT_FOUND, operation);
            }
            return canonicalEnvelope(projectCanonicalDetailActivity(bundle));
        } catch (error) {
            if (error instanceof RepositoryError) throw error;
            throw mapReadFailure(error, operation);
        }
    }

    async getStreams(activityId, options) {
        const operation = 'getStreams';
        const id = normalizeId(activityId, operation);
        const requestedTypes = normalizeStreamOptions(options, operation);
        let canonicalTypes;
        try {
            canonicalTypes = canonicalStreamTypesForLegacy(requestedTypes);
        } catch {
            throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST, operation);
        }
        try {
            const bundle = await this.#loadBundle(id, canonicalTypes);
            if (bundle === null) {
                throw repositoryError(REPOSITORY_ERROR_CODE.NOT_FOUND, operation);
            }
            return canonicalEnvelope(
                projectCanonicalDetailStreams(bundle, requestedTypes)
            );
        } catch (error) {
            if (error instanceof RepositoryError) throw error;
            throw mapReadFailure(error, operation);
        }
    }

    async getAthlete() {
        return canonicalEnvelope(null);
    }

    async getZones() {
        return canonicalEnvelope(null);
    }

    async getGears() {
        return canonicalEnvelope(Object.freeze([]));
    }

    async getGear(gearId) {
        if (typeof gearId !== 'string' || gearId.trim().length === 0) {
            throw repositoryError(
                REPOSITORY_ERROR_CODE.INVALID_REQUEST,
                'getGear'
            );
        }
        return canonicalEnvelope(null);
    }

    #storeBoundary(methodNames = ['initialize', 'listActivities']) {
        if (this.#store === null) this.#store = this.#storeFactory();
        const boundary = {};
        for (const name of methodNames) {
            const method = findMethod(this.#store, name);
            if (method === null) throw new TypeError('invalid canonical store');
            boundary[name] = (...args) => method.apply(this.#store, args);
        }
        return Object.freeze(boundary);
    }

    #loadBundle(activityId, streamTypes) {
        const current = this.#pendingBundles.get(activityId);
        if (current !== undefined) {
            if (streamTypes === null) return current.promise;
            const canJoin = !current.started
                || !current.hasStreamRequest
                || streamTypes.every(type => current.streamTypes.has(type));
            if (canJoin) {
                if (!current.started) {
                    current.hasStreamRequest = true;
                    for (const type of streamTypes) current.streamTypes.add(type);
                }
                return current.promise;
            }
        }

        const pending = {
            started: false,
            hasStreamRequest: streamTypes !== null,
            streamTypes: new Set(streamTypes ?? []),
            promise: null
        };
        pending.promise = Promise.resolve().then(async () => {
            pending.started = true;
            const store = this.#storeBoundary(['initialize', 'getBundle']);
            await store.initialize();
            const selectedTypes = [...pending.streamTypes];
            return pending.hasStreamRequest && selectedTypes.length > 0
                ? store.getBundle(activityId, { streamTypes: selectedTypes })
                : store.getBundle(activityId);
        }).finally(() => {
            if (this.#pendingBundles.get(activityId) === pending) {
                this.#pendingBundles.delete(activityId);
            }
        });
        this.#pendingBundles.set(activityId, pending);
        return pending.promise;
    }
}
