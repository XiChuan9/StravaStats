import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GLOBAL_MAP_ROUTE_LIMITS,
    createGlobalMapRouteSession
} from '../../js/app/global-map-routes.js';

const EMPTY_ROUTE = Object.freeze([]);

function route(offset = 0, length = 8) {
    return Array.from({ length }, (_, index) => [
        -40 + offset + (index * 0.01),
        -120 + offset + (index * 0.02)
    ]);
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

async function nextTurn() {
    await new Promise(resolve => setImmediate(resolve));
}

function assertFrozenResult(result) {
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.routes), true);
    for (const geometry of result.routes) {
        assert.equal(Object.isFrozen(geometry), true);
        for (const point of geometry) assert.equal(Object.isFrozen(point), true);
    }
}

test('global Map route limits freeze the approved activity, point, route, and concurrency budgets', () => {
    assert.deepEqual(GLOBAL_MAP_ROUTE_LIMITS, {
        maxActivityCount: 5_000,
        maxPointCount: 30_000,
        maxPointsPerRoute: 2_000,
        minimumTargetPoints: 6,
        concurrency: 2
    });
    assert.equal(Object.isFrozen(GLOBAL_MAP_ROUTE_LIMITS), true);
});

test('loads routes with session-wide concurrency two while preserving input order', async () => {
    const jobs = new Map([
        ['one', deferred()],
        ['two', deferred()],
        ['three', deferred()],
        ['four', deferred()]
    ]);
    const started = [];
    let active = 0;
    let maximumActive = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            started.push(id);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            try {
                return await jobs.get(id).promise;
            } finally {
                active -= 1;
            }
        }
    });
    const ids = Object.freeze(['one', 'two', 'three', 'four']);
    const load = session.load(ids);

    await nextTurn();
    assert.deepEqual(started, ['one', 'two']);
    jobs.get('two').resolve(route(2));
    await nextTurn();
    assert.deepEqual(started, ['one', 'two', 'three']);
    jobs.get('three').resolve(route(3));
    await nextTurn();
    assert.deepEqual(started, ['one', 'two', 'three', 'four']);
    jobs.get('four').resolve(route(4));
    jobs.get('one').resolve(route(1));

    const result = await load;
    assert.equal(maximumActive, 2);
    assert.equal(result.status, 'ready');
    assert.equal(result.routeCount, 4);
    assert.equal(result.unavailableCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.pointCount, result.routes.reduce((sum, value) => sum + value.length, 0));
    assert.deepEqual(result.routes.map(value => value[0][0]), [-39, -38, -37, -36]);
    assert.deepEqual(ids, ['one', 'two', 'three', 'four']);
    assertFrozenResult(result);
});

test('a newer load supersedes pending work without exceeding the session-wide concurrency budget', async () => {
    const jobs = new Map([
        ['old-one', deferred()],
        ['old-two', deferred()],
        ['new-one', deferred()]
    ]);
    const started = [];
    let active = 0;
    let maximumActive = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            started.push(id);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            try {
                return await jobs.get(id).promise;
            } finally {
                active -= 1;
            }
        }
    });

    const oldLoad = session.load(['old-one', 'old-two', 'never-started']);
    await nextTurn();
    const newLoad = session.load(['new-one']);
    await nextTurn();
    assert.deepEqual(started, ['old-one', 'old-two']);

    jobs.get('old-two').resolve(route(2));
    await nextTurn();
    assert.deepEqual(started, ['old-one', 'old-two', 'new-one']);
    jobs.get('new-one').resolve(route(4));
    jobs.get('old-one').resolve(route(1));

    const [oldResult, newResult] = await Promise.all([oldLoad, newLoad]);
    assert.equal(oldResult.status, 'superseded');
    assert.deepEqual(oldResult.routes, [EMPTY_ROUTE, EMPTY_ROUTE, EMPTY_ROUTE]);
    assert.equal(oldResult.routeCount, 0);
    assert.equal(oldResult.pointCount, 0);
    assert.equal(newResult.status, 'ready');
    assert.equal(newResult.routeCount, 1);
    assert.equal(maximumActive, 2);
    assert.equal(started.includes('never-started'), false);
    assertFrozenResult(oldResult);
    assertFrozenResult(newResult);
});

