import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { validateImportedActivityBundle } from '../../js/data/contracts/index.js';
import {
    STRAVA_IMPORT_LIMITS,
    STRAVA_IMPORT_MAPPER_ERROR_CODE,
    STRAVA_IMPORT_MAPPER_WARNING_CODE,
    StravaImportMapperError,
    createStravaImportMapper
} from '../../js/connectors/strava/strava-import-mapper.js';
import {
    SYNTHETIC_ACQUIRED_AT,
    SYNTHETIC_CONNECTION,
    SYNTHETIC_DEGRADED_ACTIVITY,
    SYNTHETIC_RICH_ACTIVITY,
    SYNTHETIC_SESSION,
    syntheticActivities,
    syntheticLaps,
    syntheticStreamPoints
} from '../fixtures/synthetic/strava/api-import-fixture.js';

const MODULE_URL = new URL(
    '../../js/connectors/strava/strava-import-mapper.js',
    import.meta.url
);

function clone(value) {
    return structuredClone(value);
}

function mapper(overrides = {}) {
    return createStravaImportMapper({
        session: clone(SYNTHETIC_SESSION),
        connection: clone(SYNTHETIC_CONNECTION),
        ...overrides
    });
}

function mapActivities(activities, overrides = {}) {
    return mapper().mapActivities({
        cancelled: false,
        acquiredAt: SYNTHETIC_ACQUIRED_AT,
        activities,
        ...overrides
    });
}

function expectCode(invoke, code, stage, activityIndex = null) {
    assert.throws(invoke, error => {
        assert.equal(error instanceof StravaImportMapperError, true);
        assert.equal(error.code, code);
        assert.equal(error.stage, stage);
        assert.equal(error.activityIndex, activityIndex);
        assert.equal(error.retryable, false);
        assert.equal(Object.isFrozen(error), true);
        assert.deepEqual(error.toJSON(), {
            name: 'StravaImportMapperError',
            code,
            message: error.message,
            stage,
            activityIndex,
            retryable: false
        });
        return true;
    });
}

function warningCodes(bundle) {
    return bundle.warnings.map(({ code }) => code);
}

function deepFrozen(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) deepFrozen(child, seen);
}

test('direct module exports the exact frozen C3a surface and limits', async () => {
    const module = await import(`${MODULE_URL.href}?exports=${Date.now()}`);
    assert.deepEqual(Object.keys(module).sort(), [
        'STRAVA_IMPORT_LIMITS',
        'STRAVA_IMPORT_MAPPER_ERROR_CODE',
        'STRAVA_IMPORT_MAPPER_WARNING_CODE',
        'StravaImportMapperError',
        'createStravaImportMapper'
    ]);
    assert.deepEqual(STRAVA_IMPORT_LIMITS, {
        maxActivitiesPerRun: 100,
        maxConcurrentActivityOperations: 2,
        maxStreamPointsPerSeries: 200_000,
        maxLapsPerActivity: 10_000
    });
    assert.equal(Object.isFrozen(STRAVA_IMPORT_LIMITS), true);
    assert.equal(Object.isFrozen(STRAVA_IMPORT_MAPPER_ERROR_CODE), true);
    assert.equal(Object.isFrozen(STRAVA_IMPORT_MAPPER_WARNING_CODE), true);
});

