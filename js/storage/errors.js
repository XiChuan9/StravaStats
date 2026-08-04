import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION
} from './constants.js';

const ERROR_MESSAGES = Object.freeze({
    [STORAGE_ERROR_CODE.UNAVAILABLE]: 'The storage operation is unavailable.',
    [STORAGE_ERROR_CODE.INVALID_REQUEST]: 'The storage request is invalid.',
    [STORAGE_ERROR_CODE.DATA_INVALID]: 'The storage data is invalid.',
    [STORAGE_ERROR_CODE.OPEN_FAILED]: 'The storage database could not be opened.',
    [STORAGE_ERROR_CODE.OPEN_BLOCKED]: 'Opening the storage database was blocked.',
    [STORAGE_ERROR_CODE.CONNECTION_STALE]: 'The storage connection is stale.',
    [STORAGE_ERROR_CODE.VERSION_UNSUPPORTED]: 'The storage database version is unsupported.',
    [STORAGE_ERROR_CODE.SCHEMA_MISMATCH]: 'The storage schema does not match the expected schema.',
    [STORAGE_ERROR_CODE.MIGRATION_FAILED]: 'The storage migration failed.',
    [STORAGE_ERROR_CODE.MIGRATION_INTERRUPTED]: 'The storage migration was interrupted.',
    [STORAGE_ERROR_CODE.TRANSACTION_ABORTED]: 'The storage transaction was aborted.',
    [STORAGE_ERROR_CODE.QUOTA_EXCEEDED]: 'The storage quota was exceeded.',
    [STORAGE_ERROR_CODE.CONSTRAINT_VIOLATION]: 'The storage constraint was violated.',
    [STORAGE_ERROR_CODE.CONFLICT]: 'The storage record conflicts with existing data.',
    [STORAGE_ERROR_CODE.NOT_FOUND]: 'The storage record was not found.'
});

const ERROR_CODES = Object.freeze(Object.values(STORAGE_ERROR_CODE));
const OPERATIONS = Object.freeze(Object.values(STORAGE_OPERATION));
const DETAIL_KEYS = Object.freeze(['operation', 'retryable']);
const ISSUED_STORAGE_ERRORS = new WeakSet();

function includes(array, value) {
    return array.some(item => item === value);
}

function invalidDetails() {
    return {
        valid: false,
        operation: null,
        retryable: false
    };
}

function normalizeDetails(details) {
    if (details === undefined) {
        return {
            valid: true,
            operation: null,
            retryable: false
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
        if (
            keys.some(key => (
                typeof key !== 'string'
                || !includes(DETAIL_KEYS, key)
            ))
        ) {
            return invalidDetails();
        }

        const normalized = {
            valid: true,
            operation: null,
            retryable: false
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
            && !includes(OPERATIONS, normalized.operation)
        ) {
            return invalidDetails();
        }
        if (typeof normalized.retryable !== 'boolean') {
            return invalidDetails();
        }

        return normalized;
    } catch {
        return invalidDetails();
    }
}

export class StorageError extends Error {
    constructor(code, details) {
        const normalizedDetails = normalizeDetails(details);
        const codeIsValid = includes(ERROR_CODES, code);
        const valid = codeIsValid && normalizedDetails.valid;
        const normalizedCode = valid
            ? code
            : STORAGE_ERROR_CODE.INVALID_REQUEST;

        super(ERROR_MESSAGES[normalizedCode]);
        this.name = 'StorageError';
        this.code = normalizedCode;
        this.operation = valid ? normalizedDetails.operation : null;
        this.retryable = valid ? normalizedDetails.retryable : false;
        ISSUED_STORAGE_ERRORS.add(this);
        Object.freeze(this);
    }

    toJSON() {
        return Object.freeze({
            name: this.name,
            code: this.code,
            message: this.message,
            operation: this.operation,
            retryable: this.retryable
        });
    }
}

export function isStorageError(value) {
    return (
        value !== null
        && (typeof value === 'object' || typeof value === 'function')
        && ISSUED_STORAGE_ERRORS.has(value)
    );
}

export function storageError(code, operation, retryable = false) {
    return new StorageError(code, { operation, retryable });
}
