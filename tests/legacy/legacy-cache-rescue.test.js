import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
    IDBFactory,
    IDBObjectStore
} from 'fake-indexeddb';
import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_ERROR_CODES,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_STORE_NAME,
    LEGACY_WARNING_CODES,
    applyLegacyRestorePlan,
    buildLegacyBundle,
    createLegacyRestorePlan,
    discoverLegacyCache,
    readLegacyIndexedDb,
    restoreLegacyBundle,
    stableStringify,
    verifyLegacyBundle
} from '../../js/services/legacy-cache/index.js';
import { saveCachedActivities } from '../../js/services/activity-cache.js';

const FIXED_NOW = Date.parse('2026-01-15T12:00:00.000Z');
const FIXED_EXPORTED_AT = '2026-01-15T12:00:00.000Z';
const EXPECTED_CACHE_VERSION = 'synthetic-cache-v2';

const SYNTHETIC_ACTIVITIES = Object.freeze([
    Object.freeze({
        id: 'synthetic-run-001',
        name: 'Synthetic Morning Run',
        sport_type: 'Run',
        start_date: '2024-01-02T06:00:00.000Z'
    }),
    Object.freeze({
        id: 'synthetic-bike-002',
        name: 'Synthetic Lunch Ride',
        sport_type: 'Ride',
        start_date: '2024-02-03T12:00:00.000Z'
    }),
    Object.freeze({
        id: 'synthetic-swim-003',
        name: 'Synthetic Evening Swim',
        sport_type: 'Swim',
        start_date: '2024-03-04T18:00:00.000Z'
    })
]);

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function makeEntry(overrides = {}) {
    return {
        key: LEGACY_ACTIVITY_KEY,
        activities: clone(SYNTHETIC_ACTIVITIES),
        timestamp: FIXED_NOW - 1000,
        cacheVersion: EXPECTED_CACHE_VERSION,
        ...overrides
    };
}

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(([key, value]) => [key, String(value)])
        );
        this.setCalls = 0;
        this.failGet = false;
        this.failSet = null;
        this.failRemove = false;
        this.operations = [];
    }

    get length() {
        if (this.failGet) throw new Error('SyntheticStorageAccessError');
        return this.values.size;
    }

    key(index) {
        if (this.failGet) throw new Error('SyntheticStorageAccessError');
        return [...this.values.keys()].sort()[index] ?? null;
    }

    getItem(key) {
        if (this.failGet) throw new Error('SyntheticStorageAccessError');
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.setCalls += 1;
        this.operations.push({ operation: 'set', key });
        if (this.failSet?.({ key, value: String(value), call: this.setCalls })) {
            throw new Error('SyntheticQuotaExceededError');
        }
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.operations.push({ operation: 'remove', key });
        if (this.failRemove) throw new Error('SyntheticRemoveError');
        this.values.delete(key);
    }

    snapshot() {
        return Object.fromEntries([...this.values.entries()].sort());
    }
}

async function openDatabase(factory, version, onUpgrade) {
    return new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME, version);
        request.onupgradeneeded = () => onUpgrade?.(request.result);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function createLegacyDatabase(factory, {
    version = 1,
    entry = null
} = {}) {
    const db = await openDatabase(factory, version, database => {
        if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
            database.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'key' });
        }
    });

    if (entry) {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(LEGACY_STORE_NAME, 'readwrite');
            transaction.objectStore(LEGACY_STORE_NAME).put(entry);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = transaction.onerror;
        });
    }
    db.close();
}

async function readRawEntry(factory) {
    const databases = await factory.databases();
    if (!databases.some(database => database.name === LEGACY_DB_NAME)) return null;
    const db = await new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.close();
        return null;
    }
    const entry = await new Promise((resolve, reject) => {
        const transaction = db.transaction(LEGACY_STORE_NAME, 'readonly');
        const request = transaction.objectStore(LEGACY_STORE_NAME).get(LEGACY_ACTIVITY_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return entry;
}

async function writeRawEntry(factory, entry) {
    const db = await new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(LEGACY_STORE_NAME, 'readwrite');
        transaction.objectStore(LEGACY_STORE_NAME).put(entry);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = transaction.onerror;
    });
    db.close();
}

async function databaseNames(factory) {
    return (await factory.databases()).map(database => database.name).sort();
}

async function deleteLegacyDatabase(factory) {
    await new Promise((resolve, reject) => {
        const request = factory.deleteDatabase(LEGACY_DB_NAME);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('SyntheticDeleteBlocked'));
    });
}

async function upgradeLegacyDatabase(factory, version) {
    const db = await openDatabase(factory, version, () => {});
    db.close();
}

function storageWithFallback(entry = makeEntry()) {
    return new MemoryStorage({
        [LEGACY_LOCAL_STORAGE_KEYS.activities]: JSON.stringify(entry.activities),
        [LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp]: String(entry.timestamp),
        [LEGACY_LOCAL_STORAGE_KEYS.cacheVersion]: entry.cacheVersion
    });
}

function openEventFactory(eventName) {
    return {
        databases: async () => [{ name: LEGACY_DB_NAME, version: 1 }],
        open() {
            const request = {};
            queueMicrotask(() => {
                if (eventName === 'error') {
                    request.error = { name: 'SyntheticOpenError' };
                    request.onerror();
                } else {
                    request.onblocked();
                }
            });
            return request;
        }
    };
}

function createLateWriteOpenFactory({
    event,
    abortFails = false,
    deleteFails = false,
    lateDelayMs = 20
}) {
    const backing = new IDBFactory();
    const counts = {
        createObjectStore: 0,
        abort: 0,
        deleteDatabase: 0
    };
    let openCalls = 0;
    let completeLateEvents;
    const lateEventsCompleted = new Promise(resolve => {
        completeLateEvents = resolve;
    });

    const factory = {
        open(name, version) {
            openCalls += 1;
            const request = {};
            let aborted = false;
            request.transaction = {
                abort() {
                    counts.abort += 1;
                    if (abortFails) throw new Error('SyntheticLateAbortFailure');
                    aborted = true;
                }
            };
            request.result = {
                objectStoreNames: { contains: () => false },
                createObjectStore() {
                    counts.createObjectStore += 1;
                },
                close() {}
            };

            if (event === 'blocked') {
                setTimeout(() => request.onblocked?.(), 0);
            }
            setTimeout(() => {
                request.onupgradeneeded?.();
                if (aborted) {
                    request.error = { name: 'AbortError' };
                    request.onerror?.();
                    completeLateEvents();
                    return;
                }

                const realRequest = backing.open(name, version || 1);
                realRequest.onupgradeneeded = () => {
                    // The synthetic request owns no store creation after cancellation.
                };
                realRequest.onerror = () => {
                    request.error = realRequest.error;
                    request.onerror?.();
                    completeLateEvents();
                };
                realRequest.onsuccess = () => {
                    request.result = realRequest.result;
                    request.onsuccess?.();
                    completeLateEvents();
                };
            }, lateDelayMs);
            return request;
        },
        deleteDatabase(name) {
            counts.deleteDatabase += 1;
            if (!deleteFails) return backing.deleteDatabase(name);
            const request = {};
            setTimeout(() => request.onblocked?.(), 0);
            return request;
        },
        databases: () => backing.databases()
    };

    return {
        backing,
        counts,
        factory,
        lateEventsCompleted
    };
}

