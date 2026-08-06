import { validateCanonicalActivity } from '../data/contracts/index.js';
import {
    STORAGE_ERROR_CODE,
    STORAGE_OPERATION,
    V2_CANONICAL_SCHEMA_VERSION,
    V2_STORE_NAME
} from './constants.js';
import { storageError } from './errors.js';

const INPUT_FIELDS = Object.freeze([
    'incomingActivityId',
    'incomingSources',
    'sourceIdMatches',
    'externalIdMatches',
    'rawArtifactActivityId',
    'fitActivityId',
    'fitSources'
]);
const SOURCE_FIELDS = Object.freeze([
    'id',
    'activityId',
    'provider',
    'externalId',
    'rawArtifactId',
    'acquisitionMethod',
    'deviceId',
    'importedAt'
]);
const REQUIRED_SOURCE_FIELDS = Object.freeze([
    'id',
    'activityId',
    'provider',
    'acquisitionMethod',
    'importedAt'
]);
const DEVICE_FIELDS = Object.freeze(['id', 'manufacturer', 'model']);
const ENVELOPE_FIELDS = Object.freeze([
    'schemaVersion',
    'activity',
    'warnings',
    'versionMetadata',
    'deviceIds'
]);
const RESULT_UNMATCHED = Object.freeze({
    status: 'unmatched',
    activityId: null
});
const RESULT_INVALID = Object.freeze({
    status: 'invalid',
    activityId: null
});
const RESULT_CONFLICT = Object.freeze({
    status: 'conflict',
    activityId: null
});

function sameArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function ownDataValues(value, allowedFields, requiredFields = allowedFields) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => !allowedFields.includes(key))
            || requiredFields.some(field => !keys.includes(field))
        ) return null;
        const values = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            values[key] = descriptor.value;
        }
        return values;
    } catch {
        return null;
    }
}

function denseArray(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string')
            || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))
            || keys.length !== value.length + 1
        ) return null;
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

