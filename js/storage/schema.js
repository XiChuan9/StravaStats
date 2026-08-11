import {
    V2_CANONICAL_SCHEMA_VERSION,
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_SCHEMA_ID,
    V2_STORE_NAME
} from './constants.js';

function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && Object.hasOwn(descriptor, 'value')) {
            deepFreeze(descriptor.value);
        }
    }
    return Object.freeze(value);
}

const V1_STORES = [
        {
            name: V2_STORE_NAME.METADATA,
            keyPath: 'key',
            autoIncrement: false,
            indexes: []
        },
        {
            name: V2_STORE_NAME.MIGRATIONS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: []
        },
        {
            name: V2_STORE_NAME.ACTIVITIES,
            keyPath: 'activity.id',
            autoIncrement: false,
            indexes: [
                {
                    name: 'byStartTimeUtc',
                    keyPath: 'activity.startTimeUtc',
                    unique: false,
                    multiEntry: false
                },
                {
                    name: 'bySportCategoryAndStartTimeUtc',
                    keyPath: [
                        'activity.sportCategory',
                        'activity.startTimeUtc'
                    ],
                    unique: false,
                    multiEntry: false
                }
            ]
        },
        {
            name: V2_STORE_NAME.ACTIVITY_SOURCES,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [
                {
                    name: 'byActivityId',
                    keyPath: 'activityId',
                    unique: false,
                    multiEntry: false
                }
            ]
        },
        {
            name: V2_STORE_NAME.STREAM_SERIES,
            keyPath: ['activityId', 'streamType'],
            autoIncrement: false,
            indexes: [
                {
                    name: 'byActivityId',
                    keyPath: 'activityId',
                    unique: false,
                    multiEntry: false
                }
            ]
        },
        {
            name: V2_STORE_NAME.LAPS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [
                {
                    name: 'byActivityIdAndIndex',
                    keyPath: ['activityId', 'index'],
                    unique: true,
                    multiEntry: false
                }
            ]
        },
        {
            name: V2_STORE_NAME.EVENTS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [
                {
                    name: 'byActivityIdAndIndex',
                    keyPath: ['activityId', 'index'],
                    unique: true,
                    multiEntry: false
                }
            ]
        },
        {
            name: V2_STORE_NAME.DEVICES,
            keyPath: 'id',
            autoIncrement: false,
            indexes: []
        }
];

const V2_IMPORT_STORES = [
        {
            name: V2_STORE_NAME.RAW_ARTIFACTS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [{
                name: 'bySha256',
                keyPath: 'sha256',
                unique: false,
                multiEntry: false
            }]
        },
        {
            name: V2_STORE_NAME.IMPORT_JOBS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [{
                name: 'byCreatedAt',
                keyPath: 'createdAt',
                unique: false,
                multiEntry: false
            }]
        },
        {
            name: V2_STORE_NAME.IMPORT_ITEMS,
            keyPath: 'id',
            autoIncrement: false,
            indexes: [{
                name: 'byJobId',
                keyPath: 'jobId',
                unique: false,
                multiEntry: false
            }]
        }
];

const V2_STORES = [...V1_STORES, ...V2_IMPORT_STORES];
const V3_STORES = V2_STORES.map(store => (
    store.name === V2_STORE_NAME.ACTIVITY_SOURCES
        ? {
            ...store,
            indexes: [
                ...store.indexes,
                {
                    name: 'byProviderAndExternalId',
                    keyPath: ['provider', 'externalId'],
                    unique: false,
                    multiEntry: false
                }
            ]
        }
        : store
));

const V4_DUPLICATE_REVIEW_STORES = [
    {
        name: V2_STORE_NAME.MERGE_CANDIDATES,
        keyPath: 'id',
        autoIncrement: false,
        indexes: [
            {
                name: 'byActivityPair',
                keyPath: ['activityAId', 'activityBId'],
                unique: true,
                multiEntry: false
            },
            {
                name: 'byStatusAndCreatedAt',
                keyPath: ['status', 'createdAt'],
                unique: false,
                multiEntry: false
            }
        ]
    },
    {
        name: V2_STORE_NAME.MERGE_DECISIONS,
        keyPath: 'id',
        autoIncrement: false,
        indexes: [{
            name: 'byCandidateId',
            keyPath: 'candidateId',
            unique: false,
            multiEntry: false
        }]
    }
];

