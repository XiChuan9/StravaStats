import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    DEMO_ACTIVITIES_KEY,
    DEMO_ATHLETE_KEY,
    DEMO_ATHLETE_TIMESTAMP_KEY,
    DEMO_GEARS_KEY,
    DEMO_GEARS_TIMESTAMP_KEY,
    DEMO_MODE_KEY,
    DEMO_STORAGE_ERROR,
    DEMO_STORAGE_KEYS,
    DEMO_TOKENS_KEY,
    DEMO_TRAINING_ZONES_KEY,
    DEMO_TRAINING_ZONES_TIMESTAMP_KEY,
    clearDemoData,
    getDemoActivities,
    getDemoAthlete,
    getDemoGears,
    getDemoTokens,
    getDemoTrainingZones,
    loadDemoData
} from '../../js/demo/index.js';
import {
    fetchAllActivities,
    fetchAllGears,
    fetchAthleteData,
    fetchGearById,
    fetchTrainingZones,
    getCachedGears,
    setCachedGears
} from '../../js/services/api.js';

const FIXED_NOW = '2026-07-29T08:30:00.000Z';
const FIXED_NOW_MS = Date.parse(FIXED_NOW);
const FIXED_REFERENCE_DATE = '2026-07-29T12:00:00.000Z';
const REAL_ACCESS_TOKEN = 'synthetic-real-access-token';
const REAL_REFRESH_TOKEN = 'synthetic-real-refresh-token';
const ATHLETE_ID = 1001001;

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(([key, value]) => [key, String(value)])
        );
        this.operations = [];
        this.getItemCalls = [];
        this.failSetKeyOnce = null;
        this.failedSet = false;
        this.forbiddenReads = new Set();
    }

    get length() {
        return this.values.size;
    }

    key(index) {
        return [...this.values.keys()].sort()[index] ?? null;
    }

    getItem(key) {
        this.getItemCalls.push(key);
        if (this.forbiddenReads.has(key)) {
            throw new Error(`Prohibited synthetic read: ${key}`);
        }
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.operations.push({ operation: 'set', key });
        if (key === this.failSetKeyOnce && !this.failedSet) {
            this.failedSet = true;
            throw new Error('Synthetic demo write failure');
        }
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.operations.push({ operation: 'remove', key });
        this.values.delete(key);
    }

    snapshot() {
        return Object.fromEntries([...this.values.entries()].sort());
    }
}

function realLibrary() {
    return {
        strava_tokens: JSON.stringify({
            access_token: REAL_ACCESS_TOKEN,
            refresh_token: REAL_REFRESH_TOKEN,
            expires_at: 2100000000
        }),
        strava_activities: '[{"id":"synthetic-real-activity-001"}]',
        strava_activities_timestamp: '1700000000000',
        strava_cache_version: 'synthetic-real-v1',
        strava_athlete_data: JSON.stringify({
            id: ATHLETE_ID,
            firstname: 'Synthetic',
            lastname: 'Athlete'
        }),
        strava_athlete_data_timestamp: '1700000000001',
        strava_training_zones: '{"heartrate":[{"min":0,"max":150}]}',
        strava_training_zones_timestamp: '1700000000002',
        strava_gears: '[{"id":"synthetic-real-gear-001"}]',
        strava_gears_timestamp: '1700000000003',
        dashboard_filters: '{"sport":"Run"}',
        dashboard_readiness_hrv: '{"enabled":true}',
        dashboard_settings: '{"theme":"dark"}',
        training_goals: '{"weeklyActivities":4}',
        run_plus_capacity_inputs_v1: '{"capacity":42}',
        'gear-custom-synthetic-real-001': '{"nickname":"Real Gear"}',
        legacy_rescue_export_marker: 'synthetic-rescue-preserved'
    };
}

function demoNamespace({
    tokens = {
        access_token: 'synthetic-demo-access-token',
        refresh_token: 'synthetic-demo-refresh-token',
        expires_at: 2100000000
    }
} = {}) {
    return {
        [DEMO_MODE_KEY]: 'true',
        [DEMO_ACTIVITIES_KEY]: JSON.stringify([{
            id: 'synthetic-demo-activity-001',
            sport_type: 'Run'
        }]),
        [DEMO_ATHLETE_KEY]: JSON.stringify({
            id: 66914681,
            firstname: 'Demo'
        }),
        [DEMO_TRAINING_ZONES_KEY]: JSON.stringify({
            heartrate: [{ min: 0, max: 142 }]
        }),
        [DEMO_GEARS_KEY]: JSON.stringify([{
            id: 'synthetic-demo-gear-001',
            name: 'Demo Shoes'
        }]),
        [DEMO_ATHLETE_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_TRAINING_ZONES_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_GEARS_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_TOKENS_KEY]: typeof tokens === 'string'
            ? tokens
            : JSON.stringify(tokens)
    };
}

