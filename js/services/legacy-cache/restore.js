import {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_DB_VERSION,
    LEGACY_ERROR_CODES,
    LEGACY_GEAR_CUSTOM_PREFIX,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_SETTINGS_KEYS,
    LEGACY_STORE_NAME
} from './constants.js';
import {
    stableStringify,
    storageEntryToString,
    verifyLegacyBundle
} from './bundle.js';
import { readLegacyIndexedDb } from './reader.js';

const issuedPlans = new WeakSet();
const planBindings = new WeakMap();

function issue(code, message, details = {}) {
    return { code, message, ...details };
}

function errorName(error) {
    return error?.name || 'Error';
}

function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
}

function isDeepFrozen(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return true;
    if (!Object.isFrozen(value)) return false;
    seen.add(value);
    return Object.values(value).every(child => isDeepFrozen(child, seen));
}

function signPlan(plan) {
    deepFreeze(plan);
    issuedPlans.add(plan);
    planBindings.set(plan, {
        desired: stableStringify(plan.desired),
        target: stableStringify(plan.target),
        verification: stableStringify(plan.verification)
    });
    return plan;
}

function desiredFromVerification(verification) {
    const activityPayload = verification.logicalFiles['legacy-activities.json'];
    const localStorage = {};
    for (const filename of [
        'legacy-athlete.json',
        'legacy-gears.json',
        'legacy-settings.json',
        'legacy-zones.json'
    ]) {
        for (const [key, entry] of Object.entries(
            verification.logicalFiles[filename].entries
        )) {
            localStorage[key] = storageEntryToString(entry);
        }
    }
    return {
        indexedDbEntry: {
            activities: activityPayload.activities,
            cacheVersion: activityPayload.cacheVersion,
            key: LEGACY_ACTIVITY_KEY,
            timestamp: activityPayload.timestamp
        },
        localStorage
    };
}

function validateIssuedPlan(plan) {
    if (
        !plan
        || typeof plan !== 'object'
        || !issuedPlans.has(plan)
        || !planBindings.has(plan)
        || !isDeepFrozen(plan)
    ) {
        return false;
    }

    try {
        const binding = planBindings.get(plan);
        if (
            stableStringify(plan.desired) !== binding.desired
            || stableStringify(plan.target) !== binding.target
            || stableStringify(plan.verification) !== binding.verification
        ) {
            return false;
        }
        if (plan.desired && plan.verification?.valid) {
            return stableStringify(plan.desired)
                === stableStringify(desiredFromVerification(plan.verification));
        }
        return plan.desired === null;
    } catch {
        return false;
    }
}

function planInvalidResult() {
    return {
        status: 'aborted',
        imported: [],
        skipped: [],
        failed: [issue(
            LEGACY_ERROR_CODES.RESTORE_PLAN_INVALID,
            'The restore plan was not issued by this module or no longer matches its bundle.'
        )],
        rolledBack: [],
        warnings: []
    };
}

function enumerateStorageKeys(storage) {
    const keys = [];
    const length = storage.length;
    for (let index = 0; index < length; index += 1) {
        const key = storage.key(index);
        if (typeof key === 'string') keys.push(key);
    }
    return keys;
}

function targetStorageKeys(storage, desiredValues) {
    const keys = new Set([
        ...Object.keys(desiredValues),
        ...LEGACY_SETTINGS_KEYS,
        LEGACY_LOCAL_STORAGE_KEYS.activities,
        LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp,
        LEGACY_LOCAL_STORAGE_KEYS.cacheVersion,
        LEGACY_LOCAL_STORAGE_KEYS.athlete,
        LEGACY_LOCAL_STORAGE_KEYS.zones,
        LEGACY_LOCAL_STORAGE_KEYS.gears
    ]);
    for (const key of enumerateStorageKeys(storage)) {
        if (key.startsWith(LEGACY_GEAR_CUSTOM_PREFIX)) keys.add(key);
    }
    return [...keys].sort();
}

