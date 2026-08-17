import { projectCanonicalSummaryActivity } from './summary-projection.js';

const LEGACY_TO_CANONICAL_STREAM = new Map([
    ['distance', 'distance'],
    ['latlng', 'position'],
    ['altitude', 'altitude'],
    ['velocity_smooth', 'speed'],
    ['heartrate', 'heartRate'],
    ['cadence', 'cadence'],
    ['watts', 'power'],
    ['temp', 'temperature'],
    ['moving', 'moving'],
    ['grade_smooth', 'grade_smooth']
]);

function projectionFailure() {
    throw new TypeError('Canonical detail projection failed.');
}

function readRecord(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') return null;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function readDenseArray(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) return null;
        const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
        if (!Number.isSafeInteger(length) || length < 0) return null;
        if (Reflect.ownKeys(value).length !== length + 1) return null;
        const result = [];
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

function readStringArray(value) {
    const values = readDenseArray(value);
    if (
        values === null
        || values.length === 0
        || values.some(item => typeof item !== 'string' || item.trim().length === 0)
        || new Set(values).size !== values.length
    ) projectionFailure();
    return values;
}

function define(target, key, value) {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
    });
}

function cloneJson(value, active = new Set()) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) projectionFailure();
        return value;
    }
    if (typeof value !== 'object' || active.has(value)) projectionFailure();
    active.add(value);
    try {
        const array = readDenseArray(value);
        if (array !== null) {
            const result = array.map(item => cloneJson(item, active));
            return Object.freeze(result);
        }
        const record = readRecord(value);
        if (record === null) projectionFailure();
        const result = {};
        for (const key of Reflect.ownKeys(record)) {
            define(result, key, cloneJson(record[key], active));
        }
        return Object.freeze(result);
    } finally {
        active.delete(value);
    }
}

function bundleParts(bundle) {
    const values = readRecord(bundle);
    if (values === null) projectionFailure();
    const activity = readRecord(values.activity);
    const laps = readDenseArray(values.laps);
    const streams = readRecord(values.streams);
    const series = readDenseArray(streams?.series);
    if (
        activity === null
        || laps === null
        || streams === null
        || series === null
        || streams.activityId !== activity.id
    ) projectionFailure();
    return { activity, laps, series };
}

function projectLap(value) {
    const lap = readRecord(value);
    if (
        lap === null
        || !Number.isInteger(lap.index)
        || lap.index < 0
        || !Number.isFinite(lap.elapsedTimeSeconds)
        || lap.elapsedTimeSeconds < 0
    ) projectionFailure();
    const result = {};
    define(result, 'lap_index', lap.index);
    if (Object.hasOwn(lap, 'distanceMeters')) {
        define(result, 'distance', lap.distanceMeters);
    }
    if (Object.hasOwn(lap, 'movingTimeSeconds')) {
        define(result, 'moving_time', lap.movingTimeSeconds);
    }
    define(result, 'elapsed_time', lap.elapsedTimeSeconds);
    if (
        typeof lap.distanceMeters === 'number'
        && Number.isFinite(lap.distanceMeters)
        && typeof lap.movingTimeSeconds === 'number'
        && Number.isFinite(lap.movingTimeSeconds)
        && lap.movingTimeSeconds > 0
    ) {
        define(result, 'average_speed', lap.distanceMeters / lap.movingTimeSeconds);
    }
    return Object.freeze(result);
}

export function canonicalStreamTypesForLegacy(requestedTypes) {
    const values = readStringArray(requestedTypes);
    const result = [];
    const seen = new Set();
    for (const type of values) {
        if (type === 'time') continue;
        const canonicalType = LEGACY_TO_CANONICAL_STREAM.get(type);
        if (canonicalType === undefined) projectionFailure();
        if (!seen.has(canonicalType)) {
            seen.add(canonicalType);
            result.push(canonicalType);
        }
    }
    return Object.freeze(result);
}

export function projectCanonicalDetailActivity(bundle) {
    const { activity, laps } = bundleParts(bundle);
    const summary = projectCanonicalSummaryActivity(activity);
    const result = {};
    for (const key of Reflect.ownKeys(summary)) {
        const descriptor = Object.getOwnPropertyDescriptor(summary, key);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
            projectionFailure();
        }
        define(result, key, cloneJson(descriptor.value));
    }
    define(result, 'laps', Object.freeze(laps.map(projectLap)));
    return Object.freeze(result);
}

