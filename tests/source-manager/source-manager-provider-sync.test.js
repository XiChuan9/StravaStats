import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourceManagerProviderSyncController } from '../../js/app/source-manager-provider-sync.js';

const SUBJECT = '424242';
const ACQUIRED_AT = '2026-08-11T08:09:10.111Z';

function authority(overrides = {}) {
    return Object.freeze({
        subjectId: SUBJECT,
        grantedScopes: Object.freeze(['read', 'activity:read_all']),
        ...overrides
    });
}

function connection(overrides = {}) {
    return Object.freeze({
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: SUBJECT,
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 3,
        ...overrides
    });
}

function successfulReport(count) {
    return Object.freeze({
        schemaVersion: 1,
        status: 'completed',
        totals: Object.freeze({
            total: count,
            completed: count,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: 0,
            cancelled: 0
        }),
        items: Object.freeze(Array.from({ length: count }, (_, ordinal) => Object.freeze({
            ordinal,
            outcome: 'completed',
            errorCode: null,
            retryable: false
        })))
    });
}

function codedError(code) {
    return Object.freeze({ code });
}

function assertDeepFrozen(value) {
    assert.equal(Object.isFrozen(value), true);
    for (const key of Reflect.ownKeys(value)) {
        const child = Object.getOwnPropertyDescriptor(value, key)?.value;
        if (child !== null && typeof child === 'object') assertDeepFrozen(child);
    }
}

function harness({
    tokenAuthority = authority(),
    sourceConnection = connection(),
    list = Object.freeze([{ id: '101' }, { id: '102' }]),
    detail,
    streams,
    report,
    transitionFailure = false,
    importArtifacts,
    waitForJob,
    cancelJob
} = {}) {
    const calls = {
        authority: 0,
        connection: 0,
        reader: 0,
        list: 0,
        detail: [],
        streams: [],
        readerClose: 0,
        mapper: [],
        artifacts: [],
        imports: [],
        waits: [],
        cancels: [],
        transitions: [],
        order: []
    };
    let current = sourceConnection;
    const reader = Object.freeze({
        async list() {
            calls.list += 1;
            calls.order.push('list');
            return typeof list === 'function' ? list() : list;
        },
        async detail(id, options) {
            calls.detail.push(id);
            calls.order.push(`detail:${id}`);
            return detail ? detail(id, options, calls) : Object.freeze({ id });
        },
        async streams(id, options) {
            calls.streams.push(id);
            calls.order.push(`streams:${id}`);
            return streams ? streams(id, options, calls) : Object.freeze({});
        },
        async close() {
            calls.readerClose += 1;
            calls.order.push('reader-close');
            return Object.freeze({ status: 'closed' });
        }
    });
    const options = {
        async readAuthority() {
            calls.authority += 1;
            calls.order.push('authority');
            return tokenAuthority;
        },
        createReader(value) {
            calls.reader += 1;
            calls.order.push('reader');
            assert.strictEqual(value, tokenAuthority);
            return reader;
        },
        connectionStore: Object.freeze({
            async getConnection(provider) {
                calls.connection += 1;
                calls.order.push('connection');
                assert.equal(provider, 'strava');
                return current;
            },
            async transitionConnection(value) {
                calls.transitions.push(value);
                calls.order.push(`transition:${value.status}`);
                if (transitionFailure) throw codedError('CONFLICT');
                current = connection({
                    ...current,
                    status: value.status,
                    lastSyncAt: value.lastSyncAt,
                    errorCode: value.errorCode,
                    revision: current.revision + 1
                });
                return current;
            }
        }),
        createMapper(value) {
            calls.order.push('mapper-factory');
            return Object.freeze({
                mapActivities(input) {
                    calls.mapper.push({ factory: value, input });
                    calls.order.push('map');
                    return Object.freeze(input.activities.map(item => Object.freeze({
                        id: item.summary.id
                    })));
                }
            });
        },
        createArtifacts(value) {
            calls.artifacts.push(value);
            calls.order.push('artifacts');
            return Object.freeze(value.bundles.map(bundle => Object.freeze({ bundle })));
        },
        importFacade: Object.freeze({
            async importArtifacts(value) {
                calls.imports.push(value);
                calls.order.push('import');
                if (importArtifacts) return importArtifacts(value, calls);
                return Object.freeze({ jobId: 'synthetic-job' });
            },
            async cancelJob(jobId) {
                calls.cancels.push(jobId);
                calls.order.push('cancel-job');
                if (cancelJob) return cancelJob(jobId, calls);
                return Object.freeze({ status: 'cancellation-requested' });
            },
            async waitForJob(jobId) {
                calls.waits.push(jobId);
                calls.order.push('wait');
                if (waitForJob) return waitForJob(jobId, calls);
                return report ?? successfulReport(list.length);
            }
        }),
        now() { return ACQUIRED_AT; },
        AbortControllerImpl: AbortController
    };
    return {
        calls,
        controller: createSourceManagerProviderSyncController(options),
        current: () => current
    };
}

