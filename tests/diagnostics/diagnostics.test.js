import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DIAGNOSTICS_ERROR_LIMIT,
    DIAGNOSTICS_EXPORT_MAX_BYTES,
    createDiagnosticsExport,
    estimateOriginStorage,
    installGlobalDiagnosticsListeners,
    readRecentDiagnosticErrors,
    recordDiagnosticError
} from '../../js/diagnostics/index.js';

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }
}

function fixedClock(...values) {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
}

test('recent errors use the exact safe schema, deduplicate, and retain at most twenty', () => {
    const storage = new MemoryStorage();
    const now = fixedClock(
        '2026-08-07T00:00:00.000Z',
        '2026-08-07T00:00:01.000Z'
    );

    assert.equal(recordDiagnosticError({
        page: 'dashboard',
        category: 'page',
        code: 'DASHBOARD_START_FAILED',
        message: 'private message must be discarded',
        activityId: 'private-id-must-be-discarded'
    }, { storage, now }), true);
    assert.equal(recordDiagnosticError({
        page: 'dashboard',
        category: 'page',
        code: 'DASHBOARD_START_FAILED'
    }, { storage, now }), true);

    const repeated = readRecentDiagnosticErrors({ storage });
    assert.equal(repeated.status, 'available');
    assert.deepEqual(repeated.records, [{
        version: 1,
        occurredAt: '2026-08-07T00:00:01.000Z',
        page: 'dashboard',
        category: 'page',
        code: 'DASHBOARD_START_FAILED',
        count: 2
    }]);

    const pages = [
        'dashboard', 'diagnostics', 'storage-backup', 'source-manager',
        'activity-router', 'activity', 'run', 'bike', 'swim'
    ];
    const categories = ['page', 'database', 'backup', 'analysis'];
    const codes = ['UNCAUGHT_ERROR', 'UNHANDLED_REJECTION', 'DETAIL_LOAD_FAILED'];
    let ordinal = 2;
    for (const page of pages) {
        for (const category of categories) {
            const code = codes[ordinal % codes.length];
            recordDiagnosticError({ page, category, code }, {
                storage,
                now: () => `2026-08-07T00:00:${String(ordinal++).padStart(2, '0')}.000Z`
            });
        }
    }

    const bounded = readRecentDiagnosticErrors({ storage });
    assert.equal(bounded.records.length, DIAGNOSTICS_ERROR_LIMIT);
    for (const record of bounded.records) {
        assert.deepEqual(Object.keys(record), [
            'version', 'occurredAt', 'page', 'category', 'code', 'count'
        ]);
        assert.equal(Object.hasOwn(record, 'message'), false);
        assert.equal(Object.hasOwn(record, 'activityId'), false);
    }
});

test('sessionStorage denial degrades without throwing or creating another persistence path', () => {
    const storage = {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); }
    };
    assert.equal(recordDiagnosticError({
        page: 'diagnostics',
        category: 'page',
        code: 'DIAGNOSTICS_START_FAILED'
    }, { storage, now: () => '2026-08-07T00:00:00.000Z' }), true);
    assert.deepEqual(readRecentDiagnosticErrors({ storage }), {
        status: 'memory',
        records: [{
            version: 1,
            occurredAt: '2026-08-07T00:00:00.000Z',
            page: 'diagnostics',
            category: 'page',
            code: 'DIAGNOSTICS_START_FAILED',
            count: 1
        }]
    });
});

test('only adjacent identical errors coalesce', () => {
    const storage = new MemoryStorage();
    const now = fixedClock(
        '2026-08-07T00:00:00.000Z',
        '2026-08-07T00:00:01.000Z',
        '2026-08-07T00:00:02.000Z'
    );
    recordDiagnosticError({
        page: 'dashboard', category: 'page', code: 'DASHBOARD_START_FAILED'
    }, { storage, now });
    recordDiagnosticError({
        page: 'dashboard', category: 'page', code: 'UNCAUGHT_ERROR'
    }, { storage, now });
    recordDiagnosticError({
        page: 'dashboard', category: 'page', code: 'DASHBOARD_START_FAILED'
    }, { storage, now });

    assert.deepEqual(
        readRecentDiagnosticErrors({ storage }).records.map(record => ({
            code: record.code,
            count: record.count
        })),
        [
            { code: 'DASHBOARD_START_FAILED', count: 1 },
            { code: 'UNCAUGHT_ERROR', count: 1 },
            { code: 'DASHBOARD_START_FAILED', count: 1 }
        ]
    );
});

test('global listeners are category-only, idempotent, and never prevent browser defaults', () => {
    const storage = new MemoryStorage();
    const listeners = new Map();
    const target = {
        addEventListener(type, listener) {
            listeners.set(type, listener);
        }
    };

    assert.equal(installGlobalDiagnosticsListeners({
        target,
        page: 'diagnostics',
        storage,
        now: fixedClock(
            '2026-08-07T00:00:00.000Z',
            '2026-08-07T00:00:01.000Z'
        )
    }), true);
    assert.equal(installGlobalDiagnosticsListeners({ target, page: 'diagnostics', storage }), false);
    assert.deepEqual([...listeners.keys()].sort(), ['error', 'unhandledrejection']);

    let prevented = 0;
    const hostileEvent = {};
    Object.defineProperties(hostileEvent, {
        error: { get() { throw new Error('must not inspect error'); } },
        reason: { get() { throw new Error('must not inspect reason'); } },
        message: { get() { throw new Error('must not inspect message'); } },
        preventDefault: { value() { prevented += 1; } }
    });
    listeners.get('error')(hostileEvent);
    listeners.get('unhandledrejection')(hostileEvent);

    assert.equal(prevented, 0);
    assert.deepEqual(
        readRecentDiagnosticErrors({ storage }).records.map(record => ({
            category: record.category,
            code: record.code
        })),
        [
            { category: 'page', code: 'UNCAUGHT_ERROR' },
            { category: 'page', code: 'UNHANDLED_REJECTION' }
        ]
    );
});

