import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_DB_VERSION,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_STORE_NAME
} from './legacy-cache/constants.js';

const DB_NAME = LEGACY_DB_NAME;
const DB_VERSION = LEGACY_DB_VERSION;
const STORE_NAME = LEGACY_STORE_NAME;
const ACTIVITIES_KEY = LEGACY_ACTIVITY_KEY;
const ACTIVITIES_TIMESTAMP_KEY = LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp;
const CACHE_VERSION_KEY = LEGACY_LOCAL_STORAGE_KEYS.cacheVersion;

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function safeGetLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function safeRemoveLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch {
    }
}

function openCacheDb() {
    if (!canUseIndexedDb()) {
        return Promise.reject(new Error('IndexedDB is not available'));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
}

async function runStoreTransaction(mode, operation) {
    const db = await openCacheDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let requestResult;
        let settled = false;

        function finish(callback, value) {
            if (settled) return;
            settled = true;
            db.close();
            callback(value);
        }

        transaction.oncomplete = () => {
            finish(resolve, requestResult);
        };

        transaction.onerror = () => {
            const error = transaction.error || new Error('IndexedDB transaction failed');
            finish(reject, error);
        };

        transaction.onabort = () => {
            const error = transaction.error || new Error('IndexedDB transaction was aborted');
            finish(reject, error);
        };

        let request;
        try {
            request = operation(store);
        } catch (error) {
            try {
                transaction.abort();
            } catch {
                // The transaction may already be inactive.
            }
            finish(reject, error);
            return;
        }

        request.onsuccess = () => {
            requestResult = request.result;
        };
    });
}

function readLocalStorageActivityCache({ cacheVersion, maxAgeMs }) {
    const cachedActivities = safeGetLocalStorage(ACTIVITIES_KEY);
    if (!cachedActivities) return null;

    const storedVersion = safeGetLocalStorage(CACHE_VERSION_KEY);
    if (cacheVersion && storedVersion !== cacheVersion) return null;

    const timestamp = Number(safeGetLocalStorage(ACTIVITIES_TIMESTAMP_KEY) || 0);
    const age = timestamp ? Date.now() - timestamp : Infinity;
    if (age > maxAgeMs) return null;

    try {
        return {
            activities: JSON.parse(cachedActivities),
            timestamp,
            cacheVersion: storedVersion || null
        };
    } catch {
        return null;
    }
}

function removeLocalStorageActivityCache() {
    safeRemoveLocalStorage(ACTIVITIES_KEY);
    safeRemoveLocalStorage(ACTIVITIES_TIMESTAMP_KEY);
}

function snapshotLocalStorageActivityCache() {
    return {
        [ACTIVITIES_KEY]: localStorage.getItem(ACTIVITIES_KEY),
        [ACTIVITIES_TIMESTAMP_KEY]: localStorage.getItem(ACTIVITIES_TIMESTAMP_KEY),
        [CACHE_VERSION_KEY]: localStorage.getItem(CACHE_VERSION_KEY)
    };
}

function restoreLocalStorageActivityCache(snapshot, changedKeys) {
    const failures = [];
    for (const key of [...changedKeys].reverse()) {
        try {
            const value = snapshot[key];
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch {
            failures.push(true);
        }
    }
    return failures;
}

export async function getCachedActivities({ cacheVersion = null, maxAgeMs = Infinity } = {}) {
    try {
        const entry = await runStoreTransaction('readonly', store => store.get(ACTIVITIES_KEY));
        if (entry?.activities) {
            const age = entry.timestamp ? Date.now() - entry.timestamp : Infinity;
            const versionMatches = !cacheVersion || entry.cacheVersion === cacheVersion;
            if (versionMatches && age <= maxAgeMs) {
                return entry;
            }
        }
    } catch {
    }

    return readLocalStorageActivityCache({ cacheVersion, maxAgeMs });
}

export async function saveCachedActivities(activities, cacheVersion) {
    const timestamp = Date.now();
    const entry = {
        key: ACTIVITIES_KEY,
        activities,
        timestamp,
        cacheVersion
    };

    try {
        await runStoreTransaction('readwrite', store => store.put(entry));
        // Keep only small metadata in localStorage; the large activity payload lives in IndexedDB.
        removeLocalStorageActivityCache();
        safeSetLocalStorage(ACTIVITIES_TIMESTAMP_KEY, String(timestamp));
        if (cacheVersion) safeSetLocalStorage(CACHE_VERSION_KEY, cacheVersion);
        return true;
    } catch {
    }

    let serializedActivities;
    try {
        serializedActivities = JSON.stringify(activities);
    } catch {
        return false;
    }

    let fallbackSnapshot;
    try {
        fallbackSnapshot = snapshotLocalStorageActivityCache();
    } catch {
        return false;
    }

    const changedKeys = [];
    try {
        localStorage.setItem(ACTIVITIES_TIMESTAMP_KEY, String(timestamp));
        changedKeys.push(ACTIVITIES_TIMESTAMP_KEY);
        if (cacheVersion) {
            localStorage.setItem(CACHE_VERSION_KEY, cacheVersion);
            changedKeys.push(CACHE_VERSION_KEY);
        }
        localStorage.setItem(ACTIVITIES_KEY, serializedActivities);
        changedKeys.push(ACTIVITIES_KEY);
        return true;
    } catch {
        const rollbackFailures = restoreLocalStorageActivityCache(
            fallbackSnapshot,
            changedKeys
        );
        if (rollbackFailures.length > 0) {
            console.warn('Failed to fully restore the previous localStorage activity cache:');
        }
        return false;
    }
}

export async function clearCachedActivities() {
    removeLocalStorageActivityCache();

    try {
        await runStoreTransaction('readwrite', store => store.delete(ACTIVITIES_KEY));
    } catch {
    }
}
