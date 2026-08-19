// js/gear.js — Gear Tab (overview of all gear)
// Individual gear detail page logic lives in gear-analysis.js

import { formatDistance, formatPace, formatTime, formatDate } from './utils.js';

// ===================================================================
// SHARED UTILITIES (exported for use by gear-analysis.js etc.)
// ===================================================================

export function getDefaultValues(type) {
    const defaults = {
        bike: { price: 1000, durationKm: 15000 },
        shoe: { price: 120, durationKm: 700 },
        unknown: { price: 100, durationKm: 1000 }
    };
    return defaults[type] || defaults.unknown;
}

export function getCustomData(gearId) {
    return JSON.parse(localStorage.getItem(`gear-custom-${gearId}`) || '{}');
}

export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===================================================================
// MODULE STATE
// ===================================================================

let gearChartInstance = null;
let gearGanttChartInstance = null;

// ===================================================================
// INTERNAL HELPERS
// ===================================================================

const EMPTY_GEAR_RENDER_SNAPSHOT = Object.freeze([]);

function createGearRenderSnapshot(gears) {
    try {
        if (
            !Array.isArray(gears)
            || Object.getPrototypeOf(gears) !== Array.prototype
        ) {
            return EMPTY_GEAR_RENDER_SNAPSHOT;
        }

        const keys = Reflect.ownKeys(gears);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(gears, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
            || lengthDescriptor.enumerable !== false
            || lengthDescriptor.configurable !== false
            || keys.length !== lengthDescriptor.value + 1
            || keys.some(key => typeof key !== 'string')
        ) {
            return EMPTY_GEAR_RENDER_SNAPSHOT;
        }

        const keySet = new Set(keys);
        if (!keySet.has('length')) return EMPTY_GEAR_RENDER_SNAPSHOT;

        const snapshot = [];
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const key = String(index);
            if (!keySet.has(key)) return EMPTY_GEAR_RENDER_SNAPSHOT;
            const descriptor = Object.getOwnPropertyDescriptor(gears, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return EMPTY_GEAR_RENDER_SNAPSHOT;
            }
            Object.defineProperty(snapshot, key, {
                value: descriptor.value,
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return Object.freeze(snapshot);
    } catch {
        return EMPTY_GEAR_RENDER_SNAPSHOT;
    }
}

function bikeFrameTypeLabel(frameType) {
    const map = { 1: 'MTB', 2: 'Cross', 3: 'Road', 4: 'Time Trial', 5: 'Gravel' };
    return map[frameType] || null;
}

function classifyShoeType(runs) {
    if (!runs || runs.length === 0) return 'Running Shoe';
    const trailCount = runs.filter(r => r.type === 'TrailRun' || r.sport_type === 'TrailRun').length;
    return (trailCount / runs.length) > 0.3 ? 'Trail Running Shoe' : 'Road Running Shoe';
}

function sortGearData(data, sortKey = 'lastUse') {
    return [...data].sort((a, b) => {
        if (sortKey === 'km') return (b.gear.distance || 0) - (a.gear.distance || 0);
        if (sortKey === 'health') {
            const health = item => {
                const custom = getCustomData(item.gear.id);
                const def = getDefaultValues(item.gear.type || 'unknown');
                return ((item.gear.distance || 0) / 1000) / (custom.durationKm ?? def.durationKm) * 100;
            };
            return health(b) - health(a);
        }
        if (sortKey === 'name') return (a.gear.name || '').localeCompare(b.gear.name || '');
        // default: lastUse
        const dateA = a.metrics.lastUse ? new Date(a.metrics.lastUse) : new Date(0);
        const dateB = b.metrics.lastUse ? new Date(b.metrics.lastUse) : new Date(0);
        return dateB - dateA;
    });
}

// ===================================================================
// GEAR METRICS CALCULATION
// ===================================================================

function calculateGearMetrics(runs) {
    const gearMetrics = new Map();

    runs.forEach(run => {
        const gearId = run.gear_id;
        if (!gearId?.trim()) return;

        if (!gearMetrics.has(gearId)) {
            gearMetrics.set(gearId, {
                numUses: 0,
                firstUse: new Date(run.start_date_local),
                lastUse: new Date(run.start_date_local),
                totalDistance: 0,
                totalMovingTime: 0,
                totalElevationGain: 0,
                trailRunCount: 0,
                runs: []
            });
        }

        const metrics = gearMetrics.get(gearId);
        metrics.numUses++;
        metrics.totalDistance += run.distance || 0;
        metrics.totalMovingTime += run.moving_time || 0;
        metrics.totalElevationGain += run.total_elevation_gain || 0;
        if (run.type === 'TrailRun' || run.sport_type === 'TrailRun') metrics.trailRunCount++;

        const runDate = new Date(run.start_date_local);
        if (runDate < metrics.firstUse) metrics.firstUse = runDate;
        if (runDate > metrics.lastUse) metrics.lastUse = runDate;
        metrics.runs.push(run);
    });

    gearMetrics.forEach(metrics => {
        metrics.avgDistancePerUse = metrics.numUses > 0 ? metrics.totalDistance / metrics.numUses : 0;
        metrics.avgPace = (metrics.totalMovingTime > 0 && metrics.totalDistance > 0)
            ? metrics.totalMovingTime / (metrics.totalDistance / 1000) : 0;
        metrics.avgElevationGainPerUse = metrics.numUses > 0 ? metrics.totalElevationGain / metrics.numUses : 0;
        metrics.numRuns = metrics.runs.length;
    });

    return gearMetrics;
}

// ===================================================================
// VALIDATION & STATE MANAGEMENT
// ===================================================================

function validateElements(elements) {
    const required = ['section', 'list', 'chartContainer', 'chartCanvas', 'ganttContainer', 'ganttCanvas'];
    const missing = required.filter(key => !elements[key]);
    if (missing.length > 0) {
        console.error(`❌ Missing elements: ${missing.join(', ')}`);
        return false;
    }
    return true;
}

function showError(container, message) {
    if (container) container.innerHTML = `<div class="error-state">⚠️ ${message}</div>`;
}

function showEmptyState(elements) {
    elements.list.innerHTML = '<div class="empty-state">📭 No gear data available</div>';
    if (gearChartInstance) { gearChartInstance.destroy(); gearChartInstance = null; }
    if (gearGanttChartInstance) { gearGanttChartInstance.destroy(); gearGanttChartInstance = null; }
    if (elements.chartContainer) elements.chartContainer.style.display = 'none';
    if (elements.ganttContainer) elements.ganttContainer.style.display = 'none';
}

function showElements(elements) {
    if (elements.chartContainer) elements.chartContainer.style.display = '';
    if (elements.ganttContainer) elements.ganttContainer.style.display = '';
}

// ===================================================================
// MAIN RENDER FUNCTION
// ===================================================================

export function renderGearTab(allActivities, sessionGears = []) {
    const gearSnapshot = createGearRenderSnapshot(sessionGears);
    const runs = allActivities.filter(a => a.type && a.gear_id && a.gear_id.trim() !== '');

    const elements = {
        container: document.getElementById('gear-tab'),
        section: document.getElementById('gear-info-section'),
        list: document.getElementById('gear-info-list'),
        chartContainer: document.getElementById('gear-chart-container'),
        chartCanvas: document.getElementById('gearChart'),
        ganttContainer: document.getElementById('gear-gantt-chart-container'),
        ganttCanvas: document.getElementById('gear-gantt-chart')
    };

    if (!validateElements(elements)) {
        showError(elements.container, 'Essential HTML containers are missing');
        return;
    }

    if (runs.length === 0) {
        showEmptyState(elements);
        return;
    }

    // Remove previous filter/summary bars on re-render
    document.getElementById('gear-filters')?.remove();
    document.getElementById('gear-summary-bar')?.remove();

    addGearFilters(elements.section, runs, gearSnapshot);
    showElements(elements);
    renderGearSection(runs, gearSnapshot, 'all', false);
    renderGearChart(runs, gearSnapshot, 'all');
    renderGearGanttChart(runs, 'all', gearSnapshot);
}

// ===================================================================
// GEAR FILTERS
// ===================================================================

function addGearFilters(container, runs, gearSnapshot) {
    const filterDiv = document.createElement('div');
    filterDiv.id = 'gear-filters';
    filterDiv.innerHTML = `
        <div class="gear-filter-group">
            <button class="gear-filter-btn active" data-filter="all">All</button>
            <button class="gear-filter-btn" data-filter="shoe">👟 Shoes</button>
            <button class="gear-filter-btn" data-filter="bike">🚴 Bikes</button>
        </div>
        <label class="gear-retired-toggle">
            <input type="checkbox" id="show-retired-check"> Show retired
        </label>
    `;
    container.insertBefore(filterDiv, container.firstChild);

    let currentFilter = 'all';
    const retiredCheck = filterDiv.querySelector('#show-retired-check');

    filterDiv.addEventListener('click', (e) => {
        const btn = e.target.closest('button.gear-filter-btn');
        if (!btn) return;
        filterDiv.querySelectorAll('.gear-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        updateGearDisplay(runs, gearSnapshot, currentFilter, retiredCheck.checked);
    });

    retiredCheck.addEventListener('change', () => {
        updateGearDisplay(runs, gearSnapshot, currentFilter, retiredCheck.checked);
    });
}

function updateGearDisplay(runs, gearSnapshot, filter, showRetired) {
    renderGearSection(runs, gearSnapshot, filter, showRetired);
    renderGearChart(runs, gearSnapshot, filter);
    renderGearGanttChart(runs, filter, gearSnapshot);
}

// ===================================================================
// GEAR SECTION
// ===================================================================

async function renderGearSection(runs, gearSnapshot, filter = 'all', showRetired = false) {
    const listContainer = document.getElementById('gear-info-list');
    if (!listContainer) return;

    const gearMetrics = calculateGearMetrics(runs);
    const allGears = gearSnapshot;

    if (allGears.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">No gear loaded yet.</p>';
        return;
    }

    const processedGears = allGears.map(gear => {
        const g = { ...gear };
        g.type = ('frame_type' in g || 'weight' in g) ? 'bike' : 'shoe';
        g.notification_distance = g.type === 'shoe' ? (g.notification_distance ?? 700) : null;
        return g;
    });

    let combinedGearData = processedGears.map(gear => ({
        gear: { ...gear, distance: gearMetrics.get(gear.id)?.totalDistance || 0 },
        metrics: gearMetrics.get(gear.id) || {}
    }));

    if (filter !== 'all') combinedGearData = combinedGearData.filter(item => item.gear.type === filter);
    if (!showRetired) combinedGearData = combinedGearData.filter(item => !item.gear.retired);

    renderGearSummary(combinedGearData);
    renderGearCards(combinedGearData);
}

// ===================================================================
// SUMMARY BAR
// ===================================================================

function renderGearSummary(data) {
    let summaryBar = document.getElementById('gear-summary-bar');
    if (!summaryBar) {
        summaryBar = document.createElement('div');
        summaryBar.id = 'gear-summary-bar';
        const section = document.getElementById('gear-info-section');
        const filters = document.getElementById('gear-filters');
        section.insertBefore(summaryBar, filters ? filters.nextSibling : section.firstChild);
    }

    const totalKm = data.reduce((s, d) => s + (d.gear.distance || 0), 0) / 1000;
    const totalActivities = data.reduce((s, d) => s + (d.metrics.numUses || 0), 0);
    const needsReplacement = data.filter(d => {
        const custom = getCustomData(d.gear.id);
        const def = getDefaultValues(d.gear.type || 'unknown');
        return ((d.gear.distance || 0) / 1000) / (custom.durationKm ?? def.durationKm) >= 1 && !d.gear.retired;
    }).length;

    summaryBar.innerHTML = `
        <div class="gear-summary-bar">
            <div class="gear-summary-stat">
                <span class="summary-icon">🎽</span>
                <div>
                    <span class="summary-value">${data.length}</span>
                    <span class="summary-label">Pieces</span>
                </div>
            </div>
            <div class="gear-summary-stat">
                <span class="summary-icon">🛤️</span>
                <div>
                    <span class="summary-value">${totalKm.toFixed(0)}</span>
                    <span class="summary-label">Total km</span>
                </div>
            </div>
            <div class="gear-summary-stat">
                <span class="summary-icon">⚡</span>
                <div>
                    <span class="summary-value">${totalActivities}</span>
                    <span class="summary-label">Activities</span>
                </div>
            </div>
            ${needsReplacement > 0 ? `
            <div class="gear-summary-stat gear-summary-stat--alert">
                <span class="summary-icon">⚠️</span>
                <div>
                    <span class="summary-value">${needsReplacement}</span>
                    <span class="summary-label">Replace</span>
                </div>
            </div>` : ''}
        </div>
    `;
}

// ===================================================================
// GEAR CARDS RENDERING
// ===================================================================

function renderGearCards(combinedGearData) {
    const listContainer = document.getElementById('gear-info-list');
    if (!listContainer) return;

    const isEditMode = localStorage.getItem('gearEditMode') === 'true';
    const sortedData = sortGearData(combinedGearData);

    const header = document.createElement('div');
    header.className = 'gear-header';
    const title = document.createElement('h3');
    title.textContent = '🎽 Your Gear';
    const toggle = document.createElement('button');
    toggle.id = 'toggle-gear-edit';
    toggle.className = 'edit-toggle-btn';
    toggle.textContent = isEditMode ? '✅ Done' : '✏️ Edit';
    header.append(title, toggle);

    const grid = document.createElement('div');
    grid.className = 'gear-grid';
    grid.append(...sortedData.map(data => createGearCard(data, isEditMode)));
    listContainer.replaceChildren(header, grid);

    attachEventListeners(isEditMode, sortedData);
}

// ===================================================================
// GEAR CARD CREATION
// ===================================================================

function createGearCard(data, isEditMode) {
    const { gear, metrics } = data;
    const defaults = getDefaultValues(gear.type || 'unknown');
    const customData = getCustomData(gear.id);

    const price = customData.price ?? defaults.price;
    const durationKm = customData.durationKm ?? defaults.durationKm;
    const totalKm = (gear.distance || 0) / 1000;
    const durabilityPercent = Math.min((totalKm / durationKm) * 100, 100);
    const euroPerKm = (price > 0 && totalKm > 0) ? (price / totalKm).toFixed(2) : '-';
    const needsReplacement = durabilityPercent >= 100;
    const remainingKm = Math.max(0, durationKm - totalKm);

    // Estimated replacement date
    let replacementEst = null;
    if (!needsReplacement && metrics.firstUse && metrics.lastUse && metrics.totalDistance > 0) {
        const weeks = Math.max(1, (metrics.lastUse - metrics.firstUse) / (1000 * 60 * 60 * 24 * 7));
        const weeklyKm = (metrics.totalDistance / 1000) / weeks;
        if (weeklyKm > 0) {
            const weeksLeft = Math.round(remainingKm / weeklyKm);
            const estDate = new Date();
            estDate.setDate(estDate.getDate() + weeksLeft * 7);
            replacementEst = document.createElement('div');
            replacementEst.className = 'gear-replacement-est';
            replacementEst.textContent = `🗓 Est. end: ${formatDate(estDate)} (~${weeksLeft}w)`;
        }
    }

    const gearLabel = gear.type === 'bike'
        ? (bikeFrameTypeLabel(gear.frame_type) || gear.frame_category || 'Bike')
        : classifyShoeType(metrics.runs);

    const statusBadges = createStatusBadges(gear, needsReplacement);
    const durabilityBar = createDurabilityBar(durabilityPercent, totalKm, durationKm);
    const stats = createStatsSection(metrics, gear, euroPerKm);
    const editSection = isEditMode ? createEditSection(gear.id, price, durationKm) : null;

    const accentColor = gear.type === 'bike' ? '#3b82f6' : '#f59e0b';
    const iconBg = gear.type === 'bike' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)';

    const card = document.createElement('div');
    card.className = [
        'gear-card',
        gear.retired ? 'retired' : '',
        needsReplacement && !gear.retired ? 'needs-replacement' : ''
    ].filter(Boolean).join(' ');
    card.style.cursor = 'pointer';
    card.style.setProperty('--accent', accentColor);
    card.addEventListener('click', () => {
        const params = new URLSearchParams();
        params.set('id', String(gear.id));
        const url = new URL(window.location.href);
        url.pathname = '/html/gear.html';
        url.search = params.toString();
        url.hash = '';
        const opened = window.open(url.href, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
    });

    const accent = document.createElement('div');
    accent.className = 'gear-card__accent';
    const cardHeader = document.createElement('div');
    cardHeader.className = 'gear-card-header';
    const icon = document.createElement('div');
    icon.className = 'gear-icon';
    icon.style.background = iconBg;
    icon.style.color = accentColor;
    icon.textContent = gear.type === 'bike' ? '🚴' : '👟';
    const gearTitle = document.createElement('div');
    gearTitle.className = 'gear-title';
    const heading = document.createElement('h4');
    heading.textContent = gear.name || [gear.brand_name, gear.model_name].filter(Boolean).join(' ') || 'Unnamed';
    const typeChip = document.createElement('span');
    typeChip.className = 'gear-type-chip';
    typeChip.style.background = iconBg;
    typeChip.style.color = accentColor;
    typeChip.textContent = gearLabel;
    gearTitle.append(heading, typeChip);
    if (gear.brand_name) {
        const brandLine = document.createElement('p');
        brandLine.className = 'gear-brand';
        brandLine.textContent = gear.brand_name + (gear.model_name ? ` · ${gear.model_name}` : '');
        gearTitle.append(brandLine);
    }
    cardHeader.append(icon, gearTitle);

    const distanceDisplay = document.createElement('div');
    distanceDisplay.className = 'gear-distance-display';
    const distanceValue = document.createElement('span');
    distanceValue.className = 'distance-value';
    distanceValue.textContent = totalKm.toFixed(0);
    const distanceUnit = document.createElement('span');
    distanceUnit.className = 'distance-unit';
    distanceUnit.textContent = 'km';
    distanceDisplay.append(distanceValue, distanceUnit);

    card.append(accent);
    if (statusBadges) card.append(statusBadges);
    card.append(cardHeader, distanceDisplay, durabilityBar);
    if (replacementEst) card.append(replacementEst);
    card.append(stats);
    if (needsReplacement && !gear.retired) {
        const alert = document.createElement('div');
        alert.className = 'replacement-alert';
        alert.textContent = '⚠️ Replacement Needed!';
        card.append(alert);
    }
    if (editSection) card.append(editSection);
    return card;
}

// ===================================================================
// CARD COMPONENTS
// ===================================================================

function createStatusBadges(gear, needsReplacement) {
    const badges = document.createElement('div');
    badges.className = 'status-badges';
    const appendBadge = (className, text) => {
        const badge = document.createElement('span');
        badge.className = `status-badge ${className}`;
        badge.textContent = text;
        badges.append(badge);
    };
    if (gear.retired) appendBadge('retired', 'RETIRED');
    if (gear.primary) appendBadge('primary', 'PRIMARY');
    if (needsReplacement && !gear.retired) appendBadge('alert', 'REPLACE');
    return badges.children.length ? badges : null;
}

function createDurabilityBar(percent, totalKm, maxKm) {
    const color = percent > 90 ? '#ef4444' : percent > 75 ? '#f59e0b' : '#10b981';
    const section = document.createElement('div');
    section.className = 'durability-section';
    const bar = document.createElement('div');
    bar.className = 'durability-bar';
    const fill = document.createElement('div');
    fill.className = 'durability-fill';
    fill.style.width = `${percent}%`;
    fill.style.background = color;
    bar.append(fill);
    const text = document.createElement('small');
    text.className = 'durability-text';
    text.textContent = `${percent.toFixed(0)}% of ${maxKm} km lifespan`;
    section.append(bar, text);
    return section;
}

function createStatsSection(metrics, gear, euroPerKm) {
    const section = document.createElement('div');
    section.className = 'gear-stats';
    const values = [
        ['🏃', metrics.numUses || 0, 'Uses'],
        ['💰', euroPerKm, '€/km'],
        ['📏', formatDistance(metrics.avgDistancePerUse || 0, 1), 'Avg Dist'],
        ['⛰️', metrics.avgElevationGainPerUse ? metrics.avgElevationGainPerUse.toFixed(0) + 'm' : '-', 'Avg Elev'],
        ['📅', metrics.firstUse ? formatDate(metrics.firstUse) : 'N/A', 'First Use'],
        ['🕐', metrics.lastUse ? formatDate(metrics.lastUse) : 'N/A', 'Last Use']
    ];
    for (let index = 0; index < values.length; index += 2) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        for (const [iconText, valueText, labelText] of values.slice(index, index + 2)) {
            const item = document.createElement('div');
            item.className = 'stat-item';
            const icon = document.createElement('span');
            icon.className = 'stat-icon-mini';
            icon.textContent = iconText;
            const content = document.createElement('div');
            content.className = 'stat-content';
            const value = document.createElement('span');
            value.className = 'stat-value';
            value.textContent = valueText;
            const label = document.createElement('span');
            label.className = 'stat-label';
            label.textContent = labelText;
            content.append(value, label);
            item.append(icon, content);
            row.append(item);
        }
        section.append(row);
    }
    return section;
}

function createEditSection(gearId, price, durationKm) {
    const section = document.createElement('div');
    section.className = 'gear-edit-section';
    section.addEventListener('click', event => event.stopPropagation());
    const makeInput = (labelText, id, value, min, step = null) => {
        const group = document.createElement('div');
        group.className = 'edit-input-group';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.value = value;
        input.min = min;
        if (step !== null) input.step = step;
        group.append(label, input);
        return group;
    };
    section.append(
        makeInput('Price (€)', `price-${gearId}`, price, '0', '0.01'),
        makeInput('Lifespan (km)', `duration-${gearId}`, durationKm, '1')
    );
    const save = document.createElement('button');
    save.className = 'save-gear-btn';
    save.dataset.gearid = String(gearId);
    save.textContent = '💾 Save';
    section.append(save);
    return section;
}

// ===================================================================
// EVENT LISTENERS
// ===================================================================

function attachEventListeners(isEditMode, combinedGearData) {
    const toggleBtn = document.getElementById('toggle-gear-edit');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newMode = !isEditMode;
            localStorage.setItem('gearEditMode', String(newMode));
            renderGearCards(combinedGearData);
        });
    }

    if (isEditMode) {
        document.querySelectorAll('.save-gear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSaveGear(btn, combinedGearData);
            });
        });
    }
}

