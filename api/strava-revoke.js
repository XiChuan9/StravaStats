import { types as utilTypes } from 'node:util';

import { logServerEvent, SERVER_API_EVENT } from './_shared.js';

const BODY_FIELDS = Object.freeze(['refresh_token']);
const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_TOKEN_LENGTH = 4_096;

function readOwnData(value, key) {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined;
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

function exactBody(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) {
        return null;
    }
    try {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.length !== 1 || keys[0] !== BODY_FIELDS[0]) return null;
        const descriptor = Object.getOwnPropertyDescriptor(value, BODY_FIELDS[0]);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
        const token = descriptor.value;
        return typeof token === 'string'
            && token.length > 0
            && token.length <= MAX_TOKEN_LENGTH
            && token.trim().length > 0
            ? token
            : null;
    } catch {
        return null;
    }
}

function contentType(req) {
    const headers = readOwnData(req, 'headers');
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

async function exactEmptyProviderResponse(response) {
    const headers = response?.headers;
    if (!headers || typeof headers.get !== 'function') return false;
    let type;
    let length;
    try {
        type = headers.get('content-type');
        length = headers.get('content-length');
    } catch {
        return false;
    }
    if (type !== null) return false;
    if (length !== null && length !== '0') return false;
    if (typeof response?.text !== 'function') return false;
    const text = await response.text();
    return text === '';
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
    if (contentType(req) !== 'application/json') {
        return res.status(400).json({ error: 'REVOKE_REQUEST_INVALID' });
    }
    const refreshToken = exactBody(readOwnData(req, 'body'));
    if (refreshToken === null) {
        return res.status(400).json({ error: 'REVOKE_REQUEST_INVALID' });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!boundedString(clientId, 128) || !boundedString(clientSecret, 512)) {
        return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
    }
    const authorization = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response;
    try {
        try {
            response = await fetch('https://www.strava.com/oauth/revoke', {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${authorization}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ token: refreshToken }).toString(),
                signal: controller.signal
            });
        } catch {
            logServerEvent(SERVER_API_EVENT.REVOKE_NETWORK_FAILED);
            return res.status(502).json({ error: 'REVOCATION_UNCONFIRMED' });
        }
        let confirmed = false;
        if (response?.ok === true && response.status === 200) {
            try {
                confirmed = await exactEmptyProviderResponse(response);
            } catch {
                confirmed = false;
            }
        }
        if (!confirmed) {
            logServerEvent(SERVER_API_EVENT.REVOKE_PROVIDER_REJECTED);
            return res.status(502).json({ error: 'REVOCATION_UNCONFIRMED' });
        }
        return res.status(200).json({ revoked: true });
    } finally {
        clearTimeout(timeout);
    }
}
