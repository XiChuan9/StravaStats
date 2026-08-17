import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
    activityDetailPage,
    findActivitySummary,
    renderActivityRouterError,
    routeActivity
} from '../../js/pages/activity-router.js';
import {
    createDetailReadSession
} from '../../js/pages/detail/detail-read-session.js';
import {
    ACTIVITY_STREAM_TYPES,
    initializeActivityPage
} from '../../js/pages/activity/index.js';
import {
    RUN_STREAM_TYPES,
    initializeRunPage
} from '../../js/pages/run/index.js';
import {
    BIKE_STREAM_TYPES,
    initializeBikePage
} from '../../js/pages/bike/index.js';
import {
    SWIM_STREAM_TYPES,
    initializeSwimPage
} from '../../js/pages/swim/index.js';
import {
    AdvancedActivityAnalyzer
} from '../../js/pages/activity/advanced-analysis.js';
import {
    REPOSITORY_ERROR_CODE,
    RepositoryError
} from '../../js/repository/index.js';

const projectRoot = new URL('../../', import.meta.url);

function envelope(data, source = 'demo') {
    return { data, source, warnings: [], partial: false };
}

function createRouterHarness({
    activityId = 'synthetic-activity',
    activities = [{ id: activityId, sport_type: 'Run' }],
    demo = false,
    canonical = false,
    listError = null
} = {}) {
    const calls = {
        demoMode: 0,
        featureFlags: 0,
        factory: [],
        listActivities: [],
        getActivity: 0,
        getStreams: 0,
        navigate: [],
        errors: []
    };
    const repository = {
        async listActivities(options) {
            calls.listActivities.push(options);
            if (listError) throw listError;
            return envelope(activities, demo ? 'demo' : 'cache');
        },
        async getActivity() {
            calls.getActivity += 1;
            throw new Error('Router must not request activity detail');
        },
        async getStreams() {
            calls.getStreams += 1;
            throw new Error('Router must not request streams');
        }
    };

    const options = {
        search: activityId === null
            ? ''
            : `?id=${encodeURIComponent(activityId)}`,
        demoModeReader() {
            calls.demoMode += 1;
            return demo;
        },
        featureFlagsReader() {
            calls.featureFlags += 1;
            return Object.freeze({
                dataRepositoryMode: canonical ? 'canonical' : 'legacy'
            });
        },
        repositoryFactory(factoryOptions) {
            calls.factory.push(factoryOptions);
            return repository;
        },
        navigate(target) {
            calls.navigate.push(target);
        },
        errorRenderer(...args) {
            calls.errors.push(args);
        }
    };
    return { calls, options, repository };
}

const routingCases = [
    ['Swim', 'swim.html'],
    ['OpenWaterSwim', 'swim.html'],
    ['Run', 'run.html'],
    ['TrailRun', 'run.html'],
    ['VirtualRun', 'run.html'],
    ['Ride', 'bike.html'],
    ['MountainBike', 'bike.html'],
    ['GravelRide', 'bike.html'],
    ['Workout', 'activity.html'],
    [null, 'activity.html']
];

for (const [sportType, page] of routingCases) {
    test(`Router preserves existing ${String(sportType)} routing`, async () => {
        const activityId = `route-${String(sportType)}`;
        const summary = sportType === null
            ? { id: activityId }
            : { id: activityId, sport_type: sportType };
        const { calls, options } = createRouterHarness({
            activityId,
            activities: [summary]
        });

        assert.equal(await routeActivity(options), true);
        assert.deepEqual(calls.navigate, [`${page}?id=${encodeURIComponent(activityId)}`]);
        assert.equal(calls.errors.length, 0);
    });
}

test('Router uses Generic fallback when no summary matches', async () => {
    const { calls, options } = createRouterHarness({
        activityId: 'missing-summary',
        activities: [{ id: 'another-activity', sport_type: 'Swim' }]
    });
    assert.equal(await routeActivity(options), true);
    assert.deepEqual(calls.navigate, ['activity.html?id=missing-summary']);
});

test('opaque 000123 stays distinct from numeric summary 123', async () => {
    const activityId = '000123';
    const activities = [
        { id: 123, sport_type: 'Swim' },
        { id: activityId, sport_type: 'Run' }
    ];
    assert.deepEqual(findActivitySummary(activities, activityId), {
        id: activityId,
        sportType: 'Run'
    });

    const { calls, options } = createRouterHarness({ activityId, activities });
    assert.equal(await routeActivity(options), true);
    assert.deepEqual(calls.navigate, ['run.html?id=000123']);
});

test('non-numeric and URL-special opaque IDs route without conversion', async () => {
    const activityId = 'alpha-beta/activity ?#%';
    const { calls, options } = createRouterHarness({
        activityId,
        activities: [{ id: activityId, type: 'Ride' }]
    });
    assert.equal(await routeActivity(options), true);
    assert.deepEqual(calls.navigate, [
        `bike.html?id=${encodeURIComponent(activityId)}`
    ]);
});

for (const search of ['', '?other=value', '?id=', '?id=%20%20%20']) {
    test(`Router rejects missing or blank ID from ${search || 'empty search'}`, async () => {
        const { calls, options } = createRouterHarness();
        options.search = search;
        assert.equal(await routeActivity(options), false);
        assert.equal(calls.demoMode, 0);
        assert.equal(calls.factory.length, 0);
        assert.equal(calls.listActivities.length, 0);
        assert.equal(calls.navigate.length, 0);
        assert.deepEqual(calls.errors, [[]]);
    });
}

test('Router freezes mode, flag, Factory, and list lookup exactly once', async t => {
    for (const scenario of [
        { name: 'real legacy', demo: false, canonical: false, mode: 'legacy' },
        { name: 'real canonical', demo: false, canonical: true, mode: 'canonical' },
        { name: 'demo ignores canonical', demo: true, canonical: true, mode: 'legacy' }
    ]) {
        await t.test(scenario.name, async () => {
            const { calls, options } = createRouterHarness(scenario);
            assert.equal(await routeActivity(options), true);
            assert.equal(calls.demoMode, 1);
            assert.equal(calls.featureFlags, scenario.demo ? 0 : 1);
            assert.deepEqual(calls.factory, [{
                sessionMode: scenario.demo ? 'demo' : 'real',
                mode: scenario.mode
            }]);
            assert.deepEqual(calls.listActivities, [{ refresh: false }]);
            assert.equal(calls.getActivity, 0);
            assert.equal(calls.getStreams, 0);
        });
    }
});

test('Demo Router performs zero real connector, Token, cache, or platform I/O', async () => {
    const guardedNames = [
        'fetch',
        'localStorage',
        'btoa',
        'indexedDB'
    ];
    const originals = new Map(guardedNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    let forbiddenAccesses = 0;
    const { calls, options } = createRouterHarness({ demo: true });

    try {
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    forbiddenAccesses += 1;
                    throw new Error('synthetic forbidden platform access');
                }
            });
        }
        assert.equal(await routeActivity(options), true);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }

    assert.equal(forbiddenAccesses, 0);
    assert.equal(calls.demoMode, 1);
    assert.equal(calls.featureFlags, 0);
    assert.deepEqual(calls.factory, [{ sessionMode: 'demo', mode: 'legacy' }]);
    assert.deepEqual(calls.listActivities, [{ refresh: false }]);
});

test('Router failure sends no raw error or secret to UI or navigation', async () => {
    const secret = 'synthetic-private-provider-message';
    const { calls, options } = createRouterHarness({
        listError: new Error(secret)
    });
    assert.equal(await routeActivity(options), false);
    assert.deepEqual(calls.errors, [[]]);
    assert.deepEqual(calls.navigate, []);
    assert.doesNotMatch(JSON.stringify(calls), new RegExp(secret));
});

