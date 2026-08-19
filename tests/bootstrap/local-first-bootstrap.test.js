import assert from 'node:assert/strict';
import test from 'node:test';

import {
    LOCAL_FIRST_NETWORK_STATUS,
    LOCAL_FIRST_ROUTE,
    LOCAL_FIRST_STATUS,
    STRAVA_SOURCE_STATUS,
    inspectLocalFirstBootstrap,
    runLocalFirstBootstrap
} from '../../js/app/local-first-bootstrap.js';
import { readLegacyIndexedDb } from '../../js/services/legacy-cache/index.js';

function tokenStorage(rawToken = null, { fail = false, calls = [] } = {}) {
    return {
        getItem(key) {
            calls.push(key);
            if (fail) throw new Error('private storage failure');
            return rawToken;
        }
    };
}

function legacyResult(activities = null) {
    if (activities === null) return { status: 'not-found' };
    return { status: 'found', entry: { activities } };
}

function harness({
    canonicalActivities = [],
    canonicalFailure = false,
    canonicalListValue,
    indexedDbResult = legacyResult(),
    localStorageResult = legacyResult(),
    indexedDbFailure = false,
    localStorageFailure = false,
    token = null,
    tokenFailure = false,
    online = true,
    now = 1_800_000_000_000
} = {}) {
    const calls = [];
    const tokenCalls = [];
    const store = {
        async initialize() {
            calls.push('v2.initialize');
            if (canonicalFailure) throw new Error('private v2 failure');
            return { status: 'ready' };
        },
        async listActivities(options) {
            calls.push(['v2.list', options]);
            return canonicalListValue ?? canonicalActivities;
        },
        async close() {
            calls.push('v2.close');
            return { status: 'closed' };
        }
    };
    const options = {
        indexedDB: {},
        IDBKeyRange: {},
        localStorage: tokenStorage(token, {
            fail: tokenFailure,
            calls: tokenCalls
        }),
        now,
        online,
        canonicalStoreFactory() {
            calls.push('v2.create');
            return store;
        },
        async legacyIndexedDbReader() {
            calls.push('legacy.indexeddb');
            if (indexedDbFailure) throw new Error('private legacy failure');
            return indexedDbResult;
        },
        legacyLocalStorageReader() {
            calls.push('legacy.localstorage');
            if (localStorageFailure) throw new Error('private local failure');
            return localStorageResult;
        }
    };
    return { options, calls, tokenCalls };
}

test('empty readable local stores enter deterministic First-run after V2-first inspection', async () => {
    const { options, calls, tokenCalls } = harness({ online: false });
    const result = await inspectLocalFirstBootstrap(options);

    assert.deepEqual(result, {
        route: LOCAL_FIRST_ROUTE.FIRST_RUN,
        localStatus: LOCAL_FIRST_STATUS.READY,
        stravaStatus: STRAVA_SOURCE_STATUS.NOT_CONNECTED,
        networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
        legacyActivities: []
    });
    assert.deepEqual(calls, [
        'v2.create',
        'v2.initialize',
        ['v2.list', { limit: 1 }],
        'v2.close',
        'legacy.indexeddb',
        'legacy.localstorage'
    ]);
    assert.deepEqual(tokenCalls, ['strava_tokens']);
    assert(Object.isFrozen(result));
    assert(Object.isFrozen(result.legacyActivities));
});

test('one Canonical activity enters Dashboard without exposing Canonical records', async () => {
    const { options } = harness({
        canonicalActivities: [{ id: 'opaque-v2-id' }]
    });
    const result = await inspectLocalFirstBootstrap(options);

    assert.equal(result.route, LOCAL_FIRST_ROUTE.DASHBOARD);
    assert.equal(result.localStatus, LOCAL_FIRST_STATUS.READY);
    assert.deepEqual(result.legacyActivities, []);
    assert.doesNotMatch(JSON.stringify(result), /opaque-v2-id/);
});

