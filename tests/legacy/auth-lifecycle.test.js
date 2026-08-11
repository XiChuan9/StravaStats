import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    IDBDatabase,
    IDBFactory,
    IDBObjectStore
} from 'fake-indexeddb';
import {
    AUTH_FAILURE_KIND,
    AUTH_LIFECYCLE_STATUS,
    createAuthLifecycle,
    inspectLegacyIndexedDbPresence
} from '../../js/app/auth-lifecycle.js';
import {
    API_AUTH_STATUS,
    ApiResponseError,
    classifyApiAuthFailure,
    handleApiResponse
} from '../../js/services/api.js';
import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_STORE_NAME
} from '../../js/services/legacy-cache/constants.js';

const SYNTHETIC_SECRET = 'synthetic-access-token-never-log';
const SYNTHETIC_REFRESH = 'synthetic-refresh-token-never-log';
const SYNTHETIC_ATHLETE_ID = 1001001;
const SYNTHETIC_OTHER_ATHLETE_ID = 2002002;

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(([key, value]) => [key, String(value)])
        );
        this.operations = [];
        this.setCalls = 0;
        this.getItemCalls = [];
        this.failGetItem = false;
        this.failRemoveItem = false;
    }

    get length() {
        return this.values.size;
    }

    key(index) {
        return [...this.values.keys()].sort()[index] ?? null;
    }

    getItem(key) {
        this.getItemCalls.push(key);
        if (this.failGetItem) throw new Error('SyntheticStorageReadFailure');
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.setCalls += 1;
        this.operations.push({ operation: 'set', key });
        this.values.set(key, String(value));
    }

    removeItem(key) {
        if (this.failRemoveItem) throw new Error('SyntheticStorageRemoveFailure');
        this.operations.push({ operation: 'remove', key });
        this.values.delete(key);
    }

    snapshot() {
        return Object.fromEntries([...this.values.entries()].sort());
    }
}

class AthleteOnlyReadableStorage extends MemoryStorage {
    getItem(key) {
        this.getItemCalls.push(key);
        if (key !== 'strava_athlete_data') {
            throw new Error(`Prohibited value read for ${key}`);
        }
        return this.values.has(key) ? this.values.get(key) : null;
    }
}

function syntheticLibrary({
    athleteId = SYNTHETIC_ATHLETE_ID,
    includeAthlete = true
} = {}) {
    return {
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET,
            refresh_token: SYNTHETIC_REFRESH,
            expires_at: 2000000000
        }),
        strava_activities: JSON.stringify([{
            id: 'synthetic-activity-001',
            name: 'Synthetic Activity',
            sport_type: 'Run'
        }]),
        strava_activities_timestamp: '1700000000000',
        strava_cache_version: 'synthetic-v1',
        ...(includeAthlete ? {
            strava_athlete_data: JSON.stringify({
                id: athleteId,
                firstname: 'Synthetic',
                lastname: 'Athlete'
            }),
            strava_athlete_data_timestamp: '1700000000000'
        } : {}),
        strava_training_zones: JSON.stringify({ zones: [] }),
        strava_training_zones_timestamp: '1700000000000',
        strava_gears: JSON.stringify([{ id: 'synthetic-gear-001' }]),
        strava_gears_timestamp: '1700000000000',
        dashboard_filters: JSON.stringify({ sport: 'Run' }),
        dashboard_readiness_hrv: JSON.stringify({ enabled: true }),
        dashboard_settings: JSON.stringify({ theme: 'dark' }),
        training_goals: JSON.stringify({ weeklyActivities: 4 }),
        run_plus_capacity_inputs_v1: JSON.stringify({ capacity: 42 }),
        'gear-custom-synthetic-001': JSON.stringify({ nickname: 'Synthetic Gear' }),
        strava_demo_mode: 'true',
        strava_demo_activities: JSON.stringify([{
            id: 'synthetic-demo-001'
        }]),
        legacy_rescue_export_marker: 'synthetic-export-preserved'
    };
}

function withoutToken(snapshot) {
    const copy = { ...snapshot };
    delete copy.strava_tokens;
    return copy;
}

function oauthResponse(athleteId = SYNTHETIC_ATHLETE_ID) {
    return {
        access_token: 'synthetic-new-access-token',
        refresh_token: 'synthetic-new-refresh-token',
        expires_at: 2100000000,
        athlete: athleteId === null ? {} : { id: athleteId }
    };
}

