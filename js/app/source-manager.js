import { createImportService, createBrowserImportWorker } from '../import/index.js';
import {
    inspectImportServiceRetryJobs,
    recoverImportServiceJob
} from '../import/import-service.js';
import {
    createImportStore,
    createSourceConnectionStore,
    createSourceOperationStore
} from '../storage/index.js';
import { createSourceManagerPage, SOURCE_MANAGER_SESSION_MODE } from '../pages/source-manager/source-manager.js';
import { createSourceManagerConnectionController } from './source-manager-connection.js';
import { createSourceManagerProviderSyncController } from './source-manager-provider-sync.js';
import { createSourceManagerRecoveryController } from './source-manager-recovery.js';
import { createSourceManagerAuthorization } from './source-manager-authorization.js';
import { createAuthLifecycle, inspectLegacyIndexedDbPresence } from './auth-lifecycle.js';
import {
    createStravaSyncConnector,
    readStravaSyncAuthority
} from '../connectors/strava/strava-sync-connector.js';
import { createStravaImportMapper } from '../connectors/strava/strava-import-mapper.js';
import { createStravaProviderArtifacts } from '../import/strava-provider-artifact.js';

const TERMINAL_JOB_STATUSES = new Set([
    'completed', 'completed_with_warnings', 'failed_validation',
    'failed_decode', 'failed_storage', 'cancelled'
]);

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
        async listDuplicateReviews() { return Object.freeze([]); },
        getDuplicateReview: unavailable,
        decideDuplicateReview: unavailable,
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
    const reviewHandles = new Map();

    async function listDuplicateReviews() {
        const candidates = await importStore.listDuplicateReviewCandidates();
        reviewHandles.clear();
        return Object.freeze(candidates.map((candidate, index) => {
            const token = `review-${index + 1}`;
            reviewHandles.set(token, candidate.id);
            return Object.freeze({
                token,
                confidence: candidate.confidence,
                createdAt: candidate.createdAt,
                evidence: candidate.evidence
            });
        }));
    }

    function candidateId(token) {
        return typeof token === 'string' ? reviewHandles.get(token) : undefined;
    }

    async function getDuplicateReview(token) {
        const id = candidateId(token);
        if (id === undefined) throw Object.freeze({ code: 'REVIEW_STALE' });
        const detail = await importStore.getDuplicateReviewCandidate(id);
        return Object.freeze({
            token,
            confidence: detail.confidence,
            status: detail.status,
            createdAt: detail.createdAt,
            evidence: detail.evidence,
            activities: detail.activities
        });
    }

    async function decideDuplicateReview(token, decision) {
        const id = candidateId(token);
        if (id === undefined) throw Object.freeze({ code: 'REVIEW_STALE' });
        const result = await importStore.decideDuplicateReviewCandidate(
            id,
            decision
        );
        reviewHandles.delete(token);
        return Object.freeze({ status: result.status });
    }
    return Object.freeze({
        initialize: () => service.initialize(),
        importArtifacts: (artifacts, sourceOperationLink) => (
            service.importArtifacts(artifacts, sourceOperationLink)
        ),
        recoverJob: jobId => recoverImportServiceJob(service, jobId),
        inspectRetryJobs: () => inspectImportServiceRetryJobs(service),
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
        listDuplicateReviews,
        getDuplicateReview,
        decideDuplicateReview,
        close: () => service.close()
    });
}

function realConnectionFacades(dependencies, importFacade, recoveryFacade) {
    const connectionStore = createSourceConnectionStore({
        indexedDB: dependencies.indexedDB,
        IDBKeyRange: dependencies.IDBKeyRange,
        now: dependencies.now,
        applicationVersion: 'source-manager-authorization@1'
    });
    const authorization = createSourceManagerAuthorization({
        fetchImpl: dependencies.fetchImpl,
        sessionStorage: dependencies.sessionStorage,
        crypto: dependencies.crypto,
        origin: dependencies.origin,
        navigate: dependencies.navigate,
        now: dependencies.now,
        setTimeoutImpl: dependencies.setTimeoutImpl,
        clearTimeoutImpl: dependencies.clearTimeoutImpl,
        AbortControllerImpl: dependencies.AbortControllerImpl
    });
    const authLifecycle = createAuthLifecycle({
        storage: dependencies.localStorage,
        inspectIndexedDb: () => inspectLegacyIndexedDbPresence({
            indexedDB: dependencies.indexedDB
        }),
        revokeTokenKind: 'refresh',
        revokeAccessToken: refreshToken => authorization.revoke(refreshToken)
    });
    const syncFacade = createSourceManagerProviderSyncController({
        readAuthority: () => readStravaSyncAuthority(dependencies.localStorage),
        createReader: authority => createStravaSyncConnector({
            authority,
            fetchImpl: dependencies.fetchImpl,
            setTimeoutImpl: dependencies.setTimeoutImpl,
            clearTimeoutImpl: dependencies.clearTimeoutImpl,
            AbortControllerImpl: dependencies.AbortControllerImpl
        }),
        connectionStore,
        createMapper: createStravaImportMapper,
        createArtifacts: createStravaProviderArtifacts,
        importFacade: Object.freeze({
            importArtifacts: (artifacts, provenance) => (
                recoveryFacade.importArtifacts(artifacts, provenance)
            ),
            cancelJob: jobId => importFacade.cancelJob(jobId),
            waitForJob: jobId => importFacade.waitForJob(jobId)
        }),
        beginHistoryCommit: () => recoveryFacade.beginHistoryCommit(),
        now: () => {
            const timestamp = dependencies.now();
            return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
        },
        AbortControllerImpl: dependencies.AbortControllerImpl
    });
    const connectionFacade = createSourceManagerConnectionController({
        authorization,
        authLifecycle,
        connectionStore,
        callback: dependencies.callback,
        awaitInactiveSyncBoundary: () => syncFacade.awaitInactive()
    });
    return Object.freeze({ connectionFacade, syncFacade });
}