function snapshotLocalStorage(storage, keys) {
    if (!storage || typeof storage.getItem !== 'function') {
        throw new Error('localStorage is not available.');
    }
    return Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
}

function entryFromFallback(snapshot) {
    const rawActivities = snapshot[LEGACY_LOCAL_STORAGE_KEYS.activities];
    if (rawActivities === null) return null;
    try {
        const activities = JSON.parse(rawActivities);
        if (!Array.isArray(activities)) return { invalid: true };
        return {
            activities,
            cacheVersion: snapshot[LEGACY_LOCAL_STORAGE_KEYS.cacheVersion],
            key: LEGACY_ACTIVITY_KEY,
            timestamp: Number(snapshot[LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp]) || 0
        };
    } catch {
        return { invalid: true };
    }
}

function normalizedEntry(entry) {
    if (!entry) return null;
    return {
        activities: entry.activities,
        cacheVersion: entry.cacheVersion ?? null,
        key: LEGACY_ACTIVITY_KEY,
        timestamp: entry.timestamp ?? null
    };
}

function entriesEqual(left, right) {
    if (left?.invalid || right?.invalid) return false;
    return stableStringify(normalizedEntry(left))
        === stableStringify(normalizedEntry(right));
}

function signedPlan(fields) {
    return signPlan({
        action: fields.action,
        reason: fields.reason,
        verification: fields.verification,
        desired: fields.desired ?? null,
        target: fields.target ?? null,
        warnings: fields.warnings || [],
        errors: fields.errors || []
    });
}

export async function parseAndVerifyLegacyBundle(bundle, options = {}) {
    return verifyLegacyBundle(bundle, options);
}

function unsupportedTargetVersionPlan({ verification, desired, target, details = {} }) {
    return signedPlan({
        action: 'abort',
        reason: 'unsupported-target-version',
        verification,
        desired,
        target,
        warnings: verification.warnings,
        errors: [issue(
            LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION,
            'Restore supports only a missing target or an existing Legacy version 1 target.',
            details
        )]
    });
}