function sourceManagerOAuthResponse(subjectId = String(SYNTHETIC_ATHLETE_ID)) {
    return {
        access_token: 'synthetic-manager-access-token',
        refresh_token: 'synthetic-manager-refresh-token',
        expires_at: 2100000000,
        subject_id: subjectId,
        granted_scopes: ['read', 'activity:read_all']
    };
}

function lifecycle(storage, overrides = {}) {
    return createAuthLifecycle({
        storage,
        inspectIndexedDb: async () => ({
            confirmed: true,
            present: false
        }),
        revokeAccessToken: async () => ({ ok: true }),
        ...overrides
    });
}

function assertLibraryPreserved(storage, before) {
    assert.deepEqual(withoutToken(storage.snapshot()), withoutToken(before));
}

function apiFailureResponse(status, body = {}) {
    return {
        ok: false,
        status,
        statusText: 'Synthetic Failure',
        headers: { get: () => 'application/json' },
        json: async () => body
    };
}

async function createSyntheticLegacyDatabase(factory) {
    const db = await new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'key' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(LEGACY_STORE_NAME, 'readwrite');
        transaction.objectStore(LEGACY_STORE_NAME).put({
            key: LEGACY_ACTIVITY_KEY,
            activities: [{ id: 'synthetic-indexeddb-activity-001' }],
            timestamp: 1700000000000,
            cacheVersion: 'synthetic-v1'
        });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = transaction.onerror;
    });
    db.close();
}

async function createEmptySyntheticLegacyDatabase(factory, version = 1) {
    const db = await new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME, version);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'key' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    db.close();
}

async function readSyntheticLegacyEntry(factory) {
    const db = await new Promise((resolve, reject) => {
        const request = factory.open(LEGACY_DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    const entry = await new Promise((resolve, reject) => {
        const transaction = db.transaction(LEGACY_STORE_NAME, 'readonly');
        const request = transaction
            .objectStore(LEGACY_STORE_NAME)
            .get(LEGACY_ACTIVITY_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return entry;
}

function factoryWithoutDatabaseList(backing) {
    const openArguments = [];
    return {
        factory: {
            open(...args) {
                openArguments.push(args);
                return backing.open(...args);
            },
            deleteDatabase: name => backing.deleteDatabase(name)
        },
        openArguments
    };
}

function databaseDescriptor(version = 1) {
    return { name: LEGACY_DB_NAME, version };
}

function createLateProbeFactory({
    event,
    abortFails = false,
    lateDelayMs = 20
}) {
    const backing = new IDBFactory();
    let completeLateEvents;
    const lateEventsCompleted = new Promise(resolve => {
        completeLateEvents = resolve;
    });
    const counts = {
        abort: 0,
        createObjectStore: 0,
        deleteDatabase: 0,
        openWithVersion: 0
    };
    const factory = {
        databases: async () => [databaseDescriptor()],
        open(name, ...rest) {
            counts.openWithVersion += rest.length;
            const request = {};
            let aborted = false;
            request.transaction = {
                abort() {
                    counts.abort += 1;
                    if (abortFails) throw new Error('SyntheticProbeAbortFailure');
                    aborted = true;
                }
            };

            if (event === 'blocked') {
                queueMicrotask(() => request.onblocked?.());
            }
            setTimeout(() => {
                request.onupgradeneeded?.();
                if (aborted) {
                    request.error = { name: 'AbortError' };
                    request.onerror?.();
                    completeLateEvents();
                    return;
                }

                const realRequest = backing.open(name);
                realRequest.onupgradeneeded = () => {
                    // The probe must not create an object store.
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
            return backing.deleteDatabase(name);
        }
    };
    return { backing, counts, factory, lateEventsCompleted };
}

test('Disconnect revoke success removes only tokens and preserves Local Library', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const indexedDB = new IDBFactory();
    await createSyntheticLegacyDatabase(indexedDB);
    const indexedDbBefore = await readSyntheticLegacyEntry(indexedDB);
    let revokeCalls = 0;
    const result = await lifecycle(storage, {
        revokeAccessToken: async token => {
            revokeCalls += 1;
            assert.equal(token, SYNTHETIC_SECRET);
            return { ok: true };
        }
    }).disconnect();

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(revokeCalls, 1);
    assert.equal(storage.getItem('strava_tokens'), null);
    assertLibraryPreserved(storage, before);
    assert.deepEqual(
        await readSyntheticLegacyEntry(indexedDB),
        indexedDbBefore
    );
    assert.deepEqual(storage.operations, [{
        operation: 'remove',
        key: 'strava_tokens'
    }]);
});

test('V1 Disconnect keeps using the access token for exact five-field authority', async () => {
    const storage = new MemoryStorage({
        ...syntheticLibrary(),
        strava_tokens: JSON.stringify(sourceManagerOAuthResponse())
    });
    let received = null;
    const result = await lifecycle(storage, {
        revokeAccessToken: async token => {
            received = token;
            return true;
        }
    }).disconnect();

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(received, 'synthetic-manager-access-token');
    assert.equal(storage.getItem('strava_tokens'), null);
});

test('Source Manager Disconnect explicitly uses refresh token for exact five-field authority', async () => {
    const storage = new MemoryStorage({
        ...syntheticLibrary(),
        strava_tokens: JSON.stringify(sourceManagerOAuthResponse())
    });
    let received = null;
    const result = await lifecycle(storage, {
        revokeTokenKind: 'refresh',
        revokeAccessToken: async token => {
            received = token;
            return true;
        }
    }).disconnect();

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(received, 'synthetic-manager-refresh-token');
    assert.equal(storage.getItem('strava_tokens'), null);
});

test('Disconnect network failure returns revocation-unconfirmed and removes tokens', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => {
            throw new Error(`Synthetic network failure: ${SYNTHETIC_SECRET}`);
        }
    }).disconnect();

    assert.equal(
        result.status,
        AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
    );
    assert.equal(storage.getItem('strava_tokens'), null);
    assertLibraryPreserved(storage, before);
    assert.equal(JSON.stringify(result).includes(SYNTHETIC_SECRET), false);
});

test('Disconnect HTTP failure returns revocation-unconfirmed and removes tokens', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => ({
            ok: false,
            status: 503,
            responseBody: SYNTHETIC_SECRET
        })
    }).disconnect();

    assert.equal(
        result.status,
        AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
    );
    assert.equal(storage.getItem('strava_tokens'), null);
    assertLibraryPreserved(storage, before);
    assert.equal(JSON.stringify(result).includes(SYNTHETIC_SECRET), false);
});

test('Disconnect malformed token skips revoke and returns revocation-unconfirmed', async () => {
    const storage = new MemoryStorage({
        strava_tokens: '{"access_token":'
    });
    let revokeCalls = 0;
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => {
            revokeCalls += 1;
            return { ok: true };
        }
    }).disconnect();

    assert.equal(
        result.status,
        AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
    );
    assert.equal(revokeCalls, 0);
    assert.equal(storage.values.has('strava_tokens'), false);
    assert.equal(JSON.stringify(result).includes('access_token'), false);
});

