// js/app/main.js
import { redirectToStrava, logout, handleAuth, loginWithDemo } from './auth.js';
import { setupDashboard, showLoading, hideLoading, handleError, } from './ui.js';
import { initKofiSystem, showKofiModal } from '../services/kofi.js';
import {
    renderRunAnalysisTab,
    renderBikeAnalysisTab,
    renderSwimAnalysisTab,
    renderDashboardTab,
    renderTrendsTab,
    renderPlannerTab,
    renderGearTab,
    renderWeatherTab,
    renderActivitiesTab,
    renderCalendarTab,
    renderWrappedTab,
    renderMapTab,
    renderAIChatTab,
    renderRunPlusTab,
    setRunSessionGears,
} from '../tabs/index.js';
import {
    createRepository,
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE,
} from '../repository/index.js';
import { preprocessActivities } from '../shared/preprocessing/index.js';
import { isDemoMode } from '../demo/index.js';
import {
    applyServiceWorkerPolicy,
    SERVICE_WORKER_LIFECYCLE_CODE
} from './service-worker-policy.js';
import { getFeatureFlags } from './feature-flags.js';
import { getApplicationShadowWriter } from '../shadow/index.js';
import {
    LOCAL_FIRST_NETWORK_STATUS,
    LOCAL_FIRST_STATUS,
    STRAVA_SOURCE_STATUS,
    inspectLocalFirstBootstrap,
    runLocalFirstBootstrap
} from './local-first-bootstrap.js';
import { recordDiagnosticError } from '../diagnostics/index.js';
import { createAICoachSession } from './ai-coach-egress.js';

export const APP_SESSION_MODE = Object.freeze({
    DEMO: 'demo',
    REAL: 'real'
});

// PR04A_B1_SUMMARY_BOUNDARY_START
const SUMMARY_ENVELOPE_KEYS = new Set([
    'data',
    'source',
    'warnings',
    'partial'
]);
const SUMMARY_WARNING_KEYS = new Set([
    'code',
    'operation',
    'retryable',
    'itemIndex'
]);
const SUMMARY_SOURCES = new Set(Object.values(REPOSITORY_SOURCE));
const SUMMARY_WARNING_CODES = new Set(Object.values(REPOSITORY_WARNING_CODE));
const SUMMARY_OPERATIONS = new Set([
    'listActivities',
    'getActivity',
    'getStreams',
    'getAthlete',
    'getZones',
    'getGears'
]);
const SUMMARY_GEAR_LOAD_KEYS = new Set([
    'data',
    'partial',
    'status'
]);
const RUN_PLUS_STREAM_OPTION_KEYS = new Set(['types']);
const RUN_PLUS_RENDER_OPTION_KEYS = new Set([
    'sessionRepository',
    'sessionGears',
    'onFiltersChange'
]);
const RUN_PLUS_STREAM_TYPES = Object.freeze([
    'time',
    'distance',
    'velocity_smooth',
    'heartrate',
    'cadence',
    'altitude'
]);

function safeOperationalError() {
    const error = new Error('Operation failed.');
    error.name = 'OperationalError';
    return error;
}

function readPlainDataRecord(value, allowedKeys = null) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }

        const keys = Reflect.ownKeys(value);
        if (keys.some(key => (
            typeof key !== 'string'
            || (allowedKeys !== null && !allowedKeys.has(key))
        ))) {
            return null;
        }

        const result = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            Object.defineProperty(result, key, {
                value: descriptor.value,
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return result;
    } catch {
        return null;
    }
}

function inspectDenseDataArray(value, collectValues = false) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) {
            return null;
        }

        const keys = Reflect.ownKeys(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
            || lengthDescriptor.enumerable !== false
            || lengthDescriptor.configurable !== false
            || keys.length !== lengthDescriptor.value + 1
            || keys.some(key => typeof key !== 'string')
        ) {
            return null;
        }

        const keySet = new Set(keys);
        if (!keySet.has('length')) return null;

        const result = collectValues ? [] : null;
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const key = String(index);
            if (!keySet.has(key)) return null;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            if (collectValues) result.push(descriptor.value);
        }
        return Object.freeze({ values: result });
    } catch {
        return null;
    }
}

function readDenseDataArray(value) {
    return inspectDenseDataArray(value, true)?.values ?? null;
}

function isDenseDataArray(value) {
    return inspectDenseDataArray(value) !== null;
}

function normalizeRepositoryWarning(value, expectedOperation) {
    const warning = readPlainDataRecord(value, SUMMARY_WARNING_KEYS);
    if (
        warning === null
        || !SUMMARY_WARNING_CODES.has(warning.code)
        || warning.operation !== expectedOperation
        || typeof warning.retryable !== 'boolean'
    ) {
        return null;
    }

    const hasItemIndex = Object.hasOwn(warning, 'itemIndex');
    if (
        warning.code === REPOSITORY_WARNING_CODE.ITEM_FETCH_FAILED
        ? !hasItemIndex
            || !Number.isSafeInteger(warning.itemIndex)
            || warning.itemIndex < 0
        : hasItemIndex
    ) {
        return null;
    }

    return Object.freeze(hasItemIndex
        ? {
            code: warning.code,
            operation: warning.operation,
            retryable: warning.retryable,
            itemIndex: warning.itemIndex
        }
        : {
            code: warning.code,
            operation: warning.operation,
            retryable: warning.retryable
        });
}

export function adaptRepositoryResult(value, {
    operation,
    dataShape,
    allowPartial = false,
    warningObserver = null
} = {}) {
    if (!SUMMARY_OPERATIONS.has(operation)) throw safeOperationalError();

    const envelope = readPlainDataRecord(value, SUMMARY_ENVELOPE_KEYS);
    if (
        envelope === null
        || Reflect.ownKeys(envelope).length !== SUMMARY_ENVELOPE_KEYS.size
        || !SUMMARY_SOURCES.has(envelope.source)
        || typeof envelope.partial !== 'boolean'
        || (envelope.partial && !allowPartial)
    ) {
        throw safeOperationalError();
    }

    let dataIsValid = false;
    try {
        if (dataShape === 'array') {
            dataIsValid = isDenseDataArray(envelope.data);
        } else if (dataShape === 'object') {
            dataIsValid = readPlainDataRecord(envelope.data) !== null;
        } else if (dataShape === 'nullable-object') {
            dataIsValid = (
                envelope.data === null
                || readPlainDataRecord(envelope.data) !== null
            );
        }
    } catch {
        dataIsValid = false;
    }
    if (!dataIsValid) throw safeOperationalError();

    const warningValues = readDenseDataArray(envelope.warnings);
    if (warningValues === null) throw safeOperationalError();
    const warnings = Object.freeze(warningValues
        .map(warning => normalizeRepositoryWarning(warning, operation))
        .filter(Boolean));

    if (warnings.length > 0 && typeof warningObserver === 'function') {
        warningObserver(Object.freeze({
            operation,
            count: warnings.length
        }));
    }

    return Object.freeze({
        data: envelope.data,
        source: envelope.source,
        warnings,
        partial: envelope.partial
    });
}

