import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    RepositoryError
} from '../errors.js';
import { projectLegacyValue } from '../legacy/legacy-projection.js';

const PROVIDER_KEYS = new Set([
    'getActivities',
    'getAthlete',
    'getZones',
    'getGears'
]);
const CONSTRUCTOR_KEYS = new Set(['provider']);
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

function repositoryError(code, operation) {
    return new RepositoryError(code, { operation });
}

function invalidRequest(operation) {
    return repositoryError(
        REPOSITORY_ERROR_CODE.INVALID_REQUEST,
        operation
    );
}

function readRecord(value, allowedKeys) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (keys.some(key => (
            typeof key !== 'string'
            || !allowedKeys.has(key)
        ))) {
            return null;
        }

        const result = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function normalizeProvider(provider) {
    const values = readRecord(provider, PROVIDER_KEYS);
    if (
        values === null
        || [...PROVIDER_KEYS].some(key => typeof values[key] !== 'function')
    ) {
        throw invalidRequest(null);
    }
    return values;
}

function normalizeListOptions(options, operation) {
    const values = readRecord(options, LIST_OPTION_KEYS);
    if (values === null) throw invalidRequest(operation);
    const refresh = values.refresh ?? false;
    if (typeof refresh !== 'boolean') throw invalidRequest(operation);
    return { refresh };
}

function normalizeId(value, operation) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    if (Number.isSafeInteger(value) && value >= 0) return String(value);
    throw invalidRequest(operation);
}

function normalizeStreamOptions(options, operation) {
    const values = readRecord(options, STREAM_OPTION_KEYS);
    if (
        values === null
        || !Object.hasOwn(values, 'types')
        || !Array.isArray(values.types)
        || values.types.length === 0
    ) {
        throw invalidRequest(operation);
    }

    let types;
    try {
        types = projectLegacyValue(values.types, operation);
    } catch {
        throw invalidRequest(operation);
    }
    if (
        types.some(type => (
            typeof type !== 'string'
            || type.trim().length === 0
            || !STREAM_TYPES.has(type)
        ))
        || new Set(types).size !== types.length
    ) {
        throw invalidRequest(operation);
    }
    return { types };
}

function result(data, operation) {
    return {
        data: projectLegacyValue(data, operation),
        source: REPOSITORY_SOURCE.DEMO,
        warnings: [],
        partial: false
    };
}

function itemId(item) {
    try {
        if (
            item === null
            || typeof item !== 'object'
            || Array.isArray(item)
            || Object.getPrototypeOf(item) !== Object.prototype
        ) {
            return null;
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, 'id');
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
        ) {
            return null;
        }
        if (
            typeof descriptor.value === 'string'
            && descriptor.value.trim().length > 0
        ) {
            return descriptor.value;
        }
        if (
            Number.isSafeInteger(descriptor.value)
            && descriptor.value >= 0
        ) {
            return String(descriptor.value);
        }
        return null;
    } catch {
        return null;
    }
}

function projectOrFallback(value, operation, fallback, shape) {
    try {
        const projected = projectLegacyValue(value, operation);
        if (shape === 'array' && Array.isArray(projected)) return projected;
        if (
            shape === 'nullable-object'
            && (
                projected === null
                || (
                    typeof projected === 'object'
                    && !Array.isArray(projected)
                )
            )
        ) {
            return projected;
        }
        return fallback;
    } catch {
        return fallback;
    }
}

export class DemoRepository {
    #provider;

    constructor(options) {
        const values = readRecord(options, CONSTRUCTOR_KEYS);
        if (values === null || !Object.hasOwn(values, 'provider')) {
            throw invalidRequest(null);
        }
        this.#provider = normalizeProvider(values.provider);
    }

    async listActivities(options = {}) {
        const operation = 'listActivities';
        normalizeListOptions(options, operation);
        return result(this.#activities(), operation);
    }

    async getActivity(activityId) {
        const operation = 'getActivity';
        const id = normalizeId(activityId, operation);
        const activity = this.#activities().find(item => itemId(item) === id);
        if (!activity) {
            throw repositoryError(
                REPOSITORY_ERROR_CODE.NOT_FOUND,
                operation
            );
        }
        return result(activity, operation);
    }

    async getStreams(activityId, options) {
        const operation = 'getStreams';
        const id = normalizeId(activityId, operation);
        const { types } = normalizeStreamOptions(options, operation);
        const activity = this.#activities().find(item => itemId(item) === id);
        if (!activity) {
            throw repositoryError(
                REPOSITORY_ERROR_CODE.NOT_FOUND,
                operation
            );
        }

        let streams = {};
        const descriptor = Object.getOwnPropertyDescriptor(activity, 'streams');
        if (
            descriptor?.enumerable
            && Object.hasOwn(descriptor, 'value')
            && descriptor.value
            && typeof descriptor.value === 'object'
            && !Array.isArray(descriptor.value)
        ) {
            streams = {};
            for (const type of types) {
                const streamDescriptor = Object.getOwnPropertyDescriptor(
                    descriptor.value,
                    type
                );
                if (
                    streamDescriptor?.enumerable
                    && Object.hasOwn(streamDescriptor, 'value')
                ) {
                    Object.defineProperty(streams, type, {
                        value: streamDescriptor.value,
                        enumerable: true,
                        configurable: true,
                        writable: true
                    });
                }
            }
        }
        return result(streams, operation);
    }

    async getAthlete() {
        const operation = 'getAthlete';
        return result(
            this.#read(
                'getAthlete',
                null,
                'nullable-object',
                operation
            ),
            operation
        );
    }

    async getZones() {
        const operation = 'getZones';
        return result(
            this.#read(
                'getZones',
                null,
                'nullable-object',
                operation
            ),
            operation
        );
    }

    async getGears() {
        const operation = 'getGears';
        return result(
            this.#read('getGears', [], 'array', operation),
            operation
        );
    }

    async getGear(gearId) {
        const operation = 'getGear';
        const id = normalizeId(gearId, operation);
        const gear = this.#read(
            'getGears',
            [],
            'array',
            operation
        ).find(item => itemId(item) === id);
        if (!gear) {
            throw repositoryError(
                REPOSITORY_ERROR_CODE.NOT_FOUND,
                operation
            );
        }
        return result(gear, operation);
    }

    #activities() {
        return this.#read(
            'getActivities',
            [],
            'array',
            'listActivities'
        );
    }

    #read(method, fallback, shape, operation) {
        let value;
        try {
            value = this.#provider[method]();
        } catch {
            return fallback;
        }
        return projectOrFallback(value, operation, fallback, shape);
    }
}
