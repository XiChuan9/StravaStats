import assert from 'node:assert/strict';
import test from 'node:test';

import {
    STRAVA_CONNECTOR_ERROR_CODE,
    StravaConnectorError
} from '../../js/connectors/strava/strava-api-connector.js';
import {
    REPOSITORY_ERROR_CODE,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE,
    RepositoryError
} from '../../js/repository/errors.js';
import {
    LEGACY_METADATA_CACHE_TTL_MS,
    LegacyCacheAdapter
} from '../../js/repository/legacy/legacy-cache-adapter.js';
import {
    LEGACY_ACTIVITY_CACHE_MAX_AGE_MS,
    LEGACY_ACTIVITY_CACHE_VERSION,
    LegacyRepository
} from '../../js/repository/legacy/legacy-repository.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function memoryStorage(initial = {}, fail = () => false) {
    const values = new Map(Object.entries(initial));
    const calls = [];
    return {
        calls,
        values,
        getItem(key) {
            calls.push(['get', key]);
            if (fail('get', key, calls)) {
                throw new Error('synthetic storage failure');
            }
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            calls.push(['set', key]);
            if (fail('set-before', key, calls)) {
                throw new Error('synthetic storage failure');
            }
            values.set(key, String(value));
            if (fail('set-after', key, calls)) {
                throw new Error('synthetic storage failure');
            }
        },
        removeItem(key) {
            calls.push(['remove', key]);
            if (fail('remove', key, calls)) {
                throw new Error('synthetic storage failure');
            }
            values.delete(key);
        }
    };
}

function connector(overrides = {}) {
    return {
        async fetchActivities() {
            return [{ id: 'synthetic-activity' }];
        },
        async fetchActivity(id) {
            return { id };
        },
        async fetchStreams(id, { types }) {
            return { id, types };
        },
        async fetchAthlete() {
            return {
                id: 'synthetic-athlete',
                shoes: [],
                bikes: []
            };
        },
        async fetchZones() {
            return { heartrate: [] };
        },
        async fetchGear(id) {
            return { id };
        },
        ...overrides
    };
}

function metadataCache(overrides = {}) {
    const miss = () => ({ status: 'miss' });
    const written = () => ({ status: 'written' });
    return {
        readAthlete: miss,
        writeAthlete: written,
        readZones: miss,
        writeZones: written,
        readGears: miss,
        writeGears: written,
        readGear: miss,
        writeGear: written,
        ...overrides
    };
}

function activityCache(overrides = {}) {
    return {
        async getCachedActivities() {
            return null;
        },
        async saveCachedActivities() {
            return true;
        },
        ...overrides
    };
}

function repository({
    connector: connectorValue = connector(),
    metadataCache: metadataCacheValue = metadataCache(),
    activityCache: activityCacheValue = activityCache(),
    now = () => 1000,
    metadataTtlMs = 100
} = {}) {
    return new LegacyRepository({
        connector: connectorValue,
        metadataCache: metadataCacheValue,
        activityCache: activityCacheValue,
        now,
        cacheVersion: LEGACY_ACTIVITY_CACHE_VERSION,
        activityMaxAgeMs: LEGACY_ACTIVITY_CACHE_MAX_AGE_MS,
        metadataTtlMs
    });
}

function assertWarning(value, code, operation) {
    assert.equal(value.code, code);
    assert.equal(value.operation, operation);
    assert.equal(typeof value.retryable, 'boolean');
}

test('Legacy cache adapter constructor and import perform zero I/O', () => {
    let calls = 0;
    const storage = {
        getItem() {
            calls += 1;
            return null;
        },
        setItem() {
            calls += 1;
        },
        removeItem() {
            calls += 1;
        }
    };
    new LegacyCacheAdapter({
        storage,
        now: () => {
            calls += 1;
            return 1000;
        }
    });
    assert.equal(calls, 0);
});

test('Legacy cache adapter reads hit, miss, malformed, and expired states', () => {
    let now = LEGACY_METADATA_CACHE_TTL_MS;
    const storage = memoryStorage({
        strava_athlete_data: JSON.stringify({ id: 'synthetic-athlete' }),
        strava_athlete_data_timestamp: '0'
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => now
    });
    assert.deepEqual(adapter.readAthlete(), {
        status: 'hit',
        data: { id: 'synthetic-athlete' },
        timestamp: 0,
        expiresAt: LEGACY_METADATA_CACHE_TTL_MS,
        expired: false
    });

    now += 1;
    assert.deepEqual(adapter.readAthlete(), {
        status: 'miss',
        data: null,
        timestamp: null,
        expiresAt: null,
        expired: true
    });
    assert.equal(storage.values.has('strava_athlete_data'), false);
    assert.equal(
        storage.values.has('strava_athlete_data_timestamp'),
        false
    );

    storage.values.set('strava_athlete_data', '{invalid');
    storage.values.set('strava_athlete_data_timestamp', String(now));
    assert.equal(adapter.readAthlete().status, 'failed');
    storage.values.delete('strava_athlete_data');
    assert.equal(adapter.readAthlete().status, 'miss');
});

test('future cache timestamps are rejected and clean only their key pair', () => {
    const storage = memoryStorage({
        strava_athlete_data: JSON.stringify({ id: 'synthetic-athlete' }),
        strava_athlete_data_timestamp: '101',
        strava_tokens: 'untouched',
        strava_training_zones: '{"untouched":true}'
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100,
        ttlMs: 50
    });
    assert.deepEqual(adapter.readAthlete(), {
        status: 'miss',
        data: null,
        timestamp: null,
        expiresAt: null,
        expired: true
    });
    assert.equal(storage.values.has('strava_athlete_data'), false);
    assert.equal(
        storage.values.has('strava_athlete_data_timestamp'),
        false
    );
    assert.equal(storage.values.get('strava_tokens'), 'untouched');
    assert.equal(
        storage.values.get('strava_training_zones'),
        '{"untouched":true}'
    );
});

