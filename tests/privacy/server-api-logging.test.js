import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as sharedApi from '../../api/_shared.js';
import authHandler from '../../api/strava-auth.js';
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
                await invokeWithoutRawRejection(authHandler, {
                    method: 'POST',
                    body: { code: 'synthetic-code' }
                }, response);
                assert.equal(response.statusCode, 502, 'safe auth network status');
                assertExactBody(response, { error: 'Cannot reach Strava' });
                assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_NETWORK_FAILED]);
            }
        );
    });

    await t.test('provider rejection', async () => {
        await withCapturedRuntime(
            async () => providerFailure(400),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(authHandler, {
                    method: 'POST',
                    body: { code: 'synthetic-code' }
                }, response);
                assert.equal(response.statusCode, 400, 'safe auth provider status');
                assertExactBody(response, { error: 'Strava auth failed' });
                assertClosedLogs(logs, [EXPECTED_EVENTS.AUTH_PROVIDER_REJECTED]);
            }
        );
    });
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
        Object.freeze({ name: 'auth', handler: authHandler, request: { method: 'POST', body: { code: 'synthetic-code' } }, status: 502, event: EXPECTED_EVENTS.AUTH_NETWORK_FAILED }),
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
                        error: scenario.name === 'auth' ? 'Cannot reach Strava' : 'Internal Server Error'
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
            async () => providerSuccess({ synthetic: true }),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(authHandler, {
                    method: 'POST',
                    body: { code: 'synthetic-code' }
                }, response);
                assert.equal(response.statusCode, 200, 'safe auth success status');
                assertClosedLogs(logs, []);
            }
        );
    });

    await t.test('auth preserves the existing empty success fallback', async () => {
        await withCapturedRuntime(
            async () => ({
                ok: true,
                status: 200,
                async json() {
                    throw new Error('synthetic-json-marker');
                }
            }),
            async logs => {
                const response = createResponse();
                await invokeWithoutRawRejection(authHandler, {
                    method: 'POST',
                    body: { code: 'synthetic-code' }
                }, response);
                assert.equal(response.statusCode, 200, 'safe auth fallback status');
                assertExactBody(response, {});
                assertClosedLogs(logs, []);
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
    } finally {
        console.error = originalConsoleError;
        await new Promise(resolve => server.close(resolve));
    }
});
