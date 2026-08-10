import { validateImportedActivityBundle } from '../../data/contracts/index.js';

export const STRAVA_IMPORT_LIMITS = Object.freeze({
    maxActivitiesPerRun: 100,
    maxConcurrentActivityOperations: 2,
    maxStreamPointsPerSeries: 200_000,
    maxLapsPerActivity: 10_000
});

export const STRAVA_IMPORT_MAPPER_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    AUTHORIZATION_REQUIRED: 'AUTHORIZATION_REQUIRED',
    IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
    SCOPE_INSUFFICIENT: 'SCOPE_INSUFFICIENT',
    LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
    CANCELLED: 'CANCELLED',
    PROVIDER_RECORD_INVALID: 'PROVIDER_RECORD_INVALID',
    BUNDLE_INVALID: 'BUNDLE_INVALID'
});

export const STRAVA_IMPORT_MAPPER_WARNING_CODE = Object.freeze({
    UNKNOWN_FIELDS_DROPPED: 'UNKNOWN_FIELDS_DROPPED',
    PRIVATE_FIELDS_DROPPED: 'PRIVATE_FIELDS_DROPPED',
    DETAIL_CONFLICT_DROPPED: 'DETAIL_CONFLICT_DROPPED',
    SPORT_FALLBACK: 'SPORT_FALLBACK',
    TIME_ZONE_NAME_DROPPED: 'TIME_ZONE_NAME_DROPPED',
    DETAIL_UNAVAILABLE: 'DETAIL_UNAVAILABLE',
    LAPS_UNAVAILABLE: 'LAPS_UNAVAILABLE',
    STREAMS_UNAVAILABLE: 'STREAMS_UNAVAILABLE',
    STREAM_UNAVAILABLE: 'STREAM_UNAVAILABLE',
    TIME_STREAM_UNAVAILABLE: 'TIME_STREAM_UNAVAILABLE'
});

const ERROR_MESSAGES = Object.freeze({
    INVALID_REQUEST: 'The mapper request is invalid.',
    AUTHORIZATION_REQUIRED: 'Provider authorization is required.',
    IDENTITY_MISMATCH: 'The provider identity does not match the connection.',
    SCOPE_INSUFFICIENT: 'The provider scope is insufficient.',
    LIMIT_EXCEEDED: 'The mapper input exceeds a fixed limit.',
    CANCELLED: 'The mapper operation was cancelled.',
    PROVIDER_RECORD_INVALID: 'The provider record is invalid.',
    BUNDLE_INVALID: 'The mapped activity bundle is invalid.'
});

const WARNING_DEFINITIONS = Object.freeze({
    UNKNOWN_FIELDS_DROPPED: Object.freeze({
        message: 'Unsupported provider fields were omitted.'
    }),
    PRIVATE_FIELDS_DROPPED: Object.freeze({
        message: 'Provider fields outside the minimal data contract were omitted.'
    }),
    DETAIL_CONFLICT_DROPPED: Object.freeze({
        message: 'Conflicting provider detail was omitted.'
    }),
    SPORT_FALLBACK: Object.freeze({
        message: 'The provider sport used the source-neutral fallback.'
    }),
    TIME_ZONE_NAME_DROPPED: Object.freeze({
        message: 'The provider time-zone display value was omitted.'
    }),
    DETAIL_UNAVAILABLE: Object.freeze({
        message: 'Optional provider detail was unavailable.'
    }),
    LAPS_UNAVAILABLE: Object.freeze({
        message: 'Optional provider laps were unavailable.'
    }),
    STREAMS_UNAVAILABLE: Object.freeze({
        message: 'Optional provider streams were unavailable.'
    }),
    STREAM_UNAVAILABLE: Object.freeze({
        message: 'An optional provider stream was unavailable.'
    }),
    TIME_STREAM_UNAVAILABLE: Object.freeze({
        message: 'Provider stream timing was unavailable.'
    })
});

