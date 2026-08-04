const LEGACY_FIELDS = Object.freeze([
    'id',
    'sport_type',
    'type',
    'start_date',
    'utc_offset',
    'name',
    'distance',
    'moving_time',
    'elapsed_time',
    'total_elevation_gain',
    'average_heartrate',
    'average_watts',
    'average_cadence',
    'gear_id',
    'map'
]);

const SPORT_MAP = new Map([
    ['Run', ['run', null]],
    ['TrailRun', ['run', 'trail-run']],
    ['VirtualRun', ['run', 'virtual-run']],
    ['Ride', ['ride', null]],
    ['MountainBikeRide', ['ride', 'mountain-bike']],
    ['GravelRide', ['ride', 'gravel']],
    ['VirtualRide', ['ride', 'virtual']],
    ['EBikeRide', ['ride', 'e-bike']],
    ['EMountainBikeRide', ['ride', 'e-mountain-bike']],
    ['Swim', ['swim', null]],
    ['Walk', ['walk', null]],
    ['Hike', ['hike', null]],
    ['Workout', ['workout', null]],
    ['WeightTraining', ['workout', 'strength']],
    ['Crossfit', ['workout', 'cross-training']],
    ['Elliptical', ['workout', 'elliptical']],
    ['StairStepper', ['workout', 'stair-stepper']],
    ['Yoga', ['workout', 'yoga']],
    ['AlpineSki', ['winter', 'alpine-ski']],
    ['NordicSki', ['winter', 'nordic-ski']],
    ['Snowboard', ['winter', 'snowboard']],
    ['Snowshoe', ['winter', 'snowshoe']],
    ['Soccer', ['team', 'football']],
    ['Tennis', ['racket', 'tennis']],
    ['Badminton', ['racket', 'badminton']],
    ['Pickleball', ['racket', 'pickleball']],
    ['Padel', ['racket', 'padel']],
    ['Racquetball', ['racket', 'racquetball']],
    ['Squash', ['racket', 'squash']]
]);

const PARITY_FIELD = Object.freeze({
    ID: 'opaqueId',
    DISTANCE: 'distance',
    MOVING_TIME: 'movingTime',
    ELAPSED_TIME: 'elapsedTime',
    DATE: 'date',
    SPORT: 'sportType',
    HEART_RATE: 'heartRate',
    POWER: 'power',
    GEAR: 'gear'
});

function ownDataRecord(value, fields = null) {
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
        if (keys.some(key => typeof key !== 'string')) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            if (fields === null || fields.includes(key)) {
                result[key] = descriptor.value;
            }
        }
        return result;
    } catch {
        return null;
    }
}

function define(target, key, value) {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
    });
}

function state(value, present = true) {
    if (!present) return Object.freeze({ state: 'missing' });
    if (value === null) return Object.freeze({ state: 'null', value: null });
    if (typeof value === 'number' && value === 0) {
        return Object.freeze({ state: 'zero', value });
    }
    return Object.freeze({ state: 'value', value });
}

function failure(field, reason) {
    return Object.freeze({ ok: false, field, reason });
}

function normalizedOpaqueId(value) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    if (
        typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 0
    ) {
        return String(value);
    }
    return null;
}

function normalizedUtcInstant(value) {
    if (typeof value !== 'string') return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!parts) return null;
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const hour = Number(parts[4]);
    const minute = Number(parts[5]);
    const second = Number(parts[6]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (
        year === 0
        || month < 1
        || month > 12
        || day < 1
        || day > monthDays[month - 1]
        || hour > 23
        || minute > 59
        || second > 59
    ) return null;
    if (parts[8] !== 'Z') {
        const offsetHour = Number(parts[8].slice(1, 3));
        const offsetMinute = Number(parts[8].slice(4, 6));
        if (
            offsetHour > 14
            || offsetMinute > 59
            || (offsetHour === 14 && offsetMinute !== 0)
        ) return null;
    }
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return null;
    const normalized = new Date(timestamp).toISOString();
    return normalized.endsWith('Z') ? normalized : null;
}

function copyNullableNumber(source, sourceField, target, targetField) {
    if (!Object.hasOwn(source, sourceField)) {
        return { ok: true, expectation: state(undefined, false) };
    }
    const value = source[sourceField];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
        return { ok: false };
    }
    define(target, targetField, value);
    return { ok: true, expectation: state(value) };
}

