import {
    REPOSITORY_ERROR_CODE,
    RepositoryError
} from '../errors.js';

const SENSITIVE_KEYS = new Set([
    'access_token',
    'refresh_token',
    'authorization',
    'tokens',
    'client_secret'
]);

function responseInvalid(operation) {
    return new RepositoryError(
        REPOSITORY_ERROR_CODE.RESPONSE_INVALID,
        { operation }
    );
}

function defineSafeProperty(target, key, value) {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
    });
}

function cloneJsonValue(value, operation, active) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw responseInvalid(operation);
        return value;
    }
    if (typeof value !== 'object') throw responseInvalid(operation);

    try {
        if (active.has(value)) throw responseInvalid(operation);
        active.add(value);

        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw responseInvalid(operation);
            }

            const lengthDescriptor = Object.getOwnPropertyDescriptor(
                value,
                'length'
            );
            if (
                !lengthDescriptor
                || !Object.hasOwn(lengthDescriptor, 'value')
                || !Number.isSafeInteger(lengthDescriptor.value)
                || lengthDescriptor.value < 0
            ) {
                throw responseInvalid(operation);
            }

            const expectedKeys = new Set([
                ...Array.from(
                    { length: lengthDescriptor.value },
                    (_, index) => String(index)
                ),
                'length'
            ]);
            const keys = Reflect.ownKeys(value);
            if (
                keys.length !== expectedKeys.size
                || keys.some(key => (
                    typeof key !== 'string'
                    || !expectedKeys.has(key)
                ))
            ) {
                throw responseInvalid(operation);
            }

            const result = [];
            for (let index = 0; index < lengthDescriptor.value; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(
                    value,
                    String(index)
                );
                if (
                    !descriptor?.enumerable
                    || !Object.hasOwn(descriptor, 'value')
                ) {
                    throw responseInvalid(operation);
                }
                result.push(
                    cloneJsonValue(descriptor.value, operation, active)
                );
            }
            active.delete(value);
            return result;
        }

        if (Object.getPrototypeOf(value) !== Object.prototype) {
            throw responseInvalid(operation);
        }

        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (
                typeof key !== 'string'
                || SENSITIVE_KEYS.has(key.toLowerCase())
            ) {
                throw responseInvalid(operation);
            }

            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                throw responseInvalid(operation);
            }
            defineSafeProperty(
                result,
                key,
                cloneJsonValue(descriptor.value, operation, active)
            );
        }
        active.delete(value);
        return result;
    } catch (error) {
        active.delete(value);
        if (error instanceof RepositoryError) throw error;
        throw responseInvalid(operation);
    }
}

export function projectLegacyValue(value, operation) {
    return cloneJsonValue(value, operation, new Set());
}
