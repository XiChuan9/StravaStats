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
    ZIP_INVALID_ENCODING: 'ZIP_INVALID_ENCODING',
    ZIP_INVALID: 'ZIP_INVALID',
    ZIP_UNSUPPORTED: 'ZIP_UNSUPPORTED',
    ZIP_ENCRYPTED: 'ZIP_ENCRYPTED',
    ZIP_MULTI_DISK: 'ZIP_MULTI_DISK',
    ZIP64_UNSUPPORTED: 'ZIP64_UNSUPPORTED',
    ZIP_DATA_DESCRIPTOR_UNSUPPORTED: 'ZIP_DATA_DESCRIPTOR_UNSUPPORTED',
    ZIP_PATH_INVALID: 'ZIP_PATH_INVALID',
    ZIP_DUPLICATE_ENTRY: 'ZIP_DUPLICATE_ENTRY',
    ZIP_SPECIAL_FILE: 'ZIP_SPECIAL_FILE',
    ZIP_NESTED_ARCHIVE: 'ZIP_NESTED_ARCHIVE',
    ZIP_LIMIT_EXCEEDED: 'ZIP_LIMIT_EXCEEDED',
    ZIP_BOMB_RISK: 'ZIP_BOMB_RISK',
    ZIP_CRC_MISMATCH: 'ZIP_CRC_MISMATCH',
    ZIP_ACTIVITIES_CSV_MISSING: 'ZIP_ACTIVITIES_CSV_MISSING',
    ZIP_ACTIVITIES_CSV_DUPLICATE: 'ZIP_ACTIVITIES_CSV_DUPLICATE',
    ZIP_DECOMPRESSION_FAILED: 'ZIP_DECOMPRESSION_FAILED',
    ZIP_TIME_BUDGET_EXCEEDED: 'ZIP_TIME_BUDGET_EXCEEDED',
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
    [IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING]: 'The ZIP transport encoding is invalid.',
    [IMPORT_ERROR_CODE.ZIP_INVALID]: 'The ZIP structure is invalid.',
    [IMPORT_ERROR_CODE.ZIP_UNSUPPORTED]: 'The ZIP uses an unsupported feature.',
    [IMPORT_ERROR_CODE.ZIP_ENCRYPTED]: 'Encrypted ZIP entries are unsupported.',
    [IMPORT_ERROR_CODE.ZIP_MULTI_DISK]: 'Multi-disk ZIP archives are unsupported.',
    [IMPORT_ERROR_CODE.ZIP64_UNSUPPORTED]: 'ZIP64 archives are unsupported.',
    [IMPORT_ERROR_CODE.ZIP_DATA_DESCRIPTOR_UNSUPPORTED]: 'ZIP data descriptors are unsupported.',
    [IMPORT_ERROR_CODE.ZIP_PATH_INVALID]: 'A ZIP entry path is invalid.',
    [IMPORT_ERROR_CODE.ZIP_DUPLICATE_ENTRY]: 'The ZIP contains duplicate entry names.',
    [IMPORT_ERROR_CODE.ZIP_SPECIAL_FILE]: 'The ZIP contains a special file entry.',
    [IMPORT_ERROR_CODE.ZIP_NESTED_ARCHIVE]: 'Nested archives are unsupported.',
    [IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED]: 'The ZIP exceeds an archive limit.',
    [IMPORT_ERROR_CODE.ZIP_BOMB_RISK]: 'The ZIP exceeds a safe expansion ratio.',
    [IMPORT_ERROR_CODE.ZIP_CRC_MISMATCH]: 'A ZIP entry checksum is invalid.',
    [IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_MISSING]: 'The ZIP is missing the required activities.csv.',
    [IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_DUPLICATE]: 'The ZIP contains more than one activities.csv.',
    [IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED]: 'A ZIP entry could not be decompressed.',
    [IMPORT_ERROR_CODE.ZIP_TIME_BUDGET_EXCEEDED]: 'ZIP processing exceeded its time budget.',
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
