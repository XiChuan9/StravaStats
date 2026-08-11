import { validateImportedActivityBundle } from '../data/contracts/index.js';
import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { deepFreeze, ownDataValues } from './safe-data.js';

export const STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE =
    'application/vnd.stravastats.strava-provider-artifact+json;version=1';

export const STRAVA_PROVIDER_ARTIFACT_LIMITS = Object.freeze({
    maxArtifactsPerJob: 100,
    maxBytesPerArtifact: 33_554_432,
    maxBytesPerJob: 33_554_432,
    maxTraversalDepth: 16,
    maxTraversalNodes: 5_000_000,
    maxSourcesPerBundle: 1,
    maxDevicesPerBundle: 0,
    maxEventsPerBundle: 0,
    maxStreamSeriesPerBundle: 10,
    maxPointsPerSeries: 200_000,
    maxLapsPerBundle: 10_000
});

export const STRAVA_PROVIDER_ARTIFACT_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    CONNECTION_REQUIRED: 'CONNECTION_REQUIRED',
    PROVENANCE_MISMATCH: 'PROVENANCE_MISMATCH',
    BUNDLE_INVALID: 'BUNDLE_INVALID',
    LIMIT_EXCEEDED: 'LIMIT_EXCEEDED'
});

const ERROR_MESSAGES = Object.freeze({
    INVALID_REQUEST: 'The provider artifact request is invalid.',
    CONNECTION_REQUIRED: 'A connected provider source is required.',
    PROVENANCE_MISMATCH: 'The provider artifact provenance is invalid.',
    BUNDLE_INVALID: 'The provider activity bundle is invalid.',
    LIMIT_EXCEEDED: 'The provider artifact exceeds a fixed limit.'
});
const ERROR_CODES = new Set(Object.values(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE));
const LIMIT = Symbol('limit');
const REQUEST_FIELDS = Object.freeze(['connection', 'bundles']);
const CONNECTION_FIELDS = Object.freeze([
    'id',
    'provider',
    'subjectId',
    'status',
    'lastSyncAt',
    'errorCode',
    'revision'
]);
const SOURCE_FIELDS = Object.freeze([
    'id',
    'activityId',
    'provider',
    'externalId',
    'rawArtifactId',
    'acquisitionMethod',
    'deviceId',
    'importedAt'
]);
const DECODER_INPUT_FIELDS = Object.freeze(['mediaType', 'content']);
const ARTIFACT_FIELDS = Object.freeze([
    'format',
    'formatVersion',
    'provider',
    'sourceConnectionId',
    'bundle'
]);
const STREAM_PROFILE = Object.freeze([
    Object.freeze(['distance', 'm']),
    Object.freeze(['position', 'wgs84']),
    Object.freeze(['altitude', 'm']),
    Object.freeze(['speed', 'm/s']),
    Object.freeze(['heartRate', 'bpm']),
    Object.freeze(['cadence', 'rpm']),
    Object.freeze(['power', 'W']),
    Object.freeze(['temperature', 'C']),
    Object.freeze(['moving', 'boolean']),
    Object.freeze(['grade_smooth', 'percent'])
]);
const SPORT_PROFILE = Object.freeze({
    run: Object.freeze([null, 'trail-run', 'virtual-run']),
    ride: Object.freeze([
        null, 'mountain-bike', 'gravel', 'virtual', 'e-bike', 'e-mountain-bike'
    ]),
    swim: Object.freeze([null]),
    walk: Object.freeze([null]),
    hike: Object.freeze([null]),
    workout: Object.freeze([
        null, 'strength', 'cross-training', 'elliptical', 'stair-stepper', 'yoga'
    ]),
    winter: Object.freeze(['alpine-ski', 'nordic-ski', 'snowboard', 'snowshoe']),
    team: Object.freeze(['football']),
    racket: Object.freeze([
        'tennis', 'badminton', 'pickleball', 'padel', 'racquetball', 'squash'
    ]),
    other: Object.freeze([null])
});
const WARNING_PROFILE = Object.freeze({
    UNKNOWN_FIELDS_DROPPED: Object.freeze({
        message: 'Unsupported provider fields were omitted.',
        paths: Object.freeze([
            '/provider/detail',
            '/provider/streams',
            '/provider/summary'
        ])
    }),
    PRIVATE_FIELDS_DROPPED: Object.freeze({
        message: 'Provider fields outside the minimal data contract were omitted.',
        paths: Object.freeze(['/provider/detail', '/provider/summary'])
    }),
    DETAIL_CONFLICT_DROPPED: Object.freeze({
        message: 'Conflicting provider detail was omitted.',
        paths: Object.freeze(['/provider/detail', '/provider/summary'])
    }),
    SPORT_FALLBACK: Object.freeze({
        message: 'The provider sport used the source-neutral fallback.',
        paths: Object.freeze(['/activity/sport'])
    }),
    TIME_ZONE_NAME_DROPPED: Object.freeze({
        message: 'The provider time-zone display value was omitted.',
        paths: Object.freeze(['/provider/summary'])
    }),
    DETAIL_UNAVAILABLE: Object.freeze({
        message: 'Optional provider detail was unavailable.',
        paths: Object.freeze(['/provider/detail'])
    }),
    LAPS_UNAVAILABLE: Object.freeze({
        message: 'Optional provider laps were unavailable.',
        paths: Object.freeze(['/provider/detail/laps'])
    }),
    STREAMS_UNAVAILABLE: Object.freeze({
        message: 'Optional provider streams were unavailable.',
        paths: Object.freeze(['/provider/streams'])
    }),
    STREAM_UNAVAILABLE: Object.freeze({
        message: 'An optional provider stream was unavailable.',
        paths: Object.freeze(['/provider/streams'])
    }),
    TIME_STREAM_UNAVAILABLE: Object.freeze({
        message: 'Provider stream timing was unavailable.',
        paths: Object.freeze(['/provider/streams'])
    })
});

