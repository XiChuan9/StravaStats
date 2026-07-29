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
        return {
            status: 'valid',
            accessToken: parsed.access_token
        };
    } catch {
        return { status: 'read-error', accessToken: null };
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
    return {
        access_token: exchangeResponse.access_token,
        refresh_token: typeof exchangeResponse.refresh_token === 'string'
            ? exchangeResponse.refresh_token
            : null,
        expires_at: Number.isFinite(exchangeResponse.expires_at)
            ? exchangeResponse.expires_at
            : null
    };
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

function normalizeIndexedDbInspection(value) {
    if (typeof value === 'boolean') {
        return { confirmed: true, present: value };
    }
    if (
        value
        && typeof value === 'object'
        && typeof value.present === 'boolean'
        && typeof value.confirmed === 'boolean'
    ) {
        return {
            confirmed: value.confirmed,
            present: value.present
        };
    }
    return { confirmed: false, present: false };
}

function deleteProbeDatabase(indexedDb) {
    if (typeof indexedDb.deleteDatabase !== 'function') {
        return Promise.resolve(false);
    }
    return new Promise(resolve => {
        let request;
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        try {
            request = indexedDb.deleteDatabase(LEGACY_DB_NAME);
        } catch {
            finish(false);
            return;
        }
        // onblocked is not terminal. Wait for success/error so no mutation can
        // occur after this inspection has returned.
        request.onsuccess = () => finish(true);
        request.onerror = () => finish(false);
    });
}

export async function inspectLegacyIndexedDbPresence({
    indexedDB: indexedDb = globalThis.indexedDB,
    openTimeoutMs = 5000
} = {}) {
    if (!indexedDb || typeof indexedDb.open !== 'function') {
        return { confirmed: false, present: false };
    }

    if (typeof indexedDb.databases === 'function') {
        try {
            const databases = await indexedDb.databases();
            if (!databases.some(database => database.name === LEGACY_DB_NAME)) {
                return { confirmed: true, present: false };
            }
        } catch {
            // databases() is only an optimization. Fall through to safe open.
        }
    }

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
                // A terminal success is compensated below.
            }
        };
        const cancel = () => {
            if (settled || cancelled) return;
            cancelled = true;
            abortMissingUpgrade();
        };
        const timeoutId = setTimeout(
            cancel,
            Math.max(0, openTimeoutMs)
        );

        try {
            request = indexedDb.open(LEGACY_DB_NAME);
        } catch {
            finish({ confirmed: false, present: false });
            return;
        }

        request.onupgradeneeded = () => {
            missingDatabase = true;
            abortMissingUpgrade();
        };
        request.onblocked = cancel;
        request.onerror = () => {
            if (missingDatabase && request.error?.name === 'AbortError') {
                finish({ confirmed: true, present: false });
                return;
            }
            finish({ confirmed: false, present: false });
        };
        request.onsuccess = async () => {
            const db = request.result;
            if (settled) {
                db.close();
                return;
            }
            if (missingDatabase) {
                db.close();
                const deleted = await deleteProbeDatabase(indexedDb);
                finish({
                    confirmed: deleted,
                    present: !deleted
                });
                return;
            }
            if (cancelled) {
                db.close();
                finish({ confirmed: false, present: false });
                return;
            }
            if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
                db.close();
                finish({ confirmed: false, present: false });
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
                    finish({ confirmed: false, present: false });
                };
                countRequest.onsuccess = () => {
                    db.close();
                    finish({
                        confirmed: true,
                        present: countRequest.result > 0
                    });
                };
                transaction.onerror = () => {
                    db.close();
                    finish({ confirmed: false, present: false });
                };
                transaction.onabort = transaction.onerror;
            } catch {
                db.close();
                finish({ confirmed: false, present: false });
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
            return { confirmed: false, present: false, athleteId: null };
        }
        if (localInspection.present) {
            return {
                confirmed: true,
                present: true,
                athleteId: readStoredAthleteIdentity(storage)
            };
        }
        if (typeof inspectIndexedDb !== 'function') {
            return { confirmed: false, present: false, athleteId: null };
        }

        let indexedDbInspection;
        try {
            indexedDbInspection = normalizeIndexedDbInspection(
                await inspectIndexedDb()
            );
        } catch {
            indexedDbInspection = { confirmed: false, present: false };
        }
        return {
            confirmed: indexedDbInspection.confirmed,
            present: indexedDbInspection.present,
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
                    const result = await revokeAccessToken(tokenRead.accessToken);
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

    async function acceptOAuthTokenResponse(exchangeResponse) {
        const tokenRecord = tokenRecordFromExchange(exchangeResponse);
        if (!tokenRecord) {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED);
        }

        const library = await inspectLibraryIdentity();
        if (!library.confirmed) {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
        }

        if (library.present) {
            const newAthleteId = normalizeIdentity(exchangeResponse?.athlete?.id);
            if (!library.athleteId || !newAthleteId) {
                return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_UNCONFIRMED);
            }
            if (library.athleteId !== newAthleteId) {
                return lifecycleResult(AUTH_LIFECYCLE_STATUS.IDENTITY_MISMATCH);
            }
        }

        try {
            storage.setItem(TOKEN_KEY, JSON.stringify(tokenRecord));
        } catch {
            return lifecycleResult(AUTH_LIFECYCLE_STATUS.TOKEN_WRITE_FAILED);
        }

        return lifecycleResult(AUTH_LIFECYCLE_STATUS.SUCCESS, {
            firstLogin: !library.present
        });
    }

    return Object.freeze({
        acceptOAuthTokenResponse,
        disconnect,
        expireToken,
        handleAuthFailure
    });
}
