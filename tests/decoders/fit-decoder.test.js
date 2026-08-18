import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import { validateImportedActivityBundle } from '../../js/data/contracts/index.js';
import {
    FIT_LIMITS,
    FIT_MEDIA_TYPE,
    fitDecoder
} from '../../js/decoders/fit/decoder.js';
import { IMPORT_ERROR_CODE } from '../../js/import/errors.js';
import {
    FIT_START_TIMESTAMP,
    createFitBytes,
    createSyntheticFitActivity,
    createSyntheticFitRecords,
    fitCompressed,
    fitData,
    fitDefinition,
    fitField,
    fitRawRecord,
    syntheticFitBase64,
    syntheticFitDescriptor
} from '../fixtures/synthetic/fit/fit-fixture.js';

function decode(options = {}) {
    return fitDecoder.decode(
        syntheticFitDescriptor(createSyntheticFitActivity(options))
    );
}

function assertImportError(action, code = IMPORT_ERROR_CODE.FILE_CORRUPTED) {
    assert.throws(action, (error) => {
        assert.equal(error.name, 'ImportError');
        assert.equal(error.code, code);
        assert.equal(error.retryable, false);
        assert.equal(error.stage, 'decode');
        return true;
    });
}

function withByte(bytes, index, value) {
    const copy = Uint8Array.from(bytes);
    copy[index] = value;
    return copy;
}

function series(bundle, type) {
    return bundle.streams.series.find(item => item.streamType === type);
}

function warningCodes(bundle) {
    return bundle.warnings.map(item => item.code);
}

function decodeRecords(records, options = {}) {
    return fitDecoder.decode(syntheticFitDescriptor(createFitBytes({
        records,
        ...options
    })));
}

function writeUint32Little(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = value >>> 8 & 0xff;
    bytes[offset + 2] = value >>> 16 & 0xff;
    bytes[offset + 3] = value >>> 24 & 0xff;
}

test('FIT decoder descriptor is an internal immutable registry-shaped boundary', () => {
    assert.equal(fitDecoder.id, 'fit');
    assert.equal(fitDecoder.mediaType, FIT_MEDIA_TYPE);
    assert.equal(typeof fitDecoder.decode, 'function');
    assert.ok(Object.isFrozen(fitDecoder));
    assert.deepEqual(FIT_LIMITS, {
        maxDecodedBytes: 16_777_216,
        maxDefinitions: 4_096,
        maxNativeFields: 128,
        maxDeveloperFields: 128,
        maxMessageBytes: 4_096,
        maxDataRecords: 250_000,
        maxRecordPoints: 200_000,
        maxHeartRatePoints: 200_000,
        maxLaps: 10_000,
        maxEvents: 10_000,
        maxDevices: 64
    });
    assert.ok(Object.isFrozen(FIT_LIMITS));
});

test('Garmin Run maps the frozen message set to a valid Canonical bundle', () => {
    const bundle = decode();
    assert.equal(bundle.activity.id, 'fit-session:1:100:7:1123455940:1123456000');
    assert.equal(bundle.activity.name, 'Imported Run');
    assert.equal(bundle.activity.sportCategory, 'run');
    assert.equal(bundle.activity.sportVariant, null);
    assert.equal(bundle.activity.distanceMeters, 1000);
    assert.equal(bundle.activity.movingTimeSeconds, 25);
    assert.equal(bundle.activity.elapsedTimeSeconds, 30);
    assert.equal(bundle.activity.elevationGainMeters, 12);
    assert.equal(bundle.activity.averageHeartRateBpm, 145);
    assert.equal(bundle.activity.averagePowerWatts, 200);
    assert.equal(bundle.activity.averageCadence, 80);
    assert.deepEqual(bundle.activity.timeZone, {
        ianaName: null,
        utcOffsetMinutes: null
    });
    assert.deepEqual(bundle.activity.capabilities, {
        hasGps: true,
        hasHeartRate: true,
        hasPower: true,
        hasCadence: true,
        hasLaps: true
    });
    assert.deepEqual(bundle.streams.series.map(item => item.streamType), [
        'position',
        'distance',
        'speed',
        'heartRate',
        'power',
        'cadence'
    ]);
    assert.deepEqual(series(bundle, 'power').values, [0, 240]);
    assert.deepEqual(series(bundle, 'cadence').values, [0, 88]);
    assert.deepEqual(bundle.events.map(item => item.type), ['start', 'stop']);
    assert.equal(bundle.laps.length, 1);
    assert.deepEqual(bundle.devices, [{
        id: `${bundle.activity.id}:device:0`,
        manufacturer: 'Garmin',
        model: 'Synthetic Device'
    }]);
    assert.equal(bundle.sources[0].externalId, null);
    assert.equal(bundle.sources[0].rawArtifactId, null);
    assert.equal(bundle.sources[0].importedAt, bundle.activity.startTimeUtc);
    assert.deepEqual(warningCodes(bundle), [
        'FIT_IMPORT_TIME_FALLBACK',
        'FIT_TIMEZONE_UNAVAILABLE'
    ]);
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
    assert.ok(Object.isFrozen(bundle));
    assert.ok(Object.isFrozen(bundle.streams.series[0].values));
});