export function createSummaryRepositorySession({
    sessionMode,
    repositoryFactory = createRepository,
    warningObserver = null
} = {}) {
    if (
        ![APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL].includes(sessionMode)
        || typeof repositoryFactory !== 'function'
    ) {
        throw safeOperationalError();
    }

    const featureFlags = sessionMode === APP_SESSION_MODE.REAL
        ? getFeatureFlags()
        : null;
    const repository = repositoryFactory({
        sessionMode,
        mode: featureFlags?.dataRepositoryMode === 'canonical'
            ? 'canonical'
            : 'legacy'
    });
    const shadowWriter = sessionMode === APP_SESSION_MODE.REAL
        ? getApplicationShadowWriter(featureFlags)
        : null;

    return Object.freeze({
        sessionMode,
        async listActivities({ refresh = false } = {}) {
            if (typeof refresh !== 'boolean') throw safeOperationalError();
            const value = await repository.listActivities({ refresh });
            const adapted = adaptRepositoryResult(value, {
                operation: 'listActivities',
                dataShape: 'array',
                allowPartial: false,
                warningObserver
            });
            if (
                shadowWriter
                && adapted.source === REPOSITORY_SOURCE.NETWORK
            ) {
                try {
                    shadowWriter.enqueueLegacyActivities(adapted.data);
                } catch {
                    // Shadow observation must never change Legacy success.
                }
            }
            return adapted;
        },
        async getActivity(activityId) {
            if (typeof activityId !== 'string' || activityId.trim().length === 0) {
                throw safeOperationalError();
            }
            return adaptRepositoryResult(await repository.getActivity(activityId), {
                operation: 'getActivity',
                dataShape: 'object',
                allowPartial: false,
                warningObserver
            });
        },
        async getStreams(activityId, options) {
            if (typeof activityId !== 'string' || activityId.trim().length === 0) {
                throw safeOperationalError();
            }
            const values = readPlainDataRecord(options, RUN_PLUS_STREAM_OPTION_KEYS);
            const types = values === null ? null : readDenseDataArray(values.types);
            if (
                values === null
                || Reflect.ownKeys(values).length !== RUN_PLUS_STREAM_OPTION_KEYS.size
                || types === null
                || types.length === 0
                || types.some(type => typeof type !== 'string' || type.trim().length === 0)
            ) {
                throw safeOperationalError();
            }
            return adaptRepositoryResult(
                await repository.getStreams(activityId, {
                    types: Object.freeze([...types])
                }),
                {
                    operation: 'getStreams',
                    dataShape: 'object',
                    allowPartial: false,
                    warningObserver
                }
            );
        },
        async getAthlete() {
            return adaptRepositoryResult(await repository.getAthlete(), {
                operation: 'getAthlete',
                dataShape: 'nullable-object',
                allowPartial: false,
                warningObserver
            });
        },
        async getZones() {
            return adaptRepositoryResult(await repository.getZones(), {
                operation: 'getZones',
                dataShape: 'nullable-object',
                allowPartial: false,
                warningObserver
            });
        },
        async getGears() {
            return adaptRepositoryResult(await repository.getGears(), {
                operation: 'getGears',
                dataShape: 'array',
                allowPartial: true,
                warningObserver
            });
        }
    });
}

export function establishSummaryRepositorySession({
    activeSessionMode,
    sessionRepository,
    requestedSessionMode,
    repositoryFactory = createRepository,
    warningObserver = null
} = {}) {
    if (
        ![APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL].includes(requestedSessionMode)
        || !(
            activeSessionMode === null
            || [APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL].includes(activeSessionMode)
        )
    ) {
        throw safeOperationalError();
    }

    if (sessionRepository !== null) {
        if (activeSessionMode !== requestedSessionMode) {
            throw safeOperationalError();
        }
        return Object.freeze({ activeSessionMode, sessionRepository });
    }
    if (activeSessionMode !== null && activeSessionMode !== requestedSessionMode) {
        throw safeOperationalError();
    }

    return Object.freeze({
        activeSessionMode: requestedSessionMode,
        sessionRepository: createSummaryRepositorySession({
            sessionMode: requestedSessionMode,
            repositoryFactory,
            warningObserver
        })
    });
}

export function requireSummaryRepositorySession(
    activeSessionMode,
    sessionRepository
) {
    if (
        ![APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL].includes(activeSessionMode)
        || sessionRepository === null
        || typeof sessionRepository !== 'object'
        || sessionRepository.sessionMode !== activeSessionMode
    ) {
        throw safeOperationalError();
    }
    return sessionRepository;
}

export async function loadActivitiesForSession({
    sessionRepository,
    refresh = false
} = {}) {
    if (
        sessionRepository === null
        || typeof sessionRepository !== 'object'
        || typeof sessionRepository.listActivities !== 'function'
        || typeof refresh !== 'boolean'
    ) {
        throw safeOperationalError();
    }
    return sessionRepository.listActivities({ refresh });
}

async function withTimeout(task, timeoutMs) {
    let timeoutId;
    try {
        return await Promise.race([
            task,
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(safeOperationalError()),
                    timeoutMs
                );
            })
        ]);
    } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
}

export async function loadInitializeAthleteAndZones(
    sessionRepository,
    { timeoutMs = 8000 } = {}
) {
    if (
        sessionRepository === null
        || typeof sessionRepository !== 'object'
        || typeof sessionRepository.getAthlete !== 'function'
        || typeof sessionRepository.getZones !== 'function'
        || !Number.isFinite(timeoutMs)
        || timeoutMs < 0
    ) {
        throw safeOperationalError();
    }

    const results = await Promise.allSettled([
        withTimeout(sessionRepository.getAthlete(), timeoutMs),
        withTimeout(sessionRepository.getZones(), timeoutMs)
    ]);
    return Object.freeze({
        athlete: results[0].status === 'fulfilled'
            ? results[0].value.data
            : null,
        zones: results[1].status === 'fulfilled'
            ? results[1].value.data
            : null,
        athleteStatus: results[0].status,
        zonesStatus: results[1].status
    });
}

export async function loadRefreshAthleteAndZones(sessionRepository) {
    if (
        sessionRepository === null
        || typeof sessionRepository !== 'object'
        || typeof sessionRepository.getAthlete !== 'function'
        || typeof sessionRepository.getZones !== 'function'
    ) {
        throw safeOperationalError();
    }
    const athlete = (await sessionRepository.getAthlete()).data;
    const zones = (await sessionRepository.getZones()).data;
    return Object.freeze({ athlete, zones });
}

export async function loadOptionalSessionGears(sessionRepository, athlete) {
    if (!athlete) {
        return Object.freeze({
            data: [],
            partial: false,
            status: 'skipped'
        });
    }
    try {
        const value = await sessionRepository.getGears();
        return Object.freeze({
            data: value.data,
            partial: value.partial,
            status: 'fulfilled'
        });
    } catch {
        return Object.freeze({
            data: [],
            partial: false,
            status: 'rejected'
        });
    }
}

export function resetSummarySessionGears() {
    return [];
}

export function applySummarySessionGearLoad(gearLoad) {
    const values = readPlainDataRecord(gearLoad, SUMMARY_GEAR_LOAD_KEYS);
    return (
        values !== null
        && Reflect.ownKeys(values).length === SUMMARY_GEAR_LOAD_KEYS.size
        && values.status === 'fulfilled'
        && typeof values.partial === 'boolean'
        && isDenseDataArray(values.data)
    )
        ? values.data
        : [];
}

