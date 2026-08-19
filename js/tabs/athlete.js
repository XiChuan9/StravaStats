// js/athlete.js — refactored: grouped sections and comments
import * as utils from './utils.js';

// -------------------------
// Module state / constants
// -------------------------
let currentDataType = 'time';
let currentActivityFrequencyPeriod = 'daily';
let uiCharts = {}; // cache chart instances for athlete tab
let interactiveMatrixChart;
let athleteActivities = [];

const UNAVAILABLE_VALUE = '—';
const MAX_DURATION_HISTOGRAM_BUCKETS = 200;

function readNonnegativeFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

function readAthleteCount(value) {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function readActivityDate(activity) {
    const rawDate = activity?.start_date_local || activity?.start_date;
    const date = new Date(rawDate);
    return Number.isFinite(date.getTime()) ? date : null;
}

function readActivityDateKey(activity) {
    const date = readActivityDate(activity);
    if (!date) return null;

    const rawDate = activity?.start_date_local || activity?.start_date;
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        return rawDate.slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
}

function clearUiChart(canvasId) {
    const chart = uiCharts[canvasId];
    if (chart && typeof chart.destroy === 'function') chart.destroy();
    delete uiCharts[canvasId];
}

function normalizeTrendsDataType(dataType) {
    return ['count', 'time', 'distance'].includes(dataType) ? dataType : 'count';
}

function readTrendsMetric(activity, dataType) {
    if (dataType === 'count') return 1;
    if (dataType === 'time') {
        const movingTime = readNonnegativeFiniteNumber(activity?.moving_time);
        return movingTime === null ? null : movingTime / 3600;
    }
    if (dataType === 'distance') {
        const distance = readNonnegativeFiniteNumber(activity?.distance);
        return distance === null ? null : distance / 1000;
    }
    return null;
}

function addFiniteAggregate(total, value) {
    const next = total + value;
    return Number.isFinite(next) ? next : total;
}

function summarizeMetric(activities, property) {
    let total = 0;
    let count = 0;
    for (const activity of activities) {
        const value = readNonnegativeFiniteNumber(activity?.[property]);
        if (value === null) continue;
        const next = total + value;
        if (!Number.isFinite(next)) continue;
        total = next;
        count++;
    }
    return { total, count };
}

function formatActivityDate(activity, date) {
    const rawDate = activity?.start_date_local || activity?.start_date;
    if (typeof rawDate === 'string' && rawDate.length >= 10) {
        return rawDate.substring(0, 10);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createActivityLink(activityId, label = 'View') {
    const routeId = typeof activityId === 'string' && activityId.length > 0
        ? activityId
        : (Number.isSafeInteger(activityId) && activityId >= 0 ? String(activityId) : null);
    if (routeId === null) {
        return document.createTextNode(label);
    }
    const params = new URLSearchParams();
    params.set('id', routeId);
    const link = document.createElement('a');
    link.href = `html/activity-router.html?${params.toString()}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
}

function createChartError() {
    const errorText = document.createElement('p');
    errorText.style.color = 'red';
    errorText.style.padding = '20px';
    errorText.textContent = 'Error rendering chart.';
    return errorText;
}

// -------------------------
// Public API
// -------------------------
export function selectTrendsMetadataContext(context = {}) {
    const athleteData = context?.athleteData;
    const zonesData = context?.zonesData;
    const analysisProfileStatus = context?.analysisProfileStatus;
    return Object.freeze({
        athleteData: athleteData && typeof athleteData === 'object' && !Array.isArray(athleteData)
            ? athleteData
            : null,
        zonesData: zonesData && typeof zonesData === 'object' && !Array.isArray(zonesData)
            ? zonesData
            : null,
        analysisProfileStatus: ['configured', 'unconfigured'].includes(analysisProfileStatus)
            ? analysisProfileStatus
            : null
    });
}

export function renderTrendsTab(
    allActivities,
    dateFilterFrom,
    dateFilterTo,
    sportFilter = 'all',
    dataType = 'time',
    metadataContext = {}
) {
    // Public entry to render the Trends tab. Keeps signature used by `main.js`.
    currentDataType = normalizeTrendsDataType(dataType);
    athleteActivities = Array.isArray(allActivities) ? allActivities : [];

    // Ensure filters UI exists (will insert only once)
    addAthleteFilters();

    // Update filter UI to reflect current state
    const sportSelect = document.getElementById('trends-sport-filter');
    const dataTypeSelect = document.getElementById('trends-data-type');
    const dateFromInput = document.getElementById('trends-date-from');
    const dateToInput = document.getElementById('trends-date-to');

    if (sportSelect) {
        const selectedSports = Array.isArray(sportFilter)
            ? sportFilter
            : (sportFilter && sportFilter !== 'all' ? [sportFilter] : []);

        populateAthleteSportOptions(sportSelect, selectedSports);
    }
    if (dataTypeSelect) dataTypeSelect.value = currentDataType;
    if (dateFromInput) dateFromInput.value = utils.isoToDisplayDate(dateFilterFrom);
    if (dateToInput) dateToInput.value = utils.isoToDisplayDate(dateFilterTo);

    // Apply filtering using the unified helper
    const filteredActivities = filterActivities(athleteActivities, dateFilterFrom, dateFilterTo, sportFilter);

    const { athleteData, zonesData, analysisProfileStatus } =
        selectTrendsMetadataContext(metadataContext);

    if (athleteData) renderAthleteProfile(athleteData);
    renderTrainingZones(zonesData, {
        localHeartRateProfile: analysisProfileStatus !== null,
        analysisProfileStatus
    });

    // Render panels & charts (order: summary, records, charts)
    renderAllTimeStats(filteredActivities);
    renderRecordStats(filteredActivities);
    renderAthleteCountHistogram(filteredActivities, currentDataType);
    renderActivityFrequencyHistogram(filteredActivities, currentActivityFrequencyPeriod);
    renderTransitions(filteredActivities);

    // Charts: use the filtered activity set for all visualizations
    renderStartTimeHistogram(filteredActivities, currentDataType);
    renderDurationHistogram(filteredActivities);
    renderYearlyComparison(filteredActivities, currentDataType);
    renderWeeklyMixChart(filteredActivities, currentDataType);
    renderMonthlyMixChart(filteredActivities, currentDataType);
    renderHourMatrix(filteredActivities, currentDataType);
    renderYearMonthMatrix(filteredActivities, currentDataType);
    renderMonthWeekdayMatrix(filteredActivities, currentDataType);
    renderMonthDayMatrix(filteredActivities, currentDataType);
    renderMonthHourMatrix(filteredActivities, currentDataType);
    renderYearHourMatrix(filteredActivities, currentDataType);
    renderYearWeekdayMatrix(filteredActivities, currentDataType);
    renderInteractiveMatrix(filteredActivities, currentDataType);

}
function renderAllTimeStats(activities) {
    const container = document.getElementById('all-time-stats-cards');
    if (!container) return;
    const distance = summarizeMetric(activities, 'distance');
    const movingTime = summarizeMetric(activities, 'moving_time');
    const elevation = summarizeMetric(activities, 'total_elevation_gain');
    const totalDist = distance.count > 0 ? `${(distance.total / 1000).toFixed(0)} km` : UNAVAILABLE_VALUE;
    const totalTime = movingTime.count > 0 ? `${(movingTime.total / 3600).toFixed(1)} h` : UNAVAILABLE_VALUE;
    const totalElev = elevation.count > 0 ? `${elevation.total.toLocaleString()} m` : UNAVAILABLE_VALUE;
    container.innerHTML = `
        <div class="card"><h3>Total Activities</h3><p>${activities.length}</p></div>
        <div class="card"><h3>Total Distance</h3><p>${totalDist}</p></div>
        <div class="card"><h3>Total Time</h3><p>${totalTime}</p></div>
        <div class="card"><h3>Total Elevation</h3><p>${totalElev}</p></div>
    `;
}

function renderAthleteCountHistogram(activities, dataType = 'count') {
    const container = document.getElementById('athlete-count-histogram');
    if (!container) return;
    if (activities.length === 0) {
        clearUiChart('athlete-count-histogram');
        return;
    }

    const categories = {
        solo: {
            total: 0,
            count: 0,
            label: '🏃 Solo',
            color: 'rgba(100, 200, 255, 0.8)'
        },
        duo: {
            total: 0,
            count: 0,
            label: '👥 Duo',
            color: 'rgba(100, 255, 200, 0.8)'
        },
        smallGroup: {
            total: 0,
            count: 0,
            label: '👫 Small Group',
            color: 'rgba(255, 200, 100, 0.8)'
        },
        largeGroup: {
            total: 0,
            count: 0,
            label: '👨‍👩‍👧‍👦 Large Group',
            color: 'rgba(255, 100, 150, 0.8)'
        }
    };

    activities.forEach(activity => {
        const athleteCount = readAthleteCount(activity?.athlete_count);
        const value = readTrendsMetric(activity, dataType);
        if (athleteCount === null || value === null) return;

        let bucket;
        if (athleteCount === 1) bucket = categories.solo;
        else if (athleteCount === 2) bucket = categories.duo;
        else if (athleteCount >= 3 && athleteCount <= 15) bucket = categories.smallGroup;
        else bucket = categories.largeGroup;

        bucket.count++;
        bucket.total = addFiniteAggregate(bucket.total, value);
    });

    if (Object.values(categories).every(category => category.count === 0)) {
        clearUiChart('athlete-count-histogram');
        return;
    }

    const labels = Object.values(categories).map(c => c.label);
    const data = Object.values(categories).map(c => c.total);
    const colors = Object.values(categories).map(c => c.color);

    const labelMap = {
        count: 'Number of Activities',
        time: 'Total Time (h)',
        distance: 'Total Distance (km)'
    };

    const displayLabel = labelMap[dataType] || labelMap.count;

    createUiChart('athlete-count-histogram', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: displayLabel,
                data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const bucket = Object.values(categories)[context.dataIndex];
                            const valueText = dataType === 'count'
                                ? `${bucket.total}`
                                : `${bucket.total.toFixed(1)} ${dataType === 'time' ? 'h' : 'km'}`;
                            return `${displayLabel}: ${valueText}`;
                        },
                        afterLabel: function(context) {
                            const bucket = Object.values(categories)[context.dataIndex];
                            return `Activities: ${bucket.count}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: displayLabel
                    }
                }
            }
        }
    });
}