test('controller surface is fixed and initialize is completely inert', async () => {
    const { controller, calls } = harness();

    assert.deepEqual(Object.keys(controller), [
        'initialize',
        'getSnapshot',
        'syncLatest',
        'cancel',
        'awaitInactive',
        'close'
    ]);
    assert.equal(Object.isFrozen(controller), true);
    assert.deepEqual(await controller.initialize(), {
        schemaVersion: 1,
        status: 'ready',
        code: null,
        actions: { sync: true, cancel: false },
        totals: null,
        completedItemsRetained: false,
        historyAdvanced: false
    });
    assert.deepEqual(calls, {
        authority: 0, connection: 0, reader: 0, list: 0,
        detail: [], streams: [], readerClose: 0, mapper: [], artifacts: [],
        imports: [], waits: [], cancels: [], transitions: [], order: []
    });
    assertDeepFrozen(controller.getSnapshot());
});

test('missing or malformed authority fails before C2, reader, mapper, artifact, and Import', async () => {
    for (const tokenAuthority of [
        null,
        Object.freeze({
            subjectId: SUBJECT,
            grantedScopes: Object.freeze(['activity:read_all', 'read'])
        }),
        Object.freeze({
            subjectId: SUBJECT,
            grantedScopes: Object.freeze(['read', 'activity:read_all', 'extra'])
        })
    ]) {
        const { controller, calls } = harness({ tokenAuthority });
        await controller.initialize();
        assert.deepEqual(await controller.syncLatest(), {
            schemaVersion: 1,
            status: 'reconnect_required',
            code: 'AUTHORIZATION_REQUIRED',
            actions: { sync: false, cancel: false },
            totals: null,
            completedItemsRetained: false,
            historyAdvanced: false
        });
        assert.equal(calls.authority, 1);
        assert.equal(calls.connection, 0);
        assert.equal(calls.reader, 0);
        assert.equal(calls.mapper.length, 0);
        assert.equal(calls.imports.length, 0);
        assert.deepEqual(calls.transitions, []);
    }
});

