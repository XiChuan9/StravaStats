import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDBDatabase,
    IDBFactory,
    IDBKeyRange
} from 'fake-indexeddb';

import {
    STORAGE_ERROR_CODE,
    createCanonicalStore
} from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-06T00:00:00.000Z');
const SHARED_TIME = '2026-08-05T08:00:00.000Z';

function options(indexedDB) {
    return {
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'canonical-pagination-test@1'
    };
}

function activity(id, {
    startTimeUtc = SHARED_TIME,
    sportCategory = 'run',
    distanceMeters
} = {}) {
    const value = {
        schemaVersion: 1,
        id,
        sportCategory,
        sportVariant: null,
        startTimeUtc,
        timeZone: {
            ianaName: 'Etc/UTC',
            utcOffsetMinutes: 0
        },
        capabilities: {
            hasGps: false,
            hasHeartRate: false,
            hasPower: false,
            hasCadence: false,
            hasLaps: false
        },
        name: null,
        movingTimeSeconds: 0,
        averagePowerWatts: null
    };
    if (distanceMeters !== undefined) value.distanceMeters = distanceMeters;
    return value;
}

function bundle(canonicalActivity) {
    const id = canonicalActivity.id;
    return {
        schemaVersion: 1,
        activity: canonicalActivity,
        streams: { activityId: id, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: `synthetic-source:${id}`,
            activityId: id,
            provider: 'synthetic',
            externalId: null,
            rawArtifactId: null,
            acquisitionMethod: 'synthetic-test',
            deviceId: null,
            importedAt: canonicalActivity.startTimeUtc
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'synthetic-parser@1',
            normalizerVersion: 'synthetic-normalizer@1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
}

function compareTuple(left, right) {
    if (left.startTimeUtc !== right.startTimeUtc) {
        return left.startTimeUtc < right.startTimeUtc ? -1 : 1;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
}

async function seed(storage, activities) {
    for (const value of activities) {
        await storage.putBundle(bundle(value));
    }
}

async function readAll(storage, {
    direction,
    sportCategory
}) {
    const values = [];
    let cursor;
    while (true) {
        const listOptions = {
            direction,
            limit: 500
        };
        if (sportCategory !== undefined) {
            listOptions.sportCategory = sportCategory;
        }
        if (cursor !== undefined) listOptions.cursor = cursor;
        const page = await storage.listActivities(listOptions);
        values.push(...page);
        if (page.length < 500) return values;
        const last = page.at(-1);
        cursor = Object.freeze({
            startTimeUtc: last.startTimeUtc,
            id: last.id
        });
    }
}

test('keyset traversal returns 503 same-time opaque IDs without gaps or duplicates', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();

    const specialIds = ['10', '2', '0002', 'alpha/beta ?#%'];
    const activities = Array.from({ length: 503 }, (_, index) => activity(
        specialIds[index] ?? `opaque-${String(index).padStart(4, '0')}`,
        {
            sportCategory: index % 2 === 0 ? 'run' : 'ride',
            distanceMeters: index === 4 ? 0 : undefined
        }
    ));
    await seed(storage, activities);

    const ascending = await readAll(storage, { direction: 'asc' });
    const descending = await readAll(storage, { direction: 'desc' });
    const expected = activities.slice().sort(compareTuple);

    assert.deepEqual(
        ascending.map(value => value.id),
        expected.map(value => value.id)
    );
    assert.deepEqual(
        descending.map(value => value.id),
        expected.slice().reverse().map(value => value.id)
    );
    assert.equal(new Set(ascending.map(value => value.id)).size, 503);
    assert.equal(new Set(descending.map(value => value.id)).size, 503);
    assert.equal(Object.hasOwn(ascending[0], 'distanceMeters'), false);
    assert.equal(
        ascending.some(value => Object.is(value.distanceMeters, 0)),
        true
    );
    assert.equal(
        ascending.every(value => value.name === null),
        true
    );

    const runValues = await readAll(storage, {
        direction: 'desc',
        sportCategory: 'run'
    });
    const expectedRuns = expected
        .filter(value => value.sportCategory === 'run')
        .reverse();
    assert.deepEqual(
        runValues.map(value => value.id),
        expectedRuns.map(value => value.id)
    );

    const first = await storage.listActivities({
        direction: 'asc',
        limit: 1
    });
    const nullPrototypeCursor = Object.create(null);
    Object.defineProperties(nullPrototypeCursor, {
        startTimeUtc: {
            value: first[0].startTimeUtc,
            enumerable: true
        },
        id: {
            value: first[0].id,
            enumerable: true
        }
    });
    const second = await storage.listActivities({
        direction: 'asc',
        limit: 1,
        cursor: nullPrototypeCursor
    });
    assert.equal(second[0].id, ascending[1].id);
    await storage.close();
});

test('hostile and malformed cursors fail before transaction I/O', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    const originalTransaction = IDBDatabase.prototype.transaction;
    let transactionCalls = 0;
    let getterCalls = 0;
    IDBDatabase.prototype.transaction = function (...args) {
        transactionCalls += 1;
        return originalTransaction.apply(this, args);
    };

    const accessor = { id: 'opaque-accessor' };
    Object.defineProperty(accessor, 'startTimeUtc', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return SHARED_TIME;
        }
    });
    const symbol = { startTimeUtc: SHARED_TIME, id: 'opaque-symbol' };
    symbol[Symbol('private')] = true;
    const customPrototype = Object.create({ inherited: true });
    customPrototype.startTimeUtc = SHARED_TIME;
    customPrototype.id = 'opaque-custom';
    const proxy = new Proxy({}, {
        ownKeys() {
            throw new Error('synthetic reflection failure');
        }
    });

    try {
        for (const cursor of [
            null,
            {},
            { startTimeUtc: SHARED_TIME },
            { startTimeUtc: '2026-02-30T00:00:00.000Z', id: 'opaque-date' },
            { startTimeUtc: SHARED_TIME, id: '' },
            { startTimeUtc: SHARED_TIME, id: 'opaque-extra', extra: true },
            accessor,
            symbol,
            customPrototype,
            proxy
        ]) {
            await assert.rejects(
                storage.listActivities({ cursor }),
                error => error.code === STORAGE_ERROR_CODE.INVALID_REQUEST
            );
        }
    } finally {
        IDBDatabase.prototype.transaction = originalTransaction;
    }
    assert.equal(transactionCalls, 0);
    assert.equal(getterCalls, 0);
    await storage.close();
});