const INVALID = Symbol('invalid');
const ERROR_CODES = new Set(Object.values(STRAVA_IMPORT_MAPPER_ERROR_CODE));
const ERROR_STAGES = new Set([
    'authorization',
    'mapping',
    'cancellation',
    'validation'
]);
const FACTORY_FIELDS = Object.freeze(['session', 'connection']);
const SESSION_FIELDS = Object.freeze(['provider', 'subjectId', 'grantedScopes']);
const CONNECTION_FIELDS = Object.freeze([
    'id',
    'provider',
    'subjectId',
    'status',
    'lastSyncAt',
    'errorCode',
    'revision'
]);
const CONTROL_FIELDS = Object.freeze(['cancelled', 'acquiredAt', 'activities']);
const ITEM_FIELDS = Object.freeze(['summary', 'detail', 'streams']);
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const PRIVATE_FIELDS = new Set([
    'name',
    'athlete',
    'map',
    'gear_id',
    'device_name'
]);
const SUMMARY_FIELDS = new Set([
    'id',
    'sport_type',
    'type',
    'start_date',
    'utc_offset',
    'timezone',
    'name',
    'distance',
    'moving_time',
    'elapsed_time',
    'total_elevation_gain',
    'average_heartrate',
    'average_watts',
    'average_cadence',
    'athlete',
    'map',
    'gear_id',
    'device_name'
]);
const DETAIL_FIELDS = new Set([...SUMMARY_FIELDS, 'laps']);
const LAP_FIELDS = new Set([
    'lap_index',
    'elapsed_time',
    'moving_time',
    'distance'
]);
const STREAM_FIELDS = new Set([
    'time',
    'distance',
    'latlng',
    'altitude',
    'velocity_smooth',
    'heartrate',
    'cadence',
    'watts',
    'temp',
    'moving',
    'grade_smooth'
]);
const SUMMARY_VALUE_FIELDS = Object.freeze([
    'sport_type',
    'type',
    'start_date',
    'utc_offset',
    'timezone',
    'distance',
    'moving_time',
    'elapsed_time',
    'total_elevation_gain',
    'average_heartrate',
    'average_watts',
    'average_cadence'
]);
const SUMMARY_NUMBER_MAP = Object.freeze([
    ['distance', 'distanceMeters', 'nonnegative'],
    ['moving_time', 'movingTimeSeconds', 'nonnegative'],
    ['elapsed_time', 'elapsedTimeSeconds', 'nonnegative'],
    ['total_elevation_gain', 'elevationGainMeters', 'nonnegative'],
    ['average_heartrate', 'averageHeartRateBpm', 'heartRate'],
    ['average_watts', 'averagePowerWatts', 'nonnegative'],
    ['average_cadence', 'averageCadence', 'nonnegative']
]);
const STREAM_MAP = Object.freeze([
    Object.freeze(['distance', 'distance', 'm', 'nonnegative']),
    Object.freeze(['latlng', 'position', 'wgs84', 'position']),
    Object.freeze(['altitude', 'altitude', 'm', 'number']),
    Object.freeze(['velocity_smooth', 'speed', 'm/s', 'number']),
    Object.freeze(['heartrate', 'heartRate', 'bpm', 'heartRate']),
    Object.freeze(['cadence', 'cadence', 'rpm', 'nonnegative']),
    Object.freeze(['watts', 'power', 'W', 'nonnegative']),
    Object.freeze(['temp', 'temperature', 'C', 'number']),
    Object.freeze(['moving', 'moving', 'boolean', 'moving']),
    Object.freeze(['grade_smooth', 'grade_smooth', 'percent', 'number'])
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

export class StravaImportMapperError extends Error {
    constructor(code, stage, activityIndex = null) {
        const valid = ERROR_CODES.has(code)
            && ERROR_STAGES.has(stage)
            && (
                activityIndex === null
                || (Number.isSafeInteger(activityIndex) && activityIndex >= 0)
            );
        const normalizedCode = valid
            ? code
            : STRAVA_IMPORT_MAPPER_ERROR_CODE.INVALID_REQUEST;
        const normalizedStage = valid ? stage : 'mapping';
        const normalizedIndex = valid ? activityIndex : null;
        super(ERROR_MESSAGES[normalizedCode]);
        this.name = 'StravaImportMapperError';
        this.code = normalizedCode;
        this.stage = normalizedStage;
        this.activityIndex = normalizedIndex;
        this.retryable = false;
        Object.freeze(this);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            stage: this.stage,
            activityIndex: this.activityIndex,
            retryable: this.retryable
        };
    }
}

function fail(code, stage, activityIndex = null) {
    throw new StravaImportMapperError(code, stage, activityIndex);
}

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ordinaryRecord(value, exactFields = null) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.some(key => typeof key !== 'string')) return null;
        if (
            exactFields !== null
            && !sameArray(keys.slice().sort(), exactFields.slice().sort())
        ) return null;
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

