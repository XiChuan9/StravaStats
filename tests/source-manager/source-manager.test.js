import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    preflightSourceFiles,
    sourceManagerReportItemCode,
    SOURCE_MANAGER_LIMITS,
    SOURCE_MANAGER_SESSION_MODE
} from '../../js/pages/source-manager/source-manager.js';
import { createSyntheticStravaZip } from '../fixtures/synthetic/strava/archive-fixture.js';
import { createSyntheticFitActivity } from '../fixtures/synthetic/fit/fit-fixture.js';
import { createSyntheticTcxActivity } from '../fixtures/synthetic/tcx/tcx-fixture.js';
import { createSyntheticGpxActivity } from '../fixtures/synthetic/gpx/gpx-fixture.js';

const encoder = new TextEncoder();

function syntheticFile(name, content, { size = null, fail = false, type = '' } = {}) {
    const bytes = content instanceof Uint8Array ? content : encoder.encode(content);
    let reads = 0;
    return {
        file: {
            name,
            size: size ?? bytes.byteLength,
            type,
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
        maxZipBytes: 67_108_864,
        maxFitBytes: 16_777_216,
        maxTcxBytes: 16_777_216,
        maxGpxBytes: 16_777_216
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
        copy: 'The file header or root does not match its selected format.',
        label: 'File 1'
    });
});

test('invalid, unsupported, oversize, and unreadable files fail safely without contaminating later files', async () => {
    const unsupported = syntheticFile('private-route.json', 'secret bytes');
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

test('FIT, TCX, and GPX preflight produces exact anonymous Registry artifacts', async () => {
    const cases = [
        {
            suffix: 'fit',
            content: createSyntheticFitActivity(),
            type: 'application/vnd.ant.fit',
            mediaType: 'application/vnd.ant.fit;base64',
            label: 'FIT file 1',
            contentPattern: /^[A-Za-z0-9+/]+={0,2}$/
        },
        {
            suffix: 'tcx',
            content: createSyntheticTcxActivity(),
            type: 'application/vnd.garmin.tcx+xml',
            mediaType: 'application/vnd.garmin.tcx+xml',
            label: 'TCX file 1',
            contentPattern: /^<\?xml/
        },
        {
            suffix: 'gpx',
            filename: 'PRIVATE-ATHLETE.GPX',
            content: createSyntheticGpxActivity(),
            type: 'application/gpx+xml',
            mediaType: 'application/gpx+xml',
            label: 'GPX file 1',
            contentPattern: /^<\?xml/
        }
    ];
    for (const item of cases) {
        const input = syntheticFile(item.filename ?? `private-athlete.${item.suffix}`, item.content, {
            type: item.type
        });
        const [result] = await preflightSourceFiles([input.file]);
        assert.equal(input.reads(), 1, item.suffix);
        assert.equal(result.ok, true, item.suffix);
        assert.equal(result.label, item.label);
        assert.equal(result.rows, null);
        assert.equal(result.artifact.mediaType, item.mediaType);
        assert.match(result.artifact.content, item.contentPattern);
        assert.doesNotMatch(JSON.stringify({
            label: result.label,
            format: result.format
        }), /private|athlete/i);
    }
});

test('recognized extension, MIME, and content signatures must agree', async () => {
    const fit = createSyntheticFitActivity();
    const cases = [
        syntheticFile('spoofed.fit', fit, { type: 'application/gpx+xml' }),
        syntheticFile('spoofed.gpx', createSyntheticTcxActivity(), { type: 'application/xml' }),
        syntheticFile('spoofed.tcx', createSyntheticGpxActivity(), { type: 'text/xml' }),
        syntheticFile('spoofed.fit', Uint8Array.of(0x50, 0x4b, 0x03, 0x04)),
        syntheticFile('spoofed.gpx', fit)
    ];
    const results = await preflightSourceFiles(cases.map(entry => entry.file));
    assert.deepEqual(results.map(result => result.code), [
        'FILE_HEADER_INVALID',
        'FILE_HEADER_INVALID',
        'FILE_HEADER_INVALID',
        'FILE_HEADER_INVALID',
        'FILE_HEADER_INVALID'
    ]);
    assert.deepEqual(cases.map(entry => entry.reads()), [0, 1, 1, 1, 1]);
});

test('generic or absent MIME is advisory while format-specific conflicts fail closed', async () => {
    const descriptors = [
        syntheticFile('synthetic.fit', createSyntheticFitActivity(), { type: 'application/octet-stream' }),
        syntheticFile('synthetic.tcx', createSyntheticTcxActivity(), { type: 'application/xml' }),
        syntheticFile('synthetic.gpx', createSyntheticGpxActivity(), { type: '' })
    ];
    const results = await preflightSourceFiles(descriptors.map(entry => entry.file));
    assert.equal(results.every(result => result.ok), true);
});

test('XML root preflight has one bounded linear prolog scan', async () => {
    const pageSource = await readFile(new URL(
        '../../js/pages/source-manager/source-manager.js',
        import.meta.url
    ), 'utf8');
    assert.match(pageSource, /const XML_ROOT_SCAN_LIMIT = 65_536;/);
    assert.doesNotMatch(pageSource, /text\.slice\(cursor\)/);

    const root = createSyntheticTcxActivity({ xmlDeclaration: '' });
    const withinLimit = syntheticFile(
        'synthetic.tcx',
        `${'<!---->'.repeat(8_000)}${root}`
    );
    assert.equal((await preflightSourceFiles([withinLimit.file]))[0].ok, true);

    const beyondLimit = syntheticFile(
        'synthetic.tcx',
        `${'<!---->'.repeat(10_000)}${root}`
    );
    assert.equal(
        (await preflightSourceFiles([beyondLimit.file]))[0].code,
        'FILE_HEADER_INVALID'
    );
});

test('FIT, TCX, and GPX size limits reject +1 before reading bytes', async () => {
    const cases = [
        ['fit', 'maxFitBytes'],
        ['tcx', 'maxTcxBytes'],
        ['gpx', 'maxGpxBytes']
    ];
    for (const [suffix, limit] of cases) {
        const oversized = syntheticFile(`oversized.${suffix}`, '', {
            size: SOURCE_MANAGER_LIMITS[limit] + 1
        });
        const [result] = await preflightSourceFiles([oversized.file]);
        assert.equal(result.code, 'FILE_TOO_LARGE');
        assert.equal(oversized.reads(), 0);
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

    const native = new File([CSV], 'synthetic-safe.csv', { type: 'text/csv' });
    for (const field of ['name', 'size', 'type', 'arrayBuffer']) {
        Object.defineProperty(native, field, {
            configurable: true,
            get() {
                getters += 1;
                throw new Error(`private native ${field}`);
            }
        });
    }
    const [nativeResult] = await preflightSourceFiles([native]);
    assert.equal(nativeResult.ok, true);
    assert.equal(nativeResult.artifact.mediaType, 'text/csv;profile=strava-activities');
    assert.equal(getters, 0);
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
