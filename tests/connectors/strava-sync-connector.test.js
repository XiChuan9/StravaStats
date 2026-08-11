import assert from 'node:assert/strict';
import test from 'node:test';

import syncHandler from '../../api/strava-sync.js';
import {
    STRAVA_SYNC_ERROR_CODE,
    StravaSyncError,
    createStravaSyncConnector,
    readStravaSyncAuthority
} from '../../js/connectors/strava/strava-sync-connector.js';

const SUBJECT = '900000000000000001';
const TOKEN = Object.freeze({
    access_token: 'synthetic-access-value',
    refresh_token: 'synthetic-refresh-value',
    expires_at: 2_100_000_000,
    subject_id: SUBJECT,
    granted_scopes: Object.freeze(['read', 'activity:read_all'])
});
const STREAM_KEYS = Object.freeze([
    'time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate',
    'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
]);

function storageFor(token = TOKEN) {
    return { getItem: key => key === 'strava_tokens' ? JSON.stringify(token) : null };
}

function jsonResponse(value, status = 200, includeLength = true) {
    const body = JSON.stringify(value);
    const headers = { 'Content-Type': 'application/json' };
    if (includeLength) headers['Content-Length'] = String(Buffer.byteLength(body));
    return new Response(body, { status, headers });
}

function connector(fetchImpl, authority = readStravaSyncAuthority(storageFor()), timers = {}) {
    return createStravaSyncConnector({
        authority,
        fetchImpl,
        setTimeoutImpl: timers.setTimeoutImpl ?? setTimeout,
        clearTimeoutImpl: timers.clearTimeoutImpl ?? clearTimeout,
        AbortControllerImpl: AbortController
    });
}

function expectCode(error, code) {
    assert.equal(error instanceof StravaSyncError, true);
    assert.equal(error.code, code);
    assert.equal(error.retryable, false);
    assert.equal(Object.isFrozen(error), true);
    return true;
}

function createApiResponse() {
    return {
        statusCode: 200,
        body: undefined,
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
            return this;
        },
        end(value = '') {
            this.body = value;
            return this;
        }
    };
}

function apiRequest(body, overrides = {}) {
    return {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        ...overrides
    };
}

function operationBody(operation, activityId = null) {
    const value = { operation };
    if (activityId !== null) value.activity_id = activityId;
    if (operation === 'streams') value.keys = [...STREAM_KEYS];
    value.token = structuredClone(TOKEN);
    return value;
}

async function withFetch(fetchImpl, callback) {
    const original = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
        return await callback();
    } finally {
        globalThis.fetch = original;
    }
}

test('authority is an exact opaque five-field snapshot and invalid storage fails closed', () => {
    const authority = readStravaSyncAuthority(storageFor());
    assert.deepEqual(authority, {
        subjectId: SUBJECT,
        grantedScopes: ['read', 'activity:read_all']
    });
    assert.equal(Object.isFrozen(authority), true);
    assert.equal(Object.isFrozen(authority.grantedScopes), true);
    assert.equal(JSON.stringify(authority).includes('synthetic-access'), false);
    assert.equal(Object.hasOwn(authority, 'access_token'), false);

    for (const invalid of [
        null,
        {},
        { access_token: 'a', refresh_token: 'r', expires_at: 1 },
        { ...TOKEN, expires_at: 0 },
        { ...TOKEN, subject_id: '01' },
        { ...TOKEN, granted_scopes: ['activity:read_all', 'read'] },
        { ...TOKEN, granted_scopes: ['read', 'activity:read_all', 'extra'] },
        { ...TOKEN, extra: true }
    ]) {
        assert.equal(readStravaSyncAuthority(storageFor(invalid)), null);
    }
    assert.equal(readStravaSyncAuthority({ getItem() { throw new Error('synthetic'); } }), null);
    assert.throws(
        () => connector(async () => assert.fail('provider I/O'), Object.freeze({
            subjectId: SUBJECT,
            grantedScopes: Object.freeze(['read', 'activity:read_all'])
        })),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.AUTHORITY_INVALID)
    );
});

