import { types as utilTypes } from 'node:util';

import { logServerEvent, SERVER_API_EVENT } from './_shared.js';

const LEGACY_BODY_FIELDS = Object.freeze(['code']);
const SOURCE_MANAGER_BODY_FIELDS = Object.freeze(['code', 'granted_scopes']);
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_CODE_LENGTH = 512;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_PROVIDER_BYTES = 65_536;

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
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    if (utilTypes.isProxy(value)) return null;
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

function exactScopes(value) {
    if (!Array.isArray(value) || utilTypes.isProxy(value)) return false;
    try {
        if (Object.getPrototypeOf(value) !== Array.prototype) return false;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== 3
            || !keys.includes('0')
            || !keys.includes('1')
            || !keys.includes('length')
        ) return false;
        return REQUIRED_SCOPES.every((scope, index) => {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            return descriptor?.enumerable
                && Object.hasOwn(descriptor, 'value')
                && descriptor.value === scope;
        });
    } catch {
        return false;
    }
}

function contentType(req) {
    const headers = readOwnData(req, 'headers');
    if (headers === null || typeof headers !== 'object' || utilTypes.isProxy(headers)) return null;
    const lower = readOwnData(headers, 'content-type');
    const canonical = readOwnData(headers, 'Content-Type');
    const value = lower === undefined ? canonical : lower;
    return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function boundedString(value, maxLength) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && value.trim().length > 0;
}

function normalizeRequest(req) {
    if (contentType(req) !== 'application/json') return null;
    const body = readOwnData(req, 'body');
    const sourceManager = exactOwnData(body, SOURCE_MANAGER_BODY_FIELDS);
    if (sourceManager) {
        if (
            !boundedString(sourceManager.code, MAX_CODE_LENGTH)
            || !exactScopes(sourceManager.granted_scopes)
        ) return null;
        return Object.freeze({
            code: sourceManager.code,
            grantedScopes: REQUIRED_SCOPES,
            sourceManager: true
        });
    }
    const legacy = exactOwnData(body, LEGACY_BODY_FIELDS);
    if (!legacy || !boundedString(legacy.code, MAX_CODE_LENGTH)) return null;
    return Object.freeze({
        code: legacy.code,
        grantedScopes: null,
        sourceManager: false
    });
}

function positiveDecimal(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
    return typeof value === 'string' && /^[1-9]\d*$/.test(value) && value.length <= 32
        ? value
        : null;
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

async function readProviderJson(response) {
    const type = responseHeader(response, 'content-type');
    const lengthRaw = responseHeader(response, 'content-length');
    if (typeof type !== 'string' || !/^application\/json(?:\s*;|$)/i.test(type.trim())) {
        throw new TypeError();
    }
    if (lengthRaw !== null) {
        if (typeof lengthRaw !== 'string' || !/^\d+$/.test(lengthRaw)) throw new TypeError();
        const length = Number(lengthRaw);
        if (!Number.isSafeInteger(length) || length > MAX_PROVIDER_BYTES) throw new TypeError();
    }
    if (typeof response?.text !== 'function') throw new TypeError();
    const text = await response.text();
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_PROVIDER_BYTES) {
        throw new TypeError();
    }
    return JSON.parse(text);
}

function normalizeProviderToken(value, grantedScopes) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) {
        return null;
    }
    const accessToken = readOwnData(value, 'access_token');
    const refreshToken = readOwnData(value, 'refresh_token');
    const expiresAt = readOwnData(value, 'expires_at');
    const athlete = readOwnData(value, 'athlete');
    const subjectId = positiveDecimal(readOwnData(athlete, 'id'));
    if (
        !boundedString(accessToken, MAX_TOKEN_LENGTH)
        || !boundedString(refreshToken, MAX_TOKEN_LENGTH)
        || !Number.isSafeInteger(expiresAt)
        || expiresAt <= 0
        || subjectId === null
    ) return null;
    const reduced = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        subject_id: subjectId
    };
    if (grantedScopes !== null) reduced.granted_scopes = [...grantedScopes];
    return reduced;
}

function setFixedHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
}

export default async function handler(req, res) {
    setFixedHeaders(res);
    if (readOwnData(req, 'method') !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }
    const request = normalizeRequest(req);
    if (!request) return res.status(400).json({ error: 'AUTH_REQUEST_INVALID' });

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!boundedString(clientId, 128) || !boundedString(clientSecret, 512)) {
        return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: request.code,
        grant_type: 'authorization_code'
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response;
    try {
        response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            body: params,
            signal: controller.signal
        });
    } catch {
        logServerEvent(SERVER_API_EVENT.AUTH_NETWORK_FAILED);
        return res.status(502).json({ error: 'AUTH_NETWORK_FAILED' });
    } finally {
        clearTimeout(timeout);
    }

    if (!response || response.ok !== true || response.status < 200 || response.status >= 300) {
        logServerEvent(SERVER_API_EVENT.AUTH_PROVIDER_REJECTED);
        return res.status(502).json({ error: 'AUTH_PROVIDER_REJECTED' });
    }

    let data;
    try {
        data = await readProviderJson(response);
    } catch {
        logServerEvent(SERVER_API_EVENT.AUTH_RESPONSE_INVALID);
        return res.status(502).json({ error: 'AUTH_RESPONSE_INVALID' });
    }
    const reduced = normalizeProviderToken(data, request.grantedScopes);
    if (!reduced) {
        logServerEvent(SERVER_API_EVENT.AUTH_RESPONSE_INVALID);
        return res.status(502).json({ error: 'AUTH_RESPONSE_INVALID' });
    }
    return res.status(200).json(reduced);
}
