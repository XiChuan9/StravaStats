export const MAP_LOCATION_ACTION_LABEL = 'Load approximate OpenStreetMap tiles for this map';
export const MAP_LOCATION_DISCLOSURE = 'Map tiles are provided by OpenStreetMap. If you choose “Load approximate OpenStreetMap tiles for this map”, StravaStats requests map images for the coarse area shown (zoom 11 or lower) from a.tile.openstreetmap.org, b.tile.openstreetmap.org, or c.tile.openstreetmap.org. Tile paths reveal the approximate displayed area and request timing. StravaStats does not send activity names or IDs, dates, route coordinates or route order, tokens, heart rate, or power; the route overlay stays in this document. Permission applies only to this map in this document. Revoke stops new requests and cancels registered loads, but cannot recall requests already received or erase browser or provider records.';
export const MAP_LOCATION_AGGREGATE_COPY = 'For this view, the requested area covers all currently visible activities.';
export const MAP_LOCATION_CDN_LIMITATION = 'Map drawing code is currently loaded from unpkg.com and runs in this page. This tile permission does not resolve that separate CDN trust boundary.';
export const MAP_LOCATION_MAX_ZOOM = 11;
export const MAP_LOCATION_TIMEOUT_MS = 4000;
export const MAP_LOCATION_MAX_CONCURRENT = 4;
export const MAP_LOCATION_MAX_RESPONSE_BYTES = 1024 * 1024;

const MERCATOR_MAX_LATITUDE = 85.05112878;
const OSM_HOSTS = Object.freeze([
    'a.tile.openstreetmap.org',
    'b.tile.openstreetmap.org',
    'c.tile.openstreetmap.org'
]);
const ABSENT_DATA = Symbol('absent-map-data');
const INVALID_DATA = Symbol('invalid-map-data');

function ownOrdinaryDataValue(record, key) {
    try {
        if (record === null || typeof record !== 'object' || Array.isArray(record)) return INVALID_DATA;
        const prototype = Object.getPrototypeOf(record);
        if (prototype !== Object.prototype && prototype !== null) return INVALID_DATA;
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        if (descriptor === undefined) return ABSENT_DATA;
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return INVALID_DATA;
        return descriptor.value;
    } catch {
        return INVALID_DATA;
    }
}

function densePlainArrayValues(value, expectedLength = null) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        if (expectedLength !== null && value.length !== expectedLength) return null;
        if (value.length === 0) return [];
        const keys = Reflect.ownKeys(value);
        if (keys.length !== value.length + 1 || keys[keys.length - 1] !== 'length') return null;
        const values = [];
        for (let index = 0; index < value.length; index += 1) {
            if (keys[index] !== String(index)) return null;
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            values.push(descriptor.value);
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (!lengthDescriptor || lengthDescriptor.enumerable || !Object.hasOwn(lengthDescriptor, 'value')) return null;
        return values;
    } catch {
        return null;
    }
}

export function validateMapGeometry(candidate) {
    const points = densePlainArrayValues(candidate);
    if (points === null || points.length === 0) return null;
    const geometry = [];
    for (const point of points) {
        const values = densePlainArrayValues(point, 2);
        if (values === null) return null;
        const [latitude, longitude] = values;
        if (
            typeof latitude !== 'number'
            || typeof longitude !== 'number'
            || !Number.isFinite(latitude)
            || !Number.isFinite(longitude)
            || latitude < -90
            || latitude > 90
            || longitude < -180
            || longitude > 180
        ) return null;
        geometry.push(Object.freeze([
            Object.is(latitude, -0) ? 0 : latitude,
            Object.is(longitude, -0) ? 0 : longitude
        ]));
    }
    return Object.freeze(geometry);
}

