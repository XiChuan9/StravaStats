import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IMPORT_ERROR_CODE } from '../../js/import/index.js';
import {
    ACTIVITIES_CSV_LIMITS,
    decodeActivitiesCsvUtf8,
    frameActivitiesCsv
} from '../../js/import/csv-tokenizer.js';
import {
    ACTIVITIES_CSV_MEDIA_TYPE,
    ENGLISH_ACTIVITIES_CSV_PROFILE,
    activitiesCsvDecoder,
    createActivitiesCsvDecoder
} from '../../js/import/activities-csv-decoder.js';

const fixtureUrl = new URL(
    '../fixtures/synthetic/strava/activities.csv',
    import.meta.url
);

function oneRow(values, headers = [
    'Activity ID',
    'Activity Date',
    'Activity Type'
]) {
    return `${headers.join(',')}\n${values.join(',')}`;
}

function decode(content, decoder = activitiesCsvDecoder) {
    return decoder.decode({
        mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
        content
    });
}

function expectCode(code) {
    return error => error.code === code
        && !Object.hasOwn(error, 'cause')
        && !JSON.stringify(error).includes('private');
}

test('fixture frames two rows and maps deterministic summary-only bundles', async () => {
    const content = await readFile(fixtureUrl, 'utf8');
    const framed = frameActivitiesCsv(content);
    assert.equal(framed.length, 2);

    const first = decode(framed[0]);
    assert.equal(first.activity.id, 'strava-archive:00042');
    assert.equal(first.sources[0].externalId, '00042');
    assert.equal(first.activity.startTimeUtc, '2026-01-02T13:05:06.000Z');
    assert.equal(first.activity.sportCategory, 'run');
    assert.equal(first.activity.sportVariant, 'trail-run');
    assert.equal(first.activity.name, '=SUM(1,2) "Synthetic Run"');
    assert.equal(first.activity.distanceMeters, 5000);
    assert.equal(first.activity.elapsedTimeSeconds, 3661);
    assert.equal(first.activity.movingTimeSeconds, 3600);
    assert.equal(first.activity.elevationGainMeters, 120);
    assert.equal(first.activity.averageHeartRateBpm, 150);
    assert.equal(first.activity.averagePowerWatts, 250);
    assert.equal(first.activity.averageCadence, 80);
    assert.deepEqual(first.activity.capabilities, {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: false
    });
    assert.deepEqual(first.streams, {
        activityId: first.activity.id,
        series: []
    });
    assert.deepEqual(first.laps, []);
    assert.deepEqual(first.events, []);
    assert.deepEqual(first.devices, []);

    const second = decode(framed[1]);
    assert.equal(
        second.activity.id,
        'strava-archive:alpha%2Fbeta%20%3F%23%25'
    );
    assert.equal(second.activity.name, 'Synthetic,\nMultiline');
    assert.equal(second.activity.sportCategory, 'other');
    assert.equal(second.activity.distanceMeters, 0);
    assert.equal(second.activity.averageHeartRateBpm, null);
    assert.ok(second.warnings.some(warning => (
        warning.code === 'CSV_UNKNOWN_SPORT_TYPE'
    )));
    assert.equal(Object.isFrozen(second), true);
});

test('tokenizer accepts BOM, CRLF, quoted commas/newlines, and escaped quotes', () => {
    const content = '\uFEFFActivity ID,Activity Date,Activity Name,Activity Type\r\n'
        + 'opaque-1,"Jan 02, 2026, 1:05:06 PM","formula, ""quoted""\nline",Run\r\n';
    const [framed] = frameActivitiesCsv(content);
    const bundle = decode(framed);
    assert.equal(bundle.activity.name, 'formula, "quoted"\nline');
    assert.equal(bundle.activity.id, 'strava-archive:opaque-1');
});