const PROFILE_CASES = [
    {
        name: 'Garmin Pool Swim',
        options: {
            sport: 5,
            subSport: 17,
            includeGps: false,
            includeHeartRate: false,
            includePower: false,
            includeCadence: false,
            poolLength: 2500
        },
        expected: ['swim', 'pool', 'Garmin']
    },
    {
        name: 'COROS Run',
        options: { manufacturer: 294, productName: 'Synthetic COROS' },
        expected: ['run', null, 'COROS']
    },
    {
        name: 'Wahoo Ride',
        options: {
            manufacturer: 32,
            productName: 'Synthetic Wahoo',
            sport: 2,
            subSport: 7
        },
        expected: ['ride', 'road', 'Wahoo']
    },
    {
        name: 'Zwift Ride',
        options: {
            manufacturer: 260,
            productName: 'Synthetic Zwift',
            sport: 2,
            subSport: 58,
            includeGps: false
        },
        expected: ['ride', 'virtual', 'Zwift']
    },
    {
        name: 'Indoor Run',
        options: { subSport: 45, includeGps: false },
        expected: ['run', 'indoor', 'Garmin']
    },
    {
        name: 'Trail Run',
        options: { subSport: 3 },
        expected: ['run', 'trail-run', 'Garmin']
    },
    {
        name: 'Mountain Bike Ride',
        options: { sport: 2, subSport: 8 },
        expected: ['ride', 'mountain-bike', 'Garmin']
    }
];

for (const profileCase of PROFILE_CASES) {
    test(`${profileCase.name} maps deterministic sport and device provenance`, () => {
        const bundle = decode(profileCase.options);
        assert.equal(bundle.activity.sportCategory, profileCase.expected[0]);
        assert.equal(bundle.activity.sportVariant, profileCase.expected[1]);
        assert.equal(bundle.devices[0].manufacturer, profileCase.expected[2]);
        assert.equal(validateImportedActivityBundle(bundle).ok, true);
        if (profileCase.name === 'Garmin Pool Swim') {
            assert.deepEqual(bundle.activity.extensions, {
                fit: { poolLengthMeters: 25 }
            });
            assert.equal(bundle.activity.capabilities.hasGps, false);
            assert.equal(series(bundle, 'position'), undefined);
        }
    });
}

test('No GPS omits position detail and does not fabricate coordinates', () => {
    const bundle = decode({ includeGps: false });
    assert.equal(bundle.activity.capabilities.hasGps, false);
    assert.equal(series(bundle, 'position'), undefined);
});

test('No HR preserves explicit invalid summary as null and omits HR detail', () => {
    const bundle = decode({ includeHeartRate: false });
    assert.equal(bundle.activity.averageHeartRateBpm, null);
    assert.equal(bundle.activity.capabilities.hasHeartRate, false);
    assert.equal(series(bundle, 'heartRate'), undefined);
});

test('absent, invalid-null, and real-zero FIT fields remain distinct', () => {
    const absentRecords = createSyntheticFitRecords({ includeHeartRate: false })
        .map((record) => {
            if (record.kind !== 'definition' || record.localMessage !== 5) return record;
            return fitDefinition(5, 18, record.fields.filter(item => item.number !== 16));
        });
    const absent = decodeRecords(absentRecords);
    const invalid = decode({ includeHeartRate: false });
    const zero = decode();
    assert.equal(Object.hasOwn(absent.activity, 'averageHeartRateBpm'), false);
    assert.equal(invalid.activity.averageHeartRateBpm, null);
    assert.equal(series(zero, 'power').values[0], 0);
});

test('a partial position is null rather than a fabricated coordinate', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (
            record.kind === 'data'
            && record.localMessage === 3
            && record.values[253] === FIT_START_TIMESTAMP
        ) return fitData(3, { ...record.values, 1: null });
        return record;
    });
    assert.deepEqual(series(decodeRecords(records), 'position').values, [
        null,
        [
            476_741_600 * 180 / 2 ** 31,
            1_405_249_900 * 180 / 2 ** 31
        ]
    ]);
});

test('native and enhanced altitude apply FIT scale/offset and preserve missing rows', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (record.kind !== 'definition' || record.localMessage !== 3) return record;
        return fitDefinition(3, 20, [
            ...record.fields,
            fitField(2, 'uint16'),
            fitField(78, 'uint32')
        ]);
    });
    const dataIndexes = records.flatMap((record, index) =>
        record.kind === 'data' && record.localMessage === 3 ? [index] : []
    );
    records[dataIndexes[0]] = fitData(3, {
        ...records[dataIndexes[0]].values,
        2: 2500,
        78: null
    });
    records[dataIndexes[1]] = fitData(3, {
        ...records[dataIndexes[1]].values,
        2: null,
        78: 2600
    });
    records.splice(dataIndexes[1] + 1, 0, fitData(3, {
        253: FIT_START_TIMESTAMP + 20,
        2: null,
        78: null
    }));
    const altitude = series(decodeRecords(records), 'altitude');
    assert.deepEqual(altitude.offsetsSeconds, [0, 10, 20]);
    assert.deepEqual(altitude.values, [0, 20, null]);
});

test('Split records fold non-conflicting fields at equal timestamps', () => {
    const bundle = decode({ splitRecords: true });
    assert.deepEqual(series(bundle, 'distance').offsetsSeconds, [0, 10]);
    assert.deepEqual(series(bundle, 'heartRate').values, [140, 150]);
    assert.deepEqual(series(bundle, 'power').values, [0, 240]);
});

test('Split records fail closed when non-null values conflict', () => {
    const records = createSyntheticFitRecords({ splitRecords: true });
    const firstSplitIndex = records.findIndex(record =>
        record.kind === 'data'
        && record.localMessage === 7
        && record.values[253] === FIT_START_TIMESTAMP
    );
    records.splice(firstSplitIndex + 1, 0, fitData(7, {
        ...records[firstSplitIndex].values,
        3: 141
    }));
    assertImportError(() => decodeRecords(records));
});

test('Header and file CRC mismatches are stable warnings, not integrity claims', () => {
    const bundle = decode({ corruptHeaderCrc: true, corruptFileCrc: true });
    assert.deepEqual(warningCodes(bundle), [
        'FIT_FILE_CRC_MISMATCH',
        'FIT_HEADER_CRC_MISMATCH',
        'FIT_IMPORT_TIME_FALLBACK',
        'FIT_TIMEZONE_UNAVAILABLE'
    ]);
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
});