export class StravaProviderArtifactError extends Error {
    constructor(code, ordinal = null) {
        const valid = ERROR_CODES.has(code)
            && (ordinal === null || (Number.isSafeInteger(ordinal) && ordinal >= 0));
        const safeCode = valid
            ? code
            : STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST;
        super(ERROR_MESSAGES[safeCode]);
        this.name = 'StravaProviderArtifactError';
        this.code = safeCode;
        this.stage = 'artifact';
        this.ordinal = valid ? ordinal : null;
        this.retryable = false;
        Object.freeze(this);
    }

    toJSON() {
        return Object.freeze({
            name: this.name,
            code: this.code,
            message: this.message,
            stage: this.stage,
            ordinal: this.ordinal,
            retryable: this.retryable
        });
    }
}

function fail(code, ordinal = null) {
    throw new StravaProviderArtifactError(code, ordinal);
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function denseArray(value, maximum) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
        if (!Number.isSafeInteger(length) || length < 0) return null;
        if (length > maximum) return LIMIT;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== length + 1
            || keys.some(key => (
                typeof key !== 'string'
                || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            ))
        ) return null;
        const result = new Array(length);
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[index] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function validConnection(value) {
    const connection = ownDataValues(value, CONNECTION_FIELDS);
    if (!connection) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST);
    if (
        connection.id !== 'source-connection:strava'
        || connection.provider !== 'strava'
    ) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH);
    if (
        typeof connection.subjectId !== 'string'
        || !/^[1-9]\d*$/.test(connection.subjectId)
        || (connection.lastSyncAt !== null && !strictUtc(connection.lastSyncAt))
        || !Number.isSafeInteger(connection.revision)
        || connection.revision < 1
    ) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST);
    if (connection.status !== 'connected' || connection.errorCode !== null) {
        fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.CONNECTION_REQUIRED);
    }
    return connection;
}