test('module import performs zero platform, credential, storage, DOM, or timer I/O', async () => {
    const names = [
        'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage',
        'indexedDB', 'Worker', 'document', 'window', 'setTimeout', 'setInterval'
    ];
    const originals = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    let accesses = 0;
    try {
        for (const name of names) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    accesses += 1;
                    throw new Error('unexpected platform access');
                }
            });
        }
        await import(`${MODULE_URL.href}?side-effects=${Date.now()}`);
        assert.equal(accesses, 0);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('authority is exact, detached, frozen, and checked before provider records', () => {
    const created = mapper();
    assert.deepEqual(Object.keys(created), ['mapActivities']);
    assert.equal(Object.isFrozen(created), true);

    const activity = {};
    Object.defineProperty(activity, 'summary', {
        enumerable: true,
        get() {
            throw new Error('provider record inspected');
        }
    });
    for (const [connection, code] of [
        [{ ...SYNTHETIC_CONNECTION, status: 'reconnect_required', errorCode: 'AUTHORIZATION_REQUIRED' }, 'AUTHORIZATION_REQUIRED'],
        [{ ...SYNTHETIC_CONNECTION, status: 'error', errorCode: 'CONNECTION_ERROR' }, 'AUTHORIZATION_REQUIRED'],
        [{ ...SYNTHETIC_CONNECTION, status: 'disconnected', errorCode: null }, 'AUTHORIZATION_REQUIRED'],
        [{ ...SYNTHETIC_CONNECTION, status: 'disconnected', errorCode: 'REVOCATION_UNCONFIRMED' }, 'AUTHORIZATION_REQUIRED']
    ]) {
        expectCode(
            () => createStravaImportMapper({
                session: clone(SYNTHETIC_SESSION),
                connection
            }),
            code,
            'authorization'
        );
    }
    expectCode(
        () => createStravaImportMapper({
            session: clone(SYNTHETIC_SESSION),
            connection: { ...SYNTHETIC_CONNECTION, subjectId: '900000000000000002' }
        }),
        'IDENTITY_MISMATCH',
        'authorization'
    );
    expectCode(
        () => createStravaImportMapper({
            session: { ...SYNTHETIC_SESSION, grantedScopes: ['read'] },
            connection: clone(SYNTHETIC_CONNECTION)
        }),
        'SCOPE_INSUFFICIENT',
        'authorization'
    );
    assert.equal(Object.getOwnPropertyDescriptor(activity, 'summary').get instanceof Function, true);
});

test('scope order, duplicates, extras, provider, subject, and C2 shape fail closed', () => {
    for (const grantedScopes of [
        ['activity:read_all', 'read'],
        ['read', 'read'],
        ['read', 'activity:read_all', 'profile:read_all'],
        ['read', null],
        Object.assign(['read', 'activity:read_all'], { extra: true })
    ]) {
        expectCode(
            () => mapper({ session: { ...SYNTHETIC_SESSION, grantedScopes } }),
            'SCOPE_INSUFFICIENT',
            'authorization'
        );
    }
    for (const overrides of [
        { id: 'other' },
        { provider: 'other' },
        { subjectId: '0001' },
        { revision: 0 },
        { revision: Number.MAX_SAFE_INTEGER + 1 },
        { lastSyncAt: '2026-08-10T00:00:00Z' },
        { errorCode: 'CONNECTION_ERROR' },
        { extra: true }
    ]) {
        expectCode(
            () => mapper({ connection: { ...SYNTHETIC_CONNECTION, ...overrides } }),
            'INVALID_REQUEST',
            'authorization'
        );
    }
    expectCode(
        () => mapper({ session: { ...SYNTHETIC_SESSION, provider: 'other' } }),
        'INVALID_REQUEST',
        'authorization'
    );
});

