/**
 * ACTIVITY.JS - Activity Details Page Controller
 * Handles fetching, processing, and rendering activity data with comprehensive charts and stats
 * Entry point: Query parameter ?id={activityId}
 */

import { formatDate as sharedFormatDate, formatPace as sharedFormatPace, formatPaceRun } from '../../shared/utils/index.js';
import { renderWeatherAnalysis, renderWeatherMapDetails } from '../../shared/utils/weather-analysis.js';
import {
    prepareStreamChartPresentation,
    prepareStreamMapPresentation,
    restoreStreamGapMask
} from '../detail/stream-presentation.js';

// =====================================================
// 1. INITIALIZATION & CONFIGURATION
// =====================================================

const CONFIG = {
    USER_MAX_HR: 195,
    WINDOW_SIZES: {
        altitude: 50,
        pace: 200,
        heartrate: 80,
        cadence: 60,
    },
    NUM_SEGMENTS: 40,
};

const MAP_LAYERS = {
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
    },
    'carto-light': {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        options: { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO' },
    },
    'carto-dark': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        options: { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO' },
    },
    'open-topo': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        options: { maxZoom: 17, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap' },
    },
    'esri-sat': {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: { maxZoom: 20, attribution: 'Tiles &copy; Esri' },
    },
};

// DOM References
const DOM = {
    details: document.getElementById('activity-details'),
    info: document.getElementById('activity-info'),
    stats: document.getElementById('activity-stats'),
    advanced: document.getElementById('activity-advanced'),
    map: document.getElementById('activity-map'),
    splitsSection: document.getElementById('splits-section'),
    streamCharts: document.getElementById('stream-charts'),
    runClassifier: document.getElementById('run-classifier-results'),
    hrZonesChart: document.getElementById('hr-zones-chart'),
};

// Chart instances registry for cleanup
const chartInstances = {};

// Smoothing control
let currentSmoothingLevel = 100;
let originalStreamData = null; // Store unsmoothed data
let lastStreamData = null;
let lastActivityData = null;
let allowExternalWeatherForPage = true;

// Dynamic chart data storage
let dynamicChartData = {
    distance: [],
    heartrate: [],
    pace: [],
    altitude: [],
    cadence: [],
    watts: [],
};

// Original unsmoothed dynamic chart data (for secondary and background stats)
let originalDynamicChartData = {
    distance: [],
    heartrate: [],
    pace: [],
    altitude: [],
    cadence: [],
    watts: [],
};

// Chart color mapping
const chartColors = {
    heartrate: { primary: 'rgb(255, 99, 132)', secondary: 'rgba(255, 99, 132, 0.3)' },
    pace: { primary: 'rgb(252, 82, 0)', secondary: 'rgba(252, 82, 0, 0.3)' },
    altitude: { primary: 'rgb(136, 136, 136)', secondary: 'rgba(136, 136, 136, 0.3)' },
    cadence: { primary: 'rgb(0, 116, 217)', secondary: 'rgba(0, 116, 217, 0.3)' },
    watts: { primary: 'rgb(155, 89, 182)', secondary: 'rgba(155, 89, 182, 0.3)' },
};

// Run classification result
let currentRunClassification = null;

/**
 * Gets chart colors based on run classification
 */
function getClassificationBasedColors() {
    if (!currentRunClassification || !currentRunClassification.top || currentRunClassification.top.length === 0) {
        return chartColors; // Default colors
    }

    const primaryType = currentRunClassification.top[0].type;

    // Define color schemes for different run types
    const colorSchemes = {
        'Race': {
            heartrate: { primary: 'rgb(220, 20, 60)', secondary: 'rgba(220, 20, 60, 0.3)' }, // Crimson
            pace: { primary: 'rgb(255, 69, 0)', secondary: 'rgba(255, 69, 0, 0.3)' }, // Red-Orange
            altitude: { primary: 'rgb(105, 105, 105)', secondary: 'rgba(105, 105, 105, 0.3)' },
            cadence: { primary: 'rgb(30, 144, 255)', secondary: 'rgba(30, 144, 255, 0.3)' }, // Dodger Blue
            watts: { primary: 'rgb(138, 43, 226)', secondary: 'rgba(138, 43, 226, 0.3)' }, // Blue Violet
        },
        'Trail Run': {
            heartrate: { primary: 'rgb(34, 139, 34)', secondary: 'rgba(34, 139, 34, 0.3)' }, // Forest Green
            pace: { primary: 'rgb(160, 82, 45)', secondary: 'rgba(160, 82, 45, 0.3)' }, // Sienna
            altitude: { primary: 'rgb(139, 69, 19)', secondary: 'rgba(139, 69, 19, 0.3)' }, // Saddle Brown
            cadence: { primary: 'rgb(0, 100, 0)', secondary: 'rgba(0, 100, 0, 0.3)' }, // Dark Green
            watts: { primary: 'rgb(85, 107, 47)', secondary: 'rgba(85, 107, 47, 0.3)' }, // Dark Olive Green
        },
        'Tempo Run': {
            heartrate: { primary: 'rgb(255, 140, 0)', secondary: 'rgba(255, 140, 0, 0.3)' }, // Dark Orange
            pace: { primary: 'rgb(255, 215, 0)', secondary: 'rgba(255, 215, 0, 0.3)' }, // Gold
            altitude: { primary: 'rgb(136, 136, 136)', secondary: 'rgba(136, 136, 136, 0.3)' },
            cadence: { primary: 'rgb(255, 165, 0)', secondary: 'rgba(255, 165, 0, 0.3)' }, // Orange
            watts: { primary: 'rgb(184, 134, 11)', secondary: 'rgba(184, 134, 11, 0.3)' }, // Dark Goldenrod
        }
    };

    return colorSchemes[primaryType] || chartColors;
}

function getAvailableRouteColorModes(streams) {
    const modes = [{ value: 'route', label: 'Route' }];
    if (streams?.heartrate?.data?.length > 0) modes.push({ value: 'heartrate', label: 'Heart Rate' });
    if (streams?.cadence?.data?.length > 0) modes.push({ value: 'cadence', label: 'Cadence' });
    if (streams?.altitude?.data?.length > 0) modes.push({ value: 'altitude', label: 'Altitude' });
    if (streams?.velocity_smooth?.data?.length > 0) {
        modes.push({ value: 'speed', label: 'Speed' });
        modes.push({ value: 'pace', label: 'Pace' });
    }
    return modes;
}

function syncRouteColorSelect(select, streams) {
    if (!select) return 'route';

    const availableModes = getAvailableRouteColorModes(streams);
    const currentValue = select.value;
    select.innerHTML = availableModes.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('');
    select.value = availableModes.some(mode => mode.value === currentValue) ? currentValue : 'route';
    return select.value;
}

// =====================================================
// 2. UTILITY FUNCTIONS
// =====================================================

/**
 * Formats seconds into HH:MM:SS format
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(h > 0 ? 2 : 1, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats date as DD/MM/YYYY
 */
function formatDate(date) {
    return sharedFormatDate(date);
}

/**
 * Converts decimal pace (e.g. 5.5) to MM:SS string (e.g. "5:30")
 */
function paceDecimalToTime(paceDecimal) {
    if (isNaN(paceDecimal) || paceDecimal <= 0) return "–";
    const minutes = Math.floor(paceDecimal);
    const seconds = Math.round((paceDecimal - minutes) * 60);
    const adjMinutes = seconds === 60 ? minutes + 1 : minutes;
    const adjSeconds = seconds === 60 ? 0 : seconds;
    return `${adjMinutes}:${adjSeconds.toString().padStart(2, "0")}`;
}

/**
 * Formats speed (m/s) into pace (min/km)
 */
function formatPace(speedInMps) {
    if (!speedInMps || speedInMps === 0) return '-';
    return formatPaceRun(1000 / speedInMps);
}

/**
 * Decodes Strava polyline encoding to lat/lng coordinates
 */