export async function createLegacyRestorePlan({
    bundle,
    indexedDB: indexedDb = globalThis.indexedDB,
    localStorage: storage = globalThis.localStorage,
    crypto: cryptoProvider = globalThis.crypto,
    confirmProvenance = false,
    openTimeoutMs = 5000
} = {}) {
    const verification = await parseAndVerifyLegacyBundle(bundle, { crypto: cryptoProvider });
    if (!verification.valid) {
        return signedPlan({
            action: 'abort',
            reason: 'validation-failed',
            verification,
            warnings: verification.warnings,
            errors: verification.errors
        });
    }

    const desired = desiredFromVerification(verification);
    if (verification.provenance?.uncertain && !confirmProvenance) {
        return signedPlan({
            action: 'abort',
            reason: 'provenance-confirmation-required',
            verification,
            desired,
            warnings: verification.warnings,
            errors: [issue(
                LEGACY_ERROR_CODES.RESTORE_PROVENANCE_CONFIRMATION_REQUIRED,
                'The hashed provenance evidence requires explicit confirmation.'
            )]
        });
    }

    let localStorageSnapshot;
    try {
        localStorageSnapshot = snapshotLocalStorage(
            storage,
            targetStorageKeys(storage, desired.localStorage)
        );
    } catch (error) {
        return signedPlan({
            action: 'abort',
            reason: 'target-read-failed',
            verification,
            desired,
            warnings: verification.warnings,
            errors: [issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_ACCESS_ERROR,
                'Reading the restore target localStorage failed.',
                { cause: errorName(error) }
            )]
        });
    }

    const indexedDbSource = await readLegacyIndexedDb({
        indexedDB: indexedDb,
        openTimeoutMs
    });
    const provisionalTarget = {
        databaseExisted: indexedDbSource.databaseVersion !== null,
        databaseVersion: indexedDbSource.databaseVersion,
        indexedDbEntry: indexedDbSource.entry || null,
        localStorage: localStorageSnapshot
    };

    if (indexedDbSource.status === 'error') {
        if (indexedDbSource.errors.some(error => (
            error.code === LEGACY_ERROR_CODES.INDEXEDDB_STORE_NOT_FOUND
        ))) {
            return unsupportedTargetVersionPlan({
                verification,
                desired,
                target: provisionalTarget
            });
        }
        return signedPlan({
            action: 'abort',
            reason: 'target-read-failed',
            verification,
            desired,
            target: provisionalTarget,
            warnings: verification.warnings,
            errors: indexedDbSource.errors
        });
    }

    if (
        indexedDbSource.databaseVersion !== null
        && indexedDbSource.databaseVersion !== LEGACY_DB_VERSION
    ) {
        return unsupportedTargetVersionPlan({
            verification,
            desired,
            target: provisionalTarget,
            details: { actualVersion: indexedDbSource.databaseVersion }
        });
    }

    const indexedDbEntry = indexedDbSource.status === 'found'
        ? indexedDbSource.entry
        : null;
    const fallbackEntry = entryFromFallback(localStorageSnapshot);
    const currentEntry = indexedDbEntry || fallbackEntry;
    const activityStorageKeys = [
        LEGACY_LOCAL_STORAGE_KEYS.activities,
        LEGACY_LOCAL_STORAGE_KEYS.activitiesTimestamp,
        LEGACY_LOCAL_STORAGE_KEYS.cacheVersion
    ];
    const metadataKeys = Object.keys(localStorageSnapshot).filter(
        key => !activityStorageKeys.includes(key)
    );
    const hasMetadata = metadataKeys.some(key => localStorageSnapshot[key] !== null);
    const hasActivityStorageState = activityStorageKeys.some(
        key => localStorageSnapshot[key] !== null
    );
    const isEmpty = currentEntry === null && !hasActivityStorageState && !hasMetadata;
    const activityIdentical = entriesEqual(currentEntry, desired.indexedDbEntry)
        && (!indexedDbEntry || !fallbackEntry || entriesEqual(
            fallbackEntry,
            desired.indexedDbEntry
        ));
    const metadataIdentical = metadataKeys.every(
        key => localStorageSnapshot[key] === (desired.localStorage[key] ?? null)
    );
    const target = {
        databaseExisted: indexedDbSource.databaseVersion !== null,
        databaseVersion: indexedDbSource.databaseVersion,
        indexedDbEntry,
        localStorage: localStorageSnapshot
    };

    if (isEmpty) {
        return signedPlan({
            action: 'restore',
            reason: 'empty-target',
            verification,
            desired,
            target,
            warnings: verification.warnings
        });
    }
    if (activityIdentical && metadataIdentical) {
        return signedPlan({
            action: 'noop',
            reason: 'identical-target',
            verification,
            desired,
            target,
            warnings: verification.warnings
        });
    }
    return signedPlan({
        action: 'abort',
        reason: 'conflicting-target',
        verification,
        desired,
        target,
        warnings: verification.warnings,
        errors: [issue(
            LEGACY_ERROR_CODES.RESTORE_CONFLICT,
            'The restore target is non-empty and differs from the bundle.'
        )]
    });
}

function restoreError(code, message, {
    cause = null,
    createdDatabase = false
} = {}) {
    const error = new Error(message);
    error.name = 'LegacyRestoreError';
    error.code = code;
    error.causeName = errorName(cause);
    error.createdDatabase = createdDatabase;
    return error;
}

