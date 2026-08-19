import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ProviderBoundaryError,
    readProviderJson,
    requestProviderJson
} from '../../api/_provider-boundary.js';
import activitiesHandler from '../../api/strava-activities.js';
import streamsHandler from '../../api/strava-streams.js';
import { readBoundedResponseJson } from '../../js/shared/bounded-response.js';

function streamedResponse(serialized, {
    status = 200,
    declaredLength = null,
    redirected = false,
    contentType = 'application/json',
    chunkSize = 7
} = {}) {
    const bytes = new TextEncoder().encode(serialized);
    const counters = { reads: 0, cancels: 0 };
    let offset = 0;
    return {
        response: {
            ok: status >= 200 && status < 300,
            status,
            redirected,
            headers: {
                get(name) {
                    const normalized = String(name).toLowerCase();
                    if (normalized === 'content-type') return contentType;
                    if (normalized === 'content-length') return declaredLength;
                    return null;
                }
            },
            body: {
                getReader() {
                    return {
                        async read() {
                            counters.reads += 1;
                            if (offset >= bytes.byteLength) return { done: true };
                            const value = bytes.subarray(
                                offset,
                                Math.min(bytes.byteLength, offset + chunkSize)
                            );
                            offset += value.byteLength;
                            return { done: false, value };
                        },
                        async cancel() {
                            counters.cancels += 1;
                            offset = bytes.byteLength;
                        },
                        releaseLock() {}
                    };
                }
            }
        },
        counters
    };
}

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        headers: Object.create(null),
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        end(value) { this.body = value; return this; }
    };
}

function authenticatedRequest(query) {
    const token = Buffer.from(JSON.stringify({
        access_token: 'synthetic-access',
        refresh_token: 'synthetic-refresh',
        expires_at: 4_102_444_800
    })).toString('base64');
    return {
        method: 'GET',
        query,
        headers: { authorization: `Bearer ${token}` }
    };
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

test('provider JSON is limited by streamed bytes with absent or forged Content-Length', async () => {
    for (const declaredLength of [null, '2']) {
        const { response, counters } = streamedResponse(
            JSON.stringify({ value: 'x'.repeat(128) }),
            { declaredLength, chunkSize: 11 }
        );
        await assert.rejects(
            readProviderJson(response, 32),
            error => error instanceof ProviderBoundaryError
                && error.code === 'UPSTREAM_RESPONSE_TOO_LARGE'
        );
        assert.equal(counters.cancels, 1);
    }
});

test('browser external-response reader cancels chunked and understated bodies before JSON allocation', async () => {
    for (const declaredLength of [null, '2']) {
        const { response, counters } = streamedResponse(
            JSON.stringify({ value: 'x'.repeat(128) }),
            { declaredLength, chunkSize: 11 }
        );
        await assert.rejects(
            readBoundedResponseJson(response, { maxBytes: 32 }),
            RangeError
        );
        assert.equal(counters.cancels, 1);
    }
});

test('oversized declared length, invalid media type, and redirects fail before body reads', async () => {
    for (const options of [
        { declaredLength: '33' },
        { declaredLength: 'invalid' },
        { contentType: 'text/html' },
        { redirected: true }
    ]) {
        const { response, counters } = streamedResponse('{}', options);
        await assert.rejects(
            readProviderJson(response, 32),
            error => error instanceof ProviderBoundaryError
        );
        assert.equal(counters.reads, 0);
    }
});

test('provider request rejects redirects and keeps one total timeout through body consumption', async () => {
    let requestOptions;
    await withFetch(async (_url, options) => {
        requestOptions = options;
        return streamedResponse('{}', { redirected: true }).response;
    }, async () => {
        await assert.rejects(
            requestProviderJson('https://provider.invalid/data', { method: 'GET' }, {
                maxBytes: 64,
                timeoutMs: 50
            }),
            error => error.code === 'UPSTREAM_RESPONSE_INVALID'
        );
    });
    assert.equal(requestOptions.redirect, 'error');
    assert.equal(requestOptions.signal instanceof AbortSignal, true);

    await withFetch(async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('synthetic abort')), {
            once: true
        });
    }), async () => {
        await assert.rejects(
            requestProviderJson('https://provider.invalid/slow', { method: 'GET' }, {
                maxBytes: 64,
                timeoutMs: 5
            }),
            error => error.code === 'UPSTREAM_TIMEOUT' && error.status === 504
        );
    });
});

