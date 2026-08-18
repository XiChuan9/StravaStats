import {
    LEGACY_ERROR_CODES,
    LEGACY_GEAR_CUSTOM_PREFIX,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_LOGICAL_FILES,
    LEGACY_SETTINGS_KEYS,
    LEGACY_WARNING_CODES
} from './constants.js';

const BUNDLE_FORMAT = 'stravastats-legacy-rescue';
const BUNDLE_FORMAT_VERSION = 1;
const MEDIA_TYPE_JSON = 'application/json';
const HASHED_LOGICAL_FILES = LEGACY_LOGICAL_FILES
    .filter(filename => filename !== 'manifest.json')
    .sort();
const PROTECTED_WARNING_CODES = new Set([
    LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN,
    LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED,
    LEGACY_WARNING_CODES.SOURCE_READ_ERROR
]);
const PROVENANCE_EVIDENCE_CODES = new Set([
    LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN,
    LEGACY_WARNING_CODES.SOURCE_READ_ERROR
]);
const STABLE_ERROR_CODES = new Set(Object.values(LEGACY_ERROR_CODES));
const STABLE_WARNING_CODES = new Set(Object.values(LEGACY_WARNING_CODES));

function issue(code, message, details = {}) {
    return { code, message, ...details };
}

class LegacyBundleBuildError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'LegacyBundleBuildError';
        this.code = code;
    }
}

function canonicalize(value, ancestors = new Set()) {
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'bigint') {
            throw new TypeError('BigInt cannot be serialized to JSON.');
        }
        return value;
    }
    if (ancestors.has(value)) {
        throw new TypeError('Circular structures cannot be serialized to JSON.');
    }

    ancestors.add(value);
    let canonical;
    if (Array.isArray(value)) {
        canonical = value.map(item => {
            const normalized = canonicalize(item, ancestors);
            return normalized === undefined ? null : normalized;
        });
    } else {
        canonical = Object.create(null);
        for (const key of Object.keys(value).sort()) {
            const normalized = canonicalize(value[key], ancestors);
            if (normalized !== undefined) canonical[key] = normalized;
        }
    }
    ancestors.delete(value);
    return canonical;
}

export function stableStringify(value) {
    const serialized = JSON.stringify(canonicalize(value));
    if (serialized === undefined) {
        throw new TypeError('The value cannot be serialized to JSON.');
    }
    return serialized;
}

function utf8Bytes(value) {
    return new TextEncoder().encode(value);
}

export async function sha256Hex(value, {
    crypto: cryptoProvider = globalThis.crypto
} = {}) {
    if (!cryptoProvider?.subtle?.digest) {
        throw new Error('Web Crypto SHA-256 is not available.');
    }
    const bytes = typeof value === 'string' ? utf8Bytes(value) : value;
    const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
    return Array.from(
        new Uint8Array(digest),
        byte => byte.toString(16).padStart(2, '0')
    ).join('');
}

function sortedUnique(values) {
    return [...new Set(values)].sort();
}

function isSortedUnique(values) {
    return Array.isArray(values)
        && stableStringify(values) === stableStringify(sortedUnique(values));
}

function compactKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveField(key) {
    const normalized = compactKey(key);
    return normalized === 'token'
        || normalized === 'tokens'
        || normalized === 'authtoken'
        || normalized === 'bearertoken'
        || normalized === 'authorizationtoken'
        || normalized.endsWith('accesstoken')
        || normalized.endsWith('refreshtoken')
        || normalized === 'authorization'
        || normalized === 'authorizationheader'
        || normalized.endsWith('apikey')
        || normalized === 'gemini'
        || normalized === 'geminikey'
        || normalized === 'aichathistory'
        || normalized === 'chathistory'
        || normalized.startsWith('stravademo');
}

