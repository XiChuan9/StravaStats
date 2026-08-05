import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
    validateCanonicalActivity,
    validateCanonicalStreamSet,
    validateImportedActivityBundle
} from '../../js/data/contracts/index.js';
import {
    TCX_LIMITS,
    TCX_MEDIA_TYPE,
    tcxDecoder
} from '../../js/decoders/tcx/decoder.js';
import { IMPORT_ERROR_CODE } from '../../js/import/errors.js';
import {
    SYNTHETIC_TCX_START,
    createSyntheticTcxActivity,
    syntheticTcxDescriptor
} from '../fixtures/synthetic/tcx/tcx-fixture.js';

function decode(options = {}) {
    return tcxDecoder.decode(syntheticTcxDescriptor(createSyntheticTcxActivity(options)));
}

function decodeXml(content) {
    return tcxDecoder.decode(syntheticTcxDescriptor(content));
}

function assertImportError(action, code = IMPORT_ERROR_CODE.FILE_CORRUPTED) {
    assert.throws(action, error => {
        assert.equal(error.name, 'ImportError');
        assert.equal(error.code, code);
        assert.equal(error.retryable, false);
        assert.equal(error.stage, 'decode');
        assert.equal(error.cause, undefined);
        return true;
    });
}

function series(bundle, streamType) {
    return bundle.streams.series.find(item => item.streamType === streamType);
}

function warningCodes(bundle) {
    return bundle.warnings.map(item => item.code);
}

function validPoint(time, values = {}) {
    return { time, ...values };
}

function runBoundaryChild(source) {
    return execFileSync(process.execPath, [
        '--max-old-space-size=1024',
        '--input-type=module',
        '-e',
        source
    ], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
}

test('TCX descriptor and limits are frozen internal boundaries', () => {
    assert.deepEqual(Object.keys(tcxDecoder), ['id', 'mediaType', 'decode']);
    assert.equal(tcxDecoder.id, 'tcx');
    assert.equal(tcxDecoder.mediaType, TCX_MEDIA_TYPE);
    assert.equal(typeof tcxDecoder.decode, 'function');
    assert.ok(Object.isFrozen(tcxDecoder));
    assert.deepEqual(TCX_LIMITS, {
        maxXmlBytes: 16_777_216,
        maxDepth: 32,
        maxElements: 500_000,
        maxAttributesPerElement: 32,
        maxAttributes: 500_000,
        maxTextNodeBytes: 262_144,
        maxAttributeValueBytes: 4_096,
        maxQNameBytes: 128,
        maxChildrenPerElement: 200_000,
        maxActivities: 1,
        maxLaps: 10_000,
        maxTracks: 20_000,
        maxTrackpointRows: 200_000,
        maxExtensionElements: 400_000,
        maxExtensionChildren: 32
    });
    assert.ok(Object.isFrozen(TCX_LIMITS));
});

test('default namespace maps core, power, temperatures, real zero, and provenance', () => {
    const bundle = decode();
    assert.deepEqual(bundle.activity, {
        schemaVersion: 1,
        id: 'tcx:2031-04-05T06%3A07%3A08.000Z',
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: SYNTHETIC_TCX_START,
        timeZone: { ianaName: null, utcOffsetMinutes: 0 },
        capabilities: {
            hasGps: true,
            hasHeartRate: true,
            hasPower: true,
            hasCadence: true,
            hasLaps: true
        },
        distanceMeters: 1000,
        elapsedTimeSeconds: 30
    });
    assert.deepEqual(bundle.streams.series.map(item => item.streamType), [
        'position', 'altitude', 'distance', 'heartRate', 'cadence',
        'speed', 'power', 'temperature', 'waterTemperature'
    ]);
    assert.deepEqual(series(bundle, 'position').values[0], [0, 0]);
    for (const type of ['distance', 'cadence', 'speed', 'power', 'temperature', 'waterTemperature']) {
        assert.equal(series(bundle, type).values[0], 0);
    }
    assert.deepEqual(bundle.laps, [{
        id: `${bundle.activity.id}:lap:0`,
        activityId: bundle.activity.id,
        index: 0,
        startOffsetSeconds: 0,
        elapsedTimeSeconds: 30,
        distanceMeters: 1000
    }]);
    assert.deepEqual(bundle.events, []);
    assert.deepEqual(bundle.devices, []);
    assert.deepEqual(bundle.sources, [{
        id: `${bundle.activity.id}:source:0`,
        activityId: bundle.activity.id,
        provider: 'tcx',
        externalId: SYNTHETIC_TCX_START,
        rawArtifactId: null,
        acquisitionMethod: 'local-file',
        deviceId: null,
        importedAt: SYNTHETIC_TCX_START
    }]);
    assert.deepEqual(warningCodes(bundle), ['TCX_IMPORT_TIME_FALLBACK']);
    assert.equal(validateCanonicalActivity(bundle.activity).ok, true);
    assert.equal(validateCanonicalStreamSet(bundle.streams).ok, true);
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
    assert.ok(Object.isFrozen(bundle));
    assert.ok(Object.isFrozen(bundle.streams.series[0].values));
});

test('prefixed namespace and inert schemaLocation are equivalent without dereference', () => {
    assert.deepEqual(decode({ prefixed: true, schemaLocation: true }), decode());
});

test('BOM, comments, declaration variants, and default extension namespaces are deterministic', () => {
    const valid = createSyntheticTcxActivity();
    assert.deepEqual(decodeXml(`\ufeff${valid.replace('?>', ' standalone="yes"?>').replace('<Activities>', '<!--synthetic--><Activities>')}`), decode());
    const defaultExtension = valid
        .replaceAll('<ae:TPX>', '<TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">')
        .replaceAll('</ae:TPX>', '</TPX>')
        .replaceAll('<ae:Speed>', '<Speed>')
        .replaceAll('</ae:Speed>', '</Speed>')
        .replaceAll('<ae:RunCadence>', '<RunCadence>')
        .replaceAll('</ae:RunCadence>', '</RunCadence>')
        .replaceAll('<ae:Watts>', '<Watts>')
        .replaceAll('</ae:Watts>', '</Watts>');
    assert.deepEqual(decodeXml(defaultExtension), decode());
});

test('multiple Laps and Tracks preserve encounter order and summed summaries', () => {
    const bundle = decode({
        laps: [
            {
                start: SYNTHETIC_TCX_START,
                totalTime: 20,
                distance: 500,
                tracks: [
                    [validPoint(SYNTHETIC_TCX_START, { distance: 0 })],
                    [validPoint('2031-04-05T06:07:28.000Z', { distance: 500 })]
                ]
            },
            {
                start: '2031-04-05T06:07:28.000Z',
                totalTime: 10,
                distance: 250,
                tracks: [[validPoint('2031-04-05T06:07:38.000Z', { distance: 250 })]]
            }
        ]
    });
    assert.equal(bundle.activity.distanceMeters, 750);
    assert.equal(bundle.activity.elapsedTimeSeconds, 30);
    assert.deepEqual(bundle.laps.map(lap => [lap.index, lap.startOffsetSeconds]), [[0, 0], [1, 20]]);
    assert.deepEqual(series(bundle, 'distance').offsetsSeconds, [0, 20, 30]);
});

test('Polar missing speed and Suunto missing altitude stay null without derivation', () => {
    const bundle = decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 30,
            distance: 100,
            tracks: [[
                validPoint(SYNTHETIC_TCX_START, { distance: 0, latitude: 1, longitude: 2 }),
                validPoint('2031-04-05T06:07:38.000Z', { distance: 100, latitude: 2, longitude: 3 })
            ]]
        }]
    });
    assert.equal(series(bundle, 'speed'), undefined);
    assert.equal(series(bundle, 'altitude'), undefined);
    assert.equal(series(bundle, 'distance').values[0], 0);
});