test('subject mismatch fails closed without reader construction or C2 mutation', async () => {
    const { controller, calls } = harness({
        tokenAuthority: authority({ subjectId: '525252' })
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'reconnect_required');
    assert.equal(result.code, 'IDENTITY_MISMATCH');
    assert.deepEqual(calls.order, ['authority', 'connection']);
    assert.equal(calls.reader, 0);
    assert.equal(calls.mapper.length, 0);
    assert.equal(calls.artifacts.length, 0);
    assert.equal(calls.imports.length, 0);
    assert.deepEqual(calls.transitions, []);
});

test('error recovery CAS precedes provider I/O and successful pipeline preserves provider order', async () => {
    let inFlight = 0;
    let maximumInFlight = 0;
    const tracked = async value => {
        inFlight += 1;
        maximumInFlight = Math.max(maximumInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return value;
    };
    const original = connection({
        status: 'error',
        errorCode: 'CONNECTION_ERROR',
        lastSyncAt: '2026-08-10T00:00:00.000Z',
        revision: 7
    });
    const { controller, calls } = harness({
        sourceConnection: original,
        list: Object.freeze([{ id: '301' }, { id: '302' }, { id: '303' }]),
        detail: id => tracked(Object.freeze({ id })),
        streams: id => tracked(Object.freeze({ synthetic: id }))
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(maximumInFlight, 2);
    assert.deepEqual(calls.transitions, [
        {
            id: 'source-connection:strava',
            expectedRevision: 7,
            status: 'connected',
            lastSyncAt: '2026-08-10T00:00:00.000Z',
            errorCode: null
        },
        {
            id: 'source-connection:strava',
            expectedRevision: 8,
            status: 'connected',
            lastSyncAt: ACQUIRED_AT,
            errorCode: null
        }
    ]);
    assert.ok(calls.order.indexOf('transition:connected') < calls.order.indexOf('reader'));
    assert.deepEqual(
        calls.mapper[0].input.activities.map(item => item.summary.id),
        ['301', '302', '303']
    );
    assert.deepEqual(calls.artifacts[0].bundles.map(bundle => bundle.id), ['301', '302', '303']);
    assert.equal(calls.imports.length, 1);
    assert.equal(calls.waits.length, 1);
    assert.equal(calls.readerClose, 1);
    assert.equal(result.status, 'completed');
    assert.equal(result.code, null);
    assert.equal(result.historyAdvanced, true);
    assert.equal(result.completedItemsRetained, true);
    assert.deepEqual(result.totals, successfulReport(3).totals);
});

test('duplicate list IDs are rejected before any detail scheduling', async () => {
    const { controller, calls } = harness({
        list: Object.freeze([{ id: '701' }, { id: '701' }])
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'error');
    assert.equal(result.code, 'PROVIDER_LIST_FAILED');
    assert.deepEqual(calls.detail, []);
    assert.deepEqual(calls.streams, []);
    assert.equal(calls.mapper.length, 0);
    assert.equal(calls.imports.length, 0);
    assert.deepEqual(calls.transitions, []);
    assert.equal(calls.readerClose, 1);
});

test('literal null optional enrichments reach the mapper once in provider order', async () => {
    const { controller, calls } = harness({
        list: Object.freeze([{ id: '801' }, { id: '802' }]),
        detail: id => id === '801' ? null : Object.freeze({ id }),
        streams: id => id === '802' ? null : Object.freeze({})
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.historyAdvanced, true);
    assert.deepEqual(calls.mapper[0].input.activities, [
        { summary: { id: '801' }, detail: null, streams: {} },
        { summary: { id: '802' }, detail: { id: '802' }, streams: null }
    ]);
});

test('an optional response-limit signal degrades to null without failing the list', async () => {
    const { controller, calls } = harness({
        list: Object.freeze([{ id: '901' }, { id: '902' }]),
        detail: id => id === '901'
            ? Promise.reject(codedError('SYNC_RESPONSE_LIMIT_EXCEEDED'))
            : Object.freeze({ id }),
        streams: id => id === '902'
            ? Promise.reject(codedError('SYNC_RESPONSE_LIMIT_EXCEEDED'))
            : Object.freeze({})
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.historyAdvanced, true);
    assert.deepEqual(calls.mapper[0].input.activities, [
        { summary: { id: '901' }, detail: null, streams: {} },
        { summary: { id: '902' }, detail: { id: '902' }, streams: null }
    ]);
});

test('401/403 outcome aborts future work and performs only reconnect-required CAS', async () => {
    const { controller, calls } = harness({
        detail(id, { signal }) {
            if (id === '101') return Promise.reject(codedError('SYNC_RECONNECT_REQUIRED'));
            return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(codedError('SYNC_CANCELLED')), {
                    once: true
                });
            });
        }
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'reconnect_required');
    assert.equal(result.code, 'RECONNECT_REQUIRED');
    assert.deepEqual(calls.streams, []);
    assert.equal(calls.mapper.length, 0);
    assert.equal(calls.imports.length, 0);
    assert.deepEqual(calls.transitions, [{
        id: 'source-connection:strava',
        expectedRevision: 3,
        status: 'reconnect_required',
        lastSyncAt: null,
        errorCode: 'AUTHORIZATION_REQUIRED'
    }]);
});

test('429 is fixed try-later, keeps C2 unchanged, and imports nothing', async () => {
    const { controller, calls } = harness({
        list() { throw codedError('SYNC_TRY_LATER'); }
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'error');
    assert.equal(result.code, 'TRY_LATER');
    assert.deepEqual(calls.transitions, []);
    assert.equal(calls.reader, 1);
    assert.equal(calls.imports.length, 0);
});

test('empty acquisition creates no mapper, artifact, Import job, or lastSyncAt CAS', async () => {
    const { controller, calls } = harness({ list: Object.freeze([]) });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'completed');
    assert.equal(result.code, 'NO_ACTIVITIES');
    assert.deepEqual(result.totals, {
        total: 0,
        completed: 0,
        reviewRequired: 0,
        skippedExactDuplicate: 0,
        failed: 0,
        cancelled: 0
    });
    assert.equal(calls.mapper.length, 0);
    assert.equal(calls.artifacts.length, 0);
    assert.equal(calls.imports.length, 0);
    assert.deepEqual(calls.transitions, []);
});

test('acquisition cancellation aborts both workers and imports nothing', async () => {
    let startedResolve;
    const started = new Promise(resolve => { startedResolve = resolve; });
    const { controller, calls } = harness({
        detail(id, { signal }) {
            startedResolve();
            return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(codedError('SYNC_CANCELLED')), {
                    once: true
                });
            });
        }
    });
    await controller.initialize();
    const syncing = controller.syncLatest();
    await started;

    const cancelling = controller.cancel();
    assert.equal(controller.getSnapshot().status, 'cancelling');
    const result = await cancelling;
    assert.strictEqual(await syncing, result);

    assert.equal(result.status, 'cancelled');
    assert.equal(result.code, 'SYNC_CANCELLED');
    assert.equal(calls.imports.length, 0);
    assert.deepEqual(calls.transitions, []);
    assert.equal(calls.readerClose, 1);
});

test('Import cancellation retains committed items and never advances history', async () => {
    let waitingResolve;
    const waiting = new Promise(resolve => { waitingResolve = resolve; });
    let finishReport;
    const terminal = new Promise(resolve => { finishReport = resolve; });
    const partial = Object.freeze({
        schemaVersion: 1,
        status: 'cancelled',
        totals: Object.freeze({
            total: 2,
            completed: 1,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: 0,
            cancelled: 1
        }),
        items: Object.freeze([
            Object.freeze({ ordinal: 0, outcome: 'completed', errorCode: null, retryable: false }),
            Object.freeze({ ordinal: 1, outcome: 'cancelled', errorCode: null, retryable: false })
        ])
    });
    const { controller, calls } = harness({
        waitForJob() {
            waitingResolve();
            return terminal;
        },
        cancelJob() {
            finishReport(partial);
            return Object.freeze({ status: 'cancellation-requested' });
        }
    });
    await controller.initialize();
    const syncing = controller.syncLatest();
    await waiting;

    const result = await controller.cancel();
    assert.strictEqual(await syncing, result);

    assert.equal(result.status, 'cancelled');
    assert.equal(result.completedItemsRetained, true);
    assert.equal(result.historyAdvanced, false);
    assert.deepEqual(result.totals, partial.totals);
    assert.deepEqual(calls.cancels, ['synthetic-job']);
    assert.deepEqual(calls.transitions, []);
});

test('the exact report predicate withholds CAS for a nonaccepted item', async () => {
    const partial = Object.freeze({
        schemaVersion: 1,
        status: 'completed_with_warnings',
        totals: Object.freeze({
            total: 2,
            completed: 1,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: 1,
            cancelled: 0
        }),
        items: Object.freeze([
            Object.freeze({ ordinal: 0, outcome: 'completed', errorCode: null, retryable: false }),
            Object.freeze({ ordinal: 1, outcome: 'failed_storage', errorCode: 'WRITE_FAILED', retryable: true })
        ])
    });
    const { controller, calls } = harness({ report: partial });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'completed');
    assert.equal(result.code, 'IMPORT_INCOMPLETE');
    assert.equal(result.completedItemsRetained, true);
    assert.equal(result.historyAdvanced, false);
    assert.deepEqual(calls.transitions, []);
});

test('a stale success CAS reports retained imports without reread, retry, or rollback', async () => {
    const { controller, calls } = harness({ transitionFailure: true });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'completed');
    assert.equal(result.code, 'HISTORY_NOT_ADVANCED');
    assert.equal(result.completedItemsRetained, true);
    assert.equal(result.historyAdvanced, false);
    assert.equal(calls.connection, 1);
    assert.equal(calls.transitions.length, 1);
    assert.equal(calls.imports.length, 1);
});

