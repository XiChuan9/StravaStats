import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REDACTED_CLIENT_PATHS = Object.freeze([
    'js/analysis/analyzers/index.js',
    'js/models/climb.js',
    'js/services/api.js',
    'js/services/activity-cache.js',
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
        ['nsm-serialization', /JSON\.stringify\s*\(\s*summary\s*\)/]
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
