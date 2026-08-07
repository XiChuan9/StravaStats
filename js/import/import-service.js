import { STORAGE_ERROR_CODE } from '../storage/index.js';
import { readActivitiesPreview } from './activities-preview.js';
import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { normalizeImportedActivity } from './normalizer.js';
import {
    IMPORT_ITEM_STATUS as I,
    IMPORT_JOB_STATUS as J,
    assertImportItemTransition,
    assertImportJobTransition,
    canCancelImportJob,
    isTerminalImportItem
} from './state-machine.js';
import {
    denseArraySnapshot,
    findDataMethod,
    frozenClone,
    ownDataValues
} from './safe-data.js';
import { SYNTHETIC_JSON_MEDIA_TYPE } from './synthetic-json-decoder.js';
import { ACTIVITIES_CSV_MEDIA_TYPE } from './activities-csv-decoder.js';
import { frameActivitiesCsv } from './csv-tokenizer.js';
import {
    STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
    STRAVA_ZIP_MEDIA_TYPE,
    expandStravaZipArtifact
} from './strava-zip.js';
import {
    observeImportCancellation,
    recordImportPerformanceOperation,
    trackImportWorkerRequest
} from '../diagnostics/import-performance.js';

const OPTION_FIELDS = Object.freeze(['importStore', 'worker', 'crypto', 'createId']);
const ARTIFACT_FIELDS = Object.freeze(['mediaType', 'content']);
const ACCEPTED_MEDIA_TYPES = Object.freeze([
    SYNTHETIC_JSON_MEDIA_TYPE,
    ACTIVITIES_CSV_MEDIA_TYPE,
    STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
    'application/vnd.ant.fit;base64',
    'application/vnd.garmin.tcx+xml',
    'application/gpx+xml'
]);

function normalizeOptions(options) {
    const values = ownDataValues(options, OPTION_FIELDS);
    const storeMethods = [
        'initialize', 'createImportJob', 'transitionImportJob',
        'transitionImportItem', 'cancelImportJob', 'storeRawArtifact',
        'persistImportItem',
        'getImportJob', 'getImportItem', 'getRawArtifact', 'listImportItems',
        'listImportJobs', 'listActivities', 'close'
    ];
    if (!values || typeof values.createId !== 'function') return null;
    const store = {};
    for (const name of storeMethods) {
        const method = findDataMethod(values.importStore, name);
        if (!method) return null;
        store[name] = (...args) => method.call(values.importStore, ...args);
    }
    const process = findDataMethod(values.worker, 'process');
    const workerClose = findDataMethod(values.worker, 'close');
    const digest = findDataMethod(values.crypto?.subtle, 'digest');
    if (!process || !workerClose || !digest) return null;
    return Object.freeze({
        store: Object.freeze(store),
        process: input => process.call(values.worker, input),
        workerClose: () => workerClose.call(values.worker),
        digest: input => digest.call(values.crypto.subtle, 'SHA-256', input),
        createId: values.createId
    });
}

