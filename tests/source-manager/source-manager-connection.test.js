import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSourceManagerConnectionController,
    sanitizeSourceManagerNavigation
} from '../../js/app/source-manager-connection.js';

const CLEAN_REAL = Object.freeze({
    pathname: '/source-manager.html',
    search: '',
    hash: '',
    replaceState() {}
});

const SUBJECT = '424242';
const OTHER_SUBJECT = '525252';

function connectionRecord(overrides = {}) {
    return Object.freeze({
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: SUBJECT,
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1,
        ...overrides
    });
}

function controllerHarness({
    record = null,
    authority = { status: 'absent', subjectId: null },
    callback = null,
    callbackToken = null,
    acceptStatus = 'success',
    disconnectStatus = 'success',
    expireStatus = 'token-expired',
    syncBoundaryFailure = false,
    createFailure = false,
    transitionFailure = false
} = {}) {
    const calls = {
        begin: 0, process: [], accept: [], expire: 0, disconnect: 0,
        syncBoundary: 0, order: [], create: [], transition: [], close: 0
    };
    let current = record;
    const authorization = Object.freeze({
        async beginAuthorization() { calls.begin += 1; return { status: 'redirecting' }; },
        async processCallback(value) {
            calls.process.push(value);
            return { status: 'authorized', token: callbackToken };
        },
        async revoke() { return true; },
        async close() { return { status: 'closed' }; }
    });
    const authLifecycle = Object.freeze({
        inspectTokenAuthority() { return authority; },
        async acceptOAuthTokenResponse(value) {
            calls.accept.push(value);
            return { status: acceptStatus, firstLogin: false };
        },
        expireToken() { calls.expire += 1; return { status: expireStatus }; },
        async disconnect() {
            calls.disconnect += 1;
            calls.order.push('disconnect');
            return { status: disconnectStatus };
        }
    });
    const connectionStore = Object.freeze({
        async initialize() { return { status: 'ready' }; },
        async getConnection() { return current; },
        async createConnection(value) {
            calls.create.push(value);
            if (createFailure) throw new Error('synthetic-create-failure');
            current = connectionRecord(value);
            return current;
        },
        async transitionConnection(value) {
            calls.transition.push(value);
            if (transitionFailure) throw new Error('synthetic-transition-failure');
            current = connectionRecord({
                ...current,
                status: value.status,
                lastSyncAt: value.lastSyncAt,
                errorCode: value.errorCode,
                revision: current.revision + 1
            });
            return current;
        },
        async close() { calls.close += 1; return { status: 'closed' }; }
    });
    return {
        calls,
        controller: createSourceManagerConnectionController({
            authorization,
            authLifecycle,
            connectionStore,
            callback,
            async awaitInactiveSyncBoundary() {
                calls.syncBoundary += 1;
                calls.order.push('sync-boundary');
                if (syncBoundaryFailure) throw new Error('synthetic-sync-boundary-failure');
            }
        })
    };
}

function navigation(overrides = {}) {
    const calls = [];
    const input = {
        ...CLEAN_REAL,
        ...overrides,
        replaceState(...args) {
            calls.push(args);
            if (typeof overrides.replaceState === 'function') {
                return overrides.replaceState(...args);
            }
        }
    };
    return { input, calls };
}

function assertDeepFrozen(value) {
    assert.equal(Object.isFrozen(value), true);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value !== null
            && typeof descriptor.value === 'object') {
            assertDeepFrozen(descriptor.value);
        }
    }
}

test('connection controller has the exact fail-closed surface and ignores hostile arguments', async () => {
    let traps = 0;
    const hostile = new Proxy({}, {
        get() { traps += 1; throw new Error('private getter'); },
        ownKeys() { traps += 1; throw new Error('private keys'); }
    });
    const controller = createSourceManagerConnectionController(hostile);

    assert.equal(traps, 0);
    assert.deepEqual(Object.keys(controller), [
        'initialize',
        'getConnectionSnapshot',
        'beginConnect',
        'disconnect',
        'close'
    ]);
    assert.equal(Object.isFrozen(controller), true);

    assert.deepEqual(await controller.initialize(), {
        status: 'error',
        code: 'CONNECTION_INITIALIZATION_FAILED'
    });
    const snapshot = controller.getConnectionSnapshot();
    assert.deepEqual(snapshot, {
        schemaVersion: 1,
        status: 'error',
        code: 'CONNECTION_INITIALIZATION_FAILED',
        actions: { connect: false, reconnect: false, sync: false, disconnect: false }
    });
    assert.strictEqual(controller.getConnectionSnapshot(), snapshot);
    assertDeepFrozen(snapshot);
});