test('overflowing cache expiry is rejected and cleaned', () => {
    const timestamp = Number.MAX_VALUE;
    const storage = memoryStorage({
        strava_athlete_data: JSON.stringify({ id: 'synthetic-athlete' }),
        strava_athlete_data_timestamp: String(timestamp)
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => timestamp,
        ttlMs: Number.MAX_VALUE
    });
    const value = adapter.readAthlete();
    assert.equal(value.status, 'miss');
    assert.equal(value.expired, true);
    assert.equal(storage.values.has('strava_athlete_data'), false);
    assert.equal(
        storage.values.has('strava_athlete_data_timestamp'),
        false
    );
});

test('cache timestamps at now and exact TTL expiry remain valid boundaries', () => {
    let timestamp = 100;
    const storage = memoryStorage({
        strava_athlete_data: JSON.stringify({ id: 'synthetic-athlete' }),
        strava_athlete_data_timestamp: String(timestamp)
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100,
        ttlMs: 50
    });
    assert.deepEqual(adapter.readAthlete(), {
        status: 'hit',
        data: { id: 'synthetic-athlete' },
        timestamp: 100,
        expiresAt: 150,
        expired: false
    });

    timestamp = 50;
    storage.values.set(
        'strava_athlete_data_timestamp',
        String(timestamp)
    );
    assert.deepEqual(adapter.readAthlete(), {
        status: 'hit',
        data: { id: 'synthetic-athlete' },
        timestamp: 50,
        expiresAt: 100,
        expired: false
    });
});

test('invalid clock values fail closed before arithmetic or cleanup', async t => {
    const cases = [
        {
            name: 'throw',
            createClock() {
                return {
                    now() {
                        throw new Error('synthetic clock failure');
                    },
                    coercions: () => 0
                };
            }
        },
        {
            name: 'Symbol',
            createClock: () => ({
                now: () => Symbol('synthetic-clock'),
                coercions: () => 0
            })
        },
        {
            name: 'BigInt',
            createClock: () => ({
                now: () => 100n,
                coercions: () => 0
            })
        },
        {
            name: 'string',
            createClock: () => ({
                now: () => '100',
                coercions: () => 0
            })
        },
        {
            name: 'boxed Number',
            createClock: () => ({
                now: () => new Number(100),
                coercions: () => 0
            })
        },
        {
            name: 'observable object',
            createClock() {
                let calls = 0;
                const value = {
                    valueOf() {
                        calls += 1;
                        return 100;
                    },
                    toString() {
                        calls += 1;
                        return '100';
                    }
                };
                return {
                    now: () => value,
                    coercions: () => calls
                };
            }
        },
        {
            name: 'null',
            createClock: () => ({
                now: () => null,
                coercions: () => 0
            })
        },
        {
            name: 'undefined',
            createClock: () => ({
                now: () => undefined,
                coercions: () => 0
            })
        },
        {
            name: 'NaN',
            createClock: () => ({
                now: () => NaN,
                coercions: () => 0
            })
        },
        {
            name: 'Infinity',
            createClock: () => ({
                now: () => Infinity,
                coercions: () => 0
            })
        }
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, () => {
            const readClock = scenario.createClock();
            const readStorage = memoryStorage({
                strava_athlete_data: '{"id":"synthetic-athlete"}',
                strava_athlete_data_timestamp: '100',
                strava_tokens: 'untouched'
            });
            const reader = new LegacyCacheAdapter({
                storage: readStorage,
                now: readClock.now,
                ttlMs: 50
            });
            assert.equal(reader.readAthlete().status, 'failed');
            assert.equal(readClock.coercions(), 0);
            assert.deepEqual(
                readStorage.calls.filter(
                    ([operation]) => operation === 'remove'
                ),
                []
            );
            assert.equal(
                readStorage.values.get('strava_athlete_data'),
                '{"id":"synthetic-athlete"}'
            );
            assert.equal(
                readStorage.values.get(
                    'strava_athlete_data_timestamp'
                ),
                '100'
            );
            assert.equal(
                readStorage.values.get('strava_tokens'),
                'untouched'
            );

            const writeClock = scenario.createClock();
            const writeStorage = memoryStorage();
            const writer = new LegacyCacheAdapter({
                storage: writeStorage,
                now: writeClock.now,
                ttlMs: 50
            });
            assert.equal(
                writer.writeAthlete({ id: 'synthetic-athlete' }).status,
                'failed'
            );
            assert.equal(writeClock.coercions(), 0);
            assert.deepEqual(writeStorage.calls, []);
        });
    }
});