test('Disconnect token without access_token returns revocation-unconfirmed', async () => {
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            refresh_token: SYNTHETIC_REFRESH,
            expires_at: 2000000000
        })
    });
    let revokeCalls = 0;
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => {
            revokeCalls += 1;
            return { ok: true };
        }
    }).disconnect();

    assert.equal(
        result.status,
        AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
    );
    assert.equal(revokeCalls, 0);
    assert.equal(storage.values.has('strava_tokens'), false);
    assert.equal(JSON.stringify(result).includes(SYNTHETIC_REFRESH), false);
});

test('Disconnect with no stored token returns success', async () => {
    const storage = new MemoryStorage({
        dashboard_settings: JSON.stringify({ theme: 'dark' })
    });
    let revokeCalls = 0;
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => {
            revokeCalls += 1;
            return { ok: true };
        }
    }).disconnect();

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(revokeCalls, 0);
    assert.equal(
        storage.getItem('dashboard_settings'),
        JSON.stringify({ theme: 'dark' })
    );
});

test('Disconnect token read failure still removes token and is unconfirmed', async () => {
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET
        })
    });
    storage.failGetItem = true;
    let revokeCalls = 0;
    const result = await lifecycle(storage, {
        revokeAccessToken: async () => {
            revokeCalls += 1;
            return { ok: true };
        }
    }).disconnect();

    assert.equal(
        result.status,
        AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
    );
    assert.equal(revokeCalls, 0);
    assert.equal(storage.values.has('strava_tokens'), false);
    assert.equal(JSON.stringify(result).includes(SYNTHETIC_SECRET), false);
});

test('Expired token removes only tokens and returns token-expired', () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = lifecycle(storage).expireToken();

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.TOKEN_EXPIRED);
    assert.equal(storage.getItem('strava_tokens'), null);
    assertLibraryPreserved(storage, before);
    assert.deepEqual(storage.operations, [{
        operation: 'remove',
        key: 'strava_tokens'
    }]);
});

