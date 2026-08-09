import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    MAP_LOCATION_ACTION_LABEL,
    MAP_LOCATION_AGGREGATE_COPY,
    MAP_LOCATION_CDN_LIMITATION,
    MAP_LOCATION_DISCLOSURE,
    MAP_LOCATION_MAX_CONCURRENT,
    MAP_LOCATION_MAX_RESPONSE_BYTES,
    MAP_LOCATION_MAX_ZOOM,
    MAP_LOCATION_TIMEOUT_MS,
    buildOpenStreetMapTileUrl,
    createApprovedTileEnvelope,
    createMapTileSession,
    readValidatedCoordinate,
    readValidatedRouteGeometry,
    validateMapGeometry
} from '../../js/app/map-location-egress.js';

const projectRoot = new URL('../../', import.meta.url);
const SYNTHETIC_GEOMETRY = Object.freeze([
    Object.freeze([0, 0]),
    Object.freeze([12.25, -45.5])
]);

async function source(relativePath) {
    return readFile(new URL(relativePath, projectRoot), 'utf8');
}

function pngResponse(bytes = 4) {
    const body = new Uint8Array(bytes);
    return {
        ok: true,
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'image/png' : null },
        body: {
            getReader() {
                let sent = false;
                return {
                    async read() {
                        if (sent) return { done: true };
                        sent = true;
                        return { done: false, value: body };
                    },
                    async cancel() {}
                };
            }
        }
    };
}

function dependencies(overrides = {}) {
    return {
        fetch: async () => pngResponse(),
        online: () => true,
        AbortController,
        setTimeout,
        clearTimeout,
        ...overrides
    };
}

function authorizedTile(session, zoom = MAP_LOCATION_MAX_ZOOM) {
    const range = session.approvedEnvelope.ranges[String(zoom)];
    return { z: zoom, x: range.xMin, y: range.yMin };
}

test('Option A constants freeze the exact gesture, copy, precision, and request budgets', () => {
    assert.equal(MAP_LOCATION_ACTION_LABEL, 'Load approximate OpenStreetMap tiles for this map');
    assert.equal(MAP_LOCATION_MAX_ZOOM, 11);
    assert.equal(MAP_LOCATION_TIMEOUT_MS, 4000);
    assert.equal(MAP_LOCATION_MAX_CONCURRENT, 4);
    assert.equal(MAP_LOCATION_MAX_RESPONSE_BYTES, 1024 * 1024);
    for (const phrase of [
        'OpenStreetMap',
        'zoom 11 or lower',
        'a.tile.openstreetmap.org',
        'b.tile.openstreetmap.org',
        'c.tile.openstreetmap.org',
        'approximate displayed area',
        'request timing',
        'does not send activity names or IDs',
        'route coordinates or route order',
        'Permission applies only to this map in this document',
        'cannot recall requests already received',
        'erase browser or provider records'
    ]) assert.equal(MAP_LOCATION_DISCLOSURE.includes(phrase), true, phrase);
    assert.equal(
        MAP_LOCATION_AGGREGATE_COPY,
        'For this view, the requested area covers all currently visible activities.'
    );
    assert.equal(MAP_LOCATION_CDN_LIMITATION.includes('exact-version-pinned'), true);
    assert.equal(MAP_LOCATION_CDN_LIMITATION.includes('served from this same origin'), true);
    assert.equal(MAP_LOCATION_CDN_LIMITATION.includes('separate external requests'), true);
    assert.equal(MAP_LOCATION_CDN_LIMITATION.includes('per-map permission'), true);
});

