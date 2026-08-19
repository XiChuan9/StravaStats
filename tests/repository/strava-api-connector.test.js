import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE,
    RepositoryError
} from '../../js/repository/errors.js';
import {
    STRAVA_CONNECTOR_ERROR_CODE,
    StravaApiConnector,
    StravaConnectorError
} from '../../js/connectors/strava/strava-api-connector.js';

const RAW_TOKEN = JSON.stringify({
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    expires_at: 4102444800
});
const AUTHORITY_TOKEN = JSON.stringify({
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    expires_at: 4102444800,
    subject_id: '424242',
    granted_scopes: ['read', 'activity:read_all']
});
const ENCODED_TOKEN = 'synthetic-encoded-token';

function syntheticResponse({
    status = 200,
    body = {},
    retryAfter = null,
    jsonError = null,
    counters = null
} = {}) {
    let responseBody = body;
    if (
        body
        && typeof body === 'object'
        && !Array.isArray(body)
        && Array.isArray(body.activities)
        && !Object.hasOwn(body, 'has_more')
        && Reflect.ownKeys(body).every(key => key === 'activities' || key === 'tokens')
        && !(Object.hasOwn(body, 'tokens') && body.tokens === undefined)
    ) {
        responseBody = {
            activities: body.activities,
            has_more: false,
            tokens: Object.hasOwn(body, 'tokens') ? body.tokens : null
        };
    }
    let bytes;
    try {
        bytes = new TextEncoder().encode(
            jsonError ? '{' : JSON.stringify(responseBody)
        );
    } catch {
        bytes = new TextEncoder().encode('{');
    }
    let offset = 0;
    return {
        status,
        headers: {
            get(name) {
                counters && (counters.headerReads += 1);
                const normalized = String(name).toLowerCase();
                if (normalized === 'retry-after') return retryAfter;
                if (normalized === 'content-type') return 'application/json';
                return null;
            }
        },
        body: {
            getReader() {
                return {
                    async read() {
                        if (offset >= bytes.byteLength) return { done: true };
                        counters && (counters.jsonReads += 1);
                        if (jsonError) throw jsonError;
                        const value = bytes.subarray(offset);
                        offset = bytes.byteLength;
                        return { done: false, value };
                    },
                    async cancel() {
                        offset = bytes.byteLength;
                    },
                    releaseLock() {}
                };
            }
        }
    };
}

function createHarness({
    rawToken = RAW_TOKEN,
    encodedToken = ENCODED_TOKEN,
    response = syntheticResponse({ body: { activities: [] } }),
    now = () => Date.UTC(2030, 0, 1),
    tokenReader,
    tokenWriter,
    tokenEncoder,
    fetchImpl,
    AbortControllerImpl,
    setTimeoutImpl,
    clearTimeoutImpl
} = {}) {
    const calls = {
        fetch: [],
        reads: 0,
        writes: [],
        encodes: []
    };
    const connector = new StravaApiConnector({
        fetchImpl: fetchImpl || (async (...args) => {
            calls.fetch.push(args);
            return response;
        }),
        tokenReader: tokenReader || (() => {
            calls.reads += 1;
            return rawToken;
        }),
        tokenWriter: tokenWriter || (serialized => {
            calls.writes.push(serialized);
        }),
        tokenEncoder: tokenEncoder || (raw => {
            calls.encodes.push(raw);
            return encodedToken;
        }),
        now,
        ...(AbortControllerImpl ? { AbortControllerImpl } : {}),
        ...(setTimeoutImpl ? { setTimeoutImpl } : {}),
        ...(clearTimeoutImpl ? { clearTimeoutImpl } : {})
    });
    return { connector, calls };
}

async function assertConnectorError(promise, code, {
    operation,
    httpStatus = null,
    retryAfterSeconds = null
} = {}) {
    await assert.rejects(promise, error => {
        assert.ok(error instanceof StravaConnectorError);
        assert.equal(error.code, code);
        if (operation !== undefined) assert.equal(error.operation, operation);
        assert.equal(error.httpStatus, httpStatus);
        assert.equal(error.retryAfterSeconds, retryAfterSeconds);
        return true;
    });
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
}

function assertErrorIsImmutable(error) {
    const before = error.toJSON();
    const secret = 'synthetic-mutation-secret';
    const fields = [
        'message',
        'code',
        'operation',
        'retryable',
        'httpStatus',
        'retryAfterSeconds'
    ];

    assert.equal(Object.isFrozen(error), true);
    for (const field of fields) {
        assert.throws(() => {
            error[field] = secret;
        }, TypeError);
    }
    for (const field of ['cause', 'raw', 'body', 'payload', 'Authorization']) {
        assert.throws(() => {
            error[field] = secret;
        }, TypeError);
    }

    assert.deepEqual(error.toJSON(), before);
    assert.deepEqual(JSON.parse(JSON.stringify(error)), before);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-mutation-secret|stack/);
}

