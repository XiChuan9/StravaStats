import { validateImportedActivityBundle } from '../data/contracts/index.js';
import { STORAGE_ERROR_CODE } from '../storage/constants.js';
import {
    expectationsFromCanonicalBundle,
    mapLegacyActivityToCanonicalBundle
} from './legacy-to-canonical.js';
import {
    createParityReport,
    PARITY_CATEGORY,
    PARITY_FIELDS
} from './parity-report.js';

const OPTION_FIELDS = Object.freeze(['canonicalStore', 'now']);
const STORE_METHODS = Object.freeze([
    'initialize',
    'putBundle',
    'getBundle',
    'close'
]);
const SAFE_STORAGE_ERROR_CODES = new Set(Object.values(STORAGE_ERROR_CODE));

function ownDataRecord(value, allowedFields = null) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
        ) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || (allowedFields && keys.some(key => !allowedFields.includes(key)))
        ) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function denseArray(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        const length = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !length
            || !Object.hasOwn(length, 'value')
            || !Number.isSafeInteger(length.value)
            || length.value < 0
            || keys.length !== length.value + 1
            || keys.some(key => typeof key !== 'string')
        ) return null;
        const result = [];
        for (let index = 0; index < length.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

function cloneJsonSafe(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('unsafe');
        return value;
    }
    if (typeof value !== 'object' || ancestors.has(value)) {
        throw new TypeError('unsafe');
    }
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            const inspected = denseArray(value);
            if (inspected === null) throw new TypeError('unsafe');
            return inspected.map(item => cloneJsonSafe(item, ancestors));
        }
        const record = ownDataRecord(value);
        if (record === null) throw new TypeError('unsafe');
        const result = {};
        for (const key of Reflect.ownKeys(record)) {
            Object.defineProperty(result, key, {
                value: cloneJsonSafe(record[key], ancestors),
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return result;
    } finally {
        ancestors.delete(value);
    }
}

function normalizeOptions(options) {
    const values = ownDataRecord(options, OPTION_FIELDS);
    if (!values || Reflect.ownKeys(values).length !== OPTION_FIELDS.length) return null;
    const store = values.canonicalStore;
    try {
        if (store === null || typeof store !== 'object') return null;
        for (const method of STORE_METHODS) {
            const descriptor = Object.getOwnPropertyDescriptor(store, method);
            if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') {
                return null;
            }
        }
    } catch {
        return null;
    }
    if (typeof values.now !== 'function') return null;
    let timestamp;
    try {
        timestamp = values.now();
    } catch {
        return null;
    }
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;
    return {
        canonicalStore: store,
        createdAt: new Date(timestamp).toISOString()
    };
}

function acceptedResult(accepted, sequence = null, reason = null) {
    return Object.freeze({ accepted, sequence, reason });
}

function safeErrorCode(error) {
    try {
        if (error === null || typeof error !== 'object') return 'STORAGE_OPERATION_FAILED';
        const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
        if (
            descriptor
            && Object.hasOwn(descriptor, 'value')
            && typeof descriptor.value === 'string'
            && SAFE_STORAGE_ERROR_CODES.has(descriptor.value)
        ) return descriptor.value;
    } catch {
        // Redact hostile thrown values.
    }
    return 'STORAGE_OPERATION_FAILED';
}

function validationFields(validation) {
    const errors = denseArray(validation?.errors) ?? [];
    const fields = new Set();
    for (const error of errors) {
        const record = ownDataRecord(error);
        const path = record && typeof record.path === 'string' ? record.path : '';
        if (path.includes('/id')) fields.add('opaqueId');
        else if (path.includes('distanceMeters')) fields.add('distance');
        else if (path.includes('movingTimeSeconds')) fields.add('movingTime');
        else if (path.includes('elapsedTimeSeconds')) fields.add('elapsedTime');
        else if (path.includes('startTimeUtc')) fields.add('date');
        else if (path.includes('sport')) fields.add('sportType');
        else if (path.includes('HeartRate')) fields.add('heartRate');
        else if (path.includes('Power')) fields.add('power');
    }
    return fields.size > 0 ? [...fields] : [null];
}

