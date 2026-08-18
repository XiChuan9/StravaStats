import { createCanonicalStore } from '../storage/index.js';
import {
    readLegacyIndexedDb,
    readLegacyLocalStorage
} from '../services/legacy-cache/index.js';

export const LOCAL_FIRST_ROUTE = Object.freeze({
    DASHBOARD: 'dashboard',
    FIRST_RUN: 'first-run',
    BLOCKED: 'blocked',
    DEMO: 'demo'
});

export const LOCAL_FIRST_STATUS = Object.freeze({
    READY: 'ready',
    DEGRADED: 'degraded',
    UNAVAILABLE: 'unavailable',
    DEMO: 'demo'
});

export const STRAVA_SOURCE_STATUS = Object.freeze({
    CONNECTED: 'connected',
    NOT_CONNECTED: 'not_connected',
    RECONNECT_REQUIRED: 'reconnect_required',
    UNAVAILABLE: 'unavailable',
    DEMO: 'demo'
});

export const LOCAL_FIRST_NETWORK_STATUS = Object.freeze({
    ONLINE: 'online',
    OFFLINE: 'offline',
    UNKNOWN: 'unknown'
});

const INSPECTION_OPTION_KEYS = new Set([
    'indexedDB',
    'IDBKeyRange',
    'localStorage',
    'now',
    'online',
    'canonicalStoreFactory',
    'legacyIndexedDbReader',
    'legacyLocalStorageReader'
]);
const ORCHESTRATION_OPTION_KEYS = new Set([
    'sessionMode',
    'inspect',
    'startDemo',
    'startDashboard',
    'navigateFirstRun',
    'showBlocked'
]);
const INSPECTION_RESULT_KEYS = new Set([
    'route',
    'localStatus',
    'stravaStatus',
    'networkStatus',
    'legacyActivities'
]);
const TOKEN_FIELDS = Object.freeze([
    'access_token',
    'refresh_token',
    'expires_at'
]);
const TOKEN_KEY = 'strava_tokens';
const V2_APPLICATION_VERSION = 'pr15-local-first-bootstrap@1';
const EMPTY_ACTIVITIES = Object.freeze([]);

function readDataRecord(value, allowedKeys, allowSubset = true) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;

        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string' || !allowedKeys.has(key))
            || (!allowSubset && keys.length !== allowedKeys.size)
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

function findDataMethod(value, name) {
    try {
        if (
            value === null
            || (typeof value !== 'object' && typeof value !== 'function')
        ) return null;
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

function denseArrayLength(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
            || keys.length !== lengthDescriptor.value + 1
            || keys.some(key => typeof key !== 'string')
        ) return null;
        const keySet = new Set(keys);
        if (!keySet.has('length')) return null;
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
        }
        return lengthDescriptor.value;
    } catch {
        return null;
    }
}

function cloneJsonSafe(value, ancestors = new Set()) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError();
        return value;
    }
    if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError();

    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            const length = denseArrayLength(value);
            if (length === null) throw new TypeError();
            const result = [];
            for (let index = 0; index < length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                result.push(cloneJsonSafe(descriptor.value, ancestors));
            }
            return Object.freeze(result);
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) throw new TypeError();
        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') throw new TypeError();
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError();
            }
            Object.defineProperty(result, key, {
                value: cloneJsonSafe(descriptor.value, ancestors),
                enumerable: true,
                configurable: false,
                writable: false
            });
        }
        return Object.freeze(result);
    } finally {
        ancestors.delete(value);
    }
}

function networkStatus(online) {
    if (online === true) return LOCAL_FIRST_NETWORK_STATUS.ONLINE;
    if (online === false) return LOCAL_FIRST_NETWORK_STATUS.OFFLINE;
    return LOCAL_FIRST_NETWORK_STATUS.UNKNOWN;
}

function readTokenStatus(storage, now) {
    let raw;
    try {
        const getItem = findDataMethod(storage, 'getItem');
        if (!getItem) return STRAVA_SOURCE_STATUS.UNAVAILABLE;
        raw = getItem.call(storage, TOKEN_KEY);
    } catch {
        return STRAVA_SOURCE_STATUS.UNAVAILABLE;
    }
    if (raw === null) return STRAVA_SOURCE_STATUS.NOT_CONNECTED;
    if (typeof raw !== 'string' || raw.length === 0) {
        return STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED;
    }
    try {
        const parsed = JSON.parse(raw);
        if (
            parsed === null
            || typeof parsed !== 'object'
            || Array.isArray(parsed)
            || Object.getPrototypeOf(parsed) !== Object.prototype
        ) return STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED;

        const token = Object.create(null);
        for (const field of TOKEN_FIELDS) {
            const descriptor = Object.getOwnPropertyDescriptor(parsed, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED;
            }
            token[field] = descriptor.value;
        }
        if (
            typeof token.access_token !== 'string'
            || token.access_token.trim().length === 0
            || typeof token.refresh_token !== 'string'
            || token.refresh_token.trim().length === 0
            || typeof token.expires_at !== 'number'
            || !Number.isFinite(token.expires_at)
            || token.expires_at <= Math.floor(now / 1000)
        ) return STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED;
        return STRAVA_SOURCE_STATUS.CONNECTED;
    } catch {
        return STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED;
    }
}

