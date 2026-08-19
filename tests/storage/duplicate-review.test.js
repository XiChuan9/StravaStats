import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DUPLICATE_REVIEW_MATCHER_VERSION,
    compareDuplicateReviewMatches,
    evaluateDuplicateReviewPair,
    orderOpaqueActivityPair
} from '../../js/storage/duplicate-review.js';

const START = '2026-08-06T00:00:00.000Z';

function activity(overrides = {}) {
    return {
        id: 'opaque-left',
        sportCategory: 'run',
        startTimeUtc: START,
        distanceMeters: 10_000,
        movingTimeSeconds: 3_000,
        ...overrides
    };
}

test('high gates are inclusive and evidence is frozen and redacted', () => {
    const result = evaluateDuplicateReviewPair(
        activity(),
        activity({
            id: 'opaque-right',
            startTimeUtc: '2026-08-06T00:00:30.000Z',
            distanceMeters: 9_900,
            movingTimeSeconds: 2_970
        })
    );

    assert.deepEqual(result, {
        confidence: 'high',
        evidence: {
            matcherVersion: DUPLICATE_REVIEW_MATCHER_VERSION,
            sportCategory: 'run',
            timeDeltaSeconds: 30,
            distanceDeltaRatio: 0.01,
            movingDurationDeltaRatio: 0.01
        }
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.evidence), true);
    assert.doesNotMatch(JSON.stringify(result), /opaque-left|opaque-right/);
});

test('possible gates are inclusive and high requires every tight gate', () => {
    const result = evaluateDuplicateReviewPair(
        activity(),
        activity({
            id: 'opaque-right',
            startTimeUtc: '2026-08-06T00:02:00.000Z',
            distanceMeters: 9_800,
            movingTimeSeconds: 2_910
        })
    );

    assert.equal(result.confidence, 'possible');
    assert.equal(result.evidence.timeDeltaSeconds, 120);
    assert.equal(result.evidence.distanceDeltaRatio, 0.02);
    assert.equal(result.evidence.movingDurationDeltaRatio, 0.03);
    assert.equal(evaluateDuplicateReviewPair(
        activity(),
        activity({
            id: 'outside',
            startTimeUtc: '2026-08-06T00:02:00.001Z',
            distanceMeters: 9_800,
            movingTimeSeconds: 2_910
        })
    ), null);
});

test('symmetric max-denominator handles true zero without treating missing as zero', () => {
    const bothZero = evaluateDuplicateReviewPair(
        activity({ distanceMeters: 0, movingTimeSeconds: 0 }),
        activity({
            id: 'zero-right',
            distanceMeters: 0,
            movingTimeSeconds: 0
        })
    );
    assert.equal(bothZero.confidence, 'high');
    assert.equal(bothZero.evidence.distanceDeltaRatio, 0);
    assert.equal(bothZero.evidence.movingDurationDeltaRatio, 0);

    assert.equal(evaluateDuplicateReviewPair(
        activity({ distanceMeters: 0 }),
        activity({ id: 'positive', distanceMeters: 1 })
    ), null);

    for (const value of [undefined, null, Number.NaN, Infinity, -1]) {
        const right = activity({ id: 'ineligible', distanceMeters: value });
        if (value === undefined) delete right.distanceMeters;
        assert.equal(evaluateDuplicateReviewPair(activity(), right), null);
    }
});

test('cross-sport and outside-ratio pairs never become candidates', () => {
    assert.equal(evaluateDuplicateReviewPair(
        activity(),
        activity({ id: 'ride', sportCategory: 'ride' })
    ), null);
    assert.equal(evaluateDuplicateReviewPair(
        activity(),
        activity({ id: 'distance-outside', distanceMeters: 9_799.99 })
    ), null);
    assert.equal(evaluateDuplicateReviewPair(
        activity(),
        activity({ id: 'duration-outside', movingTimeSeconds: 2_909.99 })
    ), null);
});

test('opaque pair ordering and candidate ranking use code-unit order only', () => {
    assert.deepEqual(orderOpaqueActivityPair('10', '2'), ['10', '2']);
    assert.deepEqual(orderOpaqueActivityPair('2', '10'), ['10', '2']);
    assert.deepEqual(orderOpaqueActivityPair('A', 'a'), ['A', 'a']);

    const high = {
        confidence: 'high',
        activityAId: 'z',
        activityBId: 'a',
        evidence: { timeDeltaSeconds: 30 }
    };
    const possible = {
        confidence: 'possible',
        activityAId: '0',
        activityBId: '1',
        evidence: { timeDeltaSeconds: 0 }
    };
    assert.ok(compareDuplicateReviewMatches(high, possible) < 0);
    assert.ok(compareDuplicateReviewMatches(
        { ...high, activityAId: '10', activityBId: '9' },
        { ...high, activityAId: '2', activityBId: '8' }
    ) < 0);
});
