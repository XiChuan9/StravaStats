import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { deepFreeze } from './safe-data.js';
import { CSV_FILE_LIMITS } from '../shared/csv-security.js';

export const ACTIVITIES_CSV_LIMITS = deepFreeze({
    maxBytes: CSV_FILE_LIMITS.maxBytes,
    maxRows: CSV_FILE_LIMITS.maxRows,
    maxColumns: 128,
    maxFieldBytes: 262_144,
    maxRowBytes: 1_048_576
});

export const ACTIVITIES_CSV_FRAME_FIELDS = deepFreeze([
    'activityId',
    'startTime',
    'sportType',
    'name',
    'elapsedTime',
    'movingTime',
    'distance',
    'elevationGain',
    'averageHeartRate',
    'averagePower',
    'averageCadence',
    'timeZone',
    'activityFilename'
]);

export const ENGLISH_ACTIVITIES_CSV_PROFILE = deepFreeze({
    id: 'english-v1',
    headers: {
        activityId: ['Activity ID'],
        startTime: ['Activity Date'],
        sportType: ['Activity Type'],
        name: ['Activity Name'],
        elapsedTime: ['Elapsed Time'],
        movingTime: ['Moving Time'],
        distance: ['Distance'],
        elevationGain: ['Elevation Gain'],
        averageHeartRate: ['Average Heart Rate'],
        averagePower: ['Average Watts'],
        averageCadence: ['Average Cadence'],
        timeZone: ['Activity Time Zone'],
        activityFilename: ['Activity Filename']
    }
});

const REQUIRED_FIELDS = new Set(['activityId', 'startTime', 'sportType']);
const REPEATED_FIELDS = new Set(['elapsedTime', 'distance']);
const FRAME_FIELDS = Object.freeze([
    'schemaVersion', 'profileId', 'columnCount', 'positions', 'hasExtra',
    'headerSha256', 'rowLexical', 'row'
]);
const FRAME_PREFIX = '{"schemaVersion":1,"profileId":"english-v1",';
const encoder = new TextEncoder();
const SHA256_CONSTANTS = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function fail(code) {
    throw importError(code, false, 'decode');
}

function byteLength(value) {
    try {
        return encoder.encode(value).byteLength;
    } catch {
        fail(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER);
    }
}

function characterInfo(value, index) {
    const code = value.charCodeAt(index);
    if (
        code === 0
        || code === 0xfffd
        || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
    ) fail(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER);
    if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
            fail(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER);
        }
        return { width: 2, bytes: 4 };
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
        fail(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER);
    }
    return {
        width: 1,
        bytes: code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3
    };
}

function rotateRight(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(value) {
    const bytes = encoder.encode(value);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const words = new Uint32Array(64);

    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let index = 0; index < 16; index += 1) {
            words[index] = view.getUint32(offset + index * 4);
        }
        for (let index = 16; index < 64; index += 1) {
            const previous = words[index - 15];
            const prior = words[index - 2];
            const sigma0 = rotateRight(previous, 7)
                ^ rotateRight(previous, 18)
                ^ (previous >>> 3);
            const sigma1 = rotateRight(prior, 17)
                ^ rotateRight(prior, 19)
                ^ (prior >>> 10);
            words[index] = (
                words[index - 16]
                + sigma0
                + words[index - 7]
                + sigma1
            ) >>> 0;
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;
        let f = h5;
        let g = h6;
        let h = h7;
        for (let index = 0; index < 64; index += 1) {
            const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choose = (e & f) ^ (~e & g);
            const temporary1 = (
                h + sum1 + choose + SHA256_CONSTANTS[index] + words[index]
            ) >>> 0;
            const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temporary2 = (sum0 + majority) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + temporary1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temporary1 + temporary2) >>> 0;
        }
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
        h5 = (h5 + f) >>> 0;
        h6 = (h6 + g) >>> 0;
        h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
        .map(part => part.toString(16).padStart(8, '0'))
        .join('');
}

function assertCharacters(value) {
    for (let index = 0; index < value.length; index += 1) {
        const info = characterInfo(value, index);
        index += info.width - 1;
    }
}

function snapshotBytes(value) {
    try {
        if (value instanceof Uint8Array) return new Uint8Array(value);
        if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
    } catch {
        // Fall through to the stable encoding error.
    }
    fail(IMPORT_ERROR_CODE.CSV_INVALID_ENCODING);
}

export function decodeActivitiesCsvUtf8(value) {
    const bytes = snapshotBytes(value);
    if (bytes.byteLength > ACTIVITIES_CSV_LIMITS.maxBytes) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_LARGE);
    }
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        fail(IMPORT_ERROR_CODE.CSV_INVALID_ENCODING);
    }
    assertCharacters(text);
    return text;
}

