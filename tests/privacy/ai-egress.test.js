import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    AI_COACH_CONFIRM_LABEL,
    AI_COACH_DISCLOSURE,
    AI_COACH_ENDPOINT,
    AI_COACH_MODEL,
    createAICoachSession
} from '../../js/app/ai-coach-egress.js';

const projectRoot = new URL('../../', import.meta.url);
const FIXED_NOW = Date.parse('2031-03-01T00:00:00.000Z');
const LEGACY_KEY = 'gemini_api_key';
const LEGACY_HISTORY = 'ai_chat_history';
const PROHIBITED_CANARIES = Object.freeze([
    'PRIVATE_ATHLETE_NAME_CANARY',
    'PRIVATE_ACTIVITY_NAME_CANARY',
    'opaque/activity?id=000123',
    'opaque-gear-id-000456',
    'PRIVATE_GEAR_NAME_CANARY',
    'PRIVATE_FILE_CANARY.fit',
    'PRIVATE_ROUTE_GPS_CANARY',
    'PRIVATE_STRAVA_TOKEN_CANARY',
    'PRIVATE_HR_CANARY',
    'PRIVATE_POWER_CANARY',
    'PRIVATE_STREAM_CANARY',
    'PRIVATE_PRIOR_CHAT_CANARY'
]);

async function source(relativePath) {
    return readFile(new URL(relativePath, projectRoot), 'utf8');
}

class MemoryStorage {
    constructor(values = {}) {
        this.values = new Map(Object.entries(values));
        this.reads = [];
        this.writes = [];
        this.removes = [];
    }

    getItem(key) {
        this.reads.push(key);
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.writes.push([key, String(value)]);
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.removes.push(key);
        this.values.delete(key);
    }
}

function response(body, { ok = true, status = 200 } = {}) {
    return {
        ok,
        status,
        async text() {
            return typeof body === 'string' ? body : JSON.stringify(body);
        }
    };
}

function okResponse(text = 'Synthetic safe coach reply.') {
    return response({
        candidates: [{ content: { parts: [{ text }] } }]
    });
}

function syntheticActivities() {
    return [
        {
            id: 'opaque/activity?id=000123',
            athlete_name: 'PRIVATE_ATHLETE_NAME_CANARY',
            name: 'PRIVATE_ACTIVITY_NAME_CANARY',
            type: 'TrailRun',
            start_date: '2031-02-20T10:00:00.000Z',
            start_date_local: '2031-02-20T18:00:00',
            distance: 1499,
            moving_time: 899,
            total_elevation_gain: 149,
            average_heartrate: 'PRIVATE_HR_CANARY',
            average_watts: 'PRIVATE_POWER_CANARY',
            gear_id: 'opaque-gear-id-000456',
            gear_name: 'PRIVATE_GEAR_NAME_CANARY',
            filename: 'PRIVATE_FILE_CANARY.fit',
            route: 'PRIVATE_ROUTE_GPS_CANARY',
            token: 'PRIVATE_STRAVA_TOKEN_CANARY',
            streams: 'PRIVATE_STREAM_CANARY'
        },
        {
            type: 'Run',
            start_date: '2031-02-21T10:00:00.000Z',
            distance: 0,
            moving_time: 0,
            total_elevation_gain: 0
        },
        {
            type: 'Ride',
            start_date: '2031-02-22T10:00:00.000Z',
            distance: null,
            moving_time: null,
            total_elevation_gain: null
        },
        {
            type: 'Yoga',
            start_date: '2031-01-20T10:00:00.000Z',
            distance: 500,
            moving_time: 450,
            total_elevation_gain: 49
        },
        {
            type: 'PRIVATE_UNBOUNDED_SPORT_CANARY',
            start_date: '2031-01-21T10:00:00.000Z',
            distance: undefined,
            moving_time: null,
            total_elevation_gain: undefined
        },
        {
            type: 'Swim',
            start_date: '2030-12-01T10:00:00.000Z',
            distance: 999999
        }
    ];
}

function trustedActivitySnapshot(session, activities = []) {
    const builder = session.createActivitySnapshot();
    for (const activity of activities) {
        builder.add(
            activity.type,
            activity.sport_type,
            activity.start_date,
            activity.start_date_local,
            activity.distance,
            activity.moving_time,
            activity.total_elevation_gain
        );
    }
    return builder.finish();
}