test('an invalid Import job ID makes no unverified retained-item claim', async () => {
    const { controller, calls } = harness({
        importArtifacts() { return Object.freeze({ jobId: null }); }
    });
    await controller.initialize();

    const result = await controller.syncLatest();

    assert.equal(result.status, 'error');
    assert.equal(result.code, 'IMPORT_REPORT_INVALID');
    assert.equal(result.completedItemsRetained, false);
    assert.equal(result.historyAdvanced, false);
    assert.deepEqual(calls.waits, []);
    assert.deepEqual(calls.transitions, []);
});

test('cancellation queued after wait resolution but before continuation prevents success CAS', async () => {
    let reportResolve;
    const reportReady = new Promise(resolve => { reportResolve = resolve; });
    let waitingResolve;
    const waiting = new Promise(resolve => { waitingResolve = resolve; });
    const { controller, calls } = harness({
        waitForJob() {
            waitingResolve();
            return reportReady;
        }
    });
    await controller.initialize();
    const syncing = controller.syncLatest();
    await waiting;

    reportResolve(successfulReport(2));
    const cancelling = controller.cancel();
    await cancelling;
    const result = await syncing;

    assert.equal(result.status, 'cancelled');
    assert.equal(result.historyAdvanced, false);
    assert.deepEqual(calls.cancels, ['synthetic-job']);
    assert.deepEqual(calls.transitions, []);
});