test('maps the rich reduced provider envelope to one exact accepted bundle', () => {
    const before = clone(SYNTHETIC_RICH_ACTIVITY);
    const [bundle] = mapActivities([SYNTHETIC_RICH_ACTIVITY]);
    assert.deepEqual(SYNTHETIC_RICH_ACTIVITY, before);
    assert.deepEqual(bundle.activity, {
        schemaVersion: 1,
        id: 'strava-api:910000000000000001',
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: '2026-08-10T10:00:00.000Z',
        timeZone: { ianaName: null, utcOffsetMinutes: 0 },
        capabilities: {
            hasGps: true,
            hasHeartRate: true,
            hasPower: true,
            hasCadence: true,
            hasLaps: true
        },
        distanceMeters: 0,
        movingTimeSeconds: 120,
        elapsedTimeSeconds: 120,
        elevationGainMeters: -0,
        averageHeartRateBpm: null,
        averagePowerWatts: 0,
        averageCadence: 0
    });
    assert.equal(Object.hasOwn(bundle.activity, 'name'), false);
    assert.deepEqual(bundle.streams.series.map(series => [series.streamType, series.unit]), [
        ['distance', 'm'],
        ['position', 'wgs84'],
        ['altitude', 'm'],
        ['speed', 'm/s'],
        ['heartRate', 'bpm'],
        ['cadence', 'rpm'],
        ['power', 'W'],
        ['temperature', 'C'],
        ['moving', 'boolean'],
        ['grade_smooth', 'percent']
    ]);
    for (const series of bundle.streams.series) {
        assert.deepEqual(series.offsetsSeconds, [0, 60, 120]);
    }
    assert.deepEqual(bundle.laps, [
        {
            id: 'strava-api:910000000000000001:lap:0',
            activityId: 'strava-api:910000000000000001',
            index: 0,
            startOffsetSeconds: 0,
            elapsedTimeSeconds: 60,
            movingTimeSeconds: null,
            distanceMeters: null
        },
        {
            id: 'strava-api:910000000000000001:lap:1',
            activityId: 'strava-api:910000000000000001',
            index: 1,
            startOffsetSeconds: 60,
            elapsedTimeSeconds: 60,
            movingTimeSeconds: 60,
            distanceMeters: 0
        }
    ]);
    assert.deepEqual(bundle.events, []);
    assert.deepEqual(bundle.devices, []);
    assert.deepEqual(bundle.sources, [{
        id: 'strava-api-source:910000000000000001',
        activityId: 'strava-api:910000000000000001',
        provider: 'strava',
        externalId: '910000000000000001',
        rawArtifactId: null,
        acquisitionMethod: 'strava-api',
        deviceId: null,
        importedAt: SYNTHETIC_ACQUIRED_AT
    }]);
    assert.deepEqual(bundle.versionMetadata, {
        schemaVersion: 1,
        parserVersion: null,
        normalizerVersion: 'strava-import-mapper@1',
        analysisVersion: null,
        settingsVersion: null,
        inputHash: null
    });
    assert.deepEqual(warningCodes(bundle), [
        'DETAIL_CONFLICT_DROPPED',
        'PRIVATE_FIELDS_DROPPED',
        'UNKNOWN_FIELDS_DROPPED',
        'PRIVATE_FIELDS_DROPPED',
        'TIME_ZONE_NAME_DROPPED',
        'UNKNOWN_FIELDS_DROPPED'
    ]);
    assert.deepEqual(validateImportedActivityBundle(bundle), {
        ok: true,
        errors: [],
        warnings: []
    });
});

test('degraded detail, laps, streams, unknown sport, and private fields warn truthfully', () => {
    const [bundle] = mapActivities([SYNTHETIC_DEGRADED_ACTIVITY]);
    assert.deepEqual(bundle.streams.series, []);
    assert.deepEqual(bundle.laps, []);
    assert.deepEqual(bundle.activity.capabilities, {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: false
    });
    assert.equal(bundle.activity.sportCategory, 'other');
    assert.equal(bundle.activity.sportVariant, null);
    assert.equal(bundle.activity.timeZone.utcOffsetMinutes, null);
    assert.deepEqual(warningCodes(bundle), [
        'SPORT_FALLBACK',
        'DETAIL_UNAVAILABLE',
        'LAPS_UNAVAILABLE',
        'STREAMS_UNAVAILABLE',
        'PRIVATE_FIELDS_DROPPED'
    ]);
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
});