function createBlockedPreExistingWriteFactory(backing, concurrentEntry) {
    let openCalls = 0;
    let finishConcurrentWrite;
    const concurrentWriteCompleted = new Promise(resolve => {
        finishConcurrentWrite = resolve;
    });
    const factory = {
        databases: () => backing.databases(),
        deleteDatabase: name => backing.deleteDatabase(name),
        open(name, version) {
            openCalls += 1;
            if (openCalls === 1) {
                return version === undefined
                    ? backing.open(name)
                    : backing.open(name, version);
            }

            const request = {};
            queueMicrotask(() => request.onblocked?.());
            setTimeout(async () => {
                await writeRawEntry(backing, concurrentEntry);
                request.error = { name: 'SyntheticBlockedOpenFailure' };
                request.onerror?.();
                finishConcurrentWrite();
            }, 10);
            return request;
        }
    };
    return {
        concurrentWriteCompleted,
        factory,
        get openCalls() {
            return openCalls;
        }
    };
}

function createRollbackRaceFactory(backing, concurrentEntry) {
    let openCalls = 0;
    let finishConcurrentWrite;
    const concurrentWriteCompleted = new Promise(resolve => {
        finishConcurrentWrite = resolve;
    });
    const forwardOpen = (request, name, version) => {
        const realRequest = version === undefined
            ? backing.open(name)
            : backing.open(name, version);
        realRequest.onblocked = () => request.onblocked?.();
        realRequest.onupgradeneeded = () => {
            request.result = realRequest.result;
            request.transaction = realRequest.transaction;
            request.onupgradeneeded?.();
        };
        realRequest.onerror = () => {
            request.error = realRequest.error;
            request.onerror?.();
        };
        realRequest.onsuccess = () => {
            request.result = realRequest.result;
            request.onsuccess?.();
        };
    };
    const factory = {
        databases: () => backing.databases(),
        deleteDatabase: name => backing.deleteDatabase(name),
        open(name, version) {
            openCalls += 1;
            if (openCalls !== 3) {
                return version === undefined
                    ? backing.open(name)
                    : backing.open(name, version);
            }

            const request = {};
            void writeRawEntry(backing, concurrentEntry).then(() => {
                finishConcurrentWrite();
                forwardOpen(request, name, version);
            });
            return request;
        }
    };
    return {
        concurrentWriteCompleted,
        factory,
        get openCalls() {
            return openCalls;
        }
    };
}

async function buildSyntheticBundle({
    demo = false,
    applicationCommit = 'synthetic-commit-001'
} = {}) {
    const indexedDB = new IDBFactory();
    await createLegacyDatabase(indexedDB, { entry: makeEntry() });
    const localStorage = new MemoryStorage({
        strava_athlete_data: JSON.stringify({ id: 'synthetic-athlete-001' }),
        strava_training_zones: JSON.stringify({ zoneCount: 5 }),
        strava_gears: JSON.stringify([{ id: 'synthetic-gear-001' }]),
        dashboard_filters: JSON.stringify({ sport: 'Run' }),
        dashboard_readiness_hrv: JSON.stringify({ enabled: true }),
        dashboard_settings: JSON.stringify({
            access_token: 'must-be-excluded',
            refreshToken: 'must-be-excluded',
            token: 'must-be-excluded',
            theme: 'dark'
        }),
        training_goals: JSON.stringify({ weeklyActivities: 4 }),
        run_plus_capacity_inputs_v1: JSON.stringify({ capacity: 42 }),
        run_plus_nsm_settings_v1: JSON.stringify({ enabled: true }),
        run_plus_nsm_activity_tags_v1: JSON.stringify({ 'synthetic-run-001': ['easy'] }),
        run_plus_nsm_session_inputs_v1: JSON.stringify({ session: 'synthetic' }),
        run_plus_nsm_tests_v1: JSON.stringify([{ id: 'synthetic-test-001' }]),
        run_plus_nsm_interval_analysis_v1: JSON.stringify({ intervals: [] }),
        'gear-custom-synthetic-bike': JSON.stringify({ nickname: 'Synthetic Bike' }),
        'gear-custom': JSON.stringify({ excluded: true }),
        'gear_custom-synthetic-bike': JSON.stringify({ excluded: true }),
        strava_tokens: JSON.stringify({ access_token: 'must-be-excluded' }),
        gemini_api_key: 'must-be-excluded',
        ai_chat_history: JSON.stringify([{ message: 'must-be-excluded' }]),
        unknown_setting: JSON.stringify({ excluded: true }),
        ...(demo ? {
            strava_demo_mode: 'true',
            strava_demo_activities: JSON.stringify([
                {
                    id: 'synthetic-demo-001',
                    name: 'Synthetic Demo Activity',
                    start_date: '2024-04-05T08:00:00.000Z'
                }
            ])
        } : {})
    });
    const rescueResult = await discoverLegacyCache({
        indexedDB,
        localStorage,
        now: FIXED_NOW,
        expectedCacheVersion: EXPECTED_CACHE_VERSION,
        maxAgeMs: 60_000
    });
    const built = await buildLegacyBundle({
        rescueResult,
        localStorage,
        exportedAt: FIXED_EXPORTED_AT,
        applicationCommit,
        crypto: webcrypto
    });
    return { built, indexedDB, localStorage, rescueResult };
}

test('Reader returns an unexpired IndexedDB cache without mutation', async () => {
    const indexedDB = new IDBFactory();
    const entry = makeEntry();
    await createLegacyDatabase(indexedDB, { entry });
    const localStorage = new MemoryStorage();
    const before = stableStringify(await readRawEntry(indexedDB));

    const result = await discoverLegacyCache({
        indexedDB,
        localStorage,
        now: FIXED_NOW,
        expectedCacheVersion: EXPECTED_CACHE_VERSION,
        maxAgeMs: 60_000
    });

    assert.equal(result.status, 'found');
    assert.equal(result.selectedSource, 'indexedDb');
    assert.equal(result.activityCount, 3);
    assert.equal(result.sourceDatabaseVersion, 1);
    assert.deepEqual(result.warnings, []);
    assert.equal(stableStringify(await readRawEntry(indexedDB)), before);
});

test('Reader returns stale and cacheVersion-mismatched entries with warnings', async () => {
    const indexedDB = new IDBFactory();
    await createLegacyDatabase(indexedDB, {
        entry: makeEntry({
            timestamp: FIXED_NOW - 120_000,
            cacheVersion: 'synthetic-cache-v1'
        })
    });

    const result = await discoverLegacyCache({
        indexedDB,
        localStorage: new MemoryStorage(),
        now: FIXED_NOW,
        expectedCacheVersion: EXPECTED_CACHE_VERSION,
        maxAgeMs: 60_000
    });

    assert.equal(result.selectedSource, 'indexedDb');
    assert.deepEqual(
        result.warnings.map(warning => warning.code),
        [
            LEGACY_WARNING_CODES.CACHE_STALE,
            LEGACY_WARNING_CODES.CACHE_VERSION_MISMATCH
        ]
    );
});

test('Reader preserves old, current, and future Legacy database versions', async () => {
    for (const version of [1, 3, 7]) {
        const indexedDB = new IDBFactory();
        await createLegacyDatabase(indexedDB, { version, entry: makeEntry() });
        const before = await indexedDB.databases();

        const result = await discoverLegacyCache({
            indexedDB,
            localStorage: new MemoryStorage(),
            now: FIXED_NOW
        });

        assert.equal(result.selectedSource, 'indexedDb', String(version));
        assert.equal(result.sourceDatabaseVersion, version, String(version));
        assert.deepEqual(await indexedDB.databases(), before, String(version));
    }
});