test('the single tile destination owner is the internal egress boundary', async () => {
    const files = new Map(await Promise.all([
        'js/app/map-location-egress.js',
        'js/tabs/maps.js',
        'js/tabs/run-analysis.js',
        'js/pages/activity/activity.js',
        'js/pages/run/run.js',
        'js/pages/bike/bike.js',
        'js/pages/swim/swim.js',
        'js/pages/gear/gear-analysis.js'
    ].map(async path => [path, await source(path)])));
    const owners = [...files]
        .filter(([, value]) => value.includes('tile.openstreetmap.org'))
        .map(([path]) => path);
    assert.deepEqual(owners, ['js/app/map-location-egress.js']);
    for (const [path, value] of files) {
        if (path === 'js/app/map-location-egress.js') continue;
        assert.doesNotMatch(value, /basemaps\.cartocdn|stamen-tiles|tile\.opentopomap|arcgisonline|\bfetch\s*\(/, path);
        assert.doesNotMatch(value, /\bL\.tileLayer\s*\(/, path);
    }
    const owner = files.get('js/app/map-location-egress.js');
    assert.doesNotMatch(owner, /localStorage|sessionStorage|indexedDB|serviceWorker|caches\s*\./);
});

test('geometry accepts genuine numeric zero and clones dense own data', () => {
    const result = validateMapGeometry(SYNTHETIC_GEOMETRY);
    assert.deepEqual(result, [[0, 0], [12.25, -45.5]]);
    assert.notEqual(result, SYNTHETIC_GEOMETRY);
    assert.notEqual(result[0], SYNTHETIC_GEOMETRY[0]);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result[0]), true);
});

test('geometry atomically rejects missing, null, coercible, sparse, accessor, nonfinite, and out-of-range values', () => {
    const sparseRoute = new Array(1);
    const sparsePoint = new Array(2);
    sparsePoint[0] = 1;
    const accessorPoint = [];
    Object.defineProperty(accessorPoint, '0', { enumerable: true, get: () => 1 });
    Object.defineProperty(accessorPoint, '1', { enumerable: true, value: 2 });
    accessorPoint.length = 2;
    const throwing = new Proxy([], { getPrototypeOf() { throw new Error('synthetic'); } });
    for (const candidate of [
        undefined,
        null,
        [],
        sparseRoute,
        [[1]],
        [[1, 2, 3]],
        sparsePoint,
        [accessorPoint],
        [[null, 2]],
        [[undefined, 2]],
        [['0', 2]],
        [[NaN, 2]],
        [[Infinity, 2]],
        [[91, 2]],
        [[1, -181]],
        throwing
    ]) assert.equal(validateMapGeometry(candidate), null);
});

test('plain-data readers fail closed before accessors, proxies, or malformed points can authorize a region', () => {
    let accessorReads = 0;
    const activityWithAccessor = {};
    Object.defineProperty(activityWithAccessor, 'map', {
        enumerable: true,
        get() {
            accessorReads += 1;
            return { summary_polyline: '??' };
        }
    });
    const pointWithAccessor = [];
    Object.defineProperty(pointWithAccessor, '0', {
        enumerable: true,
        get() {
            accessorReads += 1;
            return 1;
        }
    });
    Object.defineProperty(pointWithAccessor, '1', { enumerable: true, value: 2 });
    pointWithAccessor.length = 2;
    const throwing = new Proxy({}, {
        getPrototypeOf() { throw new Error('synthetic'); },
        get() { throw new Error('synthetic'); }
    });

    assert.deepEqual(readValidatedRouteGeometry(activityWithAccessor, null), []);
    assert.deepEqual(readValidatedRouteGeometry({}, { latlng: { data: [[1, 2, 3]] } }), []);
    assert.deepEqual(readValidatedRouteGeometry({}, { latlng: { data: [pointWithAccessor] } }), []);
    assert.deepEqual(readValidatedRouteGeometry(throwing, throwing), []);
    assert.equal(readValidatedCoordinate(activityWithAccessor, 'start_latlng'), null);
    assert.equal(readValidatedCoordinate(throwing, 'start_latlng'), null);
    assert.equal(accessorReads, 0);
    assert.deepEqual(readValidatedRouteGeometry({}, { latlng: { data: [[0, 0]] } }), [[0, 0]]);
    assert.deepEqual(readValidatedCoordinate({ start_latlng: [0, 0] }, 'start_latlng'), [0, 0]);
});

