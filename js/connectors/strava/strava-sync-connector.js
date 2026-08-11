const TOKEN_KEY = 'strava_tokens';
const TOKEN_FIELDS = Object.freeze([
    'access_token', 'refresh_token', 'expires_at', 'subject_id', 'granted_scopes'
]);
const OPTION_FIELDS = Object.freeze([
    'authority',
    'fetchImpl',
    'setTimeoutImpl',
    'clearTimeoutImpl',
    'AbortControllerImpl'
]);
const SIGNAL_FIELDS = Object.freeze(['signal']);
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const STREAM_KEYS = Object.freeze([
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
const BROWSER_TIMEOUT_MS = 15_000;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_TOKEN_JSON_BYTES = 16_384;
const MAX_ACTIVITY_ID_LENGTH = 32;
const MAX_ACTIVITIES = 25;
const MAX_LIST_OR_DETAIL_BYTES = 2 * 1024 * 1024;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const AUTHORITY_CREDENTIALS = new WeakMap();

export const STRAVA_SYNC_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'SYNC_INVALID_REQUEST',
    AUTHORITY_INVALID: 'SYNC_AUTHORITY_INVALID',
    CANCELLED: 'SYNC_CANCELLED',
    RECONNECT_REQUIRED: 'SYNC_RECONNECT_REQUIRED',
    TRY_LATER: 'SYNC_TRY_LATER',
    LIST_FAILED: 'SYNC_LIST_FAILED',
    RESPONSE_LIMIT_EXCEEDED: 'SYNC_RESPONSE_LIMIT_EXCEEDED',
    CLOSED: 'SYNC_CLOSED'
});

const ERROR_MESSAGES = Object.freeze({
    SYNC_INVALID_REQUEST: 'The provider sync request is invalid.',
    SYNC_AUTHORITY_INVALID: 'Exact local provider authority is required.',
    SYNC_CANCELLED: 'Provider sync was cancelled.',
    SYNC_RECONNECT_REQUIRED: 'Reconnect to the provider before syncing.',
    SYNC_TRY_LATER: 'Provider sync is temporarily unavailable. Try again later.',
    SYNC_LIST_FAILED: 'The provider activity list could not be acquired.',
    SYNC_RESPONSE_LIMIT_EXCEEDED: 'The provider response exceeded a fixed limit.',
    SYNC_CLOSED: 'The provider sync reader is closed.'
});

export class StravaSyncError extends Error {
    constructor(code) {
        super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.SYNC_INVALID_REQUEST);
        this.name = 'StravaSyncError';
        this.code = Object.hasOwn(ERROR_MESSAGES, code)
            ? code
            : STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST;
        this.retryable = false;
        Object.freeze(this);
    }
}

function fail(code) {
    throw new StravaSyncError(code);
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

function denseExactScopes(value) {
    try {
        return Array.isArray(value)
            && Object.getPrototypeOf(value) === Array.prototype
            && Reflect.ownKeys(value).length === REQUIRED_SCOPES.length + 1
            && value.length === REQUIRED_SCOPES.length
            && value[0] === REQUIRED_SCOPES[0]
            && value[1] === REQUIRED_SCOPES[1];
    } catch {
        return false;
    }
}

function boundedString(value, maxLength) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && value.trim().length > 0;
}

function positiveDecimal(value) {
    return typeof value === 'string'
        && value.length <= MAX_ACTIVITY_ID_LENGTH
        && /^[1-9]\d*$/.test(value);
}

function normalizeStoredToken(value) {
    const token = exactOwnData(value, TOKEN_FIELDS);
    if (
        !token
        || !boundedString(token.access_token, MAX_TOKEN_LENGTH)
        || !boundedString(token.refresh_token, MAX_TOKEN_LENGTH)
        || !Number.isSafeInteger(token.expires_at)
        || token.expires_at <= 0
        || !positiveDecimal(token.subject_id)
        || !denseExactScopes(token.granted_scopes)
    ) return null;
    return Object.freeze({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        subject_id: token.subject_id,
        granted_scopes: Object.freeze([...REQUIRED_SCOPES])
    });
}

export function readStravaSyncAuthority(storage) {
    const getItem = dataMethod(storage, 'getItem');
    if (!getItem) return null;
    let raw;
    try {
        raw = Reflect.apply(getItem, storage, [TOKEN_KEY]);
    } catch {
        return null;
    }
    if (
        typeof raw !== 'string'
        || raw.length === 0
        || new TextEncoder().encode(raw).byteLength > MAX_TOKEN_JSON_BYTES
    ) return null;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    const credential = normalizeStoredToken(parsed);
    if (!credential) return null;
    const authority = Object.freeze({
        subjectId: credential.subject_id,
        grantedScopes: Object.freeze([...REQUIRED_SCOPES])
    });
    AUTHORITY_CREDENTIALS.set(authority, credential);
    return authority;
}