test('Legacy IndexedDB activities enter Dashboard through a detached frozen façade', async () => {
    const source = [{
        id: 'opaque-legacy-id',
        distance: 0,
        average_heartrate: null,
        missing: null,
        nested: { zero: -0 }
    }];
    const { options } = harness({ indexedDbResult: legacyResult(source) });
    const result = await inspectLocalFirstBootstrap(options);

    assert.equal(result.route, LOCAL_FIRST_ROUTE.DASHBOARD);
    assert.deepEqual(result.legacyActivities, source);
    assert.notEqual(result.legacyActivities, source);
    assert.notEqual(result.legacyActivities[0], source[0]);
    assert(Object.isFrozen(result.legacyActivities));
    assert(Object.isFrozen(result.legacyActivities[0]));
    assert(Object.is(result.legacyActivities[0].nested.zero, -0));
    assert.equal(result.legacyActivities[0].distance, 0);
    assert.equal(result.legacyActivities[0].average_heartrate, null);
});

test('Legacy localStorage fallback is used when IndexedDB is empty', async () => {
    const activities = [{ id: 'fallback-id', distance: null }];
    const { options } = harness({
        localStorageResult: legacyResult(activities)
    });
    const result = await inspectLocalFirstBootstrap(options);

    assert.equal(result.route, LOCAL_FIRST_ROUTE.DASHBOARD);
    assert.deepEqual(result.legacyActivities, activities);
});

test('a proved activity degrades safely when another local boundary fails', async () => {
    const { options } = harness({
        canonicalActivities: [{ id: 'v2-only' }],
        indexedDbFailure: true,
        localStorageFailure: true
    });
    const result = await inspectLocalFirstBootstrap(options);

    assert.equal(result.route, LOCAL_FIRST_ROUTE.DASHBOARD);
    assert.equal(result.localStatus, LOCAL_FIRST_STATUS.DEGRADED);
    assert.deepEqual(result.legacyActivities, []);
});

test('unproved emptiness with any local read failure blocks instead of false First-run', async () => {
    for (const failure of [
        { canonicalFailure: true },
        { indexedDbFailure: true },
        { localStorageFailure: true }
    ]) {
        const { options } = harness(failure);
        const result = await inspectLocalFirstBootstrap(options);
        assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
        assert.equal(result.localStatus, LOCAL_FIRST_STATUS.UNAVAILABLE);
        assert.deepEqual(result.legacyActivities, []);
        assert.doesNotMatch(JSON.stringify(result), /private/);
    }
});

test('unsafe Legacy database enumeration blocks First-run with zero open', async () => {
    const { options } = harness();
    let openCalls = 0;
    options.indexedDB = {
        open() {
            openCalls += 1;
            throw new Error('ProhibitedOpen');
        }
    };
    options.legacyIndexedDbReader = readLegacyIndexedDb;

    const result = await inspectLocalFirstBootstrap(options);

    assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
    assert.equal(result.localStatus, LOCAL_FIRST_STATUS.UNAVAILABLE);
    assert.equal(openCalls, 0);
});

test('pending Legacy enumeration blocks in bounded time and cannot open late', async () => {
    const { options } = harness();
    let resolveDatabases;
    let openCalls = 0;
    let trapCalls = 0;
    options.indexedDB = {
        databases: () => new Promise(resolve => { resolveDatabases = resolve; }),
        open() {
            openCalls += 1;
            throw new Error('ProhibitedLateOpen');
        }
    };
    options.legacyIndexedDbReader = args => readLegacyIndexedDb({
        ...args,
        openTimeoutMs: 5
    });

    const inspectionPromise = inspectLocalFirstBootstrap(options);
    const bounded = await Promise.race([
        inspectionPromise.then(() => 'settled'),
        new Promise(resolve => setTimeout(() => resolve('still-pending'), 25))
    ]);
    assert.equal(bounded, 'settled');
    const result = await inspectionPromise;
    assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
    assert.equal(result.localStatus, LOCAL_FIRST_STATUS.UNAVAILABLE);

    resolveDatabases(new Proxy([], {
        getPrototypeOf() {
            trapCalls += 1;
            throw new Error('ProhibitedLateReflection');
        }
    }));
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(trapCalls, 0);
    assert.equal(openCalls, 0);
});