test('malformed, accessor, and Proxy summaries fail closed without getters', async () => {
    let getterCalls = 0;
    const accessorSummary = { sport_type: 'Swim' };
    Object.defineProperty(accessorSummary, 'id', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'target';
        }
    });
    const revoked = Proxy.revocable({ id: 'target', sport_type: 'Swim' }, {});
    revoked.revoke();
    const { calls, options } = createRouterHarness({
        activityId: 'target',
        activities: [accessorSummary, revoked.proxy, null, { id: {} }]
    });

    assert.equal(await routeActivity(options), true);
    assert.equal(getterCalls, 0);
    assert.deepEqual(calls.navigate, ['activity.html?id=target']);
});

test('accessor activity-list slots fail closed with safe error UI', async () => {
    let getterCalls = 0;
    const activities = [];
    Object.defineProperty(activities, '0', {
        configurable: true,
        enumerable: true,
        get() {
            getterCalls += 1;
            return { id: 'target', sport_type: 'Run' };
        }
    });
    Object.defineProperty(activities, 'length', { value: 1 });
    const { calls, options } = createRouterHarness({
        activityId: 'target',
        activities
    });
    assert.equal(await routeActivity(options), false);
    assert.equal(getterCalls, 0);
    assert.deepEqual(calls.errors, [[]]);
});

test('safe Router error renderer preserves title, copy, and Back behavior', () => {
    class SyntheticElement {
        constructor(tagName) {
            this.tagName = tagName;
            this.children = [];
            this.style = {};
            this.listeners = new Map();
            this.textContent = '';
            this.type = '';
        }

        append(...children) {
            this.children.push(...children);
        }

        addEventListener(name, listener) {
            this.listeners.set(name, listener);
        }
    }

    const body = new SyntheticElement('body');
    body.replaceChildren = (...children) => {
        body.children = children;
    };
    const documentObject = {
        body,
        createElement(tagName) {
            return new SyntheticElement(tagName);
        }
    };
    let backCalls = 0;
    renderActivityRouterError(documentObject, {
        back() {
            backCalls += 1;
        }
    });

    const [container] = body.children;
    const [title, message, button] = container.children;
    assert.equal(title.textContent, 'Error Loading Activity');
    assert.equal(message.textContent, 'Activity details could not be loaded.');
    assert.equal(button.textContent, 'Go Back');
    button.listeners.get('click')();
    assert.equal(backCalls, 1);
});

test('Router HTML removes direct provider code and loads the module boundary', async () => {
    const html = await readFile(
        new URL('html/activity-router.html', projectRoot),
        'utf8'
    );
    assert.match(html, /<title>Activity Details<\/title>/);
    assert.match(html, /Loading activity details\.\.\./);
    assert.doesNotMatch(html, /_vercel\/insights\/script\.js/);
    assert.doesNotMatch(html, /shared\/utils\/speed-insights\.js/);
    assert.match(html, /type="module" src="\.\.\/js\/pages\/activity-router\.js"/);
    for (const prohibited of [
        /parseInt|parseFloat/,
        /strava_tokens/,
        /Authorization/,
        /\/api\/strava-/,
        /\bfetch\s*\(/,
        /\bbtoa\s*\(/,
        /innerHTML/,
        /onclick=/
    ]) {
        assert.doesNotMatch(html, prohibited);
    }
});

function createSessionRepository(overrides = {}) {
    const calls = {
        activity: [],
        streams: [],
        zones: 0,
        athlete: 0
    };
    const values = {
        activity: envelope({ id: 'detail-activity' }, 'network'),
        streams: envelope({ distance: { data: [0, 1] } }, 'network'),
        zones: envelope({ heart_rate: { zones: [] } }, 'cache'),
        athlete: envelope({ id: 'synthetic-athlete' }, 'cache')
    };
    const repository = {
        async getActivity(id) {
            calls.activity.push(id);
            return values.activity;
        },
        async getStreams(id, options) {
            calls.streams.push({ id, options });
            return values.streams;
        },
        async getZones() {
            calls.zones += 1;
            return values.zones;
        },
        async getAthlete() {
            calls.athlete += 1;
            return values.athlete;
        },
        ...overrides
    };
    return { repository, calls, values };
}

test('DetailReadSession exposes only load and preserves exact bundle envelopes', async () => {
    const { repository, calls, values } = createSessionRepository();
    const streamTypes = ['distance', 'time', 'heartrate'];
    const session = createDetailReadSession({
        repository,
        activityId: '000-detail-id',
        streamTypes,
        includeZones: true,
        includeAthlete: true
    });
    assert.deepEqual(Object.keys(session), ['load']);
    assert.equal(Object.isFrozen(session), true);

    const bundle = await session.load();
    assert.deepEqual(bundle, {
        activity: values.activity,
        streams: values.streams,
        zones: values.zones,
        athlete: values.athlete
    });
    assert.equal(bundle.activity, values.activity);
    assert.equal(bundle.streams, values.streams);
    assert.equal(bundle.zones, values.zones);
    assert.equal(bundle.athlete, values.athlete);
    assert.deepEqual(calls.activity, ['000-detail-id']);
    assert.equal(calls.streams.length, 1);
    assert.equal(calls.streams[0].id, '000-detail-id');
    assert.deepEqual(calls.streams[0].options.types, streamTypes);
    assert.notEqual(calls.streams[0].options.types, streamTypes);
    assert.deepEqual(streamTypes, ['distance', 'time', 'heartrate']);
    assert.equal(calls.zones, 1);
    assert.equal(calls.athlete, 1);
});

test('DetailReadSession returns the identical Promise across concurrency and fulfillment', async () => {
    const { repository, calls } = createSessionRepository();
    const session = createDetailReadSession({
        repository,
        activityId: 'concurrent-id',
        streamTypes: ['distance']
    });
    const first = session.load();
    const second = session.load();
    const third = session.load();
    assert.equal(first, second);
    assert.equal(second, third);
    await Promise.all([first, second, third]);
    assert.equal(session.load(), first);
    assert.deepEqual(calls.activity, ['concurrent-id']);
    assert.equal(calls.streams.length, 1);
    assert.equal(calls.zones, 0);
    assert.equal(calls.athlete, 0);
});

test('required RepositoryError is preserved and rejection is permanently memoized', async () => {
    const requiredError = new RepositoryError(
        REPOSITORY_ERROR_CODE.NETWORK_UNAVAILABLE,
        { operation: 'getActivity', retryable: true }
    );
    const calls = { activity: 0, streams: 0 };
    const repository = {
        async getActivity() {
            calls.activity += 1;
            throw requiredError;
        },
        async getStreams() {
            calls.streams += 1;
            return envelope({});
        }
    };
    const session = createDetailReadSession({
        repository,
        activityId: 'required-failure',
        streamTypes: ['time']
    });
    const first = session.load();
    const second = session.load();
    assert.equal(first, second);
    await assert.rejects(first, error => error === requiredError);
    assert.equal(session.load(), first);
    await assert.rejects(session.load(), error => error === requiredError);
    assert.deepEqual(calls, { activity: 1, streams: 1 });
    assert.doesNotMatch(JSON.stringify(requiredError), /cause|payload|private/);
});

test('streams failure is fatal and never becomes a partial bundle', async () => {
    const requiredError = new RepositoryError(
        REPOSITORY_ERROR_CODE.RESPONSE_INVALID,
        { operation: 'getStreams' }
    );
    const { repository, calls } = createSessionRepository({
        async getStreams(id, options) {
            calls.streams.push({ id, options });
            throw requiredError;
        }
    });
    const session = createDetailReadSession({
        repository,
        activityId: 'stream-failure',
        streamTypes: ['time']
    });
    await assert.rejects(session.load(), error => error === requiredError);
    assert.equal(calls.activity.length, 1);
    assert.equal(calls.streams.length, 1);
});

test('optional RepositoryErrors become null while required envelopes remain intact', async () => {
    const optionalError = operation => new RepositoryError(
        REPOSITORY_ERROR_CODE.NETWORK_UNAVAILABLE,
        { operation, retryable: true }
    );
    const { repository, calls, values } = createSessionRepository({
        async getZones() {
            calls.zones += 1;
            throw optionalError('getZones');
        },
        async getAthlete() {
            calls.athlete += 1;
            throw optionalError('getAthlete');
        }
    });
    const session = createDetailReadSession({
        repository,
        activityId: 'optional-failure',
        streamTypes: ['distance'],
        includeZones: true,
        includeAthlete: true
    });
    const bundle = await session.load();
    assert.equal(bundle.activity, values.activity);
    assert.equal(bundle.streams, values.streams);
    assert.equal(bundle.zones, null);
    assert.equal(bundle.athlete, null);
    assert.equal(calls.zones, 1);
    assert.equal(calls.athlete, 1);
});

test('unexpected optional error rejects the stable bundle Promise', async () => {
    const unexpected = new Error('synthetic unexpected optional failure');
    const { repository, calls } = createSessionRepository({
        async getZones() {
            calls.zones += 1;
            throw unexpected;
        }
    });
    const session = createDetailReadSession({
        repository,
        activityId: 'unexpected-optional',
        streamTypes: ['time'],
        includeZones: true
    });
    const promise = session.load();
    await assert.rejects(promise, error => error === unexpected);
    assert.equal(session.load(), promise);
    assert.equal(calls.zones, 1);
});

test('DetailReadSession rejects unsafe configuration without executing accessors', () => {
    const { repository } = createSessionRepository();
    let getterCalls = 0;
    const accessorOptions = {
        repository,
        activityId: 'safe-id',
        streamTypes: ['time']
    };
    Object.defineProperty(accessorOptions, 'activityId', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'unsafe-id';
        }
    });
    assert.throws(() => createDetailReadSession(accessorOptions), TypeError);
    assert.equal(getterCalls, 0);

    const withExtra = {
        repository,
        activityId: 'safe-id',
        streamTypes: ['time'],
        extra: true
    };
    assert.throws(() => createDetailReadSession(withExtra), TypeError);

    const symbolOptions = {
        repository,
        activityId: 'safe-id',
        streamTypes: ['time'],
        [Symbol('extra')]: true
    };
    assert.throws(() => createDetailReadSession(symbolOptions), TypeError);

    const customPrototype = Object.create({ inherited: true });
    Object.assign(customPrototype, {
        repository,
        activityId: 'safe-id',
        streamTypes: ['time']
    });
    assert.throws(() => createDetailReadSession(customPrototype), TypeError);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.throws(() => createDetailReadSession(revoked.proxy), TypeError);
});

