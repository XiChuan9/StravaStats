export function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

export function opaqueString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

export function ownDataValues(value, fields, allowSubset = false) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string' || !fields.includes(key))
            || (!allowSubset && !sameArray(
                keys.slice().sort(),
                fields.slice().sort()
            ))
        ) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

export function denseArraySnapshot(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            || keys.length !== value.length + 1
        ) return null;
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

export function cloneJsonSafe(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('unsafe');
        return value;
    }
    if (typeof value !== 'object' || ancestors.has(value)) {
        throw new TypeError('unsafe');
    }
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw new TypeError('unsafe');
            }
            const items = denseArraySnapshot(value);
            if (!items) throw new TypeError('unsafe');
            return items.map(item => cloneJsonSafe(item, ancestors));
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError('unsafe');
        }
        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') throw new TypeError('unsafe');
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError('unsafe');
            }
            Object.defineProperty(result, key, {
                value: cloneJsonSafe(descriptor.value, ancestors),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
        return result;
    } finally {
        ancestors.delete(value);
    }
}

export function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && Object.hasOwn(descriptor, 'value')) {
            deepFreeze(descriptor.value);
        }
    }
    return Object.freeze(value);
}

export function frozenClone(value) {
    return deepFreeze(cloneJsonSafe(value));
}

export function findDataMethod(value, name) {
    try {
        let current = value;
        for (let depth = 0; current !== null && depth < 32; depth += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value')
                    && typeof descriptor.value === 'function'
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