function validSignal(signal) {
    try {
        return signal !== null
            && typeof signal === 'object'
            && typeof signal.aborted === 'boolean'
            && dataMethod(signal, 'addEventListener')
            && dataMethod(signal, 'removeEventListener');
    } catch {
        return false;
    }
}

function normalizeControl(value) {
    const control = exactOwnData(value, SIGNAL_FIELDS);
    return control && validSignal(control.signal) ? control : null;
}

function normalizeOptions(options) {
    const value = exactOwnData(options, OPTION_FIELDS);
    if (!value || !AUTHORITY_CREDENTIALS.has(value.authority)) return null;
    if (
        typeof value.fetchImpl !== 'function'
        || typeof value.setTimeoutImpl !== 'function'
        || typeof value.clearTimeoutImpl !== 'function'
        || typeof value.AbortControllerImpl !== 'function'
    ) return null;
    return Object.freeze({ ...value, credential: AUTHORITY_CREDENTIALS.get(value.authority) });
}

function responseStatus(response) {
    try {
        return Number.isInteger(response?.status) ? response.status : null;
    } catch {
        return null;
    }
}

function responseContentType(response) {
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

function responseContentLength(response) {
    try {
        const get = dataMethod(response?.headers, 'get');
        if (!get) return Number.NaN;
        const value = Reflect.apply(get, response.headers, ['content-length']);
        if (value === null) return null;
        if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
    } catch {
        return Number.NaN;
    }
}

async function readBoundedResponseText(response, maxBytes, claimBytes) {
    const body = response?.body;
    const getReader = dataMethod(body, 'getReader');
    if (!getReader) throw new TypeError();
    const reader = Reflect.apply(getReader, body, []);
    const read = dataMethod(reader, 'read');
    const cancel = dataMethod(reader, 'cancel');
    const releaseLock = dataMethod(reader, 'releaseLock');
    if (!read || !cancel || !releaseLock) throw new TypeError();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const result = await Reflect.apply(read, reader, []);
            if (!result || typeof result !== 'object' || typeof result.done !== 'boolean') {
                throw new TypeError();
            }
            if (result.done) break;
            if (!(result.value instanceof Uint8Array) || result.value.byteLength === 0) {
                throw new TypeError();
            }
            total += result.value.byteLength;
            if (total > maxBytes || !claimBytes(result.value.byteLength)) {
                try { await Reflect.apply(cancel, reader, []); } catch {}
                throw new RangeError();
            }
            chunks.push(result.value);
        }
    } finally {
        try { Reflect.apply(releaseLock, reader, []); } catch {}
    }
    if (total === 0) throw new TypeError();
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return Object.freeze({
        text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        bytes: total
    });
}

function deepFreeze(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
}

function parseListEnvelope(value) {
    const envelope = exactOwnData(value, ['operation', 'activities']);
    if (!envelope || envelope.operation !== 'list' || !Array.isArray(envelope.activities)) return null;
    if (envelope.activities.length > MAX_ACTIVITIES) return null;
    const ids = new Set();
    for (const activity of envelope.activities) {
        if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return null;
        const id = activity.id;
        if (!positiveDecimal(id) || ids.has(id)) return null;
        ids.add(id);
    }
    return { value: envelope.activities, ids };
}

function parseOptionalEnvelope(value, operation) {
    const field = operation === 'detail' ? 'activity' : 'streams';
    const envelope = exactOwnData(value, ['operation', field]);
    if (!envelope || envelope.operation !== operation) return undefined;
    const result = envelope[field];
    return result === null || (result && typeof result === 'object' && !Array.isArray(result))
        ? result
        : undefined;
}

