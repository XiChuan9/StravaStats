import * as utils from './utils.js';

// ─── Palette: [hue, saturation] for HSL ──────────────────────────────────────
const SPORT_PALETTE = {
    Run: [16, 90], TrailRun: [25, 85], VirtualRun: [12, 80],
    Ride: [215, 80], VirtualRide: [210, 70], GravelRide: [200, 75],
    MountainBikeRide: [190, 80], EBikeRide: [205, 65],
    Swim: [185, 85], OpenWaterSwim: [195, 80],
    Walk: [142, 65], Hike: [130, 60],
    Workout: [270, 70], WeightTraining: [280, 65], Yoga: [310, 60],
    AlpineSki: [240, 75], NordicSki: [230, 70], Snowboard: [245, 80],
    Rowing: [165, 75], Kayaking: [175, 70],
    Crossfit: [0, 75], IceSkate: [220, 60],
};


const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getType(a) { return (a.sport_type || a.type || 'Unknown').trim(); }
function emoji(t) { return utils.sportEmoji(t); }

/** Local-timezone YYYY-MM-DD string (avoids UTC offset bugs) */
function toYMD(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Monday-based ISO week key "YYYY-WW" */
function weekKey(dateStr) {
    const dt = new Date(dateStr);
    return `${dt.getFullYear()}-${String(utils.getISOWeek(dt)).padStart(2, '0')}`;
}

/**
 * Color for a sport at a given intensity [0–1].
 * intensity 0 → very pale, intensity 1 → rich dark.
 */
function sportColor(type, intensity = 0.6) {
    const [h, s] = SPORT_PALETTE[type] || [0, 0];
    const l = Math.round(94 - intensity * 56);
    return `hsl(${h},${s}%,${l}%)`;
}
function sportColorDark(type) {
    const [h, s] = SPORT_PALETTE[type] || [0, 0];
    return `hsl(${h},${s}%,26%)`;
}

/** Intensity [0–1] from moving_time; 2 h = max */
function actIntensity(act) { return Math.min(1, (act.moving_time || 0) / 7200); }

/** Group activities by YYYY-MM-DD */
function groupByDate(acts) {
    const m = {};
    for (const a of acts) {
        const d = (a.start_date_local || '').slice(0, 10);
        if (d) (m[d] = m[d] || []).push(a);
    }
    return m;
}

/** Monday of the week containing dt */
function mondayOf(dt) {
    const d = new Date(dt);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - dow);
    return d;
}