test('connection actions reject with exact safe objects before and after idempotent close', async () => {
    const controller = createSourceManagerConnectionController();
    const unavailable = error => {
        assert.deepEqual(error, { code: 'CONNECTION_INITIALIZATION_FAILED' });
        assert.deepEqual(Object.keys(error), ['code']);
        assert.equal(Object.isFrozen(error), true);
        return true;
    };
    await assert.rejects(controller.beginConnect(), unavailable);
    await assert.rejects(controller.disconnect(), unavailable);

    const firstClose = await controller.close();
    const secondClose = await controller.close();
    assert.deepEqual(firstClose, { status: 'closed' });
    assert.strictEqual(firstClose, secondClose);
    assert.equal(Object.isFrozen(firstClose), true);
    assert.deepEqual(controller.getConnectionSnapshot(), {
        schemaVersion: 1,
        status: 'closed',
        code: null,
        actions: { connect: false, reconnect: false, sync: false, disconnect: false }
    });

    const closed = error => {
        assert.deepEqual(error, { code: 'CONNECTION_CLOSED' });
        assert.deepEqual(Object.keys(error), ['code']);
        assert.equal(Object.isFrozen(error), true);
        return true;
    };
    await assert.rejects(controller.beginConnect(), closed);
    await assert.rejects(controller.disconnect(), closed);
});

test('legacy Token initializes reconnect-required and explicit reconnect enters authorizing', async () => {
    const { controller, calls } = controllerHarness({
        record: connectionRecord({ status: 'disconnected' }),
        authority: { status: 'legacy', subjectId: null }
    });
    await controller.initialize();
    assert.deepEqual(controller.getConnectionSnapshot(), {
        schemaVersion: 1,
        status: 'reconnect_required',
        code: 'AUTHORIZATION_REQUIRED',
        actions: { connect: false, reconnect: true, sync: false, disconnect: false }
    });
    await controller.beginConnect();
    assert.equal(calls.begin, 1);
    assert.equal(controller.getConnectionSnapshot().status, 'authorizing');
});

test('restored C2 subject mismatch stores nothing and never mutates connection', async () => {
    const token = Object.freeze({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000,
        subject_id: OTHER_SUBJECT,
        granted_scopes: Object.freeze(['read', 'activity:read_all'])
    });
    const { controller, calls } = controllerHarness({
        record: connectionRecord({ status: 'disconnected', revision: 7 }),
        callback: Object.freeze({
            kind: 'code', code: 'synthetic-code', state: 'synthetic-state',
            grantedScopes: Object.freeze(['read', 'activity:read_all'])
        }),
        callbackToken: token
    });
    const result = await controller.initialize();
    assert.deepEqual(result, { status: 'error', code: 'IDENTITY_MISMATCH' });
    assert.equal(calls.process.length, 1);
    assert.deepEqual(calls.accept, []);
    assert.deepEqual(calls.create, []);
    assert.deepEqual(calls.transition, []);
    assert.equal(calls.expire, 0);
});

test('Token write precedes C2 create and is rolled back when C2 fails', async () => {
    const token = Object.freeze({
        access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000, subject_id: SUBJECT,
        granted_scopes: Object.freeze(['read', 'activity:read_all'])
    });
    const { controller, calls } = controllerHarness({
        callback: Object.freeze({
            kind: 'code', code: 'synthetic-code', state: 'synthetic-state',
            grantedScopes: Object.freeze(['read', 'activity:read_all'])
        }),
        callbackToken: token,
        createFailure: true
    });
    assert.deepEqual(await controller.initialize(), {
        status: 'error', code: 'CONNECTION_UPDATE_FAILED'
    });
    assert.equal(calls.accept.length, 1);
    assert.equal(calls.create.length, 1);
    assert.equal(calls.expire, 1);
});

