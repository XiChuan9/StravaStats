import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as sharedApi from '../../api/_shared.js';
import authHandler from '../../api/strava-auth.js';
import revokeHandler from '../../api/strava-revoke.js';
import activitiesHandler from '../../api/strava-activities.js';
import activityHandler from '../../api/strava-activity.js';
import athleteHandler from '../../api/strava-athlete.js';
import gearHandler from '../../api/strava-gear.js';
import streamsHandler from '../../api/strava-streams.js';
import zonesHandler from '../../api/strava-zones.js';

const ROOT_URL = new URL('../../', import.meta.url);
const TASK_BRIEF_URL = new URL('../../docs/tasks/pr-29-server-log-redaction.md', import.meta.url);
const LOCAL_SERVER_URL = new URL('../../scripts/local-dev-server.mjs', import.meta.url);

const EXPECTED_EVENTS = Object.freeze({
    TOKEN_REFRESH_FAILED: 'server_api.token_refresh_failed',
    AUTH_NETWORK_FAILED: 'server_api.auth_network_failed',
    AUTH_PROVIDER_REJECTED: 'server_api.auth_provider_rejected',
    AUTH_RESPONSE_INVALID: 'server_api.auth_response_invalid',
    REVOKE_NETWORK_FAILED: 'server_api.revoke_network_failed',
    REVOKE_PROVIDER_REJECTED: 'server_api.revoke_provider_rejected',
    ACTIVITIES_FAILED: 'server_api.activities_failed',
    ACTIVITY_FAILED: 'server_api.activity_failed',
    ATHLETE_FAILED: 'server_api.athlete_failed',
    GEAR_FAILED: 'server_api.gear_failed',
    STREAMS_FAILED: 'server_api.streams_failed',
    ZONES_FAILED: 'server_api.zones_failed',
    LOCAL_HANDLER_FAILED: 'server_api.local_handler_failed'
});

const HANDLERS = Object.freeze([
    Object.freeze({
        name: 'activities',
        handler: activitiesHandler,
        query: Object.freeze({}),
        event: EXPECTED_EVENTS.ACTIVITIES_FAILED,
        providerStatus: 503,
        responseStatus: 500,
        providerError: 'Failed to fetch activities from Strava'
    }),
    Object.freeze({
        name: 'activity',
        handler: activityHandler,
        query: Object.freeze({ id: 'synthetic-opaque-id' }),
        event: EXPECTED_EVENTS.ACTIVITY_FAILED,
        providerStatus: 404,
        providerError: 'Failed to fetch activity from Strava'
    }),
    Object.freeze({
        name: 'athlete',
        handler: athleteHandler,
        query: Object.freeze({}),
        event: EXPECTED_EVENTS.ATHLETE_FAILED,
        providerStatus: 403,
        providerError: 'Failed to fetch athlete from Strava'
    }),
    Object.freeze({
        name: 'gear',
        handler: gearHandler,
        query: Object.freeze({ id: 'synthetic-opaque-id' }),
        event: EXPECTED_EVENTS.GEAR_FAILED,
        providerStatus: 404,
        providerError: 'Failed to fetch gear from Strava'
    }),
    Object.freeze({
        name: 'streams',
        handler: streamsHandler,
        query: Object.freeze({ id: 'synthetic-opaque-id', type: 'time' }),
        event: EXPECTED_EVENTS.STREAMS_FAILED,
        providerStatus: 429,
        providerError: 'Failed to fetch streams from Strava'
    }),
    Object.freeze({
        name: 'zones',
        handler: zonesHandler,
        query: Object.freeze({}),
        event: EXPECTED_EVENTS.ZONES_FAILED,
        providerStatus: 403,
        providerError: 'Failed to fetch zones from Strava'
    })
]);

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        ended: false,
        headers: Object.create(null),
        setHeader(name, value) {
            this.headers[name] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(value) {
            this.body = value;
            this.ended = true;
            return this;
        },
        end(value = '') {
            this.body = value;
            this.ended = true;
            return this;
        }
    };
}

function encodedToken(expiresAt = 4_102_444_800) {
    return Buffer.from(JSON.stringify({
        access_token: 'synthetic-access-value',
        refresh_token: 'synthetic-refresh-value',
        expires_at: expiresAt
    })).toString('base64');
}