export function activityLoadingMessage(source, count) {
    if (!SUMMARY_SOURCES.has(source) || !Number.isSafeInteger(count) || count < 0) {
        throw safeOperationalError();
    }
    return Object.freeze({
        [REPOSITORY_SOURCE.DEMO]: `Demo activities ready (${count})`,
        [REPOSITORY_SOURCE.CACHE]: `Activities loaded from cache (${count})`,
        [REPOSITORY_SOURCE.NETWORK]: `Activities downloaded (${count})`,
        [REPOSITORY_SOURCE.MIXED]: `Activities ready (${count})`,
        [REPOSITORY_SOURCE.CANONICAL]: `Local activities ready (${count})`
    })[source];
}

// B2_C_SESSION_GEAR_MAP_START
export function buildSessionGearNameMap(sessionGears) {
    const gears = Array.isArray(sessionGears) ? sessionGears : [];
    return new Map(gears.map(gear => {
        const label = gear?.name
            || [gear?.brand_name, gear?.model_name].filter(Boolean).join(' ')
            || gear?.id;
        return [gear?.id, label];
    }).filter(([gearId]) => gearId));
}
// B2_C_SESSION_GEAR_MAP_END

function readRunPlusSessionData(value) {
    const envelope = readPlainDataRecord(value, SUMMARY_ENVELOPE_KEYS);
    if (
        envelope === null
        || Reflect.ownKeys(envelope).length !== SUMMARY_ENVELOPE_KEYS.size
        || !SUMMARY_SOURCES.has(envelope.source)
        || envelope.partial !== false
        || !Array.isArray(envelope.warnings)
        || readPlainDataRecord(envelope.data) === null
    ) {
        throw safeOperationalError();
    }
    return envelope.data;
}

export function createRunPlusRenderOptions(value = {}) {
    const options = readPlainDataRecord(value, RUN_PLUS_RENDER_OPTION_KEYS);
    const repository = options === null
        ? null
        : readPlainDataRecord(options.sessionRepository);
    const gears = options === null
        ? null
        : readDenseDataArray(options.sessionGears);
    if (
        options === null
        || Reflect.ownKeys(options).length !== RUN_PLUS_RENDER_OPTION_KEYS.size
        || repository === null
        || typeof repository.getActivity !== 'function'
        || typeof repository.getStreams !== 'function'
        || gears === null
        || typeof options.onFiltersChange !== 'function'
    ) {
        throw safeOperationalError();
    }

    const readActivity = repository.getActivity;
    const readStreams = repository.getStreams;
    const getActivity = async activityId => {
        if (typeof activityId !== 'string' || activityId.trim().length === 0) {
            throw safeOperationalError();
        }
        try {
            return readRunPlusSessionData(await readActivity(activityId));
        } catch {
            throw safeOperationalError();
        }
    };
    const getStreams = async activityId => {
        if (typeof activityId !== 'string' || activityId.trim().length === 0) {
            throw safeOperationalError();
        }
        try {
            return readRunPlusSessionData(await readStreams(activityId, {
                types: [...RUN_PLUS_STREAM_TYPES]
            }));
        } catch {
            throw safeOperationalError();
        }
    };

    return Object.freeze({
        gears: Object.freeze([...gears]),
        getActivity,
        getStreams,
        onFiltersChange: options.onFiltersChange
    });
}

// B2_C_PREPROCESSING_CONTEXT_START
export function selectPreprocessingAthlete(sessionMode, athlete) {
    if (![APP_SESSION_MODE.DEMO, APP_SESSION_MODE.REAL].includes(sessionMode)) {
        throw safeOperationalError();
    }

    const values = readPlainDataRecord(athlete);
    const hasDisplayIdentity = values !== null && [
        values.firstname,
        values.lastname,
        values.username
    ].some(value => typeof value === 'string' && value.trim().length > 0);
    if (hasDisplayIdentity) return athlete;

    if (sessionMode === APP_SESSION_MODE.DEMO) {
        return Object.freeze({
            firstname: 'Demo',
            demoPreprocessingContext: true
        });
    }

    return Object.freeze({
        ...(values ?? {}),
        username: 'anonymous-session-context',
        preprocessingIdentitySentinel: true
    });
}
// B2_C_PREPROCESSING_CONTEXT_END
// PR04A_B1_SUMMARY_BOUNDARY_END

function logOperationalWarning(context) {
    console.warn(context);
}

export function showServiceWorkerUpdateBanner(documentObject = globalThis.document) {
    if (!documentObject?.body || typeof documentObject.createElement !== 'function') {
        return false;
    }

    let banner = documentObject.getElementById?.('service-worker-update-banner');
    if (!banner) {
        banner = documentObject.createElement('aside');
        banner.id = 'service-worker-update-banner';
        banner.className = 'service-worker-update-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        documentObject.body.append(banner);
    }
    banner.textContent = 'Update ready. Close all StravaStats tabs, then reopen.';
    return true;
}

function hasCoreVisualizationRuntime() {
    return typeof globalThis.Chart === 'function';
}