export function decodeMapPolyline(value) {
    if (typeof value !== 'string' || value.length === 0) return [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    const coordinates = [];
    function readDelta() {
        let result = 0;
        let shift = 0;
        while (index < value.length && shift <= 30) {
            const byte = value.charCodeAt(index++) - 63;
            if (byte < 0 || byte > 63) return null;
            result |= (byte & 0x1f) << shift;
            if (byte < 0x20) return (result & 1) ? ~(result >> 1) : (result >> 1);
            shift += 5;
        }
        return null;
    }
    while (index < value.length) {
        const latitudeDelta = readDelta();
        const longitudeDelta = readDelta();
        if (latitudeDelta === null || longitudeDelta === null) return [];
        latitude += latitudeDelta;
        longitude += longitudeDelta;
        const point = validateMapGeometry([[latitude / 1e5, longitude / 1e5]]);
        if (point === null) return [];
        coordinates.push(point[0]);
    }
    return Object.freeze(coordinates);
}

function encodedPolylineFromActivity(activity, allowTopLevel) {
    const map = ownOrdinaryDataValue(activity, 'map');
    if (map === INVALID_DATA) return INVALID_DATA;
    if (map !== ABSENT_DATA && map !== null && map !== undefined) {
        for (const key of ['summary_polyline', 'polyline']) {
            const value = ownOrdinaryDataValue(map, key);
            if (value === INVALID_DATA) return INVALID_DATA;
            if (value !== ABSENT_DATA && value !== null && value !== undefined && value !== '') {
                return typeof value === 'string' ? value : INVALID_DATA;
            }
        }
    }
    if (allowTopLevel) {
        for (const key of ['summary_polyline', 'polyline']) {
            const value = ownOrdinaryDataValue(activity, key);
            if (value === INVALID_DATA) return INVALID_DATA;
            if (value !== ABSENT_DATA && value !== null && value !== undefined && value !== '') {
                return typeof value === 'string' ? value : INVALID_DATA;
            }
        }
    }
    return ABSENT_DATA;
}

export function readValidatedRouteGeometry(activity, streams, { allowTopLevelPolyline = false } = {}) {
    const encoded = encodedPolylineFromActivity(activity, allowTopLevelPolyline);
    if (encoded === INVALID_DATA) return [];
    if (encoded !== ABSENT_DATA) return decodeMapPolyline(encoded);
    if (streams === null || streams === undefined) return [];
    const latlng = ownOrdinaryDataValue(streams, 'latlng');
    if (latlng === INVALID_DATA || latlng === ABSENT_DATA || latlng === null || latlng === undefined) return [];
    const data = ownOrdinaryDataValue(latlng, 'data');
    if (data === INVALID_DATA || data === ABSENT_DATA) return [];
    return validateMapGeometry(data) || [];
}

export function readValidatedCoordinate(record, key) {
    const value = ownOrdinaryDataValue(record, key);
    if (value === INVALID_DATA || value === ABSENT_DATA || value === null || value === undefined) return null;
    return validateMapGeometry([value])?.[0] || null;
}

function longitudeToTileX(longitude, zoom) {
    const count = 2 ** zoom;
    return Math.min(count - 1, Math.max(0, Math.floor(((longitude + 180) / 360) * count)));
}

function latitudeToTileY(latitude, zoom) {
    const count = 2 ** zoom;
    const clamped = Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, latitude));
    const radians = clamped * Math.PI / 180;
    const normalized = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
    return Math.min(count - 1, Math.max(0, Math.floor(normalized * count)));
}

function tileXToLongitude(x, zoom) {
    return (x / (2 ** zoom)) * 360 - 180;
}

function tileYToLatitude(y, zoom) {
    const radians = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (2 ** zoom))));
    return radians * 180 / Math.PI;
}

export function createApprovedTileEnvelope(candidate) {
    const geometry = validateMapGeometry(candidate);
    if (geometry === null) return null;
    const ranges = {};
    for (let zoom = 0; zoom <= MAP_LOCATION_MAX_ZOOM; zoom += 1) {
        const count = 2 ** zoom;
        let xMin = count - 1;
        let xMax = 0;
        let yMin = count - 1;
        let yMax = 0;
        for (const point of geometry) {
            const x = longitudeToTileX(point[1], zoom);
            const y = latitudeToTileY(point[0], zoom);
            xMin = Math.min(xMin, x);
            xMax = Math.max(xMax, x);
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
        }
        ranges[String(zoom)] = Object.freeze({
            xMin: Math.max(0, xMin - 1),
            xMax: Math.min(count - 1, xMax + 1),
            yMin: Math.max(0, yMin - 1),
            yMax: Math.min(count - 1, yMax + 1)
        });
    }
    const maximum = ranges[String(MAP_LOCATION_MAX_ZOOM)];
    const bounds = Object.freeze({
        south: tileYToLatitude(maximum.yMax + 1, MAP_LOCATION_MAX_ZOOM),
        west: tileXToLongitude(maximum.xMin, MAP_LOCATION_MAX_ZOOM),
        north: tileYToLatitude(maximum.yMin, MAP_LOCATION_MAX_ZOOM),
        east: tileXToLongitude(maximum.xMax + 1, MAP_LOCATION_MAX_ZOOM)
    });
    const geometryKey = geometry.map(point => `${point[0]},${point[1]}`).join(';');
    return Object.freeze({
        bounds,
        geometryKey,
        ranges: Object.freeze(ranges)
    });
}