test('the approved envelope is complete before a canonical z/x/y URL is constructed', () => {
    const geometry = validateMapGeometry(SYNTHETIC_GEOMETRY);
    const envelope = createApprovedTileEnvelope(geometry);
    assert.equal(Object.isFrozen(envelope), true);
    assert.deepEqual(Object.keys(envelope.ranges), Array.from({ length: 12 }, (_, value) => String(value)));
    const range = envelope.ranges['11'];
    const tile = { z: 11, x: range.xMin, y: range.yMin };
    const url = buildOpenStreetMapTileUrl(tile, envelope);
    assert.match(url, /^https:\/\/[abc]\.tile\.openstreetmap\.org\/11\/(?:0|[1-9]\d*)\/(?:0|[1-9]\d*)\.png$/);
    assert.equal(buildOpenStreetMapTileUrl({ ...tile, z: 12 }, envelope), null);
    assert.equal(buildOpenStreetMapTileUrl({ ...tile, x: range.xMin - 1 }, envelope), null);
    assert.equal(buildOpenStreetMapTileUrl({ ...tile, x: '0' }, envelope), null);
    assert.equal(buildOpenStreetMapTileUrl({ ...tile, y: null }, envelope), null);
});

test('a deterministic 200,000-point route computes its full envelope without argument spreading', () => {
    const geometry = Array.from({ length: 200_000 }, (_, index) => [
        (index % 2) * 12.25,
        (index % 2) * -45.5
    ]);
    const session = createMapTileSession({
        sessionMode: 'real',
        geometry,
        dependencies: dependencies()
    });
    assert.equal(session.enabled, true);
    assert.equal(session.coordinates.length, geometry.length);
    assert.deepEqual(
        session.approvedEnvelope.ranges['11'],
        createApprovedTileEnvelope(SYNTHETIC_GEOMETRY).ranges['11']
    );
});

test('Real starts denied and grants only in memory; Demo never inspects geometry or exposes a grant', async () => {
    let fetches = 0;
    const real = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({ fetch: async () => { fetches += 1; return pngResponse(); } })
    });
    assert.equal(real.enabled, true);
    assert.equal(real.isGranted(), false);
    assert.equal(await real.requestTile(authorizedTile(real)), null);
    assert.equal(fetches, 0);
    assert.equal(real.grant(), true);
    assert.equal(real.isGranted(), true);

    let geometryReads = 0;
    const hostileGeometry = new Proxy([], { get() { geometryReads += 1; throw new Error('synthetic'); } });
    const demo = createMapTileSession({
        sessionMode: 'demo',
        geometry: hostileGeometry,
        dependencies: dependencies({ fetch: async () => { fetches += 1; return pngResponse(); } })
    });
    assert.equal(demo.enabled, false);
    assert.equal(demo.isGranted(), false);
    assert.equal(demo.grant(), false);
    assert.equal(await demo.requestTile({ z: 0, x: 0, y: 0 }), null);
    assert.equal(geometryReads, 0);
    assert.equal(fetches, 0);
});

test('an authorized tile uses one exact privacy-hardened GET and accepts only a bounded PNG', async () => {
    const calls = [];
    const session = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({
            fetch: async (url, options) => {
                calls.push({ url: String(url), options });
                return pngResponse();
            }
        })
    });
    session.grant();
    const blob = await session.requestTile(authorizedTile(session));
    assert.equal(blob instanceof Blob, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/[abc]\.tile\.openstreetmap\.org\//);
    assert.deepEqual(
        {
            method: calls[0].options.method,
            credentials: calls[0].options.credentials,
            referrerPolicy: calls[0].options.referrerPolicy,
            redirect: calls[0].options.redirect,
            cache: calls[0].options.cache
        },
        {
            method: 'GET',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            redirect: 'error',
            cache: 'no-store'
        }
    );
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);
    assert.deepEqual(Object.keys(calls[0].options).sort(), [
        'cache', 'credentials', 'method', 'redirect', 'referrerPolicy', 'signal'
    ]);

    for (const response of [
        { ...pngResponse(), ok: false, status: 503 },
        { ...pngResponse(), redirected: true },
        { ...pngResponse(), headers: { get: () => 'image/jpeg' } },
        pngResponse(MAP_LOCATION_MAX_RESPONSE_BYTES + 1)
    ]) {
        let requests = 0;
        let requestSignal = null;
        const rejected = createMapTileSession({
            sessionMode: 'real',
            geometry: SYNTHETIC_GEOMETRY,
            dependencies: dependencies({
                fetch: async (_url, options) => {
                    requests += 1;
                    requestSignal = options.signal;
                    return response;
                }
            })
        });
        rejected.grant();
        assert.equal(await rejected.requestTile(authorizedTile(rejected)), null);
        assert.equal(requests, 1);
        assert.equal(requestSignal.aborted, true);
    }
});

