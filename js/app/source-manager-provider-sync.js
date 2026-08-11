const OPTION_FIELDS = Object.freeze([
    'readAuthority',
    'createReader',
    'connectionStore',
    'createMapper',
    'createArtifacts',
    'importFacade',
    'beginHistoryCommit',
    'now',
    'AbortControllerImpl'
]);
const AUTHORITY_FIELDS = Object.freeze(['subjectId', 'grantedScopes']);
const CONNECTION_FIELDS = Object.freeze([
    'id',
    'provider',
    'subjectId',
    'status',
    'lastSyncAt',
    'errorCode',
    'revision'
]);
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const ACCEPTED_OUTCOMES = new Set([
    'completed',
    'review_required',
    'skipped_exact_duplicate'
]);
const COMPLETED_JOB_STATUSES = new Set(['completed', 'completed_with_warnings']);
const READER_FATAL_CODES = Object.freeze({
    SYNC_AUTHORITY_INVALID: 'AUTHORITY_INVALID',
    SYNC_CANCELLED: 'CANCELLED',
    SYNC_CLOSED: 'CLOSED',
    SYNC_RECONNECT_REQUIRED: 'RECONNECT_REQUIRED',
    SYNC_TRY_LATER: 'TRY_LATER',
    SYNC_LIST_FAILED: 'LIST_FAILED',
    SYNC_RESPONSE_LIMIT_EXCEEDED: 'RESPONSE_LIMIT_EXCEEDED'
});

const CLOSED_RESULT = Object.freeze({ status: 'closed' });
const CLOSED_ERROR = Object.freeze({ code: 'SYNC_CLOSED' });
const INITIALIZATION_ERROR = Object.freeze({ code: 'SYNC_INITIALIZATION_FAILED' });
const ACTION_ERROR = Object.freeze({ code: 'SYNC_ACTION_UNAVAILABLE' });