function denseArray(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
        if (!Number.isSafeInteger(length) || length < 0) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.length !== length + 1 || keys.some(key => typeof key !== 'string')) {
            return null;
        }
        const result = new Array(length);
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[index] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function cloneJson(value, active = new Set(), depth = 0) {
    if (depth > 64) return INVALID;
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID;
    if (typeof value !== 'object' || active.has(value)) return INVALID;
    active.add(value);
    try {
        const array = denseArray(value);
        if (array !== null) {
            const result = [];
            for (const item of array) {
                const cloned = cloneJson(item, active, depth + 1);
                if (cloned === INVALID) return INVALID;
                result.push(cloned);
            }
            return result;
        }
        const record = ordinaryRecord(value);
        if (record === null) return INVALID;
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(record)) {
            const cloned = cloneJson(record[key], active, depth + 1);
            if (cloned === INVALID) return INVALID;
            result[key] = cloned;
        }
        return result;
    } finally {
        active.delete(value);
    }
}

function deepFreeze(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function providerUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    ) return null;
    const expected = value.includes('.') ? value : value.replace('Z', '.000Z');
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = new Date(parsed).toISOString();
    return normalized === expected ? normalized : null;
}

function positiveOpaqueId(value) {
    if (typeof value === 'string') return /^[1-9]\d*$/.test(value) ? value : null;
    if (Number.isSafeInteger(value) && value > 0) return String(value);
    return null;
}

function validConnectionStatus(status, errorCode) {
    if (status === 'connected') return errorCode === null;
    if (status === 'reconnect_required') return errorCode === 'AUTHORIZATION_REQUIRED';
    if (status === 'error') return errorCode === 'CONNECTION_ERROR';
    return status === 'disconnected'
        && (errorCode === null || errorCode === 'REVOCATION_UNCONFIRMED');
}

function validateAuthority(options) {
    const input = ordinaryRecord(options, FACTORY_FIELDS);
    if (!input) fail('INVALID_REQUEST', 'authorization');
    const session = ordinaryRecord(input.session, SESSION_FIELDS);
    const connection = ordinaryRecord(input.connection, CONNECTION_FIELDS);
    if (!session || !connection) fail('INVALID_REQUEST', 'authorization');
    if (
        session.provider !== 'strava'
        || positiveOpaqueId(session.subjectId) !== session.subjectId
    ) fail('INVALID_REQUEST', 'authorization');

    const scopes = denseArray(session.grantedScopes);
    if (!scopes || !sameArray(scopes, REQUIRED_SCOPES)) {
        fail('SCOPE_INSUFFICIENT', 'authorization');
    }
    if (
        connection.id !== 'source-connection:strava'
        || connection.provider !== 'strava'
        || positiveOpaqueId(connection.subjectId) !== connection.subjectId
        || !validConnectionStatus(connection.status, connection.errorCode)
        || (
            connection.lastSyncAt !== null
            && !strictUtc(connection.lastSyncAt)
        )
        || !Number.isSafeInteger(connection.revision)
        || connection.revision < 1
    ) fail('INVALID_REQUEST', 'authorization');
    if (connection.status !== 'connected') {
        fail('AUTHORIZATION_REQUIRED', 'authorization');
    }
    if (session.subjectId !== connection.subjectId) {
        fail('IDENTITY_MISMATCH', 'authorization');
    }
}

