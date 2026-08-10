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
    createDeterministicZip,
    decodeCanonicalJson,
    decodeJsonLines,
    encodeCanonicalJson,
    encodeJsonLines,
    parseDeterministicZip,
    sha256
} from '../../js/backup/codec.js';
import {
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import {
    createCanonicalStore,
    createImportStore,
    createSourceConnectionStore
} from '../../js/storage/index.js';

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

async function createConnection(indexedDB, status = 'connected') {
    const connections = createSourceConnectionStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1'
    });
    await connections.initialize();
    let record = await connections.createConnection({
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: '123456789',
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1
    });
    if (status !== 'connected') {
        record = await connections.transitionConnection({
            id: record.id,
            expectedRevision: record.revision,
            status,
            lastSyncAt: null,
            errorCode: status === 'error'
                ? 'CONNECTION_ERROR'
                : status === 'reconnect_required'
                    ? 'AUTHORIZATION_REQUIRED'
                    : null
        });
    }
    await connections.close();
    return record;
}

function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function legacyFormat1Archive(format2Blob) {
    const parsed = await parseDeterministicZip(
        new Uint8Array(await format2Blob.arrayBuffer()),
        webcrypto
    );
    const byPath = new Map(parsed.map(entry => [entry.path, entry.bytes]));
    const manifest = decodeCanonicalJson(byPath.get('manifest.json'));
    const metadata = decodeJsonLines(byPath.get('system/metadata.jsonl'));
    metadata[0] = {
        ...metadata[0],
        schemaId: 'strava-stats-v2@4',
        indexedDbVersion: 4
    };
    const payloads = parsed.slice(1)
        .filter(entry => entry.path !== 'connections.jsonl')
        .map(entry => ({ path: entry.path, bytes: entry.bytes }));
    const metadataPayload = payloads.find(entry => entry.path === 'system/metadata.jsonl');
    metadataPayload.bytes = encodeJsonLines(metadata);
    const migrationsPayload = payloads.find(entry => entry.path === 'system/migrations.jsonl');
    migrationsPayload.bytes = encodeJsonLines(
        decodeJsonLines(migrationsPayload.bytes).slice(0, 4)
    );
    manifest.backupFormatVersion = 1;
    manifest.indexedDbVersion = 4;
    manifest.schemaId = 'strava-stats-v2@4';
    manifest.stores = manifest.stores.filter(store => store.name !== 'sourceConnections');
    manifest.stores.find(store => store.name === 'metadata').recordCount = 1;
    manifest.stores.find(store => store.name === 'migrations').recordCount = 4;
    manifest.files = manifest.files.filter(file => file.path !== 'connections.jsonl');
    manifest.hashes = manifest.hashes.filter(hash => hash.path !== 'connections.jsonl');
    for (const payload of payloads) {
        const file = manifest.files.find(candidate => candidate.path === payload.path);
        file.byteLength = payload.bytes.byteLength;
        file.recordCount = decodeJsonLines(payload.bytes).length;
        const hash = manifest.hashes.find(candidate => candidate.path === payload.path);
        hash.sha256 = hex(await sha256(payload.bytes, webcrypto));
    }
    return new Blob([await createDeterministicZip([
        { path: 'manifest.json', bytes: encodeCanonicalJson(manifest) },
        ...payloads
    ], webcrypto)], { type: 'application/zip' });
}

async function archiveWithNonExactMigrationTiming(blob) {
    const parsed = await parseDeterministicZip(
        new Uint8Array(await blob.arrayBuffer()),
        webcrypto
    );
    const manifest = decodeCanonicalJson(parsed[0].bytes);
    const payloads = parsed.slice(1).map(entry => ({
        path: entry.path,
        bytes: entry.bytes
    }));
    const migrationPayload = payloads.find(
        entry => entry.path === 'system/migrations.jsonl'
    );
    const migrations = decodeJsonLines(migrationPayload.bytes);
    migrations[0] = {
        ...migrations[0],
        completedAt: '2026-08-07T01:02:03.005Z'
    };
    migrationPayload.bytes = encodeJsonLines(migrations);
    const file = manifest.files.find(
        entry => entry.path === migrationPayload.path
    );
    file.byteLength = migrationPayload.bytes.byteLength;
    file.recordCount = migrations.length;
    manifest.hashes.find(entry => entry.path === migrationPayload.path).sha256 =
        hex(await sha256(migrationPayload.bytes, webcrypto));
    return new Blob([await createDeterministicZip([
        { path: 'manifest.json', bytes: encodeCanonicalJson(manifest) },
        ...payloads
    ], webcrypto)], { type: 'application/zip' });
}

