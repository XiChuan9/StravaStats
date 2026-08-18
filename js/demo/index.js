/**
 * Demo Mode Controller
 *
 * Demo data is intentionally isolated from the real Local Library. Every
 * storage read, write, and cleanup in this module is limited to the explicit
 * namespace below.
 */

import {
    DEFAULT_DEMO_SEED,
    generateDemoData,
    generateDemoAthlete,
    generateDemoZones,
} from './generator.js';

export const DEMO_MODE_KEY = 'strava_demo_mode';
export const DEMO_ACTIVITIES_KEY = 'strava_demo_activities';
export const DEMO_ATHLETE_KEY = 'strava_demo_athlete_data';
export const DEMO_TRAINING_ZONES_KEY = 'strava_demo_training_zones';
export const DEMO_GEARS_KEY = 'strava_demo_gears';
export const DEMO_ATHLETE_TIMESTAMP_KEY =
    'strava_demo_athlete_data_timestamp';
export const DEMO_TRAINING_ZONES_TIMESTAMP_KEY =
    'strava_demo_training_zones_timestamp';
export const DEMO_GEARS_TIMESTAMP_KEY = 'strava_demo_gears_timestamp';
export const DEMO_TOKENS_KEY = 'strava_tokens_demo';

export const DEMO_STORAGE_KEYS = Object.freeze([
    DEMO_MODE_KEY,
    DEMO_ACTIVITIES_KEY,
    DEMO_ATHLETE_KEY,
    DEMO_TRAINING_ZONES_KEY,
    DEMO_GEARS_KEY,
    DEMO_ATHLETE_TIMESTAMP_KEY,
    DEMO_TRAINING_ZONES_TIMESTAMP_KEY,
    DEMO_GEARS_TIMESTAMP_KEY,
    DEMO_TOKENS_KEY
]);

export const DEMO_STORAGE_ERROR = Object.freeze({
    READ_FAILED: 'DEMO_STORAGE_READ_FAILED',
    WRITE_FAILED: 'DEMO_STORAGE_WRITE_FAILED',
    CLEAR_FAILED: 'DEMO_STORAGE_CLEAR_FAILED'
});

export class DemoStorageError extends Error {
    constructor(code, { rollbackFailed = false } = {}) {
        super('Demo storage operation failed.');
        this.name = 'DemoStorageError';
        this.code = code;
        this.rollbackFailed = rollbackFailed;
    }
}

function requireStorage(storage) {
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
    ) {
        throw new TypeError('A storage dependency is required.');
    }
    return storage;
}

function normalizeNow(now) {
    const value = new Date(now);
    if (Number.isNaN(value.getTime())) {
        throw new TypeError('now must be a valid date value');
    }
    return value.getTime();
}