test('Reader distinguishes a valid empty store from a malformed database without repair', async () => {
    const emptyFactory = new IDBFactory();
    await createLegacyDatabase(emptyFactory, { version: 3 });
    const emptyBefore = await emptyFactory.databases();
    const empty = await readLegacyIndexedDb({
        indexedDB: emptyFactory,
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert.equal(empty.status, 'not-found');
    assert.equal(empty.databaseVersion, 3);
    assert.deepEqual(await emptyFactory.databases(), emptyBefore);

    const malformedFactory = new IDBFactory();
    const malformedDb = await openDatabase(malformedFactory, 3);
    malformedDb.close();
    const malformedBefore = await malformedFactory.databases();
    const malformed = await readLegacyIndexedDb({
        indexedDB: malformedFactory,
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert.equal(malformed.status, 'error');
    assert.equal(
        malformed.errors[0].code,
        LEGACY_ERROR_CODES.INDEXEDDB_STORE_NOT_FOUND
    );
    assert.deepEqual(await malformedFactory.databases(), malformedBefore);
});

test('Reader does not create a missing database', async () => {
    const indexedDB = new IDBFactory();
    const result = await discoverLegacyCache({
        indexedDB,
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });

    assert.equal(result.status, 'empty');
    assert.equal(result.sources.indexedDb.status, 'not-found');
    assert.deepEqual(await indexedDB.databases(), []);
});

test('Reader accepted preflight race residual has version 1 and zero stores', async () => {
    const backing = new IDBFactory();
    const counts = { abort: 0, delete: 0, open: 0 };
    const indexedDB = {
        databases: async () => [{ name: LEGACY_DB_NAME, version: 1 }],
        open(name) {
            counts.open += 1;
            const request = {};
            request.transaction = {
                abort() {
                    counts.abort += 1;
                    throw new Error('SyntheticReaderAbortFailure');
                }
            };
            queueMicrotask(() => {
                request.onupgradeneeded?.();
                const realRequest = backing.open(name);
                realRequest.onsuccess = () => {
                    request.result = realRequest.result;
                    request.onsuccess?.();
                };
                realRequest.onerror = () => {
                    request.error = realRequest.error;
                    request.onerror?.();
                };
            });
            return request;
        },
        deleteDatabase(name) {
            counts.delete += 1;
            return backing.deleteDatabase(name);
        }
    };

    const result = await readLegacyIndexedDb({
        indexedDB,
        openTimeoutMs: 50,
        now: FIXED_NOW
    });

    assert.equal(result.status, 'error');
    assert.equal(counts.open, 1);
    assert.equal(counts.abort, 1);
    assert.equal(counts.delete, 0);
    assert.deepEqual(await backing.databases(), [{
        name: LEGACY_DB_NAME,
        version: 1
    }]);
    const residual = await openDatabase(backing);
    assert.equal(residual.version, 1);
    assert.equal(residual.objectStoreNames.length, 0);
    residual.close();
});

for (const lateEvent of ['success', 'error']) {
    test(`Reader timeout ignores late ${lateEvent} without database mutation`, async () => {
        const backing = new IDBFactory();
        await createLegacyDatabase(backing, { version: 3, entry: makeEntry() });
        const before = await backing.databases();
        let closeCalls = 0;
        const indexedDB = {
            databases: () => backing.databases(),
            open(name) {
                const request = {};
                setTimeout(() => {
                    if (lateEvent === 'error') {
                        request.error = { name: 'SyntheticLateOpenError' };
                        request.onerror?.();
                        return;
                    }
                    const realRequest = backing.open(name);
                    realRequest.onerror = () => {
                        request.error = realRequest.error;
                        request.onerror?.();
                    };
                    realRequest.onsuccess = () => {
                        request.result = {
                            close() {
                                closeCalls += 1;
                                realRequest.result.close();
                            }
                        };
                        request.onsuccess?.();
                    };
                }, 20);
                return request;
            }
        };

        const result = await readLegacyIndexedDb({
            indexedDB,
            openTimeoutMs: 5,
            now: FIXED_NOW
        });
        await new Promise(resolve => setTimeout(resolve, 30));

        assert.equal(result.status, 'error');
        assert.equal(result.errors[0].code, LEGACY_ERROR_CODES.INDEXEDDB_TIMEOUT);
        assert.equal(closeCalls, lateEvent === 'success' ? 1 : 0);
        assert.deepEqual(await backing.databases(), before);
    });
}

test('Reader without safe database enumeration returns an error without opening', async () => {
    let openCalls = 0;
    const indexedDB = {
        open() {
            openCalls += 1;
            throw new Error('ProhibitedOpen');
        }
    };

    const result = await discoverLegacyCache({
        indexedDB,
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });

    assert.equal(result.status, 'error');
    assert(result.errors.some(error => (
        error.code === LEGACY_ERROR_CODES.INDEXEDDB_NOT_AVAILABLE
    )));
    assert.equal(openCalls, 0);
});

test('Reader rejects unsafe database lists without open, delete, upgrade, or writes', async () => {
    const cases = [
        ['reject', async () => { throw new Error('SyntheticListFailure'); }],
        ['non-array', async () => ({})],
        ['non-finite', async () => [{ name: LEGACY_DB_NAME, version: NaN }]],
        ['accessor', async () => [Object.defineProperty({}, 'name', {
            enumerable: true,
            get() { throw new Error('ProhibitedGetter'); }
        })]],
        ['proxy', async () => new Proxy([], {
            ownKeys() { throw new Error('ProhibitedListTrap'); }
        })]
    ];

    for (const [label, databases] of cases) {
        const counts = { open: 0, delete: 0 };
        const result = await readLegacyIndexedDb({
            indexedDB: {
                databases,
                open() { counts.open += 1; throw new Error('ProhibitedOpen'); },
                deleteDatabase() { counts.delete += 1; throw new Error('ProhibitedDelete'); }
            },
            openTimeoutMs: 5,
            now: FIXED_NOW
        });
        assert.equal(result.status, 'error', label);
        assert.equal(counts.open, 0, label);
        assert.equal(counts.delete, 0, label);
    }
});

test('Reader selects localStorage fallback and reports IndexedDB errors', async () => {
    const result = await discoverLegacyCache({
        indexedDB: openEventFactory('error'),
        localStorage: storageWithFallback(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });

    assert.equal(result.status, 'partial');
    assert.equal(result.selectedSource, 'localStorage');
    assert.equal(result.activityCount, 3);
    assert(result.errors.some(error => error.code === LEGACY_ERROR_CODES.INDEXEDDB_OPEN_ERROR));
    assert(result.warnings.some(
        warning => warning.code === LEGACY_WARNING_CODES.LOCAL_STORAGE_FALLBACK_SELECTED
    ));
});

test('Reader distinguishes malformed JSON and non-array activities', async () => {
    const malformed = await discoverLegacyCache({
        indexedDB: new IDBFactory(),
        localStorage: new MemoryStorage({
            [LEGACY_LOCAL_STORAGE_KEYS.activities]: '{'
        }),
        now: FIXED_NOW
    });
    assert.equal(malformed.status, 'error');
    assert(malformed.errors.some(
        error => error.code === LEGACY_ERROR_CODES.LOCAL_STORAGE_MALFORMED_JSON
    ));

    const invalid = await discoverLegacyCache({
        indexedDB: new IDBFactory(),
        localStorage: new MemoryStorage({
            [LEGACY_LOCAL_STORAGE_KEYS.activities]: JSON.stringify({ invalid: true })
        }),
        now: FIXED_NOW
    });
    assert.equal(invalid.status, 'error');
    assert(invalid.errors.some(error => error.code === LEGACY_ERROR_CODES.ACTIVITIES_INVALID));
});

test('Reader distinguishes blocked, timeout, storage access error, and empty', async () => {
    const blocked = await discoverLegacyCache({
        indexedDB: openEventFactory('blocked'),
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert(blocked.errors.some(error => error.code === LEGACY_ERROR_CODES.INDEXEDDB_BLOCKED));

    const timeout = await discoverLegacyCache({
        indexedDB: {
            databases: async () => [{ name: LEGACY_DB_NAME, version: 1 }],
            open: () => ({})
        },
        localStorage: new MemoryStorage(),
        openTimeoutMs: 5,
        now: FIXED_NOW
    });
    assert(timeout.errors.some(error => error.code === LEGACY_ERROR_CODES.INDEXEDDB_TIMEOUT));

    const inaccessibleStorage = new MemoryStorage();
    inaccessibleStorage.failGet = true;
    const accessError = await discoverLegacyCache({
        indexedDB: new IDBFactory(),
        localStorage: inaccessibleStorage,
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert(accessError.errors.some(
        error => error.code === LEGACY_ERROR_CODES.LOCAL_STORAGE_ACCESS_ERROR
    ));

    const empty = await discoverLegacyCache({
        indexedDB: new IDBFactory(),
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert.equal(empty.status, 'empty');
    assert.deepEqual(empty.errors, []);
});

test('Reader handles versionchange as a structured error', async () => {
    const transaction = {
        abort() {},
        objectStore() {
            return { get: () => ({}) };
        }
    };
    const db = {
        version: 4,
        objectStoreNames: { contains: () => true },
        close() {},
        transaction: () => transaction,
        set onversionchange(handler) {
            if (handler) queueMicrotask(handler);
        }
    };
    const indexedDB = {
        databases: async () => [{ name: LEGACY_DB_NAME, version: 4 }],
        open() {
            const request = { result: db };
            queueMicrotask(() => request.onsuccess());
            return request;
        }
    };

    const result = await discoverLegacyCache({
        indexedDB,
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    assert(result.errors.some(
        error => error.code === LEGACY_ERROR_CODES.INDEXEDDB_VERSIONCHANGE
    ));
});

test('Reader leaves IndexedDB and localStorage unchanged and never calls fetch', async () => {
    const indexedDB = new IDBFactory();
    await createLegacyDatabase(indexedDB, { entry: makeEntry() });
    const localStorage = storageWithFallback();
    const beforeDb = stableStringify(await readRawEntry(indexedDB));
    const beforeStorage = localStorage.snapshot();
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('Network access is prohibited in this test.');
    };

    try {
        await discoverLegacyCache({ indexedDB, localStorage, now: FIXED_NOW });
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0);
    assert.equal(stableStringify(await readRawEntry(indexedDB)), beforeDb);
    assert.deepEqual(localStorage.snapshot(), beforeStorage);
});

test('Reader production source contains no destructive or write-capable IndexedDB operation', async () => {
    const source = await readFile(
        new URL('../../js/services/legacy-cache/reader.js', import.meta.url),
        'utf8'
    );
    assert.doesNotMatch(
        source,
        /deleteDatabase|createObjectStore|objectStore[^\n;]*\.(?:clear|delete|put|add)\s*\(|['"]readwrite['"]/
    );
});

test('Reader reports Demo data separately without selecting it as Legacy activities', async () => {
    const indexedDB = new IDBFactory();
    await createLegacyDatabase(indexedDB, { entry: makeEntry() });
    const localStorage = new MemoryStorage({
        strava_demo_mode: 'true',
        strava_demo_activities: JSON.stringify([{
            id: 'synthetic-demo-separate-001',
            name: 'Synthetic Separate Demo',
            start_date: '2024-06-07T08:00:00.000Z'
        }])
    });

    const result = await discoverLegacyCache({
        indexedDB,
        localStorage,
        now: FIXED_NOW
    });

    assert.equal(result.selectedSource, 'indexedDb');
    assert.equal(result.activityCount, 3);
    assert.equal(result.sources.demo.status, 'found');
    assert.equal(result.sources.demo.activities[0].id, 'synthetic-demo-separate-001');
    assert.equal(result.activities.some(activity => activity.id.includes('demo')), false);
});

test('Bundle contains six deterministic logical files and valid hashes', async () => {
    const first = await buildSyntheticBundle();
    const second = await buildLegacyBundle({
        rescueResult: first.rescueResult,
        localStorage: first.localStorage,
        exportedAt: FIXED_EXPORTED_AT,
        applicationCommit: 'synthetic-commit-001',
        crypto: webcrypto
    });

    assert.equal(first.built.bytes, second.bytes);
    assert.deepEqual(
        Object.keys(first.built.bundle.files).sort(),
        [
            'legacy-activities.json',
            'legacy-athlete.json',
            'legacy-gears.json',
            'legacy-settings.json',
            'legacy-zones.json',
            'manifest.json'
        ]
    );
    assert(first.built.manifest.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256)));
    assert(first.built.manifest.files.every(file => file.filename !== 'manifest.json'));
    assert(Object.values(first.built.bundle.files).every(contents => !contents.endsWith('\n')));

    const verification = await verifyLegacyBundle(first.built.bytes, { crypto: webcrypto });
    assert.equal(verification.valid, true);
    assert.deepEqual(verification.errors, []);
});

test('Bundle manifest records injected metadata and null applicationCommit warning', async () => {
    const { built } = await buildSyntheticBundle({ applicationCommit: null });
    assert.equal(built.manifest.exportedAt, FIXED_EXPORTED_AT);
    assert.equal(built.manifest.applicationCommit, null);
    assert.equal(built.manifest.activityCount, 3);
    assert.equal(built.manifest.earliestActivity, '2024-01-02T06:00:00.000Z');
    assert.equal(built.manifest.latestActivity, '2024-03-04T18:00:00.000Z');
    assert(built.manifest.warnings.some(
        warning => warning.code === LEGACY_WARNING_CODES.APPLICATION_COMMIT_UNAVAILABLE
    ));
});

test('Bundle settings use the exact allowlist and strict gear-custom- prefix', async () => {
    const { built } = await buildSyntheticBundle();
    const settings = JSON.parse(built.bundle.files['legacy-settings.json']);
    const keys = Object.keys(settings.entries).sort();

    assert.deepEqual(keys, [
        'dashboard_filters',
        'dashboard_readiness_hrv',
        'dashboard_settings',
        'gear-custom-synthetic-bike',
        'run_plus_capacity_inputs_v1',
        'run_plus_nsm_activity_tags_v1',
        'run_plus_nsm_interval_analysis_v1',
        'run_plus_nsm_session_inputs_v1',
        'run_plus_nsm_settings_v1',
        'run_plus_nsm_tests_v1',
        'training_goals'
    ]);
    assert.equal(settings.entries.dashboard_settings.value.access_token, undefined);
    assert.equal(settings.entries.dashboard_settings.value.refreshToken, undefined);
    assert.equal(settings.entries.dashboard_settings.value.token, undefined);
});

test('Bundle excludes tokens, API keys, AI history, Demo namespace, and unknown keys', async () => {
    const { built } = await buildSyntheticBundle({ demo: true });
    const bytes = built.bytes;

    assert.equal(bytes.includes('strava_tokens'), false);
    assert.equal(bytes.includes('gemini_api_key'), false);
    assert.equal(bytes.includes('ai_chat_history'), false);
    assert.equal(bytes.includes('strava_demo_activities'), false);
    assert.equal(bytes.includes('unknown_setting'), false);
    assert.equal(bytes.includes('must-be-excluded'), false);
    assert(built.manifest.warnings.some(
        warning => warning.code === LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN
    ));
    assert(built.manifest.warnings.some(
        warning => warning.code === LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED
    ));
});

test('Bundle rejects empty and error Rescue Reader results', async () => {
    const empty = await discoverLegacyCache({
        indexedDB: new IDBFactory(),
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    await assert.rejects(
        buildLegacyBundle({
            rescueResult: empty,
            localStorage: new MemoryStorage(),
            exportedAt: FIXED_EXPORTED_AT,
            applicationCommit: 'synthetic-commit-001',
            crypto: webcrypto
        }),
        error => error.code === LEGACY_ERROR_CODES.RESCUE_SOURCE_NOT_EXPORTABLE
    );

    const errorResult = await discoverLegacyCache({
        indexedDB: openEventFactory('error'),
        localStorage: new MemoryStorage(),
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    await assert.rejects(
        buildLegacyBundle({
            rescueResult: errorResult,
            localStorage: new MemoryStorage(),
            exportedAt: FIXED_EXPORTED_AT,
            applicationCommit: 'synthetic-commit-001',
            crypto: webcrypto
        }),
        error => error.code === LEGACY_ERROR_CODES.RESCUE_SOURCE_NOT_EXPORTABLE
    );
});

test('Bundle accepts a found selected source in a partial result with hashed source errors', async () => {
    const localStorage = storageWithFallback();
    const partial = await discoverLegacyCache({
        indexedDB: openEventFactory('error'),
        localStorage,
        openTimeoutMs: 50,
        now: FIXED_NOW
    });
    const built = await buildLegacyBundle({
        rescueResult: partial,
        localStorage,
        exportedAt: FIXED_EXPORTED_AT,
        applicationCommit: 'synthetic-commit-001',
        crypto: webcrypto
    });
    const activitiesPayload = JSON.parse(
        built.bundle.files['legacy-activities.json']
    );
    const sourceWarning = built.manifest.warnings.find(
        warning => warning.code === LEGACY_WARNING_CODES.SOURCE_READ_ERROR
    );

    assert.equal(partial.status, 'partial');
    assert.deepEqual(
        activitiesPayload.provenance.evidenceCodes,
        [LEGACY_WARNING_CODES.SOURCE_READ_ERROR]
    );
    assert(activitiesPayload.provenance.sourceErrorCodes.includes(
        LEGACY_ERROR_CODES.INDEXEDDB_OPEN_ERROR
    ));
    assert.deepEqual(
        sourceWarning.sourceErrorCodes,
        activitiesPayload.provenance.sourceErrorCodes
    );
    assert.equal(Object.hasOwn(sourceWarning, 'message'), false);
    assert.equal(built.bytes.includes('SyntheticOpenError'), false);
    assert.equal(
        (await verifyLegacyBundle(built.bytes, { crypto: webcrypto })).valid,
        true
    );
});

test('Sensitive redaction is hashed, observable, secret-free, and source-preserving', async () => {
    const indexedDB = new IDBFactory();
    const sensitiveEntry = makeEntry({
        activities: [{
            ...clone(SYNTHETIC_ACTIVITIES[0]),
            accessToken: 'synthetic-secret-must-not-export',
            note: 'tokenization drill is legitimate text'
        }]
    });
    await createLegacyDatabase(indexedDB, { entry: sensitiveEntry });
    const localStorage = new MemoryStorage({
        dashboard_settings: JSON.stringify({
            apiKey: 'synthetic-key-must-not-export',
            label: 'tokenized training label'
        }),
        dashboard_readiness_hrv: 'access_token=synthetic-raw-secret',
        training_goals: 'tokenization drill is legitimate raw text'
    });
    const dbBefore = stableStringify(await readRawEntry(indexedDB));
    const storageBefore = localStorage.snapshot();
    const rescueResult = await discoverLegacyCache({
        indexedDB,
        localStorage,
        now: FIXED_NOW
    });

    const built = await buildLegacyBundle({
        rescueResult,
        localStorage,
        exportedAt: FIXED_EXPORTED_AT,
        applicationCommit: 'synthetic-commit-001',
        crypto: webcrypto
    });
    const activitiesPayload = JSON.parse(
        built.bundle.files['legacy-activities.json']
    );
    const settingsPayload = JSON.parse(
        built.bundle.files['legacy-settings.json']
    );
    const warning = built.manifest.warnings.find(
        item => item.code === LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED
    );

    assert.equal(built.bytes.includes('synthetic-secret-must-not-export'), false);
    assert.equal(built.bytes.includes('synthetic-key-must-not-export'), false);
    assert.equal(built.bytes.includes('synthetic-raw-secret'), false);
    assert.equal(
        activitiesPayload.activities[0].note,
        'tokenization drill is legitimate text'
    );
    assert.equal(
        settingsPayload.entries.dashboard_settings.value.label,
        'tokenized training label'
    );
    assert.equal(
        settingsPayload.entries.training_goals.value,
        'tokenization drill is legitimate raw text'
    );
    assert.equal(
        Object.hasOwn(settingsPayload.entries, 'dashboard_readiness_hrv'),
        false
    );
    assert.deepEqual(
        activitiesPayload.redaction.evidenceCodes,
        [LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED]
    );
    assert.deepEqual(
        settingsPayload.redaction.evidenceCodes,
        [LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED]
    );
    assert.deepEqual(warning.logicalFiles, [
        'legacy-activities.json',
        'legacy-settings.json'
    ]);
    assert.equal(
        (await verifyLegacyBundle(built.bytes, { crypto: webcrypto })).valid,
        true
    );
    assert.equal(stableStringify(await readRawEntry(indexedDB)), dbBefore);
    assert.deepEqual(localStorage.snapshot(), storageBefore);
});

test('Removing manifest redaction warning invalidates hashed evidence consistency', async () => {
    const { built } = await buildSyntheticBundle();
    const tampered = clone(built.bundle);
    const manifest = JSON.parse(tampered.files['manifest.json']);
    manifest.warnings = manifest.warnings.filter(
        warning => warning.code !== LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED
    );
    tampered.files['manifest.json'] = stableStringify(manifest);

    const verification = await verifyLegacyBundle(tampered, { crypto: webcrypto });
    assert.equal(verification.valid, false);
    assert(verification.errors.some(error => (
        error.code === LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID
    )));
});

test('Bundle verification rejects a one-byte logical-file mutation', async () => {
    const { built } = await buildSyntheticBundle();
    const tampered = clone(built.bundle);
    const original = tampered.files['legacy-activities.json'];
    tampered.files['legacy-activities.json'] = `${original.slice(0, -1)} `;

    const verification = await verifyLegacyBundle(tampered, { crypto: webcrypto });
    assert.equal(verification.valid, false);
    assert(verification.errors.some(
        error => error.code === LEGACY_ERROR_CODES.BUNDLE_HASH_MISMATCH
    ));
});

test('Bundle verification rejects non-deterministically serialized logical JSON', async () => {
    const { built } = await buildSyntheticBundle();
    const nonDeterministic = clone(built.bundle);
    nonDeterministic.files['legacy-settings.json'] = `${
        nonDeterministic.files['legacy-settings.json']
    }\n`;

    const verification = await verifyLegacyBundle(nonDeterministic, { crypto: webcrypto });
    assert.equal(verification.valid, false);
    assert(verification.errors.some(
        error => error.code === LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID
    ));
});

test('Bundle build and verification failures do not modify source data', async () => {
    const source = await buildSyntheticBundle();
    const dbBefore = stableStringify(await readRawEntry(source.indexedDB));
    const storageBefore = source.localStorage.snapshot();

    await assert.rejects(
        buildLegacyBundle({
            rescueResult: source.rescueResult,
            localStorage: source.localStorage,
            applicationCommit: 'synthetic-commit-001',
            crypto: webcrypto
        }),
        /exportedAt/
    );
    await verifyLegacyBundle('{"invalid":', { crypto: webcrypto });

    assert.equal(stableStringify(await readRawEntry(source.indexedDB)), dbBefore);
    assert.deepEqual(source.localStorage.snapshot(), storageBefore);
});

test('Restore succeeds only into an empty target and preserves the bundle', async () => {
    const { built } = await buildSyntheticBundle();
    const bundleBefore = built.bytes;
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'restored');
    assert.deepEqual((await readRawEntry(targetIndexedDB)).activities, clone(SYNTHETIC_ACTIVITIES));
    assert.equal(
        JSON.parse(targetStorage.getItem('dashboard_settings')).theme,
        'dark'
    );
    assert.equal(built.bytes, bundleBefore);
});

test('Restore returns no-op for an identical target', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    const second = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(second.status, 'noop');
    assert.deepEqual(second.imported, []);
});

test('Restore succeeds into a pre-existing empty version 1 database', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'restored');
    assert.deepEqual(await databaseNames(targetIndexedDB), [LEGACY_DB_NAME]);
    assert.equal((await targetIndexedDB.databases())[0].version, 1);
    assert.deepEqual((await readRawEntry(targetIndexedDB)).activities, clone(SYNTHETIC_ACTIVITIES));
});

test('Restore aborts for a non-empty conflicting target', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const conflictingEntry = makeEntry({
        activities: [{
            id: 'synthetic-conflict-001',
            name: 'Synthetic Conflict',
            start_date: '2024-05-06T07:00:00.000Z'
        }]
    });
    await createLegacyDatabase(targetIndexedDB, { entry: conflictingEntry });
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT));
    assert.deepEqual(await readRawEntry(targetIndexedDB), conflictingEntry);
});

test('Restore treats orphaned activity metadata as a non-empty conflict', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage({
        [LEGACY_LOCAL_STORAGE_KEYS.cacheVersion]: 'synthetic-orphan-version'
    });

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT));
    assert.equal(
        targetStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.cacheVersion),
        'synthetic-orphan-version'
    );
});

test('Restore apply aborts if the empty target changes after planning', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(plan.action, 'restore');
    targetStorage.setItem('gear-custom-late-change', JSON.stringify({ changed: true }));

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT));
    assert.equal(await readRawEntry(targetIndexedDB), null);
    assert.equal(
        targetStorage.getItem('gear-custom-late-change'),
        JSON.stringify({ changed: true })
    );
});

test('Restore rejects forged or mutated plan data and deep-freezes issued plans', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(plan.action, 'restore');
    assertDeepFrozen(plan);
    assert.throws(() => {
        plan.desired.indexedDbEntry.activities.push({
            id: 'synthetic-mutation-001'
        });
    }, TypeError);

    const forgedPlan = clone(plan);
    forgedPlan.desired.indexedDbEntry.activities = [{
        id: 'synthetic-forged-001',
        name: 'Synthetic Forged Activity',
        start_date: '2024-08-09T10:00:00.000Z'
    }];
    const result = await applyLegacyRestorePlan(forgedPlan, {
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(
        error => error.code === LEGACY_ERROR_CODES.RESTORE_PLAN_INVALID
    ));
    assert.deepEqual(await databaseNames(targetIndexedDB), []);
    assert.deepEqual(targetStorage.snapshot(), {});
});

test('Restore aborts unsupported target database versions', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB, { version: 2 });
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION
    )));
    assert.deepEqual(await databaseNames(targetIndexedDB), [LEGACY_DB_NAME]);
    assert.equal((await targetIndexedDB.databases())[0].version, 2);
});

