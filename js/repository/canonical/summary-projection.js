const CATEGORY_NAMES = Object.freeze({
    run: 'Run',
    ride: 'Ride',
    swim: 'Swim',
    walk: 'Walk',
    hike: 'Hike',
    workout: 'Workout',
    winter: 'WinterSport',
    team: 'TeamSport',
    racket: 'RacketSport',
    other: 'Other'
});

const VARIANT_NAMES = new Map([
    ['run\u0000trail-run', 'TrailRun'],
    ['run\u0000virtual-run', 'VirtualRun'],
    ['ride\u0000mountain-bike', 'MountainBikeRide'],
    ['ride\u0000gravel', 'GravelRide'],
    ['ride\u0000virtual', 'VirtualRide'],
    ['ride\u0000indoor', 'IndoorRide'],
    ['ride\u0000e-bike', 'EBikeRide'],
    ['ride\u0000e-mountain-bike', 'EMountainBikeRide'],
    ['swim\u0000pool', 'PoolSwim'],
    ['swim\u0000open-water', 'OpenWaterSwim'],
    ['workout\u0000strength', 'WeightTraining'],
    ['workout\u0000cross-training', 'Crossfit'],
    ['workout\u0000elliptical', 'Elliptical'],
    ['workout\u0000stair-stepper', 'StairStepper'],
    ['workout\u0000yoga', 'Yoga'],
    ['workout\u0000pilates', 'Pilates'],
    ['workout\u0000hiit', 'HighIntensityIntervalTraining'],
    ['winter\u0000alpine-ski', 'AlpineSki'],
    ['winter\u0000nordic-ski', 'NordicSki'],
    ['winter\u0000snowboard', 'Snowboard'],
    ['winter\u0000snowshoe', 'Snowshoe'],
    ['team\u0000football', 'Soccer'],
    ['team\u0000basketball', 'Basketball'],
    ['team\u0000volleyball', 'Volleyball'],
    ['racket\u0000tennis', 'Tennis'],
    ['racket\u0000table-tennis', 'TableTennis'],
    ['racket\u0000badminton', 'Badminton'],
    ['racket\u0000pickleball', 'Pickleball'],
    ['racket\u0000padel', 'Padel'],
    ['racket\u0000racquetball', 'Racquetball'],
    ['racket\u0000squash', 'Squash']
]);

const TIME_ZONE_FIELDS = new Set(['ianaName', 'utcOffsetMinutes']);

function projectionFailure() {
    throw new TypeError('Canonical summary projection failed.');
}

function readRecord(value, allowedFields = null) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.some(key => (
            typeof key !== 'string'
            || (allowedFields !== null && !allowedFields.has(key))
        ))) {
            return null;
        }
        const result = Object.create(null);
        for (const key of keys) {
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

function required(record, field) {
    if (!Object.hasOwn(record, field)) projectionFailure();
    return record[field];
}

function define(target, key, value) {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
    });
}

function compatibilityType(category, variant) {
    const fallback = CATEGORY_NAMES[category];
    if (typeof fallback !== 'string') projectionFailure();
    if (variant === null) return fallback;
    if (typeof variant !== 'string') projectionFailure();
    return VARIANT_NAMES.get(`${category}\u0000${variant}`) ?? fallback;
}

function localStart(startTimeUtc, timeZone) {
    const zone = readRecord(timeZone, TIME_ZONE_FIELDS);
    if (
        zone === null
        || Reflect.ownKeys(zone).length !== TIME_ZONE_FIELDS.size
        || !Object.hasOwn(zone, 'utcOffsetMinutes')
    ) {
        projectionFailure();
    }
    const offset = zone.utcOffsetMinutes;
    if (offset === null) return startTimeUtc;
    if (!Number.isInteger(offset) || offset < -840 || offset > 840) {
        projectionFailure();
    }
    const instant = Date.parse(startTimeUtc);
    if (!Number.isFinite(instant)) projectionFailure();
    return new Date(instant + offset * 60_000)
        .toISOString()
        .slice(0, -1);
}

function shadowGear(extensions) {
    if (extensions === undefined || extensions === null) {
        return Object.freeze({ present: false });
    }
    const extensionRecord = readRecord(extensions);
    if (extensionRecord === null) projectionFailure();
    if (!Object.hasOwn(extensionRecord, 'shadowCanonicalWriterV1')) {
        return Object.freeze({ present: false });
    }
    const namespace = readRecord(extensionRecord.shadowCanonicalWriterV1);
    if (namespace === null) projectionFailure();
    if (!Object.hasOwn(namespace, 'gearExternalId')) {
        return Object.freeze({ present: false });
    }
    const value = namespace.gearExternalId;
    if (
        value !== null
        && (typeof value !== 'string' || value.trim().length === 0)
    ) {
        projectionFailure();
    }
    return Object.freeze({ present: true, value });
}

export function projectCanonicalSummaryActivity(value) {
    const activity = readRecord(value);
    if (activity === null) projectionFailure();

    const id = required(activity, 'id');
    const category = required(activity, 'sportCategory');
    const variant = required(activity, 'sportVariant');
    const startTimeUtc = required(activity, 'startTimeUtc');
    const timeZone = required(activity, 'timeZone');
    if (
        typeof id !== 'string'
        || id.trim().length === 0
        || typeof startTimeUtc !== 'string'
    ) {
        projectionFailure();
    }

    const type = compatibilityType(category, variant);
    const result = {};
    define(result, 'id', id);
    define(result, 'type', type);
    define(result, 'sport_type', type);
    define(result, 'start_date', startTimeUtc);
    define(result, 'start_date_local', localStart(startTimeUtc, timeZone));

    for (const [canonicalField, legacyField] of [
        ['name', 'name'],
        ['distanceMeters', 'distance'],
        ['elevationGainMeters', 'total_elevation_gain'],
        ['movingTimeSeconds', 'moving_time'],
        ['elapsedTimeSeconds', 'elapsed_time'],
        ['averageHeartRateBpm', 'average_heartrate'],
        ['averagePowerWatts', 'average_watts'],
        ['averageCadence', 'average_cadence']
    ]) {
        if (Object.hasOwn(activity, canonicalField)) {
            define(result, legacyField, activity[canonicalField]);
        }
    }

    const gear = shadowGear(activity.extensions);
    if (gear.present) define(result, 'gear_id', gear.value);
    return Object.freeze(result);
}

export function projectCanonicalSummaryActivities(values) {
    if (!Array.isArray(values)) projectionFailure();
    let keys;
    try {
        keys = Reflect.ownKeys(values);
    } catch {
        projectionFailure();
    }
    if (
        Object.getPrototypeOf(values) !== Array.prototype
        || keys.length !== values.length + 1
    ) {
        projectionFailure();
    }
    const result = [];
    for (let index = 0; index < values.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
            projectionFailure();
        }
        result.push(projectCanonicalSummaryActivity(descriptor.value));
    }
    return Object.freeze(result);
}