function readDemoJson(key, fallback, storage) {
    const target = requireStorage(storage);
    try {
        const raw = target.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeDemoEntries(entries, storage) {
    const target = requireStorage(storage);
    const previous = new Map();

    try {
        for (const [key] of entries) {
            previous.set(key, target.getItem(key));
        }
    } catch {
        throw new DemoStorageError(DEMO_STORAGE_ERROR.READ_FAILED);
    }

    const attempted = [];
    try {
        for (const [key, value] of entries) {
            attempted.push(key);
            target.setItem(key, value);
        }
    } catch {
        let rollbackFailed = false;
        for (const key of [...attempted].reverse()) {
            try {
                const priorValue = previous.get(key);
                if (priorValue === null) {
                    target.removeItem(key);
                } else {
                    target.setItem(key, priorValue);
                }
            } catch {
                rollbackFailed = true;
            }
        }
        throw new DemoStorageError(DEMO_STORAGE_ERROR.WRITE_FAILED, {
            rollbackFailed
        });
    }
}

export function getDemoReferenceDate(now = new Date()) {
    const referenceDate = new Date(now);
    if (Number.isNaN(referenceDate.getTime())) {
        throw new TypeError('now must be a valid date value');
    }

    referenceDate.setUTCHours(12, 0, 0, 0);
    return referenceDate.toISOString();
}

export function isDemoMode(storage = globalThis.localStorage) {
    try {
        return requireStorage(storage).getItem(DEMO_MODE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setDemoMode(enabled, storage = globalThis.localStorage) {
    const target = requireStorage(storage);
    if (enabled) {
        target.setItem(DEMO_MODE_KEY, 'true');
    } else {
        target.removeItem(DEMO_MODE_KEY);
    }
}

/**
 * Generate and atomically install a deterministic Demo namespace.
 *
 * If a write fails, only Demo keys attempted by this call are restored to
 * their exact prior values. Real Local Library keys are never inspected.
 */
export function loadDemoData({
    now = new Date(),
    referenceDate = getDemoReferenceDate(now),
    storage = globalThis.localStorage
} = {}) {
    const nowMs = normalizeNow(now);
    const activities = generateDemoData({ referenceDate });
    const athlete = generateDemoAthlete(referenceDate);
    const zones = generateDemoZones();
    const gears = [...(athlete?.shoes || []), ...(athlete?.bikes || [])];
    const tokenSuffix = DEFAULT_DEMO_SEED.toString(36);
    const demoTokens = {
        access_token: `demo_token_${tokenSuffix}`,
        refresh_token: `demo_refresh_${tokenSuffix}`,
        expires_at: Math.floor(nowMs / 1000) + 21600
    };
    const timestamp = String(nowMs);

    writeDemoEntries([
        [DEMO_ACTIVITIES_KEY, JSON.stringify(activities)],
        [DEMO_ATHLETE_KEY, JSON.stringify(athlete)],
        [DEMO_TRAINING_ZONES_KEY, JSON.stringify(zones)],
        [DEMO_GEARS_KEY, JSON.stringify(gears)],
        [DEMO_ATHLETE_TIMESTAMP_KEY, timestamp],
        [DEMO_TRAINING_ZONES_TIMESTAMP_KEY, timestamp],
        [DEMO_GEARS_TIMESTAMP_KEY, timestamp],
        [DEMO_TOKENS_KEY, JSON.stringify(demoTokens)],
        [DEMO_MODE_KEY, 'true']
    ], storage);

    return {
        activities,
        athlete,
        zones,
        gears,
        demoTokens
    };
}

/**
 * Remove only the frozen Demo namespace.
 */
export function clearDemoData(storage = globalThis.localStorage) {
    const target = requireStorage(storage);
    let failed = false;

    for (const key of DEMO_STORAGE_KEYS) {
        try {
            target.removeItem(key);
        } catch {
            failed = true;
        }
    }

    if (failed) {
        throw new DemoStorageError(DEMO_STORAGE_ERROR.CLEAR_FAILED);
    }
    return Object.freeze({ status: 'success' });
}

export function getDemoActivities(storage = globalThis.localStorage) {
    const activities = readDemoJson(DEMO_ACTIVITIES_KEY, [], storage);
    return Array.isArray(activities) ? activities : [];
}

export function getDemoAthlete(storage = globalThis.localStorage) {
    const athlete = readDemoJson(DEMO_ATHLETE_KEY, null, storage);
    return athlete && typeof athlete === 'object' && !Array.isArray(athlete)
        ? athlete
        : null;
}

export function getDemoTrainingZones(storage = globalThis.localStorage) {
    const zones = readDemoJson(DEMO_TRAINING_ZONES_KEY, null, storage);
    return zones && typeof zones === 'object' && !Array.isArray(zones)
        ? zones
        : null;
}

export function getDemoGears(storage = globalThis.localStorage) {
    const gears = readDemoJson(DEMO_GEARS_KEY, [], storage);
    return Array.isArray(gears) ? gears : [];
}

export function getDemoTokens(storage = globalThis.localStorage) {
    const tokens = readDemoJson(DEMO_TOKENS_KEY, null, storage);
    if (
        !tokens
        || typeof tokens !== 'object'
        || Array.isArray(tokens)
        || typeof tokens.access_token !== 'string'
        || tokens.access_token.length === 0
        || !Number.isFinite(tokens.expires_at)
    ) {
        return null;
    }
    return tokens;
}

export function setDemoGears(
    gears,
    {
        now = new Date(),
        storage = globalThis.localStorage
    } = {}
) {
    const normalized = Array.isArray(gears) ? gears : [];
    writeDemoEntries([
        [DEMO_GEARS_KEY, JSON.stringify(normalized)],
        [DEMO_GEARS_TIMESTAMP_KEY, String(normalizeNow(now))]
    ], storage);
    return normalized;
}

/**
 * Report whether the Demo namespace is active.
 */
export function setupDemoModeInterceptor() {
    return isDemoMode();
}