function normalizedUtcOffset(source, warnings) {
    if (!Object.hasOwn(source, 'utc_offset')) return null;
    const value = source.utc_offset;
    if (
        typeof value === 'number'
        && Number.isFinite(value)
        && Number.isInteger(value / 60)
        && value / 60 >= -840
        && value / 60 <= 840
    ) {
        return value / 60;
    }
    warnings.push(Object.freeze({
        field: PARITY_FIELD.DATE,
        reason: 'TIMEZONE_OFFSET_UNSUPPORTED'
    }));
    return null;
}

function sport(source, warnings) {
    const primary = Object.hasOwn(source, 'sport_type')
        ? source.sport_type
        : undefined;
    const fallback = Object.hasOwn(source, 'type') ? source.type : undefined;
    if (
        primary !== undefined
        && primary !== null
        && typeof primary !== 'string'
    ) {
        return null;
    }
    if (
        fallback !== undefined
        && fallback !== null
        && typeof fallback !== 'string'
    ) {
        return null;
    }
    const selected = typeof primary === 'string' && primary.trim().length > 0
        ? primary
        : typeof fallback === 'string' && fallback.trim().length > 0
            ? fallback
            : null;
    if (
        typeof primary === 'string'
        && primary.trim().length > 0
        && typeof fallback === 'string'
        && fallback.trim().length > 0
        && primary !== fallback
    ) {
        warnings.push(Object.freeze({
            field: PARITY_FIELD.SPORT,
            reason: 'SPORT_SOURCE_CONFLICT'
        }));
    }
    if (selected === null || !SPORT_MAP.has(selected)) {
        warnings.push(Object.freeze({
            field: PARITY_FIELD.SPORT,
            reason: 'SPORT_NORMALIZED_TO_OTHER'
        }));
        return Object.freeze({ category: 'other', variant: null });
    }
    const [category, variant] = SPORT_MAP.get(selected);
    return Object.freeze({ category, variant });
}

function hasSummaryPolyline(source) {
    if (!Object.hasOwn(source, 'map') || source.map === null) return false;
    const map = ownDataRecord(source.map);
    if (map === null) return null;
    if (!Object.hasOwn(map, 'summary_polyline')) return false;
    return typeof map.summary_polyline === 'string'
        && map.summary_polyline.length > 0;
}

function canonicalGear(source, activity) {
    if (!Object.hasOwn(source, 'gear_id')) {
        return { ok: true, expectation: state(undefined, false) };
    }
    const raw = source.gear_id;
    if (raw !== null) {
        const normalized = normalizedOpaqueId(raw);
        if (normalized === null) return { ok: false };
        activity.extensions = {
            shadowCanonicalWriterV1: {
                gearExternalId: normalized
            }
        };
        return { ok: true, expectation: state(normalized) };
    }
    activity.extensions = {
        shadowCanonicalWriterV1: {
            gearExternalId: null
        }
    };
    return { ok: true, expectation: state(null) };
}

function canonicalExpectation(bundle) {
    const activity = ownDataRecord(bundle.activity);
    if (activity === null) return null;
    const extension = ownDataRecord(activity.extensions ?? {});
    const namespace = extension
        ? ownDataRecord(extension.shadowCanonicalWriterV1 ?? {})
        : null;
    const gearPresent = namespace !== null
        && Object.hasOwn(namespace, 'gearExternalId');
    return Object.freeze({
        [PARITY_FIELD.ID]: state(activity.id),
        [PARITY_FIELD.DISTANCE]: state(
            activity.distanceMeters,
            Object.hasOwn(activity, 'distanceMeters')
        ),
        [PARITY_FIELD.MOVING_TIME]: state(
            activity.movingTimeSeconds,
            Object.hasOwn(activity, 'movingTimeSeconds')
        ),
        [PARITY_FIELD.ELAPSED_TIME]: state(
            activity.elapsedTimeSeconds,
            Object.hasOwn(activity, 'elapsedTimeSeconds')
        ),
        [PARITY_FIELD.DATE]: state(activity.startTimeUtc),
        [PARITY_FIELD.SPORT]: state(
            `${activity.sportCategory}\u0000${activity.sportVariant ?? ''}`
        ),
        [PARITY_FIELD.HEART_RATE]: state(
            activity.averageHeartRateBpm,
            Object.hasOwn(activity, 'averageHeartRateBpm')
        ),
        [PARITY_FIELD.POWER]: state(
            activity.averagePowerWatts,
            Object.hasOwn(activity, 'averagePowerWatts')
        ),
        [PARITY_FIELD.GEAR]: state(
            gearPresent ? namespace.gearExternalId : undefined,
            gearPresent
        )
    });
}

export function expectationsFromCanonicalBundle(bundle) {
    try {
        const record = ownDataRecord(bundle);
        const activity = record ? ownDataRecord(record.activity) : null;
        if (!record || !activity) return null;
        return canonicalExpectation({ activity });
    } catch {
        return null;
    }
}

