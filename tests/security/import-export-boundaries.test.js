import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CSVExporter } from '../../js/analysis/export/csv.js';
import {
    boundedCsvLines,
    CSV_FILE_LIMITS,
    serializeCsvCell,
    spreadsheetTextCell
} from '../../js/shared/csv-security.js';
import {
    parseGarminHrvCsv,
    readGarminHrvFile
} from '../../js/tabs/dashboard.js';

const syntheticHrv = 'Date,Nightly HRV,Reference,7 Day Average\n'
    + '2026-01-01,50,40 to 60,48\n';

test('spreadsheet text prefix covers formulas, whitespace, and controls', () => {
    const dangerous = [
        '=1+1',
        '+cmd',
        '-2+3',
        '@SUM(A1:A2)',
        '  =HYPERLINK("https://invalid.example")',
        '\u00a0+cmd',
        '\tformula',
        ' \u0007formula',
        '\nformula',
        '\u007fformula',
        '\u0085formula',
        '\u202e=formula'
    ];
    for (const value of dangerous) {
        assert.equal(spreadsheetTextCell(value), `'${value}`);
    }
    for (const value of ['', '   ', 'ordinary', '1+1', "'already-text", null, undefined]) {
        assert.equal(spreadsheetTextCell(value), value == null ? '' : String(value));
    }
});

test('shared CSV serializer neutralizes before applying RFC-style quoting', () => {
    assert.equal(serializeCsvCell('ordinary'), 'ordinary');
    assert.equal(serializeCsvCell('=formula'), "'=formula");
    assert.equal(serializeCsvCell(' =formula'), "' =formula");
    assert.equal(serializeCsvCell('a,b'), '"a,b"');
    assert.equal(serializeCsvCell('a"b'), '"a""b"');
    assert.equal(serializeCsvCell('a\r\nb'), '"a\r\nb"');
    assert.equal(serializeCsvCell('@formula', true), '"\'@formula"');
    assert.throws(() => serializeCsvCell('value', 'true'), TypeError);
});

test('all production CSV sinks use the shared serializer boundary', async () => {
    const paths = [
        '../../js/app/ui.js',
        '../../js/tabs/activities.js',
        '../../js/analysis/export/csv.js'
    ];
    for (const path of paths) {
        const source = await readFile(new URL(path, import.meta.url), 'utf8');
        assert.match(source, /import \{ serializeCsvCell \}/);
        assert.ok(source.match(/serializeCsvCell\(/g)?.length >= 1);
        assert.doesNotMatch(source, /spreadsheetTextCell/);
    }
});

test('analysis CSV export emits formula-like derived values as text', () => {
    const point = {
        timestamp: '2026-01-01T00:00:00.000Z',
        distance_from_start: 1,
        pace: { minutes: '=cmd', seconds: 0 },
        moving: true
    };
    const csv = CSVExporter.export({ points: [point] });
    assert.equal(csv.split('\n')[1].split(',')[6], "'=cmd:00");
    assert.deepEqual(point.pace, { minutes: '=cmd', seconds: 0 });
});

test('HRV CSV enforces the exact shared byte and data-row limits', () => {
    assert.deepEqual(CSV_FILE_LIMITS, { maxBytes: 5_242_880, maxRows: 10_000 });
    const exactBytes = `h\n${'x'.repeat(CSV_FILE_LIMITS.maxBytes - 2)}`;
    assert.equal(boundedCsvLines(exactBytes).length, 2);
    assert.throws(
        () => boundedCsvLines(`${exactBytes}x`),
        error => error instanceof RangeError && error.code === 'CSV_TOO_LARGE'
    );

    const exactRows = `header\n${Array.from(
        { length: CSV_FILE_LIMITS.maxRows },
        (_, index) => `row-${index}`
    ).join('\n')}`;
    assert.equal(boundedCsvLines(exactRows).length, CSV_FILE_LIMITS.maxRows + 1);
    assert.throws(
        () => boundedCsvLines(`${exactRows}\nover-limit`),
        error => error instanceof RangeError && error.code === 'CSV_TOO_MANY_ROWS'
    );
});

test('HRV parsing is bounded before storage and preserves valid behavior', () => {
    const parsed = parseGarminHrvCsv(syntheticHrv);
    assert.equal(parsed.entries.length, 1);
    assert.deepEqual(parsed.entries[0], {
        date: '2026-01-01',
        nightly: 50,
        referenceLow: 40,
        referenceHigh: 60,
        avg7: 48
    });
    const rows = Array.from(
        { length: CSV_FILE_LIMITS.maxRows + 1 },
        () => '2026-01-01,50,40 to 60,48'
    );
    assert.throws(
        () => parseGarminHrvCsv(`${syntheticHrv.split('\n')[0]}\n${rows.join('\n')}`),
        error => error instanceof RangeError && error.code === 'CSV_TOO_MANY_ROWS'
    );
});

test('HRV native size preflight runs before text allocation and post-read bytes are checked', async () => {
    let oversizedRead = false;
    class OversizedCsv extends Blob {
        get size() {
            return CSV_FILE_LIMITS.maxBytes + 1;
        }

        async text() {
            oversizedRead = true;
            return syntheticHrv;
        }
    }
    await assert.rejects(readGarminHrvFile(new OversizedCsv()), RangeError);
    assert.equal(oversizedRead, false);

    let declaredRead = false;
    const forgedSize = {
        size: 1,
        async text() {
            declaredRead = true;
            return 'x'.repeat(CSV_FILE_LIMITS.maxBytes + 1);
        }
    };
    await assert.rejects(
        readGarminHrvFile(forgedSize),
        error => error instanceof RangeError && error.code === 'CSV_TOO_LARGE'
    );
    assert.equal(declaredRead, true);

    const parsed = await readGarminHrvFile(new Blob([syntheticHrv]));
    assert.equal(parsed.entries.length, 1);
});
