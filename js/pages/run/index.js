import { isDemoMode } from '../../demo/index.js';
import { getFeatureFlags } from '../../app/feature-flags.js';
import {
    createRepository,
    REPOSITORY_SOURCE
} from '../../repository/index.js';
import '../../shared/utils/speed-insights.js';
import { createDetailReadSession } from '../detail/detail-read-session.js';

export const RUN_STREAM_TYPES = Object.freeze([
    'distance',
    'time',
    'heartrate',
    'altitude',
    'cadence',
    'watts',
    'velocity_smooth',
    'latlng'
]);
const BUNDLE_KEYS = Object.freeze(['activity', 'streams', 'zones', 'athlete']);
const ENVELOPE_KEYS = Object.freeze(['data', 'source', 'warnings', 'partial']);
const REPOSITORY_SOURCES = new Set(Object.values(REPOSITORY_SOURCE));

function repositoryModeFromFlags(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) throw new TypeError('Invalid feature flags.');
        const descriptor = Object.getOwnPropertyDescriptor(value, 'dataRepositoryMode');
        if (
            !descriptor?.enumerable
            || !Object.hasOwn(descriptor, 'value')
            || !['legacy', 'shadow', 'canonical'].includes(descriptor.value)
        ) throw new TypeError('Invalid feature flags.');
        return descriptor.value === 'canonical' ? 'canonical' : 'legacy';
    } catch {
        throw new TypeError('Invalid feature flags.');
    }
}

function readExactRecord(value, expectedKeys) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const expected = new Set(expectedKeys);
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedKeys.length
            || keys.some(key => typeof key !== 'string' || !expected.has(key))
        ) return null;
        const record = {};
        for (const key of expectedKeys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            record[key] = descriptor.value;
        }
        return record;
    } catch {
        return null;
    }
}

function isDenseNativeArray(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
        ) return false;
        const expectedKeys = new Set(['length']);
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            expectedKeys.add(String(index));
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedKeys.size
            || keys.some(key => typeof key !== 'string' || !expectedKeys.has(key))
        ) return false;
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
        }
        return true;
    } catch {
        return false;
    }
}

function readEnvelopeData(envelope, optional = false) {
    if (envelope === null) {
        if (optional) return null;
        throw new TypeError('Invalid detail result.');
    }
    const record = readExactRecord(envelope, ENVELOPE_KEYS);
    if (
        record === null
        || !REPOSITORY_SOURCES.has(record.source)
        || typeof record.partial !== 'boolean'
        || !isDenseNativeArray(record.warnings)
    ) throw new TypeError('Invalid detail result.');
    if (record.data === null) {
        if (optional) return null;
        throw new TypeError('Invalid detail result.');
    }
    if (
        typeof record.data !== 'object'
        || Array.isArray(record.data)
        || Object.getPrototypeOf(record.data) !== Object.prototype
    ) throw new TypeError('Invalid detail result.');
    return record.data;
}

function activityIdFromSearch(search) {
    const value = new URLSearchParams(search).get('id');
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function renderRunPageError(
    documentObject = globalThis.document,
    historyObject = globalThis.history
) {
    if (!documentObject?.createElement) return;
    const host = documentObject.getElementById?.('activity-details') || documentObject.body;
    if (!host?.replaceChildren) return;
    const container = documentObject.createElement('div');
    container.style.padding = '20px';
    container.style.textAlign = 'center';
    const title = documentObject.createElement('h2');
    title.textContent = 'Error Loading Activity';
    const message = documentObject.createElement('p');
    message.textContent = 'Activity details could not be loaded.';
    const button = documentObject.createElement('button');
    button.type = 'button';
    button.textContent = 'Back';
    button.addEventListener('click', () => historyObject?.back?.());
    container.append(title, message, button);
    host.replaceChildren(container);
}

async function defaultRenderer(input) {
    const { renderRunPage } = await import('./run.js');
    return renderRunPage(input);
}

export async function initializeRunPage({
    search = globalThis.location?.search || '',
    demoModeReader = isDemoMode,
    featureFlagsReader = getFeatureFlags,
    repositoryFactory = createRepository,
    sessionFactory = createDetailReadSession,
    renderer = defaultRenderer,
    errorRenderer = renderRunPageError
} = {}) {
    const activityId = activityIdFromSearch(search);
    if (activityId === null) {
        errorRenderer();
        return false;
    }
    try {
        const demo = demoModeReader();
        const repositoryMode = demo
            ? 'legacy'
            : repositoryModeFromFlags(featureFlagsReader());
        const repository = repositoryFactory({
            sessionMode: demo ? 'demo' : 'real',
            mode: repositoryMode
        });
        const session = sessionFactory({
            repository,
            activityId,
            streamTypes: RUN_STREAM_TYPES,
            includeZones: true,
            includeAthlete: false
        });
        const bundle = await session.load();
        const detail = readExactRecord(bundle, BUNDLE_KEYS);
        if (detail === null) throw new TypeError('Invalid detail bundle.');
        const activity = readEnvelopeData(detail.activity);
        await renderer({
            activity,
            activitySource: readExactRecord(detail.activity, ENVELOPE_KEYS).source,
            streams: readEnvelopeData(detail.streams),
            zones: readEnvelopeData(detail.zones, true),
            athlete: readEnvelopeData(detail.athlete, true),
            activityId,
            allowExternalWeather: !demo
        });
        return true;
    } catch {
        errorRenderer();
        return false;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        void initializeRunPage();
    }, { once: true });
}