function handleSaveGear(btn, combinedGearData) {
    const gearId = btn.getAttribute('data-gearid');
    const priceInput = document.getElementById(`price-${gearId}`);
    const durationInput = document.getElementById(`duration-${gearId}`);

    const price = parseFloat(priceInput.value);
    const durationKm = parseInt(durationInput.value, 10);

    if (isNaN(price) || isNaN(durationKm) || price < 0 || durationKm <= 0) {
        showNotification('Please enter valid values', 'error');
        return;
    }

    localStorage.setItem(`gear-custom-${gearId}`, JSON.stringify({ price, durationKm }));
    btn.textContent = '✅';
    btn.classList.add('saved');
    setTimeout(() => renderGearCards(combinedGearData), 600);
    showNotification('Gear updated!', 'success');
}

// ===================================================================
// CHART: Cumulative Distance Over Time
// ===================================================================

async function renderGearChart(runs, gearSnapshot, filter = 'all') {
    const canvas = document.getElementById('gearChart');
    const container = document.getElementById('gear-chart-container');
    if (!canvas) return;

    let filteredRuns = runs;
    if (filter !== 'all') {
        const allGears = gearSnapshot;
        const validGearIds = new Set(
            allGears
                .map(g => ({ ...g, type: ('frame_type' in g || 'weight' in g) ? 'bike' : 'shoe' }))
                .filter(g => g.type === filter)
                .map(g => g.id)
        );
        filteredRuns = runs.filter(r => validGearIds.has(r.gear_id));
    }

    if (!filteredRuns.length) {
        if (gearChartInstance) { gearChartInstance.destroy(); gearChartInstance = null; }
        if (container) container.style.display = 'none';
        return;
    }
    if (container) container.style.display = '';
    if (gearChartInstance) { gearChartInstance.destroy(); gearChartInstance = null; }

    const title = filter === 'shoe' ? 'Distance per Shoe' : filter === 'bike' ? 'Distance per Bike' : 'Distance per Gear';
    container.querySelector('h4').textContent = title;

    // Group by date and gear
    const gearUsageByDate = new Map();
    for (const run of filteredRuns) {
        if (!run.start_date_local || !run.gear_id) continue;
        const dateString = run.start_date_local.substring(0, 10);
        if (!gearUsageByDate.has(dateString)) gearUsageByDate.set(dateString, new Map());
        const daily = gearUsageByDate.get(dateString);
        daily.set(run.gear_id, (daily.get(run.gear_id) || 0) + (run.distance || 0));
    }

    const allDates = Array.from(gearUsageByDate.keys()).sort();
    if (!allDates.length) {
        if (container) container.style.display = 'none';
        return;
    }

    const uniqueGearIds = Array.from(new Set(filteredRuns.map(r => r.gear_id).filter(Boolean)));
    const allGears = gearSnapshot;
    const gearIdToName = new Map(allGears.map(g => [g.id, g.name || [g.brand_name, g.model_name].filter(Boolean).join(' ')]));

    const hexToRgba = (hex, alpha) => {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    };

    const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8', '#fd7e14', '#e83e8c'];
    const datasets = uniqueGearIds.map((gearId, idx) => {
        const color = colors[idx % colors.length];
        let cumulative = 0;
        const data = allDates.map(dateStr => {
            const daily = gearUsageByDate.get(dateStr);
            cumulative += (daily?.get(gearId) || 0);
            return +(cumulative / 1000).toFixed(1);
        });
        return {
            label: gearIdToName.get(gearId) || `Gear ${gearId.slice(-6)}`,
            data,
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.1),
            fill: false,
            tension: 0.1
        };
    });

    gearChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: allDates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Cumulative Distance Over Time' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)} km` }
                }
            },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: { type: 'category', title: { display: true, text: 'Date' }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
                y: { title: { display: true, text: 'Distance (km)' }, beginAtZero: true }
            }
        }
    });
}