async function inspectCanonical(options) {
    let store = null;
    let hasActivities = false;
    let readable = false;
    try {
        store = options.canonicalStoreFactory({
            indexedDB: options.indexedDB,
            IDBKeyRange: options.IDBKeyRange,
            now: () => options.now,
            applicationVersion: V2_APPLICATION_VERSION
        });
        const initialize = findDataMethod(store, 'initialize');
        const listActivities = findDataMethod(store, 'listActivities');
        if (!initialize || !listActivities) throw new TypeError();
        await initialize.call(store);
        const activities = await listActivities.call(store, { limit: 1 });
        const length = denseArrayLength(activities);
        if (length === null || length > 1) throw new TypeError();
        hasActivities = length === 1;
        readable = true;
    } catch {
        readable = false;
    } finally {
        const close = findDataMethod(store, 'close');
        if (close) {
            try {
                await close.call(store);
            } catch {
                readable = false;
            }
        }
    }
    return Object.freeze({ readable, hasActivities });
}

function inspectLegacyReaderResult(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
        const statusDescriptor = Object.getOwnPropertyDescriptor(value, 'status');
        if (!statusDescriptor?.enumerable || !Object.hasOwn(statusDescriptor, 'value')) {
            return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
        }
        if (statusDescriptor.value === 'not-found') {
            return Object.freeze({ readable: true, activities: EMPTY_ACTIVITIES });
        }
        if (statusDescriptor.value !== 'found') {
            return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
        }
        const entryDescriptor = Object.getOwnPropertyDescriptor(value, 'entry');
        if (
            !entryDescriptor?.enumerable
            || !Object.hasOwn(entryDescriptor, 'value')
            || entryDescriptor.value === null
            || typeof entryDescriptor.value !== 'object'
        ) return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
        const activitiesDescriptor = Object.getOwnPropertyDescriptor(
            entryDescriptor.value,
            'activities'
        );
        if (!activitiesDescriptor?.enumerable || !Object.hasOwn(activitiesDescriptor, 'value')) {
            return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
        }
        const activities = cloneJsonSafe(activitiesDescriptor.value);
        if (!Array.isArray(activities)) throw new TypeError();
        return Object.freeze({ readable: true, activities });
    } catch {
        return Object.freeze({ readable: false, activities: EMPTY_ACTIVITIES });
    }
}

function defaultInspectionOptions(values) {
    const globalNavigator = typeof navigator === 'object' && navigator !== null
        ? navigator
        : null;
    return Object.freeze({
        indexedDB: Object.hasOwn(values, 'indexedDB')
            ? values.indexedDB
            : globalThis.indexedDB,
        IDBKeyRange: Object.hasOwn(values, 'IDBKeyRange')
            ? values.IDBKeyRange
            : globalThis.IDBKeyRange,
        localStorage: Object.hasOwn(values, 'localStorage')
            ? values.localStorage
            : globalThis.localStorage,
        now: Object.hasOwn(values, 'now') ? values.now : Date.now(),
        online: Object.hasOwn(values, 'online')
            ? values.online
            : globalNavigator?.onLine,
        canonicalStoreFactory: values.canonicalStoreFactory ?? createCanonicalStore,
        legacyIndexedDbReader: values.legacyIndexedDbReader ?? readLegacyIndexedDb,
        legacyLocalStorageReader:
            values.legacyLocalStorageReader ?? readLegacyLocalStorage
    });
}

function result(route, localStatus, stravaStatus, status, legacyActivities) {
    return Object.freeze({
        route,
        localStatus,
        stravaStatus,
        networkStatus: status,
        legacyActivities
    });
}

function blockedResult(status = LOCAL_FIRST_NETWORK_STATUS.UNKNOWN) {
    return result(
        LOCAL_FIRST_ROUTE.BLOCKED,
        LOCAL_FIRST_STATUS.UNAVAILABLE,
        STRAVA_SOURCE_STATUS.UNAVAILABLE,
        status,
        EMPTY_ACTIVITIES
    );
}

