import { StravaApiConnector } from '../connectors/strava/strava-api-connector.js';
import {
    getDemoActivities,
    getDemoAthlete,
    getDemoGears,
    getDemoTrainingZones
} from '../demo/index.js';
import {
    getCachedActivities,
    saveCachedActivities
} from '../services/activity-cache.js';
import {
    REPOSITORY_ERROR_CODE,
    RepositoryError
} from './errors.js';
import { DemoRepository } from './demo/demo-repository.js';
import {
    LEGACY_METADATA_CACHE_TTL_MS,
    LegacyCacheAdapter
} from './legacy/legacy-cache-adapter.js';
import {
    LEGACY_ACTIVITY_CACHE_MAX_AGE_MS,
    LEGACY_ACTIVITY_CACHE_VERSION,
    LegacyRepository
} from './legacy/legacy-repository.js';

const FACTORY_OPTION_KEYS = new Set(['sessionMode', 'mode']);
const DEPENDENCY_KEYS = new Set([
    'connectorFactory',
    'activityCache',
    'metadataCacheFactory',
    'demoProvider',
    'now',
    'cacheVersion',
    'activityMaxAgeMs',
    'metadataTtlMs'
]);

const DEFAULT_ACTIVITY_CACHE = Object.freeze({
    getCachedActivities,
    saveCachedActivities
});
const DEFAULT_DEMO_PROVIDER = Object.freeze({
    getActivities: getDemoActivities,
    getAthlete: getDemoAthlete,
    getZones: getDemoTrainingZones,
    getGears: getDemoGears
});

function defaultNow() {
    return Date.now();
}

function defaultConnectorFactory() {
    return new StravaApiConnector();
}

function defaultMetadataCacheFactory({ now, ttlMs }) {
    return new LegacyCacheAdapter({ now, ttlMs });
}

function repositoryError(code) {
    return new RepositoryError(code);
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

function normalizeFactoryOptions(options) {
    const values = readRecord(options, FACTORY_OPTION_KEYS);
    if (values === null) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST);
    }
    if (!['real', 'demo'].includes(values.sessionMode)) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST);
    }

    const mode = values.mode ?? 'legacy';
    if (mode !== 'legacy') {
        throw repositoryError(REPOSITORY_ERROR_CODE.UNSUPPORTED_MODE);
    }
    return {
        sessionMode: values.sessionMode,
        mode
    };
}

function normalizeDependencies(dependencies) {
    const values = readRecord(dependencies, DEPENDENCY_KEYS);
    if (values === null) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST);
    }

    const normalized = {
        connectorFactory: values.connectorFactory
            ?? defaultConnectorFactory,
        activityCache: values.activityCache ?? DEFAULT_ACTIVITY_CACHE,
        metadataCacheFactory: values.metadataCacheFactory
            ?? defaultMetadataCacheFactory,
        demoProvider: values.demoProvider ?? DEFAULT_DEMO_PROVIDER,
        now: values.now ?? defaultNow,
        cacheVersion: values.cacheVersion
            ?? LEGACY_ACTIVITY_CACHE_VERSION,
        activityMaxAgeMs: values.activityMaxAgeMs
            ?? LEGACY_ACTIVITY_CACHE_MAX_AGE_MS,
        metadataTtlMs: values.metadataTtlMs
            ?? LEGACY_METADATA_CACHE_TTL_MS
    };

    if (
        typeof normalized.connectorFactory !== 'function'
        || typeof normalized.metadataCacheFactory !== 'function'
        || typeof normalized.now !== 'function'
        || typeof normalized.cacheVersion !== 'string'
        || normalized.cacheVersion.length === 0
        || !Number.isFinite(normalized.activityMaxAgeMs)
        || normalized.activityMaxAgeMs < 0
        || !Number.isFinite(normalized.metadataTtlMs)
        || normalized.metadataTtlMs < 0
    ) {
        throw repositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST);
    }
    return normalized;
}

export function createRepositoryWithDependencies(
    options,
    dependencies = {}
) {
    const normalizedOptions = normalizeFactoryOptions(options);
    const normalizedDependencies = normalizeDependencies(dependencies);

    if (normalizedOptions.sessionMode === 'demo') {
        return new DemoRepository({
            provider: normalizedDependencies.demoProvider
        });
    }

    const connector = normalizedDependencies.connectorFactory();
    const metadataCache = normalizedDependencies.metadataCacheFactory({
        now: normalizedDependencies.now,
        ttlMs: normalizedDependencies.metadataTtlMs
    });
    return new LegacyRepository({
        connector,
        activityCache: normalizedDependencies.activityCache,
        metadataCache,
        now: normalizedDependencies.now,
        cacheVersion: normalizedDependencies.cacheVersion,
        activityMaxAgeMs: normalizedDependencies.activityMaxAgeMs,
        metadataTtlMs: normalizedDependencies.metadataTtlMs
    });
}

export function createRepository(options) {
    return createRepositoryWithDependencies(options);
}
