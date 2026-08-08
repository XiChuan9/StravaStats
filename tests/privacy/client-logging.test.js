import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REDACTED_CLIENT_PATHS = Object.freeze([
    'js/analysis/analyzers/index.js',
    'js/models/climb.js',
    'js/services/api.js',
    'js/services/activity-cache.js',
    'js/app/weather-consent.js',
    'js/shared/preprocessing/core.js',
    'js/shared/utils/weather-analysis.js',
    'js/tabs/athlete.js',
    'js/tabs/bike-analysis.js',
    'js/tabs/run-analysis.js',
    'js/tabs/run-plus.js',
    'js/tabs/weather.js'
]);

const CONSOLE_SINK = /\bconsole\s*\.\s*(?:log|info|warn|error|debug)\s*\(/;
const FIXED_CLIENT_EVENTS = Object.freeze(new Map([
    [
        'js/services/activity-cache.js',
        Object.freeze([
            "console.warn('Failed to fully restore the previous localStorage activity cache:');"
        ])
    ]
]));

async function source(path) {
    return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function restoreGlobal(name, descriptor) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
}

function hostileThrownValue(counter) {
    const target = Object.create(null);
    for (const key of ['message', 'stack', 'cause', 'name']) {
        Object.defineProperty(target, key, {
            configurable: true,
            get() {
                counter.getters += 1;
                throw new Error('SYNTHETIC_GETTER_BLOCKED');
            }
        });
    }
    target[Symbol.toPrimitive] = () => {
        counter.coercions += 1;
        throw new Error('SYNTHETIC_COERCION_BLOCKED');
    };
    return new Proxy(target, {
        get(inner, key, receiver) {
            if (typeof key !== 'symbol') counter.proxyGets += 1;
            return Reflect.get(inner, key, receiver);
        },
        ownKeys(inner) {
            counter.ownKeys += 1;
            return Reflect.ownKeys(inner);
        },
        getOwnPropertyDescriptor(inner, key) {
            counter.descriptors += 1;
            return Reflect.getOwnPropertyDescriptor(inner, key);
        }
    });
}

test('R5 production responsibility paths contain no browser console sink', async () => {
    const entries = await Promise.all(REDACTED_CLIENT_PATHS.map(async path => ({
        path,
        text: FIXED_CLIENT_EVENTS.get(path)?.reduce(
            (remaining, event) => remaining.replace(event, ''),
            await source(path)
        ) ?? await source(path)
    })));

    const findingPaths = entries
        .filter(entry => CONSOLE_SINK.test(entry.text))
        .map(entry => entry.path);

    assert.deepEqual(findingPaths, [], 'CLIENT_CONSOLE_SINKS_PRESENT');
});

test('Run Plus does not publish private diagnostics through DOM or window debug surfaces', async () => {
    const text = await source('js/tabs/run-plus.js');
    const patterns = new Map([
        ['diagnostics-property', /\.runPlusDiagnostics\s*=/],
        ['nsm-property', /\.runPlusNsm\s*=/],
        ['diagnostics-dataset', /dataset\.runPlusDiagnostics\s*=/],
        ['nsm-dataset', /dataset\.runPlusNsm\s*=/],
        ['diagnostics-serialization', /JSON\.stringify\s*\(\s*diagnostics\s*\)/],
        ['nsm-serialization', /JSON\.stringify\s*\(\s*summary\s*\)/],
        ['run-plus-window-publication', /window\.runPlus[A-Za-z0-9_$]*\s*=/],
        ['computed-window-publication', /window\s*\[\s*key\s*\]/]
    ]);
    const findings = [...patterns]
        .filter(([, pattern]) => pattern.test(text))
        .map(([category]) => category);

    assert.deepEqual(findings, [], 'CLIENT_DEBUG_EXPOSURE_PRESENT');
});

test('Legacy cache hostile failures recover without console output or thrown-value inspection', async () => {
    const descriptors = new Map([
        ['console', Object.getOwnPropertyDescriptor(globalThis, 'console')],
        ['fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch')],
        ['indexedDB', Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')],
        ['localStorage', Object.getOwnPropertyDescriptor(globalThis, 'localStorage')]
    ]);
    const calls = [];
    let networkCalls = 0;
    const counter = {
        getters: 0,
        coercions: 0,
        proxyGets: 0,
        ownKeys: 0,
        descriptors: 0
    };
    const hostile = hostileThrownValue(counter);
    const storage = {
        getItem() {
            throw hostile;
        },
        setItem() {
            throw hostile;
        },
        removeItem() {
            throw hostile;
        }
    };

    Object.defineProperty(globalThis, 'console', {
        configurable: true,
        value: Object.freeze({
            log: (...args) => calls.push(args.length),
            info: (...args) => calls.push(args.length),
            warn: (...args) => calls.push(args.length),
            error: (...args) => calls.push(args.length),
            debug: (...args) => calls.push(args.length)
        })
    });
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: undefined
    });
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: storage
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: () => {
            networkCalls += 1;
            throw new Error('SYNTHETIC_NETWORK_BLOCKED');
        }
    });

    try {
        const module = await import(`../../js/services/activity-cache.js?r5=${Date.now()}`);
        assert.equal(await module.getCachedActivities(), null);
        assert.equal(await module.saveCachedActivities(Object.freeze([]), 'synthetic-version'), false);
        await module.clearCachedActivities();

        const revoked = Proxy.revocable(Object.create(null), Object.create(null));
        revoked.revoke();
        storage.getItem = () => { throw revoked.proxy; };
        storage.setItem = () => { throw revoked.proxy; };
        storage.removeItem = () => { throw revoked.proxy; };
        assert.equal(await module.getCachedActivities(), null);
        assert.equal(await module.saveCachedActivities(Object.freeze([]), 'synthetic-version'), false);
        await module.clearCachedActivities();

        assert.deepEqual(calls, [], 'CLIENT_CONSOLE_OUTPUT_PRESENT');
        assert.equal(networkCalls, 0, 'CLIENT_NETWORK_OUTPUT_PRESENT');
        assert.deepEqual(counter, {
            getters: 0,
            coercions: 0,
            proxyGets: 0,
            ownKeys: 0,
            descriptors: 0
        }, 'HOSTILE_THROWN_VALUE_INSPECTED');
    } finally {
        for (const [name, descriptor] of descriptors) restoreGlobal(name, descriptor);
    }
});