test('a series exists only when at least one sample is present and carries null for missing rows', () => {
    const bundle = decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 30,
            distance: 0,
            tracks: [[
                validPoint(SYNTHETIC_TCX_START),
                validPoint('2031-04-05T06:07:38.000Z', { power: 0 })
            ]]
        }]
    });
    assert.deepEqual(bundle.streams.series.map(item => item.streamType), ['power']);
    assert.deepEqual(series(bundle, 'power').values, [null, 0]);
    assert.equal(bundle.activity.capabilities.hasGps, false);
    assert.equal(bundle.activity.capabilities.hasHeartRate, false);
    assert.equal(bundle.activity.capabilities.hasCadence, false);
});

test('summary-only Lap is valid while a present empty Track is rejected', () => {
    const bundle = decode({
        laps: [{ start: SYNTHETIC_TCX_START, totalTime: 0, distance: 0 }]
    });
    assert.deepEqual(bundle.streams.series, []);
    assert.equal(bundle.activity.elapsedTimeSeconds, 0);
    assertImportError(() => decode({
        laps: [{ start: SYNTHETIC_TCX_START, totalTime: 0, distance: 0, emptyTrack: true }]
    }));
});

test('equal timestamps fold compatible values and reject conflicts', () => {
    const bundle = decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 1,
            distance: 0,
            tracks: [[
                validPoint(SYNTHETIC_TCX_START, { power: 0 }),
                validPoint(SYNTHETIC_TCX_START, { cadence: 0, power: 0 })
            ]]
        }]
    });
    assert.deepEqual(series(bundle, 'power').values, [0]);
    assert.deepEqual(series(bundle, 'cadence').values, [0]);
    assertImportError(() => decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 1,
            distance: 0,
            tracks: [[
                validPoint(SYNTHETIC_TCX_START, { power: 1 }),
                validPoint(SYNTHETIC_TCX_START, { power: 2 })
            ]]
        }]
    }));
});