test('repository constants are exact and frozen', () => {
    assert.deepEqual(REPOSITORY_ERROR_CODE, {
        UNAUTHENTICATED: 'UNAUTHENTICATED',
        FORBIDDEN: 'FORBIDDEN',
        TOKEN_INVALID: 'TOKEN_INVALID',
        TOKEN_READ_FAILED: 'TOKEN_READ_FAILED',
        TOKEN_ENCODING_FAILED: 'TOKEN_ENCODING_FAILED',
        TOKEN_WRITE_FAILED: 'TOKEN_WRITE_FAILED',
        NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
        PROVIDER_HTTP_ERROR: 'PROVIDER_HTTP_ERROR',
        RATE_LIMITED: 'RATE_LIMITED',
        NOT_FOUND: 'NOT_FOUND',
        UNSUPPORTED_MODE: 'UNSUPPORTED_MODE',
        INVALID_REQUEST: 'INVALID_REQUEST',
        RESPONSE_INVALID: 'RESPONSE_INVALID'
    });
    assert.deepEqual(REPOSITORY_SOURCE, {
        CACHE: 'cache',
        NETWORK: 'network',
        DEMO: 'demo',
        MIXED: 'mixed',
        CANONICAL: 'canonical'
    });
    assert.deepEqual(REPOSITORY_WARNING_CODE, {
        CACHE_READ_FAILED: 'CACHE_READ_FAILED',
        CACHE_WRITE_FAILED: 'CACHE_WRITE_FAILED',
        ITEM_FETCH_FAILED: 'ITEM_FETCH_FAILED'
    });
    assert.ok(Object.isFrozen(REPOSITORY_ERROR_CODE));
    assert.ok(Object.isFrozen(REPOSITORY_SOURCE));
    assert.ok(Object.isFrozen(REPOSITORY_WARNING_CODE));
});

test('RepositoryError exposes stable safe fields and JSON', () => {
    const error = new RepositoryError(REPOSITORY_ERROR_CODE.RATE_LIMITED, {
        operation: 'listActivities',
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 60
    });
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'RepositoryError');
    assert.deepEqual(error.toJSON(), {
        name: 'RepositoryError',
        code: 'RATE_LIMITED',
        message: 'The provider rate limit was reached.',
        operation: 'listActivities',
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 60
    });
    const serialized = JSON.stringify(error);
    assert.doesNotMatch(serialized, /stack|synthetic-access-token|Authorization/);
});

test('RepositoryError invalid constructor input fails closed', () => {
    const error = new RepositoryError('provider said synthetic-secret', {
        operation: 'unknown',
        retryable: 'yes'
    });
    assert.equal(error.code, REPOSITORY_ERROR_CODE.INVALID_REQUEST);
    assert.equal(error.operation, null);
    assert.equal(error.retryable, false);
    assert.equal(error.httpStatus, null);
    assert.equal(error.retryAfterSeconds, null);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-secret|unknown/);
});

test('RepositoryError is immutable and remains redacted after mutation attempts', () => {
    const error = new RepositoryError(REPOSITORY_ERROR_CODE.RATE_LIMITED, {
        operation: 'listActivities',
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 60
    });
    assertErrorIsImmutable(error);
});

test('RepositoryError construction is deterministic and drops secret input', () => {
    const details = {
        operation: 'listActivities',
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 60
    };
    const first = new RepositoryError(REPOSITORY_ERROR_CODE.RATE_LIMITED, details);
    const second = new RepositoryError(REPOSITORY_ERROR_CODE.RATE_LIMITED, details);
    assert.deepEqual(first.toJSON(), second.toJSON());

    const invalid = new RepositoryError('synthetic-constructor-secret', {
        ...details,
        raw: 'synthetic-constructor-secret'
    });
    assertErrorIsImmutable(invalid);
    assert.doesNotMatch(
        JSON.stringify(invalid),
        /synthetic-constructor-secret/
    );
});

test('connector constants and module exports are exact', async () => {
    assert.deepEqual(STRAVA_CONNECTOR_ERROR_CODE, {
        INVALID_REQUEST: 'INVALID_REQUEST',
        TOKEN_ABSENT: 'TOKEN_ABSENT',
        TOKEN_INVALID: 'TOKEN_INVALID',
        TOKEN_READ_FAILED: 'TOKEN_READ_FAILED',
        TOKEN_ENCODING_FAILED: 'TOKEN_ENCODING_FAILED',
        TOKEN_WRITE_FAILED: 'TOKEN_WRITE_FAILED',
        NETWORK_FAILED: 'NETWORK_FAILED',
        HTTP_UNAUTHENTICATED: 'HTTP_UNAUTHENTICATED',
        HTTP_FORBIDDEN: 'HTTP_FORBIDDEN',
        HTTP_NOT_FOUND: 'HTTP_NOT_FOUND',
        HTTP_RATE_LIMITED: 'HTTP_RATE_LIMITED',
        HTTP_SERVER_ERROR: 'HTTP_SERVER_ERROR',
        INVALID_JSON: 'INVALID_JSON',
        INVALID_ENVELOPE: 'INVALID_ENVELOPE'
    });
    assert.ok(Object.isFrozen(STRAVA_CONNECTOR_ERROR_CODE));
    const module = await import('../../js/connectors/strava/strava-api-connector.js');
    assert.deepEqual(
        Object.keys(module).sort(),
        [
            'STRAVA_CONNECTOR_ERROR_CODE',
            'StravaApiConnector',
            'StravaConnectorError'
        ].sort()
    );
});

test('module import has no fetch, token, storage, or DOM side effects', async () => {
    const names = ['fetch', 'localStorage', 'document', 'btoa'];
    const originals = new Map(
        names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
    );
    let accesses = 0;
    try {
        for (const name of names) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    accesses += 1;
                    throw new Error('synthetic side effect');
                }
            });
        }
        const url = new URL(
            '../../js/connectors/strava/strava-api-connector.js',
            import.meta.url
        );
        await import(`${url.href}?side-effect=${Date.now()}`);
        assert.equal(accesses, 0);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
});

