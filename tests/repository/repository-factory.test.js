import assert from 'node:assert/strict';
import test from 'node:test';

import { DemoRepository } from '../../js/repository/demo/demo-repository.js';
import { CanonicalRepository } from '../../js/repository/canonical/canonical-repository.js';
import {
    REPOSITORY_ERROR_CODE,
    RepositoryError
} from '../../js/repository/errors.js';
import {
    createRepository,
    createRepositoryWithDependencies
} from '../../js/repository/factory.js';
import { LegacyRepository } from '../../js/repository/legacy/legacy-repository.js';

function demoProvider() {
    return {
        getActivities: () => [],
        getAthlete: () => null,
        getZones: () => null,
        getGears: () => []
    };
}

function connector() {
    return {
        fetchActivities: async () => [],
        fetchActivity: async () => ({ id: 'synthetic' }),
        fetchStreams: async () => ({}),
        fetchAthlete: async () => ({ shoes: [], bikes: [] }),
        fetchZones: async () => ({}),
        fetchGear: async () => ({ id: 'synthetic' })
    };
}

function metadataCache() {
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
        writeGear: written
    };
}

function realDependencies(overrides = {}) {
    return {
        connectorFactory: () => connector(),
        activityCache: {
            getCachedActivities: async () => null,
            saveCachedActivities: async () => true
        },
        metadataCacheFactory: () => metadataCache(),
        demoProvider: demoProvider(),
        canonicalStoreFactory: () => ({
            async initialize() {},
            async listActivities() { return []; }
        }),
        now: () => 1000,
        ...overrides
    };
}

test('Factory creates the real LegacyRepository for real/legacy', () => {
    let connectorConstructions = 0;
    let cacheConstructions = 0;
    const repository = createRepositoryWithDependencies(
        { sessionMode: 'real', mode: 'legacy' },
        realDependencies({
            connectorFactory() {
                connectorConstructions += 1;
                return connector();
            },
            metadataCacheFactory() {
                cacheConstructions += 1;
                return metadataCache();
            }
        })
    );
    assert.ok(repository instanceof LegacyRepository);
    assert.equal(connectorConstructions, 1);
    assert.equal(cacheConstructions, 1);
});

test('Factory creates DemoRepository without constructing real dependencies', () => {
    let connectorConstructions = 0;
    let cacheConstructions = 0;
    let canonicalConstructions = 0;
    const repository = createRepositoryWithDependencies(
        { sessionMode: 'demo', mode: 'canonical' },
        realDependencies({
            connectorFactory() {
                connectorConstructions += 1;
                throw new Error('must not construct connector');
            },
            metadataCacheFactory() {
                cacheConstructions += 1;
                throw new Error('must not construct cache');
            },
            canonicalStoreFactory() {
                canonicalConstructions += 1;
                throw new Error('must not construct canonical store');
            }
        })
    );
    assert.ok(repository instanceof DemoRepository);
    assert.equal(connectorConstructions, 0);
    assert.equal(cacheConstructions, 0);
    assert.equal(canonicalConstructions, 0);
});

test('Factory creates a lazy CanonicalRepository for real/canonical', async () => {
    let canonicalConstructions = 0;
    let connectorConstructions = 0;
    let cacheConstructions = 0;
    const repository = createRepositoryWithDependencies(
        { sessionMode: 'real', mode: 'canonical' },
        realDependencies({
            canonicalStoreFactory() {
                canonicalConstructions += 1;
                return {
                    async initialize() {},
                    async listActivities() { return []; }
                };
            },
            connectorFactory() {
                connectorConstructions += 1;
                throw new Error('must not construct connector');
            },
            metadataCacheFactory() {
                cacheConstructions += 1;
                throw new Error('must not construct cache');
            }
        })
    );
    assert.ok(repository instanceof CanonicalRepository);
    assert.equal(canonicalConstructions, 0);
    assert.equal(connectorConstructions, 0);
    assert.equal(cacheConstructions, 0);
    const result = await repository.listActivities();
    assert.equal(result.source, 'canonical');
    assert.equal(canonicalConstructions, 1);
    assert.equal(connectorConstructions, 0);
    assert.equal(cacheConstructions, 0);
});

test('Factory requires an explicit valid sessionMode', () => {
    for (const options of [
        {},
        { sessionMode: 'unknown' },
        { sessionMode: null },
        { sessionMode: true }
    ]) {
        assert.throws(
            () => createRepositoryWithDependencies(
                options,
                realDependencies()
            ),
            error => (
                error instanceof RepositoryError
                && error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            )
        );
    }
});

test('Factory supports only legacy and canonical modes', () => {
    for (const mode of ['v2', 'shadow', 'unknown']) {
        assert.throws(
            () => createRepositoryWithDependencies(
                { sessionMode: 'real', mode },
                realDependencies()
            ),
            error => (
                error instanceof RepositoryError
                && error.code === REPOSITORY_ERROR_CODE.UNSUPPORTED_MODE
            )
        );
    }
});

test('Factory rejects unknown, accessor, non-enumerable, symbol, and Proxy options', () => {
    let getterCalls = 0;
    const accessor = { sessionMode: 'demo' };
    Object.defineProperty(accessor, 'mode', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'legacy';
        }
    });
    const nonEnumerable = { sessionMode: 'demo' };
    Object.defineProperty(nonEnumerable, 'mode', {
        enumerable: false,
        value: 'legacy'
    });
    const symbol = { sessionMode: 'demo' };
    symbol[Symbol('mode')] = 'legacy';
    const proxy = new Proxy({}, {
        ownKeys() {
            throw new Error('synthetic reflection failure');
        }
    });

    for (const options of [
        { sessionMode: 'demo', unknown: true },
        accessor,
        nonEnumerable,
        symbol,
        proxy
    ]) {
        assert.throws(
            () => createRepositoryWithDependencies(
                options,
                realDependencies()
            ),
            error => (
                error instanceof RepositoryError
                && error.code === REPOSITORY_ERROR_CODE.INVALID_REQUEST
            )
        );
    }
    assert.equal(getterCalls, 0);
});

test('Factory accepts deeply frozen input without mutation', () => {
    const options = Object.freeze({
        sessionMode: 'demo',
        mode: 'legacy'
    });
    const dependencies = Object.freeze(realDependencies());
    const repository = createRepositoryWithDependencies(
        options,
        dependencies
    );
    assert.ok(repository instanceof DemoRepository);
    assert.deepEqual(options, {
        sessionMode: 'demo',
        mode: 'legacy'
    });
});

test('Factory import and default construction perform zero I/O', async () => {
    const names = [
        'fetch',
        'localStorage',
        'indexedDB',
        'document',
        'btoa'
    ];
    const originals = new Map(
        names.map(name => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name)
        ])
    );
    let accesses = 0;
    try {
        for (const name of names) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    accesses += 1;
                    throw new Error('I/O must remain lazy');
                }
            });
        }
        const url = new URL(
            '../../js/repository/factory.js',
            import.meta.url
        );
        const module = await import(`${url.href}?lazy=${Date.now()}`);
        const demo = module.createRepository({ sessionMode: 'demo' });
        const real = module.createRepository({ sessionMode: 'real' });
        const canonical = module.createRepository({
            sessionMode: 'real',
            mode: 'canonical'
        });
        assert.ok(demo instanceof DemoRepository);
        assert.ok(real instanceof LegacyRepository);
        assert.ok(canonical instanceof CanonicalRepository);
        assert.equal(accesses, 0);
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

test('public createRepository defaults mode to legacy', () => {
    const repository = createRepository({ sessionMode: 'demo' });
    assert.ok(repository instanceof DemoRepository);
});
