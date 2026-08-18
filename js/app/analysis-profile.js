export const DASHBOARD_SETTINGS_STORAGE_KEY = 'dashboard_settings';
export const ANALYSIS_PROFILE_SCHEMA_VERSION = 1;
export const ANALYSIS_CONTEXT_SCHEMA_VERSION = 1;

export const ANALYSIS_PROFILE_ERROR_CODE = Object.freeze({
    INVALID_PROFILE: 'INVALID_PROFILE',
    INVALID_SETTINGS: 'INVALID_SETTINGS',
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED'
});

const PROFILE_FIELDS = Object.freeze([
    'schemaVersion',
    'revision',
    'heartRate'
]);
const HEART_RATE_FIELDS = Object.freeze([
    'maxBpm',
    'restingBpm',
    'thresholdBpm',
    'zoneMode',
    'upperBoundsBpm'
]);
const PERCENT_MAX_BOUNDARIES = Object.freeze([0.60, 0.70, 0.80, 0.90]);
const ZONE_MODES = new Set(['percent-max', 'manual']);
const contextProjections = new WeakMap();

export class AnalysisProfileError extends Error {
    constructor(code, operation) {
        super('Analysis profile operation failed safely.');
        this.name = 'AnalysisProfileError';
        this.code = code;
        this.operation = operation;
        Object.freeze(this);
    }
}

function profileError(code, operation) {
    return new AnalysisProfileError(code, operation);
}

function exactOwnDataValues(value, fields) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== fields.length
            || keys.some(key => typeof key !== 'string' || !fields.includes(key))
        ) return null;
        const values = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) return null;
            values[field] = descriptor.value;
        }
        return values;
    } catch {
        return null;
    }
}

function denseArrayValues(value, expectedLength) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) return null;
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || lengthDescriptor.enumerable
            || !Object.hasOwn(lengthDescriptor, 'value')
            || lengthDescriptor.value !== expectedLength
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedLength + 1
            || keys[keys.length - 1] !== 'length'
        ) return null;
        const values = [];
        for (let index = 0; index < expectedLength; index += 1) {
            if (keys[index] !== String(index)) return null;
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) return null;
            values.push(descriptor.value);
        }
        return values;
    } catch {
        return null;
    }
}

function cloneSafe(value) {
    try {
        if (typeof globalThis.structuredClone !== 'function') return false;
        globalThis.structuredClone(value);
        return true;
    } catch {
        return false;
    }
}

function integerInRange(value, minimum, maximum) {
    return Number.isSafeInteger(value)
        && value >= minimum
        && value <= maximum;
}

function nullableIntegerInRange(value, minimum, maximum) {
    return value === null || integerInRange(value, minimum, maximum);
}

function validHeartRateValues(values) {
    if (
        !integerInRange(values.maxBpm, 100, 230)
        || !nullableIntegerInRange(values.restingBpm, 25, 120)
        || !nullableIntegerInRange(values.thresholdBpm, 80, 229)
        || !ZONE_MODES.has(values.zoneMode)
    ) return null;
    if (values.restingBpm !== null && values.restingBpm >= values.maxBpm) return null;
    if (
        values.thresholdBpm !== null
        && (
            values.thresholdBpm >= values.maxBpm
            || (
                values.restingBpm !== null
                && values.thresholdBpm <= values.restingBpm
            )
        )
    ) return null;

    const upperBoundsBpm = denseArrayValues(values.upperBoundsBpm, 4);
    if (
        upperBoundsBpm === null
        || upperBoundsBpm.some(boundary => !integerInRange(boundary, 2, values.maxBpm))
        || upperBoundsBpm.some((boundary, index) => (
            index > 0 && boundary <= upperBoundsBpm[index - 1]
        ))
    ) return null;
    if (values.zoneMode === 'percent-max') {
        const automatic = generatePercentMaxUpperBounds(values.maxBpm);
        if (
            automatic === null
            || automatic.some((boundary, index) => boundary !== upperBoundsBpm[index])
        ) return null;
    }
    return Object.freeze({
        maxBpm: values.maxBpm,
        restingBpm: values.restingBpm,
        thresholdBpm: values.thresholdBpm,
        zoneMode: values.zoneMode,
        upperBoundsBpm: Object.freeze([...upperBoundsBpm])
    });
}