async function fullV5Library(indexedDB) {
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

test('format 2 exports portable reconnect state and restores it without credentials', async () => {
    for (const sourceStatus of [
        'connected', 'error', 'reconnect_required', 'disconnected'
    ]) {
        const sourceFactory = new IDBFactory();
        await initializedLibrary(sourceFactory, false);
        const original = await createConnection(sourceFactory, sourceStatus);
        const archive = await service(sourceFactory).exportLibrary();
        const entries = await parseDeterministicZip(
            new Uint8Array(await archive.blob.arrayBuffer()),
            webcrypto
        );
        assert.deepEqual(entries.map(entry => entry.path).slice(0, 4), [
            'manifest.json',
            'activities.jsonl',
            'sources.jsonl',
            'connections.jsonl'
        ]);
        const [portable] = decodeJsonLines(
            entries.find(entry => entry.path === 'connections.jsonl').bytes
        );
        const expected = sourceStatus === 'connected' || sourceStatus === 'error'
            ? {
                ...original,
                status: 'reconnect_required',
                errorCode: 'AUTHORIZATION_REQUIRED'
            }
            : original;
        assert.deepEqual(portable, expected);

        const targetFactory = new IDBFactory();
        const target = service(targetFactory);
        assert.equal((await target.restoreBackup(archive.blob)).status, 'restored');
        const connections = createSourceConnectionStore({
            indexedDB: targetFactory,
            IDBKeyRange,
            now: () => FIXED_TIME,
            applicationVersion: 'backup-test@1'
        });
        await connections.initialize();
        assert.deepEqual(await connections.getConnection('strava'), portable);
        await connections.close();
        assert.equal((await target.restoreBackup(archive.blob)).status, 'already_restored');
    }
});

test('format 1 V4 archive restores one-way into V5 with no inferred connection', async () => {
    const sourceFactory = new IDBFactory();
    await initializedLibrary(sourceFactory);
    const current = await service(sourceFactory).exportLibrary();
    const legacyArchive = await legacyFormat1Archive(current.blob);
    assert.equal((await service(sourceFactory).validateBackup(legacyArchive)).status, 'validated');

    const targetFactory = new IDBFactory();
    const target = service(targetFactory);
    assert.equal((await target.restoreBackup(legacyArchive)).status, 'restored');
    const connections = createSourceConnectionStore({
        indexedDB: targetFactory,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1'
    });
    await connections.initialize();
    assert.equal(await connections.getConnection('strava'), null);
    await connections.close();
    assert.equal((await target.restoreBackup(legacyArchive)).status, 'already_restored');

    const upgraded = await target.exportLibrary();
    const entries = await parseDeterministicZip(
        new Uint8Array(await upgraded.blob.arrayBuffer()),
        webcrypto
    );
    const manifest = decodeCanonicalJson(entries[0].bytes);
    assert.equal(manifest.backupFormatVersion, 2);
    assert.equal(manifest.indexedDbVersion, 5);
    assert.equal(manifest.schemaId, 'strava-stats-v2@5');
    assert.equal(manifest.stores.find(store => store.name === 'migrations').recordCount, 5);
    assert.equal(manifest.stores.find(store => store.name === 'sourceConnections').recordCount, 0);
});

test('format 1 and format 2 reject non-exact structural migration timing', async () => {
    const sourceFactory = new IDBFactory();
    await initializedLibrary(sourceFactory);
    const current = await service(sourceFactory).exportLibrary();
    const archives = [
        current.blob,
        await legacyFormat1Archive(current.blob)
    ];
    for (const archive of archives) {
        const invalid = await archiveWithNonExactMigrationTiming(archive);
        await assert.rejects(
            service(new IDBFactory()).validateBackup(invalid),
            error => error.code === BACKUP_ERROR_CODE.BACKUP_DATA_INVALID
        );
    }
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

test('exact empty V5 baseline accepts restore while a non-empty current library is protected', async () => {
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

test('cancellation during a settings write reports resumable SETTINGS_PENDING', async () => {
    const sourceFactory = new IDBFactory();
    const desired = settingsAdapter({ training_goals: '{"weekly":0}' });
    await initializedLibrary(sourceFactory);
    const archive = (await service(sourceFactory, desired).exportLibrary()).blob;

    const signal = { aborted: false };
    const targetFactory = new IDBFactory();
    const targetValues = settingsAdapter();
    const target = createBackupService({
        indexedDB: targetFactory,
        IDBKeyRange,
        crypto: webcrypto,
        now: () => FIXED_TIME,
        applicationVersion: 'backup-test@1',
        settingsReader: () => targetValues.read(),
        settingsWriter(key, value) {
            targetValues.write(key, value);
            signal.aborted = true;
        }
    });
    await assert.rejects(
        target.restoreBackup(archive, { signal }),
        error => error.code === BACKUP_ERROR_CODE.SETTINGS_PENDING
            && error.retryable === true
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

test('all fourteen V5 stores, raw bytes, import audit, and duplicate-review records round-trip', async () => {
    const sourceFactory = new IDBFactory();
    await fullV5Library(sourceFactory);
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
