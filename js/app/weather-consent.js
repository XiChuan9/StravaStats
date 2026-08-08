export const WEATHER_CONSENT_STORAGE_KEY = 'stravastats_weather_egress_consent_v1';
export const WEATHER_CONSENT_COPY = 'To retrieve historical weather, StravaStats uses Open-Meteo. If you choose “Allow for this tab”, it sends one approximate start coordinate (rounded to 2 decimals) and the local calendar date for each eligible activity in the Weather view you open. It does not send activity IDs or names, full routes, tokens, heart rate, or power. You can revoke here at any time; revocation cancels requests still in progress and blocks future requests.';
export const WEATHER_HOURLY_FIELDS = Object.freeze([
    'temperature_2m',
    'precipitation',
    'wind_speed_10m',
    'wind_direction_10m',
    'weathercode',
    'cloudcover',
    'surface_pressure',
    'relativehumidity_2m'
]);

const WEATHER_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
const CONSENT_VERSION = 1;
const CACHE_MAX_ENTRIES = 256;
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;
const GRANTED_STATE = '{"version":1,"granted":true}';
const DENIED_STATE = '{"version":1,"granted":false}';

function readExactConsentState(raw) {
    try {
        if (typeof raw !== 'string') return false;
        const value = JSON.parse(raw);
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return false;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== 2
            || keys[0] !== 'version'
            || keys[1] !== 'granted'
        ) return false;
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
        }
        return value.version === CONSENT_VERSION && value.granted === true;
    } catch {
        return false;
    }
}

function validCalendarDate(year, month, day) {
    const normalized = new Date(Date.UTC(year, month - 1, day));
    return normalized.getUTCFullYear() === year
        && normalized.getUTCMonth() + 1 === month
        && normalized.getUTCDate() === day;
}

function parseLocalStart(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
    const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
    if (
        !validCalendarDate(year, month, day)
        || hour < 0 || hour > 23
        || minute < 0 || minute > 59
        || second < 0 || second > 59
        || offsetHour < 0 || offsetHour > 23
        || offsetMinute < 0 || offsetMinute > 59
    ) return null;
    return Object.freeze({
        date: `${match[1]}-${match[2]}-${match[3]}`,
        hour
    });
}

