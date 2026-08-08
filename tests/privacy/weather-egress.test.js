import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const CONSENT_KEY = 'stravastats_weather_egress_consent_v1';
const HOURLY_FIELDS = [
    'temperature_2m',
    'precipitation',
    'wind_speed_10m',
    'wind_direction_10m',
    'weathercode',
    'cloudcover',
    'surface_pressure',
    'relativehumidity_2m'
];

async function source(relativePath) {
    return readFile(new URL(relativePath, projectRoot), 'utf8');
}

class MemoryStorage {
    constructor(values = {}) {
        this.values = new Map(Object.entries(values));
        this.reads = [];
        this.writes = [];
    }

    getItem(key) {
        this.reads.push(key);
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.writes.push([key, value]);
        this.values.set(key, String(value));
    }
}

function hourly(overrides = {}) {
    return {
        time: ['2031-02-03T04:00'],
        temperature_2m: [0],
        precipitation: [0],
        wind_speed_10m: [0],
        wind_direction_10m: [0],
        weathercode: [0],
        cloudcover: [0],
        surface_pressure: [0],
        relativehumidity_2m: [0],
        ...overrides
    };
}

function okResponse(hourlyValue = hourly()) {
    return {
        ok: true,
        async json() {
            return { hourly: hourlyValue };
        }
    };
}

async function consentModule(tag) {
    return import(`../../js/app/weather-consent.js?weather-egress=${tag}`);
}

function serviceDependencies(overrides = {}) {
    return {
        storage: new MemoryStorage(),
        fetch: async () => okResponse(),
        now: () => 1_000,
        setTimeout,
        clearTimeout,
        AbortController,
        ...overrides
    };
}

const VALID_INPUT = Object.freeze({
    coordinate: Object.freeze([12.3456, -98.7654]),
    startDateLocal: '2031-02-03T04:05:06'
});

test('the single weather egress owner is the consent boundary', async () => {
    const entries = await Promise.all([
        'js/app/weather-consent.js',
        'js/shared/preprocessing/core.js',
        'js/shared/utils/weather-analysis.js',
        'js/tabs/weather.js'
    ].map(async relativePath => [relativePath, await source(relativePath)]));
    const owners = entries
        .filter(([, value]) => value.includes('archive-api.open-meteo.com'))
        .map(([relativePath]) => relativePath);
    assert.deepEqual(owners, ['js/app/weather-consent.js']);

    const consentSource = new Map(entries).get('js/app/weather-consent.js');
    assert.match(consentSource, /sessionStorage/);
    assert.match(consentSource, new RegExp(CONSENT_KEY));
    assert.doesNotMatch(consentSource, /localStorage|indexedDB|serviceWorker|caches\s*\./);
});

test('ordinary preprocessing never fetches weather for Real or Demo-shaped activities', async () => {
    const priorFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    let fetches = 0;
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async () => {
            fetches += 1;
            return okResponse();
        }
    });
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: new MemoryStorage({ strava_demo_mode: 'false' })
    });

    try {
        const { preprocessActivities } = await import(
            `../../js/shared/preprocessing/core.js?root-zero-egress=${Date.now()}`
        );
        for (const id of ['opaque-real', 'opaque-demo-shaped']) {
            const activity = {
                id,
                name: 'Synthetic Run',
                type: 'Run',
                sport_type: 'Run',
                start_date_local: '2031-02-03T04:05:06',
                start_latlng: [12.3456, -98.7654],
                distance: 5000,
                moving_time: 1500,
                elapsed_time: 1510,
                average_heartrate: 150
            };
            const processed = await preprocessActivities([activity], {}, null, []);
            assert.equal(processed[0], activity);
        }
        assert.equal(fetches, 0);
    } finally {
        if (priorFetch) Object.defineProperty(globalThis, 'fetch', priorFetch);
        else delete globalThis.fetch;
        if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
        else delete globalThis.localStorage;
    }
});

test('absent or malformed session consent denies before fetch', async () => {
    const { createWeatherConsentService } = await consentModule('deny');
    for (const stored of [
        undefined,
        'true',
        '{"version":1,"granted":"true"}',
        '{"version":2,"granted":true}',
        '{"version":1,"granted":true,"extra":1}',
        '{not-json'
    ]) {
        const storage = new MemoryStorage(
            stored === undefined ? {} : { [CONSENT_KEY]: stored }
        );
        let fetches = 0;
        const service = createWeatherConsentService(serviceDependencies({
            storage,
            fetch: async () => {
                fetches += 1;
                return okResponse();
            }
        }));
        assert.equal(service.isGranted(), false);
        assert.equal(await service.request(VALID_INPUT), null);
        assert.equal(fetches, 0);
    }
});