test('browser reader uses only exact same-origin POST bodies and preserves opaque ID order', async () => {
    const calls = [];
    const responses = [
        jsonResponse({
            operation: 'list',
            activities: [
                { id: '910000000000000002', sport_type: 'Run' },
                { id: '910000000000000001', sport_type: 'Ride' }
            ]
        }),
        jsonResponse({ operation: 'detail', activity: { id: '910000000000000002', laps: [] } }),
        jsonResponse({ operation: 'streams', streams: { time: { data: [0] } } })
    ];
    const reader = connector(async (...args) => {
        calls.push(args);
        return responses.shift();
    });
    const signal = new AbortController().signal;
    const listed = await reader.list({ signal });
    const detail = await reader.detail('910000000000000002', { signal });
    const streams = await reader.streams('910000000000000002', { signal });

    assert.deepEqual(listed.map(item => item.id), ['910000000000000002', '910000000000000001']);
    assert.deepEqual(detail, { id: '910000000000000002', laps: [] });
    assert.deepEqual(streams, { time: { data: [0] } });
    assert.equal(Object.isFrozen(listed), true);
    assert.equal(Object.isFrozen(detail), true);
    assert.equal(Object.isFrozen(streams.time.data), true);
    assert.equal(calls.length, 3);
    for (const [url, init] of calls) {
        assert.equal(url, '/api/strava-sync');
        assert.deepEqual({
            method: init.method,
            headers: init.headers,
            credentials: init.credentials,
            cache: init.cache,
            redirect: init.redirect,
            referrerPolicy: init.referrerPolicy
        }, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer'
        });
        assert.equal(init.signal instanceof AbortSignal, true);
        assert.equal(url.includes('910000000000000002'), false);
    }
    assert.deepEqual(JSON.parse(calls[0][1].body), operationBody('list'));
    assert.deepEqual(JSON.parse(calls[1][1].body), operationBody('detail', '910000000000000002'));
    assert.deepEqual(JSON.parse(calls[2][1].body), operationBody('streams', '910000000000000002'));
});

test('reader rejects duplicates and request-ceiling violations before later provider I/O', async () => {
    let calls = 0;
    const duplicateReader = connector(async () => {
        calls += 1;
        return jsonResponse({
            operation: 'list',
            activities: [{ id: '9101' }, { id: '9101' }]
        });
    });
    await assert.rejects(
        duplicateReader.list({ signal: new AbortController().signal }),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.LIST_FAILED)
    );
    assert.equal(calls, 1);

    const responses = [
        jsonResponse({ operation: 'list', activities: [{ id: '9102' }] }),
        jsonResponse({ operation: 'detail', activity: null }),
        jsonResponse({ operation: 'streams', streams: null })
    ];
    const bounded = connector(async () => {
        calls += 1;
        return responses.shift();
    });
    const control = { signal: new AbortController().signal };
    await bounded.list(control);
    await assert.rejects(
        bounded.streams('9102', control),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST)
    );
    assert.equal(await bounded.detail('9102', control), null);
    assert.equal(await bounded.streams('9102', control), null);
    await assert.rejects(
        bounded.detail('9102', control),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST)
    );
    assert.equal(calls, 4);
});

test('auth and quota are fatal while optional non-auth failures degrade to literal null', async () => {
    const control = { signal: new AbortController().signal };
    await assert.rejects(
        connector(async () => jsonResponse({ error: 'RECONNECT_REQUIRED' }, 401)).list(control),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.RECONNECT_REQUIRED)
    );
    await assert.rejects(
        connector(async () => jsonResponse({ error: 'TRY_LATER' }, 429)).list(control),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.TRY_LATER)
    );

    for (const optionalResponse of [
        () => jsonResponse({ error: 'OPTIONAL_UNAVAILABLE' }, 404),
        () => jsonResponse({ operation: 'detail', activity: {} }, 503),
        () => jsonResponse({ operation: 'detail', unexpected: true }),
        () => Promise.reject(new Error('synthetic network failure'))
    ]) {
        const responses = [
            jsonResponse({ operation: 'list', activities: [{ id: '9201' }] }),
            optionalResponse()
        ];
        const reader = connector(async () => await responses.shift());
        await reader.list(control);
        assert.equal(await reader.detail('9201', control), null);
    }
});

