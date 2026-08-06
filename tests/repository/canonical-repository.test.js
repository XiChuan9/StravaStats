import assert from 'node:assert/strict';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import { CanonicalRepository } from '../../js/repository/canonical/canonical-repository.js';
import {
    canonicalStreamTypesForLegacy,
    projectCanonicalDetailActivity,
    projectCanonicalDetailStreams
} from '../../js/repository/canonical/detail-projection.js';
import {
    projectCanonicalSummaryActivity,
    projectCanonicalSummaryActivities
} from '../../js/repository/canonical/summary-projection.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    RepositoryError
} from '../../js/repository/errors.js';
import { createCanonicalStore } from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-06T01:02:03.004Z');

function canonicalActivity(id, overrides = {}) {
    return {
        schemaVersion: 1,
        id,
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: '2026-08-05T10:00:00.000Z',
        timeZone: {
            ianaName: null,
            utcOffsetMinutes: 480
        },
        capabilities: {
            hasGps: false,
            hasHeartRate: false,
            hasPower: false,
            hasCadence: false,
            hasLaps: false
        },
        ...overrides
    };
}

function bundle(activity) {
    const id = activity.id;
    return {
        schemaVersion: 1,
        activity,
        streams: { activityId: id, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: `synthetic-source:${id}`,
            activityId: id,
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

function detailBundle(id = 'opaque/detail ?#%') {
    const activity = canonicalActivity(id, {
        sportCategory: 'ride',
        sportVariant: 'gravel',
        name: null,
        distanceMeters: 0,
        movingTimeSeconds: 60,
        elapsedTimeSeconds: null,
        elevationGainMeters: -0,
        averageHeartRateBpm: null,
        averagePowerWatts: 0,
        averageCadence: 0,
        capabilities: {
            hasGps: true,
            hasHeartRate: true,
            hasPower: true,
            hasCadence: true,
            hasLaps: true
        }
    });
    return {
        ...bundle(activity),
        streams: {
            activityId: id,
            series: [
                {
                    streamType: 'distance',
                    unit: 'm',
                    offsetsSeconds: [0, 30, 60],
                    values: [0, 100, 200]
                },
                {
                    streamType: 'heartRate',
                    unit: 'bpm',
                    offsetsSeconds: [0, 30, 60],
                    values: [120, null, 140]
                },
                {
                    streamType: 'position',
                    unit: 'wgs84',
                    offsetsSeconds: [0, 60],
                    values: [[0, 0], [0, 0.001]]
                },
                {
                    streamType: 'power',
                    unit: 'W',
                    offsetsSeconds: [0, 30, 60],
                    values: [0, 150, 200]
                }
            ]
        },
        laps: [{
            id: `lap:${id}`,
            activityId: id,
            index: 0,
            startOffsetSeconds: 0,
            elapsedTimeSeconds: 60,
            movingTimeSeconds: 50,
            distanceMeters: 200
        }]
    };
}

function fakeStore(pages) {
    const calls = {
        initialize: 0,
        list: []
    };
    return {
        calls,
        store: {
            async initialize() {
                calls.initialize += 1;
            },
            async listActivities(options) {
                calls.list.push(options);
                const page = pages[calls.list.length - 1] ?? [];
                return Object.freeze(page.slice());
            }
        }
    };
}

function assertCanonicalEnvelope(value, data) {
    assert.deepEqual(Object.keys(value), [
        'data',
        'source',
        'warnings',
        'partial'
    ]);
    assert.equal(value.data, data);
    assert.equal(value.source, REPOSITORY_SOURCE.CANONICAL);
    assert.deepEqual(value.warnings, []);
    assert.equal(value.partial, false);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.warnings), true);
}

test('summary projection preserves missing, null, zero, opaque IDs, and known types', () => {
    const projected = projectCanonicalSummaryActivity(canonicalActivity(
        '0002/opaque ?#%',
        {
            sportVariant: 'trail-run',
            name: null,
            distanceMeters: 0,
            elevationGainMeters: -0,
            movingTimeSeconds: -0,
            elapsedTimeSeconds: null,
            averageHeartRateBpm: null,
            averagePowerWatts: 0,
            extensions: {
                shadowCanonicalWriterV1: {
                    gearExternalId: null
                },
                futureNamespace: {
                    ignored: true
                }
            },
            futureCanonicalField: 'ignored'
        }
    ));

    assert.deepEqual(projected, {
        id: '0002/opaque ?#%',
        type: 'TrailRun',
        sport_type: 'TrailRun',
        start_date: '2026-08-05T10:00:00.000Z',
        start_date_local: '2026-08-05T18:00:00.000',
        name: null,
        distance: 0,
        total_elevation_gain: -0,
        moving_time: -0,
        elapsed_time: null,
        average_heartrate: null,
        average_watts: 0,
        gear_id: null
    });
    assert.equal(Object.hasOwn(projected, 'average_cadence'), false);
    assert.equal(Object.hasOwn(projected, 'map'), false);
    assert.equal(Object.is(projected.moving_time, -0), true);
    assert.equal(Object.is(projected.total_elevation_gain, -0), true);
    assert.equal(Object.isFrozen(projected), true);

    const utcFallback = projectCanonicalSummaryActivity(canonicalActivity(
        'opaque-utc',
        {
            sportCategory: 'ride',
            sportVariant: 'unknown-future-variant',
            timeZone: { ianaName: null, utcOffsetMinutes: null }
        }
    ));
    assert.equal(utcFallback.type, 'Ride');
    assert.equal(utcFallback.start_date_local, utcFallback.start_date);

    for (const [sportCategory, sportVariant, expected] of [
        ['team', 'basketball', 'Basketball'],
        ['team', 'volleyball', 'Volleyball'],
        ['racket', 'table-tennis', 'TableTennis']
    ]) {
        const variant = projectCanonicalSummaryActivity(canonicalActivity(
            `opaque-${sportVariant}`,
            { sportCategory, sportVariant }
        ));
        assert.equal(variant.type, expected);
        assert.equal(variant.sport_type, expected);
    }
});

test('summary projection fails closed for accessors, sparse arrays, and Proxies', () => {
    let getterCalls = 0;
    const accessor = canonicalActivity('opaque-accessor');
    Object.defineProperty(accessor, 'name', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'private';
        }
    });
    const sparse = [];
    sparse.length = 1;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    for (const invoke of [
        () => projectCanonicalSummaryActivity(accessor),
        () => projectCanonicalSummaryActivities(sparse),
        () => projectCanonicalSummaryActivities(proxy)
    ]) {
        assert.throws(invoke, TypeError);
    }
    assert.equal(getterCalls, 0);
});