function getWeekLabel(date) {
    const cloned = new Date(date.getTime());
    const day = cloned.getDay() || 7;
    cloned.setHours(0, 0, 0, 0);
    cloned.setDate(cloned.getDate() + 1 - day);
    const year = cloned.getFullYear();
    const weekNum = Math.ceil((((cloned - new Date(year, 0, 1)) / 86400000) + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function renderActivityFrequencyHistogram(activities, period = 'daily') {
    const container = document.getElementById('activity-frequency-histogram');
    if (!container) return;

    const frequency = {
        daily: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        weekly: date => getWeekLabel(date),
        monthly: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    };

    const totals = {};
    activities.forEach(activity => {
        const date = readActivityDate(activity);
        if (!date) return;
        const value = readTrendsMetric(activity, currentDataType);
        if (value === null) return;
        const key = frequency[period](date);
        totals[key] = addFiniteAggregate(totals[key] || 0, value);
    });

    const entries = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = entries.map(([label]) => label);
    const data = entries.map(([, value]) => +value.toFixed(2));

    const labelMap = {
        count: '# Activities',
        time: 'Hours',
        distance: 'Distance (km)'
    };
    const yLabel = labelMap[currentDataType] || labelMap.count;

    createUiChart('activity-frequency-histogram', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: yLabel,
                data,
                backgroundColor: 'rgba(66, 133, 244, 0.75)',
                borderColor: 'rgba(66, 133, 244, 1)',
                borderWidth: 1,
                barPercentage: 0.9,
                categoryPercentage: 0.95
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `Activity Frequency (${period})`
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${yLabel}: ${ctx.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Period' },
                    ticks: { maxRotation: 45, minRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: yLabel }
                }
            }
        }
    });

    // Also render the per-period distribution (how many activities/km/hours in a single day/week)
    renderPerPeriodDistribution(activities, period);
}

function renderPerPeriodDistribution(activities, period = 'daily') {
    const container = document.getElementById('per-period-distribution');
    if (!container) return;

    const frequency = {
        daily: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        weekly: date => getWeekLabel(date),
        monthly: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    };

    const totals = {};
    activities.forEach(activity => {
        const date = readActivityDate(activity);
        if (!date) return;
        const value = readTrendsMetric(activity, currentDataType);
        if (value === null) return;
        const key = frequency[period](date);
        totals[key] = addFiniteAggregate(totals[key] || 0, value);
    });

    const values = Object.values(totals);
    if (values.length === 0) {
        clearUiChart('per-period-distribution');
        return;
    }

    // Build histogram of "how many periods had N activities/km/hours"
    const max = Math.max(...values);
    const isCount = currentDataType === 'count';
    const binSize = isCount ? 1 : (max <= 10 ? 1 : max <= 50 ? 5 : 10);
    const numBins = Math.min(30, Math.ceil(max / binSize) + 1);
    const bins = new Array(numBins).fill(0);

    values.forEach(v => {
        const idx = Math.min(numBins - 1, Math.floor(v / binSize));
        bins[idx]++;
    });

    const labelMap = {
        count: 'activities',
        time: 'hours',
        distance: 'km'
    };
    const unit = labelMap[currentDataType] || 'activities';
    const periodLabel = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    const labels = bins.map((_, i) => {
        if (isCount) return `${i * binSize}`;
        return `${(i * binSize).toFixed(0)}-${((i + 1) * binSize).toFixed(0)}`;
    });

    createUiChart('per-period-distribution', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: `# ${periodLabel}s`,
                data: bins,
                backgroundColor: 'rgba(156, 39, 176, 0.7)',
                borderColor: 'rgba(156, 39, 176, 1)',
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `Distribution: ${unit} per ${periodLabel}`
                },
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: `${unit} per ${periodLabel}` } },
                y: { beginAtZero: true, title: { display: true, text: `# of ${periodLabel}s` } }
            }
        }
    });
}