function decodePolyline(str) {
    let index = 0, lat = 0, lng = 0, coordinates = [];
    while (index < str.length) {
        let b, shift = 0, result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
}

export function getActivityRouteCoordinates(activity, streams) {
    const polyline = activity?.map?.summary_polyline || activity?.map?.polyline;
    if (typeof polyline === 'string' && polyline.length > 0) {
        const decoded = decodePolyline(polyline);
        if (decoded.length > 0) return decoded;
    }

    const positions = streams?.latlng?.data;
    if (!Array.isArray(positions) || positions.length < 2) return [];
    const coordinates = [];
    for (const point of positions) {
        if (!Array.isArray(point) || point.length < 2) return [];
        const [latitude, longitude] = point;
        if (
            !Number.isFinite(latitude)
            || !Number.isFinite(longitude)
            || Math.abs(latitude) > 90
            || Math.abs(longitude) > 180
        ) return [];
        coordinates.push([latitude, longitude]);
    }
    return coordinates;
}

/**
 * Estimates VO2max from activity data using Karvonen formula
 */
function estimateVO2max(act, userMaxHr = CONFIG.USER_MAX_HR) {
    if (!act.distance || !act.moving_time || !act.average_heartrate) return '-';
    const vel_m_min = (act.distance / act.moving_time) * 60;
    const vo2_at_pace = (vel_m_min * 0.2) + 3.5;
    const percent_max_hr = act.average_heartrate / userMaxHr;
    if (percent_max_hr < 0.5 || percent_max_hr > 1.2) return '-';
    const vo2max = vo2_at_pace / percent_max_hr;
    return vo2max.toFixed(1);
}

/**
 * Applies rolling mean smoothing to array
 */
function rollingMean(arr, windowSize = 25) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(arr.length, i + Math.ceil(windowSize / 2));
        const window = arr.slice(start, end);
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        result.push(mean);
    }
    return result;
}

/**
 * Calculates coefficient of variation (CV) for data series
 */
function calculateVariability(data, smoothingWindow = 0) {
    let processedData = data;
    if (smoothingWindow > 0) {
        processedData = rollingMean(data, smoothingWindow);
    }

    if (!processedData || processedData.length < 2) return '-';

    const validData = processedData.filter(d => d !== null && isFinite(d) && d > 0);
    if (validData.length < 2) return '-';

    const mean = validData.reduce((a, b) => a + b, 0) / validData.length;
    if (mean === 0) return '-';

    const standardDeviation = Math.sqrt(
        validData.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (validData.length - 1)
    );

    const cv = (standardDeviation / mean) * 100;
    return `${cv.toFixed(1)}%`;
}

/**
 * Calculates time spent in each HR zone
 */
function calculateTimeInZones(heartrateStream, timeStream, zones) {
    if (!heartrateStream || !timeStream || !zones || zones.length === 0) {
        return [];
    }

    const timeInZones = Array(zones.length).fill(0);

    for (let i = 1; i < heartrateStream.data.length; i++) {
        const hr = heartrateStream.data[i];
        if (hr === null) continue;
        const deltaTime = timeStream.data[i] - timeStream.data[i - 1];

        let zoneIndex = -1;
        for (let j = 0; j < zones.length; j++) {
            const zone = zones[j];
            const max = zone.max === -1 ? Infinity : zone.max;
            if (hr >= zone.min && hr < max) {
                zoneIndex = j;
                break;
            }
        }
        if (zoneIndex !== -1) {
            timeInZones[zoneIndex] += deltaTime;
        }
    }
    return timeInZones;
}

/**
 * Creates or updates a Chart.js instance with cleanup
 */
function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`Canvas element not found: ${canvasId}`);
        return;
    }

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(canvas, config);
}

function createStreamPresentationChart(canvasId, config) {
    const presentation = prepareStreamChartPresentation(
        config.data.labels,
        config.data.datasets
    );
    const canvas = document.getElementById(canvasId);
    if (canvas?.dataset) canvas.dataset.presentationState = presentation.status;
    let status = document.getElementById(`${canvasId}-presentation-status`);
    if (canvas && !status) {
        status = document.createElement('p');
        status.id = `${canvasId}-presentation-status`;
        status.setAttribute('role', 'status');
        canvas.insertAdjacentElement('afterend', status);
    }
    if (presentation.status === 'too-fragmented') {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
            delete chartInstances[canvasId];
        }
        if (canvas) canvas.hidden = true;
        if (status) {
            status.hidden = false;
            status.textContent = 'Too fragmented to plot.';
        }
        return null;
    }
    if (canvas) canvas.hidden = false;
    if (status) {
        status.hidden = true;
        status.textContent = '';
    }
    return createChart(canvasId, {
        ...config,
        data: {
            ...config.data,
            labels: presentation.labels,
            datasets: presentation.datasets
        }
    });
}

/**
 * Applies smoothing to a copy of stream data based on smoothing level
 */
function applySmoothingToStreams(streams, smoothingLevel) {
    if (!streams) return null;

    const smoothingFactor = smoothingLevel / 100;
    const smoothed = JSON.parse(JSON.stringify(streams)); // Deep copy

    // Calculate window sizes based on smoothing level
    const windowSizes = {
        altitude: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.altitude * smoothingFactor)),
        heartrate: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.heartrate * smoothingFactor)),
        cadence: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.cadence * smoothingFactor)),
        watts: Math.max(1, Math.round(60 * smoothingFactor)),
    };

    // Apply rolling mean to streams
    ['heartrate', 'altitude', 'cadence', 'watts'].forEach(key => {
        if (smoothed[key] && Array.isArray(smoothed[key].data)) {
            smoothed[key].data = rollingMean(smoothed[key].data, windowSizes[key]);
        }
    });

    return smoothed;
}

/**
 * Initializes smoothing slider control
 */
function initSmoothingControl() {
    const slider = document.getElementById('smoothing-slider');
    const valueDisplay = document.getElementById('smoothing-value');

    if (!slider || !valueDisplay) return;

    slider.addEventListener('input', (e) => {
        currentSmoothingLevel = parseInt(e.target.value, 10);
        valueDisplay.textContent = currentSmoothingLevel;

        // Apply smoothing only to primary data and smoothing-dependent charts
        if (originalStreamData && lastActivityData) {
            const smoothedStreams = applySmoothingToStreams(originalStreamData, currentSmoothingLevel);

            // Re-render stream and variability charts (affected by smoothing)
            renderStreamCharts(smoothedStreams, lastActivityData, currentSmoothingLevel);
            renderHrMinMaxAreaChart(smoothedStreams, currentSmoothingLevel);
            renderPaceMinMaxAreaChart(smoothedStreams, currentSmoothingLevel);
            syncSideBySideContainers();

            // Update dynamic chart data and re-render
            populateDynamicChartData(smoothedStreams);
            const primaryData = document.getElementById('dynamic-chart-primary-data');
            if (primaryData && primaryData.value) {
                const primaryType = document.getElementById('dynamic-chart-primary-type').value;
                const primaryShow = document.getElementById('dynamic-chart-primary-show').checked;
                const secondaryData = document.getElementById('dynamic-chart-secondary-data').value;
                const secondaryType = document.getElementById('dynamic-chart-secondary-type').value;
                const secondaryShow = document.getElementById('dynamic-chart-secondary-show').checked;
                const backgroundStat = document.getElementById('dynamic-chart-background-stat').value;

                // Primary uses smoothed data; secondary and background use original
                renderDynamicChart(primaryData.value, primaryType, primaryShow, secondaryData, secondaryType, secondaryShow, backgroundStat);
            }
        }
    });
}

/**
 * Initializes dynamic custom chart controls
 */
function initDynamicChartControls() {
    const primaryDataSelect = document.getElementById('dynamic-chart-primary-data');
    const secondaryDataSelect = document.getElementById('dynamic-chart-secondary-data');
    const primaryTypeSelect = document.getElementById('dynamic-chart-primary-type');
    const secondaryTypeSelect = document.getElementById('dynamic-chart-secondary-type');
    const backgroundStatSelect = document.getElementById('dynamic-chart-background-stat');
    const primaryShowCheckbox = document.getElementById('dynamic-chart-primary-show');
    const secondaryShowCheckbox = document.getElementById('dynamic-chart-secondary-show');

    if (!primaryDataSelect) return;

    const updateDynamicChart = () => {
        renderDynamicChart(
            primaryDataSelect.value,
            primaryTypeSelect.value,
            primaryShowCheckbox.checked,
            secondaryDataSelect.value,
            secondaryTypeSelect.value,
            secondaryShowCheckbox.checked,
            backgroundStatSelect.value
        );
    };

    primaryDataSelect.addEventListener('change', updateDynamicChart);
    secondaryDataSelect.addEventListener('change', () => {
        // Auto-check secondary show checkbox when secondary data is selected
        if (secondaryDataSelect.value) {
            secondaryShowCheckbox.checked = true;
        }
        updateDynamicChart();
    });
    primaryTypeSelect.addEventListener('change', updateDynamicChart);
    secondaryTypeSelect.addEventListener('change', updateDynamicChart);
    backgroundStatSelect.addEventListener('change', updateDynamicChart);
    primaryShowCheckbox.addEventListener('change', updateDynamicChart);
    secondaryShowCheckbox.addEventListener('change', updateDynamicChart);

    // Initial render if primary data is pre-selected
    if (primaryDataSelect.value) {
        updateDynamicChart();
    }
}

