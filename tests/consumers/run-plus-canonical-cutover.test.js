import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { createRepositoryWithDependencies } from '../../js/repository/factory.js';
import {
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';
import { preprocessActivities } from '../../js/shared/preprocessing/index.js';
import { createCanonicalStore } from '../../js/storage/index.js';

const projectRoot = new URL('../../', import.meta.url);
const mainSource = await readFile(new URL('js/app/main.js', projectRoot), 'utf8');
const runPlusSource = await readFile(new URL('js/tabs/run-plus.js', projectRoot), 'utf8');
const featureFlagsSource = await readFile(new URL('js/app/feature-flags.js', projectRoot), 'utf8');
const taskBrief = await readFile(
    new URL('docs/tasks/pr-18-run-plus-nsm-cutover.md', projectRoot),
    'utf8'
);
const browserHarness = await readFile(
    new URL('tests/consumers/run-plus-canonical-browser-smoke.html', projectRoot),
    'utf8'
);

const FIXED_TIME = Date.parse('2026-08-06T08:00:00.000Z');
const OPAQUE_ID = '0007/opaque ?#%';
const RUN_PLUS_STREAM_TYPES = Object.freeze([
    'time',
    'distance',
    'velocity_smooth',
    'heartrate',
    'cadence',
    'altitude'
]);
const USER_STORAGE_KEYS = Object.freeze([
    'run_plus_capacity_inputs_v1',
    'run_plus_nsm_settings_v1',
    'run_plus_nsm_activity_tags_v1',
    'run_plus_nsm_session_inputs_v1',
    'run_plus_nsm_tests_v1',
    'run_plus_nsm_interval_analysis_v1'
]);
const PR18_PATHS = Object.freeze([
    'docs/tasks/pr-18-run-plus-nsm-cutover.md',
    'js/app/main.js',
    'js/tabs/run-plus.js',
    'tests/consumers/run-plus-consumers.test.js',
    'tests/consumers/run-plus-canonical-cutover.test.js',
    'tests/consumers/run-plus-canonical-browser-smoke.html',
    'tests/legacy/demo-isolation.test.js'
]);

function compileMainBoundary(featureFlags) {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = mainSource.indexOf(startMarker);
    const end = mainSource.indexOf(endMarker);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const boundarySource = mainSource
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
            createSummaryRepositorySession,
            createRunPlusRenderOptions
        };`
    )(
        () => {
            throw new Error('Unexpected default Repository construction.');
        },
        REPOSITORY_SOURCE,
        REPOSITORY_WARNING_CODE,
        Object.freeze({ DEMO: 'demo', REAL: 'real' }),
        () => featureFlags,
        () => null
    );
}

function canonicalActivity(overrides = {}) {
    return {
        schemaVersion: 1,
        id: OPAQUE_ID,
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: '2026-08-05T06:00:00.000Z',
        timeZone: { ianaName: null, utcOffsetMinutes: 0 },
        capabilities: {
            hasGps: false,
            hasHeartRate: true,
            hasPower: false,
            hasCadence: true,
            hasLaps: true
        },
        name: 'Synthetic canonical interval run',
        distanceMeters: 10_000,
        elevationGainMeters: 0,
        movingTimeSeconds: 3_000,
        elapsedTimeSeconds: 3_060,
        averageHeartRateBpm: null,
        averagePowerWatts: 0,
        averageCadence: 0,
        ...overrides
    };
}

function stream(streamType, unit, values) {
    return {
        streamType,
        unit,
        offsetsSeconds: values.map((_, index) => index * 600),
        values
    };
}

function canonicalBundle(activity = canonicalActivity()) {
    return {
        schemaVersion: 1,
        activity,
        streams: {
            activityId: activity.id,
            series: [
                stream('distance', 'm', [0, 2_000, 4_000, 6_000, 8_000, 10_000]),
                stream('speed', 'm/s', [0, 3.2, 3.4, 3.5, 3.3, 0]),
                stream('heartRate', 'bpm', [null, 132, 141, 146, 138, null]),
                stream('cadence', 'rpm', [0, 82, 84, 85, 83, 0]),
                stream('altitude', 'm', [0, 0, 1, 1, 0, 0])
            ]
        },
        laps: [{
            id: `synthetic-lap:${activity.id}:0`,
            activityId: activity.id,
            index: 0,
            startOffsetSeconds: 0,
            elapsedTimeSeconds: 600,
            movingTimeSeconds: 600,
            distanceMeters: 2_000
        }],
        events: [],
        sources: [{
            id: `synthetic-source:${activity.id}`,
            activityId: activity.id,
            provider: 'synthetic',
            externalId: null,
            rawArtifactId: null,
            acquisitionMethod: 'synthetic-test',
            deviceId: null,
            importedAt: activity.startTimeUtc
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'synthetic-parser@1',
            normalizerVersion: 'synthetic-normalizer@1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
}

function modeHarness(dataRepositoryMode, sessionMode = 'real') {
    const calls = [];
    const boundary = compileMainBoundary(Object.freeze({ dataRepositoryMode }));
    boundary.createSummaryRepositorySession({
        sessionMode,
        repositoryFactory(options) {
            calls.push(options);
            return {
                async listActivities() {
                    return Object.freeze({
                        data: Object.freeze([]),
                        source: sessionMode === 'demo'
                            ? REPOSITORY_SOURCE.DEMO
                            : REPOSITORY_SOURCE.CACHE,
                        warnings: Object.freeze([]),
                        partial: false
                    });
                }
            };
        }
    });
    return calls;
}

test('explicit Real Canonical traverses Store, Repository, and the existing Run Plus facade', async () => {
    const indexedDB = new IDBFactory();
    const store = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'pr18-run-plus-cutover-test@1'
    });
    await store.initialize();
    await store.putBundle(canonicalBundle());

    const storeCalls = { initialize: 0, listActivities: 0, getBundle: [] };
    const observedStore = {
        async initialize() {
            storeCalls.initialize += 1;
            return store.initialize();
        },
        async listActivities(options) {
            storeCalls.listActivities += 1;
            return store.listActivities(options);
        },
        async getBundle(activityId, options) {
            storeCalls.getBundle.push({ activityId, options });
            return store.getBundle(activityId, options);
        }
    };
    let providerConstructions = 0;
    const repository = createRepositoryWithDependencies(
        { sessionMode: 'real', mode: 'canonical' },
        {
            canonicalStoreFactory: () => observedStore,
            connectorFactory() {
                providerConstructions += 1;
                throw new Error('provider boundary must remain unused');
            }
        }
    );
    const boundary = compileMainBoundary(Object.freeze({
        dataRepositoryMode: 'canonical'
    }));
    const factoryCalls = [];
    const session = boundary.createSummaryRepositorySession({
        sessionMode: 'real',
        repositoryFactory(options) {
            factoryCalls.push(options);
            return repository;
        }
    });
    const renderOptions = boundary.createRunPlusRenderOptions({
        sessionRepository: session,
        sessionGears: [],
        onFiltersChange() {}
    });

    const summaries = await session.listActivities({ refresh: false });
    const activity = await renderOptions.getActivity(OPAQUE_ID);
    const streams = await renderOptions.getStreams(OPAQUE_ID);
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'localStorage'
    );
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: () => null }
    });
    let preprocessed;
    try {
        preprocessed = await preprocessActivities(
            structuredClone(summaries.data),
            { username: 'synthetic-local-session' },
            null,
            []
        );
    } finally {
        if (localStorageDescriptor) {
            Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
        } else {
            delete globalThis.localStorage;
        }
    }

    assert.deepEqual(factoryCalls, [{ sessionMode: 'real', mode: 'canonical' }]);
    assert.equal(providerConstructions, 0);
    assert.equal(summaries.source, REPOSITORY_SOURCE.CANONICAL);
    assert.equal(summaries.partial, false);
    assert.equal(summaries.data.length, 1);
    assert.equal(summaries.data[0].id, OPAQUE_ID);
    assert.equal(summaries.data[0].total_elevation_gain, 0);
    assert.equal(summaries.data[0].average_heartrate, null);
    assert.equal(summaries.data[0].average_watts, 0);
    assert.equal(Object.hasOwn(summaries.data[0], 'map'), false);
    assert.equal(Number.isFinite(preprocessed[0].tss), true);
    assert.equal(preprocessed[0].tss > 0, true);
    assert.equal(Number.isFinite(preprocessed[0].ctl), true);
    assert.equal(Number.isFinite(preprocessed[0].atl), true);
    assert.equal(Number.isFinite(preprocessed[0].tsb), true);

    assert.equal(activity.id, OPAQUE_ID);
    assert.equal(activity.laps.length, 1);
    assert.equal(activity.laps[0].distance, 2_000);
    assert.equal(activity.average_heartrate, null);
    assert.equal(activity.average_watts, 0);
    assert.deepEqual(streams.time.data, [0, 600, 1_200, 1_800, 2_400, 3_000]);
    assert.deepEqual(streams.heartrate.data, [null, 132, 141, 146, 138, null]);
    assert.deepEqual(streams.cadence.data, [0, 82, 84, 85, 83, 0]);
    assert.equal(Object.hasOwn(streams, 'latlng'), false);
    assert.equal(Object.hasOwn(streams, 'watts'), false);

    assert.equal(storeCalls.listActivities, 1);
    assert.equal(storeCalls.getBundle.length, 2);
    assert.deepEqual(storeCalls.getBundle.map(call => call.activityId), [
        OPAQUE_ID,
        OPAQUE_ID
    ]);
    assert.equal(storeCalls.getBundle[0].options, undefined);
    assert.deepEqual(storeCalls.getBundle[1].options.streamTypes, [
        'distance',
        'speed',
        'heartRate',
        'cadence',
        'altitude'
    ]);
    assert.equal(Object.isFrozen(renderOptions), true);
    assert.equal(Object.isFrozen(renderOptions.gears), true);
    await store.close();
});

test('Demo remains first and Legacy/Shadow remain Legacy reads', () => {
    assert.deepEqual(modeHarness('canonical', 'demo'), [{
        sessionMode: 'demo',
        mode: 'legacy'
    }]);
    assert.deepEqual(modeHarness('legacy'), [{
        sessionMode: 'real',
        mode: 'legacy'
    }]);
    assert.deepEqual(modeHarness('shadow'), [{
        sessionMode: 'real',
        mode: 'legacy'
    }]);
    assert.deepEqual(modeHarness('canonical'), [{
        sessionMode: 'real',
        mode: 'canonical'
    }]);
    assert.match(
        featureFlagsSource,
        /dataRepositoryMode:\s*'legacy'/
    );
});

test('Run Plus cutover freezes the injected reads and user-owned persistence contract', () => {
    assert.deepEqual(
        [...mainSource.matchAll(/const RUN_PLUS_STREAM_TYPES = Object\.freeze\(\[([\s\S]*?)\]\);/g)]
            .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(value => value[1])),
        RUN_PLUS_STREAM_TYPES
    );
    const discoveredKeys = [...new Set(
        [...runPlusSource.matchAll(/['"](run_plus_[a-z0-9_]+_v\d+)['"]/g)]
            .map(match => match[1])
    )].sort();
    assert.deepEqual(discoveredKeys, [...USER_STORAGE_KEYS].sort());
    assert.match(runPlusSource, /options\.getActivity\(activityId\)/);
    assert.match(runPlusSource, /options\.getStreams\(activityId\)/);
    assert.match(runPlusSource, /typeof id === 'string' && id\.trim\(\)\.length > 0/);
    for (const pattern of [
        /strava_tokens|Authorization|\/api\/strava-|\bfetch\s*\(/,
        /indexedDB|createRepository|new\s+\w*Connector/,
        /parseInt\([^)]*\.id|parseFloat\([^)]*\.id|BigInt\([^)]*\.id/
    ]) {
        assert.doesNotMatch(runPlusSource, pattern);
    }
});

test('Task Brief freezes the literal seven-path scope without future-hostile hashes', () => {
    const match = taskBrief.match(
        /Implementation, tests, findings-first repairs, and Closure may modify exactly these seven paths[\s\S]*?```text\n([\s\S]*?)\n```/
    );
    assert.ok(match);
    assert.deepEqual(match[1].split('\n'), PR18_PATHS);
    assert.doesNotMatch(taskBrief, /FROZEN_HASHES|createHash\(|[a-f0-9]{64}/);
    assert.match(taskBrief, /DEFAULT_FEATURE_FLAGS\.dataRepositoryMode` remains literal `legacy`/);
    assert.match(taskBrief, /There is therefore no LocalStorage migration in PR-18/);
});

