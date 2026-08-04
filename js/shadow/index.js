import { createCanonicalStore } from '../storage/index.js';
import { createShadowCanonicalWriter } from './shadow-canonical-writer.js';

let activeWriter = null;
let activeClosing = null;

const FEATURE_FLAG_KEYS = Object.freeze([
    'dataRepositoryMode',
    'localImportEnabled',
    'canonicalShadowWriteEnabled'
]);

function inspectedFlags(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== FEATURE_FLAG_KEYS.length
            || keys.some(key => (
                typeof key !== 'string'
                || !FEATURE_FLAG_KEYS.includes(key)
            ))
        ) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        if (typeof result.localImportEnabled !== 'boolean') return null;
        return result;
    } catch {
        return null;
    }
}

function shadowEnabled(featureFlags) {
    const inspected = inspectedFlags(featureFlags);
    return inspected?.dataRepositoryMode === 'shadow'
        && inspected.canonicalShadowWriteEnabled === true;
}

function unavailableStore() {
    const unavailable = () => {
        const error = new Error('Canonical shadow storage is unavailable.');
        Object.defineProperty(error, 'code', {
            value: 'UNAVAILABLE',
            enumerable: true
        });
        return Promise.reject(error);
    };
    return Object.freeze({
        initialize: unavailable,
        putBundle: unavailable,
        getBundle: unavailable,
        close: async () => Object.freeze({ status: 'closed' })
    });
}

function activateWriter(canonicalStore) {
    activeWriter = createShadowCanonicalWriter({
        canonicalStore,
        now: () => Date.now()
    });
    return activeWriter;
}

export function getApplicationShadowWriter(featureFlags) {
    if (!shadowEnabled(featureFlags)) return null;
    if (activeClosing) return null;
    if (activeWriter) return activeWriter;
    let indexedDB;
    let IDBKeyRange;
    try {
        indexedDB = globalThis.indexedDB;
        IDBKeyRange = globalThis.IDBKeyRange;
    } catch {
        return null;
    }
    if (!indexedDB || !IDBKeyRange) return activateWriter(unavailableStore());
    try {
        const canonicalStore = createCanonicalStore({
            indexedDB,
            IDBKeyRange,
            now: () => Date.now(),
            applicationVersion: 'shadow-canonical-writer@1'
        });
        return activateWriter(canonicalStore);
    } catch {
        return activateWriter(unavailableStore());
    }
}

export function flushApplicationShadowWrites() {
    return activeWriter ? activeWriter.flush() : Promise.resolve(null);
}

export function exportApplicationShadowParityReport() {
    return activeWriter ? activeWriter.exportReport() : null;
}

export function closeApplicationShadowWriter() {
    if (activeClosing) return activeClosing;
    if (!activeWriter) return Promise.resolve(Object.freeze({ status: 'closed' }));
    const writer = activeWriter;
    activeWriter = null;
    activeClosing = writer.close();
    activeClosing.then(() => {
        activeClosing = null;
    }, () => {
        activeClosing = null;
    });
    return activeClosing;
}

export { createShadowCanonicalWriter };