test('legacy activity paging is exact, GET-only, and capped at 25 items per response', async () => {
    let upstream;
    await withFetch(async (...args) => {
        upstream = args;
        return streamedResponse(JSON.stringify(new Array(26).fill({ id: 1 }))).response;
    }, async () => {
        const response = responseRecorder();
        await activitiesHandler(
            authenticatedRequest({ page: '3', per_page: '25' }),
            response
        );
        assert.equal(response.statusCode, 502);
        assert.deepEqual(response.body, { error: 'ACTIVITIES_UPSTREAM_FAILED' });
    });
    const url = new URL(upstream[0]);
    assert.equal(url.pathname, '/api/v3/athlete/activities');
    assert.deepEqual([...url.searchParams], [['page', '3'], ['per_page', '25']]);
    assert.equal(upstream[1].method, 'GET');
    assert.equal(upstream[1].redirect, 'error');

    await withFetch(
        async () => streamedResponse(
            JSON.stringify(Array.from({ length: 25 }, (_, index) => ({ id: index + 1 })))
        ).response,
        async () => {
            const response = responseRecorder();
            await activitiesHandler(
                authenticatedRequest({ page: '1', per_page: '25' }),
                response
            );
            assert.equal(response.statusCode, 200);
            assert.equal(response.body.activities.length, 25);
            assert.equal(response.body.has_more, true);
        }
    );

    for (const request of [
        authenticatedRequest({ page: '1', per_page: '26' }),
        authenticatedRequest({ page: '1', per_page: '25', extra: '1' }),
        { ...authenticatedRequest({ page: '1', per_page: '25' }), method: 'POST' }
    ]) {
        const response = responseRecorder();
        await activitiesHandler(request, response);
        assert.equal(response.statusCode, request.method === 'POST' ? 405 : 400);
        assert.equal(response.headers['Cache-Control'], 'no-store');
    }

    let traps = 0;
    const hostileQuery = new Proxy(Object.create(null), {
        ownKeys() { traps += 1; throw new Error('synthetic query trap'); },
        getOwnPropertyDescriptor() { traps += 1; throw new Error('synthetic query trap'); },
        get() { traps += 1; throw new Error('synthetic query trap'); }
    });
    const hostileResponse = responseRecorder();
    await activitiesHandler(authenticatedRequest(hostileQuery), hostileResponse);
    assert.equal(hostileResponse.statusCode, 400);
    assert.equal(traps, 0);
});

test('legacy streams reject unknown keys and more than 200,000 points', async () => {
    const invalidPayloads = [
        { private: { data: [] } },
        { time: { data: new Array(200_001).fill(0) } }
    ];
    for (const payload of invalidPayloads) {
        await withFetch(
            async () => streamedResponse(JSON.stringify(payload), { chunkSize: 65_536 }).response,
            async () => {
                const response = responseRecorder();
                await streamsHandler(
                    authenticatedRequest({ id: 'synthetic-id', type: 'time' }),
                    response
                );
                assert.equal(response.statusCode, 502);
                assert.deepEqual(response.body, { error: 'STREAMS_UPSTREAM_FAILED' });
            }
        );
    }

    const response = responseRecorder();
    await streamsHandler(
        authenticatedRequest({ id: 'synthetic-id', type: 'time,private' }),
        response
    );
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'STREAMS_REQUEST_INVALID' });

    await withFetch(
        async () => streamedResponse(JSON.stringify({
            time: { data: new Array(200_000).fill(0) }
        }), { chunkSize: 65_536 }).response,
        async () => {
            const boundary = responseRecorder();
            await streamsHandler(
                authenticatedRequest({ id: 'synthetic-id', type: 'time' }),
                boundary
            );
            assert.equal(boundary.statusCode, 200);
            assert.equal(boundary.body.streams.time.data.length, 200_000);
        }
    );
});