function createRequest(query = {}, expiresAt) {
    return {
        method: 'GET',
        headers: { authorization: `Bearer ${encodedToken(expiresAt)}` },
        query,
        body: undefined
    };
}

function providerFailure(status) {
    return {
        ok: false,
        status,
        async json() {
            return { message: 'synthetic-provider-marker' };
        },
        async text() {
            return 'synthetic-provider-marker';
        }
    };
}

function providerSuccess(payload) {
    return {
        ok: true,
        status: 200,
        async json() {
            return payload;
        },
        async text() {
            return '';
        }
    };
}

async function withCapturedRuntime(fetchImpl, callback) {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const originalClientId = process.env.STRAVA_CLIENT_ID;
    const originalClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const logs = [];

    globalThis.fetch = fetchImpl;
    console.error = (...args) => logs.push(args);
    process.env.STRAVA_CLIENT_ID = 'synthetic-client-id';
    process.env.STRAVA_CLIENT_SECRET = 'synthetic-client-value';

    try {
        return await callback(logs);
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
        if (originalClientId === undefined) delete process.env.STRAVA_CLIENT_ID;
        else process.env.STRAVA_CLIENT_ID = originalClientId;
        if (originalClientSecret === undefined) delete process.env.STRAVA_CLIENT_SECRET;
        else process.env.STRAVA_CLIENT_SECRET = originalClientSecret;
    }
}

function assertClosedLogs(logs, expected) {
    assert.equal(logs.length, expected.length, 'safe log count');
    assert.equal(
        logs.every((args, index) => args.length === 1 && args[0] === expected[index]),
        true,
        'safe closed log arguments'
    );
}

function assertExactBody(response, expected) {
    assert.equal(
        JSON.stringify(response.body) === JSON.stringify(expected),
        true,
        'safe fixed response body'
    );
}

async function invokeWithoutRawRejection(handler, req, res) {
    let rejected = false;
    try {
        await handler(req, res);
    } catch {
        rejected = true;
    }
    assert.equal(rejected, false, 'safe handler containment');
}

test('Task Brief freezes the exact eleven-path R4 hard maximum', async () => {
    const source = await readFile(TASK_BRIEF_URL, 'utf8');
    const match = source.match(/The minimum cumulative hard maximum is exactly these eleven paths:\n\n```text\n([\s\S]*?)\n```/);
    assert.ok(match, 'safe allowlist block');
    assert.deepEqual(match[1].split('\n'), [
        'docs/tasks/pr-29-server-log-redaction.md',
        'api/_shared.js',
        'api/strava-auth.js',
        'api/strava-activities.js',
        'api/strava-activity.js',
        'api/strava-athlete.js',
        'api/strava-gear.js',
        'api/strava-streams.js',
        'api/strava-zones.js',
        'scripts/local-dev-server.mjs',
        'tests/privacy/server-api-logging.test.js'
    ]);
});

test('shared server event API is exact, frozen, and rejects arbitrary values without logging', async () => {
    assert.deepEqual(Object.keys(sharedApi).sort(), [
        'SERVER_API_EVENT',
        'getValidAccessToken',
        'logServerEvent',
        'validateEnv'
    ]);
    assert.deepEqual(sharedApi.SERVER_API_EVENT, EXPECTED_EVENTS);
    assert.equal(Object.isFrozen(sharedApi.SERVER_API_EVENT), true);

    await withCapturedRuntime(async () => providerSuccess({}), async logs => {
        const hostile = new Proxy(Object.create(null), {
            get() {
                assert.fail('safe event input trap');
            }
        });
        assert.throws(() => sharedApi.logServerEvent(hostile), TypeError);
        assertClosedLogs(logs, []);
    });
});