function openDatabaseForWrite(indexedDb, {
    createIfMissing,
    openTimeoutMs
}) {
    if (!indexedDb || typeof indexedDb.open !== 'function') {
        return Promise.reject(restoreError(
            LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
            'IndexedDB is not available.'
        ));
    }

    return new Promise((resolve, reject) => {
        let request;
        let settled = false;
        let sawUpgrade = false;
        let cancelled = false;
        let cancellationCode = LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED;
        let cancellationMessage = 'Opening the restore target was cancelled.';
        let upgradeAbortAttempted = false;

        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback(value);
        };
        const fail = (
            code,
            message,
            cause = null,
            createdDatabase = false
        ) => finish(reject, restoreError(
            code,
            message,
            { cause, createdDatabase }
        ));
        const abortCancelledUpgrade = () => {
            if (!sawUpgrade || upgradeAbortAttempted) return;
            upgradeAbortAttempted = true;
            try {
                request.transaction.abort();
            } catch {
                // A terminal success will prove whether this request created a database.
            }
        };
        const cancel = (code, message) => {
            if (settled || cancelled) return;
            cancelled = true;
            cancellationCode = code;
            cancellationMessage = message;
            abortCancelledUpgrade();
        };
        const timeoutId = setTimeout(() => {
            cancel(
                LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                'Opening the restore target timed out.'
            );
        }, Math.max(0, openTimeoutMs));

        try {
            request = createIfMissing
                ? indexedDb.open(LEGACY_DB_NAME, LEGACY_DB_VERSION)
                : indexedDb.open(LEGACY_DB_NAME);
        } catch (error) {
            fail(
                LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                'Opening the restore target failed.',
                error
            );
            return;
        }

        request.onupgradeneeded = () => {
            sawUpgrade = true;
            if (!createIfMissing && !cancelled) {
                cancel(
                    LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                    'The restore target was deleted after planning.'
                );
            }
            if (cancelled) {
                abortCancelledUpgrade();
                return;
            }

            try {
                const db = request.result;
                if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
                    db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'key' });
                }
            } catch (error) {
                cancel(
                    LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                    'Creating the restore target store failed.'
                );
            }
        };

        request.onblocked = () => {
            cancel(
                LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                'Opening the restore target was blocked.'
            );
        };
        request.onerror = () => {
            if (cancelled) {
                fail(
                    cancellationCode,
                    cancellationMessage,
                    request.error
                );
                return;
            }
            const code = request.error?.name === 'VersionError'
                ? LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION
                : LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED;
            fail(code, 'Opening the restore target failed.', request.error);
        };
        request.onsuccess = () => {
            const db = request.result;
            if (settled) {
                db.close();
                return;
            }
            if (cancelled) {
                db.close();
                fail(
                    cancellationCode,
                    cancellationMessage,
                    null,
                    sawUpgrade
                );
                return;
            }
            if (createIfMissing && !sawUpgrade) {
                db.close();
                fail(
                    LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                    'The restore target appeared after planning.'
                );
                return;
            }
            if (db.version !== LEGACY_DB_VERSION) {
                db.close();
                fail(
                    LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION,
                    'The restore target version is not supported.'
                );
                return;
            }
            if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
                db.close();
                fail(
                    LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION,
                    'The restore target store is not compatible.'
                );
                return;
            }
            finish(resolve, { db, createdDatabase: sawUpgrade });
        };
    });
}

