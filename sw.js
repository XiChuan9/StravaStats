// Service Worker para StravaStats PWA
const CURRENT_CACHE_NAME = 'stravastats-static-v2-000001';
const LEGACY_CACHE_NAME = 'strava-dashboard-v1';
const RETIRED_OWNED_CACHE_NAMES = Object.freeze([]);
const INSTALL_SEED_PATHS = [
    '/',
    '/manifest.json',
    '/icon-sport.svg'
];
const EXACT_SCRIPT_PATHS = new Set(['/classifyRun.js', '/classifyBike.js']);
const EXACT_IMAGE_TYPES = new Map([
    ['/icon-sport.svg', Object.freeze(['image/svg+xml'])],
    ['/media/bg-run.jpg', Object.freeze(['image/jpeg'])],
    ['/media/bg-bike.jpg', Object.freeze(['image/jpeg'])],
    ['/media/bg-swim.jpg', Object.freeze(['image/jpeg'])]
]);
const SENSITIVE_REQUEST_HEADERS = Object.freeze([
    'authorization',
    'proxy-authorization',
    'cookie',
    'range',
    'x-api-key',
    'x-auth-token'
]);

const requestGetters = Object.freeze({
    url: Object.getOwnPropertyDescriptor(Request.prototype, 'url')?.get,
    method: Object.getOwnPropertyDescriptor(Request.prototype, 'method')?.get,
    mode: Object.getOwnPropertyDescriptor(Request.prototype, 'mode')?.get,
    destination: Object.getOwnPropertyDescriptor(Request.prototype, 'destination')?.get,
    credentials: Object.getOwnPropertyDescriptor(Request.prototype, 'credentials')?.get,
    headers: Object.getOwnPropertyDescriptor(Request.prototype, 'headers')?.get
});
const responseGetters = Object.freeze({
    status: Object.getOwnPropertyDescriptor(Response.prototype, 'status')?.get,
    type: Object.getOwnPropertyDescriptor(Response.prototype, 'type')?.get,
    url: Object.getOwnPropertyDescriptor(Response.prototype, 'url')?.get,
    redirected: Object.getOwnPropertyDescriptor(Response.prototype, 'redirected')?.get,
    headers: Object.getOwnPropertyDescriptor(Response.prototype, 'headers')?.get
});
const headersHas = Headers.prototype.has;
const headersGet = Headers.prototype.get;
const responseClone = Response.prototype.clone;

function readPlatformValue(getter, receiver) {
    if (typeof getter !== 'function') throw new TypeError('PLATFORM_GETTER_UNAVAILABLE');
    return getter.call(receiver);
}

function hasSensitiveRequestHeader(headers) {
    for (const name of SENSITIVE_REQUEST_HEADERS) {
        if (headersHas.call(headers, name)) return true;
    }
    return false;
}

function classifyStaticPath(pathname) {
    if (pathname === '/' || pathname === '/index.html') {
        return Object.freeze({
            kind: 'document',
            destinations: Object.freeze(['document']),
            modes: Object.freeze(['navigate']),
            contentTypes: Object.freeze(['text/html'])
        });
    }

    if (pathname === '/manifest.json') {
        return Object.freeze({
            kind: 'manifest',
            destinations: Object.freeze(['manifest']),
            modes: Object.freeze(['cors', 'no-cors', 'same-origin']),
            contentTypes: Object.freeze(['application/manifest+json', 'application/json'])
        });
    }

    const imageTypes = EXACT_IMAGE_TYPES.get(pathname);
    if (imageTypes) {
        return Object.freeze({
            kind: 'image',
            destinations: Object.freeze(['image']),
            modes: Object.freeze(['cors', 'no-cors', 'same-origin']),
            contentTypes: imageTypes
        });
    }

    if (
        EXACT_SCRIPT_PATHS.has(pathname)
        || /^\/js\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(pathname)
    ) {
        return Object.freeze({
            kind: 'script',
            destinations: Object.freeze(['script', 'worker', 'sharedworker']),
            modes: Object.freeze(['cors', 'no-cors', 'same-origin']),
            contentTypes: Object.freeze(['text/javascript', 'application/javascript'])
        });
    }

    if (/^\/styles\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.css$/.test(pathname)) {
        return Object.freeze({
            kind: 'style',
            destinations: Object.freeze(['style']),
            modes: Object.freeze(['no-cors', 'same-origin']),
            contentTypes: Object.freeze(['text/css'])
        });
    }

    return null;
}

function inspectCacheableRequest(request, { installSeed = false } = {}) {
    try {
        const urlValue = readPlatformValue(requestGetters.url, request);
        const method = readPlatformValue(requestGetters.method, request);
        const mode = readPlatformValue(requestGetters.mode, request);
        const destination = readPlatformValue(requestGetters.destination, request);
        const credentials = readPlatformValue(requestGetters.credentials, request);
        const headers = readPlatformValue(requestGetters.headers, request);
        const url = new URL(urlValue);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (url.origin !== self.location.origin) return null;
        if (method !== 'GET') return null;
        if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
            return null;
        }
        if (credentials === 'include' || (credentials !== 'omit' && credentials !== 'same-origin')) {
            return null;
        }
        if (hasSensitiveRequestHeader(headers)) return null;

        const classification = classifyStaticPath(url.pathname);
        if (!classification) return null;

        if (installSeed) {
            if (!INSTALL_SEED_PATHS.includes(url.pathname)) return null;
            if (credentials !== 'omit' || destination !== '' || mode !== 'same-origin') return null;
        } else {
            // Browser navigations are credentials=include. Document seeds are install-only and
            // must never create a runtime Cache Storage path for credential-bearing requests.
            if (classification.kind === 'document') return null;
            if (!classification.destinations.includes(destination)) return null;
            if (!classification.modes.includes(mode)) return null;
        }

        return Object.freeze({
            url: url.href,
            pathname: url.pathname,
            kind: classification.kind,
            contentTypes: classification.contentTypes
        });
    } catch {
        return null;
    }
}

