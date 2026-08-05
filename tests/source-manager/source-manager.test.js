import assert from 'node:assert/strict';
import test from 'node:test';
import {
    preflightSourceFiles,
    sourceManagerReportItemCode,
    SOURCE_MANAGER_LIMITS,
    SOURCE_MANAGER_SESSION_MODE
} from '../../js/pages/source-manager/source-manager.js';
import { createSyntheticStravaZip } from '../fixtures/synthetic/strava/archive-fixture.js';

const encoder = new TextEncoder();

function syntheticFile(name, content, { size = null, fail = false } = {}) {
    const bytes = content instanceof Uint8Array ? content : encoder.encode(content);
    let reads = 0;
    return {
        file: {
            name,
            size: size ?? bytes.byteLength,
            async arrayBuffer() {
                reads += 1;
                if (fail) throw new Error('private file failure');
                return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            }
        },
        reads: () => reads
    };
}

const CSV = [
    'Activity ID,Activity Date,Activity Type,Activity Name,Distance',
    '0001,2026-08-01T01:02:03Z,Run,Synthetic Morning,0',
    'alpha/beta,2026-08-02T02:03:04Z,Ride,Synthetic Ride,25.5',
    ''
].join('\n');

test('Source Manager constants freeze Real/Demo modes and existing file limits', () => {
    assert.deepEqual(SOURCE_MANAGER_SESSION_MODE, { REAL: 'real', DEMO: 'demo' });
    assert.deepEqual(SOURCE_MANAGER_LIMITS, {
        maxFiles: 100,
        maxCsvBytes: 5_242_880,
        maxZipBytes: 67_108_864
    });
    assert.equal(Object.isFrozen(SOURCE_MANAGER_LIMITS), true);
});

test('CSV preflight uses anonymous labels, exact headers, row counts, and pipeline media', async () => {
    const input = syntheticFile('/private/athlete-real-name.csv', CSV);
    const [result] = await preflightSourceFiles([input.file]);
    assert.equal(input.reads(), 1);
    assert.equal(result.ok, true);
    assert.equal(result.label, 'CSV file 1');
    assert.equal(result.rows, 2);
    assert.equal(result.artifact.mediaType, 'text/csv;profile=strava-activities');
    assert.equal(result.artifact.content, CSV);
    assert.doesNotMatch(JSON.stringify({ label: result.label, rows: result.rows }), /athlete|private|real-name/i);
});

test('ZIP preflight requires magic bytes and delegates archive semantics to Import Core', async () => {
    const archive = syntheticFile('private-export.zip', createSyntheticStravaZip());
    const [result] = await preflightSourceFiles([archive.file]);
    assert.equal(result.ok, true);
    assert.equal(result.label, 'ZIP file 1');
    assert.equal(result.rows, null);
    assert.equal(result.artifact.mediaType, 'application/zip;profile=strava-archive;base64');
    assert.match(result.artifact.content, /^[A-Za-z0-9+/]+={0,2}$/);

    const invalid = syntheticFile('spoofed.zip', Uint8Array.of(0x50, 0x4b, 0x00, 0x00));
    const [failure] = await preflightSourceFiles([invalid.file]);
    assert.deepEqual(failure, {
        ok: false,
        code: 'FILE_HEADER_INVALID',
        copy: 'The file header is not a supported CSV or ZIP header.',
        label: 'File 1'
    });
});

test('invalid, unsupported, oversize, and unreadable files fail safely without contaminating later files', async () => {
    const unsupported = syntheticFile('private-route.fit', 'secret bytes');
    const malformed = syntheticFile('private-row.csv', 'Wrong,Header\n1,2\n');
    const oversized = syntheticFile('huge.csv', '', {
        size: SOURCE_MANAGER_LIMITS.maxCsvBytes + 1
    });
    const unreadable = syntheticFile('unreadable.csv', CSV, { fail: true });
    const valid = syntheticFile('later-success.csv', CSV);
    const results = await preflightSourceFiles([
        unsupported.file,
        malformed.file,
        oversized.file,
        unreadable.file,
        valid.file
    ]);
    assert.deepEqual(results.map(result => result.ok ? 'ready' : result.code), [
        'FILE_TYPE_UNSUPPORTED',
        'FILE_HEADER_INVALID',
        'FILE_TOO_LARGE',
        'FILE_READ_FAILED',
        'ready'
    ]);
    assert.equal(unsupported.reads(), 0);
    assert.equal(oversized.reads(), 0);
    assert.equal(valid.reads(), 1);
    assert.doesNotMatch(JSON.stringify(results.map(({ artifact, ...result }) => result)), /private-route|private-row|later-success/);
});

test('FIT, TCX, and GPX share the explicit later-support copy and never read bytes', async () => {
    for (const suffix of ['fit', 'tcx', 'gpx']) {
        const input = syntheticFile(`athlete.${suffix}`, 'private payload');
        const [result] = await preflightSourceFiles([input.file]);
        assert.equal(input.reads(), 0);
        assert.equal(result.code, 'FILE_TYPE_UNSUPPORTED');
        assert.equal(
            result.copy,
            'This format is not supported yet. FIT, TCX, and GPX support will be added later.'
        );
    }
});

test('file-count limit fails before reading any selected file', async () => {
    let reads = 0;
    const files = Array.from({ length: 101 }, (_, index) => ({
        name: `synthetic-${index}.csv`,
        size: encoder.encode(CSV).byteLength,
        async arrayBuffer() {
            reads += 1;
            return encoder.encode(CSV).buffer;
        }
    }));
    const results = await preflightSourceFiles(files);
    assert.equal(reads, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].code, 'TOO_MANY_FILES');
});

test('hostile file accessors are rejected without getter execution or disclosure', async () => {
    let getters = 0;
    const hostile = { size: 1, arrayBuffer() { return new ArrayBuffer(1); } };
    Object.defineProperty(hostile, 'name', {
        enumerable: true,
        get() {
            getters += 1;
            return 'private-name.csv';
        }
    });
    const [result] = await preflightSourceFiles([hostile]);
    assert.equal(getters, 0);
    assert.equal(result.code, 'FILE_READ_FAILED');
    assert.doesNotMatch(JSON.stringify(result), /private-name/);

    const target = syntheticFile('secret.csv', CSV).file;
    const revoked = Proxy.revocable(target, {});
    revoked.revoke();
    const [proxyResult] = await preflightSourceFiles([revoked.proxy]);
    assert.equal(proxyResult.code, 'FILE_READ_FAILED');
});

test('report item rendering allowlists persisted codes and rejects hostile values', () => {
    assert.equal(sourceManagerReportItemCode({
        outcome: 'failed_decode',
        errorCode: 'CSV_HEADER_INVALID'
    }), 'CSV_HEADER_INVALID');
    assert.equal(sourceManagerReportItemCode({
        outcome: 'failed_decode',
        errorCode: 'private-athlete-row-secret'
    }), 'IMPORT_FAILED');
    assert.equal(sourceManagerReportItemCode({
        outcome: 'failed_decode',
        errorCode: 'FILE_READ_FAILED'
    }), 'IMPORT_FAILED');
    assert.equal(sourceManagerReportItemCode({
        outcome: 'skipped_exact_duplicate',
        errorCode: null
    }), 'skipped_exact_duplicate');
    let getters = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'errorCode', {
        get() {
            getters += 1;
            return 'private-code';
        }
    });
    assert.equal(sourceManagerReportItemCode(hostile), 'IMPORT_FAILED');
    assert.equal(getters, 0);
});