test('external cancellation and close abort without retry', async () => {
    let calls = 0;
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await assert.rejects(
        connector(async () => { calls += 1; }).list({ signal: alreadyAborted.signal }),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.CANCELLED)
    );
    assert.equal(calls, 0);

    let requestSignal;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const reader = connector(async (_url, init) => {
        calls += 1;
        requestSignal = init.signal;
        await pending;
        throw new Error('synthetic closed request');
    });
    const operation = reader.list({ signal: new AbortController().signal });
    await new Promise(resolve => setImmediate(resolve));
    await reader.close();
    assert.equal(requestSignal.aborted, true);
    release();
    await assert.rejects(operation, error => expectCode(error, STRAVA_SYNC_ERROR_CODE.CLOSED));
    assert.equal(calls, 1);
});

test('browser bounded stream cancels at max plus one with no Content-Length', async () => {
    let cancelled = false;
    let readCount = 0;
    const body = {
        getReader() {
            return {
                async read() {
                    readCount += 1;
                    if (readCount === 1) return { done: false, value: new Uint8Array(2 * 1024 * 1024) };
                    if (readCount === 2) return { done: false, value: new Uint8Array([1]) };
                    return { done: true, value: undefined };
                },
                async cancel() { cancelled = true; },
                releaseLock() {}
            };
        }
    };
    const response = {
        status: 200,
        headers: { get: name => String(name).toLowerCase() === 'content-type'
            ? 'application/json'
            : null },
        body
    };
    await assert.rejects(
        connector(async () => response).list({ signal: new AbortController().signal }),
        error => expectCode(error, STRAVA_SYNC_ERROR_CODE.RESPONSE_LIMIT_EXCEEDED)
    );
    assert.equal(cancelled, true);
    assert.equal(readCount, 2);
});

test('concurrent optional bodies atomically share the 32 MiB acquisition budget', async () => {
    const streamEnvelope = { operation: 'streams', streams: { padding: '' } };
    const envelopeBytes = Buffer.byteLength(JSON.stringify(streamEnvelope));
    streamEnvelope.streams.padding = 'x'.repeat((16 * 1024 * 1024) - envelopeBytes);
    assert.equal(Buffer.byteLength(JSON.stringify(streamEnvelope)), 16 * 1024 * 1024);

    let calls = 0;
    const reader = connector(async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init.body);
        if (body.operation === 'list') {
            return jsonResponse({
                operation: 'list',
                activities: [{ id: '9501' }, { id: '9502' }]
            });
        }
        if (body.operation === 'detail') {
            return jsonResponse({ operation: 'detail', activity: { id: body.activity_id } });
        }
        return jsonResponse(streamEnvelope);
    });
    const control = { signal: new AbortController().signal };
    await reader.list(control);
    await Promise.all([
        reader.detail('9501', control),
        reader.detail('9502', control)
    ]);
    const results = await Promise.all([
        reader.streams('9501', control),
        reader.streams('9502', control)
    ]);
    assert.equal(results.filter(value => value === null).length, 1);
    assert.equal(
        results.filter(value => value?.padding?.length === streamEnvelope.streams.padding.length).length,
        1
    );
    assert.equal(calls, 5, 'one list, two detail, and two stream requests without retry');
});

test('browser 15-second timer remains armed through bounded body consumption', async () => {
    let timeoutDelay;
    let cleared = false;
    let bodyObservedBeforeClear = false;
    const reader = connector(
        async () => {
            const response = jsonResponse({ operation: 'list', activities: [] });
            const originalGetReader = response.body.getReader.bind(response.body);
            response.body.getReader = () => {
                const streamReader = originalGetReader();
                const originalRead = streamReader.read.bind(streamReader);
                streamReader.read = async () => {
                    bodyObservedBeforeClear = !cleared;
                    return await originalRead();
                };
                return streamReader;
            };
            return response;
        },
        readStravaSyncAuthority(storageFor()),
        {
            setTimeoutImpl(_callback, delay) {
                timeoutDelay = delay;
                return 7;
            },
            clearTimeoutImpl(id) {
                assert.equal(id, 7);
                cleared = true;
            }
        }
    );
    assert.deepEqual(await reader.list({ signal: new AbortController().signal }), []);
    assert.equal(timeoutDelay, 15_000);
    assert.equal(bodyObservedBeforeClear, true);
    assert.equal(cleared, true);
});