test('non-string timestamps avoid coercion and clean only their key pair', async t => {
    const cases = [
        {
            name: 'Symbol',
            create() {
                return { value: Symbol('synthetic-timestamp'), calls: () => 0 };
            }
        },
        {
            name: 'BigInt',
            create() {
                return { value: 100n, calls: () => 0 };
            }
        },
        {
            name: 'observable object',
            create() {
                let calls = 0;
                return {
                    value: {
                        valueOf() {
                            calls += 1;
                            return 100;
                        },
                        toString() {
                            calls += 1;
                            return '100';
                        }
                    },
                    calls: () => calls
                };
            }
        },
        {
            name: 'Proxy',
            create() {
                let calls = 0;
                return {
                    value: new Proxy({}, {
                        get() {
                            calls += 1;
                            throw new Error('must not inspect timestamp');
                        }
                    }),
                    calls: () => calls
                };
            }
        }
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, () => {
            const candidate = scenario.create();
            let clockCalls = 0;
            const storage = memoryStorage({
                strava_training_zones: '{"synthetic":true}',
                strava_training_zones_timestamp: candidate.value,
                strava_athlete_data: '{"untouched":true}',
                strava_tokens: 'untouched',
                strava_tokens_demo: 'untouched',
                strava_activities: 'untouched'
            });
            const adapter = new LegacyCacheAdapter({
                storage,
                now() {
                    clockCalls += 1;
                    return 100;
                },
                ttlMs: 50
            });
            const value = adapter.readZones();
            assert.equal(value.status, 'miss');
            assert.equal(value.expired, true);
            assert.equal(candidate.calls(), 0);
            assert.equal(clockCalls, 0);
            assert.deepEqual(
                storage.calls
                    .filter(([operation]) => operation === 'remove')
                    .map(([, key]) => key),
                [
                    'strava_training_zones',
                    'strava_training_zones_timestamp'
                ]
            );
            assert.equal(
                storage.values.get('strava_athlete_data'),
                '{"untouched":true}'
            );
            assert.equal(storage.values.get('strava_tokens'), 'untouched');
            assert.equal(
                storage.values.get('strava_tokens_demo'),
                'untouched'
            );
            assert.equal(
                storage.values.get('strava_activities'),
                'untouched'
            );
        });
    }
});

test('non-string data fails without coercion, parsing, or cleanup', async t => {
    const cases = [
        {
            name: 'Symbol',
            create() {
                return { value: Symbol('synthetic-data'), calls: () => 0 };
            }
        },
        {
            name: 'observable object',
            create() {
                let calls = 0;
                return {
                    value: {
                        valueOf() {
                            calls += 1;
                            return 1;
                        },
                        toString() {
                            calls += 1;
                            return '{"must":"not parse"}';
                        }
                    },
                    calls: () => calls
                };
            }
        },
        {
            name: 'Proxy',
            create() {
                let calls = 0;
                return {
                    value: new Proxy({}, {
                        get() {
                            calls += 1;
                            throw new Error('must not inspect data');
                        }
                    }),
                    calls: () => calls
                };
            }
        }
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, () => {
            const candidate = scenario.create();
            let clockCalls = 0;
            const storage = memoryStorage({
                strava_athlete_data: candidate.value,
                strava_athlete_data_timestamp: '100',
                strava_tokens: 'untouched'
            });
            const adapter = new LegacyCacheAdapter({
                storage,
                now() {
                    clockCalls += 1;
                    return 100;
                }
            });
            assert.equal(adapter.readAthlete().status, 'failed');
            assert.equal(candidate.calls(), 0);
            assert.equal(clockCalls, 0);
            assert.deepEqual(
                storage.calls.filter(
                    ([operation]) => operation === 'remove'
                ),
                []
            );
            assert.equal(storage.values.get('strava_tokens'), 'untouched');
        });
    }
});

test('non-string timestamp cleanup failure remains observable', () => {
    const storage = memoryStorage({
        strava_training_zones: '{"synthetic":true}',
        strava_training_zones_timestamp: Symbol('synthetic-timestamp'),
        strava_tokens: 'untouched'
    }, (operation, key) => (
        operation === 'remove'
        && key === 'strava_training_zones'
    ));
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100
    });
    const value = adapter.readZones();
    assert.equal(value.status, 'failed');
    assert.equal(value.expired, true);
    assert.equal(storage.values.get('strava_tokens'), 'untouched');
    assert.deepEqual(
        storage.calls
            .filter(([operation]) => operation === 'remove')
            .map(([, key]) => key),
        [
            'strava_training_zones',
            'strava_training_zones_timestamp'
        ]
    );
});

test('expired cleanup failure is observable and touches only the key pair', () => {
    const storage = memoryStorage({
        strava_training_zones: '{}',
        strava_training_zones_timestamp: '0',
        strava_tokens: 'untouched',
        unrelated: 'untouched'
    }, (operation, key) => (
        operation === 'remove'
        && key === 'strava_training_zones'
    ));
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => LEGACY_METADATA_CACHE_TTL_MS + 1
    });
    const value = adapter.readZones();
    assert.equal(value.status, 'failed');
    assert.equal(value.expired, true);
    assert.equal(storage.values.get('strava_tokens'), 'untouched');
    assert.equal(storage.values.get('unrelated'), 'untouched');
    assert.deepEqual(
        storage.calls
            .filter(([operation]) => operation === 'remove')
            .map(([, key]) => key),
        [
            'strava_training_zones',
            'strava_training_zones_timestamp'
        ]
    );
});

test('cache writes use two-key snapshot and compensate after failure', () => {
    const initial = {
        strava_gears: '[{"id":"old"}]',
        strava_gears_timestamp: '10',
        strava_tokens: 'untouched'
    };
    let failedOnce = false;
    const storage = memoryStorage(initial, (operation, key) => {
        if (
            operation === 'set-after'
            && key === 'strava_gears_timestamp'
            && !failedOnce
        ) {
            failedOnce = true;
            return true;
        }
        return false;
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100
    });
    assert.equal(adapter.writeGears([{ id: 'new' }]).status, 'failed');
    assert.equal(storage.values.get('strava_gears'), initial.strava_gears);
    assert.equal(
        storage.values.get('strava_gears_timestamp'),
        initial.strava_gears_timestamp
    );
    assert.equal(storage.values.get('strava_tokens'), 'untouched');
});