// -------------------------
// Sport Transitions (multi-sport days)
// -------------------------
function renderTransitions(activities) {
    const canvas = document.getElementById('transitions-chart');
    const detailsEl = document.getElementById('transitions-details');
    if (!canvas && !detailsEl) return;

    // Sort activities by start time
    const sorted = activities
        .map(activity => ({ activity, date: readActivityDate(activity) }))
        .filter(entry => entry.date !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Normalize sport type to simplified category
    const normalizeSport = a => {
        const rawType = a?.sport_type || a?.type || '';
        const t = typeof rawType === 'string' ? rawType.toLowerCase() : '';
        if (t.includes('swim')) return 'Swim';
        if (t.includes('ride') || t.includes('bike') || t.includes('cycling')) return 'Bike';
        if (t.includes('run')) return 'Run';
        return typeof a?.type === 'string' && a.type.length > 0 ? a.type : 'Other';
    };

    // Find transitions: activities within 2 hours of each other
    const MAX_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours
    const transitionCounts = {}; // "Swim→Bike" → count
    const transitionExamples = {};

    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i].activity;
        const movingTime = readNonnegativeFiniteNumber(curr?.moving_time);
        if (movingTime === null) continue;
        const currEnd = sorted[i].date.getTime() + movingTime * 1000;
        if (!Number.isFinite(currEnd)) continue;

        for (let j = i + 1; j < sorted.length; j++) {
            const next = sorted[j].activity;
            const nextStart = sorted[j].date.getTime();
            const gap = nextStart - currEnd;

            if (gap > MAX_GAP_MS) break; // No more candidates
            if (gap < 0) continue; // Overlapping — skip

            const fromSport = normalizeSport(curr);
            const toSport = normalizeSport(next);
            if (fromSport === toSport) continue; // Same sport — not a transition

            const key = `${fromSport}→${toSport}`;
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
            if (!transitionExamples[key]) transitionExamples[key] = [];
            if (transitionExamples[key].length < 3) {
                transitionExamples[key].push(formatActivityDate(curr, sorted[i].date));
            }
        }
    }

    const entries = Object.entries(transitionCounts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        clearUiChart('transitions-chart');
        if (detailsEl) {
            const empty = document.createElement('p');
            empty.style.color = '#888';
            empty.textContent = 'No multi-sport transitions found (activities within 2h of each other).';
            detailsEl.replaceChildren(empty);
        }
        return;
    }

    // Bar chart of transitions
    if (canvas) {
        const labels = entries.map(([k]) => k);
        const data = entries.map(([, v]) => v);
        const colors = labels.map(l => {
            if (l.includes('Swim') && l.includes('Bike')) return 'rgba(0,131,143,0.7)';
            if (l.includes('Bike') && l.includes('Run')) return 'rgba(46,125,50,0.7)';
            if (l.includes('Swim') && l.includes('Run')) return 'rgba(21,101,192,0.7)';
            return 'rgba(252,76,2,0.7)';
        });

        createUiChart('transitions-chart', {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '# Transitions',
                    data,
                    backgroundColor: colors
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'Count' } }
                }
            }
        });
    }

    // Details table
    if (detailsEl) {
        const triathlon = (transitionCounts['Swim→Bike'] || 0) + (transitionCounts['Bike→Run'] || 0);
        const children = [];
        if (triathlon > 0) {
            const summary = document.createElement('p');
            summary.style.marginBottom = '0.75rem';
            const strong = document.createElement('strong');
            strong.textContent = 'Triathlon-style transitions:';
            summary.append(strong, document.createTextNode(` ${triathlon} (Swim→Bike + Bike→Run)`));
            children.push(summary);
        }
        const table = document.createElement('table');
        table.className = 'compact-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const label of ['Transition', 'Count', 'Examples']) {
            const th = document.createElement('th');
            th.textContent = label;
            headerRow.append(th);
        }
        thead.append(headerRow);
        const tbody = document.createElement('tbody');
        for (const [key, count] of entries.slice(0, 8)) {
            const row = document.createElement('tr');
            const transition = document.createElement('td');
            transition.textContent = key;
            const countCell = document.createElement('td');
            countCell.textContent = String(count);
            const examples = document.createElement('td');
            examples.style.color = '#888';
            examples.style.fontSize = '0.85em';
            examples.textContent = (transitionExamples[key] || []).join(', ');
            row.append(transition, countCell, examples);
            tbody.append(row);
        }
        table.append(thead, tbody);
        detailsEl.replaceChildren(...children, table);
    }
}

function renderRecordStats(activities) {
    const container = document.getElementById('record-stats');
    if (!container) return;

    const distanceCandidates = activities
        .map(activity => ({ activity, value: readNonnegativeFiniteNumber(activity?.distance) }))
        .filter(candidate => candidate.value !== null);
    const longestRecord = distanceCandidates.reduce(
        (best, candidate) => best === null || candidate.value > best.value ? candidate : best,
        null
    );

    const getSpeed = activity => {
        const avgSpeed = readNonnegativeFiniteNumber(activity?.average_speed);
        if (avgSpeed !== null && avgSpeed > 0) return avgSpeed;
        const distance = readNonnegativeFiniteNumber(activity?.distance);
        const movingTime = readNonnegativeFiniteNumber(activity?.moving_time);
        if (distance !== null && distance > 0 && movingTime !== null && movingTime > 0) {
            const speed = distance / movingTime;
            return Number.isFinite(speed) && speed > 0 ? speed : null;
        }
        return null;
    };

    const speedCandidates = activities
        .map(activity => ({
            activity,
            speed: getSpeed(activity),
            distance: readNonnegativeFiniteNumber(activity?.distance)
        }))
        .filter(candidate => candidate.speed !== null);
    const preferredSpeedCandidates = speedCandidates.filter(candidate => (
        candidate.distance !== null && candidate.distance > 1000
    ));
    const fastestRecord = (preferredSpeedCandidates.length > 0
        ? preferredSpeedCandidates
        : speedCandidates
    ).reduce(
        (best, candidate) => best === null || candidate.speed > best.speed ? candidate : best,
        null
    );
    const fastestPaceMinutes = fastestRecord === null ? null : (1000 / fastestRecord.speed) / 60;
    const fastestPace = fastestPaceMinutes !== null && Number.isFinite(fastestPaceMinutes)
        ? utils.paceDecimalToTime(fastestPaceMinutes)
        : UNAVAILABLE_VALUE;

    const elevationCandidates = activities
        .map(activity => ({
            activity,
            value: readNonnegativeFiniteNumber(activity?.total_elevation_gain)
        }))
        .filter(candidate => candidate.value !== null);
    const elevationRecord = elevationCandidates.reduce(
        (best, candidate) => best === null || candidate.value > best.value ? candidate : best,
        null
    );

    const datedActivities = activities
        .map(activity => ({ activity, date: readActivityDate(activity) }))
        .filter(entry => entry.date !== null);
    const oldestRecord = datedActivities.reduce(
        (best, entry) => best === null || entry.date < best.date ? entry : best,
        null
    );
    const newestRecord = datedActivities.reduce(
        (best, entry) => best === null || entry.date > best.date ? entry : best,
        null
    );
    const timeDiffDays = oldestRecord && newestRecord
        ? Math.floor((newestRecord.date.getTime() - oldestRecord.date.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const hourCounts = Array(24).fill(0);
    datedActivities.forEach(({ date }) => {
        let hour = date.getHours();
        hour = (hour - 2 + 24) % 24;
        hourCounts[hour]++;
    });
    const favHour = datedActivities.length > 0
        ? hourCounts.indexOf(Math.max(...hourCounts))
        : null;

    const dayCounts = Array(7).fill(0);
    datedActivities.forEach(({ date }) => {
        let dayIdx = date.getDay();
        dayIdx = (dayIdx + 6) % 7;
        dayCounts[dayIdx]++;
    });
    const favDayIdx = datedActivities.length > 0
        ? dayCounts.indexOf(Math.max(...dayCounts))
        : null;
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const favDay = favDayIdx === null ? UNAVAILABLE_VALUE : dayLabels[favDayIdx];

    const distanceSummary = summarizeMetric(activities, 'distance');
    const avgDist = distanceSummary.count > 0
        ? `${(distanceSummary.total / distanceSummary.count / 1000).toFixed(2)} km`
        : UNAVAILABLE_VALUE;

    let pairedPaceMinutes = 0;
    let pairedCount = 0;
    for (const activity of activities) {
        const distance = readNonnegativeFiniteNumber(activity?.distance);
        const movingTime = readNonnegativeFiniteNumber(activity?.moving_time);
        if (distance === null || distance <= 0 || movingTime === null) continue;
        const paceMinutes = (movingTime / (distance / 1000)) / 60;
        if (!Number.isFinite(paceMinutes) || paceMinutes < 0) continue;
        const nextPaceTotal = pairedPaceMinutes + paceMinutes;
        if (!Number.isFinite(nextPaceTotal)) continue;
        pairedPaceMinutes = nextPaceTotal;
        pairedCount++;
    }
    const calculatedAveragePace = pairedCount > 0
        ? pairedPaceMinutes / pairedCount
        : null;
    const avgPaceMinutes = calculatedAveragePace !== null && Number.isFinite(calculatedAveragePace)
        ? calculatedAveragePace
        : null;
    const avgPace = avgPaceMinutes === null
        ? UNAVAILABLE_VALUE
        : (avgPaceMinutes === 0 ? '0:00 /km' : `${utils.paceDecimalToTime(avgPaceMinutes)} /km`);

    const participationCounts = activities
        .map(activity => readAthleteCount(activity?.athlete_count))
        .filter(value => value !== null);
    const soloCount = participationCounts.filter(value => value === 1).length;
    const groupCount = participationCounts.filter(value => value > 1).length;
    const soloValue = participationCounts.length > 0
        ? `${soloCount} (${((soloCount / participationCounts.length) * 100).toFixed(1)}%)`
        : UNAVAILABLE_VALUE;
    const groupValue = participationCounts.length > 0
        ? `${groupCount} (${((groupCount / participationCounts.length) * 100).toFixed(1)}%)`
        : UNAVAILABLE_VALUE;

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.paddingLeft = '0';
    list.style.lineHeight = '1.8';
    const appendItem = (label, value, activityId = null) => {
        const item = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = label;
        item.append(strong, document.createTextNode(` ${value}`));
        if (activityId !== null) {
            item.append(document.createTextNode(' ('), createActivityLink(activityId), document.createTextNode(')'));
        }
        list.append(item);
    };
    appendItem(
        'Longest Activity:',
        longestRecord ? `${(longestRecord.value / 1000).toFixed(2)} km` : UNAVAILABLE_VALUE,
        longestRecord?.activity?.id ?? null
    );
    const fastestDistance = fastestRecord?.distance;
    const fastestDistanceText = fastestDistance !== null && fastestDistance !== undefined
        ? ` over ${(fastestDistance / 1000).toFixed(1)}k`
        : '';
    appendItem(
        'Fastest Activity (Pace):',
        fastestRecord ? `${fastestPace} /km${fastestDistanceText}` : UNAVAILABLE_VALUE,
        fastestRecord?.activity?.id ?? null
    );
    appendItem(
        'Most Elevation:',
        elevationRecord ? `${Math.round(elevationRecord.value)} m` : UNAVAILABLE_VALUE,
        elevationRecord?.activity?.id ?? null
    );
    const timeSpan = oldestRecord && newestRecord
        ? `${timeDiffDays} days (${formatActivityDate(oldestRecord.activity, oldestRecord.date)} to ${formatActivityDate(newestRecord.activity, newestRecord.date)})`
        : UNAVAILABLE_VALUE;
    appendItem('Time Span:', timeSpan);
    appendItem('Favourite Hour:', favHour === null ? UNAVAILABLE_VALUE : `${favHour}:00`);
    appendItem('Favourite Day:', favDay);
    appendItem('Average Distance:', avgDist);
    appendItem('Average Pace:', avgPace);
    appendItem('Solo Activities:', soloValue);
    appendItem('Group Activities:', groupValue);
    container.replaceChildren(list);
}

function renderStartTimeHistogram(activities, dataType = 'count') {
    const values = Array(24).fill(0);
    activities.forEach(activity => {
        const date = readActivityDate(activity);
        if (!date) return;
        const metric = readTrendsMetric(activity, dataType);
        if (metric === null) return;
        let hour = date.getHours();
        hour = (hour - 2 + 24) % 24;
        values[hour] = addFiniteAggregate(values[hour], metric);
    });
    const labels = values.map((_, i) => `${i}:00`);
    const labelMap = {
        count: '# of Activities',
        time: 'Time (hours)',
        distance: 'Distance (km)'
    };
    createUiChart('start-time-histogram', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: labelMap[dataType],
                data: values,
                backgroundColor: 'rgba(252, 82, 0, 0.7)'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: labelMap[dataType] } } }
        }
    });
}