test('detail projection preserves opaque IDs, null/zero, minimal laps, and aligned streams', () => {
    const stored = detailBundle();
    const activity = projectCanonicalDetailActivity(stored);
    assert.deepEqual(activity, {
        id: stored.activity.id,
        type: 'GravelRide',
        sport_type: 'GravelRide',
        start_date: '2026-08-05T10:00:00.000Z',
        start_date_local: '2026-08-05T18:00:00.000',
        name: null,
        distance: 0,
        total_elevation_gain: -0,
        moving_time: 60,
        elapsed_time: null,
        average_heartrate: null,
        average_watts: 0,
        average_cadence: 0,
        laps: [{
            lap_index: 0,
            distance: 200,
            moving_time: 50,
            elapsed_time: 60,
            average_speed: 4
        }]
    });
    assert.equal(Object.is(activity.total_elevation_gain, -0), true);
    assert.equal(Object.isFrozen(activity), true);
    assert.equal(Object.isFrozen(activity.laps), true);
    assert.equal(Object.isFrozen(activity.laps[0]), true);

    const streams = projectCanonicalDetailStreams(stored, [
        'distance',
        'time',
        'heartrate',
        'latlng',
        'watts'
    ]);
    assert.deepEqual(streams, {
        distance: { data: [0, 100, 200] },
        time: { data: [0, 30, 60] },
        heartrate: { data: [120, null, 140] },
        watts: { data: [0, 150, 200] }
    });
    assert.equal(Object.hasOwn(streams, 'latlng'), false);
    assert.equal(Object.isFrozen(streams), true);
    assert.equal(Object.isFrozen(streams.distance.data), true);
    assert.deepEqual(stored, detailBundle());
});