test('rejects hostile or malformed ID collections before invoking the reader', async () => {
    let reads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async () => {
            reads += 1;
            return route();
        }
    });
    const sparse = new Array(1);
    const accessor = [];
    Object.defineProperty(accessor, '0', {
        enumerable: true,
        get() {
            reads += 100;
            return 'hidden';
        }
    });
    accessor.length = 1;
    const extraProperty = ['one'];
    extraProperty.extra = true;
    const throwing = new Proxy([], {
        getPrototypeOf() {
            throw new Error('synthetic');
        }
    });

    for (const candidate of [
        null,
        {},
        sparse,
        accessor,
        extraProperty,
        [''],
        ['   '],
        ['same', 'same'],
        ['valid', 2],
        throwing
    ]) {
        const result = await session.load(candidate);
        assert.equal(result.status, 'failed');
        assert.deepEqual(result.routes, []);
        assert.equal(result.routeCount, 0);
        assert.equal(result.unavailableCount, 0);
        assert.equal(result.failedCount, 0);
        assert.equal(result.pointCount, 0);
        assertFrozenResult(result);
    }
    assert.equal(reads, 0);
});

test('validates trimmed non-emptiness without changing an opaque ID value', async () => {
    const seen = [];
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            seen.push(id);
            return route();
        }
    });
    const result = await session.load(['  opaque-id  ']);
    assert.equal(result.status, 'ready');
    assert.deepEqual(seen, ['  opaque-id  ']);
});

test('returns a bounded limit-exceeded result with zero reads at 5,001 activities', async () => {
    let reads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async () => {
            reads += 1;
            return route();
        }
    });
    const ids = Array.from({ length: GLOBAL_MAP_ROUTE_LIMITS.maxActivityCount + 1 }, (_, index) => `id-${index}`);
    const snapshot = ids.slice();
    const result = await session.load(ids);

    assert.equal(result.status, 'limit-exceeded');
    assert.deepEqual(result.routes, []);
    assert.equal(result.routeCount, 0);
    assert.equal(result.unavailableCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.pointCount, 0);
    assert.equal(reads, 0);
    assert.deepEqual(ids, snapshot);
    assertFrozenResult(result);
});

test('short-circuits oversized own lengths before keys or elements and fails closed on malformed proxies', async () => {
    let reads = 0;
    let elementReads = 0;
    let ownKeyReads = 0;
    let indexDescriptorReads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async () => {
            reads += 1;
            return route();
        }
    });
    const huge = new Array(0xffff_ffff);
    Object.defineProperty(huge, '0', {
        enumerable: true,
        configurable: true,
        get() {
            elementReads += 1;
            throw new Error('synthetic');
        }
    });
    const trackingProxy = new Proxy(huge, {
        get(target, key, receiver) {
            if (key !== Symbol.toStringTag) elementReads += 1;
            return Reflect.get(target, key, receiver);
        },
        ownKeys(target) {
            ownKeyReads += 1;
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, key) {
            if (key !== 'length') indexDescriptorReads += 1;
            return Reflect.getOwnPropertyDescriptor(target, key);
        }
    });

    for (const candidate of [huge, trackingProxy]) {
        const result = await session.load(candidate);
        assert.equal(result.status, 'limit-exceeded');
        assert.deepEqual(result.routes, []);
        assertFrozenResult(result);
    }
    assert.equal(reads, 0);
    assert.equal(elementReads, 0);
    assert.equal(ownKeyReads, 0);
    assert.equal(indexDescriptorReads, 0);

    const malformed = new Proxy([], {
        getOwnPropertyDescriptor(target, key) {
            if (key === 'length') throw new Error('synthetic');
            return Reflect.getOwnPropertyDescriptor(target, key);
        }
    });
    const malformedResult = await session.load(malformed);
    assert.equal(malformedResult.status, 'failed');
    assert.deepEqual(malformedResult.routes, []);
    assert.equal(reads, 0);
});

