import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ANALYSIS_CONTEXT_SCHEMA_VERSION,
    ANALYSIS_PROFILE_ERROR_CODE,
    ANALYSIS_PROFILE_SCHEMA_VERSION,
    DASHBOARD_SETTINGS_STORAGE_KEY,
    DEMO_ANALYSIS_CONTEXT_V1,
    AnalysisProfileError,
    createAnalysisContextV1,
    createAnalysisProfileSettingsFacade,
    generatePercentMaxUpperBounds,
    projectAdvancedAnalysisProfile,
    projectHeartRateTrainingZones,
    readAnalysisProfileSettings,
    resetAnalysisProfile,
    saveAnalysisProfile,
    validateAnalysisProfileV1
} from '../js/app/analysis-profile.js';

function automaticDraft(overrides = {}) {
    const maxBpm = overrides.maxBpm ?? 200;
    const generated = generatePercentMaxUpperBounds(maxBpm)
        ?? generatePercentMaxUpperBounds(200);
    return {
        maxBpm,
        restingBpm: null,
        thresholdBpm: null,
        zoneMode: 'percent-max',
        upperBoundsBpm: [...generated],
        ...overrides
    };
}

function profile(overrides = {}) {
    const heartRate = automaticDraft(overrides.heartRate);
    return {
        schemaVersion: ANALYSIS_PROFILE_SCHEMA_VERSION,
        revision: overrides.revision ?? 1,
        heartRate
    };
}

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    const calls = [];
    return {
        values,
        calls,
        getItem(key) {
            calls.push(['get', key]);
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            calls.push(['set', key, value]);
            values.set(key, String(value));
        },
        removeItem(key) {
            calls.push(['remove', key]);
            values.delete(key);
        }
    };
}

test('percent-max boundaries use deterministic rounding and reject invalid maximums', () => {
    assert.deepEqual(generatePercentMaxUpperBounds(190), [114, 133, 152, 171]);
    assert.deepEqual(generatePercentMaxUpperBounds(201), [121, 141, 161, 181]);
    assert.equal(Object.isFrozen(generatePercentMaxUpperBounds(190)), true);
    for (const value of [99, 231, 190.5, NaN, Infinity, '190', null]) {
        assert.equal(generatePercentMaxUpperBounds(value), null);
    }
});

test('AnalysisProfileV1 validates exact automatic and manual five-zone contracts', () => {
    const automatic = validateAnalysisProfileV1(profile({
        revision: 7,
        heartRate: {
            maxBpm: 190,
            restingBpm: 48,
            thresholdBpm: 168
        }
    }));
    assert.deepEqual(automatic, {
        schemaVersion: 1,
        revision: 7,
        heartRate: {
            maxBpm: 190,
            restingBpm: 48,
            thresholdBpm: 168,
            zoneMode: 'percent-max',
            upperBoundsBpm: [114, 133, 152, 171]
        }
    });
    assert.equal(Object.isFrozen(automatic), true);
    assert.equal(Object.isFrozen(automatic.heartRate), true);
    assert.equal(Object.isFrozen(automatic.heartRate.upperBoundsBpm), true);

    const manual = validateAnalysisProfileV1(profile({
        heartRate: {
            maxBpm: 200,
            restingBpm: 45,
            thresholdBpm: 175,
            zoneMode: 'manual',
            upperBoundsBpm: [118, 142, 164, 184]
        }
    }));
    assert.deepEqual(manual.heartRate.upperBoundsBpm, [118, 142, 164, 184]);
});

test('AnalysisProfileV1 rejects invalid relationships and inconsistent automatic zones', () => {
    const invalidHeartRates = [
        { maxBpm: 99 },
        { maxBpm: 231 },
        { restingBpm: 121 },
        { restingBpm: 200 },
        { thresholdBpm: 200 },
        { restingBpm: 100, thresholdBpm: 100 },
        { zoneMode: 'automatic' },
        { upperBoundsBpm: [120, 120, 160, 180] },
        { upperBoundsBpm: [1, 120, 160, 180] },
        { upperBoundsBpm: [120, 140, 160, 201] },
        { upperBoundsBpm: [120, 140, 160, 181] }
    ];
    for (const heartRate of invalidHeartRates) {
        assert.equal(
            validateAnalysisProfileV1(profile({ heartRate })),
            null
        );
    }
    for (const candidate of [
        { ...profile(), schemaVersion: 2 },
        { ...profile(), revision: 0 },
        { ...profile(), revision: 1.5 },
        { ...profile(), extra: true },
        null,
        [],
        Object.create(null)
    ]) {
        assert.equal(validateAnalysisProfileV1(candidate), null);
    }
});