test('Pause and resume event state is mapped in stable timestamp order', () => {
    const bundle = decode({ pauseResume: true });
    assert.deepEqual(bundle.events.map(item => item.type), [
        'start',
        'pause',
        'resume',
        'stop'
    ]);
    assert.deepEqual(bundle.events.map(item => item.offsetSeconds), [0, 10, 20, 30]);
});

test('segmented stop_all/start cycles map to pause/resume and final stop', () => {
    const records = createSyntheticFitRecords();
    const finalStopIndex = records.findIndex(record =>
        record.kind === 'data'
        && record.localMessage === 2
        && record.values[1] === 4
    );
    records.splice(finalStopIndex, 0,
        fitData(2, { 253: FIT_START_TIMESTAMP + 10, 0: 0, 1: 4 }),
        fitData(2, { 253: FIT_START_TIMESTAMP + 20, 0: 0, 1: 0 })
    );
    const bundle = decodeRecords(records);
    assert.deepEqual(bundle.events.map(item => item.type), [
        'start',
        'pause',
        'resume',
        'stop'
    ]);
    assert.deepEqual(bundle.events.map(item => item.offsetSeconds), [0, 10, 20, 30]);
    assert.ok(warningCodes(bundle).includes('FIT_EVENT_SEQUENCE_NORMALIZED'));
});

test('duplicate terminal stop_all is omitted with dense Canonical indices', () => {
    const records = createSyntheticFitRecords();
    const finalStopIndex = records.findIndex(record =>
        record.kind === 'data'
        && record.localMessage === 2
        && record.values[1] === 4
    );
    records.splice(finalStopIndex + 1, 0,
        fitData(2, { 253: FIT_START_TIMESTAMP + 30, 0: 0, 1: 4 })
    );
    const bundle = decodeRecords(records);
    assert.deepEqual(bundle.events.map(item => item.type), ['start', 'stop']);
    assert.deepEqual(bundle.events.map(item => item.index), [0, 1]);
    assert.ok(warningCodes(bundle).includes('FIT_EVENT_SEQUENCE_NORMALIZED'));
});

test('event time beyond the FIT session is safely bounded and warned', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (
            record.kind === 'data'
            && record.localMessage === 2
            && record.values[1] === 4
        ) return fitData(2, { ...record.values, 253: FIT_START_TIMESTAMP + 31 });
        return record;
    });
    const bundle = decodeRecords(records);
    assert.deepEqual(bundle.events.map(item => item.offsetSeconds), [0, 30]);
    assert.ok(warningCodes(bundle).includes('FIT_EVENT_TIME_BOUNDED'));
});

test('lap intervals are intersected with the session and made non-overlapping', () => {
    const records = createSyntheticFitRecords();
    const lapIndex = records.findIndex(record =>
        record.kind === 'data' && record.localMessage === 4
    );
    records.splice(lapIndex + 1, 0,
        fitData(4, {
            2: FIT_START_TIMESTAMP + 19,
            7: 15_000,
            8: 20_000,
            9: 50_000
        }),
        fitData(4, {
            2: FIT_START_TIMESTAMP + 31,
            7: 1_000,
            8: 1_000,
            9: 1_000
        })
    );
    const bundle = decodeRecords(records);
    assert.deepEqual(bundle.laps.map(item => ({
        index: item.index,
        start: item.startOffsetSeconds,
        elapsed: item.elapsedTimeSeconds,
        moving: item.movingTimeSeconds
    })), [
        { index: 0, start: 0, elapsed: 19, moving: 19 },
        { index: 1, start: 19, elapsed: 11, moving: 11 }
    ]);
    assert.ok(warningCodes(bundle).includes('FIT_LAP_TIME_NORMALIZED'));
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
});

test('HR messages expand deterministic fractional/event timestamp points', () => {
    const bundle = decode({ includeHrMessage: true });
    assert.deepEqual(series(bundle, 'heartRate').offsetsSeconds, [0, 5, 10]);
    assert.deepEqual(series(bundle, 'heartRate').values, [140, 155, 150]);
});

test('HR time256 supplies the fractional anchor when fractional_timestamp is absent', () => {
    const records = createSyntheticFitRecords({ includeHeartRate: false });
    const sessionIndex = records.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    records.splice(sessionIndex, 0,
        fitDefinition(8, 132, [
            fitField(253, 'uint32'),
            fitField(1, 'uint8'),
            fitField(6, 'uint8'),
            fitField(9, 'uint32')
        ]),
        fitData(8, {
            253: FIT_START_TIMESTAMP + 5,
            1: 128,
            6: 150,
            9: 4094
        })
    );
    assert.deepEqual(
        series(decodeRecords(records), 'heartRate').offsetsSeconds,
        [5.5]
    );
});

test('record HR preserves an invalid sample before a later numeric sample', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (
            record.kind === 'data'
            && record.localMessage === 3
            && record.values[253] === FIT_START_TIMESTAMP
        ) return fitData(3, { ...record.values, 3: null });
        return record;
    });
    const heartRate = series(decodeRecords(records), 'heartRate');
    assert.deepEqual(heartRate.offsetsSeconds, [0, 10]);
    assert.deepEqual(heartRate.values, [null, 150]);
});

test('out-of-range record HR is preserved as a null gap with an anonymous warning', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (
            record.kind === 'data'
            && record.localMessage === 3
            && record.values[253] === FIT_START_TIMESTAMP
        ) return fitData(3, { ...record.values, 3: 0 });
        return record;
    });
    const bundle = decodeRecords(records);
    assert.deepEqual(series(bundle, 'heartRate').values, [null, 150]);
    assert.ok(warningCodes(bundle).includes('FIT_HEART_RATE_SAMPLE_IGNORED'));
});

