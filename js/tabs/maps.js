import {
    createMapLocationBoundary,
    readValidatedCoordinate,
    readValidatedRouteGeometry
} from '../app/map-location-egress.js';

let activeMapBoundary = null;

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

export function renderMapTab(activities = [], dateFrom = null, dateTo = null, { sessionMode } = {}) {
    const container = document.getElementById('map-tab');
    const mapElement = document.getElementById('global-map');
    if (!container || !mapElement) return;

    activeMapBoundary?.dispose();
    activeMapBoundary = createMapLocationBoundary({ sessionMode });

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
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
    }

    function visibleActivities() {
        const from = parseDate(dateFromInput?.value);
        const to = parseDate(dateToInput?.value);
        return activities.filter(activity => {
            if (!activity || typeof activity !== 'object') return false;
            const localDate = typeof activity.start_date_local === 'string'
                ? activity.start_date_local.split('T')[0]
                : null;
            if (from && localDate && localDate < from) return false;
            if (to && localDate && localDate > to) return false;
            const sport = String(activity.sport_type || activity.type || 'Unknown').trim();
            return !sportSel?.value || sportSel.value === 'all' || sport === sportSel.value;
        });
    }

    function buildItems() {
        return visibleActivities().map(activity => {
            const route = activityRoute(activity);
            const start = activityPoint(activity, 'start_latlng');
            const explicitEnd = activityPoint(activity, 'end_latlng');
            const end = explicitEnd || route.at(-1) || null;
            return { activity, route, start, end };
        });
    }

    function render() {
        const items = sessionMode === 'demo' ? [] : buildItems();
        const view = viewSelect?.value || 'heat';
        const coordinates = [];
        for (const item of items) {
            if (view === 'heat') {
                if (item.route.length) {
                    for (const point of item.route) coordinates.push(point);
                }
                else if (item.start) coordinates.push(item.start);
            } else if (view === 'routes' && item.route.length) {
                for (const point of item.route) coordinates.push(point);
            } else {
                if (item.start) coordinates.push(item.start);
                if (item.end) coordinates.push(item.end);
            }
        }

        const revisionKey = [
            dateFromInput?.value || '',
            dateToInput?.value || '',
            sportSel?.value || 'all',
            view
        ].join('|');

        activeMapBoundary.present({
            container: mapElement,
            coordinates,
            revisionKey,
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
                    } else {
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

    applyButton?.addEventListener('click', render);
    resetButton?.addEventListener('click', () => {
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (sportSel) sportSel.value = 'all';
        if (viewSelect) viewSelect.value = 'heat';
        if (densitySlider) densitySlider.value = '1.133';
        if (radiusSlider) radiusSlider.value = '8';
        if (blurSlider) blurSlider.value = '14';
        if (colorBySport) colorBySport.checked = false;
        render();
    });
    sportSel?.addEventListener('change', render);
    viewSelect?.addEventListener('change', render);
    densitySlider?.addEventListener('input', render);
    radiusSlider?.addEventListener('input', render);
    blurSlider?.addEventListener('input', render);
    colorBySport?.addEventListener('change', render);
    render();
}

export default { renderMapTab };
