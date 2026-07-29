export {
    LEGACY_ACTIVITY_KEY,
    LEGACY_DB_NAME,
    LEGACY_DB_VERSION,
    LEGACY_ERROR_CODES,
    LEGACY_GEAR_CUSTOM_PREFIX,
    LEGACY_LOCAL_STORAGE_KEYS,
    LEGACY_LOGICAL_FILES,
    LEGACY_SETTINGS_KEYS,
    LEGACY_STORE_NAME,
    LEGACY_WARNING_CODES
} from './constants.js';

export {
    discoverLegacyCache,
    readLegacyDemoSource,
    readLegacyIndexedDb,
    readLegacyLocalStorage
} from './reader.js';

export {
    buildLegacyBundle,
    sha256Hex,
    stableStringify,
    verifyLegacyBundle
} from './bundle.js';

export {
    applyLegacyRestorePlan,
    createLegacyRestorePlan,
    parseAndVerifyLegacyBundle,
    restoreLegacyBundle
} from './restore.js';