test('Restore aborts an incompatible target without the Legacy store', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const incompatible = await openDatabase(targetIndexedDB, 1, () => {});
    incompatible.close();

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: new MemoryStorage(),
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION
    )));
    assert.deepEqual(await databaseNames(targetIndexedDB), [LEGACY_DB_NAME]);
});

test('Restore fails closed if target database is deleted after planning', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(plan.action, 'restore');
    await deleteLegacyDatabase(targetIndexedDB);

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT));
    assert.deepEqual(await databaseNames(targetIndexedDB), []);
});

test('Restore fails closed if target database is created after planning', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(plan.action, 'restore');
    await createLegacyDatabase(targetIndexedDB);

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT));
    assert.deepEqual(await databaseNames(targetIndexedDB), [LEGACY_DB_NAME]);
    assert.equal(await readRawEntry(targetIndexedDB), null);
});

test('Restore fails closed if target database is upgraded after planning', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(plan.action, 'restore');
    await upgradeLegacyDatabase(targetIndexedDB, 2);

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION
    )));
    assert.equal((await targetIndexedDB.databases())[0].version, 2);
});

test('Restore open timeout cancels late upgrade without background mutation', async () => {
    const { built } = await buildSyntheticBundle();
    const planningIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: planningIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const controlled = createLateWriteOpenFactory({
        event: 'timeout',
        lateDelayMs: 20
    });

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 5
    });
    const databasesAtReturn = await databaseNames(controlled.backing);
    await controlled.lateEventsCompleted;
    await new Promise(resolve => setTimeout(resolve, 25));

    assert.equal(result.status, 'failed');
    assert.equal(controlled.counts.createObjectStore, 0);
    assert.equal(controlled.counts.abort, 1);
    assert.equal(controlled.counts.deleteDatabase, 0);
    assert.deepEqual(databasesAtReturn, []);
    assert.deepEqual(await databaseNames(controlled.backing), databasesAtReturn);
    assert.equal(
        targetStorage.operations.filter(item => item.operation === 'set').length,
        0
    );
});