test('row framing preserves lexical bytes for exact raw SHA semantics', () => {
    const plain = frameActivitiesCsv(
        'Activity ID,Activity Date,Activity Type\n'
        + 'opaque,2026-01-01T00:00:00Z,Run\n'
    );
    const quoted = frameActivitiesCsv(
        'Activity ID,Activity Date,Activity Type\r\n'
        + 'opaque,2026-01-01T00:00:00Z,"Run"\r\n'
    );
    assert.notEqual(plain[0], quoted[0]);
    assert.match(plain[0], /,Run\n$/);
    assert.match(quoted[0], /,"Run"\r\n$/);
    assert.equal(decode(plain[0]).activity.id, decode(quoted[0]).activity.id);
});

test('known repeated headers use the frozen occurrence and ambiguous duplicates fail', () => {
    const valid = 'Activity ID,Activity Date,Activity Type,Distance,Distance\n'
        + 'opaque,2026-01-01T00:00:00Z,Run,1,2';
    assert.equal(decode(valid).activity.distanceMeters, 2000);

    const invalid = 'Activity ID,Activity Date,Activity Type,Distance,Distance,Distance\n'
        + 'opaque,2026-01-01T00:00:00Z,Run,1,2,3';
    assert.throws(
        () => decode(invalid),
        expectCode(IMPORT_ERROR_CODE.CSV_HEADER_INVALID)
    );
    assert.throws(
        () => decode(
            'Activity ID,Activity ID,Activity Date,Activity Type\n'
            + 'opaque,opaque,2026-01-01T00:00:00Z,Run'
        ),
        expectCode(IMPORT_ERROR_CODE.CSV_HEADER_INVALID)
    );
});

test('required, optional, and extra headers have stable fail/degrade semantics', () => {
    assert.throws(
        () => decode('Activity ID,Activity Type\nopaque,Run'),
        expectCode(IMPORT_ERROR_CODE.CSV_HEADER_INVALID)
    );
    const bundle = decode(
        'Activity ID,Activity Date,Activity Type,Unmapped Synthetic\n'
        + 'opaque,2026-01-01T00:00:00Z,Run,ignored'
    );
    assert.equal(Object.hasOwn(bundle.activity, 'distanceMeters'), false);
    assert.ok(bundle.warnings.some(warning => (
        warning.code === 'CSV_OPTIONAL_HEADER_MISSING'
    )));
    assert.ok(bundle.warnings.some(warning => (
        warning.code === 'CSV_EXTRA_HEADER_IGNORED'
    )));
});

test('blank physical rows are ignored while empty and header-only files fail', () => {
    const framed = frameActivitiesCsv(
        '\nActivity ID,Activity Date,Activity Type\n\n'
        + 'opaque,2026-01-01T00:00:00Z,Run\n\n'
    );
    assert.equal(framed.length, 1);
    assert.throws(
        () => frameActivitiesCsv(''),
        expectCode(IMPORT_ERROR_CODE.FILE_EMPTY)
    );
    assert.throws(
        () => frameActivitiesCsv('Activity ID,Activity Date,Activity Type\n'),
        expectCode(IMPORT_ERROR_CODE.FILE_EMPTY)
    );
});

test('an all-empty data record is not discarded as a blank physical line', () => {
    const [framed] = frameActivitiesCsv(
        'Activity ID,Activity Date,Activity Type\n,,'
    );
    assert.throws(
        () => decode(framed),
        expectCode(IMPORT_ERROR_CODE.CSV_ACTIVITY_ID_INVALID)
    );
});

test('fatal UTF-8 and forbidden characters fail with stable redacted codes', () => {
    assert.throws(
        () => decodeActivitiesCsvUtf8(Uint8Array.from([0xc3, 0x28])),
        expectCode(IMPORT_ERROR_CODE.CSV_INVALID_ENCODING)
    );
    for (const value of ['\u0000', '\u0001', '\uFFFD', '\uD800']) {
        assert.throws(
            () => frameActivitiesCsv(
                `Activity ID,Activity Date,Activity Type\nopaque,2026-01-01T00:00:00Z,Run${value}`
            ),
            expectCode(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER)
        );
    }
});