export function mapLegacyActivityToCanonicalBundle(value) {
    const source = ownDataRecord(value, LEGACY_FIELDS);
    if (source === null) return failure(null, 'LEGACY_RECORD_UNSAFE');

    const id = normalizedOpaqueId(source.id);
    if (id === null) return failure(PARITY_FIELD.ID, 'OPAQUE_ID_INVALID');
    const startTimeUtc = normalizedUtcInstant(source.start_date);
    if (startTimeUtc === null) {
        return failure(PARITY_FIELD.DATE, 'START_DATE_INVALID');
    }
    const warnings = [];
    const normalizedSport = sport(source, warnings);
    if (normalizedSport === null) {
        return failure(PARITY_FIELD.SPORT, 'SPORT_VALUE_INVALID');
    }
    const gps = hasSummaryPolyline(source);
    if (gps === null) return failure(null, 'MAP_RECORD_UNSAFE');

    const activity = {
        schemaVersion: 1,
        id,
        sportCategory: normalizedSport.category,
        sportVariant: normalizedSport.variant,
        startTimeUtc,
        timeZone: {
            ianaName: null,
            utcOffsetMinutes: normalizedUtcOffset(source, warnings)
        },
        capabilities: {
            hasGps: gps,
            hasHeartRate: Object.hasOwn(source, 'average_heartrate')
                && source.average_heartrate !== null,
            hasPower: Object.hasOwn(source, 'average_watts')
                && source.average_watts !== null,
            hasCadence: Object.hasOwn(source, 'average_cadence')
                && source.average_cadence !== null,
            hasLaps: false
        }
    };

    if (Object.hasOwn(source, 'name')) {
        if (source.name !== null && typeof source.name !== 'string') {
            return failure(null, 'NAME_VALUE_INVALID');
        }
        activity.name = source.name;
    }

    const numericMappings = [
        ['distance', 'distanceMeters', PARITY_FIELD.DISTANCE],
        ['moving_time', 'movingTimeSeconds', PARITY_FIELD.MOVING_TIME],
        ['elapsed_time', 'elapsedTimeSeconds', PARITY_FIELD.ELAPSED_TIME],
        ['total_elevation_gain', 'elevationGainMeters', null],
        ['average_heartrate', 'averageHeartRateBpm', PARITY_FIELD.HEART_RATE],
        ['average_watts', 'averagePowerWatts', PARITY_FIELD.POWER],
        ['average_cadence', 'averageCadence', null]
    ];
    const expectations = {
        [PARITY_FIELD.ID]: state(id),
        [PARITY_FIELD.DATE]: state(startTimeUtc),
        [PARITY_FIELD.SPORT]: state(
            `${normalizedSport.category}\u0000${normalizedSport.variant ?? ''}`
        )
    };
    for (const [legacyField, canonicalField, parityField] of numericMappings) {
        const copied = copyNullableNumber(
            source,
            legacyField,
            activity,
            canonicalField
        );
        if (!copied.ok) {
            return failure(parityField, 'SUMMARY_NUMBER_INVALID');
        }
        if (parityField) expectations[parityField] = copied.expectation;
    }

    const gear = canonicalGear(source, activity);
    if (!gear.ok) return failure(PARITY_FIELD.GEAR, 'GEAR_ID_INVALID');
    expectations[PARITY_FIELD.GEAR] = gear.expectation;

    warnings.push(Object.freeze({
        field: PARITY_FIELD.DATE,
        reason: 'IMPORTED_AT_ACTIVITY_TIME_FALLBACK'
    }));
    const bundleWarnings = warnings.map(item => ({
        code: item.reason,
        path: item.field ? `/shadow/${item.field}` : '/shadow',
        message: 'Shadow normalization used a documented deterministic fallback.'
    }));
    const bundle = {
        schemaVersion: 1,
        activity,
        streams: {
            activityId: id,
            series: []
        },
        laps: [],
        events: [],
        sources: [
            {
                id: `strava-api-shadow:${id}`,
                activityId: id,
                provider: 'strava',
                externalId: id,
                rawArtifactId: null,
                acquisitionMethod: 'api-shadow-v1',
                deviceId: null,
                importedAt: startTimeUtc
            }
        ],
        devices: [],
        warnings: bundleWarnings,
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'strava-api-summary-shadow-v1',
            normalizerVersion: 'legacy-to-canonical-shadow-v1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };

    return Object.freeze({
        ok: true,
        bundle,
        expectations: Object.freeze(expectations),
        warnings: Object.freeze(warnings)
    });
}

export { PARITY_FIELD };
