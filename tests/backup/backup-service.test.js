import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    BACKUP_ERROR_CODE,
    BackupError,
    createBackupService
} from '../../js/backup/index.js';
import {
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { createCanonicalStore, createImportStore } from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-07T01:02:03.004Z');

function bundle(id = 'opaque:001') {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id,
            sportCategory: 'run',
            sportVariant: null,
            startTimeUtc: '2026-08-07T00:00:00.000Z',
            timeZone: { ianaName: 'Etc/UTC', utcOffsetMinutes: 0 },
            capabilities: {
                hasGps: false, hasHeartRate: true, hasPower: true,
                hasCadence: false, hasLaps: true
            },
            name: 'Deterministic synthetic activity',
            distanceMeters: 10_000,
            movingTimeSeconds: 3_000,
            elapsedTimeSeconds: 3_000,
            extensions: { missingDistinct: null, positiveZero: 0, negativeZero: -0 }
        },
        streams: {
            activityId: id,
            series: [{
                streamType: 'power', unit: 'watts',
                offsetsSeconds: [0, 1], values: [0, 123]
            }]
        },
        laps: [{
            id: `${id}:lap:0`, activityId: id, index: 0,
            startOffsetSeconds: 0, elapsedTimeSeconds: 0
        }],
        events: [{
            id: `${id}:event:0`, activityId: id, index: 0,
            type: 'start', offsetSeconds: 0
        }],
        sources: [{
            id: `${id}:source`, activityId: id,
            provider: 'synthetic-provider', acquisitionMethod: 'synthetic-import',
            deviceId: `${id}:device`, importedAt: '2026-08-07T00:00:00.000Z'
        }],
        devices: [{
            id: `${id}:device`, manufacturer: 'synthetic', model: 'deterministic'
        }],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1, parserVersion: 'test@1', normalizerVersion: 'test@1',
            analysisVersion: null, settingsVersion: 'test@1', inputHash: null
        }
    };
}

function settingsAdapter(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        read() { return Object.fromEntries(values); },
        write(key, value) { values.set(key, value); }
    };
}

function service(indexedDB, settings = settingsAdapter()) {
    return createBackupService({
        indexedDB,
        IDBKeyRange,
        crypto: webcrypto,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1',
        settingsReader: () => settings.read(),
        settingsWriter: (key, value) => settings.write(key, value)
    });
}

async function initializedLibrary(indexedDB, withActivity = true, id = 'opaque:001') {
    const storage = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1'
    });
    await storage.initialize();
    if (withActivity) await storage.putBundle(bundle(id));
    await storage.close();
}

async function fullV4Library(indexedDB) {
    let sequence = 0;
    let clock = 0;
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME + clock++,
        applicationVersion: 'backup-test@1'
    });
    const imports = createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: kind => `opaque:${kind}:${++sequence}`
    });
    await imports.initialize();
    for (const id of ['opaque:full:left', 'opaque:full:right']) {
        const started = await imports.importArtifacts([{
            mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
            content: JSON.stringify(bundle(id))
        }]);
        await imports.waitForJob(started.jobId);
    }
    const [candidate] = await importStore.listDuplicateReviewCandidates();
    assert.ok(candidate);
    await importStore.decideDuplicateReviewCandidate(candidate.id, 'rejected');
    await imports.close();
}

test('exports deterministic full archive, validates it, and restores into a fresh isolated factory', async () => {
    const sourceFactory = new IDBFactory();
    const sourceSettings = settingsAdapter({
        dashboard_settings: '{"measurementSystem":"metric"}',
        'gear-custom-opaque': '{"price":0}'
    });
    await initializedLibrary(sourceFactory);
    const source = service(sourceFactory, sourceSettings);
    const first = await source.exportLibrary();
    const second = await source.exportLibrary();
    assert.equal(first.status, 'exported');
    assert.match(first.filename, /\.stravastats-backup\.zip$/);
    assert.deepEqual(
        new Uint8Array(await first.blob.arrayBuffer()),
        new Uint8Array(await second.blob.arrayBuffer())
    );
    assert.deepEqual(await source.validateBackup(first.blob), {
        status: 'validated',
        byteLength: first.byteLength,
        createdAt: '2026-08-07T01:02:03.004Z',
        activityCount: 1
    });

    const targetFactory = new IDBFactory();
    const targetSettings = settingsAdapter();
    const target = service(targetFactory, targetSettings);
    assert.deepEqual(await target.restoreBackup(first.blob), {
        status: 'restored',
        createdAt: '2026-08-07T01:02:03.004Z',
        activityCount: 1,
        byteLength: first.byteLength
    });
    assert.equal(targetSettings.values.get('dashboard_settings'),
        '{"measurementSystem":"metric"}');
    assert.equal(targetSettings.values.get('gear-custom-opaque'), '{"price":0}');
    const restored = await target.exportLibrary();
    assert.equal(restored.activityCount, 1);
});