function prepareActivities(session, question, activities = []) {
    return session.prepare(question, trustedActivitySnapshot(session, activities));
}

function dependencies(overrides = {}) {
    return {
        sessionMode: 'real',
        fetch: async () => okResponse(),
        now: () => FIXED_NOW,
        online: () => true,
        setTimeout,
        clearTimeout,
        AbortController,
        legacyStorage: new MemoryStorage(),
        ...overrides
    };
}

function assertSafeCode(error, code) {
    assert.equal(error?.name, 'AICoachError');
    assert.equal(error?.code, code);
    assert.equal(PROHIBITED_CANARIES.some(value => String(error?.message).includes(value)), false);
    return true;
}

test('AI Coach has one provider owner and the tab has no fetch or storage boundary', async () => {
    const files = new Map(await Promise.all([
        'js/app/ai-coach-egress.js',
        'js/app/main.js',
        'js/tabs/ai-chat.js'
    ].map(async path => [path, await source(path)])));
    const endpointOwners = [...files]
        .filter(([, value]) => value.includes('generativelanguage.googleapis.com'))
        .map(([path]) => path);
    assert.deepEqual(endpointOwners, ['js/app/ai-coach-egress.js']);
    assert.doesNotMatch(files.get('js/tabs/ai-chat.js'), /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|caches\s*\.|serviceWorker/);
    assert.match(files.get('js/app/main.js'), /createAICoachSession/);
    assert.match(files.get('js/app/main.js'), /renderAIChatTab\(aiCoachActivitySnapshot,\s*\{/);
    assert.match(files.get('js/app/main.js'), /buildAICoachActivitySnapshot/);
    assert.match(files.get('js/app/main.js'), /builder\.add\([\s\S]*?activity\.type[\s\S]*?activity\.total_elevation_gain/);
    assert.match(files.get('js/app/main.js'), /sessionMode:\s*activeSessionMode/);
    assert.match(files.get('js/tabs/ai-chat.js'), /ai-request-preview-question/);
    assert.match(files.get('js/tabs/ai-chat.js'), /setComposerLocked\(true\)/);
});

test('constants freeze the selected provider, destination, disclosure, and affirmative gesture', () => {
    assert.equal(
        AI_COACH_ENDPOINT,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent'
    );
    assert.equal(AI_COACH_MODEL, 'gemini-3-flash-preview');
    assert.equal(AI_COACH_CONFIRM_LABEL, 'Send this request to Google Gemini');
    for (const phrase of [
        'Google Gemini API',
        'generativelanguage.googleapis.com',
        'question',
        'approximate 28-day training aggregates',
        'does not send activity or athlete names',
        'IDs',
        'dates',
        'gear',
        'personal bests',
        'routes',
        'tokens',
        'heart rate',
        'power',
        'raw activity/stream data',
        'request header',
        'applies once'
    ]) {
        assert.equal(AI_COACH_DISCLOSURE.includes(phrase), true, phrase);
    }
});

test('default and existing-user states perform zero durable reads, writes, or requests', () => {
    const storage = new MemoryStorage({
        [LEGACY_KEY]: 'PRIVATE_PROVIDER_KEY_CANARY',
        [LEGACY_HISTORY]: JSON.stringify([{ role: 'user', text: 'PRIVATE_PRIOR_CHAT_CANARY' }])
    });
    let fetches = 0;
    const session = createAICoachSession(dependencies({
        legacyStorage: storage,
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    assert.equal(session.enabled, true);
    assert.equal(session.hasApiKey(), false);
    assert.deepEqual(session.getHistory(), []);
    assert.deepEqual(storage.reads, []);
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(storage.removes, []);
    assert.equal(fetches, 0);
});

test('preparation returns exactly two relative buckets with closed categories and approved rounding', () => {
    const session = createAICoachSession(dependencies());
    const prepared = prepareActivities(session, 'How should I train next?', syntheticActivities());
    assert.deepEqual(Object.keys(prepared).sort(), [
        'aggregates', 'confirmLabel', 'destination', 'disclosure', 'fields', 'model', 'question'
    ]);
    assert.equal(prepared.question, 'How should I train next?');
    assert.deepEqual(prepared.fields, [
        'question',
        'recent_28_days.sports[].sport_category',
        'recent_28_days.sports[].activity_count',
        'recent_28_days.sports[].distance_km.{value,valid_samples}',
        'recent_28_days.sports[].moving_time_minutes.{value,valid_samples}',
        'recent_28_days.sports[].elevation_gain_m.{value,valid_samples}',
        'previous_28_days.sports[] (same fields)'
    ]);
    assert.deepEqual(prepared.aggregates, {
        recent_28_days: {
            sports: [
                {
                    sport_category: 'run',
                    activity_count: 2,
                    distance_km: { value: 1, valid_samples: 2 },
                    moving_time_minutes: { value: 15, valid_samples: 2 },
                    elevation_gain_m: { value: 100, valid_samples: 2 }
                },
                {
                    sport_category: 'ride',
                    activity_count: 1,
                    distance_km: { value: null, valid_samples: 0 },
                    moving_time_minutes: { value: null, valid_samples: 0 },
                    elevation_gain_m: { value: null, valid_samples: 0 }
                }
            ]
        },
        previous_28_days: {
            sports: [
                {
                    sport_category: 'workout',
                    activity_count: 1,
                    distance_km: { value: 1, valid_samples: 1 },
                    moving_time_minutes: { value: 15, valid_samples: 1 },
                    elevation_gain_m: { value: 0, valid_samples: 1 }
                },
                {
                    sport_category: 'other',
                    activity_count: 1,
                    distance_km: { value: null, valid_samples: 0 },
                    moving_time_minutes: { value: null, valid_samples: 0 },
                    elevation_gain_m: { value: null, valid_samples: 0 }
                }
            ]
        }
    });
    const serialized = JSON.stringify(prepared);
    for (const canary of PROHIBITED_CANARIES) assert.equal(serialized.includes(canary), false, canary);
    assert.equal(serialized.includes('PRIVATE_UNBOUNDED_SPORT_CANARY'), false);
    assert.equal(/2031-\d\d-\d\d/.test(serialized), false);
});

test('trusted activity snapshots are module-branded from primitive-only builder calls', () => {
    const session = createAICoachSession(dependencies());
    const builder = session.createActivitySnapshot();
    assert.deepEqual(Object.keys(builder), ['add', 'finish']);
    builder.add(
        'Run',
        undefined,
        '2031-02-20T00:00:00.000Z',
        undefined,
        1499,
        899,
        149
    );
    const snapshot = builder.finish();
    assert.equal(Object.isFrozen(snapshot), true);
    assert.deepEqual(Object.keys(snapshot), []);
    assert.equal(JSON.stringify(snapshot), '{}');
    const prepared = session.prepare('Branded snapshot', snapshot);
    assert.equal(prepared.aggregates.recent_28_days.sports[0].sport_category, 'run');
    const otherSession = createAICoachSession(dependencies());
    assert.throws(
        () => otherSession.prepare('Foreign brand denied', snapshot),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.throws(
        () => session.prepare('Raw activities denied', [{ type: 'Run' }]),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.throws(
        () => builder.add('Run', undefined, undefined, undefined, 0, 0, 0),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.throws(
        () => builder.finish(),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );

    let traps = 0;
    const proxy = new Proxy({}, {
        get() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); },
        getOwnPropertyDescriptor() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); }
    });
    const hostileBuilder = session.createActivitySnapshot();
    assert.throws(
        () => hostileBuilder.add(proxy, undefined, undefined, undefined, 0, 0, 0),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.equal(traps, 0);

    for (const invalidMetric of ['5000', Number.NaN, Number.POSITIVE_INFINITY, -1, proxy]) {
        const invalidBuilder = session.createActivitySnapshot();
        assert.throws(
            () => invalidBuilder.add('Run', undefined, undefined, undefined, invalidMetric, 0, 0),
            error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
        );
    }
    assert.equal(traps, 0);
});

test('question bounds and descriptor failures deny before request', async () => {
    let fetches = 0;
    const session = createAICoachSession(dependencies({
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    for (const question of ['', '   ', 'x'.repeat(4001), null, 0]) {
        assert.throws(
            () => session.prepare(question, []),
            error => assertSafeCode(error, 'AI_COACH_INPUT_INVALID')
        );
    }
    let getterReads = 0;
    const activity = {};
    Object.defineProperty(activity, 'start_date', {
        enumerable: true,
        get() {
            getterReads += 1;
            return '2031-02-20T00:00:00.000Z';
        }
    });
    assert.throws(
        () => session.prepare('Safe question', [activity]),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.equal(getterReads, 0);
    assert.equal(fetches, 0);
});

test('only an authentic one-use preview sends the exact header and body allowlist', async () => {
    const calls = [];
    const session = createAICoachSession(dependencies({
        fetch: async (url, options) => {
            calls.push({ url: String(url), options });
            return okResponse('Approved synthetic response.');
        }
    }));
    session.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const prepared = prepareActivities(session, 'Current question only', syntheticActivities());
    assert.equal(calls.length, 0);
    await assert.rejects(
        session.send(structuredClone(prepared)),
        error => assertSafeCode(error, 'AI_COACH_CONSENT_REQUIRED')
    );
    assert.equal(calls.length, 0);

    const reply = await session.send(prepared);
    assert.equal(reply, 'Approved synthetic response.');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, AI_COACH_ENDPOINT);
    assert.equal(new URL(calls[0].url).search, '');
    assert.deepEqual(calls[0].options.headers, {
        'Content-Type': 'application/json',
        'x-goog-api-key': 'SYNTHETIC_PROVIDER_KEY'
    });
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
    assert.equal(calls[0].options.redirect, 'error');
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);

    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(Object.keys(body).sort(), [
        'contents', 'generationConfig', 'store', 'system_instruction'
    ]);
    assert.deepEqual(body.system_instruction, {
        parts: [{
            text: 'You are a sports coach. Use only the supplied approximate aggregates. Do not infer identity, dates, routes, health data, equipment, personal bests, or earlier conversation. Answer in the language of the current question.'
        }]
    });
    assert.deepEqual(body.contents, [{
        role: 'user',
        parts: [
            { text: `TRAINING_AGGREGATES_JSON\n${JSON.stringify(prepared.aggregates)}` },
            { text: 'Current question only' }
        ]
    }]);
    assert.deepEqual(body.generationConfig, { temperature: 0.7, maxOutputTokens: 1024 });
    assert.equal(body.store, false);
    const serialized = JSON.stringify({ url: calls[0].url, body });
    for (const canary of PROHIBITED_CANARIES) assert.equal(serialized.includes(canary), false, canary);
    assert.equal(serialized.includes('SYNTHETIC_PROVIDER_KEY'), false);
    assert.equal(serialized.includes('Authorization'), false);

    await assert.rejects(
        session.send(prepared),
        error => assertSafeCode(error, 'AI_COACH_CONSENT_REQUIRED')
    );
    assert.equal(calls.length, 1);
});

test('Demo is a hard zero-I/O capability even with populated legacy storage', async () => {
    const storage = new MemoryStorage({
        [LEGACY_KEY]: 'PRIVATE_PROVIDER_KEY_CANARY',
        [LEGACY_HISTORY]: 'PRIVATE_PRIOR_CHAT_CANARY'
    });
    let fetches = 0;
    const session = createAICoachSession(dependencies({
        sessionMode: 'demo',
        legacyStorage: storage,
        fetch: async () => {
            fetches += 1;
            return okResponse();
        }
    }));
    assert.equal(session.enabled, false);
    assert.equal(session.hasApiKey(), false);
    assert.deepEqual(session.getHistory(), []);
    assert.throws(
        () => session.setApiKey('SYNTHETIC_PROVIDER_KEY'),
        error => assertSafeCode(error, 'AI_COACH_DEMO_DISABLED')
    );
    assert.throws(
        () => prepareActivities(session, 'Question', syntheticActivities()),
        error => assertSafeCode(error, 'AI_COACH_DEMO_DISABLED')
    );
    assert.throws(
        () => session.inspectLegacyData(),
        error => assertSafeCode(error, 'AI_COACH_DEMO_DISABLED')
    );
    assert.equal(fetches, 0);
    assert.deepEqual(storage.reads, []);
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(storage.removes, []);
});

test('legacy key and history are touched only by their separate explicit actions', () => {
    const storage = new MemoryStorage({
        [LEGACY_KEY]: '  SYNTHETIC_LEGACY_KEY  ',
        [LEGACY_HISTORY]: JSON.stringify([{ role: 'user', text: 'PRIVATE_PRIOR_CHAT_CANARY' }]),
        unrelated: 'must-remain'
    });
    const session = createAICoachSession(dependencies({ legacyStorage: storage }));

    assert.deepEqual(session.inspectLegacyData(), { hasSavedKey: true, hasSavedHistory: true });
    assert.deepEqual(storage.reads, [LEGACY_KEY, LEGACY_HISTORY]);
    assert.equal(session.hasApiKey(), false);

    assert.equal(session.copyLegacyKeyToMemory(), true);
    assert.equal(session.hasApiKey(), true);
    assert.equal(storage.values.has(LEGACY_KEY), true);
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(storage.removes, []);

    assert.equal(session.deleteLegacyKey(), true);
    assert.equal(storage.values.has(LEGACY_KEY), false);
    assert.deepEqual(storage.removes, [LEGACY_KEY]);
    assert.equal(storage.values.has(LEGACY_HISTORY), true);

    assert.equal(session.deleteLegacyHistory(), true);
    assert.deepEqual(storage.removes, [LEGACY_KEY, LEGACY_HISTORY]);
    assert.equal(storage.values.get('unrelated'), 'must-remain');
});

test('offline, HTTP, malformed, timeout, and revoke are safe, abortable, and never retried', async () => {
    const cases = [
        {
            name: 'offline',
            online: () => false,
            fetch: async () => okResponse(),
            code: 'AI_COACH_OFFLINE',
            fetches: 0
        },
        {
            name: 'http',
            fetch: async () => response({ error: { message: 'PRIVATE_PROVIDER_CANARY' } }, { ok: false, status: 429 }),
            code: 'AI_COACH_PROVIDER_ERROR',
            fetches: 1
        },
        {
            name: 'malformed',
            fetch: async () => response('{not-json'),
            code: 'AI_COACH_RESPONSE_INVALID',
            fetches: 1
        }
    ];
    for (const scenario of cases) {
        let fetches = 0;
        const session = createAICoachSession(dependencies({
            online: scenario.online ?? (() => true),
            fetch: async (...args) => {
                fetches += 1;
                return scenario.fetch(...args);
            }
        }));
        session.setApiKey('SYNTHETIC_PROVIDER_KEY');
        const prepared = prepareActivities(session, `Question ${scenario.name}`);
        await assert.rejects(
            session.send(prepared),
            error => assertSafeCode(error, scenario.code)
        );
        assert.equal(fetches, scenario.fetches);
        assert.deepEqual(session.getHistory(), []);
    }

    let timeoutCallback;
    let timeoutFetches = 0;
    const timeoutSession = createAICoachSession(dependencies({
        setTimeout(callback, milliseconds) {
            assert.equal(milliseconds, 4000);
            timeoutCallback = callback;
            return 17;
        },
        clearTimeout() {},
        fetch: async (_url, options) => {
            timeoutFetches += 1;
            return new Promise((_resolve, reject) => {
                options.signal.addEventListener('abort', () => {
                    const error = new Error('PRIVATE_PROVIDER_ABORT_CANARY');
                    error.name = 'AbortError';
                    reject(error);
                }, { once: true });
            });
        }
    }));
    timeoutSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const timeoutPrepared = prepareActivities(timeoutSession, 'Timeout question');
    const timeoutPromise = timeoutSession.send(timeoutPrepared);
    timeoutCallback();
    await assert.rejects(timeoutPromise, error => assertSafeCode(error, 'AI_COACH_TIMEOUT'));
    assert.equal(timeoutFetches, 1);

    let revokeFetches = 0;
    const revokeSession = createAICoachSession(dependencies({
        fetch: async (_url, options) => {
            revokeFetches += 1;
            return new Promise((_resolve, reject) => {
                options.signal.addEventListener('abort', () => {
                    const error = new Error('PRIVATE_PROVIDER_ABORT_CANARY');
                    error.name = 'AbortError';
                    reject(error);
                }, { once: true });
            });
        }
    }));
    revokeSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const revokePrepared = prepareActivities(revokeSession, 'Revoke question');
    const revokePromise = revokeSession.send(revokePrepared);
    revokeSession.revoke();
    await assert.rejects(revokePromise, error => assertSafeCode(error, 'AI_COACH_CANCELLED'));
    assert.equal(revokeFetches, 1);
    assert.equal(revokeSession.hasApiKey(), false);
    assert.deepEqual(revokeSession.getHistory(), []);
});

test('timeout and revoke remain authoritative while response headers or body are pending', async () => {
    let resolveLateFetch;
    let timeoutCallback;
    const timeoutSession = createAICoachSession(dependencies({
        setTimeout(callback, milliseconds) {
            assert.equal(milliseconds, 4000);
            timeoutCallback = callback;
            return 23;
        },
        clearTimeout() {},
        fetch: async () => new Promise(resolve => { resolveLateFetch = resolve; })
    }));
    timeoutSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const timeoutPromise = timeoutSession.send(prepareActivities(timeoutSession, 'Late headers'));
    timeoutCallback();
    resolveLateFetch(okResponse('must-not-survive-timeout'));
    await assert.rejects(timeoutPromise, error => assertSafeCode(error, 'AI_COACH_TIMEOUT'));
    assert.deepEqual(timeoutSession.getHistory(), []);

    let resolveLateBody;
    const revokeSession = createAICoachSession(dependencies({
        fetch: async () => ({
            ok: true,
            status: 200,
            async text() {
                return new Promise(resolve => { resolveLateBody = resolve; });
            }
        })
    }));
    revokeSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const revokePromise = revokeSession.send(prepareActivities(revokeSession, 'Late body'));
    for (let index = 0; index < 20 && typeof resolveLateBody !== 'function'; index += 1) {
        await Promise.resolve();
    }
    assert.equal(typeof resolveLateBody, 'function');
    revokeSession.revoke();
    resolveLateBody(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'must-not-survive-revoke' }] } }]
    }));
    await assert.rejects(revokePromise, error => assertSafeCode(error, 'AI_COACH_CANCELLED'));
    assert.equal(revokeSession.hasApiKey(), false);
    assert.deepEqual(revokeSession.getHistory(), []);
});

test('clear cancels an in-flight response and a prior cancellation wins a later timeout race', async () => {
    let resolveClearBody;
    const clearSession = createAICoachSession(dependencies({
        fetch: async () => ({
            ok: true,
            status: 200,
            async text() {
                return new Promise(resolve => { resolveClearBody = resolve; });
            }
        })
    }));
    clearSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const clearPromise = clearSession.send(prepareActivities(clearSession, 'Clear late body'));
    for (let index = 0; index < 20 && typeof resolveClearBody !== 'function'; index += 1) {
        await Promise.resolve();
    }
    assert.equal(typeof resolveClearBody, 'function');
    clearSession.clearHistory();
    resolveClearBody(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'must-not-survive-clear' }] } }]
    }));
    await assert.rejects(clearPromise, error => assertSafeCode(error, 'AI_COACH_CANCELLED'));
    assert.deepEqual(clearSession.getHistory(), []);
    assert.equal(clearSession.hasApiKey(), true);

    let timeoutCallback;
    let resolveCancelledFetch;
    const cancellationFirstSession = createAICoachSession(dependencies({
        setTimeout(callback, milliseconds) {
            assert.equal(milliseconds, 4000);
            timeoutCallback = callback;
            return 29;
        },
        clearTimeout() {},
        fetch: async () => new Promise(resolve => { resolveCancelledFetch = resolve; })
    }));
    cancellationFirstSession.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const cancellationFirstPromise = cancellationFirstSession.send(
        prepareActivities(cancellationFirstSession, 'Cancellation wins')
    );
    cancellationFirstSession.cancelPending();
    timeoutCallback();
    resolveCancelledFetch(okResponse('must-not-survive-cancellation'));
    await assert.rejects(
        cancellationFirstPromise,
        error => assertSafeCode(error, 'AI_COACH_CANCELLED')
    );
    assert.deepEqual(cancellationFirstSession.getHistory(), []);
});

