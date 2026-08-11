import { IMPORT_ERROR_CODE } from '../../import/index.js';
import { ACTIVITIES_CSV_MEDIA_TYPE } from '../../import/activities-csv-decoder.js';
import {
    ACTIVITIES_CSV_LIMITS,
    decodeActivitiesCsvUtf8,
    parseActivitiesCsv
} from '../../import/csv-tokenizer.js';
import { STRAVA_ZIP_MEDIA_TYPE } from '../../import/strava-zip.js';
import { STRAVA_ZIP_LIMITS } from '../../import/zip-inspector.js';
import {
    FIT_LIMITS,
    FIT_MEDIA_TYPE
} from '../../decoders/fit/decoder.js';
import {
    TCX_LIMITS,
    TCX_MEDIA_TYPE
} from '../../decoders/tcx/decoder.js';
import {
    GPX_LIMITS,
    GPX_MEDIA_TYPE
} from '../../decoders/gpx/decoder.js';
import {
    beginImportPerformanceSelection,
    finishImportPerformanceSelection,
    observeImportCancellation
} from '../../diagnostics/import-performance.js';
import { recordDiagnosticError } from '../../diagnostics/index.js';

export const SOURCE_MANAGER_SESSION_MODE = Object.freeze({
    REAL: 'real',
    DEMO: 'demo'
});

export const SOURCE_MANAGER_LIMITS = Object.freeze({
    maxFiles: 1_000,
    maxOrdinaryFilesPerJob: 25,
    maxOrdinaryBytesPerJob: 32 * 1024 * 1024,
    maxSelectionBytes: 256 * 1024 * 1024,
    maxCsvBytes: ACTIVITIES_CSV_LIMITS.maxBytes,
    maxZipBytes: STRAVA_ZIP_LIMITS.maxArchiveBytes,
    maxFitBytes: FIT_LIMITS.maxDecodedBytes,
    maxTcxBytes: TCX_LIMITS.maxXmlBytes,
    maxGpxBytes: GPX_LIMITS.maxXmlBytes
});

const PREFLIGHT_COPY = Object.freeze({
    FILE_TYPE_UNSUPPORTED: 'This file format is not supported.',
    FILE_HEADER_INVALID: 'The file header or root does not match its selected format.',
    FILE_TOO_LARGE: 'The file is larger than the supported import limit.',
    TOO_MANY_FILES: 'Select no more than 1,000 files at a time.',
    SELECTION_TOO_LARGE: 'Select files totaling no more than 256 MiB.',
    FILE_READ_FAILED: 'The file could not be read.',
    DEMO_IMPORT_UNAVAILABLE: 'Demo import is not available in this milestone.',
    REVIEW_STALE: 'This review item changed. Refresh the review queue.',
    REVIEW_DECISION_FAILED: 'The review decision could not be recorded.',
    INVALID_SESSION_MODE: 'The requested Source Manager session mode is invalid.',
    AUTHORIZATION_INVALID_REQUEST: 'The authorization response could not be accepted.',
    AUTHORIZATION_STATE_UNAVAILABLE: 'The authorization session is no longer available. Reconnect explicitly.',
    AUTHORIZATION_STATE_INVALID: 'The authorization session did not match. Reconnect explicitly.',
    AUTHORIZATION_STATE_EXPIRED: 'The authorization session expired. Reconnect explicitly.',
    AUTHORIZATION_ACCESS_DENIED: 'Strava authorization was cancelled.',
    AUTHORIZATION_CONFIG_FAILED: 'Authorization configuration is unavailable.',
    AUTHORIZATION_EXCHANGE_FAILED: 'Authorization could not be completed.',
    AUTHORIZATION_TOKEN_INVALID: 'The authorization response was incomplete.',
    AUTHORIZATION_REQUIRED: 'Reconnect explicitly to restore exact local authorization.',
    IDENTITY_MISMATCH: 'This Strava account does not match the local library.',
    IDENTITY_UNCONFIRMED: 'The Strava account identity could not be confirmed.',
    TOKEN_WRITE_FAILED: 'Authorization could not be stored locally.',
    TOKEN_REMOVAL_FAILED: 'Local authorization could not be removed.',
    CONNECTION_INITIALIZATION_FAILED: 'The connection record could not be opened.',
    CONNECTION_ERROR: 'The connection could not be used.',
    CONNECTION_UPDATE_FAILED: 'The connection record could not be updated.',
    CONNECTION_ACTION_UNAVAILABLE: 'That connection action is not available.',
    REVOCATION_UNCONFIRMED: 'Disconnected locally. Provider revocation was not confirmed.',
    IMPORT_FAILED: 'The import could not be completed.'
});

const IMPORT_COPY = Object.freeze({
    ...Object.fromEntries(Object.values(IMPORT_ERROR_CODE).map(code => [
        code,
        'The import could not be completed.'
    ])),
    UNSUPPORTED_FORMAT: 'This format is not supported yet.',
    FILE_EMPTY: 'The selected file is empty.',
    FILE_CORRUPTED: 'The file may be damaged and was not written to the library.',
    STORAGE_UNAVAILABLE: 'The local library could not be opened.',
    STORAGE_QUOTA_EXCEEDED: 'Browser storage space is not sufficient for this import.',
    IMPORT_CANCELLED: 'Import cancelled. Completed items were kept.',
    ZIP_PATH_INVALID: 'The archive contains an unsafe path and was not imported.',
    ZIP_BOMB_RISK: 'The archive exceeds the safe compression ratio.',
    ZIP_CRC_MISMATCH: 'The archive failed its integrity check.',
    ZIP_ACTIVITIES_CSV_MISSING: 'The archive does not contain the required root activities.csv.',
    CSV_HEADER_INVALID: 'The CSV header is not supported.',
    CANDIDATE_LIMIT_EXCEEDED: 'Too many possible duplicates were found. Nothing was imported.'
});

const SAFE_UI_CODES = new Set([
    ...Object.keys(PREFLIGHT_COPY),
    ...Object.keys(IMPORT_COPY)
]);

const IMPORT_REPORT_CODES = new Set([
    ...Object.values(IMPORT_ERROR_CODE),
    'CANDIDATE_LIMIT_EXCEEDED'
]);

const TERMINAL_JOB_STATUSES = new Set([
    'completed', 'completed_with_warnings', 'failed_validation',
    'failed_decode', 'failed_storage', 'cancelled'
]);

const TERMINAL_ITEM_OUTCOMES = new Set([
    'completed', 'review_required', 'skipped_exact_duplicate', 'failed_validation',
    'failed_decode', 'failed_storage', 'cancelled'
]);