function warningCollector() {
    const values = [];
    const seen = new Set();
    return Object.freeze({
        add(code, path) {
            const key = `${code}\u0000${path}`;
            if (seen.has(key)) return;
            seen.add(key);
            values.push({
                code,
                path,
                message: WARNING_DEFINITIONS[code].message
            });
        },
        finish() {
            return values.sort((left, right) => {
                if (left.path !== right.path) return left.path < right.path ? -1 : 1;
                if (left.code !== right.code) return left.code < right.code ? -1 : 1;
                if (left.message !== right.message) return left.message < right.message ? -1 : 1;
                return 0;
            });
        }
    });
}

function collectDroppedFields(record, allowed, warnings, path) {
    let unknown = false;
    let privateField = false;
    for (const key of Reflect.ownKeys(record)) {
        if (PRIVATE_FIELDS.has(key)) privateField = true;
        else if (!allowed.has(key)) unknown = true;
    }
    if (privateField) warnings.add('PRIVATE_FIELDS_DROPPED', path);
    if (unknown) warnings.add('UNKNOWN_FIELDS_DROPPED', path);
}

function effectiveValues(summary, detail, warnings) {
    const result = Object.create(null);
    for (const field of SUMMARY_VALUE_FIELDS) {
        const summaryHas = Object.hasOwn(summary, field);
        const detailHas = detail !== null && Object.hasOwn(detail, field);
        if (summaryHas) {
            result[field] = summary[field];
            if (detailHas && !Object.is(summary[field], detail[field])) {
                warnings.add('DETAIL_CONFLICT_DROPPED', '/provider/detail');
            }
        } else if (detailHas) {
            result[field] = detail[field];
        }
    }
    return result;
}

function normalizeSport(values, warnings) {
    const hasSportType = Object.hasOwn(values, 'sport_type');
    const selected = hasSportType ? values.sport_type : values.type;
    if (typeof selected !== 'string' || selected.length === 0) return null;
    if (
        hasSportType
        && Object.hasOwn(values, 'type')
        && values.type !== selected
    ) warnings.add('DETAIL_CONFLICT_DROPPED', '/provider/summary');
    const mapped = SPORT_MAP.get(selected);
    if (mapped) return { category: mapped[0], variant: mapped[1] };
    warnings.add('SPORT_FALLBACK', '/activity/sport');
    return { category: 'other', variant: null };
}

function summaryNumber(value, kind) {
    if (value === null) return { valid: true, value };
    if (typeof value !== 'number' || !Number.isFinite(value)) return { valid: false };
    if (kind === 'heartRate') {
        return value > 0 && value <= 300
            ? { valid: true, value }
            : { valid: false };
    }
    return value >= 0 ? { valid: true, value } : { valid: false };
}

