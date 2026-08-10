import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    IDBFactory,
    IDBKeyRange,
    IDBObjectStore
} from 'fake-indexeddb';

import * as backupApi from '../../js/backup/index.js';
import {
    BACKUP_BYTE_LIMIT,
    createDeterministicZip,
    decodeCanonicalJson,
    decodeJsonLines,
    encodeCanonicalJson,
    encodeJsonLines,
    parseDeterministicZip,
    sha256
} from '../../js/backup/codec.js';
import { createCanonicalStore } from '../../js/storage/index.js';
import {
    V2_DATABASE_NAME
} from '../../js/storage/constants.js';
import { V2_PHYSICAL_SCHEMA_BY_VERSION } from '../../js/storage/schema.js';

const ROOT = new URL('../../', import.meta.url);
const FIXED_TIME = Date.parse('2026-08-07T03:04:05.006Z');

function adapters(indexedDB, overrides = {}) {
    const settings = new Map();
    return {
        indexedDB,
        IDBKeyRange,
        crypto: webcrypto,
        now: () => FIXED_TIME,
        applicationVersion: 'boundaries@1',
        settingsReader: () => Object.fromEntries(settings),
        settingsWriter: (key, value) => settings.set(key, value),
        ...overrides
    };
}

async function emptyArchive(indexedDB = new IDBFactory()) {
    const canonical = createCanonicalStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'boundaries@1'
    });
    await canonical.initialize();
    await canonical.close();
    const service = backupApi.createBackupService(adapters(indexedDB));
    return { indexedDB, service, archive: await service.exportLibrary() };
}

function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function addPendingRawArtifacts(indexedDB) {
    const records = [];
    for (const content of ['{"synthetic":1}', '{"synthetic":2}']) {
        const bytes = new TextEncoder().encode(content);
        const digest = hex(await sha256(bytes, webcrypto));
        records.push({
            id: `raw:${digest}`,
            sha256: digest,
            mediaType: 'application/vnd.stravastats.synthetic+json',
            byteLength: bytes.byteLength,
            content,
            acquiredVia: 'local-file',
            importedAt: '2026-08-07T03:04:05.006Z',
            state: 'pending',
            activityId: null
        });
    }
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(V2_DATABASE_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction('rawArtifacts', 'readwrite');
            for (const record of records) transaction.objectStore('rawArtifacts').add(record);
            transaction.oncomplete = () => { database.close(); resolve(); };
            transaction.onabort = () => { database.close(); reject(transaction.error); };
        };
    });
}

async function rebuildArchive(entries, replacements) {
    return createDeterministicZip(entries.map(entry => ({
        path: entry.path,
        bytes: replacements.get(entry.path) ?? entry.bytes
    })), webcrypto);
}

test('public Backup API has exactly three exports and service has exactly four methods', () => {
    assert.deepEqual(Object.keys(backupApi).sort(), [
        'BACKUP_ERROR_CODE', 'BackupError', 'createBackupService'
    ]);
    const service = backupApi.createBackupService(adapters(new IDBFactory()));
    assert.deepEqual(Reflect.ownKeys(service).sort(), [
        'close', 'exportLibrary', 'restoreBackup', 'validateBackup'
    ]);
});

test('accessor and Proxy options fail closed without evaluating own accessors', () => {
    let reads = 0;
    const accessor = adapters(new IDBFactory());
    Object.defineProperty(accessor, 'now', {
        enumerable: true,
        get() { reads += 1; return () => FIXED_TIME; }
    });
    assert.throws(
        () => backupApi.createBackupService(accessor),
        error => error.code === 'INVALID_REQUEST'
    );
    assert.equal(reads, 0);
    const cryptoAccessor = adapters(new IDBFactory());
    cryptoAccessor.crypto = {};
    Object.defineProperty(cryptoAccessor.crypto, 'subtle', {
        enumerable: true,
        get() { reads += 1; return webcrypto.subtle; }
    });
    assert.throws(
        () => backupApi.createBackupService(cryptoAccessor),
        error => error.code === 'INVALID_REQUEST'
    );
    assert.equal(reads, 0);
    assert.throws(
        () => backupApi.createBackupService(new Proxy({}, {
            ownKeys() { throw new Error('synthetic trap'); }
        })),
        error => error.code === 'INVALID_REQUEST'
    );
});

