import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_GEAR_CUSTOM_PREFIX,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_SETTINGS_KEYS,
    LEGACY_STORE_NAME
} from '../services/legacy-cache/constants.js';

const TOKEN_KEY = 'strava_tokens';
const ATHLETE_KEY = LEGACY_LOCAL_STORAGE_KEYS.athlete;
const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);

const LOCAL_LIBRARY_KEYS = Object.freeze([
    LEGACY_LOCAL_STORAGE_KEYS.activities,
    LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp,
    LEGACY_LOCAL_STORAGE_KEYS.cacheVersion,
    LEGACY_LOCAL_STORAGE_KEYS.athlete,
    `${LEGACY_LOCAL_STORAGE_KEYS.athlete}_timestamp`,
    LEGACY_LOCAL_STORAGE_KEYS.zones,
    `${LEGACY_LOCAL_STORAGE_KEYS.zones}_timestamp`,
    LEGACY_LOCAL_STORAGE_KEYS.gears,
    `${LEGACY_LOCAL_STORAGE_KEYS.gears}_timestamp`,
    ...LEGACY_SETTINGS_KEYS
]);
const LOCAL_LIBRARY_KEY_SET = new Set(LOCAL_LIBRARY_KEYS);

const LOCAL_LIBRARY_PREFIXES = Object.freeze([
    LEGACY_GEAR_CUSTOM_PREFIX,
    'strava_gear_'
]);

export const AUTH_LIFECYCLE_STATUS = Object.freeze({
    SUCCESS: 'success',
    REVOCATION_UNCONFIRMED: 'revocation-unconfirmed',
    TOKEN_EXPIRED: 'token-expired',
    UNAUTHENTICATED: 'unauthenticated',
    REFRESH_FAILED: 'refresh-failed',
    FORBIDDEN: 'forbidden',
    IDENTITY_MISMATCH: 'identity-mismatch',
    IDENTITY_UNCONFIRMED: 'identity-unconfirmed',
    TOKEN_REMOVAL_FAILED: 'token-removal-failed',
    TOKEN_WRITE_FAILED: 'token-write-failed'
});

export const AUTH_FAILURE_KIND = Object.freeze({
    REFRESH_FAILURE: 'refresh-failure',
    UNAUTHORIZED: 'unauthorized',
    FORBIDDEN: 'forbidden'
});

function lifecycleResult(status, details = {}) {
    return Object.freeze({ status, ...details });
}

function normalizeIdentity(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
        return String(value);
    }
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
        return value;
    }
    return null;
}

function readStoredTokens(storage) {
    try {
        const raw = storage.getItem(TOKEN_KEY);
        if (raw === null) {
            return { status: 'absent', accessToken: null };
        }
        if (typeof raw !== 'string' || raw.length === 0) {
            return { status: 'invalid', accessToken: null };
        }
        const parsed = JSON.parse(raw);
        if (
            !parsed
            || typeof parsed !== 'object'
            || typeof parsed.access_token !== 'string'
            || parsed.access_token.trim().length === 0
        ) {
            return { status: 'invalid', accessToken: null };
        }
        const authority = exactTokenAuthority(parsed);
        return {
            status: 'valid',
            accessToken: parsed.access_token,
            revocationToken: authority === null
                ? parsed.access_token
                : parsed.refresh_token,
            authority
        };
    } catch {
        return {
            status: 'read-error',
            accessToken: null,
            revocationToken: null,
            authority: null
        };
    }
}

function exactScopes(value) {
    try {
        return Array.isArray(value)
            && Object.getPrototypeOf(value) === Array.prototype
            && Reflect.ownKeys(value).length === 3
            && value.length === 2
            && value[0] === REQUIRED_SCOPES[0]
            && value[1] === REQUIRED_SCOPES[1];
    } catch {
        return false;
    }
}

function exactTokenAuthority(value) {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const keys = Reflect.ownKeys(value);
        const exact = [
            'access_token', 'refresh_token', 'expires_at',
            'subject_id', 'granted_scopes'
        ];
        if (
            keys.length !== exact.length
            || keys.some(key => typeof key !== 'string' || !exact.includes(key))
            || typeof value.refresh_token !== 'string'
            || value.refresh_token.trim().length === 0
            || !Number.isFinite(value.expires_at)
            || normalizeIdentity(value.subject_id) === null
            || !exactScopes(value.granted_scopes)
        ) return null;
        return Object.freeze({ subjectId: normalizeIdentity(value.subject_id) });
    } catch {
        return null;
    }
}

