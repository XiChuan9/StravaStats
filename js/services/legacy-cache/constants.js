export const LEGACY_DB_NAME = 'strava-dashboard-cache';
export const LEGACY_DB_VERSION = 1;
export const LEGACY_STORE_NAME = 'entries';
export const LEGACY_ACTIVITY_KEY = 'strava_activities';

export const LEGACY_LOCAL_STORAGE_KEYS = Object.freeze({
    activities: LEGACY_ACTIVITY_KEY,
    activitiesTimestamp: 'strava_activities_timestamp',
    cacheVersion: 'strava_cache_version',
    athlete: 'strava_athlete_data',
    zones: 'strava_training_zones',
    gears: 'strava_gears',
    demoMode: 'strava_demo_mode',
    demoActivities: 'strava_demo_activities'
});

export const LEGACY_SETTINGS_KEYS = Object.freeze([
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

export const LEGACY_GEAR_CUSTOM_PREFIX = 'gear-custom-';

export const LEGACY_LOGICAL_FILES = Object.freeze([
    'legacy-activities.json',
    'legacy-athlete.json',
    'legacy-gears.json',
    'legacy-settings.json',
    'legacy-zones.json',
    'manifest.json'
]);

export const LEGACY_WARNING_CODES = Object.freeze({
    APPLICATION_COMMIT_UNAVAILABLE: 'APPLICATION_COMMIT_UNAVAILABLE',
    CACHE_STALE: 'CACHE_STALE',
    CACHE_VERSION_MISMATCH: 'CACHE_VERSION_MISMATCH',
    DEMO_DATA_PRESENT: 'DEMO_DATA_PRESENT',
    LOCAL_STORAGE_FALLBACK_SELECTED: 'LOCAL_STORAGE_FALLBACK_SELECTED',
    PROVENANCE_UNCERTAIN: 'PROVENANCE_UNCERTAIN',
    SENSITIVE_FIELDS_REDACTED: 'SENSITIVE_FIELDS_REDACTED',
    SOURCE_READ_ERROR: 'SOURCE_READ_ERROR'
});

export const LEGACY_ERROR_CODES = Object.freeze({
    ACTIVITIES_INVALID: 'ACTIVITIES_INVALID',
    BUNDLE_FORMAT_INVALID: 'BUNDLE_FORMAT_INVALID',
    BUNDLE_HASH_MISMATCH: 'BUNDLE_HASH_MISMATCH',
    BUNDLE_MANIFEST_INVALID: 'BUNDLE_MANIFEST_INVALID',
    INDEXEDDB_BLOCKED: 'INDEXEDDB_BLOCKED',
    INDEXEDDB_NOT_AVAILABLE: 'INDEXEDDB_NOT_AVAILABLE',
    INDEXEDDB_NOT_FOUND: 'INDEXEDDB_NOT_FOUND',
    INDEXEDDB_OPEN_ERROR: 'INDEXEDDB_OPEN_ERROR',
    INDEXEDDB_READ_ERROR: 'INDEXEDDB_READ_ERROR',
    INDEXEDDB_STORE_NOT_FOUND: 'INDEXEDDB_STORE_NOT_FOUND',
    INDEXEDDB_TIMEOUT: 'INDEXEDDB_TIMEOUT',
    INDEXEDDB_VERSIONCHANGE: 'INDEXEDDB_VERSIONCHANGE',
    LOCAL_STORAGE_ACCESS_ERROR: 'LOCAL_STORAGE_ACCESS_ERROR',
    LOCAL_STORAGE_MALFORMED_JSON: 'LOCAL_STORAGE_MALFORMED_JSON',
    RESCUE_SOURCE_NOT_EXPORTABLE: 'RESCUE_SOURCE_NOT_EXPORTABLE',
    RESTORE_CONFLICT: 'RESTORE_CONFLICT',
    RESTORE_PLAN_INVALID: 'RESTORE_PLAN_INVALID',
    RESTORE_PROVENANCE_CONFIRMATION_REQUIRED: 'RESTORE_PROVENANCE_CONFIRMATION_REQUIRED',
    RESTORE_ROLLBACK_FAILED: 'RESTORE_ROLLBACK_FAILED',
    RESTORE_UNSUPPORTED_TARGET_VERSION: 'RESTORE_UNSUPPORTED_TARGET_VERSION',
    RESTORE_WRITE_FAILED: 'RESTORE_WRITE_FAILED'
});
