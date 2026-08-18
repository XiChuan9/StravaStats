// js/gear-analysis.js — Individual Gear Detail Page

import { formatPace, formatTime, formatDate, formatSpeedBike } from '../../shared/utils/index.js';
import { getCachedActivities } from '../../services/activity-cache.js';
import { readValidatedCoordinate, readValidatedRouteGeometry } from '../../app/map-location-egress.js';

// ===================================================================
// HELPERS
// ===================================================================

function getDefaultValues(type) {
    const defaults = { bike: { price: 1000, durationKm: 15000 }, shoe: { price: 120, durationKm: 700 }, unknown: { price: 100, durationKm: 1000 } };
    return defaults[type] || defaults.unknown;
}
function getCustomData(gearId) { return JSON.parse(localStorage.getItem(`gear-custom-${gearId}`) || '{}'); }
function saveCustomData(gearId, data) { localStorage.setItem(`gear-custom-${gearId}`, JSON.stringify(data)); }

// Simple stat cell (neutral card, no colors)
function statCell(value, label) {
    return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.9rem 0.75rem;text-align:center;">
        <div style="font-size:1.25rem;font-weight:700;color:#0f172a;line-height:1.2;">${value}</div>
        <div style="font-size:0.7rem;color:#64748b;margin-top:0.25rem;text-transform:uppercase;letter-spacing:0.4px;">${label}</div>
    </div>`;
}

function statRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:0.85rem;">${label}</span>
        <span style="font-weight:600;font-size:0.85rem;color:#1e293b;">${value}</span>
    </div>`;
}

function styledElement(tagName, cssText, text = null) {
    const element = document.createElement(tagName);
    if (cssText) element.style.cssText = cssText;
    if (text !== null) element.textContent = text;
    return element;
}

function createStatCellNode(value, label) {
    const cell = styledElement('div', 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.9rem 0.75rem;text-align:center;');
    const valueNode = styledElement('div', 'font-size:1.25rem;font-weight:700;color:#0f172a;line-height:1.2;');
    if (value instanceof Node) valueNode.append(value);
    else valueNode.textContent = value;
    const labelNode = styledElement('div', 'font-size:0.7rem;color:#64748b;margin-top:0.25rem;text-transform:uppercase;letter-spacing:0.4px;', label);
    cell.append(valueNode, labelNode);
    return cell;
}

// ===================================================================
// MAIN ENTRY POINT
// ===================================================================

export async function renderGearDetailPage(gearId, { sessionMode, mapLocationBoundary } = {}) {
    if (sessionMode === 'demo') {
        const message = styledElement('div', 'padding:2rem;text-align:center;', 'Demo gear maps stay local. Real gear data was not read.');
        document.body.replaceChildren(message);
        return;
    }
    const activityCache = await getCachedActivities();
    const allActivities = activityCache?.activities || [];
    const allGears = JSON.parse(localStorage.getItem('strava_gears') || '[]');
    const gear = allGears.find(g => g.id === gearId);

    if (!gear) {
        const notFound = styledElement('div', 'padding:2rem;text-align:center;');
        const heading = document.createElement('h2');
        heading.textContent = 'Gear not found';
        const message = styledElement('p', 'color:#64748b;', `ID "${gearId}" not in local cache.`);
        const back = styledElement('button', 'margin-top:1rem;padding:8px 16px;border:1px solid #ddd;border-radius:6px;cursor:pointer;', '← Back');
        back.addEventListener('click', () => window.history.back());
        notFound.append(heading, message, back);
        document.body.replaceChildren(notFound);
        return;
    }

    gear.type = ('frame_type' in gear || 'weight' in gear) ? 'bike' : 'shoe';

    const gearActivities = allActivities
        .filter(a => a.gear_id === gearId)
        .sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));

    renderGearHero(gear, gearActivities);
    renderGearHealth(gear, gearActivities);
    renderGearStats(gearActivities, gear.type);
    renderGearAdvanced(gear, gearActivities);
    renderGearMap(gearActivities, mapLocationBoundary);
    renderGearUsageChart(gearActivities);
    renderGearPaceEvolutionChart(gearActivities, gear.type);
    renderGearCumulativeElevationChart(gearActivities);
    renderGearActivitiesList(gearActivities, gear.type);
}

// ===================================================================
// HERO SECTION
// ===================================================================

