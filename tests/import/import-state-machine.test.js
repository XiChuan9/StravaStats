import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IMPORT_ERROR_CODE,
    IMPORT_ITEM_STATUS as I,
    IMPORT_JOB_STATUS as J,
    assertImportItemTransition,
    assertImportJobTransition
} from '../../js/import/index.js';
import { canCancelImportJob } from '../../js/import/state-machine.js';

test('ImportJob follows the frozen PRD state machine and fails closed', () => {
    assert.equal(assertImportJobTransition(J.QUEUED, J.VALIDATING), true);
    assert.equal(assertImportJobTransition(J.HASHING, J.DECODING), true);
    assert.equal(assertImportJobTransition(J.PERSISTING, J.CANCELLED), true);
    assert.equal(canCancelImportJob(J.PERSISTING), true);
    assert.equal(assertImportJobTransition(J.FAILED_DECODE, J.RETRYING), true);
    assert.throws(
        () => assertImportJobTransition(J.HASHING, J.CANCELLED),
        error => error.code === IMPORT_ERROR_CODE.INVALID_TRANSITION
            && !Object.hasOwn(error, 'cause')
    );
    assert.throws(
        () => assertImportJobTransition(J.COMPLETED, J.RETRYING),
        error => error.code === IMPORT_ERROR_CODE.INVALID_TRANSITION
    );
});

test('ImportItem permits review, isolation, duplicate, cancellation, and retry', () => {
    assert.equal(assertImportItemTransition(I.PERSISTING, I.REVIEW_REQUIRED), true);
    assert.equal(assertImportItemTransition(I.HASHING, I.SKIPPED_EXACT_DUPLICATE), true);
    assert.equal(assertImportItemTransition(I.DECODING, I.FAILED_DECODE), true);
    assert.equal(assertImportItemTransition(I.FAILED_STORAGE, I.RETRYING), true);
    assert.equal(assertImportItemTransition(I.MATCHING, I.CANCELLED), true);
    assert.equal(assertImportItemTransition(I.PERSISTING, I.CANCELLED), true);
    assert.throws(
        () => assertImportItemTransition(I.COMPLETED, I.CANCELLED),
        error => error.code === IMPORT_ERROR_CODE.INVALID_TRANSITION
    );
    assert.throws(
        () => assertImportItemTransition(I.REVIEW_REQUIRED, I.RETRYING),
        error => error.code === IMPORT_ERROR_CODE.INVALID_TRANSITION
    );
});
