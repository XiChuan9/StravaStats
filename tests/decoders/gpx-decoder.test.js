import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
    validateCanonicalActivity,
    validateCanonicalStreamSet,
    validateImportedActivityBundle
} from '../../js/data/contracts/index.js';
import {
    GPX_LIMITS,
    GPX_MEDIA_TYPE,
    gpxDecoder
} from '../../js/decoders/gpx/decoder.js';
import { IMPORT_ERROR_CODE } from '../../js/import/errors.js';
import {
    SYNTHETIC_GPX_START,
    createSyntheticGpxActivity,
    createSyntheticGpxPoint,
    syntheticGpxDescriptor
} from '../fixtures/synthetic/gpx/gpx-fixture.js';

function decode(options = {}) {
    return gpxDecoder.decode(syntheticGpxDescriptor(createSyntheticGpxActivity(options)));
}

function decodeXml(content) {
    return gpxDecoder.decode(syntheticGpxDescriptor(content));
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

test('GPX descriptor and resource limits are exact frozen internal boundaries', () => {
    assert.deepEqual(Object.keys(gpxDecoder), ['id', 'mediaType', 'decode']);
    assert.equal(gpxDecoder.id, 'gpx');
    assert.equal(gpxDecoder.mediaType, GPX_MEDIA_TYPE);
    assert.equal(typeof gpxDecoder.decode, 'function');
    assert.ok(Object.isFrozen(gpxDecoder));
    assert.deepEqual(GPX_LIMITS, {
        maxXmlBytes: 16_777_216,
        maxDepth: 32,
        maxElements: 500_000,
        maxAttributesPerElement: 32,
        maxAttributes: 500_000,
        maxTextNodeBytes: 262_144,
        maxAttributeValueBytes: 4_096,
        maxQNameBytes: 128,
        maxChildrenPerElement: 200_000,
        maxTracks: 10_000,
        maxSegments: 20_000,
        maxTrackpoints: 225_000,
        maxTimedRows: 200_000,
        maxExtensionElements: 400_000,
        maxExtensionChildren: 32
    });
    assert.ok(Object.isFrozen(GPX_LIMITS));
});

test('default GPX maps WGS84, elevation, HR, cadence, power, zero, and provenance', () => {
    const bundle = decode();
    assert.deepEqual(bundle.activity, {
        schemaVersion: 1,
        id: 'gpx-track:2032-05-06T07%3A08%3A09.000Z:1:1:2',
        sportCategory: 'run',
        sportVariant: null,
        startTimeUtc: SYNTHETIC_GPX_START,
        timeZone: { ianaName: null, utcOffsetMinutes: 0 },
        capabilities: {
            hasGps: true,
            hasHeartRate: true,
            hasPower: true,
            hasCadence: true,
            hasLaps: false
        },
        name: 'Synthetic GPX Activity'
    });
    assert.deepEqual(bundle.streams.series.map(item => item.streamType), [
        'position', 'altitude', 'heartRate', 'cadence', 'power'
    ]);
    assert.deepEqual(series(bundle, 'position').values, [[0, 0], [1, 2]]);
    assert.deepEqual(series(bundle, 'altitude').values, [0, 12.5]);
    assert.deepEqual(series(bundle, 'heartRate').values, [140, 150]);
    assert.deepEqual(series(bundle, 'cadence').values, [0, 90]);
    assert.deepEqual(series(bundle, 'power').values, [0, 250]);
    assert.deepEqual(series(bundle, 'position').offsetsSeconds, [0, 10]);
    assert.deepEqual(bundle.laps, []);
    assert.deepEqual(bundle.events, []);
    assert.deepEqual(bundle.devices, []);
    assert.deepEqual(bundle.sources, [{
        id: `${bundle.activity.id}:source:0`,
        activityId: bundle.activity.id,
        provider: 'gpx',
        externalId: null,
        rawArtifactId: null,
        acquisitionMethod: 'local-file',
        deviceId: null,
        importedAt: SYNTHETIC_GPX_START
    }]);
    assert.deepEqual(warningCodes(bundle), [
        'GPX_IMPORT_TIME_FALLBACK', 'GPX_TIMEZONE_NAME_UNAVAILABLE'
    ]);
    assert.equal(validateCanonicalActivity(bundle.activity).ok, true);
    assert.equal(validateCanonicalStreamSet(bundle.streams).ok, true);
    assert.equal(validateImportedActivityBundle(bundle).ok, true);
    assert.ok(Object.isFrozen(bundle));
    assert.ok(Object.isFrozen(bundle.streams.series[0].values));
    assert.deepEqual(structuredClone(bundle), bundle);
    assert.deepEqual(JSON.parse(JSON.stringify(bundle)), bundle);
});

test('prefixed core namespace and inert schemaLocation are equivalent without dereference', () => {
    assert.deepEqual(decode({ prefixed: true, schemaLocation: true }), decode());
});

test('multiple Tracks and Segments flatten in encounter order without inventing Laps', () => {
    const bundle = decode({
        tracks: [
            {
                name: 'Combined',
                type: 'RUNNING',
                segments: [[createSyntheticGpxPoint({
                    latitude: 0,
                    longitude: 0,
                    time: SYNTHETIC_GPX_START,
                    heartRate: 0 + 140
                })], [createSyntheticGpxPoint({
                    latitude: 1,
                    longitude: 1,
                    time: '2032-05-06T07:08:10.000Z'
                })]]
            },
            {
                name: 'Combined',
                type: 'run',
                segments: [[createSyntheticGpxPoint({
                    latitude: 2,
                    longitude: 2,
                    time: '2032-05-06T07:08:11.000Z'
                })]]
            }
        ]
    });
    assert.equal(bundle.activity.name, 'Combined');
    assert.equal(bundle.activity.sportCategory, 'run');
    assert.equal(bundle.activity.capabilities.hasLaps, false);
    assert.deepEqual(bundle.laps, []);
    assert.deepEqual(series(bundle, 'position').offsetsSeconds, [0, 1, 2]);
    assert.match(bundle.activity.id, /:2:3:3$/);
});

test('untimed points are validated and ignored without fabricated offsets or values', () => {
    const bundle = decode({
        tracks: [{
            name: 'Timed subset',
            type: 'Running',
            segments: [[
                createSyntheticGpxPoint({
                    latitude: 5,
                    longitude: 6,
                    elevation: 999,
                    heartRate: 180,
                    power: 400
                }),
                createSyntheticGpxPoint({
                    latitude: 0,
                    longitude: 0,
                    elevation: 0,
                    time: SYNTHETIC_GPX_START,
                    cadence: 0,
                    power: 0
                })
            ]]
        }]
    });
    assert.deepEqual(series(bundle, 'position').values, [[0, 0]]);
    assert.deepEqual(series(bundle, 'altitude').values, [0]);
    assert.equal(series(bundle, 'heartRate'), undefined);
    assert.deepEqual(series(bundle, 'power').values, [0]);
    assert.deepEqual(series(bundle, 'power').offsetsSeconds, [0]);
    assert.ok(warningCodes(bundle).includes('GPX_UNTIMED_TRACKPOINT_IGNORED'));
    assert.equal(Object.hasOwn(bundle.activity, 'elapsedTimeSeconds'), false);
    assert.equal(Object.hasOwn(bundle.activity, 'movingTimeSeconds'), false);
});

test('all-untimed GPX fails closed instead of using metadata time', () => {
    const xml = createSyntheticGpxActivity({
        metadataTime: '2032-05-06T00:00:00.000Z',
        tracks: [{
            name: 'No time',
            type: 'Running',
            segments: [[createSyntheticGpxPoint({ latitude: 1, longitude: 2 })]]
        }]
    });
    assertImportError(() => decodeXml(xml));
});

test('missing stream fields become null only when the timed series exists elsewhere', () => {
    const bundle = decode({
        tracks: [{
            name: 'Sparse sensors',
            type: 'Ride',
            segments: [[
                createSyntheticGpxPoint({
                    latitude: 0,
                    longitude: 0,
                    time: SYNTHETIC_GPX_START
                }),
                createSyntheticGpxPoint({
                    latitude: 1,
                    longitude: 1,
                    time: '2032-05-06T07:08:19.000Z',
                    elevation: 0,
                    cadence: 0,
                    power: 0
                })
            ]]
        }]
    });
    assert.equal(series(bundle, 'heartRate'), undefined);
    assert.deepEqual(series(bundle, 'altitude').values, [null, 0]);
    assert.deepEqual(series(bundle, 'cadence').values, [null, 0]);
    assert.deepEqual(series(bundle, 'power').values, [null, 0]);
});

test('finite negative and large elevations are preserved while overflow fails', () => {
    const bundle = decode({
        tracks: [{
            name: 'Elevation',
            type: 'Hiking',
            segments: [[
                createSyntheticGpxPoint({
                    latitude: 0,
                    longitude: 0,
                    elevation: -500,
                    time: SYNTHETIC_GPX_START
                }),
                createSyntheticGpxPoint({
                    latitude: 1,
                    longitude: 1,
                    elevation: 100000,
                    time: '2032-05-06T07:08:10.000Z'
                })
            ]]
        }]
    });
    assert.deepEqual(series(bundle, 'altitude').values, [-500, 100000]);
    assertImportError(() => decodeXml(
        createSyntheticGpxActivity().replace('<ele>0</ele>', '<ele>1e309</ele>')
    ));
});

test('track-name precedence, metadata fallback, and conflict warning are deterministic', () => {
    const fallback = decode({
        metadataName: 'Metadata fallback',
        tracks: [{
            name: null,
            type: 'Walking',
            segments: [[createSyntheticGpxPoint({
                latitude: 0,
                longitude: 0,
                time: SYNTHETIC_GPX_START
            })]]
        }]
    });
    assert.equal(fallback.activity.name, 'Metadata fallback');
    assert.equal(fallback.activity.sportCategory, 'walk');

    const conflict = decode({
        tracks: [
            { name: 'One', type: 'Run', segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START })]] },
            { name: 'Two', type: 'Run', segments: [[createSyntheticGpxPoint({ latitude: 1, longitude: 1, time: '2032-05-06T07:08:10.000Z' })]] }
        ]
    });
    assert.equal(Object.hasOwn(conflict.activity, 'name'), false);
    assert.ok(warningCodes(conflict).includes('GPX_TRACK_NAME_CONFLICT_IGNORED'));
});