function opaqueString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function strictUtc(value) {
    if (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    ) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function sourceValues(value) {
    const values = ownDataValues(
        value,
        SOURCE_FIELDS,
        REQUIRED_SOURCE_FIELDS
    );
    if (!values) return null;
    for (const field of ['id', 'activityId', 'provider', 'acquisitionMethod']) {
        if (!opaqueString(values[field])) return null;
    }
    for (const field of ['externalId', 'rawArtifactId', 'deviceId']) {
        if (
            Object.hasOwn(values, field)
            && values[field] !== null
            && !opaqueString(values[field])
        ) return null;
    }
    if (!strictUtc(values.importedAt)) return null;
    return values;
}

function safeIntegerIdentityPart(value) {
    if (value === 'x') return true;
    if (!/^(0|[1-9]\d*)$/.test(value)) return false;
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 && String(numeric) === value;
}

function trustedFitIdentity(value) {
    if (!opaqueString(value) || !value.startsWith('fit-session:')) return false;
    const parts = value.slice('fit-session:'.length).split(':');
    return parts.length === 5 && parts.every(safeIntegerIdentityPart);
}

function exactResult(activityId) {
    return Object.freeze({ status: 'exact-match', activityId });
}

export function resolveExactIdentityCandidates(input) {
    const values = ownDataValues(input, INPUT_FIELDS);
    if (!values || !opaqueString(values.incomingActivityId)) {
        return RESULT_INVALID;
    }
    const incomingSources = denseArray(values.incomingSources);
    const sourceIdMatches = denseArray(values.sourceIdMatches);
    const externalIdMatches = denseArray(values.externalIdMatches);
    const fitSources = denseArray(values.fitSources);
    if (
        !incomingSources
        || incomingSources.length === 0
        || !sourceIdMatches
        || !externalIdMatches
        || !fitSources
        || sourceIdMatches.length !== incomingSources.length
        || externalIdMatches.length !== incomingSources.length
        || (
            values.rawArtifactActivityId !== null
            && !opaqueString(values.rawArtifactActivityId)
        )
        || (
            values.fitActivityId !== null
            && !opaqueString(values.fitActivityId)
        )
    ) return RESULT_INVALID;

    const candidates = new Set();
    if (values.rawArtifactActivityId !== null) {
        candidates.add(values.rawArtifactActivityId);
    }
    for (let index = 0; index < incomingSources.length; index += 1) {
        const incoming = sourceValues(incomingSources[index]);
        if (!incoming || incoming.activityId !== values.incomingActivityId) {
            return RESULT_INVALID;
        }

        const primaryMatch = sourceIdMatches[index];
        if (primaryMatch !== null) {
            const stored = sourceValues(primaryMatch);
            if (!stored || stored.id !== incoming.id) return RESULT_INVALID;
            candidates.add(stored.activityId);
        }

        const indexedMatches = denseArray(externalIdMatches[index]);
        if (!indexedMatches) return RESULT_INVALID;
        const externalId = Object.hasOwn(incoming, 'externalId')
            ? incoming.externalId
            : undefined;
        if (typeof externalId !== 'string' && indexedMatches.length !== 0) {
            return RESULT_INVALID;
        }
        for (const match of indexedMatches) {
            const stored = sourceValues(match);
            if (
                !stored
                || typeof externalId !== 'string'
                || stored.provider !== incoming.provider
                || stored.externalId !== externalId
            ) return RESULT_INVALID;
            candidates.add(stored.activityId);
        }
    }

    if (values.fitActivityId !== null) {
        const fitIsTrusted = (
            values.fitActivityId === values.incomingActivityId
            && trustedFitIdentity(values.incomingActivityId)
            && incomingSources.some(source => {
                const candidate = sourceValues(source);
                return candidate?.provider === 'fit';
            })
        );
        if (fitIsTrusted) {
            let storedFit = false;
            for (const source of fitSources) {
                const stored = sourceValues(source);
                if (!stored) return RESULT_INVALID;
                if (
                    stored.activityId === values.fitActivityId
                    && stored.provider === 'fit'
                ) storedFit = true;
            }
            if (storedFit) candidates.add(values.fitActivityId);
        }
    } else if (fitSources.length !== 0) {
        return RESULT_INVALID;
    }

    if (candidates.size === 0) return RESULT_UNMATCHED;
    if (candidates.size > 1) return RESULT_CONFLICT;
    return exactResult(candidates.values().next().value);
}

function invalidStored() {
    return storageError(
        STORAGE_ERROR_CODE.SCHEMA_MISMATCH,
        STORAGE_OPERATION.PERSIST_IMPORT_ITEM
    );
}

function identityConflict() {
    return storageError(
        STORAGE_ERROR_CODE.CONFLICT,
        STORAGE_OPERATION.PERSIST_IMPORT_ITEM
    );
}

export function enqueueExactIdentityLookup(
    context,
    prepared,
    rawArtifactActivityId
) {
    const incomingActivityId = prepared.records.activityId;
    const incomingSources = prepared.records.sources;
    const sourceIdTokens = incomingSources.map(source => (
        context.get(V2_STORE_NAME.ACTIVITY_SOURCES, source.id)
    ));
    const externalIdTokens = incomingSources.map(source => (
        typeof source.externalId === 'string'
            ? context.getAll(
                V2_STORE_NAME.ACTIVITY_SOURCES,
                'byProviderAndExternalId',
                [source.provider, source.externalId]
            )
            : null
    ));
    const fitCandidate = (
        trustedFitIdentity(incomingActivityId)
        && incomingSources.some(source => source.provider === 'fit')
    );
    const fitActivityToken = fitCandidate
        ? context.get(V2_STORE_NAME.ACTIVITIES, incomingActivityId)
        : null;
    const fitSourcesToken = fitCandidate
        ? context.getAll(
            V2_STORE_NAME.ACTIVITY_SOURCES,
            'byActivityId',
            incomingActivityId
        )
        : null;

    return () => {
        const decision = resolveExactIdentityCandidates({
            incomingActivityId,
            incomingSources,
            sourceIdMatches: sourceIdTokens.map(token => token.read() ?? null),
            externalIdMatches: externalIdTokens.map(token => (
                token ? token.read() : []
            )),
            rawArtifactActivityId,
            fitActivityId: fitActivityToken?.read() === undefined
                ? null
                : incomingActivityId,
            fitSources: fitSourcesToken ? fitSourcesToken.read() : []
        });
        if (decision.status === 'invalid') throw invalidStored();
        if (decision.status === 'conflict') throw identityConflict();
        return decision;
    };
}

export function enqueueExactIdentityTargetValidation(context, activityId) {
    if (!opaqueString(activityId)) throw identityConflict();
    const activityToken = context.get(V2_STORE_NAME.ACTIVITIES, activityId);
    return () => {
        if (!envelopeValues(activityToken.read(), activityId)) {
            throw invalidStored();
        }
        return Object.freeze({ status: 'exact-match', activityId });
    };
}

function allOwnDataValues(value) {
    try {
        return ownDataValues(value, Reflect.ownKeys(value));
    } catch {
        return null;
    }
}

function strictEqual(left, right) {
    if (Object.is(left, right)) return true;
    if (
        left === null
        || right === null
        || typeof left !== 'object'
        || typeof right !== 'object'
        || Array.isArray(left) !== Array.isArray(right)
    ) return false;
    if (Array.isArray(left)) {
        const leftValues = denseArray(left);
        const rightValues = denseArray(right);
        return leftValues !== null
            && rightValues !== null
            && leftValues.length === rightValues.length
            && leftValues.every((value, index) => (
                strictEqual(value, rightValues[index])
            ));
    }
    const leftValues = allOwnDataValues(left);
    const rightValues = allOwnDataValues(right);
    if (!leftValues || !rightValues) return false;
    const leftKeys = Object.keys(leftValues).sort();
    const rightKeys = Object.keys(rightValues).sort();
    return sameArray(leftKeys, rightKeys) && leftKeys.every(key => (
        strictEqual(leftValues[key], rightValues[key])
    ));
}

function deviceValues(value) {
    const values = ownDataValues(value, DEVICE_FIELDS, ['id']);
    if (!values || !opaqueString(values.id)) return null;
    for (const field of ['manufacturer', 'model']) {
        if (
            Object.hasOwn(values, field)
            && values[field] !== null
            && typeof values[field] !== 'string'
        ) return null;
    }
    return values;
}

function envelopeValues(value, activityId) {
    const values = ownDataValues(value, ENVELOPE_FIELDS);
    if (!values) return null;
    const activity = allOwnDataValues(values.activity);
    const versionMetadata = allOwnDataValues(values.versionMetadata);
    const warnings = denseArray(values.warnings);
    const deviceIds = denseArray(values.deviceIds);
    let activityIsValid = false;
    try {
        activityIsValid = validateCanonicalActivity(values.activity).ok === true;
    } catch {
        return null;
    }
    if (
        values.schemaVersion !== V2_CANONICAL_SCHEMA_VERSION
        || !activity
        || activity.id !== activityId
        || activity.schemaVersion !== values.schemaVersion
        || !activityIsValid
        || !versionMetadata
        || versionMetadata.schemaVersion !== values.schemaVersion
        || !warnings
        || !deviceIds
        || deviceIds.some(id => !opaqueString(id))
        || new Set(deviceIds).size !== deviceIds.length
        || !sameArray(deviceIds, deviceIds.slice().sort(compareStrings))
    ) return null;
    return { values, deviceIds };
}

function compareStrings(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

export function enqueueExactIdentityLink(
    context,
    prepared,
    artifact,
    activityId
) {
    if (!opaqueString(artifact?.id) || !opaqueString(activityId)) {
        throw identityConflict();
    }
    const sources = prepared.records.sources;
    if (sources.some(source => source.rawArtifactId !== artifact.id)) {
        throw identityConflict();
    }
    const activityToken = context.get(V2_STORE_NAME.ACTIVITIES, activityId);
    const originalSourceTokens = sources.map(source => (
        context.get(V2_STORE_NAME.ACTIVITY_SOURCES, source.id)
    ));
    const generatedSourceIds = sources.map((_, index) => (
        `exact-source:${artifact.id}:${index}`
    ));
    const generatedSourceTokens = generatedSourceIds.map(id => (
        context.get(V2_STORE_NAME.ACTIVITY_SOURCES, id)
    ));
    const referencedDeviceIds = [...new Set(sources
        .map(source => source.deviceId)
        .filter(id => typeof id === 'string'))];
    const deviceById = new Map(
        prepared.records.devices.map(device => [device.id, device])
    );
    const deviceTokens = referencedDeviceIds.map(id => (
        context.get(V2_STORE_NAME.DEVICES, id)
    ));

    return () => {
        const envelope = envelopeValues(activityToken.read(), activityId);
        if (!envelope) throw invalidStored();
        const acceptedSourceIds = new Set();
        const acceptedDeviceIds = new Set();
        const sourcesToAdd = [];

        sources.forEach((source, index) => {
            const rewritten = { ...source, activityId };
            const existing = originalSourceTokens[index].read();
            let accepted;
            if (existing === undefined) {
                accepted = rewritten;
                sourcesToAdd.push(rewritten);
            } else {
                if (!sourceValues(existing)) throw invalidStored();
                if (strictEqual(existing, rewritten)) {
                    accepted = rewritten;
                } else {
                    if (existing.activityId !== activityId) {
                        throw identityConflict();
                    }
                    const generated = {
                        ...rewritten,
                        id: generatedSourceIds[index]
                    };
                    const generatedExisting = generatedSourceTokens[index].read();
                    if (generatedExisting === undefined) {
                        accepted = generated;
                        sourcesToAdd.push(generated);
                    } else {
                        if (!sourceValues(generatedExisting)) throw invalidStored();
                        if (!strictEqual(generatedExisting, generated)) {
                            throw identityConflict();
                        }
                        accepted = generated;
                    }
                }
            }

            if (acceptedSourceIds.has(accepted.id)) throw identityConflict();
            acceptedSourceIds.add(accepted.id);
            if (typeof accepted.deviceId === 'string') {
                acceptedDeviceIds.add(accepted.deviceId);
            }
        });

        for (const source of sourcesToAdd) {
            context.add(V2_STORE_NAME.ACTIVITY_SOURCES, source);
        }

        referencedDeviceIds.forEach((id, index) => {
            if (!acceptedDeviceIds.has(id)) return;
            const candidate = deviceById.get(id);
            if (!candidate || !deviceValues(candidate)) throw invalidStored();
            const existing = deviceTokens[index].read();
            if (existing === undefined) {
                context.add(V2_STORE_NAME.DEVICES, candidate);
            } else if (!deviceValues(existing)) {
                throw invalidStored();
            } else if (!strictEqual(existing, candidate)) {
                throw identityConflict();
            }
        });

        const combinedDeviceIds = [...new Set([
            ...envelope.deviceIds,
            ...acceptedDeviceIds
        ])].sort(compareStrings);
        if (!sameArray(combinedDeviceIds, envelope.deviceIds)) {
            context.put(V2_STORE_NAME.ACTIVITIES, {
                ...envelope.values,
                deviceIds: combinedDeviceIds
            });
        }
        return Object.freeze({ status: 'exact-match', activityId });
    };
}
