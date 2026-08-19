import { IMPORT_ERROR_CODE, importError } from './errors.js';
import {
    denseArraySnapshot,
    frozenClone,
    ownDataValues
} from './safe-data.js';
import {
    ACTIVITIES_CSV_FRAME_FIELDS,
    ENGLISH_ACTIVITIES_CSV_PROFILE,
    parseActivitiesCsv,
    parseActivitiesCsvFrame
} from './csv-tokenizer.js';

export { ENGLISH_ACTIVITIES_CSV_PROFILE };

export const ACTIVITIES_CSV_MEDIA_TYPE = 'text/csv;profile=strava-activities';

const HEADER_FIELDS = ACTIVITIES_CSV_FRAME_FIELDS;
const PROFILE_FIELDS = Object.freeze(['id', 'headers']);
const INPUT_FIELDS = Object.freeze(['mediaType', 'content']);
const REQUIRED_HEADERS = Object.freeze(['activityId', 'startTime', 'sportType']);
const REPEATED_HEADERS = Object.freeze(['elapsedTime', 'distance']);
const KILOMETRES_TO_METRES = 1000;
const OPTIONAL_PATHS = Object.freeze({
    name: '/activity/name',
    elapsedTime: '/activity/elapsedTimeSeconds',
    movingTime: '/activity/movingTimeSeconds',
    distance: '/activity/distanceMeters',
    elevationGain: '/activity/elevationGainMeters',
    averageHeartRate: '/activity/averageHeartRateBpm',
    averagePower: '/activity/averagePowerWatts',
    averageCadence: '/activity/averageCadence',
    timeZone: '/activity/timeZone'
});

const SPORTS = Object.freeze({
    Run: ['run', null],
    'Trail Run': ['run', 'trail-run'],
    'Virtual Run': ['run', 'virtual-run'],
    Ride: ['ride', null],
    'Mountain Bike Ride': ['ride', 'mountain-bike'],
    'Gravel Ride': ['ride', 'gravel'],
    'Virtual Ride': ['ride', 'virtual'],
    'Indoor Ride': ['ride', 'indoor'],
    'E-Bike Ride': ['ride', 'e-bike'],
    'E-Mountain Bike Ride': ['ride', 'e-mountain-bike'],
    Swim: ['swim', null],
    'Pool Swim': ['swim', 'pool'],
    'Open Water Swim': ['swim', 'open-water'],
    Walk: ['walk', null],
    Hike: ['hike', null],
    Workout: ['workout', null],
    'Weight Training': ['workout', 'strength'],
    Crossfit: ['workout', 'cross-training'],
    Elliptical: ['workout', 'elliptical'],
    'Stair Stepper': ['workout', 'stair-stepper'],
    Yoga: ['workout', 'yoga'],
    Pilates: ['workout', 'pilates'],
    'High Intensity Interval Training': ['workout', 'hiit'],
    'Alpine Ski': ['winter', 'alpine-ski'],
    'Nordic Ski': ['winter', 'nordic-ski'],
    Snowboard: ['winter', 'snowboard'],
    Snowshoe: ['winter', 'snowshoe'],
    Soccer: ['team', 'football'],
    Football: ['team', 'football'],
    Basketball: ['team', 'basketball'],
    Volleyball: ['team', 'volleyball'],
    Tennis: ['racket', 'tennis'],
    Badminton: ['racket', 'badminton'],
    Pickleball: ['racket', 'pickleball'],
    Padel: ['racket', 'padel'],
    Racquetball: ['racket', 'racquetball'],
    Squash: ['racket', 'squash'],
    'Table Tennis': ['racket', 'table-tennis']
});

const MONTHS = Object.freeze({
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
});

function fail(code) {
    throw importError(code, false, 'decode');
}

function warning(code, path, message) {
    return Object.freeze({ code, path, message });
}

function snapshotAliases(value) {
    const aliases = denseArraySnapshot(value);
    if (
        !aliases
        || aliases.length === 0
        || aliases.some(alias => typeof alias !== 'string' || alias.length === 0)
        || new Set(aliases).size !== aliases.length
    ) return null;
    return aliases;
}

