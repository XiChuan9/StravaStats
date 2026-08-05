import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';

import {
    IMPORT_ERROR_CODE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import {
    STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
    STRAVA_ZIP_MEDIA_TYPE,
    expandStravaZipArtifact,
    stravaArchiveRowDecoder
} from '../../js/import/strava-zip.js';
import {
    STRAVA_ZIP_LIMITS,
    openStravaZipArchive
} from '../../js/import/zip-inspector.js';
import { createImportStore } from '../../js/storage/index.js';
import {
    SYNTHETIC_ARCHIVE_CSV,
    SYNTHETIC_ARCHIVE_ENTRIES,
    createSyntheticStravaZip,
    syntheticStravaZipArtifact,
    toBase64
} from '../fixtures/synthetic/strava/archive-fixture.js';

const FIXED_TIME = Date.parse('2026-08-05T01:02:03.004Z');

function read16(bytes, offset) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        .getUint16(offset, true);
}

function read32(bytes, offset) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        .getUint32(offset, true);
}

function write16(bytes, offset, value) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        .setUint16(offset, value, true);
}

function write32(bytes, offset, value) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        .setUint32(offset, value, true);
}

function cloneZip(options) {
    return new Uint8Array(createSyntheticStravaZip(options));
}

function centralOffsets(bytes) {
    const eocd = bytes.byteLength - 22;
    const total = read16(bytes, eocd + 10);
    const offsets = [];
    let cursor = read32(bytes, eocd + 16);
    for (let index = 0; index < total; index += 1) {
        offsets.push(cursor);
        cursor += 46 + read16(bytes, cursor + 28)
            + read16(bytes, cursor + 30) + read16(bytes, cursor + 32);
    }
    return offsets;
}

async function rejectsCode(content, code) {
    await assert.rejects(
        expandStravaZipArtifact(content),
        error => error.code === code && !JSON.stringify(error).includes('activities/opaque')
    );
}

function entries(...additional) {
    return [SYNTHETIC_ARCHIVE_ENTRIES[0], ...additional];
}

function ids(prefix = 'opaque') {
    let sequence = 0;
    return kind => `${prefix}-${kind}-${++sequence}`;
}

function store(indexedDB) {
    return createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'strava-zip-test@1'
    });
}

function service(importStore, prefix = 'opaque', overrides = {}) {
    const worker = Object.hasOwn(overrides, 'worker')
        ? overrides.worker
        : createInlineImportWorker();
    return createImportService({
        importStore,
        worker,
        crypto: webcrypto,
        createId: ids(prefix),
        ...overrides
    });
}

test('stored and raw-DEFLATE archives preserve child bytes and delegate quoted rows', async () => {
    for (const method of [0, 8]) {
        const artifact = syntheticStravaZipArtifact({ method });
        const before = artifact.content;
        const rows = await expandStravaZipArtifact(artifact.content);
        assert.equal(artifact.content, before);
        assert.equal(rows.length, 2);
        assert.equal(rows.every(row => row.mediaType === STRAVA_ARCHIVE_ROW_MEDIA_TYPE), true);
        const wrappers = rows.map(row => JSON.parse(row.content));
        assert.deepEqual(wrappers.map(row => row.association.format), ['fit', 'gpx']);
        assert.deepEqual(wrappers.map(row => row.warningCode), [
            'ZIP_ACTIVITY_FILE_UNSUPPORTED',
            'ZIP_ACTIVITY_FILE_UNSUPPORTED'
        ]);
        const decoded = rows.map(row => stravaArchiveRowDecoder.decode(row));
        assert.deepEqual(decoded.map(row => row.activity.id), [
            'strava-archive:00042',
            'strava-archive:alpha%2Fbeta'
        ]);
        assert.equal(decoded[1].activity.name, 'Quoted, Archive Ride');
        assert.equal(decoded.every(row => row.streams.series.length === 0), true);
        assert.equal(decoded.every(row => row.laps.length === 0), true);
        assert.equal(decoded.every(row => row.events.length === 0), true);
        assert.equal(decoded.every(row => row.devices.length === 0), true);
    }
});