test('record HR preserves a timestamp whose definition omits the HR field', () => {
    const records = createSyntheticFitRecords();
    const definitionIndex = records.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 3
    );
    const definition = records[definitionIndex];
    const firstRecord = records[definitionIndex + 1];
    const secondRecord = records[definitionIndex + 2];
    const firstValues = Object.fromEntries(
        Object.entries(firstRecord.values).filter(([field]) => field !== '3')
    );
    records.splice(definitionIndex, 3,
        fitDefinition(3, 20, definition.fields.filter(field => field.number !== 3)),
        fitData(3, firstValues),
        definition,
        secondRecord
    );
    const heartRate = series(decodeRecords(records), 'heartRate');
    assert.deepEqual(heartRate.offsetsSeconds, [0, 10]);
    assert.deepEqual(heartRate.values, [null, 150]);
});

test('packed 12-bit HR event timestamps accumulate across rollover', () => {
    const records = createSyntheticFitRecords({ includeHeartRate: false });
    const sessionIndex = records.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    records.splice(sessionIndex, 0,
        fitDefinition(8, 132, [
            fitField(253, 'uint32'),
            fitField(6, 'uint8'),
            fitField(9, 'uint32')
        ]),
        fitData(8, {
            253: FIT_START_TIMESTAMP + 5,
            6: 150,
            9: 4094
        }),
        fitDefinition(9, 132, [
            fitField(6, 'uint8', 2),
            fitField(10, 'byte', 3)
        ]),
        fitData(9, {
            6: [151, 152],
            10: [0xff, 0x0f, 0x00]
        })
    );
    const heartRate = series(decodeRecords(records), 'heartRate');
    assert.deepEqual(heartRate.values, [150, 151, 152]);
    assert.deepEqual(heartRate.offsetsSeconds, [
        5,
        5 + 1 / 1024,
        5 + 2 / 1024
    ]);
});

test('packed 12-bit HR reconstruction preserves unsigned values above 2^31', () => {
    const records = createSyntheticFitRecords({ includeHeartRate: false });
    const sessionIndex = records.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    const previousRaw = 3_000_000_000;
    const first = (previousRaw + 1) & 0x0fff;
    const second = (previousRaw + 2) & 0x0fff;
    records.splice(sessionIndex, 0,
        fitDefinition(8, 132, [
            fitField(253, 'uint32'),
            fitField(6, 'uint8'),
            fitField(9, 'uint32')
        ]),
        fitData(8, {
            253: FIT_START_TIMESTAMP + 5,
            6: 150,
            9: previousRaw
        }),
        fitDefinition(9, 132, [
            fitField(6, 'uint8', 2),
            fitField(10, 'byte', 3)
        ]),
        fitData(9, {
            6: [151, 152],
            10: [
                first & 0xff,
                first >>> 8 & 0x0f | (second & 0x0f) << 4,
                second >>> 4
            ]
        })
    );
    const heartRate = series(decodeRecords(records), 'heartRate');
    assert.deepEqual(heartRate.values, [150, 151, 152]);
    assert.deepEqual(heartRate.offsetsSeconds, [
        5,
        5 + 1 / 1024,
        5 + 2 / 1024
    ]);
});

test('12-byte FIT headers are accepted', () => {
    assert.equal(decode({ headerSize: 12 }).activity.sportCategory, 'run');
});

test('big-endian message definitions decode without host-endian dependence', () => {
    const records = createSyntheticFitRecords().map(record =>
        record.kind === 'definition'
            ? fitDefinition(
                record.localMessage,
                record.globalMessage,
                record.fields,
                {
                    architecture: 1,
                    developerFields: record.developerFields
                }
            )
            : record
    );
    const bundle = decodeRecords(records);
    assert.equal(bundle.activity.distanceMeters, 1000);
    assert.deepEqual(series(bundle, 'power').values, [0, 240]);
});

test('compressed timestamps decode and reconstruct five-bit rollover', () => {
    const start = FIT_START_TIMESTAMP + 30;
    let recordDataCount = 0;
    const records = createSyntheticFitRecords({ start }).map((record) => {
        if (record.kind === 'data' && record.localMessage === 3) {
            recordDataCount += 1;
            if (recordDataCount === 2) {
                return fitCompressed(3, (start + 10) & 0x1f, record.values);
            }
        }
        return record;
    });
    const bundle = decodeRecords(records);
    assert.deepEqual(series(bundle, 'distance').offsetsSeconds, [0, 10]);
});

test('compressed timestamps use a full timestamp from an unknown message', () => {
    const start = FIT_START_TIMESTAMP;
    const records = createSyntheticFitRecords({ start });
    const recordIndexes = records.flatMap((record, index) =>
        record.kind === 'data' && record.localMessage === 3 ? [index] : []
    );
    const secondIndex = recordIndexes[1];
    const secondRecord = records[secondIndex];
    records.splice(secondIndex, 1,
        fitDefinition(9, 999, [fitField(253, 'uint32')]),
        fitData(9, { 253: start + 40 }),
        fitCompressed(3, (start + 41) & 0x1f, secondRecord.values)
    );
    assert.deepEqual(
        series(decodeRecords(records), 'distance').offsetsSeconds,
        [0, 41]
    );
});

test('compressed timestamps preserve the full uint32 range', () => {
    const start = 3_000_000_000;
    let recordDataCount = 0;
    const records = createSyntheticFitRecords({ start }).map((record) => {
        if (record.kind === 'data' && record.localMessage === 3) {
            recordDataCount += 1;
            if (recordDataCount === 2) {
                return fitCompressed(3, (start + 1) & 0x1f, record.values);
            }
        }
        return record;
    });
    assert.deepEqual(
        series(decodeRecords(records), 'distance').offsetsSeconds,
        [0, 1]
    );
});