function sensitiveRawFieldNames(value) {
    const pattern = /(?:^|[\s,{;])["']?(token|tokens|access[_-]?token|accesstoken|refresh[_-]?token|refreshtoken|auth[_-]?token|authtoken|bearer[_-]?token|bearertoken|authorization(?:[_-]?token)?|api[_-]?key|apikey|gemini(?:[_-]?api)?[_-]?key|ai[_-]?chat[_-]?history|strava[_-]?demo[a-z0-9_-]*)["']?\s*[:=]/gi;
    const fields = [];
    for (const match of value.matchAll(pattern)) {
        fields.push(compactKey(match[1]));
    }
    return sortedUnique(fields);
}

function sanitizeValue(value, path, ancestors = new Set()) {
    if (value === null || typeof value !== 'object') {
        return { value, fieldPaths: [] };
    }
    if (ancestors.has(value)) {
        throw new TypeError('Circular structures cannot be exported.');
    }

    ancestors.add(value);
    const fieldPaths = [];
    let sanitized;

    if (Array.isArray(value)) {
        sanitized = value.map((item, index) => {
            const child = sanitizeValue(item, `${path}[${index}]`, ancestors);
            fieldPaths.push(...child.fieldPaths);
            return child.value;
        });
    } else {
        sanitized = Object.create(null);
        for (const key of Object.keys(value)) {
            const fieldPath = `${path}.${key}`;
            if (isSensitiveField(key)) {
                fieldPaths.push(fieldPath);
                continue;
            }
            const child = sanitizeValue(value[key], fieldPath, ancestors);
            fieldPaths.push(...child.fieldPaths);
            sanitized[key] = child.value;
        }
    }

    ancestors.delete(value);
    return {
        value: sanitized,
        fieldPaths: sortedUnique(fieldPaths)
    };
}

function redactionEvidence(fieldPaths) {
    const paths = sortedUnique(fieldPaths);
    return {
        evidenceCodes: paths.length > 0
            ? [LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED]
            : [],
        fieldPaths: paths
    };
}

function containsSensitiveFields(value) {
    if (Array.isArray(value)) return value.some(containsSensitiveFields);
    if (value === null || typeof value !== 'object') return false;
    return Object.entries(value).some(
        ([key, child]) => isSensitiveField(key) || containsSensitiveFields(child)
    );
}

function storageKeys(storage) {
    const keys = [];
    const length = storage.length;
    for (let index = 0; index < length; index += 1) {
        const key = storage.key(index);
        if (typeof key === 'string') keys.push(key);
    }
    return sortedUnique(keys);
}

function readStorageEntries(storage, keys, filename) {
    if (!storage || typeof storage.getItem !== 'function') {
        throw new Error('localStorage is not available.');
    }

    const entries = {};
    const fieldPaths = [];
    for (const key of sortedUnique(keys)) {
        const rawValue = storage.getItem(key);
        if (rawValue === null) continue;
        try {
            const sanitized = sanitizeValue(
                JSON.parse(rawValue),
                `${filename}.entries.${key}.value`
            );
            entries[key] = {
                encoding: 'json',
                value: sanitized.value
            };
            fieldPaths.push(...sanitized.fieldPaths);
        } catch (error) {
            if (error instanceof SyntaxError) {
                const sensitiveFields = sensitiveRawFieldNames(rawValue);
                if (sensitiveFields.length > 0) {
                    fieldPaths.push(...sensitiveFields.map(
                        field => `${filename}.entries.${key}.raw.${field}`
                    ));
                    continue;
                }
                entries[key] = {
                    encoding: 'raw',
                    value: rawValue
                };
                continue;
            }
            throw error;
        }
    }
    return {
        entries,
        redaction: redactionEvidence(fieldPaths)
    };
}

function approvedSettingsKeys(storage) {
    const approved = new Set(LEGACY_SETTINGS_KEYS);
    for (const key of storageKeys(storage)) {
        if (key.startsWith(LEGACY_GEAR_CUSTOM_PREFIX)) approved.add(key);
    }
    return [...approved].sort();
}

function selectedSourceRecord(rescueResult) {
    return rescueResult?.sources?.[rescueResult?.selectedSource] || null;
}

function assertExportableRescueResult(rescueResult) {
    const selectedSource = rescueResult?.selectedSource;
    const selected = selectedSourceRecord(rescueResult);
    const statusAllowed = rescueResult?.status === 'found'
        || rescueResult?.status === 'partial';
    const sourceAllowed = selectedSource === 'indexedDb'
        || selectedSource === 'localStorage';
    const activitiesValid = Array.isArray(rescueResult?.activities)
        && Array.isArray(selected?.entry?.activities);
    const activitiesMatch = activitiesValid
        && stableStringify(rescueResult.activities)
            === stableStringify(selected.entry.activities);

    if (
        !statusAllowed
        || !sourceAllowed
        || selected?.status !== 'found'
        || !activitiesValid
        || !activitiesMatch
    ) {
        throw new LegacyBundleBuildError(
            LEGACY_ERROR_CODES.RESCUE_SOURCE_NOT_EXPORTABLE,
            'The Rescue Reader result does not contain an exportable selected source.'
        );
    }
    return selected;
}

function stableSourceErrorCodes(rescueResult) {
    const issues = [
        ...(rescueResult?.errors || []),
        ...Object.values(rescueResult?.sources || {})
            .flatMap(source => source?.errors || [])
    ];
    return sortedUnique(
        issues
            .map(error => error?.code)
            .filter(code => STABLE_ERROR_CODES.has(code))
    );
}

function buildProvenance(rescueResult, provenance) {
    const evidenceCodes = [];
    const sourceErrorCodes = rescueResult.status === 'partial'
        ? stableSourceErrorCodes(rescueResult)
        : [];
    const mixed = provenance === 'mixed'
        || (
            rescueResult.selectedSource
            && rescueResult.sources?.demo?.status === 'found'
        );

    if (mixed) evidenceCodes.push(LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN);
    if (rescueResult.status === 'partial') {
        evidenceCodes.push(LEGACY_WARNING_CODES.SOURCE_READ_ERROR);
    }

    return {
        uncertain: mixed,
        evidenceCodes: sortedUnique(evidenceCodes),
        sourceErrorCodes
    };
}

function logicalPayloads({ rescueResult, localStorage: storage, provenance }) {
    const selected = selectedSourceRecord(rescueResult);
    const sanitizedActivities = sanitizeValue(
        rescueResult.activities,
        'legacy-activities.json.activities'
    );

    return {
        'legacy-activities.json': {
            activities: sanitizedActivities.value,
            cacheVersion: selected.entry.cacheVersion
                ?? rescueResult.sourceCacheVersion
                ?? null,
            key: LEGACY_LOCAL_STORAGE_KEYS.activities,
            provenance: buildProvenance(rescueResult, provenance),
            redaction: redactionEvidence(sanitizedActivities.fieldPaths),
            timestamp: selected.entry.timestamp ?? null
        },
        'legacy-athlete.json': readStorageEntries(
            storage,
            [LEGACY_LOCAL_STORAGE_KEYS.athlete],
            'legacy-athlete.json'
        ),
        'legacy-gears.json': readStorageEntries(
            storage,
            [LEGACY_LOCAL_STORAGE_KEYS.gears],
            'legacy-gears.json'
        ),
        'legacy-settings.json': readStorageEntries(
            storage,
            approvedSettingsKeys(storage),
            'legacy-settings.json'
        ),
        'legacy-zones.json': readStorageEntries(
            storage,
            [LEGACY_LOCAL_STORAGE_KEYS.zones],
            'legacy-zones.json'
        )
    };
}

function activityRange(activities) {
    const dates = activities
        .map(activity => activity?.start_date || activity?.start_date_local || null)
        .filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
        .sort((left, right) => Date.parse(left) - Date.parse(right));
    return {
        earliestActivity: dates[0] || null,
        latestActivity: dates.at(-1) || null
    };
}

function derivedProtectedWarnings(logicalFiles) {
    const warnings = [];
    const provenance = logicalFiles['legacy-activities.json']?.provenance;

    if (provenance?.uncertain) {
        warnings.push({ code: LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN });
    }
    if (provenance?.evidenceCodes?.includes(LEGACY_WARNING_CODES.SOURCE_READ_ERROR)) {
        warnings.push({
            code: LEGACY_WARNING_CODES.SOURCE_READ_ERROR,
            sourceErrorCodes: provenance.sourceErrorCodes
        });
    }

    const redactedFiles = HASHED_LOGICAL_FILES.filter(filename => (
        logicalFiles[filename]?.redaction?.evidenceCodes?.includes(
            LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED
        )
    ));
    if (redactedFiles.length > 0) {
        warnings.push({
            code: LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED,
            logicalFiles: redactedFiles
        });
    }
    return warnings.sort((left, right) => left.code.localeCompare(right.code));
}

function manifestWarnings({ rescueResult, logicalFiles, applicationCommit }) {
    const warningCodes = sortedUnique(
        (rescueResult.warnings || [])
            .map(warning => warning?.code)
            .filter(code => STABLE_WARNING_CODES.has(code) && !PROTECTED_WARNING_CODES.has(code))
    );
    if (applicationCommit === null || applicationCommit === undefined) {
        warningCodes.push(LEGACY_WARNING_CODES.APPLICATION_COMMIT_UNAVAILABLE);
    }

    return [
        ...sortedUnique(warningCodes).map(code => ({ code })),
        ...derivedProtectedWarnings(logicalFiles)
    ].sort((left, right) => left.code.localeCompare(right.code));
}

export async function buildLegacyBundle({
    rescueResult,
    localStorage: storage = globalThis.localStorage,
    exportedAt,
    applicationCommit = null,
    provenance = null,
    crypto: cryptoProvider = globalThis.crypto
} = {}) {
    if (typeof exportedAt !== 'string' || exportedAt.length === 0) {
        throw new TypeError('exportedAt must be injected as a non-empty string.');
    }
    assertExportableRescueResult(rescueResult);

    const payloads = logicalPayloads({
        rescueResult,
        localStorage: storage,
        provenance
    });
    const activities = payloads['legacy-activities.json'].activities;
    const { earliestActivity, latestActivity } = activityRange(activities);
    const files = {};
    const descriptors = [];

    for (const filename of HASHED_LOGICAL_FILES) {
        const contents = stableStringify(payloads[filename]);
        const bytes = utf8Bytes(contents);
        files[filename] = contents;
        descriptors.push({
            byteLength: bytes.byteLength,
            filename,
            mediaType: MEDIA_TYPE_JSON,
            sha256: await sha256Hex(bytes, { crypto: cryptoProvider })
        });
    }

    const manifest = {
        activityCount: activities.length,
        applicationCommit: applicationCommit ?? null,
        earliestActivity,
        exportedAt,
        files: descriptors,
        formatVersion: BUNDLE_FORMAT_VERSION,
        latestActivity,
        sourceCacheVersion: rescueResult.sourceCacheVersion,
        sourceDatabase: rescueResult.sourceDatabase ?? null,
        sourceDatabaseVersion: rescueResult.sourceDatabaseVersion,
        warnings: manifestWarnings({
            rescueResult,
            logicalFiles: payloads,
            applicationCommit
        })
    };
    files['manifest.json'] = stableStringify(manifest);

    const bundle = {
        files,
        format: BUNDLE_FORMAT
    };
    return {
        bundle,
        bytes: stableStringify(bundle),
        manifest
    };
}

function parseBundleInput(input) {
    if (typeof input === 'string') return JSON.parse(input);
    if (input?.bundle) return input.bundle;
    return input;
}

function parseLogicalJson(files, filename, errors) {
    try {
        const parsed = JSON.parse(files[filename]);
        if (stableStringify(parsed) !== files[filename]) {
            errors.push(issue(
                LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
                `The logical file ${filename} is not deterministically serialized.`,
                { filename }
            ));
        }
        return parsed;
    } catch {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            `The logical file ${filename} is not valid JSON.`,
            { filename }
        ));
        return null;
    }
}