function comparisons(expected, actual) {
    return PARITY_FIELDS
        .filter(field => field !== 'activityCount')
        .map(field => ({
            field,
            legacy: expected?.[field] ?? { state: 'unavailable' },
            canonical: actual?.[field] ?? { state: 'unavailable' }
        }));
}

function normalizationDifferences(report, warnings) {
    return warnings.map(item => report.difference(
        PARITY_CATEGORY.NORMALIZATION_WARNING,
        item.field,
        item.reason,
        'value',
        'value'
    ));
}

export function createShadowCanonicalWriter(options) {
    const normalized = normalizeOptions(options);
    if (!normalized) throw new TypeError('Invalid shadow writer configuration.');
    const store = normalized.canonicalStore;
    const report = createParityReport(normalized.createdAt);
    let sequence = 0;
    let tail = Promise.resolve();
    let ready = false;
    let closed = false;
    let closing = null;

    async function ensureReady() {
        if (ready) return;
        await store.initialize();
        ready = true;
    }

    async function processBundle(item, batch, reference) {
        const { bundle, warnings } = item;
        const expected = item.expected ?? item.expectations;
        let validation;
        try {
            validation = validateImportedActivityBundle(bundle);
        } catch {
            validation = { ok: false, errors: [] };
        }
        if (validation?.ok !== true) {
            const differences = validationFields(validation).map(field => report.difference(
                PARITY_CATEGORY.VALIDATION_FAILURE,
                field,
                'BUNDLE_VALIDATION_FAILED',
                field && expected?.[field]?.state,
                'unavailable'
            ));
            report.record(batch, {
                reference,
                outcome: 'validationFailed',
                differences: [...normalizationDifferences(report, warnings), ...differences]
            });
            return null;
        }

        try {
            await ensureReady();
        } catch (error) {
            ready = false;
            report.record(batch, {
                reference,
                outcome: 'storageFailed',
                differences: [
                    ...normalizationDifferences(report, warnings),
                    report.difference(
                        PARITY_CATEGORY.STORAGE_FAILURE,
                        null,
                        safeErrorCode(error),
                        'value',
                        'unavailable'
                    )
                ]
            });
            return null;
        }

        let write;
        try {
            write = await store.putBundle(bundle);
        } catch (error) {
            if (safeErrorCode(error) === 'CONNECTION_STALE') ready = false;
            let existing = null;
            try {
                if (ready) existing = await store.getBundle(bundle.activity.id);
            } catch {
                existing = null;
            }
            const actual = existing
                ? expectationsFromCanonicalBundle(existing)
                : null;
            report.record(batch, {
                reference,
                outcome: 'storageFailed',
                comparisons: actual ? comparisons(expected, actual) : [],
                differences: [
                    ...normalizationDifferences(report, warnings),
                    report.difference(
                        PARITY_CATEGORY.STORAGE_FAILURE,
                        null,
                        safeErrorCode(error),
                        'value',
                        actual ? 'value' : 'unavailable'
                    )
                ]
            });
            return actual ? bundle.activity.id : null;
        }

        const writeRecord = ownDataRecord(write);
        const outcome = writeRecord?.status === 'committed'
            ? 'committed'
            : writeRecord?.status === 'already-present'
                ? 'alreadyPresent'
                : null;
        if (!outcome) {
            report.record(batch, {
                reference,
                outcome: 'verificationFailed',
                differences: [report.difference(
                    PARITY_CATEGORY.VERIFICATION_FAILURE,
                    null,
                    'WRITE_RESULT_INVALID',
                    'value',
                    'unavailable'
                )]
            });
            return null;
        }

        let stored;
        try {
            stored = await store.getBundle(bundle.activity.id);
        } catch {
            stored = null;
        }
        const actual = stored ? expectationsFromCanonicalBundle(stored) : null;
        if (!actual) {
            report.record(batch, {
                reference,
                outcome: 'verificationFailed',
                differences: [
                    ...normalizationDifferences(report, warnings),
                    report.difference(
                        PARITY_CATEGORY.VERIFICATION_FAILURE,
                        null,
                        'READBACK_UNAVAILABLE',
                        'value',
                        'unavailable'
                    )
                ]
            });
            return null;
        }
        const fieldComparisons = comparisons(expected, actual);
        const mismatch = fieldComparisons.some(item => (
            item.legacy.state !== item.canonical.state
            || !Object.is(item.legacy.value, item.canonical.value)
        ));
        report.record(batch, {
            reference,
            outcome: mismatch ? 'parityMismatched' : outcome,
            comparisons: fieldComparisons,
            differences: normalizationDifferences(report, warnings)
        });
        return bundle.activity.id;
    }

    function schedule(event) {
        tail = tail.catch(() => undefined).then(async () => {
            const batch = report.startBatch(
                event.sequence,
                event.kind,
                event.items.length
            );
            const verified = new Set();
            try {
                for (let index = 0; index < event.items.length; index += 1) {
                    const item = event.items[index];
                    const reference = `batch-${String(event.sequence).padStart(6, '0')}-activity-${String(index + 1).padStart(6, '0')}`;
                    if (item.ok !== true) {
                        const validationFailure = item.category
                            === PARITY_CATEGORY.VALIDATION_FAILURE;
                        report.record(batch, {
                            reference,
                            outcome: validationFailure
                                ? 'validationFailed'
                                : 'mappingFailed',
                            differences: [report.difference(
                                validationFailure
                                    ? PARITY_CATEGORY.VALIDATION_FAILURE
                                    : PARITY_CATEGORY.MAPPING_FAILURE,
                                item.field,
                                item.reason,
                                'invalid',
                                'unavailable'
                            )]
                        });
                        continue;
                    }
                    const id = await processBundle(item, batch, reference);
                    if (id !== null) verified.add(id);
                }
            } catch {
                report.record(batch, {
                    reference: `batch-${String(event.sequence).padStart(6, '0')}-internal`,
                    outcome: 'verificationFailed',
                    differences: [report.difference(
                        PARITY_CATEGORY.VERIFICATION_FAILURE,
                        null,
                        'INTERNAL_OPERATION_FAILED',
                        'unavailable',
                        'unavailable'
                    )]
                });
            }
            report.finishBatch(batch, verified.size);
        });
    }

    function enqueueLegacyActivities(activities) {
        if (closed) return acceptedResult(false, null, 'WRITER_CLOSED');
        const values = denseArray(activities);
        sequence += 1;
        if (values === null) {
            schedule({
                sequence,
                kind: 'legacy-api',
                items: [Object.freeze({
                    ok: false,
                    field: null,
                    reason: 'LEGACY_BATCH_UNSAFE'
                })]
            });
            return acceptedResult(false, sequence, 'LEGACY_BATCH_UNSAFE');
        }
        const items = values.map(mapLegacyActivityToCanonicalBundle);
        schedule({ sequence, kind: 'legacy-api', items });
        return acceptedResult(true, sequence, null);
    }

    function enqueueImportedBundle(bundle) {
        if (closed) return acceptedResult(false, null, 'WRITER_CLOSED');
        sequence += 1;
        let snapshot;
        try {
            snapshot = cloneJsonSafe(bundle);
        } catch {
            schedule({
                sequence,
                kind: 'imported-bundle',
                items: [Object.freeze({
                    ok: false,
                    field: null,
                    reason: 'IMPORTED_BUNDLE_UNSAFE',
                    category: PARITY_CATEGORY.VALIDATION_FAILURE
                })]
            });
            return acceptedResult(false, sequence, 'IMPORTED_BUNDLE_UNSAFE');
        }
        const expected = expectationsFromCanonicalBundle(snapshot);
        schedule({
            sequence,
            kind: 'imported-bundle',
            items: [expected
                ? { ok: true, bundle: snapshot, expected, warnings: [] }
                : {
                    ok: false,
                    field: null,
                    reason: 'IMPORTED_BUNDLE_UNSAFE',
                    category: PARITY_CATEGORY.VALIDATION_FAILURE
                }]
        });
        return acceptedResult(expected !== null, sequence, expected ? null : 'IMPORTED_BUNDLE_UNSAFE');
    }

    function flush() {
        return tail.then(() => report.exportJson());
    }

    function close() {
        if (closing) return closing;
        closed = true;
        closing = tail.then(async () => {
            ready = false;
            await store.close();
            return Object.freeze({ status: 'closed' });
        });
        return closing;
    }

    return Object.freeze({
        enqueueLegacyActivities,
        enqueueImportedBundle,
        flush,
        exportReport() {
            return report.exportJson();
        },
        close
    });
}