const MAX_VISIBLE_REPORT_ITEMS = 100;

function safeCode(error, fallback = 'IMPORT_FAILED') {
    try {
        if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
            return fallback;
        }
        const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
        return descriptor && Object.hasOwn(descriptor, 'value')
            && typeof descriptor.value === 'string'
            && SAFE_UI_CODES.has(descriptor.value)
            ? descriptor.value
            : fallback;
    } catch {
        return fallback;
    }
}

function safeCopy(code) {
    return PREFLIGHT_COPY[code] || IMPORT_COPY[code] || PREFLIGHT_COPY.IMPORT_FAILED;
}

function extension(name) {
    if (typeof name !== 'string') return '';
    const match = /\.([A-Za-z0-9]+)$/.exec(name);
    return match ? match[1].toLowerCase() : '';
}

function fileSnapshot(value) {
    try {
        if (typeof File === 'function' && value instanceof File) {
            const nameGetter = Object.getOwnPropertyDescriptor(File.prototype, 'name')?.get;
            const sizeGetter = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get;
            const typeGetter = Object.getOwnPropertyDescriptor(Blob.prototype, 'type')?.get;
            const arrayBuffer = Blob.prototype.arrayBuffer;
            if (
                typeof nameGetter !== 'function'
                || typeof sizeGetter !== 'function'
                || typeof typeGetter !== 'function'
                || typeof arrayBuffer !== 'function'
            ) return null;
            return Object.freeze({
                name: Reflect.apply(nameGetter, value, []),
                size: Reflect.apply(sizeGetter, value, []),
                type: Reflect.apply(typeGetter, value, []),
                read: () => Reflect.apply(arrayBuffer, value, [])
            });
        }
        if (value === null || typeof value !== 'object') return null;
        const descriptors = Object.getOwnPropertyDescriptors(value);
        if (
            !Object.hasOwn(descriptors, 'name')
            || !Object.hasOwn(descriptors.name, 'value')
            || !Object.hasOwn(descriptors, 'size')
            || !Object.hasOwn(descriptors.size, 'value')
            || !Object.hasOwn(descriptors, 'arrayBuffer')
            || !Object.hasOwn(descriptors.arrayBuffer, 'value')
            || typeof descriptors.arrayBuffer.value !== 'function'
        ) return null;
        return Object.freeze({
            name: descriptors.name.value,
            size: descriptors.size.value,
            type: Object.hasOwn(descriptors, 'type')
                && Object.hasOwn(descriptors.type, 'value')
                && typeof descriptors.type.value === 'string'
                ? descriptors.type.value
                : '',
            read: () => descriptors.arrayBuffer.value.call(value)
        });
    } catch {
        return null;
    }
}

function binaryBase64(bytes) {
    const parts = [];
    for (let offset = 0; offset < bytes.byteLength; offset += 32_768) {
        parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)));
    }
    return btoa(parts.join(''));
}

const FORMAT_MIME = Object.freeze({
    'text/csv': 'csv',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/vnd.ant.fit': 'fit',
    'application/vnd.garmin.tcx+xml': 'tcx',
    'application/gpx+xml': 'gpx'
});

function recognizedMimeFormat(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return FORMAT_MIME[normalized] || null;
}

function zipMagic(bytes) {
    return bytes.byteLength >= 4
        && bytes[0] === 0x50
        && bytes[1] === 0x4b
        && bytes[2] === 0x03
        && bytes[3] === 0x04;
}

function fitMagic(bytes) {
    return bytes.byteLength >= 12
        && (bytes[0] === 12 || bytes[0] === 14)
        && bytes[8] === 0x2e
        && bytes[9] === 0x46
        && bytes[10] === 0x49
        && bytes[11] === 0x54;
}

const XML_ROOT_SCAN_LIMIT = 65_536;

function isXmlSpace(code) {
    return code === 0x09 || code === 0x0a || code === 0x0d || code === 0x20;
}

