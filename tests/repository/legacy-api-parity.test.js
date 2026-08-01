import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
);
const API_FILE = path.join(ROOT, 'js/services/api.js');
const API_URL = pathToFileURL(API_FILE).href;
const SYNTHETIC_TOKEN = Object.freeze({
    access_token: 'synthetic-b3-access-token',
    refresh_token: 'synthetic-b3-refresh-token',
    expires_at: 4102444800
});
const RAW_TOKEN = JSON.stringify(SYNTHETIC_TOKEN);
const ENCODED_TOKEN = 'synthetic-b3-encoded-token';
const API_EXPORTS = Object.freeze([
    'API_AUTH_STATUS',
    'ApiResponseError',
    'classifyApiAuthFailure',
    'fetchAllActivities',
    'fetchAllGears',
    'fetchAthleteData',
    'fetchGearById',
    'fetchTrainingZones',
    'getCachedGears',
    'handleApiResponse',
    'renderAthleteProfile',
    'setCachedGears'
]);

let importSequence = 0;

class MemoryStorage {
    constructor(values = {}) {
        this.values = new Map(Object.entries(values));
        this.getCalls = [];
        this.setCalls = [];
        this.removeCalls = [];
        this.throwOnGet = null;
        this.throwOnSet = null;
    }

    getItem(key) {
        this.getCalls.push(key);
        if (this.throwOnGet) throw this.throwOnGet;
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.setCalls.push([key, value]);
        if (this.throwOnSet) throw this.throwOnSet;
        this.values.set(key, value);
    }

    removeItem(key) {
        this.removeCalls.push(key);
        this.values.delete(key);
    }
}

function valueDescriptor(value) {
    return {
        configurable: true,
        writable: true,
        value
    };
}

async function withGlobalDescriptors(descriptors, operation) {
    const originals = new Map(
        Object.keys(descriptors).map(name => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name)
        ])
    );
    try {
        for (const [name, descriptor] of Object.entries(descriptors)) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                ...descriptor
            });
        }
        return await operation();
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
}

function importApi(label) {
    importSequence += 1;
    return import(`${API_URL}?legacy-api-parity=${label}-${importSequence}`);
}

function syntheticResponse({
    status = 200,
    body = { activities: [] },
    jsonError = null,
    counters = null
} = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get() {
                counters && (counters.headerReads += 1);
                return null;
            }
        },
        async json() {
            counters && (counters.jsonReads += 1);
            if (jsonError) throw jsonError;
            return body;
        }
    };
}

function realGlobals({ storage, fetchImpl, btoaImpl } = {}) {
    return {
        localStorage: valueDescriptor(storage || new MemoryStorage({
            strava_tokens: RAW_TOKEN
        })),
        fetch: valueDescriptor(fetchImpl || (async () => syntheticResponse())),
        btoa: valueDescriptor(btoaImpl || (() => ENCODED_TOKEN))
    };
}

async function captureRejection(promise) {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    assert.fail('Expected the promise to reject.');
}

function assertRedacted(error, secret = 'synthetic-b3-secret') {
    const serialized = JSON.stringify(error);
    assert.doesNotMatch(
        serialized,
        new RegExp(`${secret}|Authorization|payload|body|cause|stack`)
    );
}

function relativeImports(source) {
    return [...source.matchAll(
        /(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g
    )].map(match => match[1]).filter(value => value.startsWith('.'));
}

async function javascriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await javascriptFiles(target));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(target);
        }
    }
    return files;
}

test('api.js import and public exports have zero runtime I/O', async () => {
    const names = [
        'fetch',
        'localStorage',
        'indexedDB',
        'btoa',
        'document',
        'window'
    ];
    let accesses = 0;
    const descriptors = Object.fromEntries(names.map(name => [name, {
        get() {
            accesses += 1;
            throw new Error(`prohibited import access: ${name}`);
        }
    }]));

    await withGlobalDescriptors(descriptors, async () => {
        const module = await importApi('zero-io');
        assert.deepEqual(Object.keys(module).sort(), [...API_EXPORTS].sort());
    });
    assert.equal(accesses, 0);
});

