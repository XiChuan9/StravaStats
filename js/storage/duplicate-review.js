export const DUPLICATE_REVIEW_MATCHER_VERSION = 'duplicate-review@1';
export const DUPLICATE_REVIEW_DECISION_VERSION = 1;
export const DUPLICATE_REVIEW_MAX_CANDIDATES = 20;

const CANDIDATE_FIELDS = Object.freeze([
    'id',
    'activityAId',
    'activityBId',
    'confidence',
    'status',
    'matcherVersion',
    'createdAt',
    'updatedAt',
    'createdFromImportItemId',
    'evidence'
]);

const DECISION_FIELDS = Object.freeze([
    'id',
    'candidateId',
    'decision',
    'decidedAt',
    'decisionVersion'
]);

const EVIDENCE_FIELDS = Object.freeze([
    'matcherVersion',
    'sportCategory',
    'timeDeltaSeconds',
    'distanceDeltaRatio',
    'movingDurationDeltaRatio'
]);

const ACTIVITY_FIELDS = Object.freeze([
    'id',
    'sportCategory',
    'startTimeUtc',
    'distanceMeters',
    'movingTimeSeconds'
]);

const CANDIDATE_STATUSES = Object.freeze([
    'review_required',
    'confirmed_same',
    'rejected'
]);

const DECISIONS = Object.freeze(['confirmed_same', 'rejected']);