test('navigation cancellation expires previews and aborts work without forgetting page-memory data', async () => {
    let aborts = 0;
    const session = createAICoachSession(dependencies({
        fetch: async (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                aborts += 1;
                const error = new Error('SYNTHETIC_NAVIGATION_ABORT');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        })
    }));
    session.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const stalePreview = prepareActivities(session, 'Must expire on navigation');
    session.cancelPending();
    await assert.rejects(
        session.send(stalePreview),
        error => assertSafeCode(error, 'AI_COACH_CONSENT_REQUIRED')
    );
    assert.equal(session.hasApiKey(), true);

    const inFlight = session.send(prepareActivities(session, 'Abort on navigation'));
    session.cancelPending();
    await assert.rejects(inFlight, error => assertSafeCode(error, 'AI_COACH_CANCELLED'));
    assert.equal(aborts, 1);
    assert.equal(session.hasApiKey(), true);
    assert.deepEqual(session.getHistory(), []);
});

test('history limit failure is transactional and never retains an oversized escaped pair', async () => {
    const session = createAICoachSession(dependencies({
        fetch: async () => okResponse('\u0000'.repeat(16_384))
    }));
    session.setApiKey('SYNTHETIC_PROVIDER_KEY');
    await assert.rejects(
        session.send(prepareActivities(session, 'control-character response')),
        error => assertSafeCode(error, 'AI_COACH_RESPONSE_INVALID')
    );
    assert.deepEqual(session.getHistory(), []);
});