test('exact 256 MiB preflight rejects an oversized Blob before reading it', async () => {
    let read = false;
    class OversizedBlob extends Blob {
        get size() { return BACKUP_BYTE_LIMIT + 1; }
        async arrayBuffer() { read = true; throw new Error('must not read'); }
    }
    const service = backupApi.createBackupService(adapters(new IDBFactory()));
    await assert.rejects(
        service.validateBackup(new OversizedBlob()),
        error => error.code === 'BACKUP_TOO_LARGE'
    );
    assert.equal(read, false);
    assert.equal(BACKUP_BYTE_LIMIT, 268_435_456);
});

test('pre-aborted operations cancel without opening or mutating IndexedDB', async () => {
    let opens = 0;
    const indexedDB = Object.create(new IDBFactory());
    Object.defineProperty(indexedDB, 'open', {
        value() { opens += 1; throw new Error('must not open'); },
        enumerable: true
    });
    const service = backupApi.createBackupService(adapters(indexedDB));
    await assert.rejects(
        service.exportLibrary({ signal: { aborted: true } }),
        error => error.code === 'BACKUP_CANCELLED'
    );
    assert.equal(opens, 0);
});

test('cyclic dependency prototypes fail closed within a bounded traversal', () => {
    let prototypeReads = 0;
    let cyclic;
    cyclic = new Proxy({}, {
        getOwnPropertyDescriptor() { return undefined; },
        getPrototypeOf() {
            prototypeReads += 1;
            if (prototypeReads > 64) throw new Error('synthetic traversal guard');
            return cyclic;
        }
    });
    assert.throws(
        () => backupApi.createBackupService(adapters(cyclic)),
        error => error.code === 'INVALID_REQUEST'
    );
    assert.ok(prototypeReads <= 32, 'prototype traversal must be bounded');
});

test('cancellation raised during whole-buffer validation is observed before target mutation', async () => {
    const { archive } = await emptyArchive();
    const signal = { aborted: false };
    let digests = 0;
    const crypto = {
        subtle: {
            async digest(...args) {
                const value = await webcrypto.subtle.digest(...args);
                digests += 1;
                if (digests === 1) signal.aborted = true;
                return value;
            }
        }
    };
    const targetFactory = new IDBFactory();
    const target = backupApi.createBackupService(adapters(targetFactory, { crypto }));
    await assert.rejects(
        target.restoreBackup(archive.blob, { signal }),
        error => error.code === 'BACKUP_CANCELLED'
    );
    await assert.rejects(
        backupApi.createBackupService(adapters(targetFactory)).exportLibrary(),
        error => error.code === 'BACKUP_UNAVAILABLE'
    );
});

test('cancellation raised during database commit reports resumable settings pending', async () => {
    const { archive } = await emptyArchive();
    const signal = { aborted: false };
    const targetFactory = new IDBFactory();
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
        const request = originalAdd.apply(this, args);
        if (this.name === 'migrations') signal.aborted = true;
        return request;
    };
    try {
        const target = backupApi.createBackupService(adapters(targetFactory));
        await assert.rejects(
            target.restoreBackup(archive.blob, { signal }),
            error => error.code === 'SETTINGS_PENDING' && error.retryable === true
        );
        assert.equal((await target.restoreBackup(archive.blob)).status, 'already_restored');
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
    }
});

test('validateBackup observes cancellation raised during ZIP digest validation', async () => {
    const { archive } = await emptyArchive();
    const signal = { aborted: false };
    let digests = 0;
    const crypto = {
        subtle: {
            async digest(...args) {
                const value = await webcrypto.subtle.digest(...args);
                digests += 1;
                if (digests === 1) signal.aborted = true;
                return value;
            }
        }
    };
    const validator = backupApi.createBackupService(adapters(new IDBFactory(), { crypto }));
    await assert.rejects(
        validator.validateBackup(archive.blob, { signal }),
        error => error.code === 'BACKUP_CANCELLED'
    );
});

test('exact-current compatibility rejects a fully rehashed future-version archive', async () => {
    const { archive, service } = await emptyArchive();
    const entries = await parseDeterministicZip(
        new Uint8Array(await archive.blob.arrayBuffer()),
        webcrypto
    );
    const manifest = decodeCanonicalJson(entries[0].bytes);
    manifest.indexedDbVersion = 6;
    manifest.schemaId = 'strava-stats-v2@6';
    const incompatible = await createDeterministicZip(entries.map((entry, index) => ({
        path: entry.path,
        bytes: index === 0 ? encodeCanonicalJson(manifest) : entry.bytes
    })), webcrypto);
    await assert.rejects(
        service.validateBackup(incompatible),
        error => error.code === 'BACKUP_SCHEMA_INCOMPATIBLE'
    );
});