function scanActivitiesCsv(value, onRecord) {
    if (typeof value !== 'string' || typeof onRecord !== 'function') {
        fail(IMPORT_ERROR_CODE.CSV_INVALID_ENCODING);
    }
    if (byteLength(value) > ACTIVITIES_CSV_LIMITS.maxBytes) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_LARGE);
    }
    const bom = value.startsWith('\uFEFF') ? '\uFEFF' : '';
    const text = bom ? value.slice(1) : value;
    if (text.length === 0) fail(IMPORT_ERROR_CODE.FILE_EMPTY);

    let row = [];
    let fieldParts = [];
    let fieldStart = 0;
    let fieldBytes = 0;
    let rowBytes = 0;
    let quoted = false;
    let quoteClosed = false;
    let rowHasCsvStructure = false;
    let recordCount = 0;
    let rowStart = 0;

    const addRowBytes = amount => {
        rowBytes += amount;
        if (rowBytes > ACTIVITIES_CSV_LIMITS.maxRowBytes) {
            fail(IMPORT_ERROR_CODE.CSV_ROW_TOO_LARGE);
        }
    };
    const addFieldBytes = amount => {
        fieldBytes += amount;
        if (fieldBytes > ACTIVITIES_CSV_LIMITS.maxFieldBytes) {
            fail(IMPORT_ERROR_CODE.CSV_FIELD_TOO_LARGE);
        }
    };
    const finishField = end => {
        if (!quoteClosed) fieldParts.push(text.slice(fieldStart, end));
        row.push(fieldParts.join(''));
        if (row.length > ACTIVITIES_CSV_LIMITS.maxColumns) {
            fail(IMPORT_ERROR_CODE.CSV_TOO_MANY_COLUMNS);
        }
        fieldParts = [];
        fieldBytes = 0;
        quoteClosed = false;
    };
    const finishRow = (fieldEnd, lexicalEnd) => {
        finishField(fieldEnd);
        const blank = !rowHasCsvStructure && row.length === 1 && row[0].length === 0;
        if (!blank) {
            recordCount += 1;
            if (recordCount > ACTIVITIES_CSV_LIMITS.maxRows + 1) {
                fail(IMPORT_ERROR_CODE.CSV_TOO_MANY_ROWS);
            }
            onRecord(
                Object.freeze(row),
                recordCount - 1,
                `${recordCount === 1 ? bom : ''}${text.slice(rowStart, lexicalEnd)}`
            );
        }
        row = [];
        quoted = false;
        quoteClosed = false;
        rowHasCsvStructure = false;
        rowBytes = 0;
        rowStart = lexicalEnd;
    };

    for (let index = 0; index < text.length; index += 1) {
        const info = characterInfo(text, index);
        const character = text[index];
        addRowBytes(info.bytes);

        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    addRowBytes(1);
                    addFieldBytes(1);
                    fieldParts.push(text.slice(fieldStart, index), '"');
                    index += 1;
                    fieldStart = index + 1;
                } else {
                    fieldParts.push(text.slice(fieldStart, index));
                    fieldStart = index + 1;
                    quoted = false;
                    quoteClosed = true;
                }
            } else if (character === '\r') {
                if (text[index + 1] !== '\n') {
                    fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
                }
                addRowBytes(1);
                addFieldBytes(1);
                fieldParts.push(text.slice(fieldStart, index), '\n');
                index += 1;
                fieldStart = index + 1;
            } else {
                addFieldBytes(info.bytes);
                index += info.width - 1;
            }
            continue;
        }

        if (quoteClosed) {
            if (character === ',') {
                finishField(index);
                fieldStart = index + 1;
                continue;
            }
            if (character === '\n') {
                finishRow(index, index + 1);
                fieldStart = index + 1;
                continue;
            }
            if (character === '\r' && text[index + 1] === '\n') {
                addRowBytes(1);
                const end = index;
                index += 1;
                finishRow(end, index + 1);
                fieldStart = index + 1;
                continue;
            }
            fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
        }

        if (character === '"') {
            if (fieldBytes !== 0 || fieldParts.length !== 0 || fieldStart !== index) {
                fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
            }
            quoted = true;
            rowHasCsvStructure = true;
            fieldStart = index + 1;
        } else if (character === ',') {
            finishField(index);
            fieldStart = index + 1;
            rowHasCsvStructure = true;
        } else if (character === '\n') {
            finishRow(index, index + 1);
            fieldStart = index + 1;
        } else if (character === '\r') {
            if (text[index + 1] !== '\n') fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
            addRowBytes(1);
            const end = index;
            index += 1;
            finishRow(end, index + 1);
            fieldStart = index + 1;
        } else {
            addFieldBytes(info.bytes);
            index += info.width - 1;
        }
    }

    if (quoted) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
    if (row.length > 0 || fieldBytes > 0 || quoteClosed || fieldStart < text.length) {
        finishRow(text.length, text.length);
    }
    if (recordCount === 0) fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    return recordCount;
}

