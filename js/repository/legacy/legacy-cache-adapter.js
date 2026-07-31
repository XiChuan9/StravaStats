import {
    REPOSITORY_ERROR_CODE,
    RepositoryError
} from '../errors.js';
import { projectLegacyValue } from './legacy-projection.js';

export const LEGACY_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_KEYS = Object.freeze({
    athlete: Object.freeze({
        data: 'strava_athlete_data',
        timestamp: 'strava_athlete_data_timestamp',
        operation: 'getAthlete'
    }),
    zones: Object.freeze({
        data: 'strava_training_zones',
        timestamp: 'strava_training_zones_timestamp',
        operation: 'getZones'
    }),
    gears: Object.freeze({
        data: 'strava_gears',
        timestamp: 'strava_gears_timestamp',
        operation: 'getGears'
    })
});

const DEFAULT_STORAGE = Object.freeze({
    getItem(key) {
        return globalThis.localStorage.getItem(key);
    },
    setItem(key, value) {
        globalThis.localStorage.setItem(key, value);
    },
    removeItem(key) {
        globalThis.localStorage.removeItem(key);
    }
});

function defaultNow() {
    return Date.now();
}

function invalidRequest() {
    return new RepositoryError(REPOSITORY_ERROR_CODE.INVALID_REQUEST);
}

function readOptions(options) {
    try {
        if (
            options === null
            || typeof options !== 'object'
            || Array.isArray(options)
            || Object.getPrototypeOf(options) !== Object.prototype
        ) {
            return null;
        }
        const keys = Reflect.ownKeys(options);
        if (keys.some(key => (
            typeof key !== 'string'
            || !new Set(['storage', 'now', 'ttlMs']).has(key)
        ))) {
            return null;
        }

        const values = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(options, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            values[key] = descriptor.value;
        }
        return values;
    } catch {
        return null;
    }
}

function hasStorageMethods(storage) {
    try {
        return (
            storage !== null
            && typeof storage === 'object'
            && typeof storage.getItem === 'function'
            && typeof storage.setItem === 'function'
            && typeof storage.removeItem === 'function'
        );
    } catch {
        return false;
    }
}

function normalizeId(value) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    if (Number.isSafeInteger(value) && value >= 0) return String(value);
    return null;
}

function perIdKeys(id) {
    return {
        data: `strava_gear_${id}`,
        timestamp: `strava_gear_${id}_timestamp`,
        operation: 'getGear'
    };
}

function miss({ expired = false } = {}) {
    return {
        status: 'miss',
        data: null,
        timestamp: null,
        expiresAt: null,
        expired
    };
}

function failed({ expired = false } = {}) {
    return {
        status: 'failed',
        data: null,
        timestamp: null,
        expiresAt: null,
        expired
    };
}

export class LegacyCacheAdapter {
    #storage;
    #now;
    #ttlMs;

    constructor(options = {}) {
        const values = readOptions(options);
        if (values === null) throw invalidRequest();

        const storage = values.storage ?? DEFAULT_STORAGE;
        const now = values.now ?? defaultNow;
        const ttlMs = values.ttlMs ?? LEGACY_METADATA_CACHE_TTL_MS;
        if (
            !hasStorageMethods(storage)
            || typeof now !== 'function'
            || !Number.isFinite(ttlMs)
            || ttlMs < 0
        ) {
            throw invalidRequest();
        }

        this.#storage = storage;
        this.#now = now;
        this.#ttlMs = ttlMs;
    }

    readAthlete() {
        return this.#read(CACHE_KEYS.athlete);
    }

    writeAthlete(data) {
        return this.#write(CACHE_KEYS.athlete, data);
    }

    readZones() {
        return this.#read(CACHE_KEYS.zones);
    }

    writeZones(data) {
        return this.#write(CACHE_KEYS.zones, data);
    }

    readGears() {
        return this.#read(CACHE_KEYS.gears);
    }

    writeGears(data, { partial = false } = {}) {
        if (partial) return failed();
        return this.#write(CACHE_KEYS.gears, data);
    }

    readGear(gearId) {
        const id = normalizeId(gearId);
        return id === null ? failed() : this.#read(perIdKeys(id));
    }

    writeGear(gearId, data) {
        const id = normalizeId(gearId);
        return id === null
            ? failed()
            : this.#write(perIdKeys(id), data);
    }

    #read(keys) {
        let serialized;
        let serializedTimestamp;
        try {
            serialized = this.#storage.getItem(keys.data);
            serializedTimestamp = this.#storage.getItem(keys.timestamp);
        } catch {
            return failed();
        }

        if (
            serializedTimestamp !== null
            && typeof serializedTimestamp !== 'string'
        ) {
            return this.#invalidate(keys);
        }
        if (
            serialized !== null
            && typeof serialized !== 'string'
        ) {
            return failed();
        }
        if (serialized === null) return miss();
        if (
            serializedTimestamp === null
            || serializedTimestamp.trim().length === 0
        ) {
            return this.#invalidate(keys);
        }

        let now;
        try {
            now = this.#now();
        } catch {
            return failed();
        }
        if (
            typeof now !== 'number'
            || !Number.isFinite(now)
        ) {
            return failed();
        }

        const timestamp = Number(serializedTimestamp);
        if (!Number.isFinite(timestamp)) {
            return this.#invalidate(keys);
        }
        const expiresAt = timestamp + this.#ttlMs;
        const elapsed = now - timestamp;
        if (
            timestamp > now
            || !Number.isFinite(elapsed)
            || elapsed > this.#ttlMs
            || !Number.isFinite(expiresAt)
        ) {
            return this.#invalidate(keys);
        }

        let data;
        try {
            data = JSON.parse(serialized);
        } catch {
            return failed();
        }

        return {
            status: 'hit',
            data,
            timestamp,
            expiresAt,
            expired: false
        };
    }

    #write(keys, data) {
        let projected;
        let serialized;
        try {
            projected = projectLegacyValue(data, keys.operation);
            serialized = JSON.stringify(projected);
        } catch {
            return failed();
        }
        let timestamp;
        try {
            timestamp = this.#now();
        } catch {
            return failed();
        }
        if (
            typeof timestamp !== 'number'
            || !Number.isFinite(timestamp)
        ) {
            return failed();
        }
        const expiresAt = timestamp + this.#ttlMs;
        if (!Number.isFinite(expiresAt)) {
            return failed();
        }

        const snapshot = new Map();
        try {
            snapshot.set(keys.data, this.#storage.getItem(keys.data));
            snapshot.set(
                keys.timestamp,
                this.#storage.getItem(keys.timestamp)
            );
        } catch {
            return failed();
        }

        const changed = [];
        try {
            changed.push(keys.data);
            this.#storage.setItem(keys.data, serialized);
            changed.push(keys.timestamp);
            this.#storage.setItem(keys.timestamp, String(timestamp));
            return {
                status: 'written',
                timestamp,
                expiresAt
            };
        } catch {
            for (const key of [...changed].reverse()) {
                try {
                    const previous = snapshot.get(key);
                    if (previous === null) this.#storage.removeItem(key);
                    else this.#storage.setItem(key, previous);
                } catch {
                    // The failure remains observable through the failed status.
                }
            }
            return failed();
        }
    }

    #invalidate(keys) {
        let cleanupFailed = false;
        for (const key of [keys.data, keys.timestamp]) {
            try {
                this.#storage.removeItem(key);
            } catch {
                cleanupFailed = true;
            }
        }
        return cleanupFailed
            ? failed({ expired: true })
            : miss({ expired: true });
    }
}