function inspectHeartRateCandidate(candidate) {
    const values = exactOwnDataValues(candidate, HEART_RATE_FIELDS);
    if (values === null) return null;
    const normalized = validHeartRateValues(values);
    if (normalized === null || !cloneSafe(candidate)) return null;
    return normalized;
}

export function generatePercentMaxUpperBounds(maxBpm) {
    if (!integerInRange(maxBpm, 100, 230)) return null;
    return Object.freeze(
        PERCENT_MAX_BOUNDARIES.map(boundary => Math.round(maxBpm * boundary))
    );
}

export function validateAnalysisProfileV1(candidate) {
    const values = exactOwnDataValues(candidate, PROFILE_FIELDS);
    if (
        values === null
        || values.schemaVersion !== ANALYSIS_PROFILE_SCHEMA_VERSION
        || !integerInRange(values.revision, 1, Number.MAX_SAFE_INTEGER)
    ) return null;
    const heartRate = inspectHeartRateCandidate(values.heartRate);
    if (heartRate === null || !cloneSafe(candidate)) return null;
    return Object.freeze({
        schemaVersion: ANALYSIS_PROFILE_SCHEMA_VERSION,
        revision: values.revision,
        heartRate
    });
}

function createHeartRateContext(profile) {
    const heartRate = profile.heartRate;
    const boundaries = heartRate.upperBoundsBpm;
    const starts = [1, ...boundaries];
    const zones = starts.map((minimum, index) => {
        const maximum = index < boundaries.length ? boundaries[index] : null;
        let label;
        if (index === 0) label = `<${maximum}`;
        else if (maximum === null) label = `≥${minimum}`;
        else label = `${minimum}–${maximum - 1}`;
        return Object.freeze({
            id: `Z${index + 1}`,
            minBpm: minimum,
            maxBpmExclusive: maximum,
            label
        });
    });
    return Object.freeze({
        maxBpm: heartRate.maxBpm,
        restingBpm: heartRate.restingBpm,
        thresholdBpm: heartRate.thresholdBpm,
        zoneMode: heartRate.zoneMode,
        upperBoundsBpm: Object.freeze([...boundaries]),
        zones: Object.freeze(zones)
    });
}

function createTrainingZonesProjection(heartRate) {
    const zones = heartRate.zones.map(zone => Object.freeze({
        min: zone.minBpm,
        max: zone.maxBpmExclusive === null ? -1 : zone.maxBpmExclusive
    }));
    return Object.freeze({
        heart_rate: Object.freeze({
            custom_zones: true,
            zones: Object.freeze(zones)
        })
    });
}

function createAdvancedProjection(heartRate, trainingZones) {
    return Object.freeze({
        max_hr: heartRate.maxBpm,
        hr_rest: heartRate.restingBpm,
        lthr: heartRate.thresholdBpm,
        hr_zones: trainingZones.heart_rate.zones
    });
}

const UNCONFIGURED_ANALYSIS_CONTEXT = Object.freeze({
    schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
    status: 'unconfigured',
    revision: null,
    heartRate: null,
    trainingZones: null,
    advancedAnalysisProfile: null
});
contextProjections.set(UNCONFIGURED_ANALYSIS_CONTEXT, Object.freeze({
    trainingZones: null,
    advancedAnalysisProfile: null
}));

export function createAnalysisContextV1(candidate) {
    const profile = validateAnalysisProfileV1(candidate);
    if (profile === null) return UNCONFIGURED_ANALYSIS_CONTEXT;
    const heartRate = createHeartRateContext(profile);
    const trainingZones = createTrainingZonesProjection(heartRate);
    const advancedAnalysisProfile = createAdvancedProjection(heartRate, trainingZones);
    const context = Object.freeze({
        schemaVersion: ANALYSIS_CONTEXT_SCHEMA_VERSION,
        status: 'configured',
        revision: profile.revision,
        heartRate,
        trainingZones,
        advancedAnalysisProfile
    });
    contextProjections.set(context, Object.freeze({
        trainingZones,
        advancedAnalysisProfile
    }));
    return context;
}

const DEMO_ANALYSIS_PROFILE_V1 = Object.freeze({
    schemaVersion: ANALYSIS_PROFILE_SCHEMA_VERSION,
    revision: 1,
    heartRate: Object.freeze({
        maxBpm: 190,
        restingBpm: null,
        thresholdBpm: null,
        zoneMode: 'percent-max',
        upperBoundsBpm: Object.freeze([114, 133, 152, 171])
    })
});