test('valid developer fields are byte-counted, ignored, and warned once', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (record.kind === 'definition' && record.localMessage === 5) {
            return fitDefinition(5, 18, record.fields, {
                developerFields: [{ number: 1, size: 2, developerIndex: 0 }]
            });
        }
        if (record.kind === 'data' && record.localMessage === 5) {
            return fitData(5, record.values, [0xaa, 0x55]);
        }
        return record;
    });
    assert.ok(warningCodes(decodeRecords(records)).includes(
        'FIT_DEVELOPER_FIELDS_IGNORED'
    ));
});

test('unknown global messages are skipped only from complete definitions', () => {
    const records = createSyntheticFitRecords();
    records.splice(records.length - 2, 0,
        fitDefinition(9, 999, [fitField(253, 'uint32'), fitField(0, 'byte')]),
        fitData(9, { 253: FIT_START_TIMESTAMP + 1, 0: 42 })
    );
    assert.ok(warningCodes(decodeRecords(records)).includes(
        'FIT_UNKNOWN_MESSAGE_IGNORED'
    ));
});

test('unknown native and unsafe 64-bit fields are skipped without value access', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (record.kind === 'definition' && record.localMessage === 5) {
            return fitDefinition(5, 18, [
                ...record.fields,
                fitField(99, 'uint64')
            ]);
        }
        if (record.kind === 'data' && record.localMessage === 5) {
            return fitData(5, {
                ...record.values,
                99: 0xffff_ffff_ffff_fffen
            });
        }
        return record;
    });
    const bundle = decodeRecords(records);
    assert.ok(warningCodes(bundle).includes('FIT_UNKNOWN_FIELD_IGNORED'));
    assert.doesNotMatch(JSON.stringify(bundle), /184467/);
});

test('unmapped sports and manufacturers warn without exposing enum values', () => {
    const bundle = decode({ manufacturer: 500, sport: 99, subSport: 99 });
    assert.equal(bundle.activity.sportCategory, 'other');
    assert.equal(bundle.activity.sportVariant, null);
    assert.equal(bundle.devices[0].manufacturer, undefined);
    assert.ok(warningCodes(bundle).includes('FIT_SPORT_UNMAPPED'));
    assert.ok(warningCodes(bundle).includes('FIT_DEVICE_MANUFACTURER_UNMAPPED'));
    assert.doesNotMatch(JSON.stringify(bundle.warnings), /500|99/);
});

test('unsupported events remain redacted Canonical unknown events', () => {
    const records = createSyntheticFitRecords();
    const stopIndex = records.findIndex(record =>
        record.kind === 'data'
        && record.localMessage === 2
        && record.values[1] === 4
    );
    records.splice(stopIndex, 0,
        fitData(2, { 253: FIT_START_TIMESTAMP + 15, 0: 7, 1: 2 })
    );
    const bundle = decodeRecords(records);
    assert.equal(bundle.events[1].type, 'unknown');
    assert.equal(bundle.events[1].sourceType, 'fit-event');
    assert.ok(warningCodes(bundle).includes('FIT_EVENT_UNMAPPED'));
});

test('descriptor validation never executes accessors', () => {
    let executed = false;
    const descriptor = { mediaType: FIT_MEDIA_TYPE };
    Object.defineProperty(descriptor, 'content', {
        enumerable: true,
        get() {
            executed = true;
            return 'private-canary';
        }
    });
    assertImportError(
        () => fitDecoder.decode(descriptor),
        IMPORT_ERROR_CODE.FILE_CORRUPTED
    );
    assert.equal(executed, false);
});

test('throwing Proxy descriptors fail closed with a redacted public error', () => {
    const descriptor = new Proxy({}, {
        getPrototypeOf() {
            throw new Error('private-canary');
        }
    });
    assertImportError(
        () => fitDecoder.decode(descriptor),
        IMPORT_ERROR_CODE.FILE_CORRUPTED
    );
});

test('non-throwing Proxy descriptors are rejected after bounded reflection', () => {
    let reflectionTraps = 0;
    let valueReads = 0;
    const target = syntheticFitDescriptor(createSyntheticFitActivity());
    const descriptor = new Proxy(target, {
        getPrototypeOf(value) {
            reflectionTraps += 1;
            return Reflect.getPrototypeOf(value);
        },
        ownKeys(value) {
            reflectionTraps += 1;
            return Reflect.ownKeys(value);
        },
        getOwnPropertyDescriptor(value, key) {
            reflectionTraps += 1;
            return Reflect.getOwnPropertyDescriptor(value, key);
        },
        get(value, key, receiver) {
            valueReads += 1;
            return Reflect.get(value, key, receiver);
        }
    });
    assertImportError(() => fitDecoder.decode(descriptor));
    assert.ok(reflectionTraps > 0);
    assert.equal(valueReads, 0);
});