function readTile(value) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
        const descriptors = ['z', 'x', 'y'].map(key => Object.getOwnPropertyDescriptor(value, key));
        if (descriptors.some(descriptor => !descriptor || !Object.hasOwn(descriptor, 'value'))) return null;
        const [z, x, y] = descriptors.map(descriptor => descriptor.value);
        if (![z, x, y].every(Number.isInteger)) return null;
        if (z < 0 || z > MAP_LOCATION_MAX_ZOOM) return null;
        const count = 2 ** z;
        if (x < 0 || x >= count || y < 0 || y >= count) return null;
        return Object.freeze({ z, x, y });
    } catch {
        return null;
    }
}

export function buildOpenStreetMapTileUrl(candidate, envelope) {
    const tile = readTile(candidate);
    if (tile === null || envelope === null || typeof envelope !== 'object') return null;
    try {
        const range = envelope.ranges?.[String(tile.z)];
        if (
            range === null
            || typeof range !== 'object'
            || tile.x < range.xMin
            || tile.x > range.xMax
            || tile.y < range.yMin
            || tile.y > range.yMax
        ) return null;
        const host = OSM_HOSTS[(tile.z + tile.x + tile.y) % OSM_HOSTS.length];
        const url = new URL(`https://${host}/${tile.z}/${tile.x}/${tile.y}.png`);
        if (
            url.protocol !== 'https:'
            || !OSM_HOSTS.includes(url.hostname)
            || url.port !== ''
            || url.username !== ''
            || url.password !== ''
            || url.search !== ''
            || url.hash !== ''
            || url.pathname !== `/${tile.z}/${tile.x}/${tile.y}.png`
        ) return null;
        return url.href;
    } catch {
        return null;
    }
}

function disabledSession() {
    return Object.freeze({
        enabled: false,
        approvedEnvelope: null,
        coordinates: null,
        isGranted: () => false,
        grant: () => false,
        revoke: () => {},
        handlePageHide: () => {},
        requestTile: async () => null
    });
}

function validDependencies(value) {
    return value !== null
        && typeof value === 'object'
        && typeof value.fetch === 'function'
        && typeof value.online === 'function'
        && typeof value.AbortController === 'function'
        && typeof value.setTimeout === 'function'
        && typeof value.clearTimeout === 'function';
}

async function readBoundedPngBlob(response, controller) {
    let contentLength;
    try {
        contentLength = response.headers?.get?.('content-length');
    } catch {
        controller.abort();
        return null;
    }
    let declaredLength = null;
    if (contentLength !== null && contentLength !== undefined) {
        if (!/^(?:0|[1-9]\d*)$/.test(contentLength)) {
            controller.abort();
            return null;
        }
        declaredLength = Number(contentLength);
        if (!Number.isSafeInteger(declaredLength) || declaredLength > MAP_LOCATION_MAX_RESPONSE_BYTES) {
            controller.abort();
            return null;
        }
    }

    let reader;
    try {
        if (typeof response.body?.getReader !== 'function') {
            controller.abort();
            return null;
        }
        reader = response.body.getReader();
    } catch {
        controller.abort();
        return null;
    }

    async function rejectBody() {
        try {
            await reader.cancel?.();
        } catch {
            // The shared AbortController still settles the request below.
        }
        controller.abort();
        return null;
    }

    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const part = await reader.read();
            if (part?.done === true) break;
            if (!(part?.value instanceof Uint8Array)) return rejectBody();
            total += part.value.byteLength;
            if (
                total > MAP_LOCATION_MAX_RESPONSE_BYTES
                || (declaredLength !== null && total > declaredLength)
            ) return rejectBody();
            chunks.push(part.value);
        }
    } catch {
        return rejectBody();
    }
    if (declaredLength !== null && total !== declaredLength) return rejectBody();
    return new Blob(chunks, { type: 'image/png' });
}