test('server/API production sources use only the shared closed logger and fixed failure bodies', async () => {
    const apiFiles = [
        'api/_shared.js',
        'api/strava-auth.js',
        'api/strava-revoke.js',
        'api/strava-activities.js',
        'api/strava-activity.js',
        'api/strava-athlete.js',
        'api/strava-gear.js',
        'api/strava-streams.js',
        'api/strava-zones.js'
    ];

    for (const relativePath of apiFiles) {
        const source = await readFile(new URL(relativePath, ROOT_URL), 'utf8');
        if (relativePath !== 'api/_shared.js') {
            assert.equal(source.includes('console.'), false, `safe logger boundary: ${relativePath}`);
        }
        assert.equal(/\.\s*(?:message|stack|cause)\b/.test(source), false, `safe raw error guard: ${relativePath}`);
        assert.equal(/\bdetails\s*:/.test(source), false, `safe provider details guard: ${relativePath}`);
    }

    const sharedSource = await readFile(new URL('api/_shared.js', ROOT_URL), 'utf8');
    assert.equal(/response\.text\s*\(/.test(sharedSource), false, 'safe refresh body guard');

    const localSource = await readFile(LOCAL_SERVER_URL, 'utf8');
    assert.equal(localSource.includes('console.error'), false, 'safe local logger boundary');
    assert.equal(/\.\s*(?:message|stack|cause)\b/.test(localSource), false, 'safe local raw error guard');
});

function jsonProviderResponse(body, status = 200) {
    const serialized = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get(name) {
                if (String(name).toLowerCase() === 'content-type') return 'application/json';
                if (String(name).toLowerCase() === 'content-length') {
                    return String(Buffer.byteLength(serialized));
                }
                return null;
            }
        },
        async text() { return serialized; }
    };
}

function emptyRevokeResponse() {
    return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        async text() { return ''; }
    };
}

function sourceManagerAuthRequest(body) {
    return {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
    };
}

test('Source Manager exchange is exact, bounded, reduced, timed, and no-store', async () => {
    let upstream;
    await withCapturedRuntime(async (...args) => {
        upstream = args;
        return jsonProviderResponse({
            access_token: 'synthetic-access',
            refresh_token: 'synthetic-refresh',
            expires_at: 2_100_000_000,
            athlete: {
                id: 424242,
                firstname: 'private-profile-canary'
            },
            unknown: 'private-upstream-canary'
        });
    }, async logs => {
        const response = createResponse();
        await authHandler(sourceManagerAuthRequest({
            code: 'synthetic-code',
            granted_scopes: ['read', 'activity:read_all']
        }), response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, {
            access_token: 'synthetic-access',
            refresh_token: 'synthetic-refresh',
            expires_at: 2_100_000_000,
            subject_id: '424242',
            granted_scopes: ['read', 'activity:read_all']
        });
        assert.equal(response.headers['Cache-Control'], 'no-store');
        assert.equal(response.headers.Pragma, 'no-cache');
        assert.equal(response.headers['Referrer-Policy'], 'no-referrer');
        assertClosedLogs(logs, []);
    });
    assert.equal(upstream[0], 'https://www.strava.com/oauth/token');
    assert.equal(upstream[1].method, 'POST');
    assert.equal(upstream[1].body instanceof URLSearchParams, true);
    assert.equal(upstream[1].body.get('client_secret'), 'synthetic-client-value');
    assert.equal(upstream[1].body.get('code'), 'synthetic-code');
    assert.equal(upstream[1].signal instanceof AbortSignal, true);
});

test('Source Manager exchange keeps the upstream timeout active through body consumption', async () => {
    const originalClearTimeout = globalThis.clearTimeout;
    let bodyConsumed = false;
    let clearedAfterBody = null;
    globalThis.clearTimeout = timer => {
        clearedAfterBody = bodyConsumed;
        return originalClearTimeout(timer);
    };
    try {
        await withCapturedRuntime(async () => {
            const response = jsonProviderResponse({
                access_token: 'synthetic-access',
                refresh_token: 'synthetic-refresh',
                expires_at: 2_100_000_000,
                athlete: { id: 424242 }
            });
            const read = response.text;
            response.text = async () => {
                bodyConsumed = true;
                return read();
            };
            return response;
        }, async () => {
            const response = createResponse();
            await authHandler(sourceManagerAuthRequest({ code: 'synthetic-code' }), response);
            assert.equal(response.statusCode, 200);
        });
    } finally {
        globalThis.clearTimeout = originalClearTimeout;
    }
    assert.equal(clearedAfterBody, true);
});