test('Weather render success, failure, and hostile inputs keep output inside fixed DOM copy', async () => {
    const names = ['console', 'document', 'fetch', 'localStorage', 'sessionStorage', 'window'];
    const descriptors = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const consoleCalls = [];
    const storageCalls = [];
    const windowWrites = [];
    const bodyWrites = [];
    let networkCalls = 0;
    const hostileCounter = {
        getters: 0,
        coercions: 0,
        proxyGets: 0,
        ownKeys: 0,
        descriptors: 0
    };
    const hostile = hostileThrownValue(hostileCounter);
    const body = {
        querySelectorAll() {
            return [];
        },
        set innerHTML(value) {
            if (value.includes('weather-tabs')) bodyWrites.push('populated');
            else if (value.includes('Allow for this tab')) bodyWrites.push('consent');
            else if (value.includes('Loading weather analysis')) bodyWrites.push('loading');
            else if (value.includes('No weather data available')) bodyWrites.push('no-data');
            else if (value.includes('Weather analysis could not be loaded')) bodyWrites.push('failed');
            else bodyWrites.push('unexpected');
        }
    };
    const section = {
        classList: Object.freeze({
            add() {},
            remove() {}
        }),
        querySelector(selector) {
            return selector === '.weather-analysis__body' ? body : null;
        }
    };
    const storage = Object.freeze({
        getItem() {
            storageCalls.push('get');
            return null;
        },
        setItem() {
            storageCalls.push('set');
        },
        removeItem() {
            storageCalls.push('remove');
        }
    });

    Object.defineProperty(globalThis, 'console', {
        configurable: true,
        value: Object.freeze({
            log: (...args) => consoleCalls.push(args.length),
            info: (...args) => consoleCalls.push(args.length),
            warn: (...args) => consoleCalls.push(args.length),
            error: (...args) => consoleCalls.push(args.length),
            debug: (...args) => consoleCalls.push(args.length)
        })
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: Object.freeze({
            getElementById(id) {
                return id === 'weather-analysis-section' ? section : null;
            }
        })
    });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: new Proxy(Object.create(null), {
            set(target, key, value) {
                windowWrites.push(typeof key === 'string' ? key : 'symbol');
                return Reflect.set(target, key, value);
            }
        })
    });

    try {
        const module = await import('../../js/shared/utils/weather-analysis.js?r5-weather-runtime=1');
        const activity = Object.freeze({
            id: 'synthetic-activity',
            moving_time: 60,
            start_date_local: '2030-01-01T00:00:00.000Z'
        });
        const successCoords = Object.freeze([
            Object.freeze([1, 1]),
            Object.freeze([1.1, 1.1])
        ]);
        const noDataCoords = Object.freeze([
            Object.freeze([2, 2]),
            Object.freeze([2.1, 2.1])
        ]);
        const hostileCoords = Object.freeze([
            Object.freeze([3, 3]),
            Object.freeze([3.1, 3.1])
        ]);

        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            value: () => {
                networkCalls += 1;
                return Promise.resolve(Object.freeze({
                    ok: true,
                    json: async () => Object.freeze({
                        hourly: Object.freeze({
                            time: Object.freeze(['2030-01-01T00:00:00.000Z']),
                            temperature_2m: Object.freeze([10]),
                            precipitation: Object.freeze([0]),
                            wind_speed_10m: Object.freeze([5]),
                            wind_direction_10m: Object.freeze([90]),
                            weathercode: Object.freeze([0]),
                            relativehumidity_2m: Object.freeze([50]),
                            cloudcover: Object.freeze([10]),
                            surface_pressure: Object.freeze([1000])
                        })
                    })
                }));
            }
        });
        await module.renderWeatherAnalysis(activity, successCoords);

        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            value: () => {
                networkCalls += 1;
                return Promise.resolve(Object.freeze({ ok: false }));
            }
        });
        await module.renderWeatherAnalysis(activity, noDataCoords);

        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            value: () => {
                networkCalls += 1;
                throw hostile;
            }
        });
        await module.renderWeatherAnalysis(activity, hostileCoords);

        const revoked = Proxy.revocable(Object.create(null), Object.create(null));
        revoked.revoke();
        await module.renderWeatherAnalysis(revoked.proxy, hostileCoords);

        assert.equal(networkCalls, 0, 'WEATHER_DEFAULT_DENY_NETWORK_PRESENT');
        assert.deepEqual(consoleCalls, [], 'WEATHER_CONSOLE_OUTPUT_PRESENT');
        assert.equal(storageCalls.every(value => value === 'get'), true,
            'WEATHER_DENIED_STORAGE_MUTATION_PRESENT');
        assert.deepEqual(windowWrites, [], 'WEATHER_WINDOW_OUTPUT_PRESENT');
        assert.deepEqual(hostileCounter, {
            getters: 0,
            coercions: 0,
            proxyGets: 0,
            ownKeys: 0,
            descriptors: 0
        }, 'WEATHER_THROWN_VALUE_INSPECTED');
        assert.deepEqual(bodyWrites, [
            'consent',
            'consent',
            'consent',
            'failed'
        ], 'WEATHER_DOM_OUTPUT_CHANGED');
    } finally {
        for (const [name, descriptor] of descriptors) restoreGlobal(name, descriptor);
    }
});

