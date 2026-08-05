export const IMPORT_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_TRANSITION: 'INVALID_TRANSITION',
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    FILE_EMPTY: 'FILE_EMPTY',
    FILE_CORRUPTED: 'FILE_CORRUPTED',
    HASH_FAILED: 'HASH_FAILED',
    HASH_COLLISION: 'HASH_COLLISION',
    DECODER_FAILED: 'DECODER_FAILED',
    NORMALIZATION_FAILED: 'NORMALIZATION_FAILED',
    STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    WORKER_CRASHED: 'WORKER_CRASHED',
    IMPORT_CANCELLED: 'IMPORT_CANCELLED',
    NOT_FOUND: 'NOT_FOUND',
    RETRY_NOT_ALLOWED: 'RETRY_NOT_ALLOWED'
});

const MESSAGES = Object.freeze({
    [IMPORT_ERROR_CODE.INVALID_REQUEST]: 'The import request is invalid.',
    [IMPORT_ERROR_CODE.INVALID_TRANSITION]: 'The import state transition is invalid.',
    [IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT]: 'The artifact format is unsupported.',
    [IMPORT_ERROR_CODE.FILE_EMPTY]: 'The artifact is empty.',
    [IMPORT_ERROR_CODE.FILE_CORRUPTED]: 'The artifact is invalid.',
    [IMPORT_ERROR_CODE.HASH_FAILED]: 'The artifact hash could not be computed.',
    [IMPORT_ERROR_CODE.HASH_COLLISION]: 'The artifact hash conflicts with different content.',
    [IMPORT_ERROR_CODE.DECODER_FAILED]: 'The artifact could not be decoded.',
    [IMPORT_ERROR_CODE.NORMALIZATION_FAILED]: 'The decoded activity is invalid.',
    [IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE]: 'The import could not be stored.',
    [IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED]: 'The storage quota was exceeded.',
    [IMPORT_ERROR_CODE.WORKER_CRASHED]: 'The import worker stopped unexpectedly.',
    [IMPORT_ERROR_CODE.IMPORT_CANCELLED]: 'The import was cancelled.',
    [IMPORT_ERROR_CODE.NOT_FOUND]: 'The import record was not found.',
    [IMPORT_ERROR_CODE.RETRY_NOT_ALLOWED]: 'The import item cannot be retried.'
});
const CODES = Object.freeze(Object.values(IMPORT_ERROR_CODE));

export class ImportError extends Error {
    constructor(code, retryable = false, stage = null) {
        const valid = CODES.includes(code)
            && typeof retryable === 'boolean'
            && (stage === null || (typeof stage === 'string' && stage.length > 0));
        const safeCode = valid ? code : IMPORT_ERROR_CODE.INVALID_REQUEST;
        super(MESSAGES[safeCode]);
        this.name = 'ImportError';
        this.code = safeCode;
        this.retryable = valid ? retryable : false;
        this.stage = valid ? stage : null;
        Object.freeze(this);
    }

    toJSON() {
        return Object.freeze({
            name: this.name,
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            stage: this.stage
        });
    }
}

export function importError(code, retryable = false, stage = null) {
    return new ImportError(code, retryable, stage);
}