test('grant uses the exact versioned session key and revoke records denial', async () => {
    const { createWeatherConsentService } = await consentModule('state');
    const storage = new MemoryStorage();
    const service = createWeatherConsentService(serviceDependencies({ storage }));

    assert.equal(service.grant(), true);
    assert.equal(storage.values.get(CONSENT_KEY), '{"version":1,"granted":true}');
    assert.equal(service.isGranted(), true);
    service.revoke();
    assert.equal(storage.values.get(CONSENT_KEY), '{"version":1,"granted":false}');
    assert.equal(service.isGranted(), false);
});

test('authorized request sends only rounded point, one date, and frozen fields', async () => {
    const { createWeatherConsentService } = await consentModule('shape');
    const calls = [];
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async (url, options) => {
            calls.push({ url: String(url), options });
            return okResponse();
        }
    }));
    service.grant();
    const result = await service.request({
        ...VALID_INPUT,
        activityId: 'opaque/id?private',
        name: 'PRIVATE_NAME_CANARY',
        route: [[1, 2], [3, 4]],
        token: 'PRIVATE_TOKEN_CANARY',
        heartrate: 177,
        power: 333
    });

    assert.equal(calls.length, 1);
    const parsed = new URL(calls[0].url);
    assert.equal(parsed.origin, 'https://archive-api.open-meteo.com');
    assert.equal(parsed.pathname, '/v1/archive');
    assert.equal(parsed.searchParams.get('latitude'), '12.35');
    assert.equal(parsed.searchParams.get('longitude'), '-98.77');
    assert.equal(parsed.searchParams.get('start_date'), '2031-02-03');
    assert.equal(parsed.searchParams.get('end_date'), '2031-02-03');
    assert.equal(parsed.searchParams.get('timezone'), 'auto');
    assert.deepEqual(parsed.searchParams.get('hourly').split(','), HOURLY_FIELDS);
    assert.deepEqual([...parsed.searchParams.keys()].sort(), [
        'end_date', 'hourly', 'latitude', 'longitude', 'start_date', 'timezone'
    ]);
    assert.doesNotMatch(calls[0].url, /opaque|PRIVATE|token|heartrate|power|route/i);
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
    assert.deepEqual(result, {
        temperature: 0,
        precipitation: 0,
        wind_speed: 0,
        wind_direction: 0,
        weather_code: 0,
        humidity: 0,
        cloudcover: 0,
        pressure: 0,
        weather_time: '2031-02-03T04:00'
    });
});

test('only literal finite hourly numbers are present and genuine zero survives', async () => {
    const { createWeatherConsentService } = await consentModule('missing');
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async () => okResponse(hourly({
            temperature_2m: [0],
            precipitation: [null],
            wind_speed_10m: ['0'],
            wind_direction_10m: [Number.NaN],
            weathercode: [Number.POSITIVE_INFINITY],
            cloudcover: [undefined],
            surface_pressure: [undefined],
            relativehumidity_2m: [-0]
        }))
    }));
    service.grant();
    assert.deepEqual(await service.request(VALID_INPUT), {
        temperature: 0,
        precipitation: null,
        wind_speed: null,
        wind_direction: null,
        weather_code: null,
        humidity: -0,
        cloudcover: null,
        pressure: null,
        weather_time: '2031-02-03T04:00'
    });
});

test('daily cache selects the requested hour without cross-hour reuse', async () => {
    const { createWeatherConsentService } = await consentModule('cache-hour');
    let fetches = 0;
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async () => {
            fetches += 1;
            return okResponse({
                time: ['2031-02-03T04:00', '2031-02-03T15:00'],
                temperature_2m: [4, 15],
                precipitation: [0, 0],
                wind_speed_10m: [0, 0],
                wind_direction_10m: [0, 0],
                weathercode: [0, 0],
                cloudcover: [0, 0],
                surface_pressure: [1000, 1000],
                relativehumidity_2m: [50, 50]
            });
        }
    }));
    service.grant();
    assert.equal((await service.request(VALID_INPUT)).temperature, 4);
    assert.equal((await service.request({
        ...VALID_INPUT,
        startDateLocal: '2031-02-03T15:05:06'
    })).temperature, 15);
    assert.equal(fetches, 1);
});

