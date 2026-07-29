import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_ERROR_CODES,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_STORE_NAME,
    LEGACY_WARNING_CODES
} from './constants.js';

function issue(code, message, details = {}) {
    return { code, message, ...details };
}

function errorName(error) {
    return error?.name || 'Error';
}

function resolveNow(now) {
    const value = typeof now === 'function' ? now() : now;
    return Number.isFinite(value) ? value : Date.now();
}

function getActivityRange(activities) {
    const datedActivities = activities
        .map(activity => activity?.start_date || activity?.start_date_local || null)
        .filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
        .sort((left, right) => Date.parse(left) - Date.parse(right));

    return {
        earliestActivity: datedActivities[0] || null,
        latestActivity: datedActivities.at(-1) || null
    };
}

function cacheWarnings(entry, { expectedCacheVersion, maxAgeMs, now }) {
    const warnings = [];
    const timestamp = Number(entry?.timestamp);

    if (
        Number.isFinite(maxAgeMs)
        && maxAgeMs >= 0
        && (!Number.isFinite(timestamp) || now - timestamp > maxAgeMs)
    ) {
        warnings.push(issue(
            LEGACY_WARNING_CODES.CACHE_STALE,
            'The Legacy cache is stale, but Rescue Reader returned it without enforcing TTL.'
        ));
    }

    if (
        expectedCacheVersion !== null
        && expectedCacheVersion !== undefined
        && entry?.cacheVersion !== expectedCacheVersion
    ) {
        warnings.push(issue(
            LEGACY_WARNING_CODES.CACHE_VERSION_MISMATCH,
            'The Legacy cache version differs from the expected version, but Rescue Reader returned it.',
            {
                actual: entry?.cacheVersion ?? null,
                expected: expectedCacheVersion
            }
        ));
    }

    return warnings;
}

function openLegacyDatabase(indexedDb, openTimeoutMs) {
    if (!indexedDb || typeof indexedDb.open !== 'function') {
        return Promise.resolve({
            status: 'error',
            error: issue(
                LEGACY_ERROR_CODES.INDEXEDDB_NOT_AVAILABLE,
                'IndexedDB is not available.'
            )
        });
    }

    return new Promise(resolve => {
        let request;
        let settled = false;
        let missingDatabase = false;
        let missingAbortFailed = false;

        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
        };

        const timeoutId = setTimeout(() => {
            finish({
                status: 'error',
                error: issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_TIMEOUT,
                    'Opening the Legacy IndexedDB timed out.'
                )
            });
        }, Math.max(0, openTimeoutMs));

        try {
            // Intentionally omit a version so newer Legacy database versions remain readable.
            request = indexedDb.open(LEGACY_DB_NAME);
        } catch (error) {
            finish({
                status: 'error',
                error: issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_OPEN_ERROR,
                    'Opening the Legacy IndexedDB failed.',
                    { cause: errorName(error) }
                )
            });
            return;
        }

        request.onupgradeneeded = () => {
            missingDatabase = true;
            try {
                request.transaction.abort();
            } catch {
                missingAbortFailed = true;
            }
        };

        request.onblocked = () => {
            finish({
                status: 'error',
                error: issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_BLOCKED,
                    'Opening the Legacy IndexedDB was blocked.'
                )
            });
        };

        request.onerror = () => {
            if (
                missingDatabase
                && !missingAbortFailed
                && request.error?.name === 'AbortError'
            ) {
                finish({ status: 'not-found' });
                return;
            }
            finish({
                status: 'error',
                error: issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_OPEN_ERROR,
                    'Opening the Legacy IndexedDB failed.',
                    { cause: errorName(request.error) }
                )
            });
        };

        request.onsuccess = () => {
            if (missingDatabase) {
                request.result.close();
                finish({
                    status: 'error',
                    error: issue(
                        LEGACY_ERROR_CODES.INDEXEDDB_OPEN_ERROR,
                        missingAbortFailed
                            ? 'Aborting creation of the missing Legacy database failed.'
                            : 'The missing Legacy database was unexpectedly created.'
                    )
                });
                return;
            }
            if (settled) {
                request.result.close();
                return;
            }
            finish({ status: 'open', db: request.result });
        };
    });
}

