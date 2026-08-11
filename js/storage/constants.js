export const V2_DATABASE_NAME = 'strava-stats-v2';
export const V2_DATABASE_VERSION = 6;
export const V2_SCHEMA_ID = 'strava-stats-v2@6';
export const V2_CANONICAL_SCHEMA_VERSION = 1;

export const V2_METADATA_KEY = 'database';
export const V2_BOOTSTRAP_MIGRATION_ID = 'schema-0001-bootstrap';
export const V2_IMPORT_MIGRATION_ID = 'schema-0002-import-core';
export const V2_EXACT_IDENTITY_MIGRATION_ID =
    'schema-0003-exact-identity-index';
export const V2_DUPLICATE_REVIEW_MIGRATION_ID =
    'schema-0004-duplicate-review';
export const V2_SOURCE_CONNECTION_MIGRATION_ID =
    'schema-0005-source-connection';
export const V2_SOURCE_OPERATION_MIGRATION_ID =
    'schema-0006-source-operation-lease';

export const V2_STORE_NAME = Object.freeze({
    METADATA: 'metadata',
    MIGRATIONS: 'migrations',
    ACTIVITIES: 'activities',
    ACTIVITY_SOURCES: 'activitySources',
    STREAM_SERIES: 'streamSeries',
    LAPS: 'laps',
    EVENTS: 'events',
    DEVICES: 'devices',
    RAW_ARTIFACTS: 'rawArtifacts',
    IMPORT_JOBS: 'importJobs',
    IMPORT_ITEMS: 'importItems',
    MERGE_CANDIDATES: 'mergeCandidates',
    MERGE_DECISIONS: 'mergeDecisions',
    SOURCE_CONNECTIONS: 'sourceConnections',
    SOURCE_OPERATIONS: 'sourceOperations'
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
    NOT_FOUND: 'NOT_FOUND',
    CANDIDATE_LIMIT_EXCEEDED: 'CANDIDATE_LIMIT_EXCEEDED'
});

export const STORAGE_OPERATION = Object.freeze({
    CREATE_CANONICAL_STORE: 'createCanonicalStore',
    INITIALIZE: 'initialize',
    PUT_BUNDLE: 'putBundle',
    GET_BUNDLE: 'getBundle',
    LIST_ACTIVITIES: 'listActivities',
    CREATE_BACKUP_MANIFEST: 'createBackupManifest',
    CREATE_IMPORT_STORE: 'createImportStore',
    CREATE_SOURCE_CONNECTION_STORE: 'createSourceConnectionStore',
    CREATE_SOURCE_OPERATION_STORE: 'createSourceOperationStore',
    GET_CONNECTION: 'getConnection',
    CREATE_CONNECTION: 'createConnection',
    TRANSITION_CONNECTION: 'transitionConnection',
    GET_SOURCE_OPERATION: 'getSourceOperation',
    CLAIM_SOURCE_OPERATION: 'claimSourceOperation',
    HEARTBEAT_SOURCE_OPERATION: 'heartbeatSourceOperation',
    LINK_SOURCE_OPERATION_JOB: 'linkSourceOperationJob',
    COMPLETE_SOURCE_OPERATION: 'completeSourceOperation',
    RECOVER_SOURCE_OPERATION: 'recoverSourceOperation',
    ABANDON_SOURCE_OPERATION: 'abandonSourceOperation',
    LIST_ORPHAN_IMPORT_JOBS: 'listOrphanImportJobs',
    CREATE_IMPORT_JOB: 'createImportJob',
    TRANSITION_IMPORT_JOB: 'transitionImportJob',
    TRANSITION_IMPORT_ITEM: 'transitionImportItem',
    CANCEL_IMPORT_JOB: 'cancelImportJob',
    STORE_RAW_ARTIFACT: 'storeRawArtifact',
    PERSIST_IMPORT_ITEM: 'persistImportItem',
    GET_IMPORT_JOB: 'getImportJob',
    GET_IMPORT_ITEM: 'getImportItem',
    GET_RAW_ARTIFACT: 'getRawArtifact',
    LIST_IMPORT_ITEMS: 'listImportItems',
    LIST_IMPORT_JOBS: 'listImportJobs',
    LIST_DUPLICATE_REVIEW_CANDIDATES: 'listDuplicateReviewCandidates',
    GET_DUPLICATE_REVIEW_CANDIDATE: 'getDuplicateReviewCandidate',
    DECIDE_DUPLICATE_REVIEW_CANDIDATE: 'decideDuplicateReviewCandidate',
    CLOSE: 'close'
});