test('Run Plus synthetic render creates no window or DOM debug publication', async () => {
    const names = ['document', 'localStorage', 'sessionStorage', 'window'];
    const descriptors = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const windowWrites = [];
    const storageWrites = [];
    const root = {
        dataset: Object.create(null),
        innerHTML: '',
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
    const storage = Object.freeze({
        getItem() {
            return null;
        },
        setItem(key) {
            storageWrites.push(key);
        },
        removeItem(key) {
            storageWrites.push(key);
        }
    });
    const windowTarget = {
        history: Object.freeze({ pushState() {} }),
        location: Object.freeze({ pathname: '/run-plus' }),
        print() {}
    };

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: Object.freeze({
            body: Object.freeze({
                appendChild() {},
                removeChild() {}
            }),
            createElement() {
                let text = '';
                return {
                    get innerHTML() {
                        return text;
                    },
                    set textContent(value) {
                        text = String(value ?? '');
                    }
                };
            },
            getElementById(id) {
                return id === 'run-plus-tab' ? root : null;
            }
        })
    });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: new Proxy(windowTarget, {
            set(target, key, value) {
                windowWrites.push(typeof key === 'string' ? key : 'symbol');
                return Reflect.set(target, key, value);
            }
        })
    });

    try {
        const module = await import('../../js/tabs/run-plus.js?r5-run-plus-runtime=1');
        module.renderRunPlusTab(Object.freeze([]), null, null, 'all');
        assert.deepEqual(windowWrites, [], 'RUN_PLUS_WINDOW_OUTPUT_PRESENT');
        assert.deepEqual(Object.keys(root.dataset), [], 'RUN_PLUS_DATASET_OUTPUT_PRESENT');
        assert.deepEqual(storageWrites, [], 'RUN_PLUS_STORAGE_OUTPUT_PRESENT');
        assert.equal(root.innerHTML.length > 0, true, 'RUN_PLUS_RENDER_DID_NOT_EXECUTE');
    } finally {
        for (const [name, descriptor] of descriptors) restoreGlobal(name, descriptor);
    }
});