function roundedCoordinateString(value) {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

function prepareRequest(input) {
    try {
        if (
            input === null
            || typeof input !== 'object'
            || Array.isArray(input)
        ) return null;
        const coordinate = input.coordinate;
        if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
        const latitude = coordinate[0];
        const longitude = coordinate[1];
        if (
            typeof latitude !== 'number'
            || typeof longitude !== 'number'
            || !Number.isFinite(latitude)
            || !Number.isFinite(longitude)
            || latitude < -90 || latitude > 90
            || longitude < -180 || longitude > 180
        ) return null;
        const start = parseLocalStart(input.startDateLocal);
        if (start === null) return null;
        return Object.freeze({
            latitude: roundedCoordinateString(latitude),
            longitude: roundedCoordinateString(longitude),
            date: start.date,
            hour: start.hour
        });
    } catch {
        return null;
    }
}

function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizedWeather(data, request) {
    try {
        const hourly = data?.hourly;
        if (hourly === null || typeof hourly !== 'object' || Array.isArray(hourly)) return null;
        if (!Array.isArray(hourly.time) || hourly.time.length === 0) return null;
        const index = hourly.time.findIndex(value => {
            const parsed = parseLocalStart(value);
            return parsed?.date === request.date && parsed.hour === request.hour;
        });
        if (index < 0) return null;
        const weatherTime = hourly.time[index];
        return Object.freeze({
            temperature: finiteOrNull(hourly.temperature_2m?.[index]),
            precipitation: finiteOrNull(hourly.precipitation?.[index]),
            wind_speed: finiteOrNull(hourly.wind_speed_10m?.[index]),
            wind_direction: finiteOrNull(hourly.wind_direction_10m?.[index]),
            weather_code: finiteOrNull(hourly.weathercode?.[index]),
            humidity: finiteOrNull(hourly.relativehumidity_2m?.[index]),
            cloudcover: finiteOrNull(hourly.cloudcover?.[index]),
            pressure: finiteOrNull(hourly.surface_pressure?.[index]),
            weather_time: weatherTime
        });
    } catch {
        return null;
    }
}

function validDependencies(dependencies) {
    return dependencies !== null
        && typeof dependencies === 'object'
        && typeof dependencies.storage?.getItem === 'function'
        && typeof dependencies.storage?.setItem === 'function'
        && typeof dependencies.fetch === 'function'
        && typeof dependencies.now === 'function'
        && typeof dependencies.setTimeout === 'function'
        && typeof dependencies.clearTimeout === 'function'
        && typeof dependencies.AbortController === 'function';
}

export function createWeatherConsentService(dependencies) {
    if (!validDependencies(dependencies)) {
        throw new TypeError('Invalid weather consent dependencies.');
    }
    const cache = new Map();
    const controllers = new Set();
    const listeners = new Set();
    const maxEntries = Number.isSafeInteger(dependencies.cacheMaxEntries)
        && dependencies.cacheMaxEntries > 0
        ? dependencies.cacheMaxEntries
        : CACHE_MAX_ENTRIES;
    const ttlMs = Number.isFinite(dependencies.cacheTtlMs) && dependencies.cacheTtlMs > 0
        ? dependencies.cacheTtlMs
        : CACHE_TTL_MS;
    const requestTimeoutMs = Number.isFinite(dependencies.requestTimeoutMs)
        && dependencies.requestTimeoutMs > 0
        ? dependencies.requestTimeoutMs
        : REQUEST_TIMEOUT_MS;
    let epoch = 0;
    let localDecision = null;

    function storedGrant() {
        try {
            return readExactConsentState(
                dependencies.storage.getItem(WEATHER_CONSENT_STORAGE_KEY)
            );
        } catch {
            return false;
        }
    }

    function isGranted() {
        if (localDecision === false) return false;
        const granted = storedGrant();
        if (localDecision === true && !granted) localDecision = false;
        return granted;
    }

    function notify(granted) {
        for (const listener of [...listeners]) {
            try { listener(granted); } catch { /* consent observers are isolated */ }
        }
    }

    function abortAndClear() {
        epoch += 1;
        for (const controller of controllers) {
            try { controller.abort(); } catch { /* already terminal */ }
        }
        controllers.clear();
        cache.clear();
    }

    function grant() {
        if (localDecision !== false && storedGrant()) {
            localDecision = true;
            return true;
        }
        localDecision = false;
        try {
            dependencies.storage.setItem(WEATHER_CONSENT_STORAGE_KEY, GRANTED_STATE);
        } catch {
            return false;
        }
        if (!storedGrant()) return false;
        abortAndClear();
        localDecision = true;
        notify(true);
        return true;
    }

    function revoke() {
        localDecision = false;
        abortAndClear();
        try {
            dependencies.storage.setItem(WEATHER_CONSENT_STORAGE_KEY, DENIED_STATE);
        } catch { /* in-memory revocation still applies to current work */ }
        notify(false);
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function canRequest(input) {
        return prepareRequest(input) !== null;
    }

    function cacheKey(request) {
        return `${request.latitude}:${request.longitude}:${request.date}:${WEATHER_HOURLY_FIELDS.join(',')}`;
    }

    function cacheRead(key, requestEpoch) {
        const entry = cache.get(key);
        if (!entry) return null;
        if (entry.epoch !== requestEpoch || entry.expiresAt <= dependencies.now()) {
            cache.delete(key);
            return null;
        }
        cache.delete(key);
        cache.set(key, entry);
        return entry.value;
    }

    function cacheWrite(key, value, requestEpoch) {
        cache.set(key, Object.freeze({
            epoch: requestEpoch,
            expiresAt: dependencies.now() + ttlMs,
            value
        }));
        while (cache.size > maxEntries) {
            cache.delete(cache.keys().next().value);
        }
    }

    async function request(input) {
        if (!isGranted()) return null;
        const prepared = prepareRequest(input);
        if (prepared === null) return null;
        const requestEpoch = epoch;
        const key = cacheKey(prepared);
        const cached = cacheRead(key, requestEpoch);
        if (cached !== null) return cached;

        const url = new URL(WEATHER_ENDPOINT);
        url.searchParams.set('latitude', prepared.latitude);
        url.searchParams.set('longitude', prepared.longitude);
        url.searchParams.set('hourly', WEATHER_HOURLY_FIELDS.join(','));
        url.searchParams.set('start_date', prepared.date);
        url.searchParams.set('end_date', prepared.date);
        url.searchParams.set('timezone', 'auto');

        const controller = new dependencies.AbortController();
        controllers.add(controller);
        const timer = dependencies.setTimeout(() => controller.abort(), requestTimeoutMs);
        try {
            const response = await dependencies.fetch(url.href, {
                signal: controller.signal,
                credentials: 'omit',
                cache: 'no-store',
                referrerPolicy: 'no-referrer'
            });
            if (
                response?.ok !== true
                || epoch !== requestEpoch
                || !isGranted()
            ) return null;
            const data = await response.json();
            if (epoch !== requestEpoch || !isGranted()) return null;
            const weather = normalizedWeather(data, prepared);
            if (weather === null) return null;
            cacheWrite(key, weather, requestEpoch);
            return weather;
        } catch {
            return null;
        } finally {
            dependencies.clearTimeout(timer);
            controllers.delete(controller);
        }
    }

    return Object.freeze({
        isGranted,
        grant,
        revoke,
        subscribe,
        canRequest,
        request
    });
}

const defaultStorage = Object.freeze({
    getItem(key) {
        return globalThis.sessionStorage.getItem(key);
    },
    setItem(key, value) {
        globalThis.sessionStorage.setItem(key, value);
    }
});

const defaultService = createWeatherConsentService({
    storage: defaultStorage,
    fetch: (...args) => globalThis.fetch(...args),
    now: () => Date.now(),
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (...args) => globalThis.clearTimeout(...args),
    AbortController: globalThis.AbortController
});

export const isWeatherConsentGranted = () => defaultService.isGranted();
export const grantWeatherConsent = () => defaultService.grant();
export const revokeWeatherConsent = () => defaultService.revoke();
export const subscribeWeatherConsent = listener => defaultService.subscribe(listener);
export const canRequestHistoricalWeather = input => defaultService.canRequest(input);
export const requestHistoricalWeather = input => defaultService.request(input);