export function createStravaSyncConnector(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) fail(STRAVA_SYNC_ERROR_CODE.AUTHORITY_INVALID);
    let closed = false;
    let listStarted = false;
    let totalBytes = 0;
    let listedIds = null;
    const detailedIds = new Set();
    const detailSettledIds = new Set();
    const streamedIds = new Set();
    const controllers = new Set();

    function assertOpen() {
        if (closed) fail(STRAVA_SYNC_ERROR_CODE.CLOSED);
    }

    function claimBytes(bytes) {
        if (
            !Number.isSafeInteger(bytes)
            || bytes <= 0
            || totalBytes > MAX_TOTAL_BYTES - bytes
        ) return false;
        totalBytes += bytes;
        return true;
    }

    function requestBody(operation, activityId = null) {
        const body = { operation };
        if (activityId !== null) body.activity_id = activityId;
        if (operation === 'streams') body.keys = [...STREAM_KEYS];
        body.token = {
            access_token: dependencies.credential.access_token,
            refresh_token: dependencies.credential.refresh_token,
            expires_at: dependencies.credential.expires_at,
            subject_id: dependencies.credential.subject_id,
            granted_scopes: [...dependencies.credential.granted_scopes]
        };
        return JSON.stringify(body);
    }

    async function request(operation, activityId, control) {
        assertOpen();
        if (control.signal.aborted) fail(STRAVA_SYNC_ERROR_CODE.CANCELLED);
        let controller;
        try {
            controller = new dependencies.AbortControllerImpl();
        } catch {
            if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
            return null;
        }
        controllers.add(controller);
        const abort = () => {
            try { controller.abort(); } catch {}
        };
        const addEventListener = dataMethod(control.signal, 'addEventListener');
        const removeEventListener = dataMethod(control.signal, 'removeEventListener');
        let timeoutId;
        try {
            Reflect.apply(addEventListener, control.signal, ['abort', abort, { once: true }]);
            timeoutId = dependencies.setTimeoutImpl(abort, BROWSER_TIMEOUT_MS);
            const response = await dependencies.fetchImpl('/api/strava-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody(operation, activityId),
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                signal: controller.signal
            });
            if (closed) fail(STRAVA_SYNC_ERROR_CODE.CLOSED);
            if (control.signal.aborted) fail(STRAVA_SYNC_ERROR_CODE.CANCELLED);
            if (controller.signal.aborted) {
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
                return null;
            }
            const status = responseStatus(response);
            if (status === 401 || status === 403) {
                abort();
                fail(STRAVA_SYNC_ERROR_CODE.RECONNECT_REQUIRED);
            }
            if (status === 429) {
                abort();
                fail(STRAVA_SYNC_ERROR_CODE.TRY_LATER);
            }
            if (status === null || status < 200 || status >= 300 || !responseContentType(response)) {
                abort();
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
                return null;
            }
            const maxBytes = operation === 'streams' ? MAX_STREAM_BYTES : MAX_LIST_OR_DETAIL_BYTES;
            const declaredLength = responseContentLength(response);
            if (Number.isNaN(declaredLength) || (declaredLength !== null && declaredLength > maxBytes)) {
                abort();
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.RESPONSE_LIMIT_EXCEEDED);
                return null;
            }
            let payload;
            try {
                payload = await readBoundedResponseText(response, maxBytes, claimBytes);
            } catch (error) {
                if (error instanceof RangeError && operation === 'list') {
                    fail(STRAVA_SYNC_ERROR_CODE.RESPONSE_LIMIT_EXCEEDED);
                }
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
                return null;
            }
            if (closed) fail(STRAVA_SYNC_ERROR_CODE.CLOSED);
            if (control.signal.aborted) fail(STRAVA_SYNC_ERROR_CODE.CANCELLED);
            if (controller.signal.aborted) {
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
                return null;
            }
            let value;
            try { value = JSON.parse(payload.text); } catch {
                if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
                return null;
            }
            return value;
        } catch (error) {
            if (error instanceof StravaSyncError) throw error;
            if (closed) fail(STRAVA_SYNC_ERROR_CODE.CLOSED);
            if (control.signal.aborted) fail(STRAVA_SYNC_ERROR_CODE.CANCELLED);
            if (operation === 'list') fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
            return null;
        } finally {
            Reflect.apply(removeEventListener, control.signal, ['abort', abort]);
            controllers.delete(controller);
            if (timeoutId !== undefined) {
                try { dependencies.clearTimeoutImpl(timeoutId); } catch {}
            }
        }
    }

    async function list(controlValue) {
        const control = normalizeControl(controlValue);
        if (!control || listStarted) fail(STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST);
        listStarted = true;
        const envelope = await request('list', null, control);
        const parsed = parseListEnvelope(envelope);
        if (!parsed) fail(STRAVA_SYNC_ERROR_CODE.LIST_FAILED);
        listedIds = parsed.ids;
        return deepFreeze(structuredClone(parsed.value));
    }

    async function detail(activityId, controlValue) {
        const control = normalizeControl(controlValue);
        if (
            !control
            || !positiveDecimal(activityId)
            || !listedIds?.has(activityId)
            || detailedIds.has(activityId)
        ) fail(STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST);
        detailedIds.add(activityId);
        try {
            const envelope = await request('detail', activityId, control);
            if (envelope === null) return null;
            const value = parseOptionalEnvelope(envelope, 'detail');
            return value === undefined ? null : deepFreeze(structuredClone(value));
        } finally {
            detailSettledIds.add(activityId);
        }
    }

    async function streams(activityId, controlValue) {
        const control = normalizeControl(controlValue);
        if (
            !control
            || !positiveDecimal(activityId)
            || !listedIds?.has(activityId)
            || !detailSettledIds.has(activityId)
            || streamedIds.has(activityId)
        ) fail(STRAVA_SYNC_ERROR_CODE.INVALID_REQUEST);
        streamedIds.add(activityId);
        const envelope = await request('streams', activityId, control);
        if (envelope === null) return null;
        const value = parseOptionalEnvelope(envelope, 'streams');
        return value === undefined ? null : deepFreeze(structuredClone(value));
    }

    async function close() {
        closed = true;
        for (const controller of controllers) {
            try { controller.abort(); } catch {}
        }
        controllers.clear();
        return Object.freeze({ status: 'closed' });
    }

    return Object.freeze({ list, detail, streams, close });
}
