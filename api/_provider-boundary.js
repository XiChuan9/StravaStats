import { types as utilTypes } from 'node:util';

export const PROVIDER_LIMIT = Object.freeze({
    TIMEOUT_MS: 12_000,
    TOKEN_BYTES: 65_536,
    ACTIVITY_BYTES: 2 * 1024 * 1024,
    METADATA_BYTES: 1024 * 1024,
    STREAM_BYTES: 16 * 1024 * 1024,
    ACTIVITY_PAGE_SIZE: 25,
    STREAM_POINTS: 200_000
});

export class ProviderBoundaryError extends Error {
    constructor(code, status) {
        super(code);
        this.name = 'ProviderBoundaryError';
        this.code = code;
        this.status = status;
        Object.freeze(this);
    }
}

function boundaryError(code, status) {
    return new ProviderBoundaryError(code, status);
}

function responseHeader(response, name) {
    try {
        const value = response?.headers?.get?.(name);
        return value === null || typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

function providerStatus(response) {
    try {
        return response?.ok === true
            && Number.isInteger(response.status)
            && response.status >= 200
            && response.status < 300;
    } catch {
        return false;
    }
}

function safeFailureStatus(response) {
    const status = Number.isInteger(response?.status) ? response.status : null;
    return [401, 403, 404, 429].includes(status) ? status : 502;
}

export function setNoStoreHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
}

export async function readProviderJson(response, maxBytes) {
    const type = responseHeader(response, 'content-type');
    const lengthRaw = responseHeader(response, 'content-length');
    if (response?.redirected === true) throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
    if (typeof type !== 'string' || !/^application\/json(?:\s*;|$)/i.test(type.trim())) {
        throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
    }
    if (lengthRaw !== null) {
        if (typeof lengthRaw !== 'string' || !/^\d+$/.test(lengthRaw)) {
            throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
        }
        const length = Number(lengthRaw);
        if (!Number.isSafeInteger(length) || length > maxBytes) {
            throw boundaryError('UPSTREAM_RESPONSE_TOO_LARGE', 502);
        }
    }

    const body = response?.body;
    if (!body || typeof body.getReader !== 'function') {
        throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
    }
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const result = await reader.read();
            if (!result || typeof result !== 'object' || typeof result.done !== 'boolean') {
                throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
            }
            if (result.done) break;
            if (!(result.value instanceof Uint8Array) || result.value.byteLength === 0) {
                throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
            }
            total += result.value.byteLength;
            if (total > maxBytes) {
                try { await reader.cancel(); } catch {}
                throw boundaryError('UPSTREAM_RESPONSE_TOO_LARGE', 502);
            }
            chunks.push(result.value);
        }
    } finally {
        try { reader.releaseLock(); } catch {}
    }
    if (total === 0) throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
    try {
        const bytes = Buffer.concat(
            chunks.map(chunk => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
            total
        );
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
        if (error instanceof ProviderBoundaryError) throw error;
        throw boundaryError('UPSTREAM_RESPONSE_INVALID', 502);
    }
}

export async function requestProviderJson(url, init, {
    maxBytes,
    timeoutMs = PROVIDER_LIMIT.TIMEOUT_MS
} = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    try {
        let response;
        try {
            response = await fetch(url, {
                ...init,
                redirect: 'error',
                signal: controller.signal
            });
        } catch {
            throw boundaryError(
                timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_FAILED',
                timedOut ? 504 : 502
            );
        }
        if (!providerStatus(response)) {
            throw boundaryError('UPSTREAM_REJECTED', safeFailureStatus(response));
        }
        try {
            return await readProviderJson(response, maxBytes);
        } catch (error) {
            if (timedOut) throw boundaryError('UPSTREAM_TIMEOUT', 504);
            throw error;
        }
    } finally {
        clearTimeout(timer);
    }
}

export function exactQuery(query, fields) {
    try {
        if (
            query === null
            || typeof query !== 'object'
            || Array.isArray(query)
            || utilTypes.isProxy(query)
        ) return null;
        const keys = Reflect.ownKeys(query);
        if (
            keys.length !== fields.length
            || keys.some(key => typeof key !== 'string' || !fields.includes(key))
        ) return null;
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(query, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            if (typeof descriptor.value !== 'string') return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

export function boundedOpaqueId(value, maxLength = 128) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && value.trim().length > 0;
}

export function providerErrorStatus(error) {
    return error instanceof ProviderBoundaryError ? error.status : 502;
}