async function writeIndexedDbEntry(indexedDb, entry, {
    createIfMissing,
    expectedPreviousEntry,
    openTimeoutMs
}) {
    const opened = await openDatabaseForWrite(indexedDb, {
        createIfMissing,
        openTimeoutMs
    });
    const { db, createdDatabase } = opened;

    return new Promise((resolve, reject) => {
        let transaction;
        let operationError = null;
        const fail = error => {
            error.createdDatabase = createdDatabase;
            reject(error);
        };

        try {
            transaction = db.transaction(LEGACY_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(LEGACY_STORE_NAME);
            const readRequest = store.get(LEGACY_ACTIVITY_KEY);

            readRequest.onerror = () => {
                operationError = restoreError(
                    LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                    'Rechecking the restore target entry failed.',
                    { cause: readRequest.error, createdDatabase }
                );
                transaction.abort();
            };
            readRequest.onsuccess = () => {
                const currentEntry = readRequest.result ?? null;
                if (!entriesEqual(currentEntry, expectedPreviousEntry)) {
                    operationError = restoreError(
                        LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                        'The restore target entry changed before the write.',
                        { createdDatabase }
                    );
                    transaction.abort();
                    return;
                }
                try {
                    store.put(entry);
                } catch (error) {
                    operationError = restoreError(
                        LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                        'Writing the restore target entry failed.',
                        { cause: error, createdDatabase }
                    );
                    transaction.abort();
                }
            };
        } catch (error) {
            db.close();
            fail(restoreError(
                LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                'Starting the restore transaction failed.',
                { cause: error, createdDatabase }
            ));
            return;
        }

        transaction.oncomplete = () => {
            db.close();
            resolve({ createdDatabase });
        };
        transaction.onerror = () => {
            const error = operationError || restoreError(
                LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
                'The restore transaction failed.',
                { cause: transaction.error, createdDatabase }
            );
            db.close();
            fail(error);
        };
        transaction.onabort = transaction.onerror;
        db.onversionchange = () => {
            operationError = restoreError(
                LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                'The restore target version changed during the write.',
                { createdDatabase }
            );
            try {
                transaction.abort();
            } catch {
                db.close();
                fail(operationError);
            }
        };
    });
}

async function rollbackExistingDatabaseEntry(
    indexedDb,
    previousEntry,
    committedEntry,
    openTimeoutMs
) {
    const opened = await openDatabaseForWrite(indexedDb, {
        createIfMissing: false,
        openTimeoutMs
    });
    const { db } = opened;
    return new Promise((resolve, reject) => {
        let transaction;
        let operationError = null;
        try {
            transaction = db.transaction(LEGACY_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(LEGACY_STORE_NAME);
            const readRequest = store.get(LEGACY_ACTIVITY_KEY);
            readRequest.onerror = () => {
                operationError = restoreError(
                    LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                    'Reading the current IndexedDB entry before rollback failed.',
                    { cause: readRequest.error }
                );
                transaction.abort();
            };
            readRequest.onsuccess = () => {
                const currentEntry = readRequest.result ?? null;
                if (!entriesEqual(currentEntry, committedEntry)) {
                    operationError = restoreError(
                        LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                        'The IndexedDB entry changed after the restore committed.'
                    );
                    transaction.abort();
                    return;
                }
                try {
                    if (previousEntry) store.put(previousEntry);
                    else store.delete(LEGACY_ACTIVITY_KEY);
                } catch (error) {
                    operationError = restoreError(
                        LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                        'Writing the previous IndexedDB entry during rollback failed.',
                        { cause: error }
                    );
                    transaction.abort();
                }
            };
        } catch (error) {
            db.close();
            reject(error);
            return;
        }
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            const error = operationError || restoreError(
                LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                'The IndexedDB rollback transaction failed.',
                { cause: transaction.error }
            );
            db.close();
            reject(error);
        };
        transaction.onabort = transaction.onerror;
    });
}

function deleteCreatedDatabase(indexedDb, openTimeoutMs) {
    if (!indexedDb || typeof indexedDb.deleteDatabase !== 'function') {
        return Promise.reject(new Error('IndexedDB deletion is not available.'));
    }
    return new Promise((resolve, reject) => {
        let request;
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback(value);
        };
        const timeoutId = setTimeout(
            () => finish(reject, new Error('Deleting the created database timed out.')),
            Math.max(0, openTimeoutMs)
        );
        try {
            request = indexedDb.deleteDatabase(LEGACY_DB_NAME);
        } catch (error) {
            finish(reject, error);
            return;
        }
        request.onsuccess = () => finish(resolve);
        request.onerror = () => finish(
            reject,
            request.error || new Error('Deleting the created database failed.')
        );
        request.onblocked = () => finish(
            reject,
            new Error('Deleting the created database was blocked.')
        );
    });
}

