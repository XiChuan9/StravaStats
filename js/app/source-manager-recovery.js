import {
    SOURCE_OPERATION_LEASE_MS,
    SOURCE_OPERATION_LOCK_NAME
} from '../storage/source-operation-store.js';

const VISIBLE_HEARTBEAT_MS = 15_000;
const HIDDEN_HEARTBEAT_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONTERMINAL_JOBS = new Set([
    'queued', 'validating', 'hashing', 'decoding', 'normalizing', 'matching',
    'persisting', 'analyzing', 'retrying'
]);
const OPERATION_CODES = new Set([
    'SOURCE_OPERATION_ACTIVE',
    'SOURCE_OPERATION_RECOVERY_REQUIRED',
    'SOURCE_OPERATION_CLOCK_INVALID',
    'SOURCE_OPERATION_CONFLICT',
    'SOURCE_OPERATION_UNAVAILABLE',
    'SOURCE_OPERATION_STORAGE_FAILED',
    'RECOVERY_NOT_AVAILABLE',
    'RECOVERY_REQUEUED',
    'RECOVERY_SOURCE_UNAVAILABLE',
    'RECOVERY_ABANDONED',
    'RECOVERY_HISTORY_NOT_ADVANCED'
]);

const CLOSED = Object.freeze({ status: 'closed' });

function coded(code) {
    return Object.freeze({ code });
}