test('failed exact-authority removal downgrades the surviving record to V1-only authority', () => {
    const storage = new MemoryStorage({
        ...syntheticLibrary(),
        strava_tokens: JSON.stringify(sourceManagerOAuthResponse())
    });
    storage.failRemoveItem = true;
    const instance = lifecycle(storage);

    assert.equal(instance.expireToken().status, AUTH_LIFECYCLE_STATUS.TOKEN_EXPIRED);
    assert.deepEqual(JSON.parse(storage.getItem('strava_tokens')), {
        access_token: 'synthetic-manager-access-token',
        refresh_token: 'synthetic-manager-refresh-token',
        expires_at: 2100000000
    });
    assert.deepEqual(instance.inspectTokenAuthority(), {
        status: 'legacy', subjectId: null
    });
});

test('Refresh failure preserves the complete Local Library and tokens', () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = lifecycle(storage).handleAuthFailure(
        AUTH_FAILURE_KIND.REFRESH_FAILURE
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.REFRESH_FAILED);
    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(storage.operations, []);
    assert.equal(
        classifyApiAuthFailure(500, { refreshFailure: true }),
        API_AUTH_STATUS.REFRESH_FAILED
    );
});

test('401 returns unauthenticated and preserves the complete Local Library', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = lifecycle(storage).handleAuthFailure(
        AUTH_FAILURE_KIND.UNAUTHORIZED
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED);
    await assert.rejects(
        handleApiResponse(apiFailureResponse(401)),
        error => (
            error instanceof ApiResponseError
            && error.authStatus === API_AUTH_STATUS.UNAUTHENTICATED
            && error.httpStatus === 401
        )
    );
    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(storage.operations, []);
});

test('403 returns forbidden and preserves the complete Local Library', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = lifecycle(storage).handleAuthFailure(
        AUTH_FAILURE_KIND.FORBIDDEN
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.FORBIDDEN);
    await assert.rejects(
        handleApiResponse(apiFailureResponse(403)),
        error => (
            error instanceof ApiResponseError
            && error.authStatus === API_AUTH_STATUS.FORBIDDEN
            && error.httpStatus === 403
        )
    );
    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(storage.operations, []);
});

test('OAuth same account updates tokens and preserves the Local Library', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        oauthResponse(SYNTHETIC_ATHLETE_ID)
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(result.firstLogin, false);
    assert.deepEqual(
        JSON.parse(storage.getItem('strava_tokens')),
        {
            access_token: 'synthetic-new-access-token',
            refresh_token: 'synthetic-new-refresh-token',
            expires_at: 2100000000
        }
    );
    assertLibraryPreserved(storage, before);
    assert.equal(storage.setCalls, 1);
});

test('Source Manager OAuth stores exact five-field authority after the Legacy guard', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const lifecycleInstance = lifecycle(storage);
    const result = await lifecycleInstance.acceptOAuthTokenResponse(
        sourceManagerOAuthResponse()
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.deepEqual(JSON.parse(storage.getItem('strava_tokens')), {
        access_token: 'synthetic-manager-access-token',
        refresh_token: 'synthetic-manager-refresh-token',
        expires_at: 2100000000,
        subject_id: String(SYNTHETIC_ATHLETE_ID),
        granted_scopes: ['read', 'activity:read_all']
    });
    assert.deepEqual(lifecycleInstance.inspectTokenAuthority(), {
        status: 'authority',
        subjectId: String(SYNTHETIC_ATHLETE_ID)
    });
});

test('Source Manager OAuth commit guard blocks a late Token write', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    let guardCalls = 0;
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        sourceManagerOAuthResponse(),
        () => {
            guardCalls += 1;
            return false;
        }
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED);
    assert.equal(guardCalls, 1);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
});

test('Source Manager subject mismatch preserves the prior Token byte-for-byte', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        sourceManagerOAuthResponse(String(SYNTHETIC_OTHER_ATHLETE_ID))
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.IDENTITY_MISMATCH);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
});

test('legacy three-field Token is reported as insufficient Source Manager authority', () => {
    const storage = new MemoryStorage(syntheticLibrary());
    assert.deepEqual(lifecycle(storage).inspectTokenAuthority(), {
        status: 'legacy',
        subjectId: null
    });
});

test('non-positive, fractional, and unsafe exact five-field expiries are never authority', () => {
    for (const expiresAt of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const storage = new MemoryStorage({
            strava_tokens: JSON.stringify({
                ...sourceManagerOAuthResponse(),
                expires_at: expiresAt
            })
        });
        assert.deepEqual(lifecycle(storage).inspectTokenAuthority(), {
            status: 'invalid', subjectId: null
        });
    }
});