test('Restore blocked open cancels late upgrade without background mutation', async () => {
    const { built } = await buildSyntheticBundle();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: new IDBFactory(),
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const controlled = createLateWriteOpenFactory({
        event: 'blocked',
        lateDelayMs: 10
    });

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });
    const databasesAtReturn = await databaseNames(controlled.backing);
    await controlled.lateEventsCompleted;
    await new Promise(resolve => setTimeout(resolve, 25));

    assert.equal(result.status, 'failed');
    assert.equal(controlled.counts.createObjectStore, 0);
    assert.equal(controlled.counts.abort, 1);
    assert.equal(controlled.counts.deleteDatabase, 0);
    assert.deepEqual(databasesAtReturn, []);
    assert.deepEqual(await databaseNames(controlled.backing), databasesAtReturn);
    assert.equal(
        targetStorage.operations.filter(item => item.operation === 'set').length,
        0
    );
});

test('Restore deletes a database created after cancelled upgrade abort failure', async () => {
    const { built } = await buildSyntheticBundle();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: new IDBFactory(),
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const controlled = createLateWriteOpenFactory({
        event: 'timeout',
        abortFails: true,
        lateDelayMs: 20
    });

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 5
    });

    assert.equal(result.status, 'failed');
    assert.equal(controlled.counts.createObjectStore, 0);
    assert.equal(controlled.counts.abort, 1);
    assert.equal(controlled.counts.deleteDatabase, 1);
    assert(result.rolledBack.includes('indexedDbDatabase'));
    assert.deepEqual(await databaseNames(controlled.backing), []);
    assert.equal(
        targetStorage.operations.filter(item => item.operation === 'set').length,
        0
    );
});