function canonicalJson(value) {
    let nodes = 0;
    const ancestors = new Set();

    function encode(current, depth) {
        nodes += 1;
        if (nodes > STRAVA_PROVIDER_ARTIFACT_LIMITS.maxTraversalNodes) {
            fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED);
        }
        if (current === null || typeof current === 'boolean') return String(current);
        if (typeof current === 'string') return JSON.stringify(current);
        if (typeof current === 'number') {
            if (!Number.isFinite(current)) {
                fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
            }
            return Object.is(current, -0) ? '-0' : JSON.stringify(current);
        }
        if (typeof current !== 'object' || ancestors.has(current)) {
            fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
        }
        if (depth > STRAVA_PROVIDER_ARTIFACT_LIMITS.maxTraversalDepth) {
            fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED);
        }
        ancestors.add(current);
        try {
            if (Array.isArray(current)) {
                const items = denseArray(
                    current,
                    STRAVA_PROVIDER_ARTIFACT_LIMITS.maxTraversalNodes
                );
                if (items === LIMIT) {
                    fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED);
                }
                if (!items) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
                return `[${items.map(item => encode(item, depth + 1)).join(',')}]`;
            }
            const prototype = Object.getPrototypeOf(current);
            if (prototype !== Object.prototype && prototype !== null) {
                fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
            }
            const keys = Reflect.ownKeys(current);
            if (keys.some(key => typeof key !== 'string')) {
                fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
            }
            keys.sort((left, right) => left === right ? 0 : left < right ? -1 : 1);
            const fields = [];
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                    fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
                }
                fields.push(`${JSON.stringify(key)}:${encode(descriptor.value, depth + 1)}`);
            }
            return `{${fields.join(',')}}`;
        } catch (error) {
            if (error instanceof StravaProviderArtifactError) throw error;
            fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
        } finally {
            ancestors.delete(current);
        }
    }

    return encode(value, 1);
}

function validWarningProfile(warnings) {
    if (!Array.isArray(warnings)) return false;
    return warnings.every(warning => {
        const values = ownDataValues(warning, ['code', 'path', 'message']);
        const profile = values && WARNING_PROFILE[values.code];
        return profile
            && values.message === profile.message
            && profile.paths.includes(values.path);
    });
}

function profileResult(bundle) {
    let validation;
    try {
        validation = validateImportedActivityBundle(bundle);
    } catch {
        return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
    }
    if (validation.ok !== true || validation.warnings.length !== 0) {
        return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
    }
    const sources = denseArray(bundle.sources, 1);
    const devices = denseArray(bundle.devices, 0);
    const events = denseArray(bundle.events, 0);
    const laps = denseArray(
        bundle.laps,
        STRAVA_PROVIDER_ARTIFACT_LIMITS.maxLapsPerBundle
    );
    const series = denseArray(
        bundle.streams?.series,
        STRAVA_PROVIDER_ARTIFACT_LIMITS.maxStreamSeriesPerBundle
    );
    if (laps === LIMIT || series === LIMIT) {
        return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED;
    }
    if (
        !sources
        || sources === LIMIT
        || sources.length !== 1
        || !devices
        || devices === LIMIT
        || !events
        || events === LIMIT
        || !laps
        || !series
    ) {
        return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
    }
    let previousProfileIndex = -1;
    for (const stream of series) {
        const values = ownDataValues(stream, [
            'streamType', 'unit', 'offsetsSeconds', 'values'
        ]);
        const offsets = values && denseArray(
            values.offsetsSeconds,
            STRAVA_PROVIDER_ARTIFACT_LIMITS.maxPointsPerSeries
        );
        const points = values && denseArray(
            values.values,
            STRAVA_PROVIDER_ARTIFACT_LIMITS.maxPointsPerSeries
        );
        if (offsets === LIMIT || points === LIMIT) {
            return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED;
        }
        if (!values || !offsets || !points) {
            return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
        }
        const profileIndex = STREAM_PROFILE.findIndex(profile => (
            profile[0] === values.streamType && profile[1] === values.unit
        ));
        if (
            profileIndex < 0
            || profileIndex <= previousProfileIndex
        ) return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
        previousProfileIndex = profileIndex;
    }
    const source = ownDataValues(sources[0], SOURCE_FIELDS);
    if (!source) return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH;
    if (
        source.provider !== 'strava'
        || typeof source.externalId !== 'string'
        || !/^[1-9]\d*$/.test(source.externalId)
        || source.activityId !== `strava-api:${source.externalId}`
        || source.id !== `strava-api-source:${source.externalId}`
        || bundle.activity.id !== source.activityId
        || source.rawArtifactId !== null
        || source.acquisitionMethod !== 'strava-api'
        || source.deviceId !== null
        || !strictUtc(source.importedAt)
    ) return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH;
    const version = ownDataValues(bundle.versionMetadata, [
        'schemaVersion',
        'parserVersion',
        'normalizerVersion',
        'analysisVersion',
        'settingsVersion',
        'inputHash'
    ]);
    if (
        bundle.schemaVersion !== 1
        || !version
        || version.schemaVersion !== 1
        || version.parserVersion !== null
        || version.normalizerVersion !== 'strava-import-mapper@1'
        || version.analysisVersion !== null
        || version.settingsVersion !== null
        || version.inputHash !== null
        || !validWarningProfile(bundle.warnings)
    ) return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
    const variants = SPORT_PROFILE[bundle.activity.sportCategory];
    if (!variants || !variants.includes(bundle.activity.sportVariant)) {
        return STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID;
    }
    return null;
}