test('server rejects invalid requests before provider I/O and emits fixed no-store responses', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; }, async () => {
        for (const request of [
            apiRequest(operationBody('list'), { method: 'GET' }),
            apiRequest(operationBody('list'), { headers: { 'content-type': 'application/json; charset=utf-8' } }),
            apiRequest({ ...operationBody('list'), extra: true }),
            apiRequest({ ...operationBody('detail', '01') }),
            apiRequest({ ...operationBody('streams', '9101'), keys: [...STREAM_KEYS].reverse() }),
            apiRequest({ operation: 'list', token: { ...TOKEN, expires_at: 0 } })
        ]) {
            const response = createApiResponse();
            await syncHandler(request, response);
            assert.equal([400, 405].includes(response.statusCode), true);
            assert.equal(response.headers['Cache-Control'], 'no-store');
            assert.equal(response.headers.Pragma, 'no-cache');
            assert.equal(response.headers['Referrer-Policy'], 'no-referrer');
        }
    });
    assert.equal(calls, 0);
});

test('server uses exact provider URLs, reduces fields, and normalizes only safe upstream numeric IDs', async () => {
    const calls = [];
    const providerResponses = [
        jsonResponse([{
            id: 9100001,
            sport_type: 'Run',
            start_date: '2026-08-10T10:00:00Z',
            distance: 0,
            name: 'synthetic-private-name',
            athlete: { id: 44 },
            map: { polyline: 'synthetic-private-route' },
            unknown: 'synthetic-private-unknown'
        }]),
        jsonResponse({
            id: '9100001',
            elapsed_time: 60,
            segment_efforts: [{ id: 1 }],
            laps: [{ lap_index: 0, elapsed_time: 60, name: 'synthetic lap' }]
        }),
        jsonResponse({
            time: { data: [0, 60], series_type: 'time' },
            latlng: { data: [[0, 0], null] },
            future_stream: { data: ['synthetic-private-unknown'] }
        })
    ];
    await withFetch(async (...args) => {
        calls.push(args);
        return providerResponses.shift();
    }, async () => {
        const listResponse = createApiResponse();
        await syncHandler(apiRequest(operationBody('list')), listResponse);
        assert.equal(listResponse.statusCode, 200);
        assert.deepEqual(listResponse.body, {
            operation: 'list',
            activities: [{
                id: '9100001',
                sport_type: 'Run',
                start_date: '2026-08-10T10:00:00Z',
                distance: 0
            }]
        });

        const detailResponse = createApiResponse();
        await syncHandler(apiRequest(operationBody('detail', '9100001')), detailResponse);
        assert.equal(detailResponse.statusCode, 200);
        assert.deepEqual(detailResponse.body, {
            operation: 'detail',
            activity: {
                id: '9100001',
                elapsed_time: 60,
                laps: [{ lap_index: 0, elapsed_time: 60 }]
            }
        });

        const streamsResponse = createApiResponse();
        await syncHandler(apiRequest(operationBody('streams', '9100001')), streamsResponse);
        assert.equal(streamsResponse.statusCode, 200);
        assert.deepEqual(streamsResponse.body, {
            operation: 'streams',
            streams: {
                time: { data: [0, 60] },
                latlng: { data: [[0, 0], null] }
            }
        });
    });

    assert.deepEqual(calls.map(call => call[0]), [
        'https://www.strava.com/api/v3/athlete/activities?page=1&per_page=25',
        'https://www.strava.com/api/v3/activities/9100001?include_all_efforts=false',
        `https://www.strava.com/api/v3/activities/9100001/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`
    ]);
    for (const [, init] of calls) {
        assert.equal(init.method, 'GET');
        assert.equal(init.headers.Accept, 'application/json');
        assert.equal(init.headers.Authorization, 'Bearer synthetic-access-value');
        assert.equal(init.redirect, 'error');
        assert.equal(init.signal instanceof AbortSignal, true);
    }

    const unsafeResponse = createApiResponse();
    await withFetch(
        async () => jsonResponse([{ id: Number.MAX_SAFE_INTEGER + 1 }]),
        async () => syncHandler(apiRequest(operationBody('list')), unsafeResponse)
    );
    assert.equal(unsafeResponse.statusCode, 502);
    assert.deepEqual(unsafeResponse.body, { error: 'SYNC_LIST_FAILED' });
});