test('DetailReadSession rejects sparse, accessor, custom, and reflective stream arrays safely', () => {
    const { repository } = createSessionRepository();
    const create = streamTypes => createDetailReadSession({
        repository,
        activityId: 'safe-id',
        streamTypes
    });

    const sparse = new Array(2);
    sparse[1] = 'time';
    assert.throws(() => create(sparse), TypeError);

    let getterCalls = 0;
    const accessor = ['time'];
    Object.defineProperty(accessor, '0', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'distance';
        }
    });
    assert.throws(() => create(accessor), TypeError);
    assert.equal(getterCalls, 0);

    const extra = ['time'];
    Object.defineProperty(extra, 'forEach', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return () => {};
        }
    });
    assert.throws(() => create(extra), TypeError);
    assert.equal(getterCalls, 0);

    const customPrototype = ['time'];
    Object.setPrototypeOf(customPrototype, Object.create(Array.prototype));
    assert.throws(() => create(customPrototype), TypeError);

    const revoked = Proxy.revocable(['time'], {});
    revoked.revoke();
    assert.throws(() => create(revoked.proxy), TypeError);
});

test('activity detail page classifier is deterministic and source-neutral', () => {
    assert.equal(activityDetailPage('Swim'), 'swim.html');
    assert.equal(activityDetailPage('TrailRun'), 'run.html');
    assert.equal(activityDetailPage('MountainBikeRide'), 'bike.html');
    assert.equal(activityDetailPage('NordicSki'), 'activity.html');
    assert.equal(activityDetailPage({ private: true }), 'activity.html');
});

const detailPageCases = [
    {
        name: 'Generic',
        initialize: initializeActivityPage,
        streamTypes: ACTIVITY_STREAM_TYPES,
        includeZones: true,
        includeAthlete: false
    },
    {
        name: 'Run',
        initialize: initializeRunPage,
        streamTypes: RUN_STREAM_TYPES,
        includeZones: true,
        includeAthlete: false
    },
    {
        name: 'Bike',
        initialize: initializeBikePage,
        streamTypes: BIKE_STREAM_TYPES,
        includeZones: true,
        includeAthlete: false
    },
    {
        name: 'Swim',
        initialize: initializeSwimPage,
        streamTypes: SWIM_STREAM_TYPES,
        includeZones: true,
        includeAthlete: true
    }
];

function createDetailPageHarness({
    demo = false,
    canonical = false,
    bundleOverride
} = {}) {
    const calls = {
        mode: 0,
        featureFlags: 0,
        factory: [],
        session: [],
        load: 0,
        render: [],
        error: []
    };
    const repository = Object.freeze({ synthetic: true });
    const source = demo ? 'demo' : canonical ? 'canonical' : 'network';
    const bundle = bundleOverride ?? {
        activity: envelope({ id: 'synthetic-detail', laps: [] }, source),
        streams: envelope({}, source),
        zones: envelope({ heart_rate: { zones: [] } }, source),
        athlete: envelope({ id: 'synthetic-athlete' }, source)
    };
    return {
        calls,
        options: {
            demoModeReader() {
                calls.mode += 1;
                return demo;
            },
            featureFlagsReader() {
                calls.featureFlags += 1;
                return Object.freeze({
                    dataRepositoryMode: canonical ? 'canonical' : 'legacy'
                });
            },
            repositoryFactory(options) {
                calls.factory.push(options);
                return repository;
            },
            sessionFactory(options) {
                calls.session.push(options);
                return {
                    async load() {
                        calls.load += 1;
                        return bundle;
                    }
                };
            },
            async renderer(input) {
                calls.render.push(input);
            },
            errorRenderer(...args) {
                calls.error.push(args);
            }
        },
        repository
    };
}

function createExactDetailBundle() {
    return {
        activity: envelope({ id: 'exact-detail', laps: [] }, 'network'),
        streams: envelope({ distance: { data: [0, 1] } }, 'network'),
        zones: envelope({ heart_rate: { zones: [] } }, 'cache'),
        athlete: envelope({ id: 'exact-athlete' }, 'cache')
    };
}

async function assertRejectedDetailBundle(page, bundle, secret = null) {
    const { calls, options } = createDetailPageHarness({ bundleOverride: bundle });
    options.search = '?id=descriptor-failure';
    assert.equal(await page.initialize(options), false);
    assert.equal(calls.load, 1);
    assert.equal(calls.render.length, 0);
    assert.deepEqual(calls.error, [[]]);
    if (secret !== null) {
        assert.doesNotMatch(JSON.stringify(calls.error), new RegExp(secret));
    }
}