test('cache adapter uses only exact metadata and gear keys', () => {
    const storage = memoryStorage();
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100
    });
    adapter.writeAthlete({ id: 'athlete' });
    adapter.writeZones({});
    adapter.writeGears([]);
    adapter.writeGear('gear/id', { id: 'gear/id' });
    const touched = new Set(storage.calls.map(([, key]) => key));
    assert.deepEqual(touched, new Set([
        'strava_athlete_data',
        'strava_athlete_data_timestamp',
        'strava_training_zones',
        'strava_training_zones_timestamp',
        'strava_gears',
        'strava_gears_timestamp',
        'strava_gear_gear/id',
        'strava_gear_gear/id_timestamp'
    ]));
    for (const forbidden of [
        'strava_tokens',
        'strava_tokens_demo',
        'strava_activities'
    ]) {
        assert.equal(touched.has(forbidden), false);
    }
});

test('per-ID gear cache honors the injected TTL', () => {
    let now = 100;
    const storage = memoryStorage({
        strava_gear_synthetic: JSON.stringify({ id: 'synthetic' }),
        strava_gear_synthetic_timestamp: '100'
    });
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => now,
        ttlMs: 50
    });
    assert.equal(adapter.readGear('synthetic').status, 'hit');
    now = 151;
    const expired = adapter.readGear('synthetic');
    assert.equal(expired.status, 'miss');
    assert.equal(expired.expired, true);
    assert.equal(storage.values.has('strava_gear_synthetic'), false);
    assert.equal(
        storage.values.has('strava_gear_synthetic_timestamp'),
        false
    );
});

test('cache adapter refuses partial aggregate gear writes', () => {
    const storage = memoryStorage();
    const adapter = new LegacyCacheAdapter({
        storage,
        now: () => 100
    });
    assert.equal(
        adapter.writeGears([{ id: 'synthetic' }], { partial: true }).status,
        'failed'
    );
    assert.deepEqual(storage.calls, []);
});

const connectorMappings = [
    ['TOKEN_ABSENT', 'UNAUTHENTICATED'],
    ['TOKEN_INVALID', 'TOKEN_INVALID'],
    ['TOKEN_READ_FAILED', 'TOKEN_READ_FAILED'],
    ['TOKEN_ENCODING_FAILED', 'TOKEN_ENCODING_FAILED'],
    ['TOKEN_WRITE_FAILED', 'TOKEN_WRITE_FAILED'],
    ['NETWORK_FAILED', 'NETWORK_UNAVAILABLE'],
    ['HTTP_UNAUTHENTICATED', 'UNAUTHENTICATED'],
    ['HTTP_FORBIDDEN', 'FORBIDDEN'],
    ['HTTP_NOT_FOUND', 'NOT_FOUND'],
    ['HTTP_RATE_LIMITED', 'RATE_LIMITED'],
    ['HTTP_SERVER_ERROR', 'PROVIDER_HTTP_ERROR'],
    ['INVALID_JSON', 'RESPONSE_INVALID'],
    ['INVALID_ENVELOPE', 'RESPONSE_INVALID'],
    ['INVALID_REQUEST', 'INVALID_REQUEST']
];

for (const [connectorCode, repositoryCode] of connectorMappings) {
    test(`maps Connector ${connectorCode} to Repository ${repositoryCode}`, async () => {
        const error = new StravaConnectorError(
            STRAVA_CONNECTOR_ERROR_CODE[connectorCode],
            {
                operation: 'listActivities',
                retryable: true,
                httpStatus: connectorCode.startsWith('HTTP_') ? 429 : null,
                retryAfterSeconds: connectorCode === 'HTTP_RATE_LIMITED'
                    ? 30
                    : null
            }
        );
        const target = repository({
            connector: connector({
                async fetchActivities() {
                    throw error;
                }
            })
        });
        await assert.rejects(target.listActivities(), mapped => {
            assert.ok(mapped instanceof RepositoryError);
            assert.equal(mapped.code, repositoryCode);
            assert.equal(mapped.operation, 'listActivities');
            assert.equal(mapped.retryable, true);
            assert.equal(mapped.httpStatus, error.httpStatus);
            assert.equal(
                mapped.retryAfterSeconds,
                error.retryAfterSeconds
            );
            assert.doesNotMatch(
                JSON.stringify(mapped),
                /stack|Authorization|synthetic-access/
            );
            return true;
        });
    });
}

test('unknown, forged, and mismatched Connector errors fail closed', async () => {
    const failures = [
        new Error('synthetic raw provider secret'),
        {
            code: STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
            operation: 'listActivities'
        },
        new StravaConnectorError(
            STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
            {
                operation: 'getAthlete',
                retryable: true
            }
        )
    ];
    for (const failure of failures) {
        const target = repository({
            connector: connector({
                async fetchActivities() {
                    throw failure;
                }
            })
        });
        await assert.rejects(target.listActivities(), error => {
            assert.equal(error.code, REPOSITORY_ERROR_CODE.RESPONSE_INVALID);
            assert.doesNotMatch(
                JSON.stringify(error),
                /synthetic raw provider secret/
            );
            return true;
        });
    }
});

test('listActivities cache hit performs 1 read / 0 network / 0 write', async () => {
    const calls = { read: 0, network: 0, write: 0 };
    const target = repository({
        connector: connector({
            async fetchActivities() {
                calls.network += 1;
                return [];
            }
        }),
        activityCache: activityCache({
            async getCachedActivities(options) {
                calls.read += 1;
                assert.deepEqual(options, {
                    cacheVersion: LEGACY_ACTIVITY_CACHE_VERSION,
                    maxAgeMs: LEGACY_ACTIVITY_CACHE_MAX_AGE_MS
                });
                return { activities: [{ id: 'cached' }] };
            },
            async saveCachedActivities() {
                calls.write += 1;
                return true;
            }
        })
    });
    const value = await target.listActivities();
    assert.deepEqual(calls, { read: 1, network: 0, write: 0 });
    assert.equal(value.source, REPOSITORY_SOURCE.CACHE);
    assert.deepEqual(value.data, [{ id: 'cached' }]);
});