test('finite aggregate overflow fails before preview or request serialization', () => {
    const session = createAICoachSession(dependencies());
    assert.throws(
        () => prepareActivities(session, 'Overflow check', [
            {
                type: 'Run',
                start_date: '2031-02-20T00:00:00.000Z',
                distance: Number.MAX_VALUE,
                moving_time: 0,
                total_elevation_gain: 0
            },
            {
                type: 'Run',
                start_date: '2031-02-21T00:00:00.000Z',
                distance: Number.MAX_VALUE,
                moving_time: 0,
                total_elevation_gain: 0
            }
        ]),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
});

test('raw Proxy and revoked-Proxy activities fail with zero user trap execution', () => {
    const session = createAICoachSession(dependencies());
    let traps = 0;
    const throwingProxy = new Proxy({}, {
        getPrototypeOf() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); },
        ownKeys() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); },
        getOwnPropertyDescriptor() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); },
        get() { traps += 1; throw new Error('PRIVATE_PROXY_TRAP'); }
    });
    assert.throws(
        () => session.prepare('Proxy check', throwingProxy),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.equal(traps, 0);

    const target = {};
    const revocable = Proxy.revocable(target, {});
    revocable.revoke();
    assert.throws(
        () => session.prepare('Revoked Proxy check', revocable.proxy),
        error => assertSafeCode(error, 'AI_COACH_ACTIVITY_INVALID')
    );
    assert.equal(traps, 0);
});