function renderGearHero(gear, activities) {
    const container = document.getElementById('gear-hero');
    if (!container) return;

    const totalKm = activities.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
    const totalHours = activities.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600;
    const avgPaceSec = totalKm > 0 ? (totalHours * 3600) / totalKm : 0;

    const frameTypes = { 1: 'Mountain Bike', 2: 'Cyclocross', 3: 'Road', 4: 'Time Trial', 5: 'Gravel' };
    const trailRatio = activities.length
        ? activities.filter(a => a.type === 'TrailRun' || a.sport_type === 'TrailRun').length / activities.length : 0;
    const gearSubtype = gear.type === 'bike'
        ? (frameTypes[gear.frame_type] || 'Bike')
        : (trailRatio > 0.3 ? 'Trail Running Shoe' : 'Road Running Shoe');

    const meta = [
        gear.brand_name, gear.model_name,
        gear.type === 'bike' && gear.weight ? `${(gear.weight / 1000).toFixed(2)} kg` : null
    ].filter(Boolean).join(' · ');

    const hero = styledElement('div', 'background:white;border:1px solid #e2e8f0;border-radius:14px;padding:1.75rem;margin-bottom:1.5rem;display:flex;gap:1.5rem;align-items:flex-start;flex-wrap:wrap;');
    const icon = styledElement('div', 'font-size:3.5rem;width:72px;height:72px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;', gear.type === 'bike' ? '🚴' : '👟');
    const content = styledElement('div', 'flex:1;min-width:180px;');
    const titleRow = styledElement('div', 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.3rem;');
    const heading = styledElement('h2', 'margin:0;font-size:1.45rem;font-weight:700;color:#0f172a;', gear.name || [gear.brand_name, gear.model_name].filter(Boolean).join(' ') || 'Unnamed Gear');
    titleRow.append(heading);
    const appendBadge = (text, background, color) => {
        titleRow.append(styledElement('span', `display:inline-block;padding:0.2rem 0.6rem;border-radius:999px;font-size:0.7rem;font-weight:700;background:${background};color:${color};text-transform:uppercase;letter-spacing:0.5px;`, text));
    };
    if (gear.primary) appendBadge('Primary', '#fef3c7', '#92400e');
    if (gear.retired) appendBadge('Retired', '#fee2e2', '#991b1b');
    const metadata = styledElement('p', 'margin:0 0 1.25rem;color:#64748b;font-size:0.875rem;', `${gearSubtype}${meta ? ' · ' + meta : ''}`);
    const stats = styledElement('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.6rem;');
    stats.append(
        createStatCellNode(totalKm.toFixed(0) + ' km', 'Total Distance'),
        createStatCellNode(activities.length, 'Activities'),
        createStatCellNode(totalHours.toFixed(1) + ' h', 'Total Time')
    );
    if (avgPaceSec > 0 && gear.type !== 'bike') stats.append(createStatCellNode(formatPace(avgPaceSec, 1), 'Avg Pace'));
    if (avgPaceSec > 0 && gear.type === 'bike') stats.append(createStatCellNode(formatSpeedBike(totalKm / totalHours), 'Avg Speed'));
    content.append(titleRow, metadata, stats);
    hero.append(icon, content);
    container.replaceChildren(hero);
}

// ===================================================================
// GEAR HEALTH
// ===================================================================

function renderGearHealth(gear, activities) {
    const container = document.getElementById('gear-health-content');
    if (!container) return;

    if (!activities.length) {
        container.innerHTML = '<p style="color:#64748b;">No activities to assess gear health.</p>';
        return;
    }

    const redraw = () => {
        const custom = getCustomData(gear.id);
        const def = getDefaultValues(gear.type || 'unknown');
        const durationKm = custom.durationKm ?? def.durationKm;
        const price = custom.price ?? def.price;
        const totalKm = activities.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
        const pct = Math.min((totalKm / durationKm) * 100, 100);
        const remainingKm = Math.max(0, durationKm - totalKm);
        const euroPerKm = (price > 0 && totalKm > 0) ? (price / totalKm).toFixed(2) : '-';

        const dates = activities.map(a => new Date(a.start_date_local));
        const firstUse = new Date(Math.min(...dates));
        const lastUse = new Date(Math.max(...dates));
        const weeksUsed = Math.max(1, (lastUse - firstUse) / (1000 * 60 * 60 * 24 * 7));
        const weeklyKm = totalKm / weeksUsed;
        const weeksLeft = weeklyKm > 0 ? Math.round(remainingKm / weeklyKm) : null;
        const estDate = weeksLeft != null ? (() => { const d = new Date(); d.setDate(d.getDate() + weeksLeft * 7); return formatDate(d); })() : null;

        const barColor = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e';

        const grid = styledElement('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;margin-bottom:1.25rem;');
        const percent = styledElement('span', `color:${barColor};`, `${pct.toFixed(0)}%`);
        grid.append(
            createStatCellNode(percent, 'Durability Used'),
            createStatCellNode(remainingKm.toFixed(0) + ' km', 'Remaining'),
            createStatCellNode(weeklyKm.toFixed(1) + ' km', 'Weekly Avg')
        );
        if (weeksLeft != null) {
            const estimate = document.createElement('span');
            estimate.append(
                styledElement('span', 'font-size:0.9rem;', estDate),
                document.createElement('br'),
                styledElement('small', 'color:#64748b;', `~${weeksLeft} wks`)
            );
            grid.append(createStatCellNode(estimate, 'Est. End'));
        }
        grid.append(createStatCellNode(euroPerKm + ' €', '€ / km'));

        const progress = styledElement('div', 'height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-bottom:0.5rem;');
        const progressFill = styledElement('div', `width:${pct}%;height:100%;background:${barColor};border-radius:999px;transition:width 0.6s;`);
        progress.append(progressFill);
        const usage = styledElement('div', 'display:flex;justify-content:space-between;font-size:0.8rem;color:#64748b;margin-bottom:1rem;');
        usage.append(
            styledElement('span', '', `${totalKm.toFixed(0)} km used`),
            styledElement('span', '', `${durationKm} km lifespan`)
        );

        const details = document.createElement('details');
        const summary = styledElement('summary', 'cursor:pointer;font-size:0.85rem;color:#64748b;padding:0.25rem 0;user-select:none;', '✏️ Edit lifespan & price');
        const controls = styledElement('div', 'margin-top:0.75rem;display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;');
        const makeInput = (labelText, id, value, min, step = null) => {
            const wrapper = document.createElement('div');
            const label = styledElement('label', 'display:block;font-size:0.8rem;color:#64748b;margin-bottom:0.25rem;', labelText);
            const input = styledElement('input', 'width:110px;padding:0.4rem 0.6rem;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9rem;');
            input.type = 'number';
            input.id = id;
            input.value = value;
            input.min = min;
            if (step !== null) input.step = step;
            wrapper.append(label, input);
            return { wrapper, input };
        };
        const priceControl = makeInput('Price (€)', `hp-${gear.id}`, price, '0', '0.01');
        const durationControl = makeInput('Lifespan (km)', `hd-${gear.id}`, durationKm, '1');
        const save = styledElement('button', 'padding:0.45rem 1rem;background:#0f172a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;', 'Save');
        save.id = `hs-${gear.id}`;
        controls.append(priceControl.wrapper, durationControl.wrapper, save);
        details.append(summary, controls);
        container.replaceChildren(grid, progress, usage, details);

        save.addEventListener('click', () => {
            const p = parseFloat(priceControl.input.value);
            const d = parseInt(durationControl.input.value, 10);
            if (isNaN(p) || isNaN(d) || p < 0 || d <= 0) return;
            saveCustomData(gear.id, { price: p, durationKm: d });
            redraw();
        });
    };
    redraw();
}

// ===================================================================
// STATISTICS GRID
// ===================================================================

function renderGearStats(activities, gearType) {
    const container = document.getElementById('gear-stats-content');
    if (!container) return;

    if (!activities.length) {
        container.innerHTML = '<p style="color:#64748b;">No activities yet.</p>';
        return;
    }

    const totalKm = activities.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
    const totalHours = activities.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600;
    const totalElev = activities.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
    const avgKm = totalKm / activities.length;
    const avgElev = totalElev / activities.length;
    const avgPaceSec = totalKm > 0 ? (totalHours * 3600) / totalKm : 0;

    const dates = activities.map(a => new Date(a.start_date_local));
    const firstUse = new Date(Math.min(...dates));
    const lastUse = new Date(Math.max(...dates));
    const daysSpan = Math.max(1, Math.ceil((lastUse - firstUse) / 86400000));
    const weeksSpan = Math.max(1, daysSpan / 7);

    const avgSpeedKmh = totalHours > 0 ? (totalKm / totalHours) : 0;
    const effortMetric = gearType === 'bike'
        ? statCell(formatSpeedBike(avgSpeedKmh), 'Avg Speed')
        : statCell(formatPace(avgPaceSec, 1), 'Avg Pace');

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.65rem;">
            ${statCell(activities.length, 'Activities')}
            ${statCell(totalKm.toFixed(0) + ' km', 'Total Distance')}
            ${statCell(totalHours.toFixed(1) + ' h', 'Total Time')}
            ${statCell(totalElev.toFixed(0) + ' m', 'Total Elevation')}
            ${statCell(avgKm.toFixed(1) + ' km', 'Avg Distance')}
            ${statCell(avgElev.toFixed(0) + ' m', 'Avg Elevation')}
            ${effortMetric}
            ${statCell((totalKm / weeksSpan).toFixed(1) + ' km', 'km / week')}
            ${statCell(formatDate(firstUse), 'First Use')}
            ${statCell(formatDate(lastUse), 'Last Use')}
            ${statCell(daysSpan + ' days', 'Active Span')}
        </div>
    `;
}

// ===================================================================
// PATTERNS & RECORDS
// ===================================================================

function renderGearAdvanced(gear, activities) {
    const container = document.getElementById('gear-advanced-content');
    if (!container) return;

    if (!activities.length) {
        container.innerHTML = '<p style="color:#64748b;">No activities yet.</p>';
        return;
    }

    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayCounts = activities.reduce((acc, a) => { const d = new Date(a.start_date_local).getDay(); acc[d] = (acc[d] || 0) + 1; return acc; }, {});
    const mostUsedDay = weekdayNames[+Object.keys(weekdayCounts).reduce((a, b) => weekdayCounts[a] > weekdayCounts[b] ? a : b)];

    const hourCounts = activities.reduce((acc, a) => { const h = new Date(a.start_date_local).getHours(); acc[h] = (acc[h] || 0) + 1; return acc; }, {});
    const peakHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);

    const bestKm = Math.max(...activities.map(a => a.distance / 1000));
    const paced = activities.filter(a => a.distance > 0 && a.moving_time > 0);
    const bestPaceSec = paced.length ? Math.min(...paced.map(a => a.moving_time / (a.distance / 1000))) : 0;
    const bestClimb = Math.max(...activities.map(a => a.total_elevation_gain || 0));
    const activitiesWithElev = activities.filter(a => a.total_elevation_gain > 0);

    const withHR = activities.filter(a => a.average_heartrate > 0);
    const hrSection = withHR.length ? `
        <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #f1f5f9;">
            <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 0.6rem;">Heart Rate</p>
            ${statRow('Avg HR', (withHR.reduce((s, a) => s + a.average_heartrate, 0) / withHR.length).toFixed(0) + ' bpm')}
            ${statRow('Max HR recorded', Math.max(...withHR.map(a => a.max_heartrate || 0)) + ' bpm')}
            ${statRow('HR data coverage', withHR.length + '/' + activities.length)}
        </div>` : '';

    const speedSection = gear.type === 'bike' ? (() => {
        const ws = activities.filter(a => a.average_speed > 0);
        if (!ws.length) return '';
        const avgSpd = ws.reduce((s, a) => s + a.average_speed, 0) / ws.length * 3.6;
        const maxSpd = Math.max(...ws.map(a => (a.max_speed || 0) * 3.6));
        return `
            <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #f1f5f9;">
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 0.6rem;">Speed</p>
                ${statRow('Avg Speed', formatSpeedBike(avgSpd))}
                ${statRow('Max Speed', formatSpeedBike(maxSpd))}
            </div>`;
    })() : '';

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
            <div>
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 0.6rem;">Usage Patterns</p>
                ${statRow('Favourite day', mostUsedDay)}
                ${statRow('Peak hour', peakHour + ':00')}
                ${statRow('Activities with elev.', activitiesWithElev.length + '/' + activities.length)}
            </div>
            <div>
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 0.6rem;">Personal Bests</p>
                ${statRow('Longest activity', bestKm.toFixed(1) + ' km')}
                ${gear.type !== 'bike' && bestPaceSec > 0 ? statRow('Best pace', formatPace(bestPaceSec, 1)) : ''}
                ${statRow('Biggest climb', bestClimb.toFixed(0) + ' m')}
            </div>
        </div>
        ${hrSection}
        ${speedSection}
    `;
}

// ===================================================================
// MAP
// ===================================================================

function renderGearMap(activities, mapLocationBoundary) {
    const mapContainer = document.getElementById('gear-map');
    if (!mapContainer) return;
    const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
    const items = activities.map((act, index) => {
        const route = readValidatedRouteGeometry(act, null);
        const start = readValidatedCoordinate(act, 'start_latlng');
        return { act, index, route, start };
    });
    const coordinates = [];
    for (const item of items) {
        if (item.route.length) {
            for (const point of item.route) coordinates.push(point);
        }
        else if (item.start) coordinates.push(item.start);
    }

    mapLocationBoundary?.present({
        container: mapContainer,
        coordinates,
        revisionKey: 'gear-aggregate',
        aggregate: true,
        leaflet: globalThis.L,
        unavailableCopy: 'No local route location is available for this gear.',
        drawOverlay(map) {
            const group = L.layerGroup().addTo(map);
            for (const { act, index, route, start } of items) {
                const color = palette[index % palette.length];
                if (route.length) {
                    const tooltip = document.createElement('span');
                    tooltip.textContent = `${act.name || 'Activity'} · ${(act.distance / 1000).toFixed(1)} km`;
                    L.polyline(route, { color, weight: 2.5, opacity: 0.7 })
                        .bindTooltip(tooltip)
                        .addTo(group);
                } else if (start) {
                    const tooltip = document.createElement('span');
                    tooltip.textContent = act.name || 'Activity';
                    L.circleMarker(start, { radius: 5, color, fillOpacity: 0.8 })
                        .bindTooltip(tooltip)
                        .addTo(group);
                }
            }
            return group;
        }
    });

}

// ===================================================================
// USAGE CHART (monthly bar + cumulative line)
// ===================================================================

function renderGearUsageChart(activities) {
    const ctx = document.getElementById('gear-usage-chart');
    if (!ctx || !activities.length) return;

    const monthly = activities.reduce((acc, a) => {
        const m = a.start_date_local.substring(0, 7);
        if (!acc[m]) acc[m] = { distance: 0, count: 0 };
        acc[m].distance += a.distance / 1000;
        acc[m].count++;
        return acc;
    }, {});

    const labels = Object.keys(monthly).sort();
    const distData = labels.map(m => +monthly[m].distance.toFixed(1));
    const countData = labels.map(m => monthly[m].count);
    let cum = 0;
    const cumData = distData.map(d => +(cum += d).toFixed(1));

    ctx.parentElement.style.height = '260px';
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { type: 'line', label: 'Cumulative km', data: cumData, borderColor: '#6366f1', backgroundColor: 'transparent', yAxisID: 'y', tension: 0.4, borderDash: [5, 5], pointRadius: 2, order: 1 },
                { type: 'bar', label: 'Monthly km', data: distData, backgroundColor: 'rgba(99,102,241,0.55)', yAxisID: 'y', order: 2 },
                { type: 'line', label: 'Activities', data: countData, borderColor: '#f59e0b', backgroundColor: 'transparent', yAxisID: 'y1', tension: 0.4, pointRadius: 3, order: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { position: 'left', beginAtZero: true, title: { display: true, text: 'km' } },
                y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Activities' }, grid: { drawOnChartArea: false } }
            },
            plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false } }
        }
    });
}