test('sport vocabulary maps exactly, unknown warns, and mixed categories fail', () => {
    const categories = new Map([
        ['cycling', 'ride'], ['WALKING', 'walk'], ['hike', 'hike'], ['workout', 'workout']
    ]);
    for (const [type, category] of categories) {
        assert.equal(decode({
            tracks: [{
                name: category,
                type,
                segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START })]]
            }]
        }).activity.sportCategory, category);
    }
    const unknown = decode({
        tracks: [{
            name: 'Unknown',
            type: 'unicycle',
            segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START })]]
        }]
    });
    assert.equal(unknown.activity.sportCategory, 'other');
    assert.ok(warningCodes(unknown).includes('GPX_SPORT_UNMAPPED'));
    assertImportError(() => decode({
        tracks: [
            { name: 'Run', type: 'run', segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START })]] },
            { name: 'Ride', type: 'ride', segments: [[createSyntheticGpxPoint({ latitude: 1, longitude: 1, time: '2032-05-06T07:08:10.000Z' })]] }
        ]
    }));
});

test('metadata bounds are validated but never replace or clamp track coordinates', () => {
    const bundle = decode({ bounds: { minlat: -10, minlon: -20, maxlat: 10, maxlon: 20 } });
    assert.deepEqual(series(bundle, 'position').values, [[0, 0], [1, 2]]);
    assertImportError(() => decode({ bounds: { minlat: 10, minlon: -20, maxlat: -10, maxlon: 20 } }));
    assertImportError(() => decode({ bounds: { minlat: -10, minlon: -20, maxlat: 10, maxlon: 180 } }));
});

