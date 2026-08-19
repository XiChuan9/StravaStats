import { readBoundedResponseText } from '../shared/bounded-response.js';

export const AI_COACH_MODEL = 'gemini-3-flash-preview';
export const AI_COACH_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${AI_COACH_MODEL}:generateContent`;
export const AI_COACH_CONFIRM_LABEL = 'Send this request to Google Gemini';
export const AI_COACH_DISCLOSURE = "AI Coach uses the Google Gemini API. If you choose ‘Send this request to Google Gemini’, StravaStats sends your question and the approximate 28-day training aggregates shown below to generativelanguage.googleapis.com. It does not send activity or athlete names, IDs, dates, gear, personal bests, routes, tokens, heart rate, power, or raw activity/stream data. Your API key is sent only in the request header. This permission applies once and can be cancelled before or during the request.";

const LEGACY_KEY = 'gemini_api_key';
const LEGACY_HISTORY = 'ai_chat_history';
const REQUEST_TIMEOUT_MS = 4_000;
const QUESTION_LIMIT = 4_000;
const RESPONSE_LIMIT = 16_384;
const HISTORY_MESSAGE_LIMIT = 12;
const HISTORY_BYTE_LIMIT = 64 * 1024;
const RESPONSE_BODY_LIMIT = 128 * 1024;
const DAY_MS = 24 * 60 * 60 * 1_000;
const SYSTEM_INSTRUCTION = 'You are a sports coach. Use only the supplied approximate aggregates. Do not infer identity, dates, routes, health data, equipment, personal bests, or earlier conversation. Answer in the language of the current question.';
const PREVIEW_FIELDS = Object.freeze([
    'question',
    'recent_28_days.sports[].sport_category',
    'recent_28_days.sports[].activity_count',
    'recent_28_days.sports[].distance_km.{value,valid_samples}',
    'recent_28_days.sports[].moving_time_minutes.{value,valid_samples}',
    'recent_28_days.sports[].elevation_gain_m.{value,valid_samples}',
    'previous_28_days.sports[] (same fields)'
]);
const CATEGORY_ORDER = Object.freeze([
    'run', 'ride', 'swim', 'walk', 'hike', 'workout', 'winter', 'team', 'racket', 'other'
]);
const CATEGORY_RANK = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
const TYPE_CATEGORIES = new Map([
    ['run', 'run'], ['trailrun', 'run'], ['virtualrun', 'run'],
    ['ride', 'ride'], ['virtualride', 'ride'], ['gravelride', 'ride'],
    ['gravelbikeride', 'ride'], ['mountainbikeride', 'ride'], ['ebikeride', 'ride'],
    ['emountainbikeride', 'ride'], ['indoorride', 'ride'],
    ['swim', 'swim'], ['poolswim', 'swim'], ['openwaterswim', 'swim'],
    ['walk', 'walk'], ['walking', 'walk'], ['hike', 'hike'],
    ['workout', 'workout'], ['weighttraining', 'workout'], ['crossfit', 'workout'],
    ['elliptical', 'workout'], ['stairstepper', 'workout'], ['yoga', 'workout'],
    ['pilates', 'workout'], ['highintensityintervaltraining', 'workout'],
    ['alpineski', 'winter'], ['nordicski', 'winter'], ['snowboard', 'winter'], ['snowshoe', 'winter'],
    ['soccer', 'team'], ['basketball', 'team'], ['volleyball', 'team'],
    ['tennis', 'racket'], ['tabletennis', 'racket'], ['badminton', 'racket'],
    ['pickleball', 'racket'], ['padel', 'racket'], ['racquetball', 'racket'], ['squash', 'racket']
]);

export class AICoachError extends Error {
    constructor(code) {
        super(code);
        this.name = 'AICoachError';
        this.code = code;
    }
}

function fail(code) {
    throw new AICoachError(code);
}

function normalizedCategory(activity) {
    const source = typeof activity.type === 'string'
        ? activity.type
        : typeof activity.sport_type === 'string' ? activity.sport_type : '';
    return TYPE_CATEGORIES.get(source.replace(/[^A-Za-z]/g, '').toLowerCase()) ?? 'other';
}

function activityInstant(activity) {
    const source = typeof activity.start_date === 'string'
        ? activity.start_date
        : typeof activity.start_date_local === 'string' ? activity.start_date_local : null;
    if (source === null || source.length > 64) return null;
    const instant = Date.parse(source);
    return Number.isFinite(instant) ? instant : null;
}

function metric() {
    return { sum: 0, valid_samples: 0 };
}

function newSport(category) {
    return {
        sport_category: category,
        activity_count: 0,
        distance: metric(),
        movingTime: metric(),
        elevation: metric()
    };
}

function addMetric(target, value) {
    if (!Number.isFinite(value) || value < 0) return;
    const next = target.sum + value;
    if (!Number.isFinite(next)) fail('AI_COACH_ACTIVITY_INVALID');
    target.sum = next;
    target.valid_samples += 1;
}

function roundedMetric(source, unit, scale) {
    return Object.freeze({
        value: source.valid_samples === 0 ? null : Math.round(source.sum / unit) * scale,
        valid_samples: source.valid_samples
    });
}

function finalizeSport(source) {
    return Object.freeze({
        sport_category: source.sport_category,
        activity_count: source.activity_count,
        distance_km: roundedMetric(source.distance, 1_000, 1),
        moving_time_minutes: roundedMetric(source.movingTime, 15 * 60, 15),
        elevation_gain_m: roundedMetric(source.elevation, 100, 100)
    });
}

function buildAggregates(values, nowValue) {
    if (!Number.isFinite(nowValue)) fail('AI_COACH_ACTIVITY_INVALID');
    const recentStart = nowValue - 28 * DAY_MS;
    const previousStart = nowValue - 56 * DAY_MS;
    const buckets = { recent_28_days: new Map(), previous_28_days: new Map() };
    for (const activity of values) {
        const instant = activityInstant(activity);
        if (instant === null || instant < previousStart || instant >= nowValue) continue;
        const bucket = instant >= recentStart ? buckets.recent_28_days : buckets.previous_28_days;
        const category = normalizedCategory(activity);
        const sport = bucket.get(category) ?? newSport(category);
        sport.activity_count += 1;
        addMetric(sport.distance, activity.distance);
        addMetric(sport.movingTime, activity.moving_time);
        addMetric(sport.elevation, activity.total_elevation_gain);
        bucket.set(category, sport);
    }
    const result = {};
    for (const [name, bucket] of Object.entries(buckets)) {
        const sports = [...bucket.values()]
            .sort((left, right) => CATEGORY_RANK.get(left.sport_category) - CATEGORY_RANK.get(right.sport_category))
            .map(finalizeSport);
        Object.freeze(sports);
        result[name] = Object.freeze({ sports });
    }
    return Object.freeze(result);
}

function safeQuestion(value) {
    if (typeof value !== 'string') fail('AI_COACH_INPUT_INVALID');
    const question = value.trim();
    if (question.length === 0 || question.length > QUESTION_LIMIT) fail('AI_COACH_INPUT_INVALID');
    return question;
}

function safeApiKey(value) {
    if (typeof value !== 'string') return null;
    const key = value.trim();
    return key.length > 0 && key.length <= 4_096 ? key : null;
}

function boundedReply(value) {
    if (typeof value !== 'string' || value.length === 0) fail('AI_COACH_RESPONSE_INVALID');
    let text = value.slice(0, RESPONSE_LIMIT);
    if (/[\uD800-\uDBFF]/.test(text.at(-1) ?? '')) text = text.slice(0, -1);
    return text;
}

function responseText(value) {
    try {
        const body = JSON.parse(value);
        return boundedReply(body?.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (error) {
        if (error instanceof AICoachError) throw error;
        fail('AI_COACH_RESPONSE_INVALID');
    }
}

function historyBytes(history) {
    return new TextEncoder().encode(JSON.stringify(history)).byteLength;
}

function appendBoundedHistory(history, question, reply) {
    const candidate = history.concat(
        Object.freeze({ role: 'user', text: question }),
        Object.freeze({ role: 'model', text: reply })
    );
    while (candidate.length > HISTORY_MESSAGE_LIMIT
        || (candidate.length > 2 && historyBytes(candidate) > HISTORY_BYTE_LIMIT)) candidate.shift();
    if (historyBytes(candidate) > HISTORY_BYTE_LIMIT) fail('AI_COACH_RESPONSE_INVALID');
    history.splice(0, history.length, ...candidate);
}

function safeLegacyRead(storage, key) {
    try {
        const value = storage?.getItem?.(key);
        return typeof value === 'string' && value.trim().length > 0 ? value : null;
    } catch {
        fail('AI_COACH_LEGACY_STORAGE_ERROR');
    }
}

function safeLegacyDelete(storage, key) {
    try {
        if (typeof storage?.removeItem !== 'function') fail('AI_COACH_LEGACY_STORAGE_ERROR');
        storage.removeItem(key);
        return true;
    } catch (error) {
        if (error instanceof AICoachError) throw error;
        fail('AI_COACH_LEGACY_STORAGE_ERROR');
    }
}

function disabledSession(code) {
    const deny = () => fail(code);
    return Object.freeze({
        enabled: false,
        disclosure: AI_COACH_DISCLOSURE,
        confirmLabel: AI_COACH_CONFIRM_LABEL,
        endpoint: AI_COACH_ENDPOINT,
        model: AI_COACH_MODEL,
        hasApiKey: () => false,
        getHistory: () => [],
        setApiKey: deny,
        forgetApiKey: () => {},
        prepare: deny,
        createActivitySnapshot: deny,
        send: async () => deny(),
        cancel: () => {},
        cancelPending: () => {},
        revoke: () => {},
        clearHistory: () => {},
        inspectLegacyData: deny,
        copyLegacyKeyToMemory: deny,
        deleteLegacyKey: deny,
        deleteLegacyHistory: deny
    });
}

export function createAICoachSession(options = {}) {
    if (options?.sessionMode !== 'real') {
        return disabledSession(options?.sessionMode === 'demo'
            ? 'AI_COACH_DEMO_DISABLED'
            : 'AI_COACH_DISABLED');
    }
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
    const now = options.now ?? Date.now;
    const online = options.online ?? (() => globalThis.navigator?.onLine !== false);
    const schedule = options.setTimeout ?? globalThis.setTimeout?.bind(globalThis);
    const cancelSchedule = options.clearTimeout ?? globalThis.clearTimeout?.bind(globalThis);
    const AbortControllerImpl = options.AbortController ?? globalThis.AbortController;
    const legacyStorage = options.legacyStorage ?? null;
    if (typeof fetchImpl !== 'function' || typeof now !== 'function' || typeof online !== 'function'
        || typeof schedule !== 'function' || typeof cancelSchedule !== 'function'
        || typeof AbortControllerImpl !== 'function') return disabledSession('AI_COACH_DISABLED');

    const preparedGenerations = new WeakMap();
    const consumed = new WeakSet();
    const activitySnapshotBrands = new WeakSet();
    const activitySnapshots = new WeakMap();
    const history = [];
    let generation = 0;
    let apiKey = null;
    let active = null;

    function hasApiKey() {
        return apiKey !== null;
    }

    function setApiKey(value) {
        const candidate = safeApiKey(value);
        if (candidate === null) fail('AI_COACH_API_KEY_INVALID');
        apiKey = candidate;
        return true;
    }

    function createActivitySnapshot() {
        const activities = [];
        let open = true;

        function add(type, sportType, startDate, startDateLocal, distance, movingTime, elevationGain) {
            if (!open) fail('AI_COACH_ACTIVITY_INVALID');
            for (const value of [type, sportType, startDate, startDateLocal]) {
                if (value !== undefined && value !== null
                    && (typeof value !== 'string' || value.length > 64)) {
                    fail('AI_COACH_ACTIVITY_INVALID');
                }
            }
            for (const value of [distance, movingTime, elevationGain]) {
                if (value !== undefined && value !== null
                    && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
                    fail('AI_COACH_ACTIVITY_INVALID');
                }
            }
            activities.push(Object.freeze({
                type,
                sport_type: sportType,
                start_date: startDate,
                start_date_local: startDateLocal,
                distance,
                moving_time: movingTime,
                total_elevation_gain: elevationGain
            }));
        }

        function finish() {
            if (!open) fail('AI_COACH_ACTIVITY_INVALID');
            open = false;
            const brand = Object.freeze(Object.create(null));
            activitySnapshotBrands.add(brand);
            activitySnapshots.set(brand, Object.freeze(activities.slice()));
            return brand;
        }

        return Object.freeze({ add, finish });
    }

    function prepare(questionValue, activities) {
        const question = safeQuestion(questionValue);
        const branded = activities !== null && typeof activities === 'object'
            && activitySnapshotBrands.has(activities);
        const activityValues = branded
            ? activitySnapshots.get(activities)
            : undefined;
        if (activityValues === undefined) fail('AI_COACH_ACTIVITY_INVALID');
        let nowValue;
        try {
            nowValue = now();
        } catch {
            fail('AI_COACH_ACTIVITY_INVALID');
        }
        const prepared = Object.freeze({
            disclosure: AI_COACH_DISCLOSURE,
            confirmLabel: AI_COACH_CONFIRM_LABEL,
            destination: 'generativelanguage.googleapis.com',
            model: AI_COACH_MODEL,
            fields: PREVIEW_FIELDS,
            question,
            aggregates: buildAggregates(activityValues, nowValue)
        });
        preparedGenerations.set(prepared, generation);
        return prepared;
    }

    function authorized(prepared) {
        return prepared !== null && typeof prepared === 'object'
            && preparedGenerations.get(prepared) === generation && !consumed.has(prepared);
    }

    function cancel(prepared) {
        if (prepared !== null && typeof prepared === 'object') consumed.add(prepared);
        if (active?.prepared === prepared) {
            if (active.reason === null) active.reason = 'cancelled';
            active.controller.abort();
        }
    }

    function revoke() {
        generation += 1;
        apiKey = null;
        history.splice(0, history.length);
        if (active !== null) {
            if (active.reason === null) active.reason = 'cancelled';
            active.controller.abort();
        }
    }

    function cancelPending() {
        generation += 1;
        if (active !== null) {
            if (active.reason === null) active.reason = 'cancelled';
            active.controller.abort();
        }
    }

    function enforceActiveState(state) {
        if (state.reason === 'cancelled') fail('AI_COACH_CANCELLED');
        if (state.reason === 'timeout') fail('AI_COACH_TIMEOUT');
        if (state.controller.signal.aborted || state.generation !== generation) {
            fail('AI_COACH_CANCELLED');
        }
    }

    async function send(prepared) {
        if (!authorized(prepared)) fail('AI_COACH_CONSENT_REQUIRED');
        consumed.add(prepared);
        if (apiKey === null) fail('AI_COACH_API_KEY_REQUIRED');
        let isOnline;
        try {
            isOnline = online();
        } catch {
            isOnline = false;
        }
        if (isOnline !== true) fail('AI_COACH_OFFLINE');
        if (active !== null) fail('AI_COACH_BUSY');

        const controller = new AbortControllerImpl();
        const state = { controller, prepared, reason: null, generation };
        active = state;
        const timeout = schedule(() => {
            if (state.reason === null) state.reason = 'timeout';
            controller.abort();
        }, REQUEST_TIMEOUT_MS);
        const body = {
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{
                role: 'user',
                parts: [
                    { text: `TRAINING_AGGREGATES_JSON\n${JSON.stringify(prepared.aggregates)}` },
                    { text: prepared.question }
                ]
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
            store: false
        };
        try {
            const result = await fetchImpl(AI_COACH_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(body),
                credentials: 'omit',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                redirect: 'error',
                signal: controller.signal
            });
            enforceActiveState(state);
            if (result?.ok !== true) fail('AI_COACH_PROVIDER_ERROR');
            const { text: raw } = await readBoundedResponseText(result, {
                maxBytes: RESPONSE_BODY_LIMIT,
                requireJson: true
            });
            enforceActiveState(state);
            const reply = responseText(raw);
            enforceActiveState(state);
            appendBoundedHistory(history, prepared.question, reply);
            return reply;
        } catch (error) {
            if (state.reason === 'cancelled') fail('AI_COACH_CANCELLED');
            if (state.reason === 'timeout') fail('AI_COACH_TIMEOUT');
            if (controller.signal.aborted) fail('AI_COACH_CANCELLED');
            if (error instanceof AICoachError) throw error;
            fail('AI_COACH_NETWORK_ERROR');
        } finally {
            cancelSchedule(timeout);
            if (active === state) active = null;
        }
    }

    function inspectLegacyData() {
        return Object.freeze({
            hasSavedKey: safeLegacyRead(legacyStorage, LEGACY_KEY) !== null,
            hasSavedHistory: safeLegacyRead(legacyStorage, LEGACY_HISTORY) !== null
        });
    }

    function copyLegacyKeyToMemory() {
        const candidate = safeApiKey(safeLegacyRead(legacyStorage, LEGACY_KEY));
        if (candidate === null) return false;
        apiKey = candidate;
        return true;
    }

    return Object.freeze({
        enabled: true,
        disclosure: AI_COACH_DISCLOSURE,
        confirmLabel: AI_COACH_CONFIRM_LABEL,
        endpoint: AI_COACH_ENDPOINT,
        model: AI_COACH_MODEL,
        hasApiKey,
        getHistory: () => history.map(message => ({ role: message.role, text: message.text })),
        setApiKey,
        forgetApiKey: () => { apiKey = null; },
        createActivitySnapshot,
        prepare,
        send,
        cancel,
        cancelPending,
        revoke,
        clearHistory: () => {
            generation += 1;
            if (active !== null) {
                if (active.reason === null) active.reason = 'cancelled';
                active.controller.abort();
            }
            history.splice(0, history.length);
        },
        inspectLegacyData,
        copyLegacyKeyToMemory,
        deleteLegacyKey: () => safeLegacyDelete(legacyStorage, LEGACY_KEY),
        deleteLegacyHistory: () => safeLegacyDelete(legacyStorage, LEGACY_HISTORY)
    });
}