function createPeriodSummary(activities) {
    const count = activities.length;
    const totalKm = (activities.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(0);
    const totalH = (activities.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600).toFixed(0);
    const daysActive = new Set(activities.map(a => (a.start_date_local || '').slice(0, 10)).filter(Boolean)).size;
    const totalTSS = activities.reduce((s, a) => s + (typeof a.tss === 'number' ? a.tss : 0), 0).toFixed(0);

    const summary = document.createElement('div');
    summary.className = 'cal-year-summary';
    for (const value of [
        `${count} activities`,
        `${totalKm} km`,
        `${totalH} h`,
        `${daysActive} active days`,
        `${totalTSS} TSS`
    ]) {
        const item = document.createElement('span');
        item.textContent = value;
        summary.append(item);
    }
    return summary;
}

function createActivityLink(activity, className) {
    const activityId = typeof activity?.id === 'string' && activity.id.length > 0
        ? activity.id
        : (Number.isSafeInteger(activity?.id) && activity.id >= 0 ? String(activity.id) : null);
    if (activityId === null) {
        const inert = document.createElement('span');
        inert.className = className;
        return inert;
    }
    const params = new URLSearchParams();
    params.set('id', activityId);
    const link = document.createElement('a');
    link.className = className;
    link.href = `html/activity-router.html?${params.toString()}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
}

// ─── Streak calculation ───────────────────────────────────────────────────────
function computeStreaks(byDate) {
    const dates = Object.keys(byDate).sort();
    if (!dates.length) return { day: { current: 0, longest: 0 }, week: { current: 0, longest: 0 } };

    // Day streaks
    let dLong = 1, tmp = 1;
    for (let i = 1; i < dates.length; i++) {
        const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        tmp = diff === 1 ? tmp + 1 : 1;
        dLong = Math.max(dLong, tmp);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = new Date(dates[dates.length - 1]); last.setHours(0, 0, 0, 0);
    const gapDays = Math.round((today - last) / 86400000);
    let dCurrent = 0;
    if (gapDays <= 1) {
        dCurrent = 1;
        for (let i = dates.length - 2; i >= 0; i--) {
            if ((new Date(dates[i + 1]) - new Date(dates[i])) / 86400000 === 1) dCurrent++;
            else break;
        }
    }

    // Week streaks
    function weeksConsec(w1, w2) {
        const [y1, n1] = w1.split('-').map(Number);
        const [y2, n2] = w2.split('-').map(Number);
        return (y1 === y2 && n2 - n1 === 1) || (y2 === y1 + 1 && n1 >= 52 && n2 === 1);
    }
    const weekArr = [...new Set(dates.map(weekKey))].sort();
    let wLong = 1, wTmp = 1;
    for (let i = 1; i < weekArr.length; i++) {
        wTmp = weeksConsec(weekArr[i - 1], weekArr[i]) ? wTmp + 1 : 1;
        wLong = Math.max(wLong, wTmp);
    }
    const nowWK = weekKey(toYMD(today));
    const prevWK = weekKey(toYMD(new Date(+today - 7 * 86400000)));
    const lastWK = weekArr[weekArr.length - 1];
    let wCurrent = 0;
    if (lastWK === nowWK || lastWK === prevWK) {
        wCurrent = 1;
        for (let i = weekArr.length - 2; i >= 0; i--) {
            if (weeksConsec(weekArr[i], weekArr[i + 1])) wCurrent++;
            else break;
        }
    }

    return {
        day: { current: dCurrent, longest: dLong },
        week: { current: wCurrent, longest: wLong },
    };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function renderCalendarTab(allActivities) {
    const root = document.getElementById('calendar-tab');
    if (!root) return;

    if (!allActivities || allActivities.length === 0) {
        root.innerHTML = '<p style="padding:2rem;opacity:.5">No activity data available.</p>';
        return;
    }

    const now = new Date();

    // Persistent state
    if (!root._calState) {
        root._calState = {
            view: 'month',
            year: now.getFullYear(),
            month: now.getMonth(),
            weekOf: new Date(now),
            filterTypes: [],
        };
    }
    const state = root._calState;
    const typeCounts = allActivities.reduce((acc, a) => {
        const t = getType(a);
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});
    const types = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([type]) => type);

    // ── Build shell HTML (done once) ─────────────────────────────────────────
    root.innerHTML = `
    <div class="cal-root">
        <div class="cal-header">
            <div class="cal-controls-left">
                <div class="cal-view-btns">
                    <button class="cal-view-btn" data-view="week">Week</button>
                    <button class="cal-view-btn" data-view="month">Month</button>
                    <button class="cal-view-btn" data-view="year">Year</button>
                </div>
                <select class="cal-type-filter" multiple size="${Math.min(8, Math.max(4, types.length))}"></select>
            </div>
            <div class="cal-nav">
                <button class="cal-nav-btn" id="cal-prev">‹</button>
                <span class="cal-title" id="cal-title"></span>
                <button class="cal-nav-btn" id="cal-next">›</button>
                <button class="cal-nav-btn cal-today-btn" id="cal-today">Today</button>
            </div>
        </div>
        <div id="cal-streaks"></div>
        <div id="cal-body"></div>
        <div class="cal-legend"></div>
    </div>`;

    // ── Wire controls ────────────────────────────────────────────────────────
    root.querySelectorAll('.cal-view-btn').forEach(b =>
        b.addEventListener('click', () => { state.view = b.dataset.view; renderAll(); })
    );
    const typeFilter = root.querySelector('.cal-type-filter');
    const typeOptions = types.map(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = `${emoji(type)} ${type} (${typeCounts[type]})`;
        return option;
    });
    typeFilter.replaceChildren(...typeOptions);
    const legend = root.querySelector('.cal-legend');
    const legendItems = types.map(type => {
        const item = document.createElement('span');
        item.className = 'cal-legend-item';
        const dot = document.createElement('span');
        dot.className = 'cal-legend-dot';
        dot.style.background = sportColor(type, 0.6);
        item.append(dot, document.createTextNode(`${emoji(type)} ${type}`));
        return item;
    });
    legend.replaceChildren(...legendItems);
    Array.from(typeFilter.options).forEach(opt => {
        opt.selected = state.filterTypes.length === 0 || state.filterTypes.includes(opt.value);
    });
    typeFilter.addEventListener('change', e => {
        state.filterTypes = Array.from(e.target.selectedOptions || []).map(opt => opt.value);
        renderAll();
    });
    root.querySelector('#cal-prev').addEventListener('click', () => navigate(-1));
    root.querySelector('#cal-next').addEventListener('click', () => navigate(+1));
    root.querySelector('#cal-today').addEventListener('click', () => {
        state.year = now.getFullYear(); state.month = now.getMonth(); state.weekOf = new Date(now);
        renderAll();
    });

    function navigate(dir) {
        if (state.view === 'month') { state.month += dir; if (state.month < 0) { state.month = 11; state.year--; } if (state.month > 11) { state.month = 0; state.year++; } }
        else if (state.view === 'year') { state.year += dir; }
        else if (state.view === 'week') { state.weekOf = new Date(+state.weekOf + dir * 7 * 86400000); }
        renderAll();
    }

    // ── renderAll ────────────────────────────────────────────────────────────
    function renderAll() {
        const selectedTypes = state.filterTypes || [];
        const selectedSet = selectedTypes.length ? new Set(selectedTypes) : null;
        const filtered = selectedSet
            ? allActivities.filter(a => selectedSet.has(getType(a)))
            : allActivities;
        const byDate = groupByDate(filtered);
        const streaks = computeStreaks(byDate);

        // View buttons active state
        root.querySelectorAll('.cal-view-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.view === state.view)
        );
        // Type filter sync
        Array.from(root.querySelector('.cal-type-filter').options).forEach(opt => {
            opt.selected = !selectedSet || selectedSet.has(opt.value);
        });

        // Title
        const titleEl = root.querySelector('#cal-title');
        if (state.view === 'month') {
            const start = new Date(state.year, state.month, 1);
            const end = new Date(state.year, state.month + 1, 0);
            titleEl.textContent = `${utils.formatDate(start)} - ${utils.formatDate(end)}`;
        }
        else if (state.view === 'year') titleEl.textContent = `${state.year}`;
        else {
            const ws = mondayOf(state.weekOf);
            const we = new Date(+ws + 6 * 86400000);
            titleEl.textContent = `${utils.formatDate(ws)} - ${utils.formatDate(we)}`;
        }

        renderStreaks(streaks, byDate);

        const bodyEl = root.querySelector('#cal-body');
        // Remove any lingering day-detail panel
        root.querySelector('.cal-day-detail')?.remove();

        if (state.view === 'month') renderMonth(bodyEl, byDate);
        else if (state.view === 'year') renderYear(bodyEl, byDate, filtered);
        else renderWeek(bodyEl, byDate);
    }

    // ── Streaks banner ────────────────────────────────────────────────────────
    function renderStreaks(streaks, byDate) {
        const todayStr = toYMD(new Date());
        const todayActs = (byDate[todayStr] || []).length;
        root.querySelector('#cal-streaks').innerHTML = `
        <div class="cal-streak-cards">
            <div class="cal-streak-card">
                <div class="cal-streak-num">${streaks.day.current}${streaks.day.current > 0 ? ' 🔥' : ''}</div>
                <div class="cal-streak-label">Day streak</div>
            </div>
            <div class="cal-streak-card">
                <div class="cal-streak-num">${streaks.day.longest}</div>
                <div class="cal-streak-label">Best day streak</div>
            </div>
            <div class="cal-streak-card">
                <div class="cal-streak-num">${streaks.week.current}${streaks.week.current > 0 ? ' 📆' : ''}</div>
                <div class="cal-streak-label">Week streak</div>
            </div>
            <div class="cal-streak-card">
                <div class="cal-streak-num">${streaks.week.longest}</div>
                <div class="cal-streak-label">Best week streak</div>
            </div>
            <div class="cal-streak-card">
                <div class="cal-streak-num">${todayActs > 0 ? todayActs + ' 💪' : '0'}</div>
                <div class="cal-streak-label">Today</div>
            </div>
        </div>`;
    }

    // ── Monthly view ─────────────────────────────────────────────────────────
    function renderMonth(el, byDate) {
        const firstDay = new Date(state.year, state.month, 1);
        const lastDay = new Date(state.year, state.month + 1, 0);
        const todayStr = toYMD(new Date());
        const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
        const monthActs = [];

        const grid = document.createElement('div');
        grid.className = 'cal-month-grid';
        for (const label of DAYS_SHORT) {
            const header = document.createElement('div');
            header.className = 'cal-dow-header';
            header.textContent = label;
            grid.append(header);
        }

        for (let i = 0; i < startDow; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day-empty';
            grid.append(empty);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dt = new Date(state.year, state.month, day);
            const dateStr = toYMD(dt);
            const acts = byDate[dateStr] || [];
            monthActs.push(...acts);
            const isToday = dateStr === todayStr;
            const isFuture = dt > new Date();

            const dayCell = document.createElement('div');
            dayCell.className = `cal-day${isToday ? ' cal-today' : ''}${isFuture ? ' cal-future' : ''}`;
            dayCell.dataset.date = dateStr;
            const dayNumber = document.createElement('div');
            dayNumber.className = 'cal-day-num';
            dayNumber.textContent = String(day);
            const pills = document.createElement('div');
            pills.className = 'cal-day-pills';

            for (const a of acts.slice(0, 4)) {
                const t = getType(a);
                const bg = sportColor(t, actIntensity(a));
                const km = a.distance ? `${(a.distance / 1000).toFixed(1)} km` : '';
                const tss = typeof a.tss === 'number' ? `TSS ${Math.round(a.tss)}` : '';
                const stats = [km, tss].filter(Boolean).join(' · ');
                const pill = document.createElement('div');
                pill.className = 'cal-pill';
                pill.style.background = bg;
                pill.style.color = sportColorDark(t);
                pill.title = a.name == null ? String(a.name) : String(a.name);
                pill.textContent = `${emoji(t)} ${stats}`;
                pills.append(pill);
            }
            if (acts.length > 4) {
                const more = document.createElement('div');
                more.className = 'cal-pill cal-pill-more';
                more.textContent = `+${acts.length - 4} more`;
                pills.append(more);
            }
            dayCell.append(dayNumber, pills);
            dayCell.addEventListener('click', () => showDayDetail(dateStr, acts));
            grid.append(dayCell);
        }
        el.replaceChildren(grid, createPeriodSummary(monthActs));
    }

    // ── Weekly view ──────────────────────────────────────────────────────────
    function renderWeek(el, byDate) {
        const wStart = mondayOf(state.weekOf);
        const todayStr = toYMD(new Date());
        const weekActs = [];

        const grid = document.createElement('div');
        grid.className = 'cal-week-grid';

        for (let i = 0; i < 7; i++) {
            const dt = new Date(+wStart + i * 86400000);
            const dateStr = toYMD(dt);
            const acts = byDate[dateStr] || [];
            weekActs.push(...acts);
            const isToday = dateStr === todayStr;
            const isFuture = dt > new Date();

            const totalKm = acts.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
            const totalTime = acts.reduce((s, a) => s + (a.moving_time || 0), 0);
            const column = document.createElement('div');
            column.className = `cal-week-col${isToday ? ' cal-today' : ''}${isFuture ? ' cal-future' : ''}`;
            const header = document.createElement('div');
            header.className = 'cal-week-day-header';
            const dow = document.createElement('span');
            dow.className = 'cal-week-dow';
            dow.textContent = DAYS_SHORT[i];
            const date = document.createElement('span');
            date.className = 'cal-week-date';
            date.textContent = utils.formatDate(dt);
            header.append(dow, date);
            if (acts.length) {
                const daySummary = document.createElement('span');
                daySummary.className = 'cal-week-day-total';
                daySummary.textContent = `${totalKm.toFixed(1)} km · ${utils.formatTime(totalTime)}`;
                header.append(daySummary);
            }
            const activitiesEl = document.createElement('div');
            activitiesEl.className = 'cal-week-acts';

            if (acts.length === 0) {
                const rest = document.createElement('div');
                rest.className = 'cal-week-rest';
                rest.textContent = 'Rest day';
                activitiesEl.append(rest);
            } else {
                for (const a of acts) {
                    const t = getType(a);
                    const bg = sportColor(t, actIntensity(a));
                    const km = a.distance ? `${(a.distance / 1000).toFixed(1)} km` : '';
                    const dur = a.moving_time ? utils.formatTime(a.moving_time) : '';
                    const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';
                    const tss = typeof a.tss === 'number' ? `TSS ${Math.round(a.tss)}` : '';
                    const link = createActivityLink(a, 'cal-week-activity');
                    link.style.background = bg;
                    link.style.borderLeft = `3px solid ${sportColorDark(t)}`;
                    const sport = document.createElement('div');
                    sport.className = 'cal-week-act-sport';
                    sport.textContent = `${emoji(t)} ${t}`;
                    const name = document.createElement('div');
                    name.className = 'cal-week-act-name';
                    name.textContent = a.name || '—';
                    const stats = document.createElement('div');
                    stats.className = 'cal-week-act-stats';
                    stats.textContent = [km, dur, hr, tss].filter(Boolean).join(' · ');
                    link.append(sport, name, stats);
                    activitiesEl.append(link);
                }
            }
            column.append(header, activitiesEl);
            grid.append(column);
        }
        el.replaceChildren(grid, createPeriodSummary(weekActs));
    }

    // ── Yearly heatmap ────────────────────────────────────────────────────────
    function renderYear(el, byDate, filteredActs) {
        const jan1 = new Date(state.year, 0, 1);
        const dec31 = new Date(state.year, 11, 31);
        const CELL = 13, GAP = 2, COL_W = CELL + GAP;

        // Grid bounds: Mon before Jan 1 → Sun after Dec 31
        const gStart = new Date(jan1);
        gStart.setDate(gStart.getDate() - (jan1.getDay() + 6) % 7);
        const gEnd = new Date(dec31);
        gEnd.setDate(gEnd.getDate() + (6 - (dec31.getDay() + 6) % 7));

        // Build weeks
        const weeks = [];
        for (let d = new Date(gStart); d <= gEnd;) {
            const week = [];
            for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); }
            weeks.push(week);
        }

        // Month labels
        const monthLabels = [];
        weeks.forEach((w, wi) => {
            const m = w[0].getMonth();
            if (wi === 0 || weeks[wi - 1][0].getMonth() !== m)
                monthLabels.push({ wi, label: MONTHS_FULL[m].slice(0, 3) });
        });

        const outer = document.createElement('div');
        outer.className = 'cal-year-outer';
        const dowColumn = document.createElement('div');
        dowColumn.className = 'cal-year-dow-col';
        DAYS_SHORT.forEach((label, index) => {
            const day = document.createElement('div');
            day.className = 'cal-year-dow';
            day.textContent = index % 2 === 0 ? label : '';
            dowColumn.append(day);
        });
        const heatmap = document.createElement('div');
        heatmap.className = 'cal-year-heatmap';
        const monthsRow = document.createElement('div');
        monthsRow.className = 'cal-year-months-row';
        monthsRow.style.position = 'relative';
        monthsRow.style.height = '18px';
        monthsRow.style.marginBottom = '3px';
        monthsRow.style.fontSize = '.62rem';
        monthsRow.style.color = 'var(--text-light)';
        for (const month of monthLabels) {
            const label = document.createElement('span');
            label.style.position = 'absolute';
            label.style.left = `${month.wi * COL_W}px`;
            label.textContent = month.label;
            monthsRow.append(label);
        }
        const weeksEl = document.createElement('div');
        weeksEl.className = 'cal-year-weeks';
        for (const week of weeks) {
            const weekEl = document.createElement('div');
            weekEl.className = 'cal-year-week';
            for (const dt of week) {
                const dateStr = toYMD(dt);
                const acts = byDate[dateStr] || [];
                const inYear = dt.getFullYear() === state.year;
                const cell = document.createElement('div');

                if (!inYear || acts.length === 0) {
                    cell.className = 'cal-year-cell cal-year-empty';
                    cell.title = inYear ? utils.formatDate(dateStr) : '';
                    weekEl.append(cell);
                    continue;
                }

                // Dominant sport by time
                const byTime = {};
                let totalSec = 0;
                for (const a of acts) {
                    const t = getType(a);
                    byTime[t] = (byTime[t] || 0) + (a.moving_time || 0);
                    totalSec += (a.moving_time || 0);
                }
                const dominant = Object.entries(byTime).sort((a, b) => b[1] - a[1])[0][0];
                const intensity = Math.min(1, totalSec / 7200);
                const bg = sportColor(dominant, intensity);
                const km = acts.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
                const names = acts.map(a => `${emoji(getType(a))} ${a.name}`).join('\n');
                const tip = `${utils.formatDate(dateStr)}\n${names}\n${km.toFixed(1)} km · ${utils.formatTime(totalSec)}`;

                cell.className = 'cal-year-cell';
                cell.style.background = bg;
                cell.dataset.date = dateStr;
                cell.title = tip;
                cell.addEventListener('click', () => showDayDetail(dateStr, acts));
                weekEl.append(cell);
            }
            weeksEl.append(weekEl);
        }

        // Year summary
        const yActs = filteredActs.filter(a => (a.start_date_local || '').startsWith(`${state.year}`));

        heatmap.append(monthsRow, weeksEl);
        outer.append(dowColumn, heatmap);
        el.replaceChildren(outer, createPeriodSummary(yActs));
    }

    // ── Day detail panel ─────────────────────────────────────────────────────
    function showDayDetail(dateStr, acts) {
        // Toggle
        const existing = root.querySelector('.cal-day-detail');
        if (existing) {
            const was = existing.dataset.date;
            existing.remove();
            if (was === dateStr) return;
        }
        if (acts.length === 0) return;

        const dt = new Date(dateStr);
        const panel = document.createElement('div');
        panel.className = 'cal-day-detail';
        panel.dataset.date = dateStr;

        const rows = document.createElement('div');
        rows.className = 'cal-detail-rows';
        for (const a of acts) {
            const t = getType(a);
            const km = a.distance ? `${(a.distance / 1000).toFixed(2)} km` : '';
            const dur = a.moving_time ? utils.formatTime(a.moving_time) : '';
            const hr = a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '';
            const ele = a.total_elevation_gain ? `↑${a.total_elevation_gain.toFixed(0)} m` : '';
            const tss = typeof a.tss === 'number' ? `TSS ${Math.round(a.tss)}` : '';
            const link = createActivityLink(a, 'cal-detail-row');
            link.style.borderLeft = `3px solid ${sportColorDark(t)}`;
            const sport = document.createElement('span');
            sport.className = 'cal-detail-sport';
            sport.textContent = `${emoji(t)} ${t}`;
            const name = document.createElement('span');
            name.className = 'cal-detail-name';
            name.textContent = a.name || '—';
            const stats = document.createElement('span');
            stats.className = 'cal-detail-stats';
            stats.textContent = [km, dur, hr, ele, tss].filter(Boolean).join(' · ');
            link.append(sport, name, stats);
            rows.append(link);
        }

        const header = document.createElement('div');
        header.className = 'cal-detail-header';
        const heading = document.createElement('strong');
        heading.textContent = `${DAYS_SHORT[(dt.getDay() + 6) % 7]}, ${utils.formatDate(dt)}`;
        const close = document.createElement('button');
        close.className = 'cal-detail-close';
        close.textContent = '✕';
        close.addEventListener('click', () => panel.remove());
        header.append(heading, close);
        panel.replaceChildren(header, rows);

        root.querySelector('#cal-body').after(panel);
    }

    renderAll();
}