function cacheControlIsPrivate(value) {
    if (value === null) return false;
    return value.split(',').some(part => {
        const directive = part.trim().split('=', 1)[0].toLowerCase();
        return directive === 'no-store' || directive === 'private' || directive === 'no-cache';
    });
}

function varyIsUnsafe(value) {
    if (value === null) return false;
    return value.split(',').some(part => part.trim() === '*');
}

function inspectCacheableResponse(response, requestInfo) {
    try {
        const status = readPlatformValue(responseGetters.status, response);
        const type = readPlatformValue(responseGetters.type, response);
        const responseUrlValue = readPlatformValue(responseGetters.url, response);
        const redirected = readPlatformValue(responseGetters.redirected, response);
        const headers = readPlatformValue(responseGetters.headers, response);

        if (status !== 200 || type !== 'basic' || redirected !== false) return false;

        const responseUrl = new URL(responseUrlValue);
        if (responseUrl.href !== requestInfo.url || responseUrl.origin !== self.location.origin) {
            return false;
        }

        const contentTypeValue = headersGet.call(headers, 'content-type');
        if (contentTypeValue === null) return false;
        const contentType = contentTypeValue.split(';', 1)[0].trim().toLowerCase();
        if (!requestInfo.contentTypes.includes(contentType)) return false;
        if (cacheControlIsPrivate(headersGet.call(headers, 'cache-control'))) return false;
        if (varyIsUnsafe(headersGet.call(headers, 'vary'))) return false;
        return true;
    } catch {
        return false;
    }
}

function offlineResponse() {
    return new Response('Offline', {
        status: 503,
        statusText: 'Offline',
        headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
}

async function writeValidatedResponse(cache, request, response, requestInfo) {
    if (!inspectCacheableResponse(response, requestInfo)) return false;
    try {
        const clone = responseClone.call(response);
        await cache.put(request, clone);
        return true;
    } catch {
        // A successful network response remains usable even if Cache Storage is unavailable.
        return false;
    }
}

async function seedInstallCache() {
    try {
        const cache = await caches.open(CURRENT_CACHE_NAME);

        const seedResults = await Promise.allSettled(INSTALL_SEED_PATHS.map(async pathname => {
            const request = new Request(new URL(pathname, self.location.origin).href, {
                method: 'GET',
                mode: 'same-origin',
                credentials: 'omit',
                cache: 'reload'
            });
            const requestInfo = inspectCacheableRequest(request, { installSeed: true });
            if (!requestInfo) throw new TypeError('SW_UPDATE_INSTALL_FAILED');
            const response = await fetch(request);
            const written = await writeValidatedResponse(cache, request, response, requestInfo);
            if (!written) throw new TypeError('SW_UPDATE_INSTALL_FAILED');
        }));
        if (seedResults.some(result => result.status === 'rejected')) {
            throw new TypeError('SW_UPDATE_INSTALL_FAILED');
        }
    } catch {
        try {
            await caches.delete(CURRENT_CACHE_NAME);
        } catch {
            // The install still fails if partial-cache cleanup is unavailable.
        }
        throw new TypeError('SW_UPDATE_INSTALL_FAILED');
    }
}

async function readValidatedFallback(request, requestInfo) {
    try {
        const cache = await caches.open(CURRENT_CACHE_NAME);
        const response = await cache.match(request);
        if (inspectCacheableResponse(response, requestInfo)) return response;
    } catch {
        // Cache failures have one fixed offline result and never disclose the caught value.
    }
    return offlineResponse();
}

async function fetchStaticResource(request, requestInfo) {
    let response;
    try {
        response = await fetch(request);
    } catch {
        return readValidatedFallback(request, requestInfo);
    }

    if (!inspectCacheableResponse(response, requestInfo)) return response;

    try {
        const cache = await caches.open(CURRENT_CACHE_NAME);
        await writeValidatedResponse(cache, request, response, requestInfo);
    } catch {
        // Cache open failure must not replace a successful network response.
    }
    return response;
}

// Instalar el service worker
self.addEventListener('install', event => {
    event.waitUntil(seedInstallCache());
});

async function evictRetiredOwnedCaches() {
    await Promise.all(RETIRED_OWNED_CACHE_NAMES.map(async cacheName => {
        try {
            await caches.delete(cacheName);
        } catch {
            // Exact-name cleanup is best-effort and must not block activation.
        }
    }));
}

// Activate only after old controlled clients have drained naturally.
self.addEventListener('activate', event => {
    event.waitUntil(evictRetiredOwnedCaches());
});

// Network-first is restricted to the approved same-origin static shell.
self.addEventListener('fetch', event => {
    let request;
    try {
        request = event.request;
    } catch {
        return;
    }

    const requestInfo = inspectCacheableRequest(request);
    if (!requestInfo) return;
    event.respondWith(fetchStaticResource(request, requestInfo));
});