test('response and document-memory history enforce 16,384 code units, 12 messages, and 64 KiB', async () => {
    let counter = 0;
    const session = createAICoachSession(dependencies({
        fetch: async () => {
            counter += 1;
            return okResponse(counter === 1 ? 'R'.repeat(20_000) : `reply-${counter}`);
        }
    }));
    session.setApiKey('SYNTHETIC_PROVIDER_KEY');
    const first = await session.send(prepareActivities(session, 'first'));
    assert.equal(first.length, 16_384);
    for (let index = 0; index < 8; index += 1) {
        await session.send(prepareActivities(session, `question-${index}`));
    }
    const history = session.getHistory();
    assert.equal(history.length <= 12, true);
    assert.equal(new TextEncoder().encode(JSON.stringify(history)).byteLength <= 64 * 1024, true);
    assert.equal(history.some(message => message.text === 'PRIVATE_PRIOR_CHAT_CANARY'), false);
    session.clearHistory();
    assert.deepEqual(session.getHistory(), []);
    assert.equal(session.hasApiKey(), true);
    session.revoke();
    assert.equal(session.hasApiKey(), false);
});

test('served browser harness freezes interception-before-import and safe evidence boundaries', async () => {
    const harness = await source('tests/consumers/ai-consent-browser-smoke.html');
    for (const pattern of [
        /DISPOSABLE_LOOPBACK_ORIGIN_REQUIRED/,
        /EXPLICIT_SYNTHETIC_MODE_REQUIRED/,
        /const interceptedFetch[\s\S]*?await import\('\/js\/app\/ai-coach-egress\.js/,
        /existing-user-default-zero-egress/,
        /memory-key-and-preview-before-affirmation/,
        /affirmed-exact-request-and-memory-history/,
        /fresh-confirmation-no-transcript-resend/,
        /navigation-expires-preview-without-forgetting-key/,
        /revoke-aborts-and-discards-memory/,
        /legacy-data-explicit-copy-and-separate-delete/,
        /served-error-matrix-safe-codes-no-retry/,
        /served-timeout-and-concurrency-no-retry/,
        /demo-zero-io/,
        /production-root-route-navigation-refresh-demo/,
        /await import\('\/js\/main\.js\?r7-production-root=1'\)/,
        /providerRequestsBeforeConfirmation:\s*0/,
        /realProviderReached:\s*false/,
        /privateValuesRecorded:\s*false/
    ]) {
        assert.match(harness, pattern);
    }
    assert.doesNotMatch(harness, /tests\/fixtures\/private/);
});