for (const page of detailPageCases) {
    test(`${page.name} composition freezes mode, flag, Factory, session, load, and render once`, async t => {
        for (const scenario of [
            { name: 'real legacy', demo: false, canonical: false, mode: 'legacy' },
            { name: 'real canonical', demo: false, canonical: true, mode: 'canonical' },
            { name: 'demo ignores canonical', demo: true, canonical: true, mode: 'legacy' }
        ]) {
            await t.test(scenario.name, async () => {
                const { calls, options, repository } = createDetailPageHarness(scenario);
                options.search = '?id=000123';
                assert.equal(await page.initialize(options), true);
                assert.equal(calls.mode, 1);
                assert.equal(calls.featureFlags, scenario.demo ? 0 : 1);
                assert.deepEqual(calls.factory, [{
                    sessionMode: scenario.demo ? 'demo' : 'real',
                    mode: scenario.mode
                }]);
                assert.equal(calls.session.length, 1);
                assert.equal(calls.session[0].repository, repository);
                assert.equal(calls.session[0].activityId, '000123');
                assert.deepEqual(calls.session[0].streamTypes, page.streamTypes);
                assert.equal(calls.session[0].includeZones, page.includeZones);
                assert.equal(calls.session[0].includeAthlete, page.includeAthlete);
                assert.equal(calls.load, 1);
                assert.equal(calls.render.length, 1);
                assert.equal(calls.render[0].activityId, '000123');
                assert.equal(
                    calls.render[0].activitySource,
                    scenario.demo ? 'demo' : scenario.canonical ? 'canonical' : 'network'
                );
                assert.equal(calls.render[0].weatherFeatureEnabled, !scenario.demo);
                assert.equal(calls.error.length, 0);
            });
        }
    });

    test(`${page.name} preserves opaque nonnumeric and URL-special IDs`, async t => {
        for (const activityId of ['opaque-id', 'alpha/beta ?#%']) {
            await t.test(activityId, async () => {
                const { calls, options } = createDetailPageHarness();
                options.search = `?id=${encodeURIComponent(activityId)}`;
                assert.equal(await page.initialize(options), true);
                assert.equal(calls.session[0].activityId, activityId);
                assert.equal(calls.render[0].activityId, activityId);
            });
        }
    });

    test(`${page.name} rejects missing and blank IDs before side effects`, async t => {
        for (const search of ['', '?id=', '?id=%20%20']) {
            await t.test(search || 'empty', async () => {
                const { calls, options } = createDetailPageHarness();
                options.search = search;
                assert.equal(await page.initialize(options), false);
                assert.equal(calls.mode, 0);
                assert.equal(calls.featureFlags, 0);
                assert.equal(calls.factory.length, 0);
                assert.equal(calls.session.length, 0);
                assert.equal(calls.load, 0);
                assert.equal(calls.render.length, 0);
                assert.deepEqual(calls.error, [[]]);
            });
        }
    });
}

test('Router and four detail roots fail closed for unsafe Real feature flags', async () => {
    let getterCalls = 0;
    const unsafe = {};
    Object.defineProperty(unsafe, 'dataRepositoryMode', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'canonical';
        }
    });
    const router = createRouterHarness();
    router.options.featureFlagsReader = () => unsafe;
    assert.equal(await routeActivity(router.options), false);
    assert.equal(router.calls.factory.length, 0);

    for (const page of detailPageCases) {
        const harness = createDetailPageHarness();
        harness.options.search = '?id=unsafe-flags';
        harness.options.featureFlagsReader = () => unsafe;
        assert.equal(await page.initialize(harness.options), false);
        assert.equal(harness.calls.factory.length, 0);
    }
    assert.equal(getterCalls, 0);
});

test('required malformed detail envelopes fail once with no raw error disclosure or retry', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async () => {
            const secret = 'synthetic-private-provider-message';
            const { calls, options } = createDetailPageHarness({
                bundleOverride: {
                    activity: { data: null, message: secret },
                    streams: envelope({}),
                    zones: null,
                    athlete: null
                }
            });
            options.search = '?id=required-failure';
            assert.equal(await page.initialize(options), false);
            assert.equal(calls.load, 1);
            assert.equal(calls.render.length, 0);
            assert.deepEqual(calls.error, [[]]);
            assert.doesNotMatch(JSON.stringify(calls.error), new RegExp(secret));
        });
    }
});

test('optional null metadata remains null and does not prevent rendering', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async () => {
            const { calls, options } = createDetailPageHarness({
                bundleOverride: {
                    activity: envelope({ id: 'optional-null' }),
                    streams: envelope({}),
                    zones: null,
                    athlete: null
                }
            });
            options.search = '?id=optional-null';
            assert.equal(await page.initialize(options), true);
            assert.equal(calls.render.length, 1);
            assert.equal(calls.render[0].zones, null);
            assert.equal(calls.render[0].athlete, null);
            assert.equal(calls.error.length, 0);
        });
    }
});

test('optional Repository success envelopes may carry canonical null data', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async () => {
            const { calls, options } = createDetailPageHarness({
                bundleOverride: {
                    activity: envelope({ id: 'optional-envelope-null' }, 'canonical'),
                    streams: envelope({}, 'canonical'),
                    zones: envelope(null, 'canonical'),
                    athlete: envelope(null, 'canonical')
                }
            });
            options.search = '?id=optional-envelope-null';
            assert.equal(await page.initialize(options), true);
            assert.equal(calls.render.length, 1);
            assert.equal(calls.render[0].zones, null);
            assert.equal(calls.render[0].athlete, null);
            assert.equal(calls.error.length, 0);
        });
    }
});

test('all detail pages reject incomplete and malformed success envelopes', async t => {
    const cases = [
        ['data-only envelope', () => ({ data: {} })],
        ['extra envelope field', () => ({ ...envelope({}), extra: true })],
        ['invalid source', () => ({ ...envelope({}), source: 'synthetic-invalid-source' })],
        ['non-boolean partial', () => ({ ...envelope({}), partial: 0 })],
        ['non-array warnings', () => ({ ...envelope({}), warnings: {} })]
    ];
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            for (const [name, createMalformed] of cases) {
                await t.test(name, async () => {
                    const bundle = createExactDetailBundle();
                    bundle.activity = createMalformed();
                    await assertRejectedDetailBundle(page, bundle);
                });
            }
        });
    }
});

test('warnings arrays must be native, dense, descriptor-safe, and key-exact', async t => {
    const cases = [
        ['sparse', () => new Array(1)],
        ['custom prototype', () => Object.setPrototypeOf([], Object.create(Array.prototype))],
        ['subclass', () => new (class SyntheticWarnings extends Array {})()],
        ['extra string key', () => {
            const warnings = [];
            warnings.extra = true;
            return warnings;
        }],
        ['extra symbol key', () => {
            const warnings = [];
            warnings[Symbol('extra')] = true;
            return warnings;
        }]
    ];
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            for (const [name, createWarnings] of cases) {
                await t.test(name, async () => {
                    const bundle = createExactDetailBundle();
                    bundle.activity = {
                        ...envelope({}),
                        warnings: createWarnings()
                    };
                    await assertRejectedDetailBundle(page, bundle);
                });
            }

            await t.test('accessor element', async () => {
                let getterCalls = 0;
                const warnings = [];
                Object.defineProperty(warnings, '0', {
                    enumerable: true,
                    get() {
                        getterCalls += 1;
                        return { code: 'synthetic' };
                    }
                });
                const bundle = createExactDetailBundle();
                bundle.activity = { ...envelope({}), warnings };
                await assertRejectedDetailBundle(page, bundle);
                assert.equal(getterCalls, 0);
            });
        });
    }
});