test('all frozen sport mappings and fallback are deterministic', () => {
    const cases = new Map([
        ['Run', ['run', null]], ['TrailRun', ['run', 'trail-run']],
        ['VirtualRun', ['run', 'virtual-run']], ['Ride', ['ride', null]],
        ['MountainBikeRide', ['ride', 'mountain-bike']], ['GravelRide', ['ride', 'gravel']],
        ['VirtualRide', ['ride', 'virtual']], ['EBikeRide', ['ride', 'e-bike']],
        ['EMountainBikeRide', ['ride', 'e-mountain-bike']], ['Swim', ['swim', null]],
        ['Walk', ['walk', null]], ['Hike', ['hike', null]], ['Workout', ['workout', null]],
        ['WeightTraining', ['workout', 'strength']], ['Crossfit', ['workout', 'cross-training']],
        ['Elliptical', ['workout', 'elliptical']], ['StairStepper', ['workout', 'stair-stepper']],
        ['Yoga', ['workout', 'yoga']], ['AlpineSki', ['winter', 'alpine-ski']],
        ['NordicSki', ['winter', 'nordic-ski']], ['Snowboard', ['winter', 'snowboard']],
        ['Snowshoe', ['winter', 'snowshoe']], ['Soccer', ['team', 'football']],
        ['Tennis', ['racket', 'tennis']], ['Badminton', ['racket', 'badminton']],
        ['Pickleball', ['racket', 'pickleball']], ['Padel', ['racket', 'padel']],
        ['Racquetball', ['racket', 'racquetball']], ['Squash', ['racket', 'squash']]
    ]);
    let id = 9_300_000;
    for (const [sport, expected] of cases) {
        const activityId = String(id++);
        const [bundle] = mapActivities([{
            summary: {
                id: activityId,
                sport_type: sport,
                start_date: '2026-08-10T10:00:00Z'
            },
            detail: { id: activityId, laps: [] },
            streams: {}
        }]);
        assert.deepEqual(
            [bundle.activity.sportCategory, bundle.activity.sportVariant],
            expected,
            sport
        );
    }
});

test('summary precedence and missing, null, zero, and numeric IDs stay distinct', () => {
    const [bundle] = mapActivities([{
        summary: {
            id: 9_400_001,
            sport_type: 'Ride',
            start_date: '2026-08-10T10:00:00.123Z',
            utc_offset: 0,
            distance: null,
            moving_time: 0,
            elapsed_time: 0,
            average_watts: 0
        },
        detail: {
            id: '9400001',
            distance: 42,
            average_cadence: 0,
            laps: []
        },
        streams: {}
    }]);
    assert.equal(bundle.activity.id, 'strava-api:9400001');
    assert.equal(bundle.activity.distanceMeters, null);
    assert.equal(bundle.activity.movingTimeSeconds, 0);
    assert.equal(bundle.activity.elapsedTimeSeconds, 0);
    assert.equal(bundle.activity.averagePowerWatts, 0);
    assert.equal(bundle.activity.averageCadence, 0);
    assert.equal(Object.hasOwn(bundle.activity, 'averageHeartRateBpm'), false);
    assert.equal(Object.is(bundle.activity.elevationGainMeters, -0), false);
});

test('opaque IDs, timestamps, offsets, summary ranges, and relations fail closed', () => {
    for (const id of ['0001', '0', '-1', '1.0', '1e3', ' 1 ', 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
        expectCode(() => mapActivities([{
            summary: { id, sport_type: 'Run', start_date: '2026-08-10T10:00:00Z' },
            detail: null,
            streams: null
        }]), 'PROVIDER_RECORD_INVALID', 'mapping', 0);
    }
    for (const summary of [
        { id: '9500001', sport_type: null, start_date: '2026-08-10T10:00:00Z' },
        { id: '9500001', sport_type: 'Run', start_date: '2026-02-30T10:00:00Z' },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00+01:00' },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', utc_offset: 1 },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', utc_offset: 50_460 },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', distance: -1 },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', average_heartrate: 0 },
        { id: '9500001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', moving_time: 2, elapsed_time: 1 }
    ]) {
        expectCode(() => mapActivities([{ summary, detail: null, streams: null }]),
            'PROVIDER_RECORD_INVALID', 'mapping', 0);
    }
});