test('legacy code-only exchange stays reduced and cannot invent five-field authority', async () => {
    await withCapturedRuntime(async () => jsonProviderResponse({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000,
        athlete: { id: '424242' }
    }), async logs => {
        const response = createResponse();
        await authHandler(sourceManagerAuthRequest({ code: 'synthetic-code' }), response);
        assert.deepEqual(response.body, {
            access_token: 'synthetic-access',
            refresh_token: 'synthetic-refresh',
            expires_at: 2_100_000_000,
            subject_id: '424242'
        });
        assert.equal(Object.hasOwn(response.body, 'granted_scopes'), false);
        assertClosedLogs(logs, []);
    });
});

test('auth rejects extra keys, bad scopes, content type, and oversized code before upstream work', async () => {
    const requests = [
        sourceManagerAuthRequest({ code: 'code', extra: true }),
        sourceManagerAuthRequest({ code: 'code', granted_scopes: ['read'] }),
        { ...sourceManagerAuthRequest({ code: 'code' }), headers: { 'content-type': 'text/plain' } },
        sourceManagerAuthRequest({ code: 'x'.repeat(513) })
    ];
    for (const request of requests) {
        await withCapturedRuntime(async () => {
            assert.fail('upstream fetch must not run');
        }, async logs => {
            const response = createResponse();
            await authHandler(request, response);
            assert.equal(response.statusCode, 400);
            assertExactBody(response, { error: 'AUTH_REQUEST_INVALID' });
            assert.equal(response.headers['Cache-Control'], 'no-store');
            assertClosedLogs(logs, []);
        });
    }
});

test('malformed auth provider payload is fixed, redacted, and closed', async () => {
    await withCapturedRuntime(async () => jsonProviderResponse({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_at: 2_100_000_000,
        athlete: { id: 'private-invalid-subject' }
    }), async logs => {
        const response = createResponse();
        await authHandler(sourceManagerAuthRequest({
            code: 'synthetic-code',
            granted_scopes: ['read', 'activity:read_all']
        }), response);
        assert.equal(response.statusCode, 502);
        assertExactBody(response, { error: 'AUTH_RESPONSE_INVALID' });
        assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_RESPONSE_INVALID]);
        assert.doesNotMatch(JSON.stringify({ body: response.body, logs }), /private-invalid-subject/);
    });
});