export const DEMO_ANALYSIS_CONTEXT_V1 = createAnalysisContextV1(
    DEMO_ANALYSIS_PROFILE_V1
);

export function projectHeartRateTrainingZones(context) {
    return contextProjections.get(context)?.trainingZones ?? null;
}

export function projectAdvancedAnalysisProfile(context) {
    return contextProjections.get(context)?.advancedAnalysisProfile ?? null;
}

function inspectDraft(candidate) {
    const values = exactOwnDataValues(candidate, HEART_RATE_FIELDS);
    if (values === null) return null;
    const normalized = validHeartRateValues(values);
    if (normalized === null || !cloneSafe(candidate)) return null;
    return normalized;
}

function profileFromDraft(draft, revision) {
    const heartRate = inspectDraft(draft);
    if (heartRate === null || !integerInRange(revision, 1, Number.MAX_SAFE_INTEGER)) {
        return null;
    }
    return Object.freeze({
        schemaVersion: ANALYSIS_PROFILE_SCHEMA_VERSION,
        revision,
        heartRate
    });
}

function sameHeartRate(left, right) {
    return left.maxBpm === right.maxBpm
        && left.restingBpm === right.restingBpm
        && left.thresholdBpm === right.thresholdBpm
        && left.zoneMode === right.zoneMode
        && left.upperBoundsBpm.every((value, index) => (
            value === right.upperBoundsBpm[index]
        ));
}

function parseLegacyMaxBpm(value) {
    if (integerInRange(value, 100, 230)) return value;
    if (typeof value !== 'string' || !/^(?:1\d{2}|2[0-2]\d|230)$/.test(value)) {
        return null;
    }
    const parsed = Number(value);
    return integerInRange(parsed, 100, 230) ? parsed : null;
}

function ownValue(record, key) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && Object.hasOwn(descriptor, 'value')
        ? descriptor.value
        : undefined;
}

function parsedValueIsJsonSafe(root) {
    const pending = [root];
    try {
        while (pending.length > 0) {
            const value = pending.pop();
            if (
                value === null
                || typeof value === 'string'
                || typeof value === 'boolean'
            ) continue;
            if (typeof value === 'number') {
                if (!Number.isFinite(value) || Object.is(value, -0)) return false;
                continue;
            }
            if (typeof value !== 'object') return false;
            if (Array.isArray(value)) {
                if (Object.getPrototypeOf(value) !== Array.prototype) return false;
                const values = denseArrayValues(value, value.length);
                if (values === null) return false;
                pending.push(...values);
                continue;
            }
            if (Object.getPrototypeOf(value) !== Object.prototype) return false;
            const keys = Reflect.ownKeys(value);
            for (const key of keys) {
                if (typeof key !== 'string') return false;
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (
                    !descriptor?.enumerable
                    || !Object.hasOwn(descriptor, 'value')
                ) return false;
                pending.push(descriptor.value);
            }
        }
        return true;
    } catch {
        return false;
    }
}

function parseStoredSettings(raw) {
    if (raw === null) return {};
    if (typeof raw !== 'string') return null;
    try {
        const parsed = JSON.parse(raw);
        if (
            parsed === null
            || typeof parsed !== 'object'
            || Array.isArray(parsed)
            || Object.getPrototypeOf(parsed) !== Object.prototype
            || !parsedValueIsJsonSafe(parsed)
        ) return null;
        return parsed;
    } catch {
        return null;
    }
}

function configuredResult(profile) {
    const context = createAnalysisContextV1(profile);
    return Object.freeze({
        status: 'configured',
        profile,
        context,
        prefillMaxBpm: null
    });
}

function unconfiguredResult(prefillMaxBpm = null) {
    return Object.freeze({
        status: 'unconfigured',
        profile: null,
        context: UNCONFIGURED_ANALYSIS_CONTEXT,
        prefillMaxBpm
    });
}

function inspectStoredSettings(settings) {
    const hasProfile = Object.hasOwn(settings, 'analysisProfile');
    if (hasProfile) {
        const profile = validateAnalysisProfileV1(ownValue(settings, 'analysisProfile'));
        return profile === null
            ? unconfiguredResult()
            : configuredResult(profile);
    }
    return unconfiguredResult(
        parseLegacyMaxBpm(ownValue(settings, 'hrMax'))
    );
}