const V4_STORES = [...V3_STORES, ...V4_DUPLICATE_REVIEW_STORES];

const V5_SOURCE_CONNECTION_STORES = [{
    name: V2_STORE_NAME.SOURCE_CONNECTIONS,
    keyPath: 'id',
    autoIncrement: false,
    indexes: [{
        name: 'byProvider',
        keyPath: 'provider',
        unique: true,
        multiEntry: false
    }]
}];

const V5_STORES = [...V4_STORES, ...V5_SOURCE_CONNECTION_STORES];

const V6_SOURCE_OPERATION_STORES = [{
    name: V2_STORE_NAME.SOURCE_OPERATIONS,
    keyPath: 'id',
    autoIncrement: false,
    indexes: []
}];

const V6_STORES = [...V5_STORES, ...V6_SOURCE_OPERATION_STORES];

export const V2_PHYSICAL_SCHEMA_BY_VERSION = deepFreeze({
    1: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 1,
        schemaId: 'strava-stats-v2@1',
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V1_STORES
    },
    2: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 2,
        schemaId: 'strava-stats-v2@2',
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V2_STORES
    },
    3: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 3,
        schemaId: 'strava-stats-v2@3',
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V3_STORES
    },
    4: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 4,
        schemaId: 'strava-stats-v2@4',
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V4_STORES
    },
    5: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: 5,
        schemaId: 'strava-stats-v2@5',
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V5_STORES
    },
    6: {
        databaseName: V2_DATABASE_NAME,
        indexedDbVersion: V2_DATABASE_VERSION,
        schemaId: V2_SCHEMA_ID,
        canonicalSchemaVersion: V2_CANONICAL_SCHEMA_VERSION,
        stores: V6_STORES
    }
});

export const V2_SCHEMA = V2_PHYSICAL_SCHEMA_BY_VERSION[6];

function names(list) {
    return Array.from(list).sort();
}

function sameArray(left, right) {
    return (
        left.length === right.length
        && left.every((value, index) => value === right[index])
    );
}

function sameKeyPath(actual, expected) {
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && sameArray(actual, expected);
    }
    return actual === expected;
}

export function createPhysicalSchema(database) {
    for (const descriptor of V2_SCHEMA.stores) {
        const store = database.createObjectStore(descriptor.name, {
            keyPath: descriptor.keyPath,
            autoIncrement: descriptor.autoIncrement
        });
        for (const index of descriptor.indexes) {
            store.createIndex(index.name, index.keyPath, {
                unique: index.unique,
                multiEntry: index.multiEntry
            });
        }
    }
}

export function verifyPhysicalSchema(database) {
    const expectedStoreNames = V2_SCHEMA.stores
        .map(store => store.name)
        .sort();
    if (!sameArray(names(database.objectStoreNames), expectedStoreNames)) {
        return false;
    }

    let transaction;
    try {
        transaction = database.transaction(expectedStoreNames, 'readonly');
        for (const descriptor of V2_SCHEMA.stores) {
            const store = transaction.objectStore(descriptor.name);
            if (
                !sameKeyPath(store.keyPath, descriptor.keyPath)
                || store.autoIncrement !== descriptor.autoIncrement
            ) {
                return false;
            }

            const expectedIndexNames = descriptor.indexes
                .map(index => index.name)
                .sort();
            if (!sameArray(names(store.indexNames), expectedIndexNames)) {
                return false;
            }

            for (const descriptorIndex of descriptor.indexes) {
                const index = store.index(descriptorIndex.name);
                if (
                    !sameKeyPath(index.keyPath, descriptorIndex.keyPath)
                    || index.unique !== descriptorIndex.unique
                    || index.multiEntry !== descriptorIndex.multiEntry
                ) {
                    return false;
                }
            }
        }
        return true;
    } catch {
        return false;
    }
}