function isSectionVisible(el) {
    if (!el) return false;
    return !el.classList.contains('hidden') && el.style.display !== 'none';
}

function syncSideBySideContainers() {
    const containers = document.querySelectorAll('.side-by-side-container');
    containers.forEach(container => {
        const sections = Array.from(container.querySelectorAll(':scope > .data-section'));
        if (!sections.length) return;
        const hasVisible = sections.some(isSectionVisible);
        container.style.display = hasVisible ? '' : 'none';
    });
}

function moveAndHideCustomChartSection() {
    const section = document.getElementById('dynamic-chart-section');
    if (!section) return;

    section.classList.add('hidden');
    const container = section.closest('.container');
    const closeBtn = container?.querySelector('button[onclick="window.close()"]');
    if (container && closeBtn) {
        container.insertBefore(section, closeBtn);
    }
}

/**
 * Renders dynamic custom chart based on user selections
 */
function renderDynamicChart(primaryData, primaryType, primaryShow, secondaryData, secondaryType, secondaryShow, backgroundStat) {
    const canvas = document.getElementById('dynamic-custom-chart');
    if (!canvas || !primaryData || !primaryShow) {
        if (chartInstances['dynamic-custom-chart']) {
            chartInstances['dynamic-custom-chart'].destroy();
            delete chartInstances['dynamic-custom-chart'];
        }
        return;
    }

    const labels = dynamicChartData.distance.map(d => (d / 1000).toFixed(2));
    const datasets = [];
    let yAxisConfigs = {};

    // Primary dataset
    if (primaryShow && primaryData) {
        const primaryColor = chartColors[primaryData];
        datasets.push({
            label: getDataLabel(primaryData),
            data: restoreStreamGapMask(
                dynamicChartData[primaryData],
                originalDynamicChartData[primaryData]
            ),
            borderColor: primaryColor.primary,
            backgroundColor: primaryColor.secondary,
            borderWidth: 2,
            fill: primaryType === 'area',
            pointRadius: primaryType === 'scatter' ? 3 : 0,
            type: primaryType === 'scatter' ? 'scatter' : undefined,
            yAxisID: 'y',
            tension: primaryType === 'line' || primaryType === 'area' ? 0.3 : 0,
        });
        yAxisConfigs.y = {
            type: 'linear',
            position: 'left',
            title: { display: true, text: getDataLabel(primaryData) },
            reverse: primaryData === 'pace',
        };
    }

    // Secondary dataset (uses smoothed data)
    if (secondaryShow && secondaryData && secondaryData !== primaryData) {
        const secondaryColor = chartColors[secondaryData];
        datasets.push({
            label: getDataLabel(secondaryData),
            data: restoreStreamGapMask(
                dynamicChartData[secondaryData],
                originalDynamicChartData[secondaryData]
            ),
            borderColor: secondaryColor.primary,
            backgroundColor: secondaryColor.secondary,
            borderWidth: 2,
            fill: secondaryType === 'area',
            pointRadius: secondaryType === 'scatter' ? 3 : 0,
            type: secondaryType === 'scatter' ? 'scatter' : undefined,
            yAxisID: 'y1',
            tension: secondaryType === 'line' || secondaryType === 'area' ? 0.3 : 0,
        });
        yAxisConfigs.y1 = {
            type: 'linear',
            position: 'right',
            title: { display: true, text: getDataLabel(secondaryData) },
            reverse: secondaryData === 'pace',
            grid: { drawOnChartArea: false },
        };
    }

    // Background stream dataset (if selected) - uses original unsmoothed data
    let backgroundPlugin = null;
    if (backgroundStat && backgroundStat !== primaryData && backgroundStat !== secondaryData) {
        const bgColor = chartColors[backgroundStat];
        datasets.push({
            label: `${getDataLabel(backgroundStat)} (background)`,
            data: originalDynamicChartData[backgroundStat],
            borderColor: bgColor.primary,
            backgroundColor: 'rgba(200, 200, 200, 0.15)',
            borderWidth: 1,
            borderDash: [5, 5],
            fill: true,
            pointRadius: 0,
            yAxisID: 'y',
            tension: 0.3,
            order: -1,
        });
    }

    const config = {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Distance (km)' },
                    type: 'category',
                },
                ...yAxisConfigs,
            }
        },
        plugins: backgroundPlugin ? [backgroundPlugin] : [],
    };

    createStreamPresentationChart('dynamic-custom-chart', config);
}

/**
 * Gets human-readable label for data type
 */
function getDataLabel(dataType) {
    const labels = {
        heartrate: 'Heart Rate (bpm)',
        pace: 'Pace (min/km)',
        altitude: 'Altitude (m)',
        cadence: 'Cadence (spm)',
        watts: 'Power (W)',
    };
    return labels[dataType] || dataType;
}

/**
 * Creates a background plugin for effort/intensity visualization
 */
function createBackgroundPlugin(backgroundStat) {
    return {
        id: 'backgroundPlugin',
        afterDatasetsDraw(chart) {
            if (backgroundStat === 'effort') {
                drawEffortBackground(chart);
            } else if (backgroundStat === 'recovery') {
                drawRecoveryBackground(chart);
            } else if (backgroundStat === 'intensity') {
                drawIntensityBackground(chart);
            }
        }
    };
}

/**
 * Draws effort level background
 */
function drawEffortBackground(chart) {
    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    if (!xScale || !yScale) return;

    const chartArea = chart.chartArea;
    const totalPoints = chart.data.labels.length;

    // Create effort zones: low (start), medium (middle), high (end)
    const sections = [
        { start: 0, end: totalPoints * 0.3, color: 'rgba(76, 175, 80, 0.1)' },
        { start: totalPoints * 0.3, end: totalPoints * 0.7, color: 'rgba(255, 193, 7, 0.1)' },
        { start: totalPoints * 0.7, end: totalPoints, color: 'rgba(244, 67, 54, 0.1)' },
    ];

    sections.forEach(section => {
        const startPx = chartArea.left + (section.start / totalPoints) * chartArea.width;
        const endPx = chartArea.left + (section.end / totalPoints) * chartArea.width;
        ctx.fillStyle = section.color;
        ctx.fillRect(startPx, chartArea.top, endPx - startPx, chartArea.height);
    });
}

/**
 * Draws recovery zone background
 */
function drawRecoveryBackground(chart) {
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const totalPoints = chart.data.labels.length;

    // Recovery zones: alternating easy/moderate
    for (let i = 0; i < totalPoints; i += 2) {
        const startPx = chartArea.left + (i / totalPoints) * chartArea.width;
        const endPx = chartArea.left + (Math.min(i + 1, totalPoints) / totalPoints) * chartArea.width;
        ctx.fillStyle = i % 4 === 0 ? 'rgba(156, 39, 176, 0.08)' : 'rgba(100, 100, 100, 0.08)';
        ctx.fillRect(startPx, chartArea.top, endPx - startPx, chartArea.height);
    }
}

/**
 * Draws intensity pattern background
 */
function drawIntensityBackground(chart) {
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const totalPoints = chart.data.labels.length;

    // Intensity zones: low, moderate, high repeating
    const zones = ['rgba(0, 200, 100, 0.08)', 'rgba(255, 165, 0, 0.08)', 'rgba(255, 50, 50, 0.08)'];

    for (let i = 0; i < totalPoints; i++) {
        const zoneIndex = Math.floor((i / totalPoints) * 3);
        const startPx = chartArea.left + (i / totalPoints) * chartArea.width;
        const endPx = chartArea.left + ((i + 1) / totalPoints) * chartArea.width;
        ctx.fillStyle = zones[zoneIndex];
        ctx.fillRect(startPx, chartArea.top, endPx - startPx, chartArea.height);
    }
}

/**
 * Populates dynamic chart data from stream data
 */