test('distinguishes cached no-GPS values from retryable failures and reports partial states safely', async () => {
    const calls = new Map();
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            calls.set(id, (calls.get(id) || 0) + 1);
            if (id === 'route') return route();
            if (id === 'none') return [];
            throw new Error('private synthetic failure');
        }
    });

    const first = await session.load(['route', 'none', 'failure']);
    assert.equal(first.status, 'partial');
    assert.equal(first.routeCount, 1);
    assert.equal(first.unavailableCount, 1);
    assert.equal(first.failedCount, 1);
    assert.deepEqual(first.routes.map(value => value.length > 0), [true, false, false]);

    const second = await session.load(['route', 'none', 'failure']);
    assert.equal(second.status, 'partial');
    assert.deepEqual(Object.fromEntries(calls), { route: 1, none: 1, failure: 2 });
    assertFrozenResult(first);
    assertFrozenResult(second);
});

test('reports empty only for an empty set or an all-no-GPS set, and failed only when all reads fail', async () => {
    const emptySession = createGlobalMapRouteSession({ readRoute: async () => [] });
    const noIds = await emptySession.load([]);
    assert.equal(noIds.status, 'empty');
    assert.deepEqual(noIds.routes, []);

    const noGps = await emptySession.load(['one', 'two']);
    assert.equal(noGps.status, 'empty');
    assert.equal(noGps.unavailableCount, 2);
    assert.equal(noGps.failedCount, 0);

    const failureSession = createGlobalMapRouteSession({
        readRoute: async () => {
            throw new Error('synthetic');
        }
    });
    const failed = await failureSession.load(['one', 'two']);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.unavailableCount, 0);
    assert.equal(failed.failedCount, 2);
    assertFrozenResult(noIds);
    assertFrozenResult(noGps);
    assertFrozenResult(failed);
});

test('hostile and malformed geometries fail closed, while nullish and dense empty geometries cache as unavailable', async () => {
    const calls = new Map();
    const accessorPoint = [];
    Object.defineProperty(accessorPoint, '0', { enumerable: true, get: () => 10 });
    Object.defineProperty(accessorPoint, '1', { enumerable: true, value: 20 });
    accessorPoint.length = 2;
    const candidates = new Map([
        ['null', null],
        ['undefined', undefined],
        ['empty', []],
        ['string-number', [['10', 20]]],
        ['nan', [[NaN, 20]]],
        ['infinity', [[10, Infinity]]],
        ['latitude', [[91, 20]]],
        ['longitude', [[10, -181]]],
        ['accessor', [accessorPoint]]
    ]);
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            calls.set(id, (calls.get(id) || 0) + 1);
            return candidates.get(id);
        }
    });
    const ids = [...candidates.keys()];

    const first = await session.load(ids);
    assert.equal(first.status, 'partial');
    assert.equal(first.routeCount, 0);
    assert.equal(first.unavailableCount, 3);
    assert.equal(first.failedCount, 6);
    const second = await session.load(ids);
    assert.equal(second.status, 'partial');
    for (const id of ['null', 'undefined', 'empty']) assert.equal(calls.get(id), 1);
    for (const id of ids.slice(3)) assert.equal(calls.get(id), 2);
});