test('transport, EOCD, central, local, CRC, and feature failures are stable and fail closed', async () => {
    await rejectsCode('', IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);
    await rejectsCode('YWJjZA==\n', IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);
    await rejectsCode('____', IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);

    const truncated = cloneZip().subarray(0, cloneZip().byteLength - 1);
    await rejectsCode(toBase64(truncated), IMPORT_ERROR_CODE.ZIP_INVALID);

    const central = cloneZip();
    write32(central, centralOffsets(central)[0], 0);
    await rejectsCode(toBase64(central), IMPORT_ERROR_CODE.ZIP_INVALID);

    const local = cloneZip();
    write32(local, 0, 0);
    await rejectsCode(toBase64(local), IMPORT_ERROR_CODE.ZIP_INVALID);

    const spoofed = cloneZip();
    write32(spoofed, 18, read32(spoofed, 18) + 1);
    await rejectsCode(toBase64(spoofed), IMPORT_ERROR_CODE.ZIP_INVALID);

    const crc = cloneZip();
    const firstNameLength = read16(crc, 26);
    crc[30 + firstNameLength] ^= 0x01;
    await rejectsCode(toBase64(crc), IMPORT_ERROR_CODE.ZIP_CRC_MISMATCH);

    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: 'opaque.bin', content: 'x', flags: 1 })
    })), IMPORT_ERROR_CODE.ZIP_ENCRYPTED);
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: 'opaque.bin', content: 'x', flags: 8 })
    })), IMPORT_ERROR_CODE.ZIP_DATA_DESCRIPTOR_UNSUPPORTED);
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: 'opaque.bin', content: 'x', method: 9 })
    })), IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);

    const multiDisk = cloneZip();
    write16(multiDisk, multiDisk.byteLength - 18, 1);
    await rejectsCode(toBase64(multiDisk), IMPORT_ERROR_CODE.ZIP_MULTI_DISK);

    const zip64 = cloneZip();
    write16(zip64, zip64.byteLength - 14, 0xffff);
    write16(zip64, zip64.byteLength - 12, 0xffff);
    await rejectsCode(toBase64(zip64), IMPORT_ERROR_CODE.ZIP64_UNSUPPORTED);

    const timestamp = cloneZip();
    write16(timestamp, 10, 1);
    await rejectsCode(toBase64(timestamp), IMPORT_ERROR_CODE.ZIP_INVALID);

    const extra = cloneZip();
    write16(extra, centralOffsets(extra)[0] + 30, 1);
    await rejectsCode(toBase64(extra), IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);

    const host = cloneZip();
    write16(host, centralOffsets(host)[0] + 4, 0x0214);
    await rejectsCode(toBase64(host), IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
});

test('filename encoding and DEFLATE option flags follow the exact frozen profile', async () => {
    const invalidUtf8 = cloneZip();
    const manifestCentral = centralOffsets(invalidUtf8)[0];
    invalidUtf8[30] = 0xff;
    invalidUtf8[manifestCentral + 46] = 0xff;
    await rejectsCode(toBase64(invalidUtf8), IMPORT_ERROR_CODE.ZIP_PATH_INVALID);

    const asciiOnly = cloneZip({ utf8: false });
    const asciiCentral = centralOffsets(asciiOnly)[0];
    asciiOnly[30] = 0xff;
    asciiOnly[asciiCentral + 46] = 0xff;
    await rejectsCode(toBase64(asciiOnly), IMPORT_ERROR_CODE.ZIP_PATH_INVALID);

    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: 'e\u0301.fit', content: 'x' })
    })), IMPORT_ERROR_CODE.ZIP_PATH_INVALID);

    const rows = await expandStravaZipArtifact(toBase64(createSyntheticStravaZip({
        entries: [{
            name: 'activities.csv',
            content: 'Activity ID,Activity Date,Activity Type\n01,2026-07-01T01:02:03Z,Run\n',
            method: 8,
            flags: 0x0802
        }]
    })));
    assert.equal(rows.length, 1);
});