function resolveEnglishHeader(header) {
    const positions = [];
    const matched = new Set();
    for (const field of ACTIVITIES_CSV_FRAME_FIELDS) {
        const aliases = new Set(ENGLISH_ACTIVITIES_CSV_PROFILE.headers[field]);
        const found = [];
        for (let index = 0; index < header.length; index += 1) {
            if (aliases.has(header[index])) {
                found.push(index);
                matched.add(index);
            }
        }
        const maximum = REPEATED_FIELDS.has(field) ? 2 : 1;
        if (
            found.length > maximum
            || (REQUIRED_FIELDS.has(field) && found.length !== 1)
        ) fail(IMPORT_ERROR_CODE.CSV_HEADER_INVALID);
        positions.push(found.length === 0 ? null : found.at(-1));
    }
    return Object.freeze({
        positions: Object.freeze(positions),
        hasExtra: header.some((_, index) => !matched.has(index))
    });
}

function exactDataObject(value, fields) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== fields.length
            || keys.some(key => typeof key !== 'string' || !fields.includes(key))
        ) return null;
        const result = {};
        for (const field of fields) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function denseArray(value, expectedLength = null) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        if (expectedLength !== null && value.length !== expectedLength) return null;
        const expected = new Set([
            ...Array.from({ length: value.length }, (_, index) => String(index)),
            'length'
        ]);
        if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !expected.has(key))) {
            return null;
        }
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

export function parseActivitiesCsvFrame(value) {
    if (typeof value !== 'string' || !value.startsWith(FRAME_PREFIX)) return null;
    if (byteLength(value) > ACTIVITIES_CSV_LIMITS.maxBytes) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_LARGE);
    }
    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch {
        fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
    }
    const frame = exactDataObject(parsed, FRAME_FIELDS);
    const positions = frame
        ? denseArray(frame.positions, ACTIVITIES_CSV_FRAME_FIELDS.length)
        : null;
    const row = frame ? denseArray(frame.row) : null;
    const presentPositions = positions?.filter(position => position !== null) || [];
    if (
        !frame
        || frame.schemaVersion !== 1
        || frame.profileId !== ENGLISH_ACTIVITIES_CSV_PROFILE.id
        || !Number.isSafeInteger(frame.columnCount)
        || frame.columnCount <= 0
        || frame.columnCount > ACTIVITIES_CSV_LIMITS.maxColumns
        || !positions
        || typeof frame.hasExtra !== 'boolean'
        || typeof frame.headerSha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(frame.headerSha256)
        || typeof frame.rowLexical !== 'string'
        || !row
        || row.length > ACTIVITIES_CSV_LIMITS.maxColumns
        || row.some(cell => typeof cell !== 'string')
        || positions.some(position => position !== null && (
            !Number.isSafeInteger(position)
            || position < 0
            || position >= frame.columnCount
        ))
        || positions.slice(0, 3).some(position => position === null)
        || new Set(presentPositions).size !== presentPositions.length
    ) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);

    let rowBytes = Math.max(0, row.length - 1);
    for (const cell of row) {
        assertCharacters(cell);
        const fieldBytes = byteLength(cell);
        if (fieldBytes > ACTIVITIES_CSV_LIMITS.maxFieldBytes) {
            fail(IMPORT_ERROR_CODE.CSV_FIELD_TOO_LARGE);
        }
        rowBytes += fieldBytes;
    }
    if (rowBytes > ACTIVITIES_CSV_LIMITS.maxRowBytes) {
        fail(IMPORT_ERROR_CODE.CSV_ROW_TOO_LARGE);
    }
    const lexicalRows = parseActivitiesCsv(frame.rowLexical);
    if (
        lexicalRows.length !== 1
        || lexicalRows[0].length !== row.length
        || lexicalRows[0].some((cell, index) => cell !== row[index])
    ) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
    return deepFreeze({
        columnCount: frame.columnCount,
        positions,
        hasExtra: frame.hasExtra,
        row
    });
}

export function parseActivitiesCsv(value) {
    const records = [];
    scanActivitiesCsv(value, record => records.push(record));
    return deepFreeze(records);
}

export function frameActivitiesCsv(value) {
    const records = [];
    const count = scanActivitiesCsv(value, (record, _ordinal, lexical) => {
        records.push(Object.freeze({ record, lexical }));
    });
    if (count < 2 || records.length < 2) fail(IMPORT_ERROR_CODE.FILE_EMPTY);

    const header = records[0];
    const columnCount = header.record.length;
    const resolved = resolveEnglishHeader(header.record);
    const headerSha256 = sha256Hex(header.lexical);
    return deepFreeze(records.slice(1).map(({ record, lexical }) => (
        JSON.stringify({
            schemaVersion: 1,
            profileId: ENGLISH_ACTIVITIES_CSV_PROFILE.id,
            columnCount,
            positions: resolved.positions,
            hasExtra: resolved.hasExtra,
            headerSha256,
            rowLexical: lexical,
            row: record
        })
    )));
}