export async function readLegacyIndexedDb({
    indexedDB: indexedDb = globalThis.indexedDB,
    now = Date.now(),
    openTimeoutMs = 5000,
    expectedCacheVersion = null,
    maxAgeMs = Infinity
} = {}) {
    const opened = await openLegacyDatabase(indexedDb, openTimeoutMs);

    if (opened.status === 'not-found') {
        return {
            status: 'not-found',
            database: LEGACY_DB_NAME,
            databaseVersion: null,
            entry: null,
            warnings: [],
            errors: []
        };
    }

    if (opened.status === 'error') {
        return {
            status: 'error',
            database: LEGACY_DB_NAME,
            databaseVersion: null,
            entry: null,
            warnings: [],
            errors: [opened.error]
        };
    }

    const { db } = opened;
    const databaseVersion = db.version;

    if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.close();
        return {
            status: 'error',
            database: LEGACY_DB_NAME,
            databaseVersion,
            entry: null,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.INDEXEDDB_STORE_NOT_FOUND,
                'The Legacy IndexedDB store does not exist.'
            )]
        };
    }

    return new Promise(resolve => {
        let settled = false;
        let transaction;

        const finish = result => {
            if (settled) return;
            settled = true;
            db.onversionchange = null;
            db.close();
            resolve(result);
        };

        db.onversionchange = () => {
            try {
                transaction?.abort();
            } catch {
                // The transaction may already be inactive.
            }
            finish({
                status: 'error',
                database: LEGACY_DB_NAME,
                databaseVersion,
                entry: null,
                warnings: [],
                errors: [issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_VERSIONCHANGE,
                    'The Legacy IndexedDB version changed while it was being read.'
                )]
            });
        };

        try {
            transaction = db.transaction(LEGACY_STORE_NAME, 'readonly');
            const request = transaction.objectStore(LEGACY_STORE_NAME).get(LEGACY_ACTIVITY_KEY);

            request.onerror = () => {
                finish({
                    status: 'error',
                    database: LEGACY_DB_NAME,
                    databaseVersion,
                    entry: null,
                    warnings: [],
                    errors: [issue(
                        LEGACY_ERROR_CODES.INDEXEDDB_READ_ERROR,
                        'Reading the Legacy IndexedDB entry failed.',
                        { cause: errorName(request.error) }
                    )]
                });
            };

            request.onsuccess = () => {
                const entry = request.result;
                if (entry === undefined || entry === null) {
                    finish({
                        status: 'not-found',
                        database: LEGACY_DB_NAME,
                        databaseVersion,
                        entry: null,
                        warnings: [],
                        errors: []
                    });
                    return;
                }

                if (!Array.isArray(entry.activities)) {
                    finish({
                        status: 'error',
                        database: LEGACY_DB_NAME,
                        databaseVersion,
                        entry,
                        warnings: [],
                        errors: [issue(
                            LEGACY_ERROR_CODES.ACTIVITIES_INVALID,
                            'The Legacy IndexedDB activities value is not an array.'
                        )]
                    });
                    return;
                }

                finish({
                    status: 'found',
                    database: LEGACY_DB_NAME,
                    databaseVersion,
                    entry,
                    warnings: cacheWarnings(entry, {
                        expectedCacheVersion,
                        maxAgeMs,
                        now: resolveNow(now)
                    }),
                    errors: []
                });
            };

            transaction.onerror = () => {
                finish({
                    status: 'error',
                    database: LEGACY_DB_NAME,
                    databaseVersion,
                    entry: null,
                    warnings: [],
                    errors: [issue(
                        LEGACY_ERROR_CODES.INDEXEDDB_READ_ERROR,
                        'The Legacy IndexedDB read transaction failed.',
                        { cause: errorName(transaction.error) }
                    )]
                });
            };

            transaction.onabort = transaction.onerror;
        } catch (error) {
            finish({
                status: 'error',
                database: LEGACY_DB_NAME,
                databaseVersion,
                entry: null,
                warnings: [],
                errors: [issue(
                    LEGACY_ERROR_CODES.INDEXEDDB_READ_ERROR,
                    'Starting the Legacy IndexedDB read transaction failed.',
                    { cause: errorName(error) }
                )]
            });
        }
    });
}

function readStorageValues(storage, keys) {
    if (!storage || typeof storage.getItem !== 'function') {
        return {
            ok: false,
            error: issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_ACCESS_ERROR,
                'localStorage is not available.'
            )
        };
    }

    try {
        return {
            ok: true,
            values: Object.fromEntries(keys.map(key => [key, storage.getItem(key)]))
        };
    } catch (error) {
        return {
            ok: false,
            error: issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_ACCESS_ERROR,
                'Reading localStorage failed.',
                { cause: errorName(error) }
            )
        };
    }
}