test('decreasing and missing Trackpoint times fail closed', () => {
    assertImportError(() => decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 30,
            distance: 0,
            tracks: [[
                validPoint('2031-04-05T06:07:38.000Z'),
                validPoint(SYNTHETIC_TCX_START)
            ]]
        }]
    }));
    const xml = createSyntheticTcxActivity().replace(`<Time>${SYNTHETIC_TCX_START}</Time>`, '');
    assertImportError(() => decodeXml(xml));
});

test('base cadence and RunCadence must agree', () => {
    const consistent = decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 1,
            distance: 0,
            tracks: [[validPoint(SYNTHETIC_TCX_START, { cadence: 0, runCadence: 0 })]]
        }]
    });
    assert.equal(series(consistent, 'cadence').values[0], 0);
    assertImportError(() => decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 1,
            distance: 0,
            tracks: [[validPoint(SYNTHETIC_TCX_START, { cadence: 1, runCadence: 2 })]]
        }]
    }));
});

test('unknown wildcard, lap extension, and device trees add only static warnings', () => {
    const bundle = decode({
        creator: true,
        author: true,
        activityExtension: true,
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 1,
            distance: 0,
            lapExtension: true,
            tracks: [[validPoint(SYNTHETIC_TCX_START, { unknownExtension: true })]]
        }]
    });
    assert.deepEqual(warningCodes(bundle), [
        'TCX_DEVICE_METADATA_IGNORED',
        'TCX_IMPORT_TIME_FALLBACK',
        'TCX_LAP_EXTENSION_IGNORED',
        'TCX_UNKNOWN_EXTENSION_IGNORED'
    ]);
    assert.ok(bundle.warnings.every(warning => !JSON.stringify(warning).includes('Synthetic Device')));
});

test('approved root and Garmin extension wildcards ignore only bounded other namespaces', () => {
    let content = createSyntheticTcxActivity();
    content = content.replace(
        '</TrainingCenterDatabase>',
        '<Extensions><synthetic:Root/></Extensions></TrainingCenterDatabase>'
    );
    content = content.replace(
        '</ae:TPX>',
        '<ae:Extensions><synthetic:Tpx/></ae:Extensions></ae:TPX>'
    );
    content = content.replace(
        '</tpe:TrackPointExtension>',
        '<tpe:Extensions><synthetic:Temperature/></tpe:Extensions></tpe:TrackPointExtension>'
    );
    assert.deepEqual(warningCodes(decodeXml(content)), [
        'TCX_IMPORT_TIME_FALLBACK',
        'TCX_UNKNOWN_EXTENSION_IGNORED'
    ]);
});

test('Lap wildcard distinguishes ignored LX summaries from unknown namespaces', () => {
    const unknownLap = createSyntheticTcxActivity({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 0,
            distance: 0,
            lapExtension: true
        }]
    }).replace(
        '<ae:LX><ae:AvgSpeed>1</ae:AvgSpeed></ae:LX>',
        '<synthetic:LapMetadata/>'
    );
    assert.deepEqual(warningCodes(decodeXml(unknownLap)), [
        'TCX_IMPORT_TIME_FALLBACK',
        'TCX_UNKNOWN_EXTENSION_IGNORED'
    ]);
});

test('opaque source identity stays a string and offset normalization is host-independent', () => {
    const sourceId = '2031-04-05T14:07:08.000+08:00';
    const bundle = decode({
        activityId: sourceId,
        laps: [{ start: sourceId, totalTime: 0, distance: 0 }]
    });
    assert.equal(bundle.activity.id, `tcx:${encodeURIComponent(sourceId)}`);
    assert.equal(bundle.activity.startTimeUtc, SYNTHETIC_TCX_START);
    assert.equal(bundle.activity.timeZone.utcOffsetMinutes, 480);
    assert.equal(bundle.sources[0].externalId, sourceId);
});

test('Gregorian years below 100 and millisecond-exact fractions avoid Date constructor quirks', () => {
    const year42 = '0042-04-05T06:07:08.120Z';
    const bundle = decode({
        activityId: year42,
        laps: [{ start: year42, totalTime: 0, distance: 0 }]
    });
    assert.equal(bundle.activity.startTimeUtc, year42);
    assert.equal(bundle.sources[0].externalId, year42);
    const padded = '2031-04-05T06:07:08.12Z';
    assert.equal(decode({
        activityId: padded,
        laps: [{ start: padded, totalTime: 0, distance: 0 }]
    }).activity.startTimeUtc, '2031-04-05T06:07:08.120Z');
    for (const invalid of [
        '2031-04-05T06:07:08.1201Z',
        ' 2031-04-05T06:07:08.120Z',
        '2031-04-05T06:07:08.120Z '
    ]) {
        assertImportError(() => decode({
            activityId: invalid,
            laps: [{ start: invalid, totalTime: 0, distance: 0 }]
        }));
    }
});