test('awaitInactive waits without cancelling, while close cancels Import and is idempotent', async () => {
    let waitingResolve;
    const waiting = new Promise(resolve => { waitingResolve = resolve; });
    let finishReport;
    const terminal = new Promise(resolve => { finishReport = resolve; });
    const { controller, calls } = harness({
        waitForJob() {
            waitingResolve();
            return terminal;
        },
        cancelJob() {
            finishReport(successfulReport(2));
            return Object.freeze({ status: 'cancellation-requested' });
        }
    });
    await controller.initialize();
    const syncing = controller.syncLatest();
    await waiting;
    let inactiveSettled = false;
    const inactive = controller.awaitInactive().then(() => { inactiveSettled = true; });
    await Promise.resolve();
    assert.equal(inactiveSettled, false);
    assert.deepEqual(calls.cancels, []);

    const firstClose = controller.close();
    const secondClose = controller.close();
    assert.strictEqual(firstClose, secondClose);
    assert.deepEqual(await firstClose, { status: 'closed' });
    await inactive;
    await syncing;

    assert.deepEqual(calls.cancels, ['synthetic-job']);
    assert.equal(controller.getSnapshot().status, 'closed');
    assert.equal(controller.getSnapshot().historyAdvanced, false);
    await assert.rejects(controller.syncLatest(), error => {
        assert.deepEqual(error, { code: 'SYNC_CLOSED' });
        return true;
    });
});
