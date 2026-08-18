import { BACKUP_ERROR_CODE } from '../../backup/index.js';
import { recordDiagnosticError } from '../../diagnostics/index.js';

export const STORAGE_BACKUP_SESSION_MODE = Object.freeze({
    REAL: 'real',
    DEMO: 'demo'
});

const SAFE_UI_CODES = new Set([
    ...Object.values(BACKUP_ERROR_CODE),
    'INVALID_SESSION_MODE'
]);

const SAFE_COPY = Object.freeze({
    BACKUP_TOO_LARGE: 'The backup exceeds the 256 MiB limit.',
    BACKUP_CANCELLED: 'The operation was cancelled safely.',
    BACKUP_HASH_MISMATCH: 'The backup failed its integrity check.',
    BACKUP_SCHEMA_INCOMPATIBLE: 'This backup version is not compatible.',
    TARGET_NOT_EMPTY: 'A different local library already exists. Nothing was changed.',
    TARGET_SETTINGS_CONFLICT: 'Existing local settings conflict with this backup. Nothing was changed.',
    SETTINGS_PENDING: 'Library records are safe, but some settings remain pending. Retry the same backup.',
    QUOTA_EXCEEDED: 'Browser storage is not sufficient. The library was not partially restored.',
    BACKUP_UNAVAILABLE: 'Backup is unavailable in this session.',
    INVALID_SESSION_MODE: 'The requested backup session is invalid.'
});

function safeCode(error, fallback = 'BACKUP_DATA_INVALID') {
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

function formatBytes(value) {
    if (!Number.isSafeInteger(value) || value < 0) return '';
    if (value < 1024) return `${value} bytes`;
    return `${(value / 1_048_576).toFixed(2)} MiB`;
}

export function createStorageBackupPage({ document, sessionMode, URL }) {
    const elements = {
        blocking: document.getElementById('blocking-error'),
        blockingCode: document.getElementById('blocking-error-code'),
        session: document.getElementById('session-label'),
        version: document.getElementById('database-version'),
        count: document.getElementById('activity-count'),
        create: document.getElementById('create-backup'),
        input: document.getElementById('backup-file'),
        restore: document.getElementById('restore-backup'),
        status: document.getElementById('operation-status'),
        detail: document.getElementById('operation-detail')
    };
    let facade = null;
    let selectedFile = null;
    let busy = false;

    function showBlockingError(error) {
        elements.blockingCode.textContent = safeCode(error, 'BACKUP_UNAVAILABLE');
        elements.blocking.hidden = false;
        elements.create.disabled = true;
        elements.restore.disabled = true;
    }

    function showError(error) {
        const code = safeCode(error);
        elements.status.textContent = SAFE_COPY[code]
            ?? 'The backup operation could not be completed safely.';
        elements.detail.textContent = `Status: ${code}`;
    }

    function setBusy(value, message) {
        busy = value;
        elements.create.disabled = value || sessionMode === STORAGE_BACKUP_SESSION_MODE.DEMO;
        elements.restore.disabled = value || selectedFile === null
            || sessionMode === STORAGE_BACKUP_SESSION_MODE.DEMO;
        if (message) elements.status.textContent = message;
    }

    async function createBackup() {
        if (busy || !facade) return;
        setBusy(true, 'Creating and validating backup…');
        try {
            const result = await facade.exportLibrary();
            const objectUrl = URL.createObjectURL(result.blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = result.filename;
            anchor.hidden = true;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
            elements.status.textContent = 'Backup created.';
            elements.detail.textContent = `${formatBytes(result.byteLength)} · ${result.activityCount} activities · ${result.createdAt}`;
        } catch (error) {
            recordDiagnosticError({
                page: 'storage-backup',
                category: 'backup',
                code: 'BACKUP_EXPORT_FAILED'
            });
            showError(error);
        } finally {
            setBusy(false);
        }
    }

    async function restoreBackup() {
        if (busy || !facade || selectedFile === null) return;
        setBusy(true, 'Validating complete backup before restore…');
        try {
            const result = await facade.restoreBackup(selectedFile);
            elements.status.textContent = result.status === 'already_restored'
                ? 'This exact backup is already restored.'
                : 'Backup restored.';
            elements.detail.textContent = `${formatBytes(result.byteLength)} · ${result.activityCount} activities · ${result.createdAt}`;
            elements.count.textContent = String(result.activityCount);
        } catch (error) {
            recordDiagnosticError({
                page: 'storage-backup',
                category: 'backup',
                code: 'BACKUP_RESTORE_FAILED'
            });
            showError(error);
        } finally {
            setBusy(false);
        }
    }

    elements.create.addEventListener('click', createBackup);
    elements.input.addEventListener('change', () => {
        selectedFile = elements.input.files?.length === 1 ? elements.input.files[0] : null;
        elements.restore.disabled = busy || selectedFile === null
            || sessionMode === STORAGE_BACKUP_SESSION_MODE.DEMO;
        elements.status.textContent = selectedFile === null
            ? 'Choose one backup file.'
            : 'Backup selected. Validation has not started.';
        elements.detail.textContent = '';
    });
    elements.restore.addEventListener('click', restoreBackup);

    return Object.freeze({
        async initialize(value) {
            facade = value;
            const state = await facade.initialize();
            elements.session.textContent = sessionMode === STORAGE_BACKUP_SESSION_MODE.DEMO
                ? 'Demo · backup unavailable'
                : 'Real local library';
            elements.version.textContent = state.databaseVersion === null
                ? 'Not created'
                : `V${state.databaseVersion}`;
            elements.count.textContent = String(state.activityCount);
            if (sessionMode === STORAGE_BACKUP_SESSION_MODE.DEMO) {
                elements.create.disabled = true;
                elements.restore.disabled = true;
                elements.status.textContent = 'Backup and restore are unavailable in Demo.';
            }
        },
        showBlockingError,
        async close() {
            await facade?.close();
            return Object.freeze({ status: 'closed' });
        }
    });
}