function method(value, name) {
    try {
        const found = value?.[name];
        return typeof found === 'function' ? found.bind(value) : null;
    } catch {
        return null;
    }
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function safeCode(error, fallback = 'SOURCE_OPERATION_UNAVAILABLE') {
    try {
        const code = Object.getOwnPropertyDescriptor(error, 'code')?.value;
        if (typeof code === 'string' && OPERATION_CODES.has(code)) return code;
        if (code === 'CONFLICT') return 'SOURCE_OPERATION_CONFLICT';
        if (code === 'QUOTA_EXCEEDED' || code === 'TRANSACTION_ABORTED') {
            return 'SOURCE_OPERATION_STORAGE_FAILED';
        }
    } catch {}
    return fallback;
}

function dependenciesFrom(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return null;
    const operationStore = options.operationStore;
    const importFacade = options.importFacade;
    const locks = options.locks;
    const crypto = options.crypto;
    const document = options.document;
    const values = {
        initializeStore: method(operationStore, 'initialize'),
        getOperation: method(operationStore, 'getOperation'),
        claimOperation: method(operationStore, 'claimOperation'),
        heartbeatOperation: method(operationStore, 'heartbeatOperation'),
        beginHistoryCommit: method(operationStore, 'beginHistoryCommit'),
        completeOperation: method(operationStore, 'completeOperation'),
        listOrphans: method(operationStore, 'listOrphanImportJobs'),
        recoverOperation: method(operationStore, 'recoverOperation'),
        abandonOperation: method(operationStore, 'abandonOperation'),
        closeStore: method(operationStore, 'close'),
        importArtifacts: method(importFacade, 'importArtifacts'),
        cancelJob: method(importFacade, 'cancelJob'),
        waitForJob: method(importFacade, 'waitForJob'),
        recoverJob: method(importFacade, 'recoverJob'),
        requestLock: method(locks, 'request'),
        randomUUID: method(crypto, 'randomUUID')
    };
    if (
        Object.values(values).some(value => value === null)
        || typeof options.now !== 'function'
        || typeof options.setTimeoutImpl !== 'function'
        || typeof options.clearTimeoutImpl !== 'function'
        || typeof options.isOnline !== 'function'
        || typeof options.cancelProviderAcquisition !== 'function'
        || typeof options.advanceProviderHistory !== 'function'
        || !document
        || typeof document.addEventListener !== 'function'
        || typeof document.removeEventListener !== 'function'
    ) return null;
    return Object.freeze({
        ...values,
        now: options.now,
        setTimeoutImpl: options.setTimeoutImpl,
        clearTimeoutImpl: options.clearTimeoutImpl,
        isOnline: options.isOnline,
        cancelProviderAcquisition: options.cancelProviderAcquisition,
        advanceProviderHistory: options.advanceProviderHistory,
        document
    });
}

function operationSnapshot({ status, code = null, candidates = [] }) {
    return Object.freeze({
        schemaVersion: 1,
        status,
        code,
        actions: Object.freeze({
            recover: candidates.some(candidate => candidate.recover),
            abandon: candidates.some(candidate => candidate.abandon)
        }),
        candidates: Object.freeze(candidates.map(candidate => Object.freeze({
            token: candidate.token,
            kind: candidate.kind,
            jobStatus: candidate.jobStatus,
            recover: candidate.recover,
            abandon: candidate.abandon
        })))
    });
}

export function createSourceManagerRecoveryController(options) {
    const dependencies = dependenciesFrom(options);
    let ownerId = null;
    let initialized = false;
    let closed = false;
    let current = null;
    let activeJobId = null;
    let timer = null;
    let operationId = null;
    let ownershipFailure = null;
    let providerCancellation = null;
    let mutationQueue = Promise.resolve();
    let activeTask = null;
    let closing = null;
    let recoverySnapshot = operationSnapshot({
        status: 'unavailable',
        code: 'SOURCE_OPERATION_UNAVAILABLE'
    });
    const candidateHandles = new Map();

    function nowTimestamp() {
        try {
            const milliseconds = dependencies.now();
            if (!Number.isFinite(milliseconds)) {
                throw new Error();
            }
            const value = new Date(milliseconds).toISOString();
            if (!strictUtc(value)) throw new Error();
            return value;
        } catch {
            throw coded('SOURCE_OPERATION_CLOCK_INVALID');
        }
    }

    function leaseAt(timestamp) {
        try {
            const milliseconds = Date.parse(timestamp) + SOURCE_OPERATION_LEASE_MS;
            if (!Number.isFinite(milliseconds)) throw new Error();
            const expires = new Date(milliseconds).toISOString();
            if (!strictUtc(expires)) throw new Error();
            return expires;
        } catch {
            throw coded('SOURCE_OPERATION_CLOCK_INVALID');
        }
    }

    function validForwardClock(timestamp) {
        return current?.status !== 'active'
            || (
                Date.parse(timestamp) >= Date.parse(current.startedAt)
                && Date.parse(timestamp) >= Date.parse(current.heartbeatAt)
            );
    }

    function enqueueMutation(task) {
        const next = mutationQueue.then(task, task);
        mutationQueue = next.catch(() => undefined);
        return next;
    }

    function stopHeartbeat() {
        if (timer !== null) {
            dependencies.clearTimeoutImpl(timer);
            timer = null;
        }
    }

    function scheduleHeartbeat() {
        stopHeartbeat();
        if (closed || current?.status !== 'active' || current.ownerId !== ownerId) return;
        const delay = dependencies.document.visibilityState === 'hidden'
            ? HIDDEN_HEARTBEAT_MS
            : VISIBLE_HEARTBEAT_MS;
        timer = dependencies.setTimeoutImpl(() => {
            timer = null;
            heartbeat().catch(() => {});
        }, delay);
    }

    async function cancelCurrentJob() {
        const jobId = activeJobId ?? current?.jobId ?? null;
        if (jobId === null) return;
        try { await dependencies.cancelJob(jobId); } catch {}
    }

    async function cancelCurrentWork() {
        if (current?.kind === 'provider_sync') {
            providerCancellation ??= Promise.resolve()
                .then(() => dependencies.cancelProviderAcquisition())
                .catch(() => undefined);
            await providerCancellation;
        }
        await cancelCurrentJob();
    }

    async function heartbeat() {
        if (closed || current?.status !== 'active' || current.ownerId !== ownerId) return;
        try {
            await enqueueMutation(async () => {
                const heartbeatAt = nowTimestamp();
                if (!validForwardClock(heartbeatAt)) {
                    throw coded('SOURCE_OPERATION_CLOCK_INVALID');
                }
                current = await dependencies.heartbeatOperation({
                    expectedRevision: current.revision,
                    ownerId,
                    operationId,
                    heartbeatAt,
                    leaseExpiresAt: leaseAt(heartbeatAt)
                });
            });
            scheduleHeartbeat();
        } catch (error) {
            ownershipFailure ??= coded(safeCode(error));
            stopHeartbeat();
            await cancelCurrentWork();
        }
    }

    function visibilityChanged() {
        if (
            dependencies.document.visibilityState === 'visible'
            && current?.status === 'active'
            && current.ownerId === ownerId
        ) heartbeat().catch(() => {});
    }

    async function refresh() {
        if (closed) return CLOSED;
        if (!initialized || !dependencies) return recoverySnapshot;
        candidateHandles.clear();
        let observed;
        let orphans;
        let now;
        try {
            observed = await dependencies.getOperation();
            orphans = await dependencies.listOrphans();
            now = Date.parse(nowTimestamp());
        } catch (error) {
            recoverySnapshot = operationSnapshot({
                status: 'unavailable',
                code: safeCode(error)
            });
            return recoverySnapshot;
        }
        const candidates = [];
        if (observed.status === 'active') {
            const stale = now >= Date.parse(observed.leaseExpiresAt);
            const job = orphans.find(candidate => (
                candidate.id === observed.jobId && candidate.orphan === false
            )) ?? null;
            if (stale && (observed.jobId === null || job !== null)) {
                const token = 'operation-1';
                const candidate = {
                    token,
                    kind: observed.kind,
                    jobStatus: job?.status ?? (observed.jobId === null ? null : 'nonterminal'),
                    recover: job?.recoveryMode !== null && job !== null,
                    abandon: true,
                    record: observed,
                    jobId: observed.jobId
                };
                candidateHandles.set(token, candidate);
                candidates.push(candidate);
            }
            recoverySnapshot = operationSnapshot({
                status: candidates.length ? 'recovery_available' : 'active',
                code: candidates.length
                    ? 'SOURCE_OPERATION_RECOVERY_REQUIRED'
                    : 'SOURCE_OPERATION_ACTIVE',
                candidates
            });
            return recoverySnapshot;
        }
        orphans.filter(job => (
            job.orphan === true && NONTERMINAL_JOBS.has(job.status)
        )).forEach((job, index) => {
            const token = `orphan-${index + 1}`;
            const candidate = {
                token,
                kind: 'local_import',
                jobStatus: job.status,
                recover: job.recoveryMode !== null,
                abandon: true,
                record: observed,
                jobId: job.id
            };
            candidateHandles.set(token, candidate);
            candidates.push(candidate);
        });
        recoverySnapshot = operationSnapshot({
            status: candidates.length ? 'recovery_available' : 'idle',
            code: candidates.length ? 'SOURCE_OPERATION_RECOVERY_REQUIRED' : null,
            candidates
        });
        return recoverySnapshot;
    }

    async function requestExclusive(callback) {
        let entered = false;
        const result = await dependencies.requestLock(
            SOURCE_OPERATION_LOCK_NAME,
            Object.freeze({ mode: 'exclusive', ifAvailable: true }),
            async lock => {
                if (lock === null) return null;
                entered = true;
                return callback();
            }
        );
        if (!entered) throw coded('SOURCE_OPERATION_ACTIVE');
        return result;
    }

    async function claim(kind) {
        const observed = await dependencies.getOperation();
        if (observed.status === 'active') {
            const stale = Date.parse(nowTimestamp()) >= Date.parse(observed.leaseExpiresAt);
            throw coded(stale
                ? 'SOURCE_OPERATION_RECOVERY_REQUIRED'
                : 'SOURCE_OPERATION_ACTIVE');
        }
        const startedAt = nowTimestamp();
        operationId = dependencies.randomUUID();
        if (!UUID.test(operationId)) throw coded('SOURCE_OPERATION_UNAVAILABLE');
        current = await dependencies.claimOperation({
            expectedRevision: observed.revision,
            ownerId,
            operationId,
            kind,
            startedAt,
            heartbeatAt: startedAt,
            leaseExpiresAt: leaseAt(startedAt)
        });
        ownershipFailure = null;
        providerCancellation = null;
        scheduleHeartbeat();
        return current;
    }

    async function complete(lastAction, lastResultCode = null) {
        stopHeartbeat();
        if (current?.status !== 'active' || current.ownerId !== ownerId) return;
        await mutationQueue;
        const lastActionAt = nowTimestamp();
        if (!validForwardClock(lastActionAt)) {
            throw coded('SOURCE_OPERATION_CLOCK_INVALID');
        }
        current = await dependencies.completeOperation({
            expectedRevision: current.revision,
            ownerId,
            operationId,
            lastAction,
            lastActionAt,
            lastResultCode
        });
        operationId = null;
        activeJobId = null;
    }

    async function runClaimed(kind, task) {
        if (closed || !initialized || !dependencies) {
            throw coded('SOURCE_OPERATION_UNAVAILABLE');
        }
        if (kind === 'provider_sync' && dependencies.isOnline() !== true) {
            throw coded('SOURCE_OPERATION_UNAVAILABLE');
        }
        return requestExclusive(async () => {
            await claim(kind);
            try {
                const result = await task();
                if (ownershipFailure !== null) throw ownershipFailure;
                await complete('completed', null);
                await refresh();
                return result;
            } catch (error) {
                await cancelCurrentWork();
                try { await complete('failed', safeCode(error)); } catch {}
                await refresh().catch(() => {});
                throw error;
            }
        });
    }

    async function importArtifacts(artifacts, provenance = null) {
        if (
            current?.status !== 'active'
            || current.ownerId !== ownerId
            || !['local_import', 'provider_sync'].includes(current.kind)
        ) throw coded('SOURCE_OPERATION_UNAVAILABLE');
        return enqueueMutation(async () => {
            let sourceConnectionRevision = null;
            let acquiredAt = null;
            if (current.kind === 'provider_sync') {
                sourceConnectionRevision = provenance?.sourceConnectionRevision;
                acquiredAt = provenance?.acquiredAt;
                if (
                    !Number.isSafeInteger(sourceConnectionRevision)
                    || sourceConnectionRevision < 0
                    || !strictUtc(acquiredAt)
                ) throw coded('SOURCE_OPERATION_UNAVAILABLE');
            } else if (provenance !== null) {
                throw coded('SOURCE_OPERATION_UNAVAILABLE');
            }
            const result = await dependencies.importArtifacts(artifacts, {
                expectedRevision: current.revision,
                ownerId,
                operationId,
                sourceConnectionRevision,
                acquiredAt
            });
            activeJobId = result?.jobId ?? null;
            current = await dependencies.getOperation();
            if (
                current.status !== 'active'
                || current.ownerId !== ownerId
                || current.operationId !== operationId
                || current.jobId !== activeJobId
            ) throw coded('SOURCE_OPERATION_CONFLICT');
            return result;
        });
    }

    async function beginHistoryCommit() {
        return enqueueMutation(async () => {
            current = await dependencies.beginHistoryCommit({
                expectedRevision: current.revision,
                ownerId,
                operationId
            });
            return current;
        });
    }

    async function recover(token) {
        const candidate = candidateHandles.get(token);
        if (!candidate?.recover) throw coded('RECOVERY_NOT_AVAILABLE');
        return requestExclusive(async () => {
            const actionAt = nowTimestamp();
            operationId = dependencies.randomUUID();
            if (!UUID.test(operationId)) throw coded('SOURCE_OPERATION_UNAVAILABLE');
            const original = candidate.record;
            let recovery;
            try {
                recovery = await dependencies.recoverOperation({
                    expectedRevision: original.revision,
                    ownerId,
                    operationId,
                    jobId: candidate.jobId,
                    actionAt,
                    leaseExpiresAt: leaseAt(actionAt)
                });
                current = recovery.operation;
                ownershipFailure = null;
                providerCancellation = null;
                activeJobId = candidate.jobId;
                scheduleHeartbeat();
                let report = null;
                if (recovery.mode === 'scheduled') {
                    await dependencies.recoverJob(candidate.jobId);
                }
                report = await dependencies.waitForJob(candidate.jobId);
                if (ownershipFailure !== null) throw ownershipFailure;
                let resultCode = recovery.mode === 'terminal'
                    ? null
                    : 'RECOVERY_REQUEUED';
                if (
                    current.kind === 'provider_sync'
                    && current.sourceConnectionRevision !== null
                    && current.acquiredAt !== null
                ) {
                    let advanced = false;
                    try {
                        if (current.phase === 'importing') {
                            await beginHistoryCommit();
                        } else if (current.phase !== 'history_commit') {
                            throw coded('SOURCE_OPERATION_CONFLICT');
                        }
                        advanced = await dependencies.advanceProviderHistory({
                            sourceConnectionRevision: current.sourceConnectionRevision,
                            acquiredAt: current.acquiredAt,
                            report
                        });
                    } catch {}
                    if (!advanced) resultCode = 'RECOVERY_HISTORY_NOT_ADVANCED';
                }
                await complete('recovered', resultCode);
                await refresh();
                return recoverySnapshot;
            } catch (error) {
                await cancelCurrentJob();
                stopHeartbeat();
                if (current?.status === 'active' && current.ownerId === ownerId) {
                    try { await complete('failed', safeCode(error)); } catch {}
                }
                await refresh().catch(() => {});
                throw coded(safeCode(error, 'SOURCE_OPERATION_STORAGE_FAILED'));
            }
        });
    }

    async function abandon(token) {
        const candidate = candidateHandles.get(token);
        if (!candidate?.abandon) throw coded('RECOVERY_NOT_AVAILABLE');
        return requestExclusive(async () => {
            const actionAt = nowTimestamp();
            const actionOperationId = dependencies.randomUUID();
            if (!UUID.test(actionOperationId)) throw coded('SOURCE_OPERATION_UNAVAILABLE');
            try {
                await dependencies.abandonOperation({
                    expectedRevision: candidate.record.revision,
                    ownerId,
                    operationId: actionOperationId,
                    jobId: candidate.jobId,
                    actionAt,
                    leaseExpiresAt: leaseAt(actionAt)
                });
                await refresh();
                return recoverySnapshot;
            } catch (error) {
                await refresh().catch(() => {});
                throw coded(safeCode(error, 'SOURCE_OPERATION_STORAGE_FAILED'));
            }
        });
    }

    return Object.freeze({
        async initialize() {
            if (closed) return CLOSED;
            if (initialized) return recoverySnapshot;
            initialized = true;
            if (!dependencies) return recoverySnapshot;
            try {
                ownerId = dependencies.randomUUID();
                if (!UUID.test(ownerId)) throw new Error();
                await dependencies.initializeStore();
                dependencies.document.addEventListener('visibilitychange', visibilityChanged);
                return refresh();
            } catch (error) {
                recoverySnapshot = operationSnapshot({
                    status: 'unavailable',
                    code: safeCode(error)
                });
                return recoverySnapshot;
            }
        },
        getRecoveryState() { return recoverySnapshot; },
        refresh,
        runLocalImport(task) {
            if (typeof task !== 'function') {
                return Promise.reject(coded('SOURCE_OPERATION_UNAVAILABLE'));
            }
            if (activeTask !== null) {
                return Promise.reject(coded('SOURCE_OPERATION_ACTIVE'));
            }
            activeTask = runClaimed('local_import', task).finally(() => {
                activeTask = null;
            });
            return activeTask;
        },
        runProviderSync(task) {
            if (typeof task !== 'function') {
                return Promise.reject(coded('SOURCE_OPERATION_UNAVAILABLE'));
            }
            if (activeTask !== null) {
                return Promise.reject(coded('SOURCE_OPERATION_ACTIVE'));
            }
            activeTask = runClaimed('provider_sync', task).finally(() => {
                activeTask = null;
            });
            return activeTask;
        },
        importArtifacts,
        beginHistoryCommit,
        recover,
        abandon,
        close() {
            if (closing) return closing;
            closed = true;
            stopHeartbeat();
            dependencies?.document.removeEventListener(
                'visibilitychange',
                visibilityChanged
            );
            closing = (async () => {
                await cancelCurrentWork();
                if (activeTask) await Promise.allSettled([activeTask]);
                await mutationQueue;
                await dependencies?.closeStore();
                return CLOSED;
            })();
            return closing;
        }
    });
}
