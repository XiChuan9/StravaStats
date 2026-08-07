import { sanitizeImportPerformanceRecords } from './import-performance.js';

export const DIAGNOSTICS_ERROR_LIMIT = 20;
export const DIAGNOSTICS_EXPORT_MAX_BYTES = 256 * 1024;
export const DIAGNOSTICS_EXPORT_MIME = 'application/vnd.stravastats.diagnostics+json;version=1';

const ERROR_STORAGE_KEY = 'stravastats_diagnostics_errors_v1';
const RECORD_FIELDS = Object.freeze([
    'version',
    'occurredAt',
    'page',
    'category',
    'code',
    'count'
]);
const PAGES = new Set([
    'dashboard',
    'diagnostics',
    'storage-backup',
    'source-manager',
    'activity-router',
    'activity',
    'run',
    'bike',
    'swim'
]);
const CATEGORIES = new Set(['page', 'database', 'backup', 'analysis']);
const CODES = new Set([
    'UNCAUGHT_ERROR',
    'UNHANDLED_REJECTION',
    'DIAGNOSTICS_START_FAILED',
    'DASHBOARD_START_FAILED',
    'DASHBOARD_INITIALIZE_FAILED',
    'DASHBOARD_REFRESH_FAILED',
    'STORAGE_BACKUP_START_FAILED',
    'STORAGE_BACKUP_INITIALIZE_FAILED',
    'BACKUP_EXPORT_FAILED',
    'BACKUP_RESTORE_FAILED',
    'SOURCE_MANAGER_START_FAILED',
    'SOURCE_MANAGER_OPERATION_FAILED',
    'ACTIVITY_ROUTE_FAILED',
    'DETAIL_ID_INVALID',
    'DETAIL_LOAD_FAILED',
    'ANALYSIS_FAILED'
]);
const LISTENER_TARGETS = new WeakMap();
const MEMORY_RECORDS = new WeakMap();
const DEGRADED_STORAGES = new WeakSet();
let defaultMemoryRecords = [];
let defaultStorageDegraded = false;
const ESTIMATE_LABELS = Object.freeze({
    usage: 'Estimated origin storage use',
    quota: 'Estimated origin storage quota',
    headroom: 'Estimated origin storage headroom'
});
const UNAVAILABLE_ESTIMATE = Object.freeze({
    status: 'unavailable',
    scopeLabel: 'Browser origin estimate',
    usageLabel: ESTIMATE_LABELS.usage,
    usageValue: 'Unavailable',
    quotaLabel: ESTIMATE_LABELS.quota,
    quotaValue: 'Unavailable',
    headroomLabel: ESTIMATE_LABELS.headroom,
    headroomValue: 'Unavailable',
    percentUsed: 'Unavailable'
});
const UNSUPPORTED_ESTIMATE = Object.freeze({
    ...UNAVAILABLE_ESTIMATE,
    status: 'unsupported'
});

function ownValue(value, field) {
    try {
        if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
            return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function validTimestamp(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    try {
        return new Date(value).toISOString() === value;
    } catch {
        return false;
    }
}

function safeNow(now) {
    try {
        const value = now();
        return validTimestamp(value) ? value : null;
    } catch {
        return null;
    }
}

function normalizedInput(value) {
    const page = ownValue(value, 'page');
    const category = ownValue(value, 'category');
    const code = ownValue(value, 'code');
    return PAGES.has(page) && CATEGORIES.has(category) && CODES.has(code)
        ? Object.freeze({ page, category, code })
        : null;
}

function normalizedRecord(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== RECORD_FIELDS.length
            || keys.some((key, index) => key !== RECORD_FIELDS[index])
        ) return null;
        const version = ownValue(value, 'version');
        const occurredAt = ownValue(value, 'occurredAt');
        const page = ownValue(value, 'page');
        const category = ownValue(value, 'category');
        const code = ownValue(value, 'code');
        const count = ownValue(value, 'count');
        if (
            version !== 1
            || !validTimestamp(occurredAt)
            || !PAGES.has(page)
            || !CATEGORIES.has(category)
            || !CODES.has(code)
            || !Number.isSafeInteger(count)
            || count < 1
        ) return null;
        return Object.freeze({ version, occurredAt, page, category, code, count });
    } catch {
        return null;
    }
}

function selectedStorage(storage) {
    if (storage !== undefined) return storage;
    try {
        return globalThis.sessionStorage;
    } catch {
        return null;
    }
}

function memoryKey(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
        ? value
        : null;
}

