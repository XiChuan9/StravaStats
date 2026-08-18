import { validateMapGeometry } from './map-location-egress.js';
import { prepareStreamMapPresentation } from '../pages/detail/stream-presentation.js';

export const GLOBAL_MAP_ROUTE_LIMITS = Object.freeze({
    maxActivityCount: 5_000,
    maxPointCount: 30_000,
    maxPointsPerRoute: 2_000,
    minimumTargetPoints: 6,
    concurrency: 2
});

const EMPTY_ROUTE = Object.freeze([]);
const COOPERATIVE_ROUTE_BATCH_SIZE = 4;

function yieldToNextTask() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function frozenEmptyRoutes(length) {
    return Object.freeze(Array.from({ length }, () => EMPTY_ROUTE));
}

function frozenResult(status, routes, {
    routeCount = 0,
    unavailableCount = 0,
    failedCount = 0,
    pointCount = 0
} = {}) {
    return Object.freeze({
        status,
        routes: Object.freeze([...routes]),
        routeCount,
        unavailableCount,
        failedCount,
        pointCount
    });
}

function failedResult(length = 0) {
    return frozenResult('failed', frozenEmptyRoutes(length), { failedCount: length });
}

function supersededResult(length) {
    return frozenResult('superseded', frozenEmptyRoutes(length));
}