test('Restore reports partial rollback when cancelled-upgrade database deletion fails', async () => {
    const { built } = await buildSyntheticBundle();
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: new IDBFactory(),
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const controlled = createLateWriteOpenFactory({
        event: 'blocked',
        abortFails: true,
        deleteFails: true,
        lateDelayMs: 10
    });

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'partial-rollback');
    assert.equal(controlled.counts.createObjectStore, 0);
    assert.equal(controlled.counts.abort, 1);
    assert.equal(controlled.counts.deleteDatabase, 1);
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED
    )));
    assert.deepEqual(await databaseNames(controlled.backing), [LEGACY_DB_NAME]);
    assert.equal(
        targetStorage.operations.filter(item => item.operation === 'set').length,
        0
    );
});

test('Restore validation failure performs zero writes', async () => {
    const { built } = await buildSyntheticBundle();
    const tampered = clone(built.bundle);
    tampered.files['legacy-activities.json'] += ' ';
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: tampered,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert.equal(await readRawEntry(targetIndexedDB), null);
    assert.deepEqual(targetStorage.snapshot(), {});
});

test('Restore manifest validation failure performs zero writes', async () => {
    const { built } = await buildSyntheticBundle();
    const invalidManifestBundle = clone(built.bundle);
    const manifest = JSON.parse(invalidManifestBundle.files['manifest.json']);
    manifest.activityCount = 99;
    invalidManifestBundle.files['manifest.json'] = stableStringify(manifest);
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();

    const result = await restoreLegacyBundle({
        bundle: invalidManifestBundle,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'aborted');
    assert(result.failed.some(
        error => error.code === LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID
    ));
    assert.equal(await readRawEntry(targetIndexedDB), null);
    assert.deepEqual(targetStorage.snapshot(), {});
});

test('Restore requires explicit confirmation for uncertain provenance', async () => {
    const { built } = await buildSyntheticBundle({ demo: true });
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();

    const blocked = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    assert.equal(blocked.status, 'aborted');
    assert(blocked.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_PROVENANCE_CONFIRMATION_REQUIRED
    )));
    assert.equal(await readRawEntry(targetIndexedDB), null);
    assert.deepEqual(targetStorage.snapshot(), {});

    const confirmedPlan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        confirmProvenance: true,
        openTimeoutMs: 50
    });
    assert.equal(confirmedPlan.action, 'restore');
});