test('validator fails closed for sparse arrays, accessors, symbols, cycles, Proxies, and non-JSON values', () => {
    const sparse = profile({
        heartRate: {
            zoneMode: 'manual',
            upperBoundsBpm: new Array(4)
        }
    });
    assert.equal(validateAnalysisProfileV1(sparse), null);

    let getterCalls = 0;
    const accessor = profile();
    Object.defineProperty(accessor, 'heartRate', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return automaticDraft();
        }
    });
    assert.equal(validateAnalysisProfileV1(accessor), null);
    assert.equal(getterCalls, 0);

    const nestedAccessor = profile();
    Object.defineProperty(nestedAccessor.heartRate, 'maxBpm', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 200;
        }
    });
    assert.equal(validateAnalysisProfileV1(nestedAccessor), null);
    assert.equal(getterCalls, 0);

    const arrayAccessor = profile();
    Object.defineProperty(arrayAccessor.heartRate.upperBoundsBpm, '0', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 120;
        }
    });
    assert.equal(validateAnalysisProfileV1(arrayAccessor), null);
    assert.equal(getterCalls, 0);

    const symbolKey = profile();
    symbolKey[Symbol('private')] = true;
    assert.equal(validateAnalysisProfileV1(symbolKey), null);

    const cyclic = profile();
    cyclic.heartRate = cyclic;
    assert.equal(validateAnalysisProfileV1(cyclic), null);

    const proxied = new Proxy(profile(), {});
    assert.equal(validateAnalysisProfileV1(proxied), null);
    const revoked = Proxy.revocable(profile(), {});
    revoked.revoke();
    assert.equal(validateAnalysisProfileV1(revoked.proxy), null);

    for (const value of [NaN, Infinity, -Infinity, 200n, undefined, Symbol('bpm')]) {
        const candidate = profile({ heartRate: { maxBpm: value } });
        assert.equal(validateAnalysisProfileV1(candidate), null);
    }
});

test('configured AnalysisContextV1 has five continuous zones and frozen projections', () => {
    const context = createAnalysisContextV1(profile({
        revision: 3,
        heartRate: {
            maxBpm: 200,
            restingBpm: null,
            thresholdBpm: null,
            zoneMode: 'manual',
            upperBoundsBpm: [120, 140, 160, 180]
        }
    }));

    assert.equal(context.schemaVersion, ANALYSIS_CONTEXT_SCHEMA_VERSION);
    assert.equal(context.status, 'configured');
    assert.equal(context.revision, 3);
    assert.equal(context.heartRate.restingBpm, null);
    assert.equal(context.heartRate.thresholdBpm, null);
    assert.deepEqual(context.heartRate.zones, [
        { id: 'Z1', minBpm: 1, maxBpmExclusive: 120, label: '<120' },
        { id: 'Z2', minBpm: 120, maxBpmExclusive: 140, label: '120–139' },
        { id: 'Z3', minBpm: 140, maxBpmExclusive: 160, label: '140–159' },
        { id: 'Z4', minBpm: 160, maxBpmExclusive: 180, label: '160–179' },
        { id: 'Z5', minBpm: 180, maxBpmExclusive: null, label: '≥180' }
    ]);
    assert.equal(context.heartRate.zones.length, 5);
    for (let index = 1; index < context.heartRate.zones.length; index += 1) {
        assert.equal(
            context.heartRate.zones[index - 1].maxBpmExclusive,
            context.heartRate.zones[index].minBpm
        );
    }

    const zones = projectHeartRateTrainingZones(context);
    assert.equal(zones, context.trainingZones);
    assert.deepEqual(zones, {
        heart_rate: {
            custom_zones: true,
            zones: [
                { min: 1, max: 120 },
                { min: 120, max: 140 },
                { min: 140, max: 160 },
                { min: 160, max: 180 },
                { min: 180, max: -1 }
            ]
        }
    });
    assert.deepEqual(projectAdvancedAnalysisProfile(context), {
        max_hr: 200,
        hr_rest: null,
        lthr: null,
        hr_zones: zones.heart_rate.zones
    });
    assert.equal(projectAdvancedAnalysisProfile(context), context.advancedAnalysisProfile);
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.heartRate), true);
    assert.equal(Object.isFrozen(context.heartRate.zones), true);
    assert.equal(Object.isFrozen(context.heartRate.zones[0]), true);
    assert.equal(Object.isFrozen(zones.heart_rate.zones), true);
    assert.equal(Object.isFrozen(zones.heart_rate.zones[0]), true);
});

test('invalid profiles always produce the same non-disclosing unconfigured context', () => {
    const absent = createAnalysisContextV1(null);
    const invalid = createAnalysisContextV1(profile({ heartRate: { maxBpm: 99 } }));
    assert.equal(absent, invalid);
    assert.deepEqual(absent, {
        schemaVersion: 1,
        status: 'unconfigured',
        revision: null,
        heartRate: null,
        trainingZones: null,
        advancedAnalysisProfile: null
    });
    assert.equal(projectHeartRateTrainingZones(absent), null);
    assert.equal(projectAdvancedAnalysisProfile(absent), null);
    assert.equal(projectHeartRateTrainingZones({ ...absent }), null);
    assert.equal(Object.isFrozen(absent), true);
});