function sameStrings(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ownExactValues(value, fields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || !sameStrings(keys.slice().sort(), fields.slice().sort())
        ) {
            return null;
        }
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function ownSelectedValues(value, fields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function opaqueString(value) {
    return typeof value === 'string' && value.length > 0;
}

function strictUtcInstant(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) {
        return false;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function finiteNonNegative(value) {
    return typeof value === 'number'
        && Number.isFinite(value)
        && value >= 0;
}

function codeUnitCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function ratio(left, right) {
    if (left === 0 && right === 0) return 0;
    return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right));
}

function activityFacts(value) {
    const facts = ownSelectedValues(value, ACTIVITY_FIELDS);
    if (
        !facts
        || !opaqueString(facts.id)
        || !opaqueString(facts.sportCategory)
        || !strictUtcInstant(facts.startTimeUtc)
        || !finiteNonNegative(facts.distanceMeters)
        || !finiteNonNegative(facts.movingTimeSeconds)
    ) {
        return null;
    }
    return facts;
}

function confidenceFor(evidence) {
    const high = evidence.timeDeltaSeconds <= 30
        && evidence.distanceDeltaRatio <= 0.01
        && evidence.movingDurationDeltaRatio <= 0.01;
    if (high) return 'high';
    const possible = evidence.timeDeltaSeconds <= 120
        && evidence.distanceDeltaRatio <= 0.02
        && evidence.movingDurationDeltaRatio <= 0.03;
    return possible ? 'possible' : null;
}

export function orderOpaqueActivityPair(left, right) {
    if (!opaqueString(left) || !opaqueString(right) || left === right) return null;
    return Object.freeze(
        codeUnitCompare(left, right) < 0 ? [left, right] : [right, left]
    );
}

export function evaluateDuplicateReviewPair(left, right) {
    const leftFacts = activityFacts(left);
    const rightFacts = activityFacts(right);
    if (
        !leftFacts
        || !rightFacts
        || leftFacts.id === rightFacts.id
        || leftFacts.sportCategory !== rightFacts.sportCategory
    ) {
        return null;
    }
    const evidence = Object.freeze({
        matcherVersion: DUPLICATE_REVIEW_MATCHER_VERSION,
        sportCategory: leftFacts.sportCategory,
        timeDeltaSeconds: Math.abs(
            Date.parse(leftFacts.startTimeUtc) - Date.parse(rightFacts.startTimeUtc)
        ) / 1_000,
        distanceDeltaRatio: ratio(
            leftFacts.distanceMeters,
            rightFacts.distanceMeters
        ),
        movingDurationDeltaRatio: ratio(
            leftFacts.movingTimeSeconds,
            rightFacts.movingTimeSeconds
        )
    });
    const confidence = confidenceFor(evidence);
    return confidence === null
        ? null
        : Object.freeze({ confidence, evidence });
}

export function compareDuplicateReviewMatches(left, right) {
    const confidence = codeUnitCompare(
        left.confidence === 'high' ? '0' : '1',
        right.confidence === 'high' ? '0' : '1'
    );
    if (confidence !== 0) return confidence;
    const time = left.evidence.timeDeltaSeconds - right.evidence.timeDeltaSeconds;
    if (time !== 0) return time;
    const activityA = codeUnitCompare(left.activityAId, right.activityAId);
    return activityA !== 0
        ? activityA
        : codeUnitCompare(left.activityBId, right.activityBId);
}

export function createDuplicateReviewTimeRange(keyRange, activity) {
    const facts = activityFacts(activity);
    if (!facts || typeof keyRange?.bound !== 'function') return null;
    const center = Date.parse(facts.startTimeUtc);
    try {
        return keyRange.bound(
            [facts.sportCategory, new Date(center - 120_000).toISOString()],
            [facts.sportCategory, new Date(center + 120_000).toISOString()]
        );
    } catch {
        return null;
    }
}

export function createDuplicateReviewMatch(incomingActivity, existingEnvelope) {
    const envelope = ownSelectedValues(existingEnvelope, ['activity']);
    const evaluation = envelope
        ? evaluateDuplicateReviewPair(incomingActivity, envelope.activity)
        : null;
    if (evaluation === null) return null;
    const incoming = activityFacts(incomingActivity);
    const existing = activityFacts(envelope.activity);
    const pair = incoming && existing
        ? orderOpaqueActivityPair(incoming.id, existing.id)
        : null;
    if (pair === null) return null;
    return Object.freeze({
        activityAId: pair[0],
        activityBId: pair[1],
        confidence: evaluation.confidence,
        evidence: evaluation.evidence
    });
}

export function createDuplicateReviewCandidate({
    id,
    itemId,
    createdAt,
    match
}) {
    const record = {
        id,
        activityAId: match?.activityAId,
        activityBId: match?.activityBId,
        confidence: match?.confidence,
        status: 'review_required',
        matcherVersion: DUPLICATE_REVIEW_MATCHER_VERSION,
        createdAt,
        updatedAt: createdAt,
        createdFromImportItemId: itemId,
        evidence: match?.evidence
    };
    return validDuplicateReviewCandidate(record) ? Object.freeze(record) : null;
}

function validEvidence(value, confidence) {
    const evidence = ownExactValues(value, EVIDENCE_FIELDS);
    if (
        !evidence
        || evidence.matcherVersion !== DUPLICATE_REVIEW_MATCHER_VERSION
        || !opaqueString(evidence.sportCategory)
        || !finiteNonNegative(evidence.timeDeltaSeconds)
        || !finiteNonNegative(evidence.distanceDeltaRatio)
        || !finiteNonNegative(evidence.movingDurationDeltaRatio)
    ) {
        return false;
    }
    return confidenceFor(evidence) === confidence;
}

export function validDuplicateReviewCandidate(value) {
    const candidate = ownExactValues(value, CANDIDATE_FIELDS);
    if (!candidate) return false;
    const pair = orderOpaqueActivityPair(
        candidate.activityAId,
        candidate.activityBId
    );
    return opaqueString(candidate.id)
        && pair !== null
        && pair[0] === candidate.activityAId
        && pair[1] === candidate.activityBId
        && (candidate.confidence === 'high' || candidate.confidence === 'possible')
        && CANDIDATE_STATUSES.includes(candidate.status)
        && candidate.matcherVersion === DUPLICATE_REVIEW_MATCHER_VERSION
        && strictUtcInstant(candidate.createdAt)
        && strictUtcInstant(candidate.updatedAt)
        && candidate.updatedAt >= candidate.createdAt
        && opaqueString(candidate.createdFromImportItemId)
        && validEvidence(candidate.evidence, candidate.confidence);
}

export function validDuplicateReviewDecision(value) {
    const decision = ownExactValues(value, DECISION_FIELDS);
    return decision !== null
        && opaqueString(decision.id)
        && opaqueString(decision.candidateId)
        && DECISIONS.includes(decision.decision)
        && strictUtcInstant(decision.decidedAt)
        && decision.decisionVersion === DUPLICATE_REVIEW_DECISION_VERSION;
}