function rollbackLocalStorage(storage, snapshot, changedKeys) {
    const failures = [];
    for (const key of [...changedKeys].reverse()) {
        try {
            if (snapshot[key] === null) storage.removeItem(key);
            else storage.setItem(key, snapshot[key]);
        } catch (error) {
            failures.push({ key, cause: errorName(error) });
        }
    }
    return failures;
}

function resultForPlan(plan) {
    if (plan.action === 'noop') {
        return {
            status: 'noop',
            imported: [],
            skipped: ['bundle'],
            failed: [],
            rolledBack: [],
            warnings: plan.warnings
        };
    }
    return {
        status: 'aborted',
        imported: [],
        skipped: [],
        failed: plan.errors,
        rolledBack: [],
        warnings: plan.warnings
    };
}

async function targetMatchesPlan(plan, {
    indexedDb,
    storage,
    openTimeoutMs
}) {
    let currentStorage;
    try {
        currentStorage = snapshotLocalStorage(
            storage,
            targetStorageKeys(storage, plan.desired.localStorage)
        );
    } catch (error) {
        return {
            matches: false,
            errors: [issue(
                LEGACY_ERROR_CODES.LOCAL_STORAGE_ACCESS_ERROR,
                'Re-reading the restore target localStorage failed.',
                { cause: errorName(error) }
            )]
        };
    }
    if (stableStringify(currentStorage) !== stableStringify(plan.target.localStorage)) {
        return {
            matches: false,
            errors: [issue(
                LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                'The restore target localStorage changed after planning.'
            )]
        };
    }

    const indexedDbSource = await readLegacyIndexedDb({
        indexedDB: indexedDb,
        openTimeoutMs
    });
    if (indexedDbSource.status === 'error') {
        if (indexedDbSource.errors.some(error => (
            error.code === LEGACY_ERROR_CODES.INDEXEDDB_STORE_NOT_FOUND
        ))) {
            return {
                matches: false,
                errors: [issue(
                    LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION,
                    'The restore target became structurally incompatible after planning.'
                )]
            };
        }
        return { matches: false, errors: indexedDbSource.errors };
    }
    if (
        indexedDbSource.databaseVersion !== null
        && indexedDbSource.databaseVersion !== LEGACY_DB_VERSION
    ) {
        return {
            matches: false,
            errors: [issue(
                LEGACY_ERROR_CODES.RESTORE_UNSUPPORTED_TARGET_VERSION,
                'The restore target version changed to an unsupported version.',
                { actualVersion: indexedDbSource.databaseVersion }
            )]
        };
    }

    const currentEntry = indexedDbSource.status === 'found'
        ? indexedDbSource.entry
        : null;
    const databaseExisted = indexedDbSource.databaseVersion !== null;
    const matches = entriesEqual(currentEntry, plan.target.indexedDbEntry)
        && databaseExisted === plan.target.databaseExisted
        && indexedDbSource.databaseVersion === plan.target.databaseVersion;
    return {
        matches,
        errors: matches ? [] : [issue(
            LEGACY_ERROR_CODES.RESTORE_CONFLICT,
            'The restore target database changed after planning.'
        )]
    };
}