test('CSV byte, row, column, field, and row limits fail closed', () => {
    assert.deepEqual(ACTIVITIES_CSV_LIMITS, {
        maxBytes: 5_242_880,
        maxRows: 10_000,
        maxColumns: 128,
        maxFieldBytes: 262_144,
        maxRowBytes: 1_048_576
    });
    const columns = Array.from({ length: 129 }, (_, index) => `h${index}`);
    assert.throws(
        () => frameActivitiesCsv(`${columns.join(',')}\n${columns.join(',')}`),
        expectCode(IMPORT_ERROR_CODE.CSV_TOO_MANY_COLUMNS)
    );
    const hugeField = 'x'.repeat(ACTIVITIES_CSV_LIMITS.maxFieldBytes + 1);
    assert.throws(
        () => frameActivitiesCsv(`Activity ID,Activity Date,Activity Type\n${hugeField},2026-01-01T00:00:00Z,Run`),
        expectCode(IMPORT_ERROR_CODE.CSV_FIELD_TOO_LARGE)
    );
    const rows = Array.from(
        { length: ACTIVITIES_CSV_LIMITS.maxRows + 1 },
        (_, index) => `opaque-${index},2026-01-01T00:00:00Z,Run`
    );
    assert.throws(
        () => frameActivitiesCsv(`Activity ID,Activity Date,Activity Type\n${rows.join('\n')}`),
        expectCode(IMPORT_ERROR_CODE.CSV_TOO_MANY_ROWS)
    );
    assert.throws(
        () => frameActivitiesCsv('x'.repeat(ACTIVITIES_CSV_LIMITS.maxBytes + 1)),
        expectCode(IMPORT_ERROR_CODE.CSV_TOO_LARGE)
    );
    const wideFields = Array.from({ length: 5 }, () => (
        'x'.repeat(220_000)
    ));
    assert.throws(
        () => frameActivitiesCsv(
            `h1,h2,h3,h4,h5\n${wideFields.join(',')}`
        ),
        expectCode(IMPORT_ERROR_CODE.CSV_ROW_TOO_LARGE)
    );
});

test('dates, units, finite numbers, and time relations are strict', () => {
    assert.equal(
        decode(oneRow(['opaque-midnight', '"Jan 01, 2024, 12:00:00 AM"', 'Run']))
            .activity.startTimeUtc,
        '2024-01-01T00:00:00.000Z'
    );
    assert.equal(
        decode(oneRow(['opaque-noon', '"Feb 29, 2024, 12:00:00 PM"', 'Run']))
            .activity.startTimeUtc,
        '2024-02-29T12:00:00.000Z'
    );
    assert.equal(
        decode(oneRow(['opaque-ms', '2026-01-01T00:00:00.123Z', 'Run']))
            .activity.startTimeUtc,
        '2026-01-01T00:00:00.123Z'
    );
    for (const date of [
        'Feb 29, 2025, 1:00:00 PM',
        '2026-02-30T00:00:00Z',
        '01/02/2026 10:00'
    ]) {
        assert.throws(
            () => decode(oneRow(['opaque', `"${date}"`, 'Run'])),
            expectCode(IMPORT_ERROR_CODE.CSV_DATE_INVALID)
        );
    }
    for (const value of ['Infinity', 'NaN', '-1']) {
        assert.throws(
            () => decode(oneRow(
                ['opaque', '2026-01-01T00:00:00Z', 'Run', value],
                ['Activity ID', 'Activity Date', 'Activity Type', 'Distance']
            )),
            expectCode(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID)
        );
    }
    assert.throws(
        () => decode(oneRow(
            ['opaque', '2026-01-01T00:00:00Z', 'Run', '5 km'],
            ['Activity ID', 'Activity Date', 'Activity Type', 'Distance']
        )),
        expectCode(IMPORT_ERROR_CODE.CSV_UNIT_INVALID)
    );
    assert.throws(
        () => decode(oneRow(
            ['opaque', '2026-01-01T00:00:00Z', 'Run', '20', '21'],
            [
                'Activity ID', 'Activity Date', 'Activity Type',
                'Elapsed Time', 'Moving Time'
            ]
        )),
        expectCode(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID)
    );
    assert.throws(
        () => decode(oneRow(
            ['opaque', '2026-01-01T00:00:00Z', 'Run', '301'],
            [
                'Activity ID', 'Activity Date', 'Activity Type',
                'Average Heart Rate'
            ]
        )),
        expectCode(IMPORT_ERROR_CODE.CSV_NUMBER_INVALID)
    );
    assert.equal(
        decode(oneRow(
            ['opaque-small', '2026-01-01T00:00:00Z', 'Run', '1e-3'],
            ['Activity ID', 'Activity Date', 'Activity Type', 'Distance']
        )).activity.distanceMeters,
        1
    );
});