test('path traversal, aliases, collisions, nesting, and special files are rejected', async () => {
    for (const name of [
        '../escape.fit', '/absolute.fit', 'C:/drive.fit', '//server/share.fit',
        'folder\\ambiguous.fit', 'folder/./dot.fit', 'folder/../dotdot.fit',
        'nul\0name.fit'
    ]) {
        await rejectsCode(toBase64(createSyntheticStravaZip({
            entries: entries({ name, content: 'x' })
        })), IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
    }
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries(
            { name: 'same.fit', content: 'a' },
            { name: 'same.fit', content: 'b' }
        )
    })), IMPORT_ERROR_CODE.ZIP_DUPLICATE_ENTRY);
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries(
            { name: 'same.fit', content: 'a' },
            { name: 'SAME.FIT', content: 'b' }
        )
    })), IMPORT_ERROR_CODE.ZIP_DUPLICATE_ENTRY);
    for (const name of [
        'nested.zip', 'nested.zipx', 'nested.7z', 'nested.rar',
        'nested.tar', 'nested.tgz', 'nested.tar.gz'
    ]) {
        await rejectsCode(toBase64(createSyntheticStravaZip({
            entries: entries({ name, content: 'x' })
        })), IMPORT_ERROR_CODE.ZIP_NESTED_ARCHIVE);
    }

    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: [
            { name: 'activities.csv', content: SYNTHETIC_ARCHIVE_CSV },
            { name: 'Activities.csv', content: SYNTHETIC_ARCHIVE_CSV }
        ]
    })), IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_DUPLICATE);

    const symlink = cloneZip();
    const childCentral = centralOffsets(symlink)[2];
    write32(symlink, childCentral + 38, (0o120777 << 16) >>> 0);
    await rejectsCode(toBase64(symlink), IMPORT_ERROR_CODE.ZIP_SPECIAL_FILE);

    const alias = cloneZip();
    const offsets = centralOffsets(alias);
    write32(alias, offsets[1] + 42, read32(alias, offsets[0] + 42));
    await rejectsCode(toBase64(alias), IMPORT_ERROR_CODE.ZIP_INVALID);
});

test('entry, size, ratio, depth, filename, time, and cancellation budgets fail before extraction', async () => {
    assert.deepEqual(STRAVA_ZIP_LIMITS, {
        maxArchiveBytes: 67_108_864,
        maxEntries: 10_000,
        maxCompressedEntryBytes: 16_777_216,
        maxUncompressedEntryBytes: 16_777_216,
        maxTotalUncompressedBytes: 268_435_456,
        maxCompressionRatio: 100,
        maxDirectoryDepth: 4,
        maxFilenameBytes: 240,
        maxProcessingMilliseconds: 10_000,
        checkQuantumBytes: 65_536
    });
    const tooMany = Array.from({ length: 10_001 }, (_, index) => ({
        name: index === 0 ? 'activities.csv' : `e${index}`,
        content: index === 0 ? SYNTHETIC_ARCHIVE_CSV : ''
    }));
    await rejectsCode(toBase64(createSyntheticStravaZip({ entries: tooMany })),
        IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);

    const oversized = cloneZip();
    const firstCentral = centralOffsets(oversized)[0];
    write32(oversized, firstCentral + 24, 16_777_217);
    await rejectsCode(toBase64(oversized), IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);

    const ratio = cloneZip({ method: 8 });
    const ratioCentral = centralOffsets(ratio)[0];
    write32(ratio, ratioCentral + 20, 1);
    write32(ratio, ratioCentral + 24, 101);
    await rejectsCode(toBase64(ratio), IMPORT_ERROR_CODE.ZIP_BOMB_RISK);

    const totalEntries = Array.from({ length: 17 }, (_, index) => ({
        name: index === 0 ? 'activities.csv' : `total-${index}`,
        content: index === 0 ? SYNTHETIC_ARCHIVE_CSV : 'x',
        method: 8
    }));
    const total = new Uint8Array(createSyntheticStravaZip({ entries: totalEntries }));
    for (const offset of centralOffsets(total)) {
        write32(total, offset + 20, 16_777_216);
        write32(total, offset + 24, 16_777_216);
    }
    await rejectsCode(toBase64(total), IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);

    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: 'a/b/c/d/e.fit', content: 'x' })
    })), IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: entries({ name: `${'a'.repeat(237)}.fit`, content: 'x' })
    })), IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);

    const originalNow = Date.now;
    let calls = 0;
    Date.now = () => (calls++ === 0 ? 0 : 10_001);
    try {
        assert.throws(
            () => openStravaZipArchive(syntheticStravaZipArtifact().content),
            error => error.code === IMPORT_ERROR_CODE.ZIP_TIME_BUDGET_EXCEEDED
        );
    } finally {
        Date.now = originalNow;
    }
    assert.throws(
        () => openStravaZipArchive(syntheticStravaZipArtifact().content, () => true),
        error => error.code === IMPORT_ERROR_CODE.IMPORT_CANCELLED
    );
});