test('default Connector construction performs zero runtime I/O', async () => {
    const names = [
        'fetch',
        'localStorage',
        'indexedDB',
        'btoa',
        'document',
        'window'
    ];
    let accesses = 0;
    const descriptors = Object.fromEntries(names.map(name => [name, {
        get() {
            accesses += 1;
            throw new Error(`prohibited constructor access: ${name}`);
        }
    }]));

    await withGlobalDescriptors(descriptors, async () => {
        const { StravaApiConnector } = await import(
            '../../js/connectors/strava/strava-api-connector.js'
        );
        const connector = new StravaApiConnector();
        assert.ok(connector instanceof StravaApiConnector);
    });
    assert.equal(accesses, 0);
});

test('api, Connector, Demo, and Repository graph is acyclic and one-way', async () => {
    const repositoryFiles = await javascriptFiles(
        path.join(ROOT, 'js/repository')
    );
    const connectorFiles = await javascriptFiles(
        path.join(ROOT, 'js/connectors/strava')
    );
    const demoFiles = await javascriptFiles(path.join(ROOT, 'js/demo'));
    const files = [API_FILE, ...repositoryFiles, ...connectorFiles, ...demoFiles];
    const fileSet = new Set(files.map(file => path.resolve(file)));
    const graph = new Map();

    for (const file of files) {
        const source = await readFile(file, 'utf8');
        const imports = relativeImports(source)
            .map(specifier => path.resolve(path.dirname(file), specifier))
            .filter(target => fileSet.has(target));
        graph.set(path.resolve(file), imports);
    }

    const apiSource = await readFile(API_FILE, 'utf8');
    assert.doesNotMatch(apiSource, /(?:\.\.\/)?repository\//);
    for (const file of repositoryFiles) {
        assert.doesNotMatch(await readFile(file, 'utf8'), /services\/api\.js/);
    }

    const visited = new Set();
    const active = new Set();
    function visit(file) {
        assert.equal(
            active.has(file),
            false,
            `circular import detected at ${path.relative(ROOT, file)}`
        );
        if (visited.has(file)) return;
        active.add(file);
        for (const dependency of graph.get(file) || []) visit(dependency);
        active.delete(file);
        visited.add(file);
    }
    for (const file of graph.keys()) visit(file);
});

test('Demo fetchAllActivities reads only the Demo namespace and stays offline', async () => {
    const activities = [
        { id: 'synthetic-demo-activity-b' },
        { id: 'synthetic-demo-activity-a' }
    ];
    const storage = new MemoryStorage({
        strava_demo_mode: 'true',
        strava_demo_activities: JSON.stringify(activities),
        strava_tokens: RAW_TOKEN,
        strava_activities: 'prohibited-real-cache'
    });
    let fetchCalls = 0;
    let btoaCalls = 0;

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async () => {
            fetchCalls += 1;
            throw new Error('Demo must not fetch.');
        },
        btoaImpl: () => {
            btoaCalls += 1;
            throw new Error('Demo must not encode a Token.');
        }
    }), async () => {
        const { fetchAllActivities } = await importApi('demo-activities');
        assert.deepEqual(await fetchAllActivities(), activities);
    });

    assert.equal(fetchCalls, 0);
    assert.equal(btoaCalls, 0);
    assert.deepEqual(storage.getCalls, [
        'strava_demo_mode',
        'strava_demo_activities'
    ]);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(storage.removeCalls, []);
});

test('real fetchAllActivities delegates one exact network-only proxy request', async () => {
    const activities = [
        { id: 'synthetic-activity-z', name: 'Later' },
        { id: 'synthetic-activity-a', name: 'Earlier' }
    ];
    const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
    const fetchCalls = [];
    const encodedInputs = [];

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async (...args) => {
            fetchCalls.push(args);
            return syntheticResponse({ body: { activities } });
        },
        btoaImpl: raw => {
            encodedInputs.push(raw);
            return ENCODED_TOKEN;
        }
    }), async () => {
        const { fetchAllActivities } = await importApi('real-activities');
        const result = await fetchAllActivities();
        assert.deepEqual(result, activities);
        assert.notStrictEqual(result, activities);
        assert.equal(Array.isArray(result), true);
        assert.equal(Object.hasOwn(result, 'data'), false);
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0][0], '/api/strava-activities');
    assert.deepEqual(fetchCalls[0][1], {
        method: 'GET',
        headers: { Authorization: `Bearer ${ENCODED_TOKEN}` }
    });
    assert.doesNotMatch(fetchCalls[0][0], /page|per_page/);
    assert.deepEqual(storage.getCalls, ['strava_demo_mode', 'strava_tokens']);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(storage.removeCalls, []);
    assert.deepEqual(encodedInputs, [RAW_TOKEN]);
});