function renderDurationHistogram(activities) {
    // Convert moving_time to minutes
    const durations = activities
        .map(activity => readNonnegativeFiniteNumber(activity?.moving_time))
        .filter(duration => duration !== null)
        .map(duration => duration / 60);
    if (durations.length === 0) {
        clearUiChart('duration-histogram');
        return;
    }

    const maxDur = Math.max(...durations);

    // Choose bucket size and label unit based on max duration
    let bucketSize, unit;
    if (maxDur <= 120) {
        bucketSize = 10; // 10-minute buckets
        unit = 'min';
    } else if (maxDur <= 300) {
        bucketSize = 15; // 15-minute buckets
        unit = 'min';
    } else {
        bucketSize = 30; // 30-minute buckets
        unit = 'min';
    }

    const desiredBucketCount = Math.max(1, Math.ceil(maxDur / bucketSize));
    if (desiredBucketCount > MAX_DURATION_HISTOGRAM_BUCKETS) {
        bucketSize = maxDur / MAX_DURATION_HISTOGRAM_BUCKETS;
    }
    const numBuckets = Math.min(
        MAX_DURATION_HISTOGRAM_BUCKETS,
        Math.max(1, Math.ceil(maxDur / bucketSize))
    );
    const counts = new Array(numBuckets).fill(0);
    durations.forEach(d => {
        const idx = Math.min(Math.floor(d / bucketSize), numBuckets - 1);
        counts[idx]++;
    });

    const labels = counts.map((_, i) => {
        const from = i * bucketSize;
        const to = from + bucketSize;
        if (unit === 'min' && from >= 60) {
            const fH = Math.floor(from / 60), fM = from % 60;
            const tH = Math.floor(to / 60), tM = to % 60;
            const fStr = fM ? `${fH}h${fM}` : `${fH}h`;
            const tStr = tM ? `${tH}h${tM}` : `${tH}h`;
            return `${fStr}–${tStr}`;
        }
        return `${from}–${to} ${unit}`;
    });

    createUiChart('duration-histogram', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '# of Activities',
                data: counts,
                backgroundColor: 'rgba(0, 116, 217, 0.7)'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Duration' } },
                y: { beginAtZero: true, title: { display: true, text: 'Activities' } }
            }
        }
    });
}


function renderYearlyComparison(runs, dataType = 'count') {
    const byYear = runs.reduce((acc, run) => {
        const date = readActivityDate(run);
        if (!date) return acc;
        const year = date.getFullYear();
        if (!acc[year]) {
            acc[year] = {
                distance: 0,
                distanceCount: 0,
                count: 0,
                elevation: 0,
                elevationCount: 0,
                movingTime: 0,
                movingTimeCount: 0
            };
        }
        acc[year].count++;
        const distance = readNonnegativeFiniteNumber(run?.distance);
        const elevation = readNonnegativeFiniteNumber(run?.total_elevation_gain);
        const movingTime = readNonnegativeFiniteNumber(run?.moving_time);
        if (distance !== null) {
            acc[year].distance = addFiniteAggregate(acc[year].distance, distance / 1000);
            acc[year].distanceCount++;
        }
        if (elevation !== null) {
            acc[year].elevation = addFiniteAggregate(acc[year].elevation, elevation);
            acc[year].elevationCount++;
        }
        if (movingTime !== null) {
            acc[year].movingTime = addFiniteAggregate(acc[year].movingTime, movingTime / 3600);
            acc[year].movingTimeCount++;
        }
        return acc;
    }, {});

    const years = Object.keys(byYear).sort();
    // Get max for each measure
    const distDataRaw = years.map(y => byYear[y].distanceCount > 0 ? byYear[y].distance : null);
    const countDataRaw = years.map(y => byYear[y].count);
    const elevDataRaw = years.map(y => byYear[y].elevationCount > 0 ? byYear[y].elevation : null);
    const timeDataRaw = years.map(y => byYear[y].movingTimeCount > 0 ? byYear[y].movingTime : null);

    const maxDist = Math.max(1, ...distDataRaw.filter(Number.isFinite));
    const maxCount = Math.max(1, ...countDataRaw);
    const maxElev = Math.max(1, ...elevDataRaw.filter(Number.isFinite));
    const maxTime = Math.max(1, ...timeDataRaw.filter(Number.isFinite));

    // Scale to [0, 1]
    const distData = distDataRaw.map(v => v === null ? null : v / maxDist);
    const countData = countDataRaw.map(v => v / maxCount);
    const elevData = elevDataRaw.map(v => v === null ? null : v / maxElev);
    const timeData = timeDataRaw.map(v => v === null ? null : v / maxTime);

    const datasets = [
        {
            label: 'Total Distance (scaled)',
            data: distData,
            backgroundColor: 'rgba(0, 116, 217, 0.8)',
            hidden: false,
            realData: distDataRaw
        },
        {
            label: 'Number of Activities (scaled)',
            data: countData,
            backgroundColor: 'rgba(252, 82, 0, 0.8)',
            hidden: true,
            realData: countDataRaw
        },
        {
            label: 'Total Elevation Gain (scaled)',
            data: elevData,
            backgroundColor: 'rgba(0, 200, 83, 0.7)',
            hidden: true,
            realData: elevDataRaw
        },
        {
            label: 'Total Moving Time (scaled)',
            data: timeData,
            backgroundColor: 'rgba(255, 193, 7, 0.7)',
            hidden: true,
            realData: timeDataRaw
        }
    ];

    createUiChart('yearly-comparison-chart', {
        type: 'bar',
        data: {
            labels: years,
            datasets
        },
        options: {
            plugins: {
                legend: {
                    onClick: (e, legendItem, legend) => {
                        const chart = legend.chart;
                        const idx = legendItem.datasetIndex;
                        chart.data.datasets[idx].hidden = !chart.data.datasets[idx].hidden;
                        chart.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const dataset = context.dataset;
                            const yearIdx = context.dataIndex;
                            let label = dataset.label.replace(' (scaled)', '');
                            let value = dataset.realData ? dataset.realData[yearIdx] : context.parsed.y;
                            if (value === null) return `${label}: ${UNAVAILABLE_VALUE}`;
                            // Format value depending on dataset
                            if (label === 'Total Distance') {
                                return `${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
                            }
                            if (label === 'Number of Activities') {
                                return `${label}: ${value}`;
                            }
                            if (label === 'Total Elevation Gain') {
                                return `${label}: ${value.toLocaleString()} m`;
                            }
                            if (label === 'Total Moving Time') {
                                return `${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
                            }
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    title: { display: true, text: 'Scaled Value (0-1)' }
                }
            }
        }
    });
}


function renderWeeklyMixChart(runs, dataType = 'count') {
    // Prepare data for each day of the week (Monday-Sunday)
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayData = Array(7).fill(0);

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;
        // getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
        let dayIdx = date.getDay();
        // Shift so Monday=0, Sunday=6
        dayIdx = (dayIdx + 6) % 7;
        dayData[dayIdx] = addFiniteAggregate(dayData[dayIdx], metric);
    });

    const labelMap = {
        count: 'Number of Activities',
        time: 'Time (hours)',
        distance: 'Distance (km)'
    };

    createUiChart('weekly-mix-chart', {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: labelMap[dataType],
                data: dayData,
                backgroundColor: 'rgba(252, 82, 0, 0.7)',
            }]
        },
        options: {
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: labelMap[dataType] }
                }
            }
        }
    });
}