function populateDynamicChartData(streams, isOriginal = false) {
    const data = {
        distance: streams.distance?.data || [],
        heartrate: streams.heartrate?.data || [],
        altitude: streams.altitude?.data || [],
        cadence: streams.cadence?.data || [],
        watts: streams.watts?.data || [],
        pace: [],
    };

    // Calculate pace from distance and time
    if (streams.distance?.data && streams.time?.data) {
        const pace = [];
        for (let i = 1; i < streams.distance.data.length; i++) {
            const deltaDist = streams.distance.data[i] - streams.distance.data[i - 1];
            const deltaTime = streams.time.data[i] - streams.time.data[i - 1];
            if (deltaDist > 0 && deltaTime > 0) {
                const speed = deltaDist / deltaTime;
                pace.push(1000 / speed / 60);
            } else {
                pace.push(null);
            }
        }
        // Prepend null to match distance array length
        data.pace = [null, ...pace];

        // Apply rolling mean smoothing to pace when not original
        if (!isOriginal) {
            const smoothingFactor = currentSmoothingLevel / 100;
            const paceWindow = Math.max(1, Math.round(CONFIG.WINDOW_SIZES.pace * smoothingFactor));
            data.pace = rollingMean(data.pace, paceWindow);
        }
    }

    // Apply cadence doubling for runs
    if (lastActivityData && lastActivityData.type === 'Run') {
        data.cadence = data.cadence.map(c => c ? c * 2 : null);
    }

    // Store in appropriate location
    if (isOriginal) {
        originalDynamicChartData = data;
    } else {
        dynamicChartData = data;
    }
}

// =====================================================
// 4. RENDERING FUNCTIONS - ACTIVITY INFO
// =====================================================

/**
 * Renders basic activity information (title, date, type, gear, etc.)
 */
function providerActivityUrl(activity, activitySource) {
    const id = activity?.id;
    const numericId = (
        typeof id === 'number' && Number.isSafeInteger(id) && id >= 0
    ) || (
        typeof id === 'string' && /^(?:0|[1-9]\d*)$/.test(id)
    );
    return ['cache', 'network', 'mixed', 'demo'].includes(activitySource) && numericId
        ? `https://www.strava.com/activities/${encodeURIComponent(String(id))}`
        : null;
}

function renderActivityInfo(activity, activitySource) {

    const name = activity.name;
    const pageTitle = document.getElementById('activity-page-title');
    if (pageTitle && name) pageTitle.textContent = name;
    document.title = name ? `${name} | Running Performance Studio` : 'Running Performance Studio';
    const description = activity.description || '';
    const date = formatDate(new Date(activity.start_date_local));
    const typeLabels = ['Workout', 'Race', 'Long Run', 'Workout'];
    const activityType = activity.workout_type !== undefined
        ? typeLabels[activity.workout_type] || 'Other'
        : (activity.type || 'Other');
    const gearId = activity.gear_id || activity.gear?.id || null;
    const gear = activity.gear?.name || activity.gear_name || (gearId ? `Gear ${gearId}` : null);
    const kudosValue = Number(activity.kudos_count);
    const commentValue = Number(activity.comment_count);
    const kudos = Number.isFinite(kudosValue) ? kudosValue : null;
    const commentCount = Number.isFinite(commentValue) ? commentValue : null;
    const tempStr = activity.average_temp !== undefined && activity.average_temp !== null ? `${activity.average_temp}°C` : null;
    const stravaUrl = providerActivityUrl(activity, activitySource);

    const heroDate = document.getElementById('activity-hero-date');
    const heroDescription = document.getElementById('activity-hero-description');
    const heroType = document.getElementById('activity-hero-type');
    const heroGear = document.getElementById('activity-hero-gear');
    const heroKudos = document.getElementById('activity-hero-kudos');
    const heroComments = document.getElementById('activity-hero-comments');
    const heroLink = document.getElementById('activity-hero-strava-link');

    if (heroDate) heroDate.textContent = date;
    if (heroDescription) heroDescription.textContent = description || 'No description provided.';
    if (heroType) heroType.textContent = activityType;
    if (heroGear) {
        if (gearId) {
            const params = new URLSearchParams();
            params.set('id', String(gearId));
            const url = new URL('/html/gear.html', new URL(document.baseURI).origin);
            url.search = params.toString();
            const gearLink = document.createElement('a');
            gearLink.href = url.href;
            gearLink.textContent = gear || gearId;
            heroGear.replaceChildren(gearLink);
        } else {
            heroGear.textContent = gear || 'No gear';
        }
    }
    if (heroKudos) heroKudos.textContent = `❤️ ${kudos !== null ? kudos : '—'}`;
    if (heroComments) heroComments.textContent = `💬 ${commentCount !== null ? commentCount : '—'}`;
    if (heroLink) {
        heroLink.hidden = stravaUrl === null;
        if (stravaUrl === null) heroLink.removeAttribute('href');
        else heroLink.href = stravaUrl;
    }
}

/**
 * Renders core statistics (distance, pace, elevation, HR)
 */
function renderActivityStats(activity) {
    if (!DOM.stats) return;

    const distanceKm = (activity.distance / 1000).toFixed(2);
    const duration = formatTime(activity.moving_time);
    const pace = formatPace(activity.average_speed);
    const elevation = activity.total_elevation_gain !== undefined ? activity.total_elevation_gain : '-';
    const elevationPerKm = activity.distance > 0
        ? (activity.total_elevation_gain / (activity.distance / 1000)).toFixed(2)
        : '-';
    const calories = activity.calories !== undefined && activity.calories !== null ? activity.calories : null;
    const hrAvg = activity.average_heartrate !== undefined && activity.average_heartrate !== null ? Math.round(activity.average_heartrate) : null;
    const hrMax = activity.max_heartrate !== undefined && activity.max_heartrate !== null ? Math.round(activity.max_heartrate) : null;
    const avgPower = activity.average_watts !== undefined && activity.average_watts !== null ? Math.round(activity.average_watts) : null;
    const fields = [];
    const pushField = (label, value) => {
        if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Not available' || value === '-' || value === 'null') return;
        fields.push(`<li><b>${label}:</b> ${value}</li>`);
    };

    pushField('Duration', duration);
    pushField('Distance', `${distanceKm} km`);
    pushField('Pace', pace !== '-' && pace !== '—' ? pace : null);
    pushField('Elevation Gain', `${elevation} m`);
    pushField('Elevation per Km', `${elevationPerKm} m`);
    pushField('Calories', calories);
    pushField('HR Avg', hrAvg ? `${hrAvg} bpm` : null);
    pushField('HR Max', hrMax ? `${hrMax} bpm` : null);
    pushField('Avg Power', avgPower ? `${avgPower} W` : null);

    DOM.stats.innerHTML = `
        <h3>Stats</h3>
        <ul>
            ${fields.join('')}
        </ul>
    `;
}

/**
 * Renders advanced statistics (VO2max, variability, achievements)
 */
function renderAdvancedStats(activity) {
    if (!DOM.advanced) return;

    const elevationPerKm = activity.distance > 0
        ? (activity.total_elevation_gain / (activity.distance / 1000)).toFixed(2)
        : '-';
    const moveRatio = activity.moving_ratio !== null && activity.moving_ratio !== undefined
        ? `${(activity.moving_ratio * 100).toFixed(1)}%`
        : '-';
    const efficiency = activity.efficiency !== null && activity.efficiency !== undefined
        ? `${activity.efficiency.toFixed(3)} min/km/bpm`
        : '-';
    const effort = activity.suffer_score !== undefined && activity.suffer_score !== null
        ? activity.suffer_score
        : (activity.perceived_exertion !== undefined && activity.perceived_exertion !== null ? activity.perceived_exertion : null);
    const vo2max = estimateVO2max(activity);
    const paceVariabilityLaps = activity.pace_variability_laps || '-';
    const hrVariabilityLaps = activity.hr_variability_laps || '-';
    const prCount = activity.pr_count !== undefined && activity.pr_count !== null ? activity.pr_count : null;
    const athleteCount = activity.athlete_count !== undefined && activity.athlete_count !== null ? activity.athlete_count : null;
    const achievementCount = activity.achievement_count !== undefined && activity.achievement_count !== null ? activity.achievement_count : null;
    const fields = [];
    const pushField = (label, value) => {
        if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Not available' || value === '-' || value === 'null') return;
        fields.push(`<li><b>${label}:</b> ${value}</li>`);
    };

    pushField('Elevation per Km', `${elevationPerKm} m`);
    pushField('Move Ratio', moveRatio);
    pushField('Efficiency', efficiency);
    pushField('Effort', effort);
    pushField('VO₂max (est)', vo2max);
    pushField('Pace CV (Splits)', paceVariabilityLaps);
    pushField('HR CV (Splits)', hrVariabilityLaps);
    pushField('PRs', prCount);
    pushField('Athlete Count', athleteCount);
    pushField('Achievements', achievementCount);

    DOM.advanced.innerHTML = `
        <h3>Advanced Stats</h3>
        <ul>
            ${fields.join('')}
        </ul>
    `;
}

