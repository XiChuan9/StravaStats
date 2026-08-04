export const PARITY_FIELDS = Object.freeze([
    'activityCount',
    'opaqueId',
    'distance',
    'movingTime',
    'elapsedTime',
    'date',
    'sportType',
    'heartRate',
    'power',
    'gear'
]);

export const PARITY_CATEGORY = Object.freeze({
    MAPPING_FAILURE: 'MAPPING_FAILURE',
    VALIDATION_FAILURE: 'VALIDATION_FAILURE',
    STORAGE_FAILURE: 'STORAGE_FAILURE',
    VERIFICATION_FAILURE: 'VERIFICATION_FAILURE',
    PARITY_MISMATCH: 'PARITY_MISMATCH',
    NORMALIZATION_WARNING: 'NORMALIZATION_WARNING'
});

const STATES = Object.freeze([
    'missing',
    'null',
    'zero',
    'value',
    'invalid',
    'unavailable'
]);

const OUTCOMES = Object.freeze([
    'committed',
    'alreadyPresent',
    'mappingFailed',
    'validationFailed',
    'storageFailed',
    'verificationFailed',
    'parityMismatched',
    'rejectedClosed'
]);

function emptyStateCounts() {
    return Object.fromEntries(STATES.map(item => [item, 0]));
}

function fieldSummary() {
    return Object.fromEntries(PARITY_FIELDS.map(field => [field, {
        compared: 0,
        matched: 0,
        mismatched: 0,
        legacyStates: emptyStateCounts(),
        canonicalStates: emptyStateCounts()
    }]));
}

function sameExpectation(left, right) {
    return left?.state === right?.state && Object.is(left?.value, right?.value);
}

function safeState(value) {
    return STATES.includes(value?.state) ? value.state : 'unavailable';
}

function safeDifference(value) {
    const category = Object.values(PARITY_CATEGORY).includes(value?.category)
        ? value.category
        : PARITY_CATEGORY.VERIFICATION_FAILURE;
    const field = PARITY_FIELDS.includes(value?.field) ? value.field : null;
    const reason = typeof value?.reason === 'string'
        && /^[A-Z0-9_]{1,80}$/.test(value.reason)
        ? value.reason
        : 'UNCLASSIFIED_FAILURE';
    return Object.freeze({
        category,
        field,
        reason,
        legacyState: STATES.includes(value?.legacyState)
            ? value.legacyState
            : 'unavailable',
        canonicalState: STATES.includes(value?.canonicalState)
            ? value.canonicalState
            : 'unavailable'
    });
}

function clonedReport(report) {
    return JSON.parse(JSON.stringify(report));
}

export function createParityReport(createdAt) {
    if (
        typeof createdAt !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt)
    ) {
        throw new TypeError('Invalid parity report clock.');
    }
    const report = {
        reportVersion: 1,
        mode: 'shadow',
        createdAt,
        status: 'passed',
        totals: Object.fromEntries(OUTCOMES.map(item => [item, 0])),
        fields: fieldSummary(),
        batches: []
    };

    function difference(category, field, reason, legacyState, canonicalState) {
        return safeDifference({
            category,
            field,
            reason,
            legacyState,
            canonicalState
        });
    }

    function startBatch(sequence, kind, inputCount) {
        const batch = {
            sequence,
            kind,
            inputCount,
            canonicalVerifiedCount: 0,
            differences: [],
            activities: []
        };
        report.batches.push(batch);
        return batch;
    }

    function record(batch, {
        reference,
        outcome,
        comparisons = [],
        differences = []
    }) {
        const safeOutcome = OUTCOMES.includes(outcome)
            ? outcome
            : 'verificationFailed';
        report.totals[safeOutcome] += 1;
        const safeDifferences = differences.map(safeDifference);
        for (const comparison of comparisons) {
            if (!PARITY_FIELDS.includes(comparison?.field)) continue;
            const summary = report.fields[comparison.field];
            const legacyState = safeState(comparison.legacy);
            const canonicalState = safeState(comparison.canonical);
            summary.compared += 1;
            summary.legacyStates[legacyState] += 1;
            summary.canonicalStates[canonicalState] += 1;
            if (sameExpectation(comparison.legacy, comparison.canonical)) {
                summary.matched += 1;
            } else {
                summary.mismatched += 1;
                safeDifferences.push(difference(
                    PARITY_CATEGORY.PARITY_MISMATCH,
                    comparison.field,
                    'FIELD_STATE_OR_VALUE_MISMATCH',
                    legacyState,
                    canonicalState
                ));
            }
        }
        if (
            safeOutcome !== 'parityMismatched'
            && safeDifferences.some(item => item.category === PARITY_CATEGORY.PARITY_MISMATCH)
        ) {
            report.totals.parityMismatched += 1;
        }
        if (safeDifferences.length > 0) report.status = 'differences';
        batch.activities.push({
            reference,
            outcome: safeOutcome,
            differences: safeDifferences
        });
    }

    function finishBatch(batch, canonicalVerifiedCount) {
        batch.canonicalVerifiedCount = canonicalVerifiedCount;
        const legacy = {
            state: batch.inputCount === 0 ? 'zero' : 'value',
            value: batch.inputCount
        };
        const canonical = {
            state: canonicalVerifiedCount === 0 ? 'zero' : 'value',
            value: canonicalVerifiedCount
        };
        const summary = report.fields.activityCount;
        summary.compared += 1;
        summary.legacyStates[legacy.state] += 1;
        summary.canonicalStates[canonical.state] += 1;
        if (sameExpectation(legacy, canonical)) {
            summary.matched += 1;
        } else {
            summary.mismatched += 1;
            report.status = 'differences';
            batch.differences.push(difference(
                PARITY_CATEGORY.PARITY_MISMATCH,
                'activityCount',
                'ACTIVITY_COUNT_MISMATCH',
                legacy.state,
                canonical.state
            ));
        }
    }

    return Object.freeze({
        difference,
        startBatch,
        record,
        finishBatch,
        exportJson() {
            return JSON.stringify(clonedReport(report));
        }
    });
}