function realSnapshot(storage) {
    return Object.fromEntries(
        Object.entries(storage.snapshot())
            .filter(([key]) => !DEMO_STORAGE_KEYS.includes(key))
    );
}

function assertDemoCleared(storage) {
    for (const key of DEMO_STORAGE_KEYS) {
        assert.equal(storage.values.has(key), false, `${key} should be removed`);
    }
}

function oauthResponse(athleteId = ATHLETE_ID) {
    return {
        access_token: 'synthetic-oauth-access-token',
        refresh_token: 'synthetic-oauth-refresh-token',
        expires_at: 2200000000,
        athlete: { id: athleteId }
    };
}

function jsonResponse(data) {
    return {
        ok: true,
        status: 200,
        headers: {
            get: name => name.toLowerCase() === 'content-type'
                ? 'application/json'
                : null
        },
        json: async () => data
    };
}

const savedGlobals = {
    alert: globalThis.alert,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    window: globalThis.window
};

globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ textContent: '', innerHTML: '' })
};
globalThis.window = {
    location: {
        origin: 'https://synthetic.example',
        pathname: '/dashboard',
        search: '',
        reload: () => {}
    },
    history: {
        replaceState: () => {}
    }
};
globalThis.alert = () => {};

const {
    handleAuth,
    loginWithDemo,
    logout
} = await import('../../js/app/auth.js?demo-isolation-test');

test.after(() => {
    for (const [key, value] of Object.entries(savedGlobals)) {
        if (value === undefined) {
            delete globalThis[key];
        } else {
            globalThis[key] = value;
        }
    }
});

test('Demo namespace is frozen to the nine approved keys', () => {
    assert.deepEqual(DEMO_STORAGE_KEYS, [
        'strava_demo_mode',
        'strava_demo_activities',
        'strava_demo_athlete_data',
        'strava_demo_training_zones',
        'strava_demo_gears',
        'strava_demo_athlete_data_timestamp',
        'strava_demo_training_zones_timestamp',
        'strava_demo_gears_timestamp',
        'strava_tokens_demo'
    ]);
});

test('Entering Demo adds only Demo keys and preserves the real snapshot byte-for-byte', () => {
    const storage = new MemoryStorage(realLibrary());
    const before = storage.snapshot();
    const result = loadDemoData({
        storage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });
    const addedKeys = Object.keys(storage.snapshot())
        .filter(key => !(key in before))
        .sort();

    assert.deepEqual(realSnapshot(storage), before);
    assert.deepEqual(addedKeys, [...DEMO_STORAGE_KEYS].sort());
    assert.deepEqual(result.activities, getDemoActivities(storage));
    assert.deepEqual(result.athlete, getDemoAthlete(storage));
    assert.deepEqual(result.zones, getDemoTrainingZones(storage));
    assert.deepEqual(result.gears, getDemoGears(storage));
    assert.deepEqual(result.demoTokens, getDemoTokens(storage));
    assert.equal(
        storage.getItem(DEMO_ATHLETE_TIMESTAMP_KEY),
        String(FIXED_NOW_MS)
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );

    const secondStorage = new MemoryStorage(realLibrary());
    loadDemoData({
        storage: secondStorage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });
    assert.deepEqual(secondStorage.snapshot(), storage.snapshot());
});

test('loginWithDemo authenticates with the single stored deterministic Demo token', async () => {
    const storage = new MemoryStorage(realLibrary());
    let authenticatedTokens = null;

    const result = await loginWithDemo(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.deepEqual(authenticatedTokens, getDemoTokens(storage));
    assert.equal(
        authenticatedTokens.access_token,
        JSON.parse(storage.getItem(DEMO_TOKENS_KEY)).access_token
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );
});

test('Demo getters read only their namespace and never fallback to real metadata', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace(),
        strava_athlete_data: '{malformed-real-athlete',
        strava_training_zones: '{malformed-real-zones',
        strava_gears: '{malformed-real-gears'
    });
    const realValueKeys = [
        'strava_tokens',
        'strava_activities',
        'strava_athlete_data',
        'strava_training_zones',
        'strava_gears',
        'dashboard_settings'
    ];
    storage.forbiddenReads = new Set(realValueKeys);

    assert.equal(getDemoActivities(storage)[0].id, 'synthetic-demo-activity-001');
    assert.equal(getDemoAthlete(storage).firstname, 'Demo');
    assert.equal(getDemoTrainingZones(storage).heartrate[0].max, 142);
    assert.equal(getDemoGears(storage)[0].id, 'synthetic-demo-gear-001');
    assert.equal(
        getDemoTokens(storage).access_token,
        'synthetic-demo-access-token'
    );
    assert.deepEqual(
        storage.getItemCalls.filter(key => realValueKeys.includes(key)),
        []
    );
});

