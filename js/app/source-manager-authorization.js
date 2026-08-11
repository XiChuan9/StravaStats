const OPTION_FIELDS = Object.freeze([
    'fetchImpl',
    'sessionStorage',
    'crypto',
    'origin',
    'navigate',
    'now',
    'setTimeoutImpl',
    'clearTimeoutImpl',
    'AbortControllerImpl'
]);
const STATE_FIELDS = Object.freeze([
    'schemaVersion', 'state', 'createdAt', 'expiresAt', 'returnPath'
]);
const CODE_CALLBACK_FIELDS = Object.freeze([
    'kind', 'code', 'state', 'grantedScopes'
]);
const DENIED_CALLBACK_FIELDS = Object.freeze(['kind', 'state']);
const TOKEN_FIELDS = Object.freeze([
    'access_token', 'refresh_token', 'expires_at', 'subject_id', 'granted_scopes'
]);
const CONFIG_FIELDS = Object.freeze(['stravaClientId']);
const REVOKE_FIELDS = Object.freeze(['revoked']);
const STATE_KEY = 'source_manager_authorization_state';
const RETURN_PATH = '/source-manager.html?mode=real';
const STATE_TTL_MS = 600_000;
const BROWSER_TIMEOUT_MS = 15_000;
const MAX_JSON_BYTES = 32_768;
const MAX_CODE_LENGTH = 512;
const MAX_TOKEN_LENGTH = 4_096;
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const REDIRECTING = Object.freeze({ status: 'redirecting' });
const CLOSED = Object.freeze({ status: 'closed' });

export const SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'AUTHORIZATION_INVALID_REQUEST',
    STATE_UNAVAILABLE: 'AUTHORIZATION_STATE_UNAVAILABLE',
    STATE_INVALID: 'AUTHORIZATION_STATE_INVALID',
    STATE_EXPIRED: 'AUTHORIZATION_STATE_EXPIRED',
    ACCESS_DENIED: 'AUTHORIZATION_ACCESS_DENIED',
    CONFIG_FAILED: 'AUTHORIZATION_CONFIG_FAILED',
    EXCHANGE_FAILED: 'AUTHORIZATION_EXCHANGE_FAILED',
    TOKEN_INVALID: 'AUTHORIZATION_TOKEN_INVALID',
    CLOSED: 'AUTHORIZATION_CLOSED'
});

function authorizationError(code) {
    return Object.freeze({ code });
}

function exactOwnData(value, fields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== fields.length
            || keys.some(key => typeof key !== 'string' || !fields.includes(key))
        ) return null;
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function dataMethod(value, name) {
    try {
        if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return null;
        let current = value;
        for (let depth = 0; current !== null && depth < 32; depth += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function'
                    ? descriptor.value
                    : null;
            }
            current = Object.getPrototypeOf(current);
        }
        return null;
    } catch {
        return null;
    }
}

function validOrigin(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:')
            && url.origin === value
            && url.username === ''
            && url.password === ''
            && url.pathname === '/'
            && url.search === ''
            && url.hash === '';
    } catch {
        return false;
    }
}

function normalizeOptions(options) {
    const value = exactOwnData(options, OPTION_FIELDS);
    if (!value) return null;
    const getItem = dataMethod(value.sessionStorage, 'getItem');
    const setItem = dataMethod(value.sessionStorage, 'setItem');
    const removeItem = dataMethod(value.sessionStorage, 'removeItem');
    const getRandomValues = dataMethod(value.crypto, 'getRandomValues');
    if (
        typeof value.fetchImpl !== 'function'
        || !getItem
        || !setItem
        || !removeItem
        || !getRandomValues
        || !validOrigin(value.origin)
        || typeof value.navigate !== 'function'
        || typeof value.now !== 'function'
        || typeof value.setTimeoutImpl !== 'function'
        || typeof value.clearTimeoutImpl !== 'function'
        || typeof value.AbortControllerImpl !== 'function'
    ) return null;
    return Object.freeze({
        ...value,
        getItem,
        setItem,
        removeItem,
        getRandomValues
    });
}

function exactScopes(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== REQUIRED_SCOPES.length + 1
            || !keys.includes('length')
            || keys.some(key => key !== 'length' && key !== '0' && key !== '1')
        ) return null;
        const result = [];
        for (let index = 0; index < REQUIRED_SCOPES.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
                || descriptor.value !== REQUIRED_SCOPES[index]
            ) return null;
            result.push(descriptor.value);
        }
        return Object.freeze(result);
    } catch {
        return null;
    }
}

