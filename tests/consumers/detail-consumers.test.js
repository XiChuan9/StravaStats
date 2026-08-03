import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
    listError = null
} = {}) {
    const calls = {
        demoMode: 0,
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

test('Router freezes mode, Factory, and list lookup exactly once', async t => {
    for (const demo of [false, true]) {
        await t.test(demo ? 'demo' : 'real', async () => {
            const { calls, options } = createRouterHarness({ demo });
            assert.equal(await routeActivity(options), true);
            assert.equal(calls.demoMode, 1);
            assert.deepEqual(calls.factory, [{
                sessionMode: demo ? 'demo' : 'real',
                mode: 'legacy'
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
    assert.match(html, /_vercel\/insights\/script\.js/);
    assert.match(html, /shared\/utils\/speed-insights\.js/);
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