test('served browser seed freezes synthetic actual-route evidence without claiming a pass', () => {
    assert.match(browserHarness, /__PR18_RUN_PLUS_BROWSER_PLAN__/);
    for (const value of [
        "modes: Object.freeze(['canonical', 'demo', 'legacy', 'shadow'])",
        "routes: Object.freeze(['/run-plus', '/run-plus/nsm'])",
        'actual-served-navigation',
        'settings-and-tags-persist',
        'filter-rerender',
        'interval-analysis',
        'deep-hr-analysis',
        'impact-load',
        'tss-ctl-atl-tsb',
        'missing-gps-hr-power',
        'opaque-id-round-trip',
        'zero-provider-token-auth-legacy-io',
        'safe-repository-failure',
        'console-runtime-storage-idb-cache-sw-observation',
        'ACTUAL_SERVED_NAVIGATION_REQUIRED'
    ]) {
        assert.equal(browserHarness.includes(value), true, value);
    }
    for (const key of USER_STORAGE_KEYS) {
        assert.equal(browserHarness.includes(key), true, key);
    }
    assert.match(browserHarness, /indexedDB\.databases/);
    assert.match(browserHarness, /createCanonicalStore/);
    assert.match(browserHarness, /document\.body\.dataset\.status = 'seeded'/);
    assert.doesNotMatch(browserHarness, /dataset\.status = 'passed'|status:\s*'passed'/);
    assert.doesNotMatch(browserHarness, /https?:\/\//);
});
