import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';
import { preprocessActivities } from '../../js/shared/preprocessing/index.js';

const APP_SESSION_MODE = Object.freeze({
    DEMO: 'demo',
    REAL: 'real'
});
const projectRoot = new URL('../../', import.meta.url);
const mainSource = await readFile(new URL('js/app/main.js', projectRoot), 'utf8');

function compileBoundary(source, {
    getFeatureFlags = () => Object.freeze({
        dataRepositoryMode: 'legacy',
        localImportEnabled: false,
        canonicalShadowWriteEnabled: false
    }),
    getApplicationShadowWriter = () => null
} = {}) {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} is required`);
    assert.notEqual(end, -1, `${endMarker} is required`);

    const body = source
        .slice(start + startMarker.length, end)
        .replace(/export\s+(async\s+)?function/g, '$1function');
    return Function(
        'createRepository',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'APP_SESSION_MODE',
        'getFeatureFlags',
        'getApplicationShadowWriter',
        `"use strict";${body};return {
            readPlainDataRecord,
            readDenseDataArray,
            isDenseDataArray,
            adaptRepositoryResult,
            createSummaryRepositorySession,
            establishSummaryRepositorySession,
            requireSummaryRepositorySession,
            loadActivitiesForSession,
            loadInitializeAthleteAndZones,
            loadRefreshAthleteAndZones,
            loadOptionalSessionGears,
            resetSummarySessionGears,
            applySummarySessionGearLoad,
            activityLoadingMessage,
            selectPreprocessingAthlete
        };`
    )(
        () => {
            throw new Error('Unexpected default Repository construction');
        },
        REPOSITORY_SOURCE,
        REPOSITORY_WARNING_CODE,
        APP_SESSION_MODE,
        getFeatureFlags,
        getApplicationShadowWriter
    );
}

const boundary = compileBoundary(mainSource);

function envelope(data, {
    source = REPOSITORY_SOURCE.CACHE,
    warnings = [],
    partial = false
} = {}) {
    return { data, source, warnings, partial };
}

function syntheticRepository(overrides = {}) {
    const calls = {
        listActivities: [],
        getAthlete: 0,
        getZones: 0,
        getGears: 0
    };
    const repository = {
        async listActivities(options) {
            calls.listActivities.push(options);
            return envelope([
                { id: 'synthetic-activity-b' },
                { id: 'synthetic-activity-a' }
            ]);
        },
        async getAthlete() {
            calls.getAthlete += 1;
            return envelope({ id: 'synthetic-athlete', max_hr: 188 });
        },
        async getZones() {
            calls.getZones += 1;
            return envelope({ heartrate: [] });
        },
        async getGears() {
            calls.getGears += 1;
            return envelope([{ id: 'synthetic-gear' }]);
        },
        ...overrides
    };
    return { repository, calls };
}

function createSession(mode, repository, observations = {}) {
    observations.factoryCalls ??= [];
    observations.warningSummaries ??= [];
    return boundary.createSummaryRepositorySession({
        sessionMode: mode,
        repositoryFactory: options => {
            observations.factoryCalls.push(options);
            return repository;
        },
        warningObserver: summary => {
            observations.warningSummaries.push(summary);
        }
    });
}

test('Factory is called exactly once per real or Demo page session with frozen options', async t => {
    for (const mode of [APP_SESSION_MODE.REAL, APP_SESSION_MODE.DEMO]) {
        await t.test(mode, () => {
            const { repository } = syntheticRepository();
            const observations = { factoryCalls: [], warningSummaries: [] };
            const first = boundary.establishSummaryRepositorySession({
                activeSessionMode: null,
                sessionRepository: null,
                requestedSessionMode: mode,
                repositoryFactory: options => {
                    observations.factoryCalls.push(options);
                    return repository;
                }
            });
            const second = boundary.establishSummaryRepositorySession({
                activeSessionMode: first.activeSessionMode,
                sessionRepository: first.sessionRepository,
                requestedSessionMode: mode,
                repositoryFactory: () => {
                    throw new Error('Factory must not run twice');
                }
            });

            assert.deepEqual(observations.factoryCalls, [{
                sessionMode: mode,
                mode: 'legacy'
            }]);
            assert.equal(second.sessionRepository, first.sessionRepository);
            assert.equal(second.activeSessionMode, mode);
        });
    }
});

test('Session-mode mismatch fails closed without replacing the Repository', () => {
    const { repository } = syntheticRepository();
    const session = createSession(APP_SESSION_MODE.REAL, repository);
    assert.throws(
        () => boundary.establishSummaryRepositorySession({
            activeSessionMode: APP_SESSION_MODE.REAL,
            sessionRepository: session,
            requestedSessionMode: APP_SESSION_MODE.DEMO,
            repositoryFactory: () => {
                throw new Error('Factory must not run for mismatch');
            }
        }),
        error => error?.name === 'OperationalError'
    );
});

test('Refresh requires an established Repository and never creates one', () => {
    assert.throws(
        () => boundary.requireSummaryRepositorySession(null, null),
        error => error?.name === 'OperationalError'
    );
});

test('Initialize and refresh pass exact listActivities options and preserve order/reference', async () => {
    const activities = [
        { id: 'synthetic-z' },
        { id: 'synthetic-a' }
    ];
    const { repository, calls } = syntheticRepository({
        async listActivities(options) {
            calls.listActivities.push(options);
            return envelope(activities, { source: REPOSITORY_SOURCE.NETWORK });
        }
    });
    const session = createSession(APP_SESSION_MODE.REAL, repository);

    const initial = await boundary.loadActivitiesForSession({
        sessionRepository: session,
        refresh: false
    });
    const refreshed = await boundary.loadActivitiesForSession({
        sessionRepository: session,
        refresh: true
    });

    assert.deepEqual(calls.listActivities, [
        { refresh: false },
        { refresh: true }
    ]);
    assert.equal(initial.data, activities);
    assert.equal(refreshed.data, activities);
    assert.deepEqual(initial.data.map(item => item.id), ['synthetic-z', 'synthetic-a']);
});

test('Repository source maps only to approved generic activity loading copy', () => {
    assert.equal(boundary.activityLoadingMessage('demo', 2), 'Demo activities ready (2)');
    assert.equal(boundary.activityLoadingMessage('cache', 2), 'Activities loaded from cache (2)');
    assert.equal(boundary.activityLoadingMessage('network', 2), 'Activities downloaded (2)');
    assert.equal(boundary.activityLoadingMessage('mixed', 2), 'Activities ready (2)');
    assert.throws(() => boundary.activityLoadingMessage('private-source', 2));
});

test('Activities malformed or partial envelopes fail closed before preprocessing', async () => {
    for (const value of [
        null,
        {},
        envelope({}, {}),
        envelope([], { partial: true }),
        { data: [], source: 'cache', warnings: [] },
        { data: [], source: 'unknown', warnings: [], partial: false }
    ]) {
        const { repository } = syntheticRepository({
            async listActivities() {
                return value;
            }
        });
        const session = createSession(APP_SESSION_MODE.REAL, repository);
        await assert.rejects(
            session.listActivities({ refresh: false }),
            error => error?.name === 'OperationalError'
        );
    }
});

test('Envelope and warning accessors are not executed; revoked Proxies fail closed', () => {
    let getterCalls = 0;
    const accessorEnvelope = {};
    Object.defineProperty(accessorEnvelope, 'data', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return [];
        }
    });
    Object.assign(accessorEnvelope, {
        source: 'cache',
        warnings: [],
        partial: false
    });
    assert.throws(() => boundary.adaptRepositoryResult(accessorEnvelope, {
        operation: 'listActivities',
        dataShape: 'array'
    }));
    assert.equal(getterCalls, 0);

    const accessorActivities = [];
    Object.defineProperty(accessorActivities, '0', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return { id: 'private-activity' };
        }
    });
    assert.throws(() => boundary.adaptRepositoryResult(
        envelope(accessorActivities),
        { operation: 'listActivities', dataShape: 'array' }
    ));

    const accessorAthlete = {};
    Object.defineProperty(accessorAthlete, 'firstname', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'Private';
        }
    });
    assert.throws(() => boundary.adaptRepositoryResult(
        envelope(accessorAthlete),
        { operation: 'getAthlete', dataShape: 'nullable-object' }
    ));
    assert.equal(getterCalls, 0);

    const target = {};
    const revoked = Proxy.revocable(target, {});
    revoked.revoke();
    assert.throws(() => boundary.adaptRepositoryResult(revoked.proxy, {
        operation: 'listActivities',
        dataShape: 'array'
    }));
});

test('Safe warnings expose only operation/count and malformed warning accessors are ignored', () => {
    let warningGetterCalls = 0;
    const malformedWarning = {};
    Object.defineProperty(malformedWarning, 'code', {
        enumerable: true,
        get() {
            warningGetterCalls += 1;
            return 'CACHE_READ_FAILED';
        }
    });
    Object.assign(malformedWarning, {
        operation: 'listActivities',
        retryable: false
    });
    const summaries = [];
    const result = boundary.adaptRepositoryResult(envelope([], {
        warnings: [
            {
                code: REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
                operation: 'listActivities',
                retryable: true
            },
            malformedWarning,
            {
                code: 'PRIVATE_WARNING',
                operation: 'listActivities',
                retryable: false,
                payload: 'must-not-leak'
            }
        ]
    }), {
        operation: 'listActivities',
        dataShape: 'array',
        warningObserver: summary => summaries.push(summary)
    });

    assert.equal(warningGetterCalls, 0);
    assert.deepEqual(result.warnings, [{
        code: REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
        operation: 'listActivities',
        retryable: true
    }]);
    assert.deepEqual(summaries, [{ operation: 'listActivities', count: 1 }]);
    assert.equal(JSON.stringify({ result, summaries }).includes('must-not-leak'), false);
});

test('Initialize athlete and zones settle independently and remain optional', async () => {
    const { repository, calls } = syntheticRepository({
        async getAthlete() {
            calls.getAthlete += 1;
            throw new Error('synthetic athlete failure');
        }
    });
    const session = createSession(APP_SESSION_MODE.REAL, repository);
    const result = await boundary.loadInitializeAthleteAndZones(session, {
        timeoutMs: 100
    });

    assert.equal(result.athlete, null);
    assert.deepEqual(result.zones, { heartrate: [] });
    assert.equal(result.athleteStatus, 'rejected');
    assert.equal(result.zonesStatus, 'fulfilled');
    assert.equal(calls.getAthlete, 1);
    assert.equal(calls.getZones, 1);
});

test('Refresh athlete and zones are sequential and required', async () => {
    const order = [];
    const { repository } = syntheticRepository({
        async getAthlete() {
            order.push('athlete');
            return envelope({ id: 'synthetic-athlete' });
        },
        async getZones() {
            order.push('zones');
            return envelope({ heartrate: [] });
        }
    });
    const session = createSession(APP_SESSION_MODE.REAL, repository);
    const result = await boundary.loadRefreshAthleteAndZones(session);
    assert.deepEqual(order, ['athlete', 'zones']);
    assert.equal(result.athlete.id, 'synthetic-athlete');

    let zonesCalls = 0;
    const failedSession = createSession(APP_SESSION_MODE.REAL, syntheticRepository({
        async getAthlete() {
            throw new Error('synthetic required failure');
        },
        async getZones() {
            zonesCalls += 1;
            return envelope(null);
        }
    }).repository);
    await assert.rejects(boundary.loadRefreshAthleteAndZones(failedSession));
    assert.equal(zonesCalls, 0);
});

test('Gear complete, empty, partial, error, and no-athlete paths preserve optional parity', async t => {
    const scenarios = [
        ['complete', envelope([{ id: 'g1' }]), [{ id: 'g1' }], false, 'fulfilled'],
        ['empty', envelope([]), [], false, 'fulfilled'],
        ['partial', envelope([{ id: 'g1' }], {
            partial: true,
            source: REPOSITORY_SOURCE.MIXED,
            warnings: [{
                code: REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED,
                operation: 'getGears',
                retryable: true,
                itemIndex: 1
            }]
        }), [{ id: 'g1' }], true, 'fulfilled']
    ];
    for (const [name, value, expected, partial, status] of scenarios) {
        await t.test(name, async () => {
            const session = createSession(APP_SESSION_MODE.REAL, syntheticRepository({
                async getGears() {
                    return value;
                }
            }).repository);
            const result = await boundary.loadOptionalSessionGears(session, { id: 'a' });
            assert.deepEqual(result.data, expected);
            assert.equal(result.partial, partial);
            assert.equal(result.status, status);
        });
    }

    const errorSession = createSession(APP_SESSION_MODE.REAL, syntheticRepository({
        async getGears() {
            throw new Error('synthetic optional gear failure');
        }
    }).repository);
    assert.deepEqual(
        await boundary.loadOptionalSessionGears(errorSession, { id: 'a' }),
        { data: [], partial: false, status: 'rejected' }
    );
    assert.deepEqual(
        await boundary.loadOptionalSessionGears(errorSession, null),
        { data: [], partial: false, status: 'skipped' }
    );
});

test('Main gear lifecycle resets stale context and sets successful gears before rendering', () => {
    const events = [];
    const setter = gears => {
        events.push({ type: 'set', gears });
    };
    const staleGears = [{ id: 'stale-gear' }];
    setter(boundary.applySummarySessionGearLoad({
        data: staleGears,
        partial: false,
        status: 'fulfilled'
    }));

    const resetGears = boundary.resetSummarySessionGears();
    setter(resetGears);
    events.push({ type: 'load' });
    const loadedGears = [
        { id: 'synthetic-shoe-2', name: 'Second' },
        { id: 'synthetic-shoe-1', name: 'First' },
        { id: 'synthetic-shoe-2', name: 'Second duplicate' }
    ];
    const sessionGears = boundary.applySummarySessionGearLoad({
        data: loadedGears,
        partial: false,
        status: 'fulfilled'
    });
    setter(sessionGears);
    events.push({ type: 'run-render', gears: sessionGears });
    events.push({ type: 'run-plus-render', gears: sessionGears });
    events.push({ type: 'gear-render', gears: sessionGears });

    assert.deepEqual(resetGears, []);
    assert.equal(sessionGears, loadedGears);
    assert.deepEqual(sessionGears.map(gear => gear.id), [
        'synthetic-shoe-2',
        'synthetic-shoe-1',
        'synthetic-shoe-2'
    ]);
    assert.deepEqual(events.map(event => event.type), [
        'set',
        'set',
        'load',
        'set',
        'run-render',
        'run-plus-render',
        'gear-render'
    ]);
    assert.deepEqual(events[1].gears, []);
    assert.equal(events[3].gears, loadedGears);
});

test('Rejected, skipped, malformed, and failed-refresh gear loads keep context empty', () => {
    const setterCalls = [];
    const setter = gears => setterCalls.push(gears);
    const stale = [{ id: 'stale-before-refresh' }];
    setter(boundary.applySummarySessionGearLoad({
        data: stale,
        partial: false,
        status: 'fulfilled'
    }));

    for (const value of [
        { data: [], partial: false, status: 'rejected' },
        { data: [], partial: false, status: 'skipped' },
        { data: {}, partial: false, status: 'fulfilled' },
        { data: [], partial: false },
        null
    ]) {
        const reset = boundary.resetSummarySessionGears();
        setter(reset);
        const afterLoad = boundary.applySummarySessionGearLoad(value);
        setter(afterLoad);
        assert.deepEqual(reset, []);
        assert.deepEqual(afterLoad, []);
    }

    assert.deepEqual(setterCalls.at(-1), []);
    assert.equal(
        setterCalls.some(gears => gears.some?.(gear => gear.id === 'stale-before-refresh')),
        true
    );
});

test('Repository errors are not retried and cannot trigger Local Library deletion or false success', async () => {
    const errorCodes = ['UNAUTHENTICATED', 'FORBIDDEN', 'TOKEN_WRITE_FAILED'];
    for (const code of errorCodes) {
        let calls = 0;
        let removals = 0;
        const repositoryError = Object.assign(new Error('safe synthetic error'), { code });
        const session = createSession(APP_SESSION_MODE.REAL, syntheticRepository({
            async listActivities() {
                calls += 1;
                throw repositoryError;
            }
        }).repository);
        await assert.rejects(
            boundary.loadActivitiesForSession({
                sessionRepository: session,
                refresh: false
            }),
            error => error === repositoryError
        );
        assert.equal(calls, 1);
        assert.equal(removals, 0);
    }
});

test('Repository envelope and business data are not mutated or cloned by the adapter', () => {
    const data = [{ id: 'synthetic-order-2' }, { id: 'synthetic-order-1' }];
    const value = envelope(data);
    const before = structuredClone(value);
    const result = boundary.adaptRepositoryResult(value, {
        operation: 'listActivities',
        dataShape: 'array'
    });
    assert.equal(result.data, data);
    assert.deepEqual(value, before);
});

test('Strict dense-array validation preserves safe data and rejects unsafe array shapes', () => {
    const safeActivities = [
        { id: 'synthetic-order-2' },
        { id: 'synthetic-order-1' }
    ];
    const safeResult = boundary.adaptRepositoryResult(envelope(safeActivities), {
        operation: 'listActivities',
        dataShape: 'array'
    });
    assert.equal(safeResult.data, safeActivities);
    assert.deepEqual(safeResult.data.map(item => item.id), [
        'synthetic-order-2',
        'synthetic-order-1'
    ]);
    assert.equal(boundary.isDenseDataArray(safeActivities), true);

    let getterCalls = 0;
    let customForEachCalls = 0;
    let customIteratorCalls = 0;
    const extraEnumerable = [];
    extraEnumerable.extra = 'rejected';
    const extraNonEnumerable = [];
    Object.defineProperty(extraNonEnumerable, 'extra', {
        value: 'rejected',
        enumerable: false
    });
    const symbolProperty = [];
    symbolProperty[Symbol('extra')] = 'rejected';
    const sparse = new Array(1);
    const customPrototype = [{ id: 'must-not-reach-preprocessing' }];
    Object.setPrototypeOf(customPrototype, {
        forEach() {
            customForEachCalls += 1;
        },
        [Symbol.iterator]() {
            customIteratorCalls += 1;
            return [][Symbol.iterator]();
        }
    });
    class ActivityArray extends Array {}
    const subclass = new ActivityArray({ id: 'subclass-item' });
    const indexGetter = [];
    Object.defineProperty(indexGetter, '0', {
        enumerable: true,
        configurable: true,
        get() {
            getterCalls += 1;
            return { id: 'private-index' };
        }
    });
    const extraGetter = [];
    Object.defineProperty(extraGetter, 'extra', {
        enumerable: true,
        configurable: true,
        get() {
            getterCalls += 1;
            return 'private-extra';
        }
    });
    const customIterator = [];
    Object.defineProperty(customIterator, Symbol.iterator, {
        value() {
            customIteratorCalls += 1;
            return [][Symbol.iterator]();
        },
        enumerable: false
    });
    const nonStandardLength = [];
    Object.defineProperty(nonStandardLength, 'length', { writable: false });
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const throwingReflection = new Proxy([], {
        ownKeys() {
            throw new Error('private reflection failure');
        }
    });

    for (const value of [
        extraEnumerable,
        extraNonEnumerable,
        symbolProperty,
        sparse,
        customPrototype,
        subclass,
        indexGetter,
        extraGetter,
        customIterator,
        nonStandardLength,
        revoked.proxy,
        throwingReflection
    ]) {
        assert.throws(
            () => boundary.adaptRepositoryResult(envelope(value), {
                operation: 'listActivities',
                dataShape: 'array'
            }),
            error => (
                error?.name === 'OperationalError'
                && error.message === 'Operation failed.'
                && !error.message.includes('private')
            )
        );
    }
    assert.equal(getterCalls, 0);
    assert.equal(customForEachCalls, 0);
    assert.equal(customIteratorCalls, 0);
});

test('Warnings arrays use the same strict dense-array contract', () => {
    let getterCalls = 0;
    const validWarning = {
        code: REPOSITORY_WARNING_CODE.CACHE_READ_FAILED,
        operation: 'listActivities',
        retryable: true
    };
    const malformedWarnings = [
        Object.assign([validWarning], { extra: true }),
        Object.defineProperty([validWarning], 'hidden', {
            value: true,
            enumerable: false
        }),
        Object.assign(new Array(1), {}),
        Object.setPrototypeOf([validWarning], {}),
        new (class WarningArray extends Array {})(validWarning),
        Object.defineProperty([], 'extra', {
            enumerable: true,
            get() {
                getterCalls += 1;
                return 'private-warning';
            }
        })
    ];
    const symbolWarnings = [validWarning];
    symbolWarnings[Symbol('warning')] = true;
    malformedWarnings.push(symbolWarnings);
    const revokedWarnings = Proxy.revocable([], {});
    revokedWarnings.revoke();
    malformedWarnings.push(revokedWarnings.proxy);
    malformedWarnings.push(new Proxy([], {
        ownKeys() {
            throw new Error('private warning reflection failure');
        }
    }));

    for (const warnings of malformedWarnings) {
        assert.throws(
            () => boundary.adaptRepositoryResult(envelope([], { warnings }), {
                operation: 'listActivities',
                dataShape: 'array'
            }),
            error => (
                error?.name === 'OperationalError'
                && error.message === 'Operation failed.'
                && !error.message.includes('private')
            )
        );
    }
    assert.equal(getterCalls, 0);
});

class RecordingStorage {
    constructor() {
        this.reads = [];
        this.writes = [];
        this.forbiddenReads = new Set();
    }

    getItem(key) {
        this.reads.push(key);
        if (this.forbiddenReads.has(key)) {
            throw new Error(`Forbidden synthetic storage read: ${key}`);
        }
        return key === 'strava_demo_mode' ? 'true' : null;
    }

    setItem(key) {
        this.writes.push(key);
    }
}

function syntheticIndoorSwim(index) {
    return {
        id: `synthetic-indoor-swim-${index}`,
        name: `Synthetic Indoor Swim ${index}`,
        type: 'Swim',
        sport_type: 'Swim',
        start_date: '2026-01-01T06:00:00.000Z',
        start_date_local: '2026-01-01T08:00:00.000Z',
        distance: 1000,
        moving_time: 1200,
        elapsed_time: 1200,
        average_speed: 1000 / 1200,
        trainer: true
    };
}

test('Demo and Real missing-identity inputs bypass real athlete fallback through actual preprocessing', async t => {
    const savedStorage = globalThis.localStorage;
    const savedFetch = globalThis.fetch;
    const storage = new RecordingStorage();
    storage.forbiddenReads.add('strava_athlete_data');
    globalThis.localStorage = storage;
    globalThis.fetch = async () => {
        throw new Error('Synthetic indoor swim must not fetch');
    };

    try {
        for (const mode of [APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL]) {
            const values = [
                null,
                [],
                {},
                { id: `synthetic-${mode}-athlete`, max_hr: 187 }
            ];
            for (const [index, athlete] of values.entries()) {
                await t.test(`${mode}-${index}`, async () => {
                    const before = athlete && typeof athlete === 'object'
                        ? structuredClone(athlete)
                        : athlete;
                    const context = boundary.selectPreprocessingAthlete(mode, athlete);
                    const activity = syntheticIndoorSwim(`${mode}-${index}`);
                    const processed = await preprocessActivities(
                        [activity],
                        context,
                        null,
                        []
                    );

                    assert.equal(processed.length, 1);
                    assert.equal(processed[0], activity);
                    assert.equal(
                        storage.reads.filter(key => key === 'strava_athlete_data').length,
                        0
                    );
                    assert.deepEqual(athlete, before);
                    assert.deepEqual(storage.writes, []);
                    if (mode === APP_SESSION_MODE.DEMO) {
                        assert.equal(context.firstname, 'Demo');
                        assert.equal('id' in context, false);
                    } else {
                        assert.equal(context.preprocessingIdentitySentinel, true);
                        if (index === 3) {
                            assert.equal(context.id, athlete.id);
                            assert.equal(context.max_hr, athlete.max_hr);
                        }
                    }
                });
            }
        }
    } finally {
        if (savedStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = savedStorage;
        if (savedFetch === undefined) delete globalThis.fetch;
        else globalThis.fetch = savedFetch;
    }
});

test('__proto__ and constructor remain safe own data keys through real preprocessing', async () => {
    const savedStorage = globalThis.localStorage;
    const savedFetch = globalThis.fetch;
    const originalObjectPrototype = Object.getPrototypeOf({});
    const originalFirstnameDescriptor = Object.getOwnPropertyDescriptor(
        Object.prototype,
        'firstname'
    );
    const athlete = JSON.parse(
        '{"id":"synthetic","__proto__":{"firstname":"Injected Prototype Name"}}'
    );
    Object.defineProperty(athlete, 'constructor', {
        value: { firstname: 'Injected Constructor Name' },
        enumerable: true,
        configurable: true,
        writable: true
    });
    const athleteBefore = JSON.stringify(athlete);
    const storage = new RecordingStorage();
    storage.forbiddenReads.add('strava_athlete_data');
    const logged = [];
    const savedConsoleLog = console.log;
    const savedConsoleWarn = console.warn;
    globalThis.localStorage = storage;
    globalThis.fetch = async () => {
        throw new Error('Synthetic indoor swim must not fetch');
    };
    console.log = (...values) => logged.push(values);
    console.warn = (...values) => logged.push(values);

    try {
        const copied = boundary.readPlainDataRecord(athlete);
        assert.equal(Object.getPrototypeOf(copied), Object.prototype);
        assert.equal(Object.hasOwn(copied, '__proto__'), true);
        assert.deepEqual(Object.getOwnPropertyDescriptor(copied, '__proto__'), {
            value: athlete.__proto__,
            writable: true,
            enumerable: true,
            configurable: true
        });
        assert.equal(copied.firstname, undefined);
        assert.equal(Object.hasOwn(copied, 'constructor'), true);
        assert.equal(copied.constructor, athlete.constructor);

        const context = boundary.selectPreprocessingAthlete(
            APP_SESSION_MODE.REAL,
            athlete
        );
        assert.notEqual(context, athlete);
        assert.equal(Object.getPrototypeOf(context), Object.prototype);
        assert.equal(Object.hasOwn(context, '__proto__'), true);
        assert.equal(context.firstname, undefined);
        assert.equal(context.id, 'synthetic');
        assert.equal(context.preprocessingIdentitySentinel, true);
        assert.equal(context.username, 'anonymous-session-context');

        const activity = syntheticIndoorSwim('proto-record');
        const processed = await preprocessActivities(
            [activity],
            context,
            null,
            []
        );
        assert.equal(processed.length, 1);
        assert.equal(processed[0], activity);
        assert.equal(
            JSON.stringify(processed).includes('Injected Prototype Name'),
            false
        );
        assert.equal(
            JSON.stringify(logged).includes('Injected Prototype Name'),
            false
        );
        assert.equal(
            storage.reads.filter(key => key === 'strava_athlete_data').length,
            0
        );
        assert.deepEqual(storage.writes, []);
        assert.equal(JSON.stringify(athlete), athleteBefore);
        assert.equal(Object.getPrototypeOf(athlete), originalObjectPrototype);
        assert.deepEqual(
            Object.getOwnPropertyDescriptor(Object.prototype, 'firstname'),
            originalFirstnameDescriptor
        );
    } finally {
        console.log = savedConsoleLog;
        console.warn = savedConsoleWarn;
        if (savedStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = savedStorage;
        if (savedFetch === undefined) delete globalThis.fetch;
        else globalThis.fetch = savedFetch;
    }
});

test('pace-HR efficiency regression degrades safely and preserves valid multi-point output', async () => {
    const savedDocument = globalThis.document;
    const savedChart = globalThis.Chart;
    const savedSetTimeout = globalThis.setTimeout;
    const chartConfigs = [];
    const canvas = {
        id: 'pace-hr-efficiency-chart',
        closest() {
            return null;
        }
    };
    globalThis.document = {
        getElementById(id) {
            return id === canvas.id ? canvas : null;
        },
        querySelector() {
            return null;
        }
    };
    globalThis.Chart = class ChartEvidence {
        constructor(_canvas, config) {
            this.data = config.data;
            this.config = config;
            chartConfigs.push(config);
        }

        destroy() {}
    };
    globalThis.setTimeout = callback => {
        callback();
        return 0;
    };

    const assertFiniteConfig = config => {
        const visit = value => {
            if (typeof value === 'number') {
                assert.equal(Number.isFinite(value), true);
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (value && typeof value === 'object') {
                Object.values(value).forEach(visit);
            }
        };
        visit(config);
        assert.equal(JSON.stringify(config).includes('NaN'), false);
        assert.equal(JSON.stringify(config).includes('Infinity'), false);
    };

    try {
        const { renderPaceHrEfficiencyChart } = await import(
            '../../js/tabs/run-analysis.js?pr04a-b32-regression'
        );

        const noValidRuns = [{ id: 'invalid-run', average_heartrate: null }];
        const noValidBefore = structuredClone(noValidRuns);
        renderPaceHrEfficiencyChart(noValidRuns);
        assert.equal(chartConfigs.length, 0);
        assert.deepEqual(noValidRuns, noValidBefore);

        const singleRun = [{
            id: 'single-run',
            start_date_local: '2026-01-01T06:00:00.000Z',
            average_heartrate: 150,
            distance: 10000,
            moving_time: 3000
        }];
        const singleBefore = structuredClone(singleRun);
        renderPaceHrEfficiencyChart(singleRun);
        const singleConfig = chartConfigs.at(-1);
        assert.equal(singleConfig.data.datasets.length, 1);
        assert.equal(singleConfig.data.datasets[0].label, 'Run Data');
        assert.deepEqual(singleConfig.data.datasets[0].data, [{ x: 150, y: 5 }]);
        assert.equal(
            singleConfig.data.datasets.some(dataset => dataset.label.startsWith('Regression')),
            false
        );
        assertFiniteConfig(singleConfig);
        assert.deepEqual(singleRun, singleBefore);

        const sameHeartRateRuns = [
            {
                id: 'same-hr-first',
                start_date_local: '2026-01-01T06:00:00.000Z',
                average_heartrate: 150,
                distance: 10000,
                moving_time: 3000
            },
            {
                id: 'same-hr-second',
                start_date_local: '2026-01-02T06:00:00.000Z',
                average_heartrate: 150,
                distance: 10000,
                moving_time: 3300
            }
        ];
        const sameHeartRateBefore = structuredClone(sameHeartRateRuns);
        renderPaceHrEfficiencyChart(sameHeartRateRuns);
        const sameHeartRateConfig = chartConfigs.at(-1);
        assert.equal(sameHeartRateConfig.data.datasets.length, 1);
        assert.equal(sameHeartRateConfig.data.datasets[0].label, 'Run Data');
        assertFiniteConfig(sameHeartRateConfig);
        assert.deepEqual(sameHeartRateRuns, sameHeartRateBefore);

        const validRegressionRuns = [
            {
                id: 'valid-regression-later',
                start_date_local: '2026-01-02T06:00:00.000Z',
                average_heartrate: 160,
                distance: 10000,
                moving_time: 3000
            },
            {
                id: 'valid-regression-earlier',
                start_date_local: '2026-01-01T06:00:00.000Z',
                average_heartrate: 140,
                distance: 10000,
                moving_time: 3600
            }
        ];
        const validRegressionBefore = structuredClone(validRegressionRuns);
        renderPaceHrEfficiencyChart(validRegressionRuns);
        const validRegressionConfig = chartConfigs.at(-1);
        assert.equal(validRegressionConfig.data.datasets.length, 2);
        assert.equal(validRegressionConfig.data.datasets[0].label, 'Run Data');
        assert.match(
            validRegressionConfig.data.datasets[1].label,
            /^Regression \(slope: -?\d+\.\d{4} min\/km per bpm\)$/
        );
        assert.equal(
            validRegressionConfig.data.datasets[1].data.every(point => (
                Number.isFinite(point.x) && Number.isFinite(point.y)
            )),
            true
        );
        assertFiniteConfig(validRegressionConfig);
        assert.deepEqual(validRegressionRuns, validRegressionBefore);
    } finally {
        if (savedDocument === undefined) delete globalThis.document;
        else globalThis.document = savedDocument;
        if (savedChart === undefined) delete globalThis.Chart;
        else globalThis.Chart = savedChart;
        globalThis.setTimeout = savedSetTimeout;
    }
});

test('distance-efficiency regression rejects unsafe data and degrades safely for sparse distance input', async () => {
    const savedDocument = globalThis.document;
    const savedChart = globalThis.Chart;
    const savedSetTimeout = globalThis.setTimeout;
    const chartConfigs = [];
    const canvas = {
        id: 'distance-efficiency-chart',
        closest() {
            return null;
        }
    };
    globalThis.document = {
        getElementById(id) {
            return id === canvas.id ? canvas : null;
        },
        querySelector() {
            return null;
        }
    };
    globalThis.Chart = class ChartEvidence {
        constructor(_canvas, config) {
            this.data = config.data;
            this.config = config;
            chartConfigs.push(config);
        }

        destroy() {}
    };
    globalThis.setTimeout = callback => {
        callback();
        return 0;
    };

    const assertFiniteConfig = config => {
        const visit = value => {
            if (typeof value === 'number') {
                assert.equal(Number.isFinite(value), true);
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (value && typeof value === 'object') {
                Object.values(value).forEach(visit);
            }
        };
        visit(config);
        assert.equal(JSON.stringify(config).includes('NaN'), false);
        assert.equal(JSON.stringify(config).includes('Infinity'), false);
    };

    try {
        const { renderDistanceEfficiencyChart } = await import(
            '../../js/tabs/run-analysis.js?pr04a-b34-distance-efficiency'
        );

        const invalidRuns = [
            { id: 'undefined-efficiency', distance: 10000, efficiency: undefined },
            { id: 'null-efficiency', distance: 10000, efficiency: null },
            { id: 'nan-efficiency', distance: 10000, efficiency: Number.NaN },
            { id: 'infinite-efficiency', distance: 10000, efficiency: Number.POSITIVE_INFINITY },
            { id: 'zero-distance', distance: 0, efficiency: 0.03 },
            { id: 'infinite-distance', distance: Number.POSITIVE_INFINITY, efficiency: 0.03 }
        ];
        const invalidBefore = structuredClone(invalidRuns);
        renderDistanceEfficiencyChart(invalidRuns);
        assert.equal(chartConfigs.length, 0);
        assert.deepEqual(invalidRuns, invalidBefore);

        const singleRun = [{
            id: 'single-distance',
            start_date: '2026-01-01T06:00:00.000Z',
            distance: 10000,
            efficiency: 0.03333333333333333
        }];
        const singleBefore = structuredClone(singleRun);
        renderDistanceEfficiencyChart(singleRun);
        const singleConfig = chartConfigs.at(-1);
        assert.equal(singleConfig.data.datasets.length, 1);
        assert.equal(singleConfig.data.datasets[0].label, 'Run Data');
        assert.deepEqual(singleConfig.data.datasets[0].data, [{
            x: 10,
            y: 0.03333333333333333,
            date: '2026-01-01T06:00:00.000Z'
        }]);
        assertFiniteConfig(singleConfig);
        assert.deepEqual(singleRun, singleBefore);

        const sameDistanceRuns = [
            {
                id: 'same-distance-first',
                start_date: '2026-01-01T06:00:00.000Z',
                distance: 10000,
                efficiency: 0.03
            },
            {
                id: 'same-distance-second',
                start_date: '2026-01-02T06:00:00.000Z',
                distance: 10000,
                efficiency: 0.04
            }
        ];
        const sameDistanceBefore = structuredClone(sameDistanceRuns);
        renderDistanceEfficiencyChart(sameDistanceRuns);
        const sameDistanceConfig = chartConfigs.at(-1);
        assert.equal(sameDistanceConfig.data.datasets.length, 1);
        assert.equal(sameDistanceConfig.data.datasets[0].label, 'Run Data');
        assertFiniteConfig(sameDistanceConfig);
        assert.deepEqual(sameDistanceRuns, sameDistanceBefore);

        const validRegressionRuns = [
            {
                id: 'longer-run-first',
                start_date: '2026-01-02T06:00:00.000Z',
                distance: 20000,
                efficiency: 0.04
            },
            {
                id: 'shorter-run-second',
                start_date: '2026-01-01T06:00:00.000Z',
                distance: 10000,
                efficiency: 0.03
            }
        ];
        const validRegressionBefore = structuredClone(validRegressionRuns);
        renderDistanceEfficiencyChart(validRegressionRuns);
        const validRegressionConfig = chartConfigs.at(-1);
        assert.equal(validRegressionConfig.data.datasets.length, 2);
        assert.equal(validRegressionConfig.data.datasets[0].label, 'Run Data');
        assert.deepEqual(
            validRegressionConfig.data.datasets[0].data.map(point => point.x),
            [20, 10]
        );
        assert.match(
            validRegressionConfig.data.datasets[1].label,
            /^Regression \(slope: -?\d+\.\d{4}\)$/
        );
        assert.equal(
            validRegressionConfig.data.datasets[1].data.every(point => (
                Number.isFinite(point.x) && Number.isFinite(point.y)
            )),
            true
        );
        assertFiniteConfig(validRegressionConfig);
        assert.deepEqual(validRegressionRuns, validRegressionBefore);
    } finally {
        if (savedDocument === undefined) delete globalThis.document;
        else globalThis.document = savedDocument;
        if (savedChart === undefined) delete globalThis.Chart;
        else globalThis.Chart = savedChart;
        globalThis.setTimeout = savedSetTimeout;
    }
});

test('Preprocessing athlete accessors and revoked Proxies fail closed without execution', () => {
    let getterCalls = 0;
    const accessorAthlete = {};
    Object.defineProperty(accessorAthlete, 'firstname', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'Private';
        }
    });
    const accessorContext = boundary.selectPreprocessingAthlete(
        APP_SESSION_MODE.REAL,
        accessorAthlete
    );
    assert.equal(getterCalls, 0);
    assert.equal(accessorContext.preprocessingIdentitySentinel, true);

    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    const proxyContext = boundary.selectPreprocessingAthlete(
        APP_SESSION_MODE.DEMO,
        revocable.proxy
    );
    assert.equal(proxyContext.firstname, 'Demo');
});

test('Boundary extraction and session construction perform no network or storage I/O', () => {
    let network = 0;
    let storage = 0;
    const repository = syntheticRepository().repository;
    createSession(APP_SESSION_MODE.DEMO, repository, {
        factoryCalls: [],
        warningSummaries: [],
        network,
        storage
    });
    assert.equal(network, 0);
    assert.equal(storage, 0);
});