test('invalid coordinates and dates fail closed before fetch', async () => {
    const { createWeatherConsentService } = await consentModule('invalid-input');
    let fetches = 0;
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    service.grant();

    const invalidInputs = [
        { coordinate: ['12.3', -98.7], startDateLocal: VALID_INPUT.startDateLocal },
        { coordinate: [91, 0], startDateLocal: VALID_INPUT.startDateLocal },
        { coordinate: [0, -181], startDateLocal: VALID_INPUT.startDateLocal },
        { coordinate: [Number.NaN, 0], startDateLocal: VALID_INPUT.startDateLocal },
        { coordinate: [0, 0], startDateLocal: null },
        { coordinate: [0, 0], startDateLocal: '2031-02-30T04:05:06' },
        { coordinate: [0, 0], startDateLocal: '2031-02-03T04:05:06+99:99' },
        { coordinate: [0, 0], startDateLocal: '2031-02-03' },
        { coordinate: [0, 0], startDateLocal: 'not-a-date' }
    ];
    for (const input of invalidInputs) {
        assert.equal(service.canRequest(input), false);
        assert.equal(await service.request(input), null);
    }
    assert.equal(fetches, 0);
});

test('HTTP, network, malformed, time, and timeout failures remain unavailable', async t => {
    const { createWeatherConsentService } = await consentModule('failures');
    const cases = [
        ['http', async () => ({ ok: false })],
        ['network', async () => { throw new Error('SYNTHETIC_NETWORK_FAILURE'); }],
        ['json', async () => ({ ok: true, async json() { throw new Error('SYNTHETIC_JSON'); } })],
        ['shape', async () => okResponse(null)],
        ['time', async () => okResponse(hourly({ time: ['invalid-time'] }))],
        ['malformed matching hour', async () => okResponse(hourly({
            time: ['2031-02-03T04:not-a-time']
        }))],
        ['non-hour timestamp', async () => okResponse(hourly({
            time: ['2031-02-03T04:30:59']
        }))],
        ['non-array hourly fields', async () => okResponse(hourly({
            temperature_2m: { 0: 17 },
            precipitation: { 0: 1 },
            wind_speed_10m: { 0: 2 },
            wind_direction_10m: { 0: 3 },
            weathercode: { 0: 4 },
            cloudcover: { 0: 5 },
            surface_pressure: { 0: 1000 },
            relativehumidity_2m: { 0: 50 }
        }))],
        ['sparse hourly field', async () => okResponse(hourly({
            temperature_2m: new Array(1)
        }))],
        ['mismatched hourly field length', async () => okResponse(hourly({
            temperature_2m: []
        }))]
    ];
    for (const [name, fetch] of cases) {
        await t.test(name, async () => {
            const service = createWeatherConsentService(serviceDependencies({ fetch }));
            service.grant();
            assert.equal(await service.request(VALID_INPUT), null);
        });
    }

    await t.test('timeout', async () => {
        const service = createWeatherConsentService(serviceDependencies({
            requestTimeoutMs: 5,
            fetch: async (_url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(new Error('SYNTHETIC_ABORT')), {
                    once: true
                });
            })
        }));
        service.grant();
        assert.equal(await service.request(VALID_INPUT), null);
    });
});

test('hourly accessors fail closed without execution', async () => {
    const { createWeatherConsentService } = await consentModule('hourly-accessor');
    let reads = 0;
    const temperatures = [0];
    Object.defineProperty(temperatures, 0, {
        configurable: true,
        enumerable: true,
        get() {
            reads += 1;
            return 17;
        }
    });
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async () => okResponse(hourly({ temperature_2m: temperatures }))
    }));
    service.grant();
    assert.equal(await service.request(VALID_INPUT), null);
    assert.equal(reads, 0);
});

test('hourly record accessors fail closed without execution', async () => {
    const { createWeatherConsentService } = await consentModule('hourly-record-accessor');
    let reads = 0;
    const hourlyRecord = hourly();
    Object.defineProperty(hourlyRecord, 'time', {
        configurable: true,
        enumerable: true,
        get() {
            reads += 1;
            return ['2031-02-03T04:00'];
        }
    });
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async () => okResponse(hourlyRecord)
    }));
    service.grant();
    assert.equal(await service.request(VALID_INPUT), null);
    assert.equal(reads, 0);
});