test('unknown-length streamed responses are cancelled before reading beyond the 1 MiB bound', async () => {
    let reads = 0;
    let cancellations = 0;
    const chunks = [
        new Uint8Array(700 * 1024),
        new Uint8Array(400 * 1024),
        new Uint8Array(64)
    ];
    const response = {
        ok: true,
        status: 200,
        redirected: false,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'image/png' : null },
        body: {
            getReader() {
                return {
                    async read() {
                        const value = chunks[reads];
                        reads += 1;
                        return value ? { done: false, value } : { done: true };
                    },
                    async cancel() { cancellations += 1; }
                };
            }
        },
        async blob() { throw new Error('streaming response must not be buffered'); }
    };
    const session = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({ fetch: async () => response })
    });
    session.grant();
    assert.equal(await session.requestTile(authorizedTile(session)), null);
    assert.equal(reads, 2);
    assert.equal(cancellations, 1);
});

test('oversized declared responses are aborted without reading their body', async () => {
    let reads = 0;
    const response = {
        ok: true,
        status: 200,
        redirected: false,
        headers: {
            get(name) {
                if (name.toLowerCase() === 'content-type') return 'image/png';
                if (name.toLowerCase() === 'content-length') return String(MAP_LOCATION_MAX_RESPONSE_BYTES + 1);
                return null;
            }
        },
        body: { getReader() { reads += 1; throw new Error('must not read'); } }
    };
    const session = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({ fetch: async () => response })
    });
    session.grant();
    assert.equal(await session.requestTile(authorizedTile(session)), null);
    assert.equal(reads, 0);
});

test('malformed, understated, invalid-chunk, and no-reader bodies abort and cancel fail closed', async () => {
    const cases = [
        {
            contentLength: '01',
            body: { getReader() { throw new Error('must not read malformed length'); } },
            expectedReaderCalls: 0,
            expectedCancellations: 0
        },
        {
            contentLength: '1',
            chunks: [new Uint8Array(2)],
            expectedReaderCalls: 1,
            expectedCancellations: 1
        },
        {
            chunks: ['not-bytes'],
            expectedReaderCalls: 1,
            expectedCancellations: 1
        },
        {
            body: null,
            expectedReaderCalls: 0,
            expectedCancellations: 0
        }
    ];

    for (const fixture of cases) {
        let readerCalls = 0;
        let cancellations = 0;
        let index = 0;
        const body = Object.hasOwn(fixture, 'body')
            ? fixture.body
            : {
                getReader() {
                    readerCalls += 1;
                    return {
                        async read() {
                            const value = fixture.chunks[index];
                            index += 1;
                            return value === undefined ? { done: true } : { done: false, value };
                        },
                        async cancel() { cancellations += 1; }
                    };
                }
            };
        const response = {
            ok: true,
            status: 200,
            redirected: false,
            headers: {
                get(name) {
                    if (name.toLowerCase() === 'content-type') return 'image/png';
                    if (name.toLowerCase() === 'content-length') return fixture.contentLength ?? null;
                    return null;
                }
            },
            body
        };
        const session = createMapTileSession({
            sessionMode: 'real',
            geometry: SYNTHETIC_GEOMETRY,
            dependencies: dependencies({ fetch: async () => response })
        });
        session.grant();
        assert.equal(await session.requestTile(authorizedTile(session)), null);
        assert.equal(readerCalls, fixture.expectedReaderCalls);
        assert.equal(cancellations, fixture.expectedCancellations);
    }
});