export function readLegacyLocalStorage({
    localStorage: storage = globalThis.localStorage,
    now = Date.now(),
    expectedCacheVersion = null,
    maxAgeMs = Infinity
} = {}) {
    const keys = [
        LEGACY_LOCAL_STORAGE_KEYS.activities,
        LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp,
        LEGACY_LOCAL_STORAGE_KEYS.cacheVersion
    ];
    const read = readStorageValues(storage, keys);

    if (!read.ok) {
        return {
            status: 'error',
            entry: null,
            warnings: [],
            errors: [read.error]
        };
    }

    const rawActivities = read.values[LEGACY_LOCAL_STORAGE_KEYS.activities];
    if (rawActivities === null) {
        return {
            status: 'not-found',
            entry: null,
            warnings: [],
            errors: []
        };
    }

    let activities;
    try {
        activities = JSON.parse(rawActivities);
    } catch {
        return {
            status: 'error',
            entry: null,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_MALFORMED_JSON,
                'The localStorage Legacy activities value is malformed JSON.'
            )]
        };
    }

    const entry = {
        key: LEGACY_ACTIVITY_KEY,
        activities,
        timestamp: Number(read.values[LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp]) || 0,
        cacheVersion: read.values[LEGACY_LOCAL_STORAGE_KEYS.cacheVersion]
    };

    if (!Array.isArray(activities)) {
        return {
            status: 'error',
            entry,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.ACTIVITIES_INVALID,
                'The localStorage Legacy activities value is not an array.'
            )]
        };
    }

    return {
        status: 'found',
        entry,
        warnings: cacheWarnings(entry, {
            expectedCacheVersion,
            maxAgeMs,
            now: resolveNow(now)
        }),
        errors: []
    };
}

export function readLegacyDemoSource({
    localStorage: storage = globalThis.localStorage
} = {}) {
    const keys = [
        LEGACY_LOCAL_STORAGE_KEYS.demoMode,
        LEGACY_LOCAL_STORAGE_KEYS.demoActivities
    ];
    const read = readStorageValues(storage, keys);

    if (!read.ok) {
        return {
            status: 'error',
            active: false,
            activities: null,
            warnings: [],
            errors: [read.error]
        };
    }

    const rawActivities = read.values[LEGACY_LOCAL_STORAGE_KEYS.demoActivities];
    const active = read.values[LEGACY_LOCAL_STORAGE_KEYS.demoMode] === 'true';
    if (rawActivities === null) {
        return {
            status: 'not-found',
            active,
            activities: null,
            warnings: [],
            errors: []
        };
    }

    let activities;
    try {
        activities = JSON.parse(rawActivities);
    } catch {
        return {
            status: 'error',
            active,
            activities: null,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_MALFORMED_JSON,
                'The Demo activities value is malformed JSON.'
            )]
        };
    }

    if (!Array.isArray(activities)) {
        return {
            status: 'error',
            active,
            activities,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.ACTIVITIES_INVALID,
                'The Demo activities value is not an array.'
            )]
        };
    }

    return {
        status: 'found',
        active,
        activities,
        warnings: [],
        errors: []
    };
}

export async function discoverLegacyCache({
    indexedDB: indexedDb = globalThis.indexedDB,
    localStorage: storage = globalThis.localStorage,
    now = Date.now(),
    openTimeoutMs = 5000,
    expectedCacheVersion = null,
    maxAgeMs = Infinity
} = {}) {
    const indexedDbSource = await readLegacyIndexedDb({
        indexedDB: indexedDb,
        now,
        openTimeoutMs,
        expectedCacheVersion,
        maxAgeMs
    });
    const localStorageSource = readLegacyLocalStorage({
        localStorage: storage,
        now,
        expectedCacheVersion,
        maxAgeMs
    });
    const demoSource = readLegacyDemoSource({ localStorage: storage });

    const selectedSource = indexedDbSource.status === 'found'
        ? 'indexedDb'
        : localStorageSource.status === 'found'
            ? 'localStorage'
            : null;
    const selected = selectedSource === 'indexedDb' ? indexedDbSource : localStorageSource;
    const activities = selectedSource ? selected.entry.activities : [];
    const warnings = [
        ...indexedDbSource.warnings,
        ...localStorageSource.warnings,
        ...demoSource.warnings
    ];

    if (selectedSource === 'localStorage') {
        warnings.push(issue(
            LEGACY_WARNING_CODES.LOCAL_STORAGE_FALLBACK_SELECTED,
            'Rescue Reader selected the localStorage fallback.'
        ));
    }
    if (demoSource.status === 'found') {
        warnings.push(issue(
            LEGACY_WARNING_CODES.DEMO_DATA_PRESENT,
            'Demo activities are present and are reported separately.'
        ));
    }

    const errors = [
        ...indexedDbSource.errors,
        ...localStorageSource.errors,
        ...demoSource.errors
    ];
    const { earliestActivity, latestActivity } = getActivityRange(activities);

    return {
        status: selectedSource
            ? errors.length > 0 ? 'partial' : 'found'
            : errors.length > 0 ? 'error' : 'empty',
        selectedSource,
        sources: {
            indexedDb: indexedDbSource,
            localStorage: localStorageSource,
            demo: demoSource
        },
        activities,
        activityCount: activities.length,
        earliestActivity,
        latestActivity,
        sourceDatabase: selectedSource === 'indexedDb' ? LEGACY_DB_NAME : null,
        sourceDatabaseVersion: selectedSource === 'indexedDb'
            ? indexedDbSource.databaseVersion
            : null,
        sourceCacheVersion: selectedSource ? selected.entry.cacheVersion ?? null : null,
        warnings,
        errors
    };
}