// ===================================================================
// PACE / SPEED EVOLUTION (with rolling average)
// ===================================================================

function renderGearPaceEvolutionChart(activities, gearType) {
    const ctx = document.getElementById('gear-pace-chart');
    if (!ctx || !activities.length) return;
    ctx.parentElement.style.height = '220px';

    const sorted = [...activities].filter(a => a.distance > 0 && a.moving_time > 0)
        .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));
    if (!sorted.length) return;

    const isBike = gearType === 'bike';
    const labels = sorted.map(a => formatDate(new Date(a.start_date_local)));
    const values = isBike
        ? sorted.map(a => +((a.distance / 1000) / (a.moving_time / 3600)).toFixed(2))
        : sorted.map(a => +((a.moving_time / 60) / (a.distance / 1000)).toFixed(2));

    const winSize = 5;
    const rolling = values.map((_, i) => {
        const sl = values.slice(Math.max(0, i - winSize + 1), i + 1);
        return +(sl.reduce((a, b) => a + b, 0) / sl.length).toFixed(2);
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: isBike ? 'Speed (km/h)' : 'Pace (min/km)', data: values, borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 2, borderWidth: 1.5 },
                { label: winSize + '-act avg', data: rolling, borderColor: '#6366f1', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 2.5 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { reverse: !isBike, title: { display: true, text: isBike ? 'km/h' : 'min/km' } },
                x: { ticks: { maxTicksLimit: 10 } }
            },
            plugins: { legend: { display: true, position: 'top' } }
        }
    });
}

