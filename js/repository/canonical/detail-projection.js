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
    const laps = readDenseArray(values.laps);
    const streams = readRecord(values.streams);
    const series = readDenseArray(streams?.series);
    if (
        values.activity === null
        || typeof values.activity !== 'object'
        || laps === null
        || streams === null
        || series === null
        || streams.activityId !== values.activity.id
    ) projectionFailure();
    return { activity: values.activity, laps, series };
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

function referenceSeries(series, requestedTypes) {
    if (requestedTypes.includes('distance') && series.has('distance')) {
        return series.get('distance');
    }
    if (requestedTypes.includes('latlng') && series.has('position')) {
        return series.get('position');
    }
    return [...series.entries()]
        .sort(([left], [right]) => left < right ? -1 : (left > right ? 1 : 0))[0]?.[1]
        ?? null;
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
    const reference = referenceSeries(series, values);
    const result = {};
    for (const type of values) {
        if (type === 'time') {
            if (reference !== null) {
                define(result, 'time', Object.freeze({ data: reference.offsets }));
            }
            continue;
        }
        const canonicalType = LEGACY_TO_CANONICAL_STREAM.get(type);
        const stored = series.get(canonicalType);
        if (
            stored !== undefined
            && reference !== null
            && sameTimeline(stored.offsets, reference.offsets)
        ) {
            define(result, type, Object.freeze({ data: stored.data }));
        }
    }
    return Object.freeze(result);
}