test('Removing manifest provenance warning cannot bypass confirmation', async () => {
    const { built } = await buildSyntheticBundle({ demo: true });
    const tampered = clone(built.bundle);
    const manifest = JSON.parse(tampered.files['manifest.json']);
    manifest.warnings = manifest.warnings.filter(
        warning => warning.code !== LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN
    );
    tampered.files['manifest.json'] = stableStringify(manifest);
    const verification = await verifyLegacyBundle(tampered, { crypto: webcrypto });
    assert.equal(verification.valid, false);
    assert(verification.errors.some(error => (
        error.code === LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID
    )));

    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const result = await restoreLegacyBundle({
        bundle: tampered,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        confirmProvenance: true,
        openTimeoutMs: 50
    });
    assert.equal(result.status, 'aborted');
    assert.deepEqual(await databaseNames(targetIndexedDB), []);
    assert.deepEqual(targetStorage.snapshot(), {});
});

test('Pre-existing blocked write preserves a concurrent entry without compensation', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const concurrentEntry = makeEntry({
        activities: [{
            id: 'synthetic-concurrent-001',
            name: 'Synthetic Concurrent Activity',
            sport_type: 'Run',
            start_date: '2025-01-02T03:04:05.000Z'
        }],
        cacheVersion: 'synthetic-concurrent-version',
        timestamp: FIXED_NOW + 1234
    });
    const controlled = createBlockedPreExistingWriteFactory(
        targetIndexedDB,
        concurrentEntry
    );

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });
    await controlled.concurrentWriteCompleted;

    assert.equal(result.status, 'failed');
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_CONFLICT
    )));
    assert.equal(result.rolledBack.includes('indexedDbEntry'), false);
    assert.deepEqual(await readRawEntry(targetIndexedDB), concurrentEntry);
    assert.equal(targetStorage.setCalls, 0);
    assert.equal(controlled.openCalls, 2);
});

test('Pre-existing transaction failure does not run entry compensation', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const originalPut = IDBObjectStore.prototype.put;
    const originalDelete = IDBObjectStore.prototype.delete;
    let compensationDeletes = 0;
    IDBObjectStore.prototype.put = function syntheticRestorePutFailure(value) {
        if (value?.key === LEGACY_ACTIVITY_KEY) {
            throw new Error('SyntheticPreCommitWriteFailure');
        }
        return originalPut.call(this, value);
    };
    IDBObjectStore.prototype.delete = function countCompensationDelete(...args) {
        compensationDeletes += 1;
        return originalDelete.apply(this, args);
    };

    try {
        const result = await applyLegacyRestorePlan(plan, {
            indexedDB: targetIndexedDB,
            localStorage: targetStorage,
            openTimeoutMs: 50
        });

        assert.equal(result.status, 'failed');
        assert(result.failed.some(error => (
            error.code === LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED
        )));
        assert.equal(result.rolledBack.includes('indexedDbEntry'), false);
        assert.equal(compensationDeletes, 0);
        assert.equal(await readRawEntry(targetIndexedDB), null);
        assert.equal(targetStorage.setCalls, 0);
    } finally {
        IDBObjectStore.prototype.put = originalPut;
        IDBObjectStore.prototype.delete = originalDelete;
    }
});

test('IndexedDB restore write failure leaves the target empty', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function syntheticPutFailure() {
        throw new Error('SyntheticIndexedDbWriteError');
    };

    try {
        const result = await restoreLegacyBundle({
            bundle: built.bytes,
            indexedDB: targetIndexedDB,
            localStorage: targetStorage,
            crypto: webcrypto,
            openTimeoutMs: 50
        });
        assert.equal(result.status, 'failed');
        assert(result.failed.some(
            error => error.code === LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED
        ));
        assert(result.rolledBack.includes('indexedDbDatabase'));
        assert.equal(await readRawEntry(targetIndexedDB), null);
        assert.deepEqual(await databaseNames(targetIndexedDB), []);
        assert.deepEqual(targetStorage.snapshot(), {});
    } finally {
        IDBObjectStore.prototype.put = originalPut;
    }
});

test('localStorage restore failure rolls back IndexedDB and localStorage', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    targetStorage.failSet = ({ call }) => call === 2;

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'failed');
    assert(result.rolledBack.includes('indexedDbDatabase'));
    assert(result.rolledBack.includes('localStorage'));
    assert.equal(await readRawEntry(targetIndexedDB), null);
    assert.deepEqual(await databaseNames(targetIndexedDB), []);
    assert.deepEqual(targetStorage.snapshot(), {});
});