test('bundle and envelope accessors are rejected without getter execution', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            await t.test('bundle activity accessor', async () => {
                let getterCalls = 0;
                const bundle = createExactDetailBundle();
                delete bundle.activity;
                Object.defineProperty(bundle, 'activity', {
                    enumerable: true,
                    get() {
                        getterCalls += 1;
                        return envelope({});
                    }
                });
                await assertRejectedDetailBundle(page, bundle);
                assert.equal(getterCalls, 0);
            });

            await t.test('envelope data accessor', async () => {
                let getterCalls = 0;
                const activityEnvelope = envelope({});
                delete activityEnvelope.data;
                Object.defineProperty(activityEnvelope, 'data', {
                    enumerable: true,
                    get() {
                        getterCalls += 1;
                        return {};
                    }
                });
                const bundle = createExactDetailBundle();
                bundle.activity = activityEnvelope;
                await assertRejectedDetailBundle(page, bundle);
                assert.equal(getterCalls, 0);
            });
        });
    }
});

test('bundle exact-key and ordinary-object contract rejects reflective shape changes', async t => {
    const cases = [
        ['extra field', () => ({ ...createExactDetailBundle(), extra: true })],
        ['symbol field', () => {
            const bundle = createExactDetailBundle();
            bundle[Symbol('extra')] = true;
            return bundle;
        }],
        ['custom prototype', () => Object.assign(
            Object.create({ inherited: true }),
            createExactDetailBundle()
        )],
        ['non-enumerable activity', () => {
            const bundle = createExactDetailBundle();
            Object.defineProperty(bundle, 'activity', {
                value: bundle.activity,
                enumerable: false
            });
            return bundle;
        }]
    ];
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            for (const [name, createBundle] of cases) {
                await t.test(name, async () => {
                    await assertRejectedDetailBundle(page, createBundle());
                });
            }
        });
    }
});

test('revoked and throwing bundle/envelope Proxies fail closed without secret propagation', async t => {
    const secret = 'synthetic-descriptor-proxy-secret';
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            await t.test('revoked bundle', async () => {
                const revoked = Proxy.revocable(createExactDetailBundle(), {});
                revoked.revoke();
                await assertRejectedDetailBundle(page, revoked.proxy, secret);
            });
            await t.test('throwing bundle', async () => {
                const throwing = new Proxy(createExactDetailBundle(), {
                    getPrototypeOf() {
                        throw new Error(secret);
                    }
                });
                await assertRejectedDetailBundle(page, throwing, secret);
            });
            await t.test('revoked envelope', async () => {
                const revoked = Proxy.revocable(envelope({}), {});
                revoked.revoke();
                const bundle = createExactDetailBundle();
                bundle.activity = revoked.proxy;
                await assertRejectedDetailBundle(page, bundle, secret);
            });
            await t.test('throwing envelope', async () => {
                const bundle = createExactDetailBundle();
                bundle.activity = new Proxy(envelope({}), {
                    ownKeys() {
                        throw new Error(secret);
                    }
                });
                await assertRejectedDetailBundle(page, bundle, secret);
            });
        });
    }
});

test('malformed optional envelopes are fatal while literal null remains successful', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async t => {
            for (const optionalKey of ['zones', 'athlete']) {
                await t.test(`malformed ${optionalKey}`, async () => {
                    const bundle = createExactDetailBundle();
                    bundle[optionalKey] = { data: {} };
                    await assertRejectedDetailBundle(page, bundle);
                });
            }
            await t.test('literal null metadata', async () => {
                const bundle = createExactDetailBundle();
                bundle.zones = null;
                bundle.athlete = null;
                const { calls, options } = createDetailPageHarness({ bundleOverride: bundle });
                options.search = '?id=literal-null';
                assert.equal(await page.initialize(options), true);
                assert.equal(calls.load, 1);
                assert.equal(calls.render.length, 1);
                assert.equal(calls.render[0].zones, null);
                assert.equal(calls.render[0].athlete, null);
                assert.equal(calls.error.length, 0);
            });
        });
    }
});

test('exact success envelopes preserve payload references and warning order without mutation', async t => {
    for (const page of detailPageCases) {
        await t.test(page.name, async () => {
            const bundle = createExactDetailBundle();
            const firstWarning = { code: 'SYNTHETIC_FIRST' };
            const secondWarning = { code: 'SYNTHETIC_SECOND' };
            bundle.activity.warnings.push(firstWarning, secondWarning);
            const activityEnvelope = bundle.activity;
            const activityData = activityEnvelope.data;
            const streamsData = bundle.streams.data;
            const warnings = activityEnvelope.warnings;
            const { calls, options } = createDetailPageHarness({ bundleOverride: bundle });
            options.search = '?id=exact-success';
            assert.equal(await page.initialize(options), true);
            assert.equal(calls.load, 1);
            assert.equal(calls.render.length, 1);
            assert.equal(calls.render[0].activity, activityData);
            assert.equal(calls.render[0].streams, streamsData);
            assert.equal(bundle.activity, activityEnvelope);
            assert.equal(bundle.activity.data, activityData);
            assert.equal(bundle.activity.warnings, warnings);
            assert.deepEqual(bundle.activity.warnings, [firstWarning, secondWarning]);
            assert.equal(calls.error.length, 0);
        });
    }
});