function renderMonthlyMixChart(runs, dataType = 'count') {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthData = Array(12).fill(0);

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;

        const monthIdx = date.getMonth(); // 0–11
        monthData[monthIdx] = addFiniteAggregate(monthData[monthIdx], metric);
    });

    const labelMap = {
        count: 'Number of Activities',
        time: 'Time (hours)',
        distance: 'Distance (km)'
    };

    createUiChart('monthly-mix-chart', {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: labelMap[dataType],
                data: monthData,
                backgroundColor: 'rgba(252, 82, 0, 0.7)',
            }]
        },
        options: {
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: labelMap[dataType] }
                }
            }
        }
    });
}






function renderHourMatrix(runs, dataType = 'count') {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hourLabels = Array.from({ length: 24 }, (_, i) => i);

    // Inicializar matriz de valores [7 días x 24 horas]
    const values = Array.from({ length: 7 }, () => Array(24).fill(0));

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;
        const dayIdx = (date.getDay() + 6) % 7; // Monday=0
        const hour = (date.getHours() - 2 + 24) % 24;
        values[dayIdx][hour] = addFiniteAggregate(values[dayIdx][hour], metric);
    });

    const data = [];
    const maxVal = Math.max(...values.flat());

    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            data.push({ x: hour, y: day, v: values[day][hour] });
        }
    }

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(252,82,0,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('hour-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data: data,
                backgroundColor: data.map(d => getColor(d.v))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: item => {
                            const d = item[0].raw;
                            return `${dayLabels[d.y]} - ${d.x}:00`;
                        },
                        label: item => `${labelMap[dataType]}: ${item.raw.v.toFixed(1)}`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 24,
                    ticks: {
                        stepSize: 1,
                        callback: val => `${val}:00`,
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Hour of Day', font: { weight: 'bold' } }
                },
                y: {
                    type: 'linear',
                    min: 0 - 0.5,
                    max: 7,
                    ticks: {
                        stepSize: 1,
                        callback: val => dayLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Weekday', font: { weight: 'bold' } }
                }
            }
        }
    });
}




function renderYearMonthMatrix(runs, dataType = 'count') {
    const stats = {}; // { [year]: { [month]: value } }

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;

        const year = date.getFullYear();
        const month = date.getMonth(); // 0–11

        if (!stats[year]) stats[year] = {};
        if (!stats[year][month]) stats[year][month] = 0;

        stats[year][month] = addFiniteAggregate(stats[year][month], metric);
    });

    const years = Object.keys(stats).map(Number).sort((a, b) => a - b);
    const months = Array.from({ length: 12 }, (_, i) => i);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = [];
    let maxVal = 0;
    years.forEach((year, yIdx) => {
        months.forEach(month => {
            const val = stats[year]?.[month] || 0;
            maxVal = Math.max(maxVal, val);
            data.push({ x: month, y: yIdx, v: val });
        });
    });

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(0,128,255,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('year-month-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data,
                backgroundColor: data.map(d => getColor(d.v))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0].raw;
                            return `${years[d.y]} - ${monthLabels[d.x]}`;
                        },
                        label: item => `${labelMap[dataType]}: ${item.raw.v.toFixed(1)}`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 12,
                    ticks: {
                        stepSize: 1,
                        callback: val => monthLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: {
                        display: true,
                        text: 'Month',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    type: 'linear',
                    min: 0 - 0.5,
                    max: years.length,
                    ticks: {
                        stepSize: 1,
                        callback: val => years[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: {
                        display: true,
                        text: 'Year',
                        font: { weight: 'bold' }
                    }
                }
            },
            layout: {
                padding: 10
            }
        }
    });
}



function renderMonthWeekdayMatrix(runs, dataType = 'count') {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // stats[month][weekday] = { count, distance, time }
    const stats = Array.from({ length: 12 }, () =>
        Array.from({ length: 7 }, () => ({ count: 0, distance: 0, time: 0 }))
    );

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;

        const month = date.getMonth();           // 0–11
        const dayIdx = (date.getDay() + 6) % 7;  // Monday = 0
        const distance = readNonnegativeFiniteNumber(run?.distance);
        const movingTime = readNonnegativeFiniteNumber(run?.moving_time);

        stats[month][dayIdx].count++;
        if (distance !== null) {
            stats[month][dayIdx].distance = addFiniteAggregate(
                stats[month][dayIdx].distance,
                distance / 1000
            );
        }
        if (movingTime !== null) {
            stats[month][dayIdx].time = addFiniteAggregate(
                stats[month][dayIdx].time,
                movingTime / 3600
            );
        }
    });

    const data = [];
    let maxVal = 0;
    for (let m = 0; m < 12; m++) {
        for (let d = 0; d < 7; d++) {
            const entry = stats[m][d];
            let val;
            switch (dataType) {
                case 'count':
                    val = entry.count;
                    break;
                case 'time':
                    val = entry.time;
                    break;
                case 'distance':
                    val = entry.distance;
                    break;
                default:
                    val = entry.distance;
            }
            maxVal = Math.max(maxVal, val);
            data.push({
                x: m,
                y: d,
                val: val,
                count: entry.count,
                distance: entry.distance,
                time: entry.time
            });
        }
    }

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(0,200,120,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('month-weekday-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data,
                backgroundColor: data.map(d => getColor(d.val))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0].raw;
                            return `${dayLabels[d.y]} - ${monthLabels[d.x]}`;
                        },
                        label: item => {
                            const d = item.raw;
                            return [
                                `Activities: ${d.count}`,
                                `Distance: ${d.distance.toFixed(1)} km`,
                                `Time: ${d.time.toFixed(1)} h`
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 12,
                    ticks: {
                        stepSize: 1,
                        callback: val => monthLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: {
                        display: true,
                        text: 'Month',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    type: 'linear',
                    min: 0,
                    max: 6,
                    ticks: {
                        stepSize: 1,
                        callback: val => dayLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: {
                        display: true,
                        text: 'Weekday',
                        font: { weight: 'bold' }
                    }
                }
            },
            layout: { padding: 10 }
        }
    });
}