export function createMapTileSession({ sessionMode, geometry, dependencies } = {}) {
    if (sessionMode !== 'real') return disabledSession();
    const coordinates = validateMapGeometry(geometry);
    if (coordinates === null || !validDependencies(dependencies)) return disabledSession();
    let approvedEnvelope;
    try {
        approvedEnvelope = createApprovedTileEnvelope(coordinates);
    } catch {
        return disabledSession();
    }
    if (approvedEnvelope === null) return disabledSession();

    let granted = false;
    let disposed = false;
    let generation = 0;
    let running = 0;
    const active = new Set();
    const queue = [];

    function finishQueued() {
        while (queue.length > 0) queue.shift().resolve(null);
    }

    function revoke() {
        granted = false;
        generation += 1;
        finishQueued();
        for (const controller of active) controller.abort();
        active.clear();
    }

    async function execute(job) {
        const controller = new dependencies.AbortController();
        active.add(controller);
        const timeout = dependencies.setTimeout(() => controller.abort(), MAP_LOCATION_TIMEOUT_MS);
        try {
            const response = await dependencies.fetch(job.url, {
                method: 'GET',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                redirect: 'error',
                cache: 'no-store',
                signal: controller.signal
            });
            if (!granted || disposed || generation !== job.generation) return null;
            const contentType = response?.headers?.get?.('content-type');
            if (
                response?.ok !== true
                || response.status !== 200
                || response.redirected === true
                || !/^image\/png(?:;|$)/i.test(contentType || '')
            ) {
                controller.abort();
                return null;
            }
            const blob = await readBoundedPngBlob(response, controller);
            if (!granted || disposed || generation !== job.generation) return null;
            if (!(blob instanceof Blob) || !/^image\/png$/i.test(blob.type)) {
                return null;
            }
            return blob;
        } catch {
            controller.abort();
            return null;
        } finally {
            dependencies.clearTimeout(timeout);
            active.delete(controller);
        }
    }

    function pump() {
        while (running < MAP_LOCATION_MAX_CONCURRENT && queue.length > 0) {
            const job = queue.shift();
            if (!granted || disposed || generation !== job.generation) {
                job.resolve(null);
                continue;
            }
            running += 1;
            execute(job).then(job.resolve).finally(() => {
                running -= 1;
                pump();
            });
        }
    }

    function requestTile(tile) {
        if (!granted || disposed || dependencies.online() !== true) return Promise.resolve(null);
        const url = buildOpenStreetMapTileUrl(tile, approvedEnvelope);
        if (url === null) return Promise.resolve(null);
        return new Promise(resolve => {
            queue.push({ url, generation, resolve });
            pump();
        });
    }

    return Object.freeze({
        enabled: true,
        approvedEnvelope,
        coordinates,
        isGranted: () => granted && !disposed,
        grant: () => {
            if (disposed) return false;
            granted = true;
            return true;
        },
        revoke,
        handlePageHide: () => {
            revoke();
            disposed = true;
        },
        requestTile
    });
}

function createParagraph(documentObject, text) {
    const paragraph = documentObject.createElement('p');
    paragraph.textContent = text;
    return paragraph;
}

function defaultDependencies() {
    return {
        fetch: globalThis.fetch?.bind(globalThis),
        online: () => globalThis.navigator?.onLine !== false,
        AbortController: globalThis.AbortController,
        setTimeout: globalThis.setTimeout?.bind(globalThis),
        clearTimeout: globalThis.clearTimeout?.bind(globalThis)
    };
}

function restrictProviderControl(documentObject, controlId, visible) {
    const select = controlId ? documentObject.getElementById(controlId) : null;
    if (!select) return;
    const option = documentObject.createElement('option');
    option.value = 'osm';
    option.textContent = 'OpenStreetMap (consent required)';
    select.replaceChildren(option);
    select.value = 'osm';
    select.disabled = true;
    select.hidden = !visible;
}

