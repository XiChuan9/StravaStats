import assert from 'node:assert/strict';
import test from 'node:test';

import { DemoRepository } from '../../js/repository/demo/demo-repository.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE,
    RepositoryError
} from '../../js/repository/errors.js';
import { LegacyRepository } from '../../js/repository/legacy/legacy-repository.js';

const SOURCES = new Set(Object.values(REPOSITORY_SOURCE));
const WARNING_CODES = new Set(Object.values(REPOSITORY_WARNING_CODE));
const METHODS = [
    'listActivities',
    'getActivity',
    'getStreams',
    'getAthlete',
    'getZones',
    'getGears',
    'getGear'
];

function syntheticData() {
    return {
        activities: [{
            id: 'synthetic-activity-1',
            name: 'Synthetic activity'
        }],
        athlete: {
            id: 'synthetic-athlete',
            shoes: [{ id: 'synthetic-gear-1' }],
            bikes: []
        },
        zones: { heartrate: [] },
        gears: [{ id: 'synthetic-gear-1', name: 'Synthetic shoes' }],
        streams: { time: { data: [0, 1] } }
    };
}

function createLegacy() {
    const data = syntheticData();
    const connector = {
        async fetchActivities() {
            return data.activities;
        },
        async fetchActivity() {
            return data.activities[0];
        },
        async fetchStreams() {
            return data.streams;
        },
        async fetchAthlete() {
            return data.athlete;
        },
        async fetchZones() {
            return data.zones;
        },
        async fetchGear() {
            return data.gears[0];
        }
    };
    const miss = () => ({ status: 'miss' });
    const written = () => ({ status: 'written' });
    return {
        repository: new LegacyRepository({
            connector,
            activityCache: {
                async getCachedActivities() {
                    return null;
                },
                async saveCachedActivities() {
                    return true;
                }
            },
            metadataCache: {
                readAthlete: miss,
                writeAthlete: written,
                readZones: miss,
                writeZones: written,
                readGears: miss,
                writeGears: written,
                readGear: miss,
                writeGear: written
            },
            now: () => 1000,
            metadataTtlMs: 100
        }),
        io: { real: false }
    };
}

function createDemo() {
    const data = syntheticData();
    return {
        repository: new DemoRepository({
            provider: {
                getActivities: () => data.activities,
                getAthlete: () => data.athlete,
                getZones: () => data.zones,
                getGears: () => data.gears
            }
        }),
        io: { real: false }
    };
}

function calls(repository) {
    return [
        () => repository.listActivities(),
        () => repository.getActivity('synthetic-activity-1'),
        () => repository.getStreams(
            'synthetic-activity-1',
            { types: ['time'] }
        ),
        () => repository.getAthlete(),
        () => repository.getZones(),
        () => repository.getGears(),
        () => repository.getGear('synthetic-gear-1')
    ];
}

function assertJsonSafe(value) {
    const serialized = JSON.stringify(value);
    assert.equal(typeof serialized, 'string');
    assert.deepEqual(
        JSON.parse(serialized),
        value instanceof Error && typeof value.toJSON === 'function'
            ? value.toJSON()
            : value
    );
}

function assertEnvelope(value) {
    assert.deepEqual(
        Object.keys(value).sort(),
        ['data', 'partial', 'source', 'warnings']
    );
    assert.ok(SOURCES.has(value.source));
    assert.ok(Array.isArray(value.warnings));
    assert.equal(typeof value.partial, 'boolean');
    for (const warning of value.warnings) {
        assert.ok(WARNING_CODES.has(warning.code));
        assert.equal(typeof warning.operation, 'string');
        assert.equal(typeof warning.retryable, 'boolean');
        const allowed = warning.code === REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED
            ? ['code', 'itemIndex', 'operation', 'retryable']
            : ['code', 'operation', 'retryable'];
        assert.deepEqual(Object.keys(warning).sort(), allowed.sort());
    }
    assertJsonSafe(value);
}

for (const [name, create] of [
    ['LegacyRepository', createLegacy],
    ['DemoRepository', createDemo]
]) {
    test(`${name} exposes exactly the seven public methods`, () => {
        const { repository } = create();
        for (const method of METHODS) {
            assert.equal(typeof repository[method], 'function');
        }
        assert.equal(repository.getLaps, undefined);
    });

    test(`${name} returns the exact success envelope for all methods`, async () => {
        const { repository, io } = create();
        for (const invoke of calls(repository)) {
            const value = await invoke();
            assertEnvelope(value);
        }
        assert.equal(io.real, false);
    });

    test(`${name} returns detached deterministic results`, async () => {
        const { repository } = create();
        const first = await repository.listActivities();
        const second = await repository.listActivities();
        assert.deepEqual(first, second);
        assert.notEqual(first, second);
        assert.notEqual(first.data, second.data);
        first.data[0].name = 'caller mutation';
        const third = await repository.listActivities();
        assert.equal(third.data[0].name, 'Synthetic activity');

        const [left, right] = await Promise.all([
            repository.getAthlete(),
            repository.getAthlete()
        ]);
        assert.deepEqual(left, right);
        assert.notEqual(left, right);
        assert.notEqual(left.data, right.data);
    });

    test(`${name} rejects invalid IDs and stream options`, async () => {
        const { repository } = create();
        for (const invoke of [
            () => repository.getActivity(''),
            () => repository.getGear(-1),
            () => repository.getStreams('synthetic-activity-1', {}),
            () => repository.getStreams(
                'synthetic-activity-1',
                { types: ['time'], extra: true }
            ),
            () => repository.getStreams(
                'synthetic-activity-1',
                { types: ['time', 'time'] }
            )
        ]) {
            await assert.rejects(invoke(), error => {
                assert.ok(error instanceof RepositoryError);
                assert.equal(
                    error.code,
                    REPOSITORY_ERROR_CODE.INVALID_REQUEST
                );
                assertJsonSafe(error);
                return true;
            });
        }
    });

    test(`${name} fails closed for accessor and Proxy options`, async () => {
        const { repository } = create();
        let getterCalls = 0;
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
                throw new Error('synthetic reflection failure');
            }
        });
        for (const options of [accessor, proxy]) {
            await assert.rejects(
                repository.listActivities(options),
                error => (
                    error instanceof RepositoryError
                    && error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
                )
            );
        }
        assert.equal(getterCalls, 0);
    });
}

test('successful empty collections are not partial', async () => {
    const repository = new DemoRepository({
        provider: {
            getActivities: () => [],
            getAthlete: () => null,
            getZones: () => null,
            getGears: () => []
        }
    });
    for (const invoke of [
        () => repository.listActivities(),
        () => repository.getGears()
    ]) {
        const value = await invoke();
        assert.deepEqual(value.data, []);
        assert.equal(value.partial, false);
        assert.deepEqual(value.warnings, []);
    }
});