// ===================================================================
// CUMULATIVE ELEVATION
// ===================================================================

function renderGearCumulativeElevationChart(activities) {
    const ctx = document.getElementById('gear-elevation-chart');
    if (!ctx || !activities.length) return;
    ctx.parentElement.style.height = '220px';

    const sorted = [...activities].filter(a => a.total_elevation_gain != null)
        .sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));
    if (!sorted.length) return;

    const labels = sorted.map(a => formatDate(new Date(a.start_date_local)));
    let cum = 0;
    const data = sorted.map(a => (cum += (a.total_elevation_gain || 0)));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Cumulative Elevation (m)', data, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3, pointRadius: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'm' }, beginAtZero: true },
                x: { ticks: { maxTicksLimit: 10 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ===================================================================
// ACTIVITIES LIST
// ===================================================================

function renderGearActivitiesList(activities, gearType) {
    const container = document.getElementById('gear-activities-list');
    if (!container) return;

    if (!activities.length) {
        container.innerHTML = '<p style="color:#64748b;">No activities with this gear.</p>';
        return;
    }

    const typeIcon = t => ({ Run: '🏃', TrailRun: '🏔️', VirtualRun: '🖥️', Ride: '🚴', VirtualRide: '💻', GravelRide: '🪨', MountainBikeRide: '⛰️', Walk: '🚶', Hike: '🥾', Swim: '🏊' }[t] || '🏅');

    const summary = styledElement('p', 'font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;', `${activities.length} activities`);
    const rows = activities.map(a => {
        const km = (a.distance / 1000).toFixed(1);
        const time = formatTime(a.moving_time);
        const pace = a.distance > 0 ? formatPace((a.moving_time || 0), (a.distance || 0) / 1000) : '—';
        const speed = (a.moving_time > 0 && a.distance > 0)
            ? `${(((a.distance || 0) / 1000) / ((a.moving_time || 0) / 3600)).toFixed(1)} km/h`
            : '—';
        const effortValue = gearType === 'bike' ? speed : pace;
        const type = a.sport_type || a.type || '';
        const row = styledElement('div', 'display:flex;align-items:center;gap:0.75rem;padding:0.7rem 0.9rem;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;background:white;transition:background 0.15s;margin-bottom:0.4rem;');
        row.addEventListener('mouseenter', () => { row.style.background = '#f8fafc'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'white'; });
        row.addEventListener('click', () => {
            const params = new URLSearchParams();
            params.set('id', String(a.id));
            const url = new URL(window.location.href);
            url.pathname = '/html/activity-router.html';
            url.search = params.toString();
            url.hash = '';
            const opened = window.open(url.href, '_blank', 'noopener,noreferrer');
            if (opened) opened.opener = null;
        });

        const icon = styledElement('span', 'font-size:1.3rem;width:24px;text-align:center;flex-shrink:0;', typeIcon(type));
        const identity = styledElement('div', 'flex:1;min-width:0;');
        const name = styledElement('div', 'font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#0f172a;', a.name || 'Unnamed Activity');
        if (a.achievement_count > 0) {
            name.append(styledElement('span', 'font-size:0.75rem;color:#f59e0b;margin-left:0.25rem;', `🏆${a.achievement_count}`));
        }
        identity.append(name, styledElement('div', 'font-size:0.75rem;color:#94a3b8;', formatDate(new Date(a.start_date_local))));
        const metrics = styledElement('div', 'display:flex;gap:0.9rem;font-size:0.85rem;font-weight:500;color:#374151;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;');
        for (const value of [`${km} km`, time, effortValue]) metrics.append(styledElement('span', '', value));
        if (a.total_elevation_gain > 0) metrics.append(styledElement('span', 'color:#64748b;', `↑${a.total_elevation_gain.toFixed(0)} m`));
        if (a.average_heartrate) metrics.append(styledElement('span', 'color:#ef4444;', `♥ ${Math.round(a.average_heartrate)}`));
        row.append(icon, identity, metrics);
        return row;
    });

    container.replaceChildren(summary, ...rows);
}