test('OAuth identity guard reads only the athlete metadata value', async () => {
    const scenarios = [
        {
            includeAthlete: true,
            newAthleteId: SYNTHETIC_ATHLETE_ID,
            expectedStatus: AUTH_LIFECYCLE_STATUS.SUCCESS,
            expectedWrites: 1
        },
        {
            includeAthlete: true,
            newAthleteId: SYNTHETIC_OTHER_ATHLETE_ID,
            expectedStatus: AUTH_LIFECYCLE_STATUS.IDENTITY_MISMATCH,
            expectedWrites: 0
        },
        {
            includeAthlete: false,
            newAthleteId: SYNTHETIC_ATHLETE_ID,
            expectedStatus: AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED,
            expectedWrites: 0
        }
    ];

    for (const scenario of scenarios) {
        const storage = new AthleteOnlyReadableStorage(syntheticLibrary({
            includeAthlete: scenario.includeAthlete
        }));
        const result = await lifecycle(storage).acceptOAuthTokenResponse(
            oauthResponse(scenario.newAthleteId)
        );

        assert.equal(result.status, scenario.expectedStatus);
        assert.equal(storage.setCalls, scenario.expectedWrites);
        assert.deepEqual(storage.getItemCalls, ['strava_athlete_data']);
        assert.equal(
            storage.getItemCalls.filter(key => key === 'strava_activities').length,
            0
        );
    }
});

test('OAuth different account returns identity-mismatch with zero writes', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        oauthResponse(SYNTHETIC_OTHER_ATHLETE_ID)
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.IDENTITY_MISMATCH);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
    assert.deepEqual(storage.operations, []);
});

test('OAuth unknown old account returns identity-unconfirmed with zero writes', async () => {
    const storage = new MemoryStorage(syntheticLibrary({
        includeAthlete: false
    }));
    const before = storage.snapshot();
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        oauthResponse(SYNTHETIC_ATHLETE_ID)
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
    assert.deepEqual(storage.operations, []);
});

test('OAuth unknown new account returns identity-unconfirmed with zero writes', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const before = storage.snapshot();
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        oauthResponse(null)
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
    assert.deepEqual(storage.operations, []);
});

test('OAuth first login is allowed when no prior Local Library exists', async () => {
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET
        })
    });
    const result = await lifecycle(storage).acceptOAuthTokenResponse(
        oauthResponse(SYNTHETIC_ATHLETE_ID)
    );

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS);
    assert.equal(result.firstLogin, true);
    assert.equal(storage.setCalls, 1);
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        'synthetic-new-access-token'
    );
});

test('OAuth fails closed when IndexedDB presence cannot establish old identity', async () => {
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET
        })
    });
    const before = storage.snapshot();
    const result = await lifecycle(storage, {
        inspectIndexedDb: async () => ({
            confirmed: true,
            present: true
        })
    }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));

    assert.equal(result.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(storage.setCalls, 0);
});

test('IndexedDB identity inspection counts the key without reading activities', async () => {
    const indexedDB = new IDBFactory();
    await createSyntheticLegacyDatabase(indexedDB);
    const originalGet = IDBObjectStore.prototype.get;
    let getCalls = 0;
    IDBObjectStore.prototype.get = function prohibitedActivityRead(...args) {
        getCalls += 1;
        return originalGet.apply(this, args);
    };

    try {
        const result = await inspectLegacyIndexedDbPresence({
            indexedDB,
            openTimeoutMs: 50
        });
        assert.deepEqual(result, { confirmed: true, present: true });
        assert.equal(getCalls, 0);
    } finally {
        IDBObjectStore.prototype.get = originalGet;
    }
});

test('IndexedDB identity inspection does not create a missing database', async () => {
    const indexedDB = new IDBFactory();
    const result = await inspectLegacyIndexedDbPresence({
        indexedDB,
        openTimeoutMs: 50
    });

    assert.deepEqual(result, { confirmed: true, present: false });
    assert.deepEqual(await indexedDB.databases(), []);
});