test('equal-time compatible points fold and conflicts or decreasing time fail closed', () => {
    const compatible = decode({
        tracks: [{
            name: 'Fold',
            type: 'Run',
            segments: [[
                createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START, heartRate: 140 }),
                createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START, power: 0 })
            ]]
        }]
    });
    assert.deepEqual(series(compatible, 'position').values, [[0, 0]]);
    assert.deepEqual(series(compatible, 'heartRate').values, [140]);
    assert.deepEqual(series(compatible, 'power').values, [0]);

    for (const points of [
        [
            createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START }),
            createSyntheticGpxPoint({ latitude: 1, longitude: 0, time: SYNTHETIC_GPX_START })
        ],
        [
            createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: '2032-05-06T07:08:10.000Z' }),
            createSyntheticGpxPoint({ latitude: 1, longitude: 0, time: SYNTHETIC_GPX_START })
        ]
    ]) {
        assertImportError(() => decode({ tracks: [{ name: 'Bad', type: 'Run', segments: [points] }] }));
    }
});

test('Garmin extension conflicts, ranges, ignored fields, and literal paths are strict', () => {
    const conflict = createSyntheticGpxActivity().replace(
        '<gpxax:RunCadence>0</gpxax:RunCadence>',
        '<gpxax:RunCadence>1</gpxax:RunCadence>'
    );
    assertImportError(() => decodeXml(conflict));
    assertImportError(() => decodeXml(createSyntheticGpxActivity().replace(
        '<gpxtpx:hr>140</gpxtpx:hr>', '<gpxtpx:hr>0</gpxtpx:hr>'
    )));
    assertImportError(() => decodeXml(createSyntheticGpxActivity().replace(
        '<gpxax:Watts>0</gpxax:Watts>', '<gpxax:Watts>65536</gpxax:Watts>'
    )));

    const speed = decodeXml(createSyntheticGpxActivity().replace(
        '<gpxtpx:cad>0</gpxtpx:cad>',
        '<gpxtpx:cad>0</gpxtpx:cad><gpxtpx:speed>0</gpxtpx:speed>'
    ));
    assert.equal(series(speed, 'speed'), undefined);
    assert.ok(warningCodes(speed).includes('GPX_EXTENSION_FIELD_IGNORED'));

    const misplaced = createSyntheticGpxActivity().replace(
        '<trk><name>',
        '<trk><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions><name>'
    );
    assertImportError(() => decodeXml(misplaced));
});