function validateRedaction(filename, redaction, errors) {
    const valid = redaction
        && isSortedUnique(redaction.evidenceCodes)
        && isSortedUnique(redaction.fieldPaths)
        && redaction.evidenceCodes.every(
            code => code === LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED
        )
        && (
            redaction.fieldPaths.length > 0
                ? redaction.evidenceCodes.length === 1
                : redaction.evidenceCodes.length === 0
        )
        && redaction.fieldPaths.every(path => typeof path === 'string');
    if (!valid) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            `The logical file ${filename} has invalid redaction evidence.`,
            { filename }
        ));
    }
    return valid;
}

function validateProvenance(provenance, errors) {
    const valid = provenance
        && typeof provenance.uncertain === 'boolean'
        && isSortedUnique(provenance.evidenceCodes)
        && isSortedUnique(provenance.sourceErrorCodes)
        && provenance.evidenceCodes.every(code => PROVENANCE_EVIDENCE_CODES.has(code))
        && provenance.sourceErrorCodes.every(code => STABLE_ERROR_CODES.has(code))
        && provenance.uncertain === provenance.evidenceCodes.includes(
            LEGACY_WARNING_CODES.PROVENANCE_UNCERTAIN
        )
        && (
            provenance.evidenceCodes.includes(LEGACY_WARNING_CODES.SOURCE_READ_ERROR)
            || provenance.sourceErrorCodes.length === 0
        );
    if (!valid) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            'The Legacy activities provenance evidence is invalid.'
        ));
    }
    return valid;
}