export async function inspectLocalFirstBootstrap(options = {}) {
    const values = readDataRecord(options, INSPECTION_OPTION_KEYS);
    if (values === null) return blockedResult();

    let dependencies;
    try {
        dependencies = defaultInspectionOptions(values);
    } catch {
        return blockedResult();
    }
    if (
        !Number.isFinite(dependencies.now)
        || typeof dependencies.canonicalStoreFactory !== 'function'
        || typeof dependencies.legacyIndexedDbReader !== 'function'
        || typeof dependencies.legacyLocalStorageReader !== 'function'
    ) return blockedResult(networkStatus(dependencies.online));

    const canonical = await inspectCanonical(dependencies);
    let indexedDb;
    let localStorage;
    try {
        indexedDb = inspectLegacyReaderResult(
            await dependencies.legacyIndexedDbReader({
                indexedDB: dependencies.indexedDB,
                now: dependencies.now,
                expectedCacheVersion: null,
                maxAgeMs: Infinity
            })
        );
    } catch {
        indexedDb = Object.freeze({
            readable: false,
            activities: EMPTY_ACTIVITIES
        });
    }
    try {
        localStorage = inspectLegacyReaderResult(
            dependencies.legacyLocalStorageReader({
                localStorage: dependencies.localStorage,
                now: dependencies.now,
                expectedCacheVersion: null,
                maxAgeMs: Infinity
            })
        );
    } catch {
        localStorage = Object.freeze({
            readable: false,
            activities: EMPTY_ACTIVITIES
        });
    }

    const legacyActivities = indexedDb.activities.length > 0
        ? indexedDb.activities
        : localStorage.activities.length > 0
            ? localStorage.activities
            : EMPTY_ACTIVITIES;
    const hasActivities = canonical.hasActivities || legacyActivities.length > 0;
    const failed = !canonical.readable || !indexedDb.readable || !localStorage.readable;
    const route = hasActivities
        ? LOCAL_FIRST_ROUTE.DASHBOARD
        : failed
            ? LOCAL_FIRST_ROUTE.BLOCKED
            : LOCAL_FIRST_ROUTE.FIRST_RUN;
    const localStatus = hasActivities && failed
        ? LOCAL_FIRST_STATUS.DEGRADED
        : route === LOCAL_FIRST_ROUTE.BLOCKED
            ? LOCAL_FIRST_STATUS.UNAVAILABLE
            : LOCAL_FIRST_STATUS.READY;
    return result(
        route,
        localStatus,
        readTokenStatus(dependencies.localStorage, dependencies.now),
        networkStatus(dependencies.online),
        legacyActivities
    );
}

function demoResult() {
    return result(
        LOCAL_FIRST_ROUTE.DEMO,
        LOCAL_FIRST_STATUS.DEMO,
        STRAVA_SOURCE_STATUS.DEMO,
        LOCAL_FIRST_NETWORK_STATUS.UNKNOWN,
        EMPTY_ACTIVITIES
    );
}

function validatedInspectionResult(value) {
    const state = readDataRecord(value, INSPECTION_RESULT_KEYS, false);
    if (state === null || denseArrayLength(state.legacyActivities) === null) return null;
    if (
        state.stravaStatus === STRAVA_SOURCE_STATUS.DEMO
        || !Object.values(STRAVA_SOURCE_STATUS).includes(state.stravaStatus)
    ) return null;
    if (!Object.values(LOCAL_FIRST_NETWORK_STATUS).includes(state.networkStatus)) return null;

    const routeIsValid = (
        state.route === LOCAL_FIRST_ROUTE.DASHBOARD
        && (
            state.localStatus === LOCAL_FIRST_STATUS.READY
            || state.localStatus === LOCAL_FIRST_STATUS.DEGRADED
        )
    ) || (
        state.route === LOCAL_FIRST_ROUTE.FIRST_RUN
        && state.localStatus === LOCAL_FIRST_STATUS.READY
        && state.legacyActivities.length === 0
    ) || (
        state.route === LOCAL_FIRST_ROUTE.BLOCKED
        && state.localStatus === LOCAL_FIRST_STATUS.UNAVAILABLE
        && state.legacyActivities.length === 0
    );
    if (!routeIsValid) return null;
    try {
        return result(
            state.route,
            state.localStatus,
            state.stravaStatus,
            state.networkStatus,
            cloneJsonSafe(state.legacyActivities)
        );
    } catch {
        return null;
    }
}

export async function runLocalFirstBootstrap(options) {
    const values = readDataRecord(options, ORCHESTRATION_OPTION_KEYS, false);
    if (values === null) return blockedResult();
    if (
        typeof values.inspect !== 'function'
        || typeof values.startDemo !== 'function'
        || typeof values.startDashboard !== 'function'
        || typeof values.navigateFirstRun !== 'function'
        || typeof values.showBlocked !== 'function'
    ) return blockedResult();

    if (values.sessionMode === 'demo') {
        const state = demoResult();
        await values.startDemo(state);
        return state;
    }
    if (values.sessionMode !== 'real') {
        const state = blockedResult();
        await values.showBlocked(state);
        return state;
    }

    let state;
    try {
        state = validatedInspectionResult(await values.inspect());
    } catch {
        state = null;
    }
    if (state === null) {
        state = blockedResult();
        await values.showBlocked(state);
    } else if (state.route === LOCAL_FIRST_ROUTE.DASHBOARD) {
        await values.startDashboard(state);
    } else if (state.route === LOCAL_FIRST_ROUTE.FIRST_RUN) {
        await values.navigateFirstRun(state);
    } else {
        await values.showBlocked(state);
    }
    return state;
}