function createFetchGridLayer({
    leaflet,
    session,
    documentObject,
    objectUrls,
    pendingTileFinalizers,
    onFailure
}) {
    if (typeof leaflet?.GridLayer?.extend !== 'function') return null;
    const TileLayer = leaflet.GridLayer.extend({
        createTile(coords, done) {
            const image = documentObject.createElement('img');
            image.alt = '';
            image.decoding = 'async';
            let objectUrl = null;
            let finished = false;
            const release = () => {
                if (objectUrl === null || !objectUrls.delete(objectUrl)) return;
                URL.revokeObjectURL(objectUrl);
            };
            const settleOnRevoke = () => finish(
                new Error('Map tile authorization was revoked.'),
                false
            );
            const finish = (error, notifyFailure = error !== null) => {
                if (finished) return;
                finished = true;
                pendingTileFinalizers.delete(settleOnRevoke);
                if (notifyFailure) {
                    try {
                        onFailure();
                    } catch {
                        // Status rendering must not block Leaflet settlement.
                    }
                }
                try {
                    done?.(error, image);
                } catch {
                    // A consumer callback cannot retain the response object URL.
                } finally {
                    release();
                }
            };
            pendingTileFinalizers.add(settleOnRevoke);
            session.requestTile({ z: coords.z, x: coords.x, y: coords.y }).then(blob => {
                if (finished) return;
                if (blob === null || !session.isGranted()) {
                    finish(new Error('Map tile unavailable.'));
                    return;
                }
                objectUrl = URL.createObjectURL(blob);
                objectUrls.add(objectUrl);
                image.addEventListener('load', () => {
                    finish(session.isGranted() ? null : new Error('Map tile authorization was revoked.'));
                }, { once: true });
                image.addEventListener('error', () => finish(new Error('Map tile unavailable.')), { once: true });
                image.src = objectUrl;
            }, () => finish(new Error('Map tile unavailable.')));
            return image;
        }
    });
    return new TileLayer({
        attribution: '&copy; OpenStreetMap contributors',
        minZoom: 0,
        maxZoom: MAP_LOCATION_MAX_ZOOM,
        noWrap: true,
        bounds: [
            [session.approvedEnvelope.bounds.south, session.approvedEnvelope.bounds.west],
            [session.approvedEnvelope.bounds.north, session.approvedEnvelope.bounds.east]
        ]
    });
}