test('detail stream projection maps physical types and degrades mismatched timelines', () => {
    assert.deepEqual(canonicalStreamTypesForLegacy([
        'distance',
        'time',
        'latlng',
        'heartrate',
        'watts',
        'velocity_smooth',
        'temp'
    ]), [
        'distance',
        'position',
        'heartRate',
        'power',
        'speed',
        'temperature'
    ]);

    const stored = detailBundle('timeline-only');
    stored.streams.series = stored.streams.series.filter(
        value => value.streamType === 'position'
    );
    const streams = projectCanonicalDetailStreams(stored, ['time', 'latlng']);
    assert.deepEqual(streams, {
        time: { data: [0, 60] },
        latlng: { data: [[0, 0], [0, 0.001]] }
    });

    const requestedTimeline = detailBundle('selected-timeline');
    requestedTimeline.streams.series = [
        {
            streamType: 'altitude',
            unit: 'm',
            offsetsSeconds: [0, 5],
            values: [10, 11]
        },
        {
            streamType: 'heartRate',
            unit: 'bpm',
            offsetsSeconds: [0, 10],
            values: [120, 130]
        }
    ];
    assert.deepEqual(
        projectCanonicalDetailStreams(requestedTimeline, ['time', 'heartrate']),
        {
            time: { data: [0, 10] },
            heartrate: { data: [120, 130] }
        }
    );
});

test('detail projection rejects unsafe bundle and request shapes without getter execution', () => {
    let getterCalls = 0;
    const stored = detailBundle('unsafe-detail');
    Object.defineProperty(stored.activity, 'name', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'private';
        }
    });
    const idAccessor = detailBundle('unsafe-id');
    Object.defineProperty(idAccessor.activity, 'id', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'unsafe-id';
        }
    });
    const sparse = [];
    sparse.length = 1;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    for (const invoke of [
        () => projectCanonicalDetailActivity(stored),
        () => projectCanonicalDetailActivity(idAccessor),
        () => projectCanonicalDetailStreams(detailBundle(), sparse),
        () => projectCanonicalDetailStreams(proxy, ['time'])
    ]) {
        assert.throws(invoke, TypeError);
    }
    assert.equal(getterCalls, 0);
});

test('Repository uses fixed descending 500 pages and one complete envelope', async () => {
    const values = Array.from({ length: 500 }, (_, index) => canonicalActivity(
        `opaque-${String(500 - index).padStart(4, '0')}`,
        { startTimeUtc: '2026-08-05T10:00:00.000Z' }
    ));
    const { store, calls } = fakeStore([values, []]);
    let constructions = 0;
    const repository = new CanonicalRepository({
        storeFactory() {
            constructions += 1;
            return store;
        }
    });

    assert.equal(constructions, 0);
    const result = await repository.listActivities({ refresh: true });
    assert.equal(constructions, 1);
    assert.equal(calls.initialize, 1);
    assert.equal(calls.list.length, 2);
    assert.deepEqual(calls.list[0], { limit: 500, direction: 'desc' });
    assert.deepEqual(calls.list[1], {
        limit: 500,
        direction: 'desc',
        cursor: {
            startTimeUtc: values.at(-1).startTimeUtc,
            id: values.at(-1).id
        }
    });
    assertCanonicalEnvelope(result, result.data);
    assert.equal(result.data.length, 500);
    assert.equal(Object.isFrozen(result.data), true);
    assert.equal(Object.isFrozen(result.data[0]), true);
});

test('Repository rejects repeated, ascending, malformed, and failed Store pages safely', async () => {
    const descending = [
        canonicalActivity('opaque-b'),
        canonicalActivity('opaque-a')
    ];
    const repeatedPage = Array.from({ length: 500 }, (_, index) => (
        canonicalActivity(`opaque-${String(500 - index).padStart(4, '0')}`)
    ));
    const scenarios = [
        ['repeated', [repeatedPage, repeatedPage]],
        ['ascending', [[descending[1], descending[0]]]],
        ['malformed', [[{ id: 'malformed' }]]],
        ['non-array', [{}]]
    ];
    for (const [name, pages] of scenarios) {
        const { store } = fakeStore(pages);
        const repository = new CanonicalRepository({
            storeFactory: () => store
        });
        await assert.rejects(
            repository.listActivities(),
            error => (
                error instanceof RepositoryError
                && error.code === REPOSITORY_ERROR_CODE.RESPONSE_INVALID
                && error.operation === 'listActivities'
                && JSON.stringify(error).includes('malformed') === false
            ),
            name
        );
    }

    for (const failure of [
        { code: 'INVALID_REQUEST', private: 'private-storage-detail' },
        new Error('private local record')
    ]) {
        const repository = new CanonicalRepository({
            storeFactory: () => ({
                async initialize() {},
                async listActivities() { throw failure; }
            })
        });
        await assert.rejects(repository.listActivities(), error => {
            assert.equal(
                error.code,
                failure.code === 'INVALID_REQUEST'
                    ? REPOSITORY_ERROR_CODE.INVALID_REQUEST
                    : REPOSITORY_ERROR_CODE.RESPONSE_INVALID
            );
            const serialized = JSON.stringify(error);
            assert.equal(serialized.includes('private'), false);
            return true;
        });
    }
});