test('refreshed Token is written exactly once before activities resolve', async () => {
    const refreshed = {
        access_token: 'synthetic-b3-refreshed-access',
        refresh_token: 'synthetic-b3-refreshed-refresh',
        expires_at: 4200000000
    };
    const events = [];
    const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
        events.push('token-write');
        originalSetItem(key, value);
    };

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async () => syntheticResponse({
            body: {
                activities: [{ id: 'synthetic-refreshed-activity' }],
                tokens: refreshed
            }
        })
    }), async () => {
        const { fetchAllActivities } = await importApi('refreshed-token');
        const result = await fetchAllActivities();
        events.push('resolved');
        assert.equal(result[0].id, 'synthetic-refreshed-activity');
    });

    assert.deepEqual(events, ['token-write', 'resolved']);
    assert.deepEqual(storage.setCalls, [[
        'strava_tokens',
        JSON.stringify(refreshed)
    ]]);
});

test('Token write failure cannot return false-success activities', async () => {
    const secret = 'synthetic-b3-token-write-secret';
    const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
    storage.throwOnSet = new Error(secret);

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async () => syntheticResponse({
            body: {
                activities: [{ id: 'must-not-return' }],
                tokens: {
                    access_token: 'synthetic-next-access',
                    refresh_token: 'synthetic-next-refresh',
                    expires_at: 4300000000
                }
            }
        })
    }), async () => {
        const api = await importApi('token-write-failure');
        const error = await captureRejection(api.fetchAllActivities());
        const connector = await import(
            '../../js/connectors/strava/strava-api-connector.js'
        );
        assert.ok(error instanceof connector.StravaConnectorError);
        assert.equal(
            error.code,
            connector.STRAVA_CONNECTOR_ERROR_CODE.TOKEN_WRITE_FAILED
        );
        assertRedacted(error, secret);
    });
    assert.equal(storage.setCalls.length, 1);
});

for (const scenario of [
    {
        status: 401,
        code: 'HTTP_UNAUTHENTICATED',
        authStatus: 'unauthenticated'
    },
    {
        status: 403,
        code: 'HTTP_FORBIDDEN',
        authStatus: 'forbidden'
    }
]) {
    test(`${scenario.status} maps to stable ApiResponseError compatibility`, async () => {
        const secret = `synthetic-b3-${scenario.status}-body-secret`;
        const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
        let jsonReads = 0;

        await withGlobalDescriptors(realGlobals({
            storage,
            fetchImpl: async () => ({
                status: scenario.status,
                headers: { get: () => null },
                async json() {
                    jsonReads += 1;
                    throw new Error(secret);
                }
            })
        }), async () => {
            const api = await importApi(`auth-${scenario.status}`);
            const error = await captureRejection(api.fetchAllActivities());
            assert.ok(error instanceof api.ApiResponseError);
            assert.equal(error.httpStatus, scenario.status);
            assert.equal(error.authStatus, scenario.authStatus);
            assert.equal(
                error.message,
                `Authentication request failed (${scenario.authStatus}).`
            );
            assert.equal(error.cause, undefined);
            assert.equal(error.body, undefined);
            assert.equal(error.payload, undefined);
            assertRedacted(error, secret);
        });
        assert.equal(jsonReads, 0);
    });
}

test('500 remains a provider error and is not refresh or auth failure', async () => {
    const secret = 'synthetic-b3-500-secret';
    let jsonReads = 0;
    await withGlobalDescriptors(realGlobals({
        fetchImpl: async () => ({
            status: 500,
            headers: { get: () => null },
            async json() {
                jsonReads += 1;
                throw new Error(secret);
            }
        })
    }), async () => {
        const api = await importApi('http-500');
        const connector = await import(
            '../../js/connectors/strava/strava-api-connector.js'
        );
        const error = await captureRejection(api.fetchAllActivities());
        assert.ok(error instanceof connector.StravaConnectorError);
        assert.equal(error.code, 'HTTP_SERVER_ERROR');
        assert.equal(error.httpStatus, 500);
        assert.equal(error instanceof api.ApiResponseError, false);
        assert.notEqual(error.authStatus, api.API_AUTH_STATUS.REFRESH_FAILED);
        assertRedacted(error, secret);
    });
    assert.equal(jsonReads, 0);
});

