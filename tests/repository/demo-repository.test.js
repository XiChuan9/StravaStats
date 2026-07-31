import assert from 'node:assert/strict';
import test from 'node:test';

import { DemoRepository } from '../../js/repository/demo/demo-repository.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    RepositoryError
} from '../../js/repository/errors.js';

function createProvider(overrides = {}) {
    const data = {
        activities: [{
            id: 'synthetic-demo-activity',
            name: 'Synthetic demo activity'
        }],
        athlete: { id: 'synthetic-demo-athlete' },
        zones: { heartrate: [] },
        gears: [{
            id: 'synthetic-demo-gear',
            name: 'Synthetic demo shoes'
        }]
    };
    const calls = {
        activities: 0,
        athlete: 0,
        zones: 0,
        gears: 0
    };
    const provider = {
        getActivities() {
            calls.activities += 1;
            return data.activities;
        },
        getAthlete() {
            calls.athlete += 1;
            return data.athlete;
        },
        getZones() {
            calls.zones += 1;
            return data.zones;
        },
        getGears() {
            calls.gears += 1;
            return data.gears;
        },
        ...overrides
    };
    return { provider, calls, data };
}

test('DemoRepository implements all seven methods with demo envelopes', async () => {
    const { provider } = createProvider();
    const repository = new DemoRepository({ provider });
    const results = await Promise.all([
        repository.listActivities(),
        repository.getActivity('synthetic-demo-activity'),
        repository.getStreams(
            'synthetic-demo-activity',
            { types: ['time'] }
        ),
        repository.getAthlete(),
        repository.getZones(),
        repository.getGears(),
        repository.getGear('synthetic-demo-gear')
    ]);
    for (const result of results) {
        assert.equal(result.source, REPOSITORY_SOURCE.DEMO);
        assert.deepEqual(result.warnings, []);
        assert.equal(result.partial, false);
        assert.deepEqual(
            Object.keys(result).sort(),
            ['data', 'partial', 'source', 'warnings']
        );
    }
});

test('DemoRepository reports missing activities and gears as NOT_FOUND', async () => {
    const { provider } = createProvider();
    const repository = new DemoRepository({ provider });
    for (const invoke of [
        () => repository.getActivity('missing'),
        () => repository.getGear('missing'),
        () => repository.getStreams('missing', { types: ['time'] })
    ]) {
        await assert.rejects(invoke(), error => (
            error instanceof RepositoryError
            && error.code === REPOSITORY_ERROR_CODE.NOT_FOUND
        ));
    }
});

test('DemoRepository returns an empty stream object when Demo has no streams', async () => {
    const { provider } = createProvider();
    const repository = new DemoRepository({ provider });
    const input = Object.freeze({ types: Object.freeze(['time']) });
    const value = await repository.getStreams(
        'synthetic-demo-activity',
        input
    );
    assert.deepEqual(value.data, {});
    assert.deepEqual(input, { types: ['time'] });
});

test('DemoRepository selects only requested embedded stream types', async () => {
    const { provider } = createProvider({
        getActivities() {
            return [{
                id: 'synthetic-demo-activity',
                streams: {
                    time: { data: [0] },
                    heartrate: { data: [120] }
                }
            }];
        }
    });
    const repository = new DemoRepository({ provider });
    const value = await repository.getStreams(
        'synthetic-demo-activity',
        { types: ['heartrate'] }
    );
    assert.deepEqual(value.data, {
        heartrate: { data: [120] }
    });
});

test('malformed Demo payloads degrade to empty or null without fallback', async () => {
    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'private', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'must-not-run';
        }
    });
    const repository = new DemoRepository({
        provider: {
            getActivities: () => [accessor],
            getAthlete: () => new Date(0),
            getZones: () => {
                throw new Error('synthetic provider failure');
            },
            getGears: () => [new Map()]
        }
    });

    assert.deepEqual((await repository.listActivities()).data, []);
    assert.equal((await repository.getAthlete()).data, null);
    assert.equal((await repository.getZones()).data, null);
    assert.deepEqual((await repository.getGears()).data, []);
    assert.equal(getterCalls, 0);
});

test('Demo results are detached and caller mutation cannot affect later calls', async () => {
    const { provider, data } = createProvider();
    const repository = new DemoRepository({ provider });
    const first = await repository.listActivities();
    first.data[0].name = 'caller mutation';
    const second = await repository.listActivities();
    assert.equal(second.data[0].name, 'Synthetic demo activity');
    assert.equal(data.activities[0].name, 'Synthetic demo activity');
    assert.notEqual(first.data, second.data);
    assert.notEqual(first.data[0], second.data[0]);
});

test('Demo refresh accepts the option without network, token, or cache access', async () => {
    const { provider, calls } = createProvider();
    const repository = new DemoRepository({ provider });
    const options = Object.freeze({ refresh: true });
    const result = await repository.listActivities(options);
    assert.equal(calls.activities, 1);
    assert.equal(result.source, REPOSITORY_SOURCE.DEMO);
    assert.deepEqual(options, { refresh: true });
});

test('DemoRepository performs zero real storage, token, fetch, or connector I/O', async () => {
    const originals = new Map(
        ['fetch', 'localStorage', 'document'].map(name => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name)
        ])
    );
    let realAccesses = 0;
    try {
        for (const name of originals.keys()) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    realAccesses += 1;
                    throw new Error('real dependency must stay unreachable');
                }
            });
        }
        const { provider } = createProvider();
        const repository = new DemoRepository({ provider });
        await repository.listActivities({ refresh: true });
        await repository.getAthlete();
        await repository.getZones();
        await repository.getGears();
        assert.equal(realAccesses, 0);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
});

test('DemoRepository constructor rejects accessors without executing them', () => {
    let getterCalls = 0;
    const options = {};
    Object.defineProperty(options, 'provider', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return createProvider().provider;
        }
    });
    assert.throws(
        () => new DemoRepository(options),
        error => (
            error instanceof RepositoryError
            && error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
        )
    );
    assert.equal(getterCalls, 0);
});