function resampleSeries(values, targetLength) {
    if (!Array.isArray(values) || values.length === 0 || targetLength <= 0) return [];
    if (targetLength === values.length) return values.slice();
    if (targetLength === 1) return [values[0]];

    const resampled = [];
    for (let i = 0; i < targetLength; i++) {
        const ratio = i / (targetLength - 1);
        const position = ratio * (values.length - 1);
        const left = Math.floor(position);
        const right = Math.ceil(position);
        const mix = position - left;
        const leftValue = Number(values[left]);
        const rightValue = Number(values[right]);

        if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) {
            resampled.push(null);
        } else if (!Number.isFinite(rightValue) || left === right) {
            resampled.push(Number.isFinite(leftValue) ? leftValue : rightValue);
        } else if (!Number.isFinite(leftValue)) {
            resampled.push(rightValue);
        } else {
            resampled.push(leftValue + (rightValue - leftValue) * mix);
        }
    }
    return resampled;
}

function valueToRouteColor(value, minValue, maxValue) {
    if (!Number.isFinite(value) || !Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue === minValue) {
        return '#FC5200';
    }
    const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    const hue = 220 - (normalized * 220);
    return `hsl(${hue}, 90%, 55%)`;
}

function getRouteColorSeries(streams, mode, pointCount) {
    if (!streams || mode === 'route') return null;

    let source = null;
    if (mode === 'heartrate') source = streams.heartrate?.data;
    if (mode === 'cadence') source = streams.cadence?.data;
    if (mode === 'altitude') source = streams.altitude?.data;
    if (mode === 'speed') source = streams.velocity_smooth?.data?.map(v => v * 3.6) || null;
    if (mode === 'pace') source = streams.velocity_smooth?.data?.map(v => (v > 0 ? 60 / (v * 3.6) : null)) || null;

    if (!source || !Array.isArray(source) || source.length < 2) return null;
    return resampleSeries(source, pointCount);
}

// =====================================================
// 5. RENDERING FUNCTIONS - MAPS & ROUTES
// =====================================================

/**
 * Renders interactive map with route polyline
 */
function renderActivityMap(activity, streams) {
    if (!DOM.map) return;

    if (window.L) {
        const coords = getActivityRouteCoordinates(activity, streams);
        if (coords.length > 0) {
            DOM.map.innerHTML = '';
            if (window.activityRouteMap) {
                window.activityRouteMap.remove();
                window.activityRouteMap = null;
            }
            const style = document.getElementById('activity-map-style')?.value || 'osm';
            const layer = MAP_LAYERS[style] || MAP_LAYERS.osm;

            const routeSelect = document.getElementById('route-color-mode');
            const availableModes = getAvailableRouteColorModes(streams);
            if (routeSelect) {
                const currentValue = routeSelect.value;
                routeSelect.innerHTML = availableModes.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('');
                routeSelect.value = availableModes.some(mode => mode.value === currentValue) ? currentValue : 'route';
            }

            const colorMode = routeSelect?.value || 'route';
            const routeValues = getRouteColorSeries(streams, colorMode, coords.length);
            const presentation = prepareStreamMapPresentation(coords, routeValues);
            const displayCoords = presentation.coordinates;
            const displayRouteValues = presentation.routeValues;
            if (presentation.status === 'too-fragmented') {
                DOM.map.textContent = 'Too fragmented to plot.';
                if (allowExternalWeatherForPage) {
                    renderWeatherAnalysis(activity, coords);
                    renderWeatherMapDetails(activity, coords, null, false);
                }
                return;
            }

            const map = L.map('activity-map').setView(displayCoords[0], 13);
            window.activityRouteMap = map;
            L.tileLayer(layer.url, layer.options).addTo(map);

            if (displayRouteValues) {
                const finiteValues = displayRouteValues.filter(Number.isFinite);
                const minValue = Math.min(...finiteValues);
                const maxValue = Math.max(...finiteValues);
                const group = L.featureGroup().addTo(map);

                for (let i = 1; i < displayCoords.length; i++) {
                    const value = displayRouteValues[i] ?? displayRouteValues[i - 1];
                    const color = valueToRouteColor(value, minValue, maxValue);
                    L.polyline([displayCoords[i - 1], displayCoords[i]], { color, weight: 4, opacity: 0.9 }).addTo(group);
                }

                map.fitBounds(group.getBounds());
            } else {
                const polyline = L.polyline(displayCoords, { color: '#FC5200', weight: 4 }).addTo(map);
                map.fitBounds(polyline.getBounds());
            }

            const mapStyleSelect = document.getElementById('activity-map-style');
            if (mapStyleSelect && !mapStyleSelect.dataset.bound) {
                mapStyleSelect.dataset.bound = '1';
                mapStyleSelect.addEventListener('change', () => renderActivityMap(activity, streams));
            }

            if (routeSelect && !routeSelect.dataset.bound) {
                routeSelect.dataset.bound = '1';
                routeSelect.addEventListener('change', () => renderActivityMap(activity, streams));
            }

            const weatherToggle = document.getElementById('show-weather-details');
            if (weatherToggle && !weatherToggle.dataset.bound) {
                weatherToggle.dataset.bound = '1';
                weatherToggle.addEventListener('change', () => renderActivityMap(activity, streams));
            }

            if (allowExternalWeatherForPage) {
                renderWeatherAnalysis(activity, coords);
                renderWeatherMapDetails(activity, coords, map, weatherToggle?.checked);
            }
        } else {
            DOM.map.innerHTML = '<p>No route data available (empty polyline).</p>';
            if (allowExternalWeatherForPage) {
                renderWeatherAnalysis(activity, []);
                renderWeatherMapDetails(activity, [], null, false);
            }
        }
    } else {
        DOM.map.innerHTML = '<p>No route data available or Leaflet not loaded.</p>';
        if (allowExternalWeatherForPage) {
            renderWeatherAnalysis(activity, []);
            renderWeatherMapDetails(activity, [], null, false);
        }
    }
}

/**
 * Renders splits charts (pace and HR by kilometer)
 */
