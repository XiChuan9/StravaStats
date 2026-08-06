import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    getFeatureFlags
} from '../../js/app/feature-flags.js';
import {
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';
import {
    closeApplicationShadowWriter,
    exportApplicationShadowParityReport,
    flushApplicationShadowWrites,
    getApplicationShadowWriter
} from '../../js/shadow/index.js';

const APP_SESSION_MODE = Object.freeze({ DEMO: 'demo', REAL: 'real' });
const mainSource = await readFile(new URL('../../js/app/main.js', import.meta.url), 'utf8');

function compileBoundary(
    source,
    shadowWriterFactory = getApplicationShadowWriter,
    featureFlagsFactory = getFeatureFlags
) {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const body = source
        .slice(start + startMarker.length, end)
        .replace(/export\s+(async\s+)?function/g, '$1function');
    return Function(
        'createRepository',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'APP_SESSION_MODE',
        'getFeatureFlags',
        'getApplicationShadowWriter',
        `"use strict";${body};return { createSummaryRepositorySession };`
    )(
        () => { throw new Error('Unexpected default Repository construction'); },
        REPOSITORY_SOURCE,
        REPOSITORY_WARNING_CODE,
        APP_SESSION_MODE,
        featureFlagsFactory,
        shadowWriterFactory
    );
}

const { createSummaryRepositorySession } = compileBoundary(mainSource);

function activity(id = 'opaque-app-shadow') {
    return {
        id,
        sport_type: 'Run',
        type: 'Run',
        start_date: '2026-08-05T06:00:00Z',
        distance: 1000,
        moving_time: 300,
        elapsed_time: 320,
        average_heartrate: null,
        average_watts: 0,
        gear_id: 'synthetic-gear',
        map: { summary_polyline: '' }
    };
}

function repositoryFactory(envelope, calls) {
    return options => {
        calls.factory.push(options);
        return {
            async listActivities(listOptions) {
                calls.list.push(listOptions);
                return envelope;
            },
            async getActivity() { throw new Error('not used'); },
            async getStreams() { throw new Error('not used'); },
            async getAthlete() { throw new Error('not used'); },
            async getZones() { throw new Error('not used'); },
            async getGears() { throw new Error('not used'); }
        };
    };
}

async function withPlatform(flags, callback) {
    const keys = [
        'indexedDB',
        'IDBKeyRange',
        '__STRAVASTATS_FEATURE_FLAGS__'
    ];
    const originals = new Map(keys.map(key => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key)
    ]));
    await closeApplicationShadowWriter();
    try {
        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            writable: true,
            value: new IDBFactory()
        });
        Object.defineProperty(globalThis, 'IDBKeyRange', {
            configurable: true,
            writable: true,
            value: IDBKeyRange
        });
        Object.defineProperty(globalThis, '__STRAVASTATS_FEATURE_FLAGS__', {
            configurable: true,
            writable: true,
            value: flags
        });
        return await callback();
    } finally {
        await closeApplicationShadowWriter();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

test('real network result schedules shadow write but returns the Legacy envelope data unchanged', async () => {
    await withPlatform({
        dataRepositoryMode: 'shadow',
        canonicalShadowWriteEnabled: true
    }, async () => {
        const activities = [activity()];
        const envelope = {
            data: activities,
            source: 'network',
            warnings: [],
            partial: false
        };
        const calls = { factory: [], list: [] };
        const session = createSummaryRepositorySession({
            sessionMode: APP_SESSION_MODE.REAL,
            repositoryFactory: repositoryFactory(envelope, calls)
        });

        const result = await session.listActivities({ refresh: true });
        assert.equal(result.data, activities);
        assert.deepEqual(calls.factory, [{ sessionMode: 'real', mode: 'legacy' }]);
        assert.deepEqual(calls.list, [{ refresh: true }]);
        const report = JSON.parse(await flushApplicationShadowWrites());
        assert.equal(report.totals.committed, 1);
        assert.equal(report.fields.activityCount.matched, 1);
        assert.equal(JSON.stringify(report).includes('opaque-app-shadow'), false);
        assert.equal(JSON.stringify(report).includes('synthetic-gear'), false);
    });
});

test('synchronous shadow observer failure cannot reject a successful Legacy result', async () => {
    const throwingBoundary = compileBoundary(
        mainSource,
        () => ({
            enqueueLegacyActivities() {
                throw new Error('PRIVATE_SYNCHRONOUS_SHADOW_FAILURE');
            }
        }),
        () => ({
            dataRepositoryMode: 'shadow',
            localImportEnabled: false,
            canonicalShadowWriteEnabled: true
        })
    );
    const activities = [activity('opaque-sync-failure')];
    const calls = { factory: [], list: [] };
    const session = throwingBoundary.createSummaryRepositorySession({
        sessionMode: APP_SESSION_MODE.REAL,
        repositoryFactory: repositoryFactory({
            data: activities,
            source: 'network',
            warnings: [],
            partial: false
        }, calls)
    });

    const result = await session.listActivities({ refresh: true });
    assert.equal(result.data, activities);
    assert.equal(result.source, 'network');
});

test('cache results never invent an API shadow write event', async () => {
    await withPlatform({
        dataRepositoryMode: 'shadow',
        canonicalShadowWriteEnabled: true
    }, async () => {
        const calls = { factory: [], list: [] };
        const session = createSummaryRepositorySession({
            sessionMode: APP_SESSION_MODE.REAL,
            repositoryFactory: repositoryFactory({
                data: [activity('opaque-cache-only')],
                source: 'cache',
                warnings: [],
                partial: false
            }, calls)
        });
        const result = await session.listActivities({ refresh: false });
        assert.equal(result.source, 'cache');
        const report = JSON.parse(exportApplicationShadowParityReport());
        assert.deepEqual(report.batches, []);
    });
});

test('enabled shadow mode reports unavailable browser storage without blocking Legacy success', async () => {
    await withPlatform({
        dataRepositoryMode: 'shadow',
        canonicalShadowWriteEnabled: true
    }, async () => {
        delete globalThis.indexedDB;
        delete globalThis.IDBKeyRange;
        const calls = { factory: [], list: [] };
        const activities = [activity('opaque-storage-unavailable')];
        const session = createSummaryRepositorySession({
            sessionMode: APP_SESSION_MODE.REAL,
            repositoryFactory: repositoryFactory({
                data: activities,
                source: 'network',
                warnings: [],
                partial: false
            }, calls)
        });

        const result = await session.listActivities({ refresh: true });
        assert.equal(result.data, activities);
        const exported = await flushApplicationShadowWrites();
        const report = JSON.parse(exported);
        assert.equal(report.totals.storageFailed, 1);
        assert.equal(
            report.batches[0].activities[0].differences.some(item => item.reason === 'UNAVAILABLE'),
            true
        );
        assert.equal(exported.includes('opaque-storage-unavailable'), false);
    });
});

test('Demo, Legacy, unsafe, and disabled shadow modes keep page reads Legacy with zero writer', async () => {
    const scenarios = [
        { sessionMode: APP_SESSION_MODE.DEMO, mode: 'shadow', enabled: true },
        { sessionMode: APP_SESSION_MODE.REAL, mode: 'legacy', enabled: true },
        { sessionMode: APP_SESSION_MODE.REAL, mode: 'unknown', enabled: true },
        { sessionMode: APP_SESSION_MODE.REAL, mode: 'shadow', enabled: false }
    ];
    for (const scenario of scenarios) {
        await withPlatform({
            dataRepositoryMode: scenario.mode,
            canonicalShadowWriteEnabled: scenario.enabled
        }, async () => {
            const calls = { factory: [], list: [] };
            const activities = [activity(`opaque-${scenario.mode}`)];
            const session = createSummaryRepositorySession({
                sessionMode: scenario.sessionMode,
                repositoryFactory: repositoryFactory({
                    data: activities,
                    source: scenario.sessionMode === 'demo' ? 'demo' : 'network',
                    warnings: [],
                    partial: false
                }, calls)
            });
            const result = await session.listActivities({ refresh: true });
            assert.equal(result.data, activities);
            assert.deepEqual(calls.factory, [{
                sessionMode: scenario.sessionMode,
                mode: 'legacy'
            }]);
            assert.equal(exportApplicationShadowParityReport(), null);
        });
    }
});

test('Explicit Real canonical reads canonical with zero shadow writer', async () => {
    await withPlatform({
        dataRepositoryMode: 'canonical',
        canonicalShadowWriteEnabled: true
    }, async () => {
        const calls = { factory: [], list: [] };
        const activities = [activity('opaque-canonical')];
        const session = createSummaryRepositorySession({
            sessionMode: APP_SESSION_MODE.REAL,
            repositoryFactory: repositoryFactory({
                data: activities,
                source: 'canonical',
                warnings: [],
                partial: false
            }, calls)
        });
        const result = await session.listActivities({ refresh: true });
        assert.equal(result.data, activities);
        assert.equal(result.source, 'canonical');
        assert.deepEqual(calls.factory, [{
            sessionMode: APP_SESSION_MODE.REAL,
            mode: 'canonical'
        }]);
        assert.deepEqual(calls.list, [{ refresh: true }]);
        assert.equal(exportApplicationShadowParityReport(), null);
    });
});

test('direct application flag boundary rejects sparse, extra, symbol, and accessor shapes', async () => {
    await withPlatform({
        dataRepositoryMode: 'legacy',
        canonicalShadowWriteEnabled: false
    }, async () => {
        let getterCalls = 0;
        const accessor = {
            dataRepositoryMode: 'shadow',
            localImportEnabled: false
        };
        Object.defineProperty(accessor, 'canonicalShadowWriteEnabled', {
            enumerable: true,
            get() {
                getterCalls += 1;
                return true;
            }
        });
        const symbol = {
            dataRepositoryMode: 'shadow',
            localImportEnabled: false,
            canonicalShadowWriteEnabled: true,
            [Symbol('unsafe')]: true
        };
        const extra = {
            dataRepositoryMode: 'shadow',
            localImportEnabled: false,
            canonicalShadowWriteEnabled: true,
            unexpected: true
        };
        const sparse = {
            dataRepositoryMode: 'shadow',
            canonicalShadowWriteEnabled: true
        };

        for (const unsafe of [accessor, symbol, extra, sparse]) {
            assert.equal(getApplicationShadowWriter(unsafe), null);
        }
        assert.equal(getterCalls, 0);
    });
});

test('main insertion point is non-awaiting and changes read mode only for explicit canonical', async () => {
    const source = await readFile(new URL('../../js/app/main.js', import.meta.url), 'utf8');
    assert.match(
        source,
        /mode:\s*featureFlags\?\.dataRepositoryMode === 'canonical'[\s\S]*?\? 'canonical'[\s\S]*?: 'legacy'/
    );
    assert.match(source, /adapted\.source === REPOSITORY_SOURCE\.NETWORK/);
    assert.match(source, /shadowWriter\.enqueueLegacyActivities\(adapted\.data\)/);
    assert.doesNotMatch(source, /await\s+shadowWriter\.enqueueLegacyActivities/);
});
