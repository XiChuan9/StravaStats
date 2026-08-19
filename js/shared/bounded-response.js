function method(value, name) {
    try {
        let current = value;
        for (let depth = 0; current !== null && current !== undefined && depth < 32; depth += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function'
                    ? descriptor.value
                    : null;
            }
            current = Object.getPrototypeOf(current);
        }
    } catch {}
    return null;
}

function header(response, name) {
    try {
        const headers = response?.headers;
        const get = method(headers, 'get');
        if (!get) return null;
        const value = Reflect.apply(get, headers, [name]);
        return value === null || typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

function declaredLength(response, maxBytes) {
    const raw = header(response, 'content-length');
    if (raw === null) return null;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new TypeError();
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value > maxBytes) throw new RangeError();
    return value;
}

function assertJsonType(response) {
    const value = header(response, 'content-type');
    if (typeof value !== 'string' || !/^application\/json(?:\s*;|$)/i.test(value.trim())) {
        throw new TypeError();
    }
}

export async function readBoundedResponseText(response, {
    maxBytes,
    requireJson = false,
    claimBytes = () => true,
    allowEmpty = false
} = {}) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || typeof claimBytes !== 'function') {
        throw new TypeError();
    }
    if (requireJson) assertJsonType(response);
    declaredLength(response, maxBytes);

    const body = response?.body;
    const getReader = method(body, 'getReader');
    if (!getReader) throw new TypeError();
    const reader = Reflect.apply(getReader, body, []);
    const read = method(reader, 'read');
    const cancel = method(reader, 'cancel');
    const releaseLock = method(reader, 'releaseLock');
    if (!read || !cancel || !releaseLock) throw new TypeError();

    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const result = await Reflect.apply(read, reader, []);
            if (result === null || typeof result !== 'object' || typeof result.done !== 'boolean') {
                throw new TypeError();
            }
            if (result.done) break;
            if (!(result.value instanceof Uint8Array) || result.value.byteLength === 0) {
                throw new TypeError();
            }
            total += result.value.byteLength;
            if (total > maxBytes || claimBytes(result.value.byteLength) !== true) {
                try { await Reflect.apply(cancel, reader, []); } catch {}
                throw new RangeError();
            }
            chunks.push(result.value);
        }
    } finally {
        try { Reflect.apply(releaseLock, reader, []); } catch {}
    }
    if (!allowEmpty && total === 0) throw new TypeError();

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

export async function readBoundedResponseJson(response, options) {
    const result = await readBoundedResponseText(response, {
        ...options,
        requireJson: true,
        allowEmpty: false
    });
    return Object.freeze({
        value: JSON.parse(result.text),
        bytes: result.bytes
    });
}