test('unknown extension wildcard is bounded and rejects controlled namespace smuggling', () => {
    const unknown = decode({
        tracks: [{
            name: 'Unknown extension',
            type: 'Run',
            segments: [[createSyntheticGpxPoint({
                latitude: 0,
                longitude: 0,
                time: SYNTHETIC_GPX_START,
                unknownExtension: true
            })]]
        }]
    });
    assert.ok(warningCodes(unknown).includes('GPX_UNKNOWN_EXTENSION_IGNORED'));
    const withUnknown = createSyntheticGpxActivity({
        tracks: [{
            name: 'Smuggle',
            type: 'Run',
            segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START, unknownExtension: true })]]
        }]
    });
    assertImportError(() => decodeXml(withUnknown.replace(
        '<synthetic:Unknown synthetic:flag="bounded"/>',
        '<synthetic:Unknown><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></synthetic:Unknown>'
    )));
});

test('waypoints and routes are validated, ignored, and never become activity points', () => {
    const valid = createSyntheticGpxActivity();
    const extra = '<wpt lat="50" lon="60"><ele>100</ele><time>2032-05-06T00:00:00Z</time></wpt><rte><name>Ignored route</name><rtept lat="70" lon="80"/></rte>';
    const xml = valid.replace('<trk>', `${extra}<trk>`);
    const bundle = decodeXml(xml);
    assert.deepEqual(series(bundle, 'position').values, [[0, 0], [1, 2]]);
    assert.ok(warningCodes(bundle).includes('GPX_NON_TRACK_CONTENT_IGNORED'));
});

test('XML security rejects DTD, ENTITY, XInclude, PI, CDATA, and namespace spoofing', () => {
    const valid = createSyntheticGpxActivity();
    const attacks = [
        `<!DOCTYPE gpx [<!ENTITY xxe SYSTEM "file:///private/canary">]>${valid.replace('<?xml version="1.0" encoding="UTF-8"?>', '')}`,
        valid.replace('<name>Synthetic GPX Activity</name>', '<name>&private;</name>'),
        valid.replace('<name>Synthetic GPX Activity</name>', '<name><![CDATA[private]]></name>'),
        valid.replace('<name>Synthetic GPX Activity</name>', '<?private value?><name>Synthetic GPX Activity</name>'),
        valid.replace('xmlns:synthetic="urn:stravastats:synthetic:gpx"', 'xmlns:synthetic="http://www.w3.org/2001/XInclude"'),
        valid.replace('http://www.topografix.com/GPX/1/1', 'http://www.topografix.com/GPX/1/0'),
        valid.replace('xmlns="http://www.topografix.com/GPX/1/1"', 'xmlns="urn:spoofed"')
    ];
    for (const attack of attacks) assertImportError(() => decodeXml(attack));
});

