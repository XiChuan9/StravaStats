export const IMPORT_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_TRANSITION: 'INVALID_TRANSITION',
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    FILE_EMPTY: 'FILE_EMPTY',
    FILE_CORRUPTED: 'FILE_CORRUPTED',
    HASH_FAILED: 'HASH_FAILED',
    HASH_COLLISION: 'HASH_COLLISION',
    CSV_INVALID_ENCODING: 'CSV_INVALID_ENCODING',
    CSV_INVALID_CHARACTER: 'CSV_INVALID_CHARACTER',
    CSV_TOO_LARGE: 'CSV_TOO_LARGE',
    CSV_TOO_MANY_ROWS: 'CSV_TOO_MANY_ROWS',
    CSV_TOO_MANY_COLUMNS: 'CSV_TOO_MANY_COLUMNS',
    CSV_FIELD_TOO_LARGE: 'CSV_FIELD_TOO_LARGE',
    CSV_ROW_TOO_LARGE: 'CSV_ROW_TOO_LARGE',
    CSV_MALFORMED: 'CSV_MALFORMED',
    CSV_HEADER_INVALID: 'CSV_HEADER_INVALID',
    CSV_COLUMN_MISMATCH: 'CSV_COLUMN_MISMATCH',
    CSV_ACTIVITY_ID_INVALID: 'CSV_ACTIVITY_ID_INVALID',
    CSV_DATE_INVALID: 'CSV_DATE_INVALID',
    CSV_NUMBER_INVALID: 'CSV_NUMBER_INVALID',
    CSV_UNIT_INVALID: 'CSV_UNIT_INVALID',
    EXACT_IDENTITY_CONFLICT: 'EXACT_IDENTITY_CONFLICT',
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
    [IMPORT_ERROR_CODE.CSV_INVALID_ENCODING]: 'The CSV encoding is invalid.',
    [IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER]: 'The CSV contains an unsupported character.',
    [IMPORT_ERROR_CODE.CSV_TOO_LARGE]: 'The CSV exceeds the byte limit.',
    [IMPORT_ERROR_CODE.CSV_TOO_MANY_ROWS]: 'The CSV exceeds the row limit.',
    [IMPORT_ERROR_CODE.CSV_TOO_MANY_COLUMNS]: 'The CSV exceeds the column limit.',
    [IMPORT_ERROR_CODE.CSV_FIELD_TOO_LARGE]: 'A CSV field exceeds the byte limit.',
    [IMPORT_ERROR_CODE.CSV_ROW_TOO_LARGE]: 'A CSV row exceeds the byte limit.',
    [IMPORT_ERROR_CODE.CSV_MALFORMED]: 'The CSV structure is invalid.',
    [IMPORT_ERROR_CODE.CSV_HEADER_INVALID]: 'The CSV header is invalid.',
    [IMPORT_ERROR_CODE.CSV_COLUMN_MISMATCH]: 'A CSV row has an invalid column count.',
    [IMPORT_ERROR_CODE.CSV_ACTIVITY_ID_INVALID]: 'The CSV activity identity is invalid.',
    [IMPORT_ERROR_CODE.CSV_DATE_INVALID]: 'The CSV activity date is invalid.',
    [IMPORT_ERROR_CODE.CSV_NUMBER_INVALID]: 'A CSV numeric value is invalid.',
    [IMPORT_ERROR_CODE.CSV_UNIT_INVALID]: 'A CSV numeric value contains an unsupported unit.',
    [IMPORT_ERROR_CODE.EXACT_IDENTITY_CONFLICT]: 'The exact activity identity conflicts with stored data.',
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