test('date output is identical across host locales and time zones', () => {
    const moduleUrl = new URL(
        '../../js/import/activities-csv-decoder.js',
        import.meta.url
    ).href;
    const script = `
        import { ACTIVITIES_CSV_MEDIA_TYPE, activitiesCsvDecoder } from ${JSON.stringify(moduleUrl)};
        const value = activitiesCsvDecoder.decode({
            mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
            content: 'Activity ID,Activity Date,Activity Type\\nopaque,"Jan 02, 2026, 1:05:06 PM",Run'
        });
        process.stdout.write(value.activity.startTimeUtc);
    `;
    const output = timezone => execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        { encoding: 'utf8', env: { ...process.env, TZ: timezone, LANG: 'C' } }
    );
    assert.equal(output('UTC'), '2026-01-02T13:05:06.000Z');
    assert.equal(output('UTC'), output('Asia/Shanghai'));
    assert.equal(output('UTC'), output('America/Los_Angeles'));
});

test('time-zone metadata is exact, nullable, and fail-closed', () => {
    const valid = decode(oneRow(
        ['opaque', '2026-01-01T00:00:00Z', 'Run', '"(GMT-08:30) America/Los_Angeles"'],
        ['Activity ID', 'Activity Date', 'Activity Type', 'Activity Time Zone']
    ));
    assert.deepEqual(valid.activity.timeZone, {
        ianaName: 'America/Los_Angeles',
        utcOffsetMinutes: -510
    });
    assert.deepEqual(decode(oneRow(
        ['opaque-max-zone', '2026-01-01T00:00:00Z', 'Run', '"(GMT+14:00) Etc/UTC"'],
        ['Activity ID', 'Activity Date', 'Activity Type', 'Activity Time Zone']
    )).activity.timeZone, {
        ianaName: 'Etc/UTC',
        utcOffsetMinutes: 840
    });
    const missing = decode(oneRow([
        'opaque-missing-zone', '2026-01-01T00:00:00Z', 'Run'
    ]));
    assert.deepEqual(missing.activity.timeZone, {
        ianaName: null,
        utcOffsetMinutes: null
    });
    assert.throws(
        () => decode(oneRow(
            ['opaque', '2026-01-01T00:00:00Z', 'Run', '"(GMT+15:00) Etc/UTC"'],
            ['Activity ID', 'Activity Date', 'Activity Type', 'Activity Time Zone']
        )),
        expectCode(IMPORT_ERROR_CODE.CSV_DATE_INVALID)
    );
});

test('missing header, empty cell, zero, and value remain distinct', () => {
    const missing = decode(oneRow([
        'opaque-missing', '2026-01-01T00:00:00Z', 'Run'
    ]));
    const empty = decode(oneRow(
        ['opaque-empty', '2026-01-01T00:00:00Z', 'Run', ''],
        ['Activity ID', 'Activity Date', 'Activity Type', 'Distance']
    ));
    const zero = decode(oneRow(
        ['opaque-zero', '2026-01-01T00:00:00Z', 'Run', '0'],
        ['Activity ID', 'Activity Date', 'Activity Type', 'Distance']
    ));
    assert.equal(Object.hasOwn(missing.activity, 'distanceMeters'), false);
    assert.equal(empty.activity.distanceMeters, null);
    assert.equal(zero.activity.distanceMeters, 0);
});