function xmlRootFormat(text) {
    const limit = Math.min(text.length, XML_ROOT_SCAN_LIMIT);
    let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    let declarationSeen = false;
    while (cursor < limit) {
        while (cursor < limit && isXmlSpace(text.charCodeAt(cursor))) cursor += 1;
        if (text.startsWith('<!--', cursor)) {
            const end = text.indexOf('-->', cursor + 4);
            if (end < 0 || end + 3 > limit) return null;
            cursor = end + 3;
            continue;
        }
        if (!declarationSeen && text.startsWith('<?xml', cursor)) {
            const end = text.indexOf('?>', cursor + 5);
            if (end < 0 || end + 2 > limit) return null;
            declarationSeen = true;
            cursor = end + 2;
            continue;
        }
        break;
    }
    if (text[cursor] !== '<') return null;
    let quote = null;
    let end = -1;
    for (let index = cursor + 1; index < limit; index += 1) {
        const character = text[index];
        if (quote !== null) {
            if (character === quote) quote = null;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            end = index;
            break;
        }
    }
    if (end < 0) return null;
    const tag = text.slice(cursor, end + 1);
    const nameMatch = /^<([A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?)(?=[\u0009\u000a\u000d\u0020/>])/.exec(tag);
    if (!nameMatch) return null;
    const parts = nameMatch[1].split(':');
    const prefix = parts.length === 2 ? parts[0] : '';
    const localName = parts.length === 2 ? parts[1] : parts[0];
    const namespaces = new Map();
    const namespacePattern = /[\u0009\u000a\u000d\u0020]+xmlns(?::([A-Za-z_][A-Za-z0-9_.-]*))?\s*=\s*(["'])(.*?)\2/gs;
    for (const match of tag.matchAll(namespacePattern)) {
        const key = match[1] || '';
        if (namespaces.has(key)) return null;
        namespaces.set(key, match[3]);
    }
    const namespace = namespaces.get(prefix);
    if (
        localName === 'TrainingCenterDatabase'
        && namespace === 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2'
    ) return 'tcx';
    if (
        localName === 'gpx'
        && namespace === 'http://www.topografix.com/GPX/1/1'
    ) return 'gpx';
    return null;
}

function detectContent(bytes) {
    if (zipMagic(bytes)) return Object.freeze({ format: 'zip', text: null, records: null });
    if (fitMagic(bytes)) return Object.freeze({ format: 'fit', text: null, records: null });
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
    const xml = xmlRootFormat(text);
    if (xml) return Object.freeze({ format: xml, text, records: null });
    try {
        const decoded = decodeActivitiesCsvUtf8(bytes);
        const records = parseActivitiesCsv(decoded);
        const header = records[0] || [];
        if (
            records.length >= 2
            && ['Activity ID', 'Activity Date', 'Activity Type']
                .every(field => header.includes(field))
        ) return Object.freeze({ format: 'csv', text: decoded, records });
    } catch {
        // An unrecognized text payload remains a fixed preflight failure.
    }
    return null;
}

function preflightFailure(code, ordinal) {
    return Object.freeze({
        ok: false,
        code,
        copy: safeCopy(code),
        label: `File ${ordinal + 1}`
    });
}

function preliminaryFailure(code, ordinal) {
    return Object.freeze({ ordinal, result: preflightFailure(code, ordinal) });
}

export function planSourceFileBatches(values) {
    let files;
    try {
        files = Array.from(values);
    } catch {
        return Object.freeze({
            ok: false,
            code: 'FILE_READ_FAILED',
            copy: safeCopy('FILE_READ_FAILED')
        });
    }
    if (files.length > SOURCE_MANAGER_LIMITS.maxFiles) {
        return Object.freeze({
            ok: false,
            code: 'TOO_MANY_FILES',
            copy: safeCopy('TOO_MANY_FILES')
        });
    }
    const accepted = [];
    const rejected = [];
    let totalBytes = 0;
    for (let ordinal = 0; ordinal < files.length; ordinal += 1) {
        const snapshot = fileSnapshot(files[ordinal]);
        if (!snapshot || !Number.isSafeInteger(snapshot.size) || snapshot.size < 0) {
            rejected.push(preliminaryFailure('FILE_READ_FAILED', ordinal));
            continue;
        }
        totalBytes += snapshot.size;
        if (!Number.isSafeInteger(totalBytes) || totalBytes > SOURCE_MANAGER_LIMITS.maxSelectionBytes) {
            return Object.freeze({
                ok: false,
                code: 'SELECTION_TOO_LARGE',
                copy: safeCopy('SELECTION_TOO_LARGE')
            });
        }
        const kind = extension(snapshot.name);
        if (!['csv', 'zip', 'fit', 'tcx', 'gpx'].includes(kind)) {
            rejected.push(preliminaryFailure('FILE_TYPE_UNSUPPORTED', ordinal));
            continue;
        }
        const mimeFormat = recognizedMimeFormat(snapshot.type);
        if (mimeFormat !== null && mimeFormat !== kind) {
            rejected.push(preliminaryFailure('FILE_HEADER_INVALID', ordinal));
            continue;
        }
        const maximum = {
            csv: SOURCE_MANAGER_LIMITS.maxCsvBytes,
            zip: SOURCE_MANAGER_LIMITS.maxZipBytes,
            fit: SOURCE_MANAGER_LIMITS.maxFitBytes,
            tcx: SOURCE_MANAGER_LIMITS.maxTcxBytes,
            gpx: SOURCE_MANAGER_LIMITS.maxGpxBytes
        }[kind];
        if (snapshot.size > maximum) {
            rejected.push(preliminaryFailure('FILE_TOO_LARGE', ordinal));
            continue;
        }
        accepted.push(Object.freeze({ ordinal, kind, size: snapshot.size, file: files[ordinal] }));
    }

    const batches = [];
    let ordinary = [];
    let ordinaryBytes = 0;
    const flushOrdinary = () => {
        if (ordinary.length === 0) return;
        batches.push(Object.freeze({
            kind: 'ordinary',
            bytes: ordinaryBytes,
            files: Object.freeze(ordinary.map(entry => entry.file)),
            ordinals: Object.freeze(ordinary.map(entry => entry.ordinal))
        }));
        ordinary = [];
        ordinaryBytes = 0;
    };
    for (const entry of accepted) {
        if (entry.kind === 'csv' || entry.kind === 'zip') {
            flushOrdinary();
            batches.push(Object.freeze({
                kind: 'container',
                bytes: entry.size,
                files: Object.freeze([entry.file]),
                ordinals: Object.freeze([entry.ordinal])
            }));
            continue;
        }
        if (
            ordinary.length === SOURCE_MANAGER_LIMITS.maxOrdinaryFilesPerJob
            || ordinaryBytes + entry.size > SOURCE_MANAGER_LIMITS.maxOrdinaryBytesPerJob
        ) flushOrdinary();
        ordinary.push(entry);
        ordinaryBytes += entry.size;
    }
    flushOrdinary();
    return Object.freeze({
        ok: true,
        artifactCount: files.length,
        acceptedCount: accepted.length,
        totalBytes,
        rejected: Object.freeze(rejected),
        batches: Object.freeze(batches)
    });
}

export async function preflightSourceFiles(values) {
    let files;
    try {
        files = Array.from(values);
    } catch {
        return Object.freeze([preflightFailure('FILE_READ_FAILED', 0)]);
    }
    const plan = planSourceFileBatches(files);
    if (!plan.ok) {
        return Object.freeze([preflightFailure(plan.code, 0)]);
    }
    const results = [];
    for (let ordinal = 0; ordinal < files.length; ordinal += 1) {
        const file = fileSnapshot(files[ordinal]);
        if (!file || !Number.isSafeInteger(file.size) || file.size < 0) {
            results.push(preflightFailure('FILE_READ_FAILED', ordinal));
            continue;
        }
        const kind = extension(file.name);
        if (!['csv', 'zip', 'fit', 'tcx', 'gpx'].includes(kind)) {
            results.push(preflightFailure('FILE_TYPE_UNSUPPORTED', ordinal));
            continue;
        }
        const mimeFormat = recognizedMimeFormat(file.type);
        if (mimeFormat !== null && mimeFormat !== kind) {
            results.push(preflightFailure('FILE_HEADER_INVALID', ordinal));
            continue;
        }
        const maximum = {
            csv: SOURCE_MANAGER_LIMITS.maxCsvBytes,
            zip: SOURCE_MANAGER_LIMITS.maxZipBytes,
            fit: SOURCE_MANAGER_LIMITS.maxFitBytes,
            tcx: SOURCE_MANAGER_LIMITS.maxTcxBytes,
            gpx: SOURCE_MANAGER_LIMITS.maxGpxBytes
        }[kind];
        if (file.size > maximum) {
            results.push(preflightFailure('FILE_TOO_LARGE', ordinal));
            continue;
        }
        let bytes;
        try {
            bytes = new Uint8Array(await file.read());
        } catch {
            results.push(preflightFailure('FILE_READ_FAILED', ordinal));
            continue;
        }
        if (bytes.byteLength !== file.size) {
            results.push(preflightFailure('FILE_READ_FAILED', ordinal));
            continue;
        }
        const detected = detectContent(bytes);
        if (!detected || detected.format !== kind) {
            results.push(preflightFailure('FILE_HEADER_INVALID', ordinal));
            continue;
        }
        if (kind === 'zip') {
            results.push(Object.freeze({
                ok: true,
                label: `ZIP file ${ordinal + 1}`,
                format: 'zip',
                rows: null,
                artifact: Object.freeze({
                    mediaType: STRAVA_ZIP_MEDIA_TYPE,
                    content: binaryBase64(bytes)
                })
            }));
            continue;
        }
        if (kind === 'fit') {
            results.push(Object.freeze({
                ok: true,
                label: `FIT file ${ordinal + 1}`,
                format: 'fit',
                rows: null,
                artifact: Object.freeze({
                    mediaType: FIT_MEDIA_TYPE,
                    content: binaryBase64(bytes)
                })
            }));
            continue;
        }
        if (kind === 'tcx' || kind === 'gpx') {
            results.push(Object.freeze({
                ok: true,
                label: `${kind.toUpperCase()} file ${ordinal + 1}`,
                format: kind,
                rows: null,
                artifact: Object.freeze({
                    mediaType: kind === 'tcx' ? TCX_MEDIA_TYPE : GPX_MEDIA_TYPE,
                    content: detected.text
                })
            }));
            continue;
        }
        results.push(Object.freeze({
            ok: true,
            label: `CSV file ${ordinal + 1}`,
            format: 'csv',
            rows: detected.records.length - 1,
            artifact: Object.freeze({
                mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
                content: detected.text
            })
        }));
    }
    return Object.freeze(results);
}

function text(document, tag, value, className = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
}

function reportCategory(outcome) {
    if (outcome === 'completed') return 'success';
    if (outcome === 'review_required') return 'review';
    if (outcome === 'skipped_exact_duplicate') return 'skipped';
    if (outcome === 'cancelled') return 'cancelled';
    return outcome.startsWith('failed_') ? 'failed' : 'all';
}

export function sourceManagerReportItemCode(item) {
    try {
        if (item === null || typeof item !== 'object') return 'IMPORT_FAILED';
        const descriptors = Object.getOwnPropertyDescriptors(item);
        const errorDescriptor = descriptors.errorCode;
        if (
            errorDescriptor
            && Object.hasOwn(errorDescriptor, 'value')
            && errorDescriptor.value !== null
        ) {
            return typeof errorDescriptor.value === 'string'
                && IMPORT_REPORT_CODES.has(errorDescriptor.value)
                ? errorDescriptor.value
                : 'IMPORT_FAILED';
        }
        const outcomeDescriptor = descriptors.outcome;
        return outcomeDescriptor
            && Object.hasOwn(outcomeDescriptor, 'value')
            && TERMINAL_ITEM_OUTCOMES.has(outcomeDescriptor.value)
            ? outcomeDescriptor.value
            : 'IMPORT_FAILED';
    } catch {
        return 'IMPORT_FAILED';
    }
}

function isReport(value) {
    return value && typeof value === 'object'
        && typeof value.status === 'string'
        && value.totals && Array.isArray(value.items);
}

function validConnectionSnapshot(value) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return false;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== 4
            || !['schemaVersion', 'status', 'code', 'actions'].every(key => keys.includes(key))
        ) return false;
        const read = key => {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
                ? descriptor.value
                : undefined;
        };
        const actions = read('actions');
        if (actions === null || typeof actions !== 'object' || Array.isArray(actions)) return false;
        const actionsPrototype = Object.getPrototypeOf(actions);
        if (actionsPrototype !== Object.prototype && actionsPrototype !== null) return false;
        const actionKeys = Reflect.ownKeys(actions);
        if (
            actionKeys.length !== 4
            || !actionKeys.includes('connect')
            || !actionKeys.includes('reconnect')
            || !actionKeys.includes('sync')
            || !actionKeys.includes('disconnect')
        ) return false;
        const action = key => {
            const descriptor = Object.getOwnPropertyDescriptor(actions, key);
            return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
                ? descriptor.value
                : undefined;
        };
        const status = read('status');
        const code = read('code');
        return read('schemaVersion') === 1
            && [
                'unconfigured', 'authorizing', 'callback_processing',
                'connected', 'reconnect_required', 'error',
                'disconnecting', 'disconnected', 'closed'
            ].includes(status)
            && (code === null || (typeof code === 'string' && SAFE_UI_CODES.has(code)))
            && ['connect', 'reconnect', 'sync', 'disconnect'].every(
                key => typeof action(key) === 'boolean'
            );
    } catch {
        return false;
    }
}