test('manifest recognition and Activity Filename association warnings are deterministic', async () => {
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: [{ name: 'other.csv', content: SYNTHETIC_ARCHIVE_CSV }]
    })), IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_MISSING);
    await rejectsCode(toBase64(createSyntheticStravaZip({
        entries: [
            { name: 'activities.csv', content: SYNTHETIC_ARCHIVE_CSV },
            { name: 'activities.csv', content: SYNTHETIC_ARCHIVE_CSV }
        ]
    })), IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_DUPLICATE);

    const cases = [
        {
            csv: 'Activity ID,Activity Date,Activity Type\n01,2026-07-01T01:02:03Z,Run\n',
            code: 'ZIP_ACTIVITY_FILENAME_MISSING',
            child: null
        },
        {
            csv: 'Activity ID,Activity Date,Activity Type,Activity Filename\n01,2026-07-01T01:02:03Z,Run,../bad.fit\n',
            code: 'ZIP_ACTIVITY_FILENAME_INVALID',
            child: null
        },
        {
            csv: 'Activity ID,Activity Date,Activity Type,Activity Filename\n01,2026-07-01T01:02:03Z,Run,missing.fit\n',
            code: 'ZIP_ACTIVITY_FILE_NOT_FOUND',
            child: null
        },
        {
            csv: 'Activity ID,Activity Date,Activity Type,Activity Filename\n01,2026-07-01T01:02:03Z,Run,CHILD.FIT\n',
            code: 'ZIP_ACTIVITY_FILE_AMBIGUOUS',
            child: { name: 'child.fit', content: 'x' }
        },
        {
            csv: 'Activity ID,Activity Date,Activity Type,Activity Filename\n01,2026-07-01T01:02:03Z,Run,child.json\n',
            code: 'ZIP_ACTIVITY_FILE_UNSUPPORTED',
            child: { name: 'child.json', content: 'x' }
        }
    ];
    for (const item of cases) {
        const rows = await expandStravaZipArtifact(toBase64(createSyntheticStravaZip({
            entries: [
                { name: 'activities.csv', content: item.csv },
                ...(item.child ? [item.child] : [])
            ]
        })));
        const wrapper = JSON.parse(rows[0].content);
        assert.equal(wrapper.warningCode, item.code);
        assert.equal(wrapper.association, null);
    }

    const duplicateCsv = [
        'Activity ID,Activity Date,Activity Type,Activity Filename',
        '01,2026-07-01T01:02:03Z,Run,child.fit',
        '02,2026-07-02T01:02:03Z,Run,child.fit',
        ''
    ].join('\n');
    const duplicateRows = await expandStravaZipArtifact(toBase64(createSyntheticStravaZip({
        entries: [
            { name: 'activities.csv', content: duplicateCsv },
            { name: 'child.fit', content: 'x' }
        ]
    })));
    assert.deepEqual(duplicateRows.map(row => JSON.parse(row.content).warningCode), [
        'ZIP_ACTIVITY_FILE_DUPLICATE',
        'ZIP_ACTIVITY_FILE_DUPLICATE'
    ]);
});