function base64url(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let index = 0; index < bytes.length; index += 3) {
        const first = bytes[index];
        const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
        const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
        const combined = (first << 16) | (second << 8) | third;
        result += alphabet[(combined >>> 18) & 63];
        result += alphabet[(combined >>> 12) & 63];
        if (index + 1 < bytes.length) result += alphabet[(combined >>> 6) & 63];
        if (index + 2 < bytes.length) result += alphabet[combined & 63];
    }
    return result;
}

function validState(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function positiveDecimal(value, maxLength = 32) {
    return typeof value === 'string'
        && value.length <= maxLength
        && /^[1-9]\d*$/.test(value);
}

function boundedString(value, maxLength) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && value.trim().length > 0;
}

function normalizeStateRecord(value) {
    const record = exactOwnData(value, STATE_FIELDS);
    if (
        !record
        || record.schemaVersion !== 1
        || !validState(record.state)
        || !Number.isSafeInteger(record.createdAt)
        || !Number.isSafeInteger(record.expiresAt)
        || record.expiresAt - record.createdAt !== STATE_TTL_MS
        || record.returnPath !== RETURN_PATH
    ) return null;
    return Object.freeze({ ...record });
}

function normalizeToken(value) {
    const token = exactOwnData(value, TOKEN_FIELDS);
    const scopes = token ? exactScopes(token.granted_scopes) : null;
    if (
        !token
        || !boundedString(token.access_token, MAX_TOKEN_LENGTH)
        || !boundedString(token.refresh_token, MAX_TOKEN_LENGTH)
        || !Number.isSafeInteger(token.expires_at)
        || token.expires_at <= 0
        || !positiveDecimal(token.subject_id)
        || !scopes
    ) return null;
    return Object.freeze({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        subject_id: token.subject_id,
        granted_scopes: scopes
    });
}

function contentLength(response) {
    try {
        const get = dataMethod(response?.headers, 'get');
        if (!get) return null;
        const value = Reflect.apply(get, response.headers, ['content-length']);
        if (value === null) return null;
        if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
    } catch {
        return Number.NaN;
    }
}

function jsonContentType(response) {
    try {
        const get = dataMethod(response?.headers, 'get');
        if (!get) return false;
        const value = Reflect.apply(get, response.headers, ['content-type']);
        return typeof value === 'string'
            && /^application\/json(?:\s*;|$)/i.test(value.trim());
    } catch {
        return false;
    }
}

function responseStatus(response) {
    try {
        return response !== null
            && typeof response === 'object'
            && response.ok === true
            && Number.isInteger(response.status)
            && response.status >= 200
            && response.status < 300;
    } catch {
        return false;
    }
}

async function readBoundedJson(response) {
    if (!responseStatus(response) || !jsonContentType(response)) throw new TypeError();
    const length = contentLength(response);
    if (Number.isNaN(length) || (length !== null && length > MAX_JSON_BYTES)) throw new TypeError();
    const textMethod = dataMethod(response, 'text');
    if (!textMethod) throw new TypeError();
    const text = await Reflect.apply(textMethod, response, []);
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_JSON_BYTES) {
        throw new TypeError();
    }
    return JSON.parse(text);
}

