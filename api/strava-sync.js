import { types as utilTypes } from 'node:util';

const TOKEN_FIELDS = Object.freeze([
    'access_token', 'refresh_token', 'expires_at', 'subject_id', 'granted_scopes'
]);
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
const LIST_FIELDS = Object.freeze(['operation', 'token']);
const ACTIVITY_FIELDS = Object.freeze(['operation', 'activity_id', 'token']);
const STREAMS_FIELDS = Object.freeze(['operation', 'activity_id', 'keys', 'token']);
const SUMMARY_FIELDS = Object.freeze([
    'id',
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
const DETAIL_FIELDS = Object.freeze([...SUMMARY_FIELDS, 'laps']);
const LAP_FIELDS = Object.freeze(['lap_index', 'elapsed_time', 'moving_time', 'distance']);
const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_ACTIVITY_ID_LENGTH = 32;
const MAX_LIST_RECORDS = 25;
const MAX_LAPS = 10_000;
const MAX_STREAM_POINTS = 200_000;
const MAX_LIST_OR_DETAIL_BYTES = 2 * 1024 * 1024;
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
const PROVIDER_ROOT = 'https://www.strava.com/api/v3';

function readOwnData(value, key) {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
        return undefined;
    }
    if (utilTypes.isProxy(value)) return undefined;
    try {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function exactOwnData(value, fields) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) {
        return null;
    }
    try {
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

function exactDenseArray(value, expected = null) {
    if (!Array.isArray(value) || utilTypes.isProxy(value)) return null;
    try {
        if (Object.getPrototypeOf(value) !== Array.prototype) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== value.length + 1
            || !keys.includes('length')
            || keys.some(key => key !== 'length' && !/^(?:0|[1-9]\d*)$/.test(String(key)))
        ) return null;
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result.push(descriptor.value);
        }
        if (expected && (
            result.length !== expected.length
            || result.some((entry, index) => entry !== expected[index])
        )) return null;
        return result;
    } catch {
        return null;
    }
}

function boundedString(value, maxLength) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && value.trim().length > 0;
}

function positiveDecimal(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
    return typeof value === 'string'
        && value.length <= MAX_ACTIVITY_ID_LENGTH
        && /^[1-9]\d*$/.test(value)
        ? value
        : null;
}

function normalizeToken(value) {
    const token = exactOwnData(value, TOKEN_FIELDS);
    const scopes = token ? exactDenseArray(token.granted_scopes, REQUIRED_SCOPES) : null;
    if (
        !token
        || !boundedString(token.access_token, MAX_TOKEN_LENGTH)
        || !boundedString(token.refresh_token, MAX_TOKEN_LENGTH)
        || !Number.isSafeInteger(token.expires_at)
        || token.expires_at <= 0
        || positiveDecimal(token.subject_id) !== token.subject_id
        || !scopes
    ) return null;
    return Object.freeze({ accessToken: token.access_token });
}