function readOpaqueIds(candidate) {
    try {
        if (!Array.isArray(candidate) || Object.getPrototypeOf(candidate) !== Array.prototype) return null;
        const lengthDescriptor = Object.getOwnPropertyDescriptor(candidate, 'length');
        if (
            !lengthDescriptor
            || lengthDescriptor.enumerable
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
        ) return null;
        const length = lengthDescriptor.value;
        if (length > GLOBAL_MAP_ROUTE_LIMITS.maxActivityCount) {
            return Object.freeze({ status: 'limit-exceeded', ids: null });
        }
        const keys = Reflect.ownKeys(candidate);
        if (keys.length !== length + 1 || keys[keys.length - 1] !== 'length') return null;
        const ids = [];
        const unique = new Set();
        for (let index = 0; index < length; index += 1) {
            if (keys[index] !== String(index)) return null;
            const descriptor = Object.getOwnPropertyDescriptor(candidate, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            const id = descriptor.value;
            if (typeof id !== 'string' || id.trim().length === 0 || unique.has(id)) return null;
            unique.add(id);
            ids.push(id);
        }
        if (length !== ids.length) return null;
        return Object.freeze({ status: 'valid', ids });
    } catch {
        return null;
    }
}

function ownReadRoute(options) {
    try {
        if (
            options === null
            || typeof options !== 'object'
            || Array.isArray(options)
            || (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)
        ) return null;
        const descriptor = Object.getOwnPropertyDescriptor(options, 'readRoute');
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
        return typeof descriptor.value === 'function' ? descriptor.value : null;
    } catch {
        return null;
    }
}

function isDenseEmptyGeometry(candidate) {
    try {
        if (
            !Array.isArray(candidate)
            || Object.getPrototypeOf(candidate) !== Array.prototype
            || candidate.length !== 0
        ) return false;
        const keys = Reflect.ownKeys(candidate);
        if (keys.length !== 1 || keys[0] !== 'length') return false;
        const descriptor = Object.getOwnPropertyDescriptor(candidate, 'length');
        return Boolean(
            descriptor
            && !descriptor.enumerable
            && Object.hasOwn(descriptor, 'value')
            && descriptor.value === 0
        );
    } catch {
        return false;
    }
}

function fallbackReducedGeometry(validated, target) {
    const length = validated.length;
    const selected = new Set([0, length - 1]);
    let minimumLatitude = 0;
    let maximumLatitude = 0;
    let minimumLongitude = 0;
    let maximumLongitude = 0;
    for (let index = 1; index < length; index += 1) {
        const point = validated[index];
        if (point[0] < validated[minimumLatitude][0]) minimumLatitude = index;
        if (point[0] > validated[maximumLatitude][0]) maximumLatitude = index;
        if (point[1] < validated[minimumLongitude][1]) minimumLongitude = index;
        if (point[1] > validated[maximumLongitude][1]) maximumLongitude = index;
    }
    for (const index of [
        minimumLatitude,
        maximumLatitude,
        minimumLongitude,
        maximumLongitude
    ]) selected.add(index);

    const desired = Math.min(target, length);
    if (selected.size < desired && desired > 1) {
        for (let slot = 0; slot < desired && selected.size < desired; slot += 1) {
            selected.add(Math.floor((slot * (length - 1)) / (desired - 1)));
        }
    }
    if (selected.size < desired) {
        for (let index = 0; index < length && selected.size < desired; index += 1) {
            selected.add(index);
        }
    }
    return Object.freeze(
        [...selected]
            .sort((left, right) => left - right)
            .map(index => validated[index])
    );
}

function reducedGeometry(candidate, target) {
    if (candidate === null || candidate === undefined || isDenseEmptyGeometry(candidate)) {
        return Object.freeze({
            status: 'unavailable',
            geometry: EMPTY_ROUTE,
            sourceComplete: true
        });
    }
    const validated = validateMapGeometry(candidate);
    if (validated === null) {
        return Object.freeze({ status: 'failed', geometry: EMPTY_ROUTE, sourceComplete: false });
    }
    try {
        const presentation = prepareStreamMapPresentation(validated, null, {
            target,
            threshold: 0
        });
        const prepared = presentation.status === 'too-fragmented'
            ? null
            : validateMapGeometry(presentation.coordinates);
        const geometry = prepared !== null && prepared.length <= target
            ? prepared
            : fallbackReducedGeometry(validated, target);
        return Object.freeze({
            status: 'route',
            geometry,
            sourceComplete: geometry.length === validated.length
        });
    } catch {
        const geometry = fallbackReducedGeometry(validated, target);
        return Object.freeze({
            status: 'route',
            geometry,
            sourceComplete: geometry.length === validated.length
        });
    }
}

function resultStatus(length, routeCount, unavailableCount, failedCount) {
    if (length === 0) return 'empty';
    if (routeCount === length) return 'ready';
    if (failedCount === length) return 'failed';
    if (routeCount === 0 && unavailableCount === length) return 'empty';
    return 'partial';
}

export function createGlobalMapRouteSession(options = {}) {
    const readRoute = ownReadRoute(options);
    let disposed = false;
    let generation = 0;
    let activeReads = 0;
    let cachedPointCount = 0;
    const cache = new Map();
    const permitWaiters = [];

    function pumpPermits() {
        for (let index = permitWaiters.length - 1; index >= 0; index -= 1) {
            const waiter = permitWaiters[index];
            if (!disposed && waiter.generation === generation) continue;
            permitWaiters.splice(index, 1);
            waiter.resolve(false);
        }
        while (!disposed && activeReads < GLOBAL_MAP_ROUTE_LIMITS.concurrency && permitWaiters.length > 0) {
            const waiter = permitWaiters.shift();
            if (waiter.generation !== generation) {
                waiter.resolve(false);
                continue;
            }
            activeReads += 1;
            waiter.resolve(true);
        }
    }

    function acquirePermit(expectedGeneration) {
        if (disposed || expectedGeneration !== generation) return Promise.resolve(false);
        if (activeReads < GLOBAL_MAP_ROUTE_LIMITS.concurrency) {
            activeReads += 1;
            return Promise.resolve(true);
        }
        return new Promise(resolve => {
            permitWaiters.push({ generation: expectedGeneration, resolve });
        });
    }

    function releasePermit() {
        if (activeReads > 0) activeReads -= 1;
        pumpPermits();
    }

    function invalidateGeneration() {
        generation += 1;
        pumpPermits();
        return generation;
    }

    function clearCache() {
        cache.clear();
        cachedPointCount = 0;
    }

    function setCached(id, entry) {
        const existing = cache.get(id);
        if (existing) {
            cachedPointCount -= existing.geometry.length;
            cache.delete(id);
        }
        cache.set(id, entry);
        cachedPointCount += entry.geometry.length;
        while (
            (
                cachedPointCount > GLOBAL_MAP_ROUTE_LIMITS.maxPointCount
                || cache.size > GLOBAL_MAP_ROUTE_LIMITS.maxActivityCount
            )
            && cache.size > 0
        ) {
            const oldestId = cache.keys().next().value;
            const oldest = cache.get(oldestId);
            cache.delete(oldestId);
            cachedPointCount -= oldest.geometry.length;
        }
    }

    function cachedRoute(id, target) {
        if (!cache.has(id)) return null;
        const entry = cache.get(id);
        if (!entry.sourceComplete && entry.target < target) return null;
        let geometry = entry.geometry;
        if (geometry.length > target) {
            const reduced = reducedGeometry(geometry, target);
            if (reduced.status !== 'route') {
                cache.delete(id);
                cachedPointCount -= entry.geometry.length;
                return null;
            }
            geometry = reduced.geometry;
        }
        setCached(id, entry);
        return geometry;
    }

    async function load(activityIds) {
        const expectedGeneration = invalidateGeneration();
        const input = readOpaqueIds(activityIds);
        if (input === null) return failedResult();
        if (input.status === 'limit-exceeded') return frozenResult('limit-exceeded', EMPTY_ROUTE);
        const { ids } = input;
        if (disposed || readRoute === null) return failedResult(ids.length);
        if (ids.length === 0) return frozenResult('empty', EMPTY_ROUTE);

        const target = Math.min(
            GLOBAL_MAP_ROUTE_LIMITS.maxPointsPerRoute,
            Math.max(
                GLOBAL_MAP_ROUTE_LIMITS.minimumTargetPoints,
                Math.floor(GLOBAL_MAP_ROUTE_LIMITS.maxPointCount / ids.length)
            )
        );
        const routes = Array.from({ length: ids.length }, () => EMPTY_ROUTE);
        const outcomes = Array.from({ length: ids.length }, () => 'pending');
        const pending = [];

        for (let index = 0; index < ids.length; index += 1) {
            const cached = cachedRoute(ids[index], target);
            if (cached === null) {
                pending.push(index);
                continue;
            }
            routes[index] = cached;
            outcomes[index] = cached.length === 0 ? 'unavailable' : 'route';
        }

        let nextPending = 0;
        let scheduledInBatch = 0;
        let nextTaskPromise = null;

        async function takePendingIndex() {
            if (nextPending >= pending.length) return null;
            if (scheduledInBatch >= COOPERATIVE_ROUTE_BATCH_SIZE) {
                const scheduledTask = nextTaskPromise || yieldToNextTask();
                nextTaskPromise = scheduledTask;
                await scheduledTask;
                if (nextTaskPromise === scheduledTask) {
                    scheduledInBatch = 0;
                    nextTaskPromise = null;
                }
                if (disposed || generation !== expectedGeneration) return null;
            }
            if (nextPending >= pending.length) return null;
            const pendingOffset = nextPending;
            nextPending += 1;
            scheduledInBatch += 1;
            return pending[pendingOffset];
        }

        async function worker() {
            while (!disposed && generation === expectedGeneration) {
                const index = await takePendingIndex();
                if (index === null) return;
                const permitted = await acquirePermit(expectedGeneration);
                if (!permitted) return;
                let candidate;
                let readFailed = false;
                try {
                    candidate = await readRoute(ids[index]);
                } catch {
                    readFailed = true;
                } finally {
                    releasePermit();
                }
                if (disposed || generation !== expectedGeneration) return;
                if (readFailed) {
                    outcomes[index] = 'failed';
                    continue;
                }
                const reduced = reducedGeometry(candidate, target);
                outcomes[index] = reduced.status;
                routes[index] = reduced.geometry;
                if (reduced.status !== 'failed') {
                    setCached(ids[index], Object.freeze({
                        geometry: reduced.geometry,
                        target,
                        sourceComplete: reduced.sourceComplete
                    }));
                }
            }
        }

        await Promise.all(Array.from(
            { length: Math.min(GLOBAL_MAP_ROUTE_LIMITS.concurrency, pending.length) },
            () => worker()
        ));
        if (disposed || generation !== expectedGeneration) return supersededResult(ids.length);

        let routeCount = 0;
        let unavailableCount = 0;
        let failedCount = 0;
        let pointCount = 0;
        for (let index = 0; index < outcomes.length; index += 1) {
            if (outcomes[index] === 'route') {
                routeCount += 1;
                pointCount += routes[index].length;
            } else if (outcomes[index] === 'unavailable') {
                unavailableCount += 1;
            } else {
                failedCount += 1;
            }
        }
        return frozenResult(
            resultStatus(ids.length, routeCount, unavailableCount, failedCount),
            routes,
            { routeCount, unavailableCount, failedCount, pointCount }
        );
    }

    function clear() {
        invalidateGeneration();
        clearCache();
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        invalidateGeneration();
        clearCache();
    }

    return Object.freeze({ load, clear, dispose });
}
