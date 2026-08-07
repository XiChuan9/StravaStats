import { startSourceManager } from './app/source-manager.js';
import { configureImportPerformance } from './diagnostics/import-performance.js';
import {
    installGlobalDiagnosticsListeners,
    recordDiagnosticError
} from './diagnostics/index.js';

installGlobalDiagnosticsListeners({ page: 'source-manager' });

let performanceStorage = null;
try {
    performanceStorage = sessionStorage;
} catch {
    // The recorder keeps a bounded in-memory fallback for blocked storage.
}
configureImportPerformance({
    storage: performanceStorage,
    now: () => performance.now()
});

let application = null;

startSourceManager({
    document,
    location,
    indexedDB,
    IDBKeyRange,
    crypto,
    Worker
}).then(result => {
    application = result;
}).catch(() => {
    recordDiagnosticError({
        page: 'source-manager',
        category: 'page',
        code: 'SOURCE_MANAGER_START_FAILED'
    });
    const panel = document.getElementById('blocking-error');
    if (panel) panel.hidden = false;
});

addEventListener('pagehide', () => {
    application?.close().catch(() => {});
}, { once: true });