for (const [name, cacheValue] of [
    ['miss', null],
    ['empty', { activities: [] }]
]) {
    test(`listActivities ${name} performs 1 read / 1 network / 1 write`, async () => {
        const calls = { read: 0, network: 0, write: 0 };
        const target = repository({
            connector: connector({
                async fetchActivities() {
                    calls.network += 1;
                    return [{ id: 'network' }];
                }
            }),
            activityCache: activityCache({
                async getCachedActivities() {
                    calls.read += 1;
                    return cacheValue;
                },
                async saveCachedActivities(activities, version) {
                    calls.write += 1;
                    assert.deepEqual(activities, [{ id: 'network' }]);
                    assert.equal(version, LEGACY_ACTIVITY_CACHE_VERSION);
                    return true;
                }
            })
        });
        const value = await target.listActivities();
        assert.deepEqual(calls, { read: 1, network: 1, write: 1 });
        assert.equal(value.source, REPOSITORY_SOURCE.NETWORK);
        assert.deepEqual(value.warnings, []);
    });
}

test('listActivities refresh performs 0 reads / 1 network / 1 write', async () => {
    const calls = { read: 0, network: 0, write: 0 };
    const target = repository({
        connector: connector({
            async fetchActivities() {
                calls.network += 1;
                return [];
            }
        }),
        activityCache: activityCache({
            async getCachedActivities() {
                calls.read += 1;
                return null;
            },
            async saveCachedActivities() {
                calls.write += 1;
                return true;
            }
        })
    });
    const value = await target.listActivities({ refresh: true });
    assert.deepEqual(calls, { read: 0, network: 1, write: 1 });
    assert.deepEqual(value.data, []);
    assert.equal(value.partial, false);
});

test('listActivities invalid/read failure warns then falls back once', async () => {
    for (const read of [
        async () => ({ activities: { wrong: true } }),
        async () => {
            throw new Error('synthetic read failure');
        }
    ]) {
        let network = 0;
        let writes = 0;
        const target = repository({
            connector: connector({
                async fetchActivities() {
                    network += 1;
                    return [];
                }
            }),
            activityCache: activityCache({
                getCachedActivities: read,
                async saveCachedActivities() {
                    writes += 1;
                    return true;
                }
            })
        });
        const value = await target.listActivities();
        assert.equal(network, 1);
        assert.equal(writes, 1);
        assert.equal(value.warnings.length, 1);
        assertWarning(
            value.warnings[0],
            REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
            'listActivities'
        );
        assert.equal(value.partial, false);
    }
});

test('listActivities false/rejected writes warn without losing data', async () => {
    for (const save of [
        async () => false,
        async () => {
            throw new Error('synthetic write failure');
        }
    ]) {
        const target = repository({
            activityCache: activityCache({
                saveCachedActivities: save
            })
        });
        const value = await target.listActivities();
        assert.deepEqual(value.data, [{ id: 'synthetic-activity' }]);
        assert.equal(value.partial, false);
        assertWarning(
            value.warnings[0],
            REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED,
            'listActivities'
        );
    }
});

test('getActivity and getStreams are network-only and preserve input', async () => {
    const calls = [];
    const target = repository({
        connector: connector({
            async fetchActivity(id) {
                calls.push(['activity', id]);
                return { id };
            },
            async fetchStreams(id, options) {
                calls.push(['streams', id, [...options.types]]);
                return { time: { data: [0] } };
            }
        })
    });
    const streamOptions = Object.freeze({
        types: Object.freeze(['time'])
    });
    assert.equal(
        (await target.getActivity(0)).source,
        REPOSITORY_SOURCE.NETWORK
    );
    assert.equal(
        (await target.getStreams('activity', streamOptions)).source,
        REPOSITORY_SOURCE.NETWORK
    );
    assert.deepEqual(calls, [
        ['activity', '0'],
        ['streams', 'activity', ['time']]
    ]);
    assert.deepEqual(streamOptions, { types: ['time'] });
});

test('metadata cache hit avoids network and returns detached data', async () => {
    const cached = {
        id: 'cached-athlete',
        shoes: [],
        bikes: []
    };
    let network = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                network += 1;
                return {};
            }
        }),
        metadataCache: metadataCache({
            readAthlete: () => ({
                status: 'hit',
                data: cached,
                expiresAt: 1100
            })
        })
    });
    const first = await target.getAthlete();
    const second = await target.getAthlete();
    assert.equal(network, 0);
    assert.equal(first.source, REPOSITORY_SOURCE.CACHE);
    assert.notEqual(first.data, second.data);
    first.data.id = 'mutation';
    assert.equal(second.data.id, 'cached-athlete');
    assert.equal(cached.id, 'cached-athlete');
});

test('metadata miss/read/write failure behavior is observable', async () => {
    for (const [readAthlete, writeAthlete, expectedCodes] of [
        [
            () => ({ status: 'miss' }),
            () => ({ status: 'written' }),
            []
        ],
        [
            () => ({ status: 'failed' }),
            () => ({ status: 'written' }),
            [REPOSITORY_WARNING_CODE.CACHE_READ_FAILED]
        ],
        [
            () => ({ status: 'miss' }),
            () => ({ status: 'failed' }),
            [REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED]
        ]
    ]) {
        let network = 0;
        let writes = 0;
        const target = repository({
            connector: connector({
                async fetchAthlete() {
                    network += 1;
                    return { id: 'network', shoes: [], bikes: [] };
                }
            }),
            metadataCache: metadataCache({
                readAthlete,
                writeAthlete(data) {
                    writes += 1;
                    return writeAthlete(data);
                }
            })
        });
        const value = await target.getAthlete();
        assert.equal(network, 1);
        assert.equal(writes, 1);
        assert.equal(value.source, REPOSITORY_SOURCE.NETWORK);
        assert.deepEqual(
            value.warnings.map(item => item.code),
            expectedCodes
        );
        assert.equal(value.partial, false);
    }
});