export async function applyLegacyRestorePlan(plan, {
    indexedDB: indexedDb = globalThis.indexedDB,
    localStorage: storage = globalThis.localStorage,
    openTimeoutMs = 5000
} = {}) {
    if (!validateIssuedPlan(plan)) return planInvalidResult();
    if (plan.action !== 'restore') return resultForPlan(plan);

    const derivedDesired = desiredFromVerification(plan.verification);
    if (stableStringify(derivedDesired) !== stableStringify(plan.desired)) {
        return planInvalidResult();
    }

    const targetCheck = await targetMatchesPlan(plan, {
        indexedDb,
        storage,
        openTimeoutMs
    });
    if (!targetCheck.matches) {
        return {
            status: 'aborted',
            imported: [],
            skipped: [],
            failed: targetCheck.errors,
            rolledBack: [],
            warnings: plan.warnings
        };
    }

    const imported = [];
    const rolledBack = [];
    const failures = [];
    const changedLocalStorageKeys = [];
    let indexedDbWriteCommitted = false;
    let databaseCreatedByApply = false;

    try {
        const writeResult = await writeIndexedDbEntry(
            indexedDb,
            plan.desired.indexedDbEntry,
            {
                createIfMissing: !plan.target.databaseExisted,
                expectedPreviousEntry: plan.target.indexedDbEntry,
                openTimeoutMs
            }
        );
        databaseCreatedByApply = writeResult.createdDatabase;
        indexedDbWriteCommitted = true;
        imported.push(`indexedDb:${LEGACY_ACTIVITY_KEY}`);

        for (const key of Object.keys(plan.desired.localStorage).sort()) {
            if (storage.getItem(key) !== plan.target.localStorage[key]) {
                throw restoreError(
                    LEGACY_ERROR_CODES.RESTORE_CONFLICT,
                    'The restore target localStorage changed during apply.'
                );
            }
            storage.setItem(key, plan.desired.localStorage[key]);
            changedLocalStorageKeys.push(key);
            imported.push(`localStorage:${key}`);
        }

        return {
            status: 'restored',
            imported,
            skipped: [],
            failed: [],
            rolledBack: [],
            warnings: plan.warnings
        };
    } catch (error) {
        databaseCreatedByApply = databaseCreatedByApply || Boolean(error.createdDatabase);
        failures.push(issue(
            error.code || LEGACY_ERROR_CODES.RESTORE_WRITE_FAILED,
            'Applying the Legacy restore failed.',
            { cause: error.causeName || errorName(error) }
        ));
    }

    if (changedLocalStorageKeys.length > 0) {
        const localRollbackFailures = rollbackLocalStorage(
            storage,
            plan.target.localStorage,
            changedLocalStorageKeys
        );
        if (localRollbackFailures.length === 0) {
            rolledBack.push('localStorage');
        } else {
            failures.push(issue(
                LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                'Rolling back localStorage was only partially successful.',
                { failures: localRollbackFailures }
            ));
        }
    }

    if (databaseCreatedByApply) {
        try {
            await deleteCreatedDatabase(indexedDb, openTimeoutMs);
            rolledBack.push('indexedDbDatabase');
        } catch (error) {
            failures.push(issue(
                LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                'Deleting the database created by the failed restore did not complete.',
                { cause: errorName(error) }
            ));
        }
    } else if (indexedDbWriteCommitted && plan.target.databaseExisted) {
        try {
            await rollbackExistingDatabaseEntry(
                indexedDb,
                plan.target.indexedDbEntry,
                plan.desired.indexedDbEntry,
                openTimeoutMs
            );
            rolledBack.push('indexedDbEntry');
        } catch (error) {
            failures.push(issue(
                LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED,
                'Rolling back the pre-existing IndexedDB entry failed.',
                {
                    cause: errorName(error),
                    causeCode: error.code || null
                }
            ));
        }
    }

    return {
        status: failures.some(failure => (
            failure.code === LEGACY_ERROR_CODES.RESTORE_ROLLBACK_FAILED
        )) ? 'partial-rollback' : 'failed',
        imported,
        skipped: [],
        failed: failures,
        rolledBack,
        warnings: plan.warnings
    };
}

export async function restoreLegacyBundle(options = {}) {
    const plan = await createLegacyRestorePlan(options);
    return applyLegacyRestorePlan(plan, options);
}