test('authorized scheduling is bounded to four concurrent requests without response reuse', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let calls = 0;
    let active = 0;
    let maximum = 0;
    const session = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({
            fetch: async () => {
                calls += 1;
                active += 1;
                maximum = Math.max(maximum, active);
                await gate;
                active -= 1;
                return pngResponse();
            }
        })
    });
    session.grant();
    const requests = Array.from({ length: 8 }, () => session.requestTile(authorizedTile(session)));
    await Promise.resolve();
    assert.equal(calls, MAP_LOCATION_MAX_CONCURRENT);
    assert.equal(maximum, MAP_LOCATION_MAX_CONCURRENT);
    release();
    const results = await Promise.all(requests);
    assert.equal(results.every(value => value instanceof Blob), true);
    assert.equal(calls, 8);
    assert.equal(maximum, MAP_LOCATION_MAX_CONCURRENT);
});

test('offline, timeout, revoke, and pagehide fail closed with no retry', async () => {
    let offlineFetches = 0;
    const offline = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({
            online: () => false,
            fetch: async () => { offlineFetches += 1; return pngResponse(); }
        })
    });
    offline.grant();
    assert.equal(await offline.requestTile(authorizedTile(offline)), null);
    assert.equal(offlineFetches, 0);

    let timeoutCallback;
    let timeoutFetches = 0;
    const timed = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({
            setTimeout: callback => { timeoutCallback = callback; return 1; },
            clearTimeout: () => {},
            fetch: (_url, options) => {
                timeoutFetches += 1;
                return new Promise((_resolve, reject) => {
                    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                });
            }
        })
    });
    timed.grant();
    const timedRequest = timed.requestTile(authorizedTile(timed));
    timeoutCallback();
    assert.equal(await timedRequest, null);
    assert.equal(timeoutFetches, 1);

    let resolveLate;
    const revocable = createMapTileSession({
        sessionMode: 'real',
        geometry: SYNTHETIC_GEOMETRY,
        dependencies: dependencies({
            fetch: () => new Promise(resolve => { resolveLate = resolve; })
        })
    });
    revocable.grant();
    const lateRequest = revocable.requestTile(authorizedTile(revocable));
    revocable.revoke();
    resolveLate(pngResponse());
    assert.equal(await lateRequest, null);
    assert.equal(revocable.isGranted(), false);
    revocable.handlePageHide();
    assert.equal(await revocable.requestTile(authorizedTile(revocable)), null);
});

test('production integration injects mode and leaves no dormant provider seam', async () => {
    const [main, maps, runAnalysis, activityIndex, runIndex, bikeIndex, swimIndex, gearIndex, gear] = await Promise.all([
        'js/app/main.js',
        'js/tabs/maps.js',
        'js/tabs/run-analysis.js',
        'js/pages/activity/index.js',
        'js/pages/run/index.js',
        'js/pages/bike/index.js',
        'js/pages/swim/index.js',
        'js/pages/gear/index.js',
        'js/pages/gear/gear-analysis.js'
    ].map(source));
    assert.match(main, /renderMapTab\([\s\S]*?sessionMode:\s*activeSessionMode/);
    assert.match(maps, /createMapLocationBoundary/);
    assert.doesNotMatch(runAnalysis, /tile\.openstreetmap|L\.tileLayer/);
    for (const value of [activityIndex, runIndex, bikeIndex, swimIndex]) {
        assert.match(value, /mapLocationMode:\s*demo\s*\?\s*'demo'\s*:\s*'real'/);
    }
    assert.match(gearIndex, /isDemoMode/);
    assert.match(gearIndex, /const\s+sessionMode\s*=\s*demo\s*\?\s*'demo'\s*:\s*'real'/);
    assert.match(gear, /if\s*\(sessionMode\s*===\s*'demo'\)[\s\S]*?return/);
    assert.doesNotMatch(maps, /push\(\.\.\.item\.route\)/);
    assert.doesNotMatch(gear, /push\(\.\.\.item\.route\)/);
});

test('the browser harness freezes interception-before-import and zero real external requests', async () => {
    const harness = await source('tests/consumers/map-location-consent-browser-smoke.html');
    assert.match(harness, /globalThis\.fetch\s*=\s*interceptedFetch[\s\S]*?await import\(/);
    assert.match(harness, /realExternalRequests\s*!==\s*0/);
    assert.match(harness, /data-status/);
    assert.doesNotMatch(harness, /PRIVATE_|token|Authorization/);
});