function contentType(req) {
    const headers = readOwnData(req, 'headers');
    const lower = readOwnData(headers, 'content-type');
    const canonical = readOwnData(headers, 'Content-Type');
    const value = lower === undefined ? canonical : lower;
    return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function normalizeRequest(req) {
    if (contentType(req) !== 'application/json') return null;
    const body = readOwnData(req, 'body');
    const operation = readOwnData(body, 'operation');
    const fields = operation === 'list'
        ? LIST_FIELDS
        : operation === 'detail'
            ? ACTIVITY_FIELDS
            : operation === 'streams'
                ? STREAMS_FIELDS
                : null;
    const input = fields ? exactOwnData(body, fields) : null;
    const token = input ? normalizeToken(input.token) : null;
    if (!input || !token) return null;
    if (operation === 'list') return Object.freeze({ operation, ...token });
    const activityId = positiveDecimal(input.activity_id);
    if (activityId === null || activityId !== input.activity_id) return null;
    if (operation === 'streams' && !exactDenseArray(input.keys, STREAM_KEYS)) return null;
    return Object.freeze({ operation, activityId, ...token });
}

function responseHeader(response, name) {
    try {
        const headers = response?.headers;
        if (!headers || typeof headers.get !== 'function') return null;
        return headers.get(name);
    } catch {
        return null;
    }
}

async function readProviderJson(response, maxBytes) {
    const type = responseHeader(response, 'content-type');
    const lengthRaw = responseHeader(response, 'content-length');
    if (typeof type !== 'string' || !/^application\/json(?:\s*;|$)/i.test(type.trim())) {
        throw new TypeError();
    }
    if (lengthRaw !== null) {
        if (typeof lengthRaw !== 'string' || !/^\d+$/.test(lengthRaw)) throw new TypeError();
        const length = Number(lengthRaw);
        if (!Number.isSafeInteger(length) || length > maxBytes) throw new RangeError();
    }
    const body = response?.body;
    if (!body || typeof body.getReader !== 'function') throw new TypeError();
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const result = await reader.read();
            if (!result || typeof result !== 'object' || typeof result.done !== 'boolean') {
                throw new TypeError();
            }
            if (result.done) break;
            if (!(result.value instanceof Uint8Array) || result.value.byteLength === 0) {
                throw new TypeError();
            }
            total += result.value.byteLength;
            if (total > maxBytes) {
                try { await reader.cancel(); } catch {}
                throw new RangeError();
            }
            chunks.push(result.value);
        }
    } finally {
        try { reader.releaseLock(); } catch {}
    }
    if (total === 0) throw new TypeError();
    const bytes = Buffer.concat(
        chunks.map(chunk => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
        total
    );
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(text);
}

function ordinaryRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) {
        return null;
    }
    try {
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null ? value : null;
    } catch {
        return null;
    }
}

function finiteNumberOrNull(value) {
    return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function reduceSummary(value, expectedId = null) {
    const record = ordinaryRecord(value);
    if (!record) return null;
    const id = positiveDecimal(readOwnData(record, 'id'));
    if (id === null || (expectedId !== null && id !== expectedId)) return null;
    const result = { id };
    for (const field of SUMMARY_FIELDS) {
        if (field === 'id' || !Object.hasOwn(record, field)) continue;
        const entry = readOwnData(record, field);
        if (
            (field === 'sport_type' || field === 'type')
            && !boundedString(entry, 128)
        ) return null;
        if (
            (field === 'start_date' || field === 'timezone')
            && !(entry === null || boundedString(entry, 256))
        ) return null;
        if (
            !['sport_type', 'type', 'start_date', 'timezone'].includes(field)
            && !finiteNumberOrNull(entry)
        ) return null;
        result[field] = entry;
    }
    return result;
}

function reduceLap(value) {
    const record = ordinaryRecord(value);
    if (!record) return null;
    const result = {};
    for (const field of LAP_FIELDS) {
        if (!Object.hasOwn(record, field)) continue;
        const entry = readOwnData(record, field);
        if (!finiteNumberOrNull(entry)) return null;
        if (field === 'lap_index' && entry !== null && !Number.isSafeInteger(entry)) return null;
        result[field] = entry;
    }
    return result;
}

function reduceDetail(value, expectedId) {
    const summary = reduceSummary(value, expectedId);
    if (!summary) return null;
    const record = ordinaryRecord(value);
    const result = {};
    for (const field of DETAIL_FIELDS) {
        if (field === 'laps' || !Object.hasOwn(summary, field)) continue;
        result[field] = summary[field];
    }
    if (Object.hasOwn(record, 'laps')) {
        if (record.laps === null) {
            result.laps = null;
        } else {
            const laps = exactDenseArray(record.laps);
            if (!laps || laps.length > MAX_LAPS) return null;
            const reduced = laps.map(reduceLap);
            if (reduced.some(lap => lap === null)) return null;
            result.laps = reduced;
        }
    }
    return result;
}

function validStreamValue(key, value) {
    if (value === null) return true;
    if (key === 'moving') return typeof value === 'boolean';
    if (key === 'latlng') {
        const tuple = exactDenseArray(value);
        return tuple !== null
            && tuple.length === 2
            && tuple.every(entry => typeof entry === 'number' && Number.isFinite(entry));
    }
    return typeof value === 'number' && Number.isFinite(value);
}

function reduceStreams(value) {
    const record = ordinaryRecord(value);
    if (!record) return null;
    const result = {};
    for (const key of STREAM_KEYS) {
        if (!Object.hasOwn(record, key)) continue;
        const stream = ordinaryRecord(readOwnData(record, key));
        if (!stream || !Object.hasOwn(stream, 'data')) return null;
        const data = exactDenseArray(readOwnData(stream, 'data'));
        if (
            !data
            || data.length > MAX_STREAM_POINTS
            || data.some(entry => !validStreamValue(key, entry))
        ) return null;
        result[key] = { data: key === 'latlng'
            ? data.map(entry => entry === null ? null : [...entry])
            : [...data] };
    }
    return result;
}

function reduceList(value) {
    const activities = exactDenseArray(value);
    if (!activities || activities.length > MAX_LIST_RECORDS) return null;
    const seen = new Set();
    const result = [];
    for (const activity of activities) {
        const reduced = reduceSummary(activity);
        if (!reduced || seen.has(reduced.id)) return null;
        seen.add(reduced.id);
        result.push(reduced);
    }
    return result;
}

function providerUrl(request) {
    if (request.operation === 'list') {
        return `${PROVIDER_ROOT}/athlete/activities?page=1&per_page=25`;
    }
    if (request.operation === 'detail') {
        return `${PROVIDER_ROOT}/activities/${request.activityId}?include_all_efforts=false`;
    }
    return `${PROVIDER_ROOT}/activities/${request.activityId}/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`;
}

function maxProviderBytes(operation) {
    return operation === 'streams' ? MAX_STREAM_BYTES : MAX_LIST_OR_DETAIL_BYTES;
}

function providerResponseStatus(response) {
    if (!response || (typeof response !== 'object' && typeof response !== 'function')) return null;
    if (utilTypes.isProxy(response)) return null;
    try {
        return typeof response.ok === 'boolean'
            && Number.isInteger(response.status)
            && response.status >= 100
            && response.status <= 599
            ? response.status
            : null;
    } catch {
        return null;
    }
}

function setFixedHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
}

