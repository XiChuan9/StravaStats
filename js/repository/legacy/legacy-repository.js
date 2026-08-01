import {
    STRAVA_CONNECTOR_ERROR_CODE,
    StravaConnectorError
} from '../../connectors/strava/strava-api-connector.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE,
    RepositoryError
} from '../errors.js';
import { projectLegacyValue } from './legacy-projection.js';

export const LEGACY_ACTIVITY_CACHE_VERSION =
    'v2-efficiency-moving-ratio';
export const LEGACY_ACTIVITY_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

const OPERATIONS = new Set([
    'listActivities',
    'getActivity',
    'getStreams',
    'getAthlete',
    'getZones',
    'getGears',
    'getGear'
]);
const CONSTRUCTOR_KEYS = new Set([
    'connector',
    'activityCache',
    'metadataCache',
    'now',
    'cacheVersion',
    'activityMaxAgeMs',
    'metadataTtlMs'
]);
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
const WARNING_ORDER = new Map([
    [REPOSITORY_WARNING_CODE.CACHE_READ_FAILED, 0],
    [REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED, 1],
    [REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED, 2]
]);
const CONNECTOR_ERROR_MAP = new Map([
    [
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ABSENT,
        REPOSITORY_ERROR_CODE.UNAUTHENTICATED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
        REPOSITORY_ERROR_CODE.TOKEN_INVALID
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_READ_FAILED,
        REPOSITORY_ERROR_CODE.TOKEN_READ_FAILED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED,
        REPOSITORY_ERROR_CODE.TOKEN_ENCODING_FAILED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_WRITE_FAILED,
        REPOSITORY_ERROR_CODE.TOKEN_WRITE_FAILED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
        REPOSITORY_ERROR_CODE.NETWORK_UNAVAILABLE
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_UNAUTHENTICATED,
        REPOSITORY_ERROR_CODE.UNAUTHENTICATED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_FORBIDDEN,
        REPOSITORY_ERROR_CODE.FORBIDDEN
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_NOT_FOUND,
        REPOSITORY_ERROR_CODE.NOT_FOUND
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        REPOSITORY_ERROR_CODE.RATE_LIMITED
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_SERVER_ERROR,
        REPOSITORY_ERROR_CODE.PROVIDER_HTTP_ERROR
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_JSON,
        REPOSITORY_ERROR_CODE.RESPONSE_INVALID
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
        REPOSITORY_ERROR_CODE.RESPONSE_INVALID
    ],
    [
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
        REPOSITORY_ERROR_CODE.INVALID_REQUEST
    ]
]);

function repositoryError(code, operation, details = {}) {
    return new RepositoryError(code, {
        operation,
        retryable: details.retryable ?? false,
        httpStatus: details.httpStatus ?? null,
        retryAfterSeconds: details.retryAfterSeconds ?? null
    });
}

function invalidRequest(operation) {
    return repositoryError(
        REPOSITORY_ERROR_CODE.INVALID_REQUEST,
        operation
    );
}