test('constructor does not call injected dependencies', () => {
    let calls = 0;
    const dependency = () => {
        calls += 1;
        throw new Error('must stay lazy');
    };
    new StravaApiConnector({
        fetchImpl: dependency,
        tokenReader: dependency,
        tokenWriter: dependency,
        tokenEncoder: dependency,
        now: dependency
    });
    assert.equal(calls, 0);
});

test('constructor rejects unknown options without invoking getters', () => {
    let getterCalls = 0;
    const options = {};
    Object.defineProperty(options, 'fetchImpl', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return () => {};
        }
    });
    assert.throws(
        () => new StravaApiConnector(options),
        error => error.code === STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST
    );
    assert.equal(getterCalls, 0);
    assert.throws(
        () => new StravaApiConnector({ unknown: () => {} }),
        error => error.code === STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST
    );
});

const endpointCases = [
    {
        name: 'activities',
        invoke: connector => connector.fetchActivities(),
        body: { activities: [{ id: 3 }, { id: 1 }] },
        expected: [{ id: 3 }, { id: 1 }],
        url: '/api/strava-activities?page=1&per_page=25'
    },
    {
        name: 'activity',
        invoke: connector => connector.fetchActivity('activity/id ?'),
        body: { activity: { id: 'activity/id ?' } },
        expected: { id: 'activity/id ?' },
        url: '/api/strava-activity?id=activity%2Fid%20%3F'
    },
    {
        name: 'streams',
        invoke: connector => connector.fetchStreams(0, {
            types: ['heartrate', 'time']
        }),
        body: { streams: { heartrate: { data: [120] } } },
        expected: { heartrate: { data: [120] } },
        url: '/api/strava-streams?id=0&type=heartrate%2Ctime'
    },
    {
        name: 'athlete',
        invoke: connector => connector.fetchAthlete(),
        body: { athlete: { id: 1 } },
        expected: { id: 1 },
        url: '/api/strava-athlete'
    },
    {
        name: 'zones',
        invoke: connector => connector.fetchZones(),
        body: { zones: { heart_rate: { zones: [] } } },
        expected: { heart_rate: { zones: [] } },
        url: '/api/strava-zones'
    },
    {
        name: 'gear',
        invoke: connector => connector.fetchGear('gear/id ?'),
        body: { gear: { id: 'gear/id ?' } },
        expected: { id: 'gear/id ?' },
        url: '/api/strava-gear?id=gear%2Fid%20%3F'
    }
];

for (const endpointCase of endpointCases) {
    test(`${endpointCase.name} uses its exact endpoint and returns data only`, async () => {
        const response = syntheticResponse({ body: endpointCase.body });
        const { connector, calls } = createHarness({ response });
        const result = await endpointCase.invoke(connector);
        assert.deepEqual(result, endpointCase.expected);
        assert.equal(calls.fetch.length, 1);
        assert.equal(calls.fetch[0][0], endpointCase.url);
        assert.deepEqual(
            { ...calls.fetch[0][1], signal: undefined },
            {
                method: 'GET',
                headers: { Authorization: `Bearer ${ENCODED_TOKEN}` },
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                signal: undefined
            }
        );
        assert.ok(calls.fetch[0][1].signal instanceof AbortSignal);
        assert.equal(calls.reads, 1);
        assert.deepEqual(calls.encodes, [RAW_TOKEN]);
        assert.deepEqual(calls.writes, []);
        assert.doesNotMatch(JSON.stringify(calls.fetch), /synthetic-access-token/);
    });
}

test('activities stops after a partial bounded page without sorting', async () => {
    const activities = [{ id: 9 }, { id: 2 }, { id: 7 }];
    const { connector, calls } = createHarness({
        response: syntheticResponse({ body: { activities } })
    });
    const result = await connector.fetchActivities();
    assert.deepEqual(result, activities);
    assert.notEqual(result, activities);
    assert.equal(calls.fetch.length, 1);
    assert.equal(calls.fetch[0][0], '/api/strava-activities?page=1&per_page=25');
});

test('activities follows bounded 25-item pages and stops at has_more false', async () => {
    const urls = [];
    const pages = [
        {
            activities: Array.from({ length: 25 }, (_, index) => ({ id: index + 1 })),
            has_more: true,
            tokens: null
        },
        {
            activities: [{ id: 26 }],
            has_more: false,
            tokens: null
        }
    ];
    const { connector } = createHarness({
        fetchImpl: async url => {
            urls.push(url);
            return syntheticResponse({ body: pages.shift() });
        }
    });
    const result = await connector.fetchActivities();
    assert.equal(result.length, 26);
    assert.deepEqual(urls, [
        '/api/strava-activities?page=1&per_page=25',
        '/api/strava-activities?page=2&per_page=25'
    ]);
});