test('detail composition preserves deterministic capability-degradation fixtures', async t => {
    const fullStreams = {
        distance: { data: [0, 100] },
        time: { data: [0, 60] },
        heartrate: { data: [120, 130] },
        latlng: { data: [[0, 0], [0, 1]] },
        watts: { data: [100, 120] },
        cadence: { data: [80, 82] }
    };
    const fixtures = [
        ['full data', { laps: [{ distance: 100 }] }, fullStreams, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['empty streams', { laps: [] }, {}, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['missing HR', { laps: [] }, { ...fullStreams, heartrate: undefined }, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['missing GPS', { laps: [] }, { ...fullStreams, latlng: undefined }, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['missing power', { laps: [] }, { ...fullStreams, watts: undefined }, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['missing cadence', { laps: [] }, { ...fullStreams, cadence: undefined }, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['missing laps', {}, fullStreams, envelope({ heart_rate: { zones: [] } }), envelope({ id: 'athlete' })],
        ['zones missing', { laps: [] }, fullStreams, null, envelope({ id: 'athlete' })],
        ['athlete missing', { laps: [] }, fullStreams, envelope({ heart_rate: { zones: [] } }), null]
    ];
    for (const [name, activityFields, streams, zones, athlete] of fixtures) {
        await t.test(name, async () => {
            const activity = { id: `fixture-${name}`, ...activityFields };
            const { calls, options } = createDetailPageHarness({
                bundleOverride: {
                    activity: envelope(activity),
                    streams: envelope(streams),
                    zones,
                    athlete
                }
            });
            options.search = `?id=${encodeURIComponent(activity.id)}`;
            assert.equal(await initializeActivityPage(options), true);
            assert.equal(calls.render.length, 1);
            assert.equal(calls.render[0].activity, activity);
            assert.equal(calls.render[0].streams, streams);
            assert.equal(calls.render[0].zones, zones?.data ?? null);
            assert.equal(calls.render[0].athlete, athlete?.data ?? null);
        });
    }
});

test('Demo detail pages use the public Factory without Real provider or platform I/O', async t => {
    const demoActivity = {
        id: 'demo-detail',
        sport_type: 'Swim',
        streams: Object.fromEntries(
            [...new Set(detailPageCases.flatMap(page => page.streamTypes))]
                .map(type => [type, { data: [] }])
        )
    };
    const entries = new Map([
        ['strava_demo_activities', JSON.stringify([demoActivity])],
        ['strava_demo_training_zones', JSON.stringify({ heart_rate: { zones: [] } })],
        ['strava_demo_athlete_data', JSON.stringify({ id: 'demo-athlete' })],
        ['strava_demo_gears', '[]']
    ]);
    const realSentinels = new Map([
        ['strava_tokens', 'real-token-sentinel'],
        ['strava_activities_cache', 'real-cache-sentinel'],
        ['strava_training_zones', 'real-zone-sentinel'],
        ['strava_athlete_data', 'real-athlete-sentinel']
    ]);
    const storageCalls = [];
    const storage = {
        getItem(key) {
            storageCalls.push(['get', key]);
            if (realSentinels.has(key)) throw new Error('Real storage key accessed');
            return entries.get(key) ?? null;
        },
        setItem(key, value) {
            storageCalls.push(['set', key]);
            if (realSentinels.has(key)) throw new Error('Real storage key written');
            entries.set(key, String(value));
        },
        removeItem(key) {
            storageCalls.push(['remove', key]);
            if (realSentinels.has(key)) throw new Error('Real storage key removed');
            entries.delete(key);
        }
    };
    const guardedNames = ['fetch', 'btoa', 'indexedDB'];
    const originals = new Map([
        ['localStorage', Object.getOwnPropertyDescriptor(globalThis, 'localStorage')],
        ...guardedNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
    ]);
    let forbiddenPlatformAccesses = 0;
    try {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: storage
        });
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    forbiddenPlatformAccesses += 1;
                    throw new Error('Forbidden Demo platform access');
                }
            });
        }
        for (const page of detailPageCases) {
            await t.test(page.name, async () => {
                const rendered = [];
                const errors = [];
                assert.equal(await page.initialize({
                    search: '?id=demo-detail',
                    demoModeReader: () => true,
                    renderer: input => rendered.push(input),
                    errorRenderer: (...args) => errors.push(args)
                }), true);
                assert.equal(rendered.length, 1);
                assert.equal(rendered[0].weatherFeatureEnabled, false);
                assert.equal(errors.length, 0);
            });
        }
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(forbiddenPlatformAccesses, 0);
    assert.equal(storageCalls.some(([, key]) => realSentinels.has(key)), false);
    assert.deepEqual(realSentinels, new Map([
        ['strava_tokens', 'real-token-sentinel'],
        ['strava_activities_cache', 'real-cache-sentinel'],
        ['strava_training_zones', 'real-zone-sentinel'],
        ['strava_athlete_data', 'real-athlete-sentinel']
    ]));
});

test('Advanced Analysis reuses injected activity and streams across repeated analysis', async () => {
    const activity = Object.freeze({ id: 'advanced-id', name: 'Synthetic Activity' });
    const streams = Object.freeze({ time: Object.freeze({ data: Object.freeze([0, 1]) }) });
    const calls = [];
    const analyzer = new AdvancedActivityAnalyzer(
        'advanced-id',
        activity,
        streams,
        async (...args) => {
            calls.push(args);
            return { insights: [], climbs: [], segments: {} };
        }
    );
    const guardedNames = ['fetch', 'localStorage', 'btoa', 'indexedDB'];
    const originals = new Map(guardedNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    let forbiddenAccesses = 0;
    try {
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    forbiddenAccesses += 1;
                    throw new Error('Advanced provider I/O is forbidden');
                }
            });
        }
        await analyzer.analyze('normal');
        await analyzer.analyze('advanced');
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(call => call.slice(0, 3)), [
        ['advanced-id', activity, streams],
        ['advanced-id', activity, streams]
    ]);
    assert.deepEqual(calls.map(call => call[4]), ['normal', 'advanced']);
    assert.notEqual(calls[0][1], activity);
    assert.notEqual(calls[0][2], streams);
    assert.equal(forbiddenAccesses, 0);
});

test('two Advanced button clicks rerun local UI analysis with zero provider or Repository I/O', async () => {
    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const guardedNames = ['fetch', 'localStorage', 'btoa', 'indexedDB'];
    const originals = new Map(guardedNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const listeners = new Map();
    const button = {
        disabled: false,
        textContent: 'Analyze',
        addEventListener(name, listener) {
            listeners.set(name, listener);
        }
    };
    const mode = { value: 'normal' };
    const container = { style: {} };
    const loading = { style: {} };
    const content = { innerHTML: '' };
    const elements = new Map([
        ['advanced-analysis-btn', button],
        ['analysis-mode', mode],
        ['analysis-results-container', container],
        ['analysis-loading', loading],
        ['analysis-content', content]
    ]);
    let analyzerFactoryCalls = 0;
    let analyzeCalls = 0;
    let repositoryCalls = 0;
    let uiCalls = 0;
    let forbiddenAccesses = 0;
    try {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { getElementById: id => elements.get(id) ?? null }
        });
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    forbiddenAccesses += 1;
                    throw new Error('Advanced provider I/O is forbidden');
                }
            });
        }
        const { initAdvancedAnalysis } = await import(
            `../../js/pages/activity/activity.js?advanced-click=${Date.now()}`
        );
        initAdvancedAnalysis(
            'advanced-click-id',
            { id: 'advanced-click-id' },
            { time: { data: [0, 1] } },
            {
                analyzerFactory() {
                    analyzerFactoryCalls += 1;
                    return {
                        async analyze() {
                            analyzeCalls += 1;
                            return { insights: [], climbs: [], segments: {} };
                        },
                        getSummary() {
                            return { title: 'Synthetic' };
                        }
                    };
                },
                uiFactory() {
                    return {
                        renderSummary() { uiCalls += 1; },
                        renderInsights() { uiCalls += 1; },
                        renderClimbs() { uiCalls += 1; },
                        renderSegments() { uiCalls += 1; },
                        renderExports() { uiCalls += 1; }
                    };
                }
            }
        );
        const click = listeners.get('click');
        assert.equal(typeof click, 'function');
        await click();
        mode.value = 'advanced';
        await click();
    } finally {
        if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
        else delete globalThis.document;
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(analyzerFactoryCalls, 2);
    assert.equal(analyzeCalls, 2);
    assert.equal(uiCalls, 10);
    assert.equal(repositoryCalls, 0);
    assert.equal(forbiddenAccesses, 0);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, '🔬 Analyze Activity');
});