test('cache is consent-bound, expires at 30 minutes, and is capped at 256', async () => {
    const { createWeatherConsentService } = await consentModule('cache');
    let now = 1_000;
    let fetches = 0;
    const service = createWeatherConsentService(serviceDependencies({
        now: () => now,
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    service.grant();
    await service.request(VALID_INPUT);
    await service.request(VALID_INPUT);
    assert.equal(fetches, 1, 'same consent epoch should reuse memory response');

    now += 30 * 60 * 1000 + 1;
    await service.request(VALID_INPUT);
    assert.equal(fetches, 2, 'TTL expiry must refetch');

    service.revoke();
    service.grant();
    await service.request(VALID_INPUT);
    assert.equal(fetches, 3, 'revocation must clear the prior epoch cache');

    for (let index = 0; index < 257; index += 1) {
        await service.request({
            coordinate: [-80 + index / 100, 20],
            startDateLocal: VALID_INPUT.startDateLocal
        });
    }
    const beforeEvictedLookup = fetches;
    await service.request({
        coordinate: [-80, 20],
        startDateLocal: VALID_INPUT.startDateLocal
    });
    assert.equal(fetches, beforeEvictedLookup + 1, 'oldest entry must be evicted past 256');
});

test('revoke aborts in-flight work and denies later requests until a new grant', async () => {
    const { createWeatherConsentService } = await consentModule('revoke');
    let fetches = 0;
    let observedSignal;
    const service = createWeatherConsentService(serviceDependencies({
        fetch: async (_url, { signal }) => {
            fetches += 1;
            observedSignal = signal;
            return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(new Error('SYNTHETIC_REVOKE')), {
                    once: true
                });
            });
        }
    }));
    service.grant();
    const pending = service.request(VALID_INPUT);
    await Promise.resolve();
    service.revoke();
    assert.equal(observedSignal.aborted, true);
    assert.equal(await pending, null);
    assert.equal(await service.request(VALID_INPUT), null);
    assert.equal(fetches, 1);
});