function buildActivity(summary, detail, externalId, warnings) {
    const values = effectiveValues(summary, detail, warnings);
    const sport = normalizeSport(values, warnings);
    if (!sport) return null;
    const startTimeUtc = providerUtc(values.start_date);
    if (!startTimeUtc) return null;

    let utcOffsetMinutes = null;
    if (Object.hasOwn(values, 'utc_offset') && values.utc_offset !== null) {
        if (
            !Number.isInteger(values.utc_offset)
            || values.utc_offset % 60 !== 0
            || values.utc_offset / 60 < -840
            || values.utc_offset / 60 > 840
        ) return null;
        utcOffsetMinutes = values.utc_offset / 60;
    }
    if (Object.hasOwn(values, 'timezone')) {
        warnings.add('TIME_ZONE_NAME_DROPPED', '/provider/summary');
    }

    const activity = {
        schemaVersion: 1,
        id: `strava-api:${externalId}`,
        sportCategory: sport.category,
        sportVariant: sport.variant,
        startTimeUtc,
        timeZone: {
            ianaName: null,
            utcOffsetMinutes
        },
        capabilities: {
            hasGps: false,
            hasHeartRate: false,
            hasPower: false,
            hasCadence: false,
            hasLaps: false
        }
    };
    for (const [providerField, canonicalField, kind] of SUMMARY_NUMBER_MAP) {
        if (!Object.hasOwn(values, providerField)) continue;
        const normalized = summaryNumber(values[providerField], kind);
        if (!normalized.valid) return null;
        activity[canonicalField] = normalized.value;
    }
    if (
        typeof activity.movingTimeSeconds === 'number'
        && typeof activity.elapsedTimeSeconds === 'number'
        && activity.movingTimeSeconds > activity.elapsedTimeSeconds
    ) return null;
    return activity;
}

function streamData(stream, warnings) {
    if (stream === null) {
        warnings.add('STREAM_UNAVAILABLE', '/provider/streams');
        return null;
    }
    const record = ordinaryRecord(stream);
    if (!record || !Object.hasOwn(record, 'data')) return INVALID;
    if (Reflect.ownKeys(record).some(key => key !== 'data')) {
        warnings.add('UNKNOWN_FIELDS_DROPPED', '/provider/streams');
    }
    const data = denseArray(record.data);
    return data === null ? INVALID : data;
}

function validOffset(value, previous, hasPrevious) {
    return typeof value === 'number'
        && Number.isFinite(value)
        && value >= 0
        && (!hasPrevious || value >= previous);
}