function validateMetadataEntries(filename, payload, allowedKeys, errors) {
    if (
        !payload
        || typeof payload.entries !== 'object'
        || Array.isArray(payload.entries)
    ) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            `The logical file ${filename} has invalid entries.`,
            { filename }
        ));
        return;
    }
    validateRedaction(filename, payload.redaction, errors);

    for (const [key, entry] of Object.entries(payload.entries)) {
        if (!allowedKeys(key)) {
            errors.push(issue(
                LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
                `The logical file ${filename} contains a non-allowlisted key.`,
                { filename, key }
            ));
        }
        if (
            !entry
            || !['json', 'raw'].includes(entry.encoding)
            || !Object.hasOwn(entry, 'value')
            || (entry.encoding === 'json' && containsSensitiveFields(entry.value))
        ) {
            errors.push(issue(
                LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
                `The logical file ${filename} contains an invalid or sensitive entry.`,
                { filename, key }
            ));
        }
    }
}

function protectedManifestWarnings(manifest) {
    return (manifest?.warnings || [])
        .filter(warning => PROTECTED_WARNING_CODES.has(warning?.code))
        .sort((left, right) => left.code.localeCompare(right.code));
}

function validateManifestWarnings(manifest, logicalFiles, errors) {
    const warningsValid = Array.isArray(manifest?.warnings)
        && isSortedUnique(manifest.warnings.map(warning => warning?.code))
        && manifest.warnings.every(warning => {
            if (!warning || !STABLE_WARNING_CODES.has(warning.code)) return false;
            if (warning.code === LEGACY_WARNING_CODES.SOURCE_READ_ERROR) {
                return isSortedUnique(warning.sourceErrorCodes)
                    && warning.sourceErrorCodes.every(code => STABLE_ERROR_CODES.has(code))
                    && Object.keys(warning).sort().join(',') === 'code,sourceErrorCodes';
            }
            if (warning.code === LEGACY_WARNING_CODES.SENSITIVE_FIELDS_REDACTED) {
                return isSortedUnique(warning.logicalFiles)
                    && warning.logicalFiles.every(filename => (
                        HASHED_LOGICAL_FILES.includes(filename)
                    ))
                    && Object.keys(warning).sort().join(',') === 'code,logicalFiles';
            }
            return Object.keys(warning).length === 1;
        });
    const protectedWarningsMatch = stableStringify(protectedManifestWarnings(manifest))
        === stableStringify(derivedProtectedWarnings(logicalFiles));
    const applicationWarningPresent = manifest?.warnings?.some(
        warning => warning.code === LEGACY_WARNING_CODES.APPLICATION_COMMIT_UNAVAILABLE
    );
    const applicationWarningMatches = manifest?.applicationCommit === null
        ? applicationWarningPresent
        : !applicationWarningPresent;

    if (!warningsValid || !protectedWarningsMatch || !applicationWarningMatches) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID,
            'Manifest warnings do not match the hashed logical evidence.'
        ));
    }
}

