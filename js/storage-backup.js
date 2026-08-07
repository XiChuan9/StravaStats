import { startStorageBackup } from './app/storage-backup.js';
import {
    installGlobalDiagnosticsListeners,
    recordDiagnosticError
} from './diagnostics/index.js';

installGlobalDiagnosticsListeners({ page: 'storage-backup' });

let application = null;

startStorageBackup({
    document,
    location,
    indexedDB,
    IDBKeyRange,
    crypto,
    localStorage,
    URL,
    Blob
}).then(result => {
    application = result;
}).catch(() => {
    recordDiagnosticError({
        page: 'storage-backup',
        category: 'backup',
        code: 'STORAGE_BACKUP_START_FAILED'
    });
    const panel = document.getElementById('blocking-error');
    if (panel) panel.hidden = false;
});

addEventListener('pagehide', () => {
    application?.close().catch(() => {});
}, { once: true });