export function createMapLocationBoundary({
    sessionMode,
    dependencies,
    documentObject = globalThis.document,
    pageTarget = globalThis.window
} = {}) {
    const networkDependencies = sessionMode === 'real'
        ? (dependencies || defaultDependencies())
        : null;
    let state = null;
    let disposed = false;

    function releaseObjectUrls() {
        if (!state) return;
        for (const objectUrl of state.objectUrls) URL.revokeObjectURL(objectUrl);
        state.objectUrls.clear();
    }

    function tearDown({ destroyMap = true } = {}) {
        if (!state) return;
        state.session.revoke();
        for (const settle of [...state.pendingTileFinalizers]) settle();
        state.pendingTileFinalizers.clear();
        releaseObjectUrls();
        if (destroyMap && state.map?.remove) state.map.remove();
        state = null;
    }

    function showConsent() {
        if (!state || disposed) return;
        const { container, aggregate } = state.configuration;
        const disclosure = createParagraph(documentObject, MAP_LOCATION_DISCLOSURE);
        if (aggregate) disclosure.append(documentObject.createTextNode(` ${MAP_LOCATION_AGGREGATE_COPY}`));
        const limitation = createParagraph(documentObject, MAP_LOCATION_CDN_LIMITATION);
        const button = documentObject.createElement('button');
        button.type = 'button';
        button.textContent = MAP_LOCATION_ACTION_LABEL;
        button.addEventListener('click', () => grantAndRender());
        container.replaceChildren(disclosure, limitation, button);
    }

    function drawCurrentOverlay() {
        if (!state?.map || typeof state.configuration.drawOverlay !== 'function') return;
        if (state.overlay?.remove) state.overlay.remove();
        state.overlay = state.configuration.drawOverlay(state.map, state.session.coordinates) || null;
    }

    function grantAndRender() {
        if (!state || disposed || !state.session.grant()) return false;
        const { container, leaflet } = state.configuration;
        if (typeof leaflet?.map !== 'function') {
            state.session.revoke();
            container.replaceChildren(createParagraph(documentObject, 'Map tiles are unavailable.'));
            return false;
        }
        container.replaceChildren();
        const coarseBounds = [
            [state.session.approvedEnvelope.bounds.south, state.session.approvedEnvelope.bounds.west],
            [state.session.approvedEnvelope.bounds.north, state.session.approvedEnvelope.bounds.east]
        ];
        const map = leaflet.map(container, {
            preferCanvas: true,
            minZoom: 0,
            maxZoom: MAP_LOCATION_MAX_ZOOM,
            maxBounds: coarseBounds,
            maxBoundsViscosity: 1
        });
        state.map = map;
        map.setMaxBounds?.(coarseBounds);
        map.fitBounds(coarseBounds, { maxZoom: MAP_LOCATION_MAX_ZOOM, padding: [0, 0] });
        drawCurrentOverlay();

        const status = documentObject.createElement('span');
        status.setAttribute('role', 'status');
        status.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:1000;background:white;padding:4px 7px;border-radius:4px;font-size:12px;';
        const tileLayer = createFetchGridLayer({
            leaflet,
            session: state.session,
            documentObject,
            objectUrls: state.objectUrls,
            pendingTileFinalizers: state.pendingTileFinalizers,
            onFailure: () => { status.textContent = 'Some map tiles are unavailable.'; }
        });
        if (!tileLayer) {
            state.session.revoke();
            map.remove?.();
            state.map = null;
            container.replaceChildren(createParagraph(documentObject, 'Map tiles are unavailable.'));
            return false;
        }
        state.tileLayer = tileLayer;
        tileLayer.addTo(map);
        const revokeButton = documentObject.createElement('button');
        revokeButton.type = 'button';
        revokeButton.textContent = 'Revoke map tiles';
        revokeButton.style.cssText = 'position:absolute;right:8px;top:8px;z-index:1000;';
        revokeButton.addEventListener('click', () => {
            const configuration = state?.configuration;
            tearDown();
            if (configuration) present(configuration);
        });
        container.append(revokeButton, status);
        return true;
    }

    function present(configuration = {}) {
        if (disposed || !configuration.container?.replaceChildren) return Object.freeze({ status: 'unavailable' });
        restrictProviderControl(documentObject, configuration.providerControlId, false);
        if (sessionMode === 'demo') {
            tearDown();
            configuration.container.replaceChildren(createParagraph(
                documentObject,
                'Demo maps stay local. External map tiles are disabled.'
            ));
            return Object.freeze({ status: 'demo' });
        }
        if (sessionMode !== 'real') {
            tearDown();
            configuration.container.replaceChildren(createParagraph(
                documentObject,
                'Map location authorization is unavailable.'
            ));
            return Object.freeze({ status: 'unavailable' });
        }
        const nextSession = createMapTileSession({
            sessionMode,
            geometry: configuration.coordinates,
            dependencies: networkDependencies
        });
        if (!nextSession.enabled) {
            tearDown();
            configuration.container.replaceChildren(createParagraph(
                documentObject,
                configuration.unavailableCopy || 'No local route location is available for this map.'
            ));
            return Object.freeze({ status: 'unavailable' });
        }
        restrictProviderControl(documentObject, configuration.providerControlId, true);
        const nextKey = `${configuration.revisionKey || ''}|${nextSession.approvedEnvelope.geometryKey}`;
        if (state?.key === nextKey && state.session.isGranted() && state.map) {
            state.configuration = configuration;
            drawCurrentOverlay();
            return Object.freeze({ status: 'granted', revoke });
        }
        tearDown();
        state = {
            key: nextKey,
            session: nextSession,
            configuration,
            map: null,
            tileLayer: null,
            overlay: null,
            objectUrls: new Set(),
            pendingTileFinalizers: new Set()
        };
        showConsent();
        return Object.freeze({ status: 'denied', grant: grantAndRender, revoke });
    }

    function revoke() {
        if (!state) return;
        const configuration = state.configuration;
        tearDown();
        if (configuration && !disposed) present(configuration);
    }

    function handlePageHide() {
        pageTarget?.removeEventListener?.('pagehide', handlePageHide);
        if (state) state.session.handlePageHide();
        tearDown();
        disposed = true;
    }

    pageTarget?.addEventListener?.('pagehide', handlePageHide, { once: true });

    return Object.freeze({
        present,
        revoke,
        dispose: handlePageHide
    });
}