test('Committed restore rolls back an unchanged entry after localStorage failure', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    targetStorage.failSet = ({ call }) => call === 2;

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'failed');
    assert(result.imported.includes(`indexedDb:${LEGACY_ACTIVITY_KEY}`));
    assert(result.rolledBack.includes('indexedDbEntry'));
    assert.equal(result.rolledBack.includes('indexedDbDatabase'), false);
    assert.deepEqual(await databaseNames(targetIndexedDB), [LEGACY_DB_NAME]);
    assert.equal((await targetIndexedDB.databases())[0].version, 1);
    assert.equal(await readRawEntry(targetIndexedDB), null);
});

test('Rollback preserves an entry replaced after restore commit', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    await createLegacyDatabase(targetIndexedDB);
    const targetStorage = new MemoryStorage();
    targetStorage.failSet = ({ call }) => call === 2;
    const plan = await createLegacyRestorePlan({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });
    const concurrentEntry = makeEntry({
        activities: [{
            id: 'synthetic-concurrent-rollback-001',
            name: 'Synthetic Concurrent Rollback Activity',
            sport_type: 'Ride',
            start_date: '2025-02-03T04:05:06.000Z'
        }],
        cacheVersion: 'synthetic-concurrent-rollback-version',
        timestamp: FIXED_NOW + 5678
    });
    const controlled = createRollbackRaceFactory(
        targetIndexedDB,
        concurrentEntry
    );

    const result = await applyLegacyRestorePlan(plan, {
        indexedDB: controlled.factory,
        localStorage: targetStorage,
        openTimeoutMs: 50
    });
    await controlled.concurrentWriteCompleted;

    assert.equal(result.status, 'partial-rollback');
    assert(result.failed.some(error => (
        error.code === LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED
        && error.causeCode === LEGACY_ERROR_CODES.RESTORE_CONFLICT
    )));
    assert.equal(result.rolledBack.includes('indexedDbEntry'), false);
    assert(result.rolledBack.includes('localStorage'));
    assert.deepEqual(await readRawEntry(targetIndexedDB), concurrentEntry);
    assert.deepEqual(targetStorage.snapshot(), {});
    assert.equal(controlled.openCalls, 3);
});

test('rollback failure is returned as a structured partial-rollback report', async () => {
    const { built } = await buildSyntheticBundle();
    const targetIndexedDB = new IDBFactory();
    const targetStorage = new MemoryStorage();
    targetStorage.failSet = ({ call }) => call === 2;
    targetStorage.failRemove = true;

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB: targetIndexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'partial-rollback');
    assert(result.failed.some(
        error => error.code === LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED
    ));
    assert(result.rolledBack.includes('indexedDbDatabase'));
    assert.deepEqual(await databaseNames(targetIndexedDB), []);
});

test('created-database deletion failure returns partial-rollback', async () => {
    const { built } = await buildSyntheticBundle();
    const backingIndexedDB = new IDBFactory();
    const indexedDB = {
        open: (...args) => backingIndexedDB.open(...args),
        databases: () => backingIndexedDB.databases(),
        deleteDatabase() {
            const request = {};
            queueMicrotask(() => request.onblocked());
            return request;
        }
    };
    const targetStorage = new MemoryStorage();
    targetStorage.failSet = ({ call }) => call === 2;

    const result = await restoreLegacyBundle({
        bundle: built.bytes,
        indexedDB,
        localStorage: targetStorage,
        crypto: webcrypto,
        openTimeoutMs: 50
    });

    assert.equal(result.status, 'partial-rollback');
    assert(result.failed.some(
        error => error.code === LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED
    ));
    assert.deepEqual(await databaseNames(backingIndexedDB), [LEGACY_DB_NAME]);
});

async function withActivityCacheGlobals({ indexedDB, localStorage }, callback) {
    const originalIndexedDb = globalThis.indexedDB;
    const originalLocalStorage = globalThis.localStorage;
    const originalWarn = console.warn;
    globalThis.indexedDB = indexedDB;
    globalThis.localStorage = localStorage;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        return {
            value: await callback(),
            warnings
        };
    } finally {
        console.warn = originalWarn;
        if (originalIndexedDb === undefined) delete globalThis.indexedDB;
        else globalThis.indexedDB = originalIndexedDb;
        if (originalLocalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalLocalStorage;
    }
}

test('activity-cache fallback quota error preserves prior payload, timestamp, and version', async () => {
    const storage = storageWithFallback(makeEntry({
        activities: [clone(SYNTHETIC_ACTIVITIES[0])],
        timestamp: FIXED_NOW - 5000,
        cacheVersion: 'synthetic-old-version'
    }));
    const before = storage.snapshot();
    storage.failSet = ({ key }) => key === LEGACY_LOCAL_STORAGE_KEYS.activities;

    const { value: saved } = await withActivityCacheGlobals({
        indexedDB: openEventFactory('error'),
        localStorage: storage
    }, () => saveCachedActivities(clone(SYNTHETIC_ACTIVITIES), EXPECTED_CACHE_VERSION));

    assert.equal(saved, false);
    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(
        storage.operations.filter(item => item.operation === 'set').slice(0, 3),
        [
            { operation: 'set', key: LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp },
            { operation: 'set', key: LEGACY_LOCAL_STORAGE_KEYS.cacheVersion },
            { operation: 'set', key: LEGACY_LOCAL_STORAGE_KEYS.activities }
        ]
    );
});

test('activity-cache metadata-first failure never touches the old payload', async () => {
    const storage = storageWithFallback(makeEntry({
        activities: [clone(SYNTHETIC_ACTIVITIES[0])],
        timestamp: FIXED_NOW - 5000,
        cacheVersion: 'synthetic-old-version'
    }));
    const before = storage.snapshot();
    let failed = false;
    storage.failSet = ({ key }) => {
        if (!failed && key === LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp) {
            failed = true;
            return true;
        }
        return false;
    };

    const { value: saved } = await withActivityCacheGlobals({
        indexedDB: openEventFactory('error'),
        localStorage: storage
    }, () => saveCachedActivities(clone(SYNTHETIC_ACTIVITIES), EXPECTED_CACHE_VERSION));

    assert.equal(saved, false);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(
        storage.operations.some(item => (
            item.operation === 'set'
            && item.key === LEGACY_LOCAL_STORAGE_KEYS.activities
        )),
        false
    );
});

test('activity-cache explicitly reports fallback rollback failure without touching payload', async () => {
    const storage = storageWithFallback(makeEntry({
        activities: [clone(SYNTHETIC_ACTIVITIES[0])],
        timestamp: FIXED_NOW - 5000,
        cacheVersion: 'synthetic-old-version'
    }));
    const payloadBefore = storage.getItem(LEGACY_LOCAL_STORAGE_KEYS.activities);
    storage.failSet = ({ call }) => call >= 2;

    const { value: saved, warnings } = await withActivityCacheGlobals({
        indexedDB: openEventFactory('error'),
        localStorage: storage
    }, () => saveCachedActivities(clone(SYNTHETIC_ACTIVITIES), EXPECTED_CACHE_VERSION));

    assert.equal(saved, false);
    assert.equal(
        storage.getItem(LEGACY_LOCAL_STORAGE_KEYS.activities),
        payloadBefore
    );
    assert(warnings.some(args => (
        args[0] === 'Failed to fully restore the previous localStorage activity cache:'
    )));
});