function snapshotProfile(value) {
    const profile = ownDataValues(value, PROFILE_FIELDS);
    if (!profile || typeof profile.id !== 'string' || profile.id.trim().length === 0) {
        fail(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    const headers = ownDataValues(profile.headers, HEADER_FIELDS);
    if (!headers) fail(IMPORT_ERROR_CODE.INVALID_REQUEST);
    const safeHeaders = {};
    const aliases = new Set();
    for (const field of HEADER_FIELDS) {
        const values = snapshotAliases(headers[field]);
        if (!values || values.some(alias => aliases.has(alias))) {
            fail(IMPORT_ERROR_CODE.INVALID_REQUEST);
        }
        values.forEach(alias => aliases.add(alias));
        safeHeaders[field] = values;
    }
    return frozenClone({ id: profile.id, headers: safeHeaders });
}

function resolveHeaders(header, profile) {
    const positions = {};
    const matched = new Set();
    for (const field of HEADER_FIELDS) {
        const aliases = new Set(profile.headers[field]);
        const found = [];
        for (let index = 0; index < header.length; index += 1) {
            if (aliases.has(header[index])) {
                found.push(index);
                matched.add(index);
            }
        }
        const maximum = REPEATED_HEADERS.includes(field) ? 2 : 1;
        if (found.length > maximum || (REQUIRED_HEADERS.includes(field) && found.length !== 1)) {
            fail(IMPORT_ERROR_CODE.CSV_HEADER_INVALID);
        }
        positions[field] = found.length === 0 ? null : found.at(-1);
    }
    return Object.freeze({
        positions: Object.freeze(positions),
        hasExtra: header.some((_, index) => !matched.has(index))
    });
}

function strictInstant(year, month, day, hour, minute, second) {
    const time = Date.UTC(year, month, day, hour, minute, second, 0);
    const date = new Date(time);
    if (
        !Number.isFinite(time)
        || date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month
        || date.getUTCDate() !== day
        || date.getUTCHours() !== hour
        || date.getUTCMinutes() !== minute
        || date.getUTCSeconds() !== second
    ) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    return date.toISOString();
}

function parseDate(value) {
    let match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
    if (match) {
        const [, year, month, day, hour, minute, second, milliseconds] = match;
        if (milliseconds && milliseconds !== '000') {
            const time = Date.UTC(
                Number(year), Number(month) - 1, Number(day), Number(hour),
                Number(minute), Number(second), Number(milliseconds)
            );
            const date = new Date(time);
            if (
                !Number.isFinite(time)
                || date.getUTCFullYear() !== Number(year)
                || date.getUTCMonth() !== Number(month) - 1
                || date.getUTCDate() !== Number(day)
                || date.getUTCHours() !== Number(hour)
                || date.getUTCMinutes() !== Number(minute)
                || date.getUTCSeconds() !== Number(second)
                || date.getUTCMilliseconds() !== Number(milliseconds)
            ) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
            return date.toISOString();
        }
        return strictInstant(
            Number(year), Number(month) - 1, Number(day), Number(hour),
            Number(minute), Number(second)
        );
    }
    match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(value);
    if (!match) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    const [, monthName, day, year, rawHour, minute, second, meridiem] = match;
    const hour12 = Number(rawHour);
    if (hour12 < 1 || hour12 > 12) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    const hour = (hour12 % 12) + (meridiem === 'PM' ? 12 : 0);
    return strictInstant(
        Number(year), MONTHS[monthName], Number(day), hour,
        Number(minute), Number(second)
    );
}

function parseTimeZone(value, warnings) {
    if (value === null || value === '') {
        warnings.push(warning(
            'CSV_TIMEZONE_UNAVAILABLE',
            '/activity/timeZone',
            'The CSV does not provide usable time-zone metadata.'
        ));
        return Object.freeze({ ianaName: null, utcOffsetMinutes: null });
    }
    const match = /^\(GMT([+-])(\d{2}):(\d{2})\)(?: ([A-Za-z_]+(?:\/[A-Za-z0-9._+-]+)+))?$/.exec(value);
    if (!match) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    const [, sign, hours, minutes, ianaName = null] = match;
    const hour = Number(hours);
    const minute = Number(minutes);
    const absolute = hour * 60 + minute;
    if (minute > 59 || absolute > 840) fail(IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    return Object.freeze({
        ianaName,
        utcOffsetMinutes: (sign === '-' ? -1 : 1) * absolute
    });
}

function parseNumber(value, { heartRate = false, multiplier = 1 } = {}) {
    if (value === '') return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
        if (/^[+-]?(?:Infinity|NaN)$/.test(value)) {
            fail(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID);
        }
        fail(/[A-Za-z]/.test(value)
            ? IMPORT_ERROR_CODE.CSV_UNIT_INVALID
            : IMPORT_ERROR_CODE.CSV_NUMBER_INVALID);
    }
    const number = Number(value) * multiplier;
    if (
        !Number.isFinite(number)
        || number < 0
        || (heartRate && (number <= 0 || number > 300))
    ) fail(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID);
    return number;
}

function readCell(row, position) {
    return position === null ? undefined : row[position];
}

function mapSport(value, warnings) {
    const mapped = SPORTS[value];
    if (mapped) return Object.freeze({ category: mapped[0], variant: mapped[1] });
    warnings.push(warning(
        'CSV_UNKNOWN_SPORT_TYPE',
        '/activity/sportCategory',
        'The CSV sport type is not in the registered English profile.'
    ));
    return Object.freeze({ category: 'other', variant: null });
}

function decodeResolvedRow(row, columnCount, resolved, profile) {
    if (row.length !== columnCount) fail(IMPORT_ERROR_CODE.CSV_COLUMN_MISMATCH);
    const positions = resolved.positions;
    const warnings = [];
    for (const [field, path] of Object.entries(OPTIONAL_PATHS)) {
        if (positions[field] === null) {
            warnings.push(warning(
                'CSV_OPTIONAL_HEADER_MISSING',
                path,
                'An optional CSV summary header is missing.'
            ));
        }
    }
    if (resolved.hasExtra) {
        warnings.push(warning(
            'CSV_EXTRA_HEADER_IGNORED',
            '',
            'One or more unmapped CSV headers were ignored.'
        ));
    }

    const externalId = readCell(row, positions.activityId);
    if (
        typeof externalId !== 'string'
        || externalId.length === 0
        || externalId.trim() !== externalId
    ) fail(IMPORT_ERROR_CODE.CSV_ACTIVITY_ID_INVALID);
    const encodedId = encodeURIComponent(externalId);
    const activityId = `strava-archive:${encodedId}`;
    const startTimeUtc = parseDate(readCell(row, positions.startTime));
    const sport = mapSport(readCell(row, positions.sportType), warnings);
    const timeZone = parseTimeZone(readCell(row, positions.timeZone) ?? null, warnings);
    const activity = {
        schemaVersion: 1,
        id: activityId,
        sportCategory: sport.category,
        sportVariant: sport.variant,
        startTimeUtc,
        timeZone,
        capabilities: {
            hasGps: false,
            hasHeartRate: false,
            hasPower: false,
            hasCadence: false,
            hasLaps: false
        }
    };
    if (positions.name !== null) {
        const name = readCell(row, positions.name);
        activity.name = name === '' ? null : name;
    }
    const numericFields = [
        ['elapsedTime', 'elapsedTimeSeconds', {}],
        ['movingTime', 'movingTimeSeconds', {}],
        ['distance', 'distanceMeters', { multiplier: KILOMETRES_TO_METRES }],
        ['elevationGain', 'elevationGainMeters', {}],
        ['averageHeartRate', 'averageHeartRateBpm', { heartRate: true }],
        ['averagePower', 'averagePowerWatts', {}],
        ['averageCadence', 'averageCadence', {}]
    ];
    for (const [headerField, activityField, options] of numericFields) {
        if (positions[headerField] !== null) {
            activity[activityField] = parseNumber(
                readCell(row, positions[headerField]),
                options
            );
        }
    }
    if (
        Number.isFinite(activity.movingTimeSeconds)
        && Number.isFinite(activity.elapsedTimeSeconds)
        && activity.movingTimeSeconds > activity.elapsedTimeSeconds
    ) fail(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID);
    warnings.push(warning(
        'CSV_IMPORT_TIME_FALLBACK',
        '/sources/0/importedAt',
        'The source timestamp uses the normalized activity instant as a deterministic fallback.'
    ));
    return frozenClone({
        schemaVersion: 1,
        activity,
        streams: { activityId, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: `strava-archive-source:${encodedId}`,
            activityId,
            provider: 'strava',
            externalId,
            rawArtifactId: null,
            acquisitionMethod: 'archive-csv',
            deviceId: null,
            importedAt: startTimeUtc
        }],
        devices: [],
        warnings,
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: `strava-activities-csv:${profile.id}@1`,
            normalizerVersion: 'activities-csv-summary@1'
        }
    });
}

