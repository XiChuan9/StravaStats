import {
    createDiagnosticsExport,
    estimateOriginStorage,
    installGlobalDiagnosticsListeners,
    readRecentDiagnosticErrors,
    recordDiagnosticError
} from './diagnostics/index.js';
import { readImportPerformanceRecords } from './diagnostics/import-performance.js';
import { createDiagnosticsPage } from './pages/diagnostics/diagnostics.js';

installGlobalDiagnosticsListeners({ page: 'diagnostics' });

let performanceStorage = null;
try {
    performanceStorage = sessionStorage;
} catch {
    // Diagnostics keeps the recorder's bounded in-memory fallback when storage is blocked.
}

const page = createDiagnosticsPage({
    document,
    URL,
    Blob,
    diagnostics: Object.freeze({
        estimateStorage: () => estimateOriginStorage(),
        readErrors: () => readRecentDiagnosticErrors(),
        readImportPerformance: () => readImportPerformanceRecords({ storage: performanceStorage }),
        createExport: createDiagnosticsExport
    })
});

page.initialize().catch(() => {
    recordDiagnosticError({
        page: 'diagnostics',
        category: 'page',
        code: 'DIAGNOSTICS_START_FAILED'
    });
    page.showBlockingError();
});