test('Strava Source Status is local-only, stable, and never echoes Token material', async () => {
    const now = 1_800_000_000_000;
    const cases = [
        [null, STRAVA_SOURCE_STATUS.NOT_CONNECTED],
        ['', STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED],
        ['{invalid', STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED],
        [JSON.stringify({
            access_token: 'private-access',
            refresh_token: 'private-refresh',
            expires_at: Math.floor(now / 1000) + 60
        }), STRAVA_SOURCE_STATUS.CONNECTED],
        [JSON.stringify({
            access_token: 'private-access',
            refresh_token: 'private-refresh',
            expires_at: Math.floor(now / 1000)
        }), STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED]
    ];

    for (const [token, expected] of cases) {
        const { options, tokenCalls } = harness({ token, now });
        const result = await inspectLocalFirstBootstrap(options);
        assert.equal(result.stravaStatus, expected);
        assert.deepEqual(tokenCalls, ['strava_tokens']);
        assert.doesNotMatch(JSON.stringify(result), /private-access|private-refresh/);
    }

    const { options } = harness({ tokenFailure: true });
    assert.equal(
        (await inspectLocalFirstBootstrap(options)).stravaStatus,
        STRAVA_SOURCE_STATUS.UNAVAILABLE
    );
});

test('network status never causes provider or fetch work', async () => {
    for (const online of [true, false, null]) {
        const { options, calls } = harness({ online });
        const result = await inspectLocalFirstBootstrap(options);
        assert.equal(
            result.networkStatus,
            online === true
                ? LOCAL_FIRST_NETWORK_STATUS.ONLINE
                : online === false
                    ? LOCAL_FIRST_NETWORK_STATUS.OFFLINE
                    : LOCAL_FIRST_NETWORK_STATUS.UNKNOWN
        );
        assert.equal(calls.filter(call => call === 'legacy.indexeddb').length, 1);
    }
});

test('hostile Canonical and Legacy values fail closed without accessor execution', async () => {
    let getterCalls = 0;
    const accessorArray = [];
    Object.defineProperty(accessorArray, '0', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return { id: 'must-not-run' };
        }
    });
    accessorArray.length = 1;

    const revokedCanonical = Proxy.revocable([], {});
    revokedCanonical.revoke();
    for (const value of [accessorArray, revokedCanonical.proxy]) {
        const { options } = harness({ canonicalListValue: value });
        const result = await inspectLocalFirstBootstrap(options);
        assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
    }
    assert.equal(getterCalls, 0);

    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const { options } = harness({
        indexedDbResult: legacyResult(revoked.proxy)
    });
    const result = await inspectLocalFirstBootstrap(options);
    assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
});

test('invalid dependency objects fail closed without executing option accessors', async () => {
    let getterCalls = 0;
    const options = {};
    Object.defineProperty(options, 'indexedDB', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return {};
        }
    });

    const result = await inspectLocalFirstBootstrap(options);
    assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
    assert.equal(getterCalls, 0);
});

test('orchestration isolates Demo and dispatches each Real route exactly once', async () => {
    const demoCalls = [];
    const demoResult = await runLocalFirstBootstrap({
        sessionMode: 'demo',
        inspect: () => {
            throw new Error('Real inspection must not run');
        },
        startDemo() { demoCalls.push('demo'); },
        startDashboard() { demoCalls.push('dashboard'); },
        navigateFirstRun() { demoCalls.push('navigate'); },
        showBlocked() { demoCalls.push('blocked'); }
    });
    assert.deepEqual(demoCalls, ['demo']);
    assert.equal(demoResult.route, LOCAL_FIRST_ROUTE.DEMO);

    for (const [route, expected] of [
        [LOCAL_FIRST_ROUTE.DASHBOARD, 'dashboard'],
        [LOCAL_FIRST_ROUTE.FIRST_RUN, 'navigate'],
        [LOCAL_FIRST_ROUTE.BLOCKED, 'blocked']
    ]) {
        const calls = [];
        const state = Object.freeze({
            route,
            localStatus: route === LOCAL_FIRST_ROUTE.BLOCKED
                ? LOCAL_FIRST_STATUS.UNAVAILABLE
                : LOCAL_FIRST_STATUS.READY,
            stravaStatus: STRAVA_SOURCE_STATUS.NOT_CONNECTED,
            networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
            legacyActivities: Object.freeze([])
        });
        const result = await runLocalFirstBootstrap({
            sessionMode: 'real',
            async inspect() { calls.push('inspect'); return state; },
            async startDemo() { calls.push('demo'); },
            async startDashboard(value) {
                assert.deepEqual(value, state);
                assert.notEqual(value, state);
                calls.push('dashboard');
            },
            async navigateFirstRun(value) {
                assert.deepEqual(value, state);
                assert.notEqual(value, state);
                calls.push('navigate');
            },
            async showBlocked(value) {
                assert.equal(value.route, LOCAL_FIRST_ROUTE.BLOCKED);
                assert.equal(value.localStatus, LOCAL_FIRST_STATUS.UNAVAILABLE);
                calls.push('blocked');
            }
        });
        if (route === LOCAL_FIRST_ROUTE.BLOCKED) {
            assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
            assert.equal(result.localStatus, LOCAL_FIRST_STATUS.UNAVAILABLE);
        } else {
            assert.deepEqual(result, state);
            assert.notEqual(result, state);
        }
        assert.deepEqual(calls, ['inspect', expected]);
    }
});