test('zones are cache-first without permanent memoization', async () => {
    let reads = 0;
    let network = 0;
    const target = repository({
        connector: connector({
            async fetchZones() {
                network += 1;
                return { version: network };
            }
        }),
        metadataCache: metadataCache({
            readZones() {
                reads += 1;
                return { status: 'miss' };
            }
        })
    });
    await target.getZones();
    await target.getZones();
    assert.equal(reads, 2);
    assert.equal(network, 2);
});

test('athlete in-flight load coalesces getAthlete and getGears', async () => {
    const load = deferred();
    let network = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                network += 1;
                return load.promise;
            }
        })
    });
    const athletePromise = target.getAthlete();
    const gearsPromise = target.getGears();
    await Promise.resolve();
    assert.equal(network, 1);
    load.resolve({
        id: 'synthetic-athlete',
        shoes: [],
        bikes: []
    });
    const [athlete, gears] = await Promise.all([
        athletePromise,
        gearsPromise
    ]);
    assert.equal(network, 1);
    assert.notEqual(athlete.data, gears.data);
    assert.deepEqual(gears.data, []);
});

test('athlete concurrent callers receive different mutable references', async () => {
    const load = deferred();
    const target = repository({
        connector: connector({
            fetchAthlete: () => load.promise
        })
    });
    const leftPromise = target.getAthlete();
    const rightPromise = target.getAthlete();
    load.resolve({
        id: 'synthetic-athlete',
        shoes: [],
        bikes: []
    });
    const [left, right] = await Promise.all([leftPromise, rightPromise]);
    assert.deepEqual(left, right);
    assert.notEqual(left, right);
    assert.notEqual(left.data, right.data);
});

test('athlete rejected in-flight load clears and retries', async () => {
    let calls = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                calls += 1;
                if (calls === 1) {
                    throw new StravaConnectorError(
                        STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
                        {
                            operation: 'getAthlete',
                            retryable: true
                        }
                    );
                }
                return { id: 'recovered', shoes: [], bikes: [] };
            }
        })
    });
    await assert.rejects(
        target.getAthlete(),
        error => error.code === REPOSITORY_ERROR_CODE.NETWORK_UNAVAILABLE
    );
    assert.equal((await target.getAthlete()).data.id, 'recovered');
    assert.equal(calls, 2);
});

test('athlete resolved snapshot expires using the injected clock', async () => {
    let now = 1000;
    let calls = 0;
    let reads = 0;
    const target = repository({
        now: () => now,
        metadataTtlMs: 100,
        connector: connector({
            async fetchAthlete() {
                calls += 1;
                return { id: `athlete-${calls}`, shoes: [], bikes: [] };
            }
        }),
        metadataCache: metadataCache({
            readAthlete() {
                reads += 1;
                return { status: 'miss' };
            }
        })
    });
    assert.equal((await target.getAthlete()).data.id, 'athlete-1');
    now = 1099;
    assert.equal((await target.getAthlete()).data.id, 'athlete-1');
    now = 1100;
    assert.equal((await target.getAthlete()).data.id, 'athlete-2');
    assert.equal(calls, 2);
    assert.equal(reads, 2);
});

test('athlete cache expiry is capped to one injected metadata TTL', async () => {
    let now = 1000;
    let reads = 0;
    const target = repository({
        now: () => now,
        metadataTtlMs: 100,
        metadataCache: metadataCache({
            readAthlete() {
                reads += 1;
                return {
                    status: 'hit',
                    data: {
                        id: `cached-${reads}`,
                        shoes: [],
                        bikes: []
                    },
                    expiresAt: Number.MAX_VALUE
                };
            }
        })
    });
    assert.equal((await target.getAthlete()).data.id, 'cached-1');
    now = 1099;
    assert.equal((await target.getAthlete()).data.id, 'cached-1');
    assert.equal(reads, 1);
    now = 1100;
    assert.equal((await target.getAthlete()).data.id, 'cached-2');
    assert.equal(reads, 2);
});

test('expired and non-finite athlete cache expiry fall back to network', async () => {
    for (const expiresAt of [999, 1000, Infinity, NaN]) {
        let network = 0;
        const target = repository({
            connector: connector({
                async fetchAthlete() {
                    network += 1;
                    return {
                        id: 'network-athlete',
                        shoes: [],
                        bikes: []
                    };
                }
            }),
            metadataCache: metadataCache({
                readAthlete: () => ({
                    status: 'hit',
                    data: {
                        id: 'invalid-cache-athlete',
                        shoes: [],
                        bikes: []
                    },
                    expiresAt
                })
            })
        });
        const value = await target.getAthlete();
        assert.equal(value.data.id, 'network-athlete');
        assert.equal(value.source, REPOSITORY_SOURCE.NETWORK);
        assert.equal(network, 1);
        assertWarning(
            value.warnings[0],
            REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
            'getAthlete'
        );
    }
});

test('athlete network snapshot expiry overflow fails closed before I/O', async () => {
    let reads = 0;
    let network = 0;
    let writes = 0;
    const target = repository({
        now: () => Number.MAX_VALUE,
        metadataTtlMs: Number.MAX_VALUE,
        connector: connector({
            async fetchAthlete() {
                network += 1;
                return { id: 'unreachable', shoes: [], bikes: [] };
            }
        }),
        metadataCache: metadataCache({
            readAthlete() {
                reads += 1;
                return { status: 'miss' };
            },
            writeAthlete() {
                writes += 1;
                return { status: 'written' };
            }
        })
    });
    await assert.rejects(target.getAthlete(), error => {
        assert.equal(error instanceof RepositoryError, true);
        assert.equal(error.code, REPOSITORY_ERROR_CODE.RESPONSE_INVALID);
        assert.equal(error.operation, 'getAthlete');
        return true;
    });
    assert.deepEqual({ reads, network, writes }, {
        reads: 0,
        network: 0,
        writes: 0
    });
});