test('Confirmed absent and valid empty keep distinct internal classifications', async () => {
    const absentFactory = new IDBFactory();
    const emptyFactory = new IDBFactory();
    await createEmptySyntheticLegacyDatabase(emptyFactory);
    const emptyBefore = await emptyFactory.databases();

    const absentInspection = await inspectLegacyIndexedDbPresence({
        indexedDB: absentFactory,
        openTimeoutMs: 50
    });
    const emptyInspection = await inspectLegacyIndexedDbPresence({
        indexedDB: emptyFactory,
        openTimeoutMs: 50
    });

    // The public compatibility envelope intentionally remains unchanged.
    assert.deepEqual(absentInspection, { confirmed: true, present: false });
    assert.deepEqual(emptyInspection, { confirmed: true, present: false });
    assert.deepEqual(await absentFactory.databases(), []);
    assert.deepEqual(await emptyFactory.databases(), emptyBefore);

    for (const [label, inspection] of [
        ['absent', absentInspection],
        ['empty', emptyInspection]
    ]) {
        const storage = new MemoryStorage();
        const result = await lifecycle(storage, {
            inspectIndexedDb: async () => inspection
        }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));
        assert.equal(result.status, AUTH_LIFECYCLE_STATUS.SUCCESS, label);
        assert.equal(result.firstLogin, true, label);
        assert.equal(storage.setCalls, 1, label);
    }

    const source = await readFile(
        new URL('../../js/app/auth-lifecycle.js', import.meta.url),
        'utf8'
    );
    assert.match(source, /indexedDbInspection\('absent'\)/);
    assert.match(source, /indexedDbInspection\([\s\S]*\? 'present' : 'empty'/);
});

test('Old, current, and future Legacy versions remain unchanged after empty inspection', async () => {
    for (const version of [1, 3, 7]) {
        const indexedDB = new IDBFactory();
        await createEmptySyntheticLegacyDatabase(indexedDB, version);
        const before = await indexedDB.databases();

        const result = await inspectLegacyIndexedDbPresence({
            indexedDB,
            openTimeoutMs: 50
        });

        assert.deepEqual(result, { confirmed: true, present: false }, String(version));
        assert.deepEqual(await indexedDB.databases(), before, String(version));
    }
});

test('Malformed Legacy store fails closed without repair, upgrade, delete, or Token write', async () => {
    const indexedDB = new IDBFactory();
    const malformed = await new Promise((resolve, reject) => {
        const request = indexedDB.open(LEGACY_DB_NAME, 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    malformed.close();
    const before = await indexedDB.databases();
    let deleteCalls = 0;
    const factory = {
        databases: () => indexedDB.databases(),
        open: (...args) => indexedDB.open(...args),
        deleteDatabase() {
            deleteCalls += 1;
            throw new Error('ProhibitedDelete');
        }
    };
    const inspection = await inspectLegacyIndexedDbPresence({
        indexedDB: factory,
        openTimeoutMs: 50
    });
    const storage = new MemoryStorage();
    const auth = await lifecycle(storage, {
        inspectIndexedDb: async () => inspection
    }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));

    assert.deepEqual(inspection, { confirmed: false, present: false });
    assert.equal(auth.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.equal(storage.setCalls, 0);
    assert.equal(deleteCalls, 0);
    assert.deepEqual(await indexedDB.databases(), before);
});

test('No databases API fails closed without opening or creating a database', async () => {
    const backing = new IDBFactory();
    const controlled = factoryWithoutDatabaseList(backing);
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET
        })
    });
    const originalCreateObjectStore = IDBDatabase.prototype.createObjectStore;
    let createObjectStoreCalls = 0;
    IDBDatabase.prototype.createObjectStore = function countCreateObjectStore(...args) {
        createObjectStoreCalls += 1;
        return originalCreateObjectStore.apply(this, args);
    };

    try {
        const inspection = await inspectLegacyIndexedDbPresence({
            indexedDB: controlled.factory,
            openTimeoutMs: 50
        });
        const oauthResult = await lifecycle(storage, {
            inspectIndexedDb: () => inspectLegacyIndexedDbPresence({
                indexedDB: controlled.factory,
                openTimeoutMs: 50
            })
        }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));

        assert.deepEqual(inspection, { confirmed: false, present: false });
        assert.equal(oauthResult.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
        assert.equal(createObjectStoreCalls, 0);
        assert.deepEqual(controlled.openArguments, []);
        assert.equal(storage.setCalls, 0);
        assert.deepEqual(await backing.databases(), []);
    } finally {
        IDBDatabase.prototype.createObjectStore = originalCreateObjectStore;
    }
});

