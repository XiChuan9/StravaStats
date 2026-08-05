import { createImportService, createBrowserImportWorker } from '../import/index.js';
import { createImportStore } from '../storage/index.js';
import { createSourceManagerPage, SOURCE_MANAGER_SESSION_MODE } from '../pages/source-manager/source-manager.js';

const TERMINAL_JOB_STATUSES = new Set([
    'completed', 'completed_with_warnings', 'failed_validation',
    'failed_decode', 'failed_storage', 'cancelled'
]);

function sessionMode(search) {
    const params = new URLSearchParams(search);
    const mode = params.get('mode');
    if (mode === null || mode === SOURCE_MANAGER_SESSION_MODE.REAL) {
        return SOURCE_MANAGER_SESSION_MODE.REAL;
    }
    if (mode === SOURCE_MANAGER_SESSION_MODE.DEMO) {
        return SOURCE_MANAGER_SESSION_MODE.DEMO;
    }
    return null;
}

function demoFacade() {
    const unavailable = () => Promise.reject(Object.freeze({
        code: 'DEMO_IMPORT_UNAVAILABLE'
    }));
    return Object.freeze({
        async initialize() { return Object.freeze({ status: 'ready' }); },
        importArtifacts: unavailable,
        cancelJob: unavailable,
        getReport: unavailable,
        waitForJob: unavailable,
        async previewActivities() {
            return Object.freeze({ total: 0, bySportCategory: Object.freeze([]) });
        },
        async listPersistedReports() { return Object.freeze([]); },
        async close() { return Object.freeze({ status: 'closed' }); }
    });
}

function realFacade({ indexedDB, IDBKeyRange, crypto, Worker }) {
    let sequence = 0;
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => Date.now(),
        applicationVersion: 'pr10-source-manager@1'
    });
    const nativeWorker = new Worker(
        new URL('../import/synthetic-import-worker.js', import.meta.url),
        { type: 'module' }
    );
    const service = createImportService({
        importStore,
        worker: createBrowserImportWorker(nativeWorker),
        crypto,
        createId(kind) {
            sequence += 1;
            return `source-manager:${kind}:${sequence}:${crypto.randomUUID()}`;
        }
    });
    return Object.freeze({
        initialize: () => service.initialize(),
        importArtifacts: artifacts => service.importArtifacts(artifacts),
        cancelJob: jobId => service.cancelJob(jobId),
        getReport: jobId => service.getReport(jobId),
        waitForJob: jobId => service.waitForJob(jobId),
        previewActivities: () => service.previewActivities(),
        async listPersistedReports() {
            const jobs = await importStore.listImportJobs();
            const reports = [];
            for (const job of jobs) {
                if (TERMINAL_JOB_STATUSES.has(job.status)) {
                    reports.push(await service.getReport(job.id));
                }
            }
            return Object.freeze(reports);
        },
        close: () => service.close()
    });
}

export async function startSourceManager(dependencies) {
    const mode = sessionMode(dependencies?.location?.search ?? '');
    if (mode === null) {
        const error = Object.freeze({ code: 'INVALID_SESSION_MODE' });
        const page = createSourceManagerPage({
            document: dependencies.document,
            sessionMode: null,
            importFacade: demoFacade()
        });
        page.showBlockingError(error);
        return Object.freeze({ status: 'blocked', close: page.close });
    }
    const importFacade = mode === SOURCE_MANAGER_SESSION_MODE.DEMO
        ? demoFacade()
        : realFacade(dependencies);
    const page = createSourceManagerPage({
        document: dependencies.document,
        sessionMode: mode,
        importFacade
    });
    await page.initialize();
    return Object.freeze({ status: 'ready', close: page.close });
}