test('revoke remains deny when recording denied session state fails', async () => {
    const { createWeatherConsentService } = await consentModule('revoke-storage-failure');
    const storage = new MemoryStorage({
        [CONSENT_KEY]: '{"version":1,"granted":true}'
    });
    storage.setItem = () => {
        throw new Error('SYNTHETIC_SESSION_WRITE_FAILURE');
    };
    let fetches = 0;
    const service = createWeatherConsentService(serviceDependencies({
        storage,
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    assert.equal(service.isGranted(), true);
    service.revoke();
    assert.equal(service.isGranted(), false);
    assert.equal(await service.request(VALID_INPUT), null);
    assert.equal(fetches, 0);
});

test('main injects its frozen active session mode only into the Weather tab', async () => {
    const mainSource = await source('js/app/main.js');
    assert.match(mainSource,
        /'weather-tab': \{ render: \(\) => renderWeatherTab\(allActivities, \{ sessionMode: activeSessionMode \}\) \}/);
    assert.equal((mainSource.match(/renderWeatherTab\(/g) || []).length, 1);
});

test('Demo Weather uses embedded synthetic values before consent storage or fetch', async () => {
    const names = ['document', 'fetch', 'sessionStorage'];
    const descriptors = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const storage = new MemoryStorage();
    let fetches = 0;
    const summary = {
        innerHTML: '',
        querySelector() {
            return null;
        }
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: storage
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            getElementById(id) {
                if (id === 'weather-tab') return {};
                if (id === 'wa-stats-row') return summary;
                return null;
            }
        }
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async () => {
            fetches += 1;
            return okResponse(hourly({ temperature_2m: [99] }));
        }
    });

    try {
        const consent = await import('../../js/app/weather-consent.js');
        consent.revokeWeatherConsent();
        assert.equal(consent.grantWeatherConsent(), true);
        storage.reads.length = 0;
        storage.writes.length = 0;
        const { renderWeatherTab } = await import('../../js/tabs/weather.js?demo-session-mode=1');
        await renderWeatherTab([{
            name: 'Synthetic Demo Run',
            type: 'Run',
            start_latlng: [12.3456, -98.7654],
            start_date_local: '2031-02-03T04:05:06',
            distance: 5000,
            moving_time: 1500,
            weather: {
                temperature: 7,
                precipitation: 0,
                wind_speed: 0,
                humidity: 0,
                pressure: 0,
                cloud_cover: 0,
                condition: 'Clear'
            }
        }], { sessionMode: 'demo' });
        assert.deepEqual(storage.reads, []);
        assert.deepEqual(storage.writes, []);
        assert.equal(fetches, 0);
        assert.match(summary.innerHTML, /7\.0°C/);
        assert.doesNotMatch(summary.innerHTML, /Allow for this tab|Revoke weather access|99\.0°C/);
        summary.innerHTML = '';
        await renderWeatherTab([], { sessionMode: 'unknown' });
        assert.deepEqual(storage.reads, []);
        assert.deepEqual(storage.writes, []);
        assert.equal(fetches, 0);
        assert.match(summary.innerHTML, /Weather is unavailable for this session/);
    } finally {
        const consent = await import('../../js/app/weather-consent.js');
        consent.revokeWeatherConsent();
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('Weather tab exposes revoke while authorized requests are in flight', async () => {
    const names = ['document', 'fetch', 'sessionStorage'];
    const descriptors = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const storage = new MemoryStorage({
        [CONSENT_KEY]: '{"version":1,"granted":true}'
    });
    let summaryHtml = '';
    let revokeHandler = null;
    let observedSignal = null;
    let finishFetch = null;
    let rendering = null;
    const summary = {
        get innerHTML() {
            return summaryHtml;
        },
        set innerHTML(value) {
            summaryHtml = value;
        },
        querySelector(selector) {
            if (selector !== '[data-weather-consent-revoke]' || !summaryHtml.includes(selector.slice(1, -1))) {
                return null;
            }
            return {
                addEventListener(_event, handler) {
                    revokeHandler = handler;
                }
            };
        }
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: storage
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            getElementById(id) {
                if (id === 'weather-tab') return {};
                if (id === 'wa-stats-row') return summary;
                return null;
            }
        }
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async (_url, { signal }) => {
            observedSignal = signal;
            return new Promise((resolve, reject) => {
                finishFetch = () => resolve({ ok: false });
                signal.addEventListener('abort', () => reject(new Error('SYNTHETIC_REVOKE')), {
                    once: true
                });
            });
        }
    });

    try {
        const consent = await import('../../js/app/weather-consent.js');
        assert.equal(consent.grantWeatherConsent(), true);
        const { renderWeatherTab } = await import('../../js/tabs/weather.js?in-flight-revoke=1');
        rendering = renderWeatherTab([{
            type: 'Run',
            start_latlng: [12.3456, -98.7654],
            start_date_local: '2031-02-03T04:05:06'
        }], { sessionMode: 'real' });
        await Promise.resolve();
        assert.equal(typeof revokeHandler, 'function', 'IN_FLIGHT_REVOKE_CONTROL_MISSING');
        revokeHandler();
        await rendering;
        assert.equal(observedSignal?.aborted, true);
        assert.equal(storage.values.get(CONSENT_KEY), '{"version":1,"granted":false}');
    } finally {
        finishFetch?.();
        await rendering;
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('Weather tab omits missing values from environmental difficulty input', async () => {
    const names = ['document', 'fetch', 'sessionStorage'];
    const descriptors = new Map(names.map(name => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
    ]));
    const storage = new MemoryStorage();
    const cells = [];
    const tbody = {
        innerHTML: '',
        insertRow() {
            return {
                insertCell() {
                    const cell = { textContent: '', style: {} };
                    cells.push(cell);
                    return cell;
                }
            };
        }
    };
    const summary = {
        innerHTML: '',
        querySelector() {
            return null;
        }
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: storage
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            getElementById(id) {
                if (id === 'weather-tab') return {};
                if (id === 'wa-stats-row') return summary;
                if (id === 'runs-table') return { querySelector: () => tbody };
                if (id === 'toggle-runs') return { addEventListener() {}, textContent: '' };
                if (id === 'runs-table-container') return { classList: { toggle() {}, contains: () => true } };
                return null;
            }
        }
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async () => okResponse(hourly({
            temperature_2m: [null],
            precipitation: [null],
            wind_speed_10m: [0],
            wind_direction_10m: [null],
            weathercode: [null],
            cloudcover: [null],
            surface_pressure: [null],
            relativehumidity_2m: [null]
        }))
    });

    try {
        const consent = await import('../../js/app/weather-consent.js');
        consent.revokeWeatherConsent();
        assert.equal(consent.grantWeatherConsent(), true);
        const { renderWeatherTab } = await import('../../js/tabs/weather.js?missing-difficulty=1');
        await renderWeatherTab([{
            name: 'Synthetic Run',
            type: 'Run',
            start_latlng: [12.3456, -98.7654],
            start_date_local: '2031-02-03T04:05:06',
            distance: 5000,
            moving_time: 1500
        }], { sessionMode: 'real' });
        assert.equal(cells[11]?.textContent, '0%');
    } finally {
        const consent = await import('../../js/app/weather-consent.js');
        consent.revokeWeatherConsent();
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});