function readSeries(values) {
    const result = new Map();
    for (const value of values) {
        const series = readRecord(value);
        const offsets = readDenseArray(series?.offsetsSeconds);
        const data = readDenseArray(series?.values);
        if (
            series === null
            || typeof series.streamType !== 'string'
            || series.streamType.trim().length === 0
            || offsets === null
            || data === null
            || offsets.length !== data.length
            || result.has(series.streamType)
        ) projectionFailure();
        for (let index = 0; index < offsets.length; index += 1) {
            const offset = offsets[index];
            if (
                typeof offset !== 'number'
                || !Number.isFinite(offset)
                || offset < 0
                || (index > 0 && offset < offsets[index - 1])
            ) projectionFailure();
        }
        result.set(series.streamType, {
            offsets: cloneJson(offsets),
            data: cloneJson(data)
        });
    }
    return result;
}

function sameTimeline(left, right) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        if (!Object.is(left[index], right[index])) return false;
    }
    return true;
}

function unionTimeline(series) {
    const ordered = [...series.entries()]
        .sort(([left], [right]) => left < right ? -1 : (left > right ? 1 : 0))
        .map(([, value]) => value);
    const cursors = ordered.map(() => 0);
    const timeline = [];

    while (true) {
        let hasNext = false;
        let nextOffset;
        for (let index = 0; index < ordered.length; index += 1) {
            const offset = ordered[index].offsets[cursors[index]];
            if (
                offset !== undefined
                && (!hasNext || offset < nextOffset)
            ) {
                hasNext = true;
                nextOffset = offset;
            }
        }
        if (!hasNext) break;

        let occurrences = 0;
        for (let index = 0; index < ordered.length; index += 1) {
            const offsets = ordered[index].offsets;
            const start = cursors[index];
            let end = start;
            while (end < offsets.length && offsets[end] === nextOffset) {
                end += 1;
            }
            occurrences = Math.max(occurrences, end - start);
            cursors[index] = end;
        }
        for (let index = 0; index < occurrences; index += 1) {
            timeline.push(nextOffset);
        }
    }

    return Object.freeze(timeline);
}

function alignSeriesToTimeline(series, timeline) {
    if (sameTimeline(series.offsets, timeline)) return series.data;
    const aligned = [];
    let sourceIndex = 0;
    for (const offset of timeline) {
        if (
            sourceIndex < series.offsets.length
            && series.offsets[sourceIndex] === offset
        ) {
            aligned.push(series.data[sourceIndex]);
            sourceIndex += 1;
        } else {
            aligned.push(null);
        }
    }
    if (sourceIndex !== series.offsets.length) projectionFailure();
    return Object.freeze(aligned);
}

export function projectCanonicalDetailStreams(bundle, requestedTypes) {
    const values = readStringArray(requestedTypes);
    for (const type of values) {
        if (type !== 'time' && !LEGACY_TO_CANONICAL_STREAM.has(type)) {
            projectionFailure();
        }
    }
    const { series: storedSeries } = bundleParts(bundle);
    const series = readSeries(storedSeries);
    const selectedSeries = new Map();
    for (const type of values) {
        if (type === 'time') continue;
        const canonicalType = LEGACY_TO_CANONICAL_STREAM.get(type);
        const stored = series.get(canonicalType);
        if (stored !== undefined) selectedSeries.set(canonicalType, stored);
    }
    const position = selectedSeries.get('position') ?? null;
    const chartSeries = new Map(selectedSeries);
    chartSeries.delete('position');
    const timeline = chartSeries.size > 0
        ? unionTimeline(chartSeries)
        : position?.offsets ?? null;
    const result = {};
    for (const type of values) {
        if (type === 'time') {
            if (timeline !== null) {
                define(result, 'time', Object.freeze({ data: timeline }));
            }
            continue;
        }
        const canonicalType = LEGACY_TO_CANONICAL_STREAM.get(type);
        const stored = selectedSeries.get(canonicalType);
        if (canonicalType === 'position' && stored !== undefined) {
            define(result, type, Object.freeze({ data: stored.data }));
            continue;
        }
        if (stored !== undefined && timeline !== null) {
            define(result, type, Object.freeze({
                data: alignSeriesToTimeline(stored, timeline)
            }));
        }
    }
    return Object.freeze(result);
}