test('activities stops after 10,000 items without issuing page 401', async () => {
    let requests = 0;
    const { connector } = createHarness({
        fetchImpl: async () => {
            requests += 1;
            return syntheticResponse({
                body: {
                    activities: Array.from({ length: 25 }, (_, index) => ({
                        id: (requests - 1) * 25 + index + 1
                    })),
                    has_more: true,
                    tokens: null
                }
            });
        }
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
        { operation: 'listActivities' }
    );
    assert.equal(requests, 400);
});

test('activities aborts the seventeenth 2,000,000-byte page at the 32 MiB sync cap', async () => {
    const envelope = JSON.stringify({
        activities: Array.from({ length: 25 }, (_, index) => ({ id: index + 1 })),
        has_more: true,
        tokens: null
    });
    const bytes = new TextEncoder().encode(`${envelope}${' '.repeat(2_000_000 - envelope.length)}`);
    let requests = 0;
    let cancels = 0;
    const { connector } = createHarness({
        fetchImpl: async () => {
            requests += 1;
            let offset = 0;
            return {
                status: 200,
                headers: {
                    get(name) {
                        return String(name).toLowerCase() === 'content-type'
                            ? 'application/json'
                            : null;
                    }
                },
                body: {
                    getReader() {
                        return {
                            async read() {
                                if (offset >= bytes.byteLength) return { done: true };
                                const value = bytes.subarray(offset);
                                offset = bytes.byteLength;
                                return { done: false, value };
                            },
                            async cancel() {
                                cancels += 1;
                                offset = bytes.byteLength;
                            },
                            releaseLock() {}
                        };
                    }
                }
            };
        }
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_JSON,
        { operation: 'listActivities' }
    );
    assert.equal(requests, 17);
    assert.equal(cancels, 1);
});

const invalidIds = [
    '',
    '   ',
    -1,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    {},
    [],
    true,
    null,
    undefined
];

for (const invalidId of invalidIds) {
    test(`invalid activity ID ${String(invalidId)} fails before token or fetch`, () => {
        const { connector, calls } = createHarness();
        assert.throws(
            () => connector.fetchActivity(invalidId),
            error => (
                error.code === STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST
                && error.operation === 'getActivity'
            )
        );
        assert.equal(calls.reads, 0);
        assert.equal(calls.fetch.length, 0);
    });
}

test('invalid gear ID fails before token or fetch', () => {
    const { connector, calls } = createHarness();
    assert.throws(
        () => connector.fetchGear(false),
        error => (
            error.code === STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST
            && error.operation === 'getGear'
        )
    );
    assert.equal(calls.reads, 0);
    assert.equal(calls.fetch.length, 0);
});

const invalidStreamArguments = [
    undefined,
    {},
    { types: [] },
    { types: [''] },
    { types: ['time', 'time'] },
    { types: ['unknown'] },
    { types: ['time'], extra: true },
    { types: 'time' }
];

for (const options of invalidStreamArguments) {
    test(`invalid stream options ${JSON.stringify(options)} fail before fetch`, () => {
        const { connector, calls } = createHarness();
        assert.throws(
            () => connector.fetchStreams('1', options),
            error => (
                error.code === STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST
                && error.operation === 'getStreams'
            )
        );
        assert.equal(calls.reads, 0);
        assert.equal(calls.fetch.length, 0);
    });
}

test('stream type order and deeply frozen input are preserved', async () => {
    const options = deepFreeze({ types: ['watts', 'time', 'distance'] });
    const { connector, calls } = createHarness({
        response: syntheticResponse({ body: { streams: {} } })
    });
    await connector.fetchStreams('1', options);
    assert.deepEqual(options.types, ['watts', 'time', 'distance']);
    assert.equal(
        calls.fetch[0][0],
        '/api/strava-streams?id=1&type=watts%2Ctime%2Cdistance'
    );
});

test('streams emits one type query with opaque ID encoding and one request', async () => {
    const activityId = '000/activity id?#';
    const types = ['heartrate', 'time', 'distance'];
    const { connector, calls } = createHarness({
        response: syntheticResponse({ body: { streams: {} } })
    });

    await connector.fetchStreams(activityId, { types });

    assert.equal(calls.fetch.length, 1);
    assert.equal(
        calls.fetch[0][0],
        '/api/strava-streams?id=000%2Factivity%20id%3F%23&type=heartrate%2Ctime%2Cdistance'
    );
    const requestUrl = new URL(calls.fetch[0][0], 'https://synthetic.invalid');
    assert.deepEqual(requestUrl.searchParams.getAll('type'), [
        'heartrate,time,distance'
    ]);
    assert.deepEqual(requestUrl.searchParams.getAll('types'), []);
    assert.equal(requestUrl.searchParams.get('id'), activityId);
    assert.deepEqual(types, ['heartrate', 'time', 'distance']);
});

for (const rawToken of [null, '']) {
    test(`absent token ${String(rawToken)} maps to TOKEN_ABSENT`, async () => {
        const { connector, calls } = createHarness({ rawToken });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ABSENT,
            { operation: 'listActivities' }
        );
        assert.equal(calls.fetch.length, 0);
    });
}

test('malformed token JSON maps to TOKEN_INVALID', async () => {
    const { connector, calls } = createHarness({ rawToken: '{invalid' });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
        { operation: 'listActivities' }
    );
    assert.equal(calls.fetch.length, 0);
});

const malformedTokens = [
    null,
    [],
    {},
    { access_token: '', refresh_token: 'r', expires_at: 1 },
    { access_token: 'a', refresh_token: '', expires_at: 1 },
    { access_token: 'a', refresh_token: 'r', expires_at: Infinity },
    { access_token: 'a', refresh_token: 'r', expires_at: '1' },
    {
        access_token: 'a', refresh_token: 'r', expires_at: -1,
        subject_id: '424242', granted_scopes: ['read', 'activity:read_all']
    },
    {
        access_token: 'a', refresh_token: 'r', expires_at: 1.5,
        subject_id: '424242', granted_scopes: ['read', 'activity:read_all']
    }
];