test('only a different media type maps to unsupported format', () => {
    for (const descriptor of [
        null,
        {},
        { mediaType: FIT_MEDIA_TYPE, content: 'AA==', [Symbol('unsafe')]: true }
    ]) {
        assertImportError(() => fitDecoder.decode(descriptor));
    }
    assertImportError(
        () => fitDecoder.decode({
            mediaType: 'application/octet-stream',
            content: 'AA=='
        }),
        IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
});

test('descriptor and content are not modified', () => {
    const descriptor = syntheticFitDescriptor(createSyntheticFitActivity());
    const before = structuredClone(descriptor);
    Object.freeze(descriptor);
    fitDecoder.decode(descriptor);
    assert.deepEqual(descriptor, before);
});

test('wrong media type and empty content retain existing Import error codes', () => {
    assertImportError(
        () => fitDecoder.decode({ mediaType: 'application/octet-stream', content: 'AA==' }),
        IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
    assertImportError(
        () => fitDecoder.decode({ mediaType: FIT_MEDIA_TYPE, content: '' }),
        IMPORT_ERROR_CODE.FILE_EMPTY
    );
});

for (const content of ['A===', 'AA', 'AA-_', 'AA==\n', 'AB==', 'AAB=']) {
    test(`non-canonical base64 fails closed: ${JSON.stringify(content)}`, () => {
        assertImportError(() => fitDecoder.decode({ mediaType: FIT_MEDIA_TYPE, content }));
    });
}

test('invalid header sizes, signature, and protocol major fail closed', () => {
    const bytes = createSyntheticFitActivity();
    for (const invalid of [
        withByte(bytes, 0, 11),
        withByte(bytes, 0, 13),
        withByte(bytes, 0, 15),
        withByte(bytes, 8, 0),
        withByte(bytes, 1, 0x30)
    ]) {
        assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(invalid)));
    }
});

test('declared length overflow, truncation, and trailing bytes fail closed', () => {
    const bytes = createSyntheticFitActivity();
    const overflow = Uint8Array.from(bytes);
    overflow.set([0xff, 0xff, 0xff, 0xff], 4);
    const truncated = bytes.subarray(0, bytes.length - 1);
    const trailing = Uint8Array.from([...bytes, 0]);
    for (const invalid of [overflow, truncated, trailing]) {
        assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(invalid)));
    }
});

test('unknown local records and reserved normal header bits fail closed', () => {
    for (const raw of [[0x00], [0x10]]) {
        const bytes = createFitBytes({ records: [fitRawRecord(raw)] });
        assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(bytes)));
    }
});

test('malformed definition reserved byte, architecture, and truncation fail closed', () => {
    const records = [
        [0x40, 1, 0, 0, 0, 0],
        [0x40, 0, 2, 0, 0, 0],
        [0x40, 0, 0, 0]
    ];
    for (const raw of records) {
        assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(
            createFitBytes({ records: [fitRawRecord(raw)] })
        )));
    }
});

test('unknown base types, zero field sizes, and type-size mismatch fail closed', () => {
    const records = [
        [0x40, 0, 0, 0, 0, 1, 0, 1, 0xff],
        [0x40, 0, 0, 0, 0, 1, 0, 0, 0x02],
        [0x40, 0, 0, 0, 0, 1, 0, 3, 0x84]
    ];
    for (const raw of records) {
        assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(
            createFitBytes({ records: [fitRawRecord(raw)] })
        )));
    }
});

test('compressed timestamps require a prior timestamp and a timestamp definition', () => {
    const withoutPrior = createFitBytes({ records: [
        fitDefinition(0, 20, [fitField(253, 'uint32'), fitField(5, 'uint32')]),
        fitCompressed(0, 1, { 5: 1 })
    ] });
    const withoutTimestampField = createFitBytes({ records: [
        fitDefinition(0, 20, [fitField(5, 'uint32')]),
        fitData(0, { 5: 1 }),
        fitCompressed(0, 1, { 5: 2 })
    ] });
    assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(withoutPrior)));
    assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(withoutTimestampField)));
});

test('malformed developer definitions and byte counts fail closed', () => {
    const truncated = createFitBytes({ records: [
        fitRawRecord([0x60, 0, 0, 0, 0, 0, 1])
    ] });
    assertImportError(() => fitDecoder.decode(syntheticFitDescriptor(truncated)));
});

test('known profile fields reject a mismatched base type', () => {
    const records = createSyntheticFitRecords().map((record) => {
        if (record.kind !== 'definition' || record.localMessage !== 5) return record;
        return fitDefinition(5, 18, record.fields.map(item =>
            item.number === 5 ? fitField(5, 'uint8') : item
        ));
    });
    assertImportError(() => decodeRecords(records));
});

test('record and summary invalid sentinels stay null while real zero stays zero', () => {
    const bundle = decode();
    assert.equal(series(bundle, 'power').values[0], 0);
    assert.equal(series(bundle, 'cadence').values[0], 0);
    const noHr = decode({ includeHeartRate: false });
    assert.equal(noHr.activity.averageHeartRateBpm, null);
    assert.equal(series(noHr, 'heartRate'), undefined);
});

test('definition, field, message, and device over-limits fail before output', () => {
    const base = createSyntheticFitRecords();

    const tooManyDefinitions = [
        ...new Array(FIT_LIMITS.maxDefinitions - 5).fill(null).map(() =>
            fitDefinition(9, 999, [])
        ),
        ...base
    ];
    assertImportError(() => decodeRecords(tooManyDefinitions));

    const nativeFields = new Array(FIT_LIMITS.maxNativeFields + 1)
        .fill(null)
        .map((_, index) => fitField(index, 'byte'));
    assertImportError(() => decodeRecords([
        fitDefinition(9, 999, nativeFields),
        ...base
    ]));

    const developerFields = new Array(FIT_LIMITS.maxDeveloperFields + 1)
        .fill(null)
        .map((_, index) => ({ number: index, size: 1, developerIndex: 0 }));
    assertImportError(() => decodeRecords([
        fitDefinition(9, 999, [], { developerFields }),
        ...base
    ]));

    const oversizedFields = [
        ...new Array(16).fill(null).map((_, index) => fitField(index, 'byte', 255)),
        fitField(16, 'byte', 17)
    ];
    assertImportError(() => decodeRecords([
        fitDefinition(9, 999, oversizedFields),
        ...base
    ]));

    const tooManyDevices = [...base];
    const sessionIndex = tooManyDevices.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    const extraDevices = [];
    for (let index = 1; index <= FIT_LIMITS.maxDevices; index += 1) {
        extraDevices.push(fitData(1, {
            253: FIT_START_TIMESTAMP,
            0: index,
            2: 1,
            27: `Synthetic ${index}`
        }));
    }
    tooManyDevices.splice(sessionIndex, 0, ...extraDevices);
    assertImportError(() => decodeRecords(tooManyDevices));
});