function readMemory(selected) {
    const key = memoryKey(selected);
    return key === null
        ? [...defaultMemoryRecords]
        : [...(MEMORY_RECORDS.get(key) ?? [])];
}

function writeMemory(selected, records) {
    const value = records.slice(-DIAGNOSTICS_ERROR_LIMIT);
    const key = memoryKey(selected);
    if (key === null) {
        defaultMemoryRecords = value;
        defaultStorageDegraded = true;
    } else {
        MEMORY_RECORDS.set(key, value);
        DEGRADED_STORAGES.add(key);
    }
}

function readRecords(storage) {
    const selected = selectedStorage(storage);
    const key = memoryKey(selected);
    if ((key === null && defaultStorageDegraded) || (key !== null && DEGRADED_STORAGES.has(key))) {
        return Object.freeze({ selected, status: 'memory', records: readMemory(selected) });
    }
    try {
        if (typeof selected?.getItem !== 'function') {
            writeMemory(selected, readMemory(selected));
            return Object.freeze({ selected, status: 'memory', records: readMemory(selected) });
        }
        const serialized = selected.getItem(ERROR_STORAGE_KEY);
        if (serialized === null) {
            return Object.freeze({ selected, status: 'available', records: [] });
        }
        const parsed = JSON.parse(serialized);
        const records = !Array.isArray(parsed) ? [] : parsed
            .map(normalizedRecord)
            .filter(record => record !== null)
            .slice(-DIAGNOSTICS_ERROR_LIMIT);
        return Object.freeze({ selected, status: 'available', records });
    } catch {
        writeMemory(selected, readMemory(selected));
        return Object.freeze({ selected, status: 'memory', records: readMemory(selected) });
    }
}

function writeRecords(state, records) {
    if (state.status === 'memory') {
        writeMemory(state.selected, records);
        return true;
    }
    try {
        if (typeof state.selected?.setItem !== 'function') throw new TypeError();
        state.selected.setItem(ERROR_STORAGE_KEY, JSON.stringify(records));
        return true;
    } catch {
        writeMemory(state.selected, records);
        return true;
    }
}

export function recordDiagnosticError(value, {
    storage,
    now = () => new Date().toISOString()
} = {}) {
    const input = normalizedInput(value);
    const occurredAt = safeNow(now);
    const state = readRecords(storage);
    if (input === null || occurredAt === null) return false;
    const records = [...state.records];

    const last = records.at(-1);
    const adjacent = last !== undefined
        && last.page === input.page
        && last.category === input.category
        && last.code === input.code;
    let count = 1;
    if (adjacent) {
        count = Math.min(Number.MAX_SAFE_INTEGER, last.count + 1);
        records.pop();
    }
    records.push(Object.freeze({
        version: 1,
        occurredAt,
        page: input.page,
        category: input.category,
        code: input.code,
        count
    }));
    return writeRecords(state, records.slice(-DIAGNOSTICS_ERROR_LIMIT));
}

export function readRecentDiagnosticErrors({ storage } = {}) {
    const state = readRecords(storage);
    return Object.freeze({
        status: state.status,
        records: Object.freeze(state.records.map(record => Object.freeze({ ...record })))
    });
}

export function installGlobalDiagnosticsListeners({
    target = globalThis,
    page,
    storage,
    now = () => new Date().toISOString()
} = {}) {
    if (!PAGES.has(page)) return false;
    try {
        if (typeof target?.addEventListener !== 'function') return false;
        const pages = LISTENER_TARGETS.get(target) ?? new Set();
        if (pages.has(page)) return false;
        target.addEventListener('error', () => {
            recordDiagnosticError({
                page,
                category: 'page',
                code: 'UNCAUGHT_ERROR'
            }, { storage, now });
        });
        target.addEventListener('unhandledrejection', () => {
            recordDiagnosticError({
                page,
                category: 'page',
                code: 'UNHANDLED_REJECTION'
            }, { storage, now });
        });
        pages.add(page);
        LISTENER_TARGETS.set(target, pages);
        return true;
    } catch {
        return false;
    }
}

function coarseMiB(value) {
    if (!Number.isFinite(value) || value < 0) return null;
    if (value === 0) return 0;
    return Math.max(1, Math.round(value / 1_048_576));
}