test('Repository methods remain exactly seven with neutral metadata', async () => {
    let storeConstructions = 0;
    const repository = new CanonicalRepository({
        storeFactory() {
            storeConstructions += 1;
            throw new Error('must stay lazy');
        }
    });
    for (const method of [
        'listActivities',
        'getActivity',
        'getStreams',
        'getAthlete',
        'getZones',
        'getGears',
        'getGear'
    ]) {
        assert.equal(typeof repository[method], 'function');
    }
    assert.equal(repository.getLaps, undefined);

    const athlete = await repository.getAthlete();
    const zones = await repository.getZones();
    const gears = await repository.getGears();
    const gear = await repository.getGear('opaque-gear');
    assertCanonicalEnvelope(athlete, null);
    assertCanonicalEnvelope(zones, null);
    assertCanonicalEnvelope(gears, gears.data);
    assert.deepEqual(gears.data, []);
    assert.equal(Object.isFrozen(gears.data), true);
    assertCanonicalEnvelope(gear, null);
    assert.equal(storeConstructions, 0);

    await assert.rejects(
        repository.getGear(''),
        error => error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
    );
    assert.equal(storeConstructions, 0);
});

test('concurrent activity and stream reads coalesce into one Canonical bundle transaction', async () => {
    const stored = detailBundle('coalesced/000123 ?#%');
    const calls = { initialize: 0, bundles: [] };
    const repository = new CanonicalRepository({
        storeFactory: () => ({
            async initialize() {
                calls.initialize += 1;
            },
            async getBundle(id, options) {
                calls.bundles.push({ id, options });
                return stored;
            }
        })
    });

    const [activity, streams] = await Promise.all([
        repository.getActivity(stored.activity.id),
        repository.getStreams(stored.activity.id, {
            types: ['distance', 'time', 'heartrate', 'watts']
        })
    ]);
    assert.equal(calls.initialize, 1);
    assert.deepEqual(calls.bundles, [{
        id: stored.activity.id,
        options: {
            streamTypes: ['distance', 'heartRate', 'power']
        }
    }]);
    assertCanonicalEnvelope(activity, activity.data);
    assert.equal(activity.data.id, stored.activity.id);
    assertCanonicalEnvelope(streams, streams.data);
    assert.deepEqual(streams.data.time.data, [0, 30, 60]);
});

test('a late stream read joining a full activity bundle selects only its requested timeline', async () => {
    const stored = detailBundle('late-coalesced');
    stored.streams.series = [
        {
            streamType: 'altitude',
            unit: 'm',
            offsetsSeconds: [0, 5],
            values: [10, 11]
        },
        {
            streamType: 'heartRate',
            unit: 'bpm',
            offsetsSeconds: [0, 10],
            values: [120, 130]
        }
    ];
    let releaseBundle;
    let bundleStarted;
    const started = new Promise(resolve => { bundleStarted = resolve; });
    const blocked = new Promise(resolve => { releaseBundle = resolve; });
    const calls = [];
    const repository = new CanonicalRepository({
        storeFactory: () => ({
            async initialize() {},
            async getBundle(id, options) {
                calls.push({ id, options });
                bundleStarted();
                await blocked;
                return stored;
            }
        })
    });

    const activityPromise = repository.getActivity(stored.activity.id);
    await started;
    const streamsPromise = repository.getStreams(stored.activity.id, {
        types: ['time', 'heartrate']
    });
    releaseBundle();
    const [activity, streams] = await Promise.all([activityPromise, streamsPromise]);

    assert.equal(activity.data.id, stored.activity.id);
    assert.deepEqual(calls, [{ id: stored.activity.id, options: undefined }]);
    assert.deepEqual(streams.data, {
        time: { data: [0, 10] },
        heartrate: { data: [120, 130] }
    });
});