function renderMonthDayMatrix(runs, dataType = 'count') {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayLabels = Array.from({ length: 31 }, (_, i) => i + 1);

    // stats[day][month] = value
    const stats = Array.from({ length: 31 }, () =>
        Array.from({ length: 12 }, () => 0)
    );

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;

        const month = date.getMonth();      // 0–11
        const day = date.getDate() - 1;     // 0–30

        stats[day][month] = addFiniteAggregate(stats[day][month], metric);
    });

    const data = [];
    let maxVal = 0;
    for (let d = 0; d < 31; d++) {
        for (let m = 0; m < 12; m++) {
            const val = stats[d][m];
            maxVal = Math.max(maxVal, val);
            data.push({
                x: d,   // day
                y: m,   // month
                v: val
            });
        }
    }

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(255,140,0,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('month-day-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data,
                backgroundColor: data.map(d => getColor(d.v))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0].raw;
                            return `${monthLabels[d.y]} ${d.x + 1}`;
                        },
                        label: item => `${labelMap[dataType]}: ${item.raw.v.toFixed(1)}`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 31,
                    ticks: {
                        stepSize: 1,
                        callback: val => dayLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Day of Month', font: { weight: 'bold' } }
                },
                y: {
                    type: 'linear',
                    min: 1 - 2,
                    max: 12,
                    ticks: {
                        stepSize: 1,
                        callback: val => monthLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Month', font: { weight: 'bold' } }
                }
            },
            layout: { padding: 10 }
        }
    });
}


function renderMonthHourMatrix(runs, dataType = 'count') {
    if (!runs || runs.length === 0) {
        clearUiChart('month-hour-matrix');
        return;
    }

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const hourLabels = Array.from({ length: 24 }, (_, i) => i); // 0–23

    // stats[hour][month] = { count, distance, time }
    const stats = Array.from({ length: 24 }, () =>
        Array.from({ length: 12 }, () => ({ count: 0, distance: 0, time: 0 }))
    );

    // Aggregate
    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;

        const month = date.getMonth(); // 0–11
        let hour = date.getHours();    // 0–23

        // Subtract 2 hours and wrap around 0–23
        hour = (hour - 2 + 24) % 24;

        const distance = readNonnegativeFiniteNumber(run?.distance);
        const movingTime = readNonnegativeFiniteNumber(run?.moving_time);

        stats[hour][month].count++;
        if (distance !== null) {
            stats[hour][month].distance = addFiniteAggregate(
                stats[hour][month].distance,
                distance / 1000
            );
        }
        if (movingTime !== null) {
            stats[hour][month].time = addFiniteAggregate(
                stats[hour][month].time,
                movingTime / 3600
            );
        }
    });

    // Flatten into dataset compatible with matrix chart
    const data = [];
    let maxVal = 0;
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 12; m++) {
            const entry = stats[h][m];
            let val;
            switch (dataType) {
                case 'count':
                    val = entry.count;
                    break;
                case 'time':
                    val = entry.time;
                    break;
                case 'distance':
                    val = entry.distance;
                    break;
                default:
                    val = entry.distance;
            }
            maxVal = Math.max(maxVal, val);
            data.push({
                x: h,         // hour index (x-axis)
                y: m,         // month index (y-axis)
                v: val,       // Fixed: use 'v' to match color mapping below
                count: entry.count,
                distance: entry.distance,
                time: entry.time
            });
        }
    }

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(252,82,0,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    try {
        createUiChart('month-hour-matrix', {
            type: 'matrix',
            data: {
                datasets: [{
                    label: labelMap[dataType],
                    data,
                    backgroundColor: data.map(d => getColor(d.v))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: items => {
                                const d = items[0].raw;
                                return `${monthLabels[d.y]} - ${d.x}:00`;
                            },
                            label: item => {
                                const d = item.raw;
                                return [
                                    `Activities: ${d.count}`,
                                    `Distance: ${d.distance.toFixed(1)} km`,
                                    `Time: ${d.time.toFixed(1)} h`
                                ];
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: -0.5,
                        max: 24,
                        ticks: {
                            stepSize: 2,
                            callback: val => (val % 1 === 0 ? `${val}:00` : ''),
                            color: '#333',
                            font: { weight: 'bold' }
                        },
                        grid: { color: '#eee' },
                        title: { display: true, text: 'Hour of Day', font: { weight: 'bold' } }
                    },
                    y: {
                        type: 'linear',
                        min: -1.5,
                        max: 12,
                        ticks: {
                            stepSize: 1,
                            callback: val => monthLabels[val] || '',
                            color: '#333',
                            font: { weight: 'bold' }
                        },
                        grid: { color: '#eee' },
                        title: { display: true, text: 'Month', font: { weight: 'bold' } }
                    }
                },
                layout: { padding: 10 }
            }
        });
    } catch {
        const container = document.getElementById('month-hour-matrix')?.parentElement;
        if (container) {
            container.replaceChildren(createChartError());
        }
    }
}



function renderYearWeekdayMatrix(runs, dataType = 'count') {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const stats = {}; // { [year]: { [weekday]: value } }

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;
        const year = date.getFullYear();
        const weekday = (date.getDay() + 6) % 7; // Monday = 0

        if (!stats[year]) stats[year] = {};
        if (!stats[year][weekday]) stats[year][weekday] = 0;

        stats[year][weekday] = addFiniteAggregate(stats[year][weekday], metric);
    });

    const years = Object.keys(stats).map(Number).sort((a, b) => a - b);
    const data = [];
    let maxVal = 0;

    years.forEach((year, yIdx) => {
        for (let d = 0; d < 7; d++) {
            const val = stats[year]?.[d] || 0;
            maxVal = Math.max(maxVal, val);
            data.push({ x: d, y: yIdx, v: val });
        }
    });

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(0,180,200,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('year-weekday-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data,
                backgroundColor: data.map(d => getColor(d.v))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0].raw;
                            return `${years[d.y]} - ${dayLabels[d.x]}`;
                        },
                        label: item => `${labelMap[dataType]}: ${item.raw.v.toFixed(1)}`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: -0.5,
                    max: 7,
                    ticks: {
                        stepSize: 1,
                        callback: val => dayLabels[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Weekday', font: { weight: 'bold' } }
                },
                y: {
                    type: 'linear',
                    min: -0.5,
                    max: years.length,
                    ticks: {
                        stepSize: 1,
                        callback: val => years[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Year', font: { weight: 'bold' } }
                }
            },
            layout: { padding: 10 }
        }
    });
}