function responseInvalid(operation) {
    return repositoryError(
        REPOSITORY_ERROR_CODE.RESPONSE_INVALID,
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

function normalizeConstructorOptions(options) {
    const values = readRecord(options, CONSTRUCTOR_KEYS);
    if (values === null) throw invalidRequest(null);

    const requiredFunctions = [
        'fetchActivities',
        'fetchActivity',
        'fetchStreams',
        'fetchAthlete',
        'fetchZones',
        'fetchGear'
    ];
    try {
        if (
            !values.connector
            || requiredFunctions.some(name => (
                typeof values.connector[name] !== 'function'
            ))
            || !values.activityCache
            || typeof values.activityCache.getCachedActivities !== 'function'
            || typeof values.activityCache.saveCachedActivities !== 'function'
            || !values.metadataCache
            || [
                'readAthlete',
                'writeAthlete',
                'readZones',
                'writeZones',
                'readGears',
                'writeGears',
                'readGear',
                'writeGear'
            ].some(name => typeof values.metadataCache[name] !== 'function')
        ) {
            throw invalidRequest(null);
        }
    } catch (error) {
        if (error instanceof RepositoryError) throw error;
        throw invalidRequest(null);
    }

    const normalized = {
        connector: values.connector,
        activityCache: values.activityCache,
        metadataCache: values.metadataCache,
        now: values.now ?? (() => Date.now()),
        cacheVersion: values.cacheVersion
            ?? LEGACY_ACTIVITY_CACHE_VERSION,
        activityMaxAgeMs: values.activityMaxAgeMs
            ?? LEGACY_ACTIVITY_CACHE_MAX_AGE_MS,
        metadataTtlMs: values.metadataTtlMs
            ?? (24 * 60 * 60 * 1000)
    };
    if (
        typeof normalized.now !== 'function'
        || typeof normalized.cacheVersion !== 'string'
        || normalized.cacheVersion.length === 0
        || !Number.isFinite(normalized.activityMaxAgeMs)
        || normalized.activityMaxAgeMs < 0
        || !Number.isFinite(normalized.metadataTtlMs)
        || normalized.metadataTtlMs < 0
    ) {
        throw invalidRequest(null);
    }
    return normalized;
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

    let projected;
    try {
        projected = projectLegacyValue(values.types, operation);
    } catch {
        throw invalidRequest(operation);
    }
    if (
        projected.some(type => (
            typeof type !== 'string'
            || type.trim().length === 0
            || !STREAM_TYPES.has(type)
        ))
        || new Set(projected).size !== projected.length
    ) {
        throw invalidRequest(operation);
    }
    return { types: projected };
}

function warning(code, operation, {
    retryable = false,
    itemIndex
} = {}) {
    const value = {
        code,
        operation,
        retryable: Boolean(retryable)
    };
    if (code === REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED) {
        value.itemIndex = itemIndex;
    }
    return value;
}

function normalizeWarnings(values) {
    const unique = new Map();
    for (const value of values) {
        const key = [
            value.code,
            value.operation,
            value.retryable,
            Object.hasOwn(value, 'itemIndex') ? value.itemIndex : ''
        ].join('|');
        if (!unique.has(key)) unique.set(key, value);
    }

    return [...unique.values()].sort((left, right) => {
        const leftHasIndex = Object.hasOwn(left, 'itemIndex');
        const rightHasIndex = Object.hasOwn(right, 'itemIndex');
        if (leftHasIndex && rightHasIndex) {
            return left.itemIndex - right.itemIndex;
        }
        if (leftHasIndex !== rightHasIndex) return leftHasIndex ? 1 : -1;
        return (
            (WARNING_ORDER.get(left.code) ?? 99)
            - (WARNING_ORDER.get(right.code) ?? 99)
        );
    }).map(value => ({ ...value }));
}

function result(data, source, warnings, partial, operation) {
    return {
        data: projectLegacyValue(data, operation),
        source,
        warnings: normalizeWarnings(warnings),
        partial: Boolean(partial)
    };
}

function reframeWarnings(warnings, operation) {
    return warnings.map(value => warning(
        value.code,
        operation,
        {
            retryable: value.retryable,
            itemIndex: value.itemIndex
        }
    ));
}

function requireShape(data, operation, shape) {
    const valid = (
        (shape === 'array' && Array.isArray(data))
        || (
            shape === 'object'
            && data !== null
            && typeof data === 'object'
            && !Array.isArray(data)
        )
        || (
            shape === 'nullable-object'
            && (
                data === null
                || (
                    typeof data === 'object'
                    && !Array.isArray(data)
                )
            )
        )
    );
    if (!valid) throw responseInvalid(operation);
    return data;
}

function inspectCacheResult(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return { status: 'failed' };
        }
        const statusDescriptor = Object.getOwnPropertyDescriptor(
            value,
            'status'
        );
        if (
            !statusDescriptor?.enumerable
            || !Object.hasOwn(statusDescriptor, 'value')
            || !['hit', 'miss', 'failed', 'written'].includes(
                statusDescriptor.value
            )
        ) {
            return { status: 'failed' };
        }
        const resultValue = { status: statusDescriptor.value };
        for (const key of ['data', 'expiresAt']) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (descriptor) {
                if (
                    !descriptor.enumerable
                    || !Object.hasOwn(descriptor, 'value')
                ) {
                    return { status: 'failed' };
                }
                resultValue[key] = descriptor.value;
            }
        }
        return resultValue;
    } catch {
        return { status: 'failed' };
    }
}

function inspectActivityEntry(entry) {
    if (entry === null) return { status: 'miss' };
    try {
        if (
            entry === null
            || typeof entry !== 'object'
            || Array.isArray(entry)
            || Object.getPrototypeOf(entry) !== Object.prototype
        ) {
            return { status: 'failed' };
        }
        const descriptor = Object.getOwnPropertyDescriptor(
            entry,
            'activities'
        );
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
            || !Array.isArray(descriptor.value)
        ) {
            return { status: 'failed' };
        }
        return { status: 'hit', data: descriptor.value };
    } catch {
        return { status: 'failed' };
    }
}