test('Demo uses one shared frozen synthetic context without reading Real settings', () => {
    assert.equal(DEMO_ANALYSIS_CONTEXT_V1.status, 'configured');
    assert.equal(DEMO_ANALYSIS_CONTEXT_V1.heartRate.maxBpm, 190);
    assert.deepEqual(
        DEMO_ANALYSIS_CONTEXT_V1.heartRate.upperBoundsBpm,
        [114, 133, 152, 171]
    );
    assert.equal(DEMO_ANALYSIS_CONTEXT_V1.heartRate.zones.length, 5);
    assert.equal(
        DEMO_ANALYSIS_CONTEXT_V1.heartRate.zones[4].maxBpmExclusive,
        null
    );
    assert.equal(Object.isFrozen(DEMO_ANALYSIS_CONTEXT_V1), true);
});

test('settings façade reads only a normalized legacy maximum as first-time prefill', () => {
    const storage = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify({
            units: 'metric',
            hrMax: '190'
        })
    });
    const facade = createAnalysisProfileSettingsFacade({ storage });
    const result = facade.read();
    assert.equal(result.status, 'unconfigured');
    assert.equal(result.profile, null);
    assert.equal(result.context.status, 'unconfigured');
    assert.equal(result.prefillMaxBpm, 190);
    assert.equal(facade.readContext().status, 'unconfigured');
    assert.equal(storage.calls.some(call => call[0] !== 'get'), false);

    storage.values.set(DASHBOARD_SETTINGS_STORAGE_KEY, JSON.stringify({ hrMax: ' 190 ' }));
    assert.equal(facade.read().prefillMaxBpm, null);
});

test('save merges dashboard settings, mirrors hrMax, and starts revision one', () => {
    const original = {
        units: 'metric',
        age: '35',
        theme: { dark: true },
        nestedUnknown: ['preserved', { enabled: false }]
    };
    const storage = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify(original)
    });
    const result = saveAnalysisProfile(storage, automaticDraft({
        maxBpm: 190,
        restingBpm: 48,
        thresholdBpm: 168
    }));

    assert.equal(result.status, 'configured');
    assert.equal(result.profile.revision, 1);
    assert.equal(result.context.revision, 1);
    assert.equal(result.prefillMaxBpm, null);
    const saved = JSON.parse(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY));
    assert.deepEqual(
        Object.fromEntries(Object.entries(saved).filter(([key]) => (
            key !== 'analysisProfile' && key !== 'hrMax'
        ))),
        original
    );
    assert.equal(saved.hrMax, 190);
    assert.deepEqual(saved.analysisProfile, result.profile);
});

test('identical saves preserve revision and avoid writes while valid changes increment once', () => {
    const storage = memoryStorage();
    const facade = createAnalysisProfileSettingsFacade({ storage });
    const initialDraft = automaticDraft({ maxBpm: 190 });
    assert.equal(facade.save(initialDraft).profile.revision, 1);
    const writesAfterFirstSave = storage.calls.filter(call => call[0] === 'set').length;

    assert.equal(facade.save(structuredClone(initialDraft)).profile.revision, 1);
    assert.equal(
        storage.calls.filter(call => call[0] === 'set').length,
        writesAfterFirstSave
    );

    const changed = automaticDraft({
        maxBpm: 190,
        zoneMode: 'manual',
        upperBoundsBpm: [112, 132, 151, 170]
    });
    const changedResult = facade.save(changed);
    assert.equal(changedResult.profile.revision, 2);
    assert.equal(changedResult.profile.heartRate.zoneMode, 'manual');
    assert.equal(storage.calls.filter(call => call[0] === 'set').length, 2);
});

test('invalid saves preserve the last valid profile and expose no health value in errors', () => {
    const storage = memoryStorage();
    const facade = createAnalysisProfileSettingsFacade({ storage });
    const valid = facade.save(automaticDraft({ maxBpm: 200 }));
    const before = storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY);

    assert.throws(
        () => facade.save(automaticDraft({ maxBpm: 99 })),
        error => {
            assert.equal(error instanceof AnalysisProfileError, true);
            assert.equal(error.code, ANALYSIS_PROFILE_ERROR_CODE.INVALID_PROFILE);
            assert.equal(error.operation, 'save');
            assert.equal(error.message, 'Analysis profile operation failed safely.');
            assert.doesNotMatch(error.message, /99|200|bpm|heart/i);
            return true;
        }
    );
    assert.equal(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY), before);
    assert.deepEqual(facade.read().profile, valid.profile);
});