test('reduces a 200,000-point route to the per-route cap and preserves endpoints and coordinate extrema', async () => {
    const length = 200_000;
    const geometry = Array.from({ length }, (_, index) => [
        10 + ((index % 997) / 10_000),
        20 + ((index % 991) / 10_000)
    ]);
    geometry[0] = [11, 21];
    geometry[length - 1] = [12, 22];
    geometry[111] = [-80, 25];
    geometry[222] = [80, 26];
    geometry[333] = [15, -170];
    geometry[444] = [16, 170];
    const snapshot = [
        geometry[0].slice(),
        geometry[length - 1].slice(),
        geometry[111].slice(),
        geometry[222].slice(),
        geometry[333].slice(),
        geometry[444].slice()
    ];
    const session = createGlobalMapRouteSession({ readRoute: async () => geometry });
    const result = await session.load(['large']);

    assert.equal(result.status, 'ready');
    assert.ok(result.routes[0].length <= GLOBAL_MAP_ROUTE_LIMITS.maxPointsPerRoute);
    for (const point of snapshot) {
        assert.ok(result.routes[0].some(value => value[0] === point[0] && value[1] === point[1]));
    }
    assert.deepEqual(geometry[0], snapshot[0]);
    assert.deepEqual(geometry[length - 1], snapshot[1]);
    assert.equal(result.pointCount, result.routes[0].length);
    assertFrozenResult(result);
});

test('hydrates 5,000 routes within the aggregate point budget and reopens entirely from cache', async () => {
    let reads = 0;
    let active = 0;
    let maximumActive = 0;
    const ids = Array.from({ length: GLOBAL_MAP_ROUTE_LIMITS.maxActivityCount }, (_, index) => `route-${index}`);
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            reads += 1;
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            try {
                const offset = Number(id.slice(6)) % 20;
                return route(offset / 100, 10);
            } finally {
                active -= 1;
            }
        }
    });
    const first = await session.load(ids);
    const second = await session.load(ids);

    assert.equal(first.status, 'ready');
    assert.equal(second.status, 'ready');
    assert.equal(first.routeCount, ids.length);
    assert.ok(first.pointCount <= GLOBAL_MAP_ROUTE_LIMITS.maxPointCount);
    assert.ok(first.routes.every(value => value.length <= GLOBAL_MAP_ROUTE_LIMITS.minimumTargetPoints));
    assert.equal(second.pointCount, first.pointCount);
    assert.equal(reads, ids.length);
    assert.ok(maximumActive <= GLOBAL_MAP_ROUTE_LIMITS.concurrency);
    assertFrozenResult(first);
    assertFrozenResult(second);
});

test('target-six fallback preserves required extrema when an independent zero anchor fragments presentation', async () => {
    const geometry = [
        [10, 20],
        [-80, 30],
        [80, 40],
        [15, -170],
        [16, 170],
        [0, 50],
        [17, 60],
        [18, 70],
        [19, 80],
        [11, 21]
    ];
    const ids = Array.from({ length: 5_000 }, (_, index) => `route-${index}`);
    const session = createGlobalMapRouteSession({ readRoute: async () => geometry });
    const result = await session.load(ids);
    const required = [geometry[0], geometry.at(-1), geometry[1], geometry[2], geometry[3], geometry[4]];

    assert.equal(result.status, 'ready');
    assert.equal(result.routeCount, ids.length);
    assert.equal(result.failedCount, 0);
    assert.equal(result.pointCount, 30_000);
    assert.ok(result.routes.every(value => value.length === 6));
    for (const point of required) {
        assert.ok(result.routes[0].some(value => value[0] === point[0] && value[1] === point[1]));
    }
    assert.equal(result.routes[0].some(value => value[0] === 0 && value[1] === 50), false);
    assertFrozenResult(result);
});

test('rereads an incomplete low-fidelity cache entry when a narrower filter requests a larger target', async () => {
    const ids = Array.from({ length: 2_500 }, (_, index) => `route-${index}`);
    const fullGeometry = route(0, 100);
    let targetReads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            if (id === ids[0]) {
                targetReads += 1;
                return fullGeometry;
            }
            return [];
        }
    });

    const broad = await session.load(ids);
    const narrow = await session.load([ids[0]]);
    assert.equal(broad.status, 'partial');
    assert.equal(narrow.status, 'ready');
    assert.ok(broad.routes[0].length <= 12);
    assert.ok(narrow.routes[0].length > broad.routes[0].length);
    assert.equal(targetReads, 2);
});