test('orchestration rejects hostile or inconsistent inspection states without accessor execution', async () => {
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'route', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return LOCAL_FIRST_ROUTE.DASHBOARD;
        }
    });

    for (const state of [
        hostile,
        {
            route: LOCAL_FIRST_ROUTE.FIRST_RUN,
            localStatus: LOCAL_FIRST_STATUS.READY,
            stravaStatus: STRAVA_SOURCE_STATUS.NOT_CONNECTED,
            networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
            legacyActivities: [{ id: 'inconsistent' }]
        },
        {
            route: LOCAL_FIRST_ROUTE.DASHBOARD,
            localStatus: LOCAL_FIRST_STATUS.READY,
            stravaStatus: STRAVA_SOURCE_STATUS.DEMO,
            networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
            legacyActivities: []
        }
    ]) {
        const calls = [];
        const result = await runLocalFirstBootstrap({
            sessionMode: 'real',
            async inspect() { return state; },
            async startDemo() { calls.push('demo'); },
            async startDashboard() { calls.push('dashboard'); },
            async navigateFirstRun() { calls.push('navigate'); },
            async showBlocked() { calls.push('blocked'); }
        });
        assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
        assert.deepEqual(calls, ['blocked']);
    }
    assert.equal(getterCalls, 0);
});

test('orchestration detaches and freezes valid injected Legacy state before dispatch', async () => {
    const source = [{ id: 'opaque', nested: { zero: -0, missing: null } }];
    const state = {
        route: LOCAL_FIRST_ROUTE.DASHBOARD,
        localStatus: LOCAL_FIRST_STATUS.READY,
        stravaStatus: STRAVA_SOURCE_STATUS.NOT_CONNECTED,
        networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
        legacyActivities: source
    };
    let dispatched;
    const returned = await runLocalFirstBootstrap({
        sessionMode: 'real',
        async inspect() { return state; },
        async startDemo() {},
        async startDashboard(value) { dispatched = value; },
        async navigateFirstRun() {},
        async showBlocked() {}
    });
    source[0].nested.zero = 1;

    assert.equal(returned, dispatched);
    assert.notEqual(returned, state);
    assert.notEqual(returned.legacyActivities, source);
    assert(Object.isFrozen(returned));
    assert(Object.isFrozen(returned.legacyActivities));
    assert(Object.isFrozen(returned.legacyActivities[0]));
    assert(Object.is(returned.legacyActivities[0].nested.zero, -0));
    assert.equal(returned.legacyActivities[0].nested.missing, null);
});

test('orchestration rejects nested Legacy accessors without executing them', async () => {
    let getterCalls = 0;
    const activity = { id: 'opaque' };
    Object.defineProperty(activity, 'distance', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 0;
        }
    });
    const calls = [];
    const result = await runLocalFirstBootstrap({
        sessionMode: 'real',
        async inspect() {
            return {
                route: LOCAL_FIRST_ROUTE.DASHBOARD,
                localStatus: LOCAL_FIRST_STATUS.READY,
                stravaStatus: STRAVA_SOURCE_STATUS.NOT_CONNECTED,
                networkStatus: LOCAL_FIRST_NETWORK_STATUS.OFFLINE,
                legacyActivities: [activity]
            };
        },
        async startDemo() { calls.push('demo'); },
        async startDashboard() { calls.push('dashboard'); },
        async navigateFirstRun() { calls.push('navigate'); },
        async showBlocked() { calls.push('blocked'); }
    });

    assert.equal(result.route, LOCAL_FIRST_ROUTE.BLOCKED);
    assert.deepEqual(calls, ['blocked']);
    assert.equal(getterCalls, 0);
});
