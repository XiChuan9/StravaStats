import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSourceManagerAuthorization,
    SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE
} from '../../js/app/source-manager-authorization.js';

const STATE_KEY = 'source_manager_authorization_state';
const NOW = 1_800_000_000_000;
const SCOPES = Object.freeze(['read', 'activity:read_all']);

class MemoryStorage {
    constructor(values = {}) {
        this.values = new Map(Object.entries(values));
        this.operations = [];
        this.failRemove = false;
    }
    getItem(key) {
        this.operations.push(['get', key]);
        return this.values.has(key) ? this.values.get(key) : null;
    }
    setItem(key, value) {
        this.operations.push(['set', key, value]);
        this.values.set(key, value);
    }
    removeItem(key) {
        this.operations.push(['remove', key]);
        if (this.failRemove) throw new Error('SyntheticStateRemovalFailure');
        this.values.delete(key);
    }
}

function response(body, { status = 200, contentType = 'application/json' } = {}) {
    const serialized = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get(name) {
                if (String(name).toLowerCase() === 'content-type') return contentType;
                if (String(name).toLowerCase() === 'content-length') {
                    return String(new TextEncoder().encode(serialized).byteLength);
                }
                return null;
            }
        },
        async text() { return serialized; }
    };
}

function harness({ storage = new MemoryStorage(), fetchImpl } = {}) {
    const calls = { fetch: [], navigate: [], random: [], timers: [], cleared: [] };
    const queue = [];
    if (fetchImpl === undefined) {
        queue.push(response({ stravaClientId: '12345' }));
    }
    const authorization = createSourceManagerAuthorization({
        fetchImpl: fetchImpl ?? (async (...args) => {
            calls.fetch.push(args);
            return queue.shift();
        }),
        sessionStorage: storage,
        crypto: {
            getRandomValues(bytes) {
                calls.random.push(bytes.length);
                for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
                return bytes;
            }
        },
        origin: 'https://synthetic.example',
        navigate(url) { calls.navigate.push(url); },
        now: () => NOW,
        setTimeoutImpl(callback, delay) {
            calls.timers.push([callback, delay]);
            return calls.timers.length;
        },
        clearTimeoutImpl(id) { calls.cleared.push(id); },
        AbortControllerImpl: AbortController
    });
    return { authorization, storage, calls, queue };
}

function storedState(storage, overrides = {}) {
    return JSON.stringify({
        schemaVersion: 1,
        state: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq',
        createdAt: NOW - 1_000,
        expiresAt: NOW + 599_000,
        returnPath: '/source-manager.html?mode=real',
        ...overrides
    });
}

test('authorization constants and controller surface are exact and frozen', () => {
    assert.deepEqual(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE, {
        INVALID_REQUEST: 'AUTHORIZATION_INVALID_REQUEST',
        STATE_UNAVAILABLE: 'AUTHORIZATION_STATE_UNAVAILABLE',
        STATE_INVALID: 'AUTHORIZATION_STATE_INVALID',
        STATE_EXPIRED: 'AUTHORIZATION_STATE_EXPIRED',
        ACCESS_DENIED: 'AUTHORIZATION_ACCESS_DENIED',
        CONFIG_FAILED: 'AUTHORIZATION_CONFIG_FAILED',
        EXCHANGE_FAILED: 'AUTHORIZATION_EXCHANGE_FAILED',
        TOKEN_INVALID: 'AUTHORIZATION_TOKEN_INVALID',
        CLOSED: 'AUTHORIZATION_CLOSED'
    });
    assert.equal(Object.isFrozen(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE), true);
    const { authorization } = harness();
    assert.deepEqual(Object.keys(authorization), [
        'beginAuthorization', 'processCallback', 'revoke', 'close'
    ]);
    assert.equal(Object.isFrozen(authorization), true);
});

test('beginAuthorization stores one 32-byte ten-minute state before exact config fetch and navigation', async () => {
    const { authorization, storage, calls } = harness();
    const result = await authorization.beginAuthorization();

    assert.deepEqual(result, { status: 'redirecting' });
    assert.deepEqual(calls.random, [32]);
    assert.equal(storage.operations[0][0], 'set');
    assert.equal(storage.operations[0][1], STATE_KEY);
    const record = JSON.parse(storage.operations[0][2]);
    assert.deepEqual(Object.keys(record), [
        'schemaVersion', 'state', 'createdAt', 'expiresAt', 'returnPath'
    ]);
    assert.equal(record.state, 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8');
    assert.equal(record.state.length, 43);
    assert.equal(record.createdAt, NOW);
    assert.equal(record.expiresAt, NOW + 600_000);
    assert.equal(record.returnPath, '/source-manager.html?mode=real');
    assert.deepEqual(calls.fetch, [[
        '/api/config',
        {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: calls.fetch[0][1].signal
        }
    ]]);
    assert.equal(calls.timers[0][1], 15_000);
    assert.deepEqual(calls.cleared, [1]);
    const url = new URL(calls.navigate[0]);
    assert.equal(url.origin, 'https://www.strava.com');
    assert.equal(url.pathname, '/oauth/authorize');
    assert.deepEqual([...url.searchParams.keys()], [
        'client_id', 'redirect_uri', 'response_type', 'scope', 'state'
    ]);
    assert.equal(url.searchParams.get('client_id'), '12345');
    assert.equal(
        url.searchParams.get('redirect_uri'),
        'https://synthetic.example/source-manager.html?mode=real'
    );
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('scope'), 'read,activity:read_all');
    assert.equal(url.searchParams.get('state'), record.state);
});