test('stream missing, null, empty, timeline, value, and warning semantics are exact', () => {
    const base = {
        summary: { id: '9600001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z' },
        detail: { id: '9600001', laps: [] }
    };
    assert.deepEqual(mapActivities([{ ...base, streams: {} }])[0].streams.series, []);
    const nullStream = mapActivities([{
        ...base,
        streams: { time: { data: [0] }, heartrate: null }
    }])[0];
    assert.deepEqual(nullStream.streams.series, []);
    assert.deepEqual(warningCodes(nullStream), ['STREAM_UNAVAILABLE']);

    const noTime = mapActivities([{
        ...base,
        streams: { distance: { data: [0] } }
    }])[0];
    assert.deepEqual(noTime.streams.series, []);
    assert.deepEqual(warningCodes(noTime), ['TIME_STREAM_UNAVAILABLE']);

    for (const streams of [
        { time: { data: [0, 2, 1] }, distance: { data: [0, 1, 2] } },
        { time: { data: [0, 1] }, distance: { data: [0] } },
        { time: { data: [0] }, heartrate: { data: [0] } },
        { time: { data: [0] }, latlng: { data: [[91, 0]] } },
        { time: { data: [0] }, moving: { data: [0] } },
        { time: { data: [0] }, watts: { data: [-1] } }
    ]) {
        expectCode(() => mapActivities([{ ...base, streams }]),
            'PROVIDER_RECORD_INVALID', 'mapping', 0);
    }
});

test('activity, stream, and lap limits accept boundary and reject +1', () => {
    assert.equal(mapActivities(syntheticActivities(100)).length, 100);
    expectCode(() => mapActivities(syntheticActivities(101)),
        'LIMIT_EXCEEDED', 'mapping');

    const pointActivity = count => ({
        summary: {
            id: '9700001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z'
        },
        detail: { id: '9700001', laps: [] },
        streams: syntheticStreamPoints(count)
    });
    assert.equal(mapActivities([pointActivity(200_000)])[0].streams.series[0].values.length, 200_000);
    expectCode(() => mapActivities([pointActivity(200_001)]),
        'LIMIT_EXCEEDED', 'mapping', 0);

    const lapActivity = count => ({
        summary: {
            id: '9700002', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', elapsed_time: 0
        },
        detail: { id: '9700002', laps: syntheticLaps(count) },
        streams: {}
    });
    assert.equal(mapActivities([lapActivity(10_000)])[0].laps.length, 10_000);
    expectCode(() => mapActivities([lapActivity(10_001)]),
        'LIMIT_EXCEEDED', 'mapping', 0);
});

test('laps sort, reindex, preserve optional states, and reject duplicates and bounds', () => {
    const base = {
        summary: {
            id: '9800001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', elapsed_time: 2
        },
        streams: {}
    };
    const [bundle] = mapActivities([{
        ...base,
        detail: {
            id: '9800001',
            laps: [
                { lap_index: 2, elapsed_time: 1, moving_time: 0 },
                { lap_index: 0, elapsed_time: 1, distance: null }
            ]
        }
    }]);
    assert.deepEqual(bundle.laps.map(lap => [
        lap.index, lap.startOffsetSeconds,
        Object.hasOwn(lap, 'movingTimeSeconds') ? lap.movingTimeSeconds : 'missing',
        Object.hasOwn(lap, 'distanceMeters') ? lap.distanceMeters : 'missing'
    ]), [
        [0, 0, 'missing', null],
        [1, 1, 0, 'missing']
    ]);
    for (const laps of [
        [{ lap_index: 0, elapsed_time: 1 }, { lap_index: 0, elapsed_time: 1 }],
        [{ lap_index: -1, elapsed_time: 1 }],
        [{ lap_index: 0, elapsed_time: -1 }],
        [{ lap_index: 0, elapsed_time: 1, moving_time: 2 }],
        [{ lap_index: 0, elapsed_time: 3 }]
    ]) {
        expectCode(() => mapActivities([{ ...base, detail: { id: '9800001', laps } }]),
            'PROVIDER_RECORD_INVALID', 'mapping', 0);
    }
});