test('corrupt stored profiles fail closed without repair or legacy value disclosure', () => {
    const stored = JSON.stringify({
        units: 'metric',
        hrMax: 200,
        analysisProfile: {
            schemaVersion: 1,
            revision: 1,
            heartRate: {
                maxBpm: 999,
                restingBpm: null,
                thresholdBpm: null,
                zoneMode: 'manual',
                upperBoundsBpm: [100, 120, 140, 160]
            }
        }
    });
    const storage = memoryStorage({ [DASHBOARD_SETTINGS_STORAGE_KEY]: stored });
    const result = readAnalysisProfileSettings(storage);
    assert.deepEqual(result, {
        status: 'unconfigured',
        profile: null,
        context: createAnalysisContextV1(null),
        prefillMaxBpm: null
    });
    assert.equal(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY), stored);
    assert.equal(storage.calls.some(call => call[0] === 'set'), false);
});

test('an explicit save can replace a corrupt nested profile without dropping other settings', () => {
    const storage = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify({
            units: 'imperial',
            analysisProfile: { invalid: true },
            unknown: { retained: true }
        })
    });
    const saved = saveAnalysisProfile(storage, automaticDraft());
    assert.equal(saved.profile.revision, 1);
    const settings = JSON.parse(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY));
    assert.equal(settings.units, 'imperial');
    assert.deepEqual(settings.unknown, { retained: true });
    assert.deepEqual(settings.analysisProfile, saved.profile);
});

test('reset requires exact confirmation and removes only profile-owned fields', () => {
    const storage = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify({
            units: 'metric',
            hrMax: 190,
            analysisProfile: profile({ heartRate: { maxBpm: 190 } }),
            darkMode: true
        })
    });
    const before = storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY);
    assert.throws(
        () => resetAnalysisProfile(storage),
        error => error.code === ANALYSIS_PROFILE_ERROR_CODE.CONFIRMATION_REQUIRED
    );
    assert.throws(
        () => resetAnalysisProfile(storage, { confirmed: 'true' }),
        error => error.code === ANALYSIS_PROFILE_ERROR_CODE.CONFIRMATION_REQUIRED
    );
    assert.equal(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY), before);

    const reset = resetAnalysisProfile(storage, { confirmed: true });
    assert.equal(reset.status, 'unconfigured');
    assert.deepEqual(
        JSON.parse(storage.values.get(DASHBOARD_SETTINGS_STORAGE_KEY)),
        { units: 'metric', darkMode: true }
    );
    assert.equal(storage.calls.some(call => call[0] === 'remove'), false);
});

test('malformed settings and unavailable storage fail safely', () => {
    const malformed = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: '{malformed'
    });
    const facade = createAnalysisProfileSettingsFacade({ storage: malformed });
    assert.equal(facade.read().status, 'unconfigured');
    assert.throws(
        () => facade.save(automaticDraft()),
        error => error.code === ANALYSIS_PROFILE_ERROR_CODE.INVALID_SETTINGS
    );
    assert.equal(malformed.values.get(DASHBOARD_SETTINGS_STORAGE_KEY), '{malformed');

    const nonRoundTrippable = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: '{"unknown":1e400}'
    });
    assert.equal(readAnalysisProfileSettings(nonRoundTrippable).status, 'unconfigured');
    assert.throws(
        () => saveAnalysisProfile(nonRoundTrippable, automaticDraft()),
        error => error.code === ANALYSIS_PROFILE_ERROR_CODE.INVALID_SETTINGS
    );
    assert.equal(
        nonRoundTrippable.values.get(DASHBOARD_SETTINGS_STORAGE_KEY),
        '{"unknown":1e400}'
    );

    const unavailable = {
        getItem() { throw new Error('private storage detail'); },
        setItem() { throw new Error('private storage detail'); }
    };
    assert.equal(readAnalysisProfileSettings(unavailable).status, 'unconfigured');
    assert.throws(
        () => saveAnalysisProfile(unavailable, automaticDraft()),
        error => (
            error.code === ANALYSIS_PROFILE_ERROR_CODE.STORAGE_UNAVAILABLE
            && !error.message.includes('private storage detail')
        )
    );
});

test('dashboard settings JSON round-trip retains the nested profile unchanged', () => {
    const source = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: JSON.stringify({ units: 'metric' })
    });
    const saved = saveAnalysisProfile(source, automaticDraft({
        restingBpm: 50,
        thresholdBpm: 172
    }));
    const settingsJson = source.values.get(DASHBOARD_SETTINGS_STORAGE_KEY);
    const restored = memoryStorage({
        [DASHBOARD_SETTINGS_STORAGE_KEY]: settingsJson
    });
    const read = readAnalysisProfileSettings(restored);
    assert.deepEqual(read.profile, saved.profile);
    assert.deepEqual(read.context, saved.context);
});