test('callback consumes state before exchange and returns only exact five-field authority', async () => {
    const state = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    const storage = new MemoryStorage({ [STATE_KEY]: storedState(new MemoryStorage()) });
    const { authorization, calls, queue } = harness({ storage });
    queue.length = 0;
    queue.push(response({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000,
        subject_id: '424242',
        granted_scopes: [...SCOPES]
    }));

    const result = await authorization.processCallback({
        kind: 'code',
        code: 'synthetic-code',
        state,
        grantedScopes: [...SCOPES]
    });

    assert.deepEqual(result, {
        status: 'authorized',
        token: {
            access_token: 'synthetic-access',
            refresh_token: 'synthetic-refresh',
            expires_at: 2_100_000_000,
            subject_id: '424242',
            granted_scopes: [...SCOPES]
        }
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.token), true);
    assert.equal(Object.isFrozen(result.token.granted_scopes), true);
    assert.deepEqual(storage.operations.slice(0, 2).map(item => item.slice(0, 2)), [
        ['get', STATE_KEY], ['remove', STATE_KEY]
    ]);
    assert.deepEqual(calls.fetch, [[
        '/api/strava-auth',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'synthetic-code',
                granted_scopes: [...SCOPES]
            }),
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: calls.fetch[0][1].signal
        }
    ]]);
});

test('callback blocks before exchange when single-use state deletion fails', async () => {
    const state = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    const storage = new MemoryStorage({ [STATE_KEY]: storedState(new MemoryStorage()) });
    storage.failRemove = true;
    const { authorization, calls } = harness({ storage });

    await assert.rejects(authorization.processCallback({
        kind: 'code',
        code: 'synthetic-code',
        state,
        grantedScopes: [...SCOPES]
    }), error => {
        assert.deepEqual(error, { code: 'AUTHORIZATION_STATE_UNAVAILABLE' });
        return true;
    });
    assert.equal(calls.fetch.length, 0);
    assert.equal(storage.values.has(STATE_KEY), true);
});

test('mismatch, replay, expiry, reduced scope, and malformed state fail before exchange', async () => {
    const cases = [
        ['mismatch', storedState(new MemoryStorage()), {
            kind: 'code', code: 'code', state: 'different', grantedScopes: [...SCOPES]
        }, 'AUTHORIZATION_STATE_INVALID'],
        ['expired', storedState(new MemoryStorage(), {
            createdAt: NOW - 600_001,
            expiresAt: NOW - 1
        }), {
            kind: 'code', code: 'code', state: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq', grantedScopes: [...SCOPES]
        }, 'AUTHORIZATION_STATE_EXPIRED'],
        ['reduced', storedState(new MemoryStorage()), {
            kind: 'code', code: 'code', state: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq', grantedScopes: ['read']
        }, 'AUTHORIZATION_INVALID_REQUEST'],
        ['missing', null, {
            kind: 'code', code: 'code', state: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq', grantedScopes: [...SCOPES]
        }, 'AUTHORIZATION_STATE_UNAVAILABLE']
    ];
    for (const [name, raw, callback, code] of cases) {
        const storage = new MemoryStorage(raw === null ? {} : { [STATE_KEY]: raw });
        const { authorization, calls } = harness({ storage });
        await assert.rejects(authorization.processCallback(callback), error => {
            assert.deepEqual(error, { code });
            assert.equal(Object.isFrozen(error), true);
            return true;
        }, name);
        assert.equal(calls.fetch.length, 0, name);
        assert.equal(storage.values.has(STATE_KEY), false, name);
    }
});

test('exact access_denied consumes state and performs zero exchange', async () => {
    const state = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq';
    const storage = new MemoryStorage({ [STATE_KEY]: storedState(new MemoryStorage()) });
    const { authorization, calls } = harness({ storage });
    await assert.rejects(
        authorization.processCallback({ kind: 'denied', state }),
        error => error.code === 'AUTHORIZATION_ACCESS_DENIED'
    );
    assert.equal(calls.fetch.length, 0);
    assert.equal(storage.values.has(STATE_KEY), false);
});

test('revoke uses the exact same-origin request and treats every failure as unconfirmed', async () => {
    for (const [providerResponse, expected] of [
        [response({ revoked: true }), true],
        [response({ error: 'fixed' }, { status: 502 }), false]
    ]) {
        const calls = [];
        const { authorization } = harness({
            fetchImpl: async (...args) => {
                calls.push(args);
                return providerResponse;
            }
        });
        assert.equal(await authorization.revoke('synthetic-refresh'), expected);
        assert.equal(calls[0][0], '/api/strava-revoke');
        assert.deepEqual({ ...calls[0][1], signal: null }, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: 'synthetic-refresh' }),
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: null
        });
    }
    const { authorization } = harness({
        fetchImpl: async () => { throw new Error('synthetic-private-network'); }
    });
    assert.equal(await authorization.revoke('synthetic-refresh'), false);
});

test('close is idempotent and every later action fails with one fixed error', async () => {
    const { authorization } = harness();
    const first = await authorization.close();
    const second = await authorization.close();
    assert.deepEqual(first, { status: 'closed' });
    assert.strictEqual(first, second);
    for (const operation of [
        () => authorization.beginAuthorization(),
        () => authorization.processCallback({}),
        () => authorization.revoke('synthetic-refresh')
    ]) {
        await assert.rejects(operation(), error => {
            assert.deepEqual(error, { code: 'AUTHORIZATION_CLOSED' });
            return true;
        });
    }
});
