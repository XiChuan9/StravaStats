import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';

const projectRoot = new URL('../../', import.meta.url);
const mainSource = await readFile(new URL('js/app/main.js', projectRoot), 'utf8');
const runPlusSource = await readFile(new URL('js/tabs/run-plus.js', projectRoot), 'utf8');

function compileMainBoundary(source) {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const boundarySource = source
        .slice(start + startMarker.length, end)
        .replace(/export\s+(async\s+)?function/g, '$1function');
    return Function(
        'createRepository',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'APP_SESSION_MODE',
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
        Object.freeze({ DEMO: 'demo', REAL: 'real' })
    );
}

const boundary = compileMainBoundary(mainSource);

function envelope(data, {
    source = REPOSITORY_SOURCE.NETWORK,
    warnings = [],
    partial = false
} = {}) {
    return { data, source, warnings, partial };
}

function repositoryHarness(overrides = {}) {
    const calls = [];
    const repository = {
        async listActivities() {
            return envelope([]);
        },
        async getActivity(activityId) {
            calls.push({ operation: 'getActivity', activityId });
            return envelope({ id: activityId, laps: [] });
        },
        async getStreams(activityId, options) {
            calls.push({ operation: 'getStreams', activityId, options });
            return envelope({ time: { data: [0, 1] } });
        },
        async getAthlete() {
            return envelope(null);
        },
        async getZones() {
            return envelope(null);
        },
        async getGears() {
            return envelope([]);
        },
        ...overrides
    };
    return { calls, repository };
}

function sessionFor(repository, sessionMode = 'real') {
    return boundary.createSummaryRepositorySession({
        sessionMode,
        repositoryFactory: () => repository
    });
}

test('Run Plus receives a frozen narrow façade with order- and duplicate-preserving gears', async () => {
    const harness = repositoryHarness();
    const session = sessionFor(harness.repository);
    const gears = [
        { id: 'synthetic-shoe-2', name: 'Second' },
        { id: 'synthetic-shoe-1', name: 'First' },
        { id: 'synthetic-shoe-2', name: 'Second duplicate' }
    ];
    const onFiltersChange = () => {};
    const options = boundary.createRunPlusRenderOptions({
        sessionRepository: session,
        sessionGears: gears,
        onFiltersChange
    });

    assert.deepEqual(Reflect.ownKeys(options), [
        'gears',
        'getActivity',
        'getStreams',
        'onFiltersChange'
    ]);
    assert.equal(Object.isFrozen(options), true);
    assert.equal(Object.isFrozen(options.gears), true);
    assert.notEqual(options.gears, gears);
    assert.deepEqual(options.gears.map(gear => gear.id), [
        'synthetic-shoe-2',
        'synthetic-shoe-1',
        'synthetic-shoe-2'
    ]);
    assert.equal(options.onFiltersChange, onFiltersChange);

    const activity = await options.getActivity('opaque/activity:id');
    const streams = await options.getStreams('opaque/activity:id');
    assert.equal(activity.id, 'opaque/activity:id');
    assert.deepEqual(streams, { time: { data: [0, 1] } });
    assert.deepEqual(harness.calls, [
        { operation: 'getActivity', activityId: 'opaque/activity:id' },
        {
            operation: 'getStreams',
            activityId: 'opaque/activity:id',
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
        }
    ]);
});

test('opaque IDs are not parsed or defaulted and each callback performs one Repository read', async () => {
    const harness = repositoryHarness();
    const options = boundary.createRunPlusRenderOptions({
        sessionRepository: sessionFor(harness.repository),
        sessionGears: [],
        onFiltersChange() {}
    });

    await options.getActivity('0007-not-a-number');
    await options.getStreams('0007-not-a-number');
    assert.deepEqual(harness.calls.map(call => call.activityId), [
        '0007-not-a-number',
        '0007-not-a-number'
    ]);
    for (const invalid of ['', '   ', null, undefined, 0, 7]) {
        await assert.rejects(
            options.getActivity(invalid),
            error => error?.name === 'OperationalError'
                && error.message === 'Operation failed.'
        );
    }
    assert.equal(harness.calls.length, 2);
});

test('injected descriptors and Repository envelopes fail closed without accessors or raw errors', async () => {
    let optionGetterCalls = 0;
    const unsafeOptions = {};
    Object.defineProperty(unsafeOptions, 'sessionRepository', {
        enumerable: true,
        get() {
            optionGetterCalls += 1;
            throw new Error('private option secret');
        }
    });
    assert.throws(
        () => boundary.createRunPlusRenderOptions(unsafeOptions),
        error => error?.name === 'OperationalError'
            && error.message === 'Operation failed.'
    );
    assert.equal(optionGetterCalls, 0);

    let envelopeGetterCalls = 0;
    const harness = repositoryHarness({
        async getActivity() {
            const result = {
                source: REPOSITORY_SOURCE.NETWORK,
                warnings: [],
                partial: false
            };
            Object.defineProperty(result, 'data', {
                enumerable: true,
                get() {
                    envelopeGetterCalls += 1;
                    throw new Error('private activity secret');
                }
            });
            return result;
        },
        async getStreams() {
            throw new Error('private stream secret');
        }
    });
    const options = boundary.createRunPlusRenderOptions({
        sessionRepository: sessionFor(harness.repository),
        sessionGears: [],
        onFiltersChange() {}
    });
    for (const read of [options.getActivity, options.getStreams]) {
        await assert.rejects(
            read('opaque-safe-id'),
            error => error?.name === 'OperationalError'
                && error.message === 'Operation failed.'
                && !error.message.includes('private')
        );
    }
    assert.equal(envelopeGetterCalls, 0);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(
        () => boundary.createRunPlusRenderOptions(revoked.proxy),
        error => error?.name === 'OperationalError'
            && error.message === 'Operation failed.'
    );
});

test('Run Plus source has only injected reads and the documented user-owned storage keys', () => {
    for (const pattern of [
        /getCachedGears|strava_gears|strava_tokens/,
        /\/api\/strava-/,
        /Authorization|\bfetch\s*\(/,
        /indexedDB|createRepository|new\s+\w*Connector/,
        /from\s*['"]\.\/api\.js['"]/
    ]) {
        assert.doesNotMatch(runPlusSource, pattern);
    }
    for (const key of [
        'run_plus_capacity_inputs_v1',
        'run_plus_nsm_settings_v1',
        'run_plus_nsm_activity_tags_v1',
        'run_plus_nsm_session_inputs_v1',
        'run_plus_nsm_tests_v1',
        'run_plus_nsm_interval_analysis_v1'
    ]) {
        assert.equal(runPlusSource.includes(key), true, key);
    }
    assert.match(runPlusSource, /options\.getActivity\(activityId\)/);
    assert.match(runPlusSource, /options\.getStreams\(activityId\)/);
});
