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
const ENCODED_TOKEN = 'synthetic-encoded-token';

function syntheticResponse({
    status = 200,
    body = {},
    retryAfter = null,
    jsonError = null,
    counters = null
} = {}) {
    return {
        status,
        headers: {
            get(name) {
                counters && (counters.headerReads += 1);
                return name === 'Retry-After' ? retryAfter : null;
            }
        },
        async json() {
            counters && (counters.jsonReads += 1);
            if (jsonError) throw jsonError;
            return body;
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
    fetchImpl
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
        now
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
        MIXED: 'mixed'
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
        url: '/api/strava-activities'
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
        assert.deepEqual(calls.fetch[0], [
            endpointCase.url,
            {
                method: 'GET',
                headers: { Authorization: `Bearer ${ENCODED_TOKEN}` }
            }
        ]);
        assert.equal(calls.reads, 1);
        assert.deepEqual(calls.encodes, [RAW_TOKEN]);
        assert.deepEqual(calls.writes, []);
        assert.doesNotMatch(JSON.stringify(calls.fetch), /synthetic-access-token/);
    });
}

test('activities makes exactly one browser request without pagination or sorting', async () => {
    const activities = [{ id: 9 }, { id: 2 }, { id: 7 }];
    const { connector, calls } = createHarness({
        response: syntheticResponse({ body: { activities } })
    });
    const result = await connector.fetchActivities();
    assert.deepEqual(result, activities);
    assert.notEqual(result, activities);
    assert.equal(calls.fetch.length, 1);
    assert.doesNotMatch(calls.fetch[0][0], /page|per_page/);
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
    { access_token: 'a', refresh_token: 'r', expires_at: '1' }
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
                tokens: refreshed,
                transport_extra: 'must-not-return'
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
    assert.equal(Object.hasOwn(result, 'transport_extra'), false);
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
        activities: providerData,
        transport_extra: { ignored: true }
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

test('top-level and nested accessors are rejected without execution', async () => {
    let getterCalls = 0;
    const topLevel = {};
    Object.defineProperty(topLevel, 'activities', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return [];
        }
    });
    const nested = {};
    Object.defineProperty(nested, 'private', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'synthetic-private-value';
        }
    });

    for (const body of [topLevel, { activities: [nested] }]) {
        const { connector } = createHarness({
            response: syntheticResponse({ body })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
    }
    assert.equal(getterCalls, 0);
});

test('revoked and throwing proxies fail closed', async () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const throwingProxy = new Proxy({}, {
        getPrototypeOf() {
            throw new Error('synthetic-proxy-secret');
        }
    });
    for (const body of [
        { activities: [proxy] },
        { activities: [throwingProxy] }
    ]) {
        const { connector } = createHarness({
            response: syntheticResponse({ body })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
    }
});

const cyclic = {};
cyclic.self = cyclic;
class SyntheticClass {}
const invalidNestedValues = [
    undefined,
    Number.POSITIVE_INFINITY,
    1n,
    () => {},
    Symbol('synthetic'),
    new Date(0),
    new Map(),
    new Set(),
    new SyntheticClass(),
    cyclic
];

for (const invalidValue of invalidNestedValues) {
    test(`nested ${Object.prototype.toString.call(invalidValue)} is not JSON-safe`, async () => {
        const { connector } = createHarness({
            response: syntheticResponse({
                body: { activities: [{ value: invalidValue }] }
            })
        });
        await assertConnectorError(
            connector.fetchActivities(),
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            { operation: 'listActivities' }
        );
    });
}

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

test('connector source has no pagination loop, logging, DOM, Demo, cache, or implementation import', async () => {
    const source = await readFile(
        new URL(
            '../../js/connectors/strava/strava-api-connector.js',
            import.meta.url
        ),
        'utf8'
    );
    assert.doesNotMatch(source, /\bpage\b|\bper_page\b/);
    assert.doesNotMatch(source, /\bconsole\.(?:log|warn|error)\b/);
    assert.doesNotMatch(source, /\bdocument\b|\bwindow\b/);
    assert.doesNotMatch(source, /\bdemo\b/i);
    assert.doesNotMatch(source, /activity-cache|LegacyRepository|DemoRepository/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*\/api\//);
    assert.doesNotMatch(source, /\bwhile\s*\(|\bfor\s+await\b/);
});