test('ZIP ImportService slice is concurrent-idempotent, reload-idempotent, and report-safe', async () => {
    const indexedDB = new IDBFactory();
    const firstStore = store(indexedDB);
    const first = service(firstStore);
    await first.initialize();
    const artifact = syntheticStravaZipArtifact({ method: 8 });
    assert.equal(artifact.mediaType, STRAVA_ZIP_MEDIA_TYPE);
    const [left, right] = await Promise.all([
        first.importArtifacts([artifact]),
        first.importArtifacts([artifact])
    ]);
    const reports = await Promise.all([
        first.waitForJob(left.jobId),
        first.waitForJob(right.jobId)
    ]);
    assert.equal(reports.flatMap(report => report.items)
        .filter(item => item.outcome === 'completed').length, 2);
    assert.equal(reports.flatMap(report => report.items)
        .filter(item => item.outcome === 'skipped_exact_duplicate').length, 2);
    assert.deepEqual(await first.previewActivities(), {
        total: 2,
        bySportCategory: [
            { sportCategory: 'ride', count: 1 },
            { sportCategory: 'run', count: 1 }
        ]
    });
    assert.doesNotMatch(
        JSON.stringify(reports),
        /opaque-run|opaque-ride|Synthetic Archive|Activity Filename|contentBase64/
    );
    await first.close();

    const reloadedStore = store(indexedDB);
    const reloaded = service(reloadedStore, 'reloaded');
    await reloaded.initialize();
    const replay = await reloaded.importArtifacts([artifact]);
    const replayReport = await reloaded.waitForJob(replay.jobId);
    assert.deepEqual(replayReport.totals, {
        total: 2,
        completed: 0,
        skippedExactDuplicate: 2,
        failed: 0,
        cancelled: 0
    });
    assert.equal((await reloadedStore.listImportJobs()).length, 3);
    assert.equal((await reloadedStore.listActivities()).length, 2);
    await reloaded.close();
});

test('ZIP rows isolate semantic failures and preserve missing values without fabricated graphs', async () => {
    const csv = [
        'Activity ID,Activity Date,Activity Type,Distance,Average Heart Rate',
        '001,2026-07-01T01:02:03Z,Run,1,',
        '002,2026-02-30T01:02:03Z,Run,2,150',
        '003,2026-07-03T01:02:03Z,Ride,0,',
        ''
    ].join('\n');
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    const run = await core.importArtifacts([{
        mediaType: STRAVA_ZIP_MEDIA_TYPE,
        content: toBase64(createSyntheticStravaZip({
            entries: [{ name: 'activities.csv', content: csv }]
        }))
    }]);
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'completed_with_warnings');
    assert.deepEqual(report.totals, {
        total: 3,
        completed: 2,
        skippedExactDuplicate: 0,
        failed: 1,
        cancelled: 0
    });
    assert.equal(report.items[1].errorCode, IMPORT_ERROR_CODE.CSV_DATE_INVALID);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('ZIP Worker crash is durable, redacted, and explicitly retryable', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const inline = createInlineImportWorker();
    let calls = 0;
    const worker = {
        async process(input) {
            calls += 1;
            if (calls === 1) throw new Error(`private archive ${input.content}`);
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const core = service(importStore, 'crash', { worker });
    await core.initialize();
    const run = await core.importArtifacts([syntheticStravaZipArtifact()]);
    let report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'failed_decode');
    assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.WORKER_CRASHED);
    assert.doesNotMatch(JSON.stringify(report), /private archive|opaque-run|contentBase64/);
    await core.retryJob(run.jobId);
    report = await core.waitForJob(run.jobId);
    assert.equal(report.totals.completed, 2);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});