export function createSourceManagerAuthorization(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) {
        throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.INVALID_REQUEST);
    }
    let closed = false;
    const controllers = new Set();

    function assertOpen() {
        if (closed) throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.CLOSED);
    }

    function removeState() {
        try {
            Reflect.apply(dependencies.removeItem, dependencies.sessionStorage, [STATE_KEY]);
            return true;
        } catch {
            return false;
        }
    }

    async function requestJson(url, init, failureCode) {
        assertOpen();
        let controller;
        try {
            controller = new dependencies.AbortControllerImpl();
        } catch {
            throw authorizationError(failureCode);
        }
        controllers.add(controller);
        let timeoutId;
        try {
            timeoutId = dependencies.setTimeoutImpl(() => {
                try { controller.abort(); } catch {}
            }, BROWSER_TIMEOUT_MS);
            const response = await dependencies.fetchImpl(url, {
                ...init,
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                signal: controller.signal
            });
            return await readBoundedJson(response);
        } catch {
            throw authorizationError(failureCode);
        } finally {
            controllers.delete(controller);
            if (timeoutId !== undefined) {
                try { dependencies.clearTimeoutImpl(timeoutId); } catch {}
            }
        }
    }

    async function beginAuthorization() {
        assertOpen();
        let now;
        let state;
        try {
            now = dependencies.now();
            if (!Number.isSafeInteger(now) || now < 0) throw new TypeError();
            const bytes = new Uint8Array(32);
            const result = Reflect.apply(dependencies.getRandomValues, dependencies.crypto, [bytes]);
            if (result !== bytes) throw new TypeError();
            state = base64url(bytes);
            if (!validState(state)) throw new TypeError();
            const record = {
                schemaVersion: 1,
                state,
                createdAt: now,
                expiresAt: now + STATE_TTL_MS,
                returnPath: RETURN_PATH
            };
            Reflect.apply(dependencies.setItem, dependencies.sessionStorage, [
                STATE_KEY,
                JSON.stringify(record)
            ]);
        } catch {
            removeState();
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_UNAVAILABLE);
        }

        try {
            const data = await requestJson(
                '/api/config',
                { method: 'GET' },
                SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.CONFIG_FAILED
            );
            const config = exactOwnData(data, CONFIG_FIELDS);
            if (!config || !positiveDecimal(config.stravaClientId)) {
                throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.CONFIG_FAILED);
            }
            const url = new URL('https://www.strava.com/oauth/authorize');
            url.searchParams.set('client_id', config.stravaClientId);
            url.searchParams.set('redirect_uri', `${dependencies.origin}${RETURN_PATH}`);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('scope', REQUIRED_SCOPES.join(','));
            url.searchParams.set('state', state);
            dependencies.navigate(url.toString());
            return REDIRECTING;
        } catch (error) {
            removeState();
            if (error?.code === SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.CLOSED) throw error;
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.CONFIG_FAILED);
        }
    }

    function consumeState() {
        let raw;
        try {
            raw = Reflect.apply(dependencies.getItem, dependencies.sessionStorage, [STATE_KEY]);
        } catch {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_UNAVAILABLE);
        }
        if (!removeState()) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_UNAVAILABLE);
        }
        if (raw === null) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_UNAVAILABLE);
        }
        if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2_048) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        let parsed;
        try { parsed = JSON.parse(raw); } catch {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        const record = normalizeStateRecord(parsed);
        if (!record) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        let now;
        try { now = dependencies.now(); } catch {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        if (!Number.isSafeInteger(now) || now < record.createdAt) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        if (now >= record.expiresAt) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_EXPIRED);
        }
        return record;
    }

    async function processCallback(callback) {
        assertOpen();
        const stateRecord = consumeState();
        const fields = (() => {
            const kind = exactOwnData(callback, CODE_CALLBACK_FIELDS)?.kind;
            if (kind === 'code') return exactOwnData(callback, CODE_CALLBACK_FIELDS);
            return exactOwnData(callback, DENIED_CALLBACK_FIELDS);
        })();
        if (!fields || !validState(fields.state) || fields.state !== stateRecord.state) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.STATE_INVALID);
        }
        if (fields.kind === 'denied') {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.ACCESS_DENIED);
        }
        const scopes = exactScopes(fields.grantedScopes);
        if (
            fields.kind !== 'code'
            || !boundedString(fields.code, MAX_CODE_LENGTH)
            || !scopes
        ) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.INVALID_REQUEST);
        }
        const data = await requestJson(
            '/api/strava-auth',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: fields.code,
                    granted_scopes: [...scopes]
                })
            },
            SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.EXCHANGE_FAILED
        );
        const token = normalizeToken(data);
        if (!token) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.TOKEN_INVALID);
        }
        return Object.freeze({ status: 'authorized', token });
    }

    async function revoke(refreshToken) {
        assertOpen();
        if (!boundedString(refreshToken, MAX_TOKEN_LENGTH)) {
            throw authorizationError(SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.INVALID_REQUEST);
        }
        try {
            const data = await requestJson(
                '/api/strava-revoke',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken })
                },
                SOURCE_MANAGER_AUTHORIZATION_ERROR_CODE.EXCHANGE_FAILED
            );
            const result = exactOwnData(data, REVOKE_FIELDS);
            return result?.revoked === true;
        } catch {
            return false;
        }
    }

    async function close() {
        closed = true;
        for (const controller of controllers) {
            try { controller.abort(); } catch {}
        }
        controllers.clear();
        return CLOSED;
    }

    return Object.freeze({
        beginAuthorization,
        processCallback,
        revoke,
        close
    });
}