test('prototype-shaped backup format values fail through the fixed compatibility boundary', async () => {
    const { archive, service } = await emptyArchive();
    const entries = await parseDeterministicZip(
        new Uint8Array(await archive.blob.arrayBuffer()),
        webcrypto
    );
    const manifest = decodeCanonicalJson(entries[0].bytes);
    manifest.backupFormatVersion = '__proto__';
    const incompatible = await rebuildArchive(entries, new Map([
        ['manifest.json', encodeCanonicalJson(manifest)]
    ]));
    await assert.rejects(
        service.validateBackup(incompatible),
        error => error instanceof backupApi.BackupError
            && error.code === 'BACKUP_SCHEMA_INCOMPATIBLE'
    );
});

test('a fully container-rehashed manifest payload hash mismatch has its exact safe code', async () => {
    const { archive, service } = await emptyArchive();
    const entries = await parseDeterministicZip(
        new Uint8Array(await archive.blob.arrayBuffer()),
        webcrypto
    );
    const manifest = decodeCanonicalJson(entries[0].bytes);
    manifest.hashes[0].sha256 = '0'.repeat(64);
    const invalid = await rebuildArchive(entries, new Map([
        ['manifest.json', encodeCanonicalJson(manifest)]
    ]));
    await assert.rejects(
        service.validateBackup(invalid),
        error => error.code === 'BACKUP_HASH_MISMATCH'
    );
});

test('format 2 rejects a credential-dependent connection state before target creation', async () => {
    const { archive } = await emptyArchive();
    const entries = await parseDeterministicZip(
        new Uint8Array(await archive.blob.arrayBuffer()),
        webcrypto
    );
    const connections = encodeJsonLines([{
        id: 'source-connection:strava',
        provider: 'strava',
        subjectId: '424242',
        status: 'connected',
        lastSyncAt: null,
        errorCode: null,
        revision: 1
    }]);
    const manifest = decodeCanonicalJson(entries[0].bytes);
    const file = manifest.files.find(item => item.path === 'connections.jsonl');
    file.recordCount = 1;
    file.byteLength = connections.byteLength;
    manifest.hashes.find(item => item.path === 'connections.jsonl').sha256 = hex(
        await sha256(connections, webcrypto)
    );
    manifest.stores.find(item => item.name === 'sourceConnections').recordCount = 1;
    const invalid = await rebuildArchive(entries, new Map([
        ['manifest.json', encodeCanonicalJson(manifest)],
        ['connections.jsonl', connections]
    ]));
    const targetFactory = new IDBFactory();
    const target = backupApi.createBackupService(adapters(targetFactory));
    await assert.rejects(
        target.restoreBackup(invalid),
        error => error.code === 'BACKUP_DATA_INVALID'
    );
    await assert.rejects(
        target.exportLibrary(),
        error => error.code === 'BACKUP_UNAVAILABLE'
    );
});

test('fully rehashed noncanonical physical-store record order fails before target creation', async () => {
    const { indexedDB, service } = await emptyArchive();
    await addPendingRawArtifacts(indexedDB);
    const archive = await service.exportLibrary();
    const entries = await parseDeterministicZip(
        new Uint8Array(await archive.blob.arrayBuffer()),
        webcrypto
    );
    const rawEntry = entries.find(entry => entry.path === 'raw/artifacts.jsonl');
    const reorderedBytes = encodeJsonLines(decodeJsonLines(rawEntry.bytes).reverse());
    const manifest = decodeCanonicalJson(entries[0].bytes);
    const rawHash = manifest.hashes.find(hash => hash.path === rawEntry.path);
    rawHash.sha256 = hex(await sha256(reorderedBytes, webcrypto));
    const invalid = await rebuildArchive(entries, new Map([
        ['manifest.json', encodeCanonicalJson(manifest)],
        [rawEntry.path, reorderedBytes]
    ]));
    const targetFactory = new IDBFactory();
    const target = backupApi.createBackupService(adapters(targetFactory));
    await assert.rejects(
        target.restoreBackup(invalid),
        error => error.code === 'BACKUP_DATA_INVALID'
    );
    await assert.rejects(
        target.exportLibrary(),
        error => error.code === 'BACKUP_UNAVAILABLE'
    );
});

test('quota failure aborts a fresh restore and leaves no partial target database', async () => {
    const { archive } = await emptyArchive();
    const targetFactory = new IDBFactory();
    const target = backupApi.createBackupService(adapters(targetFactory));
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function syntheticQuota() {
        throw new DOMException('synthetic private detail', 'QuotaExceededError');
    };
    try {
        await assert.rejects(
            target.restoreBackup(archive.blob),
            error => error.code === 'QUOTA_EXCEEDED'
                && !JSON.stringify(error).includes('synthetic private detail')
        );
    } finally {
        IDBObjectStore.prototype.add = original;
    }
    await assert.rejects(
        target.exportLibrary(),
        error => error.code === 'BACKUP_UNAVAILABLE'
    );
});

