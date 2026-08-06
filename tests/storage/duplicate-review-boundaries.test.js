import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    evaluateDuplicateReviewPair,
    orderOpaqueActivityPair,
    validDuplicateReviewCandidate,
    validDuplicateReviewDecision
} from '../../js/storage/duplicate-review.js';

const INSTANT = '2026-08-06T00:00:00.000Z';
const TASK_BRIEF = readFileSync(
    new URL('../../docs/tasks/pr-20-duplicate-review.md', import.meta.url),
    'utf8'
);
const APPROVED_PATHS = Object.freeze([
    'docs/tasks/pr-20-duplicate-review.md',
    'docs/migrations/indexeddb-v2.md',
    'js/storage/constants.js',
    'js/storage/schema.js',
    'js/storage/migrations.js',
    'js/storage/database.js',
    'js/storage/transaction.js',
    'js/storage/import-store.js',
    'js/storage/duplicate-review.js',
    'js/import/state-machine.js',
    'js/import/import-service.js',
    'js/app/source-manager.js',
    'js/pages/source-manager/source-manager.js',
    'source-manager.html',
    'styles/source-manager.css',
    'tests/storage/indexeddb-v2-schema.test.js',
    'tests/storage/indexeddb-v2-boundaries.test.js',
    'tests/storage/indexeddb-v2-browser-smoke.html',
    'tests/storage/backup-manifest.test.js',
    'tests/storage/duplicate-review.test.js',
    'tests/storage/duplicate-review-transactions.test.js',
    'tests/storage/duplicate-review-boundaries.test.js',
    'tests/storage/duplicate-review-performance.test.js',
    'tests/import/import-state-machine.test.js',
    'tests/import/import-core.test.js',
    'tests/import/duplicate-review-import.test.js',
    'tests/source-manager/source-manager.test.js',
    'tests/source-manager/source-manager-boundaries.test.js',
    'tests/source-manager/source-manager-browser-smoke.html'
]);

function activity(overrides = {}) {
    return {
        id: 'opaque-left',
        sportCategory: 'run',
        startTimeUtc: INSTANT,
        distanceMeters: 1_000,
        movingTimeSeconds: 300,
        ...overrides
    };
}

function candidate(overrides = {}) {
    return {
        id: 'candidate-opaque',
        activityAId: 'activity-a',
        activityBId: 'activity-b',
        confidence: 'high',
        status: 'review_required',
        matcherVersion: 'duplicate-review@1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
        createdFromImportItemId: 'item-opaque',
        evidence: {
            matcherVersion: 'duplicate-review@1',
            sportCategory: 'run',
            timeDeltaSeconds: 0,
            distanceDeltaRatio: 0,
            movingDurationDeltaRatio: 0
        },
        ...overrides
    };
}

test('Task Brief freezes the literal 29-path hard maximum', () => {
    const section = TASK_BRIEF.match(
        /## A3 literal cumulative allowlist[\s\S]*?```text\n([\s\S]*?)\n```/
    );
    assert.ok(section);
    assert.deepEqual(section[1].split('\n'), APPROVED_PATHS);
    assert.equal(APPROVED_PATHS.length, 29);
    assert.doesNotMatch(section[1], /[*?\[\]{}]/);
});

test('hostile accessors fail closed without execution', () => {
    let calls = 0;
    const hostile = activity();
    Object.defineProperty(hostile, 'distanceMeters', {
        enumerable: true,
        get() {
            calls += 1;
            throw new Error('private payload');
        }
    });
    assert.equal(evaluateDuplicateReviewPair(activity(), hostile), null);
    assert.equal(calls, 0);
});

test('opaque IDs must be distinct strings and are never numerically normalized', () => {
    assert.deepEqual(orderOpaqueActivityPair('000', '0'), ['0', '000']);
    for (const value of ['', 0, -0, null, undefined, Number.MAX_SAFE_INTEGER]) {
        assert.equal(orderOpaqueActivityPair('safe', value), null);
    }
    assert.equal(orderOpaqueActivityPair('same', 'same'), null);
});

test('candidate validator rejects extra fields, malformed evidence, and reversed pairs', () => {
    assert.equal(validDuplicateReviewCandidate(candidate()), true);
    assert.equal(validDuplicateReviewCandidate(candidate({ activityAId: 'z' })), false);
    assert.equal(validDuplicateReviewCandidate(candidate({ extra: true })), false);
    assert.equal(validDuplicateReviewCandidate(candidate({
        evidence: { ...candidate().evidence, rawActivityId: 'forbidden' }
    })), false);
    assert.equal(validDuplicateReviewCandidate(candidate({
        evidence: { ...candidate().evidence, distanceDeltaRatio: Number.NaN }
    })), false);
});

test('decision validator accepts only the append-only exact record contract', () => {
    const value = {
        id: 'decision-opaque',
        candidateId: 'candidate-opaque',
        decision: 'confirmed_same',
        decidedAt: INSTANT,
        decisionVersion: 1
    };
    assert.equal(validDuplicateReviewDecision(value), true);
    assert.equal(validDuplicateReviewDecision({ ...value, decision: 'rejected' }), true);
    assert.equal(validDuplicateReviewDecision({ ...value, decision: 'later' }), false);
    assert.equal(validDuplicateReviewDecision({ ...value, fieldChoices: [] }), false);
    assert.equal(validDuplicateReviewDecision({ ...value, decisionVersion: '1' }), false);
});