for (const scenario of [
    {
        name: 'network rejection',
        code: 'NETWORK_FAILED',
        fetchImpl: async () => {
            throw new Error('HTTP_UNAUTHENTICATED synthetic-b3-network-secret');
        }
    },
    {
        name: 'invalid JSON',
        code: 'INVALID_JSON',
        fetchImpl: async () => syntheticResponse({
            jsonError: new Error('synthetic-b3-json-secret')
        })
    },
    {
        name: 'invalid envelope',
        code: 'INVALID_ENVELOPE',
        fetchImpl: async () => syntheticResponse({
            body: { unexpected: 'synthetic-b3-envelope-secret' }
        })
    }
]) {
    test(`${scenario.name} is not reclassified as an auth failure`, async () => {
        await withGlobalDescriptors(realGlobals({
            fetchImpl: scenario.fetchImpl
        }), async () => {
            const api = await importApi(`non-auth-${scenario.code}`);
            const connector = await import(
                '../../js/connectors/strava/strava-api-connector.js'
            );
            const error = await captureRejection(api.fetchAllActivities());
            assert.ok(error instanceof connector.StravaConnectorError);
            assert.equal(error.code, scenario.code);
            assert.equal(error instanceof api.ApiResponseError, false);
            assert.equal(error.authStatus, undefined);
            assertRedacted(error);
        });
    });
}

for (const scenario of [
    {
        name: 'absent Token',
        code: 'TOKEN_ABSENT',
        configure(storage) {
            storage.values.delete('strava_tokens');
        }
    },
    {
        name: 'malformed Token',
        code: 'TOKEN_INVALID',
        configure(storage) {
            storage.values.set('strava_tokens', '{synthetic-b3-malformed');
        }
    },
    {
        name: 'Token read failure',
        code: 'TOKEN_READ_FAILED',
        configure(storage) {
            storage.throwOnGet = new Error(
                'HTTP_FORBIDDEN synthetic-b3-read-secret'
            );
        }
    }
]) {
    test(`${scenario.name} uses its stable code without raw-message classification`, async () => {
        const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
        scenario.configure(storage);
        let fetchCalls = 0;
        await withGlobalDescriptors(realGlobals({
            storage,
            fetchImpl: async () => {
                fetchCalls += 1;
                return syntheticResponse();
            }
        }), async () => {
            const api = await importApi(`token-${scenario.code}`);
            const connector = await import(
                '../../js/connectors/strava/strava-api-connector.js'
            );
            const error = await captureRejection(api.fetchAllActivities());
            assert.ok(error instanceof connector.StravaConnectorError);
            assert.equal(error.code, scenario.code);
            assert.equal(error instanceof api.ApiResponseError, false);
            assertRedacted(error);
        });
        assert.equal(fetchCalls, 0);
    });
}

test('Token encoding failure uses a stable redacted non-auth error', async () => {
    const secret = 'synthetic-b3-encoding-secret';
    let fetchCalls = 0;
    await withGlobalDescriptors(realGlobals({
        btoaImpl: () => {
            throw new Error(`HTTP_UNAUTHENTICATED ${secret}`);
        },
        fetchImpl: async () => {
            fetchCalls += 1;
            return syntheticResponse();
        }
    }), async () => {
        const api = await importApi('token-encoding');
        const connector = await import(
            '../../js/connectors/strava/strava-api-connector.js'
        );
        const error = await captureRejection(api.fetchAllActivities());
        assert.ok(error instanceof connector.StravaConnectorError);
        assert.equal(error.code, 'TOKEN_ENCODING_FAILED');
        assert.equal(error instanceof api.ApiResponseError, false);
        assertRedacted(error, secret);
    });
    assert.equal(fetchCalls, 0);
});