test('failed Token rollback after C2 failure is surfaced and never treated as local authority', async () => {
    const token = Object.freeze({
        access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000, subject_id: SUBJECT,
        granted_scopes: Object.freeze(['read', 'activity:read_all'])
    });
    const { controller, calls } = controllerHarness({
        callback: Object.freeze({
            kind: 'code', code: 'synthetic-code', state: 'synthetic-state',
            grantedScopes: Object.freeze(['read', 'activity:read_all'])
        }),
        callbackToken: token,
        createFailure: true,
        expireStatus: 'token-removal-failed'
    });
    assert.deepEqual(await controller.initialize(), {
        status: 'error', code: 'TOKEN_REMOVAL_FAILED'
    });
    assert.equal(calls.expire, 1);
    assert.equal(controller.getConnectionSnapshot().actions.disconnect, false);
});

test('exact callback creates C2 and disconnect CASes only status/history after Token removal', async () => {
    const token = Object.freeze({
        access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000, subject_id: SUBJECT,
        granted_scopes: Object.freeze(['read', 'activity:read_all'])
    });
    const { controller, calls } = controllerHarness({
        callback: Object.freeze({
            kind: 'code', code: 'synthetic-code', state: 'synthetic-state',
            grantedScopes: Object.freeze(['read', 'activity:read_all'])
        }),
        callbackToken: token,
        disconnectStatus: 'revocation-unconfirmed'
    });
    assert.deepEqual(await controller.initialize(), { status: 'connected' });
    assert.equal(controller.getConnectionSnapshot().status, 'connected');
    assert.deepEqual(calls.create[0], connectionRecord());
    assert.deepEqual(await controller.disconnect(), { status: 'disconnected' });
    assert.equal(calls.syncBoundary, 1);
    assert.equal(calls.disconnect, 1);
    assert.deepEqual(calls.order, ['sync-boundary', 'disconnect']);
    assert.deepEqual(calls.transition[0], {
        id: 'source-connection:strava', expectedRevision: 1,
        status: 'disconnected', lastSyncAt: null,
        errorCode: 'REVOCATION_UNCONFIRMED'
    });
    assert.equal(controller.getConnectionSnapshot().status, 'disconnected');
});

test('disconnect fails before revoke, Token removal, or C2 CAS when the sync boundary is not inactive', async () => {
    const { controller, calls } = controllerHarness({
        record: connectionRecord(),
        authority: { status: 'authority', subjectId: SUBJECT },
        syncBoundaryFailure: true
    });
    assert.deepEqual(await controller.initialize(), { status: 'connected' });
    assert.deepEqual(await controller.disconnect(), {
        status: 'error', code: 'CONNECTION_UPDATE_FAILED'
    });
    assert.equal(calls.syncBoundary, 1);
    assert.equal(calls.disconnect, 0);
    assert.deepEqual(calls.transition, []);
});

test('canonical Source Manager navigation performs zero history writes', () => {
    for (const [search, sessionMode] of [
        ['', 'real'],
        ['?mode=real', 'real'],
        ['?mode=demo', 'demo']
    ]) {
        const { input, calls } = navigation({ search });
        const result = sanitizeSourceManagerNavigation(input);
        assert.deepEqual(result, { status: 'clean', sessionMode });
        assertDeepFrozen(result);
        assert.deepEqual(calls, []);
    }
});

test('noncanonical and cross-mode OAuth material is scrubbed once and blocked', () => {
    const canary = 'synthetic-private-callback-canary';
    for (const mode of ['real', 'demo']) {
        const { input, calls } = navigation({
            search: `?code=${canary}&state=${canary}&mode=${mode}`,
            hash: `#scope=${canary}`
        });
        const result = sanitizeSourceManagerNavigation(input);
        assert.deepEqual(result, {
            status: 'blocked',
            sessionMode: null,
            code: 'NAVIGATION_SANITIZATION_FAILED'
        });
        assert.deepEqual(calls, [[null, '', `/source-manager.html?mode=${mode}`]]);
        assert.doesNotMatch(JSON.stringify({ result, calls }), new RegExp(canary));
    }
});