function decodeRow(records, profile) {
    if (records.length !== 2) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
    const [header, row] = records;
    return decodeResolvedRow(row, header.length, resolveHeaders(header, profile), profile);
}

export function createActivitiesCsvDecoder(profileValue) {
    const acceptsCompactFrames = profileValue === ENGLISH_ACTIVITIES_CSV_PROFILE;
    const profile = snapshotProfile(profileValue);
    return Object.freeze({
        id: `activities-csv:${profile.id}`,
        mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
        decode(input) {
            const values = ownDataValues(input, INPUT_FIELDS);
            if (!values || values.mediaType !== ACTIVITIES_CSV_MEDIA_TYPE) {
                fail(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
            }
            if (typeof values.content !== 'string' || values.content.length === 0) {
                fail(IMPORT_ERROR_CODE.FILE_EMPTY);
            }
            const frame = acceptsCompactFrames
                ? parseActivitiesCsvFrame(values.content)
                : null;
            if (frame) {
                const positions = {};
                for (let index = 0; index < HEADER_FIELDS.length; index += 1) {
                    positions[HEADER_FIELDS[index]] = frame.positions[index];
                }
                return decodeResolvedRow(
                    frame.row,
                    frame.columnCount,
                    Object.freeze({
                        positions: Object.freeze(positions),
                        hasExtra: frame.hasExtra
                    }),
                    profile
                );
            }
            return decodeRow(parseActivitiesCsv(values.content), profile);
        }
    });
}

export const activitiesCsvDecoder = createActivitiesCsvDecoder(
    ENGLISH_ACTIVITIES_CSV_PROFILE
);