test('a lower physical target version is incompatible and remains unchanged', async () => {
    const { archive } = await emptyArchive();
    const targetFactory = new IDBFactory();
    await new Promise((resolve, reject) => {
        const request = targetFactory.open(V2_DATABASE_NAME, 3);
        request.onupgradeneeded = () => {
            for (const descriptor of V2_PHYSICAL_SCHEMA_BY_VERSION[3].stores) {
                const store = request.result.createObjectStore(descriptor.name, {
                    keyPath: descriptor.keyPath,
                    autoIncrement: descriptor.autoIncrement
                });
                for (const index of descriptor.indexes) {
                    store.createIndex(index.name, index.keyPath, index);
                }
            }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { request.result.close(); resolve(); };
    });
    const target = backupApi.createBackupService(adapters(targetFactory));
    await assert.rejects(
        target.restoreBackup(archive.blob),
        error => error.code === 'BACKUP_SCHEMA_INCOMPATIBLE'
    );
    const version = await new Promise((resolve, reject) => {
        const request = targetFactory.open(V2_DATABASE_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const value = request.result.version;
            request.result.close();
            resolve(value);
        };
    });
    assert.equal(version, 3);
});

test('production backup imports are side-effect free and page boundaries exclude provider/auth/destructive APIs', async () => {
    const counters = { fetch: 0, idb: 0, storage: 0, console: 0 };
    const originals = {
        fetch: globalThis.fetch,
        indexedDB: globalThis.indexedDB,
        localStorage: globalThis.localStorage,
        consoleError: console.error,
        consoleWarn: console.warn
    };
    globalThis.fetch = () => { counters.fetch += 1; throw new Error('network'); };
    globalThis.indexedDB = new Proxy({}, { get() { counters.idb += 1; throw new Error('idb'); } });
    globalThis.localStorage = new Proxy({}, { get() { counters.storage += 1; throw new Error('storage'); } });
    console.error = () => { counters.console += 1; };
    console.warn = () => { counters.console += 1; };
    try {
        await import(`../../js/backup/index.js?zero-io=${Date.now()}`);
        await import(`../../js/pages/storage-backup/storage-backup.js?zero-io=${Date.now()}`);
        await import(`../../js/app/storage-backup.js?zero-io=${Date.now()}`);
    } finally {
        globalThis.fetch = originals.fetch;
        if (originals.indexedDB === undefined) delete globalThis.indexedDB;
        else globalThis.indexedDB = originals.indexedDB;
        if (originals.localStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originals.localStorage;
        console.error = originals.consoleError;
        console.warn = originals.consoleWarn;
    }
    assert.deepEqual(counters, { fetch: 0, idb: 0, storage: 0, console: 0 });

    const html = await readFile(new URL('storage-backup.html', ROOT), 'utf8');
    const page = await readFile(new URL(
        'js/pages/storage-backup/storage-backup.js', ROOT
    ), 'utf8');
    const app = await readFile(new URL('js/app/storage-backup.js', ROOT), 'utf8');
    const smoke = await readFile(new URL(
        'tests/backup/backup-browser-smoke.html', ROOT
    ), 'utf8');
    assert.doesNotMatch(html, /https?:\/\//);
    assert.match(html, /whole-buffer processing/);
    assert.match(html, /Empty target only/);
    assert.doesNotMatch(page, /indexedDB|objectStore\s*\(|localStorage|fetch\s*\(|console\.|innerHTML/);
    assert.doesNotMatch(app, /fetch\s*\(|Authorization|Bearer|access_token|refresh_token|deleteDatabase|\.clear\s*\(/);
    assert.doesNotMatch(app, /createCanonicalStore|storage\.initialize\s*\(/);
    assert.match(app, /indexedDB\.open\(V2_DATABASE_NAME\)/);
    assert.match(app, /mode === STORAGE_BACKUP_SESSION_MODE\.DEMO\s*\? demoFacade\(\)/);
    assert.match(smoke, /mode: 'export'/);
    assert.match(smoke, /mode: 'restore'/);
    assert.match(smoke, /restoredConnectionStatus/);
    assert.doesNotMatch(smoke, /https?:\/\/|fetch\s*\(|deleteDatabase|access_token|refresh_token/);
});