test('aggregate gear cache hit performs zero athlete/per-ID/network work', async () => {
    const calls = { athlete: 0, gear: 0, perId: 0 };
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                calls.athlete += 1;
                return {};
            },
            async fetchGear() {
                calls.gear += 1;
                return {};
            }
        }),
        metadataCache: metadataCache({
            readGears: () => ({
                status: 'hit',
                data: [{ id: 'aggregate' }]
            }),
            readGear() {
                calls.perId += 1;
                return { status: 'miss' };
            }
        })
    });
    const value = await target.getGears();
    assert.equal(value.source, REPOSITORY_SOURCE.CACHE);
    assert.deepEqual(value.data, [{ id: 'aggregate' }]);
    assert.deepEqual(calls, { athlete: 0, gear: 0, perId: 0 });
});

test('getGears preserves shoes-before-bikes order and duplicate IDs', async () => {
    const fetched = [];
    let aggregateWrites = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                return {
                    shoes: [{ id: 'shoe' }, 'duplicate'],
                    bikes: ['bike', 'duplicate']
                };
            },
            async fetchGear(id) {
                fetched.push(id);
                return { id };
            }
        }),
        metadataCache: metadataCache({
            writeGears(data) {
                aggregateWrites += 1;
                assert.deepEqual(
                    data.map(item => item.id),
                    ['shoe', 'duplicate', 'bike', 'duplicate']
                );
                return { status: 'written' };
            }
        })
    });
    const value = await target.getGears();
    assert.deepEqual(
        value.data.map(item => item.id),
        ['shoe', 'duplicate', 'bike', 'duplicate']
    );
    assert.deepEqual(fetched, ['shoe', 'duplicate', 'bike', 'duplicate']);
    assert.equal(aggregateWrites, 1);
    assert.equal(value.partial, false);
});

test('invalid and failed gear items produce stable ordered partial warnings', async () => {
    let aggregateWrites = 0;
    let perIdWrites = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                return {
                    shoes: [null, { id: 'ok' }],
                    bikes: [{ wrong: true }, { id: 'failed' }]
                };
            },
            async fetchGear(id) {
                if (id === 'failed') {
                    throw new StravaConnectorError(
                        STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
                        {
                            operation: 'getGear',
                            retryable: true
                        }
                    );
                }
                return { id };
            }
        }),
        metadataCache: metadataCache({
            writeGears() {
                aggregateWrites += 1;
                return { status: 'written' };
            },
            writeGear() {
                perIdWrites += 1;
                return { status: 'written' };
            }
        })
    });
    const value = await target.getGears();
    assert.deepEqual(value.data, [{ id: 'ok' }]);
    assert.equal(value.partial, true);
    assert.equal(aggregateWrites, 0);
    const itemWarnings = value.warnings.filter(
        item => item.code === REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED
    );
    assert.deepEqual(
        itemWarnings.map(item => item.itemIndex),
        [0, 2, 3]
    );
    assert.equal(itemWarnings[2].retryable, true);
    assert.equal(perIdWrites, 1);
});

test('getGears source follows successful gears with athlete fallback', async t => {
    const cases = [
        {
            name: 'all successful cache gears ignore network athlete',
            athleteSource: REPOSITORY_SOURCE.NETWORK,
            items: ['cache-one', 'cache-two'],
            cacheIds: ['cache-one', 'cache-two'],
            expectedSource: REPOSITORY_SOURCE.CACHE,
            partial: false
        },
        {
            name: 'all successful network gears ignore cache athlete',
            athleteSource: REPOSITORY_SOURCE.CACHE,
            items: ['network-one', 'network-two'],
            cacheIds: [],
            expectedSource: REPOSITORY_SOURCE.NETWORK,
            partial: false
        },
        {
            name: 'successful cache and network gears produce mixed',
            athleteSource: REPOSITORY_SOURCE.CACHE,
            items: ['cached', 'network'],
            cacheIds: ['cached'],
            expectedSource: REPOSITORY_SOURCE.MIXED,
            partial: false
        },
        {
            name: 'complete empty gears use athlete source',
            athleteSource: REPOSITORY_SOURCE.CACHE,
            items: [],
            cacheIds: [],
            expectedSource: REPOSITORY_SOURCE.CACHE,
            partial: false
        },
        {
            name: 'partial with a successful gear uses only its source',
            athleteSource: REPOSITORY_SOURCE.CACHE,
            items: ['network', null],
            cacheIds: [],
            expectedSource: REPOSITORY_SOURCE.NETWORK,
            partial: true
        },
        {
            name: 'partial with zero successful gears uses athlete source',
            athleteSource: REPOSITORY_SOURCE.NETWORK,
            items: [null, { wrong: true }],
            cacheIds: [],
            expectedSource: REPOSITORY_SOURCE.NETWORK,
            partial: true
        }
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, async () => {
            const athlete = {
                id: 'synthetic-athlete',
                shoes: scenario.items,
                bikes: []
            };
            const cachedIds = new Set(scenario.cacheIds);
            const target = repository({
                connector: connector({
                    async fetchAthlete() {
                        return athlete;
                    },
                    async fetchGear(id) {
                        return { id };
                    }
                }),
                metadataCache: metadataCache({
                    readAthlete: () => (
                        scenario.athleteSource
                        === REPOSITORY_SOURCE.CACHE
                            ? {
                                status: 'hit',
                                data: athlete,
                                expiresAt: 1100
                            }
                            : { status: 'miss' }
                    ),
                    readGear(id) {
                        return cachedIds.has(id)
                            ? { status: 'hit', data: { id } }
                            : { status: 'miss' };
                    }
                })
            });
            const value = await target.getGears();
            assert.equal(value.source, scenario.expectedSource);
            assert.equal(value.partial, scenario.partial);
        });
    }
});