function mapConnectorError(error, operation) {
    if (
        !(error instanceof StravaConnectorError)
        || !Object.isFrozen(error)
        || error.operation !== operation
        || !CONNECTOR_ERROR_MAP.has(error.code)
    ) {
        return responseInvalid(operation);
    }
    return repositoryError(
        CONNECTOR_ERROR_MAP.get(error.code),
        operation,
        {
            retryable: error.retryable,
            httpStatus: error.httpStatus,
            retryAfterSeconds: error.retryAfterSeconds
        }
    );
}

function combineSources(sources, fallback) {
    const values = new Set(sources.filter(Boolean));
    if (values.has(REPOSITORY_SOURCE.MIXED) || values.size > 1) {
        return REPOSITORY_SOURCE.MIXED;
    }
    return values.values().next().value ?? fallback;
}

function readFiniteNow(nowProvider, operation) {
    let now;
    try {
        now = nowProvider();
    } catch {
        throw responseInvalid(operation);
    }
    if (!Number.isFinite(now)) throw responseInvalid(operation);
    return now;
}

function createExpiryWindow(nowProvider, ttlMs, operation) {
    const now = readFiniteNow(nowProvider, operation);
    const maxExpiresAt = now + ttlMs;
    if (!Number.isFinite(maxExpiresAt)) {
        throw responseInvalid(operation);
    }
    return { now, maxExpiresAt };
}

function extractGearItems(athlete, operation) {
    if (athlete === null) return [];
    if (
        typeof athlete !== 'object'
        || Array.isArray(athlete)
    ) {
        throw responseInvalid(operation);
    }

    const groups = [];
    for (const key of ['shoes', 'bikes']) {
        const descriptor = Object.getOwnPropertyDescriptor(athlete, key);
        if (!descriptor) {
            groups.push([]);
            continue;
        }
        if (
            !descriptor.enumerable
            || !Object.hasOwn(descriptor, 'value')
            || !Array.isArray(descriptor.value)
        ) {
            throw responseInvalid(operation);
        }
        groups.push(descriptor.value);
    }
    return [...groups[0], ...groups[1]];
}

function gearItemId(item) {
    if (typeof item === 'string' && item.trim().length > 0) return item;
    if (Number.isSafeInteger(item) && item >= 0) return String(item);
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
        const id = descriptor.value;
        if (typeof id === 'string' && id.trim().length > 0) return id;
        if (Number.isSafeInteger(id) && id >= 0) return String(id);
        return null;
    } catch {
        return null;
    }
}

export class LegacyRepository {
    #connector;
    #activityCache;
    #metadataCache;
    #now;
    #cacheVersion;
    #activityMaxAgeMs;
    #metadataTtlMs;
    #athleteSnapshot = null;
    #athleteInFlight = null;

    constructor(options) {
        const normalized = normalizeConstructorOptions(options);
        this.#connector = normalized.connector;
        this.#activityCache = normalized.activityCache;
        this.#metadataCache = normalized.metadataCache;
        this.#now = normalized.now;
        this.#cacheVersion = normalized.cacheVersion;
        this.#activityMaxAgeMs = normalized.activityMaxAgeMs;
        this.#metadataTtlMs = normalized.metadataTtlMs;
    }

    async listActivities(options = {}) {
        const operation = 'listActivities';
        const { refresh } = normalizeListOptions(options, operation);
        const warnings = [];

        if (!refresh) {
            let cacheEntry;
            try {
                cacheEntry = inspectActivityEntry(
                    await this.#activityCache.getCachedActivities({
                        cacheVersion: this.#cacheVersion,
                        maxAgeMs: this.#activityMaxAgeMs
                    })
                );
            } catch {
                cacheEntry = { status: 'failed' };
            }