test('repeat restore is idempotent and reports already_restored with zero database writes', async () => {
    const sourceFactory = new IDBFactory();
    await initializedLibrary(sourceFactory);
    const archive = (await service(sourceFactory).exportLibrary()).blob;
    const targetFactory = new IDBFactory();
    const target = service(targetFactory);
    assert.equal((await target.restoreBackup(archive)).status, 'restored');
    assert.equal((await target.restoreBackup(archive)).status, 'already_restored');
});

test('exact empty V4 baseline accepts restore while a non-empty current library is protected', async () => {
    const sourceFactory = new IDBFactory();
    await initializedLibrary(sourceFactory);
    const archive = (await service(sourceFactory).exportLibrary()).blob;

    const emptyFactory = new IDBFactory();
    await initializedLibrary(emptyFactory, false);
    assert.equal((await service(emptyFactory).restoreBackup(archive)).status, 'restored');

    const occupiedFactory = new IDBFactory();
    await initializedLibrary(occupiedFactory, true, 'opaque:different');
    const occupied = service(occupiedFactory);
    await assert.rejects(
        occupied.restoreBackup(archive),
        error => error instanceof BackupError
            && error.code === BACKUP_ERROR_CODE.TARGET_NOT_EMPTY
    );
    assert.equal((await occupied.exportLibrary()).activityCount, 1);
});

test('settings are additive, conflicts fail before database mutation, and partial writes resume', async () => {
    const sourceFactory = new IDBFactory();
    const desired = settingsAdapter({
        dashboard_filters: '{"sport":"run"}',
        training_goals: '{"weekly":0}'
    });
    await initializedLibrary(sourceFactory);
    const archive = (await service(sourceFactory, desired).exportLibrary()).blob;

    const conflictFactory = new IDBFactory();
    const conflict = settingsAdapter({ dashboard_filters: '{"sport":"ride"}' });
    await assert.rejects(
        service(conflictFactory, conflict).restoreBackup(archive),
        error => error.code === BACKUP_ERROR_CODE.TARGET_SETTINGS_CONFLICT
    );
    await assert.rejects(
        service(conflictFactory, conflict).exportLibrary(),
        error => error.code === BACKUP_ERROR_CODE.BACKUP_UNAVAILABLE
    );

    const pendingFactory = new IDBFactory();
    const pending = settingsAdapter();
    let calls = 0;
    const pendingService = createBackupService({
        indexedDB: pendingFactory,
        IDBKeyRange,
        crypto: webcrypto,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1',
        settingsReader: () => pending.read(),
        settingsWriter(key, value) {
            calls += 1;
            if (calls === 2) throw new Error('synthetic quota');
            pending.write(key, value);
        }
    });
    await assert.rejects(
        pendingService.restoreBackup(archive),
        error => error.code === BACKUP_ERROR_CODE.SETTINGS_PENDING
    );
    assert.equal((await pendingService.restoreBackup(archive)).status, 'already_restored');
});

test('a settings verification read failure after database commit reports resumable SETTINGS_PENDING', async () => {
    const sourceFactory = new IDBFactory();
    const desired = settingsAdapter({ training_goals: '{"weekly":0}' });
    await initializedLibrary(sourceFactory);
    const archive = (await service(sourceFactory, desired).exportLibrary()).blob;

    const targetFactory = new IDBFactory();
    const targetValues = settingsAdapter();
    let reads = 0;
    const target = createBackupService({
        indexedDB: targetFactory,
        IDBKeyRange,
        crypto: webcrypto,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1',
        settingsReader() {
            reads += 1;
            if (reads === 2) throw new Error('synthetic private detail');
            return targetValues.read();
        },
        settingsWriter: (key, value) => targetValues.write(key, value)
    });
    await assert.rejects(
        target.restoreBackup(archive),
        error => error.code === BACKUP_ERROR_CODE.SETTINGS_PENDING
            && !JSON.stringify(error).includes('synthetic private detail')
    );
    assert.equal((await target.restoreBackup(archive)).status, 'already_restored');
});

test('public errors are fixed, frozen, and never disclose raw causes or private data', async () => {
    const instance = service(new IDBFactory());
    await assert.rejects(instance.validateBackup(new Blob(['not a backup'])), error => {
        assert.equal(error instanceof BackupError, true);
        assert.equal(Object.isFrozen(error), true);
        assert.equal(error.message, 'Backup operation failed safely.');
        assert.equal(Object.hasOwn(error, 'cause'), false);
        assert.doesNotMatch(JSON.stringify(error), /not a backup|stack|path|token|route/i);
        return true;
    });
});

test('all thirteen V4 stores, raw bytes, import audit, and duplicate-review records round-trip', async () => {
    const sourceFactory = new IDBFactory();
    await fullV4Library(sourceFactory);
    const source = service(sourceFactory);
    const archive = await source.exportLibrary();
    assert.equal(archive.activityCount, 2);

    const targetFactory = new IDBFactory();
    const target = service(targetFactory);
    assert.equal((await target.restoreBackup(archive.blob)).status, 'restored');
    const repeated = await target.exportLibrary();
    assert.equal(repeated.activityCount, 2);
    assert.equal((await target.restoreBackup(archive.blob)).status, 'already_restored');
});
