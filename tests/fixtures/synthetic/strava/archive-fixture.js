import { deflateRawSync } from 'node:zlib';

const encoder = new TextEncoder();

const CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return value >>> 0;
}));

export const SYNTHETIC_ARCHIVE_CSV = [
    'Activity ID,Activity Date,Activity Type,Activity Name,Elapsed Time,Moving Time,Distance,Activity Filename',
    '00042,2026-07-01T01:02:03Z,Run,Synthetic Archive Run,3600,3500,10.5,activities/opaque-run.fit',
    'alpha/beta,2026-07-02T02:03:04Z,Ride,"Quoted, Archive Ride",4200,4000,25.25,activities/opaque-ride.gpx',
    ''
].join('\n');

export const SYNTHETIC_ARCHIVE_ENTRIES = Object.freeze([
    Object.freeze({ name: 'activities.csv', content: SYNTHETIC_ARCHIVE_CSV }),
    Object.freeze({ name: 'activities/', content: new Uint8Array(), directory: true }),
    Object.freeze({ name: 'activities/opaque-run.fit', content: 'synthetic opaque fit bytes' }),
    Object.freeze({ name: 'activities/opaque-ride.gpx', content: 'synthetic opaque gpx bytes' })
]);

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function bytes(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (typeof value === 'string') return encoder.encode(value);
    throw new TypeError('Synthetic fixture content must be a string or Uint8Array.');
}

function u16(value) {
    return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value) {
    return Uint8Array.of(
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff
    );
}

function join(parts) {
    const length = parts.reduce((total, part) => total + part.byteLength, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output;
}

export function createSyntheticStravaZip({
    entries = SYNTHETIC_ARCHIVE_ENTRIES,
    method = 0,
    utf8 = true
} = {}) {
    const locals = [];
    const central = [];
    let localOffset = 0;
    for (const source of entries) {
        const name = encoder.encode(source.name);
        const content = bytes(source.content);
        const directory = source.directory === true || source.name.endsWith('/');
        const selectedMethod = directory ? 0 : (source.method ?? method);
        const compressed = selectedMethod === 8
            ? new Uint8Array(deflateRawSync(content))
            : content;
        const checksum = crc32(content);
        const flags = source.flags ?? (utf8 ? 0x0800 : 0);
        const local = join([
            u32(0x04034b50),
            u16(selectedMethod === 8 ? 20 : 10),
            u16(flags),
            u16(selectedMethod),
            u16(0),
            u16(0),
            u32(checksum),
            u32(compressed.byteLength),
            u32(content.byteLength),
            u16(name.byteLength),
            u16(0),
            name,
            compressed
        ]);
        const unixMode = directory ? 0o040755 : 0o100644;
        central.push(join([
            u32(0x02014b50),
            u16(0x0314),
            u16(selectedMethod === 8 ? 20 : 10),
            u16(flags),
            u16(selectedMethod),
            u16(0),
            u16(0),
            u32(checksum),
            u32(compressed.byteLength),
            u32(content.byteLength),
            u16(name.byteLength),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32((unixMode << 16) | (directory ? 0x10 : 0)),
            u32(localOffset),
            name
        ]));
        locals.push(local);
        localOffset += local.byteLength;
    }
    const centralBytes = join(central);
    return join([
        ...locals,
        centralBytes,
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(entries.length),
        u16(entries.length),
        u32(centralBytes.byteLength),
        u32(localOffset),
        u16(0)
    ]);
}

export function toBase64(value) {
    return Buffer.from(value).toString('base64');
}

export function syntheticStravaZipArtifact(options) {
    return Object.freeze({
        mediaType: 'application/zip;profile=strava-archive;base64',
        content: toBase64(createSyntheticStravaZip(options))
    });
}