test('server rejects list duplicates before browser scheduling and maps fixed fatal statuses', async () => {
    const duplicate = createApiResponse();
    await withFetch(
        async () => jsonResponse([{ id: '9301' }, { id: 9301 }]),
        async () => syncHandler(apiRequest(operationBody('list')), duplicate)
    );
    assert.equal(duplicate.statusCode, 502);
    assert.deepEqual(duplicate.body, { error: 'SYNC_LIST_FAILED' });

    for (const [providerStatus, expectedStatus, body] of [
        [401, 401, { error: 'RECONNECT_REQUIRED' }],
        [403, 401, { error: 'RECONNECT_REQUIRED' }],
        [429, 429, { error: 'TRY_LATER' }]
    ]) {
        const response = createApiResponse();
        await withFetch(
            async () => jsonResponse({ synthetic: true }, providerStatus),
            async () => syncHandler(apiRequest(operationBody('detail', '9301')), response)
        );
        assert.equal(response.statusCode, expectedStatus);
        assert.deepEqual(response.body, body);
    }
});

test('server optional failures reduce to null and list failures import nothing', async () => {
    for (const operation of ['detail', 'streams']) {
        for (const provider of [
            () => Promise.reject(new Error('synthetic network failure')),
            () => jsonResponse(operation === 'detail' ? { invalid: true } : { time: true }),
            () => jsonResponse({ synthetic: true }, 404),
            () => jsonResponse({ synthetic: true }, 503)
        ]) {
            const response = createApiResponse();
            await withFetch(provider, async () => {
                await syncHandler(apiRequest(operationBody(operation, '9401')), response);
            });
            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.body, operation === 'detail'
                ? { operation: 'detail', activity: null }
                : { operation: 'streams', streams: null });
        }
    }
    const listResponse = createApiResponse();
    await withFetch(
        async () => Promise.reject(new Error('synthetic network failure')),
        async () => syncHandler(apiRequest(operationBody('list')), listResponse)
    );
    assert.equal(listResponse.statusCode, 502);
    assert.deepEqual(listResponse.body, { error: 'SYNC_LIST_FAILED' });
});

test('server bounded stream cancels at max plus one without trusting Content-Length', async () => {
    let cancelled = false;
    let reads = 0;
    const provider = {
        ok: true,
        status: 200,
        headers: { get: name => String(name).toLowerCase() === 'content-type'
            ? 'application/json'
            : null },
        body: {
            getReader() {
                return {
                    async read() {
                        reads += 1;
                        if (reads === 1) {
                            return { done: false, value: new Uint8Array(2 * 1024 * 1024) };
                        }
                        return { done: false, value: new Uint8Array([1]) };
                    },
                    async cancel() { cancelled = true; },
                    releaseLock() {}
                };
            }
        }
    };
    const response = createApiResponse();
    await withFetch(
        async () => provider,
        async () => syncHandler(apiRequest(operationBody('list')), response)
    );
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.body, { error: 'SYNC_LIST_FAILED' });
    assert.equal(cancelled, true);
    assert.equal(reads, 2);
});

test('server 12-second timeout remains armed through bounded body consumption', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let delay;
    let cleared = false;
    let consumedBeforeClear = false;
    globalThis.setTimeout = (_callback, value) => {
        delay = value;
        return 11;
    };
    globalThis.clearTimeout = id => {
        assert.equal(id, 11);
        cleared = true;
    };
    try {
        const provider = jsonResponse([]);
        const originalGetReader = provider.body.getReader.bind(provider.body);
        provider.body.getReader = () => {
            const reader = originalGetReader();
            const originalRead = reader.read.bind(reader);
            reader.read = async () => {
                consumedBeforeClear = !cleared;
                return await originalRead();
            };
            return reader;
        };
        const response = createApiResponse();
        await withFetch(
            async () => provider,
            async () => syncHandler(apiRequest(operationBody('list')), response)
        );
        assert.equal(response.statusCode, 200);
        assert.equal(delay, 12_000);
        assert.equal(consumedBeforeClear, true);
        assert.equal(cleared, true);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});