function validStreamValue(value, kind) {
    if (value === null) return true;
    if (kind === 'moving') return typeof value === 'boolean';
    if (kind === 'position') {
        const tuple = denseArray(value);
        return tuple !== null
            && tuple.length === 2
            && typeof tuple[0] === 'number'
            && Number.isFinite(tuple[0])
            && tuple[0] >= -90
            && tuple[0] <= 90
            && typeof tuple[1] === 'number'
            && Number.isFinite(tuple[1])
            && tuple[1] >= -180
            && tuple[1] <= 180;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (kind === 'heartRate') return value > 0 && value <= 300;
    if (kind === 'nonnegative') return value >= 0;
    return true;
}

function buildStreams(streams, activityId, warnings, activityIndex) {
    if (streams === null) {
        warnings.add('STREAMS_UNAVAILABLE', '/provider/streams');
        return { activityId, series: [] };
    }
    collectDroppedFields(streams, STREAM_FIELDS, warnings, '/provider/streams');

    let offsets = null;
    if (Object.hasOwn(streams, 'time')) {
        offsets = streamData(streams.time, warnings);
        if (offsets === INVALID) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        if (offsets !== null) {
            if (offsets.length > STRAVA_IMPORT_LIMITS.maxStreamPointsPerSeries) {
                fail('LIMIT_EXCEEDED', 'mapping', activityIndex);
            }
            let previous = 0;
            let hasPrevious = false;
            for (const offset of offsets) {
                if (!validOffset(offset, previous, hasPrevious)) {
                    fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
                }
                previous = offset;
                hasPrevious = true;
            }
        }
    }

    const series = [];
    for (const [providerField, streamType, unit, kind] of STREAM_MAP) {
        if (!Object.hasOwn(streams, providerField)) continue;
        const values = streamData(streams[providerField], warnings);
        if (values === INVALID) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        if (values === null || values.length === 0) continue;
        if (values.length > STRAVA_IMPORT_LIMITS.maxStreamPointsPerSeries) {
            fail('LIMIT_EXCEEDED', 'mapping', activityIndex);
        }
        if (offsets === null || offsets.length === 0) {
            warnings.add('TIME_STREAM_UNAVAILABLE', '/provider/streams');
            continue;
        }
        if (values.length !== offsets.length) {
            fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        }
        if (values.some(value => !validStreamValue(value, kind))) {
            fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        }
        series.push({
            streamType,
            unit,
            offsetsSeconds: [...offsets],
            values: values.map(value => {
                if (kind === 'position' && value !== null) return [...value];
                return value;
            })
        });
    }
    return { activityId, series };
}

function optionalLapNumber(record, field) {
    if (!Object.hasOwn(record, field)) return { valid: true, present: false };
    const value = record[field];
    if (value === null) return { valid: true, present: true, value };
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? { valid: true, present: true, value }
        : { valid: false, present: true };
}

function buildLaps(detail, activity, externalId, warnings, activityIndex) {
    if (detail === null) {
        warnings.add('LAPS_UNAVAILABLE', '/provider/detail/laps');
        return [];
    }
    if (!Object.hasOwn(detail, 'laps') || detail.laps === null) {
        warnings.add('LAPS_UNAVAILABLE', '/provider/detail/laps');
        return [];
    }
    const providerLaps = denseArray(detail.laps);
    if (!providerLaps) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    if (providerLaps.length > STRAVA_IMPORT_LIMITS.maxLapsPerActivity) {
        fail('LIMIT_EXCEEDED', 'mapping', activityIndex);
    }
    const normalized = [];
    const indices = new Set();
    for (const lapValue of providerLaps) {
        const lap = ordinaryRecord(lapValue);
        if (!lap) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        if (Reflect.ownKeys(lap).some(key => !LAP_FIELDS.has(key))) {
            warnings.add('UNKNOWN_FIELDS_DROPPED', '/provider/detail');
        }
        if (
            !Number.isSafeInteger(lap.lap_index)
            || lap.lap_index < 0
            || indices.has(lap.lap_index)
            || typeof lap.elapsed_time !== 'number'
            || !Number.isFinite(lap.elapsed_time)
            || lap.elapsed_time < 0
        ) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        indices.add(lap.lap_index);
        const moving = optionalLapNumber(lap, 'moving_time');
        const distance = optionalLapNumber(lap, 'distance');
        if (
            !moving.valid
            || !distance.valid
            || (
                moving.present
                && moving.value !== null
                && moving.value > lap.elapsed_time
            )
        ) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        normalized.push({
            providerIndex: lap.lap_index,
            elapsedTimeSeconds: lap.elapsed_time,
            moving,
            distance
        });
    }
    normalized.sort((left, right) => left.providerIndex - right.providerIndex);
    let offset = 0;
    const result = normalized.map((lap, index) => {
        const value = {
            id: `strava-api:${externalId}:lap:${lap.providerIndex}`,
            activityId: activity.id,
            index,
            startOffsetSeconds: offset,
            elapsedTimeSeconds: lap.elapsedTimeSeconds
        };
        if (lap.moving.present) value.movingTimeSeconds = lap.moving.value;
        if (lap.distance.present) value.distanceMeters = lap.distance.value;
        offset += lap.elapsedTimeSeconds;
        if (!Number.isFinite(offset)) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        return value;
    });
    if (
        typeof activity.elapsedTimeSeconds === 'number'
        && offset > activity.elapsedTimeSeconds
    ) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    return result;
}

function capability(series, type) {
    const found = series.find(value => value.streamType === type);
    return Boolean(found && found.values.some(value => value !== null));
}

function mapActivity(value, acquiredAt, activityIndex, seenIds) {
    const cloned = cloneJson(value);
    if (cloned === INVALID) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    const item = ordinaryRecord(cloned, ITEM_FIELDS);
    if (!item) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    const summary = ordinaryRecord(item.summary);
    const detail = item.detail === null ? null : ordinaryRecord(item.detail);
    const streams = item.streams === null ? null : ordinaryRecord(item.streams);
    if (!summary || (item.detail !== null && !detail) || (item.streams !== null && !streams)) {
        fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    }

    const warnings = warningCollector();
    collectDroppedFields(summary, SUMMARY_FIELDS, warnings, '/provider/summary');
    if (detail === null) {
        warnings.add('DETAIL_UNAVAILABLE', '/provider/detail');
    } else {
        collectDroppedFields(detail, DETAIL_FIELDS, warnings, '/provider/detail');
    }

    const externalId = positiveOpaqueId(summary.id);
    if (!externalId || seenIds.has(externalId)) {
        fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    }
    seenIds.add(externalId);
    if (detail !== null) {
        const detailId = positiveOpaqueId(detail.id);
        if (!detailId || detailId !== externalId) {
            fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
        }
    }

    const activity = buildActivity(summary, detail, externalId, warnings);
    if (!activity) fail('PROVIDER_RECORD_INVALID', 'mapping', activityIndex);
    const canonicalStreams = buildStreams(
        streams,
        activity.id,
        warnings,
        activityIndex
    );
    const laps = buildLaps(
        detail,
        activity,
        externalId,
        warnings,
        activityIndex
    );
    activity.capabilities = {
        hasGps: capability(canonicalStreams.series, 'position'),
        hasHeartRate: capability(canonicalStreams.series, 'heartRate')
            || (
                Object.hasOwn(activity, 'averageHeartRateBpm')
                && activity.averageHeartRateBpm !== null
            ),
        hasPower: capability(canonicalStreams.series, 'power')
            || (
                Object.hasOwn(activity, 'averagePowerWatts')
                && activity.averagePowerWatts !== null
            ),
        hasCadence: capability(canonicalStreams.series, 'cadence')
            || (
                Object.hasOwn(activity, 'averageCadence')
                && activity.averageCadence !== null
            ),
        hasLaps: laps.length > 0
    };

    const bundle = {
        schemaVersion: 1,
        activity,
        streams: canonicalStreams,
        laps,
        events: [],
        sources: [{
            id: `strava-api-source:${externalId}`,
            activityId: activity.id,
            provider: 'strava',
            externalId,
            rawArtifactId: null,
            acquisitionMethod: 'strava-api',
            deviceId: null,
            importedAt: acquiredAt
        }],
        devices: [],
        warnings: warnings.finish(),
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: null,
            normalizerVersion: 'strava-import-mapper@1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
    const validation = validateImportedActivityBundle(bundle);
    if (!validation.ok) fail('BUNDLE_INVALID', 'validation', activityIndex);
    return deepFreeze(bundle);
}

function mapActivities(input) {
    const control = ordinaryRecord(input, CONTROL_FIELDS);
    if (!control || typeof control.cancelled !== 'boolean') {
        fail('INVALID_REQUEST', 'mapping');
    }
    if (control.cancelled) fail('CANCELLED', 'cancellation');
    if (!strictUtc(control.acquiredAt)) fail('INVALID_REQUEST', 'mapping');
    const activities = denseArray(control.activities);
    if (!activities) fail('INVALID_REQUEST', 'mapping');
    if (activities.length > STRAVA_IMPORT_LIMITS.maxActivitiesPerRun) {
        fail('LIMIT_EXCEEDED', 'mapping');
    }
    const seenIds = new Set();
    const result = [];
    for (let index = 0; index < activities.length; index += 1) {
        try {
            result.push(mapActivity(
                activities[index],
                control.acquiredAt,
                index,
                seenIds
            ));
        } catch (error) {
            if (error instanceof StravaImportMapperError) throw error;
            fail('PROVIDER_RECORD_INVALID', 'mapping', index);
        }
    }
    return deepFreeze(result);
}

export function createStravaImportMapper(options) {
    validateAuthority(options);
    return Object.freeze({ mapActivities });
}
