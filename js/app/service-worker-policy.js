export const LOCAL_SERVICE_WORKER_QUERY_PARAM = 'enable-sw';
export const SERVICE_WORKER_URL = '/sw.js';
export const SERVICE_WORKER_SCOPE = '/';
export const SERVICE_WORKER_UPDATE_VIA_CACHE = 'none';
export const SERVICE_WORKER_UPDATE_TIMEOUT_MS = 8000;

export const SERVICE_WORKER_LIFECYCLE_CODE = Object.freeze({
    UPDATE_CHECK_TIMEOUT: 'SW_UPDATE_CHECK_TIMEOUT',
    UPDATE_INSTALL_FAILED: 'SW_UPDATE_INSTALL_FAILED',
    UPDATE_WAITING: 'SW_UPDATE_WAITING',
    ACTIVATED: 'SW_ACTIVATED',
    CACHE_EVICTION_FAILED: 'SW_CACHE_EVICTION_FAILED'
});

const OWNED_STATIC_CACHE_NAMES = Object.freeze([
    'strava-dashboard-v1',
    'stravastats-static-v2-000001'
]);
const localHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalDevelopmentHost(hostname = '') {
    return localHostnames.has(String(hostname).toLowerCase());
}

export function shouldRegisterServiceWorker({
    hostname = '',
    search = '',
} = {}) {
    if (!isLocalDevelopmentHost(hostname)) {
        return true;
    }

    const params = new URLSearchParams(search);
    return params.get(LOCAL_SERVICE_WORKER_QUERY_PARAM) === '1';
}

function readOrigin(locationObject) {
    try {
        if (typeof locationObject?.origin !== 'string') return null;
        return new URL(locationObject.origin).origin;
    } catch {
        return null;
    }
}

function isOwnedRootRegistration(registration, locationObject) {
    const origin = readOrigin(locationObject);
    if (!origin || registration?.scope !== `${origin}/`) return false;

    const workers = [
        registration.installing,
        registration.waiting,
        registration.active
    ].filter(Boolean);
    if (workers.length === 0) return false;

    return workers.every(worker => {
        try {
            return new URL(worker.scriptURL).href === `${origin}${SERVICE_WORKER_URL}`;
        } catch {
            return false;
        }
    });
}

async function unregisterDevelopmentWorkers(serviceWorker, locationObject) {
    if (typeof serviceWorker.getRegistrations !== 'function') {
        return 0;
    }

    const registrations = await serviceWorker.getRegistrations();
    let changed = 0;
    for (const registration of registrations) {
        if (!isOwnedRootRegistration(registration, locationObject)) continue;
        try {
            if (await registration.unregister()) changed += 1;
        } catch {
            // Local cleanup is best-effort and remains exact-scope only.
        }
    }
    return changed;
}

async function clearDevelopmentCaches(cacheStorage) {
    if (!cacheStorage || typeof cacheStorage.keys !== 'function') {
        return 0;
    }

    const cacheNames = await cacheStorage.keys();
    let changed = 0;
    for (const cacheName of OWNED_STATIC_CACHE_NAMES) {
        if (!cacheNames.includes(cacheName)) continue;
        try {
            if (await cacheStorage.delete(cacheName)) changed += 1;
        } catch {
            // Local cleanup is best-effort and remains exact-name only.
        }
    }
    return changed;
}

function emitLifecycleState(onLifecycleState, code) {
    try {
        onLifecycleState?.({ code });
    } catch {
        // Observability must not alter the browser lifecycle.
    }
}

function observeRegistration({
    registration,
    serviceWorker,
    onLifecycleState,
}) {
    let waitingEmitted = false;

    const emitWaiting = () => {
        if (waitingEmitted) return;
        waitingEmitted = true;
        emitLifecycleState(
            onLifecycleState,
            SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_WAITING
        );
    };

    const observeInstallingWorker = worker => {
        if (!worker || typeof worker.addEventListener !== 'function') return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'redundant') {
                emitLifecycleState(
                    onLifecycleState,
                    SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_INSTALL_FAILED
                );
                return;
            }
            if (worker.state === 'installed' && serviceWorker.controller) {
                emitWaiting();
            }
        });
    };

    if (typeof registration?.addEventListener === 'function') {
        registration.addEventListener('updatefound', () => {
            observeInstallingWorker(registration.installing);
        });
    }
    observeInstallingWorker(registration?.installing);

    if (registration?.waiting) emitWaiting();

    if (typeof serviceWorker.addEventListener === 'function') {
        serviceWorker.addEventListener('controllerchange', () => {
            emitLifecycleState(
                onLifecycleState,
                SERVICE_WORKER_LIFECYCLE_CODE.ACTIVATED
            );
        });
    }

    return { emitWaiting };
}

async function checkForUpdate({
    registration,
    emitWaiting,
    onLifecycleState,
    updateTimeoutMs,
    setTimeoutFn,
    clearTimeoutFn,
}) {
    if (typeof registration?.update !== 'function') return 'unsupported';

    let timeoutHandle;
    const updatePromise = Promise.resolve().then(() => registration.update());
    const updateOutcome = updatePromise.then(
        () => 'checked',
        () => 'failed'
    );
    const timeoutOutcome = new Promise(resolve => {
        timeoutHandle = setTimeoutFn(() => resolve('timeout'), updateTimeoutMs);
    });
    const outcome = await Promise.race([updateOutcome, timeoutOutcome]);

    if (outcome !== 'timeout') clearTimeoutFn(timeoutHandle);
    if (outcome === 'timeout') {
        emitLifecycleState(
            onLifecycleState,
            SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_CHECK_TIMEOUT
        );
    } else if (outcome === 'failed') {
        emitLifecycleState(
            onLifecycleState,
            SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_INSTALL_FAILED
        );
    }

    if (registration.waiting) emitWaiting();
    return outcome;
}

export async function applyServiceWorkerPolicy({
    navigatorObject = globalThis.navigator,
    locationObject = globalThis.location,
    cacheStorage = globalThis.caches,
    serviceWorkerUrl = SERVICE_WORKER_URL,
    logger = console,
    onLifecycleState,
    updateTimeoutMs = SERVICE_WORKER_UPDATE_TIMEOUT_MS,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
    const serviceWorker = navigatorObject?.serviceWorker;
    if (!serviceWorker) {
        return { action: 'unsupported', registrationsChanged: 0, cachesChanged: 0 };
    }

    const register = shouldRegisterServiceWorker({
        hostname: locationObject?.hostname,
        search: locationObject?.search,
    });

    if (register) {
        const registration = await serviceWorker.register(serviceWorkerUrl, {
            scope: SERVICE_WORKER_SCOPE,
            updateViaCache: SERVICE_WORKER_UPDATE_VIA_CACHE
        });
        const observers = observeRegistration({
            registration,
            serviceWorker,
            onLifecycleState
        });
        const updateStatus = await checkForUpdate({
            registration,
            emitWaiting: observers.emitWaiting,
            onLifecycleState,
            updateTimeoutMs,
            setTimeoutFn,
            clearTimeoutFn
        });
        logger.info?.('Service Worker registered.');
        return {
            action: 'registered',
            registrationsChanged: 1,
            cachesChanged: 0,
            updateStatus
        };
    }

    const [registrationsChanged, cachesChanged] = await Promise.all([
        unregisterDevelopmentWorkers(serviceWorker, locationObject),
        clearDevelopmentCaches(cacheStorage),
    ]);

    logger.info?.('Service Worker disabled for local development.', {
        registrationsChanged,
        cachesChanged,
    });

    return { action: 'disabled', registrationsChanged, cachesChanged };
}