test('Canonical detail reads preserve missing and map unsafe failures safely', async () => {
    for (const [value, code] of [
        [null, REPOSITORY_ERROR_CODE.NOT_FOUND],
        [new Error('private local record'), REPOSITORY_ERROR_CODE.RESPONSE_INVALID],
        [{ code: 'INVALID_REQUEST', private: 'private' }, REPOSITORY_ERROR_CODE.INVALID_REQUEST]
    ]) {
        const repository = new CanonicalRepository({
            storeFactory: () => ({
                async initialize() {},
                async getBundle() {
                    if (value instanceof Error || value?.code) throw value;
                    return value;
                }
            })
        });
        await assert.rejects(
            repository.getActivity('opaque-missing'),
            error => {
                assert.equal(error.code, code);
                assert.equal(error.operation, 'getActivity');
                assert.equal(JSON.stringify(error).includes('private'), false);
                return true;
            }
        );
    }

    let constructions = 0;
    const invalid = new CanonicalRepository({
        storeFactory() {
            constructions += 1;
            throw new Error('must remain lazy');
        }
    });
    for (const invoke of [
        () => invalid.getActivity(123),
        () => invalid.getStreams('opaque', { types: ['time', 'time'] }),
        () => invalid.getStreams('opaque', { types: ['unknown'] })
    ]) {
        await assert.rejects(
            invoke(),
            error => error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
        );
    }
    assert.equal(constructions, 0);
});

test('actual Canonical Store serves one projected local detail bundle', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'canonical-detail-repository-test@1'
    });
    await storage.initialize();
    const stored = detailBundle('actual-store/000123 ?#%');
    await storage.putBundle(stored);
    const repository = new CanonicalRepository({ storeFactory: () => storage });
    const [activity, streams] = await Promise.all([
        repository.getActivity(stored.activity.id),
        repository.getStreams(stored.activity.id, {
            types: ['distance', 'time', 'heartrate', 'latlng', 'watts']
        })
    ]);
    assert.equal(activity.data.id, stored.activity.id);
    assert.deepEqual(activity.data.laps, [{
        lap_index: 0,
        distance: 200,
        moving_time: 50,
        elapsed_time: 60,
        average_speed: 4
    }]);
    assert.deepEqual(streams.data, {
        distance: { data: [0, 100, 200] },
        time: { data: [0, 30, 60] },
        heartrate: { data: [120, null, 140] },
        watts: { data: [0, 150, 200] }
    });
    await storage.close();
});

test('Repository rejects unsafe list options before Store construction', async () => {
    let constructions = 0;
    let getterCalls = 0;
    const repository = new CanonicalRepository({
        storeFactory() {
            constructions += 1;
            throw new Error('must stay lazy');
        }
    });
    const accessor = {};
    Object.defineProperty(accessor, 'refresh', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return false;
        }
    });
    const proxy = new Proxy({}, {
        ownKeys() {
            throw new Error('private reflection failure');
        }
    });
    for (const options of [
        { refresh: 'yes' },
        { refresh: false, extra: true },
        accessor,
        proxy
    ]) {
        await assert.rejects(
            repository.listActivities(options),
            error => error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
        );
    }
    assert.equal(constructions, 0);
    assert.equal(getterCalls, 0);
});

test('actual Canonical Store returns all 503 activities in one Repository envelope', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'canonical-repository-test@1'
    });
    await storage.initialize();
    const specialIds = ['10', '2', '0002', 'alpha/beta ?#%'];
    for (let index = 0; index < 503; index += 1) {
        const id = specialIds[index]
            ?? `opaque-${String(index).padStart(4, '0')}`;
        const overrides = {
            startTimeUtc: '2026-08-05T09:00:00.000Z'
        };
        if (index === 4) overrides.distanceMeters = 0;
        if (index === 5) overrides.averagePowerWatts = null;
        await storage.putBundle(bundle(canonicalActivity(id, overrides)));
    }
    let factoryCalls = 0;
    const repository = new CanonicalRepository({
        storeFactory() {
            factoryCalls += 1;
            return storage;
        }
    });
    const result = await repository.listActivities();
    assert.equal(factoryCalls, 1);
    assert.equal(result.source, 'canonical');
    assert.equal(result.partial, false);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.data.length, 503);
    assert.equal(new Set(result.data.map(value => value.id)).size, 503);
    assert.equal(result.data.some(value => value.id === 'alpha/beta ?#%'), true);
    assert.equal(
        result.data.some(value => Object.is(value.distance, 0)),
        true
    );
    assert.equal(
        result.data.some(value => value.average_watts === null),
        true
    );
    await storage.close();
});