function renderSplitsCharts(activity) {
    if (!DOM.splitsSection) return;

    if (activity.splits_metric && activity.splits_metric.length > 0) {
        DOM.splitsSection.classList.remove('hidden');
        const kmLabels = activity.splits_metric.map((_, i) => `Km ${i + 1}`);
        const paceData = activity.splits_metric.map(s => s.average_speed ? 1000 / s.average_speed : null);
        const hrData = activity.splits_metric.map(s => s.average_heartrate || null);

        createChart('chart-pace', {
            type: 'line',
            data: {
                labels: kmLabels,
                datasets: [{
                    label: 'Pace (s/km)',
                    data: paceData,
                    borderColor: '#FC5200',
                    backgroundColor: 'rgba(252, 82, 0, 0.07)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { reverse: true, title: { display: true, text: 'Pace (min/km)' } }
                }
            }
        });

        createChart('chart-heartrate', {
            type: 'line',
            data: {
                labels: kmLabels,
                datasets: [{
                    label: 'HR Avg (bpm)',
                    data: hrData,
                    borderColor: 'red',
                    backgroundColor: 'rgba(255, 0, 0, 0.07)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { title: { display: true, text: 'Heart Rate (bpm)' } }
                }
            }
        });
    } else {
        DOM.splitsSection.classList.add('hidden');
    }
}

// =====================================================
// 6. RENDERING FUNCTIONS - STREAM CHARTS
// =====================================================

/**
 * Renders detailed stream charts (altitude, pace, HR, cadence vs distance)
 */
function renderStreamCharts(streams, activity, smoothingLevel = 100) {
    if (!DOM.streamCharts) return;

    if (!streams || !streams.distance || !streams.distance.data || streams.distance.data.length === 0) {
        DOM.streamCharts.innerHTML = '<p>No detailed stream data available for this activity.</p>';
        return;
    }

    const { distance, time, heartrate, altitude, cadence } = streams;
    const distLabels = distance.data.map(d => (d / 1000).toFixed(2));

    // Calculate window sizes based on smoothing level (0-200 scale, 100 is default)
    const smoothingFactor = smoothingLevel / 100;
    const windowSizes = {
        altitude: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.altitude * smoothingFactor)),
        pace: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.pace * smoothingFactor)),
        heartrate: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.heartrate * smoothingFactor)),
        cadence: Math.max(1, Math.round(CONFIG.WINDOW_SIZES.cadence * smoothingFactor)),
        watts: Math.max(1, Math.round(60 * smoothingFactor)),
    };

    // Helper function to create individual stream charts
    function createStreamChart(canvasId, label, data, colorKey, yAxisReverse = false) {
        const colors = getClassificationBasedColors();
        const color = colors[colorKey] ? colors[colorKey].primary : chartColors[colorKey].primary;
        const bgColor = colors[colorKey] ? colors[colorKey].secondary : chartColors[colorKey].secondary;

        createStreamPresentationChart(canvasId, {
            type: 'line',
            data: {
                labels: distLabels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: bgColor,
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Distance (km)' } },
                    y: { reverse: yAxisReverse, title: { display: true, text: label } }
                }
            }
        });
    }

    function setChartContainerVisibility(canvasId, visible) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !canvas.parentElement) return;
        canvas.parentElement.style.display = visible ? '' : 'none';
    }

    const hasAltitude = !!(altitude && altitude.data && altitude.data.length > 0);
    const hasPace = !!(time && time.data && distance && distance.data && distance.data.length > 1);
    const hasHeartrate = !!(heartrate && heartrate.data && heartrate.data.length > 0);
    const hasCadence = !!(cadence && cadence.data && cadence.data.length > 0);
    const watts = streams.watts;
    const hasWatts = !!(watts && watts.data && watts.data.some(w => w > 0));

    setChartContainerVisibility('chart-altitude', hasAltitude);
    setChartContainerVisibility('chart-pace-distance', hasPace);
    setChartContainerVisibility('chart-heart-distance', hasHeartrate);
    setChartContainerVisibility('chart-cadence-distance', hasCadence);
    setChartContainerVisibility('chart-watts-distance', hasWatts);

    const visibleCharts = [hasAltitude, hasPace, hasHeartrate, hasCadence, hasWatts].filter(Boolean).length;
    DOM.streamCharts.style.display = visibleCharts > 0 ? 'grid' : 'none';

    // Altitude chart
    if (hasAltitude) {
        const smoothAltitude = restoreStreamGapMask(
            rollingMean(altitude.data, windowSizes.altitude),
            originalStreamData?.altitude?.data || altitude.data
        );
        createStreamChart('chart-altitude', 'Altitud (m)', smoothAltitude, 'altitude');
    }

    // Pace chart
    if (hasPace) {
        const paceStreamData = [];
        for (let i = 1; i < distance.data.length; i++) {
            const deltaDist = distance.data[i] - distance.data[i - 1];
            const deltaTime = time.data[i] - time.data[i - 1];
            if (deltaDist > 0 && deltaTime > 0) {
                const speed = deltaDist / deltaTime;
                paceStreamData.push(1000 / speed / 60);
            } else {
                paceStreamData.push(null);
            }
        }
        const smoothPaceStreamData = restoreStreamGapMask(
            rollingMean(paceStreamData, windowSizes.pace),
            paceStreamData
        );
        const paceLabels = distLabels.slice(1);

        const colors = getClassificationBasedColors();
        const paceColor = colors.pace ? colors.pace.primary : chartColors.pace.primary;
        const paceBgColor = colors.pace ? colors.pace.secondary : chartColors.pace.secondary;

        createStreamPresentationChart('chart-pace-distance', {
            type: 'line',
            data: {
                labels: paceLabels,
                datasets: [{
                    label: 'Ritmo (min/km)',
                    data: smoothPaceStreamData,
                    borderColor: paceColor,
                    backgroundColor: paceBgColor,
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Distance (km)' } },
                    y: { reverse: true, title: { display: true, text: 'Ritmo (min/km)' } }
                }
            }
        });
    }

    // Heart rate chart
    if (hasHeartrate) {
        const smoothHeartrate = restoreStreamGapMask(
            rollingMean(heartrate.data, windowSizes.heartrate),
            originalStreamData?.heartrate?.data || heartrate.data
        );
        createStreamChart('chart-heart-distance', 'FC (bpm)', smoothHeartrate, 'heartrate');
    }

    // Cadence chart
    if (hasCadence) {
        const cadenceData = activity.type === 'Run' ? cadence.data.map(c => c * 2) : cadence.data;
        const smoothCadence = restoreStreamGapMask(
            rollingMean(cadenceData, windowSizes.cadence),
            originalStreamData?.cadence?.data || cadence.data
        );
        createStreamChart('chart-cadence-distance', 'Cadencia (spm)', smoothCadence, 'cadence');
    }

    // Power (watts) chart
    if (hasWatts) {
        const smoothWatts = restoreStreamGapMask(
            rollingMean(watts.data, windowSizes.watts),
            originalStreamData?.watts?.data || watts.data
        );
        createStreamChart('chart-watts-distance', 'Power (W)', smoothWatts, 'watts');
    }
}

// =====================================================
// 7. RENDERING FUNCTIONS - TABLES
// =====================================================

/**
 * Renders best efforts table
 */
function renderBestEfforts(bestEfforts) {
    const section = document.getElementById('best-efforts-section');
    const table = document.getElementById('best-efforts-table');
    if (!section || !table) return;

    if (!bestEfforts || bestEfforts.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const tableHead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const label of ['Distance', 'Time', 'Pace', 'Achievements']) {
        const cell = document.createElement('th');
        cell.textContent = label;
        headerRow.append(cell);
    }
    tableHead.append(headerRow);
    const tableBody = document.createElement('tbody');
    for (const effort of bestEfforts) {
        const pace = formatPace(effort.distance / effort.moving_time);
        const achievements = effort.pr_rank ? `🏆 PR #${effort.pr_rank}` : (effort.achievements.length > 0 ? '🏅' : '');
        const row = document.createElement('tr');
        for (const value of [effort.name, formatTime(effort.moving_time), pace, achievements]) {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.append(cell);
        }
        tableBody.append(row);
    }
    table.replaceChildren(tableHead, tableBody);
}

/**
 * Renders laps table
 */
