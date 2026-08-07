const STORAGE_KEY = 'stravastats_import_performance_v1';
const RECORD_LIMIT = 50;
const STAGES = Object.freeze([
    'validation', 'hashing', 'decoding', 'normalizing', 'matching', 'persistence'
]);
const OUTCOMES = new Set(['completed', 'completed_with_warnings', 'cancelled', 'failed']);
const TERMINAL_FIELDS = Object.freeze([
    'completed', 'reviewRequired', 'skippedExactDuplicate', 'failed', 'cancelled', 'notStarted'
]);
const RECORD_FIELDS = Object.freeze([
    'version', 'outcome', 'artifactCount', 'terminalCounts',
    'totalMilliseconds', 'stageMilliseconds', 'decoderMilliseconds',
    'persistenceMilliseconds', 'cancellationObservedMilliseconds',
    'peakWorkerRequests'
]);
const PAIR_FIELDS = Object.freeze(['sum', 'maximum']);

let sink = null;
let clock = () => 0;
let fallback = [];
let active = null;

function safeNow() {
    try {
        const value = clock();
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}

function finiteMilliseconds(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function readSink(selectedSink = sink) {
    if (selectedSink === null) return fallback;
    try {
        const parsed = JSON.parse(selectedSink?.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.map(safeRecord).filter(Boolean).slice(-RECORD_LIMIT)
            : fallback;
    } catch {
        return fallback;
    }
}

function writeSink(records) {
    fallback = records.slice(-RECORD_LIMIT);
    try {
        sink?.setItem(STORAGE_KEY, JSON.stringify(fallback));
    } catch {
        // The bounded in-memory records remain available for this session.
    }
}

function elapsed(start) {
    return finiteMilliseconds(safeNow() - start);
}

function safeCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function exactValues(value, fields) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== fields.length
            || keys.some((key, index) => key !== fields[index])
        ) return null;
        const result = {};
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function safeRecord(value) {
    const record = exactValues(value, RECORD_FIELDS);
    if (!record || record.version !== 1 || !OUTCOMES.has(record.outcome)) return null;
    const artifactCount = safeCount(record.artifactCount);
    const totalMilliseconds = finiteMilliseconds(record.totalMilliseconds);
    const peakWorkerRequests = safeCount(record.peakWorkerRequests);
    if (artifactCount === null || peakWorkerRequests === null) return null;
    const terminalValues = exactValues(record.terminalCounts, TERMINAL_FIELDS);
    if (!terminalValues) return null;
    const terminalCounts = {};
    for (const field of TERMINAL_FIELDS) {
        const count = safeCount(terminalValues[field]);
        if (count === null) return null;
        terminalCounts[field] = count;
    }
    const stageValues = exactValues(record.stageMilliseconds, STAGES);
    if (!stageValues) return null;
    const stageMilliseconds = {};
    for (const stage of STAGES) {
        if (!Number.isFinite(stageValues[stage]) || stageValues[stage] < 0) {
            return null;
        }
        stageMilliseconds[stage] = stageValues[stage];
    }
    const pair = source => {
        const values = exactValues(source, PAIR_FIELDS);
        if (
            !values
            || !Number.isFinite(values.sum) || values.sum < 0
            || !Number.isFinite(values.maximum) || values.maximum < 0
        ) return null;
        return Object.freeze({ sum: values.sum, maximum: values.maximum });
    };
    const decoder = pair(record.decoderMilliseconds);
    const persistence = pair(record.persistenceMilliseconds);
    const cancellation = record.cancellationObservedMilliseconds;
    if (
        !decoder || !persistence
        || (cancellation !== null && (!Number.isFinite(cancellation) || cancellation < 0))
    ) return null;
    return Object.freeze({
        version: 1,
        outcome: record.outcome,
        artifactCount,
        terminalCounts: Object.freeze(terminalCounts),
        totalMilliseconds,
        stageMilliseconds: Object.freeze(stageMilliseconds),
        decoderMilliseconds: decoder,
        persistenceMilliseconds: persistence,
        cancellationObservedMilliseconds: cancellation,
        peakWorkerRequests
    });
}

export function sanitizeImportPerformanceRecords(value) {
    if (!Array.isArray(value)) return Object.freeze([]);
    return Object.freeze(value
        .map(safeRecord)
        .filter(record => record !== null)
        .slice(-RECORD_LIMIT));
}

export function configureImportPerformance({ storage = null, now } = {}) {
    sink = storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
        ? storage
        : null;
    clock = typeof now === 'function' ? now : () => 0;
    fallback = readSink();
    active = null;
}

export function beginImportPerformanceSelection(artifactCount) {
    if (!Number.isSafeInteger(artifactCount) || artifactCount < 0) return;
    active = {
        artifactCount,
        started: safeNow(),
        cancellationObserved: null,
        workerRequests: 0,
        peakWorkerRequests: 0,
        stageMilliseconds: Object.fromEntries(STAGES.map(stage => [stage, 0])),
        decoder: { sum: 0, maximum: 0 },
        persistence: { sum: 0, maximum: 0 }
    };
}

export async function recordImportPerformanceOperation(stage, operation) {
    const started = safeNow();
    try {
        return await operation();
    } finally {
        if (active && STAGES.includes(stage)) {
            const duration = elapsed(started);
            active.stageMilliseconds[stage] += duration;
            if (stage === 'decoding') {
                active.decoder.sum += duration;
                active.decoder.maximum = Math.max(active.decoder.maximum, duration);
            }
            if (stage === 'persistence') {
                active.persistence.sum += duration;
                active.persistence.maximum = Math.max(active.persistence.maximum, duration);
            }
        }
    }
}

export async function trackImportWorkerRequest(operation) {
    if (!active) return operation();
    active.workerRequests += 1;
    active.peakWorkerRequests = Math.max(active.peakWorkerRequests, active.workerRequests);
    try {
        return await recordImportPerformanceOperation('decoding', operation);
    } finally {
        if (active) active.workerRequests = Math.max(0, active.workerRequests - 1);
    }
}

export function observeImportCancellation() {
    if (active && active.cancellationObserved === null) {
        active.cancellationObserved = elapsed(active.started);
    }
}

export function finishImportPerformanceSelection({ outcome, terminalCounts } = {}) {
    if (!active) return null;
    const current = active;
    active = null;
    const counts = Object.fromEntries(TERMINAL_FIELDS.map(field => [
        field,
        Number.isSafeInteger(terminalCounts?.[field]) && terminalCounts[field] >= 0
            ? terminalCounts[field]
            : 0
    ]));
    const record = Object.freeze({
        version: 1,
        outcome: OUTCOMES.has(outcome) ? outcome : 'failed',
        artifactCount: current.artifactCount,
        terminalCounts: Object.freeze(counts),
        totalMilliseconds: elapsed(current.started),
        stageMilliseconds: Object.freeze({ ...current.stageMilliseconds }),
        decoderMilliseconds: Object.freeze({ ...current.decoder }),
        persistenceMilliseconds: Object.freeze({ ...current.persistence }),
        cancellationObservedMilliseconds: current.cancellationObserved,
        peakWorkerRequests: current.peakWorkerRequests
    });
    writeSink([...readSink(), record].slice(-RECORD_LIMIT));
    return record;
}

export function readImportPerformanceRecords({ storage = sink } = {}) {
    const selectedStorage = storage
        && typeof storage.getItem === 'function'
        ? storage
        : null;
    return sanitizeImportPerformanceRecords(readSink(selectedStorage));
}

export function resetImportPerformanceForTests() {
    sink = null;
    clock = () => 0;
    fallback = [];
    active = null;
}