            if (cacheEntry.status === 'hit') {
                try {
                    const activities = requireShape(
                        projectLegacyValue(cacheEntry.data, operation),
                        operation,
                        'array'
                    );
                    if (activities.length > 0) {
                        return result(
                            activities,
                            REPOSITORY_SOURCE.CACHE,
                            warnings,
                            false,
                            operation
                        );
                    }
                } catch {
                    cacheEntry = { status: 'failed' };
                }
            }
            if (cacheEntry.status === 'failed') {
                warnings.push(warning(
                    REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
                    operation
                ));
            }
        }

        const activities = requireShape(
            projectLegacyValue(
                await this.#callConnector(
                    'fetchActivities',
                    [],
                    operation
                ),
                operation
            ),
            operation,
            'array'
        );
        let saved = false;
        try {
            saved = await this.#activityCache.saveCachedActivities(
                projectLegacyValue(activities, operation),
                this.#cacheVersion
            );
        } catch {
            saved = false;
        }
        if (saved !== true) {
            warnings.push(warning(
                REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED,
                operation
            ));
        }
        return result(
            activities,
            REPOSITORY_SOURCE.NETWORK,
            warnings,
            false,
            operation
        );
    }

    async getActivity(activityId) {
        const operation = 'getActivity';
        const id = normalizeId(activityId, operation);
        const data = requireShape(
            projectLegacyValue(
                await this.#callConnector(
                    'fetchActivity',
                    [id],
                    operation
                ),
                operation
            ),
            operation,
            'object'
        );
        return result(
            data,
            REPOSITORY_SOURCE.NETWORK,
            [],
            false,
            operation
        );
    }

    async getStreams(activityId, options) {
        const operation = 'getStreams';
        const id = normalizeId(activityId, operation);
        const normalized = normalizeStreamOptions(options, operation);
        const data = requireShape(
            projectLegacyValue(
                await this.#callConnector(
                    'fetchStreams',
                    [id, normalized],
                    operation
                ),
                operation
            ),
            operation,
            'object'
        );
        return result(
            data,
            REPOSITORY_SOURCE.NETWORK,
            [],
            false,
            operation
        );
    }

    async getAthlete() {
        const snapshot = await this.#getAthleteSnapshot();
        return result(
            snapshot.data,
            snapshot.source,
            snapshot.warnings,
            false,
            'getAthlete'
        );
    }

    async getZones() {
        const snapshot = await this.#loadCacheBacked({
            operation: 'getZones',
            read: () => this.#metadataCache.readZones(),
            write: data => this.#metadataCache.writeZones(data),
            connectorMethod: 'fetchZones',
            shape: 'nullable-object'
        });
        return result(
            snapshot.data,
            snapshot.source,
            snapshot.warnings,
            false,
            'getZones'
        );
    }

    async getGears() {
        const operation = 'getGears';
        const warnings = [];
        let aggregate;
        try {
            aggregate = inspectCacheResult(
                await this.#metadataCache.readGears()
            );
        } catch {
            aggregate = { status: 'failed' };
        }
        if (aggregate.status === 'hit') {
            try {
                const data = requireShape(
                    projectLegacyValue(aggregate.data, operation),
                    operation,
                    'array'
                );
                return result(
                    data,
                    REPOSITORY_SOURCE.CACHE,
                    [],
                    false,
                    operation
                );
            } catch {
                aggregate = { status: 'failed' };
            }
        }
        if (aggregate.status === 'failed') {
            warnings.push(warning(
                REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
                operation
            ));
        }

        const athlete = await this.#getAthleteSnapshot();
        warnings.push(...reframeWarnings(athlete.warnings, operation));
        const items = extractGearItems(athlete.data, operation);
        const outcomes = await Promise.all(items.map(async (item, itemIndex) => {
            const id = gearItemId(item);
            if (id === null) {
                return {
                    ok: false,
                    itemIndex,
                    retryable: false
                };
            }
            try {
                return {
                    ok: true,
                    itemIndex,
                    value: await this.#getGearResult(id)
                };
            } catch (error) {
                return {
                    ok: false,
                    itemIndex,
                    retryable: (
                        error instanceof RepositoryError
                        && error.retryable
                    )
                };
            }
        }));

        const data = [];
        const sources = [];
        let partial = false;
        for (const outcome of outcomes) {
            if (!outcome.ok) {
                partial = true;
                warnings.push(warning(
                    REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED,
                    operation,
                    {
                        retryable: outcome.retryable,
                        itemIndex: outcome.itemIndex
                    }
                ));
                continue;
            }
            data.push(outcome.value.data);
            sources.push(outcome.value.source);
            warnings.push(...reframeWarnings(
                outcome.value.warnings,
                operation
            ));
        }

        if (!partial) {
            let writeResult;
            try {
                writeResult = inspectCacheResult(
                    await this.#metadataCache.writeGears(
                        projectLegacyValue(data, operation),
                        { partial: false }
                    )
                );
            } catch {
                writeResult = { status: 'failed' };
            }
            if (writeResult.status !== 'written') {
                warnings.push(warning(
                    REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED,
                    operation
                ));
            }
        }

        return result(
            data,
            combineSources(sources, athlete.source),
            warnings,
            partial,
            operation
        );
    }

    async getGear(gearId) {
        const operation = 'getGear';
        const id = normalizeId(gearId, operation);
        return this.#getGearResult(id);
    }

    async #getGearResult(id) {
        const snapshot = await this.#loadCacheBacked({
            operation: 'getGear',
            read: () => this.#metadataCache.readGear(id),
            write: data => this.#metadataCache.writeGear(id, data),
            connectorMethod: 'fetchGear',
            connectorArgs: [id],
            shape: 'object'
        });
        return result(
            snapshot.data,
            snapshot.source,
            snapshot.warnings,
            false,
            'getGear'
        );
    }

    async #getAthleteSnapshot() {
        if (this.#athleteSnapshot !== null) {
            const now = readFiniteNow(this.#now, 'getAthlete');
            if (now < this.#athleteSnapshot.expiresAt) {
                return this.#athleteSnapshot;
            }
            this.#athleteSnapshot = null;
        }
        if (this.#athleteInFlight !== null) {
            return this.#athleteInFlight;
        }

        const expiryWindow = createExpiryWindow(
            this.#now,
            this.#metadataTtlMs,
            'getAthlete'
        );
        const load = this.#loadCacheBacked({
            operation: 'getAthlete',
            read: () => this.#metadataCache.readAthlete(),
            write: data => this.#metadataCache.writeAthlete(data),
            connectorMethod: 'fetchAthlete',
            shape: 'nullable-object',
            includeExpiry: true,
            expiryWindow
        });
        this.#athleteInFlight = load;
        try {
            const snapshot = await load;
            this.#athleteSnapshot = snapshot;
            return snapshot;
        } finally {
            if (this.#athleteInFlight === load) {
                this.#athleteInFlight = null;
            }
        }
    }

    async #loadCacheBacked({
        operation,
        read,
        write,
        connectorMethod,
        connectorArgs = [],
        shape,
        includeExpiry = false,
        expiryWindow = null
    }) {
        const warnings = [];
        let cacheResult;
        try {
            cacheResult = inspectCacheResult(await read());
        } catch {
            cacheResult = { status: 'failed' };
        }

        if (cacheResult.status === 'hit') {
            try {
                const data = requireShape(
                    projectLegacyValue(cacheResult.data, operation),
                    operation,
                    shape
                );
                if (!includeExpiry) {
                    return {
                        data,
                        source: REPOSITORY_SOURCE.CACHE,
                        warnings,
                        expiresAt: null
                    };
                }
                const expiresAt = cacheResult.expiresAt;
                if (
                    typeof expiresAt === 'number'
                    && Number.isFinite(expiresAt)
                    && expiresAt > expiryWindow.now
                ) {
                    return {
                        data,
                        source: REPOSITORY_SOURCE.CACHE,
                        warnings,
                        expiresAt: Math.min(
                            expiresAt,
                            expiryWindow.maxExpiresAt
                        )
                    };
                }
                cacheResult = { status: 'failed' };
            } catch {
                cacheResult = { status: 'failed' };
            }
        }
        if (cacheResult.status === 'failed') {
            warnings.push(warning(
                REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
                operation
            ));
        }

        const data = requireShape(
            projectLegacyValue(
                await this.#callConnector(
                    connectorMethod,
                    connectorArgs,
                    operation
                ),
                operation
            ),
            operation,
            shape
        );
        let writeResult;
        try {
            writeResult = inspectCacheResult(
                await write(projectLegacyValue(data, operation))
            );
        } catch {
            writeResult = { status: 'failed' };
        }
        if (writeResult.status !== 'written') {
            warnings.push(warning(
                REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED,
                operation
            ));
        }

        let expiresAt = null;
        if (includeExpiry) {
            expiresAt = expiryWindow.maxExpiresAt;
        }
        return {
            data,
            source: REPOSITORY_SOURCE.NETWORK,
            warnings,
            expiresAt
        };
    }

    async #callConnector(method, args, operation) {
        try {
            return await this.#connector[method](...args);
        } catch (error) {
            throw mapConnectorError(error, operation);
        }
    }
}