function decodeArtifactContent(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
    }
    const fields = ownDataValues(parsed, ARTIFACT_FIELDS);
    if (
        !fields
        || fields.format !== 'stravastats-provider-artifact'
        || fields.formatVersion !== 1
        || fields.provider !== 'strava'
        || fields.sourceConnectionId !== 'source-connection:strava'
    ) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.PROVENANCE_MISMATCH);
    if (canonicalJson(parsed) !== content) {
        fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID);
    }
    const profileError = profileResult(fields.bundle);
    if (profileError) fail(profileError);
    return deepFreeze(fields.bundle);
}

export function createStravaProviderArtifacts(input) {
    const values = ownDataValues(input, REQUEST_FIELDS);
    if (!values) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST);
    validConnection(values.connection);
    const bundles = denseArray(
        values.bundles,
        STRAVA_PROVIDER_ARTIFACT_LIMITS.maxArtifactsPerJob
    );
    if (bundles === LIMIT) {
        fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED);
    }
    if (!bundles || bundles.length === 0) {
        fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.INVALID_REQUEST);
    }
    const artifacts = [];
    let totalBytes = 0;
    for (let ordinal = 0; ordinal < bundles.length; ordinal += 1) {
        try {
            const content = canonicalJson({
                format: 'stravastats-provider-artifact',
                formatVersion: 1,
                provider: 'strava',
                sourceConnectionId: 'source-connection:strava',
                bundle: bundles[ordinal]
            });
            const byteLength = new TextEncoder().encode(content).byteLength;
            totalBytes += byteLength;
            if (
                byteLength === 0
                || byteLength > STRAVA_PROVIDER_ARTIFACT_LIMITS.maxBytesPerArtifact
                || totalBytes > STRAVA_PROVIDER_ARTIFACT_LIMITS.maxBytesPerJob
            ) fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.LIMIT_EXCEEDED, ordinal);
            decodeArtifactContent(content);
            artifacts.push(Object.freeze({
                mediaType: STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
                content
            }));
        } catch (error) {
            if (error instanceof StravaProviderArtifactError) {
                if (error.ordinal === ordinal) throw error;
                throw new StravaProviderArtifactError(error.code, ordinal);
            }
            fail(STRAVA_PROVIDER_ARTIFACT_ERROR_CODE.BUNDLE_INVALID, ordinal);
        }
    }
    return Object.freeze(artifacts);
}

export const stravaProviderArtifactDecoder = Object.freeze({
    id: 'strava-provider-artifact-v1',
    mediaType: STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, DECODER_INPUT_FIELDS);
        if (!values || values.mediaType !== STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE) {
            throw importError(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT, false, 'decode');
        }
        if (typeof values.content !== 'string' || values.content.length === 0) {
            throw importError(IMPORT_ERROR_CODE.FILE_EMPTY, false, 'decode');
        }
        if (
            new TextEncoder().encode(values.content).byteLength
            > STRAVA_PROVIDER_ARTIFACT_LIMITS.maxBytesPerArtifact
        ) throw importError(IMPORT_ERROR_CODE.FILE_CORRUPTED, false, 'decode');
        try {
            return decodeArtifactContent(values.content);
        } catch {
            throw importError(IMPORT_ERROR_CODE.FILE_CORRUPTED, false, 'decode');
        }
    }
});