test('No databases API cannot establish an existing entry and performs zero reads', async () => {
    const backing = new IDBFactory();
    await createSyntheticLegacyDatabase(backing);
    const controlled = factoryWithoutDatabaseList(backing);
    const storage = new MemoryStorage({
        strava_tokens: JSON.stringify({
            access_token: SYNTHETIC_SECRET
        })
    });
    const originalGet = IDBObjectStore.prototype.get;
    let getCalls = 0;
    IDBObjectStore.prototype.get = function prohibitedActivityRead(...args) {
        getCalls += 1;
        return originalGet.apply(this, args);
    };

    try {
        const inspection = await inspectLegacyIndexedDbPresence({
            indexedDB: controlled.factory,
            openTimeoutMs: 50
        });
        const before = storage.snapshot();
        const oauthResult = await lifecycle(storage, {
            inspectIndexedDb: () => inspectLegacyIndexedDbPresence({
                indexedDB: controlled.factory,
                openTimeoutMs: 50
            })
        }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));

        assert.deepEqual(inspection, { confirmed: false, present: false });
        assert.equal(
            oauthResult.status,
            AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED
        );
        assert.equal(getCalls, 0);
        assert.equal(storage.setCalls, 0);
        assert.deepEqual(storage.snapshot(), before);
        assert.deepEqual(controlled.openArguments, []);
    } finally {
        IDBObjectStore.prototype.get = originalGet;
    }
});

test('Database deletion between list and open leaves no probe database', async () => {
    const backing = new IDBFactory();
    const factory = {
        databases: async () => [{
            name: LEGACY_DB_NAME,
            version: 1
        }],
        open: (...args) => backing.open(...args),
        deleteDatabase: name => backing.deleteDatabase(name)
    };
    const originalCreateObjectStore = IDBDatabase.prototype.createObjectStore;
    let createObjectStoreCalls = 0;
    IDBDatabase.prototype.createObjectStore = function countCreateObjectStore(...args) {
        createObjectStoreCalls += 1;
        return originalCreateObjectStore.apply(this, args);
    };

    try {
        const result = await inspectLegacyIndexedDbPresence({
            indexedDB: factory,
            openTimeoutMs: 50
        });
        assert.deepEqual(result, { confirmed: false, present: false });
        assert.equal(createObjectStoreCalls, 0);
        assert.deepEqual(await backing.databases(), []);
    } finally {
        IDBDatabase.prototype.createObjectStore = originalCreateObjectStore;
    }
});

for (const event of ['timeout', 'blocked']) {
    test(`Late ${event} probe events finish without background mutation`, async () => {
        const controlled = createLateProbeFactory({
            event,
            lateDelayMs: 20
        });
        const result = await inspectLegacyIndexedDbPresence({
            indexedDB: controlled.factory,
            openTimeoutMs: event === 'timeout' ? 5 : 50
        });
        const databasesAtReturn = await controlled.backing.databases();
        await new Promise(resolve => setTimeout(resolve, 25));

        assert.deepEqual(result, { confirmed: false, present: false });
        assert.equal(controlled.counts.abort, 1);
        assert.equal(controlled.counts.createObjectStore, 0);
        assert.equal(controlled.counts.deleteDatabase, 0);
        assert.equal(controlled.counts.openWithVersion, 0);
        assert.deepEqual(databasesAtReturn, []);
        assert.deepEqual(await controlled.backing.databases(), databasesAtReturn);
    });
}

