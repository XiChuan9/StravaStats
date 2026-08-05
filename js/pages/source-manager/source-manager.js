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

export const SOURCE_MANAGER_SESSION_MODE = Object.freeze({
    REAL: 'real',
    DEMO: 'demo'
});

export const SOURCE_MANAGER_LIMITS = Object.freeze({
    maxFiles: 100,
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
    TOO_MANY_FILES: 'Select no more than 100 files at a time.',
    FILE_READ_FAILED: 'The file could not be read.',
    DEMO_IMPORT_UNAVAILABLE: 'Demo import is not available in this milestone.',
    INVALID_SESSION_MODE: 'The requested Source Manager session mode is invalid.',
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
    CSV_HEADER_INVALID: 'The CSV header is not supported.'
});

const SAFE_UI_CODES = new Set([
    ...Object.keys(PREFLIGHT_COPY),
    ...Object.keys(IMPORT_COPY)
]);

const IMPORT_REPORT_CODES = new Set(Object.values(IMPORT_ERROR_CODE));

const TERMINAL_JOB_STATUSES = new Set([
    'completed', 'completed_with_warnings', 'failed_validation',
    'failed_decode', 'failed_storage', 'cancelled'
]);

const TERMINAL_ITEM_OUTCOMES = new Set([
    'completed', 'skipped_exact_duplicate', 'failed_validation',
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

export async function preflightSourceFiles(values) {
    let files;
    try {
        files = Array.from(values);
    } catch {
        return Object.freeze([preflightFailure('FILE_READ_FAILED', 0)]);
    }
    if (files.length > SOURCE_MANAGER_LIMITS.maxFiles) {
        return Object.freeze([preflightFailure('TOO_MANY_FILES', 0)]);
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

export function createSourceManagerPage({ document, sessionMode, importFacade }) {
    const elements = Object.freeze({
        blocking: document.getElementById('blocking-error'),
        blockingCode: document.getElementById('blocking-error-code'),
        blockingCopy: document.getElementById('blocking-error-copy'),
        firstRun: document.getElementById('first-run'),
        sessionLabel: document.getElementById('session-label'),
        previewTotal: document.getElementById('preview-total'),
        previewList: document.getElementById('preview-list'),
        reportList: document.getElementById('report-list'),
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
    let selection = Object.freeze([]);
    let opener = null;
    let activeSource = null;
    let activeJobId = null;
    let importActive = false;
    let closed = false;

    function setSourceStatus(source, status) {
        const card = document.querySelector(`[data-source-card="${source}"]`);
        const badge = document.querySelector(`[data-source-status="${source}"]`);
        if (!card || !badge) return;
        const labels = {
            not_configured: 'Not configured', available: 'Available',
            importing: 'Importing', success: 'Success', error: 'Error'
        };
        card.dataset.status = status;
        badge.textContent = labels[status] || 'Error';
    }

    function showError(error) {
        const code = safeCode(error);
        elements.dialogErrorCode.textContent = code;
        elements.dialogErrorCopy.textContent = safeCopy(code);
        elements.dialogError.hidden = false;
        elements.alert.textContent = `${code}. ${safeCopy(code)}`;
    }

    function showBlockingError(error) {
        const code = safeCode(error, 'STORAGE_UNAVAILABLE');
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

    function renderProgress(report) {
        const completed = report.items.filter(item => TERMINAL_ITEM_OUTCOMES.has(item.outcome)).length;
        elements.progress.hidden = false;
        elements.progressBar.max = Math.max(1, report.totals.total);
        elements.progressBar.value = completed;
        elements.progressCount.textContent = `${completed} of ${report.totals.total} complete`;
        elements.progressStatus.textContent = `Current stage: ${report.status}`;
        elements.live.textContent = `Import stage ${report.status}. ${completed} of ${report.totals.total} items complete.`;
    }

    async function refreshPublicReads() {
        const [preview, reports] = await Promise.all([
            importFacade.previewActivities(),
            importFacade.listPersistedReports()
        ]);
        renderPreview(preview);
        renderReports(reports);
    }

    function resetDialog() {
        selection = Object.freeze([]);
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
        const results = await preflightSourceFiles(values);
        selection = Object.freeze(results.filter(result => result.ok));
        elements.selectionList.replaceChildren();
        for (const result of results) {
            const suffix = result.ok
                ? (result.rows === null ? 'ready' : `${result.rows} rows`)
                : `${result.code}: ${result.copy}`;
            elements.selectionList.append(text(document, 'li', `${result.label} — ${suffix}`));
        }
        elements.selectionSummary.hidden = results.length === 0;
        elements.startImport.disabled = selection.length === 0;
        const rejected = results.filter(result => !result.ok).length;
        elements.live.textContent = `${selection.length} files ready. ${rejected} files rejected.`;
        if (rejected > 0) {
            elements.alert.textContent = `${rejected} selected files were rejected by preflight.`;
        }
        elements.fileInput.value = '';
    }

    async function startImport() {
        if (selection.length === 0 || importActive) return;
        importActive = true;
        elements.startImport.disabled = true;
        elements.close.disabled = true;
        elements.closeIcon.disabled = true;
        setSourceStatus(activeSource, 'importing');
        try {
            const artifacts = selection.map(result => result.artifact);
            const started = await importFacade.importArtifacts(artifacts);
            activeJobId = started.jobId;
            while (!closed) {
                const report = await importFacade.getReport(activeJobId);
                renderProgress(report);
                if (TERMINAL_JOB_STATUSES.has(report.status)) break;
                await new Promise(resolve => setTimeout(resolve, 40));
            }
            const report = await importFacade.waitForJob(activeJobId);
            renderProgress(report);
            const failed = report.totals.failed > 0
                || ['failed_validation', 'failed_decode', 'failed_storage'].includes(report.status);
            setSourceStatus(activeSource, failed ? 'error' : 'success');
            if (report.totals.skippedExactDuplicate > 0) {
                elements.live.textContent = 'This file was already imported exactly; no second activity was created.';
            } else if (report.status === 'cancelled') {
                elements.live.textContent = 'Import cancelled. Completed items were kept.';
            } else {
                elements.live.textContent = report.status === 'completed'
                    ? 'Import completed.' : 'Import completed with warnings.';
            }
            await refreshPublicReads();
        } catch (error) {
            setSourceStatus(activeSource, 'error');
            showError(error);
        } finally {
            activeJobId = null;
            importActive = false;
            elements.close.disabled = false;
            elements.closeIcon.disabled = false;
            elements.cancelImport.disabled = false;
        }
    }

    async function cancelImport() {
        if (!importActive || activeJobId === null) return;
        elements.cancelImport.disabled = true;
        elements.progressStatus.textContent = 'Cancellation requested.';
        elements.live.textContent = 'Cancellation requested.';
        try {
            await importFacade.cancelJob(activeJobId);
        } catch (error) {
            showError(error);
            elements.cancelImport.disabled = false;
        }
    }

    function bind() {
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
        await importFacade.close();
        return Object.freeze({ status: 'closed' });
    }

    return Object.freeze({ initialize, close, showBlockingError });
}