export function renderLaps(laps) {
    const section = document.getElementById('laps-section');
    const table = document.getElementById('laps-table');
    if (!section || !table) return;

    if (!laps || laps.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const tableHeader = `
    <thead>
        <tr>
            <th>Lap</th>
            <th>Distance</th>
            <th>Time</th>
            <th>Pace</th>
            <th>Elev. Gain</th>
            <th>Avg HR</th>
        </tr>
    </thead>`;

    const tableBody = laps.map(lap => {
        const pace = formatPace(lap.average_speed);
        const distance = Number.isFinite(lap.distance) ? `${(lap.distance / 1000).toFixed(2)} km` : '-';
        const movingTime = Number.isFinite(lap.moving_time) ? formatTime(lap.moving_time) : '-';
        const elevation = Number.isFinite(lap.total_elevation_gain) ? `${Math.round(lap.total_elevation_gain)} m` : '-';
        return `
        <tr>
            <td>${lap.lap_index}</td>
            <td>${distance}</td>
            <td>${movingTime}</td>
            <td>${pace}</td>
            <td>${elevation}</td>
            <td>${lap.average_heartrate ? Math.round(lap.average_heartrate) : '-'} bpm</td>
        </tr>`;
    }).join('');

    table.innerHTML = tableHeader + `<tbody>${tableBody}</tbody>`;
}

/**
 * Renders laps pace chart
 */
export function renderLapsChart(laps) {
    const canvas = document.getElementById('laps-chart');
    const section = document.getElementById('laps-chart-section');
    if (!canvas || !section || !laps || laps.length === 0) return;

    const chartLaps = laps.filter(lap => Number.isFinite(lap.average_speed) && lap.average_speed > 0);
    if (chartLaps.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    const labels = chartLaps.map((lap, i) => `Lap ${lap.lap_index ?? i + 1}`);
    const paces = chartLaps.map(lap => 1000 / lap.average_speed);
    const minPace = Math.min(...paces);
    const maxPace = Math.max(...paces);

    const colors = paces.map(pace => {
        const t = (pace - minPace) / (maxPace - minPace || 1);
        const lightness = 35 + t * 35;
        return `hsl(15, 90%, ${lightness}%)`;
    });

    createChart('laps-chart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Pace (min/km)',
                data: paces,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Lap' } },
                y: {
                    reverse: true,
                    beginAtZero: false,
                    title: { display: true, text: 'Pace (min/km)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: ctx => labels[ctx[0].dataIndex],
                        label: ctx => {
                            const lap = chartLaps[ctx.dataIndex];
                            return `Pace: ${formatPace(lap.average_speed)}`;
                        },
                        afterLabel: ctx => {
                            const lap = chartLaps[ctx.dataIndex];
                            return [
                                `Distance: ${Number.isFinite(lap.distance) ? `${(lap.distance / 1000).toFixed(2)} km` : '-'}`,
                                `Time: ${Number.isFinite(lap.moving_time) ? formatTime(lap.moving_time) : '-'}`,
                                `Elevation: ${Number.isFinite(lap.total_elevation_gain) ? `${Math.round(lap.total_elevation_gain)} m` : '-'}`,
                                `Avg HR: ${lap.average_heartrate ? Math.round(lap.average_heartrate) : '-'} bpm`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders segment efforts table
 */
function renderSegments(segments) {
    const section = document.getElementById('segments-section');
    const table = document.getElementById('segments-table');
    if (!section || !table) return;

    if (!segments || segments.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const tableHead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const label of ['Segment Name', 'Time', 'Pace', 'Avg HR', 'Rank']) {
        const cell = document.createElement('th');
        cell.textContent = label;
        headerRow.append(cell);
    }
    tableHead.append(headerRow);
    const tableBody = document.createElement('tbody');
    for (const effort of segments) {
        const pace = formatPace(effort.distance / effort.moving_time);
        let rank = '';
        if (effort.pr_rank === 1) {
            rank = '🏆 PR!';
        } else if (effort.pr_rank) {
            rank = `PR #${effort.pr_rank}`;
        } else if (effort.kom_rank === 1) {
            rank = '👑 KOM/QOM!';
        } else if (effort.kom_rank) {
            rank = `Top ${effort.kom_rank}`;
        }
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const segmentLink = document.createElement('a');
        segmentLink.href = `https://www.strava.com/segments/${encodeURIComponent(String(effort.segment.id))}`;
        segmentLink.target = '_blank';
        segmentLink.rel = 'noopener noreferrer';
        segmentLink.textContent = String(effort.name);
        nameCell.append(segmentLink);
        row.append(nameCell);
        for (const value of [
            formatTime(effort.moving_time),
            pace,
            `${effort.average_heartrate ? Math.round(effort.average_heartrate) : '-'} bpm`,
            rank
        ]) {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.append(cell);
        }
        tableBody.append(row);
    }
    table.replaceChildren(tableHead, tableBody);
}

// =====================================================
// 8. RENDERING FUNCTIONS - ZONE & AREA CHARTS
// =====================================================

/**
 * Renders HR zone distribution chart
 */
function renderHrZoneDistributionChart(streams, zones) {
    const canvas = document.getElementById('hr-zones-chart');
    const section = document.getElementById('hr-zones-section');
    if (!canvas || !section) return;
    if (!streams.heartrate || !streams.time) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    const configuredZones = zones?.heart_rate?.zones;
    const hrZones = Array.isArray(configuredZones)
        ? configuredZones.filter(zone => zone && typeof zone === 'object' && zone.max > 0)
        : null;

    if (!hrZones || hrZones.length === 0) {
        return;
    }

    const timeInZones = calculateTimeInZones(streams.heartrate, streams.time, hrZones);
    const labels = hrZones.map((zone, i) => `Z${i + 1} (${zone.min}-${zone.max === -1 ? '∞' : zone.max})`);
    const data = timeInZones.map(time => +(time / 60).toFixed(1));

    const gradientColors = ['#fde0e0', '#fababa', '#fa7a7a', '#f44336', '#b71c1c'];

    createChart('hr-zones-chart', {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Time in Zone (min)',
                data: data,
                backgroundColor: gradientColors.slice(0, hrZones.length),
                borderColor: gradientColors.slice(0, hrZones.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} min`;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'HR Zone' } },
                y: { title: { display: true, text: 'Time (min)' }, beginAtZero: true }
            }
        }
    });
}

/**
 * Renders HR min/max/avg area chart segmented over distance
 */
function renderHrMinMaxAreaChart(streams, smoothingLevel = 100) {
    const canvas = document.getElementById('hr-minmax-area-chart');
    const section = document.getElementById('hr-min-max-area-section');

    if (!canvas || !section) return;

    if (!streams.heartrate || !streams.distance || !Array.isArray(streams.heartrate.data) || streams.heartrate.data.length < 2) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const hr = streams.heartrate.data;
    const dist = streams.distance.data;
    const totalDist = dist[dist.length - 1];
    const segmentLength = totalDist / CONFIG.NUM_SEGMENTS;

    const minArr = [], maxArr = [], avgArr = [], labels = [];
    let segEnd = segmentLength, i = 0;

    for (let s = 0; s < CONFIG.NUM_SEGMENTS; s++) {
        const hrVals = [];
        while (i < dist.length && dist[i] < segEnd) {
            if (hr[i] !== null && hr[i] !== undefined) hrVals.push(hr[i]);
            i++;
        }

        if (hrVals.length === 0) {
            minArr.push(minArr.length ? minArr[minArr.length - 1] : null);
            maxArr.push(maxArr.length ? maxArr[maxArr.length - 1] : null);
            avgArr.push(avgArr.length ? avgArr[avgArr.length - 1] : null);
        } else {
            minArr.push(Math.min(...hrVals));
            maxArr.push(Math.max(...hrVals));
            avgArr.push(hrVals.reduce((a, b) => a + b, 0) / hrVals.length);
        }

        labels.push((segEnd / 1000).toFixed(2));
        segEnd += segmentLength;
    }

    // Apply smoothing to the variability arrays based on smoothing level
    const smoothingWindow = Math.max(1, Math.round(8 * smoothingLevel / 100));
    const smoothMinArr = rollingMean(minArr, smoothingWindow);
    const smoothMaxArr = rollingMean(maxArr, smoothingWindow);
    const smoothAvgArr = rollingMean(avgArr, smoothingWindow);

    createChart('hr-minmax-area-chart', {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'HR Min',
                    data: smoothMinArr,
                    fill: '+1',
                    backgroundColor: 'rgba(252,82,0,0.3)',
                    borderColor: 'rgba(252,82,0,0.6)',
                    pointRadius: 0,
                    order: 1
                },
                {
                    label: 'HR Max',
                    data: smoothMaxArr,
                    fill: '-1',
                    backgroundColor: 'rgba(252,82,0,0.3)',
                    borderColor: 'rgba(252,82,0,0.6)',
                    pointRadius: 0,
                    order: 1
                },
                {
                    label: 'HR Avg',
                    data: smoothAvgArr,
                    fill: false,
                    borderColor: '#FC5200',
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${Math.round(context.parsed.y)} bpm`
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Distance (km)' } },
                y: { title: { display: true, text: 'Heart Rate (bpm)' }, beginAtZero: false }
            }
        }
    });
}

/**
 * Renders pace min/max/avg area chart segmented over distance
 */
function renderPaceMinMaxAreaChart(streams, smoothingLevel = 100) {
    const canvas = document.getElementById('pace-min-max-area-chart');
    const section = document.getElementById('pace-min-max-area-section');

    if (!canvas || !section) return;

    if (!streams.distance || !streams.time || !Array.isArray(streams.distance.data) || streams.distance.data.length < 2) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const dist = streams.distance.data;
    const time = streams.time.data;
    const totalDist = dist[dist.length - 1];
    const segmentLength = totalDist / CONFIG.NUM_SEGMENTS;

    const minArr = [], maxArr = [], avgArr = [], labels = [];
    let segEnd = segmentLength, i = 0;

    for (let s = 0; s < CONFIG.NUM_SEGMENTS; s++) {
        const paceVals = [];
        while (i < dist.length && dist[i] < segEnd) {
            if (i > 0 && dist[i] > dist[i - 1]) {
                const deltaDist = dist[i] - dist[i - 1];
                const deltaTime = time[i] - time[i - 1];
                if (deltaDist > 0 && deltaTime > 0) {
                    const speed = deltaDist / deltaTime;
                    paceVals.push(1000 / speed / 60);
                }
            }
            i++;
        }

        if (paceVals.length === 0) {
            minArr.push(minArr.length ? minArr[minArr.length - 1] : null);
            maxArr.push(maxArr.length ? maxArr[maxArr.length - 1] : null);
            avgArr.push(avgArr.length ? avgArr[avgArr.length - 1] : null);
        } else {
            minArr.push(Math.min(...paceVals));
            maxArr.push(Math.max(...paceVals));
            avgArr.push(paceVals.reduce((a, b) => a + b, 0) / paceVals.length);
        }

        labels.push((segEnd / 1000).toFixed(2));
        segEnd += segmentLength;
    }

    // Apply smoothing to the variability arrays based on smoothing level
    const smoothingWindow = Math.max(1, Math.round(8 * smoothingLevel / 100));
    const smoothMinArr = rollingMean(minArr, smoothingWindow);
    const smoothMaxArr = rollingMean(maxArr, smoothingWindow);
    const smoothAvgArr = rollingMean(avgArr, smoothingWindow);

    createChart('pace-min-max-area-chart', {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Pace Min',
                    data: smoothMinArr,
                    fill: '+1',
                    backgroundColor: 'rgba(0, 123, 255, 0.25)',
                    borderColor: 'rgba(0, 123, 255, 0.5)',
                    pointRadius: 0,
                    order: 1
                },
                {
                    label: 'Pace Max',
                    data: smoothMaxArr,
                    fill: '-1',
                    backgroundColor: 'rgba(0, 123, 255, 0.25)',
                    borderColor: 'rgba(0, 123, 255, 0.5)',
                    pointRadius: 0,
                    order: 1
                },
                {
                    label: 'Pace Avg',
                    data: smoothAvgArr,
                    fill: false,
                    borderColor: '#007BFF',
                    borderWidth: 2,
                    pointRadius: 0,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${sharedFormatPace(context.parsed.y * 60, 1)}`
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Distance (km)' } },
                y: {
                    reverse: true,
                    beginAtZero: false,
                    title: { display: true, text: 'Pace (min/km)' },
                    ticks: {
                        callback: value => sharedFormatPace(Number(value) * 60, 1)
                    }
                }
            }
        }
    });
}

/**
 * Renders run classification results
 */
function renderClassifierResults(classificationData) {
    const container = document.getElementById('run-classifier-results');
    if (!container) return;

    // Store classification for chart styling
    currentRunClassification = classificationData;

    const heroType = document.getElementById('activity-hero-type');

    const results = classificationData ? classificationData.top : null;
    const confidence = classificationData?.confidence || null;

    if (!results || results.length === 0) {
        container.innerHTML = '<p>Could not classify this run.</p>';
        return;
    }

    if (heroType && results[0]) {
        heroType.textContent = `${results[0].type} (${results[0].pct}%)`;
    }

    const resultsHtml = results.map((result, index) => {
        const color = index === 0 ? '#FC5200' : index === 1 ? '#6b7280' : '#a0aec0';
        return `
            <div class="classifier-result">
                <div class="classifier-type" style="color: ${color};">${result.type}</div>
                <div class="classifier-bar-container">
                    <div class="classifier-bar" style="width: ${result.pct}%; background-color: ${color};"></div>
                </div>
                <div class="classifier-score" style="color: ${color};">${result.pct}%</div>
            </div>`;
    }).join('');

    const confidenceColor = confidence?.level === 'high'
        ? '#166534'
        : confidence?.level === 'medium'
            ? '#92400e'
            : '#991b1b';

    const confidenceHtml = confidence
        ? `<div style="margin:0 0 10px 0; padding:8px 10px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-size:12px; color:#334155;">
                <div style="font-weight:700; color:${confidenceColor};">Confidence: ${Math.round(confidence.score * 100)}% (${confidence.level})</div>
                <div>Feature coverage: ${confidence.coverage}% · Top-class margin: ${confidence.margin}%</div>
                ${confidence.missingFeatures?.length ? `<div style="margin-top:4px; color:#64748b;">Missing/weak signals: ${confidence.missingFeatures.join(', ')}</div>` : ''}
           </div>`
        : '';

    container.innerHTML = confidenceHtml + resultsHtml;
}

// =====================================================
// 9. MAIN INITIALIZATION
// =====================================================

/**
 * Main entry point - loads activity data and renders all sections
 */
export async function renderRunPage({ activity, streams, zones, athlete, activityId, activitySource, allowExternalWeather }) {
    moveAndHideCustomChartSection();
    allowExternalWeatherForPage = allowExternalWeather === true;

    if (DOM.streamCharts) DOM.streamCharts.style.display = 'grid';

    const activityData = structuredClone(activity);
    const streamData = structuredClone(streams);

        // Calculate variability metrics from streams
        let paceVariabilityStream = '-';
        let hrVariabilityStream = '-';

        if (streamData && streamData.time && streamData.distance) {
            const paceStream = [];
            for (let i = 1; i < streamData.distance.data.length; i++) {
                const deltaDist = streamData.distance.data[i] - streamData.distance.data[i - 1];
                const deltaTime = streamData.time.data[i] - streamData.time.data[i - 1];
                if (deltaDist > 0 && deltaTime > 0) {
                    paceStream.push(deltaTime / deltaDist);
                }
            }
            const smoothingWindowForVariability = Math.max(1, Math.round(240 * (currentSmoothingLevel / 100)));
            paceVariabilityStream = calculateVariability(paceStream, smoothingWindowForVariability);
        }

        if (streamData && streamData.heartrate) {
            const smoothingWindowForVariability = Math.max(1, Math.round(240 * (currentSmoothingLevel / 100)));
            hrVariabilityStream = calculateVariability(streamData.heartrate.data, smoothingWindowForVariability);
        }

        // Calculate variability metrics from laps
        let paceVariabilityLaps = '-';
        let hrVariabilityLaps = '-';
        const lapsData = activityData.laps && activityData.laps.length > 1
            ? activityData.laps
            : activityData.splits_metric;

        if (lapsData && lapsData.length > 1) {
            const paceDataForCV = lapsData.map(lap => lap.average_speed);
            const hrDataForCV = lapsData.map(lap => lap.average_heartrate);
            paceVariabilityLaps = calculateVariability(paceDataForCV, false);
            hrVariabilityLaps = calculateVariability(hrDataForCV, false);
        }

        // Attach variability metrics to activity object
        activityData.pace_variability_stream = paceVariabilityStream;
        activityData.hr_variability_stream = hrVariabilityStream;
        activityData.pace_variability_laps = paceVariabilityLaps;
        activityData.hr_variability_laps = hrVariabilityLaps;

        // Store original stream data BEFORE applying smoothing
        originalStreamData = JSON.parse(JSON.stringify(streamData));
        lastActivityData = activityData;

        // Populate original dynamic chart data (for secondary and background stats)
        populateDynamicChartData(originalStreamData, true);

        // Apply initial smoothing to streams
        const initialSmoothedStreams = applySmoothingToStreams(originalStreamData, currentSmoothingLevel);

        // Populate dynamic chart data with smoothed data (for primary stat)
        populateDynamicChartData(initialSmoothedStreams, false);

        // Render all sections
        renderActivityInfo(activityData, activitySource);
        renderActivityStats(activityData);
        renderAdvancedStats(activityData);
        renderActivityMap(activityData, streamData);
        renderSplitsCharts(activityData);
        renderStreamCharts(initialSmoothedStreams, activityData, currentSmoothingLevel);
        renderBestEfforts(activityData.best_efforts);
        renderLaps(activityData.laps);
        renderLapsChart(activityData.laps);
        renderSegments(activityData.segment_efforts);
        renderClassifierResults(classifyRun(activityData, streamData, zones));
        renderHrZoneDistributionChart(streamData, zones);
        renderHrMinMaxAreaChart(initialSmoothedStreams, currentSmoothingLevel);
        renderPaceMinMaxAreaChart(initialSmoothedStreams, currentSmoothingLevel);
        syncSideBySideContainers();

        // Initialize smoothing slider control
        // Initialize dynamic chart controls
        initDynamicChartControls();

    if (DOM.streamCharts) DOM.streamCharts.style.display = '';
}