test('a temporary lower-target projection does not permanently degrade a higher-fidelity cache entry', async () => {
    const ids = Array.from({ length: 2_500 }, (_, index) => `route-${index}`);
    const fullGeometry = route(0, 100);
    let targetReads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            if (id === ids[0]) {
                targetReads += 1;
                return fullGeometry;
            }
            return [];
        }
    });

    const high = await session.load([ids[0]]);
    const low = await session.load(ids);
    const restored = await session.load([ids[0]]);
    assert.equal(high.status, 'ready');
    assert.equal(low.status, 'partial');
    assert.ok(low.routes[0].length < high.routes[0].length);
    assert.deepEqual(restored.routes[0], high.routes[0]);
    assert.equal(targetReads, 1);
});

test('bounds zero-point LRU entries to 5,000 while retaining the most recent complete set', async () => {
    const firstIds = Array.from({ length: 5_000 }, (_, index) => `first-${index}`);
    const secondIds = Array.from({ length: 5_000 }, (_, index) => `second-${index}`);
    let reads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async () => {
            reads += 1;
            return [];
        }
    });

    await session.load(firstIds);
    await session.load(secondIds);
    await session.load([secondIds[0]]);
    assert.equal(reads, 10_000);
    await session.load([firstIds[0]]);
    assert.equal(reads, 10_001);
});

test('evicts the least-recent geometry when reduced cache points exceed 30,000', async () => {
    const geometry = Array.from({ length: 5_000 }, (_, index) => [
        -40 + (index * 0.001),
        -120 + (((index * 37) % 5_000) * 0.001)
    ]);
    let reads = 0;
    const session = createGlobalMapRouteSession({
        readRoute: async () => {
            reads += 1;
            return geometry;
        }
    });
    const ids = Array.from({ length: 40 }, (_, index) => `route-${index}`);
    for (const id of ids) await session.load([id]);

    assert.equal(reads, ids.length);
    await session.load([ids.at(-1)]);
    assert.equal(reads, ids.length);
    await session.load([ids[0]]);
    assert.equal(reads, ids.length + 1);
});

test('clear invalidates cached routes and active generations; dispose permanently fails closed', async () => {
    let reads = 0;
    const pendingOne = deferred();
    const pendingTwo = deferred();
    const session = createGlobalMapRouteSession({
        readRoute: async id => {
            reads += 1;
            if (id === 'pending-one') return pendingOne.promise;
            if (id === 'pending-two') return pendingTwo.promise;
            return route();
        }
    });

    await session.load(['cached']);
    await session.load(['cached']);
    assert.equal(reads, 1);
    session.clear();
    await session.load(['cached']);
    assert.equal(reads, 2);

    const activeLoad = session.load(['pending-one', 'pending-two', 'never-started']);
    await nextTurn();
    session.dispose();
    pendingOne.resolve(route());
    pendingTwo.resolve(route());
    const superseded = await activeLoad;
    assert.equal(superseded.status, 'superseded');
    assert.equal(reads, 4);

    const afterDispose = await session.load(['cached']);
    assert.equal(afterDispose.status, 'failed');
    assert.deepEqual(afterDispose.routes, [EMPTY_ROUTE]);
    assert.equal(afterDispose.failedCount, 1);
    assert.equal(reads, 4);
    assertFrozenResult(afterDispose);
});

test('an invalid reader dependency creates a frozen fail-closed session whose public load never rejects', async () => {
    const session = createGlobalMapRouteSession({ readRoute: null });
    assert.equal(Object.isFrozen(session), true);
    const result = await session.load(['one']);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.routes, [EMPTY_ROUTE]);
    assert.equal(result.failedCount, 1);
    assert.doesNotThrow(() => session.clear());
    assert.doesNotThrow(() => session.dispose());
    assertFrozenResult(result);
});