// ===================================================================
// CHART: Gear Gantt (Monthly Distance per Gear)
// ===================================================================

export async function renderGearGanttChart(runs, filter = 'all', sessionGears = []) {
    const ctx = document.getElementById('gear-gantt-chart');
    if (!ctx) return;

    if (gearGanttChartInstance) { gearGanttChartInstance.destroy(); gearGanttChartInstance = null; }

    const allGears = createGearRenderSnapshot(sessionGears);
    const processedGears = allGears.map(g => ({
        ...g,
        type: ('frame_type' in g || 'weight' in g) ? 'bike' : 'shoe'
    }));

    const filteredGears = filter === 'all' ? processedGears : processedGears.filter(g => g.type === filter);
    const gearIds = new Set(filteredGears.map(g => g.id));
    const gearIdToName = new Map(filteredGears.map(g => [g.id, g.name || [g.brand_name, g.model_name].filter(Boolean).join(' ')]));
    const filteredRuns = runs.filter(r => gearIds.has(r.gear_id));

    if (!filteredRuns.length) return;

    const gearMonthKm = filteredRuns.reduce((acc, a) => {
        if (!a.gear_id || !a.start_date_local) return acc;
        const month = a.start_date_local.substring(0, 7);
        if (!acc[month]) acc[month] = {};
        acc[month][a.gear_id] = (acc[month][a.gear_id] || 0) + a.distance / 1000;
        return acc;
    }, {});

    const ganttTitle = filter === 'shoe' ? 'Shoes Timeline' : filter === 'bike' ? 'Bikes Timeline' : 'Gear Timeline';
    document.querySelector('#gear-gantt-chart-container h4').textContent = ganttTitle;

    const monthsWithData = Object.keys(gearMonthKm);
    if (!monthsWithData.length) return;

    const firstMonth = monthsWithData.reduce((a, b) => a < b ? a : b);
    const lastMonth = monthsWithData.reduce((a, b) => a > b ? a : b);

    function getMonthRange(start, end) {
        const result = [];
        let [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
            result.push(`${sy}-${String(sm).padStart(2, '0')}`);
            if (++sm > 12) { sm = 1; sy++; }
        }
        return result;
    }

    const allMonths = getMonthRange(firstMonth, lastMonth);
    const datasets = Array.from(gearIds).map((gearId, idx) => ({
        label: gearIdToName.get(gearId) || `Gear ${gearId.slice(-6)}`,
        data: allMonths.map(month => gearMonthKm[month]?.[gearId] || 0),
        backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 60%)`,
        stack: 'stack1'
    }));

    gearGanttChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: allMonths, datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Distance per Gear per Month' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x?.toFixed(1)} km` }
                }
            },
            scales: {
                x: { stacked: true, title: { display: true, text: 'Distance (km)' }, beginAtZero: true },
                y: { stacked: true, title: { display: true, text: 'Year-Month' } }
            }
        }
    });
}