test('server revoke uses refresh token only upstream with Basic auth and a reduced response', async () => {
    let upstream;
    await withCapturedRuntime(async (...args) => {
        upstream = args;
        return emptyRevokeResponse();
    }, async logs => {
        const response = createResponse();
        await revokeHandler(sourceManagerAuthRequest({
            refresh_token: 'synthetic-refresh'
        }), response);
        assert.equal(response.statusCode, 200);
        assertExactBody(response, { revoked: true });
        assert.equal(response.headers['Cache-Control'], 'no-store');
        assertClosedLogs(logs, []);
    });
    assert.equal(upstream[0], 'https://www.strava.com/oauth/revoke');
    assert.equal(upstream[1].method, 'POST');
    assert.equal(
        upstream[1].headers.Authorization,
        `Basic ${Buffer.from('synthetic-client-id:synthetic-client-value').toString('base64')}`
    );
    assert.equal(upstream[1].headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(upstream[1].body, 'token=synthetic-refresh');
    assert.equal(upstream[1].signal instanceof AbortSignal, true);
    assert.doesNotMatch(JSON.stringify(upstream[1].headers), /synthetic-refresh/);
});

test('server revoke confirms only the exact bounded empty provider response', async () => {
    for (const providerResponse of [
        {
            ok: true,
            status: 200,
            headers: { get: name => String(name).toLowerCase() === 'content-type' ? 'text/html' : null },
            async text() { return '<html>synthetic proxy response</html>'; }
        },
        {
            ok: true,
            status: 200,
            headers: { get: name => String(name).toLowerCase() === 'content-length' ? '1' : null },
            async text() { return 'x'; }
        },
        {
            ok: true,
            status: 204,
            headers: { get: () => null },
            async text() { return ''; }
        },
        {
            ok: true,
            status: 200,
            async text() { return ''; }
        },
        {
            ok: true,
            status: 200,
            headers: { get() { throw new Error('synthetic header failure'); } },
            async text() { return ''; }
        }
    ]) {
        await withCapturedRuntime(async () => providerResponse, async logs => {
            const response = createResponse();
            await revokeHandler(sourceManagerAuthRequest({
                refresh_token: 'synthetic-refresh'
            }), response);
            assert.equal(response.statusCode, 502);
            assertExactBody(response, { error: 'REVOCATION_UNCONFIRMED' });
            assertClosedLogs(logs, [EXPECTED_EVENTS.REVOKE_PROVIDER_REJECTED]);
        });
    }
});

test('server revoke failures are fixed and never reflect refresh token or provider details', async () => {
    await withCapturedRuntime(async () => ({ ok: false, status: 503 }), async logs => {
        const response = createResponse();
        await revokeHandler(sourceManagerAuthRequest({
            refresh_token: 'synthetic-private-refresh'
        }), response);
        assert.equal(response.statusCode, 502);
        assertExactBody(response, { error: 'REVOCATION_UNCONFIRMED' });
        assertClosedLogs(logs, [EXPECTED_EVENTS.REVOKE_PROVIDER_REJECTED]);
        assert.doesNotMatch(JSON.stringify({ body: response.body, logs }), /synthetic-private-refresh/);
    });
});

test('all ordinary provider failures preserve statuses with fixed logs and response bodies', async t => {
    for (const scenario of HANDLERS) {
        await t.test(scenario.name, async () => {
            await withCapturedRuntime(
                async () => providerFailure(scenario.providerStatus),
                async logs => {
                    const response = createResponse();
                    await invokeWithoutRawRejection(
                        scenario.handler,
                        createRequest(scenario.query),
                        response
                    );
                    assert.equal(response.statusCode, scenario.responseStatus ?? scenario.providerStatus, 'safe provider status');
                    assertExactBody(response, { error: scenario.providerError });
                    assertClosedLogs(logs, [scenario.event]);
                }
            );
        });
    }
});

test('token exchange failures use fixed events and fixed response bodies', async t => {
    await t.test('network failure', async () => {
        await withCapturedRuntime(
            async () => {
                throw new Error('synthetic-network-marker');
            },
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(
                    authHandler,
                    sourceManagerAuthRequest({ code: 'synthetic-code' }),
                    response
                );
                assert.equal(response.statusCode, 502, 'safe auth network status');
                assertExactBody(response, { error: 'AUTH_NETWORK_FAILED' });
                assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_NETWORK_FAILED]);
            }
        );
    });

    await t.test('provider rejection', async () => {
        await withCapturedRuntime(
            async () => providerFailure(400),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(
                    authHandler,
                    sourceManagerAuthRequest({ code: 'synthetic-code' }),
                    response
                );
                assert.equal(response.statusCode, 502, 'safe auth provider status');
                assertExactBody(response, { error: 'AUTH_PROVIDER_REJECTED' });
                assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_PROVIDER_REJECTED]);
            }
        );
    });
});

test('token exchange rejects absent and accessor-backed request bodies before side effects', async t => {
    const cases = [
        Object.freeze({
            name: 'absent body',
            request: sourceManagerAuthRequest(undefined),
            getReads: () => 0
        }),
        (() => {
            let reads = 0;
            const request = {
                method: 'POST',
                headers: { 'content-type': 'application/json' }
            };
            Object.defineProperty(request, 'body', {
                enumerable: true,
                get() {
                    reads += 1;
                    throw new Error('synthetic-body-marker');
                }
            });
            return Object.freeze({ name: 'body accessor', request, getReads: () => reads });
        })(),
        (() => {
            let reads = 0;
            const body = {};
            Object.defineProperty(body, 'code', {
                enumerable: true,
                get() {
                    reads += 1;
                    throw new Error('synthetic-code-marker');
                }
            });
            return Object.freeze({
                name: 'code accessor',
                request: sourceManagerAuthRequest(body),
                getReads: () => reads
            });
        })()
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, async () => {
            let fetchCalls = 0;
            await withCapturedRuntime(
                async () => {
                    fetchCalls += 1;
                    return providerSuccess({});
                },
                async logs => {
                    const response = createResponse();
                    await invokeWithoutRawRejection(authHandler, scenario.request, response);
                    assert.equal(scenario.getReads(), 0, 'safe request accessor count');
                    assert.equal(fetchCalls, 0, 'safe preflight fetch count');
                    assert.equal(response.statusCode, 400, 'safe missing code status');
                    assertExactBody(response, { error: 'AUTH_REQUEST_INVALID' });
                    assertClosedLogs(logs, []);
                }
            );
        });
    }
});