function fixedFailure(res, request, status) {
    if (status === 401 || status === 403) {
        return res.status(401).json({ error: 'RECONNECT_REQUIRED' });
    }
    if (status === 429) return res.status(429).json({ error: 'TRY_LATER' });
    if (request.operation === 'list') {
        return res.status(502).json({ error: 'SYNC_LIST_FAILED' });
    }
    return res.status(200).json(request.operation === 'detail'
        ? { operation: 'detail', activity: null }
        : { operation: 'streams', streams: null });
}

function reducedEnvelope(request, reduced) {
    if (request.operation === 'list') {
        return { operation: 'list', activities: reduced };
    }
    if (request.operation === 'detail') {
        return { operation: 'detail', activity: reduced };
    }
    return { operation: 'streams', streams: reduced };
}

function sendReduced(res, request, reduced) {
    const envelope = reducedEnvelope(request, reduced);
    let bytes;
    try {
        bytes = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
    } catch {
        return fixedFailure(res, request, 0);
    }
    if (bytes > maxProviderBytes(request.operation)) {
        return fixedFailure(res, request, 0);
    }
    return res.status(200).json(envelope);
}

export default async function handler(req, res) {
    setFixedHeaders(res);
    if (readOwnData(req, 'method') !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }
    const request = normalizeRequest(req);
    if (!request) return res.status(400).json({ error: 'SYNC_REQUEST_INVALID' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response;
    try {
        try {
            response = await fetch(providerUrl(request), {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${request.accessToken}`
                },
                redirect: 'error',
                signal: controller.signal
            });
        } catch {
            return fixedFailure(res, request, 0);
        }
        const status = providerResponseStatus(response);
        if (status !== 200) {
            try { controller.abort(); } catch {}
            return fixedFailure(res, request, status);
        }

        let providerData;
        try {
            providerData = await readProviderJson(response, maxProviderBytes(request.operation));
        } catch {
            try { controller.abort(); } catch {}
            return fixedFailure(res, request, 0);
        }
        if (controller.signal.aborted) return fixedFailure(res, request, 0);
        const reduced = request.operation === 'list'
            ? reduceList(providerData)
            : request.operation === 'detail'
                ? reduceDetail(providerData, request.activityId)
                : reduceStreams(providerData);
        if (reduced === null) return fixedFailure(res, request, 0);
        return sendReduced(res, request, reduced);
    } finally {
        clearTimeout(timeout);
    }
}