export function createSourceManagerPage({
    document,
    sessionMode,
    importFacade,
    connectionFacade = null
}) {
    const elements = Object.freeze({
        blocking: document.getElementById('blocking-error'),
        blockingCode: document.getElementById('blocking-error-code'),
        blockingCopy: document.getElementById('blocking-error-copy'),
        apiCopy: document.getElementById('source-api-copy'),
        apiConnect: document.getElementById('source-api-connect'),
        apiSync: document.getElementById('source-api-sync'),
        apiDisconnect: document.getElementById('source-api-disconnect'),
        disconnectDialog: document.getElementById('disconnect-dialog'),
        disconnectDialogTitle: document.getElementById('disconnect-dialog-title'),
        disconnectCancel: document.getElementById('disconnect-cancel'),
        disconnectConfirm: document.getElementById('disconnect-confirm'),
        firstRun: document.getElementById('first-run'),
        sessionLabel: document.getElementById('session-label'),
        previewTotal: document.getElementById('preview-total'),
        previewList: document.getElementById('preview-list'),
        reportList: document.getElementById('report-list'),
        reviewSection: document.getElementById('duplicate-review'),
        reviewState: document.getElementById('duplicate-review-state'),
        reviewList: document.getElementById('duplicate-review-list'),
        reviewDialog: document.getElementById('duplicate-review-dialog'),
        reviewDialogTitle: document.getElementById('duplicate-review-dialog-title'),
        reviewConfidence: document.getElementById('duplicate-review-confidence'),
        reviewComparison: document.getElementById('duplicate-review-comparison'),
        reviewConfirm: document.getElementById('duplicate-review-confirm'),
        reviewSeparate: document.getElementById('duplicate-review-separate'),
        reviewLater: document.getElementById('duplicate-review-later'),
        dialog: document.getElementById('import-dialog'),
        dialogTitle: document.getElementById('import-dialog-title'),
        fileInput: document.getElementById('file-input'),
        chooseFiles: document.getElementById('choose-files'),
        dropzone: document.getElementById('dropzone'),
        selectionSummary: document.getElementById('selection-summary'),
        selectionList: document.getElementById('selection-list'),
        dialogError: document.getElementById('dialog-error'),
        dialogErrorCode: document.getElementById('dialog-error-code'),
        dialogErrorCopy: document.getElementById('dialog-error-copy'),
        progress: document.getElementById('import-progress'),
        progressBar: document.getElementById('progress-bar'),
        progressCount: document.getElementById('progress-count'),
        progressStatus: document.getElementById('progress-status'),
        cancelImport: document.getElementById('cancel-import'),
        startImport: document.getElementById('start-import'),
        close: document.getElementById('dialog-close'),
        closeIcon: document.getElementById('dialog-close-icon'),
        live: document.getElementById('import-live'),
        alert: document.getElementById('import-alert')
    });
    let selection = null;
    let opener = null;
    let activeSource = null;
    let activeJobId = null;
    let activeReviewToken = null;
    let importActive = false;
    let batchCancellationRequested = false;
    let closed = false;

    function setSourceStatus(source, status) {
        const card = document.querySelector(`[data-source-card="${source}"]`);
        const badge = document.querySelector(`[data-source-status="${source}"]`);
        if (!card || !badge) return;
        const labels = {
            not_configured: 'Not configured', available: 'Available',
            unconfigured: 'Not connected', authorizing: 'Authorization in progress',
            callback_processing: 'Authorization in progress', connected: 'Connected locally',
            reconnect_required: 'Reconnect required', disconnecting: 'Disconnecting',
            disconnected: 'Disconnected', closed: 'Disconnected',
            importing: 'Importing', success: 'Success', error: 'Error'
        };
        card.dataset.status = status;
        badge.textContent = status === 'error' && source === 'api'
            ? 'Connection error'
            : labels[status] || 'Error';
    }

    function renderConnectionSnapshot(snapshot) {
        if (!validConnectionSnapshot(snapshot)) {
            showBlockingError(Object.freeze({ code: 'CONNECTION_INITIALIZATION_FAILED' }));
            return false;
        }
        setSourceStatus('api', snapshot.status);
        const copy = {
            unconfigured: 'Connect only after confirming that this is the Strava account for this local library.',
            authorizing: 'Continue authorization in this tab.',
            callback_processing: 'Completing authorization locally.',
            connected: 'Authorization is stored locally and is not automatically checked.',
            reconnect_required: 'Reconnect explicitly to restore exact local authorization.',
            error: snapshot.code === null
                ? 'The connection could not be used.'
                : safeCopy(snapshot.code),
            disconnecting: 'Removing local authorization and requesting provider revocation.',
            disconnected: snapshot.code === 'REVOCATION_UNCONFIRMED'
                ? 'Disconnected locally. Provider revocation was not confirmed.'
                : 'Disconnected locally. Local data was preserved.',
            closed: 'Connection controls are closed.'
        };
        elements.apiCopy.textContent = copy[snapshot.status];
        elements.apiConnect.textContent = snapshot.actions.reconnect ? 'Reconnect' : 'Connect';
        elements.apiConnect.disabled = !snapshot.actions.connect && !snapshot.actions.reconnect;
        elements.apiConnect.hidden = !snapshot.actions.connect && !snapshot.actions.reconnect;
        elements.apiSync.disabled = true;
        elements.apiSync.hidden = snapshot.status !== 'connected' && snapshot.status !== 'error';
        elements.apiDisconnect.disabled = !snapshot.actions.disconnect;
        elements.apiDisconnect.hidden = !snapshot.actions.disconnect;
        return true;
    }

    async function beginConnection() {
        try {
            const pending = connectionFacade.beginConnect();
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
            await pending;
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
        } catch (error) {
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
            elements.alert.textContent = safeCopy(safeCode(error));
            recordDiagnosticError({
                page: 'source-manager', category: 'connection',
                code: 'SOURCE_MANAGER_OPERATION_FAILED'
            });
        }
    }

    async function confirmDisconnect() {
        elements.disconnectConfirm.disabled = true;
        elements.disconnectCancel.disabled = true;
        elements.disconnectDialog.close();
        try {
            const pending = connectionFacade.disconnect();
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
            await pending;
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
        } catch (error) {
            renderConnectionSnapshot(connectionFacade.getConnectionSnapshot());
            elements.alert.textContent = safeCopy(safeCode(error));
        } finally {
            elements.disconnectConfirm.disabled = false;
            elements.disconnectCancel.disabled = false;
        }
    }

    function showError(error) {
        const code = safeCode(error);
        recordDiagnosticError({
            page: 'source-manager',
            category: 'page',
            code: 'SOURCE_MANAGER_OPERATION_FAILED'
        });
        elements.dialogErrorCode.textContent = code;
        elements.dialogErrorCopy.textContent = safeCopy(code);
        elements.dialogError.hidden = false;
        elements.alert.textContent = `${code}. ${safeCopy(code)}`;
    }

    function showBlockingError(error) {
        const code = safeCode(error, 'STORAGE_UNAVAILABLE');
        recordDiagnosticError({
            page: 'source-manager',
            category: 'page',
            code: 'SOURCE_MANAGER_START_FAILED'
        });
        elements.blockingCode.textContent = code;
        elements.blockingCopy.textContent = safeCopy(code);
        elements.blocking.hidden = false;
    }

    function renderPreview(preview) {
        const total = Number.isSafeInteger(preview?.total) ? preview.total : 0;
        elements.firstRun.hidden = total !== 0;
        elements.previewTotal.textContent = `${total} ${total === 1 ? 'activity' : 'activities'}`;
        elements.previewList.replaceChildren();
        const categories = Array.isArray(preview?.bySportCategory)
            ? preview.bySportCategory : [];
        if (categories.length === 0) {
            elements.previewList.append(text(document, 'li', 'No imported activities yet.'));
            return;
        }
        for (const entry of categories) {
            const category = typeof entry?.sportCategory === 'string'
                ? entry.sportCategory : 'other';
            const count = Number.isSafeInteger(entry?.count) ? entry.count : 0;
            elements.previewList.append(text(document, 'li', `${category}: ${count}`));
        }
    }

    function renderReports(reports, filter = 'all') {
        elements.reportList.replaceChildren();
        const safeReports = Array.isArray(reports) ? reports.filter(isReport) : [];
        if (safeReports.length === 0) {
            elements.reportList.append(text(document, 'p', 'No imports recorded.', 'empty-copy'));
            return;
        }
        safeReports.forEach((report, reportIndex) => {
            const card = text(document, 'article', '', 'report-card');
            const heading = text(document, 'h3', `Import ${reportIndex + 1}`);
            const summary = text(document, 'div', '', 'report-card__summary');
            summary.append(
                text(document, 'span', `Status: ${report.status}`),
                text(document, 'span', `Success: ${report.totals.completed}`),
                text(document, 'span', `Review: ${report.totals.reviewRequired || 0}`),
                text(document, 'span', `Skipped: ${report.totals.skippedExactDuplicate}`),
                text(document, 'span', `Failed: ${report.totals.failed}`),
                text(document, 'span', `Cancelled: ${report.totals.cancelled}`)
            );
            const list = text(document, 'ul', '', 'report-items');
            const matchingItems = report.items.filter(item => {
                const category = reportCategory(item.outcome);
                return filter === 'all' || category === filter;
            });
            for (const item of matchingItems.slice(0, MAX_VISIBLE_REPORT_ITEMS)) {
                const category = reportCategory(item.outcome);
                const row = text(document, 'li', '', 'report-item');
                row.dataset.reportCategory = category;
                row.append(
                    text(document, 'span', `Item ${item.ordinal + 1}`),
                    text(document, 'code', sourceManagerReportItemCode(item))
                );
                list.append(row);
            }
            card.append(heading, summary, list);
            const hiddenCount = matchingItems.length - MAX_VISIBLE_REPORT_ITEMS;
            if (hiddenCount > 0) {
                card.append(text(
                    document,
                    'p',
                    `${hiddenCount} additional items are not shown.`,
                    'report-items__remainder'
                ));
            }
            elements.reportList.append(card);
        });
    }

    function metric(value, suffix = '') {
        return typeof value === 'number' && Number.isFinite(value)
            ? `${value}${suffix}`
            : 'Unavailable';
    }

    function renderReviewActivity(activity, ordinal) {
        const card = text(
            document,
            'article',
            '',
            'duplicate-review-comparison__activity'
        );
        card.append(text(document, 'h3', `Activity ${ordinal}`));
        const list = text(document, 'dl', '', 'duplicate-review-facts');
        const facts = [
            ['Start', activity.startTimeUtc],
            ['Sport', activity.sportCategory],
            ['Distance', metric(activity.distanceMeters, ' m')],
            ['Moving duration', metric(activity.movingTimeSeconds, ' s')],
            ['GPS available', activity.capabilities?.hasGps ? 'Yes' : 'No'],
            ['Heart-rate available', activity.capabilities?.hasHeartRate ? 'Yes' : 'No'],
            ['Power available', activity.capabilities?.hasPower ? 'Yes' : 'No'],
            ['Cadence available', activity.capabilities?.hasCadence ? 'Yes' : 'No'],
            ['Sources', activity.sourceLabel],
            ['Device', activity.deviceLabel],
            ['Laps', metric(activity.lapCount)]
        ];
        for (const [label, value] of facts) {
            list.append(
                text(document, 'dt', label),
                text(document, 'dd', typeof value === 'string' ? value : 'Unavailable')
            );
        }
        card.append(list);
        return card;
    }

    async function openDuplicateReview(event) {
        const token = event.currentTarget?.dataset?.reviewToken;
        if (typeof token !== 'string' || token.length === 0) return;
        elements.reviewState.textContent = 'Loading comparison.';
        try {
            const detail = await importFacade.getDuplicateReview(token);
            if (
                !detail
                || detail.token !== token
                || !Array.isArray(detail.activities)
                || detail.activities.length !== 2
            ) {
                throw Object.freeze({ code: 'REVIEW_STALE' });
            }
            activeReviewToken = token;
            elements.reviewConfidence.textContent = detail.confidence === 'high'
                ? 'High similarity' : 'Possible similarity';
            elements.reviewComparison.replaceChildren(
                renderReviewActivity(detail.activities[0], 1),
                renderReviewActivity(detail.activities[1], 2)
            );
            elements.reviewDialog.showModal();
            queueMicrotask(() => elements.reviewDialogTitle.focus());
            elements.reviewState.textContent = 'Comparison ready.';
        } catch (error) {
            const code = safeCode(error, 'REVIEW_STALE');
            elements.reviewState.textContent = safeCopy(code);
            elements.alert.textContent = `${code}. ${safeCopy(code)}`;
        }
    }

    function renderDuplicateReviews(reviews) {
        elements.reviewList.replaceChildren();
        const safeReviews = Array.isArray(reviews) ? reviews : [];
        if (sessionMode !== SOURCE_MANAGER_SESSION_MODE.REAL) {
            elements.reviewState.textContent = 'Duplicate review is unavailable in Demo mode.';
            return;
        }
        if (safeReviews.length === 0) {
            elements.reviewState.textContent = 'No possible duplicates need review.';
            return;
        }
        elements.reviewState.textContent = `${safeReviews.length} possible ${
            safeReviews.length === 1 ? 'duplicate needs' : 'duplicates need'
        } review.`;
        safeReviews.forEach((review, index) => {
            const card = text(document, 'article', '', 'duplicate-review-card');
            card.append(
                text(document, 'h3', `Candidate ${index + 1}`),
                text(
                    document,
                    'p',
                    review.confidence === 'high'
                        ? 'High similarity' : 'Possible similarity',
                    'duplicate-review-card__confidence'
                )
            );
            const button = text(document, 'button', 'Review comparison', 'button');
            button.type = 'button';
            button.dataset.reviewToken = review.token;
            button.addEventListener('click', openDuplicateReview);
            card.append(button);
            elements.reviewList.append(card);
        });
    }

    function closeDuplicateReview() {
        activeReviewToken = null;
        elements.reviewComparison.replaceChildren();
        if (elements.reviewDialog.open) elements.reviewDialog.close();
    }

    async function decideDuplicateReview(decision) {
        if (activeReviewToken === null) return;
        elements.reviewConfirm.disabled = true;
        elements.reviewSeparate.disabled = true;
        try {
            const result = await importFacade.decideDuplicateReview(
                activeReviewToken,
                decision
            );
            closeDuplicateReview();
            elements.live.textContent = result.status === 'confirmed_same'
                ? 'Same-activity intent recorded. Both activities remain in the library.'
                : 'Keep-separate decision recorded. Both activities remain in the library.';
            renderDuplicateReviews(await importFacade.listDuplicateReviews());
        } catch (error) {
            const code = safeCode(error, 'REVIEW_DECISION_FAILED');
            elements.reviewState.textContent = safeCopy(code);
            elements.alert.textContent = `${code}. ${safeCopy(code)}`;
        } finally {
            elements.reviewConfirm.disabled = false;
            elements.reviewSeparate.disabled = false;
        }
    }

    function renderProgress(report, completedBefore = 0, selectionTotal = report.totals.total) {
        const completed = report.items.filter(item => TERMINAL_ITEM_OUTCOMES.has(item.outcome)).length;
        const aggregateCompleted = completedBefore + completed;
        elements.progress.hidden = false;
        elements.progressBar.max = Math.max(1, selectionTotal);
        elements.progressBar.value = Math.min(selectionTotal, aggregateCompleted);
        elements.progressCount.textContent = `${aggregateCompleted} of ${selectionTotal} complete`;
        elements.progressStatus.textContent = `Current stage: ${report.status}`;
        elements.live.textContent = `Import stage ${report.status}. ${aggregateCompleted} of ${selectionTotal} items complete.`;
    }

    async function refreshPublicReads() {
        const [preview, reports, reviews] = await Promise.all([
            importFacade.previewActivities(),
            importFacade.listPersistedReports(),
            importFacade.listDuplicateReviews()
        ]);
        renderPreview(preview);
        renderReports(reports);
        renderDuplicateReviews(reviews);
    }

    function resetDialog() {
        selection = null;
        batchCancellationRequested = false;
        elements.fileInput.value = '';
        elements.selectionSummary.hidden = true;
        elements.selectionList.replaceChildren();
        elements.dialogError.hidden = true;
        elements.progress.hidden = true;
        elements.startImport.disabled = true;
        elements.cancelImport.disabled = false;
    }

    function closeDialog() {
        if (importActive) return;
        if (elements.dialog.open) elements.dialog.close();
        resetDialog();
        const target = opener;
        opener = null;
        target?.focus();
    }

    function openDialog(event) {
        if (sessionMode !== SOURCE_MANAGER_SESSION_MODE.REAL) {
            showError(Object.freeze({ code: 'DEMO_IMPORT_UNAVAILABLE' }));
            return;
        }
        opener = event.currentTarget;
        activeSource = event.currentTarget.dataset.openImport;
        resetDialog();
        elements.dialog.showModal();
        queueMicrotask(() => elements.dialogTitle.focus());
    }

    async function acceptFiles(values) {
        elements.dialogError.hidden = true;
        const plan = planSourceFileBatches(values);
        elements.selectionList.replaceChildren();
        if (!plan.ok) {
            selection = null;
            showError(Object.freeze({ code: plan.code }));
            elements.selectionSummary.hidden = false;
            elements.startImport.disabled = true;
            elements.fileInput.value = '';
            return;
        }
        selection = plan;
        const entries = plan.batches.flatMap(batch => batch.ordinals.map((ordinal, index) => ({
            ordinal,
            kind: batch.kind === 'container'
                ? extension(fileSnapshot(batch.files[index])?.name)
                : 'file'
        })));
        const visible = entries.slice(0, MAX_VISIBLE_REPORT_ITEMS);
        for (const entry of visible) {
            const label = entry.kind === 'file'
                ? `File ${entry.ordinal + 1}`
                : `${entry.kind.toUpperCase()} file ${entry.ordinal + 1}`;
            elements.selectionList.append(text(document, 'li', `${label} — ready`));
        }
        for (const rejected of plan.rejected.slice(0, Math.max(0, MAX_VISIBLE_REPORT_ITEMS - visible.length))) {
            elements.selectionList.append(text(
                document,
                'li',
                `${rejected.result.label} — ${rejected.result.code}: ${rejected.result.copy}`
            ));
        }
        const hidden = plan.artifactCount - elements.selectionList.children.length;
        if (hidden > 0) {
            elements.selectionList.append(text(document, 'li', `${hidden} additional files are not shown.`));
        }
        elements.selectionSummary.hidden = plan.artifactCount === 0;
        elements.startImport.disabled = plan.acceptedCount === 0;
        const rejected = plan.rejected.length;
        elements.live.textContent = `${plan.acceptedCount} files ready. ${rejected} files rejected.`;
        if (rejected > 0) {
            elements.alert.textContent = `${rejected} selected files were rejected by preflight.`;
        }
        elements.fileInput.value = '';
    }

    async function startImport() {
        if (!selection || selection.acceptedCount === 0 || importActive) return;
        const currentSelection = selection;
        importActive = true;
        batchCancellationRequested = false;
        beginImportPerformanceSelection(currentSelection.artifactCount);
        elements.startImport.disabled = true;
        elements.close.disabled = true;
        elements.closeIcon.disabled = true;
        setSourceStatus(activeSource, 'importing');
        const terminalCounts = {
            completed: 0,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: currentSelection.rejected.length,
            cancelled: 0,
            notStarted: 0
        };
        let processedAcceptedFiles = 0;
        let outcome = 'completed';
        try {
            for (const batch of currentSelection.batches) {
                if (batchCancellationRequested || closed) break;
                const results = await preflightSourceFiles(batch.files);
                const artifacts = results.filter(result => result.ok).map(result => result.artifact);
                terminalCounts.failed += results.length - artifacts.length;
                processedAcceptedFiles += results.length - artifacts.length;
                if (batchCancellationRequested || closed) break;
                if (artifacts.length === 0) continue;
                const started = await importFacade.importArtifacts(artifacts);
                activeJobId = started.jobId;
                if (batchCancellationRequested) {
                    await importFacade.cancelJob(activeJobId);
                }
                while (!closed) {
                    const report = await importFacade.getReport(activeJobId);
                    renderProgress(
                        report,
                        currentSelection.rejected.length + processedAcceptedFiles,
                        currentSelection.artifactCount
                    );
                    if (TERMINAL_JOB_STATUSES.has(report.status)) break;
                    await new Promise(resolve => setTimeout(resolve, 40));
                }
                const report = await importFacade.waitForJob(activeJobId);
                renderProgress(
                    report,
                    currentSelection.rejected.length + processedAcceptedFiles,
                    currentSelection.artifactCount
                );
                for (const field of ['completed', 'reviewRequired', 'skippedExactDuplicate', 'failed', 'cancelled']) {
                    terminalCounts[field] += report.totals[field] || 0;
                }
                processedAcceptedFiles += artifacts.length;
                activeJobId = null;
                const quota = report.status === 'failed_storage'
                    || report.items.some(item => item.errorCode === 'STORAGE_QUOTA_EXCEEDED');
                if (quota) {
                    outcome = 'failed';
                    break;
                }
                if (report.status === 'cancelled') {
                    batchCancellationRequested = true;
                    outcome = 'cancelled';
                    break;
                }
                if (report.totals.failed > 0 || report.status !== 'completed') {
                    outcome = 'completed_with_warnings';
                }
            }
            terminalCounts.notStarted = Math.max(
                0,
                currentSelection.acceptedCount - processedAcceptedFiles
            );
            if (batchCancellationRequested) outcome = 'cancelled';
            const failed = terminalCounts.failed > 0 || outcome === 'failed';
            setSourceStatus(activeSource, failed ? 'error' : 'success');
            if (outcome === 'cancelled') {
                elements.live.textContent = 'Import cancelled. Completed items were kept.';
            } else if (terminalCounts.skippedExactDuplicate > 0 && terminalCounts.completed === 0) {
                elements.live.textContent = 'These files were already imported exactly; no second activities were created.';
            } else {
                elements.live.textContent = outcome === 'completed'
                    ? 'Import completed.' : 'Import completed with warnings.';
            }
            await refreshPublicReads();
        } catch (error) {
            outcome = 'failed';
            setSourceStatus(activeSource, 'error');
            showError(error);
        } finally {
            terminalCounts.notStarted = Math.max(
                terminalCounts.notStarted,
                currentSelection.acceptedCount - processedAcceptedFiles
            );
            finishImportPerformanceSelection({ outcome, terminalCounts });
            activeJobId = null;
            importActive = false;
            elements.close.disabled = false;
            elements.closeIcon.disabled = false;
            elements.cancelImport.disabled = false;
        }
    }

    async function cancelImport() {
        if (!importActive) return;
        batchCancellationRequested = true;
        observeImportCancellation();
        elements.cancelImport.disabled = true;
        elements.progressStatus.textContent = 'Cancellation requested.';
        elements.live.textContent = 'Cancellation requested.';
        if (activeJobId === null) return;
        try {
            await importFacade.cancelJob(activeJobId);
        } catch (error) {
            showError(error);
            elements.cancelImport.disabled = false;
        }
    }

    function bind() {
        if (sessionMode === SOURCE_MANAGER_SESSION_MODE.REAL) {
            elements.apiConnect.addEventListener('click', beginConnection);
            elements.apiDisconnect.addEventListener('click', () => {
                elements.disconnectDialog.showModal();
                queueMicrotask(() => elements.disconnectDialogTitle.focus());
            });
            elements.disconnectCancel.addEventListener('click', () => {
                elements.disconnectDialog.close();
                elements.apiDisconnect.focus();
            });
            elements.disconnectConfirm.addEventListener('click', confirmDisconnect);
            elements.disconnectDialog.addEventListener('cancel', event => {
                event.preventDefault();
                elements.disconnectDialog.close();
                elements.apiDisconnect.focus();
            });
        }
        document.querySelectorAll('[data-open-import]').forEach(button => {
            button.addEventListener('click', openDialog);
            if (sessionMode !== SOURCE_MANAGER_SESSION_MODE.REAL) button.disabled = true;
        });
        document.getElementById('demo-info-button')?.addEventListener('click', () => {
            elements.live.textContent = 'Demo seed import is not available in this milestone.';
        });
        elements.chooseFiles.addEventListener('click', event => {
            event.stopPropagation();
            elements.fileInput.click();
        });
        elements.dropzone.addEventListener('click', event => {
            if (event.target !== elements.chooseFiles) elements.fileInput.click();
        });
        elements.dropzone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                elements.fileInput.click();
            }
        });
        elements.fileInput.addEventListener('change', () => acceptFiles(elements.fileInput.files));
        for (const type of ['dragenter', 'dragover']) {
            elements.dropzone.addEventListener(type, event => {
                event.preventDefault();
                elements.dropzone.classList.add('is-dragging');
            });
        }
        for (const type of ['dragleave', 'drop']) {
            elements.dropzone.addEventListener(type, event => {
                event.preventDefault();
                elements.dropzone.classList.remove('is-dragging');
            });
        }
        elements.dropzone.addEventListener('drop', event => acceptFiles(event.dataTransfer.files));
        elements.startImport.addEventListener('click', startImport);
        elements.cancelImport.addEventListener('click', cancelImport);
        elements.close.addEventListener('click', closeDialog);
        elements.closeIcon.addEventListener('click', event => {
            event.preventDefault();
            closeDialog();
        });
        elements.dialog.addEventListener('cancel', event => {
            event.preventDefault();
            closeDialog();
        });
        elements.reviewConfirm.addEventListener('click', () => (
            decideDuplicateReview('confirmed_same')
        ));
        elements.reviewSeparate.addEventListener('click', () => (
            decideDuplicateReview('rejected')
        ));
        elements.reviewLater.addEventListener('click', closeDuplicateReview);
        elements.reviewDialog.addEventListener('cancel', event => {
            event.preventDefault();
            closeDuplicateReview();
        });
        document.querySelectorAll('[data-report-filter]').forEach(button => {
            button.addEventListener('click', async () => {
                document.querySelectorAll('[data-report-filter]').forEach(item => {
                    const active = item === button;
                    item.classList.toggle('is-active', active);
                    item.setAttribute('aria-pressed', String(active));
                });
                renderReports(await importFacade.listPersistedReports(), button.dataset.reportFilter);
            });
        });
    }

    async function initialize() {
        bind();
        elements.sessionLabel.textContent = sessionMode === SOURCE_MANAGER_SESSION_MODE.DEMO
            ? 'Demo presentation session' : 'Real local library';
        setSourceStatus('demo', sessionMode === SOURCE_MANAGER_SESSION_MODE.DEMO
            ? 'available' : 'not_configured');
        if (sessionMode === SOURCE_MANAGER_SESSION_MODE.REAL) {
            let snapshot = null;
            try {
                snapshot = connectionFacade?.getConnectionSnapshot();
            } catch {
                // The page exposes only the fixed unavailable state.
            }
            renderConnectionSnapshot(snapshot);
        } else {
            setSourceStatus('api', 'unconfigured');
            elements.apiCopy.textContent = 'Demo — no provider connection';
            elements.apiConnect.hidden = true;
            elements.apiConnect.disabled = true;
            elements.apiSync.hidden = true;
            elements.apiSync.disabled = true;
            elements.apiDisconnect.hidden = true;
            elements.apiDisconnect.disabled = true;
        }
        try {
            await importFacade.initialize();
            await refreshPublicReads();
        } catch (error) {
            showBlockingError(error);
        }
        return Object.freeze({ status: 'ready' });
    }

    async function close() {
        closed = true;
        if (sessionMode === SOURCE_MANAGER_SESSION_MODE.REAL) {
            await connectionFacade?.close();
        }
        await importFacade.close();
        return Object.freeze({ status: 'closed' });
    }

    return Object.freeze({ initialize, close, showBlockingError });
}
