import { IMPORT_ERROR_CODE, importError } from './errors.js';

export const IMPORT_JOB_STATUS = Object.freeze({
    QUEUED: 'queued',
    VALIDATING: 'validating',
    HASHING: 'hashing',
    DECODING: 'decoding',
    NORMALIZING: 'normalizing',
    MATCHING: 'matching',
    PERSISTING: 'persisting',
    ANALYZING: 'analyzing',
    COMPLETED: 'completed',
    COMPLETED_WITH_WARNINGS: 'completed_with_warnings',
    FAILED_VALIDATION: 'failed_validation',
    FAILED_DECODE: 'failed_decode',
    FAILED_STORAGE: 'failed_storage',
    RETRYING: 'retrying',
    CANCELLED: 'cancelled'
});

export const IMPORT_ITEM_STATUS = Object.freeze({
    QUEUED: 'queued',
    VALIDATING: 'validating',
    HASHING: 'hashing',
    DECODING: 'decoding',
    NORMALIZING: 'normalizing',
    MATCHING: 'matching',
    PERSISTING: 'persisting',
    COMPLETED: 'completed',
    SKIPPED_EXACT_DUPLICATE: 'skipped_exact_duplicate',
    FAILED_VALIDATION: 'failed_validation',
    FAILED_DECODE: 'failed_decode',
    FAILED_STORAGE: 'failed_storage',
    RETRYING: 'retrying',
    CANCELLED: 'cancelled'
});

const J = IMPORT_JOB_STATUS;
const I = IMPORT_ITEM_STATUS;
const JOB_TRANSITIONS = Object.freeze({
    [J.QUEUED]: Object.freeze([J.VALIDATING, J.CANCELLED]),
    [J.VALIDATING]: Object.freeze([J.HASHING, J.FAILED_VALIDATION, J.CANCELLED]),
    [J.HASHING]: Object.freeze([J.DECODING]),
    [J.DECODING]: Object.freeze([J.NORMALIZING, J.FAILED_DECODE, J.CANCELLED]),
    [J.NORMALIZING]: Object.freeze([J.MATCHING, J.CANCELLED]),
    [J.MATCHING]: Object.freeze([J.PERSISTING, J.CANCELLED]),
    [J.PERSISTING]: Object.freeze([J.ANALYZING, J.FAILED_STORAGE]),
    [J.ANALYZING]: Object.freeze([J.COMPLETED, J.COMPLETED_WITH_WARNINGS]),
    [J.FAILED_VALIDATION]: Object.freeze([J.RETRYING]),
    [J.FAILED_DECODE]: Object.freeze([J.RETRYING]),
    [J.FAILED_STORAGE]: Object.freeze([J.RETRYING]),
    [J.RETRYING]: Object.freeze([J.VALIDATING]),
    [J.COMPLETED]: Object.freeze([]),
    [J.COMPLETED_WITH_WARNINGS]: Object.freeze([]),
    [J.CANCELLED]: Object.freeze([])
});

const ITEM_TRANSITIONS = Object.freeze({
    [I.QUEUED]: Object.freeze([I.VALIDATING, I.CANCELLED]),
    [I.VALIDATING]: Object.freeze([I.HASHING, I.FAILED_VALIDATION, I.CANCELLED]),
    [I.HASHING]: Object.freeze([
        I.DECODING,
        I.SKIPPED_EXACT_DUPLICATE,
        I.FAILED_VALIDATION,
        I.FAILED_STORAGE,
        I.RETRYING,
        I.CANCELLED
    ]),
    [I.DECODING]: Object.freeze([
        I.NORMALIZING,
        I.FAILED_DECODE,
        I.RETRYING,
        I.CANCELLED
    ]),
    [I.NORMALIZING]: Object.freeze([
        I.MATCHING,
        I.FAILED_VALIDATION,
        I.RETRYING,
        I.CANCELLED
    ]),
    [I.MATCHING]: Object.freeze([I.PERSISTING, I.RETRYING, I.CANCELLED]),
    [I.PERSISTING]: Object.freeze([
        I.COMPLETED,
        I.SKIPPED_EXACT_DUPLICATE,
        I.FAILED_STORAGE,
        I.RETRYING
    ]),
    [I.FAILED_VALIDATION]: Object.freeze([I.RETRYING]),
    [I.FAILED_DECODE]: Object.freeze([I.RETRYING]),
    [I.FAILED_STORAGE]: Object.freeze([I.RETRYING]),
    [I.RETRYING]: Object.freeze([I.VALIDATING]),
    [I.COMPLETED]: Object.freeze([]),
    [I.SKIPPED_EXACT_DUPLICATE]: Object.freeze([]),
    [I.CANCELLED]: Object.freeze([])
});

function assertTransition(table, current, next) {
    if (!Object.hasOwn(table, current) || !table[current].includes(next)) {
        throw importError(IMPORT_ERROR_CODE.INVALID_TRANSITION);
    }
    return true;
}

export function assertImportJobTransition(current, next) {
    return assertTransition(JOB_TRANSITIONS, current, next);
}

export function assertImportItemTransition(current, next) {
    return assertTransition(ITEM_TRANSITIONS, current, next);
}

export function canCancelImportJob(status) {
    return [J.QUEUED, J.VALIDATING, J.DECODING, J.NORMALIZING, J.MATCHING]
        .includes(status);
}

export function isTerminalImportItem(status) {
    return [
        I.COMPLETED,
        I.SKIPPED_EXACT_DUPLICATE,
        I.FAILED_VALIDATION,
        I.FAILED_DECODE,
        I.FAILED_STORAGE,
        I.CANCELLED
    ].includes(status);
}
