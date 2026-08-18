import {
    createMapLocationBoundary,
    readValidatedCoordinate,
    readValidatedRouteGeometry
} from '../app/map-location-egress.js';

let activeMapRenderCleanup = null;

const MAP_ROUTE_STATUS_COPY = Object.freeze({
    loading: 'Loading local routes…',
    demo: 'Demo maps stay local. External map tiles are disabled.',
    empty: 'No local routes are available for the current filters.',
    failed: 'Local routes could not be loaded. Try the filters again.',
    'limit-exceeded': 'Too many activities to map at once. Narrow the date or sport filters to 5,000 activities or fewer.'
});

function activityRoute(activity) {
    return readValidatedRouteGeometry(activity, null, { allowTopLevelPolyline: true });
}

function activityPoint(activity, key) {
    return readValidatedCoordinate(activity, key);
}

function createMapPopup(activity, { end = false } = {}) {
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${end ? 'End: ' : ''}${activity.name || activity.type || ''}`;
    popup.append(title, document.createElement('br'), document.createTextNode(activity.start_date_local || ''));
    return popup;
}

function routeStatusCopy(result) {
    if (result?.status === 'ready') {
        const routeLabel = result.routeCount === 1 ? 'route' : 'routes';
        const pointLabel = result.pointCount === 1 ? 'point' : 'points';
        return `Local routes ready: ${result.routeCount} ${routeLabel}, ${result.pointCount} ${pointLabel}.`;
    }
    if (result?.status === 'partial') {
        const routeLabel = result.routeCount === 1 ? 'route' : 'routes';
        return `Local routes ready with gaps: ${result.routeCount} ${routeLabel}, ${result.unavailableCount} unavailable, ${result.failedCount} failed.`;
    }
    return MAP_ROUTE_STATUS_COPY[result?.status] || MAP_ROUTE_STATUS_COPY.failed;
}

export function renderMapTab(
    activities = [],
    dateFrom = null,
    dateTo = null,
    { sessionMode, loadCanonicalRoutes = null } = {}
) {
    const container = document.getElementById('map-tab');
    const mapElement = document.getElementById('global-map');
    if (!container || !mapElement) return;

    activeMapRenderCleanup?.();

    const mapBoundary = createMapLocationBoundary({ sessionMode });
    const dateFromInput = document.getElementById('map-date-from');
    const dateToInput = document.getElementById('map-date-to');
    const applyButton = document.getElementById('map-apply-date');
    const resetButton = document.getElementById('map-reset-date');
    const sportSel = document.getElementById('map-sport-filter');
    const viewSelect = document.getElementById('map-visualization');
    const densitySlider = document.getElementById('map-heat-intensity');
    const radiusSlider = document.getElementById('map-heat-radius');
    const blurSlider = document.getElementById('map-heat-blur');
    const colorBySport = document.getElementById('map-color-by-sport');
    let statusElement = document.getElementById('map-route-status');
    if (!statusElement) {
        statusElement = document.createElement('p');
        statusElement.id = 'map-route-status';
        statusElement.setAttribute('role', 'status');
        statusElement.setAttribute('aria-live', 'polite');
        statusElement.dataset.state = 'idle';
        statusElement.textContent = 'Local routes load when this tab opens.';
        mapElement.before(statusElement);
    }
    const listeners = [];
    let disposed = false;
    let loadGeneration = 0;
    let geometryRevision = 0;
    let currentItems = [];

    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        loadGeneration += 1;
        for (const [element, eventName, listener] of listeners) {
            element.removeEventListener(eventName, listener);
        }
        listeners.length = 0;
        mapBoundary.dispose();
    };
    activeMapRenderCleanup = cleanup;

    function listen(element, eventName, listener) {
        if (!element) return;
        element.addEventListener(eventName, listener);
        listeners.push([element, eventName, listener]);
    }

    function setStatus(text, state) {
        if (!statusElement) return;
        statusElement.textContent = text;
        statusElement.dataset.state = state;
    }

    const typeColors = {
        Run: '#e31a1c',
        Ride: '#1f78b4',
        Swim: '#33a02c',
        Walk: '#ff7f00',
        Hike: '#6a3d9a',
        Row: '#b15928',
        Default: '#888'
    };

    const types = [...new Set(activities
        .filter(activity => activity && typeof activity === 'object')
        .map(activity => String(activity.sport_type || activity.type || 'Unknown').trim())
        .filter(Boolean))].sort();
    const allSportsOption = document.createElement('option');
    allSportsOption.value = 'all';
    allSportsOption.textContent = 'All';
    const sportOptions = types.map(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        return option;
    });
    if (sportSel) {
        sportSel.replaceChildren(allSportsOption, ...sportOptions);
        sportSel.value = 'all';
    }
    if (viewSelect) viewSelect.value = 'heat';
    if (densitySlider) densitySlider.value = '1.133';
    if (radiusSlider) radiusSlider.value = '8';
    if (blurSlider) blurSlider.value = '14';
    if (colorBySport) colorBySport.checked = false;
    if (dateFromInput) dateFromInput.value = dateFrom || '';
    if (dateToInput) dateToInput.value = dateTo || '';

    function parseDate(value) {
        if (typeof value !== 'string') return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
    }

    function visibleActivities() {
        const from = parseDate(dateFromInput?.value);
        const to = parseDate(dateToInput?.value);
        return activities.filter(activity => {
            if (!activity || typeof activity !== 'object') return false;
            const sourceDate = typeof activity.start_date_local === 'string'
                ? activity.start_date_local
                : typeof activity.start_date === 'string'
                    ? activity.start_date
                    : null;
            const localDate = sourceDate?.split('T')[0] || null;
            if (from && (!localDate || localDate < from)) return false;
            if (to && (!localDate || localDate > to)) return false;
            const sport = String(activity.sport_type || activity.type || 'Unknown').trim();
            return !sportSel?.value || sportSel.value === 'all' || sport === sportSel.value;
        });
    }

    function buildLegacyItems(visible) {
        return visible.map(activity => {
            const route = activityRoute(activity);
            const start = activityPoint(activity, 'start_latlng') || route[0] || null;
            const explicitEnd = activityPoint(activity, 'end_latlng');
            const end = explicitEnd || route.at(-1) || null;
            return { activity, route, start, end };
        });
    }

    function buildCanonicalItems(visible, routes) {
        return visible.map((activity, index) => {
            const route = routes[index] || [];
            return {
                activity,
                route,
                start: route[0] || null,
                end: route.at(-1) || null
            };
        });
    }

    function presentationCoordinates(items, view) {
        const coordinates = [];
        for (const item of items) {
            if (view === 'heat') {
                if (item.route.length) {
                    for (const point of item.route) coordinates.push(point);
                } else if (item.start) {
                    coordinates.push(item.start);
                }
            } else if (view === 'routes') {
                for (const point of item.route) coordinates.push(point);
            } else {
                if (item.start) coordinates.push(item.start);
                if (item.end) coordinates.push(item.end);
            }
        }
        return coordinates;
    }

    function authorizationCoordinates(items) {
        const coordinates = [];
        for (const item of items) {
            if (item.route.length) {
                for (const point of item.route) coordinates.push(point);
            } else {
                if (item.start) coordinates.push(item.start);
                if (item.end) coordinates.push(item.end);
            }
        }
        return coordinates;
    }

    function presentSnapshot() {
        if (disposed) return;
        const items = sessionMode === 'demo' ? [] : currentItems;
        const view = viewSelect?.value || 'heat';
        const coordinates = presentationCoordinates(items, view);
        const authorizedGeometry = authorizationCoordinates(items);

        mapBoundary.present({
            container: mapElement,
            coordinates: authorizedGeometry,
            revisionKey: String(geometryRevision),
            aggregate: true,
            providerControlId: 'map-tiles',
            leaflet: globalThis.L,
            drawOverlay(map) {
                const group = L.layerGroup().addTo(map);
                if (view === 'heat' && typeof L.heatLayer === 'function') {
                    const factor = Number.parseFloat(densitySlider?.value) || 1.133;
                    const radius = Number.parseInt(radiusSlider?.value, 10) || 8;
                    const blur = Number.parseInt(blurSlider?.value, 10) || 14;
                    const heatPoints = coordinates.map(point => [point[0], point[1], 0.5 * factor]);
                    if (heatPoints.length) L.heatLayer(heatPoints, { radius, blur, maxZoom: 11 }).addTo(group);
                    return group;
                }
                for (const item of items) {
                    const useSportColor = colorBySport ? colorBySport.checked : true;
                    const color = sportSel?.value && sportSel.value !== 'all'
                        ? '#e31a1c'
                        : (useSportColor ? (typeColors[item.activity.type] || typeColors.Default) : '#e31a1c');
                    if (view === 'routes' && item.route.length) {
                        const polyline = L.polyline(item.route, { color, weight: 3, opacity: 0.8, smoothFactor: 1 });
                        polyline.activity = item.activity;
                        polyline.addTo(group);
                    } else if (view === 'points') {
                        if (item.start) {
                            const popup = createMapPopup(item.activity);
                            L.circleMarker(item.start, { radius: 5, color, fillColor: color, fillOpacity: 0.9 })
                                .bindPopup(popup).addTo(group);
                        }
                        if (item.end) {
                            const popup = createMapPopup(item.activity, { end: true });
                            L.circleMarker(item.end, { radius: 5, color, fillColor: color, fillOpacity: 0.9 })
                                .bindPopup(popup).addTo(group);
                        }
                    }
                }
                return group;
            }
        });
    }

    async function reloadRoutes() {
        if (disposed) return;
        const generation = ++loadGeneration;
        const visible = visibleActivities();
        geometryRevision += 1;

        if (sessionMode === 'demo') {
            currentItems = [];
            setStatus(MAP_ROUTE_STATUS_COPY.demo, 'demo');
            presentSnapshot();
            return;
        }

        if (typeof loadCanonicalRoutes !== 'function') {
            currentItems = buildLegacyItems(visible);
            const routeCount = currentItems.filter(item => item.route.length > 0).length;
            const pointCount = authorizationCoordinates(currentItems).length;
            setStatus(
                pointCount > 0
                    ? `Map data ready: ${routeCount} ${routeCount === 1 ? 'route' : 'routes'}, ${pointCount} ${pointCount === 1 ? 'point' : 'points'}.`
                    : MAP_ROUTE_STATUS_COPY.empty,
                pointCount > 0 ? 'ready' : 'empty'
            );
            presentSnapshot();
            return;
        }

        currentItems = [];
        setStatus(MAP_ROUTE_STATUS_COPY.loading, 'loading');
        mapBoundary.present({
            container: mapElement,
            coordinates: [],
            revisionKey: String(geometryRevision),
            aggregate: true,
            providerControlId: 'map-tiles',
            unavailableCopy: MAP_ROUTE_STATUS_COPY.loading
        });

        let result;
        try {
            result = await loadCanonicalRoutes(visible.map(activity => activity.id));
        } catch {
            result = null;
        }
        if (disposed || generation !== loadGeneration || result?.status === 'superseded') return;

        currentItems = buildCanonicalItems(visible, result?.routes || []);
        setStatus(routeStatusCopy(result), result?.status || 'failed');
        presentSnapshot();
    }

    listen(applyButton, 'click', reloadRoutes);
    listen(resetButton, 'click', () => {
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (sportSel) sportSel.value = 'all';
        if (viewSelect) viewSelect.value = 'heat';
        if (densitySlider) densitySlider.value = '1.133';
        if (radiusSlider) radiusSlider.value = '8';
        if (blurSlider) blurSlider.value = '14';
        if (colorBySport) colorBySport.checked = false;
        reloadRoutes();
    });
    listen(sportSel, 'change', reloadRoutes);
    listen(viewSelect, 'change', presentSnapshot);
    listen(densitySlider, 'input', presentSnapshot);
    listen(radiusSlider, 'input', presentSnapshot);
    listen(blurSlider, 'input', presentSnapshot);
    listen(colorBySport, 'change', presentSnapshot);
    void reloadRoutes();
    return cleanup;
}

export default { renderMapTab };