test('Accepted preflight race residual is only an empty version 1 database', async () => {
    const controlled = createLateProbeFactory({
        event: 'timeout',
        abortFails: true,
        lateDelayMs: 20
    });
    const result = await inspectLegacyIndexedDbPresence({
        indexedDB: controlled.factory,
        openTimeoutMs: 5
    });
    await controlled.lateEventsCompleted;

    assert.deepEqual(result, { confirmed: false, present: false });
    assert.equal(controlled.counts.abort, 1);
    assert.equal(controlled.counts.createObjectStore, 0);
    assert.equal(controlled.counts.deleteDatabase, 0);
    assert.equal(controlled.counts.openWithVersion, 0);
    const databases = await controlled.backing.databases();
    assert.ok(databases.length === 0 || databases.length === 1);
    if (databases.length === 1) {
        assert.deepEqual(databases, [databaseDescriptor()]);
        const residual = await new Promise((resolve, reject) => {
            const request = controlled.backing.open(LEGACY_DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
        assert.equal(residual.version, 1);
        assert.equal(
            residual.objectStoreNames.length,
            0,
            'zero stores permit zero user records'
        );
        residual.close();
    }

    const storage = new MemoryStorage();
    const oauthResult = await lifecycle(storage, {
        inspectIndexedDb: async () => result
    }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));
    assert.equal(oauthResult.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.equal(storage.setCalls, 0);
});

test('Unsafe databases enumeration fails closed with zero open, delete, or Token write', async () => {
    const cases = [
        ['reject', { databases: async () => { throw new Error('SyntheticListFailure'); } }],
        ['non-array', { databases: async () => ({}) }],
        ['non-finite-version', { databases: async () => [databaseDescriptor(Infinity)] }],
        ['accessor-descriptor', {
            databases: async () => [Object.defineProperty({}, 'name', {
                enumerable: true,
                get() { throw new Error('ProhibitedDescriptorGetter'); }
            })]
        }],
        ['proxy-list', { databases: async () => new Proxy([], {
            getPrototypeOf() { throw new Error('ProhibitedListTrap'); }
        }) }]
    ];

    for (const [label, base] of cases) {
        let openCalls = 0;
        let deleteCalls = 0;
        const indexedDB = {
            ...base,
            open() { openCalls += 1; throw new Error('ProhibitedOpen'); },
            deleteDatabase() { deleteCalls += 1; throw new Error('ProhibitedDelete'); }
        };
        const storage = new MemoryStorage({
            strava_tokens: JSON.stringify({ access_token: SYNTHETIC_SECRET })
        });
        const before = storage.snapshot();
        const inspect = () => inspectLegacyIndexedDbPresence({ indexedDB, openTimeoutMs: 5 });

        assert.deepEqual(await inspect(), { confirmed: false, present: false }, label);
        const oauthResult = await lifecycle(storage, { inspectIndexedDb: inspect })
            .acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));
        assert.equal(oauthResult.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED, label);
        assert.equal(openCalls, 0, label);
        assert.equal(deleteCalls, 0, label);
        assert.equal(storage.setCalls, 0, label);
        assert.deepEqual(storage.snapshot(), before, label);
    }
});

test('Pending database enumeration times out and late resolution never opens', async () => {
    let resolveDatabases;
    let openCalls = 0;
    let deleteCalls = 0;
    let trapCalls = 0;
    const indexedDB = {
        databases: () => new Promise(resolve => { resolveDatabases = resolve; }),
        open() { openCalls += 1; throw new Error('ProhibitedLateOpen'); },
        deleteDatabase() { deleteCalls += 1; throw new Error('ProhibitedDelete'); }
    };
    const storage = new MemoryStorage();
    const inspectionPromise = inspectLegacyIndexedDbPresence({
        indexedDB,
        openTimeoutMs: 5
    });
    const bounded = await Promise.race([
        inspectionPromise.then(() => 'settled'),
        new Promise(resolve => setTimeout(() => resolve('still-pending'), 25))
    ]);

    assert.equal(bounded, 'settled');
    const inspection = await inspectionPromise;
    assert.deepEqual(inspection, { confirmed: false, present: false });
    const auth = await lifecycle(storage, {
        inspectIndexedDb: async () => inspection
    }).acceptOAuthTokenResponse(oauthResponse(SYNTHETIC_ATHLETE_ID));
    assert.equal(auth.status, AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
    assert.equal(storage.setCalls, 0);

    resolveDatabases(new Proxy([], {
        getPrototypeOf() {
            trapCalls += 1;
            throw new Error('ProhibitedLateReflection');
        }
    }));
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(trapCalls, 0);
    assert.equal(openCalls, 0);
    assert.equal(deleteCalls, 0);
});

test('Authentication errors and stable results do not echo token material', async () => {
    const storage = new MemoryStorage(syntheticLibrary());
    const disconnectResult = await lifecycle(storage, {
        revokeAccessToken: async () => {
            throw new Error(`${SYNTHETIC_SECRET}:${SYNTHETIC_REFRESH}`);
        }
    }).disconnect();
    let apiError;
    try {
        await handleApiResponse(apiFailureResponse(401, {
            error: `${SYNTHETIC_SECRET}:${SYNTHETIC_REFRESH}`
        }));
    } catch (error) {
        apiError = error;
    }

    const publicEvidence = JSON.stringify({
        disconnectResult,
        apiError: {
            name: apiError.name,
            message: apiError.message,
            authStatus: apiError.authStatus,
            httpStatus: apiError.httpStatus
        }
    });
    assert.equal(publicEvidence.includes(SYNTHETIC_SECRET), false);
    assert.equal(publicEvidence.includes(SYNTHETIC_REFRESH), false);
});

test('Authentication implementation cannot call clearCachedActivities', async () => {
    const sourceUrls = [
        new URL('../../js/app/auth.js', import.meta.url),
        new URL('../../js/app/auth-lifecycle.js', import.meta.url),
        new URL('../../js/services/api.js', import.meta.url)
    ];
    const sources = await Promise.all(sourceUrls.map(url => readFile(url, 'utf8')));
    for (const source of sources) {
        assert.equal(source.includes('clearCachedActivities'), false);
    }
    assert.equal(sources[1].includes('deleteDatabase'), false);
});
