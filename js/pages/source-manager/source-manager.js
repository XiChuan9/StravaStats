import { IMPORT_ERROR_CODE } from '../../import/index.js';
import { ACTIVITIES_CSV_MEDIA_TYPE } from '../../import/activities-csv-decoder.js';
import {
    ACTIVITIES_CSV_LIMITS,
    decodeActivitiesCsvUtf8,
    parseActivitiesCsv
} from '../../import/csv-tokenizer.js';
import { STRAVA_ZIP_MEDIA_TYPE } from '../../import/strava-zip.js';
import { STRAVA_ZIP_LIMITS } from '../../import/zip-inspector.js';

export const SOURCE_MANAGER_SESSION_MODE = Object.freeze({
    REAL: 'real',
    DEMO: 'demo'
});

export const SOURCE_MANAGER_LIMITS = Object.freeze({
    maxFiles: 100,
    maxCsvBytes: ACTIVITIES_CSV_LIMITS.maxBytes,
    maxZipBytes: STRAVA_ZIP_LIMITS.maxArchiveBytes
});

const PREFLIGHT_COPY = Object.freeze({
    FILE_TYPE_UNSUPPORTED: 'This format is not supported yet. FIT, TCX, and GPX support will be added later.',
    FILE_HEADER_INVALID: 'The file header is not a supported CSV or ZIP header.',
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
            return Object.freeze({
                name: value.name,
                size: value.size,
                read: () => value.arrayBuffer()
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
            read: () => descriptors.arrayBuffer.value.call(value)
        });
    } catch {
        return null;
    }
}

function zipBase64(bytes) {
    const parts = [];
    for (let offset = 0; offset < bytes.byteLength; offset += 32_768) {
        parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)));
    }
    return btoa(parts.join(''));
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
        if (!['csv', 'zip'].includes(kind)) {
            results.push(preflightFailure('FILE_TYPE_UNSUPPORTED', ordinal));
            continue;
        }
        const maximum = kind === 'csv'
            ? SOURCE_MANAGER_LIMITS.maxCsvBytes
            : SOURCE_MANAGER_LIMITS.maxZipBytes;
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
        if (kind === 'zip') {
            if (
                bytes.byteLength < 4
                || bytes[0] !== 0x50 || bytes[1] !== 0x4b
                || bytes[2] !== 0x03 || bytes[3] !== 0x04
            ) {
                results.push(preflightFailure('FILE_HEADER_INVALID', ordinal));
                continue;
            }
            results.push(Object.freeze({
                ok: true,
                label: `ZIP file ${ordinal + 1}`,
                format: 'zip',
                rows: null,
                artifact: Object.freeze({
                    mediaType: STRAVA_ZIP_MEDIA_TYPE,
                    content: zipBase64(bytes)
                })
            }));
            continue;
        }
        try {
            const text = decodeActivitiesCsvUtf8(bytes);
            const records = parseActivitiesCsv(text);
            const header = records[0] || [];
            if (
                records.length < 2
                || !['Activity ID', 'Activity Date', 'Activity Type']
                    .every(field => header.includes(field))
            ) {
                results.push(preflightFailure('FILE_HEADER_INVALID', ordinal));
                continue;
            }
            results.push(Object.freeze({
                ok: true,
                label: `CSV file ${ordinal + 1}`,
                format: 'csv',
                rows: records.length - 1,
                artifact: Object.freeze({
                    mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
                    content: text
                })
            }));
        } catch {
            results.push(preflightFailure('FILE_HEADER_INVALID', ordinal));
        }
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
