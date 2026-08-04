export const V2_DATABASE_NAME = 'strava-stats-v2';
export const V2_DATABASE_VERSION = 1;
export const V2_SCHEMA_ID = 'strava-stats-v2@1';
export const V2_CANONICAL_SCHEMA_VERSION = 1;

export const V2_METADATA_KEY = 'database';
export const V2_BOOTSTRAP_MIGRATION_ID = 'schema-0001-bootstrap';

export const V2_STORE_NAME = Object.freeze({
    METADATA: 'metadata',
    MIGRATIONS: 'migrations',
    ACTIVITIES: 'activities',
    ACTIVITY_SOURCES: 'activitySources',
    STREAM_SERIES: 'streamSeries',
    LAPS: 'laps',
    EVENTS: 'events',
    DEVICES: 'devices'
});

export const STORAGE_ERROR_CODE = Object.freeze({
    UNAVAILABLE: 'UNAVAILABLE',
    INVALID_REQUEST: 'INVALID_REQUEST',
    DATA_INVALID: 'DATA_INVALID',
    OPEN_FAILED: 'OPEN_FAILED',
    OPEN_BLOCKED: 'OPEN_BLOCKED',
    CONNECTION_STALE: 'CONNECTION_STALE',
    VERSION_UNSUPPORTED: 'VERSION_UNSUPPORTED',
    SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
    MIGRATION_FAILED: 'MIGRATION_FAILED',
    MIGRATION_INTERRUPTED: 'MIGRATION_INTERRUPTED',
    TRANSACTION_ABORTED: 'TRANSACTION_ABORTED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
    CONFLICT: 'CONFLICT',
    NOT_FOUND: 'NOT_FOUND'
});

export const STORAGE_OPERATION = Object.freeze({
    CREATE_CANONICAL_STORE: 'createCanonicalStore',
    INITIALIZE: 'initialize',
    PUT_BUNDLE: 'putBundle',
    GET_BUNDLE: 'getBundle',
    LIST_ACTIVITIES: 'listActivities',
    CREATE_BACKUP_MANIFEST: 'createBackupManifest',
    CLOSE: 'close'
});