function tokenRecordFromExchange(exchangeResponse) {
    if (
        !exchangeResponse
        || typeof exchangeResponse !== 'object'
        || typeof exchangeResponse.access_token !== 'string'
        || exchangeResponse.access_token.length === 0
    ) {
        return null;
    }
    const subjectId = normalizeIdentity(exchangeResponse.subject_id)
        || normalizeIdentity(exchangeResponse?.athlete?.id);
    const hasScopes = Object.hasOwn(exchangeResponse, 'granted_scopes');
    if (hasScopes && (subjectId === null || !exactScopes(exchangeResponse.granted_scopes))) {
        return null;
    }
    const record = {
        access_token: exchangeResponse.access_token,
        refresh_token: typeof exchangeResponse.refresh_token === 'string'
            ? exchangeResponse.refresh_token
            : null,
        expires_at: Number.isFinite(exchangeResponse.expires_at)
            ? exchangeResponse.expires_at
            : null
    };
    if (hasScopes) {
        if (
            record.refresh_token === null
            || record.refresh_token.trim().length === 0
            || record.expires_at === null
        ) return null;
        record.subject_id = subjectId;
        record.granted_scopes = [...REQUIRED_SCOPES];
    }
    return { record, subjectId };
}

function inspectLocalStorageLibrary(storage) {
    try {
        const length = Number(storage.length);
        if (!Number.isFinite(length) || length < 0) {
            return { confirmed: false, present: false };
        }
        for (let index = 0; index < length; index += 1) {
            const key = storage.key(index);
            if (typeof key !== 'string') {
                return { confirmed: false, present: false };
            }
            if (
                LOCAL_LIBRARY_KEY_SET.has(key)
                || LOCAL_LIBRARY_PREFIXES.some(prefix => key.startsWith(prefix))
            ) {
                return { confirmed: true, present: true };
            }
        }
        return { confirmed: true, present: false };
    } catch {
        return { confirmed: false, present: false };
    }
}

function readStoredAthleteIdentity(storage) {
    try {
        const raw = storage.getItem(ATHLETE_KEY);
        if (!raw) return null;
        return normalizeIdentity(JSON.parse(raw)?.id);
    } catch {
        return null;
    }
}

const indexedDbInspectionClassifications = new WeakMap();

function indexedDbInspection(classification) {
    const result = classification === 'present'
        ? { confirmed: true, present: true }
        : classification === 'absent' || classification === 'empty'
            ? { confirmed: true, present: false }
            : { confirmed: false, present: false };
    indexedDbInspectionClassifications.set(result, classification);
    return result;
}

function normalizeIndexedDbInspection(value) {
    if (typeof value === 'boolean') {
        return {
            confirmed: true,
            present: value,
            classification: value ? 'present' : 'empty-or-absent'
        };
    }
    if (
        value
        && typeof value === 'object'
        && typeof value.present === 'boolean'
        && typeof value.confirmed === 'boolean'
    ) {
        return {
            confirmed: value.confirmed,
            present: value.present,
            classification: indexedDbInspectionClassifications.get(value)
                ?? (value.confirmed
                    ? value.present ? 'present' : 'empty-or-absent'
                    : 'unknown')
        };
    }
    return { confirmed: false, present: false, classification: 'unknown' };
}

function findDataMethod(value, name) {
    try {
        if (
            value === null
            || (typeof value !== 'object' && typeof value !== 'function')
        ) return null;
        let current = value;
        for (let depth = 0; current !== null && depth < 32; depth += 1) {
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

function inspectDatabaseList(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return 'unknown';
        }
        const keys = Reflect.ownKeys(value);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
            || keys.length !== lengthDescriptor.value + 1
        ) return 'unknown';

        let found = false;
        const names = new Set();
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const itemDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!itemDescriptor?.enumerable || !Object.hasOwn(itemDescriptor, 'value')) {
                return 'unknown';
            }
            const item = itemDescriptor.value;
            if (
                item === null
                || typeof item !== 'object'
                || Array.isArray(item)
                || Object.getPrototypeOf(item) !== Object.prototype
            ) return 'unknown';
            const itemKeys = Reflect.ownKeys(item);
            if (
                itemKeys.length !== 2
                || !itemKeys.includes('name')
                || !itemKeys.includes('version')
                || itemKeys.some(key => typeof key !== 'string')
            ) return 'unknown';
            const name = Object.getOwnPropertyDescriptor(item, 'name');
            const version = Object.getOwnPropertyDescriptor(item, 'version');
            if (
                !name?.enumerable
                || !Object.hasOwn(name, 'value')
                || typeof name.value !== 'string'
                || names.has(name.value)
                || !version?.enumerable
                || !Object.hasOwn(version, 'value')
                || !Number.isSafeInteger(version.value)
                || version.value < 1
            ) return 'unknown';
            names.add(name.value);
            if (name.value === LEGACY_DB_NAME) found = true;
        }
        return found ? 'present' : 'absent';
    } catch {
        return 'unknown';
    }
}