function renderYearHourMatrix(runs, dataType = 'count') {
    const stats = {}; // { [year]: { [hour]: value } }

    runs.forEach(run => {
        const date = readActivityDate(run);
        if (!date) return;
        const metric = readTrendsMetric(run, dataType);
        if (metric === null) return;
        const year = date.getFullYear();
        let hour = (date.getHours() - 2 + 24) % 24;

        if (!stats[year]) stats[year] = {};
        if (!stats[year][hour]) stats[year][hour] = 0;

        stats[year][hour] = addFiniteAggregate(stats[year][hour], metric);
    });

    const years = Object.keys(stats).map(Number).sort((a, b) => a - b);
    const data = [];
    let maxVal = 0;

    years.forEach((year, yIdx) => {
        for (let h = 0; h < 24; h++) {
            const val = stats[year]?.[h] || 0;
            maxVal = Math.max(maxVal, val);
            data.push({ x: h, y: yIdx, v: val });
        }
    });

    function getColor(v) {
        if (v === 0) return 'rgba(255,255,255,0)';
        const alpha = maxVal > 0 ? 0.3 + 0.7 * (v / maxVal) : 0.5;
        return `rgba(255,100,0,${alpha.toFixed(2)})`;
    }

    const labelMap = {
        count: 'Activities',
        time: 'Time (h)',
        distance: 'Distance (km)'
    };

    createUiChart('year-hour-matrix', {
        type: 'matrix',
        data: {
            datasets: [{
                label: labelMap[dataType],
                data,
                backgroundColor: data.map(d => getColor(d.v))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: items => {
                            const d = items[0].raw;
                            return `${years[d.y]} - ${d.x}:00`;
                        },
                        label: item => `${labelMap[dataType]}: ${item.raw.v.toFixed(1)}`
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: -0.5,
                    max: 24,
                    ticks: {
                        stepSize: 2,
                        callback: val => (val % 1 === 0 ? `${val}:00` : ''),
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Hour of Day', font: { weight: 'bold' } }
                },
                y: {
                    type: 'linear',
                    min: -0.5,
                    max: years.length,
                    ticks: {
                        stepSize: 1,
                        callback: val => years[val] || '',
                        color: '#333',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' },
                    title: { display: true, text: 'Year', font: { weight: 'bold' } }
                }
            },
            layout: { padding: 10 }
        }
    });
}



// let interactiveMatrixChart;

function renderInteractiveMatrix(runs, dataType = 'count') {
    const ctx = document.getElementById("interactiveMatrix");
    const datedRuns = runs
        .map(run => ({ run, date: readActivityDate(run) }))
        .filter(entry => entry.date !== null);

    const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function getValue(date, key) {
        switch (key) {
            case "year": return date.getFullYear();
            case "month": return date.getMonth(); // 0-11
            case "weekday": return (date.getDay() + 6) % 7; // Monday=0
            case "hour": return (date.getHours() - 2 + 24) % 24;
            case "season":
                const m = date.getMonth();
                return [11, 0, 1].includes(m) ? 0 : [2, 3, 4].includes(m) ? 1 : [5, 6, 7].includes(m) ? 2 : 3;
            default: return 0;
        }
    }

    function getLabel(key, value) {
        switch (key) {
            case "weekday": return weekdayLabels[value];
            case "month": return monthLabels[value];
            default: return value.toString();
        }
    }

    function updateMatrix() {
        const xKey = document.getElementById("matrix-x-axis").value;
        const yKey = document.getElementById("matrix-y-axis").value;

        const matrix = {};
        const contributors = [];
        datedRuns.forEach(({ run, date }) => {
            const metric = readTrendsMetric(run, dataType);
            if (metric === null) return;
            const xVal = getValue(date, xKey);
            const yVal = getValue(date, yKey);
            matrix[yVal] ??= {};
            matrix[yVal][xVal] ??= 0;
            matrix[yVal][xVal] = addFiniteAggregate(matrix[yVal][xVal], metric);
            contributors.push({ xVal, yVal });
        });

        const xLabels = [...new Set(contributors.map(entry => entry.xVal))].sort((a, b) => a - b);
        const yLabels = [...new Set(contributors.map(entry => entry.yVal))].sort((a, b) => a - b);

        const points = [];
        let maxVal = 0;
        yLabels.forEach((y, yi) => {
            xLabels.forEach((x, xi) => {
                const v = matrix[y]?.[x] ?? 0;
                maxVal = Math.max(maxVal, v);
                points.push({ x: x, y: y, v });
            });
        });

        function getColor(v) {
            if (v === 0) return 'rgba(255,255,255,0)';
            return `rgba(0,128,255,${0.15 + 0.85 * (v / maxVal)})`;
        }

        if (interactiveMatrixChart) interactiveMatrixChart.destroy();

        interactiveMatrixChart = new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Activity Matrix',
                    data: points,
                    backgroundColor: points.map(d => getColor(d.v)),
                    width: 20,   // tamaño fijo por celda
                    height: 20,  // tamaño fijo por celda
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: items => `X: ${getLabel(xKey, items[0].raw.x)}, Y: ${getLabel(yKey, items[0].raw.y)}`,
                            label: items => {
                                const dataTypeLabel = dataType === 'count' ? 'Count' : dataType === 'time' ? 'Time (h)' : 'Distance (km)';
                                return `${dataTypeLabel}: ${items[0].raw.v.toFixed(1)}`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { type: 'category', labels: xLabels.map(x => getLabel(xKey, x)), title: { display: true, text: xKey } },
                    y: { type: 'category', labels: yLabels.map(y => getLabel(yKey, y)), title: { display: true, text: yKey } }
                }
            }
        });
    }

    // Clone select elements to remove stacked event listeners
    const xSelect = document.getElementById("matrix-x-axis");
    const ySelect = document.getElementById("matrix-y-axis");
    if (xSelect) {
        const newX = xSelect.cloneNode(true);
        xSelect.parentNode.replaceChild(newX, xSelect);
        newX.addEventListener("change", updateMatrix);
    }
    if (ySelect) {
        const newY = ySelect.cloneNode(true);
        ySelect.parentNode.replaceChild(newY, ySelect);
        newY.addEventListener("change", updateMatrix);
    }

    updateMatrix(); // Inicial
}