test('default Advanced adapter keeps five static sections and binds exports to the current analyzer', async () => {
    class SyntheticElement {
        constructor(tagName = 'div') {
            this.tagName = tagName;
            this.children = [];
            this.dataset = {};
            this.style = {};
            this.listeners = new Map();
            this.attributes = new Map();
            this.disabled = false;
            this.textContent = '';
            this._innerHTML = '';
            this._exportButtons = [];
        }

        append(...children) {
            this.children.push(...children);
        }

        addEventListener(name, listener) {
            this.listeners.set(name, listener);
        }

        removeAttribute(name) {
            this.attributes.delete(name);
        }

        querySelectorAll(selector) {
            return selector === '.export-btn' ? this._exportButtons : [];
        }

        set innerHTML(value) {
            this._innerHTML = value;
            this.children = [];
            this._exportButtons = value.includes('class="export-btn"')
                ? ['gpx', 'csv', 'json'].map(() => {
                    const button = new SyntheticElement('button');
                    button.attributes.set('onclick', 'legacy-global-handler');
                    return button;
                })
                : [];
        }

        get innerHTML() {
            return this._innerHTML;
        }
    }

    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const guardedNames = ['fetch', 'localStorage', 'btoa', 'indexedDB'];
    const originals = new Map(guardedNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const button = new SyntheticElement('button');
    const mode = { value: 'normal' };
    const container = new SyntheticElement();
    const loading = new SyntheticElement();
    const content = new SyntheticElement();
    const elements = new Map([
        ['advanced-analysis-btn', button],
        ['analysis-mode', mode],
        ['analysis-results-container', container],
        ['analysis-loading', loading],
        ['analysis-content', content]
    ]);
    const exportCalls = [];
    let analyzeCalls = 0;
    let forbiddenAccesses = 0;
    const analyzer = {
        async analyze() {
            analyzeCalls += 1;
            return { insights: [], climbs: [], segments: {} };
        },
        getSummary() {
            return {
                sport: 'Run',
                distance: 10,
                duration: '1:00:00',
                moving_time: '59:00',
                elevation_gain: 100,
                avg_pace: { minutes: 5, seconds: 30 },
                avg_speed: 0,
                max_speed: 18,
                avg_hr: 150,
                max_hr: 175,
                insights: ['Synthetic insight']
            };
        },
        getClimbDetails() {
            return [];
        },
        getSegmentBreakdown() {
            return { distance: [], terrain: [] };
        },
        downloadExport(format) {
            exportCalls.push(format);
        }
    };

    try {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: {
                createElement: tagName => new SyntheticElement(tagName),
                getElementById: id => elements.get(id) ?? null
            }
        });
        for (const name of guardedNames) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    forbiddenAccesses += 1;
                    throw new Error('Advanced provider I/O is forbidden');
                }
            });
        }
        const { initAdvancedAnalysis } = await import(
            `../../js/pages/activity/activity.js?advanced-default=${Date.now()}`
        );
        initAdvancedAnalysis('advanced-default-id', {}, {}, {
            analyzerFactory: () => analyzer
        });
        const click = button.listeners.get('click');
        await click();

        assert.deepEqual(
            content.children.map(child => child.dataset.analysisSection),
            ['summary', 'insights', 'climbs', 'segments', 'exports']
        );
        for (const child of content.children) {
            assert.notEqual(child.innerHTML, '');
        }
        const exportSection = content.children[4];
        assert.equal(exportSection._exportButtons.length, 3);
        for (const exportButton of exportSection._exportButtons) {
            assert.equal(exportButton.attributes.has('onclick'), false);
            assert.equal(exportButton.onclick, null);
            exportButton.listeners.get('click')({ preventDefault() {} });
        }
        assert.deepEqual(exportCalls, ['gpx', 'csv', 'json']);

        mode.value = 'advanced';
        await click();
        assert.equal(content.children.length, 5);
    } finally {
        if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
        else delete globalThis.document;
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }

    assert.equal(analyzeCalls, 2);
    assert.equal(forbiddenAccesses, 0);
});

test('Swim polyline decoder renders valid routes and fails malformed input closed', async () => {
    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { getElementById: () => null }
        });
        const { decodePolyline } = await import(
            `../../js/pages/swim/swim.js?polyline=${Date.now()}`
        );
        assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
            [38.5, -120.2],
            [40.7, -120.95],
            [43.252, -126.453]
        ]);
        for (const value of [undefined, null, '', '_', '\u0000', '~~~~~~~']) {
            assert.deepEqual(decodePolyline(value), []);
        }
    } finally {
        if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
        else delete globalThis.document;
    }
});

test('real Run and Bike classifiers consume injected zones without provider storage or input mutation', async () => {
    const activity = {
        distance: 10000,
        moving_time: 3000,
        elapsed_time: 3100,
        total_elevation_gain: 120,
        average_speed: 3.333,
        average_heartrate: 150,
        suffer_score: 120,
        sport_type: 'Run',
        name: 'Synthetic Tempo'
    };
    const streams = {
        distance: { data: [0, 2500, 5000, 7500, 10000] },
        time: { data: [0, 750, 1500, 2250, 3000] },
        heartrate: { data: [120, 140, 150, 165, 175] },
        velocity_smooth: { data: [3.2, 3.3, 3.4, 3.3, 3.2] }
    };
    const zones = {
        heart_rate: {
            zones: [
                { min: 0, max: 120 },
                { min: 120, max: 140 },
                { min: 140, max: 155 },
                { min: 155, max: 170 },
                { min: 170, max: -1 }
            ]
        }
    };
    const before = structuredClone({ activity, streams, zones });
    let storageCalls = 0;
    const sandbox = {
        window: {},
        localStorage: {
            getItem() {
                storageCalls += 1;
                throw new Error('provider storage must not be read');
            },
            setItem() {
                storageCalls += 1;
                throw new Error('provider storage must not be written');
            },
            removeItem() {
                storageCalls += 1;
                throw new Error('provider storage must not be removed');
            }
        }
    };
    const outputs = {};
    for (const [fileName, globalName] of [
        ['classifyRun.js', 'classifyRun'],
        ['classifyBike.js', 'classifyBike']
    ]) {
        const script = await readFile(new URL(fileName, projectRoot), 'utf8');
        vm.runInNewContext(script, sandbox, { filename: fileName });
        const classifier = sandbox.window[globalName];
        outputs[globalName] = classifier(activity, streams, zones);
        assert.doesNotThrow(() => classifier(activity, streams, null));
        assert.doesNotThrow(() => classifier(activity, streams, { heart_rate: {} }));
        assert.equal(Array.isArray(outputs[globalName].top), true);
        assert.equal(Array.isArray(outputs[globalName].all), true);
        const scores = Array.from(outputs[globalName].all, result => result.abs);
        assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    }

    assert.deepEqual(
        JSON.parse(JSON.stringify(outputs.classifyRun.top)),
        [
            { type: 'Tempo Run', abs: 375, pct: 69.4 },
            { type: 'Long Run', abs: 95, pct: 17.6 },
            { type: 'Race', abs: 55, pct: 10.2 },
            { type: 'Easy/Recovery Run', abs: 15, pct: 2.8 }
        ]
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(outputs.classifyBike.top)),
        [{ type: 'Mountain Bike', abs: 150, pct: 115.4 }]
    );
    assert.equal(storageCalls, 0);
    assert.deepEqual({ activity, streams, zones }, before);
});

test('four renderers degrade safely on empty streams without mutating bundle payloads', async () => {
    const globalNames = ['document', 'window', 'classifyRun', 'fetch'];
    const originals = new Map(globalNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    let fetchAccesses = 0;
    let activeStats = null;
    try {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: {
                title: '',
                body: {},
                getElementById: id => id === 'activity-stats' ? activeStats : null,
                querySelector: () => null,
                querySelectorAll: () => []
            }
        });
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {}
        });
        Object.defineProperty(globalThis, 'classifyRun', {
            configurable: true,
            value: () => []
        });
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            get() {
                fetchAccesses += 1;
                throw new Error('Demo weather/provider fetch is forbidden');
            }
        });

        const cases = [
            ['activity', 'renderActivityPage', 'Run'],
            ['run', 'renderRunPage', 'Run'],
            ['bike', 'renderBikePage', 'Ride'],
            ['swim', 'renderSwimPage', 'Swim']
        ];
        for (const [directory, exportName, sportType] of cases) {
            activeStats = directory === 'swim' ? null : { innerHTML: '' };
            const module = await import(
                `../../js/pages/${directory}/${directory}.js?empty=${Date.now()}-${directory}`
            );
            const activity = {
                id: `empty-${directory}`,
                name: 'Synthetic Activity',
                sport_type: sportType,
                start_date_local: '2026-01-01T00:00:00Z',
                distance: 0,
                moving_time: 0,
                elapsed_time: 0,
                laps: [],
                splits_metric: [],
                segment_efforts: [],
                best_efforts: []
            };
            const streams = {};
            const activityBefore = structuredClone(activity);
            const streamsBefore = structuredClone(streams);
            await module[exportName]({
                activity,
                streams,
                zones: null,
                athlete: null,
                activityId: activity.id,
                weatherFeatureEnabled: false
            });
            assert.deepEqual(activity, activityBefore, directory);
            assert.deepEqual(streams, streamsBefore, directory);
            if (activeStats !== null) {
                const missingElevationActivity = {
                    ...activity,
                    id: `missing-elevation-${directory}`,
                    distance: 1000,
                    moving_time: 300,
                    elapsed_time: 300,
                    average_speed: 1000 / 300
                };
                const missingElevationBefore = structuredClone(missingElevationActivity);
                activeStats.innerHTML = '';
                await module[exportName]({
                    activity: missingElevationActivity,
                    streams,
                    zones: null,
                    athlete: null,
                    activityId: missingElevationActivity.id,
                    weatherFeatureEnabled: false
                });
                assert.doesNotMatch(activeStats.innerHTML, /\b(?:NaN|Infinity)\b/, directory);
                assert.deepEqual(missingElevationActivity, missingElevationBefore, directory);
            }
        }
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(fetchAccesses, 0);
});