function availableEstimate(usage, quota) {
    const usageMiB = coarseMiB(usage);
    const quotaMiB = coarseMiB(quota);
    if (usageMiB === null || quotaMiB === null) return null;
    const headroomMiB = coarseMiB(Math.max(quota - usage, 0));
    const percent = quota > 0
        ? Math.max(0, Math.min(100, Math.round((usage / quota) * 1000) / 10))
        : null;
    return Object.freeze({
        status: 'available',
        scopeLabel: 'Browser origin estimate',
        usageLabel: ESTIMATE_LABELS.usage,
        usageValue: `About ${usageMiB} MiB`,
        quotaLabel: ESTIMATE_LABELS.quota,
        quotaValue: `About ${quotaMiB} MiB`,
        headroomLabel: ESTIMATE_LABELS.headroom,
        headroomValue: `About ${headroomMiB} MiB`,
        percentUsed: percent === null ? 'Unavailable' : `About ${percent}%`
    });
}

export async function estimateOriginStorage({ storageManager } = {}) {
    let selected;
    try {
        selected = storageManager === undefined
            ? globalThis.navigator?.storage
            : storageManager;
    } catch {
        return UNAVAILABLE_ESTIMATE;
    }
    let estimate;
    try {
        estimate = selected?.estimate;
    } catch {
        return UNAVAILABLE_ESTIMATE;
    }
    if (typeof estimate !== 'function') return UNSUPPORTED_ESTIMATE;
    try {
        const result = await estimate.call(selected);
        return availableEstimate(
            ownValue(result, 'usage'),
            ownValue(result, 'quota')
        ) ?? UNAVAILABLE_ESTIMATE;
    } catch {
        return UNAVAILABLE_ESTIMATE;
    }
}

function normalizedEstimate(value) {
    const status = ownValue(value, 'status');
    const scopeLabel = ownValue(value, 'scopeLabel');
    const usageLabel = ownValue(value, 'usageLabel');
    const usageValue = ownValue(value, 'usageValue');
    const quotaLabel = ownValue(value, 'quotaLabel');
    const quotaValue = ownValue(value, 'quotaValue');
    const headroomLabel = ownValue(value, 'headroomLabel');
    const headroomValue = ownValue(value, 'headroomValue');
    const percentUsed = ownValue(value, 'percentUsed');
    if (
        !['available', 'unsupported', 'unavailable'].includes(status)
        || scopeLabel !== 'Browser origin estimate'
        || usageLabel !== ESTIMATE_LABELS.usage
        || quotaLabel !== ESTIMATE_LABELS.quota
        || headroomLabel !== ESTIMATE_LABELS.headroom
        || ![usageValue, quotaValue, headroomValue, percentUsed].every(label => (
            typeof label === 'string' && label.length <= 32
        ))
    ) return UNAVAILABLE_ESTIMATE;
    return Object.freeze({
        status,
        scopeLabel,
        usageLabel,
        usageValue,
        quotaLabel,
        quotaValue,
        headroomLabel,
        headroomValue,
        percentUsed
    });
}

function normalizedExportErrors(value) {
    if (!Array.isArray(value)) return Object.freeze([]);
    return Object.freeze(value
        .map(normalizedRecord)
        .filter(record => record !== null)
        .slice(-DIAGNOSTICS_ERROR_LIMIT));
}

export function createDiagnosticsExport({
    createdAt,
    storageEstimate,
    recentErrors,
    importPerformance
} = {}) {
    if (!validTimestamp(createdAt)) {
        throw Object.freeze({ code: 'DIAGNOSTICS_EXPORT_INVALID' });
    }
    const errors = [...normalizedExportErrors(recentErrors)];
    const performance = [...sanitizeImportPerformanceRecords(importPerformance)];
    const omitted = { recentErrors: 0, importPerformance: 0 };
    let json;
    let byteLength;
    while (true) {
        const snapshot = Object.freeze({
            version: 1,
            createdAt,
            storageEstimate: normalizedEstimate(storageEstimate),
            recentErrors: Object.freeze([...errors]),
            importPerformance: Object.freeze([...performance]),
            omittedRecords: Object.freeze({ ...omitted })
        });
        json = `${JSON.stringify(snapshot, null, 2)}\n`;
        byteLength = new TextEncoder().encode(json).byteLength;
        if (byteLength <= DIAGNOSTICS_EXPORT_MAX_BYTES) break;
        if (errors.length > 0) {
            errors.shift();
            omitted.recentErrors += 1;
        } else if (performance.length > 0) {
            performance.shift();
            omitted.importPerformance += 1;
        } else {
            throw Object.freeze({ code: 'DIAGNOSTICS_EXPORT_TOO_LARGE' });
        }
    }
    return Object.freeze({
        json,
        byteLength,
        mimeType: DIAGNOSTICS_EXPORT_MIME,
        filename: `stravastats-diagnostics-${createdAt.replace(/[-:.]/g, '')}.json`
    });
}