test('complete empty aggregate gears are cached once using athlete source', async () => {
    let writes = 0;
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                return { shoes: [], bikes: [] };
            }
        }),
        metadataCache: metadataCache({
            writeGears(data, options) {
                writes += 1;
                assert.deepEqual(data, []);
                assert.deepEqual(options, { partial: false });
                return { status: 'written' };
            }
        })
    });
    const value = await target.getGears();
    assert.deepEqual(value.data, []);
    assert.equal(value.source, REPOSITORY_SOURCE.NETWORK);
    assert.equal(value.partial, false);
    assert.equal(writes, 1);
});

test('aggregate gear write failure warns without making complete data partial', async () => {
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                return { shoes: [], bikes: [] };
            }
        }),
        metadataCache: metadataCache({
            writeGears: () => ({ status: 'failed' })
        })
    });
    const value = await target.getGears();
    assert.equal(value.partial, false);
    assertWarning(
        value.warnings[0],
        REPOSITORY_WARNING_CODE.CACHE_WRITE_FAILED,
        'getGears'
    );
});

test('duplicate operation warnings are deterministically deduplicated', async () => {
    const target = repository({
        connector: connector({
            async fetchAthlete() {
                return {
                    shoes: ['one'],
                    bikes: ['two']
                };
            }
        }),
        metadataCache: metadataCache({
            readGear: () => ({ status: 'failed' })
        })
    });
    const value = await target.getGears();
    assert.deepEqual(
        value.warnings.filter(
            item => (
                item.code
                === REPOSITORY_WARNING_CODE.CACHE_READ_FAILED
            )
        ),
        [{
            code: REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
            operation: 'getGears',
            retryable: false
        }]
    );
});

test('getGear is per-ID cache-first and never reads aggregate cache', async () => {
    let aggregateReads = 0;
    let perIdReads = 0;
    let network = 0;
    const target = repository({
        connector: connector({
            async fetchGear(id) {
                network += 1;
                return { id };
            }
        }),
        metadataCache: metadataCache({
            readGears() {
                aggregateReads += 1;
                return { status: 'miss' };
            },
            readGear(id) {
                perIdReads += 1;
                return {
                    status: 'hit',
                    data: { id },
                    expiresAt: 1100
                };
            }
        })
    });
    const value = await target.getGear('cached');
    assert.equal(value.source, REPOSITORY_SOURCE.CACHE);
    assert.equal(aggregateReads, 0);
    assert.equal(perIdReads, 1);
    assert.equal(network, 0);
});

test('projection rejects sensitive keys before cache write', async () => {
    let writes = 0;
    const target = repository({
        connector: connector({
            async fetchActivity() {
                return {
                    id: 'synthetic',
                    tokens: { access_token: 'synthetic-secret' }
                };
            },
            async fetchAthlete() {
                return {
                    id: 'synthetic',
                    access_token: 'synthetic-secret',
                    shoes: [],
                    bikes: []
                };
            }
        }),
        metadataCache: metadataCache({
            writeAthlete() {
                writes += 1;
                return { status: 'written' };
            }
        })
    });
    for (const invoke of [
        () => target.getActivity('synthetic'),
        () => target.getAthlete()
    ]) {
        await assert.rejects(invoke(), error => {
            assert.equal(error.code, REPOSITORY_ERROR_CODE.RESPONSE_INVALID);
            assert.doesNotMatch(
                JSON.stringify(error),
                /synthetic-secret|access_token/
            );
            return true;
        });
    }
    assert.equal(writes, 0);
});

test('projection fails closed for accessor, Proxy, cycle, and non-JSON values', async () => {
    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'private', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'must-not-run';
        }
    });
    const proxy = new Proxy({}, {
        ownKeys() {
            throw new Error('synthetic reflection failure');
        }
    });
    const cycle = {};
    cycle.self = cycle;
    for (const invalid of [
        accessor,
        proxy,
        cycle,
        new Date(0),
        { value: undefined },
        { value: 1n },
        { value: Infinity }
    ]) {
        const target = repository({
            connector: connector({
                async fetchActivity() {
                    return invalid;
                }
            })
        });
        await assert.rejects(
            target.getActivity('synthetic'),
            error => error.code === REPOSITORY_ERROR_CODE.RESPONSE_INVALID
        );
    }
    assert.equal(getterCalls, 0);
});

test('projection safely preserves __proto__ and constructor data keys', async () => {
    const data = JSON.parse(
        '{"id":"synthetic","__proto__":{"safe":true},"constructor":"value"}'
    );
    const target = repository({
        connector: connector({
            async fetchActivity() {
                return data;
            }
        })
    });
    const value = await target.getActivity('synthetic');
    assert.equal(Object.getPrototypeOf(value.data), Object.prototype);
    assert.equal(Object.hasOwn(value.data, '__proto__'), true);
    assert.deepEqual(value.data.__proto__, { safe: true });
    assert.equal(value.data.constructor, 'value');
    assert.equal({}.safe, undefined);
});

test('activity cache dependency never calls clearCachedActivities', async () => {
    let clearCalls = 0;
    const cache = activityCache();
    Object.defineProperty(cache, 'clearCachedActivities', {
        enumerable: true,
        get() {
            clearCalls += 1;
            throw new Error('clear must remain unreachable');
        }
    });
    const target = repository({ activityCache: cache });
    await target.listActivities();
    assert.equal(clearCalls, 0);
});
