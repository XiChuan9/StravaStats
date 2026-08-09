import { startSourceManager } from './app/source-manager.js';
import { sanitizeSourceManagerNavigation } from './app/source-manager-connection.js';
import { configureImportPerformance } from './diagnostics/import-performance.js';
import {
    installGlobalDiagnosticsListeners,
    recordDiagnosticError
} from './diagnostics/index.js';

const navigation = (() => {
    try {
        return sanitizeSourceManagerNavigation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            replaceState: history.replaceState.bind(history)
        });
    } catch {
        return sanitizeSourceManagerNavigation({});
    }
})();

let application = null;
let pageHidden = false;

if (navigation.status === 'blocked') {
    const panel = document.getElementById('blocking-error');
    const code = document.getElementById('blocking-error-code');
    const copy = document.getElementById('blocking-error-copy');
    if (code) code.textContent = 'NAVIGATION_SANITIZATION_FAILED';
    if (copy) {
        copy.textContent = 'The Source Manager navigation could not be accepted safely.';
    }
    if (panel) panel.hidden = false;
} else {
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

    addEventListener('pagehide', () => {
        pageHidden = true;
        application?.close().catch(() => {});
    }, { once: true });

    startSourceManager({
        document,
        sessionMode: navigation.sessionMode,
        indexedDB,
        IDBKeyRange,
        crypto,
        Worker
    }).then(async result => {
        application = result;
        if (pageHidden) await application.close();
    }).catch(() => {
        recordDiagnosticError({
            page: 'source-manager',
            category: 'page',
            code: 'SOURCE_MANAGER_START_FAILED'
        });
        const panel = document.getElementById('blocking-error');
        if (panel) panel.hidden = false;
    });
}