test('ZIP cancellation retains durable rows but performs no Canonical write', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const inline = createInlineImportWorker();
    let release;
    let reached;
    const gate = new Promise(resolve => { release = resolve; });
    const reachedGate = new Promise(resolve => { reached = resolve; });
    let first = true;
    const worker = {
        async process(input) {
            if (first) {
                first = false;
                reached();
                await gate;
            }
            return inline.process(input);
        },
        close() { inline.close(); }
    };
    const core = service(importStore, 'cancel', { worker });
    await core.initialize();
    const run = await core.importArtifacts([syntheticStravaZipArtifact()]);
    await reachedGate;
    assert.deepEqual(await core.cancelJob(run.jobId), {
        status: 'cancellation-requested'
    });
    release();
    const report = await core.waitForJob(run.jobId);
    assert.equal(report.status, 'cancelled');
    assert.equal(report.totals.cancelled, 2);
    assert.equal((await core.previewActivities()).total, 0);
    assert.equal((await importStore.listImportItems(run.jobId)).length, 2);
    await core.close();
});

test('ZIP quota failure aborts one Canonical transaction and allows the next row', async () => {
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore, 'quota');
    await core.initialize();
    const originalAdd = IDBObjectStore.prototype.add;
    let injected = false;
    IDBObjectStore.prototype.add = function (...args) {
        if (!injected && this.name === 'activities') {
            injected = true;
            throw new DOMException('private quota detail', 'QuotaExceededError');
        }
        return originalAdd.apply(this, args);
    };
    let report;
    try {
        const run = await core.importArtifacts([syntheticStravaZipArtifact()]);
        report = await core.waitForJob(run.jobId);
    } finally {
        IDBObjectStore.prototype.add = originalAdd;
    }
    assert.equal(report.status, 'completed_with_warnings');
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.failed, 1);
    assert.equal(
        report.items[0].errorCode,
        IMPORT_ERROR_CODE.STORAGE_QUOTA_EXCEEDED
    );
    assert.doesNotMatch(JSON.stringify(report), /private quota detail|opaque-run/);
    assert.equal((await core.previewActivities()).total, 1);
    await core.close();
});

test('archive and row wrapper hostile inputs fail without getter execution or disclosure', async () => {
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'mediaType', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return STRAVA_ZIP_MEDIA_TYPE;
        }
    });
    Object.defineProperty(hostile, 'content', {
        enumerable: true,
        value: syntheticStravaZipArtifact().content
    });
    const indexedDB = new IDBFactory();
    const importStore = store(indexedDB);
    const core = service(importStore);
    await core.initialize();
    await assert.rejects(
        core.importArtifacts([hostile]),
        error => error.code === IMPORT_ERROR_CODE.INVALID_REQUEST
    );
    assert.equal(getterCalls, 0);
    assert.deepEqual(await importStore.listImportJobs(), []);

    const [internalRow] = await expandStravaZipArtifact(
        syntheticStravaZipArtifact().content
    );
    await assert.rejects(
        core.importArtifacts([internalRow]),
        error => error.code === IMPORT_ERROR_CODE.INVALID_REQUEST
    );
    assert.deepEqual(await importStore.listImportJobs(), []);
    await core.close();

    assert.throws(
        () => stravaArchiveRowDecoder.decode({
            mediaType: STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
            content: '{"schemaVersion":1,"csv":"private-path","association":null,"warningCode":"BAD"}'
        }),
        error => error.code === IMPORT_ERROR_CODE.FILE_CORRUPTED
            && !JSON.stringify(error).includes('private-path')
    );
});