export function renderAthleteProfile(athlete) {
    const container = document.getElementById('athlete-profile-card');
    if (!container) return;
    const contentDiv = container.querySelector('.profile-content');
    if (!contentDiv) return;

    const children = [];
    if (athlete.profile_medium === '/icon-sport.svg') {
        const image = document.createElement('img');
        image.src = '/icon-sport.svg';
        image.alt = 'Athlete profile picture';
        children.push(image);
    }
    const details = document.createElement('div');
    details.className = 'profile-details';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${athlete.firstname} ${athlete.lastname}`;
    const location = document.createElement('span');
    location.className = 'location';
    location.textContent = `${athlete.city || ''}, ${athlete.country || ''}`;
    const stats = document.createElement('span');
    stats.className = 'stats';
    stats.textContent = `Followers: ${athlete.follower_count} | Friends: ${athlete.friend_count}`;
    details.append(name, location, stats);
    contentDiv.replaceChildren(...children, details);
}

export function renderTrainingZones(zones, {
    localHeartRateProfile = false,
    analysisProfileStatus = null
} = {}) {
    const container = document.getElementById('training-zones-card');
    if (!container) return;
    const contentDiv = container.querySelector('.zones-content');
    if (!contentDiv) return;

    const groups = [];

    // Renderizar Zonas de Frecuencia Cardíaca (Versión Robusta)
    if (zones?.heart_rate && zones.heart_rate.zones && zones.heart_rate.custom_zones) {
        const hrZones = zones.heart_rate.zones;

        // La API a veces devuelve la primera zona con min y max 0, la filtramos.
        // También nos aseguramos de que haya zonas válidas.
        const validZones = hrZones.filter((zone, index) => {
            if (!Number.isFinite(zone?.min)) return false;
            if (localHeartRateProfile && zone?.max === -1) {
                return index === hrZones.length - 1;
            }
            return Number.isFinite(zone?.max)
                && zone.max > 0
                && zone.max >= zone.min;
        });

        if (validZones.length > 0) {
            const visualZones = validZones.map((zone, index) => {
                if (!localHeartRateProfile || zone.max !== -1) {
                    return { ...zone, visualMax: zone.max };
                }
                const priorMinimum = validZones[index - 1]?.min;
                const inferredWidth = Number.isFinite(priorMinimum)
                    ? Math.max(1, zone.min - priorMinimum)
                    : 1;
                return { ...zone, visualMax: zone.min + inferredWidth };
            });
            // Calculamos el ancho total de las zonas para la proporcionalidad
            const totalRange = visualZones[visualZones.length - 1].visualMax
                - visualZones[0].min;
            if (Number.isFinite(totalRange) && totalRange > 0) {
                // Generamos dinámicamente cada segmento de la barra
                const zoneBar = document.createElement('div');
                zoneBar.className = 'zone-bar';
                visualZones.forEach((zone, index) => {
                    const zoneWidth = ((zone.visualMax - zone.min) / totalRange) * 100;
                    if (!Number.isFinite(zoneWidth) || zoneWidth < 0) return;
                    const zoneNumber = index + 1;
                    const openEnded = localHeartRateProfile && zone.max === -1;
                    const legacyLastZone = !localHeartRateProfile
                        && index === validZones.length - 1;
                    const zoneText = openEnded || legacyLastZone
                        ? `${zone.min}+`
                        : zone.max;

                    const segment = document.createElement('div');
                    segment.className = `zone-segment hr-z${zoneNumber}`;
                    segment.style.flexBasis = `${zoneWidth}%`;
                    segment.title = localHeartRateProfile
                        ? openEnded
                            ? `Z${zoneNumber}: ≥${zone.min}`
                            : `Z${zoneNumber}: ${zone.min}-${zone.max - 1}`
                        : `Z${zoneNumber}: ${zone.min}-${zone.max}`;
                    segment.textContent = String(zoneText);
                    zoneBar.append(segment);
                });
                const group = document.createElement('div');
                group.className = 'zone-group';
                const heading = document.createElement('h4');
                heading.textContent = 'Heart Rate Zones (bpm)';
                group.append(heading, zoneBar);
                groups.push(group);
            }
        }
    }

    // Renderizar Zonas de Potencia (sin cambios, ya era robusto)
    if (zones?.power && zones.power.zones && zones.power.zones.length > 0) {
        // Buscamos el FTP, que es el inicio de la Zona 4 (o la última zona si hay menos)
        const ftpZone = zones.power.zones.find(z => z.name === 'Z4') || zones.power.zones[zones.power.zones.length - 1];
        if (ftpZone) {
            const group = document.createElement('div');
            group.className = 'zone-group';
            const heading = document.createElement('h4');
            heading.textContent = 'Functional Threshold Power (FTP)';
            const value = document.createElement('p');
            value.style.fontSize = '1.5rem';
            value.style.fontWeight = 'bold';
            value.style.color = 'var(--text-dark)';
            value.style.margin = '0';
            value.textContent = `${ftpZone.min} W`;
            group.append(heading, value);
            groups.push(group);
        }
    }

    if (groups.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = localHeartRateProfile && analysisProfileStatus === 'unconfigured'
            ? 'Configure your local heart rate profile to see personalized zones.'
            : 'No custom training zones configured in your Strava profile.';
        groups.push(empty);
    }
    contentDiv.replaceChildren(...groups);
}

// let uiCharts = {}; // Almacén de gráficos para la pestaña "Athlete" para no interferir con los del dashboard principal
function createUiChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }
    if (uiCharts[canvasId]) {
        uiCharts[canvasId].destroy();
    }
    try {
        uiCharts[canvasId] = new Chart(canvas, config);
    } catch {
        canvas.parentElement.replaceChildren(createChartError());
    }
}

function populateAthleteSportOptions(sportSelect, selectedSports = []) {
    // Count sport occurrences using sport_type (preferred) or type
    const sportCounts = {};
    athleteActivities.forEach(activity => {
        const sport = (activity.sport_type || activity.type || 'Unknown').trim();
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    // Sort sports by count (descending)
    const topSports = Object.entries(sportCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([sport]) => sport);

    sportSelect.size = Math.min(8, Math.max(4, topSports.length));
    const options = topSports.map(sport => {
        const count = sportCounts[sport];
        const option = document.createElement('option');
        option.value = sport;
        option.textContent = `${sport} (${count})`;
        return option;
    });
    sportSelect.replaceChildren(...options);

    Array.from(sportSelect.options).forEach(opt => {
        opt.selected = selectedSports.length === 0 || selectedSports.includes(opt.value);
    });
}

function addAthleteFilters() {
    const filterContainer = document.getElementById('trends-filters');
    if (!filterContainer) return;

    // Check if filters already exist
    if (document.getElementById('trends-data-type')) return;

    const dataTypeSelect = document.createElement('select');
    dataTypeSelect.id = 'trends-data-type';
    dataTypeSelect.innerHTML = `
        <option value="time">Time (hours)</option>
        <option value="distance">Distance (km)</option>
        <option value="count">Number of Activities</option>
    `;

    const dataTypeLabel = document.createElement('label');
    dataTypeLabel.style = 'display: flex; align-items: center; gap: 0.5rem;';
    dataTypeLabel.innerHTML = '<span>Data Type:</span>';
    dataTypeLabel.appendChild(dataTypeSelect);

    const sportSelect = document.createElement('select');
    sportSelect.id = 'trends-sport-filter';
    sportSelect.multiple = true;
    populateAthleteSportOptions(sportSelect);

    const sportLabel = document.createElement('label');
    sportLabel.style = 'display: flex; align-items: center; gap: 0.5rem;';
    sportLabel.innerHTML = '<span>Sports:</span>';
    sportLabel.appendChild(sportSelect);

    const dateFromInput = document.createElement('input');
    dateFromInput.type = 'text';
    dateFromInput.id = 'trends-date-from';
    dateFromInput.placeholder = 'dd/mm/yyyy';
    dateFromInput.inputMode = 'numeric';
    dateFromInput.title = 'Format: dd/mm/yyyy';

    const dateFromLabel = document.createElement('label');
    dateFromLabel.style = 'display: flex; align-items: center; gap: 0.5rem;';
    dateFromLabel.innerHTML = '<span>From:</span>';
    dateFromLabel.appendChild(dateFromInput);

    const dateToInput = document.createElement('input');
    dateToInput.type = 'text';
    dateToInput.id = 'trends-date-to';
    dateToInput.placeholder = 'dd/mm/yyyy';
    dateToInput.inputMode = 'numeric';
    dateToInput.title = 'Format: dd/mm/yyyy';

    const dateToLabel = document.createElement('label');
    dateToLabel.style = 'display: flex; align-items: center; gap: 0.5rem;';
    dateToLabel.innerHTML = '<span>To:</span>';
    dateToLabel.appendChild(dateToInput);

    const applyButton = document.createElement('button');
    applyButton.id = 'trends-apply-filters';
    applyButton.textContent = 'Apply Filters';

    const frequencyButtonGroup = document.getElementById('activity-frequency-button-group') || document.createElement('div');
    frequencyButtonGroup.id = 'activity-frequency-button-group';
    frequencyButtonGroup.style.cssText = 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;';

    const frequencyOptions = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' }
    ];

    frequencyOptions.forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = option.label;
        button.dataset.period = option.value;
        button.style.cssText = 'padding:0.5rem 0.85rem; border:1px solid #ccc; border-radius:5px; background:#fff; cursor:pointer;';
        if (option.value === currentActivityFrequencyPeriod) {
            button.style.background = '#fc5200';
            button.style.color = '#fff';
        }
        button.addEventListener('click', () => {
            currentActivityFrequencyPeriod = option.value;
            Array.from(frequencyButtonGroup.children).forEach(btn => {
                btn.style.background = btn.dataset.period === option.value ? '#fc5200' : '#fff';
                btn.style.color = btn.dataset.period === option.value ? '#fff' : '#000';
            });

            const selectedSports = Array.from(sportSelect.selectedOptions || []).map(opt => opt.value);
            const selectedDateFrom = utils.parseDateInputToIso(dateFromInput.value) || null;
            const selectedDateTo = utils.parseDateInputToIso(dateToInput.value) || null;
            const filtered = filterActivities(athleteActivities, selectedDateFrom, selectedDateTo, selectedSports);
            renderActivityFrequencyHistogram(filtered, currentActivityFrequencyPeriod);
        });
        frequencyButtonGroup.appendChild(button);
    });

    filterContainer.appendChild(dataTypeLabel);
    filterContainer.appendChild(sportLabel);
    filterContainer.appendChild(dateFromLabel);
    filterContainer.appendChild(dateToLabel);
    filterContainer.appendChild(applyButton);

    filterContainer.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;';

    // Setup event listener for apply button
    applyButton.addEventListener('click', () => {
        const selectedSports = Array.from(sportSelect.selectedOptions || []).map(opt => opt.value);
        const selectedDataType = dataTypeSelect.value || 'time';
        const selectedDateFrom = utils.parseDateInputToIso(dateFromInput.value) || null;
        const selectedDateTo = utils.parseDateInputToIso(dateToInput.value) || null;

        // Dispatch custom event with filter values
        const event = new CustomEvent('trends-filters-changed', {
            detail: {
                dateFilterFrom: selectedDateFrom,
                dateFilterTo: selectedDateTo,
                sportFilter: selectedSports,
                dataType: selectedDataType,
                allActivities: athleteActivities
            }
        });
        document.dispatchEvent(event);
    });
}

function filterActivities(allActivities, dateFilterFrom, dateFilterTo, sportFilter = 'all') {
    let filtered = Array.isArray(allActivities) ? allActivities : [];

    if (dateFilterFrom || dateFilterTo) {
        filtered = filtered.filter(activity => {
            const dateKey = readActivityDateKey(activity);
            if (!dateKey) return false;
            if (dateFilterFrom && dateKey < dateFilterFrom) return false;
            if (dateFilterTo && dateKey > dateFilterTo) return false;
            return true;
        });
    }

    const selectedSports = Array.isArray(sportFilter)
        ? sportFilter.filter(Boolean)
        : (sportFilter && sportFilter !== 'all' ? [sportFilter] : []);

    if (selectedSports.length > 0) {
        const selectedSet = new Set(selectedSports);
        filtered = filtered.filter(activity => {
            const rawSport = activity?.sport_type || activity?.type || 'Unknown';
            const sport = typeof rawSport === 'string' ? rawSport.trim() : 'Unknown';
            return selectedSet.has(sport);
        });
    }

    return filtered;
}