export async function startSourceManager(dependencies) {
    const mode = dependencies?.sessionMode;
    if (
        mode !== SOURCE_MANAGER_SESSION_MODE.REAL
        && mode !== SOURCE_MANAGER_SESSION_MODE.DEMO
    ) {
        const error = Object.freeze({ code: 'INVALID_SESSION_MODE' });
        const page = createSourceManagerPage({
            document: dependencies.document,
            sessionMode: null,
            importFacade: demoFacade(),
            connectionFacade: null
        });
        page.showBlockingError(error);
        return Object.freeze({ status: 'blocked', close: page.close });
    }
    const rawImportFacade = mode === SOURCE_MANAGER_SESSION_MODE.DEMO
        ? demoFacade()
        : realFacade(dependencies);
    let syncFacade = null;
    const recoveryFacade = mode === SOURCE_MANAGER_SESSION_MODE.REAL
        ? createSourceManagerRecoveryController({
            operationStore: createSourceOperationStore({
                indexedDB: dependencies.indexedDB,
                IDBKeyRange: dependencies.IDBKeyRange,
                now: dependencies.now,
                applicationVersion: 'source-manager-recovery@1'
            }),
            importFacade: rawImportFacade,
            locks: dependencies.locks,
            crypto: dependencies.crypto,
            now: dependencies.now,
            document: dependencies.document,
            setTimeoutImpl: dependencies.setTimeoutImpl,
            clearTimeoutImpl: dependencies.clearTimeoutImpl,
            isOnline: dependencies.isOnline,
            cancelProviderAcquisition: () => (
                syncFacade?.cancel() ?? Promise.resolve()
            ),
            advanceProviderHistory: value => (
                syncFacade?.advanceRecoveredHistory(value) ?? Promise.resolve(false)
            )
        })
        : null;
    const liveFacades = mode === SOURCE_MANAGER_SESSION_MODE.REAL
        ? realConnectionFacades(dependencies, rawImportFacade, recoveryFacade)
        : Object.freeze({ connectionFacade: null, syncFacade: null });
    syncFacade = liveFacades.syncFacade;
    const importFacade = mode === SOURCE_MANAGER_SESSION_MODE.REAL
        ? Object.freeze({
            initialize: () => rawImportFacade.initialize(),
            importArtifacts: artifacts => recoveryFacade.importArtifacts(artifacts),
            cancelJob: jobId => rawImportFacade.cancelJob(jobId),
            getReport: jobId => rawImportFacade.getReport(jobId),
            waitForJob: jobId => rawImportFacade.waitForJob(jobId),
            previewActivities: () => rawImportFacade.previewActivities(),
            listPersistedReports: () => rawImportFacade.listPersistedReports(),
            listDuplicateReviews: () => rawImportFacade.listDuplicateReviews(),
            getDuplicateReview: token => rawImportFacade.getDuplicateReview(token),
            decideDuplicateReview: (token, decision) => (
                rawImportFacade.decideDuplicateReview(token, decision)
            ),
            close: () => rawImportFacade.close()
        })
        : rawImportFacade;
    const page = createSourceManagerPage({
        document: dependencies.document,
        sessionMode: mode,
        importFacade,
        connectionFacade: liveFacades.connectionFacade,
        syncFacade: liveFacades.syncFacade,
        recoveryFacade
    });
    const startupCloseRequested = dependencies.startupCloseRequested instanceof Promise
        ? dependencies.startupCloseRequested
        : new Promise(() => {});
    const initialization = page.initialize();
    try {
        const outcome = await Promise.race([
            initialization.then(() => 'initialized'),
            startupCloseRequested.then(() => 'close')
        ]);
        if (outcome === 'close') {
            await page.close();
            await Promise.allSettled([initialization]);
            return Object.freeze({ status: 'closed', close: page.close });
        }
    } catch (error) {
        await page.close().catch(() => {});
        throw error;
    }
    return Object.freeze({ status: 'ready', close: page.close });
}
