export const DEFAULT_FEATURE_FLAGS = Object.freeze({
    dataRepositoryMode: 'canonical',
    localImportEnabled: false,
    canonicalShadowWriteEnabled: false,
});

const repositoryModes = new Set(['legacy', 'shadow', 'canonical']);
const FEATURE_FLAG_KEYS = Object.freeze([
    'dataRepositoryMode',
    'localImportEnabled',
    'canonicalShadowWriteEnabled'
]);

function inspectOverrides(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.some(key => typeof key !== 'string' || !FEATURE_FLAG_KEYS.includes(key))
        ) return null;
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

export function resolveFeatureFlags(overrides = {}) {
    const values = inspectOverrides(overrides);
    if (values === null) return DEFAULT_FEATURE_FLAGS;
    const dataRepositoryMode = repositoryModes.has(values.dataRepositoryMode)
        ? values.dataRepositoryMode
        : DEFAULT_FEATURE_FLAGS.dataRepositoryMode;

    return Object.freeze({
        dataRepositoryMode,
        localImportEnabled: values.localImportEnabled === true,
        canonicalShadowWriteEnabled:
            dataRepositoryMode === 'shadow'
            && values.canonicalShadowWriteEnabled === true,
    });
}

export function getFeatureFlags(runtimeOverrides) {
    if (arguments.length > 0) return resolveFeatureFlags(runtimeOverrides ?? {});
    try {
        const descriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            '__STRAVASTATS_FEATURE_FLAGS__'
        );
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
            return DEFAULT_FEATURE_FLAGS;
        }
        return resolveFeatureFlags(descriptor.value ?? {});
    } catch {
        return DEFAULT_FEATURE_FLAGS;
    }
}