test('origin storage estimate uses coarse labels and honest degraded states', async () => {
    assert.deepEqual(await estimateOriginStorage({ storageManager: null }), {
        status: 'unsupported',
        scopeLabel: 'Browser origin estimate',
        usageLabel: 'Estimated origin storage use',
        usageValue: 'Unavailable',
        quotaLabel: 'Estimated origin storage quota',
        quotaValue: 'Unavailable',
        headroomLabel: 'Estimated origin storage headroom',
        headroomValue: 'Unavailable',
        percentUsed: 'Unavailable'
    });
    assert.deepEqual(await estimateOriginStorage({
        storageManager: { estimate: async () => ({
            usage: 10.49 * 1024 * 1024,
            quota: 100.49 * 1024 * 1024
        }) }
    }), {
        status: 'available',
        scopeLabel: 'Browser origin estimate',
        usageLabel: 'Estimated origin storage use',
        usageValue: 'About 10 MiB',
        quotaLabel: 'Estimated origin storage quota',
        quotaValue: 'About 100 MiB',
        headroomLabel: 'Estimated origin storage headroom',
        headroomValue: 'About 90 MiB',
        percentUsed: 'About 10.4%'
    });
    assert.deepEqual(await estimateOriginStorage({
        storageManager: { estimate: async () => { throw new Error('denied'); } }
    }), {
        status: 'unavailable',
        scopeLabel: 'Browser origin estimate',
        usageLabel: 'Estimated origin storage use',
        usageValue: 'Unavailable',
        quotaLabel: 'Estimated origin storage quota',
        quotaValue: 'Unavailable',
        headroomLabel: 'Estimated origin storage headroom',
        headroomValue: 'Unavailable',
        percentUsed: 'Unavailable'
    });
    const hostileManager = {};
    Object.defineProperty(hostileManager, 'estimate', {
        get() { throw new Error('denied'); }
    });
    assert.deepEqual(await estimateOriginStorage({ storageManager: hostileManager }), {
        status: 'unavailable',
        scopeLabel: 'Browser origin estimate',
        usageLabel: 'Estimated origin storage use',
        usageValue: 'Unavailable',
        quotaLabel: 'Estimated origin storage quota',
        quotaValue: 'Unavailable',
        headroomLabel: 'Estimated origin storage headroom',
        headroomValue: 'Unavailable',
        percentUsed: 'Unavailable'
    });
});

test('diagnostics export is deterministic, safe, and bounded to 256 KiB', () => {
    const performanceRecord = {
        version: 1,
        outcome: 'completed',
        artifactCount: 2,
        terminalCounts: {
            completed: 2,
            reviewRequired: 0,
            skippedExactDuplicate: 0,
            failed: 0,
            cancelled: 0,
            notStarted: 0
        },
        totalMilliseconds: 12,
        stageMilliseconds: {
            validation: 1,
            hashing: 2,
            decoding: 3,
            normalizing: 1,
            matching: 1,
            persistence: 4
        },
        decoderMilliseconds: { sum: 3, maximum: 2 },
        persistenceMilliseconds: { sum: 4, maximum: 3 },
        cancellationObservedMilliseconds: null,
        peakWorkerRequests: 1
    };
    const input = {
        createdAt: '2026-08-07T00:00:00.000Z',
        storageEstimate: {
            status: 'available',
            scopeLabel: 'Browser origin estimate',
            usageLabel: 'Estimated origin storage use',
            usageValue: 'About 10 MiB',
            quotaLabel: 'Estimated origin storage quota',
            quotaValue: 'About 100 MiB',
            headroomLabel: 'Estimated origin storage headroom',
            headroomValue: 'About 90 MiB',
            percentUsed: 'About 10%'
        },
        recentErrors: [{
            version: 1,
            occurredAt: '2026-08-07T00:00:01.000Z',
            page: 'dashboard',
            category: 'page',
            code: 'DASHBOARD_START_FAILED',
            count: 1
        }],
        importPerformance: [performanceRecord]
    };
    const first = createDiagnosticsExport(input);
    const second = createDiagnosticsExport(input);
    assert.deepEqual(first, second);
    assert.equal(first.byteLength, new TextEncoder().encode(first.json).byteLength);
    assert.equal(first.byteLength <= DIAGNOSTICS_EXPORT_MAX_BYTES, true);
    assert.equal(
        first.mimeType,
        'application/vnd.stravastats.diagnostics+json;version=1'
    );
    assert.equal(first.filename, 'stravastats-diagnostics-20260807T000000000Z.json');
    assert.deepEqual(JSON.parse(first.json), {
        version: 1,
        createdAt: input.createdAt,
        storageEstimate: input.storageEstimate,
        recentErrors: input.recentErrors,
        importPerformance: [performanceRecord],
        omittedRecords: {
            recentErrors: 0,
            importPerformance: 0
        }
    });
    assert.equal(first.json.endsWith('\n'), true);
});