function validStorage(storage) {
    try {
        return storage !== null
            && typeof storage === 'object'
            && typeof storage.getItem === 'function'
            && typeof storage.setItem === 'function';
    } catch {
        return false;
    }
}

export function createAnalysisProfileSettingsFacade({ storage } = {}) {
    if (!validStorage(storage)) {
        throw new TypeError('Invalid analysis profile storage dependency.');
    }

    function load(operation) {
        let raw;
        try {
            raw = storage.getItem(DASHBOARD_SETTINGS_STORAGE_KEY);
        } catch {
            throw profileError(ANALYSIS_PROFILE_ERROR_CODE.STORAGE_UNAVAILABLE, operation);
        }
        const settings = parseStoredSettings(raw);
        if (settings === null) {
            throw profileError(ANALYSIS_PROFILE_ERROR_CODE.INVALID_SETTINGS, operation);
        }
        return settings;
    }

    function store(settings, operation) {
        let serialized;
        try {
            serialized = JSON.stringify(settings);
            storage.setItem(DASHBOARD_SETTINGS_STORAGE_KEY, serialized);
        } catch {
            throw profileError(ANALYSIS_PROFILE_ERROR_CODE.STORAGE_UNAVAILABLE, operation);
        }
    }

    function read() {
        try {
            return inspectStoredSettings(load('read'));
        } catch {
            return unconfiguredResult();
        }
    }

    function readContext() {
        return read().context;
    }

    function save(draft) {
        const operation = 'save';
        const settings = load(operation);
        const existing = Object.hasOwn(settings, 'analysisProfile')
            ? validateAnalysisProfileV1(ownValue(settings, 'analysisProfile'))
            : null;
        const revision = existing === null ? 1 : existing.revision;
        let profile = profileFromDraft(draft, revision);
        if (profile === null) {
            throw profileError(ANALYSIS_PROFILE_ERROR_CODE.INVALID_PROFILE, operation);
        }
        const unchanged = existing !== null
            && sameHeartRate(existing.heartRate, profile.heartRate);
        if (!unchanged) {
            const nextRevision = existing === null ? 1 : existing.revision + 1;
            profile = profileFromDraft(draft, nextRevision);
            if (profile === null) {
                throw profileError(ANALYSIS_PROFILE_ERROR_CODE.INVALID_PROFILE, operation);
            }
        } else {
            profile = existing;
        }
        const mirroredMax = parseLegacyMaxBpm(ownValue(settings, 'hrMax'));
        if (unchanged && mirroredMax === profile.heartRate.maxBpm) {
            return configuredResult(profile);
        }
        const nextSettings = {
            ...settings,
            analysisProfile: profile,
            hrMax: profile.heartRate.maxBpm
        };
        store(nextSettings, operation);
        return configuredResult(profile);
    }

    function reset(options = {}) {
        const confirmed = exactOwnDataValues(options, ['confirmed']);
        if (confirmed === null || confirmed.confirmed !== true) {
            throw profileError(
                ANALYSIS_PROFILE_ERROR_CODE.CONFIRMATION_REQUIRED,
                'reset'
            );
        }
        const settings = load('reset');
        if (
            !Object.hasOwn(settings, 'analysisProfile')
            && !Object.hasOwn(settings, 'hrMax')
        ) return unconfiguredResult();
        const nextSettings = { ...settings };
        delete nextSettings.analysisProfile;
        delete nextSettings.hrMax;
        store(nextSettings, 'reset');
        return unconfiguredResult();
    }

    return Object.freeze({ read, readContext, save, reset });
}

export function readAnalysisProfileSettings(storage) {
    return createAnalysisProfileSettingsFacade({ storage }).read();
}

export function readLocalAnalysisContext() {
    try {
        return readAnalysisProfileSettings(globalThis.localStorage).context;
    } catch {
        return UNCONFIGURED_ANALYSIS_CONTEXT;
    }
}

export function saveAnalysisProfile(storage, draft) {
    return createAnalysisProfileSettingsFacade({ storage }).save(draft);
}

export function resetAnalysisProfile(storage, options) {
    return createAnalysisProfileSettingsFacade({ storage }).reset(options);
}