function inspectDatabaseState(indexedDb, databasesMethod, timeoutMs) {
    return new Promise(resolve => {
        let settled = false;
        const finish = state => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(state);
        };
        const timeoutId = setTimeout(
            () => finish('unknown'),
            Math.max(0, timeoutMs)
        );
        try {
            Promise.resolve(databasesMethod.call(indexedDb)).then(
                value => {
                    if (settled) return;
                    finish(inspectDatabaseList(value));
                },
                () => finish('unknown')
            );
        } catch {
            finish('unknown');
        }
    });
}

export async function inspectLegacyIndexedDbPresence({
    indexedDB: indexedDb = globalThis.indexedDB,
    openTimeoutMs = 5000
} = {}) {
    const databasesMethod = findDataMethod(indexedDb, 'databases');
    const openMethod = findDataMethod(indexedDb, 'open');
    if (!databasesMethod || !openMethod) {
        return indexedDbInspection('unknown');
    }

    const databaseState = await inspectDatabaseState(
        indexedDb,
        databasesMethod,
        openTimeoutMs
    );
    if (databaseState === 'absent') return indexedDbInspection('absent');
    if (databaseState !== 'present') return indexedDbInspection('unknown');

    return new Promise(resolve => {
        let request;
        let settled = false;
        let missingDatabase = false;
        let cancelled = false;
        let abortAttempted = false;

        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
        };
        const abortMissingUpgrade = () => {
            if (!missingDatabase || abortAttempted) return;
            abortAttempted = true;
            try {
                request.transaction.abort();
            } catch {
                // Any terminal success is closed below without deletion.
            }
        };
        const cancel = () => {
            if (settled || cancelled) return;
            cancelled = true;
            abortMissingUpgrade();
            finish(indexedDbInspection('unknown'));
        };
        const timeoutId = setTimeout(
            cancel,
            Math.max(0, openTimeoutMs)
        );

        try {
            request = openMethod.call(indexedDb, LEGACY_DB_NAME);
        } catch {
            finish(indexedDbInspection('unknown'));
            return;
        }

        request.onupgradeneeded = () => {
            missingDatabase = true;
            abortMissingUpgrade();
        };
        request.onblocked = cancel;
        request.onerror = () => {
            finish(indexedDbInspection('unknown'));
        };
        request.onsuccess = () => {
            const db = request.result;
            if (settled) {
                db.close();
                return;
            }
            if (missingDatabase) {
                db.close();
                finish(indexedDbInspection('unknown'));
                return;
            }
            if (cancelled) {
                db.close();
                finish(indexedDbInspection('unknown'));
                return;
            }
            if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
                db.close();
                finish(indexedDbInspection('unknown'));
                return;
            }

            let transaction;
            try {
                transaction = db.transaction(LEGACY_STORE_NAME, 'readonly');
                const countRequest = transaction
                    .objectStore(LEGACY_STORE_NAME)
                    .count(LEGACY_ACTIVITY_KEY);
                countRequest.onerror = () => {
                    db.close();
                    finish(indexedDbInspection('unknown'));
                };
                countRequest.onsuccess = () => {
                    db.close();
                    finish(indexedDbInspection(
                        countRequest.result > 0 ? 'present' : 'empty'
                    ));
                };
                transaction.onerror = () => {
                    db.close();
                    finish(indexedDbInspection('unknown'));
                };
                transaction.onabort = transaction.onerror;
            } catch {
                db.close();
                finish(indexedDbInspection('unknown'));
            }
        };
    });
}