async function snapshotArtifacts(value, isCancelled) {
    const values = denseArraySnapshot(value);
    if (!values || values.length === 0) {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    try {
        const artifacts = [];
        for (const item of values) {
            const artifact = ownDataValues(item, ARTIFACT_FIELDS);
            if (!artifact) throw new TypeError();
            if (artifact.mediaType === STRAVA_ARCHIVE_ROW_MEDIA_TYPE) {
                throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
            }
            if (
                artifact.mediaType === ACTIVITIES_CSV_MEDIA_TYPE
                && typeof artifact.content === 'string'
            ) {
                for (const content of frameActivitiesCsv(artifact.content)) {
                    artifacts.push(frozenClone({
                        mediaType: artifact.mediaType,
                        content
                    }));
                }
            } else if (
                artifact.mediaType === STRAVA_ZIP_MEDIA_TYPE
                && typeof artifact.content === 'string'
            ) {
                artifacts.push(...await expandStravaZipArtifact(
                    artifact.content,
                    isCancelled
                ));
            } else {
                artifacts.push(frozenClone({
                    mediaType: artifact.mediaType,
                    content: artifact.content
                }));
            }
        }
        return Object.freeze(artifacts);
    } catch (error) {
        const code = ownErrorValue(error, 'code');
        if (Object.values(IMPORT_ERROR_CODE).includes(code)) {
            throw importError(code, false, 'decode');
        }
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
}

function safeId(createId, kind, ordinal) {
    let id;
    try {
        id = createId(kind, ordinal);
    } catch {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    if (typeof id !== 'string' || id.trim().length === 0) {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    return id;
}

function hex(buffer) {
    return [...new Uint8Array(buffer)]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
}

function ownErrorValue(error, field) {
    try {
        if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
            return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(error, field);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function mapStorageError(error, allowIdentityConflict = false) {
    if (
        ownErrorValue(error, 'code')
        === STORAGE_ERROR_CODE.CANDIDATE_LIMIT_EXCEEDED
    ) {
        return Object.freeze({
            code: STORAGE_ERROR_CODE.CANDIDATE_LIMIT_EXCEEDED,
            retryable: false
        });
    }
    if (ownErrorValue(error, 'code') === STORAGE_ERROR_CODE.QUOTA_EXCEEDED) {
        return importError(IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED, true, 'persist');
    }
    if (
        allowIdentityConflict
        && ownErrorValue(error, 'code') === STORAGE_ERROR_CODE.CONFLICT
    ) {
        return importError(IMPORT_ERROR_CODE.EXACT_IDENTITY_CONFLICT, false, 'persist');
    }
    return importError(IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE, true, 'persist');
}

function safeImportFailure(error) {
    const code = ownErrorValue(error, 'code');
    if (Object.values(IMPORT_ERROR_CODE).includes(code)) {
        const stage = ownErrorValue(error, 'stage');
        return importError(
            code,
            ownErrorValue(error, 'retryable') === true,
            typeof stage === 'string' && stage.length > 0 ? stage : null
        );
    }
    return mapStorageError(error);
}

function itemDetails(error = null) {
    return Object.freeze({
        errorCode: ownErrorValue(error, 'code') || null,
        retryable: ownErrorValue(error, 'retryable') === true,
        activityId: null
    });
}

function publicReport(job, items) {
    const outcomes = new Map();
    for (const item of items) {
        outcomes.set(item.status, (outcomes.get(item.status) || 0) + 1);
    }
    const reviewRequired = outcomes.get(I.REVIEW_REQUIRED) || 0;
    const totals = {
        total: job.totalItems,
        completed: outcomes.get(I.COMPLETED) || 0,
        reviewRequired,
        skippedExactDuplicate: outcomes.get(I.SKIPPED_EXACT_DUPLICATE) || 0,
        failed: items.filter(item => item.status.startsWith('failed_')).length,
        cancelled: outcomes.get(I.CANCELLED) || 0
    };
    return Object.freeze({
        schemaVersion: 1,
        status: job.status,
        totals: Object.freeze(totals),
        items: Object.freeze(items.map(item => Object.freeze({
            ordinal: item.ordinal,
            outcome: item.status,
            errorCode: item.errorCode,
            retryable: item.retryable
        })))
    });
}

export function createImportService(options) {
    const dependencies = normalizeOptions(options);
    if (!dependencies) throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    const active = new Map();
    const cancellation = new Set();
    let closed = false;

    async function transitionJob(jobId, expected, next, errorCode = null) {
        assertImportJobTransition(expected, next);
        return dependencies.store.transitionImportJob(
            jobId,
            expected,
            next,
            errorCode
        );
    }

    async function transitionItem(item, next, error = null) {
        assertImportItemTransition(item.status, next);
        const result = await dependencies.store.transitionImportItem(
            item.id,
            item.status,
            next,
            itemDetails(error)
        );
        return result.item;
    }

    async function cancelRemaining(jobId, status) {
        if (!canCancelImportJob(status)) return false;
        assertImportJobTransition(status, J.CANCELLED);
        await dependencies.store.cancelImportJob(jobId, status);
        cancellation.delete(jobId);
        return true;
    }

    async function cancellationCheckpoint(jobId, status) {
        if (!cancellation.has(jobId)) return false;
        observeImportCancellation();
        if (status === J.HASHING) {
            await transitionJob(jobId, J.HASHING, J.DECODING);
            return cancelRemaining(jobId, J.DECODING);
        }
        return cancelRemaining(jobId, status);
    }

    async function terminalizeHashingQuota(jobId, items) {
        const quotaFailure = importError(
            IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED,
            true,
            'persist'
        );
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            try {
                if (items[index].status === I.VALIDATING) {
                    items[index] = await transitionItem(items[index], I.HASHING);
                }
                if (items[index].status === I.HASHING) {
                    items[index] = await failItem(
                        items[index],
                        I.FAILED_STORAGE,
                        quotaFailure
                    );
                }
            } catch {
                // Terminalization is best-effort under storage pressure.
                break;
            }
        }
        await transitionJob(jobId, J.HASHING, J.DECODING);
        await transitionJob(jobId, J.DECODING, J.NORMALIZING);
        await transitionJob(jobId, J.NORMALIZING, J.MATCHING);
        await transitionJob(jobId, J.MATCHING, J.PERSISTING);
        await transitionJob(
            jobId,
            J.PERSISTING,
            J.FAILED_STORAGE,
            IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED
        );
    }

    async function hash(content) {
        try {
            const bytes = new TextEncoder().encode(content);
            const digest = await dependencies.digest(bytes);
            const value = hex(digest);
            if (!/^[a-f0-9]{64}$/.test(value)) throw new TypeError();
            return Object.freeze({ sha256: value, byteLength: bytes.byteLength });
        } catch {
            throw importError(IMPORT_ERROR_CODE.HASH_FAILED, true, 'hash');
        }
    }

    async function failItem(item, status, error) {
        try {
            return await transitionItem(item, status, error);
        } catch {
            throw mapStorageError();
        }
    }

    async function run(jobId, suppliedArtifacts = null, startingStatus = J.QUEUED) {
        let jobStatus = startingStatus;
        let items = [...await dependencies.store.listImportItems(jobId)];
        let artifacts = suppliedArtifacts;
        if (startingStatus === J.RETRYING) {
            await transitionJob(jobId, J.RETRYING, J.VALIDATING);
            jobStatus = J.VALIDATING;
            const loaded = [];
            for (let item of items) {
                if (isTerminalImportItem(item.status) && item.retryable !== true) {
                    loaded[item.ordinal] = null;
                    continue;
                }
                if (item.status !== I.RETRYING) {
                    item = await transitionItem(item, I.RETRYING);
                }
                item = await transitionItem(item, I.VALIDATING);
                const stored = item.artifactId
                    ? await dependencies.store.getRawArtifact(item.artifactId)
                    : null;
                if (!stored) throw importError(IMPORT_ERROR_CODE.RETRY_NOT_ALLOWED);
                loaded[item.ordinal] = Object.freeze({
                    mediaType: stored.mediaType,
                    content: stored.content
                });
            }
            artifacts = Object.freeze(loaded);
            items = [...await dependencies.store.listImportItems(jobId)];
        } else {
            await transitionJob(jobId, J.QUEUED, J.VALIDATING);
            jobStatus = J.VALIDATING;
            for (let index = 0; index < items.length; index += 1) {
                items[index] = await recordImportPerformanceOperation(
                    'validation',
                    () => transitionItem(items[index], I.VALIDATING)
                );
                if (await cancellationCheckpoint(jobId, jobStatus)) return;
            }
        }

        if (await cancellationCheckpoint(jobId, jobStatus)) return;

        let viable = 0;
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            const artifact = artifacts[index];
            if (
                !artifact
                || !ACCEPTED_MEDIA_TYPES.includes(artifact.mediaType)
                || typeof artifact.content !== 'string'
                || artifact.content.length === 0
            ) {
                const code = artifact?.content === ''
                    ? IMPORT_ERROR_CODE.FILE_EMPTY
                    : ACCEPTED_MEDIA_TYPES.includes(artifact?.mediaType)
                        ? IMPORT_ERROR_CODE.FILE_CORRUPTED
                        : IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT;
                items[index] = await failItem(
                    items[index],
                    I.FAILED_VALIDATION,
                    importError(code, false, 'validate')
                );
            } else {
                viable += 1;
            }
            if (await cancellationCheckpoint(jobId, jobStatus)) return;
        }
        if (viable === 0) {
            await transitionJob(
                jobId,
                jobStatus,
                J.FAILED_VALIDATION,
                IMPORT_ERROR_CODE.FILE_CORRUPTED
            );
            return;
        }

        await transitionJob(jobId, jobStatus, J.HASHING);
        jobStatus = J.HASHING;
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            items[index] = await transitionItem(items[index], I.HASHING);
            try {
                const hashed = await recordImportPerformanceOperation(
                    'hashing',
                    () => hash(artifacts[index].content)
                );
                const rawArtifactId = `raw:${hashed.sha256}`;
                const decision = await dependencies.store.storeRawArtifact(
                    items[index].id,
                    {
                        id: rawArtifactId,
                        sha256: hashed.sha256,
                        mediaType: artifacts[index].mediaType,
                        byteLength: hashed.byteLength,
                        content: artifacts[index].content
                    }
                );
                items[index] = await dependencies.store.getImportItem(items[index].id);
                if (decision.status === 'committed-existing') {
                    items[index] = await transitionItem(
                        items[index],
                        I.SKIPPED_EXACT_DUPLICATE
                    );
                } else if (decision.status === 'hash-collision') {
                    items[index] = await failItem(
                        items[index],
                        I.FAILED_VALIDATION,
                        importError(IMPORT_ERROR_CODE.HASH_COLLISION)
                    );
                }
            } catch (error) {
                const safe = safeImportFailure(error);
                items[index] = await failItem(
                    items[index],
                    ownErrorValue(error, 'code') === IMPORT_ERROR_CODE.HASH_COLLISION
                        ? I.FAILED_VALIDATION
                        : I.FAILED_STORAGE,
                    safe
                );
                if (safe.code === IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED) {
                    await terminalizeHashingQuota(jobId, items);
                    return;
                }
            }
            if (await cancellationCheckpoint(jobId, jobStatus)) return;
        }

        await transitionJob(jobId, J.HASHING, J.DECODING);
        jobStatus = J.DECODING;
        if (await cancellationCheckpoint(jobId, jobStatus)) return;

        const decodedItems = new Map();
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            items[index] = await transitionItem(items[index], I.DECODING);
            try {
                const result = await trackImportWorkerRequest(() => dependencies.process({
                    mediaType: artifacts[index].mediaType,
                    content: artifacts[index].content,
                    rawArtifactId: items[index].artifactId
                }));
                const resultValues = ownDataValues(
                    result,
                    ['ok', 'decoded', 'code', 'retryable'],
                    true
                );
                if (!resultValues || resultValues.ok !== true || !resultValues.decoded) {
                    const error = importError(
                        typeof resultValues?.code === 'string'
                            ? resultValues.code
                            : IMPORT_ERROR_CODE.DECODER_FAILED,
                        resultValues?.retryable === true,
                        'decode'
                    );
                    items[index] = await failItem(items[index], I.FAILED_DECODE, error);
                    continue;
                }
                decodedItems.set(items[index].id, resultValues.decoded);
            } catch (error) {
                const safe = importError(IMPORT_ERROR_CODE.WORKER_CRASHED, true, 'decode');
                items[index] = await failItem(items[index], I.FAILED_DECODE, safe);
                await transitionJob(jobId, jobStatus, J.FAILED_DECODE, safe.code);
                return;
            }
            if (await cancellationCheckpoint(jobId, jobStatus)) return;
        }

        await transitionJob(jobId, jobStatus, J.NORMALIZING);
        jobStatus = J.NORMALIZING;
        const bundles = new Map();
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            items[index] = await transitionItem(items[index], I.NORMALIZING);
            try {
                bundles.set(items[index].id, await recordImportPerformanceOperation(
                    'normalizing',
                    async () => normalizeImportedActivity({
                        decoded: decodedItems.get(items[index].id),
                        rawArtifactId: items[index].artifactId
                    })
                ));
            } catch {
                items[index] = await failItem(
                    items[index],
                    I.FAILED_VALIDATION,
                    importError(
                        IMPORT_ERROR_CODE.NORMALIZATION_FAILED,
                        false,
                        'normalize'
                    )
                );
            }
            if (await cancellationCheckpoint(jobId, jobStatus)) return;
        }
        if (await cancellationCheckpoint(jobId, jobStatus)) return;

        await transitionJob(jobId, jobStatus, J.MATCHING);
        jobStatus = J.MATCHING;
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            items[index] = await recordImportPerformanceOperation(
                'matching',
                () => transitionItem(items[index], I.MATCHING)
            );
            if (await cancellationCheckpoint(jobId, jobStatus)) return;
        }
        if (await cancellationCheckpoint(jobId, jobStatus)) return;

        await transitionJob(jobId, jobStatus, J.PERSISTING);
        jobStatus = J.PERSISTING;
        let quotaReached = false;
        let quotaIndex = -1;
        for (let index = 0; index < items.length; index += 1) {
            if (isTerminalImportItem(items[index].status)) continue;
            items[index] = await transitionItem(items[index], I.PERSISTING);
            try {
                await recordImportPerformanceOperation('persistence', () => (
                    dependencies.store.persistImportItem(
                        items[index].id,
                        bundles.get(items[index].id)
                    )
                ));
                items[index] = await dependencies.store.getImportItem(items[index].id);
            } catch (error) {
                const safe = mapStorageError(error, true);
                items[index] = await failItem(
                    items[index],
                    I.FAILED_STORAGE,
                    safe
                );
                quotaReached = safe.code === IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED;
                if (quotaReached) quotaIndex = index;
            }
            if (quotaReached) break;
        }
        if (quotaReached) {
            const quotaFailure = importError(
                IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED,
                true,
                'persist'
            );
            for (let index = quotaIndex + 1; index < items.length; index += 1) {
                if (isTerminalImportItem(items[index].status)) continue;
                try {
                    items[index] = await transitionItem(items[index], I.PERSISTING);
                    items[index] = await failItem(
                        items[index],
                        I.FAILED_STORAGE,
                        quotaFailure
                    );
                } catch {
                    // Terminalization is best-effort under storage pressure.
                    break;
                }
            }
            await transitionJob(
                jobId,
                jobStatus,
                J.FAILED_STORAGE,
                IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED
            );
            return;
        }
        await transitionJob(jobId, jobStatus, J.ANALYZING);
        jobStatus = J.ANALYZING;
        const hasWarnings = items.some(item => (
            item.status !== I.COMPLETED
            && item.status !== I.REVIEW_REQUIRED
            && item.status !== I.SKIPPED_EXACT_DUPLICATE
        )) || [...bundles.values()].some(bundle => bundle.warnings.length > 0);
        await transitionJob(
            jobId,
            jobStatus,
            hasWarnings ? J.COMPLETED_WITH_WARNINGS : J.COMPLETED
        );
    }

    async function getReport(jobId) {
        const job = await dependencies.store.getImportJob(jobId);
        if (!job) throw importError(IMPORT_ERROR_CODE.NOT_FOUND);
        return publicReport(job, await dependencies.store.listImportItems(jobId));
    }

    async function importArtifacts(value) {
        if (closed) throw importError(IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE);
        const artifacts = await snapshotArtifacts(value, () => closed);
        if (closed) throw importError(IMPORT_ERROR_CODE.IMPORT_CANCELLED);
        const jobId = safeId(dependencies.createId, 'job', 0);
        const itemIds = artifacts.map((_, index) => (
            safeId(dependencies.createId, 'item', index)
        ));
        if (new Set([jobId, ...itemIds]).size !== itemIds.length + 1) {
            throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
        }
        await dependencies.store.createImportJob(jobId, itemIds);
        const completion = run(jobId, artifacts).finally(() => active.delete(jobId));
        active.set(jobId, completion);
        return Object.freeze({ jobId, completion });
    }

    async function cancelJob(jobId) {
        const wasActive = active.has(jobId);
        if (wasActive) cancellation.add(jobId);
        const job = await dependencies.store.getImportJob(jobId);
        if (!job) {
            cancellation.delete(jobId);
            throw importError(IMPORT_ERROR_CODE.NOT_FOUND);
        }
        if (
            wasActive
            && (canCancelImportJob(job.status) || job.status === J.HASHING)
        ) {
            observeImportCancellation();
            return Object.freeze({ status: 'cancellation-requested' });
        }
        if (!canCancelImportJob(job.status)) {
            cancellation.delete(jobId);
            throw importError(IMPORT_ERROR_CODE.INVALID_TRANSITION);
        }
        cancellation.add(jobId);
        await cancelRemaining(jobId, job.status);
        return Object.freeze({ status: J.CANCELLED });
    }

    async function retryJob(jobId) {
        if (closed) throw importError(IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE);
        const job = await dependencies.store.getImportJob(jobId);
        if (!job || ![J.FAILED_VALIDATION, J.FAILED_DECODE, J.FAILED_STORAGE].includes(job.status)) {
            throw importError(job ? IMPORT_ERROR_CODE.RETRY_NOT_ALLOWED : IMPORT_ERROR_CODE.NOT_FOUND);
        }
        const items = await dependencies.store.listImportItems(jobId);
        const retryable = items.filter(item => item.retryable === true);
        if (retryable.length === 0) {
            throw importError(IMPORT_ERROR_CODE.RETRY_NOT_ALLOWED);
        }
        for (const item of retryable) {
            if (!item.artifactId || !await dependencies.store.getRawArtifact(item.artifactId)) {
                throw importError(IMPORT_ERROR_CODE.RETRY_NOT_ALLOWED);
            }
        }
        await transitionJob(jobId, job.status, J.RETRYING);
        const completion = run(jobId, null, J.RETRYING).finally(() => active.delete(jobId));
        active.set(jobId, completion);
        return Object.freeze({ jobId, completion });
    }

    return Object.freeze({
        async initialize() {
            if (closed) throw importError(IMPORT_ERROR_CODE.STORAGE_UNAVAILABLE);
            await dependencies.store.initialize();
            return Object.freeze({ status: 'ready' });
        },
        importArtifacts,
        cancelJob,
        retryJob,
        getReport,
        previewActivities: () => readActivitiesPreview(dependencies.store),
        async waitForJob(jobId) {
            const pending = active.get(jobId);
            if (pending) await pending;
            return getReport(jobId);
        },
        async close() {
            closed = true;
            try {
                dependencies.workerClose();
            } catch {
                // Storage closure remains mandatory when a Worker adapter misbehaves.
            }
            await Promise.allSettled(active.values());
            await dependencies.store.close();
            return Object.freeze({ status: 'closed' });
        }
    });
}