for (const malformedToken of malformedTokens) {
    test(`malformed token shape ${JSON.stringify(malformedToken)} is rejected`, async () => {
        const { connector, calls } = createHarness({
            rawToken: JSON.stringify(malformedToken)
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
            { operation: 'listActivities' }
        );
        assert.equal(calls.fetch.length, 0);
    });
}

test('tokenReader failure maps to TOKEN_READ_FAILED without leaking message', async () => {
    const { connector } = createHarness({
        tokenReader: () => {
            throw new Error('synthetic-reader-secret');
        }
    });
    await assert.rejects(connector.fetchActivities(), error => {
        assert.equal(error.code, STRAVA_CONNECTOR_ERROR_CODE.TOKEN_READ_FAILED);
        assert.doesNotMatch(JSON.stringify(error), /synthetic-reader-secret/);
        return true;
    });
});

test('tokenEncoder throw maps to TOKEN_ENCODING_FAILED', async () => {
    const { connector, calls } = createHarness({
        tokenEncoder: () => {
            throw new Error('synthetic-encoder-secret');
        }
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED,
        { operation: 'listActivities' }
    );
    assert.equal(calls.fetch.length, 0);
});

for (const encodedToken of ['', null, 1]) {
    test(`invalid encoded token ${String(encodedToken)} maps to TOKEN_ENCODING_FAILED`, async () => {
        const { connector, calls } = createHarness({ encodedToken });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED,
            { operation: 'listActivities' }
        );
        assert.equal(calls.fetch.length, 0);
    });
}

for (const [status, code] of [
    [401, STRAVA_CONNECTOR_ERROR_CODE.HTTP_UNAUTHENTICATED],
    [403, STRAVA_CONNECTOR_ERROR_CODE.HTTP_FORBIDDEN]
]) {
    test(`HTTP ${status} maps without reading failure body`, async () => {
        const counters = { headerReads: 0, jsonReads: 0 };
        const { connector } = createHarness({
            response: syntheticResponse({ status, counters })
        });
        await assertConnectorError(connector.fetchActivities(), code, {
            operation: 'listActivities',
            httpStatus: status
        });
        assert.equal(counters.jsonReads, 0);
        assert.equal(counters.headerReads, 0);
    });
}

test('HTTP 404 is NOT_FOUND only for activity and gear operations', async () => {
    for (const [invoke, operation, expected] of [
        [connector => connector.fetchActivity('1'), 'getActivity', 'HTTP_NOT_FOUND'],
        [connector => connector.fetchGear('1'), 'getGear', 'HTTP_NOT_FOUND'],
        [connector => connector.fetchActivities(), 'listActivities', 'HTTP_SERVER_ERROR'],
        [connector => connector.fetchStreams('1', { types: ['time'] }), 'getStreams', 'HTTP_SERVER_ERROR'],
        [connector => connector.fetchAthlete(), 'getAthlete', 'HTTP_SERVER_ERROR'],
        [connector => connector.fetchZones(), 'getZones', 'HTTP_SERVER_ERROR']
    ]) {
        const counters = { headerReads: 0, jsonReads: 0 };
        const { connector } = createHarness({
            response: syntheticResponse({ status: 404, counters })
        });
        await assertConnectorError(invoke(connector), expected, {
            operation,
            httpStatus: 404
        });
        assert.equal(counters.jsonReads, 0);
    }
});

test('HTTP 429 parses integer Retry-After without reading body', async () => {
    const counters = { headerReads: 0, jsonReads: 0 };
    const { connector } = createHarness({
        response: syntheticResponse({
            status: 429,
            retryAfter: '120',
            counters
        })
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        {
            operation: 'listActivities',
            httpStatus: 429,
            retryAfterSeconds: 120
        }
    );
    assert.equal(counters.headerReads, 1);
    assert.equal(counters.jsonReads, 0);
});

test('HTTP 429 accepts zero delta-seconds', async () => {
    const { connector } = createHarness({
        response: syntheticResponse({
            status: 429,
            retryAfter: '0'
        })
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        {
            operation: 'listActivities',
            httpStatus: 429,
            retryAfterSeconds: 0
        }
    );
});

test('HTTP 429 parses future, past, and equal IMF-fixdate Retry-After', async () => {
    const current = Date.UTC(2030, 0, 1, 0, 0, 0);
    for (const [date, expected] of [
        [new Date(current + 90000).toUTCString(), 90],
        [new Date(current - 1000).toUTCString(), 0],
        [new Date(current).toUTCString(), 0]
    ]) {
        const { connector } = createHarness({
            response: syntheticResponse({
                status: 429,
                retryAfter: date
            }),
            now: () => current
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
            {
                operation: 'listActivities',
                httpStatus: 429,
                retryAfterSeconds: expected
            }
        );
    }
});

const invalidRetryAfterValues = [
    '-1',
    '+1',
    '1.5',
    '1e3',
    '01 Jan 2030 00:00:00 GMT',
    '2030-01-01T00:00:00.000Z',
    'Tue, 01 Jan 2030 00:00:00 PST',
    'Sun, 31 Feb 2030 00:00:00 GMT',
    'Mon, 01 Jan 2030 00:00:00 GMT',
    'Tue, 01 Jan 2030 00:00:00 GMT trailing',
    '١٢٠'
];

for (const retryAfter of invalidRetryAfterValues) {
    test(`Retry-After ${JSON.stringify(retryAfter)} is rejected`, async () => {
        const counters = { headerReads: 0, jsonReads: 0 };
        const { connector } = createHarness({
            response: syntheticResponse({
                status: 429,
                retryAfter,
                counters
            })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
            {
                operation: 'listActivities',
                httpStatus: 429,
                retryAfterSeconds: null
            }
        );
        assert.equal(counters.headerReads, 1);
        assert.equal(counters.jsonReads, 0);
    });
}

test('absent or throwing Retry-After fails closed to null', async () => {
    const responses = [
        syntheticResponse({ status: 429 }),
        {
            status: 429,
            headers: {
                get() {
                    throw new Error('synthetic-header-secret');
                }
            },
            async json() {
                throw new Error('body must not be read');
            }
        }
    ];
    for (const response of responses) {
        const { connector } = createHarness({ response });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
            {
                operation: 'listActivities',
                httpStatus: 429,
                retryAfterSeconds: null
            }
        );
    }
});

test('HTTP 500 remains HTTP_SERVER_ERROR and never invents refresh failure', async () => {
    const counters = { headerReads: 0, jsonReads: 0 };
    const { connector } = createHarness({
        response: syntheticResponse({ status: 500, counters })
    });
    await assert.rejects(connector.fetchActivities(), error => {
        assert.equal(error.code, STRAVA_CONNECTOR_ERROR_CODE.HTTP_SERVER_ERROR);
        assert.equal(error.httpStatus, 500);
        assert.equal(error.retryable, true);
        assert.notEqual(error.code, 'TOKEN_REFRESH_FAILED');
        return true;
    });
    assert.equal(counters.jsonReads, 0);
});

test('fetch rejection maps to NETWORK_FAILED without underlying message', async () => {
    const { connector } = createHarness({
        fetchImpl: async () => {
            throw new Error('synthetic-network-secret');
        }
    });
    await assert.rejects(connector.fetchActivities(), error => {
        assert.equal(error.code, STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED);
        assert.equal(error.retryable, true);
        assert.doesNotMatch(JSON.stringify(error), /synthetic-network-secret/);
        return true;
    });
});

test('the 12-second deadline aborts a request waiting for response headers', async () => {
    let timeoutCallback;
    let timeoutDelay;
    const cleared = [];
    const timeoutId = Object.freeze({ id: 'synthetic-header-timeout' });
    let resolveLate;
    const { connector } = createHarness({
        setTimeoutImpl(callback, delay) {
            timeoutCallback = callback;
            timeoutDelay = delay;
            return timeoutId;
        },
        clearTimeoutImpl(id) {
            cleared.push(id);
        },
        fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
            resolveLate = resolve;
            options.signal.addEventListener('abort', () => {
                reject(new Error('synthetic-abort-detail'));
            }, { once: true });
        })
    });

    const pending = connector.fetchActivities();
    assert.equal(timeoutDelay, 12_000);
    timeoutCallback();
    await assertConnectorError(
        pending,
        STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
        { operation: 'listActivities' }
    );
    resolveLate(syntheticResponse({ body: { activities: [{ id: 99 }] } }));
    await Promise.resolve();
    assert.deepEqual(cleared, [timeoutId]);
});

test('the same 12-second deadline aborts a pending streamed response body', async () => {
    let timeoutCallback;
    const cleared = [];
    const timeoutId = Object.freeze({ id: 'synthetic-body-timeout' });
    let resolveLate;
    let capturedSignal;
    const { connector } = createHarness({
        setTimeoutImpl(callback, delay) {
            assert.equal(delay, 12_000);
            timeoutCallback = callback;
            return timeoutId;
        },
        clearTimeoutImpl(id) {
            cleared.push(id);
        },
        fetchImpl: async (_url, options) => {
            capturedSignal = options.signal;
            return {
                status: 200,
                headers: {
                    get(name) {
                        return String(name).toLowerCase() === 'content-type'
                            ? 'application/json'
                            : null;
                    }
                },
                body: {
                    getReader() {
                        return {
                            read() {
                                return new Promise((resolve, reject) => {
                                    resolveLate = resolve;
                                    if (capturedSignal.aborted) {
                                        reject(new Error('synthetic-abort-detail'));
                                        return;
                                    }
                                    capturedSignal.addEventListener('abort', () => {
                                        reject(new Error('synthetic-abort-detail'));
                                    }, { once: true });
                                });
                            },
                            async cancel() {},
                            releaseLock() {}
                        };
                    }
                }
            };
        }
    });

    const pending = connector.fetchActivities();
    await Promise.resolve();
    assert.equal(typeof timeoutCallback, 'function');
    timeoutCallback();
    await assertConnectorError(
        pending,
        STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
        { operation: 'listActivities' }
    );
    resolveLate({ done: false, value: new Uint8Array([123]) });
    await Promise.resolve();
    assert.deepEqual(cleared, [timeoutId]);
});

test('successful bounded body parsing clears the request deadline afterward', async () => {
    const events = [];
    const timeoutId = Object.freeze({ id: 'synthetic-success-timeout' });
    const { connector } = createHarness({
        setTimeoutImpl(_callback, delay) {
            assert.equal(delay, 12_000);
            events.push('timer-set');
            return timeoutId;
        },
        clearTimeoutImpl(id) {
            assert.equal(id, timeoutId);
            events.push('timer-clear');
        },
        fetchImpl: async (_url, options) => {
            assert.ok(options.signal instanceof AbortSignal);
            events.push('fetch');
            const response = syntheticResponse({ body: { activities: [{ id: 1 }] } });
            const originalGetReader = response.body.getReader;
            response.body.getReader = () => {
                const reader = originalGetReader();
                const originalRead = reader.read;
                reader.read = async () => {
                    const result = await originalRead();
                    if (result.done) events.push('body-complete');
                    return result;
                };
                return reader;
            };
            return response;
        }
    });

    assert.deepEqual(await connector.fetchActivities(), [{ id: 1 }]);
    assert.deepEqual(events, ['timer-set', 'fetch', 'body-complete', 'timer-clear']);
});

test('invalid JSON maps to INVALID_JSON without underlying message', async () => {
    const { connector } = createHarness({
        response: syntheticResponse({
            status: 200,
            jsonError: new Error('synthetic-json-secret')
        })
    });
    await assert.rejects(connector.fetchActivities(), error => {
        assert.equal(error.code, STRAVA_CONNECTOR_ERROR_CODE.INVALID_JSON);
        assert.doesNotMatch(JSON.stringify(error), /synthetic-json-secret/);
        return true;
    });
});

for (const body of [
    {},
    { activities: null },
    { activities: {} },
    [],
    null
]) {
    test(`invalid activities envelope ${JSON.stringify(body)} is rejected`, async () => {
        const { connector } = createHarness({
            response: syntheticResponse({ body })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
    });
}

test('refreshed token is validated, reduced, and written exactly once before return', async () => {
    const events = [];
    const refreshed = {
        access_token: 'synthetic-new-access',
        refresh_token: 'synthetic-new-refresh',
        expires_at: 4200000000,
        provider_extra: 'must-not-persist'
    };
    const { connector, calls } = createHarness({
        response: syntheticResponse({
            body: {
                activities: [{ id: 1 }],
                tokens: refreshed
            }
        }),
        tokenWriter: serialized => {
            events.push('write');
            calls.writes.push(serialized);
        }
    });
    const promise = connector.fetchActivities().then(data => {
        events.push('return');
        return data;
    });
    const result = await promise;
    assert.deepEqual(events, ['write', 'return']);
    assert.equal(calls.writes.length, 1);
    assert.deepEqual(JSON.parse(calls.writes[0]), {
        access_token: 'synthetic-new-access',
        refresh_token: 'synthetic-new-refresh',
        expires_at: 4200000000
    });
    assert.deepEqual(result, [{ id: 1 }]);
});

test('refresh preserves exact subject and ordered scopes for five-field authority', async () => {
    const { connector, calls } = createHarness({
        rawToken: AUTHORITY_TOKEN,
        response: syntheticResponse({
            body: {
                activities: [],
                tokens: {
                    access_token: 'synthetic-new-access',
                    refresh_token: 'synthetic-new-refresh',
                    expires_at: 4200000000
                }
            }
        })
    });
    await connector.fetchActivities();
    assert.deepEqual(JSON.parse(calls.writes[0]), {
        access_token: 'synthetic-new-access',
        refresh_token: 'synthetic-new-refresh',
        expires_at: 4200000000,
        subject_id: '424242',
        granted_scopes: ['read', 'activity:read_all']
    });
});

test('authority refresh rejects non-positive, fractional, and unsafe expiry before writing', async () => {
    for (const expiresAt of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const { connector, calls } = createHarness({
            rawToken: AUTHORITY_TOKEN,
            response: syntheticResponse({
                body: {
                    activities: [],
                    tokens: {
                        access_token: 'synthetic-new-access',
                        refresh_token: 'synthetic-new-refresh',
                        expires_at: expiresAt
                    }
                }
            })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
        assert.deepEqual(calls.writes, []);
    }
});

test('refresh cannot change or downgrade five-field authority evidence', async () => {
    for (const authorityFields of [
        { subject_id: '525252', granted_scopes: ['read', 'activity:read_all'] },
        { subject_id: '424242', granted_scopes: ['activity:read_all', 'read'] },
        { subject_id: '424242' },
        { granted_scopes: ['read', 'activity:read_all'] }
    ]) {
        const { connector, calls } = createHarness({
            rawToken: AUTHORITY_TOKEN,
            response: syntheticResponse({
                body: {
                    activities: [],
                    tokens: {
                        access_token: 'synthetic-new-access',
                        refresh_token: 'synthetic-new-refresh',
                        expires_at: 4200000000,
                        ...authorityFields
                    }
                }
            })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
        assert.deepEqual(calls.writes, []);
    }
});

test('null or absent refreshed tokens do not write', async () => {
    for (const body of [
        { activities: [] },
        { activities: [], tokens: null }
    ]) {
        const { connector, calls } = createHarness({
            response: syntheticResponse({ body })
        });
        await connector.fetchActivities();
        assert.deepEqual(calls.writes, []);
    }
});

test('present undefined refreshed tokens are an invalid envelope', async () => {
    const { connector, calls } = createHarness({
        response: syntheticResponse({
            body: { activities: [], tokens: undefined }
        })
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
        { operation: 'listActivities' }
    );
    assert.deepEqual(calls.writes, []);
});

test('invalid refreshed token maps to INVALID_ENVELOPE without writing', async () => {
    const { connector, calls } = createHarness({
        response: syntheticResponse({
            body: {
                activities: [],
                tokens: {
                    access_token: 'synthetic-new-access',
                    refresh_token: '',
                    expires_at: 1
                }
            }
        })
    });
    await assertConnectorError(
        connector.fetchActivities(),
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
        { operation: 'listActivities' }
    );
    assert.deepEqual(calls.writes, []);
});

test('tokenWriter failure maps to TOKEN_WRITE_FAILED and withholds data', async () => {
    let returned = false;
    const { connector } = createHarness({
        response: syntheticResponse({
            body: {
                activities: [{ id: 1 }],
                tokens: {
                    access_token: 'synthetic-new-access',
                    refresh_token: 'synthetic-new-refresh',
                    expires_at: 4200000000
                }
            }
        }),
        tokenWriter: () => {
            throw new Error('synthetic-writer-secret');
        }
    });
    await connector.fetchActivities()
        .then(() => {
            returned = true;
        })
        .catch(error => {
            assert.equal(error.code, STRAVA_CONNECTOR_ERROR_CODE.TOKEN_WRITE_FAILED);
            assert.doesNotMatch(JSON.stringify(error), /synthetic-writer-secret/);
        });
    assert.equal(returned, false);
});

test('returned data is detached and input is not mutated', async () => {
    const providerData = deepFreeze([
        {
            id: 1,
            nested: {
                values: [3, 2, 1]
            }
        }
    ]);
    const providerEnvelope = deepFreeze({
        activities: providerData
    });
    const { connector } = createHarness({
        response: syntheticResponse({ body: providerEnvelope })
    });
    const result = await connector.fetchActivities();
    assert.deepEqual(result, providerData);
    assert.notEqual(result, providerData);
    assert.notEqual(result[0], providerData[0]);
    assert.notEqual(result[0].nested, providerData[0].nested);
    result[0].nested.values.push(4);
    assert.deepEqual(providerData[0].nested.values, [3, 2, 1]);
});

test('detached cloning preserves __proto__ as data without prototype mutation', async () => {
    const providerData = JSON.parse(
        '[{"__proto__":{"synthetic":"value"},"id":1}]'
    );
    const { connector } = createHarness({
        response: syntheticResponse({
            body: { activities: providerData }
        })
    });
    const result = await connector.fetchActivities();
    assert.equal(Object.getPrototypeOf(result[0]), Object.prototype);
    assert.equal(Object.hasOwn(result[0], '__proto__'), true);
    assert.deepEqual(result[0].__proto__, { synthetic: 'value' });
});

test('connector consumes streamed JSON bytes and never invokes response.json', async () => {
    let jsonCalls = 0;
    const response = syntheticResponse({ body: { activities: [{ id: 1 }] } });
    response.json = async () => {
        jsonCalls += 1;
        throw new Error('synthetic-json-method-secret');
    };
    const { connector } = createHarness({ response });
    assert.deepEqual(await connector.fetchActivities(), [{ id: 1 }]);
    assert.equal(jsonCalls, 0);
});

test('StravaConnectorError is deterministic, redacted, and fails closed', () => {
    const first = new StravaConnectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        {
            operation: 'listActivities',
            retryable: true,
            httpStatus: 429,
            retryAfterSeconds: 30
        }
    );
    const second = new StravaConnectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        {
            operation: 'listActivities',
            retryable: true,
            httpStatus: 429,
            retryAfterSeconds: 30
        }
    );
    assert.deepEqual(first.toJSON(), second.toJSON());
    assert.doesNotMatch(JSON.stringify(first), /stack|Authorization|synthetic-access-token/);

    const invalid = new StravaConnectorError('synthetic-provider-secret', {
        operation: 'unknown',
        raw: RAW_TOKEN
    });
    assert.equal(invalid.code, STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST);
    assert.equal(invalid.operation, null);
    assert.doesNotMatch(
        JSON.stringify(invalid),
        /synthetic-provider-secret|synthetic-access-token|unknown/
    );
});

test('StravaConnectorError is immutable and remains redacted after mutation attempts', () => {
    const error = new StravaConnectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        {
            operation: 'listActivities',
            retryable: true,
            httpStatus: 429,
            retryAfterSeconds: 30
        }
    );
    assertErrorIsImmutable(error);
});

test('StravaConnectorError drops secret constructor input deterministically', () => {
    const details = {
        operation: 'listActivities',
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 30
    };
    const first = new StravaConnectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        details
    );
    const second = new StravaConnectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
        details
    );
    assert.deepEqual(first.toJSON(), second.toJSON());

    const invalid = new StravaConnectorError('synthetic-constructor-secret', {
        ...details,
        raw: 'synthetic-constructor-secret'
    });
    assertErrorIsImmutable(invalid);
    assert.doesNotMatch(
        JSON.stringify(invalid),
        /synthetic-constructor-secret/
    );
});

test('connector source keeps bounded pagination isolated from UI, logging, and implementation imports', async () => {
    const source = await readFile(
        new URL(
            '../../js/connectors/strava/strava-api-connector.js',
            import.meta.url
        ),
        'utf8'
    );
    assert.doesNotMatch(source, /\bconsole\.(?:log|warn|error)\b/);
    assert.doesNotMatch(source, /\bdocument\b|\bwindow\b/);
    assert.doesNotMatch(source, /\bdemo\b/i);
    assert.doesNotMatch(source, /activity-cache|LegacyRepository|DemoRepository/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*\/api\//);
    assert.match(source, /MAX_ACTIVITY_PAGES\s*=\s*400/);
    assert.match(source, /MAX_ACTIVITIES\s*=\s*10_000/);
    assert.match(source, /MAX_ACTIVITY_SYNC_BYTES\s*=\s*32\s*\*\s*1024\s*\*\s*1024/);
});