export function createAuthLifecycle({
    storage = globalThis.localStorage,
    revokeAccessToken,
    inspectIndexedDb = null
} = {}) {
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
    ) {
        throw new TypeError('A storage dependency is required.');
    }

    async function inspectLibraryIdentity() {
        const localInspection = inspectLocalStorageLibrary(storage);
        if (!localInspection.confirmed) {
            return {
                confirmed: false,
                present: false,
                classification: 'unknown',
                athleteId: null
            };
        }
        if (localInspection.present) {
            return {
                confirmed: true,
                present: true,
                classification: 'local-present',
                athleteId: readStoredAthleteIdentity(storage)
            };
        }
        if (typeof inspectIndexedDb !== 'function') {
            return {
                confirmed: false,
                present: false,
                classification: 'unknown',
                athleteId: null
            };
        }

        let indexedDbInspection;
        try {
            indexedDbInspection = normalizeIndexedDbInspection(
                await inspectIndexedDb()
            );
        } catch {
            indexedDbInspection = {
                confirmed: false,
                present: false,
                classification: 'unknown'
            };
        }
        return {
            confirmed: indexedDbInspection.confirmed,
            present: indexedDbInspection.present,
            classification: indexedDbInspection.classification,
            athleteId: null
        };
    }

    async function disconnect() {
        const tokenRead = readStoredTokens(storage);
        let revocationConfirmed = tokenRead.status === 'absent';

        if (tokenRead.status === 'valid') {
            if (typeof revokeAccessToken !== 'function') {
                revocationConfirmed = false;
            } else {
                try {
                    const result = await revokeAccessToken(tokenRead.revocationToken);
                    revocationConfirmed = result !== false && result?.ok !== false;
                } catch {
                    revocationConfirmed = false;
                }
            }
        }

        try {
            storage.removeItem(TOKEN_KEY);
        } catch {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.TOKEN_REMOVAL_FAILED);
        }

        return lifecycleResult(
            revocationConfirmed
                ? AUTH_LIFECYCLE_STATUS.SUCCESS
                : AUTH_LIFECYCLE_STATUS.REVOCATION_UNCONFIRMED
        );
    }

    function expireToken() {
        try {
            storage.removeItem(TOKEN_KEY);
        } catch {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.TOKEN_REMOVAL_FAILED);
        }
        return lifecycleResult(AUTH_LIFECYCLE_STATUS.TOKEN_EXPIRED);
    }

    function handleAuthFailure(kind) {
        const statuses = {
            [AUTH_FAILURE_KIND.REFRESH_FAILURE]: AUTH_LIFECYCLE_STATUS.REFRESH_FAILED,
            [AUTH_FAILURE_KIND.UNAUTHORIZED]: AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED,
            [AUTH_FAILURE_KIND.FORBIDDEN]: AUTH_LIFECYCLE_STATUS.FORBIDDEN
        };
        return lifecycleResult(
            statuses[kind] || AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED
        );
    }

    function inspectTokenAuthority() {
        const tokenRead = readStoredTokens(storage);
        if (tokenRead.status === 'absent') {
            return lifecycleResult('absent', { subjectId: null });
        }
        if (tokenRead.status !== 'valid') {
            return lifecycleResult('invalid', { subjectId: null });
        }
        if (tokenRead.authority === null) {
            return lifecycleResult('legacy', { subjectId: null });
        }
        return lifecycleResult('authority', {
            subjectId: tokenRead.authority.subjectId
        });
    }

    async function acceptOAuthTokenResponse(exchangeResponse) {
        const candidate = tokenRecordFromExchange(exchangeResponse);
        if (!candidate) {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED);
        }

        const library = await inspectLibraryIdentity();
        if (!library.confirmed) {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
        }

        if (library.present) {
            const newAthleteId = candidate.subjectId;
            if (!library.athleteId || !newAthleteId) {
                return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
            }
            if (library.athleteId !== newAthleteId) {
                return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_MISMATCH);
            }
        }

        try {
            storage.setItem(TOKEN_KEY, JSON.stringify(candidate.record));
        } catch {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.TOKEN_WRITE_FAILED);
        }

        const firstLogin = library.classification === 'absent'
            || library.classification === 'empty'
            || library.classification === 'empty-or-absent';
        return lifecycleResult(AUTH_LIFECYCLE_STATUS.SUCCESS, { firstLogin });
    }

    return Object.freeze({
        acceptOAuthTokenResponse,
        disconnect,
        expireToken,
        handleAuthFailure,
        inspectTokenAuthority
    });
}