test('exact Real callback is captured only in memory after the synchronous scrub', () => {
    const state = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    const { input, calls } = navigation({
        search: `?mode=real&code=synthetic-code&state=${state}&scope=read%2Cactivity%3Aread_all`
    });
    const result = sanitizeSourceManagerNavigation(input);
    assert.deepEqual(calls, [[null, '', '/source-manager.html?mode=real']]);
    assert.deepEqual(result, {
        status: 'sanitized',
        sessionMode: 'real',
        callback: {
            kind: 'code',
            code: 'synthetic-code',
            state,
            grantedScopes: ['read', 'activity:read_all']
        }
    });
    assertDeepFrozen(result);
});

test('exact access_denied callback is detached and duplicate callback keys block', () => {
    const state = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    const denied = navigation({
        search: `?error=access_denied&state=${state}&mode=real`
    });
    assert.deepEqual(sanitizeSourceManagerNavigation(denied.input), {
        status: 'sanitized',
        sessionMode: 'real',
        callback: { kind: 'denied', state }
    });
    assert.deepEqual(denied.calls, [[null, '', '/source-manager.html?mode=real']]);

    const duplicate = navigation({
        search: `?mode=real&code=one&code=two&state=${state}&scope=read%2Cactivity%3Aread_all`
    });
    assert.deepEqual(sanitizeSourceManagerNavigation(duplicate.input), {
        status: 'blocked', sessionMode: null,
        code: 'NAVIGATION_SANITIZATION_FAILED'
    });
    assert.equal(duplicate.calls.length, 1);
});

test('untrusted navigation without one valid mode scrubs once and remains blocked', () => {
    const cases = [
        '?code=synthetic-canary',
        '?mode=',
        '?mode=invalid',
        '?mode=demo&mode=real',
        '?mode=demo&unknown=synthetic-canary',
        '?mode=%E0%A4%A',
        '?scope=one&scope=two'
    ];
    for (const search of cases) {
        const { input, calls } = navigation({ search });
        const result = sanitizeSourceManagerNavigation(input);
        assert.deepEqual(result, {
            status: 'blocked',
            sessionMode: null,
            code: 'NAVIGATION_SANITIZATION_FAILED'
        });
        assertDeepFrozen(result);
        assert.deepEqual(calls, [[null, '', '/source-manager.html']]);
        assert.doesNotMatch(JSON.stringify({ result, calls }), /synthetic-canary/);
    }
});

test('a fragment is always removed and can preserve only an explicit canonical mode', () => {
    const preserved = navigation({ search: '?mode=demo', hash: '#synthetic-canary' });
    assert.deepEqual(sanitizeSourceManagerNavigation(preserved.input), {
        status: 'sanitized', sessionMode: 'demo'
    });
    assert.deepEqual(preserved.calls, [[null, '', '/source-manager.html?mode=demo']]);

    const blocked = navigation({ hash: '#synthetic-canary' });
    assert.deepEqual(sanitizeSourceManagerNavigation(blocked.input), {
        status: 'blocked',
        sessionMode: null,
        code: 'NAVIGATION_SANITIZATION_FAILED'
    });
    assert.deepEqual(blocked.calls, [[null, '', '/source-manager.html']]);
});

test('invalid path, hostile descriptors, Proxies, and history failure return only the fixed block', () => {
    const blocked = {
        status: 'blocked',
        sessionMode: null,
        code: 'NAVIGATION_SANITIZATION_FAILED'
    };
    const wrongPath = navigation({ pathname: '/other.html' });
    assert.deepEqual(sanitizeSourceManagerNavigation(wrongPath.input), blocked);
    assert.deepEqual(wrongPath.calls, []);

    let getters = 0;
    const accessor = { ...CLEAN_REAL };
    Object.defineProperty(accessor, 'search', {
        enumerable: true,
        get() { getters += 1; return '?mode=demo'; }
    });
    assert.deepEqual(sanitizeSourceManagerNavigation(accessor), blocked);
    assert.equal(getters, 0);

    const revoked = Proxy.revocable({ ...CLEAN_REAL }, {});
    revoked.revoke();
    assert.deepEqual(sanitizeSourceManagerNavigation(revoked.proxy), blocked);

    const historyFailure = navigation({
        search: '?code=synthetic-canary&mode=real',
        replaceState() { throw new Error('private history failure'); }
    });
    assert.deepEqual(sanitizeSourceManagerNavigation(historyFailure.input), blocked);
    assert.equal(historyFailure.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(blocked), /private|history|synthetic-canary/);
});