test('strict XML lexical and schema sequence rules fail closed', () => {
    const valid = createSyntheticGpxActivity();
    const invalid = [
        valid.replace('<name>Synthetic GPX Activity</name><type>', '<type>Run</type><name>Synthetic GPX Activity</name><type>'),
        valid.replace(' lat="0"', ' lat="0" lat="1"'),
        valid.replace('creator="StravaStats synthetic fixture"', 'creator="bad<value"'),
        valid.replace(' lat="0"', ' lat="1e0"'),
        valid.replace('<ele>0</ele>', '<ele>1e0</ele>'),
        valid.replace('</name>', ']]></name>'),
        valid.replace('<trkpt', '<trkptx'),
        valid.replace('</gpx>', ''),
        valid.replace('version="1.1"', 'version="1.0"')
    ];
    for (const content of invalid) assertImportError(() => decodeXml(content));
});

test('descriptor rejects accessors, symbols, custom prototypes, extra keys, and Proxies', () => {
    const content = createSyntheticGpxActivity();
    let getterCalls = 0;
    const accessor = { mediaType: GPX_MEDIA_TYPE };
    Object.defineProperty(accessor, 'content', {
        enumerable: true,
        get() { getterCalls += 1; return content; }
    });
    const symbol = { mediaType: GPX_MEDIA_TYPE, content, [Symbol('private')]: true };
    const special = Object.assign(Object.create({ private: true }), { mediaType: GPX_MEDIA_TYPE, content });
    const extra = { mediaType: GPX_MEDIA_TYPE, content, private: true };
    const throwingProxy = new Proxy({}, { ownKeys() { throw new Error('private'); } });
    const ordinaryProxy = new Proxy({ mediaType: GPX_MEDIA_TYPE, content }, {});
    for (const input of [null, accessor, symbol, special, extra, throwingProxy, ordinaryProxy]) {
        assertImportError(() => gpxDecoder.decode(input));
    }
    assert.equal(getterCalls, 0);
    assertImportError(
        () => gpxDecoder.decode({ mediaType: 'application/xml', content }),
        IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
    assertImportError(
        () => gpxDecoder.decode({ mediaType: GPX_MEDIA_TYPE, content: '' }),
        IMPORT_ERROR_CODE.FILE_EMPTY
    );
});

test('input stays unchanged, output is detached, and errors/warnings are redacted', () => {
    const descriptor = syntheticGpxDescriptor();
    const snapshot = structuredClone(descriptor);
    const bundle = gpxDecoder.decode(descriptor);
    assert.deepEqual(descriptor, snapshot);
    assert.throws(() => { bundle.activity.id = 'changed'; }, TypeError);
    assert.deepEqual(descriptor, snapshot);

    const canary = 'PRIVATE_CANARY_GPX_61e9';
    const content = createSyntheticGpxActivity().replace('<ele>0</ele>', `<ele>${canary}</ele>`);
    assert.throws(() => decodeXml(content), error => {
        const serialized = `${error.name}|${error.code}|${error.message}|${JSON.stringify(error)}|${error.cause ?? ''}`;
        assert.equal(serialized.includes(canary), false);
        assert.equal(serialized.includes('<ele>'), false);
        return true;
    });
    assert.equal(JSON.stringify(bundle.warnings).includes('2032'), false);
});

test('decode performs zero application I/O, storage, logging, Worker, or timer work', () => {
    const names = [
        'fetch', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'localStorage',
        'sessionStorage', 'caches', 'Worker'
    ];
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
    const originalInterval = globalThis.setInterval;
    console.log = () => { calls += 1; };
    globalThis.setTimeout = () => { calls += 1; throw new Error('timer sentinel'); };
    globalThis.setInterval = () => { calls += 1; throw new Error('timer sentinel'); };
    try {
        assert.equal(decode().activity.sportCategory, 'run');
        assert.equal(calls, 0);
    } finally {
        console.log = originalConsole;
        globalThis.setTimeout = originalTimeout;
        globalThis.setInterval = originalInterval;
        for (const [name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});

test('serialized output is byte-identical across timezone and locale environments', () => {
    const script = `
        import { gpxDecoder } from './js/decoders/gpx/decoder.js';
        import { syntheticGpxDescriptor } from './tests/fixtures/synthetic/gpx/gpx-fixture.js';
        process.stdout.write(JSON.stringify(gpxDecoder.decode(syntheticGpxDescriptor())));
    `;
    const run = env => execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        encoding: 'utf8'
    });
    assert.equal(run({ TZ: 'UTC', LANG: 'C' }), run({ TZ: 'Pacific/Honolulu', LANG: 'zh_CN.UTF-8' }));
});

test('lexical resource limits accept exact and reject +1', () => {
    const valid = createSyntheticGpxActivity();
    const commentPayload = GPX_LIMITS.maxXmlBytes - new TextEncoder().encode(valid).length - 7;
    const atByteLimit = valid.replace('<gpx ', `<!--${'x'.repeat(commentPayload)}--><gpx `);
    assert.equal(new TextEncoder().encode(atByteLimit).length, GPX_LIMITS.maxXmlBytes);
    assert.equal(decodeXml(atByteLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(atByteLimit.replace('--><gpx', 'x--><gpx')));

    const textAtLimit = valid.replaceAll(
        '<name>Synthetic GPX Activity</name>',
        `<name>${'x'.repeat(GPX_LIMITS.maxTextNodeBytes)}</name>`
    );
    assert.equal(decodeXml(textAtLimit).activity.name.length, GPX_LIMITS.maxTextNodeBytes);
    assertImportError(() => decodeXml(textAtLimit.replace('</name>', 'x</name>')));

    const attributeAtLimit = valid.replace(
        'xmlns:synthetic=',
        `xmlns:pad="${'u'.repeat(GPX_LIMITS.maxAttributeValueBytes)}" xmlns:synthetic=`
    );
    assert.equal(decodeXml(attributeAtLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(attributeAtLimit.replace('" xmlns:synthetic=', 'u" xmlns:synthetic=')));

    const localAtLimit = 'Q'.repeat(GPX_LIMITS.maxQNameBytes - 'synthetic:'.length);
    const qnameAtLimit = valid.replace(
        '</gpx>',
        `<extensions><synthetic:${localAtLimit}/></extensions></gpx>`
    );
    assert.equal(decodeXml(qnameAtLimit).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(qnameAtLimit.replace(`${localAtLimit}/`, `${localAtLimit}Q/`)));

    const nested = count => valid.replace(
        '</gpx>',
        `<extensions>${'<synthetic:X>'.repeat(count)}${'</synthetic:X>'.repeat(count)}</extensions></gpx>`
    );
    assert.equal(decodeXml(nested(GPX_LIMITS.maxDepth - 2)).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(nested(GPX_LIMITS.maxDepth - 1)));

    const extensionChildren = count => valid.replace(
        '</gpx>',
        `<extensions>${'<synthetic:E/>'.repeat(count)}</extensions></gpx>`
    );
    assert.equal(decodeXml(extensionChildren(GPX_LIMITS.maxExtensionChildren)).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(extensionChildren(GPX_LIMITS.maxExtensionChildren + 1)));

    const attributes = count => Array.from({ length: count }, (_, index) => ` a${index}="x"`).join('');
    const pointWithUnknown = createSyntheticGpxActivity({
        tracks: [{
            name: 'Attributes',
            type: 'Run',
            segments: [[createSyntheticGpxPoint({ latitude: 0, longitude: 0, time: SYNTHETIC_GPX_START, unknownExtension: true })]]
        }]
    });
    const exactAttributes = pointWithUnknown.replace(
        '<synthetic:Unknown synthetic:flag="bounded"/>',
        `<synthetic:Unknown${attributes(GPX_LIMITS.maxAttributesPerElement)}/>`
    );
    assert.equal(decodeXml(exactAttributes).activity.sportCategory, 'run');
    assertImportError(() => decodeXml(exactAttributes.replace(
        `${attributes(GPX_LIMITS.maxAttributesPerElement)}/>`,
        `${attributes(GPX_LIMITS.maxAttributesPerElement + 1)}/>`
    )));
});

test('high-count structural resource limits accept exact and reject +1 independently', () => {
    const prelude = `
        import { gpxDecoder, GPX_MEDIA_TYPE } from './js/decoders/gpx/decoder.js';
        const decode = content => gpxDecoder.decode({ mediaType: GPX_MEDIA_TYPE, content });
        const start = '2032-05-06T07:08:09Z';
        const root = inner => '<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:s="urn:stravastats:synthetic:limit" version="1.1" creator="synthetic">' + inner + '</gpx>';
        const point = '<trkpt lat="0" lon="0"><time>' + start + '</time></trkpt>';
        const track = '<trk><trkseg>' + point + '</trkseg></trk>';
        const reject = content => { try { decode(content); throw new Error('accepted'); } catch (error) { if (error.code !== 'FILE_CORRUPTED') throw error; } };
    `;

    const elementScript = `${prelude}
        const extension = leaves => '<extensions><s:W><s:G>' + '<s:E/>'.repeat(199994) + '</s:G><s:G>' + '<s:E/>'.repeat(leaves - 199994) + '</s:G></s:W></extensions>';
        const exact = root('<rte/>'.repeat(100004) + track + extension(399987));
        decode(exact);
        reject(root('<rte/>'.repeat(100005) + track + extension(399987)));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(elementScript), 'ok');

    const attributeScript = `${prelude}
        const route = count => '<rte>' + '<rtept lat="0" lon="0"/>'.repeat(count) + '</rte>';
        const exact = root(route(124999) + route(124998) + track);
        decode(exact);
        reject(exact.replace('xmlns:s=', 'xmlns:t="urn:stravastats:synthetic:extra" xmlns:s='));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(attributeScript), 'ok');

    const childrenScript = `${prelude}
        decode(root('<rte/>'.repeat(199999) + track));
        reject(root('<rte/>'.repeat(200000) + track));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(childrenScript), 'ok');

    const trackScript = `${prelude}
        decode(root(track + '<trk/>'.repeat(9999)));
        reject(root(track + '<trk/>'.repeat(10000)));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(trackScript), 'ok');

    const segmentScript = `${prelude}
        const exactTrack = '<trk><trkseg>' + point + '</trkseg>' + '<trkseg/>'.repeat(19999) + '</trk>';
        decode(root(exactTrack));
        reject(root(exactTrack.replace('</trk>', '<trkseg/></trk>')));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(segmentScript), 'ok');

    const pointScript = `${prelude}
        const empty = '<trkpt lat="0" lon="0"/>';
        const make = extra => root('<trk><trkseg>' + point + empty.repeat(112499) + '</trkseg><trkseg>' + empty.repeat(112500 + extra) + '</trkseg></trk>');
        decode(make(0));
        reject(make(1));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(pointScript), 'ok');

    const timedRowScript = `${prelude}
        const makePoints = (count, offset) => {
            const values = [];
            const epoch = Date.parse(start);
            for (let index = 0; index < count; index += 1) {
                const time = new Date(epoch + (offset + index) * 1000).toISOString().replace('.000Z', 'Z');
                values.push('<trkpt lat="0" lon="0"><time>' + time + '</time></trkpt>');
            }
            return values.join('');
        };
        decode(root('<trk><trkseg>' + makePoints(200000, 0) + '</trkseg></trk>'));
        reject(root('<trk><trkseg>' + makePoints(100000, 0) + '</trkseg><trkseg>' + makePoints(100001, 100000) + '</trkseg></trk>'));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(timedRowScript), 'ok');

    const extensionScript = `${prelude}
        const extension = second => '<extensions><s:W><s:G>' + '<s:E/>'.repeat(199999) + '</s:G><s:G>' + '<s:E/>'.repeat(second) + '</s:G></s:W></extensions>';
        decode(root(track + extension(199998)));
        reject(root(track + extension(199999)));
        process.stdout.write('ok');
    `;
    assert.equal(runBoundaryChild(extensionScript), 'ok');
});
