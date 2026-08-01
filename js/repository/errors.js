export const REPOSITORY_ERROR_CODE = Object.freeze({
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_READ_FAILED: 'TOKEN_READ_FAILED',
    TOKEN_ENCODING_FAILED: 'TOKEN_ENCODING_FAILED',
    TOKEN_WRITE_FAILED: 'TOKEN_WRITE_FAILED',
    NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
    PROVIDER_HTTP_ERROR: 'PROVIDER_HTTP_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    NOT_FOUND: 'NOT_FOUND',
    UNSUPPORTED_MODE: 'UNSUPPORTED_MODE',
    INVALID_REQUEST: 'INVALID_REQUEST',
    RESPONSE_INVALID: 'RESPONSE_INVALID'
});

export const REPOSITORY_SOURCE = Object.freeze({
    CACHE: 'cache',
    NETWORK: 'network',
    DEMO: 'demo',
    MIXED: 'mixed'
});

export const REPOSITORY_WARNING_CODE = Object.freeze({
    CACHE_READ_FAILED: 'CACHE_READ_FAILED',
    CACHE_WRITE_FAILED: 'CACHE_WRITE_FAILED',
    ITEM_FETCH_FAILED: 'ITEM_FETCH_FAILED'
});

const ERROR_MESSAGES = Object.freeze({
    [REPOSITORY_ERROR_CODE.UNAUTHENTICATED]: 'Authentication is required.',
    [REPOSITORY_ERROR_CODE.FORBIDDEN]: 'The request is not permitted.',
    [REPOSITORY_ERROR_CODE.TOKEN_INVALID]: 'Stored authentication data is invalid.',
    [REPOSITORY_ERROR_CODE.TOKEN_READ_FAILED]: 'Authentication data could not be read.',
    [REPOSITORY_ERROR_CODE.TOKEN_ENCODING_FAILED]: 'Authentication data could not be encoded.',
    [REPOSITORY_ERROR_CODE.TOKEN_WRITE_FAILED]: 'Refreshed authentication data could not be stored.',
    [REPOSITORY_ERROR_CODE.NETWORK_UNAVAILABLE]: 'The provider network is unavailable.',
    [REPOSITORY_ERROR_CODE.PROVIDER_HTTP_ERROR]: 'The provider request failed.',
    [REPOSITORY_ERROR_CODE.RATE_LIMITED]: 'The provider rate limit was reached.',
    [REPOSITORY_ERROR_CODE.NOT_FOUND]: 'The requested resource was not found.',
    [REPOSITORY_ERROR_CODE.UNSUPPORTED_MODE]: 'The requested repository mode is unsupported.',
    [REPOSITORY_ERROR_CODE.INVALID_REQUEST]: 'The repository request is invalid.',
    [REPOSITORY_ERROR_CODE.RESPONSE_INVALID]: 'The provider response is invalid.'
});

const ERROR_CODES = new Set(Object.values(REPOSITORY_ERROR_CODE));
const OPERATIONS = new Set([
    'listActivities',
    'getActivity',
    'getStreams',
    'getAthlete',
    'getZones',
    'getGears',
    'getGear'
]);
const DETAIL_KEYS = new Set([
    'operation',
    'retryable',
    'httpStatus',
    'retryAfterSeconds'
]);

function invalidDetails() {
    return {
        valid: false,
        operation: null,
        retryable: false,
        httpStatus: null,
        retryAfterSeconds: null
    };
}

function normalizeDetails(details) {
    if (details === undefined) {
        return {
            valid: true,
            operation: null,
            retryable: false,
            httpStatus: null,
            retryAfterSeconds: null
        };
    }

    try {
        if (
            details === null
            || typeof details !== 'object'
            || Array.isArray(details)
            || Object.getPrototypeOf(details) !== Object.prototype
        ) {
            return invalidDetails();
        }

        const keys = Reflect.ownKeys(details);
        if (keys.some(key => typeof key !== 'string' || !DETAIL_KEYS.has(key))) {
            return invalidDetails();
        }

        const normalized = {
            valid: true,
            operation: null,
            retryable: false,
            httpStatus: null,
            retryAfterSeconds: null
        };

        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(details, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return invalidDetails();
            }
            normalized[key] = descriptor.value;
        }

        if (
            normalized.operation !== null
            && !OPERATIONS.has(normalized.operation)
        ) {
            return invalidDetails();
        }
        if (typeof normalized.retryable !== 'boolean') {
            return invalidDetails();
        }
        if (
            normalized.httpStatus !== null
            && (
                !Number.isInteger(normalized.httpStatus)
                || normalized.httpStatus < 100
                || normalized.httpStatus > 599
            )
        ) {
            return invalidDetails();
        }
        if (
            normalized.retryAfterSeconds !== null
            && (
                !Number.isInteger(normalized.retryAfterSeconds)
                || normalized.retryAfterSeconds < 0
            )
        ) {
            return invalidDetails();
        }

        return normalized;
    } catch {
        return invalidDetails();
    }
}

export class RepositoryError extends Error {
    constructor(code, details) {
        const normalizedDetails = normalizeDetails(details);
        const normalizedCode = (
            ERROR_CODES.has(code)
            && normalizedDetails.valid
        )
            ? code
            : REPOSITORY_ERROR_CODE.INVALID_REQUEST;

        super(ERROR_MESSAGES[normalizedCode]);
        this.name = 'RepositoryError';
        this.code = normalizedCode;
        this.operation = normalizedCode === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            && (!ERROR_CODES.has(code) || !normalizedDetails.valid)
            ? null
            : normalizedDetails.operation;
        this.retryable = normalizedCode === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            && (!ERROR_CODES.has(code) || !normalizedDetails.valid)
            ? false
            : normalizedDetails.retryable;
        this.httpStatus = normalizedCode === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            && (!ERROR_CODES.has(code) || !normalizedDetails.valid)
            ? null
            : normalizedDetails.httpStatus;
        this.retryAfterSeconds = normalizedCode === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            && (!ERROR_CODES.has(code) || !normalizedDetails.valid)
            ? null
            : normalizedDetails.retryAfterSeconds;
        Object.freeze(this);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            operation: this.operation,
            retryable: this.retryable,
            httpStatus: this.httpStatus,
            retryAfterSeconds: this.retryAfterSeconds
        };
    }
}
