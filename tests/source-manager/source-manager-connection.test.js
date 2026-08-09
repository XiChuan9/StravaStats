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

test('connection controller has the exact fail-closed surface and ignores hostile arguments', () => {
    let traps = 0;
    const hostile = new Proxy({}, {
        get() { traps += 1; throw new Error('private getter'); },
        ownKeys() { traps += 1; throw new Error('private keys'); }
    });
    const controller = createSourceManagerConnectionController(hostile);

    assert.equal(traps, 0);
    assert.deepEqual(Object.keys(controller), [
        'getConnectionSnapshot',
        'beginConnect',
        'disconnect',
        'close'
    ]);
    assert.equal(Object.isFrozen(controller), true);

    const snapshot = controller.getConnectionSnapshot();
    assert.deepEqual(snapshot, {
        schemaVersion: 1,
        status: 'authorization_unavailable',
        code: 'AUTHORIZATION_UNAVAILABLE',
        actions: { connect: false, disconnect: false }
    });
    assert.strictEqual(controller.getConnectionSnapshot(), snapshot);
    assertDeepFrozen(snapshot);
});

test('connection actions reject with exact safe objects before and after idempotent close', async () => {
    const controller = createSourceManagerConnectionController();
    const unavailable = error => {
        assert.deepEqual(error, { code: 'AUTHORIZATION_UNAVAILABLE' });
        assert.deepEqual(Object.keys(error), ['code']);
        assert.equal(Object.isFrozen(error), true);
        return true;
    };
    await assert.rejects(controller.beginConnect(), unavailable);
    await assert.rejects(controller.disconnect(), unavailable);

    const snapshot = controller.getConnectionSnapshot();
    const firstClose = await controller.close();
    const secondClose = await controller.close();
    assert.deepEqual(firstClose, { status: 'closed' });
    assert.strictEqual(firstClose, secondClose);
    assert.equal(Object.isFrozen(firstClose), true);
    assert.strictEqual(controller.getConnectionSnapshot(), snapshot);

    const closed = error => {
        assert.deepEqual(error, { code: 'CONNECTION_CLOSED' });
        assert.deepEqual(Object.keys(error), ['code']);
        assert.equal(Object.isFrozen(error), true);
        return true;
    };
    await assert.rejects(controller.beginConnect(), closed);
    await assert.rejects(controller.disconnect(), closed);
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

test('OAuth-shaped material is scrubbed once and preserves one exact explicit mode', () => {
    const canary = 'synthetic-private-callback-canary';
    for (const mode of ['real', 'demo']) {
        const { input, calls } = navigation({
            search: `?code=${canary}&state=${canary}&mode=${mode}`,
            hash: `#scope=${canary}`
        });
        const result = sanitizeSourceManagerNavigation(input);
        assert.deepEqual(result, { status: 'sanitized', sessionMode: mode });
        assert.deepEqual(calls, [[null, '', `/source-manager.html?mode=${mode}`]]);
        assert.doesNotMatch(JSON.stringify({ result, calls }), new RegExp(canary));
    }
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