function dataProperty(value, key) {
    try {
        if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
            return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function exactRecord(value, fields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== fields.length
            || keys.some(key => typeof key !== 'string' || !fields.includes(key))
        ) return null;
        const result = Object.create(null);
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function denseArray(value, maximum) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
        const keys = Reflect.ownKeys(value);
        if (keys.length !== length + 1 || keys.some(key => typeof key !== 'string')) return null;
        const result = new Array(length);
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[index] = descriptor.value;
        }
        return result;
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

function positiveOpaqueId(value) {
    return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null;
}

function exactAuthority(value) {
    const authority = exactRecord(value, AUTHORITY_FIELDS);
    if (!authority || !positiveOpaqueId(authority.subjectId)) return null;
    const scopes = denseArray(authority.grantedScopes, REQUIRED_SCOPES.length);
    if (
        !scopes
        || scopes.length !== REQUIRED_SCOPES.length
        || !scopes.every((scope, index) => scope === REQUIRED_SCOPES[index])
    ) return null;
    return Object.freeze({
        subjectId: authority.subjectId,
        grantedScopes: Object.freeze([...scopes])
    });
}

function exactConnection(value) {
    const connection = exactRecord(value, CONNECTION_FIELDS);
    if (
        !connection
        || connection.id !== 'source-connection:strava'
        || connection.provider !== 'strava'
        || !positiveOpaqueId(connection.subjectId)
        || !['connected', 'error'].includes(connection.status)
        || (connection.lastSyncAt !== null && !strictUtc(connection.lastSyncAt))
        || (
            connection.status === 'connected'
                ? connection.errorCode !== null
                : connection.errorCode !== 'CONNECTION_ERROR'
        )
        || !Number.isSafeInteger(connection.revision)
        || connection.revision < 1
    ) return null;
    return Object.freeze({ ...connection });
}

function method(value, name) {
    const found = dataProperty(value, name);
    return typeof found === 'function'
        ? (...args) => Reflect.apply(found, value, args)
        : null;
}

function dependenciesFrom(value) {
    const options = exactRecord(value, OPTION_FIELDS);
    if (!options) return null;
    const getConnection = method(options.connectionStore, 'getConnection');
    const transitionConnection = method(options.connectionStore, 'transitionConnection');
    const importArtifacts = method(options.importFacade, 'importArtifacts');
    const cancelJob = method(options.importFacade, 'cancelJob');
    const waitForJob = method(options.importFacade, 'waitForJob');
    if (
        typeof options.readAuthority !== 'function'
        || typeof options.createReader !== 'function'
        || !getConnection
        || !transitionConnection
        || typeof options.createMapper !== 'function'
        || typeof options.createArtifacts !== 'function'
        || !importArtifacts
        || !cancelJob
        || !waitForJob
        || typeof options.beginHistoryCommit !== 'function'
        || typeof options.now !== 'function'
        || typeof options.AbortControllerImpl !== 'function'
    ) return null;
    return Object.freeze({
        readAuthority: options.readAuthority,
        createReader: options.createReader,
        getConnection,
        transitionConnection,
        createMapper: options.createMapper,
        createArtifacts: options.createArtifacts,
        importArtifacts,
        cancelJob,
        waitForJob,
        beginHistoryCommit: options.beginHistoryCommit,
        now: options.now,
        AbortControllerImpl: options.AbortControllerImpl
    });
}

function emptyTotals() {
    return Object.freeze({
        total: 0,
        completed: 0,
        reviewRequired: 0,
        skippedExactDuplicate: 0,
        failed: 0,
        cancelled: 0
    });
}

function snapshot({
    status,
    code = null,
    totals = null,
    completedItemsRetained = false,
    historyAdvanced = false,
    cancelAvailable = status === 'syncing'
}) {
    const canSync = ['ready', 'completed', 'cancelled'].includes(status)
        || (status === 'error' && code !== 'SYNC_INITIALIZATION_FAILED');
    return Object.freeze({
        schemaVersion: 1,
        status,
        code,
        actions: Object.freeze({
            sync: canSync,
            cancel: cancelAvailable
        }),
        totals,
        completedItemsRetained,
        historyAdvanced
    });
}

function safeReaderCode(error) {
    const code = dataProperty(error, 'code');
    return typeof code === 'string' && Object.hasOwn(READER_FATAL_CODES, code)
        ? READER_FATAL_CODES[code]
        : null;
}

function readerFrom(value) {
    const list = method(value, 'list');
    const detail = method(value, 'detail');
    const streams = method(value, 'streams');
    const close = method(value, 'close');
    return list && detail && streams && close
        ? Object.freeze({ list, detail, streams, close })
        : null;
}

function summariesFrom(value) {
    const summaries = denseArray(value, 25);
    if (!summaries) return null;
    const ids = new Set();
    const result = [];
    for (const summary of summaries) {
        const id = positiveOpaqueId(dataProperty(summary, 'id'));
        if (!id || ids.has(id)) return null;
        ids.add(id);
        result.push(Object.freeze({ summary, id }));
    }
    return Object.freeze(result);
}

function safeReport(value) {
    const report = exactRecord(value, ['schemaVersion', 'status', 'totals', 'items']);
    if (!report || report.schemaVersion !== 1) return null;
    const status = report.status;
    const totalsValue = report.totals;
    const itemsValue = report.items;
    const totalFields = [
        'total', 'completed', 'reviewRequired',
        'skippedExactDuplicate', 'failed', 'cancelled'
    ];
    const totalsRecord = exactRecord(totalsValue, totalFields);
    const items = denseArray(itemsValue, 25);
    if (
        typeof status !== 'string'
        || !totalsRecord
        || !items
        || totalFields.some(field => (
            !Number.isSafeInteger(totalsRecord[field]) || totalsRecord[field] < 0
        ))
        || totalsRecord.total !== items.length
    ) return null;
    const outcomes = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = exactRecord(
            items[index],
            ['ordinal', 'outcome', 'errorCode', 'retryable']
        );
        if (
            !item
            || !Number.isSafeInteger(item.ordinal)
            || item.ordinal !== index
            || typeof item.outcome !== 'string'
            || (item.errorCode !== null && typeof item.errorCode !== 'string')
            || typeof item.retryable !== 'boolean'
        ) {
            return null;
        }
        outcomes.push(item.outcome);
    }
    return Object.freeze({
        status,
        totals: Object.freeze({ ...totalsRecord }),
        outcomes: Object.freeze(outcomes)
    });
}