test('exact definition, native/developer field, message, and device limits remain accepted', () => {
    const base = createSyntheticFitRecords();
    const exactDefinitions = [
        ...new Array(FIT_LIMITS.maxDefinitions - 6).fill(null).map(() =>
            fitDefinition(9, 999, [])
        ),
        ...base
    ];
    assert.equal(decodeRecords(exactDefinitions).activity.sportCategory, 'run');

    const nativeFields = new Array(FIT_LIMITS.maxNativeFields)
        .fill(null)
        .map((_, index) => fitField(index, 'byte'));
    const nativeValues = Object.fromEntries(nativeFields.map(item => [item.number, 1]));
    assert.equal(decodeRecords([
        fitDefinition(9, 999, nativeFields),
        fitData(9, nativeValues),
        ...base
    ]).activity.sportCategory, 'run');

    const developerFields = new Array(FIT_LIMITS.maxDeveloperFields)
        .fill(null)
        .map((_, index) => ({ number: index, size: 1, developerIndex: 0 }));
    assert.equal(decodeRecords([
        fitDefinition(9, 999, [], { developerFields }),
        fitData(9, {}, new Array(FIT_LIMITS.maxDeveloperFields).fill(0)),
        ...base
    ]).activity.sportCategory, 'run');

    const exactMessageFields = [
        ...new Array(16).fill(null).map((_, index) => fitField(index, 'byte', 255)),
        fitField(16, 'byte', 16)
    ];
    const exactMessageValues = Object.fromEntries(exactMessageFields.map(item => [
        item.number,
        new Array(item.size).fill(1)
    ]));
    assert.equal(decodeRecords([
        fitDefinition(9, 999, exactMessageFields),
        fitData(9, exactMessageValues),
        ...base
    ]).activity.sportCategory, 'run');

    const exactDevices = [...base];
    const sessionIndex = exactDevices.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    exactDevices.splice(sessionIndex, 0,
        ...new Array(FIT_LIMITS.maxDevices - 1).fill(null).map((_, index) =>
            fitData(1, {
                253: FIT_START_TIMESTAMP,
                0: index + 1,
                2: 1,
                27: `Synthetic ${index + 1}`
            })
        )
    );
    assert.equal(decodeRecords(exactDevices).devices.length, FIT_LIMITS.maxDevices);
});

test('data-record limit fails closed without retaining unknown payloads', () => {
    const base = createSyntheticFitRecords();
    const baseDataCount = base.filter(record =>
        record.kind === 'data' || record.kind === 'compressed'
    ).length;
    const count = FIT_LIMITS.maxDataRecords - baseDataCount + 1;
    const raw = new Uint8Array(count * 2);
    for (let index = 0; index < count; index += 1) {
        raw[index * 2] = 9;
        raw[index * 2 + 1] = 1;
    }
    assertImportError(() => decodeRecords([
        fitDefinition(9, 999, [fitField(0, 'byte')]),
        fitRawRecord(raw),
        ...base
    ]));
});

test('duplicate-equal record inputs are limited after timestamp folding', () => {
    const raw = new Uint8Array(FIT_LIMITS.maxRecordPoints * 9);
    for (let index = 0; index < FIT_LIMITS.maxRecordPoints; index += 1) {
        const offset = index * 9;
        raw[offset] = 9;
        writeUint32Little(raw, offset + 1, FIT_START_TIMESTAMP);
        writeUint32Little(raw, offset + 5, 0);
    }
    const bundle = decodeRecords([
        fitDefinition(9, 20, [fitField(253, 'uint32'), fitField(5, 'uint32')]),
        fitRawRecord(raw),
        ...createSyntheticFitRecords()
    ]);
    assert.deepEqual(series(bundle, 'distance').offsetsSeconds, [0, 10]);
});

test('duplicate-equal HR inputs are limited after final dedupe', () => {
    const records = createSyntheticFitRecords({ includeHeartRate: false });
    const sessionIndex = records.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    const raw = new Uint8Array(FIT_LIMITS.maxHeartRatePoints * 6);
    for (let index = 0; index < FIT_LIMITS.maxHeartRatePoints; index += 1) {
        const offset = index * 6;
        raw[offset] = 9;
        raw[offset + 1] = 150;
        writeUint32Little(raw, offset + 2, 4094);
    }
    records.splice(sessionIndex, 0,
        fitDefinition(8, 132, [
            fitField(253, 'uint32'),
            fitField(6, 'uint8'),
            fitField(9, 'uint32')
        ]),
        fitData(8, {
            253: FIT_START_TIMESTAMP + 5,
            6: 150,
            9: 4094
        }),
        fitDefinition(9, 132, [fitField(6, 'uint8'), fitField(9, 'uint32')]),
        fitRawRecord(raw)
    );
    const heartRate = series(decodeRecords(records), 'heartRate');
    assert.deepEqual(heartRate.offsetsSeconds, [5]);
    assert.deepEqual(heartRate.values, [150]);
});