test('read-committed traversal admits unread inserts and defers passed inserts', async () => {
    const indexedDB = new IDBFactory();
    const storage = createCanonicalStore(options(indexedDB));
    await storage.initialize();
    await seed(storage, [
        activity('opaque-03', { startTimeUtc: '2026-08-05T03:00:00.000Z' }),
        activity('opaque-02', { startTimeUtc: '2026-08-05T02:00:00.000Z' }),
        activity('opaque-01', { startTimeUtc: '2026-08-05T01:00:00.000Z' })
    ]);

    const firstPage = await storage.listActivities({
        direction: 'desc',
        limit: 1
    });
    assert.equal(firstPage[0].id, 'opaque-03');
    await seed(storage, [
        activity('opaque-unread', {
            startTimeUtc: '2026-08-05T02:30:00.000Z'
        }),
        activity('opaque-passed', {
            startTimeUtc: '2026-08-05T04:00:00.000Z'
        })
    ]);

    const cursor = {
        startTimeUtc: firstPage[0].startTimeUtc,
        id: firstPage[0].id
    };
    const remainder = await storage.listActivities({
        direction: 'desc',
        limit: 10,
        cursor
    });
    assert.deepEqual(
        remainder.map(value => value.id),
        ['opaque-unread', 'opaque-02', 'opaque-01']
    );
    assert.equal(
        remainder.some(value => value.id === 'opaque-passed'),
        false
    );
    assert.equal(
        (await storage.listActivities({ direction: 'desc', limit: 10 }))[0].id,
        'opaque-passed'
    );
    await storage.close();
});
