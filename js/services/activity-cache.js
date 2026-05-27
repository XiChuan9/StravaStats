const DB_NAME = 'strava-dashboard-cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';
const ACTIVITIES_KEY = 'strava_activities';
const ACTIVITIES_TIMESTAMP_KEY = `${ACTIVITIES_KEY}_timestamp`;
const CACHE_VERSION_KEY = 'strava_cache_version';

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function safeGetLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn(`Failed to read localStorage key ${key}:`, error);
        return null;
    }
}

function safeSetLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn(`Failed to write localStorage key ${key}:`, error);
        return false;
    }
}

function safeRemoveLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn(`Failed to remove localStorage key ${key}:`, error);
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
    } catch (error) {
        console.warn('Failed to read localStorage activity cache:', error);
        return null;
    }
}

function removeLocalStorageActivityCache() {
    safeRemoveLocalStorage(ACTIVITIES_KEY);
    safeRemoveLocalStorage(ACTIVITIES_TIMESTAMP_KEY);
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
    } catch (error) {
        console.warn('IndexedDB activity cache unavailable, falling back to localStorage:', error);
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
    } catch (error) {
        console.warn('Failed to save activities in IndexedDB, trying localStorage fallback:', error);
    }

    try {
        localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
        safeSetLocalStorage(ACTIVITIES_TIMESTAMP_KEY, String(timestamp));
        if (cacheVersion) safeSetLocalStorage(CACHE_VERSION_KEY, cacheVersion);
        return true;
    } catch (error) {
        console.warn('Activity cache skipped because browser storage quota was exceeded:', error);
        removeLocalStorageActivityCache();
        if (cacheVersion) safeSetLocalStorage(CACHE_VERSION_KEY, cacheVersion);
        return false;
    }
}

export async function clearCachedActivities() {
    removeLocalStorageActivityCache();

    try {
        await runStoreTransaction('readwrite', store => store.delete(ACTIVITIES_KEY));
    } catch (error) {
        console.warn('Failed to clear IndexedDB activity cache:', error);
    }
}