test('token exchange rejects Proxy request shapes without executing traps', async t => {
    for (const target of ['request', 'body']) {
        await t.test(target, async () => {
            let traps = 0;
            const hostile = new Proxy(Object.create(null), {
                get() {
                    traps += 1;
                    throw new Error('synthetic-proxy-get-marker');
                },
                getOwnPropertyDescriptor() {
                    traps += 1;
                    throw new Error('synthetic-proxy-descriptor-marker');
                },
                ownKeys() {
                    traps += 1;
                    throw new Error('synthetic-proxy-keys-marker');
                }
            });
            const request = target === 'request'
                ? hostile
                : sourceManagerAuthRequest(hostile);
            let fetchCalls = 0;

            await withCapturedRuntime(
                async () => {
                    fetchCalls += 1;
                    return providerSuccess({});
                },
                async logs => {
                    const response = createResponse();
                    await invokeWithoutRawRejection(authHandler, request, response);
                    assert.equal(traps, 0, 'safe request Proxy trap count');
                    assert.equal(fetchCalls, 0, 'safe Proxy preflight fetch count');
                    assert.equal(response.statusCode, target === 'request' ? 405 : 400, 'safe Proxy request status');
                    assertClosedLogs(logs, []);
                }
            );
        });
    }
});

test('token refresh failure does not read the provider body and emits only closed events', async () => {
    let textReads = 0;
    await withCapturedRuntime(
        async () => ({
            ok: false,
            status: 401,
            async text() {
                textReads += 1;
                return 'synthetic-provider-marker';
            }
        }),
        async logs => {
            const response = createResponse();
            await invokeWithoutRawRejection(
                athleteHandler,
                createRequest({}, 1),
                response
            );
            assert.equal(textReads, 0, 'safe refresh body read count');
            assert.equal(response.statusCode, 500, 'safe refresh failure status');
            assertExactBody(response, { error: 'Internal Server Error' });
            assertClosedLogs(logs, [
                EXPECTED_EVENTS.TOKEN_REFRESH_FAILED,
                EXPECTED_EVENTS.ATHLETE_FAILED
            ]);
        }
    );
});

test('hostile thrown values are never inspected, coerced, logged, or returned', async t => {
    const scenarios = [
        Object.freeze({
            name: 'auth',
            handler: authHandler,
            request: sourceManagerAuthRequest({ code: 'synthetic-code' }),
            status: 502,
            event: EXPECTED_EVENTS.AUTH_NETWORK_FAILED
        }),
        ...HANDLERS.map(scenario => Object.freeze({
            name: scenario.name,
            handler: scenario.handler,
            request: createRequest(scenario.query),
            status: 500,
            event: scenario.event
        }))
    ];

    for (const scenario of scenarios) {
        await t.test(scenario.name, async () => {
            let traps = 0;
            const hostile = new Proxy(Object.create(null), {
                get() {
                    traps += 1;
                    throw new Error('synthetic-trap-marker');
                },
                getOwnPropertyDescriptor() {
                    traps += 1;
                    throw new Error('synthetic-descriptor-marker');
                },
                ownKeys() {
                    traps += 1;
                    throw new Error('synthetic-keys-marker');
                }
            });

            await withCapturedRuntime(
                async () => { throw hostile; },
                async logs => {
                    const response = createResponse();
                    await invokeWithoutRawRejection(scenario.handler, scenario.request, response);
                    assert.equal(traps, 0, 'safe hostile trap count');
                    assert.equal(response.statusCode, scenario.status, 'safe hostile status');
                    assertExactBody(response, {
                        error: scenario.name === 'auth' ? 'AUTH_NETWORK_FAILED' : 'Internal Server Error'
                    });
                    assertClosedLogs(logs, [scenario.event]);
                }
            );
        });
    }
});