test('malformed XML, namespace spoofing, and multiple Activities fail closed', () => {
    const valid = createSyntheticTcxActivity();
    assertImportError(() => decodeXml(''), IMPORT_ERROR_CODE.FILE_EMPTY);
    const cases = [
        valid.slice(0, -8),
        valid.replace('</Trackpoint>', '</Track>'),
        valid.replace(' Sport="Running"', ' Sport="Running" Sport="Running"'),
        valid.replace('xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"', 'xmlns="urn:spoof"'),
        valid.replace('<TrainingCenterDatabase', '<bad:TrainingCenterDatabase'),
        valid.replace('</Activities>', valid.match(/<Activity[\s\S]*<\/Activity>/)[0] + '</Activities>'),
        valid.replace('<LatitudeDegrees>0</LatitudeDegrees>', '<LatitudeDegrees>0</LatitudeDegrees><LatitudeDegrees>0</LatitudeDegrees>'),
        valid.replace('<Position><LatitudeDegrees>0</LatitudeDegrees><LongitudeDegrees>0</LongitudeDegrees></Position>', '<Position><LatitudeDegrees>0</LatitudeDegrees></Position>'),
        valid.replace('<Activities>', '<Activities><synthetic:Outside/>'),
        valid.replace('<Activities>', '<Activities><ae:TPX/>')
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('unknown namespaces outside approved Extensions and unsupported Training fail closed', () => {
    const creator = createSyntheticTcxActivity({ creator: true });
    assertImportError(() => decodeXml(creator.replace(
        '</Creator>',
        '<synthetic:Outside/></Creator>'
    )));
    assertImportError(() => decodeXml(createSyntheticTcxActivity().replace(
        '</Lap>',
        '</Lap><Training VirtualPartner="false"/>'
    )));
});

test('known extension elements at unapproved wildcard paths fail closed', () => {
    const valid = createSyntheticTcxActivity();
    const cases = [
        valid.replace('<ae:TPX>', '<ae:LX>').replace('</ae:TPX>', '</ae:LX>'),
        valid.replace('<ae:TPX>', '<tpe:Unknown>').replace('</ae:TPX>', '</tpe:Unknown>'),
        valid.replace('</TrainingCenterDatabase>', '<Extensions><ae:TPX/></Extensions></TrainingCenterDatabase>'),
        valid.replace('</Activity>', '<Extensions><tpe:TrackPointExtension/></Extensions></Activity>'),
        valid.replace('</tpe:TrackPointExtension>', '<tpe:Extensions><ae:TPX/></tpe:Extensions></tpe:TrackPointExtension>')
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('unknown wildcard wrappers cannot smuggle controlled descendants', () => {
    const valid = createSyntheticTcxActivity();
    const descendants = [
        '<ae:TPX><ae:Watts>1</ae:Watts></ae:TPX>',
        '<tpe:TrackPointExtension/>',
        `<Id>${SYNTHETIC_TCX_START}</Id>`,
        '<xsi:probe/>',
        '<xml:probe/>'
    ];
    for (const descendant of descendants) {
        const content = valid.replace(
            '</Activity>',
            `<Extensions><synthetic:Wrap>${descendant}</synthetic:Wrap></Extensions></Activity>`
        );
        assertImportError(() => decodeXml(content));
    }
});

test('selected Garmin extension fields remain singleton schema members', () => {
    const valid = createSyntheticTcxActivity();
    const cases = [
        valid.replace('</ae:TPX>', '<ae:Extensions/><ae:Extensions/></ae:TPX>'),
        valid.replace(
            '</tpe:TrackPointExtension>',
            '<tpe:Extensions/><tpe:Extensions/></tpe:TrackPointExtension>'
        )
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('TCX and selected extension schema sequences reject out-of-order fields', () => {
    const valid = createSyntheticTcxActivity({ creator: true, author: true });
    const cases = [
        valid.replace(/(<Activities>[\s\S]*<\/Activities>)(<Author>[\s\S]*<\/Author>)/, '$2$1'),
        valid.replace(/(<Id>[^<]+<\/Id>)(<Lap[\s\S]*<\/Lap>)/, '$2$1'),
        valid.replace(/(<TotalTimeSeconds>[^<]+<\/TotalTimeSeconds>)(<DistanceMeters>[^<]+<\/DistanceMeters>)/, '$2$1'),
        valid.replace(/(<Time>[^<]+<\/Time>)(<Position>[\s\S]*?<\/Position>)/, '$2$1'),
        valid.replace(/(<ae:Speed>[^<]+<\/ae:Speed>)(<ae:RunCadence>[^<]+<\/ae:RunCadence>)/, '$2$1'),
        valid.replace(/(<tpe:atemp>[^<]+<\/tpe:atemp>)(<tpe:wtemp>[^<]+<\/tpe:wtemp>)/, '$2$1')
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('DTD, entities, XInclude, processing instructions, and CDATA are rejected', () => {
    const valid = createSyntheticTcxActivity();
    const cases = [
        `<!DOCTYPE x>${valid}`,
        valid.replace('?>', '?><!DOCTYPE x [<!ENTITY probe "expanded">]>'),
        valid.replace('<Id>', '<Id>&probe;'),
        valid.replace('<Activities>', '<Activities><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///private"/>'),
        valid.replace('<Id>', '<?probe private?><Id>'),
        valid.replace(SYNTHETIC_TCX_START, `<![CDATA[${SYNTHETIC_TCX_START}]]>`)
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('raw attribute delimiters, forbidden text terminators, malformed comments, and non-XML whitespace fail closed', () => {
    const valid = createSyntheticTcxActivity({ schemaLocation: true });
    const cases = [
        valid.replace('https://invalid.example/synthetic.xsd', 'https://invalid.example/<probe'),
        valid.replace('</Activity>', '<Notes>bad]]>text</Notes></Activity>'),
        valid.replace('<Activities>', '<!--bad---><Activities>'),
        valid.replace(' Sport="Running"', '\u00a0Sport="Running"'),
        valid.replace(`<Id>${SYNTHETIC_TCX_START}</Id>`, `<Id>\u00a0${SYNTHETIC_TCX_START}</Id>`)
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('reserved namespace prefixes and attribute-only namespaces cannot become elements', () => {
    const valid = createSyntheticTcxActivity();
    const cases = [
        valid.replace(' xmlns:ae=', ' xmlns:XmLfoo="urn:reserved" xmlns:ae='),
        valid.replace(' xmlns:ae=', ` xmlns:xi="http://www.w3.org/2001/XInclude" xmlns:ae=`),
        valid.replace('</TrainingCenterDatabase>', '<Extensions><xsi:probe/></Extensions></TrainingCenterDatabase>'),
        valid.replace('</TrainingCenterDatabase>', '<Extensions><xml:probe/></Extensions></TrainingCenterDatabase>')
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
});

test('predefined and numeric references work but arbitrary named references do not', () => {
    const sourceId = '2031-04-05T06:07:08.000&#90;';
    const content = createSyntheticTcxActivity().replaceAll(SYNTHETIC_TCX_START, sourceId);
    const bundle = decodeXml(content);
    assert.equal(bundle.sources[0].externalId, SYNTHETIC_TCX_START);
    assertImportError(() => decodeXml(content.replace('&#90;', '&private;')));
});

test('invalid dates, numbers, ranges, and non-finite values fail closed', () => {
    const valid = createSyntheticTcxActivity();
    const replacements = [
        [SYNTHETIC_TCX_START, '2031-02-29T06:07:08.000Z'],
        [SYNTHETIC_TCX_START, '2031-04-05T06:07:08'],
        [SYNTHETIC_TCX_START, '2031-04-05T06:07:08+14:01'],
        ['<AltitudeMeters>12.5</AltitudeMeters>', '<AltitudeMeters>NaN</AltitudeMeters>'],
        ['<DistanceMeters>0</DistanceMeters>', '<DistanceMeters>-1</DistanceMeters>'],
        ['<Value>120</Value>', '<Value>0</Value>'],
        ['<Cadence>0</Cadence>', '<Cadence>255</Cadence>'],
        ['<ae:Watts>0</ae:Watts>', '<ae:Watts>65536</ae:Watts>'],
        ['<LatitudeDegrees>0</LatitudeDegrees>', '<LatitudeDegrees>91</LatitudeDegrees>'],
        ['<LongitudeDegrees>0</LongitudeDegrees>', '<LongitudeDegrees>180</LongitudeDegrees>']
    ];
    for (const [before, after] of replacements) {
        assertImportError(() => decodeXml(valid.replace(before, after)));
    }
});

test('overlapping Laps and unsupported sports fail closed', () => {
    assertImportError(() => decode({ sport: 'Cycling' }));
    assertImportError(() => decode({
        laps: [
            { start: SYNTHETIC_TCX_START, totalTime: 20, distance: 0 },
            { start: '2031-04-05T06:07:18.000Z', totalTime: 10, distance: 0 }
        ]
    }));
});

test('depth, attribute-count, attribute-value, name, text, and extension-width limits fail closed', () => {
    const valid = createSyntheticTcxActivity();
    const tooManyAttributes = Array.from({ length: TCX_LIMITS.maxAttributesPerElement + 1 }, (_, index) => ` a${index}="x"`).join('');
    const tooManyExtensions = Array.from({ length: TCX_LIMITS.maxExtensionChildren + 1 }, (_, index) => `<synthetic:E${index}/>`).join('');
    const cases = [
        valid.replace(' Sport="Running"', ` Sport="Running"${tooManyAttributes}`),
        valid.replace(' Sport="Running"', ` Sport="Running" synthetic:a="${'x'.repeat(TCX_LIMITS.maxAttributeValueBytes + 1)}"`),
        valid.replace('<Id>', `<${'A'.repeat(TCX_LIMITS.maxQNameBytes + 1)}><Id>`),
        valid.replace('<Id>', `<Id>${'x'.repeat(TCX_LIMITS.maxTextNodeBytes + 1)}</Id><Id>`),
        valid.replace('</Activity>', `<Extensions>${tooManyExtensions}</Extensions></Activity>`)
    ];
    for (const content of cases) assertImportError(() => decodeXml(content));
    let nested = '<synthetic:X/>'.repeat(0);
    for (let index = 0; index < TCX_LIMITS.maxDepth; index += 1) nested = `<synthetic:X>${nested}</synthetic:X>`;
    assertImportError(() => decodeXml(valid.replace('</Activity>', `<Extensions>${nested}</Extensions></Activity>`)));
});

test('Lap and Track collection limits accept the boundary and reject one over', () => {
    const boundaryLaps = Array.from({ length: TCX_LIMITS.maxLaps }, () => ({
        start: SYNTHETIC_TCX_START,
        totalTime: 0,
        distance: 0
    }));
    assert.equal(decode({ laps: boundaryLaps }).laps.length, TCX_LIMITS.maxLaps);
    assertImportError(() => decode({
        laps: [...boundaryLaps, {
            start: SYNTHETIC_TCX_START,
            totalTime: 0,
            distance: 0
        }]
    }));

    const point = validPoint(SYNTHETIC_TCX_START);
    const boundaryTracks = Array.from(
        { length: TCX_LIMITS.maxTracks },
        () => [point]
    );
    assert.equal(decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 0,
            distance: 0,
            tracks: boundaryTracks
        }]
    }).streams.series.length, 0);
    assertImportError(() => decode({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 0,
            distance: 0,
            tracks: [...boundaryTracks, [point]]
        }]
    }));
});

test('lexical and tree-shape limits accept exact boundaries and reject one over', () => {
    const valid = createSyntheticTcxActivity();
    const declarationEnd = valid.indexOf('?>') + 2;
    const commentPayload = TCX_LIMITS.maxXmlBytes - valid.length - 7;
    const atByteLimit = `${valid.slice(0, declarationEnd)}<!--${'x'.repeat(commentPayload)}-->${valid.slice(declarationEnd)}`;
    assert.equal(new TextEncoder().encode(atByteLimit).length, TCX_LIMITS.maxXmlBytes);
    assert.equal(decodeXml(atByteLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(atByteLimit.replace('-->', 'x-->')));

    const textAtLimit = valid.replace(
        '</Activity>',
        `<Notes>${'x'.repeat(TCX_LIMITS.maxTextNodeBytes)}</Notes></Activity>`
    );
    assert.equal(decodeXml(textAtLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(textAtLimit.replace('</Notes>', 'x</Notes>')));

    const attributeAtLimit = valid.replace(
        ' xmlns:ae=',
        ` xmlns:pad="${'u'.repeat(TCX_LIMITS.maxAttributeValueBytes)}" xmlns:ae=`
    );
    assert.equal(decodeXml(attributeAtLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(attributeAtLimit.replace('" xmlns:ae=', 'u" xmlns:ae=')));

    const localAtLimit = 'Q'.repeat(TCX_LIMITS.maxQNameBytes - 'synthetic:'.length);
    const qnameAtLimit = valid.replace(
        '</Activity>',
        `<Extensions><synthetic:${localAtLimit}/></Extensions></Activity>`
    );
    assert.equal(decodeXml(qnameAtLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(qnameAtLimit.replace(`${localAtLimit}/`, `${localAtLimit}Q/`)));

    const nested = count => {
        let value = '';
        for (let index = 0; index < count; index += 1) {
            value = `<synthetic:X>${value}</synthetic:X>`;
        }
        return valid.replace(
            '</TrainingCenterDatabase>',
            `<Extensions>${value}</Extensions></TrainingCenterDatabase>`
        );
    };
    assert.equal(decodeXml(nested(TCX_LIMITS.maxDepth - 2)).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(nested(TCX_LIMITS.maxDepth - 1)));

    const extensionChildren = count => valid.replace(
        '</TrainingCenterDatabase>',
        `<Extensions>${'<synthetic:E/>'.repeat(count)}</Extensions></TrainingCenterDatabase>`
    );
    assert.equal(decodeXml(extensionChildren(TCX_LIMITS.maxExtensionChildren)).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(extensionChildren(TCX_LIMITS.maxExtensionChildren + 1)));

    const attributes = count => Array.from(
        { length: count },
        (_, index) => ` a${index}="x"`
    ).join('');
    const pointWithUnknown = createSyntheticTcxActivity({
        laps: [{
            start: SYNTHETIC_TCX_START,
            totalTime: 0,
            distance: 0,
            tracks: [[validPoint(SYNTHETIC_TCX_START, { unknownExtension: true })]]
        }]
    });
    const exactAttributes = pointWithUnknown.replace(
        '<synthetic:Unknown synthetic:flag="bounded">',
        `<synthetic:Unknown${attributes(TCX_LIMITS.maxAttributesPerElement)}>`
    );
    assert.equal(decodeXml(exactAttributes).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(exactAttributes.replace(
        `${attributes(TCX_LIMITS.maxAttributesPerElement)}>`,
        `${attributes(TCX_LIMITS.maxAttributesPerElement + 1)}>`
    )));
});

test('high-count element, attribute, child, row, and extension guards accept exact limits and reject one over', () => {
    const importLine = `import { tcxDecoder, TCX_MEDIA_TYPE } from './js/decoders/tcx/decoder.js';`;
    const decodeLine = `const decode = content => tcxDecoder.decode({ mediaType: TCX_MEDIA_TYPE, content });`;
    const baseStart = `const start = '${SYNTHETIC_TCX_START}';`;
    const shell = body => `${importLine}${decodeLine}${baseStart}${body}`;

    const collectionScript = over => shell(`
        let pointIndex = 0;
        const laps = [];
        for (let lap = 0; lap < 10000; lap += 1) {
            const tracks = [];
            for (let track = 0; track < 2; track += 1) {
                const points = [];
                for (let point = 0; point < 10; point += 1) {
                    const time = new Date(Date.parse(start) + pointIndex).toISOString();
                    pointIndex += 1;
                    points.push('<Trackpoint><Time>' + time + '</Time></Trackpoint>');
                }
                tracks.push('<Track>' + points.join('') + '</Track>');
            }
            const maximum = lap < 9998 ? '<MaximumSpeed>0</MaximumSpeed>' : '';
            const cadence = lap < 9998 ? '<Cadence>0</Cadence>' : '';
            const extra = ${over ? "lap === 9999 ? '<Notes>x</Notes>' : ''" : "''"};
            laps.push('<Lap StartTime="' + start + '"><TotalTimeSeconds>0</TotalTimeSeconds><DistanceMeters>0</DistanceMeters>'
                + maximum + '<Calories>0</Calories><Intensity>Active</Intensity>' + cadence
                + '<TriggerMethod>Manual</TriggerMethod>' + tracks.join('') + extra + '</Lap>');
        }
        const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>'
            + start + '</Id>' + laps.join('') + '</Activity></Activities></TrainingCenterDatabase>';
        ${over
            ? "try { decode(xml); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; }"
            : "const bundle = decode(xml); if (bundle.laps.length !== 10000 || pointIndex !== 200000) throw new Error('boundary');"}
        process.stdout.write('ok');
    `);
    assert.equal(runBoundaryChild(collectionScript(false)), 'ok');
    assert.equal(runBoundaryChild(collectionScript(true)), 'ok');

    const rowScript = shell(`
        let pointIndex = 0;
        const tracks = [];
        for (const count of [100000, 100001]) {
            const points = [];
            for (let point = 0; point < count; point += 1) {
                const time = new Date(Date.parse(start) + pointIndex).toISOString();
                pointIndex += 1;
                points.push('<Trackpoint><Time>' + time + '</Time></Trackpoint>');
            }
            tracks.push('<Track>' + points.join('') + '</Track>');
        }
        const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>'
            + start + '</Id><Lap StartTime="' + start + '"><TotalTimeSeconds>0</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Calories>0</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>'
            + tracks.join('') + '</Lap></Activity></Activities></TrainingCenterDatabase>';
        try { decode(xml); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; }
        process.stdout.write('ok');
    `);
    assert.equal(runBoundaryChild(rowScript), 'ok');

    const childrenScript = count => shell(`
        const children = '<Name/>'.repeat(${count});
        const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>'
            + start + '</Id><Lap StartTime="' + start + '"><TotalTimeSeconds>0</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Calories>0</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod></Lap><Creator>'
            + children + '</Creator></Activity></Activities></TrainingCenterDatabase>';
        ${count > TCX_LIMITS.maxChildrenPerElement
            ? "try { decode(xml); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; }"
            : "decode(xml);"}
        process.stdout.write('ok');
    `);
    assert.equal(runBoundaryChild(childrenScript(TCX_LIMITS.maxChildrenPerElement)), 'ok');
    assert.equal(runBoundaryChild(childrenScript(TCX_LIMITS.maxChildrenPerElement + 1)), 'ok');

    const attributeScript = over => shell(`
        const full = Array.from({ length: 32 }, (_, index) => ' a' + index + '="x"').join('');
        const partialCount = ${over ? 30 : 29};
        const partial = Array.from({ length: partialCount }, (_, index) => ' a' + index + '="x"').join('');
        const children = ('<Name' + full + '/>').repeat(15624) + '<Name' + partial + '/>';
        const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>'
            + start + '</Id><Lap StartTime="' + start + '"><TotalTimeSeconds>0</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Calories>0</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod></Lap><Creator>'
            + children + '</Creator></Activity></Activities></TrainingCenterDatabase>';
        ${over
            ? "try { decode(xml); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; }"
            : "decode(xml);"}
        process.stdout.write('ok');
    `);
    assert.equal(runBoundaryChild(attributeScript(false)), 'ok');
    assert.equal(runBoundaryChild(attributeScript(true)), 'ok');

    const extensionScript = over => shell(`
        const first = '<s:E/>'.repeat(199999);
        const second = '<s:E/>'.repeat(${over ? 200000 : 199999});
        const extensions = '<Extensions><s:G>' + first + '</s:G><s:G>' + second + '</s:G></Extensions>';
        const xml = '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:s="urn:stravastats:synthetic:limit"><Activities><Activity Sport="Running"><Id>'
            + start + '</Id><Lap StartTime="' + start + '"><TotalTimeSeconds>0</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Calories>0</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod></Lap></Activity></Activities>'
            + extensions + '</TrainingCenterDatabase>';
        ${over
            ? "try { decode(xml); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; }"
            : "decode(xml);"}
        process.stdout.write('ok');
    `);
    assert.equal(runBoundaryChild(extensionScript(false)), 'ok');
    assert.equal(runBoundaryChild(extensionScript(true)), 'ok');
});

test('descriptor rejects accessors, symbols, special prototypes, extra keys, and reflection failures', () => {
    const content = createSyntheticTcxActivity();
    const accessor = { mediaType: TCX_MEDIA_TYPE };
    Object.defineProperty(accessor, 'content', { enumerable: true, get() { throw new Error('private'); } });
    const symbol = { mediaType: TCX_MEDIA_TYPE, content, [Symbol('private')]: true };
    const special = Object.assign(Object.create({ private: true }), { mediaType: TCX_MEDIA_TYPE, content });
    const extra = { mediaType: TCX_MEDIA_TYPE, content, private: true };
    const proxy = new Proxy({}, { ownKeys() { throw new Error('private'); } });
    for (const input of [accessor, symbol, special, extra, proxy]) {
        assertImportError(() => tcxDecoder.decode(input));
    }
    assertImportError(
        () => tcxDecoder.decode({ mediaType: 'application/xml', content }),
        IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
    assertImportError(
        () => tcxDecoder.decode({ mediaType: TCX_MEDIA_TYPE, content: '' }),
        IMPORT_ERROR_CODE.FILE_EMPTY
    );
});

test('input remains unchanged and returned output is detached', () => {
    const descriptor = { mediaType: TCX_MEDIA_TYPE, content: createSyntheticTcxActivity() };
    const snapshot = structuredClone(descriptor);
    const bundle = tcxDecoder.decode(descriptor);
    assert.deepEqual(descriptor, snapshot);
    assert.throws(() => { bundle.activity.id = 'changed'; }, TypeError);
    assert.deepEqual(descriptor, snapshot);
});

test('errors and warnings never expose XML values, causes, or private canaries', () => {
    const canary = 'PRIVATE_CANARY_9f13';
    const content = createSyntheticTcxActivity().replace('<AltitudeMeters>12.5</AltitudeMeters>', `<AltitudeMeters>${canary}</AltitudeMeters>`);
    assert.throws(() => decodeXml(content), error => {
        const serialized = `${error.name}|${error.code}|${error.message}|${JSON.stringify(error)}|${error.cause ?? ''}`;
        assert.equal(serialized.includes(canary), false);
        assert.equal(serialized.includes('<AltitudeMeters>'), false);
        assert.equal(serialized.includes('Number'), false);
        return true;
    });
});

test('decode performs zero application I/O and no logging or timer work', () => {
    const names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'localStorage', 'sessionStorage', 'caches', 'Worker'];
    const originals = new Map();
    let calls = 0;
    for (const name of names) {
        originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, {
            configurable: true,
            value() { calls += 1; throw new Error('I/O sentinel'); }
        });
    }
    const originalConsole = console.log;
    const originalTimeout = globalThis.setTimeout;
    console.log = () => { calls += 1; };
    globalThis.setTimeout = () => { calls += 1; throw new Error('timer sentinel'); };
    try {
        const bundle = decode();
        assert.equal(bundle.activity.sportCategory, 'run');
        assert.equal(calls, 0);
    } finally {
        console.log = originalConsole;
        globalThis.setTimeout = originalTimeout;
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('byte-identical output is stable across timezone and locale environments', () => {
    const script = `
        import { tcxDecoder } from './js/decoders/tcx/decoder.js';
        import { syntheticTcxDescriptor } from './tests/fixtures/synthetic/tcx/tcx-fixture.js';
        process.stdout.write(JSON.stringify(tcxDecoder.decode(syntheticTcxDescriptor())));
    `;
    const run = env => execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        encoding: 'utf8'
    });
    assert.equal(run({ TZ: 'UTC', LANG: 'C' }), run({ TZ: 'Pacific/Honolulu', LANG: 'fr_FR.UTF-8' }));
});
