import { types as utilTypes } from 'node:util';

import { logServerEvent, SERVER_API_EVENT } from './_shared.js';
import {
    PROVIDER_LIMIT,
    ProviderBoundaryError,
    requestProviderJson,
    setNoStoreHeaders
} from './_provider-boundary.js';

const SOURCE_MANAGER_BODY_FIELDS = Object.freeze(['code', 'granted_scopes']);
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const REQUIRED_PROVIDER_SCOPE = REQUIRED_SCOPES.join(' ');
const MAX_CODE_LENGTH = 512;
const MAX_TOKEN_LENGTH = 4_096;

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
    return null;
}

function positiveDecimal(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
    return typeof value === 'string' && /^[1-9]\d*$/.test(value) && value.length <= 32
        ? value
        : null;
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
    const providerScope = readOwnData(value, 'scope');
    if (
        !boundedString(accessToken, MAX_TOKEN_LENGTH)
        || !boundedString(refreshToken, MAX_TOKEN_LENGTH)
        || !Number.isSafeInteger(expiresAt)
        || expiresAt <= 0
        || subjectId === null
        || providerScope !== REQUIRED_PROVIDER_SCOPE
    ) return null;
    const reduced = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        subject_id: subjectId
    };
    reduced.granted_scopes = [...REQUIRED_SCOPES];
    return reduced;
}

function setFixedHeaders(res) {
    setNoStoreHeaders(res);
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
    try {
        let data;
        try {
            data = await requestProviderJson('https://www.strava.com/oauth/token', {
                method: 'POST',
                body: params
            }, {
                maxBytes: PROVIDER_LIMIT.TOKEN_BYTES
            });
        } catch (error) {
            if (error instanceof ProviderBoundaryError && error.code === 'UPSTREAM_TIMEOUT') {
                logServerEvent(SERVER_API_EVENT.AUTH_NETWORK_FAILED);
                return res.status(504).json({ error: 'AUTH_TIMEOUT' });
            }
            if (error instanceof ProviderBoundaryError && error.code === 'UPSTREAM_REJECTED') {
                logServerEvent(SERVER_API_EVENT.AUTH_PROVIDER_REJECTED);
                return res.status(502).json({ error: 'AUTH_PROVIDER_REJECTED' });
            }
            if (error instanceof ProviderBoundaryError && error.code.startsWith('UPSTREAM_RESPONSE')) {
                logServerEvent(SERVER_API_EVENT.AUTH_RESPONSE_INVALID);
                return res.status(502).json({ error: 'AUTH_RESPONSE_INVALID' });
            }
            logServerEvent(SERVER_API_EVENT.AUTH_NETWORK_FAILED);
            return res.status(502).json({ error: 'AUTH_NETWORK_FAILED' });
        }
        const reduced = normalizeProviderToken(data, request.grantedScopes);
        if (!reduced) {
            logServerEvent(SERVER_API_EVENT.AUTH_RESPONSE_INVALID);
            return res.status(502).json({ error: 'AUTH_RESPONSE_INVALID' });
        }
        return res.status(200).json(reduced);
    } catch {
        logServerEvent(SERVER_API_EVENT.AUTH_NETWORK_FAILED);
        return res.status(502).json({ error: 'AUTH_NETWORK_FAILED' });
    }
}