test('registered English sports reuse source-neutral Canonical variants', () => {
    const cases = [
        ['Virtual Ride', 'ride', 'virtual'],
        ['Indoor Ride', 'ride', 'indoor'],
        ['Pool Swim', 'swim', 'pool'],
        ['Weight Training', 'workout', 'strength'],
        ['Crossfit', 'workout', 'cross-training'],
        ['Elliptical', 'workout', 'elliptical'],
        ['Stair Stepper', 'workout', 'stair-stepper'],
        ['Soccer', 'team', 'football'],
        ['Padel', 'racket', 'padel']
    ];
    for (const [label, category, variant] of cases) {
        const bundle = decode(oneRow([
            `opaque-${variant}`,
            '2026-01-01T00:00:00Z',
            label
        ]));
        assert.equal(bundle.activity.sportCategory, category);
        assert.equal(bundle.activity.sportVariant, variant);
    }
});

test('profile factory is a descriptor-safe locale extension seam', () => {
    const custom = structuredClone(ENGLISH_ACTIVITIES_CSV_PROFILE);
    custom.id = 'synthetic-locale';
    custom.headers.activityId = ['Synthetic ID'];
    custom.headers.startTime = ['Synthetic Date'];
    custom.headers.sportType = ['Synthetic Sport'];
    const decoder = createActivitiesCsvDecoder(custom);
    custom.headers.activityId[0] = 'Mutated ID';
    const bundle = decode(
        'Synthetic ID,Synthetic Date,Synthetic Sport\n'
        + 'opaque,2026-01-01T00:00:00Z,Run',
        decoder
    );
    assert.equal(bundle.activity.id, 'strava-archive:opaque');

    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'id', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'private';
        }
    });
    assert.throws(
        () => createActivitiesCsvDecoder(hostile),
        expectCode(IMPORT_ERROR_CODE.INVALID_REQUEST)
    );
    assert.equal(getterCalls, 0);
});

test('column mismatch and malformed quoting are deterministic and redacted', () => {
    assert.throws(
        () => decode('Activity ID,Activity Date,Activity Type\nopaque,2026-01-01T00:00:00Z'),
        expectCode(IMPORT_ERROR_CODE.CSV_COLUMN_MISMATCH)
    );
    assert.throws(
        () => frameActivitiesCsv(
            'Activity ID,Activity Date,Activity Type\nprivate,"unterminated,Run'
        ),
        expectCode(IMPORT_ERROR_CODE.CSV_MALFORMED)
    );
    assert.throws(
        () => frameActivitiesCsv(
            'Activity ID,Activity Date,Activity Type\rprivate,2026-01-01T00:00:00Z,Run'
        ),
        expectCode(IMPORT_ERROR_CODE.CSV_MALFORMED)
    );
});

test('PR-08 public error and bundle warning code allowlists are exact', () => {
    assert.deepEqual(
        Object.keys(IMPORT_ERROR_CODE).filter(code => (
            code.startsWith('CSV_') || code === 'EXACT_IDENTITY_CONFLICT'
        )),
        [
            'CSV_INVALID_ENCODING',
            'CSV_INVALID_CHARACTER',
            'CSV_TOO_LARGE',
            'CSV_TOO_MANY_ROWS',
            'CSV_TOO_MANY_COLUMNS',
            'CSV_FIELD_TOO_LARGE',
            'CSV_ROW_TOO_LARGE',
            'CSV_MALFORMED',
            'CSV_HEADER_INVALID',
            'CSV_COLUMN_MISMATCH',
            'CSV_ACTIVITY_ID_INVALID',
            'CSV_DATE_INVALID',
            'CSV_NUMBER_INVALID',
            'CSV_UNIT_INVALID',
            'EXACT_IDENTITY_CONFLICT'
        ]
    );
    const bundle = decode(
        'Activity ID,Activity Date,Activity Type,Synthetic Extra\n'
        + 'opaque-warning,2026-01-01T00:00:00Z,Unknown Synthetic,ignored'
    );
    assert.deepEqual(
        [...new Set(bundle.warnings.map(warning => warning.code))].sort(),
        [
            'CSV_EXTRA_HEADER_IGNORED',
            'CSV_IMPORT_TIME_FALLBACK',
            'CSV_OPTIONAL_HEADER_MISSING',
            'CSV_TIMEZONE_UNAVAILABLE',
            'CSV_UNKNOWN_SPORT_TYPE'
        ]
    );
    assert.doesNotMatch(JSON.stringify(bundle.warnings), /opaque-warning|Unknown Synthetic/);
});