function successfulReport(report) {
    return report !== null
        && COMPLETED_JOB_STATUSES.has(report.status)
        && report.totals.total >= 1
        && report.totals.failed === 0
        && report.totals.cancelled === 0
        && report.outcomes.every(outcome => ACCEPTED_OUTCOMES.has(outcome))
        && report.totals.completed
            + report.totals.reviewRequired
            + report.totals.skippedExactDuplicate === report.totals.total;
}

function acceptedCount(report) {
    if (!report) return 0;
    return report.totals.completed
        + report.totals.reviewRequired
        + report.totals.skippedExactDuplicate;
}

function transitionInput(connection, status, lastSyncAt, errorCode) {
    return Object.freeze({
        id: 'source-connection:strava',
        expectedRevision: connection.revision,
        status,
        lastSyncAt,
        errorCode
    });
}

export function createSourceManagerProviderSyncController(options) {
    const dependencies = dependenciesFrom(options);
    let initialized = false;
    let closed = false;
    let closing = null;
    let active = null;
    let activeAbort = null;
    let activeReader = null;
    let activeJobId = null;
    let importCancel = null;
    let cancelRequested = false;
    let suppressSuccessCas = false;
    let successCommitStarted = false;
    let currentSnapshot = snapshot({
        status: 'error',
        code: 'SYNC_INITIALIZATION_FAILED'
    });

    function setSnapshot(value) {
        if (closed && value.status !== 'closed') return currentSnapshot;
        currentSnapshot = snapshot(value);
        return currentSnapshot;
    }

    function cancelled() {
        return cancelRequested || closed;
    }

    function abortAcquisition() {
        try {
            if (activeAbort && !activeAbort.signal.aborted) activeAbort.abort();
        } catch {}
    }

    function requestImportCancellation() {
        if (activeJobId === null || importCancel !== null || !dependencies) {
            return importCancel ?? Promise.resolve();
        }
        const jobId = activeJobId;
        importCancel = Promise.resolve()
            .then(() => dependencies.cancelJob(jobId))
            .catch(() => undefined);
        return importCancel;
    }

    function terminal(value) {
        return setSnapshot(value);
    }

    async function fatalAcquisition(error, connection) {
        const code = safeReaderCode(error);
        if (cancelled() || code === 'CANCELLED' || (code === 'CLOSED' && closed)) {
            return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
        }
        if (code === 'AUTHORITY_INVALID') {
            return terminal({ status: 'reconnect_required', code: 'AUTHORIZATION_REQUIRED' });
        }
        if (code === 'RECONNECT_REQUIRED') {
            try {
                if (!closed) {
                    await dependencies.transitionConnection(transitionInput(
                        connection,
                        'reconnect_required',
                        connection.lastSyncAt,
                        'AUTHORIZATION_REQUIRED'
                    ));
                }
            } catch {}
            return terminal({ status: 'reconnect_required', code: 'RECONNECT_REQUIRED' });
        }
        if (code === 'TRY_LATER') {
            return terminal({ status: 'error', code: 'TRY_LATER' });
        }
        return terminal({ status: 'error', code: 'PROVIDER_LIST_FAILED' });
    }

    async function acquireActivities(reader, summaries, signal) {
        const acquired = new Array(summaries.length);
        let nextIndex = 0;
        let fatal = null;

        async function worker() {
            while (!fatal && !cancelled()) {
                const index = nextIndex;
                if (index >= summaries.length) return;
                nextIndex += 1;
                const { id, summary } = summaries[index];
                let detail = null;
                let streams = null;
                try {
                    detail = await reader.detail(id, Object.freeze({ signal }));
                } catch (error) {
                    const code = safeReaderCode(error);
                    if (code !== null && code !== 'RESPONSE_LIMIT_EXCEEDED') {
                        if (fatal === null) {
                            fatal = error;
                            abortAcquisition();
                        }
                        return;
                    }
                    detail = null;
                }
                if (fatal || cancelled()) return;
                try {
                    streams = await reader.streams(id, Object.freeze({ signal }));
                } catch (error) {
                    const code = safeReaderCode(error);
                    if (code !== null && code !== 'RESPONSE_LIMIT_EXCEEDED') {
                        if (fatal === null) {
                            fatal = error;
                            abortAcquisition();
                        }
                        return;
                    }
                    streams = null;
                }
                if (fatal || cancelled()) return;
                acquired[index] = Object.freeze({ summary, detail, streams });
            }
        }

        await Promise.all([worker(), worker()]);
        if (fatal) throw fatal;
        if (cancelled()) throw Object.freeze({ code: 'CANCELLED' });
        for (let index = 0; index < acquired.length; index += 1) {
            if (acquired[index] === undefined) {
                throw Object.freeze({ code: 'SYNC_LIST_FAILED' });
            }
        }
        return Object.freeze(acquired);
    }

    async function runSync() {
        let connection = null;
        let report = null;
        try {
            let opaqueAuthority;
            try {
                opaqueAuthority = await Reflect.apply(dependencies.readAuthority, null, []);
            } catch {
                return terminal({ status: 'reconnect_required', code: 'AUTHORIZATION_REQUIRED' });
            }
            if (cancelled()) return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
            const authority = exactAuthority(opaqueAuthority);
            if (!authority) {
                return terminal({ status: 'reconnect_required', code: 'AUTHORIZATION_REQUIRED' });
            }
            try {
                connection = exactConnection(await dependencies.getConnection('strava'));
            } catch {
                connection = null;
            }
            if (!connection) {
                return terminal({ status: 'reconnect_required', code: 'CONNECTION_REQUIRED' });
            }
            if (connection.subjectId !== authority.subjectId) {
                return terminal({ status: 'reconnect_required', code: 'IDENTITY_MISMATCH' });
            }
            if (connection.status === 'error') {
                try {
                    connection = exactConnection(await dependencies.transitionConnection(
                        transitionInput(connection, 'connected', connection.lastSyncAt, null)
                    ));
                } catch {
                    connection = null;
                }
                if (!connection || connection.status !== 'connected') {
                    return terminal({ status: 'error', code: 'CONNECTION_UPDATE_FAILED' });
                }
            }
            if (cancelled()) return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });

            let reader;
            try {
                reader = readerFrom(await Reflect.apply(
                    dependencies.createReader,
                    null,
                    [opaqueAuthority]
                ));
            } catch (error) {
                return fatalAcquisition(error, connection);
            }
            if (!reader) {
                return terminal({ status: 'reconnect_required', code: 'AUTHORIZATION_REQUIRED' });
            }
            activeReader = reader;
            if (cancelled()) {
                return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
            }
            try {
                activeAbort = new dependencies.AbortControllerImpl();
            } catch {
                return terminal({ status: 'error', code: 'PROVIDER_LIST_FAILED' });
            }
            let summaries;
            try {
                summaries = summariesFrom(await reader.list(Object.freeze({
                    signal: activeAbort.signal
                })));
                if (!summaries) throw Object.freeze({ code: 'SYNC_LIST_FAILED' });
                if (summaries.length === 0) {
                    return terminal({
                        status: 'completed',
                        code: 'NO_ACTIVITIES',
                        totals: emptyTotals()
                    });
                }
                const activities = await acquireActivities(
                    reader,
                    summaries,
                    activeAbort.signal
                );
                if (cancelled()) {
                    return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
                }

                let acquiredAt;
                try {
                    acquiredAt = Reflect.apply(dependencies.now, null, []);
                } catch {
                    acquiredAt = null;
                }
                if (
                    !strictUtc(acquiredAt)
                    || (
                        connection.lastSyncAt !== null
                        && acquiredAt <= connection.lastSyncAt
                    )
                ) return terminal({ status: 'error', code: 'CLOCK_INVALID' });

                const session = Object.freeze({
                    provider: 'strava',
                    subjectId: authority.subjectId,
                    grantedScopes: authority.grantedScopes
                });
                if (cancelled()) {
                    return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
                }
                let bundles;
                try {
                    const mapper = Reflect.apply(
                        dependencies.createMapper,
                        null,
                        [Object.freeze({ session, connection })]
                    );
                    const mapActivities = method(mapper, 'mapActivities');
                    if (!mapActivities) throw new Error();
                    bundles = mapActivities(Object.freeze({
                        cancelled: false,
                        acquiredAt,
                        activities
                    }));
                } catch {
                    return terminal({ status: 'error', code: 'MAPPING_FAILED' });
                }
                if (cancelled()) {
                    return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
                }
                let artifacts;
                try {
                    artifacts = Reflect.apply(
                        dependencies.createArtifacts,
                        null,
                        [Object.freeze({ bundles, connection })]
                    );
                } catch {
                    return terminal({ status: 'error', code: 'ARTIFACT_FAILED' });
                }
                if (cancelled()) {
                    return terminal({ status: 'cancelled', code: 'SYNC_CANCELLED' });
                }

                let job;
                try {
                    job = await dependencies.importArtifacts(artifacts, Object.freeze({
                        sourceConnectionRevision: connection.revision,
                        acquiredAt
                    }));
                } catch {
                    return terminal({ status: 'error', code: 'IMPORT_FAILED' });
                }
                const jobId = dataProperty(job, 'jobId');
                if (typeof jobId !== 'string' || jobId.length === 0) {
                    return terminal({
                        status: 'error',
                        code: 'IMPORT_REPORT_INVALID'
                    });
                }
                activeJobId = jobId;
                if (cancelled()) await requestImportCancellation();
                let rawReport;
                try {
                    rawReport = await dependencies.waitForJob(jobId);
                } catch {
                    return terminal({
                        status: cancelled() ? 'cancelled' : 'error',
                        code: cancelled() ? 'SYNC_CANCELLED' : 'IMPORT_FAILED',
                        completedItemsRetained: true
                    });
                }
                activeJobId = null;
                importCancel = null;
                report = safeReport(rawReport);
                if (!report) {
                    return terminal({
                        status: cancelled() ? 'cancelled' : 'error',
                        code: cancelled() ? 'SYNC_CANCELLED' : 'IMPORT_REPORT_INVALID',
                        completedItemsRetained: true
                    });
                }
                const retained = acceptedCount(report) > 0;
                if (cancelled()) {
                    return terminal({
                        status: 'cancelled',
                        code: 'SYNC_CANCELLED',
                        totals: report.totals,
                        completedItemsRetained: retained
                    });
                }
                if (!successfulReport(report)) {
                    return terminal({
                        status: 'completed',
                        code: 'IMPORT_INCOMPLETE',
                        totals: report.totals,
                        completedItemsRetained: retained
                    });
                }
                if (suppressSuccessCas || closed) {
                    return terminal({
                        status: 'cancelled',
                        code: 'SYNC_CANCELLED',
                        totals: report.totals,
                        completedItemsRetained: retained
                    });
                }
                successCommitStarted = true;
                setSnapshot({ status: 'syncing', cancelAvailable: false });
                try {
                    await dependencies.beginHistoryCommit();
                    await dependencies.transitionConnection(transitionInput(
                        connection,
                        'connected',
                        acquiredAt,
                        null
                    ));
                } catch {
                    return terminal({
                        status: 'completed',
                        code: 'HISTORY_NOT_ADVANCED',
                        totals: report.totals,
                        completedItemsRetained: true
                    });
                }
                return terminal({
                    status: 'completed',
                    totals: report.totals,
                    completedItemsRetained: retained,
                    historyAdvanced: true
                });
            } catch (error) {
                return fatalAcquisition(error, connection);
            }
        } finally {
            activeJobId = null;
            importCancel = null;
            activeAbort = null;
            const reader = activeReader;
            activeReader = null;
            if (reader) {
                try {
                    await reader.close();
                } catch {}
            }
        }
    }

    async function syncLatest() {
        if (closed) throw CLOSED_ERROR;
        if (!initialized || !dependencies) throw INITIALIZATION_ERROR;
        if (active !== null) throw ACTION_ERROR;
        cancelRequested = false;
        suppressSuccessCas = false;
        successCommitStarted = false;
        setSnapshot({ status: 'syncing' });
        let operation;
        operation = runSync().finally(() => {
            if (active === operation) active = null;
        });
        active = operation;
        return operation;
    }

    async function cancel() {
        if (closed) throw CLOSED_ERROR;
        if (!initialized || !dependencies) throw INITIALIZATION_ERROR;
        if (active === null || successCommitStarted) throw ACTION_ERROR;
        cancelRequested = true;
        suppressSuccessCas = true;
        setSnapshot({ status: 'cancelling' });
        abortAcquisition();
        await requestImportCancellation();
        await active;
        return currentSnapshot;
    }

    async function advanceRecoveredHistory(value) {
        const input = exactRecord(value, [
            'sourceConnectionRevision', 'acquiredAt', 'report'
        ]);
        const report = input ? safeReport(input.report) : null;
        if (
            closed
            || !initialized
            || active !== null
            || !input
            || !Number.isSafeInteger(input.sourceConnectionRevision)
            || input.sourceConnectionRevision < 1
            || !strictUtc(input.acquiredAt)
            || !successfulReport(report)
        ) return false;
        let authority;
        let connection;
        try {
            authority = exactAuthority(await dependencies.readAuthority());
            connection = exactConnection(await dependencies.getConnection('strava'));
        } catch {
            return false;
        }
        if (
            !authority
            || !connection
            || connection.status !== 'connected'
            || connection.subjectId !== authority.subjectId
            || connection.revision !== input.sourceConnectionRevision
            || (connection.lastSyncAt !== null && input.acquiredAt <= connection.lastSyncAt)
        ) return false;
        try {
            const advanced = exactConnection(await dependencies.transitionConnection(
                transitionInput(connection, 'connected', input.acquiredAt, null)
            ));
            return advanced !== null
                && advanced.revision === connection.revision + 1
                && advanced.lastSyncAt === input.acquiredAt;
        } catch {
            return false;
        }
    }

    return Object.freeze({
        initialize() {
            if (closed) return Promise.reject(CLOSED_ERROR);
            if (initialized) return Promise.resolve(currentSnapshot);
            initialized = true;
            if (!dependencies) return Promise.resolve(currentSnapshot);
            return Promise.resolve(setSnapshot({ status: 'ready' }));
        },
        getSnapshot() {
            return currentSnapshot;
        },
        syncLatest,
        cancel,
        advanceRecoveredHistory,
        async awaitInactive() {
            if (active) await active;
            return currentSnapshot;
        },
        close() {
            if (closing) return closing;
            const drainSuccessCommit = successCommitStarted;
            closed = true;
            currentSnapshot = snapshot({ status: 'closed' });
            if (!drainSuccessCommit) {
                cancelRequested = true;
                suppressSuccessCas = true;
                abortAcquisition();
            }
            closing = (async () => {
                if (!drainSuccessCommit) await requestImportCancellation();
                if (active) await active;
                return CLOSED_RESULT;
            })();
            return closing;
        }
    });
}