test('four renderers accept canonical latlng streams without requiring provider polylines', async () => {
    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { getElementById: () => null }
        });
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {}
        });

        for (const directory of ['activity', 'run', 'bike', 'swim']) {
            const module = await import(
                `../../js/pages/${directory}/${directory}.js?canonical-route=${Date.now()}-${directory}`
            );
            const streams = {
                latlng: {
                    data: [
                        [37.7749, -122.4194],
                        [37.7754, -122.4188],
                        [37.7760, -122.4181]
                    ]
                }
            };
            const before = structuredClone(streams);
            const coords = module.getActivityRouteCoordinates({}, streams);

            assert.deepEqual(coords, streams.latlng.data, directory);
            assert.notEqual(coords, streams.latlng.data, directory);
            assert.notEqual(coords[0], streams.latlng.data[0], directory);
            assert.deepEqual(streams, before, directory);
            assert.deepEqual(
                module.getActivityRouteCoordinates({}, { latlng: { data: [[91, 0], [0, 0]] } }),
                [],
                directory
            );
            assert.deepEqual(
                module.getActivityRouteCoordinates({ map: { summary_polyline: '??' } }, {}),
                [[0, 0]],
                directory
            );
        }
    } finally {
        if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
        else delete globalThis.document;
        if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
        else delete globalThis.window;
    }
});

test('Swim keeps its existing hidden map behavior when all route inputs are absent', async () => {
    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
        const classes = new Set();
        const section = {
            classList: {
                add: value => classes.add(value),
                remove: value => classes.delete(value)
            }
        };
        const map = { innerHTML: 'synthetic-map-sentinel' };
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: {
                title: '',
                body: {},
                getElementById: id => {
                    if (id === 'activity-map') return map;
                    if (id === 'activity-map-container') return section;
                    return null;
                },
                querySelector: () => null,
                querySelectorAll: () => []
            }
        });
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { L: {} }
        });
        const module = await import(
            `../../js/pages/swim/swim.js?missing-route=${Date.now()}`
        );
        await module.renderSwimPage({
            activity: {
                id: 'missing-route',
                name: 'Synthetic Swim',
                sport_type: 'Swim',
                start_date_local: '2026-01-01T00:00:00Z',
                distance: 0,
                moving_time: 0,
                elapsed_time: 0,
                laps: [],
                splits_metric: [],
                segment_efforts: [],
                best_efforts: []
            },
            streams: {},
            zones: null,
            athlete: null,
            activityId: 'missing-route',
            activitySource: 'canonical',
            weatherFeatureEnabled: false
        });
        assert.equal(classes.has('hidden'), true);
        assert.equal(map.innerHTML, 'synthetic-map-sentinel');
    } finally {
        if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
        else delete globalThis.document;
        if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
        else delete globalThis.window;
    }
});

test('Run, Bike, and Swim hide provider links for canonical opaque IDs', async () => {
    const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const priorClassifier = Object.getOwnPropertyDescriptor(globalThis, 'classifyRun');
    try {
        for (const [directory, exportName, sportType] of [
            ['run', 'renderRunPage', 'Run'],
            ['bike', 'renderBikePage', 'Ride'],
            ['swim', 'renderSwimPage', 'Swim']
        ]) {
            const heroLink = {
                href: 'about:blank',
                hidden: false,
                removeAttribute(name) {
                    if (name === 'href') this.href = '';
                }
            };
            Object.defineProperty(globalThis, 'document', {
                configurable: true,
                value: {
                    title: '',
                    body: {},
                    getElementById: id => (
                        id === 'activity-hero-strava-link' ? heroLink : null
                    ),
                    querySelector: () => null,
                    querySelectorAll: () => []
                }
            });
            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: {}
            });
            Object.defineProperty(globalThis, 'classifyRun', {
                configurable: true,
                value: () => []
            });
            const module = await import(
                `../../js/pages/${directory}/${directory}.js?provider-link=${Date.now()}-${directory}`
            );
            const activity = {
                id: '000123/opaque ?#%',
                name: 'Synthetic Activity',
                sport_type: sportType,
                start_date_local: '2026-01-01T00:00:00Z',
                distance: 0,
                moving_time: 0,
                elapsed_time: 0,
                laps: [],
                splits_metric: [],
                segment_efforts: [],
                best_efforts: []
            };
            await module[exportName]({
                activity,
                streams: {},
                zones: null,
                athlete: null,
                activityId: activity.id,
                activitySource: 'canonical',
                weatherFeatureEnabled: false
            });
            assert.equal(heroLink.href, '', directory);
            assert.equal(heroLink.hidden, true, directory);
        }
    } finally {
        for (const [name, descriptor] of [
            ['document', priorDocument],
            ['window', priorWindow],
            ['classifyRun', priorClassifier]
        ]) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('four renderers keep minimal canonical laps free of non-finite presentation values', async () => {
    const globalNames = ['document', 'window', 'Chart'];
    const originals = new Map(globalNames.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const forbidden = /NaN|Infinity|undefined/;
    try {
        for (const directory of ['activity', 'run', 'bike', 'swim']) {
            const elements = new Map();
            for (const id of ['laps-section', 'laps-table', 'laps-chart', 'laps-chart-section']) {
                elements.set(id, {
                    id,
                    innerHTML: '',
                    classList: {
                        add() {},
                        remove() {}
                    }
                });
            }
            const chartConfigs = [];
            Object.defineProperty(globalThis, 'document', {
                configurable: true,
                value: {
                    getElementById: id => elements.get(id) || null
                }
            });
            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: {}
            });
            Object.defineProperty(globalThis, 'Chart', {
                configurable: true,
                value: class {
                    constructor(_canvas, config) {
                        chartConfigs.push(config);
                    }
                    destroy() {}
                }
            });

            const module = await import(
                `../../js/pages/${directory}/${directory}.js?minimal-laps=${Date.now()}-${directory}`
            );
            const laps = [
                { lap_index: 1, distance: 1000, moving_time: 300, average_speed: 1000 / 300 },
                { lap_index: 2 }
            ];
            module.renderLaps(laps);
            module.renderLapsChart(laps);

            assert.doesNotMatch(elements.get('laps-table').innerHTML, forbidden, directory);
            assert.equal(chartConfigs.length, 1, directory);
            const data = chartConfigs[0].data.datasets[0].data;
            assert.equal(data.length, 1, directory);
            assert.equal(data.every(Number.isFinite), true, directory);

            const callbacks = chartConfigs[0].options.plugins.tooltip.callbacks;
            for (const callbackName of ['label', 'afterLabel']) {
                if (typeof callbacks[callbackName] !== 'function') continue;
                const output = callbacks[callbackName]({ dataIndex: 0 });
                assert.doesNotMatch(JSON.stringify(output), forbidden, `${directory}:${callbackName}`);
            }
        }
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('Swim detail has no implicit athlete-specific correction', async () => {
    const source = await readFile(
        new URL('../../js/pages/swim/swim.js', import.meta.url),
        'utf8'
    );
    assert.match(source, /const activityData = structuredClone\(activity\)/);
    assert.equal(source.includes(['TARGET', 'ATHLETE', 'ID'].join('_')), false);
    assert.equal(source.includes(['maybeCorrect', 'IndoorSwim'].join('')), false);
});
