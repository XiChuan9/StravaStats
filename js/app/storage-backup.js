import { createBackupService } from '../backup/index.js';
import {
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION
} from '../storage/index.js';
import {
    createStorageBackupPage,
    STORAGE_BACKUP_SESSION_MODE
} from '../pages/storage-backup/storage-backup.js';

const SETTINGS_KEYS = Object.freeze([
    'dashboard_filters',
    'dashboard_readiness_hrv',
    'dashboard_settings',
    'training_goals',
    'run_plus_capacity_inputs_v1',
    'run_plus_nsm_settings_v1',
    'run_plus_nsm_activity_tags_v1',
    'run_plus_nsm_session_inputs_v1',
    'run_plus_nsm_tests_v1',
    'run_plus_nsm_interval_analysis_v1'
]);
const GEAR_PREFIX = 'gear-custom-';

function sessionMode(search, referrer, origin) {
    const mode = new URLSearchParams(search).get('mode');
    if (mode === STORAGE_BACKUP_SESSION_MODE.REAL) {
        return STORAGE_BACKUP_SESSION_MODE.REAL;
    }
    if (mode === STORAGE_BACKUP_SESSION_MODE.DEMO) {
        return STORAGE_BACKUP_SESSION_MODE.DEMO;
    }
    if (mode !== null) return null;
    try {
        const source = new URL(referrer);
        if (
            source.origin === origin
            && source.pathname === '/source-manager.html'
            && new URLSearchParams(source.search).get('mode')
                === STORAGE_BACKUP_SESSION_MODE.DEMO
        ) return STORAGE_BACKUP_SESSION_MODE.DEMO;
    } catch { /* direct navigation defaults to Real */ }
    return STORAGE_BACKUP_SESSION_MODE.REAL;
}

function settingsReader(storage) {
    return () => {
        const result = {};
        for (const key of SETTINGS_KEYS) {
            const value = storage.getItem(key);
            if (value !== null) result[key] = value;
        }
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (typeof key === 'string' && key.startsWith(GEAR_PREFIX)) {
                const value = storage.getItem(key);
                if (value !== null) result[key] = value;
            }
        }
        return result;
    };
}

function demoFacade() {
    const unavailable = () => Promise.reject(Object.freeze({
        code: 'BACKUP_UNAVAILABLE'
    }));
    return Object.freeze({
        async initialize() {
            return Object.freeze({ databaseVersion: V2_DATABASE_VERSION, activityCount: 0 });
        },
        exportLibrary: unavailable,
        restoreBackup: unavailable,
        async close() { return Object.freeze({ status: 'closed' }); }
    });
}

async function inspectCurrentLibrary(indexedDB) {
    let databases;
    try {
        if (typeof indexedDB.databases !== 'function') throw new Error();
        databases = await indexedDB.databases();
    } catch {
        throw Object.freeze({ code: 'BACKUP_UNAVAILABLE' });
    }
    const descriptor = databases.find(value => value.name === V2_DATABASE_NAME);
    if (!descriptor) {
        return Object.freeze({ databaseVersion: null, activityCount: 0 });
    }
    if (descriptor.version !== V2_DATABASE_VERSION) {
        throw Object.freeze({ code: 'BACKUP_SCHEMA_INCOMPATIBLE' });
    }
    return new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(V2_DATABASE_NAME); } catch {
            reject(Object.freeze({ code: 'BACKUP_UNAVAILABLE' }));
            return;
        }
        request.onupgradeneeded = () => {
            try { request.transaction.abort(); } catch { /* terminal event */ }
        };
        request.onerror = () => reject(Object.freeze({ code: 'BACKUP_UNAVAILABLE' }));
        request.onblocked = () => reject(Object.freeze({ code: 'BACKUP_UNAVAILABLE' }));
        request.onsuccess = () => {
            const database = request.result;
            if (database.version !== V2_DATABASE_VERSION) {
                database.close();
                reject(Object.freeze({ code: 'BACKUP_SCHEMA_INCOMPATIBLE' }));
                return;
            }
            let transaction;
            try {
                transaction = database.transaction('activities', 'readonly');
                const count = transaction.objectStore('activities').count();
                count.onsuccess = () => {
                    database.close();
                    resolve(Object.freeze({
                        databaseVersion: V2_DATABASE_VERSION,
                        activityCount: count.result
                    }));
                };
                count.onerror = () => {
                    database.close();
                    reject(Object.freeze({ code: 'BACKUP_UNAVAILABLE' }));
                };
            } catch {
                database.close();
                reject(Object.freeze({ code: 'BACKUP_UNAVAILABLE' }));
            }
        };
    });
}

function realFacade(dependencies) {
    const backup = createBackupService({
        indexedDB: dependencies.indexedDB,
        IDBKeyRange: dependencies.IDBKeyRange,
        crypto: dependencies.crypto,
        now: () => Date.now(),
        applicationVersion: 'pr21-backup-restore@1',
        settingsReader: settingsReader(dependencies.localStorage),
        settingsWriter: (key, value) => dependencies.localStorage.setItem(key, value)
    });
    return Object.freeze({
        async initialize() {
            return inspectCurrentLibrary(dependencies.indexedDB);
        },
        exportLibrary: options => backup.exportLibrary(options),
        restoreBackup: (file, options) => backup.restoreBackup(file, options),
        async close() {
            await backup.close();
            return Object.freeze({ status: 'closed' });
        }
    });
}

export async function startStorageBackup(dependencies) {
    const mode = sessionMode(
        dependencies?.location?.search ?? '',
        dependencies?.document?.referrer ?? '',
        dependencies?.location?.origin ?? ''
    );
    const page = createStorageBackupPage({
        document: dependencies.document,
        sessionMode: mode,
        URL: dependencies.URL
    });
    if (mode === null) {
        page.showBlockingError(Object.freeze({ code: 'INVALID_SESSION_MODE' }));
        return Object.freeze({ status: 'blocked', close: page.close });
    }
    const facade = mode === STORAGE_BACKUP_SESSION_MODE.DEMO
        ? demoFacade()
        : realFacade(dependencies);
    await page.initialize(facade);
    return Object.freeze({ status: 'ready', close: page.close });
}