test('cancelled snapshot and control validation occur before activity inspection', () => {
    const activities = [];
    Object.defineProperty(activities, '0', {
        enumerable: true,
        get() {
            throw new Error('activity inspected');
        }
    });
    Object.defineProperty(activities, 'length', { value: 1 });
    expectCode(() => mapper().mapActivities({
        cancelled: true,
        acquiredAt: SYNTHETIC_ACQUIRED_AT,
        activities
    }), 'CANCELLED', 'cancellation');

    for (const control of [
        { cancelled: 0, acquiredAt: SYNTHETIC_ACQUIRED_AT, activities: [] },
        { cancelled: false, acquiredAt: '2026-08-10T12:00:00Z', activities: [] },
        { cancelled: false, acquiredAt: SYNTHETIC_ACQUIRED_AT, activities: {}, },
        { cancelled: false, acquiredAt: SYNTHETIC_ACQUIRED_AT, activities: [], extra: true }
    ]) {
        expectCode(() => mapper().mapActivities(control),
            'INVALID_REQUEST', 'mapping');
    }
});

test('hostile descriptors, proxies, symbols, cycles, sparse arrays, and non-finite values fail closed', () => {
    let getterCalls = 0;
    const getterSummary = {
        id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z'
    };
    Object.defineProperty(getterSummary, 'distance', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 1;
        }
    });
    const cyclic = { id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z' };
    cyclic.unknown = cyclic;
    const symbol = { id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z' };
    symbol[Symbol('unsafe')] = 1;
    const sparse = new Array(1);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const summary of [getterSummary, cyclic, symbol, revoked.proxy, {
        id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', distance: Infinity
    }, {
        id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', unknown: 1n
    }, {
        id: '9900001', sport_type: 'Run', start_date: '2026-08-10T10:00:00Z', unknown: () => {}
    }]) {
        expectCode(() => mapActivities([{ summary, detail: null, streams: null }]),
            'PROVIDER_RECORD_INVALID', 'mapping', 0);
    }
    expectCode(() => mapActivities(sparse), 'INVALID_REQUEST', 'mapping');
    assert.equal(getterCalls, 0);
});

test('duplicate identity is fatal and results are deterministic, detached, frozen, and JSON-safe', () => {
    const duplicate = syntheticActivities(2);
    duplicate[1].summary.id = duplicate[0].summary.id;
    duplicate[1].detail.id = duplicate[0].detail.id;
    expectCode(() => mapActivities(duplicate),
        'PROVIDER_RECORD_INVALID', 'mapping', 1);

    const input = clone(SYNTHETIC_RICH_ACTIVITY);
    const first = mapActivities([input]);
    const second = mapActivities([clone(input)]);
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    assert.notEqual(first[0], input);
    deepFrozen(first);
    assert.equal(validateImportedActivityBundle(JSON.parse(JSON.stringify(first[0]))).ok, true);
    assert.deepEqual(input, clone(SYNTHETIC_RICH_ACTIVITY));
});

test('errors and warnings never serialize authority or provider canaries', () => {
    let error;
    try {
        mapActivities([{
            summary: {
                id: '9900010', sport_type: 'Run',
                start_date: 'SYNTHETIC SECRET PROVIDER CANARY'
            },
            detail: null,
            streams: null
        }]);
    } catch (caught) {
        error = caught;
    }
    const serialized = JSON.stringify(error);
    assert.doesNotMatch(serialized, /900000000000000001|9900010|SECRET|provider canary/i);

    const [bundle] = mapActivities([SYNTHETIC_RICH_ACTIVITY]);
    const warningText = JSON.stringify(bundle.warnings);
    assert.doesNotMatch(warningText, /910000000000000001|PRIVATE-FIELD|PROFILE|ROUTE|GEAR|DEVICE|UNKNOWN CANARY/i);
});

test('production source has only the approved contract import and no forbidden capability', async () => {
    const source = await readFile(MODULE_URL, 'utf8');
    assert.match(source, /data\/contracts\/index\.js/);
    assert.doesNotMatch(
        source,
        /from\s+['"][^'"]*(?:strava-api-connector|auth|source-connection-store|repository|backup|\/import\/)/i
    );
    assert.doesNotMatch(
        source,
        /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|Worker|document\.|window\.|console\.|setTimeout|setInterval/
    );
    assert.doesNotMatch(source, /Number\s*\(\s*(?:profile|athlete|activity)\.id|parseInt|parseFloat|BigInt/);
    assert.equal(pathToFileURL(new URL('.', MODULE_URL).pathname).protocol, 'file:');
});