export async function verifyLegacyBundle(input, {
    crypto: cryptoProvider = globalThis.crypto
} = {}) {
    const errors = [];
    let bundle;

    try {
        bundle = parseBundleInput(input);
    } catch {
        return {
            valid: false,
            bundle: null,
            manifest: null,
            logicalFiles: null,
            provenance: null,
            warnings: [],
            errors: [issue(
                LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
                'The Legacy bundle is not valid JSON.'
            )]
        };
    }

    if (
        !bundle
        || bundle.format !== BUNDLE_FORMAT
        || !bundle.files
        || typeof bundle.files !== 'object'
        || Array.isArray(bundle.files)
    ) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            'The Legacy bundle envelope is invalid.'
        ));
    }

    const files = bundle?.files || {};
    const actualFilenames = Object.keys(files).sort();
    if (stableStringify(actualFilenames) !== stableStringify([...LEGACY_LOGICAL_FILES].sort())) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            'The Legacy bundle must contain exactly six logical files.'
        ));
    }

    const manifest = typeof files['manifest.json'] === 'string'
        ? parseLogicalJson(files, 'manifest.json', errors)
        : null;
    if (
        !manifest
        || manifest.formatVersion !== BUNDLE_FORMAT_VERSION
        || !Array.isArray(manifest.files)
        || typeof manifest.exportedAt !== 'string'
        || !Number.isInteger(manifest.activityCount)
        || manifest.activityCount < 0
        || !(
            manifest.applicationCommit === null
            || typeof manifest.applicationCommit === 'string'
        )
        || !(
            manifest.sourceDatabase === null
            || typeof manifest.sourceDatabase === 'string'
        )
        || !(
            manifest.sourceDatabaseVersion === null
            || Number.isInteger(manifest.sourceDatabaseVersion)
        )
        || !Array.isArray(manifest.warnings)
    ) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID,
            'The Legacy bundle manifest is invalid.'
        ));
    }

    if (manifest?.files) {
        const descriptorNames = manifest.files.map(file => file?.filename);
        if (stableStringify(descriptorNames) !== stableStringify(HASHED_LOGICAL_FILES)) {
            errors.push(issue(
                LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID,
                'The manifest logical filenames are not in the required order.'
            ));
        }
        for (const descriptor of manifest.files) {
            const contents = files[descriptor?.filename];
            if (
                typeof contents !== 'string'
                || descriptor.mediaType !== MEDIA_TYPE_JSON
                || descriptor.byteLength !== utf8Bytes(contents || '').byteLength
                || !/^[0-9a-f]{64}$/.test(descriptor.sha256 || '')
            ) {
                errors.push(issue(
                    LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID,
                    'A manifest file descriptor is invalid.',
                    { filename: descriptor?.filename ?? null }
                ));
                continue;
            }
            try {
                const actualDigest = await sha256Hex(contents, { crypto: cryptoProvider });
                if (actualDigest !== descriptor.sha256) {
                    errors.push(issue(
                        LEGACY_ERROR_CODES.BUNDLE_HASH_MISMATCH,
                        'A logical file SHA-256 digest does not match the manifest.',
                        { filename: descriptor.filename }
                    ));
                }
            } catch (error) {
                errors.push(issue(
                    LEGACY_ERROR_CODES.BUNDLE_HASH_MISMATCH,
                    'A logical file SHA-256 digest could not be verified.',
                    { filename: descriptor.filename, cause: error?.name || 'Error' }
                ));
            }
        }
    }

    const logicalFiles = {};
    for (const filename of HASHED_LOGICAL_FILES) {
        if (typeof files[filename] === 'string') {
            logicalFiles[filename] = parseLogicalJson(files, filename, errors);
        }
    }

    const activityPayload = logicalFiles['legacy-activities.json'];
    if (
        !activityPayload
        || !Array.isArray(activityPayload.activities)
        || containsSensitiveFields(activityPayload.activities)
    ) {
        errors.push(issue(
            LEGACY_ERROR_CODES.BUNDLE_FORMAT_INVALID,
            'The Legacy activities logical file is invalid.'
        ));
    } else if (manifest) {
        const range = activityRange(activityPayload.activities);
        if (
            activityPayload.activities.length !== manifest.activityCount
            || range.earliestActivity !== manifest.earliestActivity
            || range.latestActivity !== manifest.latestActivity
        ) {
            errors.push(issue(
                LEGACY_ERROR_CODES.BUNDLE_MANIFEST_INVALID,
                'The manifest activity summary does not match the activities logical file.'
            ));
        }
    }

    if (activityPayload) {
        validateProvenance(activityPayload.provenance, errors);
        validateRedaction('legacy-activities.json', activityPayload.redaction, errors);
    }
    validateMetadataEntries(
        'legacy-athlete.json',
        logicalFiles['legacy-athlete.json'],
        key => key === LEGACY_LOCAL_STORAGE_KEYS.athlete,
        errors
    );
    validateMetadataEntries(
        'legacy-gears.json',
        logicalFiles['legacy-gears.json'],
        key => key === LEGACY_LOCAL_STORAGE_KEYS.gears,
        errors
    );
    validateMetadataEntries(
        'legacy-zones.json',
        logicalFiles['legacy-zones.json'],
        key => key === LEGACY_LOCAL_STORAGE_KEYS.zones,
        errors
    );
    validateMetadataEntries(
        'legacy-settings.json',
        logicalFiles['legacy-settings.json'],
        key => LEGACY_SETTINGS_KEYS.includes(key)
            || key.startsWith(LEGACY_GEAR_CUSTOM_PREFIX),
        errors
    );
    if (manifest && Object.keys(logicalFiles).length === HASHED_LOGICAL_FILES.length) {
        validateManifestWarnings(manifest, logicalFiles, errors);
    }

    return {
        valid: errors.length === 0,
        bundle,
        manifest,
        logicalFiles,
        provenance: activityPayload?.provenance || null,
        warnings: Array.isArray(manifest?.warnings) ? manifest.warnings : [],
        errors
    };
}

export function storageEntryToString(entry) {
    if (entry.encoding === 'raw') return entry.value;
    return stableStringify(entry.value);
}