test('Malformed Demo payloads return safe values without real fallback', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        [DEMO_ACTIVITIES_KEY]: '{bad',
        [DEMO_ATHLETE_KEY]: '[]',
        [DEMO_TRAINING_ZONES_KEY]: '"bad"',
        [DEMO_GEARS_KEY]: '{}',
        [DEMO_TOKENS_KEY]: '{"access_token":'
    });

    assert.deepEqual(getDemoActivities(storage), []);
    assert.equal(getDemoAthlete(storage), null);
    assert.equal(getDemoTrainingZones(storage), null);
    assert.deepEqual(getDemoGears(storage), []);
    assert.equal(getDemoTokens(storage), null);
});

test('Every Demo API path is offline and reads only Demo data', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let fetchCalls = 0;
    globalThis.localStorage = storage;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('Demo API must be offline');
    };

    assert.equal(
        (await fetchAllActivities())[0].id,
        'synthetic-demo-activity-001'
    );
    assert.equal((await fetchAthleteData()).firstname, 'Demo');
    assert.equal((await fetchTrainingZones()).heartrate[0].max, 142);
    assert.equal(
        (await fetchAllGears({
            shoes: [{ id: 'prohibited-real-gear-id' }]
        }))[0].id,
        'synthetic-demo-gear-001'
    );
    assert.equal(getCachedGears()[0].id, 'synthetic-demo-gear-001');
    assert.equal(
        (await fetchGearById('synthetic-demo-gear-001')).name,
        'Demo Shoes'
    );
    assert.equal(await fetchGearById('missing-demo-gear'), null);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(realSnapshot(storage), realBefore);
});

test('Demo setCachedGears modifies only Demo gears and timestamp', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    globalThis.localStorage = storage;
    storage.operations = [];

    setCachedGears([{
        id: 'synthetic-demo-gear-updated',
        name: 'Updated Demo Shoes'
    }], {
        now: FIXED_NOW
    });

    assert.equal(
        JSON.parse(storage.getItem(DEMO_GEARS_KEY))[0].id,
        'synthetic-demo-gear-updated'
    );
    assert.equal(
        storage.getItem(DEMO_GEARS_TIMESTAMP_KEY),
        String(FIXED_NOW_MS)
    );
    assert.deepEqual(realSnapshot(storage), realBefore);
    assert.deepEqual(
        storage.operations
            .filter(operation => operation.operation === 'set')
            .map(operation => operation.key),
        [DEMO_GEARS_KEY, DEMO_GEARS_TIMESTAMP_KEY]
    );
});

test('clearDemoData removes all Demo keys and preserves the real snapshot', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);

    const result = clearDemoData(storage);

    assert.equal(result.status, 'success');
    assertDemoCleared(storage);
    assert.deepEqual(realSnapshot(storage), realBefore);
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );
});