test('record and HR output point over-limits fail before bundle allocation', () => {
    const recordBase = createSyntheticFitRecords();
    const recordCount = FIT_LIMITS.maxRecordPoints - 1;
    const recordBytes = new Uint8Array(recordCount * 9);
    for (let index = 0; index < recordCount; index += 1) {
        const offset = index * 9;
        recordBytes[offset] = 9;
        writeUint32Little(recordBytes, offset + 1, FIT_START_TIMESTAMP + 15 + index);
        writeUint32Little(recordBytes, offset + 5, index);
    }
    assertImportError(() => decodeRecords([
        fitDefinition(9, 20, [fitField(253, 'uint32'), fitField(5, 'uint32')]),
        fitRawRecord(recordBytes),
        ...recordBase
    ]));

    const hrBase = createSyntheticFitRecords({ includeHeartRate: false });
    const sessionIndex = hrBase.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    const hrBytes = new Uint8Array(FIT_LIMITS.maxHeartRatePoints * 6);
    for (let index = 0; index < FIT_LIMITS.maxHeartRatePoints; index += 1) {
        const offset = index * 6;
        hrBytes[offset] = 9;
        hrBytes[offset + 1] = 150;
        writeUint32Little(hrBytes, offset + 2, 4095 + index);
    }
    hrBase.splice(sessionIndex, 0,
        fitDefinition(8, 132, [
            fitField(253, 'uint32'),
            fitField(6, 'uint8'),
            fitField(9, 'uint32')
        ]),
        fitData(8, {
            253: FIT_START_TIMESTAMP + 5,
            6: 150,
            9: 4094
        }),
        fitDefinition(9, 132, [fitField(6, 'uint8'), fitField(9, 'uint32')]),
        fitRawRecord(hrBytes)
    );
    assertImportError(() => decodeRecords(hrBase));
});

test('lap and event limits fail closed before Canonical validation', () => {
    const lapRecords = createSyntheticFitRecords();
    const lapSessionIndex = lapRecords.findIndex(record =>
        record.kind === 'definition' && record.localMessage === 5
    );
    lapRecords.splice(lapSessionIndex, 0,
        ...new Array(FIT_LIMITS.maxLaps).fill(null).map(() =>
            fitData(4, {
                2: FIT_START_TIMESTAMP + 30,
                7: 0,
                8: 0,
                9: 0
            })
        )
    );
    assertImportError(() => decodeRecords(lapRecords));

    const eventRecords = createSyntheticFitRecords();
    const stopIndex = eventRecords.findIndex(record =>
        record.kind === 'data'
        && record.localMessage === 2
        && record.values[1] === 4
    );
    eventRecords.splice(stopIndex, 0,
        ...new Array(FIT_LIMITS.maxEvents - 1).fill(null).map(() =>
            fitData(2, {
                253: FIT_START_TIMESTAMP + 1,
                0: 1,
                1: 3
            })
        )
    );
    assertImportError(() => decodeRecords(eventRecords));
});

test('decoded-byte over-limit is rejected before allocation of a bundle', () => {
    const length = FIT_LIMITS.maxDecodedBytes + 1;
    const base64Length = Math.ceil(length / 3) * 4;
    const content = `${'A'.repeat(base64Length - 2)}==`;
    assertImportError(() => fitDecoder.decode({ mediaType: FIT_MEDIA_TYPE, content }));
});

test('Node ESM import and decode perform zero network, DOM, storage, Worker, or console I/O', async () => {
    const guarded = ['fetch', 'document', 'localStorage', 'indexedDB', 'caches', 'Worker'];
    const saved = new Map();
    for (const name of guarded) {
        saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        const descriptor = saved.get(name);
        if (!descriptor || descriptor.configurable) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    throw new Error(`unexpected-${name}`);
                }
            });
        }
    }
    const consoleMethods = ['log', 'warn', 'error'];
    const originalConsole = Object.fromEntries(consoleMethods.map(name => [name, console[name]]));
    let consoleCalls = 0;
    for (const name of consoleMethods) console[name] = () => { consoleCalls += 1; };
    let bundle;
    try {
        const module = await import(`../../js/decoders/fit/decoder.js?zero-io=${Date.now()}`);
        bundle = module.fitDecoder.decode(
            syntheticFitDescriptor(createSyntheticFitActivity())
        );
    } finally {
        for (const name of consoleMethods) console[name] = originalConsole[name];
        for (const name of guarded) {
            const descriptor = saved.get(name);
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
    assert.equal(bundle.activity.sportCategory, 'run');
    assert.equal(consoleCalls, 0);
});

test('output is byte-identical across timezone and locale environments', () => {
    const script = [
        "import {fitDecoder} from './js/decoders/fit/decoder.js';",
        "import {createSyntheticFitActivity,syntheticFitDescriptor} from './tests/fixtures/synthetic/fit/fit-fixture.js';",
        'process.stdout.write(JSON.stringify(fitDecoder.decode(syntheticFitDescriptor(createSyntheticFitActivity({pauseResume:true,includeHrMessage:true})))));'
    ].join('');
    const run = (env) => execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        { cwd: process.cwd(), env: { ...process.env, ...env } }
    ).toString();
    const utcEnglish = run({ TZ: 'UTC', LANG: 'C', LC_ALL: 'C' });
    const nonUtcChinese = run({
        TZ: 'Pacific/Honolulu',
        LANG: 'zh_CN.UTF-8',
        LC_ALL: 'zh_CN.UTF-8'
    });
    assert.equal(nonUtcChinese, utcEnglish);
});

test('errors and warnings never leak synthetic private canaries', () => {
    const canary = 'PRIVATE_GPS_HR_TOKEN_CANARY';
    const descriptor = syntheticFitDescriptor(createSyntheticFitActivity());
    descriptor[canary] = canary;
    assert.throws(() => fitDecoder.decode(descriptor), (error) => {
        assert.doesNotMatch(JSON.stringify(error), new RegExp(canary));
        assert.doesNotMatch(error.message, new RegExp(canary));
        return true;
    });
});

test('fixture base64 encoder remains canonical for generated FIT bytes', () => {
    const bytes = createSyntheticFitActivity();
    const content = syntheticFitBase64(bytes);
    assert.match(content, /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
    assert.equal(fitDecoder.decode({ mediaType: FIT_MEDIA_TYPE, content }).activity.sportCategory, 'run');
});
