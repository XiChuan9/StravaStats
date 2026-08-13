import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    DEMO_ACTIVITIES_KEY,
    DEMO_ATHLETE_KEY,
    DEMO_ATHLETE_TIMESTAMP_KEY,
    DEMO_GEARS_KEY,
    DEMO_GEARS_TIMESTAMP_KEY,
    DEMO_MODE_KEY,
    DEMO_STORAGE_ERROR,
    DEMO_STORAGE_KEYS,
    DEMO_TOKENS_KEY,
    DEMO_TRAINING_ZONES_KEY,
    DEMO_TRAINING_ZONES_TIMESTAMP_KEY,
    clearDemoData,
    getDemoActivities,
    getDemoAthlete,
    getDemoGears,
    getDemoTokens,
    getDemoTrainingZones,
    loadDemoData
} from '../../js/demo/index.js';
import {
    fetchAllActivities,
    fetchAllGears,
    fetchAthleteData,
    fetchGearById,
    fetchTrainingZones,
    getCachedGears,
    setCachedGears
} from '../../js/services/api.js';
import {
    createRepository,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';
import { createAICoachSession } from '../../js/app/ai-coach-egress.js';

const FIXED_NOW = '2026-07-29T08:30:00.000Z';
const FIXED_NOW_MS = Date.parse(FIXED_NOW);
const FIXED_REFERENCE_DATE = '2026-07-29T12:00:00.000Z';
const REAL_ACCESS_TOKEN = 'synthetic-real-access-token';
const REAL_REFRESH_TOKEN = 'synthetic-real-refresh-token';
const ATHLETE_ID = 1001001;

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(([key, value]) => [key, String(value)])
        );
        this.operations = [];
        this.getItemCalls = [];
        this.failSetKeyOnce = null;
        this.failedSet = false;
        this.forbiddenReads = new Set();
    }

    get length() {
        return this.values.size;
    }

    key(index) {
        return [...this.values.keys()].sort()[index] ?? null;
    }

    getItem(key) {
        this.getItemCalls.push(key);
        if (this.forbiddenReads.has(key)) {
            throw new Error(`Prohibited synthetic read: ${key}`);
        }
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.operations.push({ operation: 'set', key });
        if (key === this.failSetKeyOnce && !this.failedSet) {
            this.failedSet = true;
            throw new Error('Synthetic demo write failure');
        }
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.operations.push({ operation: 'remove', key });
        this.values.delete(key);
    }

    snapshot() {
        return Object.fromEntries([...this.values.entries()].sort());
    }
}

function realLibrary() {
    return {
        strava_tokens: JSON.stringify({
            access_token: REAL_ACCESS_TOKEN,
            refresh_token: REAL_REFRESH_TOKEN,
            expires_at: 2100000000
        }),
        strava_activities: '[{"id":"synthetic-real-activity-001"}]',
        strava_activities_timestamp: '1700000000000',
        strava_cache_version: 'synthetic-real-v1',
        strava_athlete_data: JSON.stringify({
            id: ATHLETE_ID,
            firstname: 'Synthetic',
            lastname: 'Athlete'
        }),
        strava_athlete_data_timestamp: '1700000000001',
        strava_training_zones: '{"heartrate":[{"min":0,"max":150}]}',
        strava_training_zones_timestamp: '1700000000002',
        strava_gears: '[{"id":"synthetic-real-gear-001"}]',
        strava_gears_timestamp: '1700000000003',
        dashboard_filters: '{"sport":"Run"}',
        dashboard_readiness_hrv: '{"enabled":true}',
        dashboard_settings: '{"theme":"dark"}',
        training_goals: '{"weeklyActivities":4}',
        run_plus_capacity_inputs_v1: '{"capacity":42}',
        'gear-custom-synthetic-real-001': '{"nickname":"Real Gear"}',
        legacy_rescue_export_marker: 'synthetic-rescue-preserved'
    };
}

function demoNamespace({
    tokens = {
        access_token: 'synthetic-demo-access-token',
        refresh_token: 'synthetic-demo-refresh-token',
        expires_at: 2100000000
    }
} = {}) {
    return {
        [DEMO_MODE_KEY]: 'true',
        [DEMO_ACTIVITIES_KEY]: JSON.stringify([{
            id: 'synthetic-demo-activity-001',
            sport_type: 'Run'
        }]),
        [DEMO_ATHLETE_KEY]: JSON.stringify({
            id: 'demo-athlete-0001',
            firstname: 'Demo'
        }),
        [DEMO_TRAINING_ZONES_KEY]: JSON.stringify({
            heartrate: [{ min: 0, max: 142 }]
        }),
        [DEMO_GEARS_KEY]: JSON.stringify([{
            id: 'synthetic-demo-gear-001',
            name: 'Demo Shoes'
        }]),
        [DEMO_ATHLETE_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_TRAINING_ZONES_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_GEARS_TIMESTAMP_KEY]: String(FIXED_NOW_MS),
        [DEMO_TOKENS_KEY]: typeof tokens === 'string'
            ? tokens
            : JSON.stringify(tokens)
    };
}

function realSnapshot(storage) {
    return Object.fromEntries(
        Object.entries(storage.snapshot())
            .filter(([key]) => !DEMO_STORAGE_KEYS.includes(key))
    );
}

const REAL_LOCAL_LIBRARY_READ_KEYS = Object.freeze([
    'strava_tokens',
    'strava_activities',
    'strava_activities_timestamp',
    'strava_cache_version',
    'strava_athlete_data',
    'strava_athlete_data_timestamp',
    'strava_training_zones',
    'strava_training_zones_timestamp',
    'strava_gears',
    'strava_gears_timestamp'
]);

function assertNoRealLocalLibraryReads(storage) {
    assert.deepEqual(
        storage.getItemCalls.filter(key => (
            REAL_LOCAL_LIBRARY_READ_KEYS.includes(key)
        )),
        []
    );
}

function assertDemoCleared(storage) {
    for (const key of DEMO_STORAGE_KEYS) {
        assert.equal(storage.values.has(key), false, `${key} should be removed`);
    }
}

function oauthResponse(athleteId = ATHLETE_ID) {
    return {
        access_token: 'synthetic-oauth-access-token',
        refresh_token: 'synthetic-oauth-refresh-token',
        expires_at: 2200000000,
        athlete: { id: athleteId }
    };
}

function jsonResponse(data) {
    return {
        ok: true,
        status: 200,
        headers: {
            get: name => name.toLowerCase() === 'content-type'
                ? 'application/json'
                : null
        },
        json: async () => data
    };
}

const savedGlobals = {
    alert: globalThis.alert,
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    window: globalThis.window
};

globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ textContent: '', innerHTML: '' })
};
globalThis.window = {
    location: {
        origin: 'https://synthetic.example',
        pathname: '/dashboard',
        search: '',
        reload: () => {}
    },
    history: {
        replaceState: () => {}
    }
};
globalThis.alert = () => {};

const {
    handleAuth,
    loginWithDemo,
    logout
} = await import('../../js/app/auth.js?demo-isolation-test');
const {
    selectTrendsMetadataContext
} = await import('../../js/tabs/athlete.js?demo-isolation-test');
const {
    renderGearGanttChart: renderRunGearGanttChart,
    setRunSessionGears
} = await import('../../js/tabs/run-analysis.js');
const {
    renderGearTab
} = await import('../../js/tabs/gear.js?demo-isolation-test');
const {
    preprocessActivities
} = await import('../../js/shared/preprocessing/index.js?demo-isolation-test');

const projectRoot = new URL('../../', import.meta.url);
const mainSource = await readFile(
    new URL('js/app/main.js', projectRoot),
    'utf8'
);

function compileSummaryBoundary(source) {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} is required`);
    assert.notEqual(end, -1, `${endMarker} is required`);

    const boundarySource = source
        .slice(start + startMarker.length, end)
        .replace(/export\s+(async\s+)?function/g, '$1function');
    return Function(
        'createRepository',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'APP_SESSION_MODE',
        'getFeatureFlags',
        'getApplicationShadowWriter',
        `"use strict";${boundarySource};return {
            establishSummaryRepositorySession,
            requireSummaryRepositorySession,
            loadActivitiesForSession,
            loadInitializeAthleteAndZones,
            loadRefreshAthleteAndZones,
            loadOptionalSessionGears,
            resetSummarySessionGears,
            applySummarySessionGearLoad,
            buildSessionGearNameMap,
            createRunPlusRenderOptions,
            selectPreprocessingAthlete
        };`
    )(
        () => {
            throw new Error('Unexpected default Repository construction');
        },
        REPOSITORY_SOURCE,
        REPOSITORY_WARNING_CODE,
        Object.freeze({ DEMO: 'demo', REAL: 'real' }),
        () => Object.freeze({ dataRepositoryMode: 'legacy' }),
        () => null
    );
}

const {
    establishSummaryRepositorySession,
    requireSummaryRepositorySession,
    loadActivitiesForSession,
    loadInitializeAthleteAndZones,
    loadRefreshAthleteAndZones,
    loadOptionalSessionGears,
    resetSummarySessionGears,
    applySummarySessionGearLoad,
    buildSessionGearNameMap,
    createRunPlusRenderOptions,
    selectPreprocessingAthlete
} = compileSummaryBoundary(mainSource);

function repositoryEnvelope(data, source = REPOSITORY_SOURCE.DEMO) {
    return {
        data,
        source,
        warnings: [],
        partial: false
    };
}

function repositorySessionHarness({ storage, sessionMode = 'demo' }) {
    const calls = {
        factory: 0,
        listActivities: [],
        getActivity: [],
        getStreams: [],
        getAthlete: 0,
        getZones: 0,
        getGears: 0
    };
    const repository = {
        async listActivities(options) {
            calls.listActivities.push(options);
            return repositoryEnvelope(
                sessionMode === 'demo'
                    ? getDemoActivities(storage)
                    : [{ id: 'synthetic-real-repository-activity' }],
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.CACHE
            );
        },
        async getActivity(activityId) {
            calls.getActivity.push(activityId);
            const activity = sessionMode === 'demo'
                ? getDemoActivities(storage).find(item => String(item.id) === activityId)
                : { id: activityId, laps: [] };
            return repositoryEnvelope(
                activity,
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.NETWORK
            );
        },
        async getStreams(activityId, options) {
            calls.getStreams.push({ activityId, options });
            return repositoryEnvelope(
                {},
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.NETWORK
            );
        },
        async getAthlete() {
            calls.getAthlete += 1;
            return repositoryEnvelope(
                sessionMode === 'demo'
                    ? getDemoAthlete(storage)
                    : { id: ATHLETE_ID, firstname: 'Synthetic' },
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.CACHE
            );
        },
        async getZones() {
            calls.getZones += 1;
            return repositoryEnvelope(
                sessionMode === 'demo'
                    ? getDemoTrainingZones(storage)
                    : { heartrate: [] },
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.CACHE
            );
        },
        async getGears() {
            calls.getGears += 1;
            return repositoryEnvelope(
                sessionMode === 'demo'
                    ? getDemoGears(storage)
                    : [{ id: 'synthetic-real-repository-gear' }],
                sessionMode === 'demo'
                    ? REPOSITORY_SOURCE.DEMO
                    : REPOSITORY_SOURCE.CACHE
            );
        }
    };
    const factory = options => {
        calls.factory += 1;
        assert.deepEqual(options, { sessionMode, mode: 'legacy' });
        return repository;
    };
    return {
        calls,
        factory,
        repository
    };
}

test.after(() => {
    for (const [key, value] of Object.entries(savedGlobals)) {
        if (value === undefined) {
            delete globalThis[key];
        } else {
            globalThis[key] = value;
        }
    }
});

test('Demo namespace is frozen to the nine approved keys', () => {
    assert.deepEqual(DEMO_STORAGE_KEYS, [
        'strava_demo_mode',
        'strava_demo_activities',
        'strava_demo_athlete_data',
        'strava_demo_training_zones',
        'strava_demo_gears',
        'strava_demo_athlete_data_timestamp',
        'strava_demo_training_zones_timestamp',
        'strava_demo_gears_timestamp',
        'strava_tokens_demo'
    ]);
});

test('Main Demo initialization ignores a populated real activity cache', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const harness = repositorySessionHarness({ storage, sessionMode: 'demo' });
    const established = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'demo',
        repositoryFactory: harness.factory
    });
    const result = await loadActivitiesForSession({
        sessionRepository: established.sessionRepository,
        refresh: false
    });

    assert.equal(result.source, 'demo');
    assert.equal(result.data[0].id, 'synthetic-demo-activity-001');
    assert.equal(
        result.data.some(activity => activity.id === 'synthetic-real-activity-001'),
        false
    );
    assert.equal(harness.calls.factory, 1);
    assert.deepEqual(harness.calls.listActivities, [{ refresh: false }]);
    assertNoRealLocalLibraryReads(storage);
    assert.deepEqual(storage.snapshot(), before);
});

test('Main Demo initialization with no real cache never opens or creates it', async () => {
    const emptyRealLibrary = realLibrary();
    delete emptyRealLibrary.strava_activities;
    delete emptyRealLibrary.strava_activities_timestamp;
    delete emptyRealLibrary.strava_cache_version;
    const storage = new MemoryStorage({
        ...emptyRealLibrary,
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const harness = repositorySessionHarness({ storage, sessionMode: 'demo' });
    const established = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'demo',
        repositoryFactory: harness.factory
    });
    const result = await loadActivitiesForSession({
        sessionRepository: established.sessionRepository,
        refresh: false
    });

    assert.equal(result.source, 'demo');
    assert.equal(result.data[0].id, 'synthetic-demo-activity-001');
    assertNoRealLocalLibraryReads(storage);
    assert.deepEqual(storage.snapshot(), before);
});

test('Main Demo refresh remains offline and preserves the real cache byte-for-byte', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const harness = repositorySessionHarness({ storage, sessionMode: 'demo' });
    const established = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'demo',
        repositoryFactory: harness.factory
    });
    const repository = requireSummaryRepositorySession(
        established.activeSessionMode,
        established.sessionRepository
    );
    const initial = await loadActivitiesForSession({
        sessionRepository: repository,
        refresh: false
    });
    const result = await loadActivitiesForSession({
        sessionRepository: repository,
        refresh: true
    });

    assert.equal(initial.source, 'demo');
    assert.equal(result.source, 'demo');
    assert.equal(result.data[0].id, 'synthetic-demo-activity-001');
    assert.equal(harness.calls.factory, 1);
    assert.deepEqual(harness.calls.listActivities, [
        { refresh: false },
        { refresh: true }
    ]);
    assertNoRealLocalLibraryReads(storage);
    assert.deepEqual(storage.snapshot(), before);
});

test('Main Demo metadata and gears stay inside the Demo Repository path', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const harness = repositorySessionHarness({ storage, sessionMode: 'demo' });
    const established = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'demo',
        repositoryFactory: harness.factory
    });
    const metadata = await loadInitializeAthleteAndZones(
        established.sessionRepository,
        { timeoutMs: 100 }
    );
    const gears = await loadOptionalSessionGears(
        established.sessionRepository,
        metadata.athlete
    );

    assert.equal(metadata.athlete.firstname, 'Demo');
    assert.equal(metadata.zones.heartrate[0].max, 142);
    assert.equal(gears.data[0].id, 'synthetic-demo-gear-001');
    assert.equal(harness.calls.getAthlete, 1);
    assert.equal(harness.calls.getZones, 1);
    assert.equal(harness.calls.getGears, 1);
    assertNoRealLocalLibraryReads(storage);
    assert.deepEqual(storage.snapshot(), before);
});

test('Actual Demo Factory through the main session facade performs zero real I/O', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    for (const key of REAL_LOCAL_LIBRARY_READ_KEYS) {
        storage.forbiddenReads.add(key);
    }
    const beforeRealSnapshot = JSON.stringify(realSnapshot(storage));
    const savedDescriptors = Object.fromEntries(
        ['fetch', 'btoa', 'indexedDB', 'localStorage'].map(key => [
            key,
            Object.getOwnPropertyDescriptor(globalThis, key)
        ])
    );
    const calls = {
        factory: 0,
        fetch: 0,
        btoa: 0,
        indexedDb: 0
    };
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: storage
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: async () => {
            calls.fetch += 1;
            throw new Error('Prohibited synthetic fetch');
        }
    });
    Object.defineProperty(globalThis, 'btoa', {
        configurable: true,
        writable: true,
        value: () => {
            calls.btoa += 1;
            throw new Error('Prohibited synthetic btoa');
        }
    });
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        get() {
            calls.indexedDb += 1;
            throw new Error('Prohibited synthetic IndexedDB access');
        }
    });

    try {
        const established = establishSummaryRepositorySession({
            activeSessionMode: null,
            sessionRepository: null,
            requestedSessionMode: 'demo',
            repositoryFactory: options => {
                calls.factory += 1;
                return createRepository(options);
            }
        });
        const repository = requireSummaryRepositorySession(
            established.activeSessionMode,
            established.sessionRepository
        );
        const initial = await repository.listActivities({ refresh: false });
        const athlete = await repository.getAthlete();
        const zones = await repository.getZones();
        const gears = await repository.getGears();
        const refreshed = await repository.listActivities({ refresh: true });

        for (const result of [initial, athlete, zones, gears, refreshed]) {
            assert.equal(result.source, REPOSITORY_SOURCE.DEMO);
        }
        assert.equal(initial.data[0].id, 'synthetic-demo-activity-001');
        assert.equal(refreshed.data[0].id, 'synthetic-demo-activity-001');
        assert.equal(athlete.data.firstname, 'Demo');
        assert.equal(zones.data.heartrate[0].max, 142);
        assert.equal(gears.data[0].id, 'synthetic-demo-gear-001');
        assert.equal(calls.factory, 1);
        assert.equal(calls.fetch, 0);
        assert.equal(calls.btoa, 0);
        assert.equal(calls.indexedDb, 0);
        assertNoRealLocalLibraryReads(storage);
        assert.deepEqual(
            storage.operations.filter(({ key }) => (
                REAL_LOCAL_LIBRARY_READ_KEYS.includes(key)
            )),
            []
        );
        assert.equal(JSON.stringify(realSnapshot(storage)), beforeRealSnapshot);
    } finally {
        for (const [key, descriptor] of Object.entries(savedDescriptors)) {
            if (descriptor === undefined) delete globalThis[key];
            else Object.defineProperty(globalThis, key, descriptor);
        }
    }
});

test('Main real-mode initialize and refresh delegate Legacy cache behavior to one Repository', async () => {
    const storage = new MemoryStorage(realLibrary());
    const harness = repositorySessionHarness({ storage, sessionMode: 'real' });
    const established = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'real',
        repositoryFactory: harness.factory
    });
    const initial = await loadActivitiesForSession({
        sessionRepository: established.sessionRepository,
        refresh: false
    });
    const refreshed = await loadActivitiesForSession({
        sessionRepository: established.sessionRepository,
        refresh: true
    });
    const metadata = await loadRefreshAthleteAndZones(
        established.sessionRepository
    );

    assert.equal(initial.source, REPOSITORY_SOURCE.CACHE);
    assert.equal(refreshed.source, REPOSITORY_SOURCE.CACHE);
    assert.equal(metadata.athlete.id, ATHLETE_ID);
    assert.equal(harness.calls.factory, 1);
    assert.deepEqual(harness.calls.listActivities, [
        { refresh: false },
        { refresh: true }
    ]);
});

test('Main gear labels use only session gears with no real gear-key reads', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    storage.forbiddenReads.add('strava_gears');

    const demoMap = buildSessionGearNameMap([{
        id: 'synthetic-demo-session-gear',
        name: 'Demo Session Shoes'
    }]);
    assert.equal(
        demoMap.get('synthetic-demo-session-gear'),
        'Demo Session Shoes'
    );
    assert.equal(buildSessionGearNameMap(null).size, 0);
    assert.equal(buildSessionGearNameMap('{malformed').size, 0);

    const realMap = buildSessionGearNameMap([{
        id: 'synthetic-real-session-gear',
        brand_name: 'Synthetic',
        model_name: 'Trainer'
    }]);
    assert.equal(
        realMap.get('synthetic-real-session-gear'),
        'Synthetic Trainer'
    );
    assert.equal(
        storage.getItemCalls.filter(key => key === 'strava_gears').length,
        0
    );
});

test('Run session gear snapshot is detached, ordered, duplicate-safe, and used by Gantt labels', async () => {
    const savedChart = globalThis.Chart;
    const savedGetElementById = globalThis.document.getElementById;
    const chartConfigs = [];
    const canvas = { id: 'gear-gantt-chart' };
    globalThis.document.getElementById = id => (
        id === 'gear-gantt-chart' ? canvas : null
    );
    globalThis.Chart = class ChartStub {
        constructor(_canvas, config) {
            this.config = config;
            chartConfigs.push(config);
        }

        destroy() {}
    };

    try {
        const defaultRuns = [{
            gear_id: 'fallback-gear-id',
            start_date_local: '2026-01-02T06:00:00.000Z',
            distance: 1000
        }];
        await renderRunGearGanttChart(defaultRuns);
        assert.deepEqual(
            chartConfigs.at(-1).data.datasets.map(dataset => dataset.label),
            ['fallback-gear-id']
        );

        const input = [
            { id: 'shoe-2', name: 'Second Shoe' },
            { id: 'shoe-1', name: 'First Shoe' },
            { id: 'shoe-2', name: 'Second Shoe Duplicate' }
        ];
        const snapshot = setRunSessionGears(input);
        assert.notEqual(snapshot, input);
        assert.equal(Object.isFrozen(snapshot), true);
        assert.deepEqual(snapshot.map(gear => gear.id), [
            'shoe-2',
            'shoe-1',
            'shoe-2'
        ]);
        input.length = 0;
        input.push({ id: 'mutated-after-set', name: 'Must Not Appear' });

        await renderRunGearGanttChart([
            {
                gear_id: 'shoe-2',
                start_date_local: '2026-01-02T06:00:00.000Z',
                distance: 2000
            },
            {
                gear_id: 'shoe-1',
                start_date_local: '2026-01-03T06:00:00.000Z',
                distance: 3000
            }
        ]);
        assert.deepEqual(
            chartConfigs.at(-1).data.datasets.map(dataset => dataset.label),
            ['Second Shoe Duplicate', 'First Shoe']
        );

        let getterCalls = 0;
        let iteratorCalls = 0;
        const accessorArray = [];
        Object.defineProperty(accessorArray, '0', {
            enumerable: true,
            get() {
                getterCalls += 1;
                return { id: 'private-gear' };
            }
        });
        assert.deepEqual(setRunSessionGears(accessorArray), []);
        const customIterator = [];
        Object.defineProperty(customIterator, Symbol.iterator, {
            value() {
                iteratorCalls += 1;
                return [][Symbol.iterator]();
            }
        });
        assert.deepEqual(setRunSessionGears(customIterator), []);
        assert.deepEqual(setRunSessionGears(null), []);
        assert.equal(getterCalls, 0);
        assert.equal(iteratorCalls, 0);

        const frozenInput = Object.freeze([{ id: 'frozen-gear' }]);
        assert.deepEqual(
            setRunSessionGears(frozenInput).map(gear => gear.id),
            ['frozen-gear']
        );
    } finally {
        setRunSessionGears([]);
        globalThis.document.getElementById = savedGetElementById;
        if (savedChart === undefined) delete globalThis.Chart;
        else globalThis.Chart = savedChart;
    }
});

test('Gear filter rerender keeps its injected snapshot and preserves UI-owned storage', () => {
    const savedDocument = globalThis.document;
    const savedStorage = globalThis.localStorage;
    const savedChart = globalThis.Chart;
    const savedSetTimeout = globalThis.setTimeout;
    const storage = new MemoryStorage({
        ...realLibrary(),
        'gear-custom-shoe-1': JSON.stringify({ price: 140, durationKm: 800 }),
        gearEditMode: 'false'
    });
    storage.forbiddenReads.add('strava_gears');

    const registry = new Map();
    const allElements = new Set();
    const chartConfigs = [];
    let filterDiv = null;
    const classList = () => ({ add() {}, remove() {}, toggle() {} });

    class FakeElement {
        constructor(id = '') {
            allElements.add(this);
            this._id = '';
            this.id = id;
            this.style = { setProperty(name, value) { this[name] = value; } };
            this.dataset = {};
            this.classList = classList();
            this.listeners = new Map();
            this.children = [];
            this.checked = false;
            this.firstChild = null;
            this.nextSibling = null;
            this._textContent = '';
            this._innerHTML = '';
            this.heading = null;
        }

        set id(value) {
            this._id = value;
            if (value) registry.set(value, this);
            if (value === 'gear-filters') filterDiv = this;
        }

        get id() {
            return this._id;
        }

        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
        }

        get innerHTML() {
            return this._innerHTML;
        }

        set textContent(value) {
            this._textContent = String(value);
            this.children = [];
        }

        get textContent() {
            return this._textContent + this.children.map(child => child.textContent || '').join('');
        }

        addEventListener(type, callback) {
            this.listeners.set(type, callback);
        }

        insertBefore(child) {
            this.children.unshift(child);
            child.parentElement = this;
        }

        appendChild(child) {
            this.children.push(child);
            child.parentElement = this;
        }

        append(...children) {
            for (const child of children) this.appendChild(child);
        }

        replaceChildren(...children) {
            this._innerHTML = '';
            this._textContent = '';
            this.children = [];
            this.append(...children);
        }

        getAttribute(name) {
            if (name === 'data-gearid') return this.dataset.gearid ?? null;
            return null;
        }

        remove() {
            registry.delete(this.id);
        }

        querySelector(selector) {
            if (selector === '#show-retired-check') return retiredCheck;
            if (selector === 'h4') return this.heading;
            return null;
        }

        querySelectorAll(selector) {
            return selector === '.gear-filter-btn' ? filterButtons : [];
        }

        closest(selector) {
            return selector === 'button.gear-filter-btn' ? this : null;
        }

        getContext() {
            return {};
        }
    }

    const retiredCheck = new FakeElement('show-retired-check');
    const filterButtons = ['all', 'shoe', 'bike'].map(filter => {
        const button = new FakeElement();
        button.dataset.filter = filter;
        return button;
    });
    const section = new FakeElement('gear-info-section');
    const list = new FakeElement('gear-info-list');
    const chartContainer = new FakeElement('gear-chart-container');
    chartContainer.heading = new FakeElement();
    const ganttContainer = new FakeElement('gear-gantt-chart-container');
    ganttContainer.heading = new FakeElement();
    new FakeElement('gear-tab');
    new FakeElement('gearChart');
    new FakeElement('gear-gantt-chart');
    globalThis.document = {
        body: new FakeElement(),
        getElementById: id => registry.get(id) ?? null,
        createElement: () => new FakeElement(),
        querySelector: selector => (
            selector === '#gear-gantt-chart-container h4'
                ? ganttContainer.heading
                : null
        ),
        querySelectorAll: selector => (
            selector === '.save-gear-btn'
                ? [...allElements].filter(element => element.className === 'save-gear-btn')
                : []
        )
    };
    globalThis.localStorage = storage;
    globalThis.setTimeout = callback => {
        callback();
        return 0;
    };
    globalThis.Chart = class ChartStub {
        constructor(_context, config) {
            this.config = config;
            chartConfigs.push(config);
        }

        destroy() {}
    };

    try {
        const activities = [
            {
                type: 'Run',
                sport_type: 'Run',
                gear_id: 'bike-1',
                start_date_local: '2026-01-01T06:00:00.000Z',
                distance: 5000,
                moving_time: 1500,
                total_elevation_gain: 50
            },
            {
                type: 'Run',
                sport_type: 'Run',
                gear_id: 'shoe-1',
                start_date_local: '2026-01-02T06:00:00.000Z',
                distance: 10000,
                moving_time: 3000,
                total_elevation_gain: 100
            }
        ];
        const gears = [
            { id: 'bike-1', name: 'Synthetic Bike', frame_type: 3 },
            { id: 'shoe-1', name: 'Synthetic Shoe' },
            { id: 'shoe-1', name: 'Synthetic Shoe Duplicate' }
        ];
        renderGearTab(activities, gears);
        assert.ok(filterDiv);
        assert.match(list.textContent, /Synthetic Shoe Duplicate/);
        assert.equal(
            storage.getItemCalls.filter(key => key === 'gear-custom-shoe-1').length > 0,
            true
        );
        assert.equal(
            storage.getItemCalls.filter(key => key === 'gearEditMode').length > 0,
            true
        );

        gears.length = 0;
        filterDiv.listeners.get('click')({
            target: filterButtons[1]
        });
        const latestLine = [...chartConfigs]
            .reverse()
            .find(config => config.type === 'line');
        assert.deepEqual(
            latestLine.data.datasets.map(dataset => dataset.label),
            ['Synthetic Shoe Duplicate']
        );
        assert.equal(
            storage.getItemCalls.filter(key => key === 'strava_gears').length,
            0
        );

        registry.get('toggle-gear-edit').listeners.get('click')({ stopPropagation() {} });
        assert.equal(storage.getItem('gearEditMode'), 'true');
        assert.equal(
            storage.operations.some(operation => (
                operation.operation === 'set'
                && operation.key === 'gearEditMode'
            )),
            true
        );

        registry.get('price-shoe-1').value = '155';
        registry.get('duration-shoe-1').value = '900';
        const saveButton = [...allElements].reverse().find(element => element.className === 'save-gear-btn');
        saveButton.listeners.get('click')({ stopPropagation() {} });
        assert.deepEqual(
            JSON.parse(storage.getItem('gear-custom-shoe-1')),
            { price: 155, durationKm: 900 }
        );
        assert.equal(
            storage.operations.some(operation => (
                operation.operation === 'set'
                && operation.key === 'gear-custom-shoe-1'
            )),
            true
        );

        for (const malformedGears of [[], null, {}, undefined]) {
            renderGearTab(activities, malformedGears);
            assert.match(list.innerHTML, /No gear loaded yet\./);
        }
        assert.equal(
            storage.getItemCalls.filter(key => key === 'strava_gears').length,
            0
        );
    } finally {
        globalThis.document = savedDocument;
        globalThis.localStorage = savedStorage;
        globalThis.setTimeout = savedSetTimeout;
        if (savedChart === undefined) delete globalThis.Chart;
        else globalThis.Chart = savedChart;
    }
});

test('Trends metadata selection uses injected context without identity reads or logs', () => {
    const storage = new MemoryStorage(realLibrary());
    storage.forbiddenReads.add('strava_athlete_data');
    storage.forbiddenReads.add('strava_training_zones');
    globalThis.localStorage = storage;
    const originalConsoleLog = console.log;
    let identityLogCalls = 0;
    console.log = () => {
        identityLogCalls += 1;
    };

    try {
        const demoAthlete = {
            id: 'demo-athlete-0001',
            firstname: 'Demo'
        };
        const demoZones = {
            heartrate: [{ min: 0, max: 142 }]
        };
        const demoSelection = selectTrendsMetadataContext({
            athleteData: demoAthlete,
            zonesData: demoZones
        });
        assert.equal(demoSelection.athleteData, demoAthlete);
        assert.equal(demoSelection.zonesData, demoZones);

        assert.deepEqual(selectTrendsMetadataContext({
            athleteData: null,
            zonesData: null
        }), {
            athleteData: null,
            zonesData: null
        });

        const realAthlete = { id: ATHLETE_ID, firstname: 'Synthetic' };
        const realZones = { heartrate: [{ min: 0, max: 150 }] };
        const realSelection = selectTrendsMetadataContext({
            athleteData: realAthlete,
            zonesData: realZones
        });
        assert.equal(realSelection.athleteData, realAthlete);
        assert.equal(realSelection.zonesData, realZones);
    } finally {
        console.log = originalConsoleLog;
    }

    assert.equal(
        storage.getItemCalls.filter(key => (
            key === 'strava_athlete_data'
            || key === 'strava_training_zones'
        )).length,
        0
    );
    assert.equal(identityLogCalls, 0);
});

test('Demo preprocessing context blocks Legacy athlete fallback when metadata is absent', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        [DEMO_MODE_KEY]: 'true'
    });
    storage.forbiddenReads.add('strava_athlete_data');
    globalThis.localStorage = storage;

    const malformedDemoAthletes = [null, [], {}, { id: 24681357 }];
    for (const [index, malformedDemoAthlete] of malformedDemoAthletes.entries()) {
        const context = selectPreprocessingAthlete(
            'demo',
            malformedDemoAthlete
        );
        assert.equal(context.firstname, 'Demo');
        assert.equal(context.demoPreprocessingContext, true);
        assert.equal('id' in context, false);
        assert.equal('lastname' in context, false);
        assert.equal('username' in context, false);

        // A fresh non-empty indoor swim forces the production pipeline through
        // the production preprocessing boundary without any athlete-specific fallback.
        const syntheticActivity = {
            id: `synthetic-demo-preprocessing-swim-${index + 1}`,
            name: `Synthetic Demo Indoor Swim ${index + 1}`,
            type: 'Swim',
            sport_type: 'Swim',
            start_date: '2025-07-01T06:00:00.000Z',
            start_date_local: '2025-07-01T08:00:00.000Z',
            distance: 1000,
            moving_time: 1200,
            elapsed_time: 1200,
            average_speed: 1000 / 1200,
            trainer: true
        };
        const processed = await preprocessActivities(
            [syntheticActivity],
            context,
            null,
            []
        );
        assert.equal(processed.length, 1);
        assert.equal(processed[0], syntheticActivity);
    }

    assert.equal(
        storage.getItemCalls.filter(key => key === 'strava_athlete_data').length,
        0
    );
});

test('Run Plus Demo data façade uses only the Demo Repository session', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    storage.operations = [];
    storage.forbiddenReads = new Set([
        'strava_tokens',
        'strava_activities',
        'strava_athlete_data',
        'strava_training_zones',
        'strava_gears'
    ]);
    const harness = repositorySessionHarness({ storage, sessionMode: 'demo' });
    const session = establishSummaryRepositorySession({
        activeSessionMode: null,
        sessionRepository: null,
        requestedSessionMode: 'demo',
        repositoryFactory: harness.factory
    }).sessionRepository;
    const gears = getDemoGears(storage);
    const options = createRunPlusRenderOptions({
        sessionRepository: session,
        sessionGears: gears,
        onFiltersChange() {}
    });
    const activityId = String(getDemoActivities(storage)[0].id);

    const activity = await options.getActivity(activityId);
    const streams = await options.getStreams(activityId);

    assert.equal(activity.id, getDemoActivities(storage)[0].id);
    assert.deepEqual(streams, {});
    assert.deepEqual(harness.calls.getActivity, [activityId]);
    assert.deepEqual(harness.calls.getStreams, [{
        activityId,
        options: {
            types: [
                'time',
                'distance',
                'velocity_smooth',
                'heartrate',
                'cadence',
                'altitude'
            ]
        }
    }]);
    assert.notEqual(options.gears, gears);
    assert.deepEqual(options.gears, gears);
    assert.equal(Object.isFrozen(options), true);
    assert.equal(Object.isFrozen(options.gears), true);
    assert.deepEqual(
        storage.getItemCalls.filter(key => storage.forbiddenReads.has(key)),
        []
    );
});

test('Entering Demo adds only Demo keys and preserves the real snapshot byte-for-byte', () => {
    const storage = new MemoryStorage(realLibrary());
    const before = storage.snapshot();
    const result = loadDemoData({
        storage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });
    const addedKeys = Object.keys(storage.snapshot())
        .filter(key => !(key in before))
        .sort();

    assert.deepEqual(realSnapshot(storage), before);
    assert.deepEqual(addedKeys, [...DEMO_STORAGE_KEYS].sort());
    assert.deepEqual(result.activities, getDemoActivities(storage));
    assert.deepEqual(result.athlete, getDemoAthlete(storage));
    assert.deepEqual(result.zones, getDemoTrainingZones(storage));
    assert.deepEqual(result.gears, getDemoGears(storage));
    assert.deepEqual(result.demoTokens, getDemoTokens(storage));
    assert.equal(
        storage.getItem(DEMO_ATHLETE_TIMESTAMP_KEY),
        String(FIXED_NOW_MS)
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );

    const secondStorage = new MemoryStorage(realLibrary());
    loadDemoData({
        storage: secondStorage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });
    assert.deepEqual(secondStorage.snapshot(), storage.snapshot());
});

test('loginWithDemo authenticates with the single stored deterministic Demo token', async () => {
    const storage = new MemoryStorage(realLibrary());
    let authenticatedTokens = null;

    const result = await loginWithDemo(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        now: FIXED_NOW,
        referenceDate: FIXED_REFERENCE_DATE
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.deepEqual(authenticatedTokens, getDemoTokens(storage));
    assert.equal(
        authenticatedTokens.access_token,
        JSON.parse(storage.getItem(DEMO_TOKENS_KEY)).access_token
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );
});

test('Demo getters read only their namespace and never fallback to real metadata', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace(),
        strava_athlete_data: '{malformed-real-athlete',
        strava_training_zones: '{malformed-real-zones',
        strava_gears: '{malformed-real-gears'
    });
    const realValueKeys = [
        'strava_tokens',
        'strava_activities',
        'strava_athlete_data',
        'strava_training_zones',
        'strava_gears',
        'dashboard_settings'
    ];
    storage.forbiddenReads = new Set(realValueKeys);

    assert.equal(getDemoActivities(storage)[0].id, 'synthetic-demo-activity-001');
    assert.equal(getDemoAthlete(storage).firstname, 'Demo');
    assert.equal(getDemoTrainingZones(storage).heartrate[0].max, 142);
    assert.equal(getDemoGears(storage)[0].id, 'synthetic-demo-gear-001');
    assert.equal(
        getDemoTokens(storage).access_token,
        'synthetic-demo-access-token'
    );
    assert.deepEqual(
        storage.getItemCalls.filter(key => realValueKeys.includes(key)),
        []
    );
});

test('Malformed Demo payloads return safe values without real fallback', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        [DEMO_ACTIVITIES_KEY]: '{bad',
        [DEMO_ATHLETE_KEY]: '[]',
        [DEMO_TRAINING_ZONES_KEY]: '"bad"',
        [DEMO_GEARS_KEY]: '{}',
        [DEMO_TOKENS_KEY]: '{"access_token":'
    });

    assert.deepEqual(getDemoActivities(storage), []);
    assert.equal(getDemoAthlete(storage), null);
    assert.equal(getDemoTrainingZones(storage), null);
    assert.deepEqual(getDemoGears(storage), []);
    assert.equal(getDemoTokens(storage), null);
});

test('Every Demo API path is offline and reads only Demo data', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let fetchCalls = 0;
    globalThis.localStorage = storage;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('Demo API must be offline');
    };

    assert.equal(
        (await fetchAllActivities())[0].id,
        'synthetic-demo-activity-001'
    );
    assert.equal((await fetchAthleteData()).firstname, 'Demo');
    assert.equal((await fetchTrainingZones()).heartrate[0].max, 142);
    assert.equal(
        (await fetchAllGears({
            shoes: [{ id: 'prohibited-real-gear-id' }]
        }))[0].id,
        'synthetic-demo-gear-001'
    );
    assert.equal(getCachedGears()[0].id, 'synthetic-demo-gear-001');
    assert.equal(
        (await fetchGearById('synthetic-demo-gear-001')).name,
        'Demo Shoes'
    );
    assert.equal(await fetchGearById('missing-demo-gear'), null);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(realSnapshot(storage), realBefore);
});

test('Demo setCachedGears modifies only Demo gears and timestamp', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    globalThis.localStorage = storage;
    storage.operations = [];

    setCachedGears([{
        id: 'synthetic-demo-gear-updated',
        name: 'Updated Demo Shoes'
    }], {
        now: FIXED_NOW
    });

    assert.equal(
        JSON.parse(storage.getItem(DEMO_GEARS_KEY))[0].id,
        'synthetic-demo-gear-updated'
    );
    assert.equal(
        storage.getItem(DEMO_GEARS_TIMESTAMP_KEY),
        String(FIXED_NOW_MS)
    );
    assert.deepEqual(realSnapshot(storage), realBefore);
    assert.deepEqual(
        storage.operations
            .filter(operation => operation.operation === 'set')
            .map(operation => operation.key),
        [DEMO_GEARS_KEY, DEMO_GEARS_TIMESTAMP_KEY]
    );
});

test('clearDemoData removes all Demo keys and preserves the real snapshot', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);

    const result = clearDemoData(storage);

    assert.equal(result.status, 'success');
    assertDemoCleared(storage);
    assert.deepEqual(realSnapshot(storage), realBefore);
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        REAL_ACCESS_TOKEN
    );
});

test('Demo logout skips disconnect and revoke while preserving the real library', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let disconnectCalls = 0;
    let revokeCalls = 0;
    let reloadCalls = 0;

    const result = await logout({
        storage,
        reload: () => {
            reloadCalls += 1;
        },
        lifecycleFactory: () => ({
            disconnect: async () => {
                disconnectCalls += 1;
                revokeCalls += 1;
                return { status: 'success' };
            }
        })
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.equal(disconnectCalls, 0);
    assert.equal(revokeCalls, 0);
    assert.equal(reloadCalls, 1);
    assertDemoCleared(storage);
    assert.deepEqual(realSnapshot(storage), realBefore);
});

test('A reloaded page restores the Demo session only from strava_tokens_demo', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    let authenticatedTokens = null;
    let lifecycleCalls = 0;

    const result = await handleAuth(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        search: '',
        now: FIXED_NOW_MS,
        lifecycleFactory: () => {
            lifecycleCalls += 1;
            throw new Error('Real lifecycle must not run for Demo restore');
        }
    });

    assert.equal(result.status, 'success');
    assert.equal(result.demo, true);
    assert.equal(lifecycleCalls, 0);
    assert.equal(
        authenticatedTokens.access_token,
        'synthetic-demo-access-token'
    );
    assert.equal(
        storage.getItemCalls.filter(key => key === 'strava_tokens').length,
        0
    );
});

test('Malformed or expired Demo tokens clear only the Demo namespace', async () => {
    const cases = [
        {
            name: 'malformed',
            tokens: '{"access_token":',
            expectedStatus: 'unauthenticated'
        },
        {
            name: 'expired',
            tokens: {
                access_token: 'synthetic-expired-demo-token',
                refresh_token: 'synthetic-expired-demo-refresh',
                expires_at: Math.floor(FIXED_NOW_MS / 1000) - 1
            },
            expectedStatus: 'token-expired'
        }
    ];

    for (const scenario of cases) {
        const storage = new MemoryStorage({
            ...realLibrary(),
            ...demoNamespace({ tokens: scenario.tokens })
        });
        const realBefore = realSnapshot(storage);
        let authenticatedCalls = 0;

        const result = await handleAuth(() => {
            authenticatedCalls += 1;
        }, {
            storage,
            search: '',
            now: FIXED_NOW_MS,
            lifecycleFactory: () => {
                throw new Error(`Real lifecycle ran for ${scenario.name}`);
            }
        });

        assert.equal(result.status, scenario.expectedStatus);
        assert.equal(result.demo, true);
        assert.equal(authenticatedCalls, 0);
        assertDemoCleared(storage);
        assert.deepEqual(realSnapshot(storage), realBefore);
    }
});

test('Real OAuth takes priority over Demo and clears only Demo after success', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const realBefore = realSnapshot(storage);
    let fetchCalls = 0;
    let historyCalls = 0;
    let authenticatedTokens = null;

    const result = await handleAuth(tokens => {
        authenticatedTokens = tokens;
    }, {
        storage,
        search: '?code=synthetic-oauth-code',
        now: FIXED_NOW_MS,
        fetchImpl: async (url, options) => {
            fetchCalls += 1;
            assert.equal(url, '/api/strava-auth');
            assert.equal(
                JSON.parse(options.body).code,
                'synthetic-oauth-code'
            );
            return jsonResponse(oauthResponse());
        },
        history: {
            replaceState: () => {
                historyCalls += 1;
            }
        }
    });

    assert.equal(result.status, 'success');
    assert.equal(fetchCalls, 1);
    assert.equal(historyCalls, 1);
    assertDemoCleared(storage);
    assert.equal(
        authenticatedTokens.access_token,
        'synthetic-oauth-access-token'
    );
    assert.equal(
        JSON.parse(storage.getItem('strava_tokens')).access_token,
        'synthetic-oauth-access-token'
    );
    const realAfter = realSnapshot(storage);
    assert.deepEqual(
        {
            ...realAfter,
            strava_tokens: realBefore.strava_tokens
        },
        realBefore
    );
});

test('OAuth identity mismatch from Demo fails closed with zero storage writes', async () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace()
    });
    const before = storage.snapshot();
    const originalConsoleError = console.error;
    console.error = () => {};
    storage.operations = [];

    try {
        await assert.rejects(
            handleAuth(() => {
                throw new Error('Mismatched OAuth must not authenticate');
            }, {
                storage,
                search: '?code=synthetic-mismatch-code',
                now: FIXED_NOW_MS,
                fetchImpl: async () => jsonResponse(oauthResponse(2002002)),
                history: { replaceState: () => {} }
            }),
            error => error?.code === 'identity-mismatch'
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.deepEqual(storage.snapshot(), before);
    assert.deepEqual(storage.operations, []);
});

test('A partial Demo write is compensated without touching the real library', () => {
    const storage = new MemoryStorage({
        ...realLibrary(),
        ...demoNamespace({
            tokens: {
                access_token: 'preexisting-demo-token',
                expires_at: 2100000000
            }
        })
    });
    const before = storage.snapshot();
    storage.failSetKeyOnce = DEMO_GEARS_KEY;

    assert.throws(
        () => loadDemoData({
            storage,
            now: FIXED_NOW,
            referenceDate: FIXED_REFERENCE_DATE
        }),
        error => (
            error?.code === DEMO_STORAGE_ERROR.WRITE_FAILED
            && error.rollbackFailed === false
        )
    );

    assert.deepEqual(storage.snapshot(), before);
    assert.equal(
        storage.operations.some(operation => (
            !DEMO_STORAGE_KEYS.includes(operation.key)
        )),
        false
    );
});

test('Source and privacy boundaries enforce production-path isolation', async () => {
    const [
        demoSource,
        authSource,
        apiSource,
        athleteSource,
        runPlusSource,
        indexSource
    ] = await Promise.all([
        readFile(new URL('js/demo/index.js', projectRoot), 'utf8'),
        readFile(new URL('js/app/auth.js', projectRoot), 'utf8'),
        readFile(new URL('js/services/api.js', projectRoot), 'utf8'),
        readFile(new URL('js/tabs/athlete.js', projectRoot), 'utf8'),
        readFile(new URL('js/tabs/run-plus.js', projectRoot), 'utf8'),
        readFile(new URL('index.html', projectRoot), 'utf8')
    ]);
    const prohibitedMutation = /(?:setItem|removeItem)\(\s*['"](?:strava_tokens|strava_activities|strava_athlete_data|strava_training_zones|strava_gears|dashboard_settings)/;
    const rawConsoleArgument = /console\.(?:log|info|debug|warn|error)\([^;]*,\s*(?:activities|allActivities|preprocessed|athlete|zones|gears|error|results\[)/s;

    assert.equal(prohibitedMutation.test(demoSource), false);
    assert.equal(demoSource.includes('indexedDB'), false);
    assert.equal(authSource.includes('clearCachedActivities'), false);
    assert.equal(apiSource.includes('clearCachedActivities'), false);
    assert.equal(rawConsoleArgument.test(mainSource), false);
    assert.equal(mainSource.includes('[Strava] Athlete data:'), false);
    assert.equal(mainSource.includes('[Strava] Training zones:'), false);
    assert.equal(mainSource.includes('[Strava] Summary:'), false);
    assert.equal(mainSource.includes('dateRange:'), false);
    assert.equal(mainSource.includes('console.error'), false);
    assert.equal(
        mainSource.includes("localStorage.getItem('strava_gears')"),
        false
    );
    assert.doesNotMatch(
        mainSource,
        /handleError\([^;]*,\s*error\s*\)/
    );
    assert.equal(
        (mainSource.match(/\bisDemoMode\(\)/g) || []).length,
        1,
        'initialize freezes session mode once and refresh reuses it'
    );
    assert.equal(
        (mainSource.match(
            /const activityLoad = await loadActivitiesForSession\(\{/g
        ) || []).length,
        2,
        'initialize and refresh must call the production activity loader'
    );
    assert.match(mainSource, /createRunPlusRenderOptions\(\{/);
    assert.match(mainSource, /sessionRepository:\s*requireSummaryRepositorySession\(/);
    assert.match(
        mainSource,
        /return buildSessionGearNameMap\(sessionGears\)/
    );
    assert.equal(
        (mainSource.match(
            /const preprocessingAthlete = selectPreprocessingAthlete\(/g
        ) || []).length,
        2
    );
    assert.equal(athleteSource.includes('strava_athlete_data'), false);
    assert.equal(athleteSource.includes('strava_training_zones'), false);
    assert.equal(athleteSource.includes('active athlete'), false);

    for (const pattern of [
        /getCachedGears|strava_gears|strava_tokens/,
        /\/api\/strava-/,
        /Authorization|\bfetch\s*\(/,
        /indexedDB|createRepository|new\s+\w*Connector/
    ]) {
        assert.doesNotMatch(runPlusSource, pattern);
    }
    assert.equal(
        runPlusSource.includes("console.error('NSM interval analysis failed:'"),
        false
    );
    assert.match(runPlusSource, /options\.getActivity\(activityId\)/);
    assert.match(runPlusSource, /options\.getStreams\(activityId\)/);
    assert.match(
        indexSource,
        /id="logout-button"[\s\S]*?aria-label="Disconnect Strava"[\s\S]*?title="Disconnect Strava"/
    );
    assert.doesNotMatch(indexSource, /Delete Local Data/i);
});

test('R7 Demo AI Coach capability performs zero consent, key, provider, history, or storage I/O', () => {
    const storage = new MemoryStorage({
        gemini_api_key: 'synthetic-existing-key',
        ai_chat_history: '[{"role":"user","text":"synthetic-existing-history"}]'
    });
    let fetches = 0;
    const session = createAICoachSession({
        sessionMode: 'demo',
        legacyStorage: storage,
        fetch: async () => {
            fetches += 1;
            throw new Error('Demo AI Coach must never fetch');
        }
    });

    assert.equal(session.enabled, false);
    assert.equal(session.hasApiKey(), false);
    assert.deepEqual(session.getHistory(), []);
    assert.throws(
        () => session.prepare('Synthetic question', [{
            type: 'Run',
            start_date: '2031-02-20T00:00:00.000Z',
            distance: 0,
            moving_time: 0,
            total_elevation_gain: 0
        }]),
        error => error?.code === 'AI_COACH_DEMO_DISABLED'
    );
    assert.throws(
        () => session.inspectLegacyData(),
        error => error?.code === 'AI_COACH_DEMO_DISABLED'
    );
    assert.equal(fetches, 0);
    assert.deepEqual(storage.getItemCalls, []);
    assert.deepEqual(storage.operations, []);
});

test('R7 Demo entry revokes the Real AI capability and reloads after deterministic seeding', async () => {
    const mainSource = await readFile(new URL('js/app/main.js', projectRoot), 'utf8');
    const firstRun = mainSource.split('function showLocalFirstEntry(state)')[1]
        ?.split('async function inspectApplicationStart()')[0];
    assert.notEqual(firstRun, undefined);
    assert.match(firstRun, /loginSection\?\.classList\.remove\('hidden'\)/);
    assert.match(firstRun, /first-run-sources-link/);
    assert.match(firstRun, /sourcesLink === null[\s\S]*?demoButton\?\.parentElement\?\.append\(sourcesLink\)/);
    assert.match(mainSource, /navigateFirstRun: showLocalFirstEntry/);
    assert.match(
        mainSource,
        /demoButton\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*aiCoachSession\.revoke\(\);\s*aiCoachActivitySnapshot = null;\s*aiCoachSession = createAICoachSession\(\{\s*sessionMode:\s*APP_SESSION_MODE\.DEMO\s*\}\);\s*loginWithDemo\(\(\)\s*=>\s*\{\s*window\.location\.reload\(\);\s*\}\)/
    );
    assert.doesNotMatch(mainSource, /loginWithDemo\(initializeApp\)/);
});