test('Demo logout skips disconnect and revoke while preserving the real library', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let disconnectCalls = 0;
    let revokeCalls = 0;
    let reloadCalls = 0;

    const result = await logout({
        storage,
        reload: () => {
            reloadCalls += 1;
        },
        lifecycleFactory: () => ({
            disconnect: async () => {
                disconnectCalls += 1;
                revokeCalls += 1;
                return { status: 'success' };
            }
        })
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.equal(disconnectCalls, 0);
    assert.equal(revokeCalls, 0);
    assert.equal(reloadCalls, 1);
    assertDemoCleared(storage);
    assert.deepEqual(realSnapshot(storage), realBefore);
});

test('A reloaded page restores the Demo session only from strava_tokens_demo', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    let authenticatedTokens = null;
    let lifecycleCalls = 0;

    const result = await handleAuth(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        search: '',
        now: FIXED_NOW_MS,
        lifecycleFactory: () => {
            lifecycleCalls += 1;
            throw new Error('Real lifecycle must not run for Demo restore');
        }
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.equal(lifecycleCalls, 0);
    assert.equal(
        authenticatedTokens.access_token,
        'synthetic-demo-access-token'
    );
    assert.equal(
        storage.getItemCalls.filter(key => key === 'strava_tokens').length,
        0
    );
});

test('Malformed or expired Demo tokens clear only the Demo namespace', async () => {
    const cases = [
        {
            name: 'malformed',
            tokens: '{"access_token":',
            expectedStatus: 'unauthenticated'
        },
        {
            name: 'expired',
            tokens: {
                access_token: 'synthetic-expired-demo-token',
                refresh_token: 'synthetic-expired-demo-refresh',
                expires_at: Math.floor(FIXED_NOW_MS / 1000) - 1
            },
            expectedStatus: 'token-expired'
        }
    ];

    for (const scenario of cases) {
        const storage = new MemoryStorage({
            ...realLibrary(),
            ...demoNamespace({ tokens: scenario.tokens })
        });
        const realBefore = realSnapshot(storage);
        let authenticatedCalls = 0;

        const result = await handleAuth(() => {
            authenticatedCalls += 1;
        }, {
            storage,
            search: '',
            now: FIXED_NOW_MS,
            lifecycleFactory: () => {
                throw new Error(`Real lifecycle ran for ${scenario.name}`);
            }
        });

        assert.equal(result.status, scenario.expectedStatus);
        assert.equal(result.demo, true);
        assert.equal(authenticatedCalls, 0);
        assertDemoCleared(storage);
        assert.deepEqual(realSnapshot(storage), realBefore);
    }
});

test('Real OAuth takes priority over Demo and clears only Demo after success', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let fetchCalls = 0;
    let historyCalls = 0;
    let authenticatedTokens = null;

    const result = await handleAuth(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        search: '?code=synthetic-oauth-code',
        now: FIXED_NOW_MS,
        fetchImpl: async (url, options) => {
            fetchCalls += 1;
            assert.equal(url, '/api/strava-auth');
            assert.equal(
                JSON.parse(options.body).code,
                'synthetic-oauth-code'
            );
            return jsonResponse(oauthResponse());
        },
        history: {
            replaceState: () => {
                historyCalls += 1;
            }
        }
    });

    assert.equal(result.status, 'success');
    assert.equal(fetchCalls, 1);
    assert.equal(historyCalls, 1);
    assertDemoCleared(storage);
    assert.equal(
        authenticatedTokens.access_token,
        'synthetic-oauth-access-token'
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        'synthetic-oauth-access-token'
    );
    const realAfter = realSnapshot(storage);
    assert.deepEqual(
        {
            ...realAfter,
            strava_tokens: realBefore.strava_tokens
        },
        realBefore
    );
});

test('OAuth identity mismatch from Demo fails closed with zero storage writes', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const originalConsoleError = console.error;
    console.error = () => {};
    storage.operations = [];

    try {
        await assert.rejects(
            handleAuth(() => {
                throw new Error('Mismatched OAuth must not authenticate');
            }, {
                storage,
                search: '?code=synthetic-mismatch-code',
                now: FIXED_NOW_MS,
                fetchImpl: async () => jsonResponse(oauthResponse(2002002)),
                history: { replaceState: () => {} }
            }),
            error => error?.code === 'identity-mismatch'
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(storage.operations, []);
});

test('A partial Demo write is compensated without touching the real library', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace({
            tokens: {
                access_token: 'preexisting-demo-token',
                expires_at: 2100000000
            }
        })
    });
    const before = storage.snapshot();
    storage.failSetKeyOnce = DEMO_GEARS_KEY;

    assert.throws(
        () => loadDemoData({
            storage,
            now: FIXED_NOW,
            referenceDate: FIXED_REFERENCE_DATE
        }),
        error => (
            error?.code === DEMO_STORAGE_ERROR.WRITE_FAILED
            && error.rollbackFailed === false
        )
    );

    assert.deepEqual(storage.snapshot(), before);
    assert.equal(
        storage.operations.some(operation => (
            !DEMO_STORAGE_KEYS.includes(operation.key)
        )),
        false
    );
});

test('Source boundaries prohibit real Demo storage mutations and cache clearing', async () => {
    const root = new URL('../../', import.meta.url);
    const [demoSource, authSource, apiSource] = await Promise.all([
        readFile(new URL('js/demo/index.js', root), 'utf8'),
        readFile(new URL('js/app/auth.js', root), 'utf8'),
        readFile(new URL('js/services/api.js', root), 'utf8')
    ]);
    const prohibitedMutation = /(?:setItem|removeItem)\(\s*['"](?:strava_tokens|strava_activities|strava_athlete_data|strava_training_zones|strava_gears|dashboard_settings)/;

    assert.equal(prohibitedMutation.test(demoSource), false);
    assert.equal(demoSource.includes('indexedDB'), false);
    assert.equal(authSource.includes('clearCachedActivities'), false);
    assert.equal(apiSource.includes('clearCachedActivities'), false);
});