test('fetchAllActivities owns no cache, pagination, sorting, or Repository work', async () => {
    const source = await readFile(API_FILE, 'utf8');
    const start = source.indexOf('export async function fetchAllActivities');
    const end = source.indexOf('export async function fetchGearById', start);
    const facade = source.slice(start, end);

    assert.match(facade, /new StravaApiConnector\(\)\.fetchActivities\(\)/);
    assert.doesNotMatch(
        facade,
        /getFromCache|saveToCache|strava_activities|timestamp|version|sort\s*\(|page|per_page|LegacyRepository|listActivities|createRepository/
    );
    assert.doesNotMatch(source, /activity-cache\.js|repository\/index\.js/);
});

test('real fetchAllGears preserves shoes-before-bikes, duplicates, and partial order', async () => {
    const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
    const requestedIds = [];
    const athlete = {
        shoes: [
            { id: 'shoe-a' },
            'duplicate-gear',
            { id: 'rejected-gear' },
            null
        ],
        bikes: [
            { id: 'bike-a' },
            { id: 'duplicate-gear' },
            { id: 'null-gear' }
        ]
    };

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async url => {
            assert.match(url, /^\/api\/strava-gear\?id=/);
            const id = decodeURIComponent(url.split('=')[1]);
            requestedIds.push(id);
            if (id === 'rejected-gear') {
                return syntheticResponse({ status: 500 });
            }
            if (id === 'null-gear') {
                return syntheticResponse({ body: { gear: null } });
            }
            return syntheticResponse({ body: { gear: { id } } });
        }
    }), async () => {
        const { fetchAllGears } = await importApi('gear-partial');
        const result = await fetchAllGears(athlete);
        assert.deepEqual(result.map(gear => gear.id), [
            'shoe-a',
            'duplicate-gear',
            'bike-a',
            'duplicate-gear'
        ]);
        assert.equal(Array.isArray(result), true);
        assert.equal(Object.hasOwn(result, 'warnings'), false);
        assert.equal(Object.hasOwn(result, 'source'), false);
        assert.equal(Object.hasOwn(result, 'partial'), false);
    });

    assert.deepEqual(requestedIds, [
        'shoe-a',
        'duplicate-gear',
        'rejected-gear',
        'bike-a',
        'duplicate-gear',
        'null-gear'
    ]);
    assert.equal(requestedIds.includes('athlete'), false);
});

test('real fetchAllGears with no valid IDs performs zero Token and network I/O', async () => {
    const storage = new MemoryStorage({ strava_tokens: RAW_TOKEN });
    let fetchCalls = 0;
    let btoaCalls = 0;
    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async () => {
            fetchCalls += 1;
            return syntheticResponse();
        },
        btoaImpl: () => {
            btoaCalls += 1;
            return ENCODED_TOKEN;
        }
    }), async () => {
        const { fetchAllGears } = await importApi('gear-empty');
        assert.deepEqual(await fetchAllGears({
            shoes: [null, {}, ''],
            bikes: []
        }), []);
    });

    assert.equal(fetchCalls, 0);
    assert.equal(btoaCalls, 0);
    assert.deepEqual(storage.getCalls, ['strava_demo_mode']);
});

test('Demo fetchAllGears returns Demo gears with zero real I/O', async () => {
    const gears = [
        { id: 'synthetic-demo-shoe' },
        { id: 'synthetic-demo-bike' }
    ];
    const storage = new MemoryStorage({
        strava_demo_mode: 'true',
        strava_demo_gears: JSON.stringify(gears),
        strava_tokens: RAW_TOKEN,
        strava_gears: 'prohibited-real-gears'
    });
    let fetchCalls = 0;
    let btoaCalls = 0;

    await withGlobalDescriptors(realGlobals({
        storage,
        fetchImpl: async () => {
            fetchCalls += 1;
            throw new Error('Demo gear path must be offline.');
        },
        btoaImpl: () => {
            btoaCalls += 1;
            throw new Error('Demo gear path must not encode a Token.');
        }
    }), async () => {
        const { fetchAllGears } = await importApi('gear-demo');
        assert.deepEqual(await fetchAllGears({
            shoes: [{ id: 'prohibited-real-shoe' }]
        }), gears);
    });

    assert.equal(fetchCalls, 0);
    assert.equal(btoaCalls, 0);
    assert.deepEqual(storage.getCalls, [
        'strava_demo_mode',
        'strava_demo_gears'
    ]);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(storage.removeCalls, []);
});

test('fetchAllGears remains a Legacy facade with no Repository dependency', async () => {
    const source = await readFile(API_FILE, 'utf8');
    const start = source.indexOf('export async function fetchAllGears');
    const end = source.indexOf('export function getCachedGears', start);
    const facade = source.slice(start, end);

    assert.match(facade, /Promise\.allSettled/);
    assert.match(facade, /athlete\.shoes/);
    assert.match(facade, /athlete\.bikes/);
    assert.doesNotMatch(
        facade,
        /createRepository|LegacyRepository|DemoRepository|getAthlete|getGears|new StravaApiConnector/
    );
});