function showCoreVisualizationUnavailable(documentObject = document) {
    const container = documentObject.createElement('main');
    container.setAttribute('role', 'alert');
    const title = documentObject.createElement('h1');
    title.textContent = 'Visualization runtime unavailable';
    const message = documentObject.createElement('p');
    message.textContent = 'StravaStats could not start safely. No activity data was read.';
    container.append(title, message);
    documentObject.body.replaceChildren(container);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!hasCoreVisualizationRuntime()) {
        showCoreVisualizationUnavailable();
        return;
    }
    // --- STATE ---
    let allActivities = [];
    let activeSessionMode = null;
    let sessionRepository = null;
    const documentSessionMode = (() => {
        try {
            return isDemoMode()
                ? APP_SESSION_MODE.DEMO
                : APP_SESSION_MODE.REAL;
        } catch {
            return APP_SESSION_MODE.REAL;
        }
    })();
    let aiCoachSession = createAICoachSession({
        sessionMode: documentSessionMode,
        legacyStorage: documentSessionMode === APP_SESSION_MODE.REAL
            ? globalThis.localStorage
            : null
    });
    let aiCoachActivitySnapshot = null;
    let consumerRenderingEnabled = true;
    let sessionAthlete = null;
    let sessionZones = null;
    let sessionGears = [];
    let dateFilterFrom = null;
    let dateFilterTo = null;
    let trendsSportFilter = 'all';
    let trendsDataType = 'time';
    let runGearFilter = 'all';
    let bikeGearFilter = 'all';
    let runRollingWindow = 26; // default 6 months (26 weeks)
    let bikeRollingWindow = 26;
    let swimRollingWindow = 26;

    // --- Tab rendering config: maps tab id → { render function, uses date filters } ---
    const tabConfig = {
        'dashboard-tab': { render: () => renderDashboardTab(allActivities, dateFilterFrom, dateFilterTo), usesFilters: true },
        'run-tab': { render: () => renderRunAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, runRollingWindow), usesFilters: true },
        'run-plus-tab': { render: () => renderRunPlusTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, getRunPlusRenderOptions()), usesFilters: true },
        'bike-tab': { render: () => renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow), usesFilters: true },
        'swim-tab': { render: () => renderSwimAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, swimRollingWindow), usesFilters: true },
        'trends-tab': { render: () => renderTrendsTab(allActivities, dateFilterFrom, dateFilterTo, trendsSportFilter, trendsDataType, getTrendsMetadataContext()), usesFilters: true },
        'planner-tab': { render: () => renderPlannerTab(allActivities) },
        'gear-tab': { render: () => renderGearTab(allActivities, sessionGears) },
        'activities-tab': { render: () => renderActivitiesTab(allActivities) },
        'calendar-tab': { render: () => renderCalendarTab(allActivities) },
        'weather-tab': { render: () => renderWeatherTab(allActivities, { sessionMode: activeSessionMode }) },
        'map-tab': {
            render: () => renderMapTab(allActivities, dateFilterFrom, dateFilterTo, {
                sessionMode: activeSessionMode
            }),
            usesFilters: true
        },
        'wrapped-tab': { render: () => renderWrappedTab(allActivities) },
        'ai-chat-tab': {
            render: () => renderAIChatTab(aiCoachActivitySnapshot, {
                sessionMode: activeSessionMode,
                aiCoach: aiCoachSession
            })
        },
    };
    const renderedTabs = new Set();

    // --- DOM REFERENCES ---
    const loginButton = document.getElementById('login-button');
    const demoButton = document.getElementById('demo-button');
    const logoutButton = document.getElementById('logout-button');
    const refreshButton = document.getElementById('refresh-button');
    const kofiButton = document.getElementById('kofi-button');
    const loginSection = document.getElementById('login-section');
    const appSection = document.getElementById('app-section');
    const localFirstError = document.getElementById('local-first-error');
    const sourceStatus = document.getElementById('source-status');

    function buildAICoachActivitySnapshot(activities) {
        if (activeSessionMode !== APP_SESSION_MODE.REAL || aiCoachSession.enabled !== true) return null;
        try {
            const builder = aiCoachSession.createActivitySnapshot();
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
        } catch {
            return null;
        }
    }

    // Run Tab
    const applyFilterButton = document.getElementById('apply-date-filter');
    const resetFilterButton = document.getElementById('reset-date-filter');
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    const runGearFilterEl = document.getElementById('run-gear-filter');

    // Bike Tab
    const bikeApplyFilterButton = document.getElementById('bike-apply-date-filter');
    const bikeResetFilterButton = document.getElementById('bike-reset-date-filter');
    const bikeDateFromEl = document.getElementById('bike-date-from');
    const bikeDateToEl = document.getElementById('bike-date-to');
    const bikeGearFilterEl = document.getElementById('bike-gear-filter');

    // Swim Tab
    const swimApplyFilterButton = document.getElementById('swim-apply-date-filter');
    const swimResetFilterButton = document.getElementById('swim-reset-date-filter');
    const swimDateFromEl = document.getElementById('swim-date-from');
    const swimDateToEl = document.getElementById('swim-date-to');

    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettings = document.getElementById('close-settings');

    const unitSelect = document.getElementById('units');
    const hrMaxInput = document.getElementById('hr-max');
    const ageInput = document.getElementById('age');
    const bgImagesToggle = document.getElementById('bg-images-toggle');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    // --- SETTINGS ---
    if (settingsButton && settingsPanel && closeSettings) {
        settingsButton.addEventListener('click', () => {
            settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
        });
        closeSettings.addEventListener('click', () => {
            settingsPanel.style.display = 'none';
        });
    }

    function applyBgImages(enabled) {
        document.documentElement.dataset.tabBackgroundImages = enabled ? 'on' : 'off';
        document.documentElement.style.setProperty(
            '--tab-bg-overlay',
            enabled ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 1)'
        );
    }

    function applyDarkMode(enabled) {
        document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    }

    function loadSettings() {
        let saved;
        try {
            saved = readPlainDataRecord(
                JSON.parse(localStorage.getItem('dashboard_settings') || '{}')
            ) ?? {};
        } catch {
            saved = {};
        }
        if (saved.units && unitSelect) unitSelect.value = saved.units;
        if (saved.hrMax && hrMaxInput) hrMaxInput.value = saved.hrMax;
        if (saved.age && ageInput) ageInput.value = saved.age;
        const bgEnabled = saved.bgImages === true;
        if (bgImagesToggle) bgImagesToggle.checked = bgEnabled;
        applyBgImages(bgEnabled);
        const darkEnabled = saved.darkMode === true;
        if (darkModeToggle) darkModeToggle.checked = darkEnabled;
        applyDarkMode(darkEnabled);
    }

    function saveSettings() {
        const settings = {
            units: unitSelect?.value,
            hrMax: hrMaxInput?.value,
            age: ageInput?.value,
            bgImages: bgImagesToggle?.checked || false,
            darkMode: darkModeToggle?.checked || false
        };
        localStorage.setItem('dashboard_settings', JSON.stringify(settings));
        applyBgImages(settings.bgImages);
        applyDarkMode(settings.darkMode);
    }

    loadSettings();

    if (unitSelect) unitSelect.addEventListener('change', saveSettings);
    if (hrMaxInput) hrMaxInput.addEventListener('input', saveSettings);
    if (ageInput) ageInput.addEventListener('input', saveSettings);
    if (bgImagesToggle) bgImagesToggle.addEventListener('change', saveSettings);
    if (darkModeToggle) darkModeToggle.addEventListener('change', saveSettings);

    // --- TAB NAVIGATION ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const WIP_TABS = {
        'weather-tab': 'Weather is currently Work in Progress. Some metrics may be incomplete.\n\nDo you want to continue anyway?',
        'ai-chat-tab': 'AI Coach is currently Work in Progress. Responses and features may be unstable.\n\nDo you want to continue anyway?',

    };

    const routeToTab = {
        '/': 'dashboard-tab',
        '/run': 'run-tab',
        '/run-plus': 'run-plus-tab',
        '/run-plus/nsm': 'run-plus-tab',
        '/dashboard': 'dashboard-tab',
        '/bike': 'bike-tab',
        '/swim': 'swim-tab',
        '/trends': 'trends-tab',
        '/planner': 'planner-tab',
        '/gear': 'gear-tab',
        '/activities': 'activities-tab',
        '/calendar': 'calendar-tab',
        '/weather': 'weather-tab',
        '/map': 'map-tab',
        '/wrapped': 'wrapped-tab',

        '/ai-coach': 'ai-chat-tab'
    };

    const tabToRoute = {
        'run-tab': '/run',
        'run-plus-tab': '/run-plus',
        'dashboard-tab': '/dashboard',
        'bike-tab': '/bike',
        'swim-tab': '/swim',
        'trends-tab': '/trends',
        'planner-tab': '/planner',
        'gear-tab': '/gear',
        'activities-tab': '/activities',
        'calendar-tab': '/calendar',
        'weather-tab': '/weather',
        'map-tab': '/map',
        'wrapped-tab': '/wrapped',

        'ai-chat-tab': '/ai-coach'
    };

    function normalizePath(pathname) {
        if (!pathname) return '/';
        return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    }

    function getTabIdFromPath(pathname) {
        const normalized = normalizePath(pathname);
        return routeToTab[normalized] || 'dashboard-tab'; // Default to dashboard-tab
    }

    function setupWipTabIndicators() {
        Object.entries(WIP_TABS).forEach(([tabId]) => {
            const link = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
            if (!link) return;
            link.classList.add('tab-link-wip');
            link.title = 'Work in Progress';
            link.setAttribute('aria-label', `${link.textContent.trim()} (Work in Progress)`);

            if (!link.querySelector('.tab-wip-badge')) {
                const badge = document.createElement('span');
                badge.className = 'tab-wip-badge';
                badge.textContent = 'WIP';
                badge.setAttribute('aria-hidden', 'true');
                link.appendChild(badge);
            }
        });
    }

    function syncDateInputs() {
        // Sync all date inputs with current filter state
        if (dateFromEl) dateFromEl.value = dateFilterFrom || '';
        if (dateToEl) dateToEl.value = dateFilterTo || '';
        if (bikeDateFromEl) bikeDateFromEl.value = dateFilterFrom || '';
        if (bikeDateToEl) bikeDateToEl.value = dateFilterTo || '';
        if (swimDateFromEl) swimDateFromEl.value = dateFilterFrom || '';
        if (swimDateToEl) swimDateToEl.value = dateFilterTo || '';
        if (runGearFilterEl) runGearFilterEl.value = runGearFilter || 'all';
        if (bikeGearFilterEl) bikeGearFilterEl.value = bikeGearFilter || 'all';
    }

    function getGearNameMap() {
        return buildSessionGearNameMap(sessionGears);
    }

    function populateGearFilters() {
        const gearNameMap = getGearNameMap();

        const buildOptions = (activities) => {
            const uniqueGearIds = [...new Set(
                activities
                    .map(activity => activity.gear_id)
                    .filter(Boolean)
            )];

            return [
                { value: 'all', label: 'All' },
                ...uniqueGearIds.map(gearId => ({ value: gearId, label: gearNameMap.get(gearId) || gearId }))
            ];
        };

        const runActivities = allActivities.filter(activity => activity.type && activity.type.includes('Run'));
        const bikeActivities = allActivities.filter(activity =>
            activity.type === 'Ride' ||
            activity.sport_type === 'Ride' ||
            activity.sport_type === 'MountainBikeRide'
        );

        const runOptions = buildOptions(runActivities);
        const bikeOptions = buildOptions(bikeActivities);

        const setOptions = (selectEl, options) => {
            if (!selectEl) return;
            const optionElements = options.map(option => {
                const optionEl = document.createElement('option');
                optionEl.value = String(option.value);
                optionEl.textContent = String(option.label);
                return optionEl;
            });
            selectEl.replaceChildren(...optionElements);
        };

        setOptions(runGearFilterEl, runOptions);
        setOptions(bikeGearFilterEl, bikeOptions);

        const runValues = new Set(runOptions.map(option => option.value));
        const bikeValues = new Set(bikeOptions.map(option => option.value));
        if (!runValues.has(runGearFilter)) runGearFilter = 'all';
        if (!bikeValues.has(bikeGearFilter)) bikeGearFilter = 'all';

        syncDateInputs();
    }

    let activeTabId = null;

    function getTrendsMetadataContext() {
        return {
            athleteData: sessionAthlete,
            zonesData: sessionZones
        };
    }

    function getRunPlusRenderOptions() {
        return createRunPlusRenderOptions({
            sessionRepository: requireSummaryRepositorySession(
                activeSessionMode,
                sessionRepository
            ),
            sessionGears,
            onFiltersChange: handleRunPlusFiltersChange
        });
    }

    function handleRunPlusFiltersChange({ dateFilterFrom: newFrom = null, dateFilterTo: newTo = null, gearFilter: newGear = 'all' } = {}) {
        dateFilterFrom = newFrom || null;
        dateFilterTo = newTo || null;
        runGearFilter = newGear || 'all';

        if (dateFromEl) dateFromEl.value = dateFilterFrom || '';
        if (dateToEl) dateToEl.value = dateFilterTo || '';
        if (runGearFilterEl) runGearFilterEl.value = runGearFilter;
        document.querySelectorAll('#year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));

        if (dateFilterFrom && dateFilterTo && dateFilterFrom.slice(5) === '01-01' && dateFilterTo.slice(5) === '12-31') {
            const year = dateFilterFrom.slice(0, 4);
            document.querySelector(`#year-filter-buttons .year-btn[data-year="${year}"]`)?.classList.add('active');
        }

        saveFilterState();
        renderRunRelatedTabs();
    }

    function renderRunRelatedTabs() {
        renderRunAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, runRollingWindow);
        if (renderedTabs.has('run-plus-tab') || activeTabId === 'run-plus-tab') {
            renderRunPlusTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, getRunPlusRenderOptions());
            renderedTabs.add('run-plus-tab');
        }
    }

    function activateTab(tabId, { updateUrl = false, replaceUrl = false } = {}) {
        if (!consumerRenderingEnabled) return;
        if (tabId === activeTabId) {
            if (tabId === 'run-plus-tab' && tabConfig[tabId]) {
                requestAnimationFrame(() => tabConfig[tabId].render());
            } else if (tabId === 'ai-chat-tab'
                && !renderedTabs.has(tabId)
                && tabConfig[tabId]) {
                renderedTabs.add(tabId);
                requestAnimationFrame(() => tabConfig[tabId].render());
            }
            return; // skip if already active
        }

        const link = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
        const content = document.getElementById(tabId);
        if (!link || !content) return;

        if (activeTabId === 'ai-chat-tab' && tabId !== 'ai-chat-tab') {
            aiCoachSession.cancelPending();
            renderedTabs.delete('ai-chat-tab');
        }

        // Deactivate previous tab directly instead of looping all
        if (activeTabId) {
            const prevLink = document.querySelector(`.tab-link[data-tab="${activeTabId}"]`);
            const prevContent = document.getElementById(activeTabId);
            if (prevLink) prevLink.classList.remove('active');
            if (prevContent) prevContent.classList.remove('active');
        } else {
            // First time - clean all (fallback for initial load)
            tabLinks.forEach(item => item.classList.remove('active'));
            tabContents.forEach(item => item.classList.remove('active'));
        }

        link.classList.add('active');
        content.classList.add('active');
        activeTabId = tabId;

        // Scroll active tab into view on mobile
        link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        // Sync date inputs when switching tabs
        syncDateInputs();

        // Lazy-render tabs on first visit (deferred to next frame)
        if (!renderedTabs.has(tabId) && tabConfig[tabId]) {
            renderedTabs.add(tabId);
            requestAnimationFrame(() => tabConfig[tabId].render());
        }

        if (updateUrl) {
            const currentRoute = normalizePath(window.location.pathname);
            const route = replaceUrl && tabId === 'run-plus-tab' && routeToTab[currentRoute] === 'run-plus-tab'
                ? currentRoute
                : (tabToRoute[tabId] || '/run');
            const method = replaceUrl ? 'replaceState' : 'pushState';
            window.history[method]({ tabId }, '', route);
        }
    }

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            const warningMessage = WIP_TABS[tabId];
            if (warningMessage) {
                const proceed = window.confirm(warningMessage);
                if (!proceed) return;
            }
            activateTab(tabId, { updateUrl: true });
        });
    });

    setupWipTabIndicators();

    window.addEventListener('popstate', () => {
        activateTab(getTabIdFromPath(window.location.pathname));
    });

    // --- FILTER STATE PERSISTENCE ---
    function saveFilterState() {
        try {
            localStorage.setItem('dashboard_filters', JSON.stringify({
                dateFilterFrom,
                dateFilterTo,
                trendsSportFilter,
                trendsDataType,
                runGearFilter,
                bikeGearFilter
            }));
        } catch {
            // User-owned filter persistence is optional for local startup.
        }
    }

    function loadFilterState() {
        let filters = {};
        try {
            const saved = localStorage.getItem('dashboard_filters');
            filters = saved
                ? readPlainDataRecord(JSON.parse(saved)) ?? {}
                : {};
        } catch {
            filters = {};
        }

        // Always start with no date filter on app load.
        dateFilterFrom = null;
        dateFilterTo = null;
        trendsSportFilter = filters.trendsSportFilter || filters.athleteSportFilter || 'all';
        trendsDataType = filters.trendsDataType || filters.athleteDataType || 'time';
        runGearFilter = filters.runGearFilter || 'all';
        bikeGearFilter = filters.bikeGearFilter || 'all';

        syncDateInputs();

        // Persist the reset so a hard refresh also starts unfiltered.
        saveFilterState();
    }

    // --- YEAR FILTER BUTTONS ---
    function setupYearlySelector() {
        const yearsToShow = 5;

        // Setup for Run Tab
        const runContainer = document.getElementById('year-filter-buttons');
        const bikeContainer = document.getElementById('bike-year-filter-buttons');
        const swimContainer = document.getElementById('swim-year-filter-buttons');

        if ((runContainer || bikeContainer || swimContainer) && allActivities.length === 0) return;

        const years = [...new Set(allActivities.map(a => a.start_date_local.substring(0, 4)))]
            .sort((a, b) => b - a);

        const yearButtonsHTML = years.slice(0, yearsToShow).map(year =>
            `<button class="year-btn" data-year="${year}">${year}</button>`
        ).join('');

        // Populate all three containers
        if (runContainer) runContainer.innerHTML = yearButtonsHTML;
        if (bikeContainer) bikeContainer.innerHTML = yearButtonsHTML;
        if (swimContainer) swimContainer.innerHTML = yearButtonsHTML;

        // Setup event listeners for Run Tab
        if (runContainer) {
            runContainer.querySelectorAll('.year-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    runContainer.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const year = btn.dataset.year;
                    dateFilterFrom = `${year}-01-01`;
                    dateFilterTo = `${year}-12-31`;

                    if (dateFromEl) dateFromEl.value = dateFilterFrom;
                    if (dateToEl) dateToEl.value = dateFilterTo;
                    runGearFilter = runGearFilterEl?.value || runGearFilter || 'all';
                    saveFilterState();

                    renderRunRelatedTabs();
                });
            });
        }

        // Setup event listeners for Bike Tab
        if (bikeContainer) {
            bikeContainer.querySelectorAll('.year-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    bikeContainer.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const year = btn.dataset.year;
                    dateFilterFrom = `${year}-01-01`;
                    dateFilterTo = `${year}-12-31`;

                    if (bikeDateFromEl) bikeDateFromEl.value = dateFilterFrom;
                    if (bikeDateToEl) bikeDateToEl.value = dateFilterTo;
                    bikeGearFilter = bikeGearFilterEl?.value || bikeGearFilter || 'all';
                    saveFilterState();

                    renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow);
                });
            });
        }

        // Setup event listeners for Swim Tab
        if (swimContainer) {
            swimContainer.querySelectorAll('.year-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    swimContainer.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const year = btn.dataset.year;
                    dateFilterFrom = `${year}-01-01`;
                    dateFilterTo = `${year}-12-31`;

                    if (swimDateFromEl) swimDateFromEl.value = dateFilterFrom;
                    if (swimDateToEl) swimDateToEl.value = dateFilterTo;
                    saveFilterState();

                    renderSwimAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, swimRollingWindow);
                });
            });
        }
    }

    function renderSourceStatus(state) {
        if (!sourceStatus) return;
        const localCopy = {
            [LOCAL_FIRST_STATUS.READY]: 'Local Library ready',
            [LOCAL_FIRST_STATUS.DEGRADED]: 'Local Library degraded',
            [LOCAL_FIRST_STATUS.UNAVAILABLE]: 'Local Library unavailable',
            [LOCAL_FIRST_STATUS.DEMO]: 'Demo Library'
        }[state.localStatus] || 'Local Library unavailable';
        const stravaCopy = {
            [STRAVA_SOURCE_STATUS.CONNECTED]: 'Strava connected',
            [STRAVA_SOURCE_STATUS.NOT_CONNECTED]: 'Strava not connected',
            [STRAVA_SOURCE_STATUS.RECONNECT_REQUIRED]: 'Strava reconnect needed',
            [STRAVA_SOURCE_STATUS.UNAVAILABLE]: 'Strava status unavailable',
            [STRAVA_SOURCE_STATUS.DEMO]: 'Demo source'
        }[state.stravaStatus] || 'Strava status unavailable';
        const networkCopy = state.networkStatus === LOCAL_FIRST_NETWORK_STATUS.OFFLINE
            ? 'offline'
            : state.networkStatus === LOCAL_FIRST_NETWORK_STATUS.ONLINE
                ? 'online'
                : 'network unknown';
        sourceStatus.textContent = `${localCopy} · ${stravaCopy} · ${networkCopy}`;
    }

    function showLocalDashboardShell(state) {
        renderSourceStatus(state);
        loginSection?.classList.add('hidden');
        appSection?.classList.remove('hidden');
        consumerRenderingEnabled = false;
        tabLinks.forEach(link => {
            link.disabled = true;
            link.setAttribute('aria-disabled', 'true');
        });
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.title = 'Summary refresh becomes available from the compatible data path.';
        }
        const topline = document.getElementById('dashboard-topline');
        if (topline) {
            topline.textContent = 'Local Library is ready. Open Sources to import or manage local activities.';
        }
        hideLoading();
    }

    function showLocalFirstBlocked(state) {
        renderSourceStatus(state);
        appSection?.classList.add('hidden');
        loginSection?.classList.remove('hidden');
        if (localFirstError) localFirstError.hidden = false;
        hideLoading();
    }

    async function initializeLocalDashboard(state) {
        renderSourceStatus(state);
        if (getFeatureFlags().dataRepositoryMode === 'canonical') {
            await initializeApp(null);
            return;
        }
        if (state.legacyActivities.length === 0) {
            showLocalDashboardShell(state);
            return;
        }
        await initializeApp(null, state.legacyActivities);
    }

    // --- INITIALIZATION ---
    async function initializeApp(tokenData, localActivities = null) {
        const localOnly = localActivities !== null;
        sessionAthlete = null;
        sessionZones = null;
        sessionGears = resetSummarySessionGears();
        setRunSessionGears(sessionGears);
        const requestedSessionMode = documentSessionMode;
        const t0 = Date.now();
        const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s elapsed`;
        showLoading('Preparing dashboard...', 2, elapsed());
        let progress = 0;

        try {
            const establishedSession = establishSummaryRepositorySession({
                activeSessionMode,
                sessionRepository,
                requestedSessionMode,
                repositoryFactory: createRepository,
                warningObserver: ({ operation, count }) => {
                    logOperationalWarning(
                        `Repository warning (${operation}: ${count})`
                    );
                }
            });
            activeSessionMode = establishedSession.activeSessionMode;
            sessionRepository = establishedSession.sessionRepository;
            const repository = requireSummaryRepositorySession(
                activeSessionMode,
                sessionRepository
            );
            const sessionMode = activeSessionMode;

            // Phase 1: Load activities (0% -> 40%)
            progress = 8;
            showLoading(
                sessionMode === APP_SESSION_MODE.DEMO
                    ? 'Loading Demo activities...'
                    : 'Checking local cache...',
                progress,
                elapsed()
            );

            let selectedActivityLoad;
            if (localOnly) {
                selectedActivityLoad = Object.freeze({
                    data: structuredClone(localActivities),
                    source: REPOSITORY_SOURCE.CACHE,
                    warnings: Object.freeze([]),
                    partial: false
                });
            } else {
                const activityLoad = await loadActivitiesForSession({
                    sessionRepository: repository,
                    refresh: false
                });
                selectedActivityLoad = activityLoad;
            }
            const activityLoad = selectedActivityLoad;
            const activities = activityLoad.data;
            if (
                activityLoad.source === REPOSITORY_SOURCE.CANONICAL
                && activities.length === 0
            ) {
                window.location.assign('/source-manager.html?mode=real');
                return;
            }
            if (
                activityLoad.source === REPOSITORY_SOURCE.CANONICAL
                && sourceStatus
            ) {
                sourceStatus.textContent = 'Local Library ready · Canonical summaries · provider offline';
            }
            progress = 40;
            showLoading(
                localOnly
                    ? 'Loading local activities...'
                    : activityLoadingMessage(activityLoad.source, activities.length),
                progress,
                elapsed()
            );
            if (!localOnly) console.log(`Activities loaded (${activities.length})`);

            // Phase 2: Load athlete, zones, and gears (40% -> 90%)
            // These are optional - if they fail, continue without them
            let athlete = null;
            let zones = null;
            let gears = [];

            if (!localOnly) {
                progress = 52;
                showLoading('Loading athlete profile and zones...', progress, elapsed());

                const metadata = await loadInitializeAthleteAndZones(repository);
                athlete = metadata.athlete;
                zones = metadata.zones;
                sessionAthlete = athlete;
                sessionZones = zones;

                if (metadata.athleteStatus === 'fulfilled') {
                    console.log('Athlete profile loaded');
                } else {
                    sessionAthlete = null;
                    logOperationalWarning('Failed to load athlete data');
                }
                if (metadata.zonesStatus === 'fulfilled') {
                    console.log('Training zones loaded');
                } else {
                    sessionZones = null;
                    logOperationalWarning('Failed to load zones data');
                }

                if (athlete || zones) {
                    progress = 65;
                    showLoading('Athlete profile and zones ready', progress, elapsed());
                } else {
                    showLoading('Athlete/zones unavailable (timeout or error), continuing...', 65, elapsed());
                }

                if (athlete) {
                    showLoading('Loading gear usage...', 72, elapsed());
                }
                const gearLoad = await loadOptionalSessionGears(
                    repository,
                    athlete
                );
                sessionGears = applySummarySessionGearLoad(gearLoad);
                setRunSessionGears(sessionGears);
                gears = sessionGears;
                if (gearLoad.status === 'fulfilled') {
                    console.log(`Gears loaded (${gears.length})`);
                } else if (gearLoad.status === 'rejected') {
                    logOperationalWarning(
                        'Failed to load gears; continuing without gear metadata'
                    );
                    showLoading('Gear unavailable, continuing...', 76, elapsed());
                }
            }

            progress = 90;
            showLoading('Processing and enriching activities...', progress, elapsed());

            // Phase 3: Preprocess activities (90% -> 100%)
            const preprocessingAthlete = selectPreprocessingAthlete(
                sessionMode,
                athlete
            );
            const preprocessingActivities = activityLoad.source === REPOSITORY_SOURCE.CANONICAL
                ? structuredClone(activities)
                : activities;
            const preprocessed = await preprocessActivities(
                preprocessingActivities,
                preprocessingAthlete,
                zones,
                gears
            );
            allActivities = preprocessed;
            aiCoachActivitySnapshot = buildAICoachActivitySnapshot(allActivities);
            if (!localOnly) console.log(`Activities prepared (${allActivities.length})`);

            progress = 100;
            showLoading('Finalizing UI...', progress, elapsed());

            setupDashboard(allActivities);
            loadFilterState();
            populateGearFilters();
            renderRunAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, runRollingWindow);
            renderedTabs.add('run-tab');
            setupYearlySelector();

            // Initialize Ko-fi support system
            initKofiSystem();

            const initialTabId = getTabIdFromPath(window.location.pathname);
            activateTab(initialTabId, { updateUrl: true, replaceUrl: true });
        } catch {
            recordDiagnosticError({
                page: 'dashboard',
                category: 'page',
                code: 'DASHBOARD_INITIALIZE_FAILED'
            });
            handleError('Could not initialize the app', safeOperationalError());
        } finally {
            hideLoading();
        }
    }

    async function refreshActivities() {
        const sessionMode = activeSessionMode;
        const canonicalRefresh = sessionMode === APP_SESSION_MODE.REAL
            && getFeatureFlags().dataRepositoryMode === 'canonical';
        sessionAthlete = null;
        sessionZones = null;
        sessionGears = resetSummarySessionGears();
        setRunSessionGears(sessionGears);
        const t0 = Date.now();
        const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s elapsed`;
        showLoading(
            sessionMode === APP_SESSION_MODE.DEMO
                ? 'Refreshing Demo activities...'
                : canonicalRefresh
                    ? 'Refreshing Canonical summaries from Local Library...'
                    : 'Refreshing activities from Strava...',
            20,
            elapsed()
        );
        try {
            const repository = requireSummaryRepositorySession(
                activeSessionMode,
                sessionRepository
            );
            const activityLoad = await loadActivitiesForSession({
                sessionRepository: repository,
                refresh: true
            });
            const activities = activityLoad.data;
            const metadata = await loadRefreshAthleteAndZones(repository);
            const athlete = metadata.athlete;
            const zones = metadata.zones;
            sessionAthlete = athlete;
            sessionZones = zones;
            const gearLoad = await loadOptionalSessionGears(
                repository,
                athlete
            );
            sessionGears = applySummarySessionGearLoad(gearLoad);
            setRunSessionGears(sessionGears);
            const gears = sessionGears;
            if (gearLoad.status === 'rejected') {
                logOperationalWarning(
                    'Failed to load gears during refresh; continuing without gear metadata'
                );
            }

            // Keep refresh aligned with initial load: preprocessing is rebuilt from raw activities.
            const preprocessingAthlete = selectPreprocessingAthlete(
                sessionMode,
                athlete
            );
            const preprocessingActivities = activityLoad.source === REPOSITORY_SOURCE.CANONICAL
                ? structuredClone(activities)
                : activities;
            allActivities = await preprocessActivities(
                preprocessingActivities,
                preprocessingAthlete,
                zones,
                gears
            );
            aiCoachActivitySnapshot = buildAICoachActivitySnapshot(allActivities);
            if (
                activityLoad.source === REPOSITORY_SOURCE.CANONICAL
                && sourceStatus
            ) {
                sourceStatus.textContent = 'Local Library ready · Canonical summaries · provider offline';
            }
            console.log(`Activities refreshed (${allActivities.length})`);
            showLoading(`Rebuilding views (${allActivities.length} activities)...`, 80, elapsed());

            // Reset rendered state so tabs re-render with fresh data
            renderedTabs.clear();
            loadFilterState();
            populateGearFilters();
            renderRunAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, runGearFilter, runRollingWindow);
            renderedTabs.add('run-tab');
            setupYearlySelector();
            activateTab(getTabIdFromPath(window.location.pathname));
            showLoading('Refresh completed', 100, elapsed());
        } catch {
            recordDiagnosticError({
                page: 'dashboard',
                category: 'page',
                code: 'DASHBOARD_REFRESH_FAILED'
            });
            handleError('Error refreshing activities', safeOperationalError());
        } finally {
            hideLoading();
        }
    }



    // --- EVENT LISTENERS ---
    if (loginButton) loginButton.addEventListener('click', redirectToStrava);
    if (demoButton) demoButton.addEventListener('click', () => {
        aiCoachSession.revoke();
        aiCoachActivitySnapshot = null;
        aiCoachSession = createAICoachSession({
            sessionMode: APP_SESSION_MODE.DEMO
        });
        loginWithDemo(initializeApp);
    });
    if (logoutButton) logoutButton.addEventListener('click', () => {
        aiCoachSession.revoke();
        aiCoachActivitySnapshot = null;
        logout();
    });
    if (refreshButton) refreshButton.addEventListener('click', () => {
        aiCoachSession.cancelPending();
        refreshActivities();
    });
    if (kofiButton) kofiButton.addEventListener('click', showKofiModal);

    // --- SERVICE WORKER REGISTRATION (PWA) ---
    window.addEventListener('load', () => {
        applyServiceWorkerPolicy({
            onLifecycleState({ code }) {
                if (code === SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_WAITING) {
                    showServiceWorkerUpdateBanner();
                }
            }
        })
            .catch(error => {
                logOperationalWarning(
                    'Unable to apply Service Worker policy'
                );
            });
    });

    // --- TRENDS FILTER LISTENERS (via custom event) ---
    document.addEventListener('trends-filters-changed', (e) => {
        const { dateFilterFrom: newFrom, dateFilterTo: newTo, sportFilter, dataType, allActivities: activities } = e.detail;
        trendsSportFilter = sportFilter;
        trendsDataType = dataType;
        dateFilterFrom = newFrom;
        dateFilterTo = newTo;
        saveFilterState();
        renderTrendsTab(
            activities,
            dateFilterFrom,
            dateFilterTo,
            trendsSportFilter,
            trendsDataType,
            getTrendsMetadataContext()
        );
    });

    if (applyFilterButton) {
        applyFilterButton.addEventListener('click', () => {
            document.querySelectorAll('#year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            dateFilterFrom = dateFromEl?.value || null;
            dateFilterTo = dateToEl?.value || null;
            runGearFilter = runGearFilterEl?.value || 'all';
            saveFilterState();
            renderRunRelatedTabs();
        });
    }

    if (resetFilterButton) {
        resetFilterButton.addEventListener('click', () => {
            dateFilterFrom = null;
            dateFilterTo = null;
            if (dateFromEl) dateFromEl.value = '';
            if (dateToEl) dateToEl.value = '';
            runGearFilter = 'all';
            if (runGearFilterEl) runGearFilterEl.value = 'all';
            document.querySelectorAll('#year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            saveFilterState();
            renderRunRelatedTabs();
        });
    }

    if (runGearFilterEl) {
        runGearFilterEl.addEventListener('change', () => {
            runGearFilter = runGearFilterEl.value || 'all';
            saveFilterState();
            renderRunRelatedTabs();
        });
    }

    // Rolling mean window selector for Run Tab
    const runRollingWindowEl = document.getElementById('rolling-window-run');
    if (runRollingWindowEl) {
        runRollingWindow = parseInt(runRollingWindowEl.value) || 26;
        runRollingWindowEl.addEventListener('change', () => {
            runRollingWindow = parseInt(runRollingWindowEl.value) || 26;
            renderRunRelatedTabs();
        });
    }

    // Rolling mean window selector for Bike Tab
    const bikeRollingWindowEl = document.getElementById('rolling-window-bike');
    if (bikeRollingWindowEl) {
        bikeRollingWindow = parseInt(bikeRollingWindowEl.value) || 26;
        bikeRollingWindowEl.addEventListener('change', () => {
            bikeRollingWindow = parseInt(bikeRollingWindowEl.value) || 26;
            renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow);
        });
    }

    // Rolling mean window selector for Swim Tab
    const swimRollingWindowEl = document.getElementById('rolling-window-swim');
    if (swimRollingWindowEl) {
        swimRollingWindow = parseInt(swimRollingWindowEl.value) || 26;
        swimRollingWindowEl.addEventListener('change', () => {
            swimRollingWindow = parseInt(swimRollingWindowEl.value) || 26;
            renderSwimAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, swimRollingWindow);
        });
    }

    // Bike Tab Filters
    if (bikeApplyFilterButton) {
        bikeApplyFilterButton.addEventListener('click', () => {
            document.querySelectorAll('#bike-year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            dateFilterFrom = bikeDateFromEl?.value || null;
            dateFilterTo = bikeDateToEl?.value || null;
            bikeGearFilter = bikeGearFilterEl?.value || 'all';
            saveFilterState();
            renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow);
        });
    }

    if (bikeResetFilterButton) {
        bikeResetFilterButton.addEventListener('click', () => {
            dateFilterFrom = null;
            dateFilterTo = null;
            if (bikeDateFromEl) bikeDateFromEl.value = '';
            if (bikeDateToEl) bikeDateToEl.value = '';
            bikeGearFilter = 'all';
            if (bikeGearFilterEl) bikeGearFilterEl.value = 'all';
            document.querySelectorAll('#bike-year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            saveFilterState();
            renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow);
        });
    }

    if (bikeGearFilterEl) {
        bikeGearFilterEl.addEventListener('change', () => {
            bikeGearFilter = bikeGearFilterEl.value || 'all';
            saveFilterState();
            renderBikeAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, bikeGearFilter, bikeRollingWindow);
        });
    }

    // Swim Tab Filters
    if (swimApplyFilterButton) {
        swimApplyFilterButton.addEventListener('click', () => {
            document.querySelectorAll('#swim-year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            dateFilterFrom = swimDateFromEl?.value || null;
            dateFilterTo = swimDateToEl?.value || null;
            saveFilterState();
            renderSwimAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, swimRollingWindow);
        });
    }

    if (swimResetFilterButton) {
        swimResetFilterButton.addEventListener('click', () => {
            dateFilterFrom = null;
            dateFilterTo = null;
            if (swimDateFromEl) swimDateFromEl.value = '';
            if (swimDateToEl) swimDateToEl.value = '';
            document.querySelectorAll('#swim-year-filter-buttons .year-btn').forEach(b => b.classList.remove('active'));
            saveFilterState();
            renderSwimAnalysisTab(allActivities, dateFilterFrom, dateFilterTo, swimRollingWindow);
        });
    }

    // --- APP ENTRY POINT ---
    const applicationStart = (
        documentSessionMode === APP_SESSION_MODE.REAL
        && getFeatureFlags().dataRepositoryMode === 'canonical'
    )
        ? initializeApp(null)
        : runLocalFirstBootstrap({
        sessionMode: documentSessionMode,
        inspect: () => inspectLocalFirstBootstrap(),
        startDemo: state => {
            renderSourceStatus(state);
            return handleAuth(initializeApp);
        },
        startDashboard: initializeLocalDashboard,
        navigateFirstRun: () => {
            window.location.assign('/source-manager.html?mode=real');
        },
        showBlocked: showLocalFirstBlocked
    });
    applicationStart.catch(() => {
        recordDiagnosticError({
            page: 'dashboard',
            category: 'page',
            code: 'DASHBOARD_START_FAILED'
        });
        logOperationalWarning('App failed to start');
        showLocalFirstBlocked(Object.freeze({
            localStatus: LOCAL_FIRST_STATUS.UNAVAILABLE,
            stravaStatus: STRAVA_SOURCE_STATUS.UNAVAILABLE,
            networkStatus: LOCAL_FIRST_NETWORK_STATUS.UNKNOWN
        }));
        hideLoading();
    });
});
