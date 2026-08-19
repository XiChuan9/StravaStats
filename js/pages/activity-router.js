import { isDemoMode } from '../demo/index.js';
import { createRepository } from '../repository/index.js';
import { getFeatureFlags } from '../app/feature-flags.js';
import {
    installGlobalDiagnosticsListeners,
    recordDiagnosticError
} from '../diagnostics/index.js';

installGlobalDiagnosticsListeners({ page: 'activity-router' });

const ROUTER_OPTION_KEYS = new Set([
    'search',
    'demoModeReader',
    'featureFlagsReader',
    'repositoryFactory',
    'navigate',
    'errorRenderer'
]);
const SAFE_ERROR_COPY = 'Activity details could not be loaded.';

function invalidBoundary() {
    return new TypeError('The activity routing boundary is invalid.');
}

function repositoryModeFromFlags(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) throw invalidBoundary();
        const descriptor = Object.getOwnPropertyDescriptor(
            value,
            'dataRepositoryMode'
        );
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
            || !['legacy', 'shadow', 'canonical'].includes(descriptor.value)
        ) throw invalidBoundary();
        return descriptor.value === 'canonical' ? 'canonical' : 'legacy';
    } catch {
        throw invalidBoundary();
    }
}

function readPlainRecord(value, allowedKeys) {
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
            || !allowedKeys.has(key)
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
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function readCallable(receiver, name) {
    try {
        if (
            receiver === null
            || (typeof receiver !== 'object' && typeof receiver !== 'function')
        ) {
            return null;
        }

        let current = receiver;
        while (current !== null) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value')
                    && typeof descriptor.value === 'function'
                    ? descriptor.value
                    : null;
            }
            current = Object.getPrototypeOf(current);
        }
        return null;
    } catch {
        return null;
    }
}

function readDenseArray(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) {
            return null;
        }

        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
        ) {
            return null;
        }

        const expectedKeys = new Set(['length']);
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            expectedKeys.add(String(index));
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedKeys.size
            || keys.some(key => (
                typeof key !== 'string'
                || !expectedKeys.has(key)
            ))
        ) {
            return null;
        }

        const result = [];
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

function readActivityList(result) {
    const values = readPlainRecord(
        result,
        new Set(['data', 'source', 'warnings', 'partial'])
    );
    if (values === null || !Object.hasOwn(values, 'data')) {
        throw invalidBoundary();
    }
    const activities = readDenseArray(values.data);
    if (activities === null) throw invalidBoundary();
    return activities;
}

function readDataProperty(value, field) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
        ) {
            return null;
        }
        return descriptor.value;
    } catch {
        return null;
    }
}

function normalizeSummaryId(value) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    if (Number.isSafeInteger(value) && value >= 0) {
        return String(value);
    }
    return null;
}

export function findActivitySummary(activities, activityId) {
    const values = readDenseArray(activities);
    if (values === null) throw invalidBoundary();

    for (const value of values) {
        const id = normalizeSummaryId(readDataProperty(value, 'id'));
        if (id !== activityId) continue;

        const sportType = readDataProperty(value, 'sport_type');
        const fallbackType = readDataProperty(value, 'type');
        return {
            id,
            sportType: typeof sportType === 'string'
                ? sportType
                : (typeof fallbackType === 'string' ? fallbackType : 'Unknown')
        };
    }
    return null;
}

export function activityDetailPage(sportType) {
    const normalized = typeof sportType === 'string'
        ? sportType
        : 'Unknown';
    const lower = normalized.toLowerCase();

    if (lower.includes('swim')) return 'swim.html';
    if (
        normalized === 'Run'
        || normalized === 'TrailRun'
        || lower.includes('run')
    ) {
        return 'run.html';
    }
    if (
        normalized === 'Ride'
        || normalized === 'MountainBike'
        || lower.includes('bike')
        || lower.includes('ride')
    ) {
        return 'bike.html';
    }
    return 'activity.html';
}

function defaultSearch() {
    return globalThis.window?.location?.search ?? '';
}

function defaultNavigate(target) {
    globalThis.window.location.href = target;
}

export function renderActivityRouterError(
    documentObject = globalThis.document,
    historyObject = globalThis.history
) {
    try {
        if (!documentObject?.body) return;

        const container = documentObject.createElement('div');
        container.style.cssText = 'text-align: center; padding: 40px; color: red;';

        const title = documentObject.createElement('h2');
        title.textContent = 'Error Loading Activity';

        const message = documentObject.createElement('p');
        message.textContent = SAFE_ERROR_COPY;

        const button = documentObject.createElement('button');
        button.type = 'button';
        button.textContent = 'Go Back';
        button.addEventListener('click', () => {
            try {
                historyObject?.back();
            } catch {
                // Navigation failure has no safe recovery at this boundary.
            }
        });

        container.append(title, message, button);
        documentObject.body.replaceChildren(container);
    } catch {
        // Never surface a rendering failure or the underlying provider error.
    }
}

function normalizeRouterOptions(options) {
    const values = readPlainRecord(options, ROUTER_OPTION_KEYS);
    if (values === null) throw invalidBoundary();

    const normalized = {
        search: Object.hasOwn(values, 'search') ? values.search : defaultSearch(),
        demoModeReader: values.demoModeReader ?? isDemoMode,
        featureFlagsReader: values.featureFlagsReader ?? getFeatureFlags,
        repositoryFactory: values.repositoryFactory ?? createRepository,
        navigate: values.navigate ?? defaultNavigate,
        errorRenderer: values.errorRenderer ?? renderActivityRouterError
    };
    if (
        typeof normalized.search !== 'string'
        || typeof normalized.demoModeReader !== 'function'
        || typeof normalized.featureFlagsReader !== 'function'
        || typeof normalized.repositoryFactory !== 'function'
        || typeof normalized.navigate !== 'function'
        || typeof normalized.errorRenderer !== 'function'
    ) {
        throw invalidBoundary();
    }
    return normalized;
}

export async function routeActivity(options = {}) {
    let normalized;
    try {
        normalized = normalizeRouterOptions(options);
        const activityId = new URLSearchParams(normalized.search).get('id');
        if (activityId === null || activityId.trim().length === 0) {
            throw invalidBoundary();
        }

        const demoMode = normalized.demoModeReader();
        if (typeof demoMode !== 'boolean') throw invalidBoundary();
        const repositoryMode = demoMode
            ? 'legacy'
            : repositoryModeFromFlags(normalized.featureFlagsReader());

        const repository = normalized.repositoryFactory({
            sessionMode: demoMode ? 'demo' : 'real',
            mode: repositoryMode
        });
        const listActivities = readCallable(repository, 'listActivities');
        if (listActivities === null) throw invalidBoundary();

        const result = await listActivities.call(repository, { refresh: false });
        const activities = readActivityList(result);
        const summary = findActivitySummary(activities, activityId);
        const targetPage = activityDetailPage(summary?.sportType);
        normalized.navigate(`${targetPage}?id=${encodeURIComponent(activityId)}`);
        return true;
    } catch {
        recordDiagnosticError({
            page: 'activity-router',
            category: 'page',
            code: 'ACTIVITY_ROUTE_FAILED'
        });
        try {
            (normalized?.errorRenderer ?? renderActivityRouterError)();
        } catch {
            // Error UI remains best-effort and never receives the raw error.
        }
        return false;
    }
}

export function startActivityRouter() {
    return routeActivity();
}

if (typeof globalThis.document?.addEventListener === 'function') {
    globalThis.document.addEventListener(
        'DOMContentLoaded',
        () => {
            void startActivityRouter();
        },
        { once: true }
    );
}