test('ordinary successes emit no server error event', async t => {
    for (const scenario of HANDLERS.filter(item => item.name !== 'activities')) {
        await t.test(scenario.name, async () => {
            await withCapturedRuntime(
                async () => providerSuccess({ synthetic: true }),
                async logs => {
                    const response = createResponse();
                    await invokeWithoutRawRejection(scenario.handler, createRequest(scenario.query), response);
                    assert.equal(response.statusCode, 200, 'safe success status');
                    assertClosedLogs(logs, []);
                }
            );
        });
    }

    await t.test('activities', async () => {
        let calls = 0;
        await withCapturedRuntime(
            async () => providerSuccess(calls++ === 0 ? [{ synthetic: true }] : []),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(activitiesHandler, createRequest(), response);
                assert.equal(response.statusCode, 200, 'safe activities success status');
                assertClosedLogs(logs, []);
            }
        );
    });

    await t.test('auth', async () => {
        await withCapturedRuntime(
            async () => jsonProviderResponse({
                access_token: 'synthetic-access',
                refresh_token: 'synthetic-refresh',
                expires_at: 4_102_444_800,
                athlete: { id: 424242 }
            }),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(
                    authHandler,
                    sourceManagerAuthRequest({ code: 'synthetic-code' }),
                    response
                );
                assert.equal(response.statusCode, 200, 'safe auth success status');
                assertExactBody(response, {
                    access_token: 'synthetic-access',
                    refresh_token: 'synthetic-refresh',
                    expires_at: 4_102_444_800,
                    subject_id: '424242'
                });
                assertClosedLogs(logs, []);
            }
        );
    });

    await t.test('auth fails closed on a malformed provider success body', async () => {
        await withCapturedRuntime(
            async () => jsonProviderResponse({ synthetic: true }),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(
                    authHandler,
                    sourceManagerAuthRequest({ code: 'synthetic-code' }),
                    response
                );
                assert.equal(response.statusCode, 502, 'safe auth invalid response status');
                assertExactBody(response, { error: 'AUTH_RESPONSE_INVALID' });
                assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_RESPONSE_INVALID]);
            }
        );
    });

    await t.test('token refresh success preserves the existing success envelope', async () => {
        let calls = 0;
        await withCapturedRuntime(
            async () => {
                calls += 1;
                if (calls === 1) {
                    return providerSuccess({
                        access_token: 'synthetic-new-access',
                        refresh_token: 'synthetic-new-refresh',
                        expires_at: 4_102_444_800
                    });
                }
                return providerSuccess({ synthetic: true });
            },
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(athleteHandler, createRequest({}, 1), response);
                assert.equal(response.statusCode, 200, 'safe refresh success status');
                assert.equal(calls, 2, 'safe refresh request count');
                assert.equal(response.body.tokens !== null, true, 'safe refreshed token presence');
                assertClosedLogs(logs, []);
            }
        );
    });
});

function requestLoopback(port, path, body) {
    return new Promise((resolve, reject) => {
        const req = httpRequest({
            host: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                body: Buffer.concat(chunks).toString('utf8')
            }));
        });
        req.on('error', reject);
        req.end(body);
    });
}

test('isolated actual-served local API failures are closed and synthetic', async () => {
    const source = await readFile(LOCAL_SERVER_URL, 'utf8');
    assert.equal(source.includes('export function createLocalDevServer'), true, 'safe local server seam');
    if (!source.includes('export function createLocalDevServer')) return;

    const moduleUrl = new URL(`../../scripts/local-dev-server.mjs?test=${Date.now()}`, import.meta.url);
    const localServer = await import(moduleUrl.href);
    const logs = [];
    const originalConsoleError = console.error;
    console.error = (...args) => logs.push(args);
    const server = localServer.createLocalDevServer();

    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        assert.equal(typeof address, 'object', 'safe loopback address');
        const result = await requestLoopback(address.port, '/api/strava-auth', '{');
        assert.equal(result.status, 500, 'safe served status');
        assert.equal(result.body === JSON.stringify({ error: 'Internal Server Error' }), true, 'safe served body');
        assertClosedLogs(logs, [EXPECTED_EVENTS.LOCAL_HANDLER_FAILED]);

        const outerResult = await requestLoopback(address.port, ['/api/', '%'].join(''), '');
        assert.equal(outerResult.status, 500, 'safe outer served status');
        assert.equal(outerResult.body === JSON.stringify({ error: 'Internal Server Error' }), true, 'safe outer served body');
        assertClosedLogs(logs, [
            EXPECTED_EVENTS.LOCAL_HANDLER_FAILED,
            EXPECTED_EVENTS.LOCAL_HANDLER_FAILED
        ]);
    } finally {
        console.error = originalConsoleError;
        await new Promise(resolve => server.close(resolve));
    }
});
